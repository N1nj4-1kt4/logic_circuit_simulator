/**
 * TruthTablePanelStateMachine - Explicit state machine for TruthTablePanel
 *
 * Manages panel visibility states and data synchronization states separately.
 * Returns action objects that TruthTablePanel executes.
 *
 * @module TruthTablePanelStateMachine
 */

// ============================================================================
// SECTION: State Enums
// ============================================================================

/**
 * Panel visibility states
 */
export const PANEL_STATES = {
    /** Panel not visible */
    HIDDEN: 'hidden',
    /** Visible, showing progress bar (no table yet) */
    SHOWING_COMPUTING: 'showing_computing',
    /** Visible, showing error message (no table yet) */
    SHOWING_INVALID: 'showing_invalid',
    /** Visible, rendering table (async) */
    SHOWING_TABLE: 'showing_table',
    /** Visible with table, computing overlay */
    VISIBLE_COMPUTING: 'visible_computing',
    /** Visible, showing valid table */
    VISIBLE_TABLE: 'visible_table',
    /** Visible, showing invalid message */
    VISIBLE_INVALID: 'visible_invalid'
};

/**
 * Data synchronization states
 */
export const DATA_STATES = {
    /** Local copy matches CircuitState */
    FRESH: 'fresh',
    /** Changes occurred while hidden */
    STALE: 'stale',
    /** Async computation in progress */
    COMPUTING: 'computing'
};

/**
 * Action types returned by state machine
 */
export const ACTION_TYPES = {
    NONE: 'NONE',
    SHOW_COMPUTING: 'SHOW_COMPUTING',
    SHOW_INVALID: 'SHOW_INVALID',
    RENDER_TABLE: 'RENDER_TABLE',
    REBUILD_TABLE: 'REBUILD_TABLE',
    UPDATE_HEADERS: 'UPDATE_HEADERS',
    UPDATE_DATA: 'UPDATE_DATA',
    SHOW_PROGRESS: 'SHOW_PROGRESS',
    HIGHLIGHT_ROW: 'HIGHLIGHT_ROW',
    HIDE: 'HIDE',
    SYNC: 'SYNC'
};

// ============================================================================
// SECTION: RenderQueue
// ============================================================================

/**
 * Serializes async render operations to prevent concurrent renders.
 * Multiple rapid render requests collapse into: first + one pending.
 */
export class RenderQueue {
    constructor() {
        /** @type {Promise|null} Current render promise */
        this._current = null;
        /** @type {Function|null} Pending render function (only one) */
        this._pending = null;
    }

    /**
     * Queue a render function for execution.
     * If a render is in progress, the new request becomes pending.
     * Multiple pending requests collapse into one (latest wins).
     *
     * @param {Function} renderFn - Async function that performs the render
     * @returns {Promise} Resolves when this render completes
     */
    async enqueue(renderFn) {
        if (this._current) {
            // Replace any pending (collapse multiple into one)
            this._pending = renderFn;
            await this._current;
            return this._processQueue();
        }
        this._current = this._execute(renderFn);
        return this._current;
    }

    /**
     * Execute a render function and process any pending request
     * @param {Function} renderFn - Async function to execute
     * @returns {Promise}
     * @private
     */
    async _execute(renderFn) {
        try {
            await renderFn();
        } finally {
            this._current = null;
        }
    }

    /**
     * Process the pending queue after current render completes
     * @returns {Promise}
     * @private
     */
    async _processQueue() {
        if (this._pending) {
            const nextRenderFn = this._pending;
            this._pending = null;
            this._current = this._execute(nextRenderFn);
            return this._current;
        }
    }

    /**
     * Check if a render is currently in progress
     * @returns {boolean}
     */
    isRendering() {
        return this._current !== null;
    }

    /**
     * Check if there's a pending render waiting
     * @returns {boolean}
     */
    hasPending() {
        return this._pending !== null;
    }
}

// ============================================================================
// SECTION: TruthTablePanelStateMachine
// ============================================================================

/**
 * State machine for TruthTablePanel.
 *
 * Manages:
 * - Panel visibility state (HIDDEN, SHOWING_*, VISIBLE_*)
 * - Data synchronization state (FRESH, STALE, COMPUTING)
 * - Last simulation cycle index for highlighting
 * - Render-in-progress flag
 *
 * Each handler method returns an action object that the panel executes.
 * The state machine never performs side effects directly.
 */
export class TruthTablePanelStateMachine {
    /**
     * @param {Object} panel - TruthTablePanel instance for reading analysis state
     */
    constructor(panel) {
        this._panel = panel;
        this._state = {
            panel: PANEL_STATES.HIDDEN,
            data: DATA_STATES.FRESH,
            lastCycleIndex: null,
            renderInProgress: false
        };
    }

