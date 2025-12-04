/**
 * Unit tests for serialization utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    deepClone,
    validateComponentData,
    validateCircuitData
} from '../../../src/utils/serialization.js';

describe('Serialization Utilities', () => {
    describe('deepClone()', () => {
        it('should clone primitive values', () => {
            expect(deepClone(42)).toBe(42);
            expect(deepClone('hello')).toBe('hello');
            expect(deepClone(true)).toBe(true);
            expect(deepClone(null)).toBe(null);
        });

        it('should clone arrays', () => {
            const original = [1, 2, 3, 4, 5];
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
        });

        it('should clone nested arrays', () => {
            const original = [[1, 2], [3, 4], [5, [6, 7]]];
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned[0]).not.toBe(original[0]);
            expect(cloned[2][1]).not.toBe(original[2][1]);
        });

        it('should clone objects', () => {
            const original = { a: 1, b: 'test', c: true };
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
        });

        it('should clone nested objects', () => {
            const original = {
                level1: {
                    level2: {
                        level3: {
                            value: 'deep'
                        }
                    }
                }
            };
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned.level1).not.toBe(original.level1);
            expect(cloned.level1.level2).not.toBe(original.level1.level2);
            expect(cloned.level1.level2.level3).not.toBe(original.level1.level2.level3);
        });

        it('should clone mixed arrays and objects', () => {
            const original = {
                components: [
                    { id: 1, type: 'AND', x: 100, y: 100 },
                    { id: 2, type: 'OR', x: 200, y: 200 }
                ],
                connections: [
                    { from: 1, to: 2 }
                ],
                metadata: {
                    name: 'Test Circuit',
                    created: '2024-01-01'
                }
            };
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned.components).not.toBe(original.components);
            expect(cloned.components[0]).not.toBe(original.components[0]);
            expect(cloned.connections[0]).not.toBe(original.connections[0]);
            expect(cloned.metadata).not.toBe(original.metadata);
        });

        it('should not clone undefined properties', () => {
            const original = { a: 1, b: undefined };
            const cloned = deepClone(original);

            expect(cloned.a).toBe(1);
            expect('b' in cloned).toBe(false);
        });

        it('should handle empty objects and arrays', () => {
            expect(deepClone({})).toEqual({});
            expect(deepClone([])).toEqual([]);
        });

        it('should clone circuit component structure', () => {
            const component = {
                id: 1,
                type: 'CUSTOM',
                x: 100,
                y: 100,
                value: null,
                label: 'MyGate',
                inputPorts: [
                    { x: 75, y: 90 },
                    { x: 75, y: 110 }
                ],
                outputPorts: [
                    { x: 125, y: 100 }
                ],
                customDefinition: {
                    name: 'MyGate',
                    components: [{ id: 1, type: 'AND' }],
                    connections: []
                }
            };

            const cloned = deepClone(component);

            expect(cloned).toEqual(component);
            expect(cloned.inputPorts[0]).not.toBe(component.inputPorts[0]);
            expect(cloned.customDefinition.components[0]).not.toBe(component.customDefinition.components[0]);
        });
    });

    describe('validateComponentData()', () => {
        it('should validate valid component data', () => {
            const validComponent = {
                name: 'TestComponent',
                components: [{ id: 1, type: 'AND' }],
                connections: []
            };

            expect(validateComponentData(validComponent)).toBe(true);
        });

        it('should throw error for missing name', () => {
            const invalid = {
                components: [],
                connections: []
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a name');
        });

        it('should throw error for empty name', () => {
            const invalid = {
                name: '',
                components: [],
                connections: []
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a name');
        });

        it('should throw error for missing components array', () => {
            const invalid = {
                name: 'Test',
                connections: []
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a components array');
        });

        it('should throw error for non-array components', () => {
            const invalid = {
                name: 'Test',
                components: 'not an array',
                connections: []
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a components array');
        });

        it('should throw error for missing connections array', () => {
            const invalid = {
                name: 'Test',
                components: []
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a connections array');
        });

        it('should throw error for non-array connections', () => {
            const invalid = {
                name: 'Test',
                components: [],
                connections: { from: 1, to: 2 }
            };

            expect(() => validateComponentData(invalid)).toThrow('Component must have a connections array');
        });

        it('should allow empty arrays for components and connections', () => {
            const valid = {
                name: 'EmptyComponent',
                components: [],
                connections: []
            };

            expect(validateComponentData(valid)).toBe(true);
        });

        it('should validate complex component data', () => {
            const valid = {
                name: 'HalfAdder',
                description: 'A half adder circuit',
                components: [
                    { id: 1, type: 'INPUT', label: 'A' },
                    { id: 2, type: 'INPUT', label: 'B' },
                    { id: 3, type: 'XOR' },
                    { id: 4, type: 'AND' },
                    { id: 5, type: 'OUTPUT', label: 'Sum' },
                    { id: 6, type: 'OUTPUT', label: 'Carry' }
                ],
                connections: [
                    { from: 1, to: 3, fromPort: 0, toPort: 0 },
                    { from: 2, to: 3, fromPort: 0, toPort: 1 },
                    { from: 1, to: 4, fromPort: 0, toPort: 0 },
                    { from: 2, to: 4, fromPort: 0, toPort: 1 },
                    { from: 3, to: 5, fromPort: 0, toPort: 0 },
                    { from: 4, to: 6, fromPort: 0, toPort: 0 }
                ],
                inputPorts: [{ label: 'A' }, { label: 'B' }],
                outputPorts: [{ label: 'Sum' }, { label: 'Carry' }]
            };

            expect(validateComponentData(valid)).toBe(true);
        });
    });

    describe('validateCircuitData()', () => {
        it('should validate valid circuit data', () => {
            const validCircuit = {
                components: [{ id: 1, type: 'AND' }],
                connections: []
            };

            expect(validateCircuitData(validCircuit)).toBe(true);
        });

        it('should throw error for missing components array', () => {
            const invalid = {
                connections: []
            };

            expect(() => validateCircuitData(invalid)).toThrow('Circuit must have a components array');
        });

        it('should throw error for non-array components', () => {
            const invalid = {
                components: null,
                connections: []
            };

            expect(() => validateCircuitData(invalid)).toThrow('Circuit must have a components array');
        });

        it('should throw error for missing connections array', () => {
            const invalid = {
                components: []
            };

            expect(() => validateCircuitData(invalid)).toThrow('Circuit must have a connections array');
        });

        it('should throw error for non-array connections', () => {
            const invalid = {
                components: [],
                connections: null
            };

            expect(() => validateCircuitData(invalid)).toThrow('Circuit must have a connections array');
        });

        it('should allow empty arrays', () => {
            const valid = {
                components: [],
                connections: []
            };

            expect(validateCircuitData(valid)).toBe(true);
        });

        it('should validate full circuit data with metadata', () => {
            const valid = {
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100, value: 0 },
                    { id: 2, type: 'OUTPUT', x: 300, y: 100, value: null }
                ],
                connections: [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ],
                nextId: 3,
                currentBoardName: 'Test Board',
                truthTableState: { width: 400, height: 300 }
            };

            expect(validateCircuitData(valid)).toBe(true);
        });
    });

    describe('Integration scenarios', () => {
        it('should clone and validate component for export', () => {
            const component = {
                name: 'ExportTest',
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100, label: 'A' },
                    { id: 2, type: 'NOT', x: 200, y: 100 },
                    { id: 3, type: 'OUTPUT', x: 300, y: 100, label: 'Y' }
                ],
                connections: [
                    { from: 1, to: 2, fromPort: 0, toPort: 0 },
                    { from: 2, to: 3, fromPort: 0, toPort: 0 }
                ]
            };

            // Clone before export
            const exportData = deepClone(component);

            // Validate
            expect(validateComponentData(exportData)).toBe(true);

            // Modify original shouldn't affect clone
            component.name = 'Modified';
            expect(exportData.name).toBe('ExportTest');
        });

        it('should clone circuit state for auto-save', () => {
            const circuitState = {
                components: [
                    { id: 1, type: 'AND', x: 200, y: 150 },
                    { id: 2, type: 'INPUT', x: 100, y: 100, value: 1 },
                    { id: 3, type: 'INPUT', x: 100, y: 200, value: 0 },
                    { id: 4, type: 'OUTPUT', x: 300, y: 150, value: null }
                ],
                connections: [
                    { from: 2, to: 1, fromPort: 0, toPort: 0 },
                    { from: 3, to: 1, fromPort: 0, toPort: 1 },
                    { from: 1, to: 4, fromPort: 0, toPort: 0 }
                ]
            };

            const savedState = deepClone(circuitState);

            // Simulate modification
            circuitState.components[1].value = 0;
            circuitState.components.push({ id: 5, type: 'OR', x: 250, y: 250 });

            // Saved state should be unchanged
            expect(savedState.components[1].value).toBe(1);
            expect(savedState.components).toHaveLength(4);

            // Both should be valid
            expect(validateCircuitData(circuitState)).toBe(true);
            expect(validateCircuitData(savedState)).toBe(true);
        });
    });
});
