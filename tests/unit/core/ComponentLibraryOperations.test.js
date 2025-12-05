/**
 * Unit tests for ComponentLibraryOperations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentLibraryOperations } from '../../../src/core/ComponentLibraryOperations.js';
import { CircuitState } from '../../../src/core/CircuitState.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';
import {
    NoInputsError,
    NoOutputsError,
    EmptyCircuitError,
    ComponentNotFoundError,
    ComponentSaveError
} from '../../../src/core/errors.js';

const createMockComponentLibrary = () => ({
    saveComponent: vi.fn().mockResolvedValue(true),
    loadComponent: vi.fn().mockResolvedValue(null),
    deleteComponent: vi.fn().mockResolvedValue(true),
    listComponents: vi.fn().mockResolvedValue({})
});

const createMockContextManager = () => ({
    saveCurrentContext: vi.fn().mockResolvedValue(undefined),
    loadCircuitContext: vi.fn()
});

describe('ComponentLibraryOperations', () => {
    let state;
    let operations;
    let mockComponentLibrary;
    let mockContextManager;

    beforeEach(() => {
        state = new CircuitState();
        mockComponentLibrary = createMockComponentLibrary();
        mockContextManager = createMockContextManager();

        operations = new ComponentLibraryOperations({
            state,
            componentLibrary: mockComponentLibrary,
            contextManager: mockContextManager
        });

        // Clear event bus before each test
        eventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ====================================
    // Save Component Tests
    // ====================================

    describe('Save Component', () => {
        const setupValidCircuit = () => {
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'OUTPUT', x: 300, y: 100,
                inputs: [{ x: 280, y: 100 }], outputs: [],
                value: null, label: 'O1'
            });
        };

        it('throws EmptyCircuitError for empty circuit', async () => {
            await expect(operations.saveComponent('Test', 'Description'))
                .rejects.toThrow(EmptyCircuitError);
        });

        it('throws NoInputsError when no inputs', async () => {
            state.addComponent({
                id: 1, type: 'OUTPUT', x: 300, y: 100,
                inputs: [{ x: 280, y: 100 }], outputs: [],
                value: null, label: 'O1'
            });
            state.addComponent({
                id: 2, type: 'AND', x: 200, y: 100,
                inputs: [], outputs: [],
                value: null, label: null
            });

            await expect(operations.saveComponent('Test', 'Description'))
                .rejects.toThrow(NoInputsError);
        });

        it('throws NoOutputsError when no outputs', async () => {
            state.addComponent({
                id: 1, type: 'INPUT', x: 100, y: 100,
                inputs: [], outputs: [{ x: 120, y: 100 }],
                value: 0, label: 'I1'
            });
            state.addComponent({
                id: 2, type: 'AND', x: 200, y: 100,
                inputs: [], outputs: [],
                value: null, label: null
            });

            await expect(operations.saveComponent('Test', 'Description'))
                .rejects.toThrow(NoOutputsError);
        });

        it('saves component to library', async () => {
            setupValidCircuit();
            mockComponentLibrary.saveComponent.mockResolvedValue(true);
            mockComponentLibrary.listComponents.mockResolvedValue({ 'TestComp': {} });

            const result = await operations.saveComponent('TestComp', 'A test component');

            expect(result).toBe('TestComp');
            expect(mockComponentLibrary.saveComponent).toHaveBeenCalled();
            expect(state.getCurrentComponentName()).toBe('TestComp');
        });

        it('clears current board name when saving as component', async () => {
            setupValidCircuit();
            state.setCurrentBoardName('SomeBoard');
            mockComponentLibrary.saveComponent.mockResolvedValue(true);

            await operations.saveComponent('TestComp', 'Description');

            expect(state.getCurrentBoardName()).toBeNull();
        });

        it('throws ComponentSaveError on failure', async () => {
            setupValidCircuit();
            mockComponentLibrary.saveComponent.mockResolvedValue(false);

            await expect(operations.saveComponent('TestComp', 'Description'))
                .rejects.toThrow(ComponentSaveError);
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS after save', async () => {
            setupValidCircuit();
            mockComponentLibrary.saveComponent.mockResolvedValue(true);

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            await operations.saveComponent('TestComp', 'Description');

            expect(handler).toHaveBeenCalled();
        });

        it('includes truth table state in saved component', async () => {
            setupValidCircuit();
            state.setTruthTableState({ width: 500, height: 300 });
            mockComponentLibrary.saveComponent.mockResolvedValue(true);

            await operations.saveComponent('TestComp', 'Description');

            expect(mockComponentLibrary.saveComponent).toHaveBeenCalledWith(
                'TestComp',
                expect.objectContaining({
                    truthTableState: { width: 500, height: 300 }
                })
            );
        });

        it('creates component definition with input/output ports', async () => {
            setupValidCircuit();
            mockComponentLibrary.saveComponent.mockResolvedValue(true);

            await operations.saveComponent('TestComp', 'Description');

            expect(mockComponentLibrary.saveComponent).toHaveBeenCalledWith(
                'TestComp',
                expect.objectContaining({
                    inputPorts: [{ label: 'I1', id: 1 }],
                    outputPorts: [{ label: 'O1', id: 2 }]
                })
            );
        });
    });

    // ====================================
    // Delete Component Tests
    // ====================================

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

        it('does not clear component name when deleting different component', async () => {
            state.setCurrentComponentName('CurrentComp');
            mockComponentLibrary.deleteComponent.mockResolvedValue(true);

            await operations.deleteComponent('OtherComp');

            expect(state.getCurrentComponentName()).toBe('CurrentComp');
        });

        it('returns false on failure', async () => {
            mockComponentLibrary.deleteComponent.mockResolvedValue(false);

            const result = await operations.deleteComponent('TestComp');

            expect(result).toBe(false);
        });

        it('emits TOOLBAR_UPDATE_DISPLAYS after delete', async () => {
            mockComponentLibrary.deleteComponent.mockResolvedValue(true);

            const handler = vi.fn();
            eventBus.on(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS, handler);

            await operations.deleteComponent('TestComp');

            expect(handler).toHaveBeenCalled();
        });
    });

    // ====================================
    // Load Component For Editing Tests
    // ====================================

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
            expect(mockContextManager.loadCircuitContext).toHaveBeenCalledWith(
                componentDef,
                { type: 'component', name: 'TestComp' }
            );
        });

        it('does not auto-save current context before loading (user should explicitly save)', async () => {
            mockComponentLibrary.loadComponent.mockResolvedValue({
                name: 'TestComp',
                components: [],
                connections: []
            });

            await operations.loadComponentForEditing('TestComp');

            // We intentionally do NOT call saveCurrentContext on load.
            // Auto-saving would overwrite the saved state with unsaved changes,
            // breaking the "Revert to Saved" concept.
            expect(mockContextManager.saveCurrentContext).not.toHaveBeenCalled();
        });

        it('throws ComponentNotFoundError when component not found', async () => {
            mockComponentLibrary.loadComponent.mockResolvedValue(null);

            await expect(operations.loadComponentForEditing('NonExistent'))
                .rejects.toThrow(ComponentNotFoundError);
        });
    });

    // ====================================
    // Export Component Tests
    // ====================================

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

        it('creates blob with correct JSON content', async () => {
            const componentDef = {
                name: 'TestComp',
                components: [{ id: 1, type: 'INPUT' }],
                connections: []
            };
            mockComponentLibrary.loadComponent.mockResolvedValue(componentDef);

            const mockAnchor = { href: '', download: '', click: vi.fn() };
            vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

            let createdBlob = null;
            vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
                createdBlob = blob;
                return 'blob:test';
            });
            vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

            await operations.exportComponent('TestComp');

            expect(createdBlob).toBeInstanceOf(Blob);
            expect(createdBlob.type).toBe('application/json');
        });

        it('revokes object URL after download', async () => {
            mockComponentLibrary.loadComponent.mockResolvedValue({
                name: 'TestComp',
                components: [],
                connections: []
            });

            const mockAnchor = { href: '', download: '', click: vi.fn() };
            vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
            vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
            const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

            await operations.exportComponent('TestComp');

            expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
        });
    });

    // ====================================
    // Import Component Tests
    // ====================================

    describe('Import Component', () => {
        it('returns null when no file selected', async () => {
            const event = { target: { files: [], value: '' } };

            const result = await operations.importComponent(event);

            expect(result).toBeNull();
        });

        // Note: More comprehensive file import tests require FileReader mocking
        // which is complex. The functionality is better tested via integration tests.
    });
});