    /**
     * Get a copy of the current state
     * @returns {Object} State object with panel, data, lastCycleIndex, renderInProgress
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Set the lastCycleIndex (for restoring from persisted state)
     * @param {number|null} index - The cycle index to restore
     */
    setLastCycleIndex(index) {
        this._state.lastCycleIndex = index;
    }

    /**
     * Check if panel is in a visible state
     * @returns {boolean}
     */
    isVisible() {
        return this._state.panel !== PANEL_STATES.HIDDEN;
    }

    /**
     * Handle show() request.
     * Determines appropriate action based on current analysis state.
     *
     * @returns {Object} Action to execute
     */
    handleShow() {
        // If already visible, determine if sync is needed
        if (this.isVisible()) {
            if (this._state.data === DATA_STATES.STALE) {
                this._state.data = DATA_STATES.FRESH;
                return { action: ACTION_TYPES.SYNC };
            }
            return { action: ACTION_TYPES.NONE };
        }

        // Transitioning from HIDDEN to visible
        const analysis = this._panel.circuitState?.getCircuitAnalysis();

        if (!analysis) {
            // No analysis yet - show computing state
            this._state.panel = PANEL_STATES.SHOWING_COMPUTING;
            this._state.data = DATA_STATES.COMPUTING;
            return { action: ACTION_TYPES.SHOW_COMPUTING };
        }

        if (!analysis.isValid) {
            // Invalid circuit - show invalid message
            this._state.panel = PANEL_STATES.SHOWING_INVALID;
            this._state.data = DATA_STATES.FRESH;
            return { action: ACTION_TYPES.SHOW_INVALID, reason: analysis.reason };
        }

        // Valid analysis - check if we can reuse existing Tabulator
        if (this._panel.tabulatorInstance) {
            if (this._state.data === DATA_STATES.FRESH) {
                // Tabulator exists and data is fresh - just show panel, no rebuild needed
                this._state.panel = PANEL_STATES.VISIBLE_TABLE;
                return { action: ACTION_TYPES.NONE };
            }
            // Tabulator exists but data changed while hidden - sync it
            this._state.panel = PANEL_STATES.VISIBLE_TABLE;
            this._state.data = DATA_STATES.FRESH;
            return { action: ACTION_TYPES.SYNC };
        }

        // No existing Tabulator - need full render
        this._state.panel = PANEL_STATES.SHOWING_TABLE;
        this._state.data = DATA_STATES.FRESH;
        return { action: ACTION_TYPES.RENDER_TABLE };
    }

    /**
     * Handle hide() request.
     * Always transitions to HIDDEN state.
     *
     * @returns {Object} Action to execute
     */
    handleHide() {
        this._state.panel = PANEL_STATES.HIDDEN;
        // Preserve data state and lastCycleIndex for when panel reopens
        return { action: ACTION_TYPES.HIDE };
    }

    /**
     * Handle CIRCUIT_VALIDITY_CHANGED event.
     *
     * @param {Object} data - Event data with canSimulate and reason
     * @returns {Object} Action to execute
     */
    handleValidityChanged(data) {
        if (!this.isVisible()) {
            // Mark data as stale when hidden
            this._state.data = DATA_STATES.STALE;
            return { action: ACTION_TYPES.NONE };
        }

        // Visible + invalid: show invalid state
        if (!data.canSimulate) {
            this._state.panel = PANEL_STATES.VISIBLE_INVALID;
            return { action: ACTION_TYPES.SHOW_INVALID, reason: data.reason };
        }

        // Visible + valid: no immediate action needed
        // (CIRCUIT_ANALYSIS_COMPUTED will fire for valid circuits)
        return { action: ACTION_TYPES.NONE };
    }


    /**
     * Handle CIRCUIT_ANALYSIS_COMPUTING event.
     *
     * @param {Object} data - Event data with percent, current, total
     * @returns {Object} Action to execute
     */
    handleComputing(data) {
        this._state.data = DATA_STATES.COMPUTING;

        if (!this.isVisible()) {
            return { action: ACTION_TYPES.NONE };
        }

        // Update panel state if we have a table
        if (this._state.panel === PANEL_STATES.VISIBLE_TABLE) {
            this._state.panel = PANEL_STATES.VISIBLE_COMPUTING;
        }

        return {
            action: ACTION_TYPES.SHOW_PROGRESS,
            percent: data.percent,
            current: data.current,
            total: data.total
        };
    }

