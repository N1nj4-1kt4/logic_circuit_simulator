/**
 * Situation sequence functions for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 *
 * Each situation represents a sequence of user interactions
 * that tests different aspects of state preservation.
 */

/**
 * Capture the current state of the panel for comparison
 * @param {TruthTablePanel} panel - The panel instance
 * @param {Object} mockDOM - Mock DOM elements
 * @returns {Object} Captured state
 */
export function captureState(panel, mockDOM) {
    return {
        position: {
            x: panel.state?.x,
            y: panel.state?.y
        },
        size: {
            width: panel.state?.width,
            height: panel.state?.height
        },
        columnOrder: panel.columnOrder ? [...panel.columnOrder] : null,
        rowHeight: panel.state?.rowHeight,
        visible: panel.state?.visible,
        interactionsSetup: panel.interactionsSetup,
        // DOM state
        domWidth: mockDOM?.panelEl?.style?.width,
        domHeight: mockDOM?.panelEl?.style?.height,
        domTransform: mockDOM?.panelEl?.style?.transform
    };
}

/**
 * All possible situations (sequences of user interactions)
 */
export const SITUATIONS = {
    HIDE_THEN_SHOW: {
        name: 'S1: Hide → Show',
        description: 'Tests state restoration after simple toggle',
        sequence: async (panel, action, circuitState, analysis, mockDOM, recreatePanel) => {
            // Initial state: panel visible
            await panel.show();

            // Capture state after initial show
            const stateBefore = captureState(panel, mockDOM);

            // Hide
            await panel.hide();

            // Show again
            await panel.show();

            return {
                stateBefore,
                stateAfter: captureState(panel, mockDOM),
                panel
            };
        }
    },

    HIDE_ACTION_SHOW: {
        name: 'S2: Hide → Action → Show',
        description: 'Tests state restoration after hidden modification',
        sequence: async (panel, action, circuitState, analysis, mockDOM, recreatePanel) => {
            // Initial state: panel visible
            await panel.show();

            // Capture state before hide
            const stateBefore = captureState(panel, mockDOM);

            // Hide
            await panel.hide();

            // Perform action while hidden
            await action.execute(panel, circuitState, analysis, mockDOM);

            // Show again
            await panel.show();

            return {
                stateBefore,
                stateAfter: captureState(panel, mockDOM),
                panel
            };
        }
    },

    ACTION_REFRESH: {
        name: 'S3: Action → Refresh',
        description: 'Tests persistence across page reload',
        sequence: async (panel, action, circuitState, analysis, mockDOM, recreatePanel) => {
            // Initial state: panel visible
            await panel.show();

            // Perform action while visible
            await action.execute(panel, circuitState, analysis, mockDOM);

            // Capture state after action
            const stateBefore = captureState(panel, mockDOM);

            // Simulate page refresh: get saved state
            const savedState = panel.getState();

            // Destroy current panel
            panel.destroy();

            // Recreate panel with saved state (simulates page refresh)
            const newPanel = recreatePanel(savedState);
            await newPanel.show();

            return {
                stateBefore,
                stateAfter: captureState(newPanel, mockDOM),
                panel: newPanel,
                savedState
            };
        }
    },

    ACTION_HIDE_SHOW: {
        name: 'S4: Action → Hide → Show',
        description: 'Tests state preservation after visible action then toggle',
        sequence: async (panel, action, circuitState, analysis, mockDOM, recreatePanel) => {
            // Initial state: panel visible
            await panel.show();

            // Perform action while visible
            await action.execute(panel, circuitState, analysis, mockDOM);

            // Capture state after action
            const stateBefore = captureState(panel, mockDOM);

            // Hide then show
            await panel.hide();
            await panel.show();

            return {
                stateBefore,
                stateAfter: captureState(panel, mockDOM),
                panel
            };
        }
    }
};

/**
 * Get all situation keys
 */
export function getSituationKeys() {
    return Object.keys(SITUATIONS);
}

/**
 * Compare two captured states for equality (with tolerance for expected changes)
 * @param {Object} before - State before action
 * @param {Object} after - State after action
 * @param {Object} options - Comparison options
 * @returns {Object} Comparison result with differences
 */
export function compareStates(before, after, options = {}) {
    const {
        expectPositionChange = false,
        expectSizeChange = false,
        expectColumnOrderChange = false,
        expectSizeReset = false
    } = options;

    const differences = [];

    // Compare position
    if (!expectPositionChange) {
        if (before.position.x !== after.position.x) {
            differences.push({
                field: 'position.x',
                before: before.position.x,
                after: after.position.x
            });
        }
        if (before.position.y !== after.position.y) {
            differences.push({
                field: 'position.y',
                before: before.position.y,
                after: after.position.y
            });
        }
    }

    // Compare size
    if (!expectSizeChange && !expectSizeReset) {
        if (before.size.width !== after.size.width) {
            differences.push({
                field: 'size.width',
                before: before.size.width,
                after: after.size.width
            });
        }
        if (before.size.height !== after.size.height) {
            differences.push({
                field: 'size.height',
                before: before.size.height,
                after: after.size.height
            });
        }
    }

    // Compare column order
    if (!expectColumnOrderChange && before.columnOrder && after.columnOrder) {
        const orderMatch = JSON.stringify(before.columnOrder) === JSON.stringify(after.columnOrder);
        if (!orderMatch) {
            differences.push({
                field: 'columnOrder',
                before: before.columnOrder,
                after: after.columnOrder
            });
        }
    }

    return {
        equal: differences.length === 0,
        differences
    };
}
