/**
 * Unit tests for validation and error handling
 * Tests data validation, storage error handling, and graceful degradation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { CircuitOperations } from '../../../src/core/CircuitOperations.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import { BoardManager } from '../../../src/storage/BoardManager.js';
import { ComponentLibrary } from '../../../src/storage/ComponentLibrary.js';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';
import {
    validateComponentData,
    validateCircuitData,
    deepClone
} from '../../../src/utils/serialization.js';

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

describe('Component Data Validation', () => {
    it('should reject component data without name', () => {
        const invalidData = {
            components: [],
            connections: []
        };

        expect(() => validateComponentData(invalidData)).toThrow('Component must have a name');
    });

    it('should reject component data without components array', () => {
        const invalidData = {
            name: 'TestComponent',
            connections: []
        };

        expect(() => validateComponentData(invalidData)).toThrow('Component must have a components array');
    });

    it('should reject component data with non-array components', () => {
        const invalidData = {
            name: 'TestComponent',
            components: 'not an array',
            connections: []
        };

        expect(() => validateComponentData(invalidData)).toThrow('Component must have a components array');
    });

    it('should reject component data without connections array', () => {
        const invalidData = {
            name: 'TestComponent',
            components: []
        };

        expect(() => validateComponentData(invalidData)).toThrow('Component must have a connections array');
    });

    it('should reject component data with non-array connections', () => {
        const invalidData = {
            name: 'TestComponent',
            components: [],
            connections: {}
        };

        expect(() => validateComponentData(invalidData)).toThrow('Component must have a connections array');
    });

    it('should accept valid component data', () => {
        const validData = {
            name: 'TestComponent',
            components: [{ id: 1, type: 'INPUT' }],
            connections: [{ from: 1, to: 2 }]
        };

        expect(validateComponentData(validData)).toBe(true);
    });

    it('should accept component data with empty arrays', () => {
        const validData = {
            name: 'EmptyComponent',
            components: [],
            connections: []
        };

        expect(validateComponentData(validData)).toBe(true);
    });
});

describe('Circuit Data Validation', () => {
    it('should reject circuit data without components array', () => {
        const invalidData = {
            connections: []
        };

        expect(() => validateCircuitData(invalidData)).toThrow('Circuit must have a components array');
    });

    it('should reject circuit data with non-array components', () => {
        const invalidData = {
            components: null,
            connections: []
        };

        expect(() => validateCircuitData(invalidData)).toThrow('Circuit must have a components array');
    });

    it('should reject circuit data without connections array', () => {
        const invalidData = {
            components: []
        };

        expect(() => validateCircuitData(invalidData)).toThrow('Circuit must have a connections array');
    });

    it('should accept valid circuit data', () => {
        const validData = {
            components: [],
            connections: []
        };

        expect(validateCircuitData(validData)).toBe(true);
    });
});

describe('Board Name Validation', () => {
    let state;
    let operations;
    let mockStorage;

    const mockCallbacks = {
        redraw: vi.fn(),
        defineComponentPorts: vi.fn(),
        findComponent: vi.fn(),
        findPort: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        const storageAdapter = new LocalStorageAdapter();
        const boardManager = new BoardManager(storageAdapter);
        const componentLibrary = new ComponentLibrary(storageAdapter);

        operations = new CircuitOperations({
            state,
            boardManager,
            componentLibrary,
            callbacks: mockCallbacks
        });
    });

    it('should reject empty string board name', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        const result = await operations.saveCurrentBoard('');

        expect(result).toBe(false);
    });

    it('should reject whitespace-only board name', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        const result = await operations.saveCurrentBoard('   ');

        expect(result).toBe(false);
    });

    it('should accept valid board name', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });

        const result = await operations.saveCurrentBoard('ValidBoardName');

        expect(result).toBe(true);
    });

    it('should accept board name with spaces', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });

        const result = await operations.saveCurrentBoard('My Board Name');

        expect(result).toBe(true);
    });

    it('should handle very long board names', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });

        const longName = 'A'.repeat(1000);
        const result = await operations.saveCurrentBoard(longName);

        // Should succeed (localStorage can handle long keys)
        expect(result).toBe(true);
    });
});

describe('Storage Error Handling', () => {
    let state;
    let operations;
    let mockStorage;

    const mockCallbacks = {
        redraw: vi.fn(),
        defineComponentPorts: vi.fn(),
        findComponent: vi.fn(),
        findPort: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        const storageAdapter = new LocalStorageAdapter();
        const boardManager = new BoardManager(storageAdapter);
        const componentLibrary = new ComponentLibrary(storageAdapter);

        operations = new CircuitOperations({
            state,
            boardManager,
            componentLibrary,
            callbacks: mockCallbacks
        });
    });

    it('should handle corrupted JSON in localStorage', async () => {
        // Store corrupted JSON
        mockStorage._storage.set('currentBoard', 'not valid json {{{');

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Should not throw
        await expect(operations.loadBoardState()).resolves.not.toThrow();

        // State should remain empty (fallback to empty state)
        expect(state.getComponents()).toHaveLength(0);

        consoleErrorSpy.mockRestore();
    });

    it('should handle partially corrupted data gracefully', async () => {
        // Store data with missing fields
        // Note: double-stringify because saveBoardState does JSON.stringify before setItem
        const partialData = {
            components: [{ id: 1, type: 'INPUT' }]
            // Missing connections, nextId, etc.
        };
        mockStorage._storage.set('currentBoard', JSON.stringify(JSON.stringify(partialData)));

        await operations.loadBoardState();

        // Should load what's available
        expect(state.getComponents()).toHaveLength(1);
        expect(state.getConnections()).toHaveLength(0);
    });

    it('should handle null values in stored data', async () => {
        // Note: double-stringify
        const dataWithNulls = {
            components: null,
            connections: null,
            nextId: null
        };
        mockStorage._storage.set('currentBoard', JSON.stringify(JSON.stringify(dataWithNulls)));

        await operations.loadBoardState();

        // Should fall back to defaults
        expect(state.getComponents()).toHaveLength(0);
        expect(state.getConnections()).toHaveLength(0);
    });

    it('should handle localStorage.getItem returning null', async () => {
        // Default behavior - no stored data
        await operations.loadBoardState();

        expect(state.getComponents()).toHaveLength(0);
    });

    it('should handle localStorage.setItem errors gracefully', async () => {
        // Make setItem throw an error (simulating quota exceeded)
        mockStorage.setItem = vi.fn(() => {
            throw new Error('QuotaExceededError');
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Should not throw
        await expect(operations.saveBoardState()).resolves.not.toThrow();

        // Error should be logged
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it('should handle localStorage.removeItem errors gracefully', async () => {
        mockStorage.removeItem = vi.fn(() => {
            throw new Error('Storage error');
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(operations.clearBoardState()).resolves.not.toThrow();

        consoleErrorSpy.mockRestore();
    });
});

describe('State Load Validation', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should handle loadState with missing components', () => {
        state.loadState({
            connections: [{ from: 1, to: 2 }],
            nextId: 5
        });

        expect(state.getComponents()).toHaveLength(0);
        expect(state.getConnections()).toHaveLength(1);
    });

    it('should handle loadState with missing connections', () => {
        state.loadState({
            components: [{ id: 1, type: 'INPUT' }],
            nextId: 5
        });

        expect(state.getComponents()).toHaveLength(1);
        expect(state.getConnections()).toHaveLength(0);
    });

    it('should handle loadState with missing nextId', () => {
        state.loadState({
            components: [{ id: 10, type: 'INPUT' }],
            connections: []
        });

        // Should default to 1 when not provided
        expect(state.generateNextId()).toBe(1);
    });

    it('should handle loadState with undefined values', () => {
        state.loadState({
            components: undefined,
            connections: undefined,
            nextId: undefined
        });

        expect(state.getComponents()).toHaveLength(0);
        expect(state.getConnections()).toHaveLength(0);
        expect(state.generateNextId()).toBe(1);
    });

    it('should restore truthTableState from loadState', () => {
        state.loadState({
            components: [],
            connections: [],
            truthTableState: { width: 500, columnOrder: ['A', 'B'] }
        });

        expect(state.getTruthTableState()).toEqual({ width: 500, columnOrder: ['A', 'B'] });
        expect(state.getTruthTableColumnOrder()).toEqual(['A', 'B']);
    });

    it('should handle loadState with null truthTableState', () => {
        state.loadState({
            components: [],
            connections: [],
            truthTableState: null
        });

        expect(state.getTruthTableState()).toBeNull();
    });
});

describe('Deep Clone Validation', () => {
    it('should create independent copy of nested objects', () => {
        const original = {
            components: [{ id: 1, nested: { value: 10 } }],
            connections: [{ from: 1, to: 2 }]
        };

        const cloned = deepClone(original);

        // Modify clone
        cloned.components[0].nested.value = 999;
        cloned.connections.push({ from: 3, to: 4 });

        // Original should be unchanged
        expect(original.components[0].nested.value).toBe(10);
        expect(original.connections).toHaveLength(1);
    });

    it('should handle empty objects', () => {
        expect(deepClone({})).toEqual({});
    });

    it('should handle empty arrays', () => {
        expect(deepClone([])).toEqual([]);
    });

    it('should handle null values', () => {
        expect(deepClone(null)).toBeNull();
    });

    it('should handle primitive values', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('string')).toBe('string');
        expect(deepClone(true)).toBe(true);
    });

    it('should not preserve function references (JSON limitation)', () => {
        const objWithFunction = {
            value: 10,
            method: () => 'test'
        };

        const cloned = deepClone(objWithFunction);

        expect(cloned.value).toBe(10);
        expect(cloned.method).toBeUndefined();
    });

    it('should not preserve undefined values (JSON limitation)', () => {
        const objWithUndefined = {
            value: 10,
            undef: undefined
        };

        const cloned = deepClone(objWithUndefined);

        expect(cloned.value).toBe(10);
        expect('undef' in cloned).toBe(false);
    });
});

describe('Invalid Component Types', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should allow adding component with unknown type', () => {
        // State layer doesn't validate types
        const unknownComponent = { id: 1, type: 'UNKNOWN_TYPE', x: 100, y: 100 };
        state.addComponent(unknownComponent);

        expect(state.getComponents()).toHaveLength(1);
        expect(state.getComponent(1).type).toBe('UNKNOWN_TYPE');
    });

    it('should allow adding component with null type', () => {
        const nullTypeComponent = { id: 1, type: null, x: 100, y: 100 };
        state.addComponent(nullTypeComponent);

        expect(state.getComponents()).toHaveLength(1);
    });

    it('should allow adding component without type', () => {
        const noTypeComponent = { id: 1, x: 100, y: 100 };
        state.addComponent(noTypeComponent);

        expect(state.getComponents()).toHaveLength(1);
        expect(state.getComponent(1).type).toBeUndefined();
    });

    it('should handle component with missing position', () => {
        const noPositionComponent = { id: 1, type: 'INPUT' };
        state.addComponent(noPositionComponent);

        expect(state.getComponents()).toHaveLength(1);
        expect(state.getComponent(1).x).toBeUndefined();
        expect(state.getComponent(1).y).toBeUndefined();
    });
});
