/**
 * Pure logic gate evaluation functions
 * Each function takes input values and returns the gate's output
 */

/**
 * Evaluate AND gate
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateAND(inputs) {
    return inputs[0] && inputs[1] ? 1 : 0;
}

/**
 * Evaluate OR gate
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateOR(inputs) {
    return inputs[0] || inputs[1] ? 1 : 0;
}

/**
 * Evaluate NOT gate
 * @param {number[]} inputs - Array with single input value (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateNOT(inputs) {
    return inputs[0] ? 0 : 1;
}

/**
 * Evaluate XOR gate (exclusive OR)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateXOR(inputs) {
    return inputs[0] !== inputs[1] ? 1 : 0;
}

/**
 * Evaluate NAND gate (NOT AND)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateNAND(inputs) {
    return inputs[0] && inputs[1] ? 0 : 1;
}

/**
 * Evaluate NOR gate (NOT OR)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateNOR(inputs) {
    return inputs[0] || inputs[1] ? 0 : 1;
}

/**
 * Evaluate XNOR gate (exclusive NOR)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateXNOR(inputs) {
    return inputs[0] === inputs[1] ? 1 : 0;
}

/**
 * Evaluate OUTPUT component (pass-through)
 * @param {number[]} inputs - Array with single input value
 * @returns {number} Output value (same as input)
 */
export function evaluateOUTPUT(inputs) {
    return inputs[0];
}

/**
 * Generic gate evaluator - dispatches to specific gate function
 * @param {string} type - Gate type (AND, OR, NOT, XOR, NAND, NOR, XNOR, OUTPUT)
 * @param {number[]} inputs - Array of input values
 * @returns {number|null} Output value or null if inputs incomplete
 */
export function evaluateGate(type, inputs) {
    // Return null if any input is null or undefined
    if (inputs.some(v => v === null || v === undefined)) {
        return null;
    }

    switch (type) {
        case 'AND':
            return evaluateAND(inputs);
        case 'OR':
            return evaluateOR(inputs);
        case 'NOT':
            return evaluateNOT(inputs);
        case 'XOR':
            return evaluateXOR(inputs);
        case 'NAND':
            return evaluateNAND(inputs);
        case 'NOR':
            return evaluateNOR(inputs);
        case 'XNOR':
            return evaluateXNOR(inputs);
        case 'OUTPUT':
            return evaluateOUTPUT(inputs);
        default:
            return null;
    }
}

/**
 * Get truth table for a specific gate type
 * @param {string} type - Gate type
 * @returns {Array} Array of {inputs: [], output: number} objects
 */
export function getGateTruthTable(type) {
    const gateFunction = (inputs) => evaluateGate(type, inputs);

    switch (type) {
        case 'NOT':
            return [
                { inputs: [0], output: gateFunction([0]) },
                { inputs: [1], output: gateFunction([1]) }
            ];
        case 'AND':
        case 'OR':
        case 'XOR':
        case 'NAND':
        case 'NOR':
        case 'XNOR':
            return [
                { inputs: [0, 0], output: gateFunction([0, 0]) },
                { inputs: [0, 1], output: gateFunction([0, 1]) },
                { inputs: [1, 0], output: gateFunction([1, 0]) },
                { inputs: [1, 1], output: gateFunction([1, 1]) }
            ];
        default:
            return [];
    }
}
