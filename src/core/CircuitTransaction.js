/**
 * CircuitTransaction - Predictive changes pattern
 *
 * This class allows analyzing the impact of proposed circuit changes before
 * committing them. It separates "what would happen" from "make it happen".
 */

import { validateCircuitForAnalysis } from './CircuitAnalyzer.js';

/**
 * Transaction for circuit changes
 * Allows analyzing impact before committing
 */
export class CircuitTransaction {
    /**
     * @param {CircuitState} circuitState - The circuit state instance
     */
    constructor(circuitState) {
        this.circuitState = circuitState;
        this.operations = [];
        this.committed = false;

        // Clone current state for simulation
        this.simulatedComponents = JSON.parse(JSON.stringify(circuitState.getComponents()));
        this.simulatedConnections = JSON.parse(JSON.stringify(circuitState.getConnections()));
    }

    /**
     * Queue a component removal
     * @param {string|number} componentId - ID of component to remove
     * @returns {CircuitTransaction} this (for chaining)
     */
    removeComponent(componentId) {
        if (this.committed) {
            throw new Error('Cannot modify committed transaction');
        }

        this.operations.push({ type: 'removeComponent', componentId });

        // Apply to simulated state
        this.simulatedComponents = this.simulatedComponents.filter(c => c.id !== componentId);
        this.simulatedConnections = this.simulatedConnections.filter(
            conn => conn.from !== componentId && conn.to !== componentId
        );

        return this;
    }

    /**
     * Queue a connection removal
     * @param {Object} connection - Connection to remove
     * @returns {CircuitTransaction} this (for chaining)
     */
    removeConnection(connection) {
        if (this.committed) {
            throw new Error('Cannot modify committed transaction');
        }

        this.operations.push({ type: 'removeConnection', connection });

        // Apply to simulated state
        this.simulatedConnections = this.simulatedConnections.filter(conn =>
            !(conn.from === connection.from && conn.to === connection.to &&
              conn.fromPort === connection.fromPort && conn.toPort === connection.toPort)
        );

        return this;
    }

    /**
     * Analyze the impact of the queued operations
     * @returns {Object} Analysis result
     */
    analyze() {
        const validation = validateCircuitForAnalysis(
            this.simulatedComponents,
            this.simulatedConnections
        );

        // Count changes
        const originalComponentCount = this.circuitState.getComponents().length;
        const originalConnectionCount = this.circuitState.getConnections().length;
        const removedComponentCount = originalComponentCount - this.simulatedComponents.length;
        const removedConnectionCount = originalConnectionCount - this.simulatedConnections.length;

        return {
            wouldBeValid: validation.isValid,
            newValidity: validation.isValid ? 'valid' : 'incomplete',
            reason: validation.reason,
            affectedComponents: this._getAffectedComponents(),
            inputCount: validation.inputs.length,
            outputCount: validation.outputs.length,
            removedComponentCount,
            removedConnectionCount,
            inputs: validation.inputs,
            outputs: validation.outputs
        };
    }

    /**
     * Commit the queued operations to the real circuit state
     * @returns {boolean} True if commit was successful
     */
    commit() {
        if (this.committed) {
            throw new Error('Transaction already committed');
        }

        // Apply operations to real state
        for (const op of this.operations) {
            switch (op.type) {
                case 'removeComponent':
                    this.circuitState.removeComponent(op.componentId);
                    break;
                case 'removeConnection':
                    this.circuitState.removeConnection(op.connection);
                    break;
            }
        }

        this.committed = true;
        return true;
    }

    /**
     * Check if the transaction has been committed
     * @returns {boolean}
     */
    isCommitted() {
        return this.committed;
    }

    /**
     * Get list of operations queued
     * @returns {Array}
     */
    getOperations() {
        return [...this.operations];
    }

    /**
     * Get simulated components (state after transaction would be applied)
     * @returns {Array}
     */
    getSimulatedComponents() {
        return this.simulatedComponents;
    }

    /**
     * Get simulated connections (state after transaction would be applied)
     * @returns {Array}
     */
    getSimulatedConnections() {
        return this.simulatedConnections;
    }

    /**
     * Get list of affected component IDs
     * @private
     * @returns {Array}
     */
    _getAffectedComponents() {
        const affected = new Set();

        for (const op of this.operations) {
            if (op.type === 'removeComponent') {
                affected.add(op.componentId);
            } else if (op.type === 'removeConnection') {
                // Components at either end of the connection are affected
                affected.add(op.connection.from);
                affected.add(op.connection.to);
            }
        }

        return Array.from(affected);
    }
}
