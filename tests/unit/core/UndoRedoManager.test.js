/**
 * Unit tests for UndoRedoManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UndoRedoManager } from '../../../src/core/UndoRedoManager.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import { UNDO_REDO } from '../../../src/constants.js';

const createMockStorage = () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
});

describe('UndoRedoManager', () => {
    let state;
    let manager;
    let mockStorage;

    beforeEach(() => {
        state = new CircuitState();
        mockStorage = createMockStorage();

        manager = new UndoRedoManager({
            state,
            storage: mockStorage,
            maxHistorySize: 5 // Use smaller size for testing
        });

        // Initialize lastKnownState so captureSnapshot works correctly
        manager.initializeLastKnownState();

        // Clear event bus before each test
        eventBus.clear();
    });

    afterEach(() => {
        manager.teardownListeners();
        vi.restoreAllMocks();
    });

    describe('Initial State', () => {
        it('should start with empty undo/redo stacks', () => {
            expect(manager.canUndo()).toBe(false);
            expect(manager.canRedo()).toBe(false);
            expect(manager.getUndoStackSize()).toBe(0);
            expect(manager.getRedoStackSize()).toBe(0);
        });

        it('should use default max history size from constants', () => {
            const managerWithDefaults = new UndoRedoManager({
                state,
                storage: mockStorage
            });
            expect(managerWithDefaults.maxHistorySize).toBe(UNDO_REDO.MAX_HISTORY_SIZE);
        });
    });

    describe('Snapshot Capture', () => {
        it('should capture state on captureSnapshot', () => {
            // Add a component to the state
            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });

            manager.captureSnapshot('component:added');

            expect(manager.canUndo()).toBe(true);
            expect(manager.getUndoStackSize()).toBe(1);
        });

        it('should clear redo stack when capturing new snapshot', () => {
            // Capture initial state
            manager.captureSnapshot('initial');

            // Simulate undo (manually push to redo)
            manager.undoStack.pop();
            manager.redoStack.push({ action: 'test', timestamp: Date.now(), state: {} });

            expect(manager.canRedo()).toBe(true);

            // Capture new state - should clear redo
            manager.captureSnapshot('new');

            expect(manager.canRedo()).toBe(false);
        });

        it('should enforce max history size with FIFO', () => {
            for (let i = 0; i < 10; i++) {
                manager.captureSnapshot(`action-${i}`);
            }

            // Max size is 5, so oldest entries should be removed
            expect(manager.getUndoStackSize()).toBe(5);
        });

        it('should not capture during restore (isRestoring flag)', () => {
            manager.isRestoring = true;
            manager.captureSnapshot('should-be-ignored');
            manager.isRestoring = false;

            expect(manager.getUndoStackSize()).toBe(0);
        });
    });

    describe('Undo Operation', () => {
        beforeEach(() => {
            // Setup initial state manually (without triggering events)
            state.components.push({ id: 1, type: 'AND', x: 100, y: 100 });
            state.nextId = 2;
            // Re-initialize lastKnownState after adding component
            manager.initializeLastKnownState();
        });

        it('should return false when undo stack is empty', () => {
            expect(manager.undo()).toBe(false);
        });

        it('should restore previous state on undo', () => {
            // Capture after current state (simulates an action happening)
            // lastKnownState has {x: 100}, this will push it when called
            manager.captureSnapshot('action');

            // Modify state to {x: 200}
            state.components[0].x = 200;
            state.components[0].y = 200;

            // Undo should restore previous state (x=100)
            const result = manager.undo();

            expect(result).toBe(true);
            expect(state.getComponent(1).x).toBe(100);
        });

        it('should push current state to redo stack on undo', () => {
            manager.captureSnapshot('state-1');

            expect(manager.canRedo()).toBe(false);

            manager.undo();

            expect(manager.canRedo()).toBe(true);
        });

        it('should emit UNDO_REDO_STATE_CHANGED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.UNDO_REDO_STATE_CHANGED, handler);

            manager.captureSnapshot('state-1');
            manager.undo();

            expect(handler).toHaveBeenCalledWith({
                canUndo: false,
                canRedo: true
            });
        });
    });

    describe('Redo Operation', () => {
        it('should return false when redo stack is empty', () => {
            expect(manager.redo()).toBe(false);
        });

        it('should restore next state on redo', () => {
            // Manually add component without triggering events
            state.components.push({ id: 1, type: 'AND', x: 100, y: 100 });
            // Re-initialize lastKnownState after adding component
            manager.initializeLastKnownState();

            // Capture snapshot (pushes lastKnownState with x=100 to undo stack)
            manager.captureSnapshot('action');

            // Modify state to x=200
            state.components[0].x = 200;
            state.components[0].y = 200;

            // Undo to go back to initial (x=100)
            manager.undo();
            expect(state.getComponent(1).x).toBe(100);

            // Redo to go forward to modified (x=200)
            const result = manager.redo();

            expect(result).toBe(true);
            expect(state.getComponent(1).x).toBe(200);
        });

        it('should push current state to undo stack on redo', () => {
            manager.captureSnapshot('state-1');
            manager.undo();

            const undoSizeBefore = manager.getUndoStackSize();
            manager.redo();

            expect(manager.getUndoStackSize()).toBe(undoSizeBefore + 1);
        });
    });

    describe('Clear History', () => {
        it('should clear both stacks', () => {
            manager.captureSnapshot('state-1');
            manager.captureSnapshot('state-2');
            manager.undo();

            manager.clearHistory();

            expect(manager.canUndo()).toBe(false);
            expect(manager.canRedo()).toBe(false);
            expect(manager.getUndoStackSize()).toBe(0);
            expect(manager.getRedoStackSize()).toBe(0);
        });

        it('should reset coalescing state', () => {
            manager.startCoalescing();
            expect(manager.isCoalescing).toBe(true);

            manager.clearHistory();

            expect(manager.isCoalescing).toBe(false);
            expect(manager.preCoalesceSnapshot).toBeNull();
        });
    });

    describe('Coalescing (Drag Operations)', () => {
        beforeEach(() => {
            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });
        });

        it('should capture pre-drag state on startCoalescing', () => {
            manager.startCoalescing();

            expect(manager.isCoalescing).toBe(true);
            expect(manager.preCoalesceSnapshot).not.toBeNull();
        });

        it('should not double-start coalescing', () => {
            manager.startCoalescing();
            const firstSnapshot = manager.preCoalesceSnapshot;

            // Modify state
            state.updateComponent(1, { x: 150, y: 150 });

            // Try to start again - should be ignored
            manager.startCoalescing();

            // Should still have original pre-coalesce snapshot
            expect(manager.preCoalesceSnapshot).toBe(firstSnapshot);
        });

        it('should push single action on endCoalescing if state changed', () => {
            manager.startCoalescing();

            // Simulate drag - modify state
            state.updateComponent(1, { x: 200, y: 200 });

            manager.endCoalescing();

            expect(manager.getUndoStackSize()).toBe(1);
            expect(manager.isCoalescing).toBe(false);
        });

        it('should not push action on endCoalescing if state unchanged', () => {
            manager.startCoalescing();
            // Don't modify state
            manager.endCoalescing();

            expect(manager.getUndoStackSize()).toBe(0);
        });

        it('should ignore intermediate moves during coalescing', () => {
            manager.setupListeners();

            manager.startCoalescing();

            // Multiple move events should be ignored
            eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, { component: { id: 1 } });
            eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, { component: { id: 1 } });
            eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, { component: { id: 1 } });

            // End coalescing with state change
            state.updateComponent(1, { x: 200, y: 200 });
            manager.endCoalescing();

            // Should only have one undo action
            expect(manager.getUndoStackSize()).toBe(1);
        });
    });

    describe('Event Listeners', () => {
        beforeEach(() => {
            // Manually add a component without triggering events
            state.components.push({ id: 1, type: 'AND', x: 100, y: 100 });
            state.nextId = 2;

            // Re-initialize lastKnownState after modifying state
            manager.initializeLastKnownState();

            // Setup listeners after state is ready
            manager.setupListeners();
        });

        it('should capture on COMPONENT_ADDED', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component: { id: 2 } });

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should capture on COMPONENT_REMOVED', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.COMPONENT_REMOVED, { componentId: 1 });

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should capture on CONNECTION_ADDED', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.CONNECTION_ADDED, { connection: {} });

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should capture on CONNECTION_REMOVED', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.CONNECTION_REMOVED, { connection: {} });

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should capture on COMPONENT_LABEL_CHANGED', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.COMPONENT_LABEL_CHANGED, { component: { id: 1 } });

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should start coalescing on DRAG_STARTED', () => {
            eventBus.emit(EVENT_TYPES.DRAG_STARTED, { component: { id: 1 } });

            expect(manager.isCoalescing).toBe(true);
        });

        it('should end coalescing on DRAG_ENDED', () => {
            eventBus.emit(EVENT_TYPES.DRAG_STARTED, { component: { id: 1 } });
            // Modify state manually to simulate drag
            state.components[0].x = 200;
            state.components[0].y = 200;
            eventBus.emit(EVENT_TYPES.DRAG_ENDED, { component: { id: 1 } });

            expect(manager.isCoalescing).toBe(false);
            expect(manager.getUndoStackSize()).toBe(1);
        });

        it('should capture on BOARD_WILL_CLEAR for non-empty board', () => {
            const initialSize = manager.getUndoStackSize();
            eventBus.emit(EVENT_TYPES.BOARD_WILL_CLEAR);

            expect(manager.getUndoStackSize()).toBe(initialSize + 1);
        });

        it('should not capture on BOARD_WILL_CLEAR for empty board', () => {
            // Manually clear the state
            state.components = [];
            state.connections = [];
            manager.clearHistory();

            eventBus.emit(EVENT_TYPES.BOARD_WILL_CLEAR);

            expect(manager.getUndoStackSize()).toBe(0);
        });
    });

    describe('Persistence', () => {
        it('should save history to storage', async () => {
            manager.captureSnapshot('test');

            await manager.saveHistory('TestBoard');

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board_TestBoard',
                expect.any(String)
            );

            // Verify structure
            const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
            expect(savedData.version).toBe(1);
            expect(savedData.undoStack).toHaveLength(1);
            expect(savedData.redoStack).toHaveLength(0);
        });

        it('should use unnamed key for null board name', async () => {
            await manager.saveHistory(null);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board__unnamed_',
                expect.any(String)
            );
        });

        it('should load history from storage', async () => {
            const historyData = {
                version: 1,
                undoStack: [{ action: 'test', timestamp: Date.now(), state: {} }],
                redoStack: []
            };
            mockStorage.getItem.mockResolvedValue(JSON.stringify(historyData));

            await manager.loadHistory('TestBoard');

            expect(manager.getUndoStackSize()).toBe(1);
        });

        it('should start fresh if no saved history', async () => {
            mockStorage.getItem.mockResolvedValue(null);

            await manager.loadHistory('TestBoard');

            expect(manager.getUndoStackSize()).toBe(0);
            expect(manager.getRedoStackSize()).toBe(0);
        });

        it('should start fresh on storage error', async () => {
            mockStorage.getItem.mockRejectedValue(new Error('Storage error'));

            await manager.loadHistory('TestBoard');

            expect(manager.getUndoStackSize()).toBe(0);
        });

        it('should delete history from storage', async () => {
            await manager.deleteHistory('TestBoard');

            expect(mockStorage.removeItem).toHaveBeenCalledWith('undoredo_board_TestBoard');
        });
    });

    describe('Board Switching', () => {
        it('should save current and load new on board switch', async () => {
            manager.captureSnapshot('state-1');

            await manager.onBoardSwitch('BoardA', 'BoardB');

            // Should save BoardA's history
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board_BoardA',
                expect.any(String)
            );

            // Should load BoardB's history
            expect(mockStorage.getItem).toHaveBeenCalledWith('undoredo_board_BoardB');
        });

        it('should migrate history on first save (unnamed to named)', async () => {
            manager.captureSnapshot('state-1');

            await manager.onBoardSwitch(null, 'NewBoard', true);

            // Should save to new board name
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board_NewBoard',
                expect.any(String)
            );

            // Should delete unnamed history
            expect(mockStorage.removeItem).toHaveBeenCalledWith('undoredo_board__unnamed_');
        });

        it('should not switch if same board', async () => {
            await manager.onBoardSwitch('BoardA', 'BoardA');

            expect(mockStorage.setItem).not.toHaveBeenCalled();
            expect(mockStorage.getItem).not.toHaveBeenCalled();
        });
    });

    describe('Save As', () => {
        it('should save original history and clear for new board', async () => {
            manager.captureSnapshot('state-1');
            manager.captureSnapshot('state-2');

            await manager.onSaveAs('OriginalBoard', 'NewBoard');

            // Should save original board's history
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board_OriginalBoard',
                expect.any(String)
            );

            // History should be cleared for new board
            expect(manager.getUndoStackSize()).toBe(0);

            // Should save empty history for new board
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'undoredo_board_NewBoard',
                expect.any(String)
            );
        });

        it('should just clear history if original board has no name', async () => {
            manager.captureSnapshot('state-1');

            await manager.onSaveAs(null, 'NewBoard');

            // History should be cleared
            expect(manager.getUndoStackSize()).toBe(0);
        });
    });

    describe('Event Emission', () => {
        it('should emit state changed on capture', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.UNDO_REDO_STATE_CHANGED, handler);

            manager.captureSnapshot('test');

            expect(handler).toHaveBeenCalledWith({
                canUndo: true,
                canRedo: false
            });
        });

        it('should emit state changed on clear', () => {
            const handler = vi.fn();
            manager.captureSnapshot('test');

            eventBus.on(EVENT_TYPES.UNDO_REDO_STATE_CHANGED, handler);
            manager.clearHistory();

            expect(handler).toHaveBeenCalledWith({
                canUndo: false,
                canRedo: false
            });
        });

        it('should emit state changed on load', async () => {
            const historyData = {
                version: 1,
                undoStack: [{ action: 'test', timestamp: Date.now(), state: {} }],
                redoStack: []
            };
            mockStorage.getItem.mockResolvedValue(JSON.stringify(historyData));

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.UNDO_REDO_STATE_CHANGED, handler);

            await manager.loadHistory('TestBoard');

            expect(handler).toHaveBeenCalledWith({
                canUndo: true,
                canRedo: false
            });
        });
    });

    describe('Listener Cleanup', () => {
        it('should remove all event listeners on teardown', () => {
            manager.setupListeners();
            manager.teardownListeners();

            // Events should not trigger captures
            eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component: {} });
            eventBus.emit(EVENT_TYPES.CONNECTION_ADDED, { connection: {} });

            expect(manager.getUndoStackSize()).toBe(0);
        });
    });
});
