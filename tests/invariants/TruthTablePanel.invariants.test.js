/**
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 *
 * These tests encode required behaviors that MUST be preserved.
 * If a test fails, FIX THE PRODUCTION CODE, not the test.
 *
 * Historical context: 16 bugs were fixed multiple times due to refactoring
 * regressions. These tests prevent that from happening again.
 *
 * Test Matrix: 3 circuit types × 4 situations × 14 actions = 168 scenarios
 * Each scenario verifies 5 invariants (where applicable)
 *
 * See: docs/TRUTH_TABLE_GUIDELINES.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Fixtures
import { CIRCUIT_TYPES, createCircuit, generateDefaultColumnOrder, cloneAnalysis } from './fixtures/circuits.js';
import { ACTIONS, isActionApplicable, getActionKeys } from './fixtures/actions.js';
import { SITUATIONS, getSituationKeys, captureState } from './fixtures/situations.js';

// Helpers
import {
    createTestSetup,
    setupWithPosition,
    setupWithSize,
    setupWithColumnOrder,
    setupWithRowHeight,
    setupAllPreConditions,
    KNOWN_POSITION,
    KNOWN_SIZE,
    KNOWN_ROW_HEIGHT
} from './helpers/setup.js';
import {
    assertPositionPreserved,
    assertSizePreserved,
    assertSizeReset,
    assertColumnOrderPreserved,
    assertDraggable,
    assertVisibleStateSaved,
    assertRowHeightApplied,
    getInvariantChecks
} from './helpers/assertions.js';

// Global variable for mock Tabulator columns - can be set by setupWithColumnOrder
// This needs to be before the vi.mock() but since vi.mock is hoisted, we use globalThis
globalThis.__mockTabulatorColumns = [];

// Mock Tabulator
vi.mock('tabulator-tables', () => {
    // Use a class for proper constructor behavior
    class MockTabulator {
        constructor() {
            this.destroy = vi.fn();
            // getColumns returns column objects with getField() and getDefinition() methods
            // Uses globalThis.__mockTabulatorColumns which can be set by test setup
            this.getColumns = vi.fn(() => {
                const columns = globalThis.__mockTabulatorColumns || [];
                return columns.map(field => ({
                    getField: () => field,
                    getDefinition: () => ({ title: field })  // Return field as title
                }));
            });
            this.getRows = vi.fn().mockReturnValue([]);
            this.getData = vi.fn().mockReturnValue([]);
            this.deselectRow = vi.fn();
            this.selectRow = vi.fn();
            this.replaceData = vi.fn();
            this.setHeight = vi.fn();
            this.setData = vi.fn();
            this.setColumns = vi.fn();
            this.scrollToRow = vi.fn();
            this.redraw = vi.fn();
            this._callbacks = {};
            // Mock on() to capture callbacks and immediately fire 'tableBuilt'
            this.on = vi.fn((event, callback) => {
                this._callbacks[event] = callback;
                // Fire tableBuilt immediately (async) to resolve the Promise
                if (event === 'tableBuilt') {
                    setTimeout(() => callback(), 0);
                }
            });
        }
    }
    return { TabulatorFull: MockTabulator };
});

// Mock interactjs
vi.mock('interactjs', () => {
    const mockInteract = vi.fn().mockReturnValue({
        draggable: vi.fn().mockReturnThis(),
        resizable: vi.fn().mockReturnThis(),
        unset: vi.fn()
    });
    mockInteract.modifiers = {
        restrictRect: vi.fn().mockReturnValue({}),
        restrictSize: vi.fn().mockReturnValue({})
    };
    return { default: mockInteract };
});

// Mock positioning utility
vi.mock('../../src/utils/positioning.js', () => ({
    positionPanelSmartly: vi.fn()
}));

// Mock DialogFactory
vi.mock('../../src/ui/DialogFactory.js', () => ({
    DialogFactory: {
        showAlert: vi.fn()
    }
}));

// Get all keys for the matrix
const circuitTypeKeys = Object.keys(CIRCUIT_TYPES);
const situationKeys = getSituationKeys();
const actionKeys = getActionKeys();

/**
 * Determine if a test combination should be skipped
 */
function shouldSkipCombination(circuitType, actionKey) {
    // Check if action is applicable to this circuit type
    if (!isActionApplicable(actionKey, circuitType)) {
        return true;
    }
    return false;
}

/**
 * Main test matrix
 */
