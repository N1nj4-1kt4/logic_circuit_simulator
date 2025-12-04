/**
 * Unit tests for CircuitOperations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitOperations } from '../../../src/core/CircuitOperations.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import {
    NoInputsError,
    NoOutputsError,
    EmptyCircuitError,
    BoardNameRequiredError,
    ComponentNotFoundError,
    BoardSaveError,
    BoardLoadError,
    ComponentSaveError
} from '../../../src/core/errors.js';

// Mock dependencies
const createMockBoardManager = () => ({
    saveBoard: vi.fn().mockResolvedValue(true),
    loadBoard: vi.fn().mockResolvedValue(null),
    deleteBoard: vi.fn().mockResolvedValue(true),
    getAllBoards: vi.fn().mockResolvedValue({}),
    storage: {
        getItem: vi.fn().mockResolvedValue(null),
        setItem: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined)
    }
});

const createMockComponentLibrary = () => ({
    saveComponent: vi.fn().mockResolvedValue(true),
    loadComponent: vi.fn().mockResolvedValue(null),
    deleteComponent: vi.fn().mockResolvedValue(true),
    listComponents: vi.fn().mockResolvedValue({})
});

const createMockCallbacks = () => ({
    redraw: vi.fn(),
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

describe('CircuitOperations', () => {
    let state;
    let operations;
    let mockBoardManager;
    let mockComponentLibrary;
    let mockCallbacks;

    beforeEach(() => {
        state = new CircuitState();
        mockBoardManager = createMockBoardManager();
        mockComponentLibrary = createMockComponentLibrary();
        mockCallbacks = createMockCallbacks();

        operations = new CircuitOperations({
            state,
            boardManager: mockBoardManager,
            componentLibrary: mockComponentLibrary,
            callbacks: mockCallbacks
        });

        // Clear event bus before each test
        eventBus.clear();

        // Clear timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
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
    });

    // ====================================
    // Simulation Tests
    // ====================================

    describe('Simulation', () => {
        it('runs simulation and emits events', () => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(300, 100, 'OUTPUT');

            const redrawHandler = vi.fn();
            const highlightHandler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, redrawHandler);
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT, highlightHandler);

            operations.simulate();

            expect(redrawHandler).toHaveBeenCalled();
            expect(highlightHandler).toHaveBeenCalled();
        });

        describe('Auto Cycle', () => {
            beforeEach(() => {
                operations.placeComponent(100, 100, 'INPUT');
                operations.placeComponent(100, 200, 'INPUT');
                operations.placeComponent(300, 100, 'OUTPUT');
            });

            it('throws NoInputsError when no inputs', () => {
                // Clear state and add only output
                state.clearComponents();
                operations.placeComponent(300, 100, 'OUTPUT');

                expect(() => operations.startAutoCycle()).toThrow(NoInputsError);
            });

            it('throws NoOutputsError when no outputs', () => {
                // Clear state and add only input
                state.clearComponents();
                operations.placeComponent(100, 100, 'INPUT');

                expect(() => operations.startAutoCycle()).toThrow(NoOutputsError);
            });

            it('starts auto-cycling with correct state', () => {
                operations.startAutoCycle();

                expect(state.isAutoCyclingActive()).toBe(true);
                expect(state.getTotalCombinations()).toBe(4); // 2^2 = 4
            });

            it('emits SIMULATION_STATE_CHANGED when starting', () => {
                const handler = vi.fn();
                eventBus.on(EVENT_TYPES.SIMULATION_STATE_CHANGED, handler);

                operations.startAutoCycle();

                expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                    isRunning: true,
                    totalCombinations: 4
                }));
            });

            it('stops auto-cycling correctly', () => {
                operations.startAutoCycle();
                operations.stopAutoCycle();

                expect(state.isAutoCyclingActive()).toBe(false);
            });

            it('emits SIMULATION_STATE_CHANGED when stopping', () => {
                operations.startAutoCycle();

                const handler = vi.fn();
                eventBus.on(EVENT_TYPES.SIMULATION_STATE_CHANGED, handler);

                operations.stopAutoCycle();

                expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                    isRunning: false
                }));
            });

            it('preserves input state when input count increases during simulation', () => {
                // Start with 2 inputs (I1, I2)
                operations.startAutoCycle();
                expect(state.getTotalCombinations()).toBe(4); // 2^2 = 4

                // Set inputs to specific values: I1=1, I2=0 (index 2 in 2-input space)
                const inputsBefore = state.getComponents()
                    .filter(c => c.type === 'INPUT')
                    .sort((a, b) => a.label.localeCompare(b.label));
                inputsBefore[0].value = 1; // I1
                inputsBefore[1].value = 0; // I2
                state.setCurrentCycleIndex(2);

                // Add a third input while simulation is running
                operations.placeComponent(100, 300, 'INPUT');

                // Call autoCycleStep which should detect the change
                operations.autoCycleStep();

                // totalCombinations should be updated to 8 (2^3)
                expect(state.getTotalCombinations()).toBe(8);

                // The index should be calculated from current input values
                // I1=1, I2=0, I3=0 (new input defaults to 0) = binary 100 = index 4
                // After the step processes index 4 and increments, we should be at 5
                expect(state.getCurrentCycleIndex()).toBe(5);
            });

            it('preserves input state when input count decreases during simulation', () => {
                // Start with 2 inputs (I1, I2)
                operations.startAutoCycle();
                expect(state.getTotalCombinations()).toBe(4); // 2^2 = 4

                // Set inputs to specific values: I1=1, I2=1 (index 3 in 2-input space)
                const inputsBefore = state.getComponents()
                    .filter(c => c.type === 'INPUT')
                    .sort((a, b) => a.label.localeCompare(b.label));
                inputsBefore[0].value = 1; // I1
                inputsBefore[1].value = 1; // I2
                state.setCurrentCycleIndex(3);

                // Remove I1 while simulation is running
                state.removeComponent(inputsBefore[0].id);

                // Call autoCycleStep which should detect the change
                operations.autoCycleStep();

                // totalCombinations should be updated to 2 (2^1)
                expect(state.getTotalCombinations()).toBe(2);

                // The remaining input I2 had value 1, so newIndex = 1
                // Step processes index 1, then increments to 2
                // The wrap check happens at the START of next step, not after increment
                expect(state.getCurrentCycleIndex()).toBe(2);
            });

            it('continues from correct position after input added', () => {
                // Start with 2 inputs
                operations.startAutoCycle();

                // Manually set input values to I1=1, I2=1
                const inputsBefore = state.getComponents()
                    .filter(c => c.type === 'INPUT')
                    .sort((a, b) => a.label.localeCompare(b.label));
                inputsBefore[0].value = 1; // I1
                inputsBefore[1].value = 1; // I2

                // Add a third input (I3 starts at 0)
                operations.placeComponent(100, 300, 'INPUT');

                // Run one step to trigger the recalculation
                operations.autoCycleStep();

                // Get inputs sorted by label
                const inputs = state.getComponents()
                    .filter(c => c.type === 'INPUT')
                    .sort((a, b) => a.label.localeCompare(b.label));

                expect(inputs).toHaveLength(3);

                // The step should have used index derived from I1=1, I2=1, I3=0 = 110 = 6
                // So inputs should reflect index 6 values
                expect(inputs[0].value).toBe(1); // I1
                expect(inputs[1].value).toBe(1); // I2
                expect(inputs[2].value).toBe(0); // I3
            });
        });

        describe('Step Simulation', () => {
            beforeEach(() => {
                operations.placeComponent(100, 100, 'INPUT');
                operations.placeComponent(300, 100, 'OUTPUT');
            });

            it('throws NoInputsError when no inputs', () => {
                state.clearComponents();
                operations.placeComponent(300, 100, 'OUTPUT');

                expect(() => operations.stepSimulation(1)).toThrow(NoInputsError);
            });

            it('throws NoOutputsError when no outputs', () => {
                state.clearComponents();
                operations.placeComponent(100, 100, 'INPUT');

                expect(() => operations.stepSimulation(1)).toThrow(NoOutputsError);
            });

            it('steps forward through combinations', () => {
                // Start at 0 (default), step forward
                // With 1 input, total combinations = 2 (0, 1)
                operations.stepSimulation(1);

                // Should advance from input=0 to input=1
                expect(state.getCurrentCycleIndex()).toBe(1);
            });

            it('wraps around at end when stepping forward', () => {
                // Set input value to 1 to start at index 1
                const inputs = state.getComponents().filter(c => c.type === 'INPUT');
                inputs[0].value = 1;

                operations.stepSimulation(1);

                // Should wrap from 1 to 0
                expect(state.getCurrentCycleIndex()).toBe(0);
            });

            it('steps backward through combinations', () => {
                // Set input value to 1 to start at index 1
                const inputs = state.getComponents().filter(c => c.type === 'INPUT');
                inputs[0].value = 1;

                operations.stepSimulation(-1);

                // Should go from 1 to 0
                expect(state.getCurrentCycleIndex()).toBe(0);
            });

            it('wraps around at beginning when stepping backward', () => {
                // Input is 0, step backward should wrap to 1
                operations.stepSimulation(-1);

                expect(state.getCurrentCycleIndex()).toBe(1);
            });
        });

        describe('Reset Simulation', () => {
            beforeEach(() => {
                operations.placeComponent(100, 100, 'INPUT');
                operations.placeComponent(100, 200, 'INPUT');
                operations.placeComponent(300, 100, 'OUTPUT');
            });

            it('resets all inputs to 0', () => {
                const inputs = state.getComponents().filter(c => c.type === 'INPUT');
                inputs.forEach(input => { input.value = 1; });

                operations.resetSimulation();

                inputs.forEach(input => {
                    expect(input.value).toBe(0);
                });
            });

            it('resets cycle index to 0', () => {
                state.setCurrentCycleIndex(3);
                operations.resetSimulation();

                expect(state.getCurrentCycleIndex()).toBe(0);
            });

            it('stops auto-cycle if running', () => {
                operations.startAutoCycle();
                operations.resetSimulation();

                expect(state.isAutoCyclingActive()).toBe(false);
            });

            it('does nothing if no inputs', () => {
                state.clearComponents();
                operations.placeComponent(300, 100, 'OUTPUT');

                // Should not throw
                expect(() => operations.resetSimulation()).not.toThrow();
            });
        });
    });

    // ====================================
    // Board Management Tests
    // ====================================

    describe('Board Management', () => {
        describe('Save Current Board', () => {
            it('throws BoardNameRequiredError for empty name', async () => {
                await expect(operations.saveCurrentBoard('')).rejects.toThrow(BoardNameRequiredError);
                await expect(operations.saveCurrentBoard('   ')).rejects.toThrow(BoardNameRequiredError);
            });

            it('saves board and updates state', async () => {
                operations.placeComponent(100, 100, 'INPUT');
                mockBoardManager.saveBoard.mockResolvedValue(true);
                mockBoardManager.getAllBoards.mockResolvedValue({ 'TestBoard': {} });

                const result = await operations.saveCurrentBoard('TestBoard');

                expect(result).toBe('TestBoard');
                expect(state.getCurrentBoardName()).toBe('TestBoard');
                expect(mockBoardManager.saveBoard).toHaveBeenCalled();
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
        });

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
                expect(state.getComponents()).toHaveLength(1);
                expect(state.getCurrentBoardName()).toBe('TestBoard');
            });

            it('throws BoardLoadError when board not found', async () => {
                mockBoardManager.loadBoard.mockResolvedValue(null);

                await expect(operations.loadBoard('NonExistent')).rejects.toThrow(BoardLoadError);
            });

            it('emits BOARD_LOADED after loading', async () => {
                const handler = vi.fn();
                eventBus.on(EVENT_TYPES.BOARD_LOADED, handler);

                mockBoardManager.loadBoard.mockResolvedValue({
                    components: [],
                    connections: []
                });

                await operations.loadBoard('TestBoard');

                expect(handler).toHaveBeenCalled();
            });
        });

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
                operations.placeComponent(100, 100, 'INPUT');
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
        });

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
                operations.placeComponent(100, 100, 'INPUT');
                mockBoardManager.deleteBoard.mockResolvedValue(true);

                await operations.deleteBoard('TestBoard');

                expect(state.getComponents()).toHaveLength(0);
                expect(state.getCurrentBoardName()).toBeNull();
            });
        });
    });

    // ====================================
    // Component Library Management Tests
    // ====================================

    describe('Component Library Management', () => {
        describe('Save Component', () => {
            beforeEach(() => {
                operations.placeComponent(100, 100, 'INPUT');
                operations.placeComponent(300, 100, 'OUTPUT');
            });

            it('throws EmptyCircuitError for empty circuit', async () => {
                state.clearComponents();

                await expect(operations.saveComponent('Test', 'Description'))
                    .rejects.toThrow(EmptyCircuitError);
            });

            it('throws NoInputsError when no inputs', async () => {
                state.clearComponents();
                operations.placeComponent(300, 100, 'OUTPUT');
                operations.placeComponent(200, 100, 'AND');

                await expect(operations.saveComponent('Test', 'Description'))
                    .rejects.toThrow(NoInputsError);
            });

            it('throws NoOutputsError when no outputs', async () => {
                state.clearComponents();
                operations.placeComponent(100, 100, 'INPUT');
                operations.placeComponent(200, 100, 'AND');

                await expect(operations.saveComponent('Test', 'Description'))
                    .rejects.toThrow(NoOutputsError);
            });

            it('saves component to library', async () => {
                mockComponentLibrary.saveComponent.mockResolvedValue(true);
                mockComponentLibrary.listComponents.mockResolvedValue({ 'TestComp': {} });

                const result = await operations.saveComponent('TestComp', 'A test component');

                expect(result).toBe('TestComp');
                expect(mockComponentLibrary.saveComponent).toHaveBeenCalled();
                expect(state.getCurrentComponentName()).toBe('TestComp');
            });

            it('throws ComponentSaveError on failure', async () => {
                mockComponentLibrary.saveComponent.mockResolvedValue(false);

                await expect(operations.saveComponent('TestComp', 'Description'))
                    .rejects.toThrow(ComponentSaveError);
            });
        });

        describe('Delete Component', () => {
            it('deletes component from library', async () => {
                mockComponentLibrary.deleteComponent.mockResolvedValue(true);
                mockComponentLibrary.listComponents.mockResolvedValue({});

                const result = await operations.deleteComponent('TestComp');

                expect(result).toBe(true);
                expect(mockComponentLibrary.deleteComponent).toHaveBeenCalledWith('TestComp');
            });

            it('clears component name when deleting current component', async () => {
                state.setCurrentComponentName('TestComp');
                mockComponentLibrary.deleteComponent.mockResolvedValue(true);

                await operations.deleteComponent('TestComp');

                expect(state.getCurrentComponentName()).toBeNull();
            });

            it('returns false on failure', async () => {
                mockComponentLibrary.deleteComponent.mockResolvedValue(false);

                const result = await operations.deleteComponent('TestComp');

                expect(result).toBe(false);
            });
        });

        describe('Load Component For Editing', () => {
            it('loads component and updates state', async () => {
                const componentDef = {
                    name: 'TestComp',
                    components: [{ id: 1, type: 'INPUT', x: 100, y: 100 }],
                    connections: []
                };
                mockComponentLibrary.loadComponent.mockResolvedValue(componentDef);

                const result = await operations.loadComponentForEditing('TestComp');

                expect(result).toBe('TestComp');
                expect(state.getCurrentComponentName()).toBe('TestComp');
                expect(state.getCurrentBoardName()).toBeNull();
            });

            it('throws ComponentNotFoundError when component not found', async () => {
                mockComponentLibrary.loadComponent.mockResolvedValue(null);

                await expect(operations.loadComponentForEditing('NonExistent'))
                    .rejects.toThrow(ComponentNotFoundError);
            });
        });

        describe('Export Component', () => {
            it('exports component to file', async () => {
                const componentDef = {
                    name: 'TestComp',
                    components: [],
                    connections: []
                };
                mockComponentLibrary.loadComponent.mockResolvedValue(componentDef);

                // Mock DOM APIs
                const mockAnchor = { href: '', download: '', click: vi.fn() };
                vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
                vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
                vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

                const result = await operations.exportComponent('TestComp');

                expect(result).toBe('TestComp');
                expect(mockAnchor.download).toBe('TestComp.json');
                expect(mockAnchor.click).toHaveBeenCalled();
            });

            it('throws ComponentNotFoundError when component not found', async () => {
                mockComponentLibrary.loadComponent.mockResolvedValue(null);

                await expect(operations.exportComponent('NonExistent'))
                    .rejects.toThrow(ComponentNotFoundError);
            });
        });

        describe('Import Component', () => {
            it('returns null when no file selected', async () => {
                const event = { target: { files: [], value: '' } };

                const result = await operations.importComponent(event);

                expect(result).toBeNull();
            });

            // Note: File import tests require FileReader mocking which is complex
            // and the functionality is better tested via integration tests
        });
    });

    // ====================================
    // Auto-Save Tests
    // ====================================

    describe('Auto-Save Functionality', () => {
        beforeEach(() => {
            operations.setupAutoSave();
        });

        afterEach(() => {
            operations.clearAutoSave();
        });

        it('saves board state on BOARD_CHANGED event after debounce', async () => {
            eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

            // Fast-forward past debounce delay
            vi.advanceTimersByTime(1500);

            expect(mockBoardManager.storage.setItem).toHaveBeenCalledWith(
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
            expect(mockBoardManager.storage.setItem).toHaveBeenCalledTimes(1);
        });

        it('clears board state on BOARD_CLEARED event', async () => {
            eventBus.emit(EVENT_TYPES.BOARD_CLEARED);

            // BOARD_CLEARED triggers immediately (no debounce)
            await vi.runAllTimersAsync();

            expect(mockBoardManager.storage.removeItem).toHaveBeenCalledWith('currentBoard');
        });

        it('loads board state from storage', async () => {
            const savedState = JSON.stringify({
                components: [{ id: 1, type: 'INPUT', x: 100, y: 100, label: 'I1' }],
                connections: [],
                nextId: 2,
                currentBoardName: 'SavedBoard'
            });
            mockBoardManager.storage.getItem.mockResolvedValue(savedState);

            await operations.loadBoardState();

            expect(state.getComponents()).toHaveLength(1);
            expect(state.getCurrentBoardName()).toBe('SavedBoard');
        });

        it('handles empty storage gracefully', async () => {
            mockBoardManager.storage.getItem.mockResolvedValue(null);

            await operations.loadBoardState();

            expect(state.getComponents()).toHaveLength(0);
        });
    });

    // ====================================
    // Truth Table Recomputation Tests
    // ====================================

    describe('Truth Table Recomputation', () => {
        it('stores computed truth table in state', () => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(300, 100, 'OUTPUT');

            operations.recomputeTruthTable();

            const cache = state.getTruthTableCache();
            expect(cache).not.toBeNull();
        });

        it('emits TRUTH_TABLE_COMPUTED event', () => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(300, 100, 'OUTPUT');

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, handler);

            operations.recomputeTruthTable();

            expect(handler).toHaveBeenCalled();
        });

        it('sets truthTableCache with isValid property', () => {
            operations.placeComponent(100, 100, 'INPUT');
            operations.placeComponent(300, 100, 'OUTPUT');

            operations.recomputeTruthTable();

            const cache = state.getTruthTableCache();
            expect(cache).toHaveProperty('isValid');
        });

        it('handles debounced recomputation setup', () => {
            // Verify the debounce timer property exists
            expect(operations.truthTableDebounceTimer).toBeDefined();
        });
    });
});
