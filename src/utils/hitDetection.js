/**
 * Hit Detection Utilities
 * Pure functions for finding components, ports, and connections at coordinates
 */

import { GRID_SIZE, HIT_DETECTION_SIZES, PORT_DETECTION_RADIUS } from '../constants.js';
import { distanceToLine } from './geometry.js';

/**
 * Find component at given coordinates
 * @param {Array} components - All components
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object|null} Component or null
 */
export function findComponentAt(components, x, y) {
    return components.find(c => {
        let size = HIT_DETECTION_SIZES.DEFAULT;
        if (c.type === 'INPUT' || c.type === 'OUTPUT') {
            size = HIT_DETECTION_SIZES.INPUT;
        } else if (c.type === 'CUSTOM') {
            size = HIT_DETECTION_SIZES.CUSTOM;
        } else if (c.type === 'NOT') {
            size = HIT_DETECTION_SIZES.NOT;
        } else {
            // Logic gates (AND, OR, XOR, NAND, NOR, XNOR)
            size = HIT_DETECTION_SIZES.STANDARD_GATE;
        }
        return x >= c.x - size/2 && x <= c.x + size/2 &&
               y >= c.y - size/2 && y <= c.y + size/2;
    }) || null;
}

/**
 * Find port at given coordinates
 * @param {Array} components - All components
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} [portType] - Optional: 'input' or 'output' to filter
 * @returns {Object|null} Port info {component, portIndex, isOutput, x, y} or null
 */
export function findPortAt(components, x, y, portType = null) {
    for (const component of components) {
        // Check output ports
        if (portType !== 'input') {
            for (let i = 0; i < component.outputs.length; i++) {
                const port = component.outputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < PORT_DETECTION_RADIUS) {
                    return {
                        component: component.id,
                        portIndex: i,
                        isOutput: true,
                        x: port.x,
                        y: port.y
                    };
                }
            }
        }

        // Check input ports
        if (portType !== 'output') {
            for (let i = 0; i < component.inputs.length; i++) {
                const port = component.inputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < PORT_DETECTION_RADIUS) {
                    return {
                        component: component.id,
                        portIndex: i,
                        isOutput: false,
                        x: port.x,
                        y: port.y
                    };
                }
            }
        }
    }
    return null;
}

/**
 * Find connection at given coordinates
 * @param {Array} connections - All connections
 * @param {Array} components - All components
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} [threshold=5] - Distance threshold for hit detection
 * @returns {Object|null} Connection or null
 */
export function findConnectionAt(connections, components, x, y, threshold = 5) {
    for (const conn of connections) {
        const from = components.find(c => c.id === conn.from);
        const to = components.find(c => c.id === conn.to);
        if (!from || !to) continue;

        const fromPort = from.outputs[conn.fromPort];
        const toPort = to.inputs[conn.toPort];
        if (!fromPort || !toPort) continue;

        // Distance check to connection line
        const dist = distanceToLine(x, y, fromPort.x, fromPort.y, toPort.x, toPort.y);
        if (dist < threshold) {
            return conn;
        }
    }
    return null;
}

/**
 * Snap coordinates to grid
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} [gridSize=GRID_SIZE] - Grid size
 * @returns {{x: number, y: number}} Snapped coordinates
 */
export function snapToGrid(x, y, gridSize = GRID_SIZE) {
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
    };
}

/**
 * Check if a point is within a component's bounds
 * @param {Object} component - Component object with x, y, type
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if point is within component bounds
 */
export function isPointInComponent(component, x, y) {
    let size = HIT_DETECTION_SIZES.DEFAULT;
    if (component.type === 'INPUT' || component.type === 'OUTPUT') {
        size = HIT_DETECTION_SIZES.INPUT;
    } else if (component.type === 'CUSTOM') {
        size = HIT_DETECTION_SIZES.CUSTOM;
    } else if (component.type === 'NOT') {
        size = HIT_DETECTION_SIZES.NOT;
    } else {
        size = HIT_DETECTION_SIZES.STANDARD_GATE;
    }
    return x >= component.x - size/2 && x <= component.x + size/2 &&
           y >= component.y - size/2 && y <= component.y + size/2;
}
