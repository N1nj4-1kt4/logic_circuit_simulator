/**
 * CircuitState - Single source of truth for all circuit state
 *
 * This class manages all application state and emits events when state changes.
 * It provides a clean interface for accessing and modifying circuit state without
 * direct DOM dependencies.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';

export class CircuitState {
    constructor() {
        // Circuit components and connections
        this.components = [];
        this.connections = [];
        this.nextId = 1;

        // Tool and mode state
        this.selectedTool = null;
        this.mode = 'place'; // place, connect, delete
        this.connectStart = null;

        // Custom components and saved boards
        this.customComponents = {};
        this.savedBoards = {};

        // Current circuit tracking
        this.currentBoardName = null; // null means unsaved board
        this.currentComponentName = null; // null means not a saved component
        this.lastSavedState = null; // To track if board has been modified

        // Circuit analysis - pre-computed input/output mappings for all combinations
        // { inputs, outputs, table, isValid, reason }
        this.circuitAnalysis = null;

        // Truth table panel UI state (position, size, column order, visibility)
        // { x, y, width, height, columnOrder, visible }
        this.truthTablePanelState = null;

        // Simulation state
        this.isAutoCycling = false;
        this.autoCycleTimeout = null;
        this.currentCycleIndex = 0;
        this.totalCombinations = 0;
    }

    // ====================================
    // Component Management
    // ====================================

    /**
     * Add a component to the circuit
     * @param {Object} component - Component to add
     */
    addComponent(component) {
        this.components.push(component);
        eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component });
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    }

    /**
     * Remove a component by ID
     * @param {number} componentId - ID of component to remove
     */
    removeComponent(componentId) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return false;

        this.components = this.components.filter(c => c.id !== componentId);

        // Also remove all connections to/from this component
        this.connections = this.connections.filter(
            conn => conn.from !== componentId && conn.to !== componentId
        );

        eventBus.emit(EVENT_TYPES.COMPONENT_REMOVED, { componentId, component });
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
        return true;
    }

    /**
     * Update a component's properties
     * @param {number} componentId - ID of component to update
     * @param {Object} updates - Properties to update
     */
    updateComponent(componentId, updates) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return false;

        const oldState = { ...component };
        Object.assign(component, updates);

        eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, {
            component,
            oldState,
            updates
        });
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
        return true;
    }

    /**
     * Get all components
     * @returns {Array} Components array
     */
    getComponents() {
        return this.components;
    }

    /**
     * Get a component by ID
     * @param {number} componentId - Component ID
     * @returns {Object|null} Component or null
     */
    getComponent(componentId) {
        return this.components.find(c => c.id === componentId) || null;
    }

    /**
     * Clear all components
     */
    clearComponents() {
        // Emit pre-clear event for undo capture before state changes
        eventBus.emit(EVENT_TYPES.BOARD_WILL_CLEAR);

        this.components = [];
        this.connections = [];
        this.nextId = 1;
        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    }

    /**
     * Generate next component ID
     * @returns {number} Next ID
     */
    generateNextId() {
        return this.nextId++;
    }

    /**
     * Get the current next ID value without incrementing
     * Use this when saving state - NOT generateNextId() which has side effects
     * @returns {number} Current nextId value
     */
    getNextId() {
        return this.nextId;
    }

    /**
     * Set the next ID (useful when loading saved circuits)
     * @param {number} id - ID to set
     */
    setNextId(id) {
        this.nextId = id;
    }

    // ====================================
    // Connection Management
    // ====================================

    /**
     * Add a connection between components
     * @param {Object} connection - Connection to add
     */
    addConnection(connection) {
        this.connections.push(connection);
        eventBus.emit(EVENT_TYPES.CONNECTION_ADDED, { connection });
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    }

    /**
     * Remove a connection
     * @param {Object} connection - Connection to remove
     */
    removeConnection(connection) {
        const index = this.connections.indexOf(connection);
        if (index === -1) return false;

        this.connections.splice(index, 1);
        eventBus.emit(EVENT_TYPES.CONNECTION_REMOVED, { connection });
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
        return true;
    }

    /**
     * Get all connections
     * @returns {Array} Connections array
     */
    getConnections() {
        return this.connections;
    }

    // ====================================
    // Mode and Tool Management
    // ====================================

    /**
     * Set the current mode
     * @param {string} mode - Mode to set ('place', 'connect', 'delete')
     */
    setMode(mode) {
        const oldMode = this.mode;
        this.mode = mode;

        // Clear connection start when changing modes
        if (mode !== 'connect') {
            this.connectStart = null;
        }

        eventBus.emit('mode:changed', { mode, oldMode });
    }

    /**
     * Get the current mode
     * @returns {string} Current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Set the selected tool
     * @param {string|null} tool - Tool to select (gate type or null)
     */
    setSelectedTool(tool) {
        this.selectedTool = tool;
        eventBus.emit('tool:changed', { tool });
    }

    /**
     * Get the selected tool
     * @returns {string|null} Selected tool
     */
    getSelectedTool() {
        return this.selectedTool;
    }

    /**
     * Set connection start point
     * @param {Object|null} connectStart - Connection start data or null
     */
    setConnectStart(connectStart) {
        this.connectStart = connectStart;
        eventBus.emit('connection:startChanged', { connectStart });
    }

    /**
     * Get connection start point
     * @returns {Object|null} Connection start data
     */
    getConnectStart() {
        return this.connectStart;
    }

    // ====================================
    // Custom Components and Saved Boards
    // ====================================

    /**
     * Set custom components library
     * @param {Object} customComponents - Custom components object
     */
    setCustomComponents(customComponents) {
        this.customComponents = customComponents;
        eventBus.emit('customComponents:updated', { customComponents });
    }

    /**
     * Get custom components library
     * @returns {Object} Custom components
     */
    getCustomComponents() {
        return this.customComponents;
    }

    /**
     * Set saved boards
     * @param {Object} savedBoards - Saved boards object
     */
    setSavedBoards(savedBoards) {
        this.savedBoards = savedBoards;
        eventBus.emit('savedBoards:updated', { savedBoards });
    }

    /**
     * Get saved boards
     * @returns {Object} Saved boards
     */
    getSavedBoards() {
        return this.savedBoards;
    }

    // ====================================
    // Current Circuit Tracking
    // ====================================

    /**
     * Set current board name
     * @param {string|null} name - Board name or null
     */
    setCurrentBoardName(name) {
        this.currentBoardName = name;
        if (name) {
            this.currentComponentName = null; // Clear component name when setting board name
        }
        eventBus.emit('currentBoard:changed', { boardName: name });
    }

    /**
     * Get current board name
     * @returns {string|null} Current board name
     */
    getCurrentBoardName() {
        return this.currentBoardName;
    }

    /**
     * Set current component name
     * @param {string|null} name - Component name or null
     */
    setCurrentComponentName(name) {
        this.currentComponentName = name;
        if (name) {
            this.currentBoardName = null; // Clear board name when setting component name
        }
        eventBus.emit('currentComponent:changed', { componentName: name });
    }

    /**
     * Get current component name
     * @returns {string|null} Current component name
     */
    getCurrentComponentName() {
        return this.currentComponentName;
    }

    /**
     * Set last saved state (for detecting changes)
     * @param {string|null} state - Serialized state or null
     */
    setLastSavedState(state) {
        this.lastSavedState = state;
    }

    /**
     * Get last saved state
     * @returns {string|null} Last saved state
     */
    getLastSavedState() {
        return this.lastSavedState;
    }

    /**
     * Check if there are unsaved changes
     * @returns {boolean} True if there are unsaved changes
     */
    hasUnsavedChanges() {
        if (this.components.length === 0 && !this.currentBoardName) {
            return false; // Empty unsaved board
        }

        const currentState = JSON.stringify(this.getCurrentState());
        // lastSavedState may be an object (from deepClone) or a string
        // Normalize to string for comparison
        const savedState = typeof this.lastSavedState === 'string'
            ? this.lastSavedState
            : JSON.stringify(this.lastSavedState);

        return currentState !== savedState;
    }

    /**
     * Get current state for saving
     * @returns {Object} Current state
     */
    getCurrentState() {
        return {
            components: JSON.parse(JSON.stringify(this.components)),
            connections: JSON.parse(JSON.stringify(this.connections)),
            nextId: this.nextId,
            truthTablePanelState: this.truthTablePanelState ? JSON.parse(JSON.stringify(this.truthTablePanelState)) : null
        };
    }

    // ====================================
    // Circuit Analysis & Truth Table Panel State
    // ====================================

    /**
     * Set circuit analysis (pre-computed input/output mappings)
     * @param {Object|null} analysis - Circuit analysis { inputs, outputs, table, isValid, reason }
     */
    setCircuitAnalysis(analysis) {
        this.circuitAnalysis = analysis;
    }

    /**
     * Get circuit analysis
     * @returns {Object|null} Circuit analysis
     */
    getCircuitAnalysis() {
        return this.circuitAnalysis;
    }

    /**
     * Set truth table panel UI state (position, size, column order, visibility)
     * @param {Object|null} state - Panel state { x, y, width, height, columnOrder, visible }
     */
    setTruthTablePanelState(state) {
        this.truthTablePanelState = state;
        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_PANEL_STATE_CHANGED, { state });
    }

    /**
     * Get truth table panel UI state
     * @returns {Object|null} Panel state
     */
    getTruthTablePanelState() {
        return this.truthTablePanelState;
    }

    // ====================================
    // Simulation State
    // ====================================

    /**
     * Set auto-cycling state
     * @param {boolean} isAutoCycling - Whether auto-cycling is active
     */
    setAutoCycling(isAutoCycling) {
        this.isAutoCycling = isAutoCycling;
        eventBus.emit('simulation:autoCycleChanged', { isAutoCycling });
    }

    /**
     * Get auto-cycling state
     * @returns {boolean} Whether auto-cycling is active
     */
    isAutoCyclingActive() {
        return this.isAutoCycling;
    }

    /**
     * Set pending auto-cycle flag (for restoring auto-cycle state after page load)
     * @param {boolean} value - Whether auto-cycling should resume
     */
    setPendingAutoCycle(value) {
        this.pendingAutoCycle = value;
    }

    /**
     * Get pending auto-cycle flag
     * @returns {boolean} Whether auto-cycling should resume
     */
    getPendingAutoCycle() {
        return this.pendingAutoCycle || false;
    }

    /**
     * Clear pending auto-cycle flag
     */
    clearPendingAutoCycle() {
        this.pendingAutoCycle = false;
    }

    /**
     * Set auto-cycle timeout
     * @param {number|null} timeout - Timeout ID or null
     */
    setAutoCycleTimeout(timeout) {
        this.autoCycleTimeout = timeout;
    }

    /**
     * Get auto-cycle timeout
     * @returns {number|null} Timeout ID
     */
    getAutoCycleTimeout() {
        return this.autoCycleTimeout;
    }

    /**
     * Set current cycle index
     * @param {number} index - Cycle index
     */
    setCurrentCycleIndex(index) {
        this.currentCycleIndex = index;
        eventBus.emit('simulation:cycleIndexChanged', { index });
    }

    /**
     * Get current cycle index
     * @returns {number} Cycle index
     */
    getCurrentCycleIndex() {
        return this.currentCycleIndex;
    }

    /**
     * Set total combinations
     * @param {number} total - Total combinations
     */
    setTotalCombinations(total) {
        this.totalCombinations = total;
    }

    /**
     * Get total combinations
     * @returns {number} Total combinations
     */
    getTotalCombinations() {
        return this.totalCombinations;
    }

    // ====================================
    // Bulk State Operations
    // ====================================

    /**
     * Load a complete circuit state
     * @param {Object} state - State to load
     */
    loadState(state) {
        // Deep clone components and connections to prevent mutation of the source
        // (e.g., lastSavedState should not be modified when user moves components)
        this.components = state.components ? JSON.parse(JSON.stringify(state.components)) : [];
        this.connections = state.connections ? JSON.parse(JSON.stringify(state.connections)) : [];
        this.nextId = state.nextId || 1;
        this.currentBoardName = state.currentBoardName || null;
        this.currentComponentName = state.currentComponentName || null;
        this.truthTablePanelState = state.truthTablePanelState ? JSON.parse(JSON.stringify(state.truthTablePanelState)) : null;

        eventBus.emit(EVENT_TYPES.BOARD_LOADED, { state });
    }

    /**
     * Reset state to initial values
     */
    reset() {
        this.components = [];
        this.connections = [];
        this.nextId = 1;
        this.selectedTool = null;
        this.mode = 'place';
        this.connectStart = null;
        this.currentBoardName = null;
        this.currentComponentName = null;
        this.lastSavedState = null;
        this.circuitAnalysis = null;
        this.truthTablePanelState = null;
        this.isAutoCycling = false;
        this.autoCycleTimeout = null;
        this.currentCycleIndex = 0;
        this.totalCombinations = 0;

        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
    }
}
