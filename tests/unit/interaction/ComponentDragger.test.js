/**
 * Unit tests for ComponentDragger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentDragger } from '../../../src/interaction/ComponentDragger.js';

// Create mock CircuitState
const createMockState = () => ({
    getMode: vi.fn().mockReturnValue('place'),
    getSelectedTool: vi.fn().mockReturnValue(null)
});

// Create mock canvas element
const createMockCanvas = () => ({
    style: { cursor: '' }
});

describe('ComponentDragger', () => {
    let dragger;
    let mockState;
    let mockFindComponent;
    let mockMoveComponent;
    let mockRedraw;
    let mockCanvas;

    beforeEach(() => {
        mockState = createMockState();
        mockFindComponent = vi.fn();
        mockMoveComponent = vi.fn();
        mockRedraw = vi.fn();
        mockCanvas = createMockCanvas();

        dragger = new ComponentDragger({
            state: mockState,
            findComponent: mockFindComponent,
            moveComponent: mockMoveComponent,
            redraw: mockRedraw
        });
    });

    describe('Initialization', () => {
        it('initializes with correct default drag state', () => {
            expect(dragger.isDragging()).toBe(false);
            expect(dragger.getHasMoved()).toBe(false);
        });

        it('stores provided dependencies', () => {
            expect(dragger.state).toBe(mockState);
            expect(dragger.findComponent).toBe(mockFindComponent);
            expect(dragger.moveComponent).toBe(mockMoveComponent);
            expect(dragger.redraw).toBe(mockRedraw);
        });
    });

    describe('handleMouseDown', () => {
        const testComponent = { id: 1, type: 'AND', x: 100, y: 100 };

        it('resets hasMoved flag on every click', () => {
            dragger.dragState.hasMoved = true;
            mockFindComponent.mockReturnValue(null);

            dragger.handleMouseDown(200, 200, mockCanvas);

            expect(dragger.getHasMoved()).toBe(false);
        });

        it('prepares drag when clicking on component in place mode', () => {
            mockState.getMode.mockReturnValue('place');
            mockState.getSelectedTool.mockReturnValue(null);
            mockFindComponent.mockReturnValue(testComponent);

            const result = dragger.handleMouseDown(100, 100, mockCanvas);

            expect(result).toBe(true);
            expect(dragger.dragState.component).toBe(testComponent);
            expect(dragger.dragState.startPos).toEqual({ x: 100, y: 100 });
        });

        it('calculates correct offset from component center', () => {
            mockState.getMode.mockReturnValue('place');
            mockFindComponent.mockReturnValue(testComponent);

            dragger.handleMouseDown(110, 115, mockCanvas);

            expect(dragger.dragState.offset).toEqual({ x: 10, y: 15 });
        });

        it('does not start drag when in connect mode', () => {
            mockState.getMode.mockReturnValue('connect');
            mockFindComponent.mockReturnValue(testComponent);

            const result = dragger.handleMouseDown(100, 100, mockCanvas);

            expect(result).toBe(false);
            expect(dragger.dragState.component).toBeNull();
        });

        it('does not start drag when in delete mode', () => {
            mockState.getMode.mockReturnValue('delete');
            mockFindComponent.mockReturnValue(testComponent);

            const result = dragger.handleMouseDown(100, 100, mockCanvas);

            expect(result).toBe(false);
            expect(dragger.dragState.component).toBeNull();
        });

        it('does not start drag when tool is selected for placement', () => {
            mockState.getMode.mockReturnValue('place');
            mockState.getSelectedTool.mockReturnValue('AND');
            mockFindComponent.mockReturnValue(testComponent);

            const result = dragger.handleMouseDown(100, 100, mockCanvas);

            expect(result).toBe(false);
        });

        it('returns false when no component found', () => {
            mockState.getMode.mockReturnValue('place');
            mockFindComponent.mockReturnValue(null);

            const result = dragger.handleMouseDown(100, 100, mockCanvas);

            expect(result).toBe(false);
            expect(dragger.dragState.component).toBeNull();
        });

        it('does not set isDragging to true immediately', () => {
            mockFindComponent.mockReturnValue(testComponent);

            dragger.handleMouseDown(100, 100, mockCanvas);

            expect(dragger.isDragging()).toBe(false);
        });
    });

    describe('handleMouseMove', () => {
        const testComponent = { id: 1, type: 'AND', x: 100, y: 100 };

        beforeEach(() => {
            // Setup component click
            mockFindComponent.mockReturnValue(testComponent);
            dragger.handleMouseDown(100, 100, mockCanvas);
        });

        it('does not start drag for small movement (within threshold)', () => {
            const result = dragger.handleMouseMove(101, 101, mockCanvas);

            expect(result).toBe(false);
            expect(dragger.isDragging()).toBe(false);
            expect(mockMoveComponent).not.toHaveBeenCalled();
        });

        it('starts drag when movement exceeds threshold', () => {
            dragger.handleMouseMove(105, 100, mockCanvas);

            expect(dragger.isDragging()).toBe(true);
            expect(dragger.getHasMoved()).toBe(true);
        });

        it('sets cursor to grabbing when drag starts', () => {
            dragger.handleMouseMove(110, 100, mockCanvas);

            expect(mockCanvas.style.cursor).toBe('grabbing');
        });

        it('moves component during drag', () => {
            // Start drag
            dragger.handleMouseMove(110, 110, mockCanvas);

            // Continue drag
            dragger.handleMouseMove(150, 150, mockCanvas);

            expect(mockMoveComponent).toHaveBeenCalledWith(testComponent, 150, 150);
        });

        it('applies offset when moving', () => {
            // Start with offset (clicked at 110, 115 on component at 100, 100)
            dragger.dragState.offset = { x: 10, y: 15 };
            dragger.dragState.isDragging = true;

            dragger.handleMouseMove(200, 200, mockCanvas);

            expect(mockMoveComponent).toHaveBeenCalledWith(testComponent, 190, 185);
        });

        it('calls redraw during drag', () => {
            dragger.handleMouseMove(110, 110, mockCanvas);
            dragger.handleMouseMove(120, 120, mockCanvas);

            expect(mockRedraw).toHaveBeenCalled();
        });

        it('returns true when dragging', () => {
            dragger.handleMouseMove(110, 110, mockCanvas); // Start drag

            const result = dragger.handleMouseMove(120, 120, mockCanvas);

            expect(result).toBe(true);
        });

        it('returns false when not dragging', () => {
            // No component clicked
            dragger.dragState.component = null;

            const result = dragger.handleMouseMove(120, 120, mockCanvas);

            expect(result).toBe(false);
        });
    });

    describe('handleMouseUp', () => {
        const testComponent = { id: 1, type: 'AND', x: 100, y: 100 };

        beforeEach(() => {
            mockFindComponent.mockReturnValue(testComponent);
            dragger.handleMouseDown(100, 100, mockCanvas);
            dragger.handleMouseMove(110, 110, mockCanvas); // Start drag
        });

        it('resets drag state', () => {
            dragger.handleMouseUp(mockCanvas);

            expect(dragger.isDragging()).toBe(false);
            expect(dragger.dragState.component).toBeNull();
            expect(dragger.dragState.startPos).toBeNull();
        });

        it('preserves hasMoved flag for click detection', () => {
            expect(dragger.getHasMoved()).toBe(true);

            dragger.handleMouseUp(mockCanvas);

            expect(dragger.getHasMoved()).toBe(true);
        });

        it('resets cursor to crosshair', () => {
            mockCanvas.style.cursor = 'grabbing';

            dragger.handleMouseUp(mockCanvas);

            expect(mockCanvas.style.cursor).toBe('crosshair');
        });
    });

    describe('isDragging', () => {
        it('returns current drag state', () => {
            expect(dragger.isDragging()).toBe(false);

            dragger.dragState.isDragging = true;

            expect(dragger.isDragging()).toBe(true);
        });
    });

    describe('getHasMoved', () => {
        it('returns hasMoved state', () => {
            expect(dragger.getHasMoved()).toBe(false);

            dragger.dragState.hasMoved = true;

            expect(dragger.getHasMoved()).toBe(true);
        });
    });

    describe('resetHasMoved', () => {
        it('resets hasMoved to false', () => {
            dragger.dragState.hasMoved = true;

            dragger.resetHasMoved();

            expect(dragger.getHasMoved()).toBe(false);
        });
    });

    describe('Movement Threshold', () => {
        const testComponent = { id: 1, type: 'AND', x: 100, y: 100 };

        beforeEach(() => {
            mockFindComponent.mockReturnValue(testComponent);
            dragger.handleMouseDown(100, 100, mockCanvas);
        });

        it('does not start drag at exactly 3px movement', () => {
            dragger.handleMouseMove(103, 100, mockCanvas);

            expect(dragger.isDragging()).toBe(false);
        });

        it('starts drag at 4px horizontal movement', () => {
            dragger.handleMouseMove(104, 100, mockCanvas);

            expect(dragger.isDragging()).toBe(true);
        });

        it('starts drag at 4px vertical movement', () => {
            dragger.handleMouseMove(100, 104, mockCanvas);

            expect(dragger.isDragging()).toBe(true);
        });

        it('starts drag at diagonal movement > 3px in either direction', () => {
            dragger.handleMouseMove(104, 104, mockCanvas);

            expect(dragger.isDragging()).toBe(true);
        });
    });

    describe('Complete Drag Flow', () => {
        const testComponent = { id: 1, type: 'AND', x: 100, y: 100 };

        it('performs complete drag operation', () => {
            mockFindComponent.mockReturnValue(testComponent);

            // 1. Click on component
            const mouseDownResult = dragger.handleMouseDown(100, 100, mockCanvas);
            expect(mouseDownResult).toBe(true);
            expect(dragger.isDragging()).toBe(false);

            // 2. Move past threshold
            dragger.handleMouseMove(110, 100, mockCanvas);
            expect(dragger.isDragging()).toBe(true);
            expect(dragger.getHasMoved()).toBe(true);

            // 3. Continue dragging
            dragger.handleMouseMove(200, 150, mockCanvas);
            expect(mockMoveComponent).toHaveBeenCalledWith(testComponent, 200, 150);

            // 4. Release
            dragger.handleMouseUp(mockCanvas);
            expect(dragger.isDragging()).toBe(false);
            expect(dragger.getHasMoved()).toBe(true); // Still true for click detection

            // 5. Reset hasMoved after click handler processes it
            dragger.resetHasMoved();
            expect(dragger.getHasMoved()).toBe(false);
        });

        it('distinguishes click from drag', () => {
            mockFindComponent.mockReturnValue(testComponent);

            // Click without significant movement
            dragger.handleMouseDown(100, 100, mockCanvas);
            dragger.handleMouseMove(101, 101, mockCanvas); // Within threshold
            dragger.handleMouseUp(mockCanvas);

            expect(dragger.getHasMoved()).toBe(false);

            // This would be a click, not a drag
        });
    });
});
