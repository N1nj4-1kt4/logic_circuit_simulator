/**
 * GridRenderer - Renders the grid background on the canvas
 * Currently grid is drawn via CSS, but this class exists for consistency
 * and future canvas-based grid rendering if needed
 */
export class GridRenderer {
    constructor(canvas, gridSize = 50) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
    }

    /**
     * Render the grid on the canvas
     * Currently a no-op since grid is CSS-based
     */
    render() {
        // Grid is now drawn via CSS background
        // This method exists for consistency and future canvas-based rendering
    }
}

