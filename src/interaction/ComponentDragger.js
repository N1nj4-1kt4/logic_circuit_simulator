/**
 * ComponentDragger
 * Handles dragging of components on the canvas
 *
 * Drag state is managed locally in this class (not in CircuitState)
 * since it's UI interaction state, not circuit state.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';

export class ComponentDragger {
    /**
     * @param {Object} params
     * @param {CircuitState} params.state - The circuit state instance (for mode checks only)
     * @param {Function} params.findComponent - Function to find component at coordinates
     * @param {Function} params.moveComponent - Function to move a component
     * @param {Function} params.redraw - Function to redraw the canvas
     */
    constructor({ state, findComponent, moveComponent, redraw }) {
        this.state = state;
        this.findComponent = findComponent;
        this.moveComponent = moveComponent;
        this.redraw = redraw;

        // Local drag state (UI interaction state, not circuit state)
        this.dragState = {
            isDragging: false,
            component: null,
            offset: { x: 0, y: 0 },
            startPos: null,
            hasMoved: false
        };
    }

    /**
     * Handle mousedown event - start potential drag
     * @param {number} x - Mouse x coordinate
     * @param {number} y - Mouse y coordinate
     * @param {HTMLElement} canvas - Canvas element
     * @returns {boolean} - True if drag started, false otherwise
     */
    handleMouseDown(x, y, canvas) {
        // Reset hasMoved flag for all clicks
        this.dragState.hasMoved = false;

        // Only allow dragging if not in special modes and no tool selected for placement
        const isPlacementMode = this.state.getMode() === 'place' && this.state.getSelectedTool();
        if (this.state.getMode() !== 'connect' && this.state.getMode() !== 'delete' && !isPlacementMode) {
            const component = this.findComponent(x, y);
            if (component) {
                // If a component is clicked, prepare for potential drag
                this.dragState.isDragging = false; // Don't set true yet
                this.dragState.component = component;
                this.dragState.startPos = { x, y };
                this.dragState.offset = {
                    x: x - component.x,
                    y: y - component.y
                };
                return true;
            }
        }
        return false;
    }

    /**
     * Handle mousemove event - perform dragging if threshold exceeded
     * @param {number} x - Mouse x coordinate
     * @param {number} y - Mouse y coordinate
     * @param {HTMLElement} canvas - Canvas element
     * @returns {boolean} - True if dragging occurred, false otherwise
     */
    handleMouseMove(x, y, canvas) {
        // Check if we should start dragging (movement threshold)
        const { component, startPos, isDragging } = this.dragState;

        if (component && !isDragging && startPos) {
            const dx = Math.abs(x - startPos.x);
            const dy = Math.abs(y - startPos.y);
            if (dx > 3 || dy > 3) { // 3px movement threshold
                this.dragState.isDragging = true;
                this.dragState.hasMoved = true;
                canvas.style.cursor = 'grabbing';
                // Emit drag started event for undo coalescing
                eventBus.emit(EVENT_TYPES.DRAG_STARTED, { component });
            }
        }

        // Handle component dragging
        if (this.dragState.isDragging && component) {
            const { offset } = this.dragState;
            const newX = x - offset.x;
            const newY = y - offset.y;
            this.moveComponent(component, newX, newY);
            this.redraw();
            return true;
        }

        return false;
    }

    /**
     * Handle mouseup event - stop dragging
     * @param {HTMLElement} canvas - Canvas element
     */
    handleMouseUp(canvas) {
        // Emit drag ended event if we were actually dragging
        if (this.dragState.isDragging && this.dragState.component) {
            eventBus.emit(EVENT_TYPES.DRAG_ENDED, { component: this.dragState.component });
        }

        // Reset drag state (but preserve hasMoved for click detection)
        this.dragState.isDragging = false;
        this.dragState.component = null;
        this.dragState.startPos = null;
        canvas.style.cursor = 'crosshair';
    }

    /**
     * Check if currently dragging
     * @returns {boolean}
     */
    isDragging() {
        return this.dragState.isDragging;
    }

    /**
     * Check if component has moved (for click vs drag detection)
     * @returns {boolean}
     */
    getHasMoved() {
        return this.dragState.hasMoved;
    }

    /**
     * Reset the hasMoved flag (called after click is processed)
     */
    resetHasMoved() {
        this.dragState.hasMoved = false;
    }
}
