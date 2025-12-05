/**
 * TruthTableManager - Truth Table Computation Module
 *
 * Handles truth table computation and caching with event-driven recomputation.
 * Subscribes to circuit change events and automatically recomputes with debouncing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { logger } from '../utils/logger.js';
import { computeTruthTable } from './TruthTableComputer.js';
import { TIMING } from '../constants.js';

export class TruthTableManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     */
    constructor(config) {
        this.state = config.state;

        // Truth table recomputation debounce timer
        this.truthTableDebounceTimer = null;

        // Bind handlers for cleanup
        this._handleBoardChanged = this._handleBoardChanged.bind(this);
        this._handleLabelChanged = this._handleLabelChanged.bind(this);
        this._handleBoardCleared = this._handleBoardCleared.bind(this);
        this._handleBoardLoaded = this._handleBoardLoaded.bind(this);

        // Subscribe to circuit changes for truth table recomputation
        this._setupTruthTableRecomputation();
    }

    /**
     * Setup event listeners for truth table recomputation
     * @private
     */
    _setupTruthTableRecomputation() {
        // Recompute truth table on any circuit topology change
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);

        // Recompute truth table when input/output labels change
        // (affects column headers in truth table display)
        eventBus.on(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this._handleLabelChanged);

        // Clear cache on board cleared
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);

        // Recompute truth table when board is loaded (including revert to saved)
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }

    /**
     * Handle BOARD_CHANGED event
     * @private
     */
    _handleBoardChanged() {
        this._debouncedRecomputeTruthTable();
    }

    /**
     * Handle COMPONENT_LABEL_CHANGED event
     * @private
     */
    _handleLabelChanged(data) {
        logger.debug('[TruthTableManager] Received COMPONENT_LABEL_CHANGED:', data);
        this._debouncedRecomputeTruthTable();
    }

    /**
     * Handle BOARD_CLEARED event
     * @private
     */
    _handleBoardCleared() {
        this.state.setTruthTableCache(null);
    }

    /**
     * Handle BOARD_LOADED event - recompute for loaded/reverted circuit
     * @private
     */
    _handleBoardLoaded() {
        this.recomputeTruthTable();
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

        logger.debug('[TruthTableManager] recomputeTruthTable called');

        const result = computeTruthTable(components, connections);
        this.state.setTruthTableCache(result);

        logger.debug('[TruthTableManager] Truth table computed, emitting TRUTH_TABLE_COMPUTED:', {
            inputLabels: result.inputs?.map(i => i.label),
            outputLabels: result.outputs?.map(o => o.label),
            isValid: result.isValid
        });

        // Also update the truthTableData for backwards compatibility
        if (result.isValid) {
            this.state.setTruthTableData(result);
        }

        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_COMPUTED, result);
    }

    /**
     * Clean up event listeners and timers
     */
    destroy() {
        // Clear debounce timer
        if (this.truthTableDebounceTimer) {
            clearTimeout(this.truthTableDebounceTimer);
            this.truthTableDebounceTimer = null;
        }

        // Remove event listeners
        eventBus.off(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);
        eventBus.off(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this._handleLabelChanged);
        eventBus.off(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);
        eventBus.off(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }
}
