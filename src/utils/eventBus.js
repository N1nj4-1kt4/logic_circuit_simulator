/**
 * Simple Event Bus for decoupled communication
 * Lightweight alternative to mitt library
 */

class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function to remove
     */
    off(event, callback) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to handlers
     */
    emit(event, data) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        });
    }

    /**
     * Subscribe to an event that fires only once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        const onceWrapper = (data) => {
            callback(data);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }

    /**
     * Clear all event handlers
     */
    clear() {
        this.events.clear();
    }

    /**
     * Get all registered events (for debugging)
     */
    getEvents() {
        return Array.from(this.events.keys());
    }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

/**
 * Event type constants for documentation and type safety
 *
 * SIMULATION EVENTS:
 *
 * SIMULATION_STEP_COMPLETED
 * - Emitted when a simulation step has executed and outputs are computed
 * - Emitted by: ALL simulation triggers (input toggle, manual step, auto-cycle)
 * - Use for: truth table row highlighting, step counter updates
 * - Payload: { cycleIndex: number, totalCombinations: number, inputValues: number[] }
 *
 * AUTOCYCLE_STATE_CHANGED
 * - Emitted when auto-cycling state changes (started, stopped, or error)
 * - Emitted by: start(), stop() methods (and _handleValidityChange for error)
 * - Use for: play/pause button state, enable/disable step buttons
 * - Payload: {
 *     state: 'running' | 'stopped' | 'error',
 *     error?: string   // Present when state === 'error'
 *   }
 */
export const EVENT_TYPES = {
    // Component events
    COMPONENT_ADDED: 'component:added',
    COMPONENT_REMOVED: 'component:removed',
    COMPONENT_MOVED: 'component:moved',
    COMPONENT_VALUE_CHANGED: 'component:valueChanged',
    // Payload: { component, oldLabel, newLabel }
    COMPONENT_LABEL_CHANGED: 'component:labelChanged',

    // Connection events
    CONNECTION_ADDED: 'connection:added',
    CONNECTION_REMOVED: 'connection:removed',

    // Simulation events (legacy - kept for backwards compatibility)
    SIMULATION_RUN: 'simulation:run',
    SIMULATION_COMPLETED: 'simulation:completed',
    SIMULATION_RESET: 'simulation:reset',

    // Simulation lifecycle events
    // Payload: { state: 'running' | 'stopped' | 'error', error?: string }
    AUTOCYCLE_STATE_CHANGED: 'simulation:autocycleStateChanged',
    // Payload: { cycleIndex, totalCombinations, inputValues }
    SIMULATION_STEP_COMPLETED: 'simulation:stepCompleted',

    // Board events
    BOARD_SAVE: 'board:save',
    BOARD_LOADED: 'board:loaded',
    BOARD_DELETED: 'board:deleted',
    BOARD_CHANGED: 'board:changed',
    BOARD_CLEARED: 'board:cleared',

    // Truth table panel events (UI-related)
    TRUTH_TABLE_GENERATE: 'truthTable:generate',
    TRUTH_TABLE_SHOWN: 'truthTable:shown',
    TRUTH_TABLE_HIDDEN: 'truthTable:hidden',
    TRUTH_TABLE_PANEL_STATE_CHANGED: 'truthTable:panelStateChanged',

    // Circuit analysis events (computed data)
    CIRCUIT_ANALYSIS_COMPUTED: 'circuitAnalysis:computed',
    // Payload: { current: number, total: number, percent: number }
    CIRCUIT_ANALYSIS_COMPUTING: 'circuitAnalysis:computing',

    // Theme events
    THEME_CHANGED: 'theme:changed',

    // Circuit validity events (new declarative events)
    // Payload: { from, to, canSimulate, reason, inputs, outputs, isValid }
    CIRCUIT_VALIDITY_CHANGED: 'circuit:validityChanged',
    // Payload: { previousInputCount, previousOutputCount, newInputCount, newOutputCount, inputs, outputs }
    IO_STRUCTURE_CHANGED: 'circuit:ioStructureChanged',

    // Circuit events
    CIRCUIT_CLEARED: 'circuit:cleared',

    // Proposed changes events (for confirmation flows)
    // Payload: { component, connection, impact, transaction }
    DELETION_PROPOSED: 'circuit:deletionProposed',
    DELETION_CONFIRMED: 'circuit:deletionConfirmed',
    DELETION_CANCELLED: 'circuit:deletionCancelled',

    // Mode events
    MODE_EXIT_REQUEST: 'mode:exitRequest',

    // UI update events
    TOOLBAR_UPDATE_DISPLAYS: 'toolbar:updateDisplays',
    CONNECTION_START_CHANGED: 'connection:startChanged',

    // Canvas events
    CANVAS_REDRAW: 'canvas:redraw',

    // Undo/Redo events
    // Payload: { canUndo: boolean, canRedo: boolean }
    UNDO_REDO_STATE_CHANGED: 'undoredo:stateChanged',

    // Drag interaction events (for undo coalescing)
    // Payload: { component }
    DRAG_STARTED: 'interaction:dragStarted',
    DRAG_ENDED: 'interaction:dragEnded',

    // Pre-clear event (for undo capture before state is cleared)
    // Payload: {}
    BOARD_WILL_CLEAR: 'board:willClear'
};
