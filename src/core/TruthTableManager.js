/**
 * TruthTableManager - Truth Table Computation Module
 *
 * Handles truth table computation and caching with event-driven recomputation.
 * Subscribes to circuit change events and automatically recomputes with debouncing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { computeTruthTable, computeTruthTableAsync } from './TruthTableComputer.js';
import { TIMING } from '../constants.js';

// Threshold for using async computation (number of input combinations)
const ASYNC_THRESHOLD = 256; // 8+ inputs = 256+ rows

export class TruthTableManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     */
    constructor(config) {
        this.state = config.state;

        // Truth table recomputation debounce timer
        this.truthTableDebounceTimer = null;

        // Track if async computation is in progress
        this._isComputing = false;
        this._computationId = 0; // Incremented to invalidate stale computations

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
    _handleLabelChanged() {
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
     * Uses async computation for large tables to keep UI responsive
     */
    recomputeTruthTable() {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        // Count inputs to determine if we need async computation
        const inputCount = components.filter(c => c.type === 'INPUT').length;
        const numCombinations = Math.pow(2, inputCount);

        if (numCombinations > ASYNC_THRESHOLD) {
            // Use async computation for large tables
            this._recomputeTruthTableAsync(components, connections, numCombinations);
        } else {
            // Use sync computation for small tables
            this._recomputeTruthTableSync(components, connections);
        }
    }

    /**
     * Synchronous truth table computation (for small tables)
     * @private
     */
    _recomputeTruthTableSync(components, connections) {
        const result = computeTruthTable(components, connections);
        this._handleComputationResult(result);
    }

    /**
     * Asynchronous truth table computation (for large tables)
     * @private
     */
    async _recomputeTruthTableAsync(components, connections, numCombinations) {
        // Increment computation ID to invalidate any in-progress computation
        this._computationId++;
        const currentComputationId = this._computationId;

        this._isComputing = true;

        // Clear cache immediately so panel knows computation is in progress
        this.state.setTruthTableCache(null);

        try {
            const result = await computeTruthTableAsync(components, connections, {
                onProgress: (progress) => {
                    // Only emit if this computation is still valid
                    if (this._computationId === currentComputationId) {
                        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_COMPUTING, progress);
                    }
                },
                chunkSize: 64
            });

            // Only use result if this computation is still valid
            if (this._computationId === currentComputationId) {
                this._handleComputationResult(result);
            }
        } catch (error) {
            // Computation failed - log error but don't crash
            console.error('[TruthTableManager] Async computation failed:', error);
        } finally {
            if (this._computationId === currentComputationId) {
                this._isComputing = false;
            }
        }
    }

    /**
     * Handle computation result (shared by sync and async paths)
     * @private
     */
    _handleComputationResult(result) {
        this.state.setTruthTableCache(result);

        // Also update the truthTableData for backwards compatibility
        if (result.isValid) {
            this.state.setTruthTableData(result);
        }

        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_COMPUTED, result);
    }

    /**
     * Check if computation is in progress
     * @returns {boolean}
     */
    isComputing() {
        return this._isComputing;
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
