/**
 * Tests for CircuitValidityManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitValidityManager, VALIDITY_STATES } from '../../../src/core/CircuitValidityManager.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('CircuitValidityManager', () => {
    let manager;
    let mockCircuitState;

    beforeEach(() => {
        // Clear event bus before each test
        eventBus.clear();

        // Create mock circuit state
        mockCircuitState = {
            getComponents: vi.fn().mockReturnValue([]),
            getConnections: vi.fn().mockReturnValue([])
        };

        manager = new CircuitValidityManager(mockCircuitState);
    });

    afterEach(() => {
        if (manager) {
            manager.destroy();
        }
        eventBus.clear();
    });

    describe('VALIDITY_STATES', () => {
        it('should export validity states', () => {
            expect(VALIDITY_STATES.EMPTY).toBe('empty');
            expect(VALIDITY_STATES.INCOMPLETE).toBe('incomplete');
            expect(VALIDITY_STATES.VALID).toBe('valid');
        });
    });

    describe('initial state', () => {
        it('should start with EMPTY validity state', () => {
            const validity = manager.getValidity();
            expect(validity.state).toBe(VALIDITY_STATES.EMPTY);
            expect(validity.reason).toBe(null);
        });

        it('should not be able to simulate initially', () => {
            expect(manager.canSimulate()).toBe(false);
        });
    });

    describe('revalidate', () => {
        it('should detect empty circuit', () => {
            mockCircuitState.getComponents.mockReturnValue([]);
            mockCircuitState.getConnections.mockReturnValue([]);

            manager.revalidate();

            expect(manager.getValidity().state).toBe(VALIDITY_STATES.EMPTY);
            expect(manager.canSimulate()).toBe(false);
        });

        it('should detect incomplete circuit with only inputs', () => {
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 }
            ]);

            manager.revalidate();

            expect(manager.getValidity().state).toBe(VALIDITY_STATES.INCOMPLETE);
            expect(manager.canSimulate()).toBe(false);
        });

        it('should detect incomplete circuit with only outputs', () => {
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'OUTPUT', label: 'O1', value: null }
            ]);

            manager.revalidate();

            expect(manager.getValidity().state).toBe(VALIDITY_STATES.INCOMPLETE);
            expect(manager.canSimulate()).toBe(false);
        });

        it('should detect incomplete circuit with unconnected gate', () => {
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 2, type: 'OUTPUT', label: 'O1', value: null },
                { id: 3, type: 'AND', inputs: [null, null], outputs: [null] }
            ]);
            mockCircuitState.getConnections.mockReturnValue([]);

            manager.revalidate();

            expect(manager.getValidity().state).toBe(VALIDITY_STATES.INCOMPLETE);
            expect(manager.canSimulate()).toBe(false);
        });

        it('should detect valid circuit', () => {
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 2, type: 'INPUT', label: 'I2', value: 0 },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null },
                { id: 4, type: 'AND', inputs: [null, null], outputs: [null] }
            ]);
            mockCircuitState.getConnections.mockReturnValue([
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 3, toPort: 0 }
            ]);

            manager.revalidate();

            expect(manager.getValidity().state).toBe(VALIDITY_STATES.VALID);
            expect(manager.canSimulate()).toBe(true);
        });
    });

    describe('event emission', () => {
        it('should emit CIRCUIT_VALIDITY_CHANGED when validity changes', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, handler);

            // Set up valid circuit
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 2, type: 'INPUT', label: 'I2', value: 0 },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null },
                { id: 4, type: 'AND', inputs: [null, null], outputs: [null] }
            ]);
            mockCircuitState.getConnections.mockReturnValue([
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 3, toPort: 0 }
            ]);

            manager.revalidate();

            expect(handler).toHaveBeenCalled();
            const eventData = handler.mock.calls[0][0];
            expect(eventData.from).toBe(VALIDITY_STATES.EMPTY);
            expect(eventData.to).toBe(VALIDITY_STATES.VALID);
            expect(eventData.canSimulate).toBe(true);
        });

        it('should emit IO_STRUCTURE_CHANGED when I/O count changes', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.IO_STRUCTURE_CHANGED, handler);

            // First: set up circuit with 1 input (initializes tracking)
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 }
            ]);
            manager.revalidate();

            // Then: add another input - should trigger IO_STRUCTURE_CHANGED
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 2, type: 'INPUT', label: 'I2', value: 0 }
            ]);
            manager.revalidate();

            expect(handler).toHaveBeenCalled();
            const eventData = handler.mock.calls[0][0];
            expect(eventData.previousInputCount).toBe(1);
            expect(eventData.newInputCount).toBe(2);
        });
    });

    describe('event subscriptions', () => {
        it('should revalidate on BOARD_CHANGED event', () => {
            const revalidateSpy = vi.spyOn(manager, 'revalidate');

            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            expect(revalidateSpy).toHaveBeenCalled();
        });

        it('should revalidate on BOARD_CLEARED event', () => {
            const revalidateSpy = vi.spyOn(manager, 'revalidate');

            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

            expect(revalidateSpy).toHaveBeenCalled();
        });

        it('should revalidate on BOARD_LOADED event', () => {
            const revalidateSpy = vi.spyOn(manager, 'revalidate');

            eventBus.emit(EVENT_TYPES.BOARD_LOADED);

            expect(revalidateSpy).toHaveBeenCalled();
        });
    });

    describe('wouldBeValidAfter', () => {
        it('should predict validity after proposed changes', () => {
            const proposedComponents = [
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 2, type: 'INPUT', label: 'I2', value: 0 },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null },
                { id: 4, type: 'AND', inputs: [null, null], outputs: [null] }
            ];
            const proposedConnections = [
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 3, toPort: 0 }
            ];

            const result = manager.wouldBeValidAfter(proposedComponents, proposedConnections);

            expect(result.isValid).toBe(true);
            expect(result.validity).toBe(VALIDITY_STATES.VALID);
        });

        it('should predict invalid circuit when gate disconnected', () => {
            const proposedComponents = [
                { id: 1, type: 'INPUT', label: 'I1', value: 0 },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null },
                { id: 4, type: 'AND', inputs: [null, null], outputs: [null] }
            ];
            const proposedConnections = [
                // Only one input connected to gate
                { from: 1, fromPort: 0, to: 4, toPort: 0 }
            ];

            const result = manager.wouldBeValidAfter(proposedComponents, proposedConnections);

            expect(result.isValid).toBe(false);
            expect(result.validity).toBe(VALIDITY_STATES.INCOMPLETE);
        });
    });

    describe('getLastValidation', () => {
        it('should return null before first revalidation', () => {
            expect(manager.getLastValidation()).toBe(null);
        });

        it('should return validation result after revalidation', () => {
            mockCircuitState.getComponents.mockReturnValue([
                { id: 1, type: 'INPUT', label: 'I1', value: 0 }
            ]);
            manager.revalidate();

            const validation = manager.getLastValidation();
            expect(validation).not.toBe(null);
            expect(validation.inputs).toHaveLength(1);
        });
    });

    describe('destroy', () => {
        it('should clean up event listeners', () => {
            const revalidateSpy = vi.spyOn(manager, 'revalidate');

            manager.destroy();

            // Emit events after destroy
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
            eventBus.emit(EVENT_TYPES.BOARD_LOADED);

            // Should not trigger revalidation
            expect(revalidateSpy).not.toHaveBeenCalled();
        });
    });
});
