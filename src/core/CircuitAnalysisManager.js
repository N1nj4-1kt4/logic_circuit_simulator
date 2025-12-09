/**
 * CircuitAnalysisManager - Circuit Analysis Computation Module
 *
 * Handles circuit analysis (truth table data) computation and caching with event-driven recomputation.
 * Subscribes to circuit change events and automatically recomputes with debouncing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { computeCircuitAnalysis, computeCircuitAnalysisAsync } from './CircuitAnalyzer.js';
import { TIMING } from '../constants.js';

// Threshold for using async computation (number of input combinations)
const ASYNC_THRESHOLD = 256; // 8+ inputs = 256+ rows

export class CircuitAnalysisManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     */
    constructor(config) {
        this.state = config.state;

        // Circuit analysis recomputation debounce timer
        this.analysisDebounceTimer = null;

        // Track if async computation is in progress
        this._isComputing = false;
        this._computationId = 0; // Incremented to invalidate stale computations

        // Bind handlers for cleanup
        this._handleBoardChanged = this._handleBoardChanged.bind(this);
        this._handleLabelChanged = this._handleLabelChanged.bind(this);
        this._handleBoardCleared = this._handleBoardCleared.bind(this);
        this._handleBoardLoaded = this._handleBoardLoaded.bind(this);

        // Subscribe to circuit changes for analysis recomputation
        this._setupAnalysisRecomputation();
    }

    /**
     * Setup event listeners for circuit analysis recomputation
     * @private
     */
    _setupAnalysisRecomputation() {
        // Recompute analysis on any circuit topology change
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);

        // Recompute analysis when input/output labels change
        // (affects column headers in truth table display)
        eventBus.on(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this._handleLabelChanged);

        // Clear analysis on board cleared
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);

        // Recompute analysis when board is loaded (including revert to saved)
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }

    /**
     * Handle BOARD_CHANGED event
     * @private
     */
    _handleBoardChanged() {
        this._debouncedRecomputeAnalysis();
    }

    /**
     * Handle COMPONENT_LABEL_CHANGED event
     * Labels are display metadata only - no need to recompute truth table.
     * Just patch the label in the existing analysis.
     * @private
     */
    _handleLabelChanged({ component, newLabel }) {
        const analysis = this.state.getCircuitAnalysis();
        if (!analysis) return;

        const list = component.type === 'INPUT' ? analysis.inputs : analysis.outputs;
        const item = list.find(i => i.id === component.id);
        if (item) item.label = newLabel;

        this.state.setCircuitAnalysis(analysis);

        // Only emit CIRCUIT_ANALYSIS_COMPUTED for valid circuits
        // Invalid circuits are handled by CIRCUIT_VALIDITY_CHANGED
        if (analysis.isValid) {
            eventBus.emit(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, analysis);
        }
    }

    /**
     * Handle BOARD_CLEARED event
     * @private
     */
    _handleBoardCleared() {
        this.state.setCircuitAnalysis(null);
    }

    /**
     * Handle BOARD_LOADED event - recompute for loaded/reverted circuit
     * @private
     */
    _handleBoardLoaded() {
        this.recomputeAnalysis();
    }

    /**
     * Debounced recomputation of circuit analysis
     * @private
     */
    _debouncedRecomputeAnalysis() {
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
        }
        this.analysisDebounceTimer = setTimeout(() => {
            this.recomputeAnalysis();
        }, TIMING.TRUTH_TABLE_DEBOUNCE);
    }

    /**
     * Recompute circuit analysis and store in state
     * Uses async computation for large analyses to keep UI responsive
     */
    recomputeAnalysis() {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        // Count inputs to determine if we need async computation
        const inputCount = components.filter(c => c.type === 'INPUT').length;
        const numCombinations = Math.pow(2, inputCount);

        if (numCombinations > ASYNC_THRESHOLD) {
            // Use async computation for large analyses
            this._recomputeAnalysisAsync(components, connections, numCombinations);
        } else {
            // Use sync computation for small analyses
            this._recomputeAnalysisSync(components, connections);
        }
    }

    /**
     * Synchronous circuit analysis computation (for small circuits)
     * @private
     */
    _recomputeAnalysisSync(components, connections) {
        const result = computeCircuitAnalysis(components, connections);
        this._handleComputationResult(result);
    }

    /**
     * Asynchronous circuit analysis computation (for large circuits)
     * @private
     */
    async _recomputeAnalysisAsync(components, connections, numCombinations) {
        // Increment computation ID to invalidate any in-progress computation
        this._computationId++;
        const currentComputationId = this._computationId;

        this._isComputing = true;

        // Clear analysis immediately so panel knows computation is in progress
        this.state.setCircuitAnalysis(null);

        try {
            const result = await computeCircuitAnalysisAsync(components, connections, {
                onProgress: (progress) => {
                    // Only emit if this computation is still valid
                    if (this._computationId === currentComputationId) {
                        eventBus.emit(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTING, progress);
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
            console.error('[CircuitAnalysisManager] Async computation failed:', error);
        } finally {
            if (this._computationId === currentComputationId) {
                this._isComputing = false;
            }
        }
    }

    /**
     * Handle computation result (shared by sync and async paths)
     *
     * NOTE: CIRCUIT_ANALYSIS_COMPUTED is only emitted for valid circuits.
     * Invalid circuits are handled by CIRCUIT_VALIDITY_CHANGED, which fires
     * immediately on topology changes. This avoids redundant invalid-state
     * handling in subscribers like TruthTablePanel.
     *
     * @private
     */
    _handleComputationResult(result) {
        // Always store the analysis in state (valid or invalid)
        // This allows show() to read from state when panel opens
        this.state.setCircuitAnalysis(result);

        // Only emit CIRCUIT_ANALYSIS_COMPUTED for valid circuits
        // Invalid circuits are handled by CIRCUIT_VALIDITY_CHANGED
        if (result.isValid) {
            eventBus.emit(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, result);
        }
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
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
            this.analysisDebounceTimer = null;
        }

        // Remove event listeners
        eventBus.off(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);
        eventBus.off(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this._handleLabelChanged);
        eventBus.off(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);
        eventBus.off(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }
}
