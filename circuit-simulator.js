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

import {
    pointDistance,
    distanceToLine,
    getComponentsBoundingBox,
    calculateRectOverlap,
    pointInRect,
    rectsIntersect
} from './src/utils/geometry.js';

import { positionPanelSmartly } from './src/utils/positioning.js';

import {
    deepClone,
    exportToJSON,
    importFromJSON,
    validateComponentData,
    validateCircuitData
} from './src/utils/serialization.js';

import { LocalStorageAdapter } from './src/storage/LocalStorageAdapter.js';
import { BoardManager } from './src/storage/BoardManager.js';
import { ComponentLibrary } from './src/storage/ComponentLibrary.js';

import { evaluateGate } from './src/core/gateLogic.js';

import {
    simulateCircuit,
    calculateComponentValue,
    evaluateCustomComponent,
    calculateInternalComponentValue,
    getPortValue,
    getComponentValue,
    getInputCount,
    getOutputCount
} from './src/core/circuitEvaluator.js';

import { CanvasRenderer } from './src/rendering/CanvasRenderer.js';

import { TruthTablePanel } from './src/ui/TruthTablePanel.js';
import { Toolbar } from './src/ui/Toolbar.js';
import { DialogManager } from './src/ui/DialogManager.js';
import { DialogFactory } from './src/ui/DialogFactory.js';
import { ThemeManager } from './src/ui/ThemeManager.js';

