/**
 * Integration tests for full circuit workflow
 * Tests end-to-end functionality of the circuit simulator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';
import { CanvasOperations } from '../../src/core/CanvasOperations.js';
import { BoardOperations } from '../../src/core/BoardOperations.js';
import { ComponentLibraryOperations } from '../../src/core/ComponentLibraryOperations.js';
import { ContextManager } from '../../src/core/ContextManager.js';
import { CircuitAnalysisManager } from '../../src/core/CircuitAnalysisManager.js';
import { SimulationController } from '../../src/core/SimulationController.js';
import { CircuitValidityManager } from '../../src/core/CircuitValidityManager.js';
import { eventBus, EVENT_TYPES } from '../../src/utils/eventBus.js';
import { simulateCircuit } from '../../src/core/circuitEvaluator.js';
import { BoardManager } from '../../src/storage/BoardManager.js';
import { ComponentLibrary } from '../../src/storage/ComponentLibrary.js';
import { LocalStorageAdapter } from '../../src/storage/LocalStorageAdapter.js';
import { EmptyCircuitError, NoInputsError } from '../../src/core/errors.js';

// Create a working localStorage mock for integration tests
function createLocalStorageMock() {
    const storage = new Map();
    return {
        getItem: vi.fn((key) => storage.get(key) ?? null),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        clear: vi.fn(() => storage.clear()),
        key: vi.fn((index) => Array.from(storage.keys())[index] ?? null),
        get length() { return storage.size; }
    };
}

describe('Full Circuit Workflow', () => {
    let state;
    let storageAdapter;
    let boardManager;
    let componentLibrary;
    let canvasOperations;
    let boardOperations;
    let componentLibraryOperations;
    let simulationController;
    let validityManager;
    let mockStorage;

    // Mock callbacks for CanvasOperations
    const mockCallbacks = {
        redraw: vi.fn(),
        defineComponentPorts: vi.fn((component) => {
            // Define ports based on component type
            switch (component.type) {
                case 'INPUT':
                    component.inputs = [];
                    component.inputPorts = [];
                    component.outputPorts = [{ x: component.x + 20, y: component.y }];
                    break;
                case 'OUTPUT':
                    component.inputs = [null];
                    component.inputPorts = [{ x: component.x - 20, y: component.y }];
                    component.outputPorts = [];
                    break;
                case 'AND':
                case 'OR':
                case 'XOR':
                case 'NAND':
                case 'NOR':
                case 'XNOR':
                    component.inputs = [null, null];
                    component.inputPorts = [
                        { x: component.x - 25, y: component.y - 10 },
                        { x: component.x - 25, y: component.y + 10 }
                    ];
                    component.outputPorts = [{ x: component.x + 25, y: component.y }];
                    break;
                case 'NOT':
                    component.inputs = [null];
                    component.inputPorts = [{ x: component.x - 22.5, y: component.y }];
                    component.outputPorts = [{ x: component.x + 22.5, y: component.y }];
                    break;
                default:
                    component.inputs = [];
                    component.inputPorts = [];
                    component.outputPorts = [];
            }
        }),
        findComponent: vi.fn(),
        findPort: vi.fn()
    };

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();
        eventBus.clear();

        // Create a working localStorage mock for this test
        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        // Initialize state and storage
        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();
        boardManager = new BoardManager(storageAdapter);
        componentLibrary = new ComponentLibrary(storageAdapter);

        // Initialize CircuitAnalysisManager
        const circuitAnalysisManager = new CircuitAnalysisManager({ state });

        // Initialize ContextManager
        const contextManager = new ContextManager({
            state,
            boardManager,
            componentLibrary,
            circuitAnalysisManager
        });

        // Initialize operations using new split classes
        canvasOperations = new CanvasOperations({
            state,
            callbacks: mockCallbacks
        });

        boardOperations = new BoardOperations({
            state,
            boardManager,
            contextManager
        });

        componentLibraryOperations = new ComponentLibraryOperations({
            state,
            componentLibrary,
            contextManager
        });

        // Initialize simulation controller
        validityManager = new CircuitValidityManager(state);
        simulationController = new SimulationController({
            circuitState: state,
            validityManager
        });
    });

    describe('Component Placement and Connection', () => {
        it('should place components on the canvas', () => {
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(200, 100, 'AND');
            canvasOperations.placeComponent(300, 100, 'OUTPUT');

            const components = state.getComponents();
            expect(components).toHaveLength(3);
            expect(components[0].type).toBe('INPUT');
            expect(components[1].type).toBe('AND');
            expect(components[2].type).toBe('OUTPUT');
        });

        it('should snap components to grid', () => {
            canvasOperations.placeComponent(127, 163, 'INPUT');

            const components = state.getComponents();
            expect(components[0].x).toBe(150); // Snapped to nearest 50
            expect(components[0].y).toBe(150);
        });

        it('should auto-label INPUT and OUTPUT components', () => {
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(100, 200, 'INPUT');
            canvasOperations.placeComponent(300, 100, 'OUTPUT');
            canvasOperations.placeComponent(300, 200, 'OUTPUT');

            const components = state.getComponents();
            expect(components[0].label).toBe('I1');
            expect(components[1].label).toBe('I2');
            expect(components[2].label).toBe('O1');
            expect(components[3].label).toBe('O2');
        });

        it('should place gates without labels', () => {
            canvasOperations.placeComponent(200, 100, 'AND');
            canvasOperations.placeComponent(200, 200, 'OR');

            const components = state.getComponents();
            expect(components[0].label).toBeNull();
            expect(components[1].label).toBeNull();
        });
    });

    describe('Circuit Simulation', () => {
        it('should simulate AND gate correctly', () => {
            // Create circuit: INPUT1 --\
            //                           AND -- OUTPUT
            //                INPUT2 --/
            const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };
            const andGate = { id: 3, type: 'AND', x: 200, y: 150, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const output = { id: 4, type: 'OUTPUT', x: 300, y: 150, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(andGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

            simulateCircuit(state.getComponents(), state.getConnections());

            expect(output.value).toBe(1); // 1 AND 1 = 1
        });

        it('should simulate OR gate correctly', () => {
            const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };
            const orGate = { id: 3, type: 'OR', x: 200, y: 150, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const output = { id: 4, type: 'OUTPUT', x: 300, y: 150, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input1);
            state.addComponent(input2);
            state.addComponent(orGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 });
            state.addConnection({ from: 3, fromPort: 0, to: 4, toPort: 0 });

            simulateCircuit(state.getComponents(), state.getConnections());

            expect(output.value).toBe(1); // 0 OR 1 = 1
        });

        it('should simulate NOT gate correctly', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const notGate = { id: 2, type: 'NOT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [{}] };
            const output = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            simulateCircuit(state.getComponents(), state.getConnections());

            expect(output.value).toBe(1); // NOT 0 = 1
        });

        it('should simulate chain of gates (half adder)', () => {
            // Half adder: Sum = A XOR B, Carry = A AND B
            const inputA = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'A' };
            const inputB = { id: 2, type: 'INPUT', x: 100, y: 200, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'B' };
            const xorGate = { id: 3, type: 'XOR', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const andGate = { id: 4, type: 'AND', x: 200, y: 200, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
            const outputSum = { id: 5, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'Sum' };
            const outputCarry = { id: 6, type: 'OUTPUT', x: 300, y: 200, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'Carry' };

            state.addComponent(inputA);
            state.addComponent(inputB);
            state.addComponent(xorGate);
            state.addComponent(andGate);
            state.addComponent(outputSum);
            state.addComponent(outputCarry);

            // Connect inputs to both gates
            state.addConnection({ from: 1, fromPort: 0, to: 3, toPort: 0 }); // A to XOR
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 1 }); // B to XOR
            state.addConnection({ from: 1, fromPort: 0, to: 4, toPort: 0 }); // A to AND
            state.addConnection({ from: 2, fromPort: 0, to: 4, toPort: 1 }); // B to AND
            state.addConnection({ from: 3, fromPort: 0, to: 5, toPort: 0 }); // XOR to Sum
            state.addConnection({ from: 4, fromPort: 0, to: 6, toPort: 0 }); // AND to Carry

            simulateCircuit(state.getComponents(), state.getConnections());

            expect(outputSum.value).toBe(0); // 1 XOR 1 = 0
            expect(outputCarry.value).toBe(1); // 1 AND 1 = 1
        });
    });

    describe('Board Save and Load', () => {
        it('should save and load a board', async () => {
            // Create a simple circuit
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(200, 100, 'NOT');
            canvasOperations.placeComponent(300, 100, 'OUTPUT');

            const initialComponents = state.getComponents().length;

            // Save the board as "TestBoard"
            await boardOperations.saveCurrentBoard('TestBoard');

            // Create a new board (this clears the state and sets board name to null)
            state.clearComponents();
            state.setCurrentBoardName(null); // Clear board name so load won't overwrite
            expect(state.getComponents()).toHaveLength(0);

            // Load the saved board
            await boardOperations.loadBoard('TestBoard');

            expect(state.getComponents()).toHaveLength(initialComponents);
            expect(state.getCurrentBoardName()).toBe('TestBoard');
        });

        it('should maintain connections when loading a board', async () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const output = { id: 2, type: 'OUTPUT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(output);
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

            // Save the board
            await boardOperations.saveCurrentBoard('ConnectionTest');

            // Create a new board (clears state AND board name)
            state.clearComponents();
            state.setCurrentBoardName(null); // Clear board name so load won't overwrite

            // Load the saved board
            await boardOperations.loadBoard('ConnectionTest');

            expect(state.getConnections()).toHaveLength(1);
            expect(state.getConnections()[0].from).toBe(1);
            expect(state.getConnections()[0].to).toBe(2);
        });
    });

    describe('Component Library', () => {
        it('should save a circuit as custom component', async () => {
            // Create a simple NOT gate circuit
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const notGate = { id: 2, type: 'NOT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [{}] };
            const output = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(notGate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            // Save as component
            await componentLibraryOperations.saveComponent('TestInverter', 'A simple inverter');

            // Check it was saved - listComponents returns an array
            const componentsList = await componentLibrary.listComponents();
            const testInverter = componentsList.find(c => c.name === 'TestInverter');
            expect(testInverter).toBeDefined();
            expect(testInverter.description).toBe('A simple inverter');
        });

        it('should not allow saving empty circuit as component', async () => {
            await expect(componentLibraryOperations.saveComponent('EmptyComponent', 'Empty')).rejects.toThrow(EmptyCircuitError);
        });

        it('should not allow saving circuit without inputs or outputs', async () => {
            // Only add a gate (no inputs/outputs)
            state.addComponent({ id: 1, type: 'AND', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] });

            await expect(componentLibraryOperations.saveComponent('InvalidComponent', 'No I/O')).rejects.toThrow(NoInputsError);
        });
    });

    describe('State Management', () => {
        it('should track mode changes', () => {
            expect(state.getMode()).toBe('place');

            state.setMode('connect');
            expect(state.getMode()).toBe('connect');

            state.setMode('delete');
            expect(state.getMode()).toBe('delete');
        });

        it('should clear connect start when mode changes', () => {
            state.setConnectStart({ component: 1, portIndex: 0, x: 100, y: 100 });
            expect(state.getConnectStart()).not.toBeNull();

            state.setMode('delete');
            expect(state.getConnectStart()).toBeNull();
        });

        it('should track selected tool', () => {
            state.setSelectedTool('AND');
            expect(state.getSelectedTool()).toBe('AND');

            state.setSelectedTool('OR');
            expect(state.getSelectedTool()).toBe('OR');
        });

        it('should reset state to initial values', () => {
            // Add some data
            canvasOperations.placeComponent(100, 100, 'INPUT');
            state.setMode('connect');
            state.setSelectedTool('AND');
            state.setCurrentBoardName('TestBoard');

            // Reset
            state.reset();

            expect(state.getComponents()).toHaveLength(0);
            expect(state.getConnections()).toHaveLength(0);
            expect(state.getMode()).toBe('place');
            expect(state.getSelectedTool()).toBeNull();
            expect(state.getCurrentBoardName()).toBeNull();
        });
    });

    describe('Event Bus Integration', () => {
        it('should emit events on component placement', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);

            canvasOperations.placeComponent(100, 100, 'INPUT');

            expect(handler).toHaveBeenCalled();
        });

        it('should emit events on component removal', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, handler);

            canvasOperations.placeComponent(100, 100, 'INPUT');
            const components = state.getComponents();
            state.removeComponent(components[0].id);

            expect(handler).toHaveBeenCalled();
        });

        it('should emit events on board changes', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.BOARD_CHANGED, handler);

            canvasOperations.placeComponent(100, 100, 'INPUT');

            expect(handler).toHaveBeenCalled();
        });

        it('should emit canvas redraw event on simulation', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
            const output = { id: 2, type: 'OUTPUT', x: 200, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(output);
            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

            // Use SimulationController to trigger simulation
            simulationController.onToggleInput();

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('ID Generation', () => {
        it('should generate sequential IDs for components', () => {
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(200, 100, 'AND');
            canvasOperations.placeComponent(300, 100, 'OUTPUT');

            const components = state.getComponents();
            expect(components[0].id).toBe(1);
            expect(components[1].id).toBe(2);
            expect(components[2].id).toBe(3);
        });

        it('should continue ID sequence after removing components', () => {
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(200, 100, 'AND');

            const components = state.getComponents();
            state.removeComponent(components[1].id); // Remove AND gate

            canvasOperations.placeComponent(300, 100, 'OUTPUT');

            const updatedComponents = state.getComponents();
            expect(updatedComponents[1].id).toBe(3); // Should continue from 3
        });

        it('should reset IDs when clearing all components', () => {
            canvasOperations.placeComponent(100, 100, 'INPUT');
            canvasOperations.placeComponent(200, 100, 'AND');

            state.clearComponents();

            canvasOperations.placeComponent(100, 100, 'INPUT');

            const components = state.getComponents();
            expect(components[0].id).toBe(1); // Should start from 1 again
        });
    });

    describe('Connection Removal', () => {
        it('should remove all connections to a component when it is deleted', () => {
            const input = { id: 1, type: 'INPUT', x: 100, y: 100, value: 0, inputPorts: [], outputPorts: [{}], label: 'I1' };
            const gate = { id: 2, type: 'NOT', x: 200, y: 100, value: null, inputPorts: [{}], outputPorts: [{}] };
            const output = { id: 3, type: 'OUTPUT', x: 300, y: 100, value: null, inputPorts: [{}], outputPorts: [], label: 'O1' };

            state.addComponent(input);
            state.addComponent(gate);
            state.addComponent(output);

            state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });
            state.addConnection({ from: 2, fromPort: 0, to: 3, toPort: 0 });

            expect(state.getConnections()).toHaveLength(2);

            // Remove the gate
            state.removeComponent(2);

            // Both connections should be removed
            expect(state.getConnections()).toHaveLength(0);
        });
    });
});

describe('Simulation Edge Cases', () => {
    let state;

    beforeEach(() => {
        eventBus.clear();
        state = new CircuitState();
    });

    it('should handle unconnected inputs (undefined value)', () => {
        const andGate = { id: 1, type: 'AND', x: 200, y: 100, value: null, inputs: [null, null], inputPorts: [{}, {}], outputPorts: [{}] };
        const output = { id: 2, type: 'OUTPUT', x: 300, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };

        state.addComponent(andGate);
        state.addComponent(output);
        state.addConnection({ from: 1, fromPort: 0, to: 2, toPort: 0 });

        // Should not throw error
        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();
    });

    it('should handle empty circuit', () => {
        expect(() => {
            simulateCircuit([], []);
        }).not.toThrow();
    });

    it('should handle circuit with only inputs', () => {
        const input1 = { id: 1, type: 'INPUT', x: 100, y: 100, value: 1, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' };
        const input2 = { id: 2, type: 'INPUT', x: 100, y: 200, value: 0, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I2' };

        state.addComponent(input1);
        state.addComponent(input2);

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();
    });

    it('should handle circuit with only outputs', () => {
        const output1 = { id: 1, type: 'OUTPUT', x: 100, y: 100, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' };
        const output2 = { id: 2, type: 'OUTPUT', x: 100, y: 200, value: null, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O2' };

        state.addComponent(output1);
        state.addComponent(output2);

        expect(() => {
            simulateCircuit(state.getComponents(), state.getConnections());
        }).not.toThrow();
    });
});

describe('Bug Fixes Regression Tests', () => {
    let state;
    let storageAdapter;
    let boardManager;
    let componentLibrary;
    let boardOperations;
    let componentLibraryOperations;
    let mockStorage;

    // Create localStorage mock
    function createLocalStorageMock() {
        const storage = new Map();
        return {
            getItem: vi.fn((key) => storage.get(key) ?? null),
            setItem: vi.fn((key, value) => storage.set(key, value)),
            removeItem: vi.fn((key) => storage.delete(key)),
            clear: vi.fn(() => storage.clear()),
            key: vi.fn((index) => Array.from(storage.keys())[index] ?? null),
            get length() { return storage.size; },
            _storage: storage
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.clear();

        mockStorage = createLocalStorageMock();
        global.localStorage = mockStorage;

        state = new CircuitState();
        storageAdapter = new LocalStorageAdapter();
        boardManager = new BoardManager(storageAdapter);
        componentLibrary = new ComponentLibrary(storageAdapter);

        // Initialize CircuitAnalysisManager
        const circuitAnalysisManager = new CircuitAnalysisManager({ state });

        // Initialize ContextManager
        const contextManager = new ContextManager({
            state,
            boardManager,
            componentLibrary,
            circuitAnalysisManager
        });

        boardOperations = new BoardOperations({
            state,
            boardManager,
            contextManager
        });

        componentLibraryOperations = new ComponentLibraryOperations({
            state,
            componentLibrary,
            contextManager
        });
    });

    describe('MODE_EXIT_REQUEST event (right-click mode exit)', () => {
        it('should emit MODE_EXIT_REQUEST event type exists', () => {
            expect(EVENT_TYPES.MODE_EXIT_REQUEST).toBe('mode:exitRequest');
        });

        it('should handle MODE_EXIT_REQUEST event subscription', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.MODE_EXIT_REQUEST, handler);

            eventBus.emit(EVENT_TYPES.MODE_EXIT_REQUEST, {});

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('Board Name State Management', () => {
        it('should clear board name after creating new board', () => {
            state.setCurrentBoardName('ExistingBoard');
            expect(state.getCurrentBoardName()).toBe('ExistingBoard');

            // Simulate "New Board" action
            state.clearComponents();
            state.setCurrentBoardName(null);

            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('should suggest current board name for "Save As" when board exists', () => {
            state.setCurrentBoardName('MyCircuit');
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

            // The current board name can be used as suggestion
            const suggestion = state.getCurrentBoardName();
            expect(suggestion).toBe('MyCircuit');
        });

        it('should have null board name for unsaved circuit', () => {
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100 });

            expect(state.getCurrentBoardName()).toBeNull();
        });
    });

    describe('Connection Start State Cleanup', () => {
        it('should clear connection start when switching to delete mode', () => {
            state.setMode('connect');
            state.setConnectStart({ component: 1, portIndex: 0, x: 100, y: 100 });

            expect(state.getConnectStart()).not.toBeNull();

            state.setMode('delete');

            expect(state.getConnectStart()).toBeNull();
        });

        it('should clear connection start when switching to place mode', () => {
            state.setMode('connect');
            state.setConnectStart({ component: 1, portIndex: 0, x: 100, y: 100 });

            state.setMode('place');

            expect(state.getConnectStart()).toBeNull();
        });

        it('should emit connection:startChanged when connection start changes', () => {
            const handler = vi.fn();
            eventBus.on('connection:startChanged', handler);

            const connectStart = { component: 1, portIndex: 0, x: 100, y: 100 };
            state.setConnectStart(connectStart);

            expect(handler).toHaveBeenCalledWith({ connectStart });
        });
    });

    describe('Truth Table State Persistence', () => {
        it('should preserve truth table state across board save/load', async () => {
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });
            state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' });

            const truthTablePanelState = {
                width: 450,
                height: 350,
                columnOrder: ['I1', 'O1']
            };
            state.setTruthTablePanelState(truthTablePanelState);

            await boardOperations.saveCurrentBoard('BoardWithTable');

            // Clear and reload
            state.clearComponents();
            state.setCurrentBoardName(null);
            state.setTruthTablePanelState(null);

            await boardOperations.loadBoard('BoardWithTable');

            expect(state.getTruthTablePanelState()).toEqual(truthTablePanelState);
        });

        it('should emit TRUTH_TABLE_PANEL_STATE_CHANGED when state changes', () => {
            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TRUTH_TABLE_PANEL_STATE_CHANGED, handler);

            state.setTruthTablePanelState({ width: 500 });

            expect(handler).toHaveBeenCalledWith({ state: { width: 500 } });
        });
    });

    describe('Component Library Context Switching', () => {
        it('should set currentComponentName when saving as component', async () => {
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });
            state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' });

            await componentLibraryOperations.saveComponent('MyInverter', 'Test inverter');

            expect(state.getCurrentComponentName()).toBe('MyInverter');
            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('should clear currentComponentName when saving as board', async () => {
            state.addComponent({ id: 1, type: 'INPUT', x: 100, y: 100, inputs: [], inputPorts: [], outputPorts: [{}], label: 'I1' });
            state.addComponent({ id: 2, type: 'OUTPUT', x: 200, y: 100, inputs: [null], inputPorts: [{}], outputPorts: [], label: 'O1' });

            // First save as component
            await componentLibraryOperations.saveComponent('MyComponent', 'Test');
            expect(state.getCurrentComponentName()).toBe('MyComponent');

            // Then save as board
            await boardOperations.saveCurrentBoard('MyBoard');

            expect(state.getCurrentBoardName()).toBe('MyBoard');
            expect(state.getCurrentComponentName()).toBeNull();
        });
    });
});
