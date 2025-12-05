/**
 * CircuitValidityManager - Single source of truth for circuit validity state
 *
 * This module manages the validity state of the circuit and emits events
 * when validity changes. Components subscribe to CIRCUIT_VALIDITY_CHANGED
 * instead of checking validity themselves.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { validateCircuitForTruthTable } from './TruthTableComputer.js';

/**
 * Circuit validity states
 */
export const VALIDITY_STATES = {
    EMPTY: 'empty',           // No components
    INCOMPLETE: 'incomplete', // Has I/O but not fully connected
    VALID: 'valid'            // Ready to simulate
};

/**
 * Manages circuit validity state and emits events on changes
 */
export class CircuitValidityManager {
    /**
     * @param {Object} circuitState - The CircuitState instance
     */
    constructor(circuitState) {
        this.circuitState = circuitState;
        this.currentValidity = VALIDITY_STATES.EMPTY;
        this.lastReason = null;
        this.lastValidation = null;

        // React to topology changes
        this._handleBoardChanged = this._handleBoardChanged.bind(this);
        this._handleBoardCleared = this._handleBoardCleared.bind(this);
        this._handleBoardLoaded = this._handleBoardLoaded.bind(this);

        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }

    /**
     * Handle board changed events
     * @private
     */
    _handleBoardChanged() {
        this.revalidate();
    }

    /**
     * Handle board cleared events
     * @private
     */
    _handleBoardCleared() {
        this.revalidate();
    }

    /**
     * Handle board loaded events
     * @private
     */
    _handleBoardLoaded() {
        this.revalidate();
    }

    /**
     * Revalidate the circuit and emit event if validity changed
     */
    revalidate() {
        const components = this.circuitState.getComponents();
        const connections = this.circuitState.getConnections();
        const validation = validateCircuitForTruthTable(components, connections);

        const newValidity = this._computeValidity(validation, components);
        const oldValidity = this.currentValidity;

        // Store last validation for external access
        this.lastValidation = validation;

        // Always check structure change (must call before the condition to avoid short-circuit)
        // This ensures I/O counts are tracked and IO_STRUCTURE_CHANGED is emitted when needed
        const structureChanged = this._hasStructureChanged(validation);
        const validityChanged = oldValidity !== newValidity;

        if (validityChanged || structureChanged) {
            this.currentValidity = newValidity;
            this.lastReason = validation.reason;

            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                from: oldValidity,
                to: newValidity,
                canSimulate: newValidity === VALIDITY_STATES.VALID,
                reason: validation.reason,
                inputs: validation.inputs,
                outputs: validation.outputs,
                isValid: validation.isValid
            });
        }
    }

    /**
     * Check if I/O structure has changed
     * @private
     * @param {Object} validation - Current validation result
     * @returns {boolean}
     */
    _hasStructureChanged(validation) {
        // First call - initialize tracking (use undefined check, not falsy, since 0 is valid)
        if (this._previousInputCount === undefined || this._previousOutputCount === undefined) {
            this._previousInputCount = validation.inputs.length;
            this._previousOutputCount = validation.outputs.length;
            return false;
        }

        const changed = validation.inputs.length !== this._previousInputCount ||
                       validation.outputs.length !== this._previousOutputCount;

        if (changed) {
            const event = {
                previousInputCount: this._previousInputCount,
                previousOutputCount: this._previousOutputCount,
                newInputCount: validation.inputs.length,
                newOutputCount: validation.outputs.length,
                inputs: validation.inputs,
                outputs: validation.outputs
            };

            this._previousInputCount = validation.inputs.length;
            this._previousOutputCount = validation.outputs.length;

            // Emit I/O structure change event
            eventBus.emit(EVENT_TYPES.IO_STRUCTURE_CHANGED, event);
        }

        return changed;
    }

    /**
     * Check if the circuit can be simulated
     * @returns {boolean}
     */
    canSimulate() {
        return this.currentValidity === VALIDITY_STATES.VALID;
    }

    /**
     * Get current validity state
     * @returns {{ state: string, reason: string|null }}
     */
    getValidity() {
        return {
            state: this.currentValidity,
            reason: this.lastReason
        };
    }

    /**
     * Get the last validation result
     * @returns {Object|null}
     */
    getLastValidation() {
        return this.lastValidation;
    }

    /**
     * Predictive validation for proposed changes
     * @param {Array} proposedComponents - Components after proposed change
     * @param {Array} proposedConnections - Connections after proposed change
     * @returns {{ isValid: boolean, reason: string|null, validity: string }}
     */
    wouldBeValidAfter(proposedComponents, proposedConnections) {
        const validation = validateCircuitForTruthTable(proposedComponents, proposedConnections);
        return {
            isValid: validation.isValid,
            reason: validation.reason,
            validity: this._computeValidity(validation, proposedComponents),
            inputs: validation.inputs,
            outputs: validation.outputs
        };
    }

    /**
     * Compute validity state from validation result
     * @private
     * @param {Object} validation - Validation result
     * @param {Array} components - Current components
     * @returns {string} - One of VALIDITY_STATES
     */
    _computeValidity(validation, components) {
        // Empty if no components at all
        if (components.length === 0) {
            return VALIDITY_STATES.EMPTY;
        }

        // Empty if no inputs AND no outputs
        if (validation.inputs.length === 0 && validation.outputs.length === 0) {
            return VALIDITY_STATES.EMPTY;
        }

        // Invalid means incomplete
        if (!validation.isValid) {
            return VALIDITY_STATES.INCOMPLETE;
        }

        return VALIDITY_STATES.VALID;
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        eventBus.off(EVENT_TYPES.BOARD_CHANGED, this._handleBoardChanged);
        eventBus.off(EVENT_TYPES.BOARD_CLEARED, this._handleBoardCleared);
        eventBus.off(EVENT_TYPES.BOARD_LOADED, this._handleBoardLoaded);
    }
}