import { CircuitState } from './src/core/CircuitState.js';

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

        this.init();
    }

    async init() {
        await this.loadCustomComponents();
        await this.loadSavedBoards();
        this.setupEventListeners();
        // Truth table dragging now handled by TruthTablePanel + Interact.js
        this.setupAutoSave();
        await this.loadBoardState();
        // Update renderer with loaded components and connections
        this.canvasRenderer.updateComponents(this.state.getComponents());
        this.canvasRenderer.updateConnections(this.state.getConnections());
        this.canvasRenderer.render();

        // Initialize toolbar (after DOM is ready)
        this.toolbar.init();

        // Initialize dialog manager (after DOM is ready)
        this.dialogManager.init();

        // Update toolbar displays
        this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());
        this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
        this.toolbar.updateCircuitNameDisplay(
            this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
            !!this.state.getCurrentComponentName()
        );

        // Theme already applied by ThemeManager in constructor
    }

    getScaledCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
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
            this.redraw();
        });
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
        this.createNewBoard();
    }

    handleSaveBoard() {
        // Show save options dialog to let user choose save method
        this.dialogManager.showSaveOptionsDialog(null);
    }

    handleSimulationStep(direction) {
        if (direction === 'next') {
            this.stepSimulation(1);
        } else if (direction === 'prev') {
            this.stepSimulation(-1);
        } else if (direction === 'reset') {
            this.resetSimulation();
        }
    }

    toggleSimulation() {
        if (this.state.isAutoCyclingActive()) {
            this.stopAutoCycle();
        } else {
            this.startAutoCycle();
        }
    }

    // ====================================
    // End of Toolbar Handler Methods
    // ====================================

    setupEventListeners() {
        // NOTE: Toolbar button event listeners now handled by Toolbar class
        // NOTE: Dialog event listeners now handled by DialogManager class

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toolbar.exitToNeutralMode();
            } else if (e.key === '?' && !e.target.matches('input, textarea')) {
                // Open help dialog with '?' key (if not typing in an input field)
                this.dialogManager.showHelpDialog();
            }
        });

        // Right-click on canvas to exit mode
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent context menu
            e.stopPropagation();
            console.log('Right-click detected - exiting to neutral mode');
            this.toolbar.exitToNeutralMode();
            return false;
        });

        // NOTE: Theme toggle now handled by ThemeManager class

        // Canvas click
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        // Canvas double-click for rename
        this.canvas.addEventListener('dblclick', (e) => {
            this.handleCanvasDoubleClick(e);
        });

        // Canvas mousedown for dragging
        this.canvas.addEventListener('mousedown', (e) => {
            const { x, y } = this.getScaledCoordinates(e);

            // Reset hasMoved flag for all clicks
            this.state.setHasMoved(false);

            // Only allow dragging if not in special modes and no tool selected for placement
            const isPlacementMode = this.state.getMode() === 'place' && this.state.getSelectedTool();
            if (this.state.getMode() !== 'connect' && this.state.getMode() !== 'delete' && !isPlacementMode) {
                const component = this.findComponent(x, y);
                if (component) {
                    // If a component is clicked, prepare for potential drag
                    this.state.setDraggingState(false); // Don't set true yet
                    this.state.setDraggedComponent(component);
                    this.state.setDragStartPos({ x, y });
                    const dragOffset = this.state.getDragOffset();
                    dragOffset.x = x - component.x;
                    dragOffset.y = y - component.y;
                    this.state.setDragOffset(dragOffset);
                }
            }
        });

        // Canvas mousemove for dragging and connection preview
        this.canvas.addEventListener('mousemove', (e) => {
            const { x, y } = this.getScaledCoordinates(e);

            // Check if we should start dragging (movement threshold)
            const draggedComponent = this.state.getDraggedComponent();
            const dragStartPos = this.state.getDragStartPos();
            if (draggedComponent && !this.state.isDragging() && dragStartPos) {
                const dx = Math.abs(x - dragStartPos.x);
                const dy = Math.abs(y - dragStartPos.y);
                if (dx > 3 || dy > 3) { // 3px movement threshold
                    this.state.setDraggingState(true);
                    this.state.setHasMoved(true);
                    this.canvas.style.cursor = 'grabbing';
                }
            }

            // Handle component dragging
            if (this.state.isDragging() && draggedComponent) {
                const dragOffset = this.state.getDragOffset();
                const newX = x - dragOffset.x;
                const newY = y - dragOffset.y;
                this.moveComponent(draggedComponent, newX, newY);
                this.redraw();
                e.preventDefault();
            }
            // Handle connection preview
            else if (this.state.getMode() === 'connect' && this.state.getConnectStart()) {
                this.redraw();
                const connectStart = this.state.getConnectStart();
                this.canvasRenderer.drawConnectionPreview(connectStart.x, connectStart.y, x, y);
            }
            // Update cursor based on hover
            else if (this.state.getMode() !== 'connect' && this.state.getMode() !== 'delete') {
                const isPlacementMode = this.state.getMode() === 'place' && this.state.getSelectedTool();
                if (!isPlacementMode) {
                    const component = this.findComponent(x, y);
                    this.canvas.style.cursor = component ? 'grab' : 'crosshair';
                } else {
                    this.canvas.style.cursor = 'crosshair';
                }
            }
        });

        // Canvas mouseup to stop dragging
        this.canvas.addEventListener('mouseup', () => {
            // Reset drag state
            this.state.setDraggingState(false);
            this.state.setDraggedComponent(null);
            this.state.setDragStartPos(null);
            this.canvas.style.cursor = 'crosshair';
        });

        // Also handle mouseup outside canvas
        document.addEventListener('mouseup', () => {
            if (this.state.isDragging()) {
                this.state.setDraggingState(false);
                this.state.setDraggedComponent(null);
                this.state.setDragStartPos(null);
                this.canvas.style.cursor = 'crosshair';
            }
        });
    }

    handleCanvasClick(e) {
        // Don't process click if it was actually a drag
        if (this.state.getHasMoved()) {
            this.state.setHasMoved(false);
            return;
        }

        const { x, y } = this.getScaledCoordinates(e);

        console.log('Canvas click - Mode:', this.state.getMode(), 'SelectedTool:', this.state.getSelectedTool());
        console.log('Scaled coords:', x.toFixed(0), y.toFixed(0));

        if (this.state.getMode() === 'place' && this.state.getSelectedTool()) {
            this.placeComponent(x, y, this.state.getSelectedTool());
        } else if (this.state.getMode() === 'connect') {
            console.log('Calling handleConnect');
            this.handleConnect(x, y);
        } else if (this.state.getMode() === 'delete') {
            console.log('Calling handleDelete');
            this.handleDelete(x, y);
        } else {
            // Check if clicking on an input to toggle
            this.toggleInput(x, y);
        }
    }

    placeComponent(x, y, type) {
        let customName = null;
        let actualType = type;

        // Check if this is a custom component
        if (type.startsWith('CUSTOM:')) {
            customName = type.substring(7);
            actualType = 'CUSTOM';

            const customComponents = this.state.getCustomComponents();
            if (!customComponents[customName]) {
                DialogFactory.showAlert({
                    message: 'Custom component not found!',
                    type: 'error'
                });
                return;
            }
        }

        const components = this.state.getComponents();
        const customComponents = this.state.getCustomComponents();

        const component = {
            id: this.state.generateNextId(),
            type: actualType,
            x: Math.round(x / 50) * 50,
            y: Math.round(y / 50) * 50,
            value: actualType === 'INPUT' ? 0 : null,
            inputs: [],
            outputs: [],
            label: actualType === 'INPUT' ? `I${getInputCount(components) + 1}` :
                   actualType === 'OUTPUT' ? `O${getOutputCount(components) + 1}` :
                   actualType === 'CUSTOM' ? customName : null,
            customName: customName,
            customDefinition: customName ? customComponents[customName] : null
        };

        // Define input/output ports
        this.defineComponentPorts(component);

        this.state.addComponent(component);
        this.redraw();
    }

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
        component.x = Math.round(newX / 50) * 50;
        component.y = Math.round(newY / 50) * 50;

        // Clear and recalculate ports
        component.inputs = [];
        component.outputs = [];
        this.defineComponentPorts(component);
    }

    handleConnect(x, y) {
        const port = this.findPort(x, y);
        console.log('findPort result:', port);

        if (!port) {
            console.log('No port found at', x, y);
            return;
        }

        const connectStart = this.state.getConnectStart();
        if (!connectStart) {
            // Start connection from output port only
            if (port.isOutput) {
                console.log('Starting connection from output port');
                this.state.setConnectStart({
                    component: port.component,
                    portIndex: port.portIndex,
                    x: port.x,
                    y: port.y
                });
                this.toolbar.setConnectionStart(true);
            } else {
                console.log('Clicked port is not an output port');
            }
        } else {
            // End connection at input port only
            if (!port.isOutput) {
                console.log('Completing connection to input port');
                this.state.addConnection({
                    from: connectStart.component,
                    fromPort: connectStart.portIndex,
                    to: port.component,
                    toPort: port.portIndex
                });
                this.state.setConnectStart(null);
                this.toolbar.setConnectionStart(false);
                this.redraw();
            } else {
                console.log('Clicked port is not an input port');
            }
        }
    }

    handleDelete(x, y) {
        const components = this.state.getComponents();
        console.log('Total components on board:', components.length);
        console.log('Components:', components.map(c => ({type: c.type, x: c.x, y: c.y, id: c.id})));

        // Delete component
        const component = this.findComponent(x, y);
        console.log('findComponent result:', component);
        console.log('Clicked at:', x, y);

        if (component) {
            console.log('Deleting component:', component.type, component.id);
            this.state.removeComponent(component.id);
            this.redraw();
            return;
        } else {
            console.log('No component found at', x, y);
        }

        // Delete connection
        const connection = this.findConnection(x, y);
        if (connection) {
            this.state.removeConnection(connection);
            this.redraw();
        }
    }

    toggleInput(x, y) {
        const component = this.findComponent(x, y);
        if (component && component.type === 'INPUT') {
            component.value = component.value === 0 ? 1 : 0;
            this.simulate(); // Simulate to update output values
            this.redraw();
            this.updateTruthTableHighlight(); // Update truth table highlighting
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
        simulateCircuit(this.state.getComponents(), this.state.getConnections());
        this.redraw();
        this.updateTruthTableHighlight(); // Update truth table highlighting after simulation
    }

    generateTruthTable() {
        // Initialize truth table panel if not already created
        if (!this.truthTablePanel) {
            this.truthTablePanel = new TruthTablePanel(
                this.canvas,
                this.state.getComponents(),
                this.state.getConnections(),
                this.simulate.bind(this)
            );

            // Hook up state persistence
            this.truthTablePanel.onStateChange = (state) => {
                this.state.setTruthTableState(state);
                this.saveBoardState();
            };

            // Restore saved state if available
            const truthTableState = this.state.getTruthTableState();
            if (truthTableState) {
                this.truthTablePanel.setState(truthTableState);
            }
        }

        // Generate and display truth table
        const success = this.truthTablePanel.generate();
        if (success) {
            this.truthTablePanel.display();

            // Store reference for backward compatibility
            this.state.setTruthTableData(this.truthTablePanel.truthTableData);
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

    startAutoCycle() {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            DialogFactory.showAlert({
                message: 'Please add at least one input to simulate.',
                type: 'warning'
            });
            return;
        }

        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            DialogFactory.showAlert({
                message: 'Please add at least one output to simulate.',
                type: 'warning'
            });
            return;
        }

        this.state.setAutoCycling(true);
        this.state.setCurrentCycleIndex(0);
        const totalCombinations = Math.pow(2, inputs.length);
        this.state.setTotalCombinations(totalCombinations);

        // Update toolbar simulation state
        this.toolbar.setSimulationState(true, 0, totalCombinations);

        this.autoCycleStep();
    }

    stopAutoCycle() {
        this.state.setAutoCycling(false);
        const autoCycleTimeout = this.state.getAutoCycleTimeout();
        if (autoCycleTimeout) {
            clearTimeout(autoCycleTimeout);
            this.state.setAutoCycleTimeout(null);
        }

        // Reset toolbar simulation state
        this.toolbar.setSimulationState(false);
    }

    autoCycleStep() {
        if (!this.state.isAutoCyclingActive()) return;

        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        let currentCycleIndex = this.state.getCurrentCycleIndex();
        const totalCombinations = this.state.getTotalCombinations();

        if (currentCycleIndex >= totalCombinations) {
            // Finished all combinations, restart
            currentCycleIndex = 0;
            this.state.setCurrentCycleIndex(0);
        }

        // Set input values for current combination
        inputs.forEach((input, index) => {
            const bitValue = (currentCycleIndex >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
        });

        // Simulate circuit
        this.simulate();

        // Update display
        document.getElementById('selectedComponent').textContent =
            `Combination ${currentCycleIndex + 1} / ${totalCombinations}`;

        // Update truth table highlighting
        this.updateTruthTableHighlight();

        // Move to next combination
        this.state.setCurrentCycleIndex(currentCycleIndex + 1);

        // Schedule next cycle
        const timeout = setTimeout(() => {
            this.autoCycleStep();
        }, 800); // 800ms delay between combinations
        this.state.setAutoCycleTimeout(timeout);
    }

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
        // Prepare component data
        const components = this.state.getComponents();
        const connections = this.state.getConnections();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));
        const outputs = components.filter(c => c.type === 'OUTPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        const truthTableState = this.state.getTruthTableState();

        // Deep clone components and connections
        const componentData = {
            name: name,
            description: description,
            components: JSON.parse(JSON.stringify(components)),
            connections: JSON.parse(JSON.stringify(connections)),
            inputPorts: inputs.map(i => ({ id: i.id, label: i.label })),
            outputPorts: outputs.map(o => ({ id: o.id, label: o.label })),
            truthTableState: truthTableState ? JSON.parse(JSON.stringify(truthTableState)) : null,
            created: new Date().toISOString()
        };

        const success = await this.componentLibrary.saveComponent(name, componentData);

        if (success) {
            await this.loadCustomComponents(); // Refresh local copy
            this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());

            // Update current circuit name to reflect it's now a saved component
            this.state.setCurrentComponentName(name);
            this.state.setLastSavedState(JSON.stringify(this.state.getCurrentState()));
            this.toolbar.updateCircuitNameDisplay(
                this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
                !!this.state.getCurrentComponentName()
            );

            DialogFactory.showAlert({
                message: `Component "${name}" saved successfully!`,
                type: 'success'
            });
        } else {
            DialogFactory.showAlert({
                message: `Failed to save component "${name}"`,
                type: 'error'
            });
        }
    }

    /**
     * Handle deleting component - callback for DialogManager
     */
    async handleDeleteComponent(name) {
        const success = await this.componentLibrary.deleteComponent(name);
        if (success) {
            await this.loadCustomComponents(); // Refresh local copy
            this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());
        } else {
            DialogFactory.showAlert({
                message: `Failed to delete component "${name}"`,
                type: 'error'
            });
        }
    }

    // Export/Import Methods
    async exportComponentToFile() {
        // Use DialogManager to show export dialog
        this.dialogManager.showExportComponentDialog();
    }

    async downloadComponent(name) {
        const success = await this.componentLibrary.exportComponent(name);
        if (success) {
            DialogFactory.showAlert({
                message: `Component "${name}" exported successfully!`,
                type: 'success'
            });
        } else {
            DialogFactory.showAlert({
                message: `Failed to export component "${name}"`,
                type: 'error'
            });
        }
    }

    async importComponentFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const componentData = await this.componentLibrary.importComponent(file);

            if (componentData) {
                await this.loadCustomComponents(); // Refresh local copy
                this.toolbar.updateCustomComponentsList(this.state.getCustomComponents());
                DialogFactory.showAlert({
                    message: `Component "${componentData.name}" imported successfully!`,
                    type: 'success'
                });
            }
        } catch (error) {
            DialogFactory.showAlert({
                message: 'Failed to import component: ' + error.message,
                type: 'error'
            });
        }

        // Reset file input
        event.target.value = '';
    }

    // Edit Component Method
    loadComponentForEditing(name) {
        const customComponents = this.state.getCustomComponents();
        if (!customComponents[name]) {
            DialogFactory.showAlert({
                message: 'Component not found.',
                type: 'error'
            });
            return;
        }

        const doLoad = () => {
            this.stopAutoCycle();

            // Hide Truth Table when loading a different component
            const truthTablePanel = document.getElementById('truthTablePanel');
            if (truthTablePanel) {
                truthTablePanel.style.display = 'none';
            }

            const componentData = customComponents[name];

            // Deep clone the component data and load into state
            const loadedState = {
                components: JSON.parse(JSON.stringify(componentData.components)),
                connections: JSON.parse(JSON.stringify(componentData.connections)),
                currentComponentName: name,
                currentBoardName: null,
                truthTableState: componentData.truthTableState ? JSON.parse(JSON.stringify(componentData.truthTableState)) : null
            };

            // Load the state
            this.state.loadState(loadedState);

            // Update nextId to avoid conflicts
            const components = this.state.getComponents();
            const maxId = Math.max(...components.map(c => c.id), 0);
            this.state.setNextId(maxId + 1);

            // Clear last saved state (mark as modified)
            this.state.setLastSavedState(null);

            // Restore Truth Table state if saved
            if (this.truthTablePanel) {
                this.truthTablePanel.setState(this.state.getTruthTableState());
            }

            // Recalculate port positions for all components (migrate old components to new port positions)
            this.migrateComponentPorts();

            this.redraw();
            this.toolbar.updateCircuitNameDisplay(
                this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
                !!this.state.getCurrentComponentName()
            );
            document.getElementById('manageComponentsDialog').style.display = 'none';
            DialogFactory.showAlert({
                message: `Component "${name}" loaded for editing. Make your changes and save it again.`,
                type: 'info'
            });
        };

        if (this.state.hasUnsavedChanges()) {
            this.dialogManager.showSaveOptionsDialog(doLoad);
        } else {
            doLoad();
        }
    }

    // Manual Simulation Step Controls
    stepSimulation(direction) {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            DialogFactory.showAlert({
                message: 'Please add at least one input to simulate.',
                type: 'warning'
            });
            return;
        }

        const totalCombinations = Math.pow(2, inputs.length);

        // If no current index, start from 0
        let currentCycleIndex = this.state.getCurrentCycleIndex();
        if (currentCycleIndex === undefined || currentCycleIndex === null) {
            currentCycleIndex = 0;
        }

        // Calculate new index
        currentCycleIndex += direction;

        // Wrap around
        if (currentCycleIndex < 0) {
            currentCycleIndex = totalCombinations - 1;
        } else if (currentCycleIndex >= totalCombinations) {
            currentCycleIndex = 0;
        }

        this.state.setCurrentCycleIndex(currentCycleIndex);

        // Set input values
        inputs.forEach((input, index) => {
            const bitValue = (currentCycleIndex >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
        });

        // Simulate
        this.simulate();

        // Update display
        document.getElementById('selectedComponent').textContent =
            `Combination ${currentCycleIndex + 1} / ${totalCombinations}`;

        // Update truth table highlighting
        this.updateTruthTableHighlight();
    }

    resetSimulation() {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT');

        if (inputs.length === 0) {
            DialogFactory.showAlert({
                message: 'No inputs to reset.',
                type: 'warning'
            });
            return;
        }

        this.state.setCurrentCycleIndex(0);

        // Set all inputs to 0
        inputs.forEach(input => {
            input.value = 0;
        });

        // Simulate
        this.simulate();

        const totalCombinations = Math.pow(2, inputs.length);
        document.getElementById('selectedComponent').textContent =
            `Combination 1 / ${totalCombinations}`;

        // Update truth table highlighting
        this.updateTruthTableHighlight();
    }

    // Rename Methods
    handleCanvasDoubleClick(e) {
        const { x, y } = this.getScaledCoordinates(e);
        const component = this.findComponent(x, y);

        if (component && (component.type === 'INPUT' || component.type === 'OUTPUT')) {
            this.dialogManager.showRenameDialog(component);
        }
    }

    // Theme Management Methods
    // Theme management methods removed - now handled by ThemeManager class

    // Draggable Truth Table
    // setupDraggableTruthTable removed - now handled by TruthTablePanel + Interact.js

    // Auto-Save Functionality
    setupAutoSave() {
        // Auto-save on every change
        const originalRedraw = this.redraw.bind(this);
        this.redraw = () => {
            originalRedraw();
            this.saveBoardState();
        };

        // Warn before leaving page if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.state.getComponents().length > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsaved work. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    async saveBoardState() {
        const truthTablePanel = document.getElementById('truthTablePanel');
        const state = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId(), // This will get the current nextId
            currentComponentName: this.state.getCurrentComponentName(),
            currentBoardName: this.state.getCurrentBoardName(),
            truthTableState: this.state.getTruthTableState(),
            truthTableVisible: truthTablePanel ? truthTablePanel.style.display !== 'none' : false
        };
        // Decrement nextId back since we just called generateNextId for reading
        this.state.setNextId(state.nextId);
        await this.storageAdapter.setItem('circuitBoardState', state);
    }

    async loadBoardState() {
        const state = await this.storageAdapter.getItem('circuitBoardState');
        if (state) {
            // Load into CircuitState
            this.state.loadState({
                components: state.components || [],
                connections: state.connections || [],
                nextId: state.nextId || 1,
                currentComponentName: state.currentComponentName || null,
                currentBoardName: state.currentBoardName || null,
                truthTableState: state.truthTableState || null
            });

            // Recalculate port positions for auto-saved state (migrate to new positions)
            if (this.state.getComponents().length > 0) {
                this.migrateComponentPorts();
            }

            // Restore truth table visibility if it was open
            if (state.truthTableVisible) {
                // Delay slightly to ensure DOM is ready
                setTimeout(() => {
                    this.generateTruthTable();
                }, 100);
            }
        }
    }

    async clearBoardState() {
        await this.storageAdapter.removeItem('circuitBoardState');
    }

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
        const state = this.getCurrentState();
        const currentBoardName = this.state.getCurrentBoardName();
        const boardData = {
            ...state,
            savedAt: Date.now(),
            createdFrom: currentBoardName ?
                { type: 'board', name: currentBoardName } : null
        };

        const success = await this.boardManager.saveBoard(boardName, boardData);

        if (success) {
            await this.loadSavedBoards(); // Refresh local copy
            this.state.setCurrentBoardName(boardName);
            this.state.setLastSavedState(JSON.stringify(state));
            this.toolbar.updateCircuitNameDisplay(
                this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
                !!this.state.getCurrentComponentName()
            );
            this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
            console.log(`Board saved: ${boardName}`);
        } else {
            DialogFactory.showAlert({
                message: `Failed to save board "${boardName}"`,
                type: 'error'
            });
        }
    }

    async loadBoard(boardName) {
        const board = await this.boardManager.loadBoard(boardName);

        if (!board) {
            DialogFactory.showAlert({
                message: `Board "${boardName}" not found.`,
                type: 'error'
            });
            return;
        }

        // Hide and clear Truth Table when loading a different board
        const truthTablePanel = document.getElementById('truthTablePanel');
        if (truthTablePanel) {
            truthTablePanel.style.display = 'none';
        }

        // Clear truth table panel instance so it regenerates for the new board
        if (this.truthTablePanel) {
            this.truthTablePanel.hide();
        }
        this.truthTablePanel = null;
        this.state.setTruthTableData(null);

        // Load board state
        this.state.loadState({
            components: JSON.parse(JSON.stringify(board.components || [])),
            connections: JSON.parse(JSON.stringify(board.connections || [])),
            nextId: board.nextId || 1,
            currentBoardName: boardName,
            currentComponentName: null,
            truthTableState: board.truthTableState ? JSON.parse(JSON.stringify(board.truthTableState)) : null
        });

        // Recalculate port positions for all components (migrate old boards to new port positions)
        this.migrateComponentPorts();

        this.state.setLastSavedState(JSON.stringify(this.getCurrentState()));
        this.redraw();
        this.toolbar.updateCircuitNameDisplay(
            this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
            !!this.state.getCurrentComponentName()
        );
        this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
        console.log(`Board loaded: ${boardName}`);
    }

    createNewBoard() {
        // Hide and clear Truth Table when creating a new board
        const truthTablePanel = document.getElementById('truthTablePanel');
        if (truthTablePanel) {
            truthTablePanel.style.display = 'none';
        }

        // Clear truth table panel instance so it regenerates for the new board
        if (this.truthTablePanel) {
            this.truthTablePanel.hide();
        }
        this.truthTablePanel = null;

        // Reset state
        this.state.reset();

        this.redraw();
        this.toolbar.updateCircuitNameDisplay(
            this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
            !!this.state.getCurrentComponentName()
        );
        this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
        console.log('New board created');
    }

    async deleteBoard(boardName) {
        DialogFactory.showConfirm({
            message: `Are you sure you want to delete board "${boardName}"?`,
            title: 'Delete Board',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            type: 'warning',
            onConfirm: async () => {
                const success = await this.boardManager.deleteBoard(boardName);

                if (success) {
                    await this.loadSavedBoards(); // Refresh local copy
                    const currentBoardName = this.state.getCurrentBoardName();
                    if (currentBoardName === boardName) {
                        this.state.setCurrentBoardName(null);
                    }
                    this.toolbar.updateBoardsList(this.state.getSavedBoards(), this.state.getCurrentBoardName());
                    this.toolbar.updateCircuitNameDisplay(
                        this.state.getCurrentComponentName() || this.state.getCurrentBoardName(),
                        !!this.state.getCurrentComponentName()
                    );
                    console.log(`Board deleted: ${boardName}`);
                } else {
                    DialogFactory.showAlert({
                        message: `Failed to delete board "${boardName}"`,
                        type: 'error'
                    });
                }
            }
        });
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
