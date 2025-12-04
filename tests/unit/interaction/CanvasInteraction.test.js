/**
 * Unit tests for CanvasInteraction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CanvasInteraction } from '../../../src/interaction/CanvasInteraction.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

// Create mock CircuitState
const createMockState = () => ({
    getMode: vi.fn().mockReturnValue('place'),
    getSelectedTool: vi.fn().mockReturnValue(null),
    getConnectStart: vi.fn().mockReturnValue(null)
});

// Create mock canvas element
const createMockCanvas = () => {
    const canvas = {
        width: 800,
        height: 600,
        style: { cursor: '' },
        getBoundingClientRect: vi.fn().mockReturnValue({
            left: 0,
            top: 0,
            width: 800,
            height: 600
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    };
    return canvas;
};

// Create mock callbacks
const createMockCallbacks = () => ({
    onCanvasClick: vi.fn(),
    onCanvasDoubleClick: vi.fn(),
    onConnectionPreview: vi.fn(),
    findComponent: vi.fn(),
    moveComponent: vi.fn(),
    redraw: vi.fn()
});

// Create mock canvas renderer
const createMockCanvasRenderer = () => ({
    drawConnectionPreview: vi.fn()
});

describe('CanvasInteraction', () => {
    let interaction;
    let mockCanvas;
    let mockState;
    let mockCallbacks;
    let mockCanvasRenderer;

    beforeEach(() => {
        mockCanvas = createMockCanvas();
        mockState = createMockState();
        mockCallbacks = createMockCallbacks();
        mockCanvasRenderer = createMockCanvasRenderer();

        interaction = new CanvasInteraction({
            canvas: mockCanvas,
            state: mockState,
            callbacks: mockCallbacks,
            canvasRenderer: mockCanvasRenderer
        });

        eventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('stores provided dependencies', () => {
            expect(interaction.canvas).toBe(mockCanvas);
            expect(interaction.state).toBe(mockState);
            expect(interaction.callbacks).toBe(mockCallbacks);
            expect(interaction.canvasRenderer).toBe(mockCanvasRenderer);
        });

        it('creates ComponentDragger instance', () => {
            expect(interaction.componentDragger).toBeDefined();
        });

        it('binds event handlers', () => {
            expect(typeof interaction.handleMouseDown).toBe('function');
            expect(typeof interaction.handleMouseMove).toBe('function');
            expect(typeof interaction.handleMouseUp).toBe('function');
            expect(typeof interaction.handleClick).toBe('function');
            expect(typeof interaction.handleDoubleClick).toBe('function');
            expect(typeof interaction.handleContextMenu).toBe('function');
        });
    });

    describe('init', () => {
        it('adds canvas event listeners', () => {
            interaction.init();

            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('dblclick', expect.any(Function));
            expect(mockCanvas.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
        });

        it('adds document mouseup listener', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

            interaction.init();

            expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
        });
    });

    describe('destroy', () => {
        it('removes canvas event listeners', () => {
            interaction.destroy();

            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('dblclick', expect.any(Function));
            expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
        });

        it('removes document mouseup listener', () => {
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            interaction.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
        });
    });

    describe('getScaledCoordinates', () => {
        it('returns correct coordinates for 1:1 scale', () => {
            const event = { clientX: 100, clientY: 150 };

            const coords = interaction.getScaledCoordinates(event);

            expect(coords.x).toBe(100);
            expect(coords.y).toBe(150);
        });

        it('scales coordinates when canvas is scaled', () => {
            mockCanvas.getBoundingClientRect.mockReturnValue({
                left: 0,
                top: 0,
                width: 400,  // Canvas displayed at half size
                height: 300
            });

            const event = { clientX: 100, clientY: 150 };

            const coords = interaction.getScaledCoordinates(event);

            expect(coords.x).toBe(200);  // Scaled up
            expect(coords.y).toBe(300);
        });

        it('accounts for canvas offset', () => {
            mockCanvas.getBoundingClientRect.mockReturnValue({
                left: 50,
                top: 100,
                width: 800,
                height: 600
            });

            const event = { clientX: 150, clientY: 250 };

            const coords = interaction.getScaledCoordinates(event);

            expect(coords.x).toBe(100);  // 150 - 50
            expect(coords.y).toBe(150);  // 250 - 100
        });
    });

    describe('handleClick', () => {
        it('calls onCanvasClick callback with coordinates', () => {
            const event = {
                clientX: 100,
                clientY: 100
            };

            interaction.handleClick(event);

            expect(mockCallbacks.onCanvasClick).toHaveBeenCalledWith(100, 100);
        });

        it('does not call onCanvasClick if component was dragged', () => {
            // Simulate a drag having occurred
            interaction.componentDragger.dragState.hasMoved = true;

            const event = {
                clientX: 100,
                clientY: 100
            };

            interaction.handleClick(event);

            expect(mockCallbacks.onCanvasClick).not.toHaveBeenCalled();
        });

        it('resets hasMoved after suppressing click', () => {
            interaction.componentDragger.dragState.hasMoved = true;

            const event = {
                clientX: 100,
                clientY: 100
            };

            interaction.handleClick(event);

            expect(interaction.componentDragger.getHasMoved()).toBe(false);
        });
    });

    describe('handleDoubleClick', () => {
        it('calls onCanvasDoubleClick callback with coordinates', () => {
            const event = {
                clientX: 200,
                clientY: 150
            };

            interaction.handleDoubleClick(event);

            expect(mockCallbacks.onCanvasDoubleClick).toHaveBeenCalledWith(200, 150);
        });
    });

    describe('handleContextMenu', () => {
        it('prevents default behavior', () => {
            const event = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            const result = interaction.handleContextMenu(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('emits MODE_EXIT_REQUEST event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.MODE_EXIT_REQUEST, handler);

            const event = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            interaction.handleContextMenu(event);

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('handleMouseDown', () => {
        it('passes coordinates to componentDragger', () => {
            const handleMouseDownSpy = vi.spyOn(interaction.componentDragger, 'handleMouseDown');

            const event = {
                clientX: 100,
                clientY: 100
            };

            interaction.handleMouseDown(event);

            expect(handleMouseDownSpy).toHaveBeenCalledWith(100, 100, mockCanvas);
        });
    });

    describe('handleMouseMove', () => {
        it('passes coordinates to componentDragger', () => {
            const handleMouseMoveSpy = vi.spyOn(interaction.componentDragger, 'handleMouseMove')
                .mockReturnValue(false);

            const event = {
                clientX: 150,
                clientY: 150
            };

            interaction.handleMouseMove(event);

            expect(handleMouseMoveSpy).toHaveBeenCalledWith(150, 150, mockCanvas);
        });

        it('prevents default when dragging', () => {
            vi.spyOn(interaction.componentDragger, 'handleMouseMove').mockReturnValue(true);

            const event = {
                clientX: 150,
                clientY: 150,
                preventDefault: vi.fn()
            };

            interaction.handleMouseMove(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });

        describe('Connection Preview', () => {
            beforeEach(() => {
                mockState.getMode.mockReturnValue('connect');
                mockState.getConnectStart.mockReturnValue({
                    x: 100,
                    y: 100
                });
                vi.spyOn(interaction.componentDragger, 'handleMouseMove').mockReturnValue(false);
            });

            it('draws connection preview in connect mode with start point', () => {
                const event = {
                    clientX: 200,
                    clientY: 150
                };

                interaction.handleMouseMove(event);

                expect(mockCallbacks.redraw).toHaveBeenCalled();
                expect(mockCanvasRenderer.drawConnectionPreview).toHaveBeenCalledWith(100, 100, 200, 150);
            });

            it('does not draw preview without connect start', () => {
                mockState.getConnectStart.mockReturnValue(null);

                const event = {
                    clientX: 200,
                    clientY: 150
                };

                interaction.handleMouseMove(event);

                expect(mockCanvasRenderer.drawConnectionPreview).not.toHaveBeenCalled();
            });
        });

        describe('Cursor Updates', () => {
            beforeEach(() => {
                vi.spyOn(interaction.componentDragger, 'handleMouseMove').mockReturnValue(false);
            });

            it('sets cursor to grab when hovering over component', () => {
                mockState.getMode.mockReturnValue('place');
                mockState.getSelectedTool.mockReturnValue(null);
                mockCallbacks.findComponent.mockReturnValue({ id: 1, type: 'AND' });

                const event = { clientX: 100, clientY: 100 };
                interaction.handleMouseMove(event);

                expect(mockCanvas.style.cursor).toBe('grab');
            });

            it('sets cursor to crosshair when not hovering over component', () => {
                mockState.getMode.mockReturnValue('place');
                mockState.getSelectedTool.mockReturnValue(null);
                mockCallbacks.findComponent.mockReturnValue(null);

                const event = { clientX: 100, clientY: 100 };
                interaction.handleMouseMove(event);

                expect(mockCanvas.style.cursor).toBe('crosshair');
            });

            it('keeps crosshair cursor in placement mode with tool selected', () => {
                mockState.getMode.mockReturnValue('place');
                mockState.getSelectedTool.mockReturnValue('AND');

                const event = { clientX: 100, clientY: 100 };
                interaction.handleMouseMove(event);

                expect(mockCanvas.style.cursor).toBe('crosshair');
            });

            it('does not update cursor in connect mode', () => {
                mockState.getMode.mockReturnValue('connect');
                mockCanvas.style.cursor = 'initial';

                const event = { clientX: 100, clientY: 100 };
                interaction.handleMouseMove(event);

                // Cursor should not be changed by hover logic
                expect(mockCallbacks.findComponent).not.toHaveBeenCalled();
            });

            it('does not update cursor in delete mode', () => {
                mockState.getMode.mockReturnValue('delete');

                const event = { clientX: 100, clientY: 100 };
                interaction.handleMouseMove(event);

                expect(mockCallbacks.findComponent).not.toHaveBeenCalled();
            });
        });
    });

    describe('handleMouseUp', () => {
        it('passes canvas to componentDragger', () => {
            const handleMouseUpSpy = vi.spyOn(interaction.componentDragger, 'handleMouseUp');

            const event = {};
            interaction.handleMouseUp(event);

            expect(handleMouseUpSpy).toHaveBeenCalledWith(mockCanvas);
        });
    });

    describe('handleDocumentMouseUp', () => {
        it('handles mouseup when dragging outside canvas', () => {
            vi.spyOn(interaction.componentDragger, 'isDragging').mockReturnValue(true);
            const handleMouseUpSpy = vi.spyOn(interaction.componentDragger, 'handleMouseUp');

            interaction.handleDocumentMouseUp({});

            expect(handleMouseUpSpy).toHaveBeenCalledWith(mockCanvas);
        });

        it('does nothing when not dragging', () => {
            vi.spyOn(interaction.componentDragger, 'isDragging').mockReturnValue(false);
            const handleMouseUpSpy = vi.spyOn(interaction.componentDragger, 'handleMouseUp');

            interaction.handleDocumentMouseUp({});

            expect(handleMouseUpSpy).not.toHaveBeenCalled();
        });
    });

    describe('Integration Scenarios', () => {
        it('handles complete click flow', () => {
            const event = {
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn()
            };

            // Mousedown
            interaction.handleMouseDown(event);

            // Small movement (not a drag)
            interaction.handleMouseMove({ ...event, clientX: 101, clientY: 101 });

            // Mouseup
            interaction.handleMouseUp(event);

            // Click
            interaction.handleClick(event);

            expect(mockCallbacks.onCanvasClick).toHaveBeenCalledWith(100, 100);
        });

        it('suppresses click after drag', () => {
            // Setup to enable dragging
            mockCallbacks.findComponent.mockReturnValue({ id: 1, type: 'AND', x: 100, y: 100 });

            const mouseDownEvent = {
                clientX: 100,
                clientY: 100
            };

            const mouseMoveEvent = {
                clientX: 150,
                clientY: 150,
                preventDefault: vi.fn()
            };

            const mouseUpEvent = {};
            const clickEvent = {
                clientX: 150,
                clientY: 150
            };

            // Drag flow
            interaction.handleMouseDown(mouseDownEvent);
            interaction.handleMouseMove(mouseMoveEvent);
            interaction.handleMouseUp(mouseUpEvent);
            interaction.handleClick(clickEvent);

            // Click should be suppressed after drag
            expect(mockCallbacks.onCanvasClick).not.toHaveBeenCalled();
        });
    });
});
