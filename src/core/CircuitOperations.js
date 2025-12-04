/**
 * CircuitOperations - Business Logic Module
 *
 * Handles all circuit operations including:
 * - Component placement and management
 * - Connection and deletion
 * - Simulation orchestration
 * - Truth table generation
 * - Board management (save, load, delete)
 * - Component library management
 * - Auto-save functionality
 *
 * This module contains the core business logic extracted from circuit-simulator.js
 * Uses event bus for decoupled communication and callbacks for integration
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import {
    simulateCircuit,
    getInputCount,
    getOutputCount
} from './circuitEvaluator.js';
import { computeTruthTable } from './TruthTableComputer.js';
import { deepClone } from '../utils/serialization.js';
import { snapToGrid } from '../utils/hitDetection.js';
import { TIMING } from '../constants.js';
import {
    NoInputsError,
    NoOutputsError,
    EmptyCircuitError,
    BoardNameRequiredError,
    ComponentNotFoundError,
    BoardSaveError,
    BoardLoadError,
    InvalidComponentFileError,
    ComponentSaveError
} from './errors.js';

export class CircuitOperations {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {BoardManager} config.boardManager - Board management instance
     * @param {ComponentLibrary} config.componentLibrary - Component library instance
     * @param {Object} config.callbacks - Callback functions
     * @param {Function} config.callbacks.redraw - Redraw canvas
     * @param {Function} config.callbacks.defineComponentPorts - Define component ports
     * @param {Function} config.callbacks.findComponent - Find component at coordinates
     * @param {Function} config.callbacks.findPort - Find port at coordinates
     */
    constructor(config) {
        this.state = config.state;
        this.boardManager = config.boardManager;
        this.componentLibrary = config.componentLibrary;
        this.callbacks = config.callbacks;

        // Auto-save debounce timer reference
        this.autoSaveTimer = null;
        this.autoSaveDelay = 1000; // 1 second debounce delay

        // Truth table recomputation debounce timer
        this.truthTableDebounceTimer = null;

        // Subscribe to circuit changes for truth table recomputation
        this._setupTruthTableRecomputation();
    }

    /**
     * Setup event listeners for truth table recomputation
     * @private
     */
    _setupTruthTableRecomputation() {
        // Recompute truth table on any circuit topology change
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => {
            this._debouncedRecomputeTruthTable();
        });

        // Clear cache on board cleared
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, () => {
            this.state.setTruthTableCache(null);
        });
    }

    /**
     * Debounced recomputation of truth table
     * @private
     */
    _debouncedRecomputeTruthTable() {
        if (this.truthTableDebounceTimer) {
            clearTimeout(this.truthTableDebounceTimer);
        }
        this.truthTableDebounceTimer = setTimeout(() => {
            this.recomputeTruthTable();
        }, TIMING.TRUTH_TABLE_DEBOUNCE);
    }

    /**
     * Recompute truth table and store in cache
     */
    recomputeTruthTable() {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        const result = computeTruthTable(components, connections);
        this.state.setTruthTableCache(result);

        // Also update the truthTableData for backwards compatibility
        if (result.isValid) {
            this.state.setTruthTableData(result);
        }

        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_COMPUTED, result);
    }

    // ====================================
    // Component Placement
    // ====================================

    /**
     * Place a component on the canvas
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Component type (e.g., 'AND', 'INPUT', 'CUSTOM:name')
     */
    placeComponent(x, y, type) {
        let customName = null;
        let actualType = type;

        // Check if this is a custom component
        if (type.startsWith('CUSTOM:')) {
            customName = type.substring(7);
            actualType = 'CUSTOM';

            const customComponents = this.state.getCustomComponents();
            if (!customComponents[customName]) {
                throw new ComponentNotFoundError(customName);
            }
        }

        const components = this.state.getComponents();
        const customComponents = this.state.getCustomComponents();

        const snapped = snapToGrid(x, y);
        const component = {
            id: this.state.generateNextId(),
            type: actualType,
            x: snapped.x,
            y: snapped.y,
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
        this.callbacks.defineComponentPorts(component);

        this.state.addComponent(component);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
    }

    // ====================================
    // Connection and Deletion
    // ====================================

    /**
     * Handle connection between components
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    handleConnect(x, y) {
        const port = this.callbacks.findPort(x, y);

        if (!port) {
            return;
        }

        const connectStart = this.state.getConnectStart();
        if (!connectStart) {
            // Start connection from output port only
            if (port.isOutput) {
                this.state.setConnectStart({
                    component: port.component,
                    portIndex: port.portIndex,
                    x: port.x,
                    y: port.y
                });
                eventBus.emit(EVENT_TYPES.CONNECTION_START_CHANGED, true);
            }
        } else {
            // End connection at input port only
            if (!port.isOutput) {
                this.state.addConnection({
                    from: connectStart.component,
                    fromPort: connectStart.portIndex,
                    to: port.component,
                    toPort: port.portIndex
                });
                this.state.setConnectStart(null);
                eventBus.emit(EVENT_TYPES.CONNECTION_START_CHANGED, false);
                eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            }
        }
    }

    /**
     * Handle deletion of components or connections
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Function} findConnection - Find connection at coordinates
     */
    handleDelete(x, y, findConnection) {
        // Delete component
        const component = this.callbacks.findComponent(x, y);

        if (component) {
            this.state.removeComponent(component.id);
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            return;
        }

        // Delete connection
        const connection = findConnection(x, y);

        if (connection) {
            this.state.removeConnection(connection);
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        }
    }

    // ====================================
    // Simulation
    // ====================================

    /**
     * Run simulation on the circuit
     */
    simulate() {
        simulateCircuit(this.state.getComponents(), this.state.getConnections());
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT);
    }

    /**
     * Start auto-cycling through all input combinations
     */
    startAutoCycle() {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            throw new NoInputsError();
        }

        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            throw new NoOutputsError();
        }

        this.state.setAutoCycling(true);
        const totalCombinations = Math.pow(2, inputs.length);
        this.state.setTotalCombinations(totalCombinations);

        // Calculate starting index from current input state
        const currentState = inputs.map(input => input.value || 0);
        let startIndex = 0;
        for (let i = 0; i < inputs.length; i++) {
            startIndex = (startIndex << 1) | currentState[i];
        }
        // Advance to next combination immediately (user already sees current state)
        startIndex = (startIndex + 1) % totalCombinations;
        this.state.setCurrentCycleIndex(startIndex);

        // Emit simulation state change
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            isRunning: true,
            currentIndex: 0,
            totalCombinations: totalCombinations
        });

        this.autoCycleStep();
    }

    /**
     * Stop auto-cycling
     */
    stopAutoCycle() {
        this.state.setAutoCycling(false);
        const autoCycleTimeout = this.state.getAutoCycleTimeout();
        if (autoCycleTimeout) {
            clearTimeout(autoCycleTimeout);
            this.state.setAutoCycleTimeout(null);
        }

        // Emit simulation state change
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            isRunning: false
        });
    }

    /**
     * Execute one step of auto-cycling
     */
    autoCycleStep() {
        if (!this.state.isAutoCyclingActive()) return;

        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        // Detect if input count changed during simulation (e.g., user added/removed an input)
        const currentTotalCombinations = Math.pow(2, inputs.length);
        const storedTotalCombinations = this.state.getTotalCombinations();

        if (currentTotalCombinations !== storedTotalCombinations) {
            // Input count changed - recalculate index to preserve current input state
            // Convert current input values to the equivalent index in the new space
            // New inputs default to 0, removed inputs are ignored
            let newIndex = 0;
            inputs.forEach((input, index) => {
                const bitValue = input.value || 0;
                newIndex = (newIndex << 1) | bitValue;
            });

            this.state.setTotalCombinations(currentTotalCombinations);
            this.state.setCurrentCycleIndex(newIndex);
        }

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

        // Try to use cached truth table for output lookup
        const cache = this.state.getTruthTableCache();
        if (cache && cache.isValid && cache.table && cache.table[currentCycleIndex]) {
            const row = cache.table[currentCycleIndex];

            // Restore ALL component values from cache (not just inputs/outputs)
            // This ensures wire colors are correct for all connections
            if (row.componentValues) {
                components.forEach(comp => {
                    const cached = row.componentValues[comp.id];
                    if (cached) {
                        comp.value = cached.value;
                        if (cached.outputValues) {
                            comp.outputValues = [...cached.outputValues];
                        }
                    }
                });
            }

            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT);
        } else {
            // Fallback to full simulation if cache not available
            this.simulate();
        }

        // Emit simulation state change with current progress (before incrementing)
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            isRunning: true,
            currentIndex: currentCycleIndex,
            totalCombinations: totalCombinations
        });

        // Update cycle index for next iteration
        currentCycleIndex++;
        this.state.setCurrentCycleIndex(currentCycleIndex);

        // Schedule next step
        const timeout = setTimeout(() => {
            this.autoCycleStep();
        }, TIMING.AUTO_CYCLE_DELAY);
        this.state.setAutoCycleTimeout(timeout);
    }

    /**
     * Step through simulation manually
     * @param {number} direction - Direction to step (1 for next, -1 for previous)
     */
    stepSimulation(direction) {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            throw new NoInputsError();
        }

        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            throw new NoOutputsError();
        }

        const totalCombinations = Math.pow(2, inputs.length);

        // If not auto-cycling, initialize cycle state
        if (!this.state.isAutoCyclingActive()) {
            // Get current input state and find its index
            const currentState = inputs.map(input => input.value || 0);
            let currentIndex = 0;
            for (let i = 0; i < inputs.length; i++) {
                currentIndex = (currentIndex << 1) | currentState[i];
            }
            this.state.setCurrentCycleIndex(currentIndex);
            this.state.setTotalCombinations(totalCombinations);
        }

        // Calculate new index
        let currentCycleIndex = this.state.getCurrentCycleIndex();
        currentCycleIndex += direction;

        // Wrap around
        if (currentCycleIndex < 0) {
            currentCycleIndex = totalCombinations - 1;
        } else if (currentCycleIndex >= totalCombinations) {
            currentCycleIndex = 0;
        }

        this.state.setCurrentCycleIndex(currentCycleIndex);

        // Set input values for new combination
        inputs.forEach((input, index) => {
            const bitValue = (currentCycleIndex >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
        });

        // Try to use cached truth table for output lookup
        const cache = this.state.getTruthTableCache();
        if (cache && cache.isValid && cache.table && cache.table[currentCycleIndex]) {
            const row = cache.table[currentCycleIndex];

            // Restore ALL component values from cache (not just inputs/outputs)
            // This ensures wire colors are correct for all connections
            if (row.componentValues) {
                components.forEach(comp => {
                    const cached = row.componentValues[comp.id];
                    if (cached) {
                        comp.value = cached.value;
                        if (cached.outputValues) {
                            comp.outputValues = [...cached.outputValues];
                        }
                    }
                });
            }

            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT);
        } else {
            // Fallback to full simulation if cache not available
            this.simulate();
        }

        // Emit simulation state change with current progress
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            isRunning: false,
            currentIndex: currentCycleIndex,
            totalCombinations: totalCombinations
        });
    }

    /**
     * Reset simulation to initial state (all inputs to 0)
     */
    resetSimulation() {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT');

        if (inputs.length === 0) {
            return;
        }

        // Stop auto-cycle if running
        if (this.state.isAutoCyclingActive()) {
            this.stopAutoCycle();
        }

        // Reset all inputs to 0
        inputs.forEach(input => {
            input.value = 0;
        });

        // Reset cycle index
        this.state.setCurrentCycleIndex(0);
        const totalCombinations = Math.pow(2, inputs.length);
        this.state.setTotalCombinations(totalCombinations);

        // Simulate circuit
        this.simulate();

        // Emit simulation state change
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            isRunning: false,
            currentIndex: 0,
            totalCombinations: totalCombinations
        });
    }

    // ====================================
    // Board Management
    // ====================================

    /**
     * Save current board to storage
     * @param {string} boardName - Name of the board
     */
    async saveCurrentBoard(boardName) {
        if (!boardName || boardName.trim() === '') {
            throw new BoardNameRequiredError();
        }

        const boardData = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId() - 1,
            customComponents: this.state.getCustomComponents(),
            truthTableState: this.state.getTruthTableState()
        };

        const success = await this.boardManager.saveBoard(boardName, boardData);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.getAllBoards();
            this.state.setSavedBoards(boards);

            // Update current board name
            this.state.setCurrentBoardName(boardName);
            this.state.setCurrentComponentName(null);

            // Update last saved state for change detection
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return boardName; // Return board name for success message
        } else {
            throw new BoardSaveError('Failed to save board to storage');
        }
    }

    /**
     * Load a board from storage
     * @param {string} boardName - Name of the board to load
     */
    async loadBoard(boardName) {
        // Save current context's state before switching (including truth table changes)
        await this._saveCurrentContext();

        const boardData = await this.boardManager.loadBoard(boardName);

        if (boardData) {
            // Load circuit context using common helper
            this._loadCircuitContext(boardData, { type: 'board', name: boardName });

            return boardName; // Return board name for success message
        } else {
            throw new BoardLoadError(boardName);
        }
    }

    /**
     * Create a new empty board
     * @param {Function} showSaveOptionsDialog - Callback to show save options dialog (still needed for dialog flow)
     * @param {Function} onCreated - Optional callback called when new board is created
     */
    createNewBoard(showSaveOptionsDialog, onCreated) {
        // Check for unsaved changes
        if (this.state.hasUnsavedChanges()) {
            showSaveOptionsDialog(() => {
                this._createNewBoardInternal();
                if (onCreated) onCreated();
            });
        } else {
            this._createNewBoardInternal();
            if (onCreated) onCreated();
        }
    }

    /**
     * Internal method to create a new board
     * @private
     */
    _createNewBoardInternal() {
        // Clear the board
        this.state.clearComponents();
        this.state.setCurrentBoardName(null);
        this.state.setCurrentComponentName(null);

        // Emit events
        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
    }

    /**
     * Delete a board from storage
     * Note: Caller should confirm with user before calling this method
     * @param {string} boardName - Name of the board to delete
     * @returns {Promise<string>} Board name on success for notification
     */
    async deleteBoard(boardName) {
        const success = await this.boardManager.deleteBoard(boardName);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.getAllBoards();
            this.state.setSavedBoards(boards);

            // If we deleted the current board, clear it
            if (this.state.getCurrentBoardName() === boardName) {
                this.state.clearComponents();
                this.state.setCurrentBoardName(null);
                this.state.setCurrentComponentName(null);
                eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            }

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return boardName; // Return name for success message
        } else {
            throw new BoardSaveError(`Failed to delete board "${boardName}"`);
        }
    }

    // ====================================
    // Component Library Management
    // ====================================

    /**
     * Save current circuit as a custom component
     * @param {string} name - Component name
     * @param {string} description - Component description
     * @returns {Promise<string>} Component name on success for notification
     */
    async saveComponent(name, description) {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        if (components.length === 0) {
            throw new EmptyCircuitError();
        }

        // Validate inputs and outputs
        const inputs = components.filter(c => c.type === 'INPUT');
        const outputs = components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0) {
            throw new NoInputsError();
        }

        if (outputs.length === 0) {
            throw new NoOutputsError();
        }

        // Create component definition
        const componentDef = {
            name,
            description,
            components: deepClone(components),
            connections: deepClone(connections),
            inputPorts: inputs.map(input => ({ label: input.label, id: input.id })),
            outputPorts: outputs.map(output => ({ label: output.label, id: output.id })),
            truthTableState: this.state.getTruthTableState()
        };

        // Save to component library
        const success = await this.componentLibrary.saveComponent(name, componentDef);

        if (success) {
            // Update custom components in state
            const customComponents = await this.componentLibrary.listComponents();
            this.state.setCustomComponents(customComponents);

            // Set current component name
            this.state.setCurrentComponentName(name);
            this.state.setCurrentBoardName(null);

            // Update last saved state
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return name; // Return name for success message
        } else {
            throw new ComponentSaveError(`Failed to save component "${name}"`);
        }
    }

    /**
     * Delete a component from the library
     * @param {string} name - Component name
     */
    async deleteComponent(name) {
        const success = await this.componentLibrary.deleteComponent(name);

        if (success) {
            // Update custom components in state
            const customComponents = await this.componentLibrary.listComponents();
            this.state.setCustomComponents(customComponents);

            // If we deleted the current component, clear component name
            if (this.state.getCurrentComponentName() === name) {
                this.state.setCurrentComponentName(null);
            }

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return true;
        }

        return false;
    }

    /**
     * Export component to file
     * @param {string} name - Component name
     * @returns {Promise<string>} Component name on success for notification
     */
    async exportComponent(name) {
        const component = await this.componentLibrary.loadComponent(name);

        if (component) {
            const json = JSON.stringify(component, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${name}.json`;
            a.click();

            URL.revokeObjectURL(url);

            return name; // Return name for success message
        } else {
            throw new ComponentNotFoundError(name);
        }
    }

    /**
     * Import component from file
     * @param {Event} event - File input change event
     * @returns {Promise<string>} Component name on success for notification
     */
    async importComponent(event) {
        const file = event.target.files[0];
        if (!file) return null;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const componentDef = JSON.parse(e.target.result);

                    // Validate component definition
                    if (!componentDef.name || !componentDef.components || !componentDef.connections) {
                        reject(new InvalidComponentFileError());
                        return;
                    }

                    // Save to component library
                    const success = await this.componentLibrary.saveComponent(componentDef.name, componentDef);

                    if (success) {
                        // Update custom components in state
                        const customComponents = await this.componentLibrary.listComponents();
                        this.state.setCustomComponents(customComponents);

                        // Emit event to update toolbar displays
                        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

                        resolve(componentDef.name); // Return name for success message
                    } else {
                        reject(new ComponentSaveError(`Failed to save imported component "${componentDef.name}"`));
                    }
                } catch (error) {
                    console.error('Error importing component:', error);
                    if (error.name === 'InvalidComponentFileError' || error.name === 'ComponentSaveError') {
                        reject(error);
                    } else {
                        reject(new InvalidComponentFileError());
                    }
                }
            };

            reader.onerror = () => {
                reject(new InvalidComponentFileError());
            };

            reader.readAsText(file);

            // Reset file input
            event.target.value = '';
        });
    }

    /**
     * Load component for editing
     * @param {string} name - Component name
     * @returns {Promise<string>} Component name on success for notification
     */
    async loadComponentForEditing(name) {
        // Save current context's state before switching (including truth table changes)
        await this._saveCurrentContext();

        const componentDef = await this.componentLibrary.loadComponent(name);

        if (componentDef) {
            // Load circuit context using common helper
            this._loadCircuitContext(componentDef, { type: 'component', name });

            return name; // Return name for success message
        } else {
            throw new ComponentNotFoundError(name);
        }
    }

    /**
     * Internal helper to save current context (board or component) before switching
     * Ensures truth table state and other changes are persisted
     * @private
     */
    async _saveCurrentContext() {
        const currentBoardName = this.state.getCurrentBoardName();
        const currentComponentName = this.state.getCurrentComponentName();

        if (currentBoardName) {
            const currentBoardData = {
                components: this.state.getComponents(),
                connections: this.state.getConnections(),
                nextId: this.state.generateNextId() - 1,
                customComponents: this.state.getCustomComponents(),
                truthTableState: this.state.getTruthTableState()
            };
            await this.boardManager.saveBoard(currentBoardName, currentBoardData);
        } else if (currentComponentName) {
            // Load existing component to preserve its metadata
            const existingComponent = await this.componentLibrary.loadComponent(currentComponentName);
            if (existingComponent) {
                // Update with current state including truth table
                const updatedComponent = {
                    ...existingComponent,
                    components: this.state.getComponents(),
                    connections: this.state.getConnections(),
                    truthTableState: this.state.getTruthTableState()
                };
                await this.componentLibrary.saveComponent(currentComponentName, updatedComponent);
            }
        }
    }

    /**
     * Internal helper to load circuit context and restore truth table state
     * Used by both loadBoard() and loadComponentForEditing()
     * @private
     * @param {Object} circuitData - Circuit data with components, connections, etc.
     * @param {Object} contextInfo - Context information (boardName or componentName)
     * @param {string} contextInfo.type - 'board' or 'component'
     * @param {string} contextInfo.name - Name of the board or component
     */
    _loadCircuitContext(circuitData, contextInfo) {
        // Load circuit data into state
        this.state.loadState({
            components: circuitData.components || [],
            connections: circuitData.connections || [],
            nextId: (circuitData.nextId || 0) + 1,
            customComponents: circuitData.customComponents || this.state.getCustomComponents()
        });

        // Set current context (board or component)
        if (contextInfo.type === 'board') {
            this.state.setCurrentBoardName(contextInfo.name);
            this.state.setCurrentComponentName(null);
        } else if (contextInfo.type === 'component') {
            this.state.setCurrentComponentName(contextInfo.name);
            this.state.setCurrentBoardName(null);
        }

        // Load truth table state for this context (or clear if none saved)
        this.state.setTruthTableState(circuitData.truthTableState || null);

        // Clear and recompute truth table cache for the new circuit
        this.state.setTruthTableCache(null);
        this.recomputeTruthTable();

        // Update last saved state
        this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

        // Emit standard events for any circuit context switch
        eventBus.emit(EVENT_TYPES.BOARD_LOADED);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
    }

    // ====================================
    // Auto-Save Functionality
    // ====================================

    /**
     * Setup auto-save functionality using event-driven approach
     * Listens to all board state change events and auto-saves with debouncing
     */
    setupAutoSave() {
        // Create debounced save handler
        this.debouncedSave = () => {
            // Clear existing timer
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }

            // Set new timer
            this.autoSaveTimer = setTimeout(async () => {
                await this.saveBoardState();
            }, this.autoSaveDelay);
        };

        // Listen to all events that modify board state
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);

        // When board is cleared, clear the auto-saved state immediately (no debounce)
        this.handleBoardCleared = async () => {
            await this.clearBoardState();
        };
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, this.handleBoardCleared);
    }

    /**
     * Clear auto-save timer and event listeners
     */
    clearAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        // Remove event listeners
        if (this.debouncedSave) {
            eventBus.off(EVENT_TYPES.BOARD_CHANGED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.BOARD_LOADED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);
        }

        if (this.handleBoardCleared) {
            eventBus.off(EVENT_TYPES.BOARD_CLEARED, this.handleBoardCleared);
        }
    }

    /**
     * Save current board state to localStorage (auto-save)
     */
    async saveBoardState() {
        const boardData = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId() - 1,
            currentBoardName: this.state.getCurrentBoardName(),
            currentComponentName: this.state.getCurrentComponentName(),
            customComponents: this.state.getCustomComponents(),
            truthTableState: this.state.getTruthTableState()
        };

        try {
            await this.boardManager.storage.setItem('currentBoard', JSON.stringify(boardData));
        } catch (error) {
            // Silently handle auto-save errors
        }
    }

    /**
     * Load board state from localStorage (on app start)
     */
    async loadBoardState() {
        try {
            const savedState = await this.boardManager.storage.getItem('currentBoard');

            if (savedState) {
                const boardData = JSON.parse(savedState);

                // Load state
                this.state.loadState({
                    components: boardData.components || [],
                    connections: boardData.connections || [],
                    nextId: (boardData.nextId || 0) + 1,
                    customComponents: boardData.customComponents || {}
                });

                // Restore current board/component names
                this.state.setCurrentBoardName(boardData.currentBoardName || null);
                this.state.setCurrentComponentName(boardData.currentComponentName || null);

                // Restore truth table state
                if (boardData.truthTableState) {
                    this.state.setTruthTableState(boardData.truthTableState);
                }

                // Compute truth table cache for the restored circuit
                this.recomputeTruthTable();

                // Update last saved state
                this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

                // Emit event to update toolbar displays
                eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
            }
        } catch (error) {
            // Silently handle load errors - start with empty state
        }
    }

    /**
     * Clear auto-saved board state
     */
    async clearBoardState() {
        try {
            await this.boardManager.storage.removeItem('currentBoard');
        } catch (error) {
            // Silently handle clear errors
        }
    }
}
