/**
 * Integration tests for auto-save functionality
 * Tests debouncing, context switching, and data persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';
import { AutoSaveManager } from '../../src/core/AutoSaveManager.js';
import { BoardOperations } from '../../src/core/BoardOperations.js';
import { ContextManager } from '../../src/core/ContextManager.js';
import { TruthTableManager } from '../../src/core/TruthTableManager.js';
import { eventBus, EVENT_TYPES } from '../../src/utils/eventBus.js';
import { BoardManager } from '../../src/storage/BoardManager.js';
import { ComponentLibrary } from '../../src/storage/ComponentLibrary.js';
import { LocalStorageAdapter } from '../../src/storage/LocalStorageAdapter.js';

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
        _storage: storage // For test inspection
    };
}

describe('Auto-Save Debouncing', () => {
    let state;
    let autoSaveManager;
    let mockStorage;
    let storageAdapter;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();

        autoSaveManager = new AutoSaveManager({
            state,
            storage: storageAdapter
        });

        autoSaveManager.setupAutoSave();
    });

    afterEach(() => {
        autoSaveManager.clearAutoSave();
        vi.useRealTimers();
    });

    it('should debounce auto-save on rapid changes', () => {
        const saveSpy = vi.spyOn(autoSaveManager, 'saveBoardState');

        // Make 5 rapid changes
        for (let i = 0; i < 5; i++) {
            state.addComponent({ id: state.generateNextId(), type: 'INPUT', x: 100 * i, y: 100 });
        }

        // saveBoardState should not be called immediately
        expect(saveSpy).not.toHaveBeenCalled();

        // Advance past debounce delay (1000ms)
        vi.advanceTimersByTime(1100);

        // Should have been called only once
        expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on each change', () => {
        const saveSpy = vi.spyOn(autoSaveManager, 'saveBoardState');

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Advance 500ms (half the debounce)
        vi.advanceTimersByTime(500);

        // Another change should reset the timer
        state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100 });

        // Advance another 500ms (total 1000ms from first change, 500ms from second)
        vi.advanceTimersByTime(500);

        // Should not have saved yet (timer was reset)
        expect(saveSpy).not.toHaveBeenCalled();

        // Advance to complete the second debounce period
        vi.advanceTimersByTime(600);

        expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('should save after debounce period', async () => {
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Advance past debounce
        vi.advanceTimersByTime(1100);

        // Verify save occurred
        expect(mockStorage.setItem).toHaveBeenCalledWith(
            'currentBoard',
            expect.any(String)
        );
    });
});

describe('Auto-Save State Persistence', () => {
    let state;
    let autoSaveManager;
    let mockStorage;
    let storageAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();

        autoSaveManager = new AutoSaveManager({
            state,
            storage: storageAdapter
        });
    });

    it('should include all relevant state in auto-save', async () => {
        // Setup state
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' });
        state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, label: 'O1' });
        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
        state.setCurrentBoardName('TestBoard');
        state.setTruthTableState({ width: 400, height: 300 });

        await autoSaveManager.saveBoardState();

        // Data is double-stringified (saveBoardState JSON.stringifys, then setItem JSON.stringifys again)
        // getItem from our mock does a JSON.parse, so we need one more parse
        const rawData = mockStorage._storage.get('currentBoard');
        const savedData = JSON.parse(JSON.parse(rawData));

        expect(savedData.components).toHaveLength(2);
        expect(savedData.connections).toHaveLength(1);
        expect(savedData.currentBoardName).toBe('TestBoard');
        expect(savedData.truthTableState).toEqual({ width: 400, height: 300 });
    });

    it('should restore state from auto-save', async () => {
        // Pre-populate storage with saved state
        // Note: saveBoardState passes JSON.stringify(boardData) to setItem
        // setItem then does another JSON.stringify, so data is double-stringified
        // getItem does one JSON.parse, then loadBoardState does another
        const savedState = {
            components: [
                { id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' },
                { id: 2, type: 'OUTPUT', x: 200, y: 100, label: 'O1' }
            ],
            connections: [{ from: 1, fromPort: 0, to: 2, toPort: 0 }],
            nextId: 2,
            currentBoardName: 'RestoredBoard',
            truthTableState: { width: 500, height: 400 }
        };

        // Simulate double-stringify that happens in actual save flow
        // setItem receives JSON.stringify(boardData), then does JSON.stringify again
        mockStorage._storage.set('currentBoard', JSON.stringify(JSON.stringify(savedState)));

        await autoSaveManager.loadBoardState();

        expect(state.getComponents()).toHaveLength(2);
        expect(state.getConnections()).toHaveLength(1);
        expect(state.getCurrentBoardName()).toBe('RestoredBoard');
        expect(state.getTruthTableState()).toEqual({ width: 500, height: 400 });
    });

    it('should handle missing auto-save data gracefully', async () => {
        // No saved state exists - Map.get returns undefined for missing keys
        // But our mock's getItem returns null for missing keys (line 18)
        expect(mockStorage.getItem('currentBoard')).toBeNull();

        // Should not throw
        await expect(autoSaveManager.loadBoardState()).resolves.not.toThrow();

        // State should remain empty
        expect(state.getComponents()).toHaveLength(0);
    });

    it('should clear auto-save state when board is cleared', async () => {
        // Save some state
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });
        await autoSaveManager.saveBoardState();

        expect(mockStorage._storage.has('currentBoard')).toBe(true);

        // Clear board state
        await autoSaveManager.clearBoardState();

        expect(mockStorage._storage.has('currentBoard')).toBe(false);
    });
});

describe('Context Switching', () => {
    let state;
    let boardOperations;
    let mockStorage;
    let storageAdapter;
    let boardManager;
    let componentLibrary;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();
        boardManager = new BoardManager(storageAdapter);
        componentLibrary = new ComponentLibrary(storageAdapter);

        const truthTableManager = new TruthTableManager({ state });
        const contextManager = new ContextManager({
            state,
            boardManager,
            componentLibrary,
            truthTableManager
        });

        boardOperations = new BoardOperations({
            state,
            boardManager,
            contextManager
        });
    });

    it('should save current board before loading another', async () => {
        // Create and save Board A
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1', inputs: [], inputPorts: [], outputPorts: [{}] });
        await boardOperations.saveCurrentBoard('BoardA');

        // Verify Board A exists
        const boardA = await boardManager.loadBoard('BoardA');
        expect(boardA.components).toHaveLength(1);

        // Add another component to Board A
        state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, label: 'O1', inputs: [null], inputPorts: [{}], outputPorts: [] });

        // Create Board B
        state.clearComponents();
        state.setCurrentBoardName(null);
        state.addComponent({ id: 1, type: 'AND', x: 150, y: 150, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] });
        await boardOperations.saveCurrentBoard('BoardB');

        // Load Board A (should trigger auto-save of current context via _saveCurrentContext)
        await boardOperations.loadBoard('BoardA');

        // Board A should have 1 component (original saved state)
        expect(state.getComponents()).toHaveLength(1);
        expect(state.getCurrentBoardName()).toBe('BoardA');
    });

    it('should preserve truth table state per board', async () => {
        // Setup Board A with truth table state
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1', inputs: [], inputPorts: [], outputPorts: [{}] });
        state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, label: 'O1', inputs: [null], inputPorts: [{}], outputPorts: [] });
        state.setTruthTableState({ width: 400, height: 300, columnOrder: ['I1', 'O1'] });
        await boardOperations.saveCurrentBoard('BoardWithTable');

        // Clear and reload
        state.clearComponents();
        state.setCurrentBoardName(null);
        state.setTruthTableState(null);

        await boardOperations.loadBoard('BoardWithTable');

        expect(state.getTruthTableState()).toEqual({
            width: 400,
            height: 300,
            columnOrder: ['I1', 'O1']
        });
    });

    it('should not overwrite board when loading same board', async () => {
        // Create and save board
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1', inputs: [], inputPorts: [], outputPorts: [{}] });
        await boardOperations.saveCurrentBoard('SameBoard');

        // Load the same board - this is essentially a no-op/refresh
        // The _saveCurrentContext will save current state (which is same as saved)
        await boardOperations.loadBoard('SameBoard');

        // Should still have same data
        expect(state.getComponents()).toHaveLength(1);
        expect(state.getCurrentBoardName()).toBe('SameBoard');
    });

    it('should clear board name to prevent accidental overwrite', async () => {
        // Save a board
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1', inputs: [], inputPorts: [], outputPorts: [{}] });
        await boardOperations.saveCurrentBoard('OriginalBoard');

        // Clear for new work
        state.clearComponents();
        state.setCurrentBoardName(null);

        // Add new components
        state.addComponent({ id: 1, type: 'AND', x: 150, y: 150, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] });

        // Board name should be null, so saving would require a new name
        expect(state.getCurrentBoardName()).toBeNull();

        // Original board should be unchanged
        const original = await boardManager.loadBoard('OriginalBoard');
        expect(original.components).toHaveLength(1);
        expect(original.components[0].type).toBe('INPUT');
    });
});

describe('Auto-Save Event Triggers', () => {
    let state;
    let autoSaveManager;
    let mockStorage;
    let storageAdapter;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();

        autoSaveManager = new AutoSaveManager({
            state,
            storage: storageAdapter
        });

        autoSaveManager.setupAutoSave();
    });

    afterEach(() => {
        autoSaveManager.clearAutoSave();
        vi.useRealTimers();
    });

    it('should trigger auto-save on BOARD_CHANGED event', () => {
        const saveSpy = vi.spyOn(autoSaveManager, 'saveBoardState');

        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

        vi.advanceTimersByTime(1100);

        expect(saveSpy).toHaveBeenCalled();
    });

    it('should trigger auto-save on TRUTH_TABLE_STATE_CHANGED event', () => {
        const saveSpy = vi.spyOn(autoSaveManager, 'saveBoardState');

        state.setTruthTableState({ width: 500 });

        vi.advanceTimersByTime(1100);

        expect(saveSpy).toHaveBeenCalled();
    });

    it('should call clearBoardState on BOARD_CLEARED event', () => {
        const clearSpy = vi.spyOn(autoSaveManager, 'clearBoardState');

        // Trigger the event
        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

        // The handler should have been called (even though it's async)
        expect(clearSpy).toHaveBeenCalled();
    });

    it('should stop auto-save when clearAutoSave is called', () => {
        const saveSpy = vi.spyOn(autoSaveManager, 'saveBoardState');

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Clear auto-save before timer fires
        autoSaveManager.clearAutoSave();

        vi.advanceTimersByTime(2000);

        expect(saveSpy).not.toHaveBeenCalled();
    });
});
