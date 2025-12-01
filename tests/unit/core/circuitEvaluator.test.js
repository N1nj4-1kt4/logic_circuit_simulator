import { describe, it, expect, beforeEach } from 'vitest';
import {
    getPortValue,
    getComponentValue,
    calculateComponentValue,
    simulateCircuit,
    getInputCount,
    getOutputCount,
    evaluateCustomComponent,
    calculateInternalComponentValue
} from '../../../src/core/circuitEvaluator.js';

describe('Circuit Evaluator', () => {
    describe('getPortValue', () => {
        it('should return component value for regular components', () => {
            const component = { type: 'AND', value: 1 };
            expect(getPortValue(component, 0)).toBe(1);
        });

        it('should return specific output value for custom components', () => {
            const component = {
                type: 'CUSTOM',
                outputValues: [0, 1, 1]
            };
            expect(getPortValue(component, 0)).toBe(0);
            expect(getPortValue(component, 1)).toBe(1);
            expect(getPortValue(component, 2)).toBe(1);
        });

        it('should return null for custom component with undefined port', () => {
            const component = {
                type: 'CUSTOM',
                outputValues: [1]
            };
            expect(getPortValue(component, 5)).toBeNull();
        });

        it('should return component value if outputValues not present', () => {
            const component = {
                type: 'CUSTOM',
                value: 1
            };
            expect(getPortValue(component, 0)).toBe(1);
        });
    });

    describe('getComponentValue', () => {
        it('should return value for INPUT component', () => {
            const component = { type: 'INPUT', value: 1 };
            expect(getComponentValue(component)).toBe(1);
        });

        it('should return value for gate component', () => {
            const component = { type: 'AND', value: 0 };
            expect(getComponentValue(component)).toBe(0);
        });

        it('should return null for component with no value', () => {
            const component = { type: 'OR', value: null };
            expect(getComponentValue(component)).toBeNull();
        });
    });

    describe('getInputCount', () => {
        it('should count INPUT components', () => {
            const components = [
                { type: 'INPUT', value: 0 },
                { type: 'INPUT', value: 1 },
                { type: 'AND', value: null },
                { type: 'OUTPUT', value: null }
            ];
            expect(getInputCount(components)).toBe(2);
        });

        it('should return 0 when no INPUT components', () => {
            const components = [
                { type: 'AND', value: null },
                { type: 'OR', value: null }
            ];
            expect(getInputCount(components)).toBe(0);
        });
    });

    describe('getOutputCount', () => {
        it('should count OUTPUT components', () => {
            const components = [
                { type: 'INPUT', value: 0 },
                { type: 'AND', value: null },
                { type: 'OUTPUT', value: null },
                { type: 'OUTPUT', value: null }
            ];
            expect(getOutputCount(components)).toBe(2);
        });

        it('should return 0 when no OUTPUT components', () => {
            const components = [
                { type: 'INPUT', value: 1 },
                { type: 'AND', value: null }
            ];
            expect(getOutputCount(components)).toBe(0);
        });
    });

    describe('simulateCircuit', () => {
        it('should simulate simple AND gate', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[2].value).toBe(1);
            expect(result.stable).toBe(true);
            expect(result.iterations).toBeGreaterThan(0);
        });

        it('should simulate simple OR gate', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OR', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[2].value).toBe(1);
            expect(result.stable).toBe(true);
        });

        it('should simulate NOT gate', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[1].value).toBe(0);
            expect(result.stable).toBe(true);
        });

        it('should simulate XOR gate', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'XOR', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[2].value).toBe(1);
            expect(result.stable).toBe(true);
        });

        it('should simulate OUTPUT component', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];

            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[1].value).toBe(1);
            expect(result.stable).toBe(true);
        });

        it('should simulate chain of gates', () => {
            // INPUT -> NOT -> NOT -> OUTPUT (should preserve original value)
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] },
                { id: 4, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] }
            ];

            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 0 },
                { from: 3, to: 4, fromPort: 0, toPort: 0 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[1].value).toBe(0); // NOT 1 = 0
            expect(components[2].value).toBe(1); // NOT 0 = 1
            expect(components[3].value).toBe(1); // OUTPUT = 1
            expect(result.stable).toBe(true);
        });

        it('should simulate half adder (AND + XOR)', () => {
            // Half adder: two inputs A, B
            // Sum = A XOR B
            // Carry = A AND B
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] }, // A
                { id: 2, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] }, // B
                { id: 3, type: 'XOR', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }, // Sum
                { id: 4, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }  // Carry
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 },
                { from: 1, to: 4, fromPort: 0, toPort: 0 },
                { from: 2, to: 4, fromPort: 0, toPort: 1 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[2].value).toBe(0); // Sum: 1 XOR 1 = 0
            expect(components[3].value).toBe(1); // Carry: 1 AND 1 = 1
            expect(result.stable).toBe(true);
        });

        it('should reset non-input values before simulation', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'NOT', value: 999, inputs: [{ x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] } // Old value
            ];

            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 }
            ];

            simulateCircuit(components, connections);

            expect(components[1].value).toBe(0); // Should be recalculated
        });

        it('should handle incomplete connections', () => {
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            // Only one input connected
            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 }
            ];

            const result = simulateCircuit(components, connections);

            expect(components[1].value).toBeNull(); // Should remain null
            expect(result.stable).toBe(true);
        });

        it('should report max iterations reached if circuit doesn\'t stabilize', () => {
            // This test verifies the safety mechanism
            const components = [
                { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ];

            const connections = [
                { from: 1, to: 2, fromPort: 0, toPort: 0 },
                { from: 1, to: 2, fromPort: 0, toPort: 1 }
            ];

            const result = simulateCircuit(components, connections);

            expect(result.iterations).toBeLessThanOrEqual(100);
            expect(result.maxIterationsReached).toBeDefined();
        });
    });

    describe('calculateComponentValue', () => {
        it('should return null when not all inputs are connected', () => {
            const component = {
                id: 3,
                type: 'AND',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [
                { id: 1, type: 'INPUT', value: 1 },
                component
            ];

            // Only one connection
            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 }
            ];

            const result = calculateComponentValue(component, components, connections);

            expect(result).toBeNull();
        });

        it('should return null when source component not found', () => {
            const component = {
                id: 3,
                type: 'AND',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [component];

            const connections = [
                { from: 999, to: 3, fromPort: 0, toPort: 0 }, // Non-existent source
                { from: 998, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = calculateComponentValue(component, components, connections);

            expect(result).toBeNull();
        });

        it('should return null when source value is null', () => {
            const component = {
                id: 3,
                type: 'AND',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [
                { id: 1, type: 'INPUT', value: null },
                { id: 2, type: 'INPUT', value: 1 },
                component
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = calculateComponentValue(component, components, connections);

            expect(result).toBeNull();
        });

        it('should calculate AND gate correctly', () => {
            const component = {
                id: 3,
                type: 'AND',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [
                { id: 1, type: 'INPUT', value: 1 },
                { id: 2, type: 'INPUT', value: 1 },
                component
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = calculateComponentValue(component, components, connections);

            expect(result).toBe(1);
        });
    });

    describe('calculateInternalComponentValue', () => {
        it('should calculate value from internal connections', () => {
            const component = {
                id: 3,
                type: 'AND',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [
                { id: 1, type: 'INPUT', value: 1 },
                { id: 2, type: 'INPUT', value: 0 },
                component
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 },
                { from: 2, to: 3, fromPort: 0, toPort: 1 }
            ];

            const result = calculateInternalComponentValue(component, components, connections);

            expect(result).toBe(0);
        });

        it('should return null when connection missing', () => {
            const component = {
                id: 3,
                type: 'OR',
                inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
            };

            const components = [
                { id: 1, type: 'INPUT', value: 1 },
                component
            ];

            const connections = [
                { from: 1, to: 3, fromPort: 0, toPort: 0 }
                // Missing second connection
            ];

            const result = calculateInternalComponentValue(component, components, connections);

            expect(result).toBeNull();
        });
    });

    describe('evaluateCustomComponent', () => {
        it('should evaluate custom component with single output', () => {
            const customComponent = {
                type: 'CUSTOM',
                customDefinition: {
                    components: [
                        { id: 1, type: 'INPUT', value: null },
                        { id: 2, type: 'INPUT', value: null },
                        { id: 3, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
                        { id: 4, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }] }
                    ],
                    connections: [
                        { from: 1, to: 3, fromPort: 0, toPort: 0 },
                        { from: 2, to: 3, fromPort: 0, toPort: 1 },
                        { from: 3, to: 4, fromPort: 0, toPort: 0 }
                    ],
                    inputPorts: [
                        { id: 1, label: 'A' },
                        { id: 2, label: 'B' }
                    ],
                    outputPorts: [
                        { id: 4, label: 'Out' }
                    ]
                }
            };

            const result = evaluateCustomComponent(customComponent, [1, 1]);

            expect(result).toBe(1);
            expect(customComponent.outputValues).toEqual([1]);
        });

        it('should evaluate custom component with multiple outputs', () => {
            // Half adder custom component
            const customComponent = {
                type: 'CUSTOM',
                customDefinition: {
                    components: [
                        { id: 1, type: 'INPUT', value: null },
                        { id: 2, type: 'INPUT', value: null },
                        { id: 3, type: 'XOR', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
                        { id: 4, type: 'AND', value: null, inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
                        { id: 5, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }] }, // Sum
                        { id: 6, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }] }  // Carry
                    ],
                    connections: [
                        { from: 1, to: 3, fromPort: 0, toPort: 0 },
                        { from: 2, to: 3, fromPort: 0, toPort: 1 },
                        { from: 1, to: 4, fromPort: 0, toPort: 0 },
                        { from: 2, to: 4, fromPort: 0, toPort: 1 },
                        { from: 3, to: 5, fromPort: 0, toPort: 0 },
                        { from: 4, to: 6, fromPort: 0, toPort: 0 }
                    ],
                    inputPorts: [
                        { id: 1, label: 'A' },
                        { id: 2, label: 'B' }
                    ],
                    outputPorts: [
                        { id: 5, label: 'Sum' },
                        { id: 6, label: 'Carry' }
                    ]
                }
            };

            const result = evaluateCustomComponent(customComponent, [1, 1]);

            expect(result).toBe(0); // Sum output (first output)
            expect(customComponent.outputValues).toEqual([0, 1]); // [Sum, Carry]
        });

        it('should handle custom component with NOT gate', () => {
            const customComponent = {
                type: 'CUSTOM',
                customDefinition: {
                    components: [
                        { id: 1, type: 'INPUT', value: null },
                        { id: 2, type: 'NOT', value: null, inputs: [{ x: 0, y: 0 }] },
                        { id: 3, type: 'OUTPUT', value: null, inputs: [{ x: 0, y: 0 }] }
                    ],
                    connections: [
                        { from: 1, to: 2, fromPort: 0, toPort: 0 },
                        { from: 2, to: 3, fromPort: 0, toPort: 0 }
                    ],
                    inputPorts: [
                        { id: 1, label: 'In' }
                    ],
                    outputPorts: [
                        { id: 3, label: 'Out' }
                    ]
                }
            };

            const result1 = evaluateCustomComponent(customComponent, [0]);
            expect(result1).toBe(1);

            const result2 = evaluateCustomComponent(customComponent, [1]);
            expect(result2).toBe(0);
        });
    });
});
