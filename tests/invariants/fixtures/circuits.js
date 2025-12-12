/**
 * Circuit type factories for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 */

/**
 * Circuit type configurations
 */
export const CIRCUIT_TYPES = {
    SMALL_VALID: {
        name: 'Small Valid (6 inputs, 2 outputs)',
        inputs: 6,
        outputs: 2,
        isValid: true,
        rowCount: 64  // 2^6
    },
    LARGE_VALID: {
        name: 'Large Valid (12 inputs, 3 outputs)',
        inputs: 12,
        outputs: 3,
        isValid: true,
        rowCount: 4096  // 2^12, triggers async computing
    },
    INVALID: {
        name: 'Invalid (12 inputs, 0 outputs)',
        inputs: 12,
        outputs: 0,
        isValid: false,
        reason: 'No outputs connected'
    }
};

/**
 * Generate a truth table for given input/output counts
 * @param {number} numInputs - Number of inputs
 * @param {number} numOutputs - Number of outputs
 * @returns {Array} Truth table rows
 */
export function generateTruthTable(numInputs, numOutputs) {
    const rowCount = Math.pow(2, numInputs);
    const table = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const row = {};

        // Input columns (using ID-based field names)
        for (let i = 0; i < numInputs; i++) {
            const inputId = i + 1;
            row[`input_${inputId}`] = (rowIndex >> (numInputs - 1 - i)) & 1;
        }

        // Output columns (using ID-based field names)
        for (let i = 0; i < numOutputs; i++) {
            const outputId = numInputs + i + 1;
            // Simple XOR-like logic for outputs
            row[`output_${outputId}`] = rowIndex % 2;
        }

        table.push(row);
    }

    return table;
}

/**
 * Generate default column order for a circuit analysis
 * @param {Object} analysis - Circuit analysis
 * @returns {Array} Column order array
 */
export function generateDefaultColumnOrder(analysis) {
    const order = [];

    // Inputs first
    if (analysis.inputs) {
        analysis.inputs.forEach(input => {
            order.push(`input_${input.id}`);
        });
    }

    // Then outputs
    if (analysis.outputs) {
        analysis.outputs.forEach(output => {
            order.push(`output_${output.id}`);
        });
    }

    return order;
}

/**
 * Create a circuit analysis object for a given circuit type
 * @param {string} type - Circuit type key from CIRCUIT_TYPES
 * @returns {Object} Circuit analysis object
 */
export function createCircuit(type) {
    const config = CIRCUIT_TYPES[type];
    if (!config) {
        throw new Error(`Unknown circuit type: ${type}`);
    }

    const inputs = Array.from({ length: config.inputs }, (_, i) => ({
        id: i + 1,
        label: `I${i + 1}`,
        value: 0
    }));

    const outputs = Array.from({ length: config.outputs }, (_, i) => ({
        id: config.inputs + i + 1,
        label: `O${i + 1}`,
        value: 0
    }));

    return {
        inputs,
        outputs,
        table: config.isValid ? generateTruthTable(config.inputs, config.outputs) : [],
        isValid: config.isValid,
        reason: config.reason || null
    };
}

/**
 * Deep clone a circuit analysis object
 * @param {Object} analysis - Circuit analysis to clone
 * @returns {Object} Cloned analysis
 */
export function cloneAnalysis(analysis) {
    if (!analysis) return null;

    return {
        inputs: analysis.inputs.map(input => ({ ...input })),
        outputs: analysis.outputs.map(output => ({ ...output })),
        table: analysis.table.map(row => ({ ...row })),
        isValid: analysis.isValid,
        reason: analysis.reason
    };
}
