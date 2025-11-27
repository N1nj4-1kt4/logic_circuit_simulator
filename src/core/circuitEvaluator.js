/**
 * Circuit evaluation engine
 * Simulates circuit behavior by propagating values through connections
 */

import { evaluateGate } from './gateLogic.js';

/**
 * Get value from a specific output port of a component
 * @param {Object} component - Component object
 * @param {number} portIndex - Output port index
 * @returns {number|null} Port value or null if not available
 */
export function getPortValue(component, portIndex) {
    // For custom components with multiple outputs, return the specific output value
    if (component.type === 'CUSTOM' && component.outputValues) {
        return component.outputValues[portIndex] !== undefined ? component.outputValues[portIndex] : null;
    }
    // For regular components with single output
    return component.value;
}

/**
 * Get current value of a component
 * @param {Object} component - Component object
 * @returns {number|null} Component value
 */
export function getComponentValue(component) {
    if (component.type === 'INPUT') {
        return component.value;
    }
    return component.value;
}

/**
 * Calculate component value from its inputs (for internal custom component simulation)
 * @param {Object} component - Component to evaluate
 * @param {Array} components - Array of all components in the internal circuit
 * @param {Array} connections - Array of all connections in the internal circuit
 * @returns {number|null} Calculated value or null if inputs incomplete
 */
export function calculateInternalComponentValue(component, components, connections) {
    const inputValues = [];

    // Get input values from internal connections
    for (let i = 0; i < component.inputs.length; i++) {
        const connection = connections.find(
            c => c.to === component.id && c.toPort === i
        );

        if (!connection) {
            return null;
        }

        const sourceComponent = components.find(c => c.id === connection.from);
        if (!sourceComponent || sourceComponent.value === null) {
            return null;
        }

        inputValues.push(sourceComponent.value);
    }

    return evaluateGate(component.type, inputValues);
}

/**
 * Evaluate a custom component
 * @param {Object} component - Custom component to evaluate
 * @param {number[]} inputValues - Input values for the component
 * @returns {number|null} Primary output value (first output)
 */
export function evaluateCustomComponent(component, inputValues) {
    const def = component.customDefinition;

    // Create a temporary circuit for simulation
    const tempComponents = JSON.parse(JSON.stringify(def.components));
    const tempConnections = JSON.parse(JSON.stringify(def.connections));

    // Set input values on the internal INPUT components
    def.inputPorts.forEach((inputPort, index) => {
        const internalInput = tempComponents.find(c => c.id === inputPort.id);
        if (internalInput) {
            internalInput.value = inputValues[index];
        }
    });

    // Simulate the internal circuit
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        tempComponents.forEach(comp => {
            if (comp.type === 'INPUT') return;

            const oldValue = comp.value;
            const newValue = calculateInternalComponentValue(comp, tempComponents, tempConnections);

            if (newValue !== null && newValue !== oldValue) {
                comp.value = newValue;
                changed = true;
            }
        });
    }

    // Get ALL output values (not just the first one!)
    const outputValues = [];
    def.outputPorts.forEach(outputPort => {
        const internalOutput = tempComponents.find(c => c.id === outputPort.id);
        outputValues.push(internalOutput ? internalOutput.value : null);
    });

    // Store output values in the component for multi-output support
    component.outputValues = outputValues;

    // Return first output for backward compatibility with single-output components
    return outputValues[0];
}

/**
 * Calculate a component's value from its connected inputs
 * @param {Object} component - Component to evaluate
 * @param {Array} components - Array of all components
 * @param {Array} connections - Array of all connections
 * @returns {number|null} Calculated value or null if inputs incomplete
 */
export function calculateComponentValue(component, components, connections) {
    const inputValues = [];

    // Get input values from connections
    for (let i = 0; i < component.inputs.length; i++) {
        const connection = connections.find(
            c => c.to === component.id && c.toPort === i
        );

        if (!connection) {
            return null; // Not all inputs connected
        }

        const sourceComponent = components.find(c => c.id === connection.from);
        if (!sourceComponent) {
            return null; // Source component not found
        }

        // Get value from the specific output port (critical for multi-output components!)
        const portValue = getPortValue(sourceComponent, connection.fromPort);
        if (portValue === null) {
            return null; // Source port not yet calculated
        }

        inputValues.push(portValue);
    }

    // Calculate output based on gate type
    if (component.type === 'CUSTOM') {
        return evaluateCustomComponent(component, inputValues);
    } else {
        return evaluateGate(component.type, inputValues);
    }
}

/**
 * Simulate entire circuit
 * Iteratively propagates values through all components until stable
 * @param {Array} components - Array of all components (will be modified)
 * @param {Array} connections - Array of all connections
 * @returns {Object} Simulation result with iteration count and success status
 */
export function simulateCircuit(components, connections) {
    // Reset all component values except inputs
    components.forEach(c => {
        if (c.type !== 'INPUT') {
            c.value = null;
        }
    });

    // Iteratively calculate values until stable
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        components.forEach(component => {
            if (component.type === 'INPUT') return;

            const oldValue = component.value;
            const newValue = calculateComponentValue(component, components, connections);

            if (newValue !== null && newValue !== oldValue) {
                component.value = newValue;
                changed = true;
            }
        });
    }

    return {
        iterations,
        stable: iterations < maxIterations,
        maxIterationsReached: iterations >= maxIterations
    };
}

/**
 * Count input components
 * @param {Array} components - Array of all components
 * @returns {number} Number of INPUT components
 */
export function getInputCount(components) {
    return components.filter(c => c.type === 'INPUT').length;
}

/**
 * Count output components
 * @param {Array} components - Array of all components
 * @returns {number} Number of OUTPUT components
 */
export function getOutputCount(components) {
    return components.filter(c => c.type === 'OUTPUT').length;
}
