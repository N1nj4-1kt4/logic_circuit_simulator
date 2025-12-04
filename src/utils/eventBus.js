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

// Event type constants for documentation and type safety
export const EVENT_TYPES = {
    // Component events
    COMPONENT_ADDED: 'component:added',
    COMPONENT_REMOVED: 'component:removed',
    COMPONENT_MOVED: 'component:moved',
    COMPONENT_VALUE_CHANGED: 'component:valueChanged',

    // Connection events
    CONNECTION_ADDED: 'connection:added',
    CONNECTION_REMOVED: 'connection:removed',

    // Simulation events
    SIMULATION_RUN: 'simulation:run',
    SIMULATION_COMPLETED: 'simulation:completed',
    SIMULATION_RESET: 'simulation:reset',
    SIMULATION_STATE_CHANGED: 'simulation:stateChanged',

    // Board events
    BOARD_SAVE: 'board:save',
    BOARD_LOADED: 'board:loaded',
    BOARD_DELETED: 'board:deleted',
    BOARD_CHANGED: 'board:changed',
    BOARD_CLEARED: 'board:cleared',

    // Truth table events
    TRUTH_TABLE_GENERATE: 'truthTable:generate',
    TRUTH_TABLE_SHOWN: 'truthTable:shown',
    TRUTH_TABLE_HIDDEN: 'truthTable:hidden',
    TRUTH_TABLE_STATE_CHANGED: 'truthTable:stateChanged',
    TRUTH_TABLE_UPDATE_HIGHLIGHT: 'truthTable:updateHighlight',
    TRUTH_TABLE_COMPUTED: 'truthTable:computed',

    // Theme events
    THEME_CHANGED: 'theme:changed',

    // Circuit events
    CIRCUIT_CLEARED: 'circuit:cleared',

    // Mode events
    MODE_EXIT_REQUEST: 'mode:exitRequest',

    // UI update events
    TOOLBAR_UPDATE_DISPLAYS: 'toolbar:updateDisplays',
    CONNECTION_START_CHANGED: 'connection:startChanged',

    // Canvas events
    CANVAS_REDRAW: 'canvas:redraw'
};
