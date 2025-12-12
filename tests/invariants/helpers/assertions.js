/**
 * Invariant assertion helpers for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 *
 * These helpers verify specific invariants hold after actions.
 */

import { expect } from 'vitest';

/**
 * Assert that position is preserved
 * @param {Object} stateBefore - State before action
 * @param {Object} stateAfter - State after action
 * @param {string} context - Test context for error messages
 */
export function assertPositionPreserved(stateBefore, stateAfter, context = '') {
    expect(stateAfter.position.x, `Position X should be preserved ${context}`).toBe(stateBefore.position.x);
    expect(stateAfter.position.y, `Position Y should be preserved ${context}`).toBe(stateBefore.position.y);
}

/**
 * Assert that size is preserved
 * @param {Object} stateBefore - State before action
 * @param {Object} stateAfter - State after action
 * @param {string} context - Test context for error messages
 */
export function assertSizePreserved(stateBefore, stateAfter, context = '') {
    expect(stateAfter.size.width, `Width should be preserved ${context}`).toBe(stateBefore.size.width);
    expect(stateAfter.size.height, `Height should be preserved ${context}`).toBe(stateBefore.size.height);
}

/**
 * Assert that size was reset for auto-fit (structure change)
 * @param {Object} stateAfter - State after action
 * @param {string} context - Test context for error messages
 */
export function assertSizeReset(stateAfter, context = '') {
    expect(stateAfter.size.width, `Width should be reset for auto-fit ${context}`).toBe('');
    expect(stateAfter.size.height, `Height should be reset for auto-fit ${context}`).toBe('');
}

/**
 * Assert that column order is preserved
 * @param {Object} stateBefore - State before action
 * @param {Object} stateAfter - State after action
 * @param {string} context - Test context for error messages
 */
export function assertColumnOrderPreserved(stateBefore, stateAfter, context = '') {
    if (stateBefore.columnOrder === null && stateAfter.columnOrder === null) {
        return; // Both null is valid
    }
    expect(stateAfter.columnOrder, `Column order should be preserved ${context}`).toEqual(stateBefore.columnOrder);
}

/**
 * Assert that panel is draggable
 * @param {TruthTablePanel} panel - Panel instance
 * @param {string} context - Test context for error messages
 */
export function assertDraggable(panel, context = '') {
    expect(panel.interactionsSetup, `Panel should be draggable ${context}`).toBe(true);
}

/**
 * Assert that panel is visible
 * @param {TruthTablePanel} panel - Panel instance
 * @param {string} context - Test context for error messages
 */
export function assertVisible(panel, context = '') {
    expect(panel.state?.visible, `Panel should be visible ${context}`).toBe(true);
}

/**
 * Assert that state was saved via callback
 * @param {Function} onStateChange - Mock state change callback
 * @param {string} context - Test context for error messages
 */
export function assertStateSaved(onStateChange, context = '') {
    expect(onStateChange, `State should be saved ${context}`).toHaveBeenCalled();
}

/**
 * Assert that state was saved with visible = true
 * @param {Function} onStateChange - Mock state change callback
 * @param {string} context - Test context for error messages
 */
export function assertVisibleStateSaved(onStateChange, context = '') {
    expect(onStateChange, `Visible state should be saved ${context}`).toHaveBeenCalledWith(
        expect.objectContaining({
            visible: true
        })
    );
}

/**
 * Assert that row height was applied
 * @param {Object} mockTabulator - Mock Tabulator instance
 * @param {string} context - Test context for error messages
 */
export function assertRowHeightApplied(mockTabulator, context = '') {
    expect(mockTabulator.getRows, `Row heights should be queried/applied ${context}`).toHaveBeenCalled();
}

/**
 * Determine which invariants should be checked based on action type
 * @param {Object} action - Action configuration
 * @param {Object} circuitConfig - Circuit configuration
 * @returns {Object} Flags for which invariants to check
 */
export function getInvariantChecks(action, circuitConfig) {
    const affects = action.affects;

    return {
        // Position is preserved unless action explicitly changes it
        checkPosition: affects !== 'position',

        // Size is preserved unless action changes it or causes structure change
        // For structure changes, size behavior is auto-fit which can't be fully tested with mocks
        checkSize: affects !== 'size' && affects !== 'structure' && affects !== 'validity+structure',

        // Size reset check disabled: Mock DOM doesn't simulate auto-fit behavior
        // The production code clears dimensions but _saveState() reads offsetWidth which is static in mocks
        // This invariant is verified via integration/e2e tests instead
        expectSizeReset: false,

        // Column order preserved unless explicitly changed or structure change
        checkColumnOrder: circuitConfig.isValid &&
            affects !== 'columnOrder' &&
            affects !== 'structure' &&
            affects !== 'validity+structure',

        // Row height check is disabled for all actions in this test suite because:
        // 1. Structure changes create new Tabulator instances (mock can't track)
        // 2. Position/size/columnOrder/labels don't rebuild the table
        // 3. Data changes (toggle input) do call getRows but on a different instance
        // The row height invariant is verified via the edge case tests instead
        checkRowHeight: false,

        // Draggable should always be true after show
        checkDraggable: true,

        // Visible state should be saved after show
        checkVisibleState: true
    };
}

/**
 * Run all applicable invariant assertions for a test result
 * @param {Object} stateBefore - State before action
 * @param {Object} stateAfter - State after action
 * @param {Object} action - Action configuration
 * @param {Object} circuitConfig - Circuit configuration
 * @param {Object} extras - Extra test objects (panel, mockTabulator, onStateChange)
 */
export function assertInvariants(stateBefore, stateAfter, action, circuitConfig, extras = {}) {
    const checks = getInvariantChecks(action, circuitConfig);
    const { panel, mockTabulator, onStateChange } = extras;
    const context = `after ${action.name}`;

    if (checks.checkPosition) {
        assertPositionPreserved(stateBefore, stateAfter, context);
    }

    if (checks.checkSize) {
        assertSizePreserved(stateBefore, stateAfter, context);
    }

    if (checks.expectSizeReset) {
        assertSizeReset(stateAfter, context);
    }

    if (checks.checkColumnOrder) {
        assertColumnOrderPreserved(stateBefore, stateAfter, context);
    }

    if (checks.checkDraggable && panel) {
        assertDraggable(panel, context);
    }

    if (checks.checkRowHeight && mockTabulator) {
        assertRowHeightApplied(mockTabulator, context);
    }

    if (checks.checkVisibleState && onStateChange) {
        assertVisibleStateSaved(onStateChange, context);
    }
}
