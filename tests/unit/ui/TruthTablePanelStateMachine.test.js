/**
 * Unit tests for TruthTablePanelStateMachine
 */

import { describe, it, expect, vi } from 'vitest';
import {
    TruthTablePanelStateMachine,
    RenderQueue,
    PANEL_STATES,
    DATA_STATES,
    ACTION_TYPES
} from '../../../src/ui/TruthTablePanelStateMachine.js';

// Create a mock panel with circuitState
const createMockPanel = (analysis = null) => ({
    circuitState: {
        getCircuitAnalysis: vi.fn().mockReturnValue(analysis)
    }
});

// Create valid analysis
const createValidAnalysis = (numInputs = 2, numOutputs = 1) => ({
    inputs: Array.from({ length: numInputs }, (_, i) => ({ id: i + 1, label: `I${i + 1}`, value: 0 })),
    outputs: Array.from({ length: numOutputs }, (_, i) => ({ id: numInputs + i + 1, label: `O${i + 1}`, value: 0 })),
    table: Array.from({ length: Math.pow(2, numInputs) }, () => ({})),
    isValid: true
});

// Create invalid analysis
const createInvalidAnalysis = (reason = 'Circuit incomplete') => ({
    inputs: [],
    outputs: [],
    table: [],
    isValid: false,
    reason
});

// ============================================================================
// RenderQueue Tests
// ============================================================================

describe('RenderQueue', () => {
    describe('enqueue()', () => {
        it('should execute render function immediately when queue is empty', async () => {
            const queue = new RenderQueue();
            const renderFn = vi.fn().mockResolvedValue();

            await queue.enqueue(renderFn);

            expect(renderFn).toHaveBeenCalledTimes(1);
        });

        it('should serialize concurrent render requests', async () => {
            const queue = new RenderQueue();
            const executionOrder = [];

            const render1 = vi.fn(async () => {
                executionOrder.push('start1');
                await new Promise(resolve => setTimeout(resolve, 10));
                executionOrder.push('end1');
            });

            const render2 = vi.fn(async () => {
                executionOrder.push('start2');
                await new Promise(resolve => setTimeout(resolve, 5));
                executionOrder.push('end2');
            });

            // Start both renders concurrently
            const promise1 = queue.enqueue(render1);
            const promise2 = queue.enqueue(render2);

            await Promise.all([promise1, promise2]);

            // render1 should complete before render2 starts
            expect(executionOrder).toEqual(['start1', 'end1', 'start2', 'end2']);
        });

        it('should collapse multiple pending requests into one', async () => {
            const queue = new RenderQueue();
            const executionOrder = [];

            const render1 = vi.fn(async () => {
                executionOrder.push('render1');
                await new Promise(resolve => setTimeout(resolve, 20));
            });

            const render2 = vi.fn(async () => {
                executionOrder.push('render2');
            });

            const render3 = vi.fn(async () => {
                executionOrder.push('render3');
            });

            // Start first render
            const promise1 = queue.enqueue(render1);

            // Queue two more while first is running - only the last should execute
            const promise2 = queue.enqueue(render2);
            const promise3 = queue.enqueue(render3);

            await Promise.all([promise1, promise2, promise3]);

            // render1 executes, then render3 (render2 is collapsed)
            expect(executionOrder).toEqual(['render1', 'render3']);
            expect(render2).not.toHaveBeenCalled();
        });

        it('should handle render function errors gracefully', async () => {
            const queue = new RenderQueue();
            const error = new Error('Render failed');

            const failingRender = vi.fn().mockRejectedValue(error);
            const successRender = vi.fn().mockResolvedValue();

            // First render fails
            await queue.enqueue(failingRender).catch(() => {});

            // Queue should still work for next render
            await queue.enqueue(successRender);

            expect(successRender).toHaveBeenCalled();
        });
    });

    describe('isRendering()', () => {
        it('should return false when no render is in progress', () => {
            const queue = new RenderQueue();
            expect(queue.isRendering()).toBe(false);
        });

        it('should return true when render is in progress', async () => {
            const queue = new RenderQueue();

            const renderFn = async () => {
                // Wait until the test has checked isRendering()
                await new Promise(resolve => setTimeout(resolve, 20));
            };

            const promise = queue.enqueue(renderFn);

            // Small delay to ensure _execute has started
            await new Promise(resolve => setTimeout(resolve, 5));

            // Check during render - this should be true
            expect(queue.isRendering()).toBe(true);

            await promise;

            // Check after render
            expect(queue.isRendering()).toBe(false);
        });
    });

    describe('hasPending()', () => {
        it('should return false when no pending render', () => {
            const queue = new RenderQueue();
            expect(queue.hasPending()).toBe(false);
        });

        it('should return true when there is a pending render', async () => {
            const queue = new RenderQueue();
            let hasPendingDuringRender = false;

            const render1 = async () => {
                await new Promise(resolve => setTimeout(resolve, 20));
                hasPendingDuringRender = queue.hasPending();
            };

            const render2 = vi.fn().mockResolvedValue();

            const promise1 = queue.enqueue(render1);
            queue.enqueue(render2);

            await promise1;

            expect(hasPendingDuringRender).toBe(true);
        });
    });
});

