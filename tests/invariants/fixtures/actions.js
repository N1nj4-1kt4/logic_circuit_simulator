/**
 * Action simulation functions for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 *
 * Each action simulates a user interaction or circuit change
 * and the expected panel response.
 */

import { generateTruthTable, generateDefaultColumnOrder } from './circuits.js';

/**
 * All possible actions that can affect the truth table panel
 */
export const ACTIONS = {
    TOGGLE_INPUT: {
        name: 'Toggle an input',
        affects: 'data',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Toggle first input value
            analysis.inputs[0].value = analysis.inputs[0].value === 0 ? 1 : 0;
            // Simulate step completed event
            await panel._handleStepCompleted({ cycleIndex: 1, inputValues: analysis.inputs.map(i => i.value) });
        }
    },

    VALID_TO_INVALID: {
        name: 'Valid → Invalid (remove output)',
        affects: 'validity',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Remove all outputs, making circuit invalid
            analysis.outputs = [];
            analysis.isValid = false;
            analysis.reason = 'No outputs connected';
            analysis.table = [];
            circuitState._setAnalysis(analysis);
            await panel._handleValidityChanged({ canSimulate: false, reason: analysis.reason });
        }
    },

    INVALID_TO_VALID: {
        name: 'Invalid → Valid (connect output)',
        affects: 'validity+structure',  // Building a table from scratch is effectively a structure change
        applicableTo: ['INVALID'],
        execute: async (panel, circuitState, analysis) => {
            // Add an output to make circuit valid
            const outputId = analysis.inputs.length + 1;
            analysis.outputs = [{ id: outputId, label: 'O1', value: 0 }];
            analysis.isValid = true;
            analysis.reason = null;
            analysis.table = generateTruthTable(analysis.inputs.length, 1);
            circuitState._setAnalysis(analysis);
            await panel._handleComputed();
        }
    },

    ADD_INPUT: {
        name: 'Add input (keep valid)',
        affects: 'structure',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Add a new input
            const newId = analysis.inputs.length + 1;
            analysis.inputs.push({ id: newId, label: `I${newId}`, value: 0 });
            // Regenerate table with new structure
            analysis.table = generateTruthTable(analysis.inputs.length, analysis.outputs.length);
            // Update output IDs to be after inputs
            analysis.outputs.forEach((output, i) => {
                output.id = analysis.inputs.length + i + 1;
            });
            circuitState._setAnalysis(analysis);
            await panel._handleComputed();
        }
    },

    DELETE_INPUT: {
        name: 'Delete input (keep valid)',
        affects: 'structure',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Remove last input (keep at least 1)
            if (analysis.inputs.length > 1) {
                analysis.inputs.pop();
                // Regenerate table with new structure
                analysis.table = generateTruthTable(analysis.inputs.length, analysis.outputs.length);
                // Update output IDs
                analysis.outputs.forEach((output, i) => {
                    output.id = analysis.inputs.length + i + 1;
                });
                circuitState._setAnalysis(analysis);
                await panel._handleComputed();
            }
        }
    },

    ADD_OUTPUT: {
        name: 'Add output',
        affects: 'structure',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Add a new output
            const newId = analysis.inputs.length + analysis.outputs.length + 1;
            analysis.outputs.push({ id: newId, label: `O${analysis.outputs.length + 1}`, value: 0 });
            // Regenerate table with new structure
            analysis.table = generateTruthTable(analysis.inputs.length, analysis.outputs.length);
            circuitState._setAnalysis(analysis);
            await panel._handleComputed();
        }
    },

    RENAME_INPUT: {
        name: 'Rename input',
        affects: 'labels',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Rename first input
            analysis.inputs[0].label = 'RenamedInput';
            circuitState._setAnalysis(analysis);
            await panel._handleComputed();
        }
    },

    RENAME_OUTPUT: {
        name: 'Rename output',
        affects: 'labels',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Rename first output
            if (analysis.outputs.length > 0) {
                analysis.outputs[0].label = 'RenamedOutput';
                circuitState._setAnalysis(analysis);
                await panel._handleComputed();
            }
        }
    },

    REORDER_INPUT_COLUMNS: {
        name: 'Reorder input columns',
        affects: 'columnOrder',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Simulate Tabulator columnMoved event by reordering columns
            const currentOrder = panel.columnOrder || generateDefaultColumnOrder(analysis);
            const newOrder = [...currentOrder];
            // Swap first two columns if there are at least 2
            if (newOrder.length >= 2) {
                [newOrder[0], newOrder[1]] = [newOrder[1], newOrder[0]];
            }
            panel.columnOrder = newOrder;
            panel._saveState();
        }
    },

    REORDER_OUTPUT_COLUMNS: {
        name: 'Reorder output columns',
        affects: 'columnOrder',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Simulate moving last output column to the beginning
            const currentOrder = panel.columnOrder || generateDefaultColumnOrder(analysis);
            const newOrder = [...currentOrder];
            if (newOrder.length > 0) {
                const lastItem = newOrder.pop();
                newOrder.unshift(lastItem);
            }
            panel.columnOrder = newOrder;
            panel._saveState();
        }
    },

    DRAG_TABLE: {
        name: 'Drag table',
        affects: 'position',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID', 'INVALID'],
        execute: async (panel, circuitState, analysis, mockDOM) => {
            // Simulate drag via interact.js callback
            if (panel._dragMoveListener) {
                // Get current position
                const currentX = panel.state?.x || 0;
                const currentY = panel.state?.y || 0;

                // Simulate drag event
                panel._dragMoveListener({
                    target: panel.panel,
                    dx: 50,
                    dy: 30
                });

                // Update mock DOM transform
                if (mockDOM && mockDOM.panelEl) {
                    mockDOM.panelEl.style.transform = `translate(${currentX + 50}px, ${currentY + 30}px)`;
                }
            }
        }
    },

    RESIZE_SMALLER: {
        name: 'Resize smaller',
        affects: 'size',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID', 'INVALID'],
        execute: async (panel, circuitState, analysis, mockDOM) => {
            // Simulate resize via interact.js callback
            if (panel._resizeMoveListener) {
                panel._resizeMoveListener({
                    target: panel.panel,
                    rect: { width: 300, height: 200 },
                    deltaRect: { left: 0, top: 0 }  // No edge translation
                });

                // Update mock DOM dimensions
                if (mockDOM && mockDOM.panelEl) {
                    mockDOM.panelEl.style.width = '300px';
                    mockDOM.panelEl.style.height = '200px';
                    mockDOM.panelEl.offsetWidth = 300;
                    mockDOM.panelEl.offsetHeight = 200;
                }
            }
        }
    },

    RESIZE_LARGER: {
        name: 'Resize larger',
        affects: 'size',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID', 'INVALID'],
        execute: async (panel, circuitState, analysis, mockDOM) => {
            // Simulate resize via interact.js callback
            if (panel._resizeMoveListener) {
                panel._resizeMoveListener({
                    target: panel.panel,
                    rect: { width: 700, height: 500 },
                    deltaRect: { left: 0, top: 0 }  // No edge translation
                });

                // Update mock DOM dimensions
                if (mockDOM && mockDOM.panelEl) {
                    mockDOM.panelEl.style.width = '700px';
                    mockDOM.panelEl.style.height = '500px';
                    mockDOM.panelEl.offsetWidth = 700;
                    mockDOM.panelEl.offsetHeight = 500;
                }
            }
        }
    },

    DELETE_INPUT_INVALID: {
        name: 'Delete input (circuit goes invalid)',
        affects: 'validity+structure',
        applicableTo: ['SMALL_VALID', 'LARGE_VALID'],
        execute: async (panel, circuitState, analysis) => {
            // Remove all inputs, making circuit invalid
            analysis.inputs = [];
            analysis.isValid = false;
            analysis.reason = 'No inputs connected';
            analysis.table = [];
            circuitState._setAnalysis(analysis);
            await panel._handleValidityChanged({ canSimulate: false, reason: analysis.reason });
        }
    }
};

/**
 * Check if an action is applicable to a circuit type
 * @param {string} actionKey - Action key from ACTIONS
 * @param {string} circuitType - Circuit type key from CIRCUIT_TYPES
 * @returns {boolean} True if action can be applied
 */
export function isActionApplicable(actionKey, circuitType) {
    const action = ACTIONS[actionKey];
    if (!action) return false;
    return action.applicableTo.includes(circuitType);
}

/**
 * Get all action keys
 */
export function getActionKeys() {
    return Object.keys(ACTIONS);
}
