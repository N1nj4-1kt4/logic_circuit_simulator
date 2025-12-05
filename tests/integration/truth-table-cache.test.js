/**
 * Integration tests for pre-computed truth table caching
 * Tests the complete workflow of truth table computation, caching, and usage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';
import { TruthTableManager } from '../../src/core/TruthTableManager.js';
import { SimulationController } from '../../src/core/SimulationController.js';
import { CircuitValidityManager } from '../../src/core/CircuitValidityManager.js';
import { eventBus, EVENT_TYPES } from '../../src/utils/eventBus.js';
import { TIMING } from '../../src/constants.js';

// Create a working localStorage mock
function createLocalStorageMock() {
    const storage = new Map();
    return {
        getItem: vi.fn((key) => storage.get(key) ?? null),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        clear: vi.fn(() => storage.clear()),
        key: vi.fn((index) => Array.from(storage.keys())[index] ?? null),
        get length() { return storage.size; },
        _storage: storage
    };
}

// Helper to create a proper component with ports
function createComponent(id, type, label, x = 100, y = 100) {
    const component = {
        id,
        type,
        label,
        x,
        y,
        value: type === 'INPUT' ? 0 : null,
        inputs: [],
        outputs: []
    };

    // Set up ports based on type
    if (type === 'INPUT') {
        component.outputs = [{ x: x + 50, y }];
    } else if (type === 'OUTPUT') {
        component.inputs = [{ x, y }];
    } else if (type === 'NOT') {
        component.inputs = [{ x, y }];
        component.outputs = [{ x: x + 50, y }];
    } else if (type === 'AND' || type === 'OR' || type === 'XOR' || type === 'NAND' || type === 'NOR') {
        component.inputs = [{ x, y: y - 10 }, { x, y: y + 10 }];
        component.outputs = [{ x: x + 50, y }];
    }

    return component;
}

describe('Truth Table Cache - Core Functionality', () => {
    let state;
    let truthTableManager;
    let mockStorage;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        truthTableManager = new TruthTableManager({ state });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Cache Initialization', () => {
        it('should have null cache initially', () => {
            expect(state.getTruthTableCache()).toBeNull();
        });

        it('should compute cache after debounce on BOARD_CHANGED event', () => {
            // Add complete circuit manually
            const input1 = createComponent(1, 'INPUT', 'I1', 100, 100);
            const input2 = createComponent(2, 'INPUT', 'I2', 100, 200);
            const andGate = createComponent(3, 'AND', null, 200, 150);
            const output = createComponent(4, 'OUTPUT', 'O1', 300, 150);

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(andGate);
            state.addComponent(output);

            // Add connections
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

            // Cache should not be computed yet (still debouncing)
            expect(state.getTruthTableCache()).toBeNull();

            // Advance past debounce time
            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            // Cache should now be computed
            const cache = state.getTruthTableCache();
            expect(cache).not.toBeNull();
            expect(cache.isValid).toBe(true);
            expect(cache.table).toHaveLength(4);
        });
    });

    describe('Cache Invalidation', () => {
        it('should recompute cache when component is added', () => {
            // Setup initial circuit
            const input1 = createComponent(1, 'INPUT', 'I1');
            const output = createComponent(2, 'OUTPUT', 'O1', 200, 100);

            state.addComponent(input1);
            state.addComponent(output);

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            const initialCache = state.getTruthTableCache();
            expect(initialCache).not.toBeNull();

            // Add a gate
            const notGate = createComponent(3, 'NOT', null, 150, 100);
            state.addComponent(notGate);

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            const newCache = state.getTruthTableCache();
            expect(newCache).not.toBe(initialCache);
        });

        it('should recompute cache when component is removed', () => {
            const input1 = createComponent(1, 'INPUT', 'I1');
            const input2 = createComponent(2, 'INPUT', 'I2', 100, 200);
            const andGate = createComponent(3, 'AND', null, 200, 150);
            const output = createComponent(4, 'OUTPUT', 'O1', 300, 150);

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(andGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            const initialCache = state.getTruthTableCache();
            expect(initialCache.isValid).toBe(true);
            expect(initialCache.table).toHaveLength(4); // 2 inputs = 4 rows

            // Remove one input
            state.removeComponent(2);

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            const newCache = state.getTruthTableCache();
            // Cache should be recomputed (but might be invalid due to missing connection)
            expect(newCache).not.toBe(initialCache);
        });

        it('should recompute cache when connection is added', () => {
            const input = createComponent(1, 'INPUT', 'I1');
            const notGate = createComponent(2, 'NOT', null, 200, 100);
            const output = createComponent(3, 'OUTPUT', 'O1', 300, 100);

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            // Initially invalid (not connected)
            const initialCache = state.getTruthTableCache();
            expect(initialCache.isValid).toBe(false);

            // Add connections
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            const newCache = state.getTruthTableCache();
            expect(newCache.isValid).toBe(true);
        });

        it('should clear cache on BOARD_CLEARED event', () => {
            const input = createComponent(1, 'INPUT', 'I1');
            const notGate = createComponent(2, 'NOT', null, 200, 100);
            const output = createComponent(3, 'OUTPUT', 'O1', 300, 100);

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            expect(state.getTruthTableCache()).not.toBeNull();

            // Clear the board
            state.clearComponents();

            // Cache should be cleared immediately (no debounce)
            expect(state.getTruthTableCache()).toBeNull();
        });
    });

    describe('Debouncing', () => {
        it('should debounce multiple rapid changes', () => {
            const recomputeSpy = vi.spyOn(truthTableManager, 'recomputeTruthTable');

            // Make many rapid changes
            for (let i = 0; i < 10; i++) {
                const component = createComponent(i + 1, 'INPUT', `I${i + 1}`, 100 * i, 100);
                state.addComponent(component);
            }

            // Should not have been called yet
            expect(recomputeSpy).not.toHaveBeenCalled();

            // Advance just under debounce time
            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE - 10);
            expect(recomputeSpy).not.toHaveBeenCalled();

            // Advance past debounce time
            vi.advanceTimersByTime(20);
            expect(recomputeSpy).toHaveBeenCalledTimes(1);
        });

        it('should reset debounce timer on each change', () => {
            const recomputeSpy = vi.spyOn(truthTableManager, 'recomputeTruthTable');

            // First change
            state.addComponent(createComponent(1, 'INPUT', 'I1'));

            // Wait 100ms (less than debounce)
            vi.advanceTimersByTime(100);

            // Second change (should reset timer)
            state.addComponent(createComponent(2, 'INPUT', 'I2', 200, 100));

            // Wait another 100ms
            vi.advanceTimersByTime(100);

            // Should not have recomputed yet
            expect(recomputeSpy).not.toHaveBeenCalled();

            // Wait for full debounce from last change
            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE);
            expect(recomputeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('TRUTH_TABLE_COMPUTED Event', () => {
        it('should emit TRUTH_TABLE_COMPUTED event after recomputation', () => {
            const eventHandler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, eventHandler);

            const input = createComponent(1, 'INPUT', 'I1');
            const notGate = createComponent(2, 'NOT', null, 200, 100);
            const output = createComponent(3, 'OUTPUT', 'O1', 300, 100);

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

            expect(eventHandler).toHaveBeenCalled();
            const result = eventHandler.mock.calls[0][0];
            expect(result.isValid).toBe(true);
            expect(result.table).toHaveLength(2);
        });
    });
});

describe('Truth Table Cache - Simulation Integration', () => {
    let state;
    let simulationController;
    let validityManager;
    let mockStorage;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        validityManager = new CircuitValidityManager(state);

        // TruthTableManager is needed to set up truth table cache recomputation on BOARD_CHANGED
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const truthTableManager = new TruthTableManager({ state });

        simulationController = new SimulationController({
            circuitState: state,
            validityManager
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should use cache for auto-cycle step when available', () => {
        // Setup circuit
        const input1 = createComponent(1, 'INPUT', 'I1', 100, 100);
        const input2 = createComponent(2, 'INPUT', 'I2', 100, 200);
        const andGate = createComponent(3, 'AND', null, 200, 150);
        const output = createComponent(4, 'OUTPUT', 'O1', 300, 150);

        state.addComponent(input1);
        state.addComponent(input2);
        state.addComponent(andGate);
        state.addComponent(output);

        state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
        state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
        state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

        // Wait for cache to be computed
        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const cache = state.getTruthTableCache();
        expect(cache.isValid).toBe(true);

        // Spy on SimulationController's _simulate to verify cache is used
        const simulateSpy = vi.spyOn(simulationController, '_simulate');

        // Start auto-cycle (this uses cache internally)
        simulationController.autocycleStart();

        // Advance timer to trigger the first step
        vi.advanceTimersByTime(TIMING.AUTO_CYCLE_DELAY);

        // Should NOT have called _simulate (uses cache instead)
        expect(simulateSpy).not.toHaveBeenCalled();

        // Cleanup
        simulationController.autocycleStop();
    });

    it('should use cache for manualStep', () => {
        // Setup NOT circuit
        const input = createComponent(1, 'INPUT', 'I1', 100, 100);
        const notGate = createComponent(2, 'NOT', null, 200, 100);
        const output = createComponent(3, 'OUTPUT', 'O1', 300, 100);

        state.addComponent(input);
        state.addComponent(notGate);
        state.addComponent(output);

        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
        state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const simulateSpy = vi.spyOn(simulationController, '_simulate');

        // Step to next state
        simulationController.manualStep(1);

        // Should use cache, not simulate
        expect(simulateSpy).not.toHaveBeenCalled();

        // Verify input and output changed correctly
        const components = state.getComponents();
        const inputComponent = components.find(c => c.type === 'INPUT');
        const outputComponent = components.find(c => c.type === 'OUTPUT');

        expect(inputComponent.value).toBe(1); // Stepped to next state
        expect(outputComponent.value).toBe(0); // NOT 1 = 0
    });
});

describe('Truth Table Cache - State Preservation', () => {
    let state;
    let mockStorage;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();

        // TruthTableManager sets up truth table cache recomputation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const truthTableManager = new TruthTableManager({ state });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not modify original components during cache computation', () => {
        const input = createComponent(1, 'INPUT', 'I1', 100, 100);
        input.value = 0;
        const notGate = createComponent(2, 'NOT', null, 200, 100);
        notGate.value = null;
        const output = createComponent(3, 'OUTPUT', 'O1', 300, 100);
        output.value = null;

        state.addComponent(input);
        state.addComponent(notGate);
        state.addComponent(output);

        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
        state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

        // Trigger cache computation
        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        // Verify original values unchanged
        const components = state.getComponents();
        expect(components[0].value).toBe(0);
        expect(components[1].value).toBeNull();
        expect(components[2].value).toBeNull();
    });

    it('should preserve input states when switching between simulation modes', () => {
        // Setup circuit with specific input values
        const input1 = createComponent(1, 'INPUT', 'I1', 100, 100);
        input1.value = 1;
        const input2 = createComponent(2, 'INPUT', 'I2', 100, 200);
        input2.value = 0;

        state.addComponent(input1);
        state.addComponent(input2);

        const initialValue1 = input1.value;
        const initialValue2 = input2.value;

        // Wait for cache computation (shouldn't change values)
        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const components = state.getComponents();
        expect(components[0].value).toBe(initialValue1);
        expect(components[1].value).toBe(initialValue2);
    });
});

describe('Truth Table Cache - Edge Cases', () => {
    let state;
    let truthTableManager;
    let mockStorage;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        truthTableManager = new TruthTableManager({ state });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should handle empty circuit gracefully', () => {
        // Manually trigger recomputation on empty circuit
        truthTableManager.recomputeTruthTable();

        const cache = state.getTruthTableCache();
        expect(cache).not.toBeNull();
        expect(cache.isValid).toBe(false);
    });

    it('should handle circuit with only inputs', () => {
        state.addComponent(createComponent(1, 'INPUT', 'I1'));
        state.addComponent(createComponent(2, 'INPUT', 'I2', 100, 200));

        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const cache = state.getTruthTableCache();
        expect(cache.isValid).toBe(false);
        expect(cache.reason).toContain('output');
    });

    it('should handle circuit with only outputs', () => {
        state.addComponent(createComponent(1, 'OUTPUT', 'O1'));
        state.addComponent(createComponent(2, 'OUTPUT', 'O2', 100, 200));

        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const cache = state.getTruthTableCache();
        expect(cache.isValid).toBe(false);
        expect(cache.reason).toContain('input');
    });

    it('should handle rapid add/remove cycles', () => {
        const recomputeSpy = vi.spyOn(truthTableManager, 'recomputeTruthTable');

        // Add and remove rapidly
        for (let i = 0; i < 5; i++) {
            const component = createComponent(100 + i, 'INPUT', `I${i}`);
            state.addComponent(component);
            state.removeComponent(100 + i);
        }

        // Should only recompute once after debounce
        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);
        expect(recomputeSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent events correctly', () => {
        // Add multiple components in same event loop
        state.addComponent(createComponent(1, 'INPUT', 'I1'));
        state.addComponent(createComponent(2, 'OUTPUT', 'O1', 200, 100));
        state.addComponent(createComponent(3, 'NOT', null, 150, 100));

        // Add connections
        state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
        state.addConnection({ from: 3, fromPort: 0, to: 2, toPort: 0 });

        vi.advanceTimersByTime(TIMING.TRUTH_TABLE_DEBOUNCE + 10);

        const cache = state.getTruthTableCache();
        // Cache should reflect final state of all changes
        expect(cache).not.toBeNull();
    });
});
