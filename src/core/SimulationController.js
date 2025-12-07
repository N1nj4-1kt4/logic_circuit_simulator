/**
 * SimulationController - Owns simulation lifecycle
 *
 * This module manages the simulation state machine and reacts to circuit changes.
 * It encapsulates all simulation logic including auto-cycling, manual stepping,
 * and I/O structure change handling.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { simulateCircuit } from './circuitEvaluator.js';
import { TIMING } from '../constants.js';
import { InvalidCircuitError } from './errors.js';

/**
 * Simulation states
 */
export const SIMULATION_STATES = {
    IDLE: 'idle',
    RUNNING: 'running'
};

/**
 * Controls simulation lifecycle
 */
export class SimulationController {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.circuitState - The CircuitState instance
     * @param {CircuitValidityManager} config.validityManager - The validity manager
     */
    constructor(config) {
        this.circuitState = config.circuitState;
        this.validityManager = config.validityManager;

        this.state = SIMULATION_STATES.IDLE;
        this.cycleIndex = 0;
        this.totalCombinations = 0;
        this.autoCycleTimeout = null;

        // Bind event handlers
        this._handleValidityChange = this._handleValidityChange.bind(this);
        this._handleIOStructureChange = this._handleIOStructureChange.bind(this);

        // React to validity changes
        eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._handleValidityChange);

