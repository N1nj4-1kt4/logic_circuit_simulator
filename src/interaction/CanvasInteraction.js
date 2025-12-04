/**
 * CanvasInteraction
 * Handles all canvas event listeners and user interactions
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { ComponentDragger } from './ComponentDragger.js';

export class CanvasInteraction {
    /**
     * @param {Object} params
     * @param {HTMLCanvasElement} params.canvas - The canvas element
     * @param {CircuitState} params.state - The circuit state instance
     * @param {Object} params.callbacks - Callback functions for interaction events
     * @param {Function} params.callbacks.onCanvasClick - Called on canvas click
     * @param {Function} params.callbacks.onCanvasDoubleClick - Called on canvas double-click
     * @param {Function} params.callbacks.onConnectionPreview - Called when drawing connection preview
     * @param {Function} params.callbacks.findComponent - Function to find component at coordinates
     * @param {Function} params.callbacks.moveComponent - Function to move a component
     * @param {Function} params.callbacks.redraw - Function to redraw the canvas
     * @param {Object} params.canvasRenderer - The canvas renderer instance
     */
    constructor({ canvas, state, callbacks, canvasRenderer }) {
        this.canvas = canvas;
        this.state = state;
        this.callbacks = callbacks;
        this.canvasRenderer = canvasRenderer;

        // Initialize component dragger
        this.componentDragger = new ComponentDragger({
            state: this.state,
            findComponent: this.callbacks.findComponent,
            moveComponent: this.callbacks.moveComponent,
            redraw: this.callbacks.redraw
        });

        // Bind event handlers
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleDocumentMouseUp = this.handleDocumentMouseUp.bind(this);
    }

    /**
     * Initialize event listeners
     */
    init() {
        // Canvas event listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('dblclick', this.handleDoubleClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);

        // Document event listener (for mouseup outside canvas)
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    }

    /**
     * Get scaled coordinates from mouse event
     * @param {MouseEvent} e - Mouse event
     * @returns {{x: number, y: number}} - Scaled coordinates
     */
    getScaledCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /**
     * Handle mousedown event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseDown(e) {
        const { x, y } = this.getScaledCoordinates(e);
        this.componentDragger.handleMouseDown(x, y, this.canvas);
    }

    /**
     * Handle mousemove event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        const { x, y } = this.getScaledCoordinates(e);

        // Handle component dragging
        const isDragging = this.componentDragger.handleMouseMove(x, y, this.canvas);

        if (isDragging) {
            e.preventDefault();
        }
        // Handle connection preview
        else if (this.state.getMode() === 'connect' && this.state.getConnectStart()) {
            this.callbacks.redraw();
            const connectStart = this.state.getConnectStart();
            this.canvasRenderer.drawConnectionPreview(connectStart.x, connectStart.y, x, y);
        }
        // Update cursor based on hover
        else if (this.state.getMode() !== 'connect' && this.state.getMode() !== 'delete') {
            const isPlacementMode = this.state.getMode() === 'place' && this.state.getSelectedTool();
            if (!isPlacementMode) {
                const component = this.callbacks.findComponent(x, y);
                this.canvas.style.cursor = component ? 'grab' : 'crosshair';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
        }
    }

    /**
     * Handle mouseup event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseUp(e) {
        this.componentDragger.handleMouseUp(this.canvas);
    }

    /**
     * Handle document mouseup (outside canvas)
     * @param {MouseEvent} e - Mouse event
     */
    handleDocumentMouseUp(e) {
        if (this.componentDragger.isDragging()) {
            this.componentDragger.handleMouseUp(this.canvas);
        }
    }

    /**
     * Handle click event
     * @param {MouseEvent} e - Mouse event
     */
    handleClick(e) {
        // Don't process click if it was actually a drag
        if (this.componentDragger.getHasMoved()) {
            this.componentDragger.resetHasMoved();
            return;
        }

        const { x, y } = this.getScaledCoordinates(e);
        this.callbacks.onCanvasClick(x, y);
    }

    /**
     * Handle double-click event
     * @param {MouseEvent} e - Mouse event
     */
    handleDoubleClick(e) {
        const { x, y } = this.getScaledCoordinates(e);
        this.callbacks.onCanvasDoubleClick(x, y);
    }

    /**
     * Handle context menu (right-click) event
     * @param {MouseEvent} e - Mouse event
     */
    handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        // Emit event for exiting to neutral mode
        eventBus.emit(EVENT_TYPES.MODE_EXIT_REQUEST);

        return false;
    }
}
