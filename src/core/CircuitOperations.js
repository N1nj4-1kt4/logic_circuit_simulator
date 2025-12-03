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
import { DialogFactory } from '../ui/DialogFactory.js';
import { messages } from '../ui/messages.js';
import {
    simulateCircuit,
    getInputCount,
    getOutputCount
} from './circuitEvaluator.js';
import { deepClone } from '../utils/serialization.js';

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

        // Auto-save timer reference
        this.autoSaveTimer = null;
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
                DialogFactory.showAlert({
                    message: messages.alerts.customComponentNotFound,
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
        this.callbacks.defineComponentPorts(component);

        this.state.addComponent(component);
        this.callbacks.redraw();
    }

    // ====================================
    // Connection and Deletion
    // ====================================

    /**
     * Handle connection between components
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Function} setConnectionStart - Toolbar callback to update connection start indicator
     */
    handleConnect(x, y, setConnectionStart) {
        const port = this.callbacks.findPort(x, y);
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
                setConnectionStart(true);
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
                setConnectionStart(false);
                this.callbacks.redraw();
            } else {
                console.log('Clicked port is not an input port');
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
        const components = this.state.getComponents();
        console.log('Total components on board:', components.length);
        console.log('Components:', components.map(c => ({type: c.type, x: c.x, y: c.y, id: c.id})));

        // Delete component
        const component = this.callbacks.findComponent(x, y);
        console.log('findComponent result:', component);
        console.log('Clicked at:', x, y);

        if (component) {
            console.log('Removing component');
            this.state.removeComponent(component.id);
            this.callbacks.redraw();
            return;
        }

        // Delete connection
        const connection = findConnection(x, y);
        console.log('findConnection result:', connection);

        if (connection) {
            console.log('Removing connection');
            this.state.removeConnection(connection);
            this.callbacks.redraw();
        }
    }

    // ====================================
    // Simulation
    // ====================================

    /**
     * Run simulation on the circuit
     * @param {Function} updateTruthTableHighlight - Callback to update truth table highlighting
     */
    simulate(updateTruthTableHighlight) {
        simulateCircuit(this.state.getComponents(), this.state.getConnections());
        this.callbacks.redraw();
        updateTruthTableHighlight(); // Update truth table highlighting after simulation
    }

    /**
     * Start auto-cycling through all input combinations
     * @param {Function} setSimulationState - Toolbar callback to update simulation state
     */
    startAutoCycle(setSimulationState) {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.noInputsToSimulate,
                type: 'warning'
            });
            return;
        }

        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.noOutputsToSimulate,
                type: 'warning'
            });
            return;
        }

        this.state.setAutoCycling(true);
        this.state.setCurrentCycleIndex(0);
        const totalCombinations = Math.pow(2, inputs.length);
        this.state.setTotalCombinations(totalCombinations);

        // Update toolbar simulation state
        setSimulationState(true, 0, totalCombinations);

        this.autoCycleStep(setSimulationState);
    }

    /**
     * Stop auto-cycling
     * @param {Function} setSimulationState - Toolbar callback to update simulation state
     */
    stopAutoCycle(setSimulationState) {
        this.state.setAutoCycling(false);
        const autoCycleTimeout = this.state.getAutoCycleTimeout();
        if (autoCycleTimeout) {
            clearTimeout(autoCycleTimeout);
            this.state.setAutoCycleTimeout(null);
        }

        // Reset toolbar simulation state
        setSimulationState(false);
    }

    /**
     * Execute one step of auto-cycling
     * @param {Function} setSimulationState - Toolbar callback to update simulation state
     * @param {Function} updateTruthTableHighlight - Callback to update truth table highlighting
     */
    autoCycleStep(setSimulationState, updateTruthTableHighlight) {
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
        this.simulate(updateTruthTableHighlight);

        // Update cycle index
        currentCycleIndex++;
        this.state.setCurrentCycleIndex(currentCycleIndex);

        // Update toolbar with current progress
        setSimulationState(true, currentCycleIndex, totalCombinations);

        // Schedule next step
        const timeout = setTimeout(() => {
            this.autoCycleStep(setSimulationState, updateTruthTableHighlight);
        }, 500); // 500ms delay between steps
        this.state.setAutoCycleTimeout(timeout);
    }

    /**
     * Step through simulation manually
     * @param {number} direction - Direction to step (1 for next, -1 for previous)
     * @param {Function} setSimulationState - Toolbar callback to update simulation state
     * @param {Function} updateTruthTableHighlight - Callback to update truth table highlighting
     */
    stepSimulation(direction, setSimulationState, updateTruthTableHighlight) {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.noInputsToSimulate,
                type: 'warning'
            });
            return;
        }

        const outputs = components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.noOutputsToSimulate,
                type: 'warning'
            });
            return;
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

        // Simulate circuit
        this.simulate(updateTruthTableHighlight);

        // Update toolbar with current progress
        setSimulationState(false, currentCycleIndex, totalCombinations);
    }

    /**
     * Reset simulation to initial state (all inputs to 0)
     * @param {Function} setSimulationState - Toolbar callback to update simulation state
     * @param {Function} updateTruthTableHighlight - Callback to update truth table highlighting
     */
    resetSimulation(setSimulationState, updateTruthTableHighlight) {
        const components = this.state.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT');

        if (inputs.length === 0) {
            return;
        }

        // Stop auto-cycle if running
        if (this.state.isAutoCyclingActive()) {
            this.stopAutoCycle(setSimulationState);
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
        this.simulate(updateTruthTableHighlight);

        // Update toolbar
        setSimulationState(false, 0, totalCombinations);
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
            DialogFactory.showAlert({
                message: messages.alerts.boardNameRequired,
                type: 'warning'
            });
            return false;
        }

        const boardData = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId() - 1,
            customComponents: this.state.getCustomComponents()
        };

        const success = await this.boardManager.saveBoard(boardName, boardData);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.listBoards();
            this.state.setSavedBoards(boards);

            // Update current board name
            this.state.setCurrentBoardName(boardName);
            this.state.setCurrentComponentName(null);

            // Update last saved state for change detection
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            DialogFactory.showAlert({
                message: messages.alerts.boardSaved(boardName),
                type: 'success'
            });

            return true;
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.boardSaveFailed,
                type: 'error'
            });
            return false;
        }
    }

    /**
     * Load a board from storage
     * @param {string} boardName - Name of the board to load
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async loadBoard(boardName, updateToolbarDisplays) {
        const boardData = await this.boardManager.loadBoard(boardName);

        if (boardData) {
            // Load board data into state
            this.state.loadState({
                components: boardData.components || [],
                connections: boardData.connections || [],
                nextId: (boardData.nextId || 0) + 1,
                customComponents: boardData.customComponents || {}
            });

            // Set current board name
            this.state.setCurrentBoardName(boardName);
            this.state.setCurrentComponentName(null);

            // Update last saved state
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Redraw canvas
            this.callbacks.redraw();

            // Update toolbar displays
            updateToolbarDisplays();

            DialogFactory.showAlert({
                message: messages.alerts.boardLoaded(boardName),
                type: 'success'
            });

            return true;
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.boardLoadFailed(boardName),
                type: 'error'
            });
            return false;
        }
    }

    /**
     * Create a new empty board
     * @param {Function} showSaveOptionsDialog - Callback to show save options dialog
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    createNewBoard(showSaveOptionsDialog, updateToolbarDisplays) {
        // Check for unsaved changes
        if (this.state.hasUnsavedChanges()) {
            showSaveOptionsDialog(() => {
                this._createNewBoardInternal(updateToolbarDisplays);
            });
        } else {
            this._createNewBoardInternal(updateToolbarDisplays);
        }
    }

    /**
     * Internal method to create a new board
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     * @private
     */
    _createNewBoardInternal(updateToolbarDisplays) {
        // Clear the board
        this.state.clearComponents();
        this.state.setCurrentBoardName(null);
        this.state.setCurrentComponentName(null);

        // Redraw canvas
        this.callbacks.redraw();

        // Update toolbar displays
        updateToolbarDisplays();

        DialogFactory.showAlert({
            message: messages.alerts.newBoardCreated,
            type: 'success'
        });
    }

    /**
     * Delete a board from storage
     * @param {string} boardName - Name of the board to delete
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async deleteBoard(boardName, updateToolbarDisplays) {
        const confirmed = await DialogFactory.showConfirm({
            message: messages.confirms.deleteBoard(boardName),
            type: 'warning'
        });

        if (!confirmed) {
            return false;
        }

        const success = await this.boardManager.deleteBoard(boardName);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.listBoards();
            this.state.setSavedBoards(boards);

            // If we deleted the current board, clear it
            if (this.state.getCurrentBoardName() === boardName) {
                this.state.clearComponents();
                this.state.setCurrentBoardName(null);
                this.state.setCurrentComponentName(null);
                this.callbacks.redraw();
            }

            // Update toolbar displays
            updateToolbarDisplays();

            DialogFactory.showAlert({
                message: messages.alerts.boardDeleted(boardName),
                type: 'success'
            });

            return true;
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.boardDeleteFailed,
                type: 'error'
            });
            return false;
        }
    }

    // ====================================
    // Component Library Management
    // ====================================

    /**
     * Save current circuit as a custom component
     * @param {string} name - Component name
     * @param {string} description - Component description
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async saveComponent(name, description, updateToolbarDisplays) {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        if (components.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.emptyCircuit,
                type: 'warning'
            });
            return false;
        }

        // Validate inputs and outputs
        const inputs = components.filter(c => c.type === 'INPUT');
        const outputs = components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0 || outputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.componentNeedsInputsOutputs,
                type: 'warning'
            });
            return false;
        }

        // Create component definition
        const componentDef = {
            name,
            description,
            components: deepClone(components),
            connections: deepClone(connections),
            inputPorts: inputs.map(input => ({ label: input.label, id: input.id })),
            outputPorts: outputs.map(output => ({ label: output.label, id: output.id }))
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

            // Update toolbar displays
            updateToolbarDisplays();

            DialogFactory.showAlert({
                message: messages.alerts.componentSaved(name),
                type: 'success'
            });

            return true;
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.componentSaveFailed,
                type: 'error'
            });
            return false;
        }
    }

    /**
     * Delete a component from the library
     * @param {string} name - Component name
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async deleteComponent(name, updateToolbarDisplays) {
        const success = await this.componentLibrary.deleteComponent(name);

        if (success) {
            // Update custom components in state
            const customComponents = await this.componentLibrary.listComponents();
            this.state.setCustomComponents(customComponents);

            // If we deleted the current component, clear component name
            if (this.state.getCurrentComponentName() === name) {
                this.state.setCurrentComponentName(null);
            }

            // Update toolbar displays
            updateToolbarDisplays();

            return true;
        }

        return false;
    }

    /**
     * Export component to file
     * @param {string} name - Component name
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

            DialogFactory.showAlert({
                message: messages.alerts.componentExported(name),
                type: 'success'
            });
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.componentExportFailed,
                type: 'error'
            });
        }
    }

    /**
     * Import component from file
     * @param {Event} event - File input change event
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async importComponent(event, updateToolbarDisplays) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const componentDef = JSON.parse(e.target.result);

                // Validate component definition
                if (!componentDef.name || !componentDef.components || !componentDef.connections) {
                    DialogFactory.showAlert({
                        message: messages.alerts.invalidComponentFile,
                        type: 'error'
                    });
                    return;
                }

                // Save to component library
                const success = await this.componentLibrary.saveComponent(componentDef.name, componentDef);

                if (success) {
                    // Update custom components in state
                    const customComponents = await this.componentLibrary.listComponents();
                    this.state.setCustomComponents(customComponents);

                    // Update toolbar displays
                    updateToolbarDisplays();

                    DialogFactory.showAlert({
                        message: messages.alerts.componentImported(componentDef.name),
                        type: 'success'
                    });
                }
            } catch (error) {
                console.error('Error importing component:', error);
                DialogFactory.showAlert({
                    message: messages.alerts.componentImportFailed,
                    type: 'error'
                });
            }
        };

        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    }

    /**
     * Load component for editing
     * @param {string} name - Component name
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async loadComponentForEditing(name, updateToolbarDisplays) {
        const componentDef = await this.componentLibrary.loadComponent(name);

        if (componentDef) {
            // Load component data into state
            this.state.loadState({
                components: componentDef.components || [],
                connections: componentDef.connections || [],
                nextId: Math.max(...(componentDef.components || []).map(c => c.id)) + 1,
                customComponents: this.state.getCustomComponents()
            });

            // Set current component name
            this.state.setCurrentComponentName(name);
            this.state.setCurrentBoardName(null);

            // Update last saved state
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Redraw canvas
            this.callbacks.redraw();

            // Update toolbar displays
            updateToolbarDisplays();

            DialogFactory.showAlert({
                message: messages.alerts.componentLoadedForEditing(name),
                type: 'success'
            });

            return true;
        } else {
            DialogFactory.showAlert({
                message: messages.alerts.componentLoadFailed(name),
                type: 'error'
            });
            return false;
        }
    }

    // ====================================
    // Auto-Save Functionality
    // ====================================

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        // Save board state every 30 seconds
        this.autoSaveTimer = setInterval(async () => {
            await this.saveBoardState();
        }, 30000);
    }

    /**
     * Clear auto-save timer
     */
    clearAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
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
            await this.boardManager.storageAdapter.setItem('currentBoard', JSON.stringify(boardData));
            console.log('Board state auto-saved');
        } catch (error) {
            console.error('Error auto-saving board state:', error);
        }
    }

    /**
     * Load board state from localStorage (on app start)
     * @param {Function} updateToolbarDisplays - Callback to update toolbar displays
     */
    async loadBoardState(updateToolbarDisplays) {
        try {
            const savedState = await this.boardManager.storageAdapter.getItem('currentBoard');

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

                // Update last saved state
                this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

                console.log('Board state restored from auto-save');

                // Update toolbar displays if callback provided
                if (updateToolbarDisplays) {
                    updateToolbarDisplays();
                }
            }
        } catch (error) {
            console.error('Error loading board state:', error);
        }
    }

    /**
     * Clear auto-saved board state
     */
    async clearBoardState() {
        try {
            await this.boardManager.storageAdapter.removeItem('currentBoard');
            console.log('Auto-saved board state cleared');
        } catch (error) {
            console.error('Error clearing board state:', error);
        }
    }
}