        // React to I/O structure changes during simulation
        eventBus.on(EVENT_TYPES.IO_STRUCTURE_CHANGED, this._handleIOStructureChange);
    }

    // ====================================
    // Public API
    // ====================================

    /**
     * Start auto-cycling through all input combinations
     * Cycles through all 2^n input combinations automatically on a timer
     */
    autocycleStart() {
        if (!this.validityManager.canSimulate()) {
            const validity = this.validityManager.getValidity();
            throw new InvalidCircuitError(validity.reason);
        }

        const inputs = this._getInputs();
        this.totalCombinations = Math.pow(2, inputs.length);

        // Calculate starting index from current input state, advance by 1
        const startIndex = this._calculateIndexFromInputs();
        this.cycleIndex = (startIndex + 1) % this.totalCombinations;

        this.state = SIMULATION_STATES.RUNNING;
        this.circuitState.setAutoCycling(true);

        this._emitAutocycleStateChanged('running');
        this._scheduleNextStep();
    }

    /**
     * Stop auto-cycling
     * Stops the automatic cycling through input combinations
     */
    autocycleStop() {
        this._clearTimeout();
        this.state = SIMULATION_STATES.IDLE;
        this.circuitState.setAutoCycling(false);

        this._emitAutocycleStateChanged('stopped');
    }


    /**
     * Step through simulation manually (via prev/next buttons)
     * @param {number} direction - Direction to step (1 for next, -1 for previous)
     */
    manualStep(direction = 1) {
        if (!this.validityManager.canSimulate()) {
            const validity = this.validityManager.getValidity();
            throw new InvalidCircuitError(validity.reason);
        }

        const inputs = this._getInputs();
        const newTotalCombinations = Math.pow(2, inputs.length);

        // Initialize if not already set or if input count changed
        if (this.state === SIMULATION_STATES.IDLE || this.totalCombinations !== newTotalCombinations) {
            this.cycleIndex = this._calculateIndexFromInputs();
            this.totalCombinations = newTotalCombinations;
        }

        // Calculate new index with wrap-around
        this.cycleIndex += direction;
        if (this.cycleIndex < 0) {
            this.cycleIndex = this.totalCombinations - 1;
        } else if (this.cycleIndex >= this.totalCombinations) {
            this.cycleIndex = 0;
        }

        // Apply inputs for this index and simulate
        this._applyInputsForIndex(this.cycleIndex);
        this._simulateAndEmit();
    }

    /**
     * Reset simulation to initial state (all inputs to 0)
     * @param {Object} options - Optional configuration
     * @param {boolean} options.skipSimulate - If true, don't run simulation after reset
     */
    reset(options = {}) {
        const { skipSimulate = false } = options;
        const components = this.circuitState.getComponents();
        const inputs = components.filter(c => c.type === 'INPUT');

        // Stop auto-cycle if running
        if (this.isRunning()) {
            this.autocycleStop();
        }

        if (inputs.length === 0) {
            return;
        }

        // Reset all inputs to 0
        inputs.forEach(input => {
            input.value = 0;
        });

        // Reset cycle index
        this.cycleIndex = 0;
        this.totalCombinations = Math.pow(2, inputs.length);

        // Simulate circuit (unless caller will do it after modifications)
        if (!skipSimulate) {
            this._simulateAndEmit();
        }
    }

    /**
     * Check if simulation is running
     * @returns {boolean}
     */
    isRunning() {
        return this.state === SIMULATION_STATES.RUNNING;
    }

    /**
     * Get current simulation state
     * @returns {{ state: string, cycleIndex: number, totalCombinations: number }}
     */
    getState() {
        return {
            state: this.state,
            cycleIndex: this.cycleIndex,
            totalCombinations: this.totalCombinations
        };
    }

    /**
     * Handle input toggle - run simulation when user clicks an INPUT component
     * Input values are already set by the caller (toggleInput in circuit-simulator.js)
     * Emits SIMULATION_STEP_COMPLETED for truth table row highlighting
     */
    onToggleInput() {
        this.cycleIndex = this._calculateIndexFromInputs();
        this.totalCombinations = Math.pow(2, this._getInputs().length);

        // Simulate (inputs already set by caller)
        this._simulateAndEmit();
    }

    // ====================================
    // Event Handlers
    // ====================================

    /**
     * Handle circuit validity changes
     * @private
     * @param {Object} event - Validity change event
     */
    _handleValidityChange(event) {
        if (!event.canSimulate && this.isRunning()) {
            this._clearTimeout();
            this.state = SIMULATION_STATES.IDLE;
            this.circuitState.setAutoCycling(false);
            this._emitAutocycleStateChanged('error', { error: `Circuit became invalid: ${event.reason}` });
        }
    }

    /**
     * Handle I/O structure changes during simulation
     * @private
     */
    _handleIOStructureChange() {
        if (!this.isRunning()) return;

        // Recalculate index based on current input values
        // This preserves user's current position in the new input space
        this.cycleIndex = this._calculateIndexFromInputs();
        this.totalCombinations = Math.pow(2, this._getInputs().length);
    }

    // ====================================
    // Private Helpers
    // ====================================

    /**
     * Get sorted input components
     * @private
     * @returns {Array}
     */
    _getInputs() {
        return this.circuitState.getComponents()
            .filter(c => c.type === 'INPUT')
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }

    /**
     * Get current input values
     * @private
     * @returns {Array}
     */
    _getCurrentInputValues() {
        return this._getInputs().map(input => input.value || 0);
    }

    /**
     * Calculate cycle index from current input values
     * @private
     * @returns {number}
     */
    _calculateIndexFromInputs() {
        const inputs = this._getInputs();
        let index = 0;
        for (let i = 0; i < inputs.length; i++) {
            index = (index << 1) | (inputs[i].value || 0);
        }
        return index;
    }

    /**
     * Execute simulation and emit events (common to all 3 simulation types)
     * Assumes this.cycleIndex and this.totalCombinations are already set
     * @private
     */
    _simulateAndEmit() {
        const components = this.circuitState.getComponents();
        this._restoreFromCacheOrSimulate(this.cycleIndex, components);
        this._emitStepCompleted();
    }

    /**
     * Schedule next auto-cycle step
     * @private
     */
    _scheduleNextStep() {
        this.autoCycleTimeout = setTimeout(() => {
            this._executeAutoCycleStep();
        }, TIMING.AUTO_CYCLE_DELAY);
    }

    /**
     * Execute one step of auto-cycling
     * @private
     */
    _executeAutoCycleStep() {
        if (this.state !== SIMULATION_STATES.RUNNING) return;

        // Handle I/O structure changes during simulation
        const inputs = this._getInputs();
        const currentTotalCombinations = Math.pow(2, inputs.length);
        if (currentTotalCombinations !== this.totalCombinations) {
            this.cycleIndex = this._calculateIndexFromInputs();
            this.totalCombinations = currentTotalCombinations;
        }

        // Wrap around if needed
        if (this.cycleIndex >= this.totalCombinations) {
            this.cycleIndex = 0;
        }

        // Apply inputs for this index and simulate
        this._applyInputsForIndex(this.cycleIndex);
        this._simulateAndEmit();

        // Advance to next and schedule
        this.cycleIndex = (this.cycleIndex + 1) % this.totalCombinations;
        this._scheduleNextStep();
    }

    /**
     * Apply input values for a given index
     * @private
     * @param {number} index - Combination index
     */
    _applyInputsForIndex(index) {
        const inputs = this._getInputs();
        inputs.forEach((input, i) => {
            input.value = (index >> (inputs.length - 1 - i)) & 1;
        });
    }

    /**
     * Restore component values from cache or fall back to simulation
     * @private
     * @param {number} cycleIndex - Current cycle index
     * @param {Array} components - Array of components
     * @returns {boolean} True if cache was used
     */
    _restoreFromCacheOrSimulate(cycleIndex, components) {
        const cache = this.circuitState.getCircuitAnalysis();
        if (cache && cache.isValid && cache.table && cache.table[cycleIndex]) {
            const row = cache.table[cycleIndex];

            // Restore ALL component values from cache
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
            return true;
        } else {
            // Fallback to full simulation
            this._simulate();
            return false;
        }
    }

    /**
     * Run simulation
     * @private
     */
    _simulate() {
        simulateCircuit(
            this.circuitState.getComponents(),
            this.circuitState.getConnections()
        );
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
    }

    /**
     * Clear auto-cycle timeout
     * @private
     */
    _clearTimeout() {
        if (this.autoCycleTimeout) {
            clearTimeout(this.autoCycleTimeout);
            this.autoCycleTimeout = null;
        }
    }

    /**
     * Emit auto-cycle state change event
     * @private
     * @param {'running' | 'stopped' | 'error'} state
     * @param {Object} options
     * @param {string} [options.error] - Error message when state === 'error'
     */
    _emitAutocycleStateChanged(state, options = {}) {
        eventBus.emit(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, {
            state,
            ...options
        });
    }

    /**
     * Emit simulation step completed event
     * @private
     */
    _emitStepCompleted() {
        eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
            cycleIndex: this.cycleIndex,
            totalCombinations: this.totalCombinations,
            inputValues: this._getCurrentInputValues()
        });
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        this._clearTimeout();
        eventBus.off(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._handleValidityChange);
        eventBus.off(EVENT_TYPES.IO_STRUCTURE_CHANGED, this._handleIOStructureChange);
    }
}