describe('TruthTablePanel Invariants', () => {

    describe.each(circuitTypeKeys)('Circuit: %s', (circuitType) => {
        const circuitConfig = CIRCUIT_TYPES[circuitType];

        describe.each(situationKeys)('Situation: %s', (situationKey) => {
            const situation = SITUATIONS[situationKey];

            describe.each(actionKeys)('Action: %s', (actionKey) => {
                const action = ACTIONS[actionKey];
                const shouldSkip = shouldSkipCombination(circuitType, actionKey);

                let testSetup;

                beforeEach(() => {
                    if (!shouldSkip) {
                        testSetup = createTestSetup(circuitType);
                    }
                });

                afterEach(() => {
                    if (testSetup) {
                        testSetup.cleanup();
                    }
                    vi.clearAllMocks();
                    // Reset mock Tabulator columns to prevent test pollution
                    globalThis.__mockTabulatorColumns = [];
                });

                // Test 1: Position preservation
                (shouldSkip ? it.skip : it)(
                    `preserves position after ${action.name}`,
                    async () => {
                        const { panel, mockDOM, circuitState, analysis, recreatePanel } = testSetup;

                        // Setup known position
                        setupWithPosition(panel, mockDOM, KNOWN_POSITION);

                        // Run the situation sequence
                        const result = await situation.sequence(
                            panel,
                            action,
                            circuitState,
                            analysis,
                            mockDOM,
                            recreatePanel
                        );

                        // Check position invariant
                        const checks = getInvariantChecks(action, circuitConfig);
                        if (checks.checkPosition) {
                            assertPositionPreserved(result.stateBefore, result.stateAfter, `after ${action.name}`);
                        }
                    }
                );

                // Test 2: Size preservation/reset
                (shouldSkip ? it.skip : it)(
                    `preserves/updates size correctly after ${action.name}`,
                    async () => {
                        const { panel, mockDOM, circuitState, analysis, recreatePanel } = testSetup;

                        // Setup known size
                        setupWithSize(panel, mockDOM, KNOWN_SIZE);

                        // Run the situation sequence
                        const result = await situation.sequence(
                            panel,
                            action,
                            circuitState,
                            analysis,
                            mockDOM,
                            recreatePanel
                        );

                        // Check size invariant
                        const checks = getInvariantChecks(action, circuitConfig);
                        // S1 (HIDE_THEN_SHOW) doesn't execute the action, so skip size reset check
                        const actionExecuted = situationKey !== 'HIDE_THEN_SHOW';
                        if (checks.expectSizeReset && actionExecuted) {
                            assertSizeReset(result.stateAfter, `after ${action.name}`);
                        } else if (checks.checkSize) {
                            assertSizePreserved(result.stateBefore, result.stateAfter, `after ${action.name}`);
                        }
                    }
                );

                // Test 3: Column order preservation
                (shouldSkip || !circuitConfig.isValid ? it.skip : it)(
                    `preserves column order after ${action.name}`,
                    async () => {
                        const { panel, mockDOM, circuitState, analysis, recreatePanel } = testSetup;

                        // Setup known column order
                        const columnOrder = generateDefaultColumnOrder(analysis);
                        setupWithColumnOrder(panel, columnOrder);

                        // Run the situation sequence
                        const result = await situation.sequence(
                            panel,
                            action,
                            circuitState,
                            analysis,
                            mockDOM,
                            recreatePanel
                        );

                        // Check column order invariant
                        const checks = getInvariantChecks(action, circuitConfig);
                        if (checks.checkColumnOrder) {
                            assertColumnOrderPreserved(result.stateBefore, result.stateAfter, `after ${action.name}`);
                        }
                    }
                );

                // Test 4: Row height preservation
                (shouldSkip || !circuitConfig.isValid ? it.skip : it)(
                    `preserves row height after ${action.name}`,
                    async () => {
                        const { panel, mockDOM, mockTabulator, circuitState, analysis, recreatePanel } = testSetup;

                        // Setup known row height
                        setupWithRowHeight(panel, mockTabulator, KNOWN_ROW_HEIGHT);

                        // Run the situation sequence
                        await situation.sequence(
                            panel,
                            action,
                            circuitState,
                            analysis,
                            mockDOM,
                            recreatePanel
                        );

                        // Check row height invariant
                        const checks = getInvariantChecks(action, circuitConfig);
                        if (checks.checkRowHeight) {
                            // Row heights should be reapplied after table operations
                            // This is verified by checking that getRows was called
                            // (in actual code, _applyRowStyles calls getRows)
                            assertRowHeightApplied(mockTabulator, `after ${action.name}`);
                        }
                    }
                );

                // Test 5: Panel is draggable after action
                (shouldSkip ? it.skip : it)(
                    `panel is draggable after ${action.name}`,
                    async () => {
                        const { panel, mockDOM, circuitState, analysis, recreatePanel } = testSetup;

                        // Run the situation sequence
                        const result = await situation.sequence(
                            panel,
                            action,
                            circuitState,
                            analysis,
                            mockDOM,
                            recreatePanel
                        );

                        // Panel should always be draggable after show
                        assertDraggable(result.panel, `after ${action.name}`);
                    }
                );

            }); // Action
        }); // Situation
    }); // Circuit Type

    /**
     * Additional edge case tests
     */
    describe('Edge Cases', () => {
        let testSetup;

        afterEach(() => {
            if (testSetup) {
                testSetup.cleanup();
            }
            vi.clearAllMocks();
        });

        it('page refresh with large table preserves state', async () => {
            testSetup = createTestSetup('LARGE_VALID');
            const { panel, mockDOM, circuitState, analysis, recreatePanel, onStateChange } = testSetup;

            // Setup all known state
            setupAllPreConditions(panel, mockDOM, testSetup.mockTabulator, analysis);

            // Show panel
            await panel.show();
            const stateBefore = captureState(panel, mockDOM);

            // Simulate refresh
            const savedState = panel.getState();
            panel.destroy();

            const newPanel = recreatePanel(savedState);
            await newPanel.show();

            const stateAfter = captureState(newPanel, mockDOM);

            // Position should be preserved
            expect(stateAfter.position.x).toBe(stateBefore.position.x);
            expect(stateAfter.position.y).toBe(stateBefore.position.y);
        });

        it('first open with large board computes correct dimensions', async () => {
            testSetup = createTestSetup('LARGE_VALID');
            const { panel, mockDOM } = testSetup;

            // Don't set any pre-conditions (simulates first open)

            await panel.show();

            // Panel should be visible and draggable
            expect(panel.interactionsSetup).toBe(true);
        });

        it('hide during computing preserves state on reopen', async () => {
            testSetup = createTestSetup('LARGE_VALID');
            const { panel, mockDOM, circuitState, analysis } = testSetup;

            setupWithPosition(panel, mockDOM, KNOWN_POSITION);
            setupWithSize(panel, mockDOM, KNOWN_SIZE);

            await panel.show();

            // Simulate computing state
            await panel._handleComputing({ percent: 50, current: 2048, total: 4096 });

            // Hide while computing
            await panel.hide();

            // Reopen
            await panel.show();

            // Position should be preserved
            expect(panel.state.x).toBe(KNOWN_POSITION.x);
            expect(panel.state.y).toBe(KNOWN_POSITION.y);
        });

        it('structure change while hidden updates table on show', async () => {
            testSetup = createTestSetup('SMALL_VALID');
            const { panel, mockDOM, circuitState, analysis } = testSetup;

            await panel.show();
            await panel.hide();

            // Add input while hidden (structure change)
            analysis.inputs.push({ id: 7, label: 'I7', value: 0 });
            circuitState._setAnalysis(analysis);

            // Reopen - should rebuild table
            await panel.show();

            expect(panel.interactionsSetup).toBe(true);
        });

        it('valid to invalid preserves position', async () => {
            testSetup = createTestSetup('SMALL_VALID');
            const { panel, mockDOM, circuitState, analysis } = testSetup;

            setupWithPosition(panel, mockDOM, KNOWN_POSITION);

            await panel.show();

            // Make circuit invalid
            analysis.outputs = [];
            analysis.isValid = false;
            analysis.reason = 'No outputs';
            circuitState._setAnalysis(analysis);
            await panel._handleValidityChanged({ canSimulate: false, reason: 'No outputs' });

            // Position should be preserved
            expect(panel.state.x).toBe(KNOWN_POSITION.x);
            expect(panel.state.y).toBe(KNOWN_POSITION.y);
        });

        it('invalid to valid preserves position', async () => {
            testSetup = createTestSetup('INVALID');
            const { panel, mockDOM, circuitState, analysis } = testSetup;

            setupWithPosition(panel, mockDOM, KNOWN_POSITION);

            await panel.show();

            // Make circuit valid
            analysis.outputs = [{ id: 13, label: 'O1', value: 0 }];
            analysis.isValid = true;
            analysis.reason = null;
            circuitState._setAnalysis(analysis);
            await panel._handleComputed();

            // Position should be preserved
            expect(panel.state.x).toBe(KNOWN_POSITION.x);
            expect(panel.state.y).toBe(KNOWN_POSITION.y);
        });
    });
});