// ============================================================================
// TruthTablePanelStateMachine Tests
// ============================================================================

describe('TruthTablePanelStateMachine', () => {
    describe('Initial State', () => {
        it('should initialize with HIDDEN panel state', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const state = sm.getState();
            expect(state.panel).toBe(PANEL_STATES.HIDDEN);
        });

        it('should initialize with FRESH data state', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const state = sm.getState();
            expect(state.data).toBe(DATA_STATES.FRESH);
        });

        it('should initialize with null lastCycleIndex', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const state = sm.getState();
            expect(state.lastCycleIndex).toBeNull();
        });

        it('should initialize with renderInProgress false', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const state = sm.getState();
            expect(state.renderInProgress).toBe(false);
        });
    });

    describe('getState()', () => {
        it('should return a copy of the state', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const state1 = sm.getState();
            const state2 = sm.getState();

            expect(state1).not.toBe(state2);
            expect(state1).toEqual(state2);
        });
    });

    describe('isVisible()', () => {
        it('should return false when panel is HIDDEN', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            expect(sm.isVisible()).toBe(false);
        });

        it('should return true for all visible states', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const visibleStates = [
                PANEL_STATES.SHOWING_COMPUTING,
                PANEL_STATES.SHOWING_INVALID,
                PANEL_STATES.SHOWING_TABLE,
                PANEL_STATES.VISIBLE_COMPUTING,
                PANEL_STATES.VISIBLE_TABLE,
                PANEL_STATES.VISIBLE_INVALID
            ];

            for (const state of visibleStates) {
                sm.setPanelState(state);
                expect(sm.isVisible()).toBe(true);
            }
        });
    });

    describe('handleShow()', () => {
        it('should return SHOW_COMPUTING when analysis is null', () => {
            const mockPanel = createMockPanel(null);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleShow();

            expect(action.action).toBe(ACTION_TYPES.SHOW_COMPUTING);
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_COMPUTING);
            expect(sm.getState().data).toBe(DATA_STATES.COMPUTING);
        });

        it('should return SHOW_INVALID when analysis is invalid', () => {
            const invalidAnalysis = createInvalidAnalysis('Missing connection');
            const mockPanel = createMockPanel(invalidAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleShow();

            expect(action.action).toBe(ACTION_TYPES.SHOW_INVALID);
            expect(action.reason).toBe('Missing connection');
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_INVALID);
        });

        it('should return RENDER_TABLE when analysis is valid', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleShow();

            expect(action.action).toBe(ACTION_TYPES.RENDER_TABLE);
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
            expect(sm.getState().data).toBe(DATA_STATES.FRESH);
        });

        it('should return SYNC when already visible and data is STALE', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // First show to make visible
            sm.handleShow();
            sm.renderCompleted();

            // Mark as stale and call show again
            sm.setDataState(DATA_STATES.STALE);
            const action = sm.handleShow();

            expect(action.action).toBe(ACTION_TYPES.SYNC);
            expect(sm.getState().data).toBe(DATA_STATES.FRESH);
        });

        it('should return NONE when already visible and data is FRESH', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // First show to make visible
            sm.handleShow();
            sm.renderCompleted();

            // Call show again when data is fresh
            const action = sm.handleShow();

            expect(action.action).toBe(ACTION_TYPES.NONE);
        });
    });

    describe('handleHide()', () => {
        it('should transition to HIDDEN state', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // First show
            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleHide();

            expect(action.action).toBe(ACTION_TYPES.HIDE);
            expect(sm.getState().panel).toBe(PANEL_STATES.HIDDEN);
        });

        it('should preserve lastCycleIndex when hiding', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Show and set cycle index
            sm.handleShow();
            sm.renderCompleted();
            sm.handleStepCompleted({ cycleIndex: 5 });

            // Hide
            sm.handleHide();

            expect(sm.getState().lastCycleIndex).toBe(5);
        });

        it('should preserve data state when hiding', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.setDataState(DATA_STATES.COMPUTING);

            sm.handleHide();

            expect(sm.getState().data).toBe(DATA_STATES.COMPUTING);
        });
    });

    describe('handleValidityChanged()', () => {
        it('should mark data STALE when hidden', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleValidityChanged({ canSimulate: false, reason: 'Test' });

            expect(action.action).toBe(ACTION_TYPES.NONE);
            expect(sm.getState().data).toBe(DATA_STATES.STALE);
        });

        it('should return SHOW_INVALID when visible and circuit becomes invalid', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Show first
            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleValidityChanged({ canSimulate: false, reason: 'Connection removed' });

            expect(action.action).toBe(ACTION_TYPES.SHOW_INVALID);
            expect(action.reason).toBe('Connection removed');
            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_INVALID);
        });

        it('should return NONE when visible and circuit is valid', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleValidityChanged({ canSimulate: true });

            expect(action.action).toBe(ACTION_TYPES.NONE);
        });
    });

    describe('handleComputing()', () => {
        it('should mark data as COMPUTING', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleComputing({ percent: 50, current: 50, total: 100 });

            expect(sm.getState().data).toBe(DATA_STATES.COMPUTING);
        });

        it('should return NONE when hidden', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleComputing({ percent: 50, current: 50, total: 100 });

            expect(action.action).toBe(ACTION_TYPES.NONE);
        });

        it('should return SHOW_PROGRESS when visible', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleComputing({ percent: 75, current: 150, total: 200 });

            expect(action.action).toBe(ACTION_TYPES.SHOW_PROGRESS);
            expect(action.percent).toBe(75);
            expect(action.current).toBe(150);
            expect(action.total).toBe(200);
        });

        it('should transition VISIBLE_TABLE to VISIBLE_COMPUTING', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_TABLE);

            sm.handleComputing({ percent: 10, current: 10, total: 100 });

            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_COMPUTING);
        });
    });

    describe('handleComputed()', () => {
        it('should mark data as STALE when hidden', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleComputed(createValidAnalysis(), null);

            expect(action.action).toBe(ACTION_TYPES.NONE);
            expect(sm.getState().data).toBe(DATA_STATES.STALE);
        });

        it('should return RENDER_TABLE when transitioning from SHOWING_COMPUTING', () => {
            const mockPanel = createMockPanel(null);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Start in showing_computing state
            sm.handleShow();
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_COMPUTING);

            // Now circuit analysis is ready - update mock
            mockPanel.circuitState.getCircuitAnalysis.mockReturnValue(createValidAnalysis());

            const action = sm.handleComputed(createValidAnalysis(), null);

            expect(action.action).toBe(ACTION_TYPES.RENDER_TABLE);
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
        });

        it('should return RENDER_TABLE when transitioning from VISIBLE_INVALID', () => {
            const invalidAnalysis = createInvalidAnalysis();
            const mockPanel = createMockPanel(invalidAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_INVALID);

            const validAnalysis = createValidAnalysis();
            const action = sm.handleComputed(validAnalysis, invalidAnalysis);

            expect(action.action).toBe(ACTION_TYPES.RENDER_TABLE);
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
        });

        it('should return REBUILD_TABLE when structure changes', () => {
            const validAnalysis = createValidAnalysis(2, 1);
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            // Structure changed - 3 inputs now instead of 2
            const newAnalysis = createValidAnalysis(3, 1);
            const action = sm.handleComputed(newAnalysis, validAnalysis);

            expect(action.action).toBe(ACTION_TYPES.REBUILD_TABLE);
            expect(sm.getState().lastCycleIndex).toBeNull();
        });

        it('should return UPDATE_HEADERS when labels change', () => {
            const oldAnalysis = {
                inputs: [{ label: 'OldLabel', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{}, {}],
                isValid: true
            };
            const newAnalysis = {
                inputs: [{ label: 'NewLabel', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{}, {}],
                isValid: true
            };

            const mockPanel = createMockPanel(oldAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleComputed(newAnalysis, oldAnalysis);

            expect(action.action).toBe(ACTION_TYPES.UPDATE_HEADERS);
            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_TABLE);
        });

        it('should return UPDATE_DATA when only data changes', () => {
            const oldAnalysis = {
                inputs: [{ label: 'A', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{ input0: 0, output0: 0 }],
                isValid: true
            };
            const newAnalysis = {
                inputs: [{ label: 'A', value: 1 }],  // Value changed
                outputs: [{ label: 'Q', value: 1 }],
                table: [{ input0: 0, output0: 1 }],  // Output changed
                isValid: true
            };

            const mockPanel = createMockPanel(oldAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleComputed(newAnalysis, oldAnalysis);

            expect(action.action).toBe(ACTION_TYPES.UPDATE_DATA);
        });

        it('should clear lastCycleIndex on structure change', () => {
            const oldAnalysis = createValidAnalysis(2, 1);
            const mockPanel = createMockPanel(oldAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleStepCompleted({ cycleIndex: 3 });
            expect(sm.getState().lastCycleIndex).toBe(3);

            // Structure change
            const newAnalysis = createValidAnalysis(3, 1);
            sm.handleComputed(newAnalysis, oldAnalysis);

            expect(sm.getState().lastCycleIndex).toBeNull();
        });
    });

    describe('handleStepCompleted()', () => {
        it('should track lastCycleIndex when hidden', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            const action = sm.handleStepCompleted({ cycleIndex: 7 });

            expect(action.action).toBe(ACTION_TYPES.NONE);
            expect(sm.getState().lastCycleIndex).toBe(7);
        });

        it('should return HIGHLIGHT_ROW when VISIBLE_TABLE', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();

            const action = sm.handleStepCompleted({ cycleIndex: 2 });

            expect(action.action).toBe(ACTION_TYPES.HIGHLIGHT_ROW);
            expect(action.index).toBe(2);
            expect(sm.getState().lastCycleIndex).toBe(2);
        });

        it('should return NONE when visible but not VISIBLE_TABLE', () => {
            const mockPanel = createMockPanel(null);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow(); // Goes to SHOWING_COMPUTING

            const action = sm.handleStepCompleted({ cycleIndex: 2 });

            expect(action.action).toBe(ACTION_TYPES.NONE);
            expect(sm.getState().lastCycleIndex).toBe(2);
        });
    });

    describe('renderStarted() / renderCompleted()', () => {
        it('should track render in progress', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();

            sm.renderStarted();
            expect(sm.getState().renderInProgress).toBe(true);

            sm.renderCompleted();
            expect(sm.getState().renderInProgress).toBe(false);
        });

        it('should transition SHOWING_TABLE to VISIBLE_TABLE on renderCompleted', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);

            sm.renderStarted();
            sm.renderCompleted();

            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_TABLE);
        });
    });

    describe('reset()', () => {
        it('should reset to initial state', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Modify state
            sm.handleShow();
            sm.renderCompleted();
            sm.handleStepCompleted({ cycleIndex: 5 });
            sm.setDataState(DATA_STATES.STALE);

            // Reset
            sm.reset();

            const state = sm.getState();
            expect(state.panel).toBe(PANEL_STATES.HIDDEN);
            expect(state.data).toBe(DATA_STATES.FRESH);
            expect(state.lastCycleIndex).toBeNull();
            expect(state.renderInProgress).toBe(false);
        });
    });

    describe('setPanelState() / setDataState()', () => {
        it('should set valid panel states', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.setPanelState(PANEL_STATES.VISIBLE_TABLE);
            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_TABLE);
        });

        it('should ignore invalid panel states', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.setPanelState('invalid_state');
            expect(sm.getState().panel).toBe(PANEL_STATES.HIDDEN);
        });

        it('should set valid data states', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.setDataState(DATA_STATES.COMPUTING);
            expect(sm.getState().data).toBe(DATA_STATES.COMPUTING);
        });

        it('should ignore invalid data states', () => {
            const mockPanel = createMockPanel();
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.setDataState('invalid_state');
            expect(sm.getState().data).toBe(DATA_STATES.FRESH);
        });
    });

    describe('clearLastCycleIndex()', () => {
        it('should clear the lastCycleIndex', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleStepCompleted({ cycleIndex: 10 });
            expect(sm.getState().lastCycleIndex).toBe(10);

            sm.clearLastCycleIndex();
            expect(sm.getState().lastCycleIndex).toBeNull();
        });
    });

    describe('State Transition Table', () => {
        // Tests for specific transitions from the plan

        it('HIDDEN + show() + null analysis → SHOWING_COMPUTING', () => {
            const mockPanel = createMockPanel(null);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();

            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_COMPUTING);
        });

        it('HIDDEN + show() + invalid analysis → SHOWING_INVALID', () => {
            const mockPanel = createMockPanel(createInvalidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();

            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_INVALID);
        });

        it('HIDDEN + show() + valid analysis → SHOWING_TABLE', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();

            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
        });

        it('SHOWING_TABLE + renderCompleted() → VISIBLE_TABLE', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);

            sm.renderCompleted();
            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_TABLE);
        });

        it('VISIBLE_TABLE + hide() → HIDDEN', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleHide();

            expect(sm.getState().panel).toBe(PANEL_STATES.HIDDEN);
        });

        it('VISIBLE_TABLE + VALIDITY_CHANGED(invalid) → VISIBLE_INVALID', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleValidityChanged({ canSimulate: false, reason: 'Test' });

            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_INVALID);
        });

        it('VISIBLE_TABLE + ANALYSIS_COMPUTING → VISIBLE_COMPUTING', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleComputing({ percent: 50, current: 50, total: 100 });

            expect(sm.getState().panel).toBe(PANEL_STATES.VISIBLE_COMPUTING);
        });

        it('VISIBLE_COMPUTING + ANALYSIS_COMPUTED → SHOWING_TABLE (for rebuild)', () => {
            const mockPanel = createMockPanel(createValidAnalysis(2, 1));
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.renderCompleted();
            sm.handleComputing({ percent: 50, current: 50, total: 100 });

            sm.handleComputed(createValidAnalysis(3, 1), createValidAnalysis(2, 1)); // Structure changed

            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
        });

        it('VISIBLE_INVALID + ANALYSIS_COMPUTED(valid) → SHOWING_TABLE', () => {
            const invalidAnalysis = createInvalidAnalysis();
            const mockPanel = createMockPanel(invalidAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_INVALID);

            sm.handleComputed(createValidAnalysis(), invalidAnalysis);

            expect(sm.getState().panel).toBe(PANEL_STATES.SHOWING_TABLE);
        });

        it('VISIBLE_INVALID + hide() → HIDDEN', () => {
            const mockPanel = createMockPanel(createInvalidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            sm.handleShow();
            sm.handleHide();

            expect(sm.getState().panel).toBe(PANEL_STATES.HIDDEN);
        });
    });

    describe('Edge Cases', () => {
        it('should handle multiple rapid validity changes while hidden', () => {
            const mockPanel = createMockPanel(createValidAnalysis());
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Multiple changes while hidden
            sm.handleValidityChanged({ canSimulate: false, reason: 'A' });
            sm.handleValidityChanged({ canSimulate: true });
            sm.handleValidityChanged({ canSimulate: false, reason: 'B' });

            // Should be STALE regardless of intermediate states
            expect(sm.getState().data).toBe(DATA_STATES.STALE);
        });

        it('should preserve lastCycleIndex across hide/show cycle', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Show and set cycle index
            sm.handleShow();
            sm.renderCompleted();
            sm.handleStepCompleted({ cycleIndex: 3 });

            // Hide and show again
            sm.handleHide();
            sm.handleShow();

            expect(sm.getState().lastCycleIndex).toBe(3);
        });

        it('should handle STEP_COMPLETED while hidden then show', () => {
            const validAnalysis = createValidAnalysis();
            const mockPanel = createMockPanel(validAnalysis);
            const sm = new TruthTablePanelStateMachine(mockPanel);

            // Step completed while hidden
            sm.handleStepCompleted({ cycleIndex: 5 });
            expect(sm.getState().lastCycleIndex).toBe(5);

            // Now show
            sm.handleShow();
            sm.renderCompleted();

            // lastCycleIndex should still be available
            expect(sm.getState().lastCycleIndex).toBe(5);
        });
    });
});
