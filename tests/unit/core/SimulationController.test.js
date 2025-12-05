/**
 * Tests for SimulationController
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulationController, SIMULATION_STATES } from '../../../src/core/SimulationController.js';
import { CircuitValidityManager, VALIDITY_STATES } from '../../../src/core/CircuitValidityManager.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

describe('SimulationController', () => {
    let controller;
    let mockCircuitState;
    let mockValidityManager;
    let validCircuit;

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus.clear();

        // Create a valid circuit with properly structured components
        // Components need inputs/outputs arrays that match what circuitEvaluator expects
        validCircuit = {
            components: [
                { id: 1, type: 'INPUT', label: 'I1', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 2, type: 'INPUT', label: 'I2', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] },
                { id: 3, type: 'OUTPUT', label: 'O1', value: null, inputs: [{ x: 0, y: 0 }], outputs: [] },
                { id: 4, type: 'AND', inputs: [{ x: 0, y: 0 }, { x: 0, y: 0 }], outputs: [{ x: 0, y: 0 }] }
            ],
            connections: [
                { from: 1, fromPort: 0, to: 4, toPort: 0 },
                { from: 2, fromPort: 0, to: 4, toPort: 1 },
                { from: 4, fromPort: 0, to: 3, toPort: 0 }
            ]
        };

        mockCircuitState = {
            getComponents: vi.fn().mockReturnValue(validCircuit.components),
            getConnections: vi.fn().mockReturnValue(validCircuit.connections),
            getTruthTableCache: vi.fn().mockReturnValue(null),
            setAutoCycling: vi.fn()
        };

        mockValidityManager = {
            canSimulate: vi.fn().mockReturnValue(true),
            getValidity: vi.fn().mockReturnValue({ state: VALIDITY_STATES.VALID, reason: null })
        };

        controller = new SimulationController({
            circuitState: mockCircuitState,
            validityManager: mockValidityManager
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        if (controller) {
            controller.destroy();
        }
        eventBus.clear();
    });

    describe('SIMULATION_STATES', () => {
        it('should export simulation states', () => {
            expect(SIMULATION_STATES.IDLE).toBe('idle');
            expect(SIMULATION_STATES.RUNNING).toBe('running');
        });
    });

    describe('initial state', () => {
        it('should start in IDLE state', () => {
            const state = controller.getState();
            expect(state.state).toBe(SIMULATION_STATES.IDLE);
            expect(state.cycleIndex).toBe(0);
            expect(state.totalCombinations).toBe(0);
        });

        it('should not be running initially', () => {
            expect(controller.isRunning()).toBe(false);
        });
    });

    describe('autocycleStart', () => {
        it('should start simulation when circuit is valid', () => {
            controller.autocycleStart();
            expect(controller.isRunning()).toBe(true);
        });

        it('should throw when circuit is invalid', () => {
            mockValidityManager.canSimulate.mockReturnValue(false);
            mockValidityManager.getValidity.mockReturnValue({
                state: VALIDITY_STATES.INCOMPLETE,
                reason: 'No outputs'
            });

            expect(() => controller.autocycleStart()).toThrow('No outputs');
        });

        it('should calculate total combinations based on input count', () => {
            controller.autocycleStart();
            expect(controller.getState().totalCombinations).toBe(4); // 2^2 inputs
        });

        it('should emit AUTOCYCLE_STATE_CHANGED event with running state', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, handler);

            controller.autocycleStart();

            expect(handler).toHaveBeenCalled();
            const eventData = handler.mock.calls[0][0];
            expect(eventData.state).toBe('running');
        });
    });

    describe('autocycleStop', () => {
        it('should stop simulation', () => {
            controller.autocycleStart();
            controller.autocycleStop();

            expect(controller.isRunning()).toBe(false);
            expect(controller.getState().state).toBe(SIMULATION_STATES.IDLE);
        });

        it('should emit AUTOCYCLE_STATE_CHANGED event with stopped state', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, handler);

            controller.autocycleStart();
            handler.mockClear(); // Clear the 'running' event
            controller.autocycleStop();

            expect(handler).toHaveBeenCalled();
            const eventData = handler.mock.calls[0][0];
            expect(eventData.state).toBe('stopped');
        });
    });

    describe('manualStep', () => {
        it('should step forward through combinations', () => {
            controller.manualStep(1);
            const state1 = controller.getState();

            controller.manualStep(1);
            const state2 = controller.getState();

            expect(state2.cycleIndex).toBe(state1.cycleIndex + 1);
        });

        it('should step backward through combinations', () => {
            // Start at index 2
            controller.manualStep(1);
            controller.manualStep(1);
            const state1 = controller.getState();

            controller.manualStep(-1);
            const state2 = controller.getState();

            expect(state2.cycleIndex).toBe(state1.cycleIndex - 1);
        });

        it('should wrap around when stepping past end', () => {
            // With 4 combinations (2 inputs), stepping 4 times should wrap to 0
            controller.manualStep(1);
            controller.manualStep(1);
            controller.manualStep(1);
            controller.manualStep(1);

            expect(controller.getState().cycleIndex).toBe(0);
        });

        it('should wrap around when stepping before start', () => {
            controller.manualStep(-1);

            expect(controller.getState().cycleIndex).toBe(3); // Last combination
        });

        it('should emit SIMULATION_STEP_COMPLETED event', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, handler);

            controller.manualStep(1);

            expect(handler).toHaveBeenCalled();
        });

        it('should throw when circuit is invalid', () => {
            mockValidityManager.canSimulate.mockReturnValue(false);
            mockValidityManager.getValidity.mockReturnValue({
                state: VALIDITY_STATES.INCOMPLETE,
                reason: 'No outputs'
            });

            expect(() => controller.manualStep(1)).toThrow('No outputs');
        });
    });

    describe('reset', () => {
        it('should reset all inputs to 0', () => {
            // Start simulation and step
            controller.autocycleStart();
            controller.manualStep(1);

            // Reset
            controller.reset();

            // Check inputs are 0
            const inputs = mockCircuitState.getComponents()
                .filter(c => c.type === 'INPUT');
            inputs.forEach(input => {
                expect(input.value).toBe(0);
            });
        });

        it('should reset cycle index to 0', () => {
            controller.autocycleStart();
            controller.manualStep(1);
            controller.reset();

            expect(controller.getState().cycleIndex).toBe(0);
        });

        it('should stop simulation if running', () => {
            controller.autocycleStart();
            expect(controller.isRunning()).toBe(true);

            controller.reset();
            expect(controller.isRunning()).toBe(false);
        });

        it('should skip simulate when skipSimulate option is true', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            controller.reset({ skipSimulate: true });

            // CANVAS_REDRAW should not be emitted when skipSimulate is true
            expect(handler).not.toHaveBeenCalled();
        });

        it('should use cache for index 0 when available', () => {
            // Set up a valid cache
            const mockCache = {
                isValid: true,
                table: [
                    { componentValues: { 1: { value: 0 }, 2: { value: 0 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 0 }, 2: { value: 1 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 1 }, 2: { value: 0 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 1 }, 2: { value: 1 }, 3: { value: 1 }, 4: { value: 1 } } }
                ]
            };
            mockCircuitState.getTruthTableCache.mockReturnValue(mockCache);

            // Set some non-zero input values first
            validCircuit.components[0].value = 1;
            validCircuit.components[1].value = 1;

            const redrawHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);

            controller.reset();

            // Should have emitted CANVAS_REDRAW (from cache restore)
            expect(redrawHandler).toHaveBeenCalled();
            // Inputs should be reset to 0
            expect(validCircuit.components[0].value).toBe(0);
            expect(validCircuit.components[1].value).toBe(0);
        });

        it('should fall back to simulation on reset when cache is null', () => {
            mockCircuitState.getTruthTableCache.mockReturnValue(null);

            const redrawHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);

            controller.reset();

            // Should still work and emit CANVAS_REDRAW
            expect(redrawHandler).toHaveBeenCalled();
        });
    });

    describe('auto-cycling', () => {
        it('should cycle through combinations on timer', () => {
            const stepHandler = vi.fn();
            eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, stepHandler);

            controller.autocycleStart();

            // Advance timer to trigger steps
            vi.advanceTimersByTime(750); // One step
            vi.advanceTimersByTime(750); // Two steps

            // Should have emitted multiple step completed events
            expect(stepHandler.mock.calls.length).toBeGreaterThan(1);
        });

        it('should wrap around after completing all combinations', () => {
            controller.autocycleStart();

            // Advance through all 4 combinations plus one more
            vi.advanceTimersByTime(750 * 5);

            // Should have wrapped around
            expect(controller.getState().cycleIndex).toBeLessThan(4);
        });
    });

    describe('validity change handling', () => {
        it('should stop and emit error when circuit becomes invalid during simulation', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, handler);

            controller.autocycleStart();
            expect(controller.isRunning()).toBe(true);
            handler.mockClear();

            // Emit validity change event indicating circuit is now invalid
            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                from: VALIDITY_STATES.VALID,
                to: VALIDITY_STATES.INCOMPLETE,
                canSimulate: false,
                reason: 'Output disconnected'
            });

            expect(controller.isRunning()).toBe(false);
            expect(controller.getState().state).toBe(SIMULATION_STATES.IDLE);
            expect(handler).toHaveBeenCalledWith({
                state: 'error',
                error: 'Circuit became invalid: Output disconnected'
            });
        });

        it('should not stop when circuit remains valid', () => {
            controller.autocycleStart();

            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                from: VALIDITY_STATES.VALID,
                to: VALIDITY_STATES.VALID,
                canSimulate: true,
                reason: null
            });

            expect(controller.isRunning()).toBe(true);
        });
    });

    describe('I/O structure change handling', () => {
        it('should recalculate index when I/O count changes', () => {
            controller.autocycleStart();

            // Simulate adding a third input (with proper structure)
            const newComponents = [
                ...validCircuit.components,
                { id: 5, type: 'INPUT', label: 'I3', value: 0, inputs: [], outputs: [{ x: 0, y: 0 }] }
            ];
            mockCircuitState.getComponents.mockReturnValue(newComponents);

            eventBus.emit(EVENT_TYPES.IO_STRUCTURE_CHANGED, {
                previousInputCount: 2,
                newInputCount: 3
            });

            // Total combinations should now be 8 (2^3)
            expect(controller.getState().totalCombinations).toBe(8);
        });
    });

    describe('onToggleInput', () => {
        it('should run simulation and emit CANVAS_REDRAW', () => {
            const redrawHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);

            controller.onToggleInput();

            expect(redrawHandler).toHaveBeenCalled();
        });

        it('should use cache when available', () => {
            // Set up a valid cache
            const mockCache = {
                isValid: true,
                table: [
                    { componentValues: { 1: { value: 0 }, 2: { value: 0 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 0 }, 2: { value: 1 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 1 }, 2: { value: 0 }, 3: { value: 0 }, 4: { value: 0 } } },
                    { componentValues: { 1: { value: 1 }, 2: { value: 1 }, 3: { value: 1 }, 4: { value: 1 } } }
                ]
            };
            mockCircuitState.getTruthTableCache.mockReturnValue(mockCache);

            // Set input values to [1, 1] which corresponds to index 3
            validCircuit.components[0].value = 1;
            validCircuit.components[1].value = 1;

            controller.onToggleInput();

            // Should update cycleIndex to match input state
            expect(controller.getState().cycleIndex).toBe(3);
            expect(controller.getState().totalCombinations).toBe(4);
        });

        it('should emit SIMULATION_STEP_COMPLETED with correct cycleIndex', () => {
            const stepHandler = vi.fn();
            eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, stepHandler);

            // Set input values to [0, 1] which corresponds to index 1
            validCircuit.components[0].value = 0;
            validCircuit.components[1].value = 1;

            controller.onToggleInput();

            expect(stepHandler).toHaveBeenCalled();
            const eventData = stepHandler.mock.calls[0][0];
            expect(eventData.cycleIndex).toBe(1);
            expect(eventData.totalCombinations).toBe(4);
            expect(eventData.inputValues).toEqual([0, 1]);
        });

        it('should fall back to simulation when cache is null', () => {
            mockCircuitState.getTruthTableCache.mockReturnValue(null);

            const redrawHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);

            controller.onToggleInput();

            // Should still work and emit CANVAS_REDRAW
            expect(redrawHandler).toHaveBeenCalled();
        });

        it('should fall back to simulation when cache is invalid', () => {
            const mockCache = { isValid: false, table: [] };
            mockCircuitState.getTruthTableCache.mockReturnValue(mockCache);

            const redrawHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);

            controller.onToggleInput();

            // Should still work and emit CANVAS_REDRAW
            expect(redrawHandler).toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        it('should clean up event listeners and timers', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.AUTOCYCLE_STATE_CHANGED, handler);

            controller.autocycleStart();
            controller.destroy();
            handler.mockClear();

            // Should no longer react to validity changes after destroy
            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                canSimulate: false,
                reason: 'Test'
            });

            // No error event should be emitted because listener was removed
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