    /**
     * Handle CIRCUIT_ANALYSIS_COMPUTED event.
     * Determines update strategy based on what changed.
     *
     * @param {Object} analysis - New analysis data
     * @param {Object|null} oldAnalysis - Previous analysis data for comparison
     * @returns {Object} Action to execute
     */
    handleComputed(analysis, oldAnalysis) {
        this._state.data = DATA_STATES.FRESH;

        if (!this.isVisible()) {
            // Mark stale so we sync when panel becomes visible
            this._state.data = DATA_STATES.STALE;
            return { action: ACTION_TYPES.NONE };
        }

        // Check structure change FIRST - applies to ALL visible states
        // This must happen before state-specific logic to ensure REBUILD_TABLE
        // is returned when structure changes, regardless of current panel state
        const structureChanged = !oldAnalysis ||
            analysis.inputs.length !== oldAnalysis.inputs.length ||
            analysis.outputs.length !== oldAnalysis.outputs.length;

        if (structureChanged) {
            // Preserve dimensions if coming from SHOWING_COMPUTING (initial computation after page refresh)
            // This prevents clearing user's saved dimensions when structure hasn't actually changed,
            // just the "computing" placeholder was compared against the new analysis
            const preserveDimensions = this._state.panel === PANEL_STATES.SHOWING_COMPUTING;
            this._state.panel = PANEL_STATES.SHOWING_TABLE;
            this._state.lastCycleIndex = null;
            return { action: ACTION_TYPES.REBUILD_TABLE, preserveDimensions };
        }

        // No structure change - determine state-specific action
        const panelState = this._state.panel;

        // If showing computing or invalid, transition to showing table
        if (panelState === PANEL_STATES.SHOWING_COMPUTING ||
            panelState === PANEL_STATES.SHOWING_INVALID ||
            panelState === PANEL_STATES.VISIBLE_COMPUTING ||
            panelState === PANEL_STATES.VISIBLE_INVALID) {

            this._state.panel = PANEL_STATES.SHOWING_TABLE;
            this._state.lastCycleIndex = null;
            return { action: ACTION_TYPES.RENDER_TABLE };
        }

        // If showing table or visible table, determine update type
        if (panelState === PANEL_STATES.SHOWING_TABLE ||
            panelState === PANEL_STATES.VISIBLE_TABLE) {

            // Check for label changes
            const labelsChanged = oldAnalysis && (
                analysis.inputs.some((inp, i) => inp.label !== oldAnalysis.inputs[i]?.label) ||
                analysis.outputs.some((out, i) => out.label !== oldAnalysis.outputs[i]?.label)
            );

            if (labelsChanged) {
                this._state.panel = PANEL_STATES.VISIBLE_TABLE;
                return { action: ACTION_TYPES.UPDATE_HEADERS };
            }

            // Data only change
            this._state.panel = PANEL_STATES.VISIBLE_TABLE;
            return { action: ACTION_TYPES.UPDATE_DATA };
        }

        return { action: ACTION_TYPES.NONE };
    }

    /**
     * Handle SIMULATION_STEP_COMPLETED event.
     * Always tracks cycle index for highlighting when panel is shown.
     *
     * @param {Object} data - Event data with cycleIndex
     * @returns {Object} Action to execute
     */
    handleStepCompleted(data) {
        // Always track the cycle index
        this._state.lastCycleIndex = data.cycleIndex;

        if (!this.isVisible()) {
            return { action: ACTION_TYPES.NONE };
        }

        // Only highlight if we have a visible table
        if (this._state.panel === PANEL_STATES.VISIBLE_TABLE) {
            return { action: ACTION_TYPES.HIGHLIGHT_ROW, index: data.cycleIndex };
        }

        return { action: ACTION_TYPES.NONE };
    }

    /**
     * Signal that a render operation has started.
     * Called by TruthTablePanel before async render.
     */
    renderStarted() {
        this._state.renderInProgress = true;
    }

    /**
     * Signal that a render operation has completed.
     * Called by TruthTablePanel after async render.
     * Transitions SHOWING_TABLE to VISIBLE_TABLE.
     */
    renderCompleted() {
        this._state.renderInProgress = false;

        // Transition from SHOWING_TABLE to VISIBLE_TABLE
        if (this._state.panel === PANEL_STATES.SHOWING_TABLE) {
            this._state.panel = PANEL_STATES.VISIBLE_TABLE;
        }
    }

    /**
     * Reset state machine to initial state.
     * Called on destroy() or when switching boards.
     */
    reset() {
        this._state = {
            panel: PANEL_STATES.HIDDEN,
            data: DATA_STATES.FRESH,
            lastCycleIndex: null,
            renderInProgress: false
        };
    }

    /**
     * Manually set the panel state.
     * Used for testing or special transitions.
     *
     * @param {string} panelState - One of PANEL_STATES values
     */
    setPanelState(panelState) {
        if (Object.values(PANEL_STATES).includes(panelState)) {
            this._state.panel = panelState;
        }
    }

    /**
     * Manually set the data state.
     * Used for testing or special transitions.
     *
     * @param {string} dataState - One of DATA_STATES values
     */
    setDataState(dataState) {
        if (Object.values(DATA_STATES).includes(dataState)) {
            this._state.data = dataState;
        }
    }

    /**
     * Clear the last cycle index.
     * Called when table structure changes.
     */
    clearLastCycleIndex() {
        this._state.lastCycleIndex = null;
    }
}
