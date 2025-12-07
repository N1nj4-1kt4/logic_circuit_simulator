// Logic Circuit Simulator

// Import utilities
import {
    GATE_SIZES,
    COLORS,
    GRID_SIZE,
    PORT_RADIUS,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    FONTS,
    STORAGE_KEYS,
    GATE_TYPES,
    PORT_CONFIG
} from './src/constants.js';

import { eventBus, EVENT_TYPES } from './src/utils/eventBus.js';
import { logger } from './src/utils/logger.js';

import { findComponentAt, findPortAt, findConnectionAt, snapToGrid } from './src/utils/hitDetection.js';
import { generateNextBoardName } from './src/utils/naming.js';

import { LocalStorageAdapter } from './src/storage/LocalStorageAdapter.js';
import { BoardManager } from './src/storage/BoardManager.js';
import { ComponentLibrary } from './src/storage/ComponentLibrary.js';

import {
    calculateComponentValue,
    evaluateCustomComponent,
    calculateInternalComponentValue,
    getPortValue,
    getComponentValue
} from './src/core/circuitEvaluator.js';

import { CanvasRenderer } from './src/rendering/CanvasRenderer.js';

import { TruthTablePanel } from './src/ui/TruthTablePanel.js';
import { Toolbar } from './src/ui/Toolbar.js';
import { DialogManager } from './src/ui/DialogManager.js';
import { DialogFactory } from './src/ui/DialogFactory.js';
import { ThemeManager } from './src/ui/ThemeManager.js';

import { CircuitState } from './src/core/CircuitState.js';
import { CircuitError } from './src/core/errors.js';
import { CircuitValidityManager } from './src/core/CircuitValidityManager.js';
import { SimulationController } from './src/core/SimulationController.js';

// Refactored operations modules
import { CanvasOperations } from './src/core/CanvasOperations.js';
import { CircuitAnalysisManager } from './src/core/CircuitAnalysisManager.js';
import { ContextManager } from './src/core/ContextManager.js';
import { BoardOperations } from './src/core/BoardOperations.js';
import { ComponentLibraryOperations } from './src/core/ComponentLibraryOperations.js';
import { AutoSaveManager } from './src/core/AutoSaveManager.js';
import { UndoRedoManager } from './src/core/UndoRedoManager.js';

import { CanvasInteraction } from './src/interaction/CanvasInteraction.js';

import { messages } from './src/ui/messages.js';

class CircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('breadboard');
        this.ctx = this.canvas.getContext('2d');

        // Initialize centralized state container
        this.state = new CircuitState();

        // Initialize validity manager (tracks circuit validity state)
        this.validityManager = new CircuitValidityManager(this.state);

        // Initialize simulation controller (owns simulation lifecycle)
        this.simulationController = new SimulationController({
            circuitState: this.state,
            validityManager: this.validityManager
        });

        // Initialize storage system
        this.storageAdapter = new LocalStorageAdapter();
        this.boardManager = new BoardManager(this.storageAdapter);
        this.componentLibrary = new ComponentLibrary(this.storageAdapter);

        // Initialize theme manager (must be before renderer)
        this.themeManager = new ThemeManager({
            onThemeChange: (isDarkMode) => {
                this.canvasRenderer.setDarkMode(isDarkMode);
                this.redraw();
            }
        });

        // Initialize renderer (will be updated after components/connections are loaded)
        this.canvasRenderer = new CanvasRenderer(this.canvas, this.state.getComponents(), this.state.getConnections(), this.themeManager.isDark());

        // Initialize truth table panel
        this.truthTablePanel = null;

        // Initialize toolbar with callbacks
        this.toolbar = new Toolbar({
            onToolSelect: (tool) => this.handleToolSelect(tool),
            onModeChange: (mode) => this.handleModeChange(mode),
            onClearBoard: () => this.handleClearBoard(),
            onSimulate: () => this.toggleSimulation(),
            onTruthTable: () => this.handleTruthTable(),
            onSaveComponent: () => this.dialogManager.showSaveComponentDialog(),
            onManageComponents: () => this.dialogManager.showManageComponentsDialog(),
            onExportComponent: () => this.exportComponentToFile(),
            onImportComponent: () => this.handleImportComponent(),
            onNewBoard: () => this.handleNewBoard(),
            onSaveBoard: () => this.handleSaveBoard(),
            onLoadBoard: (boardName) => this.loadBoard(boardName),
            onSimulationStep: (direction) => this.handleSimulationStep(direction),
            onRevertToSaved: () => this.handleRevertToSaved(),
            hasUnsavedChanges: () => this.state.hasUnsavedChanges(),
            onUndo: () => this.handleUndo(),
            onRedo: () => this.handleRedo()
        });

        // Initialize dialog manager with callbacks
        this.dialogManager = new DialogManager({
            onSaveComponent: async (name, description) => await this.handleSaveComponent(name, description),
            onLoadComponentForEditing: (name) => this.loadComponentForEditing(name),
            onDownloadComponent: async (name) => await this.downloadComponent(name),
            onDeleteComponent: async (name) => await this.handleDeleteComponent(name),
            onRenameComplete: () => this.redraw(),
            onSaveCurrentBoard: async (name) => await this.saveCurrentBoard(name),
            onImportComponent: async (e) => await this.importComponentFromFile(e),
            getComponentLibrary: () => this.componentLibrary,
            getBoardManager: () => this.boardManager,
            getCurrentBoardName: () => this.state.getCurrentBoardName(),
            getCurrentComponentName: () => this.state.getCurrentComponentName(),
            getCustomComponents: () => this.state.getCustomComponents(),
            getSavedBoards: () => this.state.getSavedBoards(),
            getCircuitData: () => ({ components: this.state.getComponents(), connections: this.state.getConnections() }),
            getLastSavedState: () => this.state.getLastSavedState()
        });

        // Initialize refactored operations modules

        // 1. CircuitAnalysisManager (independent)
        this.circuitAnalysisManager = new CircuitAnalysisManager({
            state: this.state
        });

        // 2. ContextManager (needs circuitAnalysisManager)
        this.contextManager = new ContextManager({
            state: this.state,
            boardManager: this.boardManager,
            componentLibrary: this.componentLibrary,
            circuitAnalysisManager: this.circuitAnalysisManager
        });

        // 3. BoardOperations (needs contextManager)
        this.boardOperations = new BoardOperations({
            state: this.state,
            boardManager: this.boardManager,
            contextManager: this.contextManager
        });

        // 4. ComponentLibraryOperations (needs contextManager)
        this.componentLibraryOperations = new ComponentLibraryOperations({
            state: this.state,
            componentLibrary: this.componentLibrary,
            contextManager: this.contextManager
        });

        // 5. AutoSaveManager (independent)
        this.autoSaveManager = new AutoSaveManager({
            state: this.state,
            storage: this.storageAdapter
        });

        // 6. UndoRedoManager (independent)
        this.undoRedoManager = new UndoRedoManager({
            state: this.state,
            storage: this.storageAdapter
        });

        // 7. CanvasOperations (independent)
        this.canvasOperations = new CanvasOperations({
            state: this.state,
            callbacks: {
                defineComponentPorts: (component) => this.defineComponentPorts(component),
                findComponent: (x, y) => this.findComponent(x, y),
                findPort: (x, y) => this.findPort(x, y)
            }
        });

        // Create backward-compatible facade for this.operations
        this.operations = this._createOperationsFacade();

        this.init();
    }

    /**
     * Create a backward-compatible facade that delegates to new operation classes
     * @private
     */
    _createOperationsFacade() {
        return {
            // Canvas operations
            placeComponent: (...args) => this.canvasOperations.placeComponent(...args),
            handleConnect: (...args) => this.canvasOperations.handleConnect(...args),
            handleDelete: (...args) => this.canvasOperations.handleDelete(...args),
            checkDeletionImpact: (...args) => this.canvasOperations.checkDeletionImpact(...args),

            // Board operations
            saveCurrentBoard: (...args) => this.boardOperations.saveCurrentBoard(...args),
            loadBoard: (...args) => this.boardOperations.loadBoard(...args),
            createNewBoard: (...args) => this.boardOperations.createNewBoard(...args),
            deleteBoard: (...args) => this.boardOperations.deleteBoard(...args),

            // Component library operations
            saveComponent: (...args) => this.componentLibraryOperations.saveComponent(...args),
            loadComponentForEditing: (...args) => this.componentLibraryOperations.loadComponentForEditing(...args),
            deleteComponent: (...args) => this.componentLibraryOperations.deleteComponent(...args),
            exportComponent: (...args) => this.componentLibraryOperations.exportComponent(...args),
            importComponent: (...args) => this.componentLibraryOperations.importComponent(...args),

            // Circuit analysis operations
            recomputeAnalysis: () => this.circuitAnalysisManager.recomputeAnalysis(),

            // Auto-save operations
            setupAutoSave: () => this.autoSaveManager.setupAutoSave(),
            clearAutoSave: () => this.autoSaveManager.clearAutoSave(),
            saveBoardState: () => this.autoSaveManager.saveBoardState(),
            loadBoardState: () => this.autoSaveManager.loadBoardState(this.circuitAnalysisManager),
            clearBoardState: () => this.autoSaveManager.clearBoardState()
        };
    }

    async init() {
        await this.loadCustomComponents();
        await this.loadSavedBoards();
        this.setupEventListeners();

        // Initialize toolbar early so it can receive state change events
        this.toolbar.init();

        // Initialize dialog manager (after DOM is ready)
        this.dialogManager.init();

        // Truth table dragging now handled by TruthTablePanel + Interact.js
        this.autoSaveManager.setupAutoSave();
        await this.autoSaveManager.loadBoardState(this.circuitAnalysisManager);

        // Setup undo/redo manager (after toolbar so button states update correctly)
        this.undoRedoManager.setupListeners();
        await this.undoRedoManager.loadHistory(this.state.getCurrentBoardName());
        // Initialize lastKnownState after loading so first action can be undone
        this.undoRedoManager.initializeLastKnownState();

        // Update renderer with loaded components and connections
        this.canvasRenderer.updateComponents(this.state.getComponents());
        this.canvasRenderer.updateConnections(this.state.getConnections());
        this.canvasRenderer.render();

        // Restore truth table if it was visible
        const truthTablePanelState = this.state.getTruthTablePanelState();
        if (truthTablePanelState && truthTablePanelState.visible) {
            console.log('Restoring truth table from saved state...');
            this.generateTruthTable();
        }

        // Initialize canvas interaction layer
        this.canvasInteraction = new CanvasInteraction({
            canvas: this.canvas,
            state: this.state,
            canvasRenderer: this.canvasRenderer,
            callbacks: {
                onCanvasClick: (x, y) => this.handleCanvasClick(x, y),
                onCanvasDoubleClick: (x, y) => this.handleCanvasDoubleClick(x, y),
                findComponent: (x, y) => this.findComponent(x, y),
                moveComponent: (component, newX, newY) => this.moveComponent(component, newX, newY),
                redraw: () => this.redraw()
            }
        });
        this.canvasInteraction.init();

        // Update toolbar displays
        this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());
        this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
        this.toolbar.updateCircuitNameDisplay(
            this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
            !!this.state.getCurrentComponentName()
        );

        // Theme already applied by ThemeManager in constructor
    }

    // ====================================
    // Toolbar Handler Methods
    // ====================================

    handleToolSelect(tool) {
        this.state.setSelectedTool(tool);
    }

    handleModeChange(mode) {
        this.state.setMode(mode);
        this.state.setConnectStart(null);
        this.toolbar.setConnectionStart(false);
        this.redraw();
    }

    handleClearBoard() {
        // Check for unsaved changes before clearing
        if (this.state.hasUnsavedChanges()) {
            this.dialogManager.showSaveOptionsDialog(() => {
                this._clearBoardInternal();
            });
        } else {
            this._clearBoardInternal();
        }
    }

    _clearBoardInternal() {
        this.state.clearComponents();
        this.state.setCurrentBoardName(null);
        this.state.setCurrentComponentName(null);
        this.toolbar.updateCircuitNameDisplay(null, false);
        // Emit event to close truth table and notify other components
        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
        this.redraw();
    }

    // Helper method to update toolbar displays
    updateToolbarDisplays() {
        this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());
        this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
        this.toolbar.updateCircuitNameDisplay(
            this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
            !!this.state.getCurrentComponentName()
        );
    }

    handleTruthTable() {
        // Generate and show truth table
        this.generateTruthTable();
    }

    handleImportComponent() {
        // Trigger the hidden file input for component import
        console.log('handleImportComponent called');
        const fileInput = document.getElementById('importFile');
        console.log('File input element:', fileInput);
        if (fileInput) {
            console.log('Triggering file input click');
            fileInput.click();
        } else {
            console.error('importFile element not found in DOM');
        }
    }

    handleNewBoard() {
        // Save current board's history before creating new board
        const currentBoardName = this.state.getCurrentBoardName();

        this.operations.createNewBoard(
            (callback) => this.dialogManager.showSaveOptionsDialog(callback),
            async () => {
                // Save current board's history before switching
                await this.undoRedoManager.saveHistory(currentBoardName);
                // Clear history for the new unnamed board
                this.undoRedoManager.clearHistory();

                DialogFactory.showAlert({
                    message: messages.alerts.newBoardCreated,
                    type: 'success'
                });
            }
        );
    }

    handleSaveBoard() {
        // Show save options dialog to let user choose save method
        this.dialogManager.showSaveOptionsDialog(null);
    }

    handleRevertToSaved() {
        const success = this.boardOperations.revertToSaved();
        if (!success) {
            // No saved state to revert to - this shouldn't happen if button is properly disabled
            DialogFactory.showAlert({
                message: 'No saved version to revert to.',
                type: 'warning'
            });
        }
    }

    /**
     * Handle undo action
     */
    handleUndo() {
        const success = this.undoRedoManager.undo();
        if (success) {
            // Update renderer with restored state
            this.canvasRenderer.updateComponents(this.state.getComponents());
            this.canvasRenderer.updateConnections(this.state.getConnections());
            this.redraw();
        }
    }

    /**
     * Handle redo action
     */
    handleRedo() {
        const success = this.undoRedoManager.redo();
        if (success) {
            // Update renderer with restored state
            this.canvasRenderer.updateComponents(this.state.getComponents());
            this.canvasRenderer.updateConnections(this.state.getConnections());
            this.redraw();
        }
    }

    handleSimulationStep(direction) {
        try {
            if (direction === 'next') {
                this.simulationController.manualStep(1);
            } else if (direction === 'prev') {
                this.simulationController.manualStep(-1);
            } else if (direction === 'reset') {
                this.simulationController.reset();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    toggleSimulation() {
        try {
            if (this.simulationController.isRunning()) {
                this.simulationController.autocycleStop();
            } else {
                this.simulationController.autocycleStart();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    // ====================================
    // End of Toolbar Handler Methods
    // ====================================

    setupEventListeners() {
        // NOTE: Toolbar button event listeners now handled by Toolbar class
        // NOTE: Dialog event listeners now handled by DialogManager class
        // NOTE: Canvas event listeners now handled by CanvasInteraction class

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Skip shortcuts when typing in input fields
            const isTyping = e.target.matches('input, textarea');

            if (e.key === 'Escape') {
                this.toolbar.exitToNeutralMode();
            } else if (e.key === '?' && !isTyping) {
                // Open help dialog with '?' key (if not typing in an input field)
                this.dialogManager.showHelpDialog();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isTyping) {
                // Ctrl+Z or Cmd+Z - Undo
                e.preventDefault();
                this.handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey && !isTyping) {
                // Ctrl+Shift+Z or Cmd+Shift+Z - Redo
                e.preventDefault();
                this.handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isTyping) {
                // Ctrl+Y or Cmd+Y - Redo (alternative)
                e.preventDefault();
                this.handleRedo();
            }
        });

        // Help button click handler
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            this.dialogManager.showHelpDialog();
        });

        // Event bus listener for mode exit request (from right-click)
        eventBus.on(EVENT_TYPES.MODE_EXIT_REQUEST, () => {
            console.log('Right-click detected - exiting to neutral mode');
            this.toolbar.exitToNeutralMode();
        });

        // Canvas redraw event
        eventBus.on(EVENT_TYPES.CANVAS_REDRAW, () => {
            this.redraw();
        });

        // Toolbar update displays event
        eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, () => {
            this.updateToolbarDisplays();
        });

        // Circuit analysis computed event - refresh panel when analysis is updated
        eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, (data) => {
            logger.debug('[circuit-simulator] Received CIRCUIT_ANALYSIS_COMPUTED, calling truthTablePanel.refresh()');
            if (this.truthTablePanel) {
                this.truthTablePanel.refresh();
            }
        });

        // Auto-cycle state changes (play/stop button, enable/disable step buttons)
        eventBus.on(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, (data) => {
            this.toolbar.setAutocycleState(data.state);
        });

        // Step progress changes (step counter) - fires for ALL simulation types
        eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, (data) => {
            this.toolbar.setSimulationProgress(data.cycleIndex, data.totalCombinations);
        });

        // Connection start changed event
        eventBus.on(EVENT_TYPES.CONNECTION_START_CHANGED, (hasStart) => {
            this.toolbar.setConnectionStart(hasStart);
        });

        // Board cleared event - destroy truth table to avoid stale data
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, () => {
            if (this.truthTablePanel) {
                console.log('BOARD_CLEARED: Destroying truth table panel');
                this.truthTablePanel.hide();
                this.truthTablePanel.destroy();
                // Don't remove the panel from DOM - it's part of static HTML and should remain
                // Just destroy the TruthTablePanel object so it's regenerated with new board data
                this.truthTablePanel = null;
                // Clear truth table panel state for this board
                this.state.setTruthTablePanelState(null);
                console.log('Truth table panel destroyed and state cleared');
            }
            // Reset the DOM panel's inline styles to prevent stale dimensions
            // affecting new boards (DOM element persists, JS object is destroyed)
            const panel = document.getElementById('truthTablePanel');
            if (panel) {
                panel.style.width = '';
                panel.style.height = '';
                panel.style.transform = '';
                panel.removeAttribute('data-x');
                panel.removeAttribute('data-y');
            }
        });

        // Board loaded event - destroy truth table to avoid stale data
        eventBus.on(EVENT_TYPES.BOARD_LOADED, () => {
            // Read the loaded board's truth table panel state BEFORE destroying panel
            // (hide() would overwrite the state with current position)
            const truthTablePanelState = this.state.getTruthTablePanelState();

            if (this.truthTablePanel) {
                // Don't call hide() here - it would save current position and overwrite the loaded state
                // Just destroy the panel directly
                this.truthTablePanel.destroy();
                this.truthTablePanel = null;
            }
            // Reset the DOM panel's inline styles to prevent stale dimensions
            // The loaded board's saved state (if any) will be applied when the panel is opened
            const panel = document.getElementById('truthTablePanel');
            if (panel) {
                panel.style.width = '';
                panel.style.height = '';
                panel.style.transform = '';
                panel.style.opacity = '0';
                panel.style.display = 'none';
                panel.classList.add('hidden');
                panel.removeAttribute('data-x');
                panel.removeAttribute('data-y');
            }

            // Restore truth table if it was visible in the loaded board
            // setState() in generateTruthTable() will set _isRestoring flag
            if (truthTablePanelState && truthTablePanelState.visible) {
                this.generateTruthTable();
            }
        });

        // NOTE: Theme toggle now handled by ThemeManager class
    }

    handleCanvasClick(x, y) {
        console.log('Canvas click - Mode:', this.state.getMode(), 'SelectedTool:', this.state.getSelectedTool());
        console.log('Scaled coords:', x.toFixed(0), y.toFixed(0));

        try {
            if (this.state.getMode() === 'place' && this.state.getSelectedTool()) {
                this.operations.placeComponent(x, y, this.state.getSelectedTool());
            } else if (this.state.getMode() === 'connect') {
                console.log('Calling handleConnect');
                this.operations.handleConnect(x, y);
            } else if (this.state.getMode() === 'delete') {
                console.log('Calling handleDelete');
                const impact = this.operations.checkDeletionImpact(x, y, (x, y) => this.findConnection(x, y));

                if (impact.willInvalidate) {
                    // Show warning dialog before deleting
                    DialogFactory.showConfirm({
                        message: messages.confirms.deletionWillStopSimulation.message,
                        title: messages.confirms.deletionWillStopSimulation.title,
                        confirmLabel: messages.confirms.deletionWillStopSimulation.confirmLabel,
                        cancelLabel: messages.confirms.deletionWillStopSimulation.cancelLabel,
                        type: 'warning',
                        onConfirm: () => {
                            // Stop simulation and reset inputs (but don't simulate yet)
                            this.simulationController.reset({ skipSimulate: true });
                            // Commit the transaction to apply the deletion
                            this.operations.handleDelete(x, y, null, { transaction: impact.transaction });
                            // Now simulate to update component values after deletion
                            // This ensures disconnected outputs and their wires turn gray
                            this.simulationController.onToggleInput();
                        }
                    });
                } else if (impact.transaction) {
                    // Use transaction if available (component or connection found)
                    this.operations.handleDelete(x, y, null, { transaction: impact.transaction });
                }
            } else {
                // Check if clicking on an input to toggle
                this.toggleInput(x, y);
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    // placeComponent moved to CircuitOperations

    defineComponentPorts(component) {
        const { type, x, y } = component;

        if (type === 'INPUT') {
            // Input circle has radius 20, shift port 3px outside edge
            component.outputs.push({ x: x + 23, y: y });
        } else if (type === 'OUTPUT') {
            // Output circle has radius 20, port 2px outside left edge
            component.inputs.push({ x: x - 22, y: y });
        } else if (type === 'NOT') {
            // NOT gate: input 2px outside, output 3px outside
            component.inputs.push({ x: x - 22, y: y });
            component.outputs.push({ x: x + 28, y: y });
        } else if (type === 'NAND' || type === 'NOR' || type === 'XNOR') {
            // Inverted gates: inputs 2px outside, output 3px outside
            component.inputs.push({ x: x - 27, y: y - 15 });
            component.inputs.push({ x: x - 27, y: y + 15 });
            component.outputs.push({ x: x + 33, y: y });
        } else if (type === 'CUSTOM') {
            // Custom component ports (90x90 size - 15% larger for better visibility)
            const def = component.customDefinition;
            const numInputs = def.inputPorts.length;
            const numOutputs = def.outputPorts.length;

            // Calculate spacing for ports (based on 90x90 size)
            const inputSpacing = Math.min(40, 90 / (numInputs + 1));
            const outputSpacing = Math.min(40, 90 / (numOutputs + 1));

            // Create input ports 2px outside left edge (rect is from x - 45 to x + 45)
            for (let i = 0; i < numInputs; i++) {
                const offsetY = (i - (numInputs - 1) / 2) * inputSpacing;
                component.inputs.push({ x: x - 47, y: y + offsetY });
            }

            // Create output ports 3px outside right edge
            for (let i = 0; i < numOutputs; i++) {
                const offsetY = (i - (numOutputs - 1) / 2) * outputSpacing;
                component.outputs.push({ x: x + 48, y: y + offsetY });
            }
        } else {
            // AND, OR, XOR gates (non-inverted): inputs 2px outside, output 3px outside
            component.inputs.push({ x: x - 27, y: y - 15 });
            component.inputs.push({ x: x - 27, y: y + 15 });
            component.outputs.push({ x: x + 23, y: y });
        }
    }

    moveComponent(component, newX, newY) {
        // Update component position (snap to grid)
        const oldX = component.x;
        const oldY = component.y;
        const snapped = snapToGrid(newX, newY);
        component.x = snapped.x;
        component.y = snapped.y;

        // Clear and recalculate ports
        component.inputs = [];
        component.outputs = [];
        this.defineComponentPorts(component);

        // Emit event if position actually changed
        if (oldX !== component.x || oldY !== component.y) {
            eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, {
                component,
                oldState: { x: oldX, y: oldY },
                updates: { x: component.x, y: component.y }
            });
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
        }
    }

    // handleConnect moved to CircuitOperations

    // handleDelete moved to CircuitOperations

    toggleInput(x, y) {
        const component = this.findComponent(x, y);
        if (component && component.type === 'INPUT') {
            component.value = component.value === 0 ? 1 : 0;
            this.simulationController.onToggleInput();
        }
    }

    findComponent(x, y) {
        return findComponentAt(this.state.getComponents(), x, y);
    }

    // Recalculate port positions for a component (for migrating old saved boards)
    recalculateComponentPorts(component) {
        // Clear existing ports
        component.inputs = [];
        component.outputs = [];

        // Recalculate using current logic
        this.defineComponentPorts(component);
    }

    // Migrate all components in a board to use current port positions
    migrateComponentPorts() {
        const components = this.state.getComponents();
        components.forEach(component => {
            this.recalculateComponentPorts(component);
        });
    }

    findPort(x, y) {
        return findPortAt(this.state.getComponents(), x, y);
    }

    findConnection(x, y) {
        return findConnectionAt(
            this.state.getConnections(),
            this.state.getComponents(),
            x, y
        );
    }

    redraw() {
        // Update renderer with current components and connections
        this.canvasRenderer.updateComponents(this.state.getComponents());
        this.canvasRenderer.updateConnections(this.state.getConnections());
        this.canvasRenderer.render();
    }

    simulate() {
        this.simulationController.onToggleInput();
    }

    generateTruthTable() {
        // Initialize truth table panel if not already created OR if DOM was removed
        const needsNewPanel = !this.truthTablePanel ||
                             (this.truthTablePanel.panel && !document.body.contains(this.truthTablePanel.panel));

        if (needsNewPanel) {
            this.truthTablePanel = new TruthTablePanel(
                this.canvas,
                this.state.getComponents(),
                this.state.getConnections(),
                this.state
            );

            // Hook up state persistence
            this.truthTablePanel.onStateChange = (state) => {
                this.state.setTruthTablePanelState(state);
                // Event system will trigger auto-save via TRUTH_TABLE_PANEL_STATE_CHANGED event
            };

            // Restore saved state if available (position, size, etc.)
            // setState() sets _isRestoring flag to skip saveState() during initial display
            const truthTablePanelState = this.state.getTruthTablePanelState();
            if (truthTablePanelState) {
                this.truthTablePanel.setState(truthTablePanelState);
            }
        }

        // Show truth table (reuses existing table if available, or builds new one)
        this.truthTablePanel.show();
    }

    // Old truth table methods removed - now handled by TruthTablePanel class
    // (displayTruthTable, setupTruthTableDragDrop, setupTruthTableResize, saveTruthTableState, restoreTruthTableState)

    getCurrentInputState() {
        // Get current input values sorted by label (same order as truth table)
        const components = this.state.getComponents();
        const inputs = components
            .filter(c => c.type === 'INPUT')
            .sort((a, b) => a.label.localeCompare(b.label));

        return inputs.map(input => input.value);
    }

    findMatchingTruthTableRow() {
        const circuitAnalysis = this.state.getCircuitAnalysis();
        if (!circuitAnalysis) {
            return -1; // No circuit analysis computed yet
        }

        const currentState = this.getCurrentInputState();

        // Check if circuit is in active state (all inputs have valid values)
        if (currentState.some(val => val === null || val === undefined)) {
            return -1; // Circuit not in active state
        }

        // Find the row that matches current input state
        return circuitAnalysis.table.findIndex(row => {
            return row.inputs.every((val, index) => val === currentState[index]);
        });
    }

    // startAutoCycle, stopAutoCycle, autoCycleStep moved to CircuitOperations
    // These are now called through toggleSimulation and handleSimulationStep handlers

    // Custom Component Management Methods
    async loadCustomComponents() {
        const customComponents = await this.componentLibrary.getAllComponents();
        this.state.setCustomComponents(customComponents);
    }

    async saveCustomComponentsToStorage() {
        // DEPRECATED: Components are now saved through ComponentLibrary
        // This method kept for backward compatibility but does nothing
        console.warn('saveCustomComponentsToStorage() is deprecated, components are saved automatically through ComponentLibrary');
    }

    /**
     * Handle saving component - callback for DialogManager
     */
    async handleSaveComponent(name, description) {
        try {
            const savedName = await this.operations.saveComponent(name, description);
            DialogFactory.showAlert({
                message: messages.alerts.componentSaved(savedName),
                type: 'success'
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Handle deleting component - callback for DialogManager
     */
    async handleDeleteComponent(name) {
        await this.operations.deleteComponent(name);
    }

    // Export/Import Methods
    async exportComponentToFile() {
        // Use DialogManager to show export dialog
        this.dialogManager.showExportComponentDialog();
    }

    async downloadComponent(name) {
        try {
            const exportedName = await this.operations.exportComponent(name);
            DialogFactory.showAlert({
                message: messages.alerts.componentExported(exportedName),
                type: 'success'
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    async importComponentFromFile(event) {
        try {
            const importedName = await this.operations.importComponent(event);
            if (importedName) {
                DialogFactory.showAlert({
                    message: messages.alerts.componentImported(importedName),
                    type: 'success'
                });
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    // Edit Component Method
    async loadComponentForEditing(name) {
        try {
            const loadedName = await this.operations.loadComponentForEditing(name);
            DialogFactory.showAlert({
                message: messages.alerts.componentLoadedForEditing(loadedName),
                type: 'success'
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    // stepSimulation and resetSimulation moved to CircuitOperations
    // These are now called through handleSimulationStep handler

    // Rename Methods
    handleCanvasDoubleClick(x, y) {
        const component = this.findComponent(x, y);

        if (component && (component.type === 'INPUT' || component.type === 'OUTPUT')) {
            this.dialogManager.showRenameDialog(component);
        }
    }

    // Theme Management Methods
    // Theme management methods removed - now handled by ThemeManager class

    // Draggable Truth Table
    // setupDraggableTruthTable removed - now handled by TruthTablePanel + Interact.js

    // setupAutoSave, saveBoardState, loadBoardState, clearBoardState moved to CircuitOperations

    // ===== BOARD MANAGEMENT METHODS =====

    async loadSavedBoards() {
        const savedBoards = await this.boardManager.getAllBoards();
        this.state.setSavedBoards(savedBoards);
    }

    async saveBoardsToStorage() {
        // DEPRECATED: Boards are now saved through BoardManager
        // This method kept for backward compatibility but does nothing
        console.warn('saveBoardsToStorage() is deprecated, boards are saved automatically through BoardManager');
    }

    getNextBoardName() {
        const savedBoards = this.state.getSavedBoards();
        const customComponents = this.state.getCustomComponents();
        const allNames = [...Object.keys(savedBoards), ...Object.keys(customComponents)];
        return generateNextBoardName(allNames);
    }

    getCurrentState() {
        return this.state.getCurrentState();
    }

    hasUnsavedChanges() {
        return this.state.hasUnsavedChanges();
    }

    async saveCurrentBoard(boardName) {
        try {
            const oldBoardName = this.state.getCurrentBoardName();
            const savedName = await this.operations.saveCurrentBoard(boardName);

            // Handle undo/redo history based on save type
            if (oldBoardName === null && savedName) {
                // Unnamed → Named (first save): Migrate history to new board name
                await this.undoRedoManager.onBoardSwitch(null, savedName, true);
            } else if (oldBoardName !== savedName) {
                // Named → Different Name (Save As): New board starts with empty history
                await this.undoRedoManager.onSaveAs(oldBoardName, savedName);
            }
            // Named → Same Name (update): History is preserved (no action needed)

            DialogFactory.showAlert({
                message: messages.alerts.boardSaved(savedName),
                type: 'success'
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    async loadBoard(boardName) {
        // Check for unsaved changes before loading
        const hasChanges = this.state.hasUnsavedChanges();
        if (hasChanges) {
            this.dialogManager.showSaveOptionsDialog(async () => {
                // User chose to proceed (either saved or discarded)
                await this._loadBoardInternal(boardName);
            });
        } else {
            await this._loadBoardInternal(boardName);
        }
    }

    async _loadBoardInternal(boardName) {
        try {
            // Save current board's undo/redo history before switching
            const currentBoardName = this.state.getCurrentBoardName();
            await this.undoRedoManager.saveHistory(currentBoardName);

            const loadedName = await this.operations.loadBoard(boardName);

            // Load the new board's undo/redo history and initialize lastKnownState
            await this.undoRedoManager.loadHistory(loadedName);
            this.undoRedoManager.initializeLastKnownState();

            DialogFactory.showAlert({
                message: messages.alerts.boardLoaded(loadedName),
                type: 'success'
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    // createNewBoard now called through operations.createNewBoard in handleNewBoard

    async deleteBoard(boardName) {
        // Show confirmation dialog (UI concern belongs in coordinator)
        DialogFactory.showConfirm({
            message: messages.confirms.deleteBoard(boardName),
            type: 'warning',
            onConfirm: async () => {
                try {
                    const deletedName = await this.operations.deleteBoard(boardName);
                    DialogFactory.showAlert({
                        message: messages.alerts.boardDeleted(deletedName),
                        type: 'success'
                    });
                } catch (error) {
                    this._handleError(error);
                }
            }
        });
    }

    /**
     * Central error handler for operations
     * Maps error types to appropriate user-facing messages
     * @private
     */
    _handleError(error) {
        // Log all errors for debugging
        console.error('Operation error:', error);

        // Handle CircuitError subclasses with their built-in type
        if (error instanceof CircuitError) {
            DialogFactory.showAlert({
                message: error.message,
                type: error.type
            });
            return;
        }

        // Map known error names to user-friendly messages
        const errorMessages = {
            'NoInputsError': messages.alerts.noInputsToSimulate,
            'NoOutputsError': messages.alerts.noOutputsToSimulate,
            'EmptyCircuitError': messages.alerts.emptyCircuit,
            'BoardNameRequiredError': messages.alerts.boardNameRequired,
            'ComponentNotFoundError': messages.alerts.customComponentNotFound,
            'InvalidComponentFileError': messages.alerts.invalidComponentFile,
            'BoardLoadError': (err) => messages.alerts.boardLoadFailed(err.boardName || 'unknown'),
            'BoardSaveError': messages.alerts.boardSaveFailed,
            'ComponentSaveError': messages.alerts.componentSaveFailed,
            'ImportExportError': messages.alerts.componentImportFailed,
            'ComponentExistsError': (err) => messages.alerts.componentNameConflict(err.componentName)
        };

        const messageOrFn = errorMessages[error.name];
        if (messageOrFn) {
            const message = typeof messageOrFn === 'function' ? messageOrFn(error) : messageOrFn;
            DialogFactory.showAlert({
                message,
                type: error.type || 'error'
            });
        } else {
            // Fallback for unknown errors
            DialogFactory.showAlert({
                message: error.message || 'An unexpected error occurred.',
                type: 'error'
            });
        }
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
