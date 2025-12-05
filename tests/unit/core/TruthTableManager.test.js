/**
 * Unit tests for TruthTableManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TruthTableManager } from '../../../src/core/TruthTableManager.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('TruthTableManager', () => {
    let state;
    let manager;

    beforeEach(() => {
        state = new CircuitState();

        // Clear event bus before each test
        eventBus.clear();

        // Clear timers
        vi.useFakeTimers();

        manager = new TruthTableManager({
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

            manager.recomputeTruthTable();

            const cache = state.getTruthTableCache();
            expect(cache).not.toBeNull();
        });

        it('emits TRUTH_TABLE_COMPUTED event', () => {
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

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

            manager.recomputeTruthTable();

            expect(handler).toHaveBeenCalled();
        });

        it('sets truthTableCache with isValid property', () => {
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

            manager.recomputeTruthTable();

            const cache = state.getTruthTableCache();
            expect(cache).toHaveProperty('isValid');
        });

        it('handles debounced recomputation setup', () => {
            // Verify the debounce timer property exists
            expect(manager.truthTableDebounceTimer).toBeDefined();
        });
    });

    describe('Event-driven Recomputation', () => {
        beforeEach(() => {
            // Add components for recomputation tests
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
        });

        it('recomputes truth table on BOARD_CHANGED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

            // Emit board changed event
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Fast-forward past debounce delay
            vi.advanceTimersByTime(200);

            expect(handler).toHaveBeenCalled();
        });

        it('recomputes truth table on COMPONENT_LABEL_CHANGED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

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
            manager.recomputeTruthTable();
            expect(state.getTruthTableCache()).not.toBeNull();

            // Emit board cleared event
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

            expect(state.getTruthTableCache()).toBeNull();
        });

        it('debounces rapid BOARD_CHANGED events', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

            // Emit multiple rapid changes
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            vi.advanceTimersByTime(200);

            // Should only compute once due to debouncing
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Cleanup', () => {
        it('clears timers on destroy', () => {
            // Start a debounced recomputation
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Destroy the manager
            manager.destroy();

            // Timer should be cleared
            expect(manager.truthTableDebounceTimer).toBeNull();
        });

        it('removes event listeners on destroy', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

            // Destroy the manager
            manager.destroy();

            // Emit events - should not trigger computation
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            vi.advanceTimersByTime(200);

            // Handler should not be called because manager's listeners are removed
            // (Note: The TRUTH_TABLE_COMPUTED handler we added should still exist,
            // but there's nothing to emit it since manager's listeners are gone)
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
