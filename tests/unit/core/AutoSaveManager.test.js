/**
 * Unit tests for AutoSaveManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AutoSaveManager } from '../../../src/core/AutoSaveManager.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

const createMockStorage = () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
});

describe('AutoSaveManager', () => {
    let state;
    let manager;
    let mockStorage;

    beforeEach(() => {
        state = new CircuitState();
        mockStorage = createMockStorage();

        manager = new AutoSaveManager({
            state,
            storage: mockStorage
        });

        // Clear event bus before each test
        eventBus.clear();

        // Clear timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        manager.clearAutoSave();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Setup and Teardown', () => {
        it('sets up event listeners on setupAutoSave', () => {
            manager.setupAutoSave();

            // Emit an event and check if handler is called
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );
        });

        it('removes event listeners on clearAutoSave', () => {
            manager.setupAutoSave();
            manager.clearAutoSave();

            // Emit event - should not trigger save
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).not.toHaveBeenCalled();
        });

        it('clears timer on clearAutoSave', () => {
            manager.setupAutoSave();

            // Start debounce timer
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Clear before timer fires
            manager.clearAutoSave();
            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('Auto-Save on Events', () => {
        beforeEach(() => {
            manager.setupAutoSave();
        });

        it('saves board state on BOARD_CHANGED event after debounce', async () => {
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Fast-forward past debounce delay
            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );
        });

        it('saves board state on BOARD_LOADED event after debounce', async () => {
            eventBus.emit(EVENT_TYPES.BOARD_LOADED);

            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );
        });

        it('saves board state on TRUTH_TABLE_STATE_CHANGED event after debounce', async () => {
            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED);

            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );
        });

        it('saves board state on THEME_CHANGED event after debounce', async () => {
            eventBus.emit(EVENT_TYPES.THEME_CHANGED);

            vi.advanceTimersByTime(1500);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );
        });

        it('debounces rapid changes', async () => {
            // Emit multiple rapid changes
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            vi.advanceTimersByTime(1500);

            // Should only save once due to debouncing
            expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
        });

        it('saves board state on BOARD_CLEARED event immediately (preserves lastSavedState for revert)', async () => {
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

            // BOARD_CLEARED triggers immediate save (no debounce) to preserve lastSavedState
            await vi.runAllTimersAsync();

            expect(mockStorage.setItem).toHaveBeenCalledWith('currentBoard', expect.any(String));
        });
    });

    describe('Save Board State', () => {
        it('saves all relevant state properties', async () => {
            // Set up state
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            state.setCurrentBoardName('TestBoard');
            state.setTruthTableState({ width: 500, height: 300 });

            await manager.saveBoardState();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'currentBoard',
                expect.any(String)
            );

            // Parse saved data to verify contents
            const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
            expect(savedData.components).toHaveLength(1);
            expect(savedData.currentBoardName).toBe('TestBoard');
            expect(savedData.truthTableState).toEqual({ width: 500, height: 300 });
        });

        it('handles save errors silently', async () => {
            mockStorage.setItem.mockRejectedValue(new Error('Storage full'));

            // Should not throw
            await expect(manager.saveBoardState()).resolves.not.toThrow();
        });

        it('persists lastSavedState alongside working state', async () => {
            // Set up state with a lastSavedState (stored separately, not in working state)
            const lastSaved = {
                components: [{ id: 1, type: 'AND', x: 50, y: 50 }],
                connections: [],
                nextId: 2,
                truthTableState: null
            };
            state.setLastSavedState(lastSaved);

            // Add a component to working state (this is a separate change from lastSaved)
            state.addComponent({
                id: 2, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });

            await manager.saveBoardState();

            const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
            // lastSavedState should be persisted as-is (for revert functionality)
            expect(savedData.lastSavedState).toEqual(lastSaved);
            // Working state has 1 component (the one we just added)
            // Note: lastSavedState is a separate snapshot, not part of working state
            expect(savedData.components).toHaveLength(1);
        });
    });

    describe('Load Board State', () => {
        it('loads board state from storage', async () => {
            const savedState = JSON.stringify({
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' }],
                connections: [],
                nextId: 2,
                currentBoardName: 'SavedBoard'
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            await manager.loadBoardState();

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getCurrentBoardName()).toBe('SavedBoard');
        });

        it('restores truth table state', async () => {
            const savedState = JSON.stringify({
                components: [],
                connections: [],
                nextId: 1,
                truthTableState: { width: 600, height: 400, columnOrder: ['I1', 'O1'] }
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            await manager.loadBoardState();

            expect(state.getTruthTableState()).toEqual({
                width: 600, height: 400, columnOrder: ['I1', 'O1']
            });
        });

        it('restores current component name', async () => {
            const savedState = JSON.stringify({
                components: [],
                connections: [],
                nextId: 1,
                currentComponentName: 'MyComponent'
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            await manager.loadBoardState();

            expect(state.getCurrentComponentName()).toBe('MyComponent');
        });

        it('handles empty storage gracefully', async () => {
            mockStorage.getItem.mockResolvedValue(null);

            await manager.loadBoardState();

            expect(state.getComponents()).toHaveLength(0);
        });

        it('handles load errors silently', async () => {
            mockStorage.getItem.mockRejectedValue(new Error('Storage error'));

            // Should not throw
            await expect(manager.loadBoardState()).resolves.not.toThrow();
        });

        it('restores lastSavedState when present', async () => {
            const lastSaved = {
                components: [{ id: 1, type: 'AND', x: 50, y: 50 }],
                connections: [],
                nextId: 2,
                truthTableState: null
            };
            const savedState = JSON.stringify({
                components: [{ id: 1, type: 'AND', x: 50, y: 50 }, { id: 2, type: 'INPUT', x: 100, y: 100 }],
                connections: [],
                nextId: 3,
                lastSavedState: lastSaved
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            await manager.loadBoardState();

            expect(state.getLastSavedState()).toEqual(lastSaved);
            expect(state.getComponents()).toHaveLength(2); // Working state has 2 components
        });

        it('sets lastSavedState to null when migrating from old format (no lastSavedState)', async () => {
            // Old format: no lastSavedState field
            const savedState = JSON.stringify({
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' }],
                connections: [],
                nextId: 2,
                currentBoardName: 'OldBoard'
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            await manager.loadBoardState();

            // Migration: treat as never saved
            expect(state.getLastSavedState()).toBeNull();
            expect(state.getComponents()).toHaveLength(1);
        });

        it('handles invalid JSON gracefully', async () => {
            mockStorage.getItem.mockResolvedValue('invalid json {');

            // Should not throw
            await expect(manager.loadBoardState()).resolves.not.toThrow();
            expect(state.getComponents()).toHaveLength(0);
        });

        it('calls truthTableManager.recomputeTruthTable if provided', async () => {
            const savedState = JSON.stringify({
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' }],
                connections: [],
                nextId: 2
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            const mockTruthTableManager = {
                recomputeTruthTable: vi.fn()
            };

            await manager.loadBoardState(mockTruthTableManager);

            expect(mockTruthTableManager.recomputeTruthTable).toHaveBeenCalled();
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS after loading', async () => {
            const savedState = JSON.stringify({
                components: [],
                connections: [],
                nextId: 1
            });
            mockStorage.getItem.mockResolvedValue(savedState);

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            await manager.loadBoardState();

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('Clear Board State', () => {
        it('removes currentBoard from storage', async () => {
            await manager.clearBoardState();

            expect(mockStorage.removeItem).toHaveBeenCalledWith('currentBoard');
        });

        it('handles clear errors silently', async () => {
            mockStorage.removeItem.mockRejectedValue(new Error('Storage error'));

            // Should not throw
            await expect(manager.clearBoardState()).resolves.not.toThrow();
        });
    });
});
