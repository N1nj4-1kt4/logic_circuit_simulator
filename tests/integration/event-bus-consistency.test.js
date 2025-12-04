/**
 * Integration tests for event bus interactions and state consistency
 * Tests event emission order, handler behavior, and state synchronization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../src/utils/eventBus.js';

describe('Event Emission Order', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should emit COMPONENT_ADDED before BOARD_CHANGED', () => {
        const eventOrder = [];

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, () => eventOrder.push('COMPONENT_ADDED'));
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventOrder.push('BOARD_CHANGED'));

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        expect(eventOrder).toEqual(['COMPONENT_ADDED', 'BOARD_CHANGED']);
    });

    it('should emit COMPONENT_REMOVED before BOARD_CHANGED', () => {
        const eventOrder = [];

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, () => eventOrder.push('COMPONENT_REMOVED'));
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventOrder.push('BOARD_CHANGED'));

        state.removeComponent(1);

        expect(eventOrder).toEqual(['COMPONENT_REMOVED', 'BOARD_CHANGED']);
    });

    it('should emit CONNECTION_ADDED before BOARD_CHANGED', () => {
        const eventOrder = [];

        eventBus.on(EVENT_TYPES.CONNECTION_ADDED, () => eventOrder.push('CONNECTION_ADDED'));
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventOrder.push('BOARD_CHANGED'));

        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

        expect(eventOrder).toEqual(['CONNECTION_ADDED', 'BOARD_CHANGED']);
    });

    it('should emit CONNECTION_REMOVED before BOARD_CHANGED', () => {
        const connection = { from: 1, fromPort: 0, to: 2, toPort: 0 };
        state.addConnection(connection);

        const eventOrder = [];
        eventBus.on(EVENT_TYPES.CONNECTION_REMOVED, () => eventOrder.push('CONNECTION_REMOVED'));
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventOrder.push('BOARD_CHANGED'));

        state.removeConnection(connection);

        expect(eventOrder).toEqual(['CONNECTION_REMOVED', 'BOARD_CHANGED']);
    });

    it('should emit BOARD_CLEARED and BOARD_CHANGED when clearing components', () => {
        const eventOrder = [];

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        eventBus.on(EVENT_TYPES.BOARD_CLEARED, () => eventOrder.push('BOARD_CLEARED'));
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => eventOrder.push('BOARD_CHANGED'));

        state.clearComponents();

        expect(eventOrder).toEqual(['BOARD_CLEARED', 'BOARD_CHANGED']);
    });

    it('should emit mode:changed with old and new mode', () => {
        let eventData = null;

        eventBus.on('mode:changed', (data) => {
            eventData = data;
        });

        state.setMode('connect');

        expect(eventData).toEqual({ mode: 'connect', oldMode: 'place' });
    });
});

describe('State Consistency After Events', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should have consistent state in COMPONENT_ADDED handler', () => {
        let componentCountInHandler = 0;

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, () => {
            componentCountInHandler = state.getComponents().length;
        });

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Component should already be in state when event fires
        expect(componentCountInHandler).toBe(1);
    });

    it('should have consistent state in COMPONENT_REMOVED handler', () => {
        let componentCountInHandler = 0;

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, () => {
            componentCountInHandler = state.getComponents().length;
        });

        state.removeComponent(1);

        // Component should already be removed when event fires
        expect(componentCountInHandler).toBe(0);
    });

    it('should clear connection state when mode changes from connect', () => {
        state.setMode('connect');
        state.setConnectStart({ component: 1, portIndex: 0, x: 100, y: 100 });

        expect(state.getConnectStart()).not.toBeNull();

        state.setMode('delete');

        // Connection start should be cleared automatically
        expect(state.getConnectStart()).toBeNull();
    });

    it('should preserve connection state when staying in connect mode', () => {
        state.setMode('connect');
        const connectStart = { component: 1, portIndex: 0, x: 100, y: 100 };
        state.setConnectStart(connectStart);

        // Setting same mode again
        state.setMode('connect');

        // Connection start should remain because we're staying in connect mode
        expect(state.getConnectStart()).toEqual(connectStart);
    });

    it('should maintain state after rapid mode changes', () => {
        const modes = ['place', 'connect', 'delete', 'connect', 'place'];

        modes.forEach(mode => {
            state.setMode(mode);
        });

        expect(state.getMode()).toBe('place');
        expect(state.getConnectStart()).toBeNull();
    });

    it('should emit connection:startChanged when connection start is set', () => {
        const handler = vi.fn();
        eventBus.on('connection:startChanged', handler);

        const connectStart = { component: 1, portIndex: 0, x: 100, y: 100 };
        state.setConnectStart(connectStart);

        expect(handler).toHaveBeenCalledWith({ connectStart });
    });
});

describe('Event Handler Cleanup', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should not cause issues with multiple eventBus.clear() calls', () => {
        const handler = vi.fn();
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);

        eventBus.clear();
        eventBus.clear();
        eventBus.clear();

        // Should not throw and handler should not be called
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });
        expect(handler).not.toHaveBeenCalled();
    });

    it('should allow re-registering handlers after clear', () => {
        const handler = vi.fn();

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);
        eventBus.clear();

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fire once() handler only once', () => {
        const handler = vi.fn();
        eventBus.once(EVENT_TYPES.COMPONENT_ADDED, handler);

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });
        state.addComponent({ id: 2, type: 'INPUT', x: 200, y: 100 });
        state.addComponent({ id: 3, type: 'INPUT', x: 300, y: 100 });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should correctly remove specific handler with off()', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler1);
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler2);

        eventBus.off(EVENT_TYPES.COMPONENT_ADDED, handler1);

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle off() for non-existent handler gracefully', () => {
        const handler = vi.fn();

        // Remove handler that was never added
        expect(() => {
            eventBus.off(EVENT_TYPES.COMPONENT_ADDED, handler);
        }).not.toThrow();
    });

    it('should handle off() for non-existent event gracefully', () => {
        const handler = vi.fn();

        expect(() => {
            eventBus.off('non:existent:event', handler);
        }).not.toThrow();
    });
});

describe('Board Name and State Synchronization', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should emit currentBoard:changed when board name is set', () => {
        const handler = vi.fn();
        eventBus.on('currentBoard:changed', handler);

        state.setCurrentBoardName('TestBoard');

        expect(handler).toHaveBeenCalledWith({ boardName: 'TestBoard' });
    });

    it('should emit currentComponent:changed when component name is set', () => {
        const handler = vi.fn();
        eventBus.on('currentComponent:changed', handler);

        state.setCurrentComponentName('TestComponent');

        expect(handler).toHaveBeenCalledWith({ componentName: 'TestComponent' });
    });

    it('should clear component name when setting board name', () => {
        state.setCurrentComponentName('TestComponent');
        expect(state.getCurrentComponentName()).toBe('TestComponent');

        state.setCurrentBoardName('TestBoard');

        expect(state.getCurrentBoardName()).toBe('TestBoard');
        expect(state.getCurrentComponentName()).toBeNull();
    });

    it('should clear board name when setting component name', () => {
        state.setCurrentBoardName('TestBoard');
        expect(state.getCurrentBoardName()).toBe('TestBoard');

        state.setCurrentComponentName('TestComponent');

        expect(state.getCurrentComponentName()).toBe('TestComponent');
        expect(state.getCurrentBoardName()).toBeNull();
    });

    it('should correctly report unsaved changes', () => {
        // Empty board has no unsaved changes
        expect(state.hasUnsavedChanges()).toBe(false);

        // Add a component
        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Now has unsaved changes (no last saved state)
        expect(state.hasUnsavedChanges()).toBe(true);

        // Set last saved state to current
        state.setLastSavedState(JSON.stringify(state.getCurrentState()));

        // No more unsaved changes
        expect(state.hasUnsavedChanges()).toBe(false);

        // Add another component
        state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100 });

        // Again has unsaved changes
        expect(state.hasUnsavedChanges()).toBe(true);
    });
});

describe('Event Data Integrity', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should pass component data in COMPONENT_ADDED event', () => {
        let receivedData = null;
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, (data) => {
            receivedData = data;
        });

        const component = { id: 1, type: 'AND', x: 100, y: 100 };
        state.addComponent(component);

        expect(receivedData).toEqual({ component });
        expect(receivedData.component).toBe(component); // Same object reference
    });

    it('should pass componentId and component in COMPONENT_REMOVED event', () => {
        let receivedData = null;
        const component = { id: 1, type: 'AND', x: 100, y: 100 };
        state.addComponent(component);

        eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, (data) => {
            receivedData = data;
        });

        state.removeComponent(1);

        expect(receivedData.componentId).toBe(1);
        expect(receivedData.component).toBe(component);
    });

    it('should pass connection data in CONNECTION_ADDED event', () => {
        let receivedData = null;
        eventBus.on(EVENT_TYPES.CONNECTION_ADDED, (data) => {
            receivedData = data;
        });

        const connection = { from: 1, fromPort: 0, to: 2, toPort: 1 };
        state.addConnection(connection);

        expect(receivedData).toEqual({ connection });
    });

    it('should pass old and updated state in COMPONENT_MOVED event', () => {
        let receivedData = null;
        const component = { id: 1, type: 'AND', x: 100, y: 100 };
        state.addComponent(component);

        eventBus.on(EVENT_TYPES.COMPONENT_MOVED, (data) => {
            receivedData = data;
        });

        state.updateComponent(1, { x: 200, y: 200 });

        expect(receivedData.component).toBe(component);
        expect(receivedData.oldState.x).toBe(100);
        expect(receivedData.oldState.y).toBe(100);
        expect(receivedData.updates).toEqual({ x: 200, y: 200 });
    });

    it('should include state in BOARD_LOADED event', () => {
        let receivedData = null;
        eventBus.on(EVENT_TYPES.BOARD_LOADED, (data) => {
            receivedData = data;
        });

        const loadState = {
            components: [{ id: 1, type: 'INPUT' }],
            connections: [],
            nextId: 2
        };

        state.loadState(loadState);

        expect(receivedData.state).toEqual(loadState);
    });
});

describe('Error Handling in Event Handlers', () => {
    let state;
    let consoleErrorSpy;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should continue executing other handlers if one throws', () => {
        const handler1 = vi.fn(() => {
            throw new Error('Handler 1 error');
        });
        const handler2 = vi.fn();

        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler1);
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler2);

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // Both handlers were called
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();

        // Error was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not corrupt state if handler throws', () => {
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, () => {
            throw new Error('Test error');
        });

        state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

        // State should still be valid
        expect(state.getComponents()).toHaveLength(1);
        expect(state.getComponent(1)).toBeDefined();
    });
});
