// Logic Circuit Simulator

// Import utilities
import {
    GATE_SIZES,
    HIT_DETECTION_SIZES,
    COLORS,
    GRID_SIZE,
    PORT_RADIUS,
    PORT_DETECTION_RADIUS,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    FONTS,
    STORAGE_KEYS,
    GATE_TYPES,
    PORT_CONFIG
} from './src/constants.js';

import { eventBus, EVENT_TYPES } from './src/utils/eventBus.js';

import { distanceToLine } from './src/utils/geometry.js';

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
import { CircuitOperations } from './src/core/CircuitOperations.js';

import { CanvasInteraction } from './src/interaction/CanvasInteraction.js';

class CircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('breadboard');
        this.ctx = this.canvas.getContext('2d');

        // Initialize centralized state container
        this.state = new CircuitState();

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
            onSimulationStep: (direction) => this.handleSimulationStep(direction)
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
            getCircuitData: () => ({ components: this.state.getComponents(), connections: this.state.getConnections() })
        });

        // Initialize circuit operations (business logic layer)
        this.operations = new CircuitOperations({
            state: this.state,
            boardManager: this.boardManager,
            componentLibrary: this.componentLibrary,
            callbacks: {
                redraw: () => this.redraw(),
                defineComponentPorts: (component) => this.defineComponentPorts(component),
                findComponent: (x, y) => this.findComponent(x, y),
                findPort: (x, y) => this.findPort(x, y)
            }
        });

        this.init();
    }

    async init() {
        await this.loadCustomComponents();
        await this.loadSavedBoards();
        this.setupEventListeners();
        // Truth table dragging now handled by TruthTablePanel + Interact.js
        this.operations.setupAutoSave();
        await this.operations.loadBoardState();
        // Update renderer with loaded components and connections
        this.canvasRenderer.updateComponents(this.state.getComponents());
        this.canvasRenderer.updateConnections(this.state.getConnections());
        this.canvasRenderer.render();

        // Restore truth table if it was visible
        const truthTableState = this.state.getTruthTableState();
        if (truthTableState && truthTableState.visible) {
            console.log('Restoring truth table from saved state...');
            this.generateTruthTable();
        }

        // Initialize toolbar (after DOM is ready)
        this.toolbar.init();

        // Initialize dialog manager (after DOM is ready)
        this.dialogManager.init();

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
        this.dialogManager.showSaveOptionsDialog(() => {
            this.state.clearComponents();
            this.state.setCurrentBoardName(null);
            this.state.setCurrentComponentName(null);
            this.toolbar.updateCircuitNameDisplay(null, false);
            // Emit event to close truth table and notify other components
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
            this.redraw();
        });
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
        this.operations.createNewBoard(
            (callback) => this.dialogManager.showSaveOptionsDialog(callback)
        );
    }

    handleSaveBoard() {
        // Show save options dialog to let user choose save method
        this.dialogManager.showSaveOptionsDialog(null);
    }

    handleSimulationStep(direction) {
        if (direction === 'next') {
            this.operations.stepSimulation(1);
        } else if (direction === 'prev') {
            this.operations.stepSimulation(-1);
        } else if (direction === 'reset') {
            this.operations.resetSimulation();
        }
    }

    toggleSimulation() {
        if (this.state.isAutoCyclingActive()) {
            this.operations.stopAutoCycle();
        } else {
            this.operations.startAutoCycle();
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
            if (e.key === 'Escape') {
                this.toolbar.exitToNeutralMode();
            } else if (e.key === '?' && !e.target.matches('input, textarea')) {
                // Open help dialog with '?' key (if not typing in an input field)
                this.dialogManager.showHelpDialog();
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

        // Truth table update highlight event
        eventBus.on(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT, () => {
            this.updateTruthTableHighlight();
        });

        // Simulation state changed event
        eventBus.on(EVENT_TYPES.SIMULATION_STATE_CHANGED, (data) => {
            this.toolbar.setSimulationState(data.isRunning, data.currentIndex, data.totalCombinations);
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
                // Don't remove the panel from DOM - it's part of static HTML and should remain
                // Just destroy the TruthTablePanel object so it's regenerated with new board data
                this.truthTablePanel = null;
                // Clear truth table state for this board
                this.state.setTruthTableState(null);
                console.log('Truth table panel destroyed and state cleared');
            }
        });

        // Board loaded event - destroy truth table to avoid stale data
        eventBus.on(EVENT_TYPES.BOARD_LOADED, () => {
            if (this.truthTablePanel) {
                console.log('BOARD_LOADED: Destroying truth table panel');
                this.truthTablePanel.hide();
                // Don't remove the panel from DOM - it's part of static HTML and should remain
                // Just destroy the TruthTablePanel object so it's regenerated with new board data
                this.truthTablePanel = null;
                // Note: Don't clear state here - board might have saved truth table state
                console.log('Truth table panel destroyed');
            }
        });

        // NOTE: Theme toggle now handled by ThemeManager class
    }

    handleCanvasClick(x, y) {
        console.log('Canvas click - Mode:', this.state.getMode(), 'SelectedTool:', this.state.getSelectedTool());
        console.log('Scaled coords:', x.toFixed(0), y.toFixed(0));

        if (this.state.getMode() === 'place' && this.state.getSelectedTool()) {
            this.operations.placeComponent(x, y, this.state.getSelectedTool());
        } else if (this.state.getMode() === 'connect') {
            console.log('Calling handleConnect');
            this.operations.handleConnect(x, y);
        } else if (this.state.getMode() === 'delete') {
            console.log('Calling handleDelete');
            this.operations.handleDelete(x, y, (x, y) => this.findConnection(x, y));
        } else {
            // Check if clicking on an input to toggle
            this.toggleInput(x, y);
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
        component.x = Math.round(newX / 50) * 50;
        component.y = Math.round(newY / 50) * 50;

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
            this.operations.simulate();
        }
    }

    findComponent(x, y) {
        const components = this.state.getComponents();
        return components.find(c => {
            let size = 50; // Increased default size for better detection
            if (c.type === 'INPUT' || c.type === 'OUTPUT') {
                size = 40; // Increased from 30 to cover full circle
            } else if (c.type === 'CUSTOM') {
                size = 100; // Updated for new 90x90 component size
            } else if (c.type === 'NOT') {
                size = 50; // NOT gates are smaller
            } else {
                // Logic gates (AND, OR, XOR, NAND, NOR, XNOR)
                size = 60; // Increased to cover full gate shape
            }
            return x >= c.x - size/2 && x <= c.x + size/2 &&
                   y >= c.y - size/2 && y <= c.y + size/2;
        });
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
        const components = this.state.getComponents();
        for (let component of components) {
            // Check output ports
            for (let i = 0; i < component.outputs.length; i++) {
                const port = component.outputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < 10) {
                    return { component: component.id, portIndex: i, isOutput: true, x: port.x, y: port.y };
                }
            }

            // Check input ports
            for (let i = 0; i < component.inputs.length; i++) {
                const port = component.inputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < 10) {
                    return { component: component.id, portIndex: i, isOutput: false, x: port.x, y: port.y };
                }
            }
        }
        return null;
    }

    findConnection(x, y) {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();
        for (let conn of connections) {
            const from = components.find(c => c.id === conn.from);
            const to = components.find(c => c.id === conn.to);
            if (!from || !to) continue;

            const fromPort = from.outputs[conn.fromPort];
            const toPort = to.inputs[conn.toPort];

            // Simple distance check to connection line
            const dist = distanceToLine(x, y, fromPort.x, fromPort.y, toPort.x, toPort.y);
            if (dist < 5) {
                return conn;
            }
        }
        return null;
    }

    redraw() {
        // Update renderer with current components and connections
        this.canvasRenderer.updateComponents(this.state.getComponents());
        this.canvasRenderer.updateConnections(this.state.getConnections());
        this.canvasRenderer.render();
    }

    simulate() {
        this.operations.simulate();
    }

    generateTruthTable() {
        console.log('generateTruthTable called, current panel:', this.truthTablePanel);
        // Initialize truth table panel if not already created OR if DOM was removed
        const needsNewPanel = !this.truthTablePanel ||
                             (this.truthTablePanel.panel && !document.body.contains(this.truthTablePanel.panel));

        if (needsNewPanel) {
            if (this.truthTablePanel) {
                console.log('Panel exists but DOM was removed, creating new one...');
            } else {
                console.log('Creating new TruthTablePanel...');
            }
            this.truthTablePanel = new TruthTablePanel(
                this.canvas,
                this.state.getComponents(),
                this.state.getConnections(),
                this.state
            );
            console.log('TruthTablePanel created:', this.truthTablePanel);

            // Hook up state persistence
            this.truthTablePanel.onStateChange = (state) => {
                this.state.setTruthTableState(state);
                // Event system will trigger auto-save via TRUTH_TABLE_STATE_CHANGED event
            };

            // Restore saved state if available (position, size, etc.)
            const truthTableState = this.state.getTruthTableState();
            if (truthTableState) {
                console.log('Restoring truth table UI state:', truthTableState);
                this.truthTablePanel.setState(truthTableState);
            }
        } else {
            console.log('Reusing existing TruthTablePanel');
        }

        // Generate and display truth table
        console.log('Calling generate()...');
        const success = this.truthTablePanel.generate();
        console.log('Generate returned:', success);
        if (success) {
            console.log('Calling display()...');
            this.truthTablePanel.display();

            // Store reference for backward compatibility
            this.state.setTruthTableData(this.truthTablePanel.truthTableData);
        } else {
            console.error('Failed to generate truth table');
        }
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
        const truthTableData = this.state.getTruthTableData();
        if (!truthTableData) {
            return -1; // No truth table generated yet
        }

        const currentState = this.getCurrentInputState();

        // Check if circuit is in active state (all inputs have valid values)
        if (currentState.some(val => val === null || val === undefined)) {
            return -1; // Circuit not in active state
        }

        // Find the row that matches current input state
        return truthTableData.table.findIndex(row => {
            return row.inputs.every((val, index) => val === currentState[index]);
        });
    }

    updateTruthTableHighlight() {
        if (this.truthTablePanel) {
            this.truthTablePanel.updateHighlight();
        }
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
        await this.operations.saveComponent(name, description);
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
        await this.operations.exportComponent(name);
    }

    async importComponentFromFile(event) {
        await this.operations.importComponent(event);
    }

    // Edit Component Method
    async loadComponentForEditing(name) {
        await this.operations.loadComponentForEditing(name);
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
        let counter = 1;
        let name;
        const savedBoards = this.state.getSavedBoards();
        const customComponents = this.state.getCustomComponents();
        do {
            name = `Board${String(counter).padStart(2, '0')}`;
            counter++;
        } while (savedBoards[name] || customComponents[name]);
        return name;
    }

    getCurrentState() {
        return this.state.getCurrentState();
    }

    hasUnsavedChanges() {
        return this.state.hasUnsavedChanges();
    }

    async saveCurrentBoard(boardName) {
        // CircuitOperations.saveCurrentBoard already updates saved boards list
        await this.operations.saveCurrentBoard(boardName);
    }

    async loadBoard(boardName) {
        await this.operations.loadBoard(boardName);
    }

    // createNewBoard now called through operations.createNewBoard in handleNewBoard

    async deleteBoard(boardName) {
        await this.operations.deleteBoard(boardName);
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
