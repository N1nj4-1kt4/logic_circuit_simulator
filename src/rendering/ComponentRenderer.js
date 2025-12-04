/**
 * ComponentRenderer - Renders all components (gates, I/O, custom components, ports)
 */
import { getComponentValue } from '../core/circuitEvaluator.js';
import { COLORS, FONTS, PORT_RADIUS } from '../constants.js';

export class ComponentRenderer {
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
     * Draw a component (main dispatcher)
     * @param {Object} component - Component to draw
     */
    drawComponent(component) {
        const { type } = component;

        this.ctx.save();

        if (type === 'INPUT') {
            this.drawInputOutput(component, 'INPUT');
        } else if (type === 'OUTPUT') {
            this.drawInputOutput(component, 'OUTPUT');
        } else if (type === 'CUSTOM') {
            this.drawCustomComponent(component);
        } else {
            this.drawGate(component);
        }

        this.ctx.restore();
    }

    /**
     * Draw INPUT or OUTPUT component
     * @param {Object} component - Component to draw
     * @param {string} type - 'INPUT' or 'OUTPUT'
     */
    drawInputOutput(component, type) {
        const { x, y, value } = component;

        if (type === 'INPUT') {
            // Draw input as a circle
            this.ctx.fillStyle = value === 1 ? COLORS.VALUE_ON : COLORS.VALUE_OFF;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = this.darkMode ? COLORS.DARK.TEXT_PRIMARY : COLORS.LIGHT.TEXT_PRIMARY;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.darkMode ? COLORS.DARK.TEXT_PRIMARY : COLORS.LIGHT.TEXT_PRIMARY;
            this.ctx.font = FONTS.COMPONENT_LABEL;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(component.label, x, y - 35);

            this.ctx.fillStyle = 'white';
            this.ctx.fillText(value.toString(), x, y);

            // Output port
            this.drawPort(component.outputs[0].x, component.outputs[0].y, true);
        } else {
            // OUTPUT
            const outputValue = getComponentValue(component);
            this.ctx.fillStyle = outputValue === 1 ? COLORS.VALUE_ON :
                                outputValue === 0 ? COLORS.VALUE_OFF :
                                (this.darkMode ? COLORS.DARK.VALUE_UNDEFINED : COLORS.LIGHT.VALUE_UNDEFINED);
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = this.darkMode ? COLORS.DARK.TEXT_PRIMARY : COLORS.LIGHT.TEXT_PRIMARY;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.darkMode ? COLORS.DARK.TEXT_PRIMARY : COLORS.LIGHT.TEXT_PRIMARY;
            this.ctx.font = FONTS.COMPONENT_LABEL;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(component.label, x, y - 35);

            if (outputValue !== null) {
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(outputValue.toString(), x, y);
            }

            // Input port
            this.drawPort(component.inputs[0].x, component.inputs[0].y, false);
        }
    }

    /**
     * Draw custom component
     * @param {Object} component - Custom component to draw
     */
    drawCustomComponent(component) {
        const { x, y, label, customDefinition } = component;

        // Draw component body with theme colors (90x90 size - 15% larger)
        this.ctx.fillStyle = this.darkMode ? COLORS.CUSTOM_FILL : COLORS.CUSTOM_FILL_LIGHT;
        this.ctx.strokeStyle = this.darkMode ? COLORS.CUSTOM_STROKE : COLORS.CUSTOM_STROKE_LIGHT;
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(x - 45, y - 45, 90, 90);
        this.ctx.strokeRect(x - 45, y - 45, 90, 90);

        // Draw label (larger font for better readability)
        this.ctx.fillStyle = this.darkMode ? COLORS.CUSTOM_STROKE : COLORS.CUSTOM_STROKE_LIGHT;
        this.ctx.font = FONTS.COMPONENT_LABEL;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Wrap text if too long
        const maxWidth = 80;
        if (this.ctx.measureText(label).width > maxWidth) {
            const words = label.split(/(?=[A-Z])/); // Split on capital letters
            if (words.length > 1) {
                this.ctx.fillText(words[0], x, y - 7);
                this.ctx.fillText(words.slice(1).join(''), x, y + 7);
            } else {
                this.ctx.fillText(label.substring(0, 10), x, y - 7);
                this.ctx.fillText(label.substring(10), x, y + 7);
            }
        } else {
            this.ctx.fillText(label, x, y);
        }

        // Draw ports with labels (larger font)
        this.ctx.font = FONTS.CUSTOM_COMPONENT_LABEL;
        this.ctx.fillStyle = this.darkMode ? COLORS.DARK.PORT_LABEL : COLORS.LIGHT.PORT_LABEL;

        // Draw input ports with labels
        component.inputs.forEach((port, index) => {
            this.drawPort(port.x, port.y, false);

            // Draw input label to the left of the port
            if (customDefinition && customDefinition.inputPorts[index]) {
                const inputLabel = customDefinition.inputPorts[index].label;
                this.ctx.textAlign = 'right';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(inputLabel, port.x - 8, port.y);
            }
        });

        // Draw output ports with labels
        component.outputs.forEach((port, index) => {
            this.drawPort(port.x, port.y, true);

            // Draw output label to the right of the port
            if (customDefinition && customDefinition.outputPorts[index]) {
                const outputLabel = customDefinition.outputPorts[index].label;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(outputLabel, port.x + 8, port.y);
            }
        });
    }

