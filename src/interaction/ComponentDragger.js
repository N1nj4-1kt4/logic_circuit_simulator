/**
 * ComponentDragger
 * Handles dragging of components on the canvas
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';

export class ComponentDragger {
    /**
     * @param {Object} params
     * @param {CircuitState} params.state - The circuit state instance
     * @param {Function} params.findComponent - Function to find component at coordinates
     * @param {Function} params.moveComponent - Function to move a component
     * @param {Function} params.redraw - Function to redraw the canvas
     */
    constructor({ state, findComponent, moveComponent, redraw }) {
        this.state = state;
        this.findComponent = findComponent;
        this.moveComponent = moveComponent;
        this.redraw = redraw;
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
        this.state.setHasMoved(false);

        // Only allow dragging if not in special modes and no tool selected for placement
        const isPlacementMode = this.state.getMode() === 'place' && this.state.getSelectedTool();
        if (this.state.getMode() !== 'connect' && this.state.getMode() !== 'delete' && !isPlacementMode) {
            const component = this.findComponent(x, y);
            if (component) {
                // If a component is clicked, prepare for potential drag
                this.state.setDraggingState(false); // Don't set true yet
                this.state.setDraggedComponent(component);
                this.state.setDragStartPos({ x, y });
                const dragOffset = this.state.getDragOffset();
                dragOffset.x = x - component.x;
                dragOffset.y = y - component.y;
                this.state.setDragOffset(dragOffset);
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
        const draggedComponent = this.state.getDraggedComponent();
        const dragStartPos = this.state.getDragStartPos();

        if (draggedComponent && !this.state.isDragging() && dragStartPos) {
            const dx = Math.abs(x - dragStartPos.x);
            const dy = Math.abs(y - dragStartPos.y);
            if (dx > 3 || dy > 3) { // 3px movement threshold
                this.state.setDraggingState(true);
                this.state.setHasMoved(true);
                canvas.style.cursor = 'grabbing';
            }
        }

        // Handle component dragging
        if (this.state.isDragging() && draggedComponent) {
            const dragOffset = this.state.getDragOffset();
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;
            this.moveComponent(draggedComponent, newX, newY);
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
        // Reset drag state
        this.state.setDraggingState(false);
        this.state.setDraggedComponent(null);
        this.state.setDragStartPos(null);
        canvas.style.cursor = 'crosshair';
    }

    /**
     * Check if currently dragging
     * @returns {boolean}
     */
    isDragging() {
        return this.state.isDragging();
    }
}
