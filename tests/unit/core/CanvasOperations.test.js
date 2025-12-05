/**
 * Unit tests for CanvasOperations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CanvasOperations } from '../../../src/core/CanvasOperations.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import { ComponentNotFoundError } from '../../../src/core/errors.js';

const createMockCallbacks = () => ({
    defineComponentPorts: vi.fn((component) => {
        // Default port definition for testing
        if (component.type === 'INPUT') {
            component.inputs = [];
            component.outputs = [{ x: component.x + 20, y: component.y }];
        } else if (component.type === 'OUTPUT') {
            component.inputs = [{ x: component.x - 20, y: component.y }];
            component.outputs = [];
        } else if (component.type === 'AND' || component.type === 'OR') {
            component.inputs = [
                { x: component.x - 25, y: component.y - 10 },
                { x: component.x - 25, y: component.y + 10 }
            ];
            component.outputs = [{ x: component.x + 25, y: component.y }];
        } else if (component.type === 'NOT') {
            component.inputs = [{ x: component.x - 20, y: component.y }];
            component.outputs = [{ x: component.x + 20, y: component.y }];
        }
    }),
    findComponent: vi.fn(),
    findPort: vi.fn()
});

describe('CanvasOperations', () => {
    let state;
    let operations;
    let mockCallbacks;

    beforeEach(() => {
        state = new CircuitState();
        mockCallbacks = createMockCallbacks();

        operations = new CanvasOperations({
            state,
            callbacks: mockCallbacks
        });

        // Clear event bus before each test
        eventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ====================================
    // Component Placement Tests
    // ====================================

    describe('Component Placement', () => {
        it('places component at snapped coordinates', () => {
            operations.placeComponent(123, 167, 'AND');

            const components = state.getComponents();
            expect(components).toHaveLength(1);
            // Snapped to grid (50px grid)
            expect(components[0].x).toBe(100);
            expect(components[0].y).toBe(150);
        });

        it('defines ports for standard gates', () => {
            operations.placeComponent(100, 100, 'AND');

            const component = state.getComponents()[0];
            expect(component.inputs).toBeDefined();
            expect(component.outputs).toBeDefined();
            expect(mockCallbacks.defineComponentPorts).toHaveBeenCalledWith(component);
        });

        it('generates unique component IDs', () => {
            operations.placeComponent(100, 100, 'AND');
            operations.placeComponent(200, 200, 'OR');
            operations.placeComponent(300, 300, 'NOT');

            const components = state.getComponents();
            const ids = components.map(c => c.id);
            expect(new Set(ids).size).toBe(3);
        });

        it('sets INPUT component value to 0', () => {
            operations.placeComponent(100, 100, 'INPUT');

            const component = state.getComponents()[0];
            expect(component.type).toBe('INPUT');
            expect(component.value).toBe(0);
        });

        it('sets gate component value to null', () => {
            operations.placeComponent(100, 100, 'AND');

            const component = state.getComponents()[0];
            expect(component.type).toBe('AND');
            expect(component.value).toBeNull();
        });

        it('assigns labels to INPUT components', () => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(200, 100, 'INPUT');

            const components = state.getComponents();
            expect(components[0].label).toBe('I1');
            expect(components[1].label).toBe('I2');
        });

        it('assigns labels to OUTPUT components', () => {
            operations.placeComponent(100, 100, 'OUTPUT');
            operations.placeComponent(200, 100, 'OUTPUT');

            const components = state.getComponents();
            expect(components[0].label).toBe('O1');
            expect(components[1].label).toBe('O2');
        });

        it('emits CANVAS_REDRAW event after placement', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            operations.placeComponent(100, 100, 'AND');

            expect(handler).toHaveBeenCalled();
        });

        describe('Custom Components', () => {
            beforeEach(() => {
                // Setup custom component in state
                state.setCustomComponents({
                    'MyGate': {
                        name: 'MyGate',
                        inputPorts: [{ label: 'A', id: 1 }],
                        outputPorts: [{ label: 'Q', id: 2 }]
                    }
                });

                // Update callback to handle CUSTOM type
                mockCallbacks.defineComponentPorts = vi.fn((component) => {
                    if (component.type === 'CUSTOM') {
                        component.inputs = [{ x: component.x - 45, y: component.y }];
                        component.outputs = [{ x: component.x + 45, y: component.y }];
                    }
                });
            });

            it('places custom component with correct type', () => {
                operations.placeComponent(100, 100, 'CUSTOM:MyGate');

                const component = state.getComponents()[0];
                expect(component.type).toBe('CUSTOM');
                expect(component.customName).toBe('MyGate');
            });

            it('stores custom definition in component', () => {
                operations.placeComponent(100, 100, 'CUSTOM:MyGate');

                const component = state.getComponents()[0];
                expect(component.customDefinition).toBeDefined();
                expect(component.customDefinition.name).toBe('MyGate');
            });

            it('throws ComponentNotFoundError for unknown custom component', () => {
                expect(() => {
                    operations.placeComponent(100, 100, 'CUSTOM:UnknownGate');
                }).toThrow(ComponentNotFoundError);
            });
        });
    });

    // ====================================
    // Connection Tests
    // ====================================

    describe('Connections', () => {
        let inputComponent;
        let gateComponent;
        let outputComponent;

        beforeEach(() => {
            // Setup a simple circuit: INPUT -> AND -> OUTPUT
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(200, 100, 'AND');
            operations.placeComponent(300, 100, 'OUTPUT');

            inputComponent = state.getComponents()[0];
            gateComponent = state.getComponents()[1];
            outputComponent = state.getComponents()[2];
        });

        it('creates connection between output and input', () => {
            // Mock finding the output port of INPUT
            mockCallbacks.findPort.mockReturnValueOnce({
                component: inputComponent,
                portIndex: 0,
                isOutput: true,
                x: 120,
                y: 100
            });

            operations.handleConnect(120, 100);

            // Verify connection start is set
            expect(state.getConnectStart()).not.toBeNull();

            // Mock finding the input port of AND gate
            mockCallbacks.findPort.mockReturnValueOnce({
                component: gateComponent,
                portIndex: 0,
                isOutput: false,
                x: 175,
                y: 100
            });

            operations.handleConnect(175, 100);

            const connections = state.getConnections();
            expect(connections).toHaveLength(1);
            // Connection stores component object references, not IDs
            expect(connections[0].from).toBe(inputComponent);
            expect(connections[0].to).toBe(gateComponent);
        });

        it('only starts connection from output port', () => {
            // Try to start from input port (should not work)
            mockCallbacks.findPort.mockReturnValueOnce({
                component: gateComponent,
                portIndex: 0,
                isOutput: false, // Input port
                x: 175,
                y: 100
            });

            operations.handleConnect(175, 100);

            expect(state.getConnectStart()).toBeNull();
        });

        it('only ends connection at input port', () => {
            // Start connection from output
            mockCallbacks.findPort.mockReturnValueOnce({
                component: inputComponent,
                portIndex: 0,
                isOutput: true,
                x: 120,
                y: 100
            });

            operations.handleConnect(120, 100);
            expect(state.getConnectStart()).not.toBeNull();

            // Try to end at another output port (should not work)
            mockCallbacks.findPort.mockReturnValueOnce({
                component: gateComponent,
                portIndex: 0,
                isOutput: true, // Output port
                x: 225,
                y: 100
            });

            operations.handleConnect(225, 100);

            expect(state.getConnections()).toHaveLength(0);
        });

        it('does nothing when clicking empty space', () => {
            mockCallbacks.findPort.mockReturnValue(null);

            operations.handleConnect(500, 500);

            expect(state.getConnectStart()).toBeNull();
            expect(state.getConnections()).toHaveLength(0);
        });

        it('emits CONNECTION_START_CHANGED event when starting connection', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CONNECTION_START_CHANGED, handler);

            mockCallbacks.findPort.mockReturnValueOnce({
                component: inputComponent,
                portIndex: 0,
                isOutput: true,
                x: 120,
                y: 100
            });

            operations.handleConnect(120, 100);

            expect(handler).toHaveBeenCalledWith(true);
        });

        it('emits CANVAS_REDRAW after creating connection', () => {
            const handler = vi.fn();

            // Start connection
            mockCallbacks.findPort.mockReturnValueOnce({
                component: inputComponent,
                portIndex: 0,
                isOutput: true,
                x: 120,
                y: 100
            });
            operations.handleConnect(120, 100);

            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            // Complete connection
            mockCallbacks.findPort.mockReturnValueOnce({
                component: gateComponent,
                portIndex: 0,
                isOutput: false,
                x: 175,
                y: 100
            });
            operations.handleConnect(175, 100);

            expect(handler).toHaveBeenCalled();
        });
    });

    // ====================================
    // Deletion Tests
    // ====================================

    describe('Deletion', () => {
        let inputComponent;
        let gateComponent;

        beforeEach(() => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(200, 100, 'AND');

            inputComponent = state.getComponents()[0];
            gateComponent = state.getComponents()[1];
        });

        it('deletes component when found', () => {
            mockCallbacks.findComponent.mockReturnValueOnce(inputComponent);

            operations.handleDelete(100, 100, vi.fn());

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getComponents()[0].type).toBe('AND');
        });

        it('deletes connection when no component found', () => {
            // Add a connection first
            state.addConnection({
                from: inputComponent.id,
                fromPort: 0,
                to: gateComponent.id,
                toPort: 0
            });

            const connection = state.getConnections()[0];
            mockCallbacks.findComponent.mockReturnValueOnce(null);
            const findConnection = vi.fn().mockReturnValueOnce(connection);

            operations.handleDelete(150, 100, findConnection);

            expect(state.getConnections()).toHaveLength(0);
        });

        it('emits CANVAS_REDRAW after deletion', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            mockCallbacks.findComponent.mockReturnValueOnce(inputComponent);
            operations.handleDelete(100, 100, vi.fn());

            expect(handler).toHaveBeenCalled();
        });

        it('does nothing when nothing is found', () => {
            mockCallbacks.findComponent.mockReturnValueOnce(null);
            const findConnection = vi.fn().mockReturnValueOnce(null);

            operations.handleDelete(500, 500, findConnection);

            expect(state.getComponents()).toHaveLength(2);
        });

        it('commits transaction directly when provided', () => {
            // Create a mock transaction
            const mockTransaction = {
                commit: vi.fn()
            };

            operations.handleDelete(100, 100, vi.fn(), { transaction: mockTransaction });

            expect(mockTransaction.commit).toHaveBeenCalled();
            // Should not call findComponent when transaction is provided
            expect(mockCallbacks.findComponent).not.toHaveBeenCalled();
        });

        it('emits CANVAS_REDRAW when committing transaction', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            const mockTransaction = {
                commit: vi.fn()
            };

            operations.handleDelete(100, 100, vi.fn(), { transaction: mockTransaction });

            expect(handler).toHaveBeenCalled();
        });

        it('uses transaction from checkDeletionImpact for component deletion', () => {
            // Setup: find component
            mockCallbacks.findComponent.mockReturnValueOnce(inputComponent);

            // Get impact with transaction
            const impact = operations.checkDeletionImpact(100, 100, vi.fn());

            // Verify transaction is returned
            expect(impact.transaction).toBeDefined();
            expect(impact.component).toBe(inputComponent);

            // Delete using transaction
            operations.handleDelete(100, 100, vi.fn(), { transaction: impact.transaction });

            // Verify component was deleted
            expect(state.getComponents()).toHaveLength(1);
            expect(state.getComponents()[0].type).toBe('AND');
        });

        it('uses transaction from checkDeletionImpact for connection deletion', () => {
            // Add a connection first
            state.addConnection({
                from: inputComponent.id,
                fromPort: 0,
                to: gateComponent.id,
                toPort: 0
            });

            const connection = state.getConnections()[0];
            mockCallbacks.findComponent.mockReturnValueOnce(null);
            const findConnection = vi.fn().mockReturnValueOnce(connection);

            // Get impact with transaction
            const impact = operations.checkDeletionImpact(150, 100, findConnection);

            // Verify transaction is returned
            expect(impact.transaction).toBeDefined();
            expect(impact.connection).toBe(connection);

            // Delete using transaction
            operations.handleDelete(150, 100, vi.fn(), { transaction: impact.transaction });

            // Verify connection was deleted
            expect(state.getConnections()).toHaveLength(0);
        });
    });

    // ====================================
    // Check Deletion Impact Tests
    // ====================================

    describe('checkDeletionImpact', () => {
        let input1, input2, output1, gate;

        beforeEach(() => {
            // Create a valid circuit: 2 inputs -> AND gate -> 1 output
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(100, 200, 'INPUT');
            operations.placeComponent(200, 150, 'AND');
            operations.placeComponent(300, 150, 'OUTPUT');

            const components = state.getComponents();
            input1 = components[0];
            input2 = components[1];
            gate = components[2];
            output1 = components[3];

            // Connect input1 -> gate port 0
            state.addConnection({
                from: input1.id,
                fromPort: 0,
                to: gate.id,
                toPort: 0
            });

            // Connect input2 -> gate port 1
            state.addConnection({
                from: input2.id,
                fromPort: 0,
                to: gate.id,
                toPort: 1
            });

            // Connect gate -> output
            state.addConnection({
                from: gate.id,
                fromPort: 0,
                to: output1.id,
                toPort: 0
            });
        });

        it('returns willInvalidate: false when simulation is not running', () => {
            mockCallbacks.findComponent.mockReturnValueOnce(input1);

            const result = operations.checkDeletionImpact(100, 100, vi.fn());

            expect(result.willInvalidate).toBe(false);
            expect(result.component).toBe(input1);
        });

        it('returns willInvalidate: false when nothing found at coordinates', () => {
            mockCallbacks.findComponent.mockReturnValueOnce(null);
            const findConnection = vi.fn().mockReturnValueOnce(null);

            const result = operations.checkDeletionImpact(500, 500, findConnection);

            expect(result.willInvalidate).toBe(false);
            expect(result.component).toBeNull();
            expect(result.connection).toBeNull();
        });

        it('returns willInvalidate: true when deleting input during simulation would invalidate circuit', () => {
            // Start simulation
            state.setAutoCycling(true);

            mockCallbacks.findComponent.mockReturnValueOnce(input1);

            const result = operations.checkDeletionImpact(100, 100, vi.fn());

            // Deleting input1 would leave gate with only 1 input connected
            expect(result.willInvalidate).toBe(true);
            expect(result.component).toBe(input1);
        });

        it('returns willInvalidate: true when deleting critical connection during simulation', () => {
            // Start simulation
            state.setAutoCycling(true);

            const connection = state.getConnections()[0]; // input1 -> gate connection
            mockCallbacks.findComponent.mockReturnValueOnce(null);
            const findConnection = vi.fn().mockReturnValueOnce(connection);

            const result = operations.checkDeletionImpact(150, 100, findConnection);

            // Deleting this connection would leave gate with only 1 input connected
            expect(result.willInvalidate).toBe(true);
            expect(result.connection).toBe(connection);
        });

        it('returns willInvalidate: false when circuit remains valid after deletion', () => {
            // Add a second AND gate that's also fully connected
            operations.placeComponent(200, 250, 'AND');
            const components = state.getComponents();
            const gate2 = components[4];

            // Connect both inputs to gate2 as well
            state.addConnection({
                from: input1.id,
                fromPort: 0,
                to: gate2.id,
                toPort: 0
            });
            state.addConnection({
                from: input2.id,
                fromPort: 0,
                to: gate2.id,
                toPort: 1
            });

            // Add second output for gate2
            operations.placeComponent(300, 250, 'OUTPUT');
            const output2 = state.getComponents()[5];
            state.addConnection({
                from: gate2.id,
                fromPort: 0,
                to: output2.id,
                toPort: 0
            });

            // Start simulation
            state.setAutoCycling(true);

            // Delete the first gate - circuit should still be valid because gate2 is fully connected
            mockCallbacks.findComponent.mockReturnValueOnce(gate);

            const result = operations.checkDeletionImpact(200, 150, vi.fn());

            expect(result.willInvalidate).toBe(false);
            expect(result.component).toBe(gate);
        });

        it('returns willInvalidate: true when deleting the only gate during simulation', () => {
            // Start simulation
            state.setAutoCycling(true);

            mockCallbacks.findComponent.mockReturnValueOnce(gate);

            const result = operations.checkDeletionImpact(200, 150, vi.fn());

            // Deleting the only gate would leave no valid circuits
            expect(result.willInvalidate).toBe(true);
            expect(result.component).toBe(gate);
        });

        it('returns willInvalidate: true when deleting the only output during simulation', () => {
            // Start simulation
            state.setAutoCycling(true);

            mockCallbacks.findComponent.mockReturnValueOnce(output1);

            const result = operations.checkDeletionImpact(300, 150, vi.fn());

            // Deleting the only output would invalidate the circuit
            expect(result.willInvalidate).toBe(true);
            expect(result.component).toBe(output1);
        });
    });
});
