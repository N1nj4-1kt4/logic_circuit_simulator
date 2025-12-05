/**
 * Unit tests for BoardOperations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BoardOperations } from '../../../src/core/BoardOperations.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import {
    BoardNameRequiredError,
    BoardSaveError,
    BoardLoadError
} from '../../../src/core/errors.js';

const createMockBoardManager = () => ({
    saveBoard: vi.fn().mockResolvedValue(true),
    loadBoard: vi.fn().mockResolvedValue(null),
    deleteBoard: vi.fn().mockResolvedValue(true),
    getAllBoards: vi.fn().mockResolvedValue({})
});

const createMockContextManager = () => ({
    saveCurrentContext: vi.fn().mockResolvedValue(undefined),
    loadCircuitContext: vi.fn()
});

describe('BoardOperations', () => {
    let state;
    let operations;
    let mockBoardManager;
    let mockContextManager;

    beforeEach(() => {
        state = new CircuitState();
        mockBoardManager = createMockBoardManager();
        mockContextManager = createMockContextManager();

        operations = new BoardOperations({
            state,
            boardManager: mockBoardManager,
            contextManager: mockContextManager
        });

        // Clear event bus before each test
        eventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ====================================
    // Save Current Board Tests
    // ====================================

    describe('Save Current Board', () => {
        it('throws BoardNameRequiredError for empty name', async () => {
            await expect(operations.saveCurrentBoard('')).rejects.toThrow(BoardNameRequiredError);
            await expect(operations.saveCurrentBoard('   ')).rejects.toThrow(BoardNameRequiredError);
        });

        it('throws BoardNameRequiredError for null/undefined', async () => {
            await expect(operations.saveCurrentBoard(null)).rejects.toThrow(BoardNameRequiredError);
            await expect(operations.saveCurrentBoard(undefined)).rejects.toThrow(BoardNameRequiredError);
        });

        it('saves board and updates state', async () => {
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            mockBoardManager.saveBoard.mockResolvedValue(true);
            mockBoardManager.getAllBoards.mockResolvedValue({ 'TestBoard': {} });

            const result = await operations.saveCurrentBoard('TestBoard');

            expect(result).toBe('TestBoard');
            expect(state.getCurrentBoardName()).toBe('TestBoard');
            expect(mockBoardManager.saveBoard).toHaveBeenCalled();
        });

        it('clears current component name when saving as board', async () => {
            state.setCurrentComponentName('SomeComponent');
            mockBoardManager.saveBoard.mockResolvedValue(true);

            await operations.saveCurrentBoard('TestBoard');

            expect(state.getCurrentComponentName()).toBeNull();
        });

        it('throws BoardSaveError on failure', async () => {
            mockBoardManager.saveBoard.mockResolvedValue(false);

            await expect(operations.saveCurrentBoard('TestBoard')).rejects.toThrow(BoardSaveError);
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS after save', async () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            mockBoardManager.saveBoard.mockResolvedValue(true);
            await operations.saveCurrentBoard('TestBoard');

            expect(handler).toHaveBeenCalled();
        });

        it('updates saved boards list in state', async () => {
            mockBoardManager.saveBoard.mockResolvedValue(true);
            mockBoardManager.getAllBoards.mockResolvedValue({
                'TestBoard': { components: [], connections: [] }
            });

            await operations.saveCurrentBoard('TestBoard');

            expect(state.getSavedBoards()).toHaveProperty('TestBoard');
        });

        it('includes truth table state in saved data', async () => {
            state.setTruthTableState({ width: 500, height: 300 });
            mockBoardManager.saveBoard.mockResolvedValue(true);

            await operations.saveCurrentBoard('TestBoard');

            expect(mockBoardManager.saveBoard).toHaveBeenCalledWith(
                'TestBoard',
                expect.objectContaining({
                    truthTableState: { width: 500, height: 300 }
                })
            );
        });

        it('updates lastSavedState after successful save', async () => {
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            state.setTruthTableState({ width: 400 });
            mockBoardManager.saveBoard.mockResolvedValue(true);

            await operations.saveCurrentBoard('TestBoard');

            const lastSavedState = state.getLastSavedState();
            expect(lastSavedState).not.toBeNull();
            expect(lastSavedState.components).toHaveLength(1);
            expect(lastSavedState.truthTableState).toEqual({ width: 400 });
        });
    });

    // ====================================
    // Load Board Tests
    // ====================================

    describe('Load Board', () => {
        it('loads board and updates state', async () => {
            const boardData = {
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100 }],
                connections: [],
                nextId: 2
            };
            mockBoardManager.loadBoard.mockResolvedValue(boardData);

            const result = await operations.loadBoard('TestBoard');

            expect(result).toBe('TestBoard');
            expect(mockContextManager.loadCircuitContext).toHaveBeenCalledWith(
                boardData,
                { type: 'board', name: 'TestBoard' }
            );
        });

        it('saves current context before loading', async () => {
            mockBoardManager.loadBoard.mockResolvedValue({
                components: [],
                connections: []
            });

            await operations.loadBoard('TestBoard');

            expect(mockContextManager.saveCurrentContext).toHaveBeenCalled();
        });

        it('throws BoardLoadError when board not found', async () => {
            mockBoardManager.loadBoard.mockResolvedValue(null);

            await expect(operations.loadBoard('NonExistent')).rejects.toThrow(BoardLoadError);
        });

        it('passes board data to context manager', async () => {
            const boardData = {
                components: [{ id: 1, type: 'INPUT' }],
                connections: [{ from: 1, to: 2 }],
                nextId: 3,
                customComponents: { 'MyComp': {} },
                truthTableState: { width: 600 }
            };
            mockBoardManager.loadBoard.mockResolvedValue(boardData);

            await operations.loadBoard('TestBoard');

            expect(mockContextManager.loadCircuitContext).toHaveBeenCalledWith(
                boardData,
                { type: 'board', name: 'TestBoard' }
            );
        });
    });

    // ====================================
    // Create New Board Tests
    // ====================================

    describe('Create New Board', () => {
        it('creates new board when no unsaved changes', () => {
            const showSaveOptionsDialog = vi.fn();
            const onCreated = vi.fn();

            operations.createNewBoard(showSaveOptionsDialog, onCreated);

            expect(showSaveOptionsDialog).not.toHaveBeenCalled();
            expect(onCreated).toHaveBeenCalled();
            expect(state.getComponents()).toHaveLength(0);
            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('shows save options dialog when unsaved changes exist', () => {
            // Add component to create unsaved changes
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            state.setLastSavedState('{}'); // Different from current state

            const showSaveOptionsDialog = vi.fn();
            operations.createNewBoard(showSaveOptionsDialog);

            expect(showSaveOptionsDialog).toHaveBeenCalled();
        });

        it('emits BOARD_CLEARED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_CLEARED, handler);

            operations.createNewBoard(vi.fn());

            expect(handler).toHaveBeenCalled();
        });

        it('emits CANVAS_REDRAW event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            operations.createNewBoard(vi.fn());

            expect(handler).toHaveBeenCalled();
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            operations.createNewBoard(vi.fn());

            expect(handler).toHaveBeenCalled();
        });

        it('clears current component name', () => {
            state.setCurrentComponentName('SomeComponent');

            operations.createNewBoard(vi.fn());

            expect(state.getCurrentComponentName()).toBeNull();
        });

        it('calls onCreated callback when dialog is bypassed', () => {
            const onCreated = vi.fn();

            operations.createNewBoard(vi.fn(), onCreated);

            expect(onCreated).toHaveBeenCalled();
        });

        it('sets lastSavedState to null for new board', () => {
            // Set up an existing saved state
            state.setLastSavedState({
                components: [{ id: 1, type: 'INPUT' }],
                connections: [],
                nextId: 2
            });

            operations.createNewBoard(vi.fn());

            // New board should have no saved state (never saved)
            expect(state.getLastSavedState()).toBeNull();
        });
    });

    // ====================================
    // Revert to Saved Tests
    // ====================================

    describe('Revert to Saved', () => {
        it('returns false when no lastSavedState exists', () => {
            // Ensure no saved state
            state.setLastSavedState(null);

            const result = operations.revertToSaved();

            expect(result).toBe(false);
        });

        it('restores working state from lastSavedState', () => {
            // Set up saved state
            const savedState = {
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' },
                    { id: 2, type: 'OUTPUT', x: 200, y: 100, label: 'O1' }
                ],
                connections: [{ from: 1, fromPort: 0, to: 2, toPort: 0 }],
                nextId: 3,
                truthTableState: { width: 400, height: 300 }
            };
            state.setLastSavedState(savedState);

            // Make changes to working state
            state.addComponent({
                id: 5, type: 'AND', x: 300, y: 200,
                inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}]
            });

            const result = operations.revertToSaved();

            expect(result).toBe(true);
            expect(state.getComponents()).toHaveLength(2);
            expect(state.getConnections()).toHaveLength(1);
            expect(state.getTruthTableState()).toEqual({ width: 400, height: 300 });
        });

        it('emits BOARD_LOADED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_LOADED, handler);

            state.setLastSavedState({
                components: [],
                connections: [],
                nextId: 1
            });

            operations.revertToSaved();

            expect(handler).toHaveBeenCalled();
        });

        it('emits CANVAS_REDRAW event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            state.setLastSavedState({
                components: [],
                connections: [],
                nextId: 1
            });

            operations.revertToSaved();

            expect(handler).toHaveBeenCalled();
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            state.setLastSavedState({
                components: [],
                connections: [],
                nextId: 1
            });

            operations.revertToSaved();

            expect(handler).toHaveBeenCalled();
        });

        it('preserves truth table state from lastSavedState', () => {
            const truthTableState = {
                width: 500,
                height: 400,
                columnOrder: ['I1', 'O1'],
                visible: true
            };
            state.setLastSavedState({
                components: [],
                connections: [],
                nextId: 1,
                truthTableState
            });

            operations.revertToSaved();

            expect(state.getTruthTableState()).toEqual(truthTableState);
        });

        it('handles lastSavedState with no truthTableState', () => {
            state.setLastSavedState({
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100 }],
                connections: [],
                nextId: 2
                // No truthTableState
            });

            // Set current truth table state
            state.setTruthTableState({ width: 300 });

            const result = operations.revertToSaved();

            expect(result).toBe(true);
            // Should have restored components
            expect(state.getComponents()).toHaveLength(1);
        });

        it('does not modify lastSavedState after revert', () => {
            const savedState = {
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' }],
                connections: [],
                nextId: 2
            };
            state.setLastSavedState(savedState);

            operations.revertToSaved();

            // lastSavedState should remain unchanged
            const currentSavedState = state.getLastSavedState();
            expect(currentSavedState.components).toHaveLength(1);
            expect(currentSavedState.nextId).toBe(2);
        });
    });

    // ====================================
    // Delete Board Tests
    // ====================================

    describe('Delete Board', () => {
        it('deletes board and updates state', async () => {
            mockBoardManager.deleteBoard.mockResolvedValue(true);
            mockBoardManager.getAllBoards.mockResolvedValue({});

            const result = await operations.deleteBoard('TestBoard');

            expect(result).toBe('TestBoard');
            expect(mockBoardManager.deleteBoard).toHaveBeenCalledWith('TestBoard');
        });

        it('throws BoardSaveError on failure', async () => {
            mockBoardManager.deleteBoard.mockResolvedValue(false);

            await expect(operations.deleteBoard('TestBoard')).rejects.toThrow(BoardSaveError);
        });

        it('clears circuit when deleting current board', async () => {
            state.setCurrentBoardName('TestBoard');
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            mockBoardManager.deleteBoard.mockResolvedValue(true);

            await operations.deleteBoard('TestBoard');

            expect(state.getComponents()).toHaveLength(0);
            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('does not clear circuit when deleting different board', async () => {
            state.setCurrentBoardName('CurrentBoard');
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });
            mockBoardManager.deleteBoard.mockResolvedValue(true);

            await operations.deleteBoard('OtherBoard');

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getCurrentBoardName()).toBe('CurrentBoard');
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS after delete', async () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            mockBoardManager.deleteBoard.mockResolvedValue(true);
            await operations.deleteBoard('TestBoard');

            expect(handler).toHaveBeenCalled();
        });

        it('emits CANVAS_REDRAW when deleting current board', async () => {
            state.setCurrentBoardName('TestBoard');
            mockBoardManager.deleteBoard.mockResolvedValue(true);

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            await operations.deleteBoard('TestBoard');

            expect(handler).toHaveBeenCalled();
        });

        it('updates saved boards list in state', async () => {
            state.setSavedBoards({ 'TestBoard': {}, 'OtherBoard': {} });
            mockBoardManager.deleteBoard.mockResolvedValue(true);
            mockBoardManager.getAllBoards.mockResolvedValue({ 'OtherBoard': {} });

            await operations.deleteBoard('TestBoard');

            expect(state.getSavedBoards()).not.toHaveProperty('TestBoard');
        });
    });
});
