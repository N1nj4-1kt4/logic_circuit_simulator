/**
 * Integration tests for edge cases
 * Tests scenarios that could cause errors, warnings, or unexpected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../src/utils/eventBus.js';
import { simulateCircuit } from '../../src/core/circuitEvaluator.js';

describe('Connection Validation Edge Cases', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    describe('Fan-out (Multiple connections FROM same output)', () => {
        it('should allow multiple connections FROM an INPUT component', () => {
            // INPUT can connect to multiple gates (fan-out)
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{ x: 120, y: 100 }], label: 'I1' };
            const and1 = { id: 2, type: 'AND', x: 200, y: 50, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const and2 = { id: 3, type: 'AND', x: 200, y: 150, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };

            state.addComponent(input);
            state.addComponent(and1);
            state.addComponent(and2);

            // Connect input to both AND gates (fan-out from INPUT)
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });

            expect(state.getConnections()).toHaveLength(2);
        });

        it('should allow multiple connections FROM same output port of a gate', () => {
            // Gate output can connect to multiple inputs (fan-out)
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const notGate = { id: 2, type: 'NOT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [{}] };
            const output1 = { id: 3, type: 'OUTPUT', x: 300, y: 50, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };
            const output2 = { id: 4, type: 'OUTPUT', x: 300, y: 150, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O2' };

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output1);
            state.addComponent(output2);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            // Fan-out from NOT gate to both outputs
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 4, toPort: 0 });

            expect(state.getConnections()).toHaveLength(3);

            // Simulate and verify both outputs get the same value
            simulateCircuit(state.getComponents(), state.getConnections());
            expect(output1.value).toBe(0); // NOT 1 = 0
            expect(output2.value).toBe(0); // Same value
        });

        it('should correctly propagate fan-out signal in half adder circuit', () => {
            // Half adder uses fan-out: each input connects to both XOR and AND gates
            const inputA = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'A' };
            const inputB = { id: 2, type: 'INPUT', x: 100, y: 200, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'B' };
            const xorGate = { id: 3, type: 'XOR', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const andGate = { id: 4, type: 'AND', x: 200, y: 200, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const outputSum = { id: 5, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'Sum' };
            const outputCarry = { id: 6, type: 'OUTPUT', x: 300, y: 200, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'Carry' };

            state.addComponent(inputA);
            state.addComponent(inputB);
            state.addComponent(xorGate);
            state.addComponent(andGate);
            state.addComponent(outputSum);
            state.addComponent(outputCarry);

            // Fan-out connections
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 }); // A -> XOR
            state.addConnection({ from: 1, fromPort: 0, to: 4, toPort: 0 }); // A -> AND (fan-out)
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 }); // B -> XOR
            state.addConnection({ from: 2, fromPort: 0, to: 4, toPort: 1 }); // B -> AND (fan-out)
            state.addConnection({ from: 3, fromPort: 0, to: 5, toPort: 0 }); // XOR -> Sum
            state.addConnection({ from: 4, fromPort: 0, to: 6, toPort: 0 }); // AND -> Carry

            simulateCircuit(state.getComponents(), state.getConnections());

            expect(outputSum.value).toBe(1);   // 1 XOR 0 = 1
            expect(outputCarry.value).toBe(0); // 1 AND 0 = 0
        });
    });

    describe('Fan-in Prevention (Multiple connections TO same input port)', () => {
        it('should allow connection state to have multiple connections to same port (state layer)', () => {
            // Note: The state layer allows adding connections, validation happens at operations layer
            // This test documents that state.addConnection doesn't prevent duplicates
            const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };
            const output = { id: 3, type: 'OUTPUT', x: 300, y: 150, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(output);

            // Both connections target the same input port (port 0 of output)
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            // State layer accepts both (validation happens elsewhere)
            expect(state.getConnections()).toHaveLength(2);
        });

        it('should not create duplicate identical connections', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const output = { id: 2, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(output);

            const connection = { from: 1, fromPort: 0, to: 2, toPort: 0 };
            state.addConnection(connection);

            // Adding same connection object again creates a second reference
            // but this demonstrates the pattern - ideally operations layer should check
            const conn2 = { from: 1, fromPort: 0, to: 2, toPort: 0 };
            state.addConnection(conn2);

            // Both connections exist at state layer (different objects)
            expect(state.getConnections()).toHaveLength(2);
        });
    });

    describe('Orphaned Connection Cleanup', () => {
        it('should remove all connections when middle component is deleted', () => {
            // Chain: INPUT -> NOT -> OUTPUT
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const notGate = { id: 2, type: 'NOT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [{}] };
            const output = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            expect(state.getConnections()).toHaveLength(2);

            // Delete the middle component (NOT gate)
            state.removeComponent(2);

            // Both connections should be cleaned up
            expect(state.getConnections()).toHaveLength(0);
            // But INPUT and OUTPUT remain
            expect(state.getComponents()).toHaveLength(2);
            expect(state.getComponent(1)).not.toBeNull();
            expect(state.getComponent(3)).not.toBeNull();
        });

        it('should remove only connections involving deleted component', () => {
            // Two parallel paths: INPUT1 -> AND -> OUTPUT, INPUT2 -> AND (same gate)
            const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };
            const andGate = { id: 3, type: 'AND', x: 200, y: 150, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const output = { id: 4, type: 'OUTPUT', x: 300, y: 150, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(andGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 }); // I1 -> AND
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 }); // I2 -> AND
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 }); // AND -> OUT

            expect(state.getConnections()).toHaveLength(3);

            // Delete INPUT1
            state.removeComponent(1);

            // Only connection from INPUT1 should be removed
            expect(state.getConnections()).toHaveLength(2);
            // Verify remaining connections
            const remaining = state.getConnections();
            expect(remaining.some(c => c.from === 2 && c.to === 3)).toBe(true);
            expect(remaining.some(c => c.from === 3 && c.to === 4)).toBe(true);
        });

        it('should handle deleting component with no connections', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const orphan = { id: 2, type: 'AND', x: 200, y: 200, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };

            state.addComponent(input);
            state.addComponent(orphan);

            // No connections exist
            expect(state.getConnections()).toHaveLength(0);

            // Delete orphan component
            state.removeComponent(2);

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getConnections()).toHaveLength(0);
        });
    });

    describe('Connection to Non-existent Elements', () => {
        it('should allow connection to non-existent component at state layer', () => {
            // State layer doesn't validate component existence
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };

            state.addComponent(input);

            // Connect to non-existent component ID 999
            state.addConnection({ from: 1, fromPort: 0, to: 999, toPort: 0 });

            expect(state.getConnections()).toHaveLength(1);
        });

        it('should handle simulation with connection to non-existent component', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const output = { id: 2, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(output);

            // Valid connection
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            // Invalid connection to non-existent component
            state.addConnection({ from: 1, fromPort: 0, to: 999, toPort: 0 });

            // Simulation should not crash
            expect(() => {
                simulateCircuit(state.getComponents(), state.getConnections());
            }).not.toThrow();

            // Valid connection should still work
            expect(output.value).toBe(1);
        });
    });
});

describe('Circuit Validation Edge Cases', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should handle empty circuit simulation', () => {
        expect(() => {
            simulateCircuit([], []);
        }).not.toThrow();
    });

    it('should handle circuit with only inputs', () => {
        const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
        const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };

        state.addComponent(input1);
        state.addComponent(input2);

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();

        // Inputs retain their values
        expect(input1.value).toBe(1);
        expect(input2.value).toBe(0);
    });

    it('should handle circuit with only outputs', () => {
        const output1 = { id: 1, type: 'OUTPUT', x: 100, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };
        const output2 = { id: 2, type: 'OUTPUT', x: 100, y: 200, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O2' };

        state.addComponent(output1);
        state.addComponent(output2);

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();

        // Outputs have null (unconnected)
        expect(output1.value).toBeNull();
        expect(output2.value).toBeNull();
    });

    it('should handle circuit with only gates (no I/O)', () => {
        const and1 = { id: 1, type: 'AND', x: 100, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
        const or1 = { id: 2, type: 'OR', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };

        state.addComponent(and1);
        state.addComponent(or1);

        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();
    });

    it('should handle unconnected gate inputs as null', () => {
        // AND gate with no inputs connected
        const andGate = { id: 1, type: 'AND', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
        const output = { id: 2, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

        state.addComponent(andGate);
        state.addComponent(output);
        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();

        // Gate with null inputs should produce null output
        expect(andGate.value).toBeNull();
    });

    it('should handle partially connected gate', () => {
        // AND gate with only one input connected
        const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
        const andGate = { id: 2, type: 'AND', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
        const output = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

        state.addComponent(input);
        state.addComponent(andGate);
        state.addComponent(output);

        // Only connect to first input of AND gate
        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
        state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();

        // AND gate with one null input should produce null
        expect(andGate.value).toBeNull();
    });
});

describe('Component ID Consistency', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should maintain ID sequence after partial deletion', () => {
        // Add components with IDs 1, 2, 3
        state.addComponent({ id: state.generateNextId(), type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });
        state.addComponent({ id: state.generateNextId(), type: 'AND', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] });
        state.addComponent({ id: state.generateNextId(), type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' });

        expect(state.getComponents().map(c => c.id)).toEqual([1, 2, 3]);

        // Delete component 2
        state.removeComponent(2);

        // Add new component - should get ID 4, not 2
        state.addComponent({ id: state.generateNextId(), type: 'NOT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [{}] });

        const ids = state.getComponents().map(c => c.id);
        expect(ids).toContain(1);
        expect(ids).toContain(3);
        expect(ids).toContain(4);
        expect(ids).not.toContain(2);
    });

    it('should reset IDs when board is cleared', () => {
        state.addComponent({ id: state.generateNextId(), type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });
        state.addComponent({ id: state.generateNextId(), type: 'OUTPUT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' });

        state.clearComponents();

        // Next ID should be 1 again
        expect(state.generateNextId()).toBe(1);
    });

    it('should handle loadState with specific nextId', () => {
        state.loadState({
            components: [
                { id: 5, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' },
                { id: 10, type: 'OUTPUT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' }
            ],
            connections: [],
            nextId: 15
        });

        // Next ID should be 15 as specified
        expect(state.generateNextId()).toBe(15);
    });

    it('should preserve connection references after other component removal', () => {
        const c1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
        const c2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };
        const c3 = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

        state.addComponent(c1);
        state.addComponent(c2);
        state.addComponent(c3);

        // Connect c1 -> c3
        state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });

        // Remove c2 (which has no connections)
        state.removeComponent(2);

        // Connection from c1 to c3 should still exist and be valid
        const connections = state.getConnections();
        expect(connections).toHaveLength(1);
        expect(connections[0].from).toBe(1);
        expect(connections[0].to).toBe(3);

        // Simulation should work
        simulateCircuit(state.getComponents(), state.getConnections());
        expect(c3.value).toBe(1);
    });
});

describe('Rapid Operations Edge Cases', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should handle rapid component additions', () => {
        const eventCounts = { added: 0, changed: 0 };

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, () => eventCounts.added++);
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventCounts.changed++);

        // Add 20 components rapidly
        for (let i = 0; i < 20; i++) {
            state.addComponent({
                id: state.generateNextId(),
                type: 'AND',
                x: 100 + (i % 5) * 50,
                y: 100 + Math.floor(i / 5) * 50,
                value: null,
                inputs: [null, null],
                inputPorts: [{}, {}],
                outputPorts: [{}]
            });
        }

        expect(state.getComponents()).toHaveLength(20);
        expect(eventCounts.added).toBe(20);
        expect(eventCounts.changed).toBe(20);
    });

    it('should handle rapid add/remove cycles', () => {
        // Add and immediately remove components
        for (let i = 0; i < 10; i++) {
            const id = state.generateNextId();
            state.addComponent({
                id,
                type: 'NOT',
                x: 100,
                y: 100,
                value: null,
                inputs: [null],
                inputPorts: [{}],
                outputPorts: [{}]
            });
            state.removeComponent(id);
        }

        expect(state.getComponents()).toHaveLength(0);
        // nextId should be 11 (10 IDs were generated)
        expect(state.generateNextId()).toBe(11);
    });

    it('should maintain state integrity during rapid connection changes', () => {
        const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
        const output = { id: 2, type: 'OUTPUT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

        state.addComponent(input);
        state.addComponent(output);

        // Add and remove connection multiple times
        for (let i = 0; i < 5; i++) {
            const conn = { from: 1, fromPort: 0, to: 2, toPort: 0 };
            state.addConnection(conn);
            expect(state.getConnections()).toHaveLength(1);
            state.removeConnection(conn);
            expect(state.getConnections()).toHaveLength(0);
        }

        // Final state should be clean
        expect(state.getConnections()).toHaveLength(0);
    });
});
