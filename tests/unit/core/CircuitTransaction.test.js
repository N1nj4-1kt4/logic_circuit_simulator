/**
 * Tests for CircuitTransaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitTransaction } from '../../../src/core/CircuitTransaction.js';

describe('CircuitTransaction', () => {
    let transaction;
    let mockCircuitState;
    let validCircuit;

    beforeEach(() => {
        // Create a valid circuit
        validCircuit = {
            components: [
                { id: 1, type: 'INPUT', label: 'I1', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'I2', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] },
                { id: 4, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ],
            connections: [
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 3, toPort: 0 }
            ]
        };

        mockCircuitState = {
            getComponents: vi.fn().mockReturnValue(validCircuit.components),
            getConnections: vi.fn().mockReturnValue(validCircuit.connections),
            removeComponent: vi.fn(),
            removeConnection: vi.fn()
        };

        transaction = new CircuitTransaction(mockCircuitState);
    });

    describe('constructor', () => {
        it('should clone current circuit state', () => {
            expect(transaction.getSimulatedComponents()).toHaveLength(4);
            expect(transaction.getSimulatedConnections()).toHaveLength(3);
        });

        it('should not be committed initially', () => {
            expect(transaction.isCommitted()).toBe(false);
        });

        it('should have no operations initially', () => {
            expect(transaction.getOperations()).toHaveLength(0);
        });
    });

    describe('removeComponent', () => {
        it('should queue component removal', () => {
            transaction.removeComponent(1);
            expect(transaction.getOperations()).toHaveLength(1);
            expect(transaction.getOperations()[0].type).toBe('removeComponent');
            expect(transaction.getOperations()[0].componentId).toBe(1);
        });

        it('should remove component from simulated state', () => {
            transaction.removeComponent(1);
            const simComponents = transaction.getSimulatedComponents();
            expect(simComponents.find(c => c.id === 1)).toBeUndefined();
        });

        it('should remove associated connections from simulated state', () => {
            transaction.removeComponent(1);
            const simConnections = transaction.getSimulatedConnections();
            // Connection from component 1 should be removed
            expect(simConnections.find(c => c.from === 1)).toBeUndefined();
        });

        it('should support chaining', () => {
            const result = transaction.removeComponent(1);
            expect(result).toBe(transaction);
        });

        it('should throw if transaction is committed', () => {
            transaction.commit();
            expect(() => transaction.removeComponent(1)).toThrow('Cannot modify committed transaction');
        });
    });

    describe('removeConnection', () => {
        it('should queue connection removal', () => {
            const conn = validCircuit.connections[0];
            transaction.removeConnection(conn);
            expect(transaction.getOperations()).toHaveLength(1);
            expect(transaction.getOperations()[0].type).toBe('removeConnection');
        });

        it('should remove connection from simulated state', () => {
            const conn = validCircuit.connections[0];
            transaction.removeConnection(conn);
            const simConnections = transaction.getSimulatedConnections();
            expect(simConnections).toHaveLength(2);
        });

        it('should support chaining', () => {
            const result = transaction.removeConnection(validCircuit.connections[0]);
            expect(result).toBe(transaction);
        });

        it('should throw if transaction is committed', () => {
            transaction.commit();
            expect(() => transaction.removeConnection(validCircuit.connections[0]))
                .toThrow('Cannot modify committed transaction');
        });
    });

    describe('analyze', () => {
        it('should return valid analysis for intact circuit', () => {
            const analysis = transaction.analyze();
            expect(analysis.wouldBeValid).toBe(true);
            expect(analysis.newValidity).toBe('valid');
            expect(analysis.removedComponentCount).toBe(0);
            expect(analysis.removedConnectionCount).toBe(0);
        });

        it('should detect when removal would invalidate circuit', () => {
            // Remove the gate - this should invalidate the circuit
            transaction.removeComponent(4);
            const analysis = transaction.analyze();
            expect(analysis.wouldBeValid).toBe(false);
            expect(analysis.newValidity).toBe('incomplete');
        });

        it('should count removed components and connections', () => {
            transaction.removeComponent(1);
            const analysis = transaction.analyze();
            expect(analysis.removedComponentCount).toBe(1);
            // Removing component 1 also removes its connection
            expect(analysis.removedConnectionCount).toBe(1);
        });

        it('should track affected components', () => {
            transaction.removeComponent(1);
            const analysis = transaction.analyze();
            expect(analysis.affectedComponents).toContain(1);
        });

        it('should include input and output counts', () => {
            const analysis = transaction.analyze();
            expect(analysis.inputCount).toBe(2);
            expect(analysis.outputCount).toBe(1);
        });
    });

    describe('commit', () => {
        it('should apply operations to circuit state', () => {
            transaction.removeComponent(1);
            transaction.commit();

            expect(mockCircuitState.removeComponent).toHaveBeenCalledWith(1);
        });

        it('should mark transaction as committed', () => {
            transaction.commit();
            expect(transaction.isCommitted()).toBe(true);
        });

        it('should return true on success', () => {
            const result = transaction.commit();
            expect(result).toBe(true);
        });

        it('should throw if already committed', () => {
            transaction.commit();
            expect(() => transaction.commit()).toThrow('Transaction already committed');
        });

        it('should apply multiple operations in order', () => {
            const conn = validCircuit.connections[0];
            transaction.removeComponent(1);
            transaction.removeConnection(conn);
            transaction.commit();

            expect(mockCircuitState.removeComponent).toHaveBeenCalledWith(1);
            expect(mockCircuitState.removeConnection).toHaveBeenCalledWith(conn);
        });
    });

    describe('chaining', () => {
        it('should support method chaining', () => {
            const conn = validCircuit.connections[1];
            transaction
                .removeComponent(2)
                .removeConnection(conn);

            expect(transaction.getOperations()).toHaveLength(2);
        });
    });

    describe('isolation', () => {
        it('should not modify original state before commit', () => {
            transaction.removeComponent(1);
            transaction.removeConnection(validCircuit.connections[0]);

            // Original state should be unchanged
            expect(mockCircuitState.removeComponent).not.toHaveBeenCalled();
            expect(mockCircuitState.removeConnection).not.toHaveBeenCalled();
        });

        it('should work with deep cloned state', () => {
            // Modify the simulated state
            transaction.removeComponent(1);

            // Original array reference should be unaffected
            expect(validCircuit.components).toHaveLength(4);
        });
    });
});
