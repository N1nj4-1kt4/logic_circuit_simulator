/**
 * CanvasRenderer - Main renderer coordinator that orchestrates all rendering
 */
import { GridRenderer } from './GridRenderer.js';
import { ComponentRenderer } from './ComponentRenderer.js';
import { ConnectionRenderer } from './ConnectionRenderer.js';

export class CanvasRenderer {
    constructor(canvas, components, connections, darkMode = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.components = components;
        this.connections = connections;
        this.darkMode = darkMode;

        // Create renderer instances
        this.gridRenderer = new GridRenderer(canvas);
        this.componentRenderer = new ComponentRenderer(this.ctx, darkMode);
        this.connectionRenderer = new ConnectionRenderer(this.ctx, darkMode);
    }

    /**
     * Set dark mode state
     * @param {boolean} darkMode
     */
    setDarkMode(darkMode) {
        this.darkMode = darkMode;
        this.componentRenderer.setDarkMode(darkMode);
        this.connectionRenderer.setDarkMode(darkMode);
    }

    /**
     * Update components reference
     * @param {Array} components
     */
    updateComponents(components) {
        this.components = components;
    }

    /**
     * Update connections reference
     * @param {Array} connections
     */
    updateConnections(connections) {
        this.connections = connections;
    }

    /**
     * Main render method
     * @param {Object|null} connectStart - Connection preview start point {x, y} or null
     */
    render(connectStart = null) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.gridRenderer.render();

        // Draw connections
        this.connectionRenderer.drawConnections(this.connections, this.components);

        // Draw components
        this.components.forEach(component => {
            this.componentRenderer.drawComponent(component);
        });

        // Draw connection preview if active
        if (connectStart) {
            // Get current mouse position from connectStart if available
            // Note: The actual mouse position will be passed from the mousemove handler
            // For now, we'll handle preview in the mousemove handler directly
        }
    }

    /**
     * Draw connection preview (called from mousemove handler)
     * @param {number} fromX - Start X position
     * @param {number} fromY - Start Y position
     * @param {number} toX - End X position
     * @param {number} toY - End Y position
     */
    drawConnectionPreview(fromX, fromY, toX, toY) {
        this.connectionRenderer.drawConnectionPreview(fromX, fromY, toX, toY);
    }
}