    /**
     * Draw logic gate (dispatcher)
     * @param {Object} component - Gate component to draw
     */
    drawGate(component) {
        const { type, x, y } = component;

        const fillColor = this.darkMode ? COLORS.DARK.GATE_FILL : COLORS.LIGHT.GATE_FILL;
        const strokeColor = this.darkMode ? COLORS.DARK.GATE_STROKE : COLORS.LIGHT.GATE_STROKE;

        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;

        // Draw standard logic gate symbols
        switch(type) {
            case 'AND':
                this.drawAndGate(x, y, false);
                break;
            case 'OR':
                this.drawOrGate(x, y, false);
                break;
            case 'NOT':
                this.drawNotGate(x, y);
                break;
            case 'XOR':
                this.drawOrGate(x, y, true);
                break;
            case 'NAND':
                this.drawAndGate(x, y, true);
                break;
            case 'NOR':
                this.drawOrGate(x, y, false, true);
                break;
            case 'XNOR':
                this.drawOrGate(x, y, true, true);
                break;
        }

        // Draw ports
        component.inputs.forEach(port => {
            this.drawPort(port.x, port.y, false);
        });
        component.outputs.forEach(port => {
            this.drawPort(port.x, port.y, true);
        });
    }

    /**
     * Draw AND or NAND gate
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {boolean} inverted - If true, draw NAND (with inversion bubble)
     */
    drawAndGate(x, y, inverted) {
        // AND gate shape (D-shape)
        this.ctx.beginPath();
        this.ctx.moveTo(x - 25, y - 20);
        this.ctx.lineTo(x, y - 20);
        this.ctx.arc(x, y, 20, -Math.PI/2, Math.PI/2);
        this.ctx.lineTo(x - 25, y + 20);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        if (inverted) {
            // Add inversion bubble for NAND
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    /**
     * Draw OR, XOR, NOR, or XNOR gate
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {boolean} isXor - If true, draw XOR/XNOR (with extra line)
     * @param {boolean} inverted - If true, draw NOR/XNOR (with inversion bubble)
     */
    drawOrGate(x, y, isXor, inverted) {
        // OR/XOR gate shape
        this.ctx.beginPath();
        this.ctx.moveTo(x - 25, y - 20);
        // Curved back
        this.ctx.quadraticCurveTo(x - 15, y, x - 25, y + 20);
        // Bottom to output curve
        this.ctx.quadraticCurveTo(x - 5, y + 15, x + 20, y);
        // Top curve back
        this.ctx.quadraticCurveTo(x - 5, y - 15, x - 25, y - 20);
        this.ctx.fill();
        this.ctx.stroke();

        if (isXor) {
            // Extra line for XOR
            this.ctx.beginPath();
            this.ctx.moveTo(x - 30, y - 20);
            this.ctx.quadraticCurveTo(x - 20, y, x - 30, y + 20);
            this.ctx.stroke();
        }

        if (inverted) {
            // Add inversion bubble for NOR/XNOR
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    /**
     * Draw NOT gate
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawNotGate(x, y) {
        // NOT gate - triangle with bubble
        this.ctx.beginPath();
        this.ctx.moveTo(x - 20, y - 15);
        this.ctx.lineTo(x - 20, y + 15);
        this.ctx.lineTo(x + 15, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Inversion circle
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Draw a port (connection point)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {boolean} isOutput - If true, draw output port (green), else input port (blue)
     */
    drawPort(x, y, isOutput) {
        this.ctx.fillStyle = isOutput ? COLORS.PORT_OUTPUT : COLORS.PORT_INPUT;
        this.ctx.beginPath();
        this.ctx.arc(x, y, PORT_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = COLORS.PORT_STROKE;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
}

