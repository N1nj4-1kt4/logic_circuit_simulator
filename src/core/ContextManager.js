/**
 * ContextManager - Circuit Context Management Module
 *
 * Handles saving and loading circuit contexts (boards vs components).
 * Ensures proper state transitions and truth table state preservation
 * when switching between different circuit contexts.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { deepClone } from '../utils/serialization.js';

export class ContextManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {BoardManager} config.boardManager - Board management instance
     * @param {ComponentLibrary} config.componentLibrary - Component library instance
     * @param {TruthTableManager} config.truthTableManager - Truth table manager instance
     */
    constructor(config) {
        this.state = config.state;
        this.boardManager = config.boardManager;
        this.componentLibrary = config.componentLibrary;
        this.truthTableManager = config.truthTableManager;
    }

    /**
     * Save current context (board or component) before switching
     * Ensures truth table state and other changes are persisted
     */
    async saveCurrentContext() {
        const currentBoardName = this.state.getCurrentBoardName();
        const currentComponentName = this.state.getCurrentComponentName();

        if (currentBoardName) {
            const currentBoardData = {
                components: this.state.getComponents(),
                connections: this.state.getConnections(),
                nextId: this.state.getNextId(),
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
     * Load circuit context and restore truth table state
     * Used by both loadBoard() and loadComponentForEditing()
     * @param {Object} circuitData - Circuit data with components, connections, etc.
     * @param {Object} contextInfo - Context information (boardName or componentName)
     * @param {string} contextInfo.type - 'board' or 'component'
     * @param {string} contextInfo.name - Name of the board or component
     */
    loadCircuitContext(circuitData, contextInfo) {
        // Load circuit data into state
        // IMPORTANT: Include truthTableState so BOARD_LOADED handler gets correct position
        this.state.loadState({
            components: circuitData.components || [],
            connections: circuitData.connections || [],
            nextId: circuitData.nextId || 1,
            customComponents: circuitData.customComponents || this.state.getCustomComponents(),
            truthTableState: circuitData.truthTableState || null
        });

        // Set current context (board or component)
        if (contextInfo.type === 'board') {
            this.state.setCurrentBoardName(contextInfo.name);
            this.state.setCurrentComponentName(null);
        } else if (contextInfo.type === 'component') {
            this.state.setCurrentComponentName(contextInfo.name);
            this.state.setCurrentBoardName(null);
        }

        // Truth table state is now set via loadState() above
        // This line is now redundant but kept for backwards compatibility with any direct callers
        this.state.setTruthTableState(circuitData.truthTableState || null);

        // Clear and recompute truth table cache for the new circuit
        this.state.setTruthTableCache(null);
        if (this.truthTableManager) {
            this.truthTableManager.recomputeTruthTable();
        }

        // Update last saved state
        this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

        // Emit standard events for any circuit context switch
        eventBus.emit(EVENT_TYPES.BOARD_LOADED);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
    }
}
