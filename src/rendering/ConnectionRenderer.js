/**
 * ConnectionRenderer - Renders connections (wires) between components
 */
import { getPortValue } from '../core/circuitEvaluator.js';
import { COLORS } from '../constants.js';

export class ConnectionRenderer {
    constructor(ctx, darkMode = false) {
        this.ctx = ctx;
        this.darkMode = darkMode;
    }

    /**
     * Set dark mode state
     * @param {boolean} darkMode
     */
    setDarkMode(darkMode) {
        this.darkMode = darkMode;
    }

    /**
     * Draw all connections between components
     * @param {Array} connections - Array of connection objects
     * @param {Array} components - Array of component objects
     */
    drawConnections(connections, components) {
        connections.forEach((conn, index) => {
            const from = components.find(c => c.id === conn.from);
            const to = components.find(c => c.id === conn.to);

            if (!from || !to) return;

            const fromPort = from.outputs[conn.fromPort];
            const toPort = to.inputs[conn.toPort];

            // Determine color based on signal value and theme
            const value = getPortValue(from, conn.fromPort);
            this.ctx.strokeStyle = value === 1 ? COLORS.VALUE_ON :
                                   value === 0 ? COLORS.VALUE_OFF :
                                   (this.darkMode ? COLORS.DARK.WIRE_UNDEFINED : COLORS.LIGHT.WIRE_UNDEFINED);
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();
            this.ctx.moveTo(fromPort.x, fromPort.y);

            // Improved routing with offset to avoid overlaps
            const dx = toPort.x - fromPort.x;
            const dy = toPort.y - fromPort.y;

            // Calculate offset based on port index to spread wires
            const offset = (conn.toPort - 0.5) * 10;

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal preference
                const midX = fromPort.x + dx * 0.6;
                this.ctx.lineTo(midX, fromPort.y);
                this.ctx.lineTo(midX, toPort.y + offset * 0.3);
                this.ctx.lineTo(toPort.x, toPort.y);
            } else {
                // Vertical preference
                const midY = fromPort.y + dy * 0.6;
                this.ctx.lineTo(fromPort.x, midY);
                this.ctx.lineTo(toPort.x, midY);
                this.ctx.lineTo(toPort.x, toPort.y);
            }

            this.ctx.stroke();
        });
    }

    /**
     * Draw connection preview line (during dragging)
     * @param {number} fromX - Start X position
     * @param {number} fromY - Start Y position
     * @param {number} toX - End X position
     * @param {number} toY - End Y position
     */
    drawConnectionPreview(fromX, fromY, toX, toY) {
        this.ctx.strokeStyle = COLORS.WIRE_PREVIEW;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
}

