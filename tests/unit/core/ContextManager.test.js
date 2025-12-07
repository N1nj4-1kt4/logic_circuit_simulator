/**
 * Unit tests for ContextManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContextManager } from '../../../src/core/ContextManager.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

const createMockBoardManager = () => ({
    saveBoard: vi.fn().mockResolvedValue(true),
    loadBoard: vi.fn().mockResolvedValue(null)
});

const createMockComponentLibrary = () => ({
    saveComponent: vi.fn().mockResolvedValue(true),
    loadComponent: vi.fn().mockResolvedValue(null)
});

const createMockCircuitAnalysisManager = () => ({
    recomputeAnalysis: vi.fn()
});

describe('ContextManager', () => {
    let state;
    let manager;
    let mockBoardManager;
    let mockComponentLibrary;
    let mockCircuitAnalysisManager;

    beforeEach(() => {
        state = new CircuitState();
        mockBoardManager = createMockBoardManager();
        mockComponentLibrary = createMockComponentLibrary();
        mockCircuitAnalysisManager = createMockCircuitAnalysisManager();

        manager = new ContextManager({
            state,
            boardManager: mockBoardManager,
            componentLibrary: mockComponentLibrary,
            circuitAnalysisManager: mockCircuitAnalysisManager
        });

        // Clear event bus before each test
        eventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ====================================
    // Save Current Context Tests
    // ====================================

    describe('Save Current Context', () => {
        it('saves board when currentBoardName is set', async () => {
            state.setCurrentBoardName('TestBoard');
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });

            await manager.saveCurrentContext();

            expect(mockBoardManager.saveBoard).toHaveBeenCalledWith(
                'TestBoard',
                expect.objectContaining({
                    components: expect.any(Array),
                    connections: expect.any(Array)
                })
            );
        });

        it('saves component when currentComponentName is set', async () => {
            state.setCurrentComponentName('TestComp');
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [], value: 0, label: 'I1'
            });

            // Mock loading existing component
            mockComponentLibrary.loadComponent.mockResolvedValue({
                name: 'TestComp',
                description: 'Test description',
                inputPorts: [],
                outputPorts: []
            });

            await manager.saveCurrentContext();

            expect(mockComponentLibrary.loadComponent).toHaveBeenCalledWith('TestComp');
            expect(mockComponentLibrary.saveComponent).toHaveBeenCalledWith(
                'TestComp',
                expect.objectContaining({
                    name: 'TestComp',
                    components: expect.any(Array),
                    connections: expect.any(Array)
                })
            );
        });

        it('does nothing when no context is set', async () => {
            await manager.saveCurrentContext();

            expect(mockBoardManager.saveBoard).not.toHaveBeenCalled();
            expect(mockComponentLibrary.saveComponent).not.toHaveBeenCalled();
        });

        it('includes truth table state when saving board', async () => {
            state.setCurrentBoardName('TestBoard');
            state.setTruthTablePanelState({ width: 500, height: 300 });

            await manager.saveCurrentContext();

            expect(mockBoardManager.saveBoard).toHaveBeenCalledWith(
                'TestBoard',
                expect.objectContaining({
                    truthTablePanelState: { width: 500, height: 300 }
                })
            );
        });

        it('includes truth table state when saving component', async () => {
            state.setCurrentComponentName('TestComp');
            state.setTruthTablePanelState({ width: 600, height: 400 });

            mockComponentLibrary.loadComponent.mockResolvedValue({
                name: 'TestComp'
            });

            await manager.saveCurrentContext();

            expect(mockComponentLibrary.saveComponent).toHaveBeenCalledWith(
                'TestComp',
                expect.objectContaining({
                    truthTablePanelState: { width: 600, height: 400 }
                })
            );
        });

        it('preserves existing component metadata when saving', async () => {
            state.setCurrentComponentName('TestComp');

            mockComponentLibrary.loadComponent.mockResolvedValue({
                name: 'TestComp',
                description: 'Original description',
                inputPorts: [{ label: 'A', id: 1 }],
                outputPorts: [{ label: 'Q', id: 2 }]
            });

            await manager.saveCurrentContext();

            expect(mockComponentLibrary.saveComponent).toHaveBeenCalledWith(
                'TestComp',
                expect.objectContaining({
                    description: 'Original description',
                    inputPorts: [{ label: 'A', id: 1 }],
                    outputPorts: [{ label: 'Q', id: 2 }]
                })
            );
        });

        it('does not save component if loadComponent returns null', async () => {
            state.setCurrentComponentName('TestComp');
            mockComponentLibrary.loadComponent.mockResolvedValue(null);

            await manager.saveCurrentContext();

            expect(mockComponentLibrary.saveComponent).not.toHaveBeenCalled();
        });
    });

    // ====================================
    // Load Circuit Context Tests
    // ====================================

    describe('Load Circuit Context', () => {
        it('loads components into state', () => {
            const circuitData = {
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100 },
                    { id: 2, type: 'OUTPUT', x: 300, y: 100 }
                ],
                connections: [],
                nextId: 3
            };

            manager.loadCircuitContext(circuitData, { type: 'board', name: 'TestBoard' });

            expect(state.getComponents()).toHaveLength(2);
        });

        it('loads connections into state', () => {
            const circuitData = {
                components: [],
                connections: [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ],
                nextId: 3
            };

            manager.loadCircuitContext(circuitData, { type: 'board', name: 'TestBoard' });

            expect(state.getConnections()).toHaveLength(1);
        });

        it('sets current board name for board context', () => {
            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(state.getCurrentBoardName()).toBe('TestBoard');
            expect(state.getCurrentComponentName()).toBeNull();
        });

        it('sets current component name for component context', () => {
            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'component', name: 'TestComp' }
            );

            expect(state.getCurrentComponentName()).toBe('TestComp');
            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('restores truth table state', () => {
            const circuitData = {
                components: [],
                connections: [],
                truthTablePanelState: { width: 500, height: 300, columnOrder: ['I1', 'O1'] }
            };

            manager.loadCircuitContext(circuitData, { type: 'board', name: 'TestBoard' });

            expect(state.getTruthTablePanelState()).toEqual({
                width: 500, height: 300, columnOrder: ['I1', 'O1']
            });
        });

        it('clears truth table state if not present in data', () => {
            state.setTruthTablePanelState({ width: 500 });

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(state.getTruthTablePanelState()).toBeNull();
        });

        it('clears truth table cache', () => {
            state.setCircuitAnalysis({ isValid: true, table: [] });

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(state.getCircuitAnalysis()).toBeNull();
        });

        it('calls circuitAnalysisManager.recomputeAnalysis', () => {
            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(mockCircuitAnalysisManager.recomputeAnalysis).toHaveBeenCalled();
        });

        it('emits BOARD_LOADED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_LOADED, handler);

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(handler).toHaveBeenCalled();
        });

        it('emits CANVAS_REDRAW event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(handler).toHaveBeenCalled();
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(handler).toHaveBeenCalled();
        });

        it('preserves custom components if not provided in data', () => {
            state.setCustomComponents({ 'ExistingComp': { name: 'ExistingComp' } });

            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(state.getCustomComponents()).toHaveProperty('ExistingComp');
        });

        it('preserves existing custom components when loading data with customComponents', () => {
            // Note: CircuitState.loadState() doesn't update customComponents directly
            // The customComponents are handled by passing them to loadState which
            // preserves existing ones if not provided. This test verifies that behavior.
            state.setCustomComponents({ 'OldComp': { name: 'OldComp' } });

            manager.loadCircuitContext(
                {
                    components: [],
                    connections: [],
                    customComponents: { 'NewComp': { name: 'NewComp' } }
                },
                { type: 'board', name: 'TestBoard' }
            );

            // Custom components from data are passed but CircuitState.loadState
            // uses them via the state parameter, not direct assignment
            // The actual behavior is that customComponents are preserved if none provided
            expect(state.getCustomComponents()).toHaveProperty('OldComp');
        });

        it('updates last saved state for change detection', () => {
            manager.loadCircuitContext(
                {
                    components: [{ id: 1, type: 'INPUT', x: 100, y: 100 }],
                    connections: []
                },
                { type: 'board', name: 'TestBoard' }
            );

            // After loading, lastSavedState should be set
            // Note: lastSavedState is stored as an object via deepClone
            expect(state.getLastSavedState()).not.toBeNull();
            expect(state.getLastSavedState()).toHaveProperty('components');
        });

        it('handles missing nextId gracefully', () => {
            manager.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            // Should not throw, nextId defaults to 1
            expect(state.generateNextId()).toBe(1);
        });

        it('works without circuitAnalysisManager', () => {
            const managerWithoutTT = new ContextManager({
                state,
                boardManager: mockBoardManager,
                componentLibrary: mockComponentLibrary,
                circuitAnalysisManager: null
            });

            // Should not throw
            managerWithoutTT.loadCircuitContext(
                { components: [], connections: [] },
                { type: 'board', name: 'TestBoard' }
            );

            expect(state.getCurrentBoardName()).toBe('TestBoard');
        });
    });
});
