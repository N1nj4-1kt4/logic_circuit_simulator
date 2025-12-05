/**
 * CanvasOperations - Canvas Manipulation Module
 *
 * Handles canvas-level component manipulation:
 * - Component placement
 * - Connection creation
 * - Component/connection deletion
 *
 * Note: This module was extracted from CircuitOperations to focus on
 * canvas manipulation only. Other responsibilities (truth table, board
 * management, component library, auto-save) are in separate modules.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { snapToGrid } from '../utils/hitDetection.js';
import { ComponentNotFoundError } from './errors.js';
import { CircuitTransaction } from './CircuitTransaction.js';
import {
    getInputCount,
    getOutputCount
} from './circuitEvaluator.js';

export class CanvasOperations {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {Object} config.callbacks - Callback functions
     * @param {Function} config.callbacks.defineComponentPorts - Define component ports
     * @param {Function} config.callbacks.findComponent - Find component at coordinates
     * @param {Function} config.callbacks.findPort - Find port at coordinates
     */
    constructor(config) {
        this.state = config.state;
        this.callbacks = config.callbacks;
    }

    // ====================================
    // Component Placement
    // ====================================

    /**
     * Place a component on the canvas
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Component type (e.g., 'AND', 'INPUT', 'CUSTOM:name')
     */
    placeComponent(x, y, type) {
        let customName = null;
        let actualType = type;

        // Check if this is a custom component
        if (type.startsWith('CUSTOM:')) {
            customName = type.substring(7);
            actualType = 'CUSTOM';

            const customComponents = this.state.getCustomComponents();
            if (!customComponents[customName]) {
                throw new ComponentNotFoundError(customName);
            }
        }

        const components = this.state.getComponents();
        const customComponents = this.state.getCustomComponents();

        const snapped = snapToGrid(x, y);
        const component = {
            id: this.state.generateNextId(),
            type: actualType,
            x: snapped.x,
            y: snapped.y,
            value: actualType === 'INPUT' ? 0 : null,
            inputs: [],
            outputs: [],
            label: actualType === 'INPUT' ? `I${getInputCount(components) + 1}` :
                   actualType === 'OUTPUT' ? `O${getOutputCount(components) + 1}` :
                   actualType === 'CUSTOM' ? customName : null,
            customName: customName,
            customDefinition: customName ? customComponents[customName] : null
        };

        // Define input/output ports
        this.callbacks.defineComponentPorts(component);

        this.state.addComponent(component);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
    }

    // ====================================
    // Connection and Deletion
    // ====================================

    /**
     * Handle connection between components
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    handleConnect(x, y) {
        const port = this.callbacks.findPort(x, y);

        if (!port) {
            return;
        }

        const connectStart = this.state.getConnectStart();
        if (!connectStart) {
            // Start connection from output port only
            if (port.isOutput) {
                this.state.setConnectStart({
                    component: port.component,
                    portIndex: port.portIndex,
                    x: port.x,
                    y: port.y
                });
                eventBus.emit(EVENT_TYPES.CONNECTION_START_CHANGED, true);
            }
        } else {
            // End connection at input port only
            if (!port.isOutput) {
                this.state.addConnection({
                    from: connectStart.component,
                    fromPort: connectStart.portIndex,
                    to: port.component,
                    toPort: port.portIndex
                });
                this.state.setConnectStart(null);
                eventBus.emit(EVENT_TYPES.CONNECTION_START_CHANGED, false);
                eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            }
        }
    }

    /**
     * Check if deleting a component/connection would invalidate the circuit during active simulation
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Function} findConnection - Function to find connection at coordinates
     * @returns {{ willInvalidate: boolean, component: Object|null, connection: Object|null, transaction: CircuitTransaction|null }}
     */
    checkDeletionImpact(x, y, findConnection) {
        const component = this.callbacks.findComponent(x, y);
        const connection = component ? null : findConnection(x, y);

        // Nothing to delete at this position
        if (!component && !connection) {
            return { willInvalidate: false, component: null, connection: null, transaction: null };
        }

        // Create transaction for predictive analysis
        const transaction = new CircuitTransaction(this.state);

        if (component) {
            transaction.removeComponent(component.id);
        } else {
            transaction.removeConnection(connection);
        }

        // Only check impact during active simulation
        if (!this.state.isAutoCyclingActive()) {
            return { willInvalidate: false, component, connection, transaction };
        }

        // Analyze the impact
        const impact = transaction.analyze();

        return {
            willInvalidate: !impact.wouldBeValid,
            component,
            connection,
            transaction
        };
    }

    /**
     * Handle deletion of components or connections
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Function} findConnection - Find connection at coordinates
     * @param {Object} options - Optional parameters
     * @param {CircuitTransaction} options.transaction - Pre-computed transaction to commit
     */
    handleDelete(x, y, findConnection, options = {}) {
        const { transaction } = options;

        // If a transaction is provided, commit it directly
        if (transaction) {
            transaction.commit();
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            return;
        }

        // Otherwise, find and delete component/connection
        const component = this.callbacks.findComponent(x, y);

        if (component) {
            this.state.removeComponent(component.id);
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            return;
        }

        // Delete connection
        const connection = findConnection(x, y);

        if (connection) {
            this.state.removeConnection(connection);
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        }
    }
}
