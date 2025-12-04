import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    pointDistance,
    distanceToLine,
    getComponentsBoundingBox,
    calculateRectOverlap,
    pointInRect,
    rectsIntersect
} from '../../../src/utils/geometry.js';

describe('Geometry Utils', () => {
    describe('pointDistance', () => {
        it('should calculate distance between two points', () => {
            expect(pointDistance(0, 0, 3, 4)).toBe(5);
        });

        it('should return 0 for same point', () => {
            expect(pointDistance(5, 5, 5, 5)).toBe(0);
        });

        it('should handle negative coordinates', () => {
            expect(pointDistance(-3, -4, 0, 0)).toBe(5);
        });

        it('should calculate horizontal distance', () => {
            expect(pointDistance(0, 0, 10, 0)).toBe(10);
        });

        it('should calculate vertical distance', () => {
            expect(pointDistance(0, 0, 0, 10)).toBe(10);
        });

        it('should handle decimal coordinates', () => {
            const distance = pointDistance(1.5, 2.5, 4.5, 6.5);
            expect(distance).toBeCloseTo(5, 5);
        });
    });

    describe('distanceToLine', () => {
        it('should calculate perpendicular distance to line', () => {
            // Point (0, 1) to horizontal line from (0, 0) to (10, 0)
            expect(distanceToLine(0, 1, 0, 0, 10, 0)).toBe(1);
        });

        it('should return distance to start point when closest', () => {
            // Point before line segment
            expect(distanceToLine(-5, 0, 0, 0, 10, 0)).toBe(5);
        });

        it('should return distance to end point when closest', () => {
            // Point after line segment
            expect(distanceToLine(15, 0, 0, 0, 10, 0)).toBe(5);
        });

        it('should handle point on the line', () => {
            expect(distanceToLine(5, 0, 0, 0, 10, 0)).toBe(0);
        });

        it('should handle vertical line segment', () => {
            // Point (1, 5) to vertical line from (0, 0) to (0, 10)
            expect(distanceToLine(1, 5, 0, 0, 0, 10)).toBe(1);
        });

        it('should handle diagonal line segment', () => {
            // Point (0, 0) to diagonal line from (0, 10) to (10, 0)
            const distance = distanceToLine(0, 0, 0, 10, 10, 0);
            expect(distance).toBeCloseTo(7.071, 2);
        });

        it('should handle zero-length line segment', () => {
            // Degenerate case: line segment is a point
            const distance = distanceToLine(3, 4, 0, 0, 0, 0);
            expect(distance).toBe(5);
        });
    });

    describe('getComponentsBoundingBox', () => {
        let mockCanvas;

        beforeEach(() => {
            // Mock canvas with getBoundingClientRect
            mockCanvas = {
                width: 800,
                height: 600,
                getBoundingClientRect: vi.fn(() => ({
                    left: 0,
                    top: 0,
                    right: 800,
                    bottom: 600,
                    width: 800,
                    height: 600
                }))
            };
        });

        it('should return null for empty components array', () => {
            const result = getComponentsBoundingBox([], mockCanvas);
            expect(result).toBeNull();
        });

        it('should calculate bounding box for single AND gate', () => {
            const components = [
                { x: 100, y: 100, type: 'AND' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox).toBeDefined();
            expect(bbox.left).toBe(75);  // 100 - 25 (halfWidth)
            expect(bbox.top).toBe(80);   // 100 - 20 (halfHeight)
            expect(bbox.right).toBe(125); // 100 + 25
            expect(bbox.bottom).toBe(120); // 100 + 20
            expect(bbox.width).toBe(50);
            expect(bbox.height).toBe(40);
        });

        it('should calculate bounding box for single INPUT component', () => {
            const components = [
                { x: 100, y: 100, type: 'INPUT' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox.left).toBe(80);  // 100 - 20
            expect(bbox.top).toBe(80);   // 100 - 20
            expect(bbox.right).toBe(120); // 100 + 20
            expect(bbox.bottom).toBe(120); // 100 + 20
        });

        it('should calculate bounding box for single CUSTOM component', () => {
            const components = [
                { x: 100, y: 100, type: 'CUSTOM' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox.left).toBeCloseTo(55, 5);  // 100 - 45
            expect(bbox.top).toBeCloseTo(55, 5);   // 100 - 45
            expect(bbox.right).toBeCloseTo(145, 5); // 100 + 45
            expect(bbox.bottom).toBeCloseTo(145, 5); // 100 + 45
        });

        it('should calculate bounding box for single NOT gate', () => {
            const components = [
                { x: 100, y: 100, type: 'NOT' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox.left).toBeCloseTo(77.5, 5);  // 100 - 22.5
            expect(bbox.top).toBe(80);     // 100 - 20
            expect(bbox.right).toBeCloseTo(122.5, 5); // 100 + 22.5
            expect(bbox.bottom).toBe(120);  // 100 + 20
        });

        it('should calculate bounding box for multiple components', () => {
            const components = [
                { x: 100, y: 100, type: 'AND' },
                { x: 300, y: 200, type: 'OR' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox.left).toBe(75);   // min x - halfWidth
            expect(bbox.top).toBe(80);    // min y - halfHeight
            expect(bbox.right).toBe(325); // max x + halfWidth
            expect(bbox.bottom).toBeCloseTo(220, 5); // max y + halfHeight
        });

        it('should handle mixed component types', () => {
            const components = [
                { x: 100, y: 100, type: 'INPUT' },
                { x: 200, y: 200, type: 'CUSTOM' },
                { x: 300, y: 300, type: 'NOT' }
            ];

            const bbox = getComponentsBoundingBox(components, mockCanvas);

            expect(bbox).toBeDefined();
            expect(bbox.left).toBe(80);    // INPUT at 100 - 20
            expect(bbox.top).toBe(80);     // INPUT at 100 - 20
            expect(bbox.right).toBe(322.5); // NOT at 300 + 22.5
            expect(bbox.bottom).toBe(320);  // NOT at 300 + 20
        });
    });

    describe('calculateRectOverlap', () => {
        it('should return 0 for non-overlapping rectangles', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 20, right: 30, top: 0, bottom: 10 };

            expect(calculateRectOverlap(rect1, rect2)).toBe(0);
        });

        it('should calculate overlap area for partially overlapping rectangles', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 5, right: 15, top: 5, bottom: 15 };

            // Overlap is from (5,5) to (10,10) = 5x5 = 25
            expect(calculateRectOverlap(rect1, rect2)).toBe(25);
        });

        it('should calculate full overlap when one rect contains another', () => {
            const rect1 = { left: 5, right: 10, top: 5, bottom: 10 };
            const rect2 = { left: 0, right: 20, top: 0, bottom: 20 };

            // rect1 is fully inside rect2, overlap = 5x5 = 25
            expect(calculateRectOverlap(rect1, rect2)).toBe(25);
        });

        it('should handle identical rectangles', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 0, right: 10, top: 0, bottom: 10 };

            expect(calculateRectOverlap(rect1, rect2)).toBe(100);
        });

        it('should return 0 for rectangles touching at edge', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 10, right: 20, top: 0, bottom: 10 };

            expect(calculateRectOverlap(rect1, rect2)).toBe(0);
        });

        it('should handle horizontal overlap only', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 5, right: 15, top: 0, bottom: 10 };

            // Overlap is from (5,0) to (10,10) = 5x10 = 50
            expect(calculateRectOverlap(rect1, rect2)).toBe(50);
        });

        it('should handle vertical overlap only', () => {
            const rect1 = { left: 0, right: 10, top: 0, bottom: 10 };
            const rect2 = { left: 0, right: 10, top: 5, bottom: 15 };

            // Overlap is from (0,5) to (10,10) = 10x5 = 50
            expect(calculateRectOverlap(rect1, rect2)).toBe(50);
        });
    });

    describe('pointInRect', () => {
        const rect = { left: 10, right: 20, top: 10, bottom: 20 };

        it('should return true for point inside rectangle', () => {
            expect(pointInRect(15, 15, rect)).toBe(true);
        });

        it('should return true for point on left edge', () => {
            expect(pointInRect(10, 15, rect)).toBe(true);
        });

        it('should return true for point on right edge', () => {
            expect(pointInRect(20, 15, rect)).toBe(true);
        });

        it('should return true for point on top edge', () => {
            expect(pointInRect(15, 10, rect)).toBe(true);
        });

        it('should return true for point on bottom edge', () => {
            expect(pointInRect(15, 20, rect)).toBe(true);
        });

        it('should return true for point at corner', () => {
            expect(pointInRect(10, 10, rect)).toBe(true);
        });

        it('should return false for point outside left', () => {
            expect(pointInRect(5, 15, rect)).toBe(false);
        });

        it('should return false for point outside right', () => {
            expect(pointInRect(25, 15, rect)).toBe(false);
        });

        it('should return false for point outside top', () => {
            expect(pointInRect(15, 5, rect)).toBe(false);
        });

        it('should return false for point outside bottom', () => {
            expect(pointInRect(15, 25, rect)).toBe(false);
        });
    });

    describe('rectsIntersect', () => {
        const rect1 = { left: 10, right: 20, top: 10, bottom: 20 };

        it('should return true for overlapping rectangles', () => {
            const rect2 = { left: 15, right: 25, top: 15, bottom: 25 };
            expect(rectsIntersect(rect1, rect2)).toBe(true);
        });

        it('should return true when one rect contains another', () => {
            const rect2 = { left: 12, right: 18, top: 12, bottom: 18 };
            expect(rectsIntersect(rect1, rect2)).toBe(true);
        });

        it('should return false for non-overlapping rectangles', () => {
            const rect2 = { left: 30, right: 40, top: 30, bottom: 40 };
            expect(rectsIntersect(rect1, rect2)).toBe(false);
        });

        it('should return false for rectangles touching at edge', () => {
            const rect2 = { left: 20, right: 30, top: 10, bottom: 20 };
            expect(rectsIntersect(rect1, rect2)).toBe(false);
        });

        it('should return true for rectangles sharing an edge with overlap', () => {
            const rect2 = { left: 10, right: 20, top: 20, bottom: 30 };
            expect(rectsIntersect(rect1, rect2)).toBe(false);
        });

        it('should return true for partial horizontal overlap', () => {
            const rect2 = { left: 15, right: 25, top: 10, bottom: 20 };
            expect(rectsIntersect(rect1, rect2)).toBe(true);
        });

        it('should return true for partial vertical overlap', () => {
            const rect2 = { left: 10, right: 20, top: 15, bottom: 25 };
            expect(rectsIntersect(rect1, rect2)).toBe(true);
        });

        it('should handle rect1 and rect2 swapped', () => {
            const rect2 = { left: 15, right: 25, top: 15, bottom: 25 };
            expect(rectsIntersect(rect2, rect1)).toBe(true);
        });
    });
});
