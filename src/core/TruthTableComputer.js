/**
 * TruthTableComputer - Pure computation of truth tables
 *
 * This module computes truth tables without modifying the original circuit state.
 * It uses cloned components for simulation to ensure the circuit remains unchanged.
 */

import { simulateCircuit } from './circuitEvaluator.js';

/**
 * Validate if the circuit is suitable for truth table computation
 * @param {Array} components - Circuit components
 * @param {Array} connections - Circuit connections
 * @returns {{ isValid: boolean, reason: string|null, inputs: Array, outputs: Array }}
 */
export function validateCircuitForTruthTable(components, connections) {
    const inputs = components
        .filter(c => c.type === 'INPUT')
        .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    const outputs = components
        .filter(c => c.type === 'OUTPUT')
        .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    // Must have at least one INPUT
    if (inputs.length === 0) {
        return {
            isValid: false,
            reason: 'Please add at least one input to generate a truth table.',
            inputs,
            outputs
        };
    }

    // Must have at least one OUTPUT
    if (outputs.length === 0) {
        return {
            isValid: false,
            reason: 'Please add at least one output to generate a truth table.',
            inputs,
            outputs
        };
    }

    // Must have at least one gate or custom component
    const gates = components.filter(c =>
        c.type !== 'INPUT' && c.type !== 'OUTPUT'
    );

    if (gates.length === 0) {
        return {
            isValid: false,
            reason: 'Please add at least one gate or component to generate a truth table.',
            inputs,
            outputs
        };
    }

    // Check that at least one gate has all its inputs connected from INPUT chain
    // and all its outputs connected to OUTPUT chain
    const hasValidGate = gates.some(gate => {
        // Skip gates without properly defined ports
        if (!gate.inputs || !gate.outputs) {
            return false;
        }

        // Check all input ports are connected
        const allInputsConnected = gate.inputs.every((_, portIndex) => {
            return connections.some(conn =>
                conn.to === gate.id && conn.toPort === portIndex
            );
        });

        // Check all output ports are connected
        const allOutputsConnected = gate.outputs.every((_, portIndex) => {
            return connections.some(conn =>
                conn.from === gate.id && conn.fromPort === portIndex
            );
        });

        return allInputsConnected && allOutputsConnected;
    });

    if (!hasValidGate) {
        return {
            isValid: false,
            reason: 'Please ensure at least one gate has all its inputs and outputs connected.',
            inputs,
            outputs
        };
    }

    return { isValid: true, reason: null, inputs, outputs };
}

/**
 * Compute truth table for a circuit without modifying the original components
 * @param {Array} components - Circuit components (will NOT be modified)
 * @param {Array} connections - Circuit connections
 * @returns {{ inputs: Array, outputs: Array, table: Array, isValid: boolean, reason: string|null }}
 */
export function computeTruthTable(components, connections) {
    // Validate circuit first
    const validation = validateCircuitForTruthTable(components, connections);

    if (!validation.isValid) {
        return {
            inputs: validation.inputs,
            outputs: validation.outputs,
            table: [],
            isValid: false,
            reason: validation.reason
        };
    }

    const { inputs, outputs } = validation;
    const numCombinations = Math.pow(2, inputs.length);
    const table = [];

    // Map original component IDs to their indices for quick lookup
    const inputIdToIndex = new Map();
    inputs.forEach((input, index) => {
        inputIdToIndex.set(input.id, index);
    });

    const outputIdToIndex = new Map();
    outputs.forEach((output, index) => {
        outputIdToIndex.set(output.id, index);
    });

    // Generate all input combinations
    for (let i = 0; i < numCombinations; i++) {
        // Deep clone components for this simulation run
        const clonedComponents = JSON.parse(JSON.stringify(components));

        // Find cloned inputs and set their values
        const clonedInputs = clonedComponents
            .filter(c => c.type === 'INPUT')
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

        const row = {};

        // Set input values on cloned components
        clonedInputs.forEach((input, index) => {
            const bitValue = (i >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
            row[`input${index}`] = bitValue;
        });

        // Simulate circuit on cloned components
        simulateCircuit(clonedComponents, connections);

        // Store ALL component values for this row (for wire color rendering)
        row.componentValues = {};
        clonedComponents.forEach(comp => {
            row.componentValues[comp.id] = {
                value: comp.value,
                outputValues: comp.outputValues ? [...comp.outputValues] : null
            };
        });

        // Record output values from cloned outputs
        const clonedOutputs = clonedComponents
            .filter(c => c.type === 'OUTPUT')
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

        clonedOutputs.forEach((output, index) => {
            row[`output${index}`] = output.value !== null ? output.value : '?';
        });

        table.push(row);
    }

    return {
        inputs,
        outputs,
        table,
        isValid: true,
        reason: null
    };
}

/**
 * Look up output values for a given input combination from a pre-computed truth table
 * @param {Object} cache - Pre-computed truth table cache
 * @param {Array} inputValues - Array of input values (0 or 1)
 * @returns {Object|null} - Row from truth table or null if not found
 */
export function lookupTruthTableRow(cache, inputValues) {
    if (!cache || !cache.isValid || !cache.table) {
        return null;
    }

    // Calculate row index from input values
    // inputValues[0] is MSB, inputValues[n-1] is LSB
    let rowIndex = 0;
    inputValues.forEach((value, index) => {
        rowIndex = (rowIndex << 1) | (value ? 1 : 0);
    });

    if (rowIndex >= 0 && rowIndex < cache.table.length) {
        return cache.table[rowIndex];
    }

    return null;
}

/**
 * Get the row index that matches the current input state
 * @param {Object} cache - Pre-computed truth table cache
 * @param {Array} components - Current circuit components (to read input values)
 * @returns {number} - Row index or -1 if not found
 */
export function getCurrentRowIndex(cache, components) {
    if (!cache || !cache.isValid || !cache.inputs) {
        return -1;
    }

    // Get current input values from actual components
    const inputs = components
        .filter(c => c.type === 'INPUT')
        .sort((a, b) => a.label.localeCompare(b.label));

    if (inputs.length !== cache.inputs.length) {
        return -1;
    }

    // Calculate row index
    let rowIndex = 0;
    inputs.forEach(input => {
        rowIndex = (rowIndex << 1) | (input.value ? 1 : 0);
    });

    return rowIndex;
}
