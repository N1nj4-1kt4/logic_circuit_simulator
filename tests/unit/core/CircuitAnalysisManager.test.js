/**
 * Unit tests for CircuitAnalysisManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitAnalysisManager } from '../../../src/core/CircuitAnalysisManager.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('CircuitAnalysisManager', () => {
    let state;
    let manager;

    beforeEach(() => {
        state = new CircuitState();

        // Clear event bus before each test
        eventBus.clear();

        // Clear timers
        vi.useFakeTimers();

        manager = new CircuitAnalysisManager({
            state
        });
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Truth Table Computation', () => {
        it('stores computed truth table in state', () => {
            // Add INPUT and OUTPUT components
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'OUTPUT', x: 300, y: 100,
                inputs: [{ x: 280, y: 100 }], outputs: [],
                value: null, label: 'O1'
            });

            manager.recomputeAnalysis();

            const cache = state.getCircuitAnalysis();
            expect(cache).not.toBeNull();
        });

        it('emits CIRCUIT_ANALYSIS_COMPUTED event for valid circuits', () => {
            // Create a valid circuit: INPUT -> AND gate -> OUTPUT (all ports connected)
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'INPUT', x: 100, y: 200,
                inputs: [], outputs: [{ x: 120, y: 200 }],
                value: 0, label: 'I2'
            });
            state.addComponent({
                id: 3, type: 'AND', x: 200, y: 150,
                inputs: [{ x: 180, y: 140 }, { x: 180, y: 160 }],
                outputs: [{ x: 220, y: 150 }],
                value: null
            });
            state.addComponent({
                id: 4, type: 'OUTPUT', x: 300, y: 150,
                inputs: [{ x: 280, y: 150 }], outputs: [],
                value: null, label: 'O1'
            });
            // Connect all ports
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            manager.recomputeAnalysis();

            expect(handler).toHaveBeenCalled();
        });

        it('sets circuitAnalysis with isValid property', () => {
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'OUTPUT', x: 300, y: 100,
                inputs: [{ x: 280, y: 100 }], outputs: [],
                value: null, label: 'O1'
            });

            manager.recomputeAnalysis();

            const cache = state.getCircuitAnalysis();
            expect(cache).toHaveProperty('isValid');
        });

        it('does NOT emit CIRCUIT_ANALYSIS_COMPUTED for invalid circuits', () => {
            // Add only INPUT - circuit is invalid without OUTPUT and connected gate
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            manager.recomputeAnalysis();

            // Event should NOT be emitted for invalid circuits
            expect(handler).not.toHaveBeenCalled();

            // But analysis should still be stored in state
            const analysis = state.getCircuitAnalysis();
            expect(analysis).not.toBeNull();
            expect(analysis.isValid).toBe(false);
        });

        it('stores analysis in state even when circuit is invalid', () => {
            // Add only INPUT - circuit is invalid
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });

            manager.recomputeAnalysis();

            // Analysis should be stored in state regardless of validity
            const analysis = state.getCircuitAnalysis();
            expect(analysis).not.toBeNull();
            expect(analysis.isValid).toBe(false);
            expect(analysis.reason).toBeDefined();
        });

        it('handles debounced recomputation setup', () => {
            // Verify the debounce timer property exists
            expect(manager.analysisDebounceTimer).toBeDefined();
        });
    });

    describe('Event-driven Recomputation', () => {
        beforeEach(() => {
            // Add components for recomputation tests
            // Must create a VALID circuit: INPUT -> AND gate -> OUTPUT (all ports connected)
            // CIRCUIT_ANALYSIS_COMPUTED only fires for valid circuits
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'INPUT', x: 100, y: 200,
                inputs: [], outputs: [{ x: 120, y: 200 }],
                value: 0, label: 'I2'
            });
            state.addComponent({
                id: 3, type: 'AND', x: 200, y: 150,
                inputs: [{ x: 180, y: 140 }, { x: 180, y: 160 }],
                outputs: [{ x: 220, y: 150 }],
                value: null
            });
            state.addComponent({
                id: 4, type: 'OUTPUT', x: 300, y: 150,
                inputs: [{ x: 280, y: 150 }], outputs: [],
                value: null, label: 'O1'
            });
            // Connect all ports for valid circuit
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });
        });

        it('recomputes truth table on BOARD_CHANGED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            // Emit board changed event
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Fast-forward past debounce delay
            vi.advanceTimersByTime(200);

            expect(handler).toHaveBeenCalled();
        });

        it('recomputes truth table on COMPONENT_LABEL_CHANGED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            // Emit label changed event
            eventBus.emit(EVENT_TYPES.COMPONENT_LABEL_CHANGED, {
                component: state.getComponents()[0],
                oldLabel: 'I1',
                newLabel: 'A'
            });

            // Fast-forward past debounce delay
            vi.advanceTimersByTime(200);

            expect(handler).toHaveBeenCalled();
        });

        it('clears cache on BOARD_CLEARED event', () => {
            // First compute truth table
            manager.recomputeAnalysis();
            expect(state.getCircuitAnalysis()).not.toBeNull();

            // Emit board cleared event
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

            expect(state.getCircuitAnalysis()).toBeNull();
        });

        it('debounces rapid BOARD_CHANGED events', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            // Emit multiple rapid changes
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            vi.advanceTimersByTime(200);

            // Should only compute once due to debouncing
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('recomputes truth table immediately on BOARD_LOADED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            // Emit board loaded event (simulating revert to saved or board load)
            eventBus.emit(EVENT_TYPES.BOARD_LOADED);

            // Should compute immediately without debouncing
            expect(handler).toHaveBeenCalled();
        });

        it('recomputes truth table on BOARD_LOADED even with no prior cache', () => {
            // Clear any existing cache
            state.setCircuitAnalysis(null);

            // Emit board loaded event
            eventBus.emit(EVENT_TYPES.BOARD_LOADED);

            // Cache should now be populated
            expect(state.getCircuitAnalysis()).not.toBeNull();
        });
    });

    describe('Cleanup', () => {
        it('clears timers on destroy', () => {
            // Start a debounced recomputation
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Destroy the manager
            manager.destroy();

            // Timer should be cleared
            expect(manager.analysisDebounceTimer).toBeNull();
        });

        it('removes event listeners on destroy', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, handler);

            // Destroy the manager
            manager.destroy();

            // Emit events - should not trigger computation
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            vi.advanceTimersByTime(200);

            // Handler should not be called because manager's listeners are removed
            // (Note: The CIRCUIT_ANALYSIS_COMPUTED handler we added should still exist,
            // but there's nothing to emit it since manager's listeners are gone)
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
