import { describe, it, expect } from 'vitest';
import {
    findComponentAt,
    findPortAt,
    findConnectionAt,
    snapToGrid,
    isPointInComponent
} from '../../../src/utils/hitDetection.js';

describe('Hit Detection Utils', () => {
    describe('findComponentAt', () => {
        it('should find AND gate at center', () => {
            const components = [
                { id: 1, type: 'AND', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 100, 100);
            expect(result).toBeDefined();
            expect(result.id).toBe(1);
        });

        it('should find AND gate within hit detection range', () => {
            const components = [
                { id: 1, type: 'AND', x: 100, y: 100 }
            ];
            // STANDARD_GATE size is 60, so ±30 from center
            const result = findComponentAt(components, 125, 100);
            expect(result).toBeDefined();
            expect(result.id).toBe(1);
        });

        it('should not find AND gate outside hit detection range', () => {
            const components = [
                { id: 1, type: 'AND', x: 100, y: 100 }
            ];
            // STANDARD_GATE size is 60, so 35 pixels away should miss
            const result = findComponentAt(components, 135, 100);
            expect(result).toBeNull();
        });

        it('should find INPUT component at center', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 100, 100);
            expect(result).toBeDefined();
            expect(result.id).toBe(1);
        });

        it('should find INPUT within hit detection range', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 100, y: 100 }
            ];
            // INPUT size is 40, so ±20 from center
            const result = findComponentAt(components, 115, 100);
            expect(result).toBeDefined();
        });

        it('should not find INPUT outside hit detection range', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 125, 100);
            expect(result).toBeNull();
        });

        it('should find OUTPUT component', () => {
            const components = [
                { id: 1, type: 'OUTPUT', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 100, 100);
            expect(result).toBeDefined();
        });

        it('should find CUSTOM component with larger hit area', () => {
            const components = [
                { id: 1, type: 'CUSTOM', x: 100, y: 100 }
            ];
            // CUSTOM size is 100, so ±50 from center
            const result = findComponentAt(components, 145, 100);
            expect(result).toBeDefined();
        });

        it('should not find CUSTOM outside hit detection range', () => {
            const components = [
                { id: 1, type: 'CUSTOM', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 155, 100);
            expect(result).toBeNull();
        });

        it('should find NOT gate', () => {
            const components = [
                { id: 1, type: 'NOT', x: 100, y: 100 }
            ];
            const result = findComponentAt(components, 100, 100);
            expect(result).toBeDefined();
        });

        it('should return first matching component when overlapping', () => {
            const components = [
                { id: 1, type: 'AND', x: 100, y: 100 },
                { id: 2, type: 'OR', x: 105, y: 100 }
            ];
            const result = findComponentAt(components, 100, 100);
            expect(result.id).toBe(1);
        });

        it('should return null for empty components array', () => {
            const result = findComponentAt([], 100, 100);
            expect(result).toBeNull();
        });

        it('should find other standard gates (OR, XOR, NAND, NOR, XNOR)', () => {
            const gateTypes = ['OR', 'XOR', 'NAND', 'NOR', 'XNOR'];
            gateTypes.forEach(type => {
                const components = [{ id: 1, type, x: 100, y: 100 }];
                const result = findComponentAt(components, 100, 100);
                expect(result).toBeDefined();
                expect(result.type).toBe(type);
            });
        });
    });

    describe('findPortAt', () => {
        it('should find output port within detection radius', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            const result = findPortAt(components, 125, 100);
            expect(result).toBeDefined();
            expect(result.isOutput).toBe(true);
            expect(result.component).toBe(1);
            expect(result.portIndex).toBe(0);
        });

        it('should find input port within detection radius', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 90 }, { x: 75, y: 110 }],
                    outputs: []
                }
            ];
            const result = findPortAt(components, 75, 90);
            expect(result).toBeDefined();
            expect(result.isOutput).toBe(false);
            expect(result.component).toBe(1);
            expect(result.portIndex).toBe(0);
        });

        it('should return null when no port is near', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 100 }],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            const result = findPortAt(components, 100, 100);
            expect(result).toBeNull();
        });

        it('should filter by portType when specified as output', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 100 }],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            // Looking for output only, but clicking near input
            const result = findPortAt(components, 75, 100, 'output');
            expect(result).toBeNull();
        });

        it('should filter by portType when specified as input', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 100 }],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            // Looking for input only, clicking near input
            const result = findPortAt(components, 75, 100, 'input');
            expect(result).toBeDefined();
            expect(result.isOutput).toBe(false);
        });

        it('should include port coordinates in result', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            const result = findPortAt(components, 126, 101);
            expect(result.x).toBe(125);
            expect(result.y).toBe(100);
        });

        it('should handle components with multiple ports', () => {
            const components = [
                {
                    id: 1,
                    type: 'AND',
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 85 }, { x: 75, y: 115 }],
                    outputs: [{ x: 125, y: 100 }]
                }
            ];
            // Find second input port
            const result = findPortAt(components, 75, 115);
            expect(result).toBeDefined();
            expect(result.portIndex).toBe(1);
        });

        it('should return null for empty components array', () => {
            const result = findPortAt([], 100, 100);
            expect(result).toBeNull();
        });
    });

    describe('findConnectionAt', () => {
        it('should find connection on the wire', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 50, y: 100, inputs: [], outputs: [{ x: 70, y: 100 }] },
                { id: 2, type: 'OUTPUT', x: 150, y: 100, inputs: [{ x: 130, y: 100 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];
            // Click on the middle of the wire
            const result = findConnectionAt(connections, components, 100, 100);
            expect(result).toBeDefined();
            expect(result.from).toBe(1);
            expect(result.to).toBe(2);
        });

        it('should not find connection when clicking far from wire', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 50, y: 100, inputs: [], outputs: [{ x: 70, y: 100 }] },
                { id: 2, type: 'OUTPUT', x: 150, y: 100, inputs: [{ x: 130, y: 100 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];
            // Click far from the wire
            const result = findConnectionAt(connections, components, 100, 150);
            expect(result).toBeNull();
        });

        it('should return null when no connections exist', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 50, y: 100, inputs: [], outputs: [{ x: 70, y: 100 }] }
            ];
            const result = findConnectionAt([], components, 100, 100);
            expect(result).toBeNull();
        });

        it('should skip connections with missing source component', () => {
            const components = [
                { id: 2, type: 'OUTPUT', x: 150, y: 100, inputs: [{ x: 130, y: 100 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }  // component 1 doesn't exist
            ];
            const result = findConnectionAt(connections, components, 100, 100);
            expect(result).toBeNull();
        });

        it('should skip connections with missing target component', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 50, y: 100, inputs: [], outputs: [{ x: 70, y: 100 }] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }  // component 2 doesn't exist
            ];
            const result = findConnectionAt(connections, components, 100, 100);
            expect(result).toBeNull();
        });

        it('should use custom threshold when specified', () => {
            const components = [
                { id: 1, type: 'INPUT', x: 50, y: 100, inputs: [], outputs: [{ x: 70, y: 100 }] },
                { id: 2, type: 'OUTPUT', x: 150, y: 100, inputs: [{ x: 130, y: 100 }], outputs: [] }
            ];
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];
            // Click 8 pixels away - should miss with default threshold of 5
            const result1 = findConnectionAt(connections, components, 100, 108);
            expect(result1).toBeNull();

            // Should hit with larger threshold
            const result2 = findConnectionAt(connections, components, 100, 108, 10);
            expect(result2).toBeDefined();
        });
    });

    describe('snapToGrid', () => {
        it('should snap to nearest grid point', () => {
            const result = snapToGrid(73, 127);
            expect(result.x).toBe(50);
            expect(result.y).toBe(150);
        });

        it('should snap exact grid point to itself', () => {
            const result = snapToGrid(100, 200);
            expect(result.x).toBe(100);
            expect(result.y).toBe(200);
        });

        it('should round up when at midpoint', () => {
            const result = snapToGrid(75, 75);
            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });

        it('should round down when below midpoint', () => {
            const result = snapToGrid(74, 74);
            expect(result.x).toBe(50);
            expect(result.y).toBe(50);
        });

        it('should handle coordinates at origin', () => {
            const result = snapToGrid(0, 0);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const result = snapToGrid(-73, -127);
            expect(result.x).toBe(-50);
            expect(result.y).toBe(-150);
        });

        it('should accept custom grid size', () => {
            const result = snapToGrid(37, 63, 25);
            // 37 / 25 = 1.48, rounds to 1, * 25 = 25
            // 63 / 25 = 2.52, rounds to 3, * 25 = 75
            expect(result.x).toBe(25);
            expect(result.y).toBe(75);
        });

        it('should handle large coordinates', () => {
            const result = snapToGrid(1273, 827);
            expect(result.x).toBe(1250);
            expect(result.y).toBe(850);
        });
    });

    describe('isPointInComponent', () => {
        it('should return true for point at component center', () => {
            const component = { type: 'AND', x: 100, y: 100 };
            expect(isPointInComponent(component, 100, 100)).toBe(true);
        });

        it('should return true for point within AND gate bounds', () => {
            const component = { type: 'AND', x: 100, y: 100 };
            expect(isPointInComponent(component, 125, 100)).toBe(true);
        });

        it('should return false for point outside AND gate bounds', () => {
            const component = { type: 'AND', x: 100, y: 100 };
            expect(isPointInComponent(component, 135, 100)).toBe(false);
        });

        it('should use smaller bounds for INPUT', () => {
            const component = { type: 'INPUT', x: 100, y: 100 };
            // INPUT size is 40, so 25 away should be outside
            expect(isPointInComponent(component, 125, 100)).toBe(false);
            // But 15 away should be inside
            expect(isPointInComponent(component, 115, 100)).toBe(true);
        });

        it('should use smaller bounds for OUTPUT', () => {
            const component = { type: 'OUTPUT', x: 100, y: 100 };
            expect(isPointInComponent(component, 125, 100)).toBe(false);
            expect(isPointInComponent(component, 115, 100)).toBe(true);
        });

        it('should use larger bounds for CUSTOM', () => {
            const component = { type: 'CUSTOM', x: 100, y: 100 };
            // CUSTOM size is 100, so 45 away should be inside
            expect(isPointInComponent(component, 145, 100)).toBe(true);
            // But 55 away should be outside
            expect(isPointInComponent(component, 155, 100)).toBe(false);
        });

        it('should use correct bounds for NOT gate', () => {
            const component = { type: 'NOT', x: 100, y: 100 };
            // NOT size is 50
            expect(isPointInComponent(component, 120, 100)).toBe(true);
            expect(isPointInComponent(component, 130, 100)).toBe(false);
        });

        it('should check both x and y bounds', () => {
            const component = { type: 'AND', x: 100, y: 100 };
            // Within x but outside y
            expect(isPointInComponent(component, 100, 140)).toBe(false);
            // Within y but outside x
            expect(isPointInComponent(component, 140, 100)).toBe(false);
        });
    });
});
