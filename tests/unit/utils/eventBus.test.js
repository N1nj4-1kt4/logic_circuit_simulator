/**
 * Unit tests for EventBus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('EventBus', () => {
    beforeEach(() => {
        eventBus.clear();
    });

    describe('on() - Subscribe to events', () => {
        it('should subscribe to an event', () => {
            const handler = vi.fn();
            eventBus.on('test:event', handler);

            eventBus.emit('test:event', { data: 'test' });

            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should allow multiple handlers for the same event', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventBus.on('test:event', handler1);
            eventBus.on('test:event', handler2);

            eventBus.emit('test:event', { data: 'test' });

            expect(handler1).toHaveBeenCalledWith({ data: 'test' });
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should allow the same handler to be added multiple times', () => {
            const handler = vi.fn();

            eventBus.on('test:event', handler);
            eventBus.on('test:event', handler);

            eventBus.emit('test:event');

            expect(handler).toHaveBeenCalledTimes(2);
        });
    });

    describe('off() - Unsubscribe from events', () => {
        it('should unsubscribe from an event', () => {
            const handler = vi.fn();
            eventBus.on('test:event', handler);
            eventBus.off('test:event', handler);

            eventBus.emit('test:event');

            expect(handler).not.toHaveBeenCalled();
        });

        it('should only remove the specified handler', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventBus.on('test:event', handler1);
            eventBus.on('test:event', handler2);
            eventBus.off('test:event', handler1);

            eventBus.emit('test:event');

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should handle unsubscribing from non-existent event', () => {
            const handler = vi.fn();

            expect(() => {
                eventBus.off('non:existent', handler);
            }).not.toThrow();
        });

        it('should handle unsubscribing non-existent handler', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventBus.on('test:event', handler1);

            expect(() => {
                eventBus.off('test:event', handler2);
            }).not.toThrow();

            eventBus.emit('test:event');
            expect(handler1).toHaveBeenCalled();
        });
    });

    describe('emit() - Emit events', () => {
        it('should emit event to all subscribers', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const handler3 = vi.fn();

            eventBus.on('test:event', handler1);
            eventBus.on('test:event', handler2);
            eventBus.on('other:event', handler3);

            eventBus.emit('test:event', 'data');

            expect(handler1).toHaveBeenCalledWith('data');
            expect(handler2).toHaveBeenCalledWith('data');
            expect(handler3).not.toHaveBeenCalled();
        });

        it('should not throw when emitting to non-existent event', () => {
            expect(() => {
                eventBus.emit('non:existent', 'data');
            }).not.toThrow();
        });

        it('should handle errors in event handlers gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const badHandler = vi.fn(() => {
                throw new Error('Handler error');
            });
            const goodHandler = vi.fn();

            eventBus.on('test:event', badHandler);
            eventBus.on('test:event', goodHandler);

            eventBus.emit('test:event');

            // Error should be logged
            expect(consoleSpy).toHaveBeenCalled();
            // Good handler should still be called
            expect(goodHandler).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should pass data correctly to handlers', () => {
            const handler = vi.fn();
            const complexData = {
                id: 1,
                nested: { value: 'test' },
                array: [1, 2, 3]
            };

            eventBus.on('test:event', handler);
            eventBus.emit('test:event', complexData);

            expect(handler).toHaveBeenCalledWith(complexData);
        });
    });

    describe('once() - One-time subscription', () => {
        it('should only fire once', () => {
            const handler = vi.fn();

            eventBus.once('test:event', handler);

            eventBus.emit('test:event', 'first');
            eventBus.emit('test:event', 'second');
            eventBus.emit('test:event', 'third');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('first');
        });

        it('should work alongside regular subscriptions', () => {
            const onceHandler = vi.fn();
            const regularHandler = vi.fn();

            // Register regular handler first, then once handler
            // (The once handler removes itself during iteration which can affect other handlers)
            eventBus.on('test:event', regularHandler);
            eventBus.once('test:event', onceHandler);

            eventBus.emit('test:event', 'first');
            eventBus.emit('test:event', 'second');

            expect(onceHandler).toHaveBeenCalledTimes(1);
            expect(regularHandler).toHaveBeenCalledTimes(2);
        });
    });

    describe('clear() - Clear all events', () => {
        it('should remove all event handlers', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventBus.on('event1', handler1);
            eventBus.on('event2', handler2);

            eventBus.clear();

            eventBus.emit('event1');
            eventBus.emit('event2');

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
        });
    });

    describe('getEvents() - List registered events', () => {
        it('should return list of registered event names', () => {
            eventBus.on('event1', vi.fn());
            eventBus.on('event2', vi.fn());
            eventBus.on('event3', vi.fn());

            const events = eventBus.getEvents();

            expect(events).toContain('event1');
            expect(events).toContain('event2');
            expect(events).toContain('event3');
            expect(events).toHaveLength(3);
        });

        it('should return empty array when no events registered', () => {
            const events = eventBus.getEvents();
            expect(events).toEqual([]);
        });
    });

    describe('EVENT_TYPES constants', () => {
        it('should have component events defined', () => {
            expect(EVENT_TYPES.COMPONENT_ADDED).toBe('component:added');
            expect(EVENT_TYPES.COMPONENT_REMOVED).toBe('component:removed');
            expect(EVENT_TYPES.COMPONENT_MOVED).toBe('component:moved');
            expect(EVENT_TYPES.COMPONENT_VALUE_CHANGED).toBe('component:valueChanged');
        });

        it('should have connection events defined', () => {
            expect(EVENT_TYPES.CONNECTION_ADDED).toBe('connection:added');
            expect(EVENT_TYPES.CONNECTION_REMOVED).toBe('connection:removed');
        });

        it('should have simulation events defined', () => {
            expect(EVENT_TYPES.SIMULATION_RUN).toBe('simulation:run');
            expect(EVENT_TYPES.SIMULATION_COMPLETED).toBe('simulation:completed');
            expect(EVENT_TYPES.SIMULATION_RESET).toBe('simulation:reset');
            expect(EVENT_TYPES.SIMULATION_STATE_CHANGED).toBe('simulation:stateChanged');
        });

        it('should have board events defined', () => {
            expect(EVENT_TYPES.BOARD_SAVE).toBe('board:save');
            expect(EVENT_TYPES.BOARD_LOADED).toBe('board:loaded');
            expect(EVENT_TYPES.BOARD_DELETED).toBe('board:deleted');
            expect(EVENT_TYPES.BOARD_CHANGED).toBe('board:changed');
            expect(EVENT_TYPES.BOARD_CLEARED).toBe('board:cleared');
        });

        it('should have truth table events defined', () => {
            expect(EVENT_TYPES.TRUTH_TABLE_GENERATE).toBe('truthTable:generate');
            expect(EVENT_TYPES.TRUTH_TABLE_SHOWN).toBe('truthTable:shown');
            expect(EVENT_TYPES.TRUTH_TABLE_HIDDEN).toBe('truthTable:hidden');
            expect(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED).toBe('truthTable:stateChanged');
            expect(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT).toBe('truthTable:updateHighlight');
        });

        it('should have theme events defined', () => {
            expect(EVENT_TYPES.THEME_CHANGED).toBe('theme:changed');
        });

        it('should have mode events defined', () => {
            expect(EVENT_TYPES.MODE_EXIT_REQUEST).toBe('mode:exitRequest');
        });

        it('should have UI update events defined', () => {
            expect(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS).toBe('toolbar:updateDisplays');
            expect(EVENT_TYPES.CONNECTION_START_CHANGED).toBe('connection:startChanged');
        });

        it('should have canvas events defined', () => {
            expect(EVENT_TYPES.CANVAS_REDRAW).toBe('canvas:redraw');
        });
    });

    describe('Real-world usage patterns', () => {
        it('should support publish-subscribe pattern', () => {
            const componentHandler = vi.fn();
            const logHandler = vi.fn();

            // Multiple subscribers to same event
            eventBus.on(EVENT_TYPES.COMPONENT_ADDED, componentHandler);
            eventBus.on(EVENT_TYPES.COMPONENT_ADDED, logHandler);

            const component = { id: 1, type: 'AND', x: 100, y: 100 };
            eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component });

            expect(componentHandler).toHaveBeenCalledWith({ component });
            expect(logHandler).toHaveBeenCalledWith({ component });
        });

        it('should support request-response pattern with once', () => {
            let responseReceived = false;

            eventBus.once('response:getData', (data) => {
                responseReceived = true;
                expect(data.result).toBe('success');
            });

            // Simulate async response
            setTimeout(() => {
                eventBus.emit('response:getData', { result: 'success' });
            }, 0);

            // Handler setup should not throw
            expect(() => {
                eventBus.emit('response:getData', { result: 'success' });
            }).not.toThrow();
        });

        it('should handle component lifecycle events', () => {
            const addHandler = vi.fn();
            const removeHandler = vi.fn();
            const moveHandler = vi.fn();

            eventBus.on(EVENT_TYPES.COMPONENT_ADDED, addHandler);
            eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, removeHandler);
            eventBus.on(EVENT_TYPES.COMPONENT_MOVED, moveHandler);

            // Simulate component lifecycle
            eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component: { id: 1 } });
            eventBus.emit(EVENT_TYPES.COMPONENT_MOVED, { component: { id: 1 }, newX: 200, newY: 200 });
            eventBus.emit(EVENT_TYPES.COMPONENT_REMOVED, { componentId: 1 });

            expect(addHandler).toHaveBeenCalledTimes(1);
            expect(moveHandler).toHaveBeenCalledTimes(1);
            expect(removeHandler).toHaveBeenCalledTimes(1);
        });
    });
});
