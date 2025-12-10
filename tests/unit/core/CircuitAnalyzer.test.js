import { describe, it, expect, beforeEach } from 'vitest';
import {
    validateCircuitForAnalysis,
    computeCircuitAnalysis,
    lookupAnalysisRow,
    getCurrentRowIndex
} from '../../../src/core/CircuitAnalyzer.js';

describe('CircuitAnalyzer', () => {
    // Helper to create a basic circuit with INPUT -> AND -> OUTPUT
    function createBasicAndCircuit() {
        const components = [
            { id: 1, type: 'INPUT', label: 'I1', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
            { id: 2, type: 'INPUT', label: 'I2', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
            { id: 3, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
            { id: 4, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
        ];
        const connections = [
            { from: 1, fromPort: 0, to: 3, toPort: 0 },
            { from: 2, fromPort: 0, to: 3, toPort: 1 },
            { from: 3, fromPort: 0, to: 4, toPort: 0 }
        ];
        return { components, connections };
    }

    // Helper to create an OR gate circuit
    function createOrCircuit() {
        const components = [
            { id: 1, type: 'INPUT', label: 'A', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
            { id: 2, type: 'INPUT', label: 'B', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
            { id: 3, type: 'OR', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
            { id: 4, type: 'OUTPUT', label: 'Y', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
        ];
        const connections = [
            { from: 1, fromPort: 0, to: 3, toPort: 0 },
            { from: 2, fromPort: 0, to: 3, toPort: 1 },
            { from: 3, fromPort: 0, to: 4, toPort: 0 }
        ];
        return { components, connections };
    }

    describe('validateCircuitForAnalysis', () => {
        it('should return invalid when no inputs exist', () => {
            const components = [
                { id: 1, type: 'AND', inputs: [], outputs: [] },
                { id: 2, type: 'OUTPUT', label: 'O1', inputs: [], outputs: [] }
            ];
            const result = validateCircuitForAnalysis(components, []);

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('input');
        });

        it('should return invalid when no outputs exist', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [] },
                { id: 2, type: 'AND', inputs: [], outputs: [] }
            ];
            const result = validateCircuitForAnalysis(components, []);

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('output');
        });

        it('should return invalid when no gates exist', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [] },
                { id: 2, type: 'OUTPUT', label: 'O1', inputs: [], outputs: [] }
            ];
            const result = validateCircuitForAnalysis(components, []);

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('gate');
        });

        it('should return invalid when gate inputs are not connected', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            // Only one input connected, AND needs two
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 0 }
            ];
            const result = validateCircuitForAnalysis(components, connections);

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('connected');
        });

        it('should return invalid when gate outputs are not connected', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'I2', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', label: 'O1', inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            // Gate output not connected to OUTPUT
            const connections = [
                { from: 1, fromPort: 0, to: 3, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 1 }
            ];
            const result = validateCircuitForAnalysis(components, connections);

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('connected');
        });

        it('should return valid for a properly connected circuit', () => {
            const { components, connections } = createBasicAndCircuit();
            const result = validateCircuitForAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.reason).toBeNull();
            expect(result.inputs).toHaveLength(2);
            expect(result.outputs).toHaveLength(1);
        });

        it('should sort inputs and outputs by label', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'B', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'A', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', label: 'Y', inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 3, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 1 },
                { from: 3, fromPort: 0, to: 4, toPort: 0 }
            ];
            const result = validateCircuitForAnalysis(components, connections);

            expect(result.inputs[0].label).toBe('A');
            expect(result.inputs[1].label).toBe('B');
        });

        it('should handle components without labels gracefully', () => {
            const components = [
                { id: 1, type: 'INPUT', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'A', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 3, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 1 },
                { from: 3, fromPort: 0, to: 4, toPort: 0 }
            ];

            // Should not throw
            const result = validateCircuitForAnalysis(components, connections);
            expect(result.inputs).toHaveLength(2);
        });

        it('should handle gates without inputs/outputs arrays gracefully', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'AND' }, // Missing inputs/outputs
                { id: 3, type: 'OUTPUT', label: 'O1', inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [];

            // Should not throw
            const result = validateCircuitForAnalysis(components, connections);
            expect(result.isValid).toBe(false);
        });
    });

    describe('computeCircuitAnalysis', () => {
        it('should return invalid result for invalid circuit', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [] }
            ];
            const result = computeCircuitAnalysis(components, []);

            expect(result.isValid).toBe(false);
            expect(result.table).toEqual([]);
        });

        it('should compute correct truth table for AND gate', () => {
            const { components, connections } = createBasicAndCircuit();
            const result = computeCircuitAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(4); // 2^2 = 4 combinations

            // AND truth table: output is 1 only when both inputs are 1
            // Note: field names are ID-based (input_1, input_2, output_4)
            // Inputs are sorted by label: I1 (id:1), I2 (id:2)
            expect(result.table[0]).toMatchObject({ input_1: 0, input_2: 0, output_4: 0 });
            expect(result.table[1]).toMatchObject({ input_1: 0, input_2: 1, output_4: 0 });
            expect(result.table[2]).toMatchObject({ input_1: 1, input_2: 0, output_4: 0 });
            expect(result.table[3]).toMatchObject({ input_1: 1, input_2: 1, output_4: 1 });
        });

        it('should compute correct truth table for OR gate', () => {
            const { components, connections } = createOrCircuit();
            const result = computeCircuitAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(4);

            // OR truth table: output is 1 when any input is 1
            // Note: field names are ID-based (input_1, input_2, output_4)
            // Inputs are sorted by label: A (id:1), B (id:2)
            expect(result.table[0]).toMatchObject({ input_1: 0, input_2: 0, output_4: 0 });
            expect(result.table[1]).toMatchObject({ input_1: 0, input_2: 1, output_4: 1 });
            expect(result.table[2]).toMatchObject({ input_1: 1, input_2: 0, output_4: 1 });
            expect(result.table[3]).toMatchObject({ input_1: 1, input_2: 1, output_4: 1 });
        });

        it('should NOT modify original components during computation', () => {
            const { components, connections } = createBasicAndCircuit();

            // Store original values
            const originalInput1Value = components[0].value;
            const originalInput2Value = components[1].value;
            const originalGateValue = components[2].value;
            const originalOutputValue = components[3].value;

            computeCircuitAnalysis(components, connections);

            // Verify original values are unchanged
            expect(components[0].value).toBe(originalInput1Value);
            expect(components[1].value).toBe(originalInput2Value);
            expect(components[2].value).toBe(originalGateValue);
            expect(components[3].value).toBe(originalOutputValue);
        });

        it('should handle single input circuit', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 0 }
            ];

            const result = computeCircuitAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(2); // 2^1 = 2 combinations
            // Note: field names are ID-based (input_1, output_3)
            expect(result.table[0]).toMatchObject({ input_1: 0, output_3: 1 }); // NOT 0 = 1
            expect(result.table[1]).toMatchObject({ input_1: 1, output_3: 0 }); // NOT 1 = 0
        });

        it('should handle three input circuit', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'A', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'B', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'INPUT', label: 'C', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 5, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 6, type: 'OUTPUT', label: 'Y', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 5, toPort: 0 },
                { from: 3, fromPort: 0, to: 5, toPort: 1 },
                { from: 5, fromPort: 0, to: 6, toPort: 0 }
            ];

            const result = computeCircuitAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(8); // 2^3 = 8 combinations

            // Only when all three inputs are 1 should output be 1
            // Note: inputs sorted by label (A, B, C), IDs are (1, 2, 3), output is id:6
            expect(result.table[7]).toMatchObject({ input_1: 1, input_2: 1, input_3: 1, output_6: 1 });
            // All other combinations should be 0
            for (let i = 0; i < 7; i++) {
                expect(result.table[i].output_6).toBe(0);
            }
        });

        it('should handle multiple outputs', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] },
                { id: 4, type: 'OUTPUT', label: 'O2', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 },
                { from: 1, fromPort: 0, to: 3, toPort: 0 }, // Direct connection to O1
                { from: 2, fromPort: 0, to: 4, toPort: 0 }  // NOT output to O2
            ];

            const result = computeCircuitAnalysis(components, connections);

            expect(result.isValid).toBe(true);
            expect(result.outputs).toHaveLength(2);
            // Note: outputs sorted by label (O1, O2), IDs are (3, 4)
            expect(result.table[0].output_3).toBe(0); // O1 = I1 = 0
            expect(result.table[0].output_4).toBe(1); // O2 = NOT I1 = 1
            expect(result.table[1].output_3).toBe(1); // O1 = I1 = 1
            expect(result.table[1].output_4).toBe(0); // O2 = NOT I1 = 0
        });

        it('should return inputs and outputs arrays in result', () => {
            const { components, connections } = createBasicAndCircuit();
            const result = computeCircuitAnalysis(components, connections);

            expect(result.inputs).toHaveLength(2);
            expect(result.outputs).toHaveLength(1);
            expect(result.inputs[0].type).toBe('INPUT');
            expect(result.outputs[0].type).toBe('OUTPUT');
        });
    });

    describe('lookupAnalysisRow', () => {
        let cache;

        beforeEach(() => {
            const { components, connections } = createBasicAndCircuit();
            cache = computeCircuitAnalysis(components, connections);
        });

        it('should return correct row for input combination', () => {
            // Input [0, 0] should be row 0
            // Component IDs: input1 (id:1), input2 (id:2), output (id:4)
            const row = lookupAnalysisRow(cache, [0, 0]);
            expect(row).toMatchObject({ input_1: 0, input_2: 0, output_4: 0 });
        });

        it('should return correct row for different combinations', () => {
            // Input [1, 1] should be row 3
            // Component IDs: input1 (id:1), input2 (id:2), output (id:4)
            const row = lookupAnalysisRow(cache, [1, 1]);
            expect(row).toMatchObject({ input_1: 1, input_2: 1, output_4: 1 });
        });

        it('should return null for invalid cache', () => {
            expect(lookupAnalysisRow(null, [0, 0])).toBeNull();
            expect(lookupAnalysisRow({}, [0, 0])).toBeNull();
            expect(lookupAnalysisRow({ isValid: false }, [0, 0])).toBeNull();
        });

        it('should return null for out of range index', () => {
            // Only 4 rows (0-3), asking for row that doesn't exist
            const row = lookupAnalysisRow(cache, [1, 1, 1]); // Would be index 7
            expect(row).toBeNull();
        });
    });

    describe('getCurrentRowIndex', () => {
        let cache;
        let components;

        beforeEach(() => {
            const circuit = createBasicAndCircuit();
            components = circuit.components;
            cache = computeCircuitAnalysis(circuit.components, circuit.connections);
        });

        it('should return 0 for all inputs at 0', () => {
            components[0].value = 0;
            components[1].value = 0;
            expect(getCurrentRowIndex(cache, components)).toBe(0);
        });

        it('should return 3 for all inputs at 1', () => {
            components[0].value = 1;
            components[1].value = 1;
            expect(getCurrentRowIndex(cache, components)).toBe(3);
        });

        it('should return correct index for mixed inputs', () => {
            components[0].value = 0;
            components[1].value = 1;
            expect(getCurrentRowIndex(cache, components)).toBe(1);

            components[0].value = 1;
            components[1].value = 0;
            expect(getCurrentRowIndex(cache, components)).toBe(2);
        });

        it('should return -1 for invalid cache', () => {
            expect(getCurrentRowIndex(null, components)).toBe(-1);
            expect(getCurrentRowIndex({}, components)).toBe(-1);
            expect(getCurrentRowIndex({ isValid: false }, components)).toBe(-1);
        });

        it('should return -1 when input count mismatch', () => {
            // Add extra input to components
            components.push({ id: 5, type: 'INPUT', label: 'I3', value: 0 });
            expect(getCurrentRowIndex(cache, components)).toBe(-1);
        });
    });

    describe('edge cases', () => {
        it('should handle empty components array', () => {
            const result = computeCircuitAnalysis([], []);
            expect(result.isValid).toBe(false);
        });

        it('should handle empty connections array with valid components', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', inputs: [], outputs: [] },
                { id: 2, type: 'AND', inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', inputs: [], outputs: [] }
            ];
            const result = computeCircuitAnalysis(components, []);
            expect(result.isValid).toBe(false);
        });

        it('should handle components with null labels', () => {
            const components = [
                { id: 1, type: 'INPUT', label: null, value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: null, value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', label: null, value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 3, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 1 },
                { from: 3, fromPort: 0, to: 4, toPort: 0 }
            ];

            // Should not throw
            const result = computeCircuitAnalysis(components, connections);
            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(4);
        });

        it('should handle undefined values in input components', () => {
            const components = [
                { id: 1, type: 'INPUT', label: 'I1', value: undefined, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'I2', value: undefined, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 3, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 1 },
                { from: 3, fromPort: 0, to: 4, toPort: 0 }
            ];

            // Should not throw and values should be unchanged on originals
            const result = computeCircuitAnalysis(components, connections);
            expect(result.isValid).toBe(true);
            expect(components[0].value).toBeUndefined();
            expect(components[1].value).toBeUndefined();
        });
    });
});
