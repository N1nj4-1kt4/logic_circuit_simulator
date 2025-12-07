/**
 * Unit tests for CircuitState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('CircuitState', () => {
    let state;

    beforeEach(() => {
        state = new CircuitState();
        // Clear event bus before each test
        eventBus.clear();
    });

    describe('Component Management', () => {
        it('should initialize with empty components array', () => {
            expect(state.getComponents()).toEqual([]);
        });

        it('should add a component', () => {
            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            state.addComponent(component);

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getComponents()[0]).toEqual(component);
        });

        it('should emit COMPONENT_ADDED event when adding component', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);

            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            state.addComponent(component);

            expect(handler).toHaveBeenCalledWith({ component });
        });

        it('should remove a component by ID', () => {
            const component1 = { id: 1, type: 'AND', x: 100, y: 100 };
            const component2 = { id: 2, type: 'OR', x: 200, y: 200 };
            state.addComponent(component1);
            state.addComponent(component2);

            const result = state.removeComponent(1);

            expect(result).toBe(true);
            expect(state.getComponents()).toHaveLength(1);
            expect(state.getComponents()[0].id).toBe(2);
        });

        it('should emit COMPONENT_REMOVED event when removing component', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, handler);

            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            state.addComponent(component);
            state.removeComponent(1);

            expect(handler).toHaveBeenCalledWith({ componentId: 1, component });
        });

        it('should return false when removing non-existent component', () => {
            const result = state.removeComponent(999);
            expect(result).toBe(false);
        });

        it('should remove connections when removing a component', () => {
            const component1 = { id: 1, type: 'AND', x: 100, y: 100 };
            const component2 = { id: 2, type: 'OR', x: 200, y: 200 };
            state.addComponent(component1);
            state.addComponent(component2);
            state.addConnection({ from: 1, to: 2, fromPort: 0, toPort: 0 });

            state.removeComponent(1);

            expect(state.getConnections()).toHaveLength(0);
        });

        it('should update a component', () => {
            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            state.addComponent(component);

            const result = state.updateComponent(1, { x: 150, y: 150 });

            expect(result).toBe(true);
            expect(state.getComponent(1).x).toBe(150);
            expect(state.getComponent(1).y).toBe(150);
        });

        it('should get a component by ID', () => {
            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            state.addComponent(component);

            const result = state.getComponent(1);

            expect(result).toEqual(component);
        });

        it('should return null for non-existent component', () => {
            const result = state.getComponent(999);
            expect(result).toBeNull();
        });

        it('should clear all components', () => {
            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });
            state.addComponent({ id: 2, type: 'OR', x: 200, y: 200 });
            state.addConnection({ from: 1, to: 2, fromPort: 0, toPort: 0 });

            state.clearComponents();

            expect(state.getComponents()).toHaveLength(0);
            expect(state.getConnections()).toHaveLength(0);
            expect(state.generateNextId()).toBe(1);
        });
    });

    describe('ID Generation', () => {
        it('should generate sequential IDs', () => {
            expect(state.generateNextId()).toBe(1);
            expect(state.generateNextId()).toBe(2);
            expect(state.generateNextId()).toBe(3);
        });

        it('should set next ID', () => {
            state.setNextId(100);
            expect(state.generateNextId()).toBe(100);
        });
    });

    describe('Connection Management', () => {
        it('should add a connection', () => {
            const connection = { from: 1, to: 2, fromPort: 0, toPort: 0 };
            state.addConnection(connection);

            expect(state.getConnections()).toHaveLength(1);
            expect(state.getConnections()[0]).toEqual(connection);
        });

        it('should emit CONNECTION_ADDED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CONNECTION_ADDED, handler);

            const connection = { from: 1, to: 2, fromPort: 0, toPort: 0 };
            state.addConnection(connection);

            expect(handler).toHaveBeenCalledWith({ connection });
        });

        it('should remove a connection', () => {
            const connection = { from: 1, to: 2, fromPort: 0, toPort: 0 };
            state.addConnection(connection);

            const result = state.removeConnection(connection);

            expect(result).toBe(true);
            expect(state.getConnections()).toHaveLength(0);
        });

        it('should return false when removing non-existent connection', () => {
            const result = state.removeConnection({ from: 1, to: 2 });
            expect(result).toBe(false);
        });
    });

    describe('Mode and Tool Management', () => {
        it('should initialize with place mode', () => {
            expect(state.getMode()).toBe('place');
        });

        it('should set mode', () => {
            state.setMode('connect');
            expect(state.getMode()).toBe('connect');
        });

        it('should clear connection start when changing mode', () => {
            state.setConnectStart({ component: 1, x: 100, y: 100 });
            state.setMode('delete');

            expect(state.getConnectStart()).toBeNull();
        });

        it('should set and get selected tool', () => {
            state.setSelectedTool('AND');
            expect(state.getSelectedTool()).toBe('AND');
        });

        it('should set and get connect start', () => {
            const connectStart = { component: 1, x: 100, y: 100 };
            state.setConnectStart(connectStart);

            expect(state.getConnectStart()).toEqual(connectStart);
        });
    });

    describe('Custom Components and Saved Boards', () => {
        it('should set and get custom components', () => {
            const customComponents = { MyGate: { name: 'MyGate' } };
            state.setCustomComponents(customComponents);

            expect(state.getCustomComponents()).toEqual(customComponents);
        });

        it('should set and get saved boards', () => {
            const savedBoards = { Board01: { name: 'Board01' } };
            state.setSavedBoards(savedBoards);

            expect(state.getSavedBoards()).toEqual(savedBoards);
        });
    });

    describe('Current Circuit Tracking', () => {
        it('should set and get current board name', () => {
            state.setCurrentBoardName('Board01');
            expect(state.getCurrentBoardName()).toBe('Board01');
        });

        it('should clear component name when setting board name', () => {
            state.setCurrentComponentName('MyComponent');
            state.setCurrentBoardName('Board01');

            expect(state.getCurrentComponentName()).toBeNull();
        });

        it('should set and get current component name', () => {
            state.setCurrentComponentName('MyComponent');
            expect(state.getCurrentComponentName()).toBe('MyComponent');
        });

        it('should clear board name when setting component name', () => {
            state.setCurrentBoardName('Board01');
            state.setCurrentComponentName('MyComponent');

            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('should track last saved state', () => {
            const savedState = '{"components":[],"connections":[]}';
            state.setLastSavedState(savedState);

            expect(state.getLastSavedState()).toBe(savedState);
        });

        it('should detect unsaved changes', () => {
            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });
            state.setLastSavedState('{"components":[],"connections":[]}');

            expect(state.hasUnsavedChanges()).toBe(true);
        });

        it('should return false for empty unsaved board', () => {
            expect(state.hasUnsavedChanges()).toBe(false);
        });

        it('should get current state', () => {
            // Use generateNextId to properly increment the ID counter
            const id = state.generateNextId();
            state.addComponent({ id, type: 'AND', x: 100, y: 100 });
            state.addConnection({ from: id, to: 2, fromPort: 0, toPort: 0 });

            const currentState = state.getCurrentState();

            expect(currentState.components).toHaveLength(1);
            expect(currentState.connections).toHaveLength(1);
            expect(currentState.nextId).toBe(2); // After generating id=1, nextId should be 2
        });
    });

    describe('Circuit Analysis & Truth Table Panel State', () => {
        it('should set and get circuit analysis', () => {
            const analysis = {
                inputs: [{ label: 'A' }],
                outputs: [{ label: 'Y' }],
                table: [{ input0: 0, output0: 0 }],
                isValid: true,
                reason: null
            };
            state.setCircuitAnalysis(analysis);

            expect(state.getCircuitAnalysis()).toEqual(analysis);
        });

        it('should set and get truth table panel state', () => {
            const panelState = { width: '400px', height: '300px', x: 100, y: 50, columnOrder: ['input0', 'output0'], visible: true };
            state.setTruthTablePanelState(panelState);

            expect(state.getTruthTablePanelState()).toEqual(panelState);
        });
    });

    describe('Simulation State', () => {
        it('should set and get auto-cycling state', () => {
            state.setAutoCycling(true);
            expect(state.isAutoCyclingActive()).toBe(true);
        });

        it('should set and get auto-cycle timeout', () => {
            const timeout = setTimeout(() => {}, 1000);
            state.setAutoCycleTimeout(timeout);

            expect(state.getAutoCycleTimeout()).toBe(timeout);
            clearTimeout(timeout);
        });

        it('should set and get current cycle index', () => {
            state.setCurrentCycleIndex(5);
            expect(state.getCurrentCycleIndex()).toBe(5);
        });

        it('should set and get total combinations', () => {
            state.setTotalCombinations(16);
            expect(state.getTotalCombinations()).toBe(16);
        });
    });

    // Note: Drag state tests removed in Phase 10.6
    // Drag state is now managed locally in ComponentDragger (interaction layer)

    describe('Bulk State Operations', () => {
        it('should load a complete state', () => {
            const loadState = {
                components: [{ id: 1, type: 'AND', x: 100, y: 100 }],
                connections: [{ from: 1, to: 2, fromPort: 0, toPort: 0 }],
                nextId: 3,
                currentBoardName: 'Board01',
                currentComponentName: null,
                truthTablePanelState: { width: '400px' }
            };

            state.loadState(loadState);

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getConnections()).toHaveLength(1);
            expect(state.getCurrentBoardName()).toBe('Board01');
            expect(state.getTruthTablePanelState()).toEqual({ width: '400px' });
        });

        it('should reset to initial state', () => {
            // Add some data
            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });
            state.addConnection({ from: 1, to: 2, fromPort: 0, toPort: 0 });
            state.setCurrentBoardName('Board01');
            state.setSelectedTool('AND');

            // Reset
            state.reset();

            expect(state.getComponents()).toHaveLength(0);
            expect(state.getConnections()).toHaveLength(0);
            expect(state.getMode()).toBe('place');
            expect(state.getSelectedTool()).toBeNull();
            expect(state.getCurrentBoardName()).toBeNull();
            expect(state.generateNextId()).toBe(1);
        });
    });

    describe('Event Emission', () => {
        it('should emit BOARD_CHANGED when adding component', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_CHANGED, handler);

            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });

            expect(handler).toHaveBeenCalled();
        });

        it('should emit BOARD_CLEARED when clearing components', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_CLEARED, handler);

            state.addComponent({ id: 1, type: 'AND', x: 100, y: 100 });
            state.clearComponents();

            expect(handler).toHaveBeenCalled();
        });

        it('should emit mode:changed when changing mode', () => {
            const handler = vi.fn();
            eventBus.on('mode:changed', handler);

            state.setMode('connect');

            expect(handler).toHaveBeenCalledWith({ mode: 'connect', oldMode: 'place' });
        });
    });

    describe('Connection Cleanup on Component Removal', () => {
        it('should remove all connections TO a deleted component', () => {
            const c1 = { id: 1, type: 'INPUT', x: 100, y: 100 };
            const c2 = { id: 2, type: 'INPUT', x: 100, y: 200 };
            const c3 = { id: 3, type: 'AND', x: 200, y: 150 };

            state.addComponent(c1);
            state.addComponent(c2);
            state.addComponent(c3);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });

            expect(state.getConnections()).toHaveLength(2);

            // Remove the AND gate (all connections TO it should be removed)
            state.removeComponent(3);

            expect(state.getConnections()).toHaveLength(0);
        });

        it('should remove all connections FROM a deleted component', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100 };
            const out1 = { id: 2, type: 'OUTPUT', x: 200, y: 100 };
            const out2 = { id: 3, type: 'OUTPUT', x: 200, y: 200 };

            state.addComponent(input);
            state.addComponent(out1);
            state.addComponent(out2);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });

            expect(state.getConnections()).toHaveLength(2);

            // Remove the INPUT (all connections FROM it should be removed)
            state.removeComponent(1);

            expect(state.getConnections()).toHaveLength(0);
        });

        it('should only remove connections involving deleted component', () => {
            const c1 = { id: 1, type: 'INPUT', x: 100, y: 100 };
            const c2 = { id: 2, type: 'INPUT', x: 100, y: 200 };
            const c3 = { id: 3, type: 'AND', x: 200, y: 100 };
            const c4 = { id: 4, type: 'OUTPUT', x: 300, y: 100 };

            state.addComponent(c1);
            state.addComponent(c2);
            state.addComponent(c3);
            state.addComponent(c4);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 4, toPort: 0 }); // c2 -> c4 (not involving c3)
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 1 });

            expect(state.getConnections()).toHaveLength(3);

            // Remove AND gate
            state.removeComponent(3);

            // Only connection c2 -> c4 should remain
            expect(state.getConnections()).toHaveLength(1);
            expect(state.getConnections()[0]).toEqual({ from: 2, fromPort: 0, to: 4, toPort: 0 });
        });
    });

    describe('ID Counter Management', () => {
        it('should reset nextId to 1 when clearComponents is called', () => {
            state.addComponent({ id: state.generateNextId(), type: 'INPUT', x: 100, y: 100 });
            state.addComponent({ id: state.generateNextId(), type: 'OUTPUT', x: 200, y: 100 });

            expect(state.generateNextId()).toBe(3);

            state.clearComponents();

            expect(state.generateNextId()).toBe(1);
        });

        it('should not reset nextId on regular component removal', () => {
            state.addComponent({ id: state.generateNextId(), type: 'INPUT', x: 100, y: 100 });
            state.addComponent({ id: state.generateNextId(), type: 'OUTPUT', x: 200, y: 100 });

            state.removeComponent(1);

            // nextId should continue from 3, not reset
            expect(state.generateNextId()).toBe(3);
        });

        it('should set nextId correctly via setNextId', () => {
            state.setNextId(100);
            expect(state.generateNextId()).toBe(100);
            expect(state.generateNextId()).toBe(101);
        });
    });

    describe('Concurrent State Modifications', () => {
        it('should handle adding and removing components in same tick', () => {
            const c1 = { id: 1, type: 'INPUT', x: 100, y: 100 };
            const c2 = { id: 2, type: 'OUTPUT', x: 200, y: 100 };

            state.addComponent(c1);
            state.addComponent(c2);
            state.removeComponent(1);
            state.addComponent({ id: 3, type: 'AND', x: 150, y: 150 });
            state.removeComponent(2);

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getComponent(3)).not.toBeNull();
        });

        it('should handle multiple connection modifications', () => {
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });
            state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100 });

            const conn = { from: 1, fromPort: 0, to: 2, toPort: 0 };

            state.addConnection(conn);
            state.removeConnection(conn);
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

            expect(state.getConnections()).toHaveLength(1);
        });
    });
});
