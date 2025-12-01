import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentLibrary } from '../../../src/storage/ComponentLibrary.js';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';

describe('ComponentLibrary', () => {
    let componentLibrary;
    let mockStorage;

    beforeEach(() => {
        // Create a clean mock storage for each test
        mockStorage = {};

        global.localStorage = {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, value) => {
                mockStorage[key] = value;
            }),
            removeItem: vi.fn((key) => {
                delete mockStorage[key];
            }),
            clear: vi.fn(() => {
                mockStorage = {};
            }),
            key: vi.fn((index) => Object.keys(mockStorage)[index] || null),
            get length() {
                return Object.keys(mockStorage).length;
            }
        };

        const adapter = new LocalStorageAdapter();
        componentLibrary = new ComponentLibrary(adapter);
    });

    describe('saveComponent', () => {
        it('should save a component with metadata', async () => {
            const componentData = {
                name: 'HalfAdder',
                description: 'A half adder circuit',
                components: [
                    { id: 1, type: 'INPUT', label: 'A' },
                    { id: 2, type: 'INPUT', label: 'B' },
                    { id: 3, type: 'XOR' },
                    { id: 4, type: 'AND' },
                    { id: 5, type: 'OUTPUT', label: 'Sum' },
                    { id: 6, type: 'OUTPUT', label: 'Carry' }
                ],
                connections: [],
                inputPorts: [
                    { id: 1, label: 'A' },
                    { id: 2, label: 'B' }
                ],
                outputPorts: [
                    { id: 5, label: 'Sum' },
                    { id: 6, label: 'Carry' }
                ]
            };

            const success = await componentLibrary.saveComponent('HalfAdder', componentData);

            expect(success).toBe(true);

            const loaded = await componentLibrary.loadComponent('HalfAdder');
            expect(loaded).toBeTruthy();
            expect(loaded.name).toBe('HalfAdder');
            expect(loaded.description).toBe('A half adder circuit');
            expect(loaded.components.length).toBe(6);
            expect(loaded.savedAt).toBeTruthy();
            expect(loaded.version).toBe('1.0');
        });

        it('should return false for invalid component name', async () => {
            const componentData = {
                name: 'Test',
                components: [],
                connections: []
            };

            const success1 = await componentLibrary.saveComponent('', componentData);
            const success2 = await componentLibrary.saveComponent(null, componentData);
            const success3 = await componentLibrary.saveComponent(123, componentData);

            expect(success1).toBe(false);
            expect(success2).toBe(false);
            expect(success3).toBe(false);
        });

        it('should overwrite existing component', async () => {
            const componentData1 = {
                name: 'Test',
                description: 'First version',
                components: [],
                connections: []
            };

            const componentData2 = {
                name: 'Test',
                description: 'Second version',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('Test', componentData1);
            await componentLibrary.saveComponent('Test', componentData2);

            const loaded = await componentLibrary.loadComponent('Test');
            expect(loaded.description).toBe('Second version');
        });
    });

    describe('loadComponent', () => {
        it('should load an existing component', async () => {
            const componentData = {
                name: 'TestComp',
                description: 'Test component',
                components: [{ id: 1, type: 'INPUT' }],
                connections: []
            };

            await componentLibrary.saveComponent('TestComp', componentData);
            const loaded = await componentLibrary.loadComponent('TestComp');

            expect(loaded).toBeTruthy();
            expect(loaded.name).toBe('TestComp');
            expect(loaded.components).toEqual(componentData.components);
        });

        it('should return null for non-existent component', async () => {
            const loaded = await componentLibrary.loadComponent('NonExistent');

            expect(loaded).toBeNull();
        });
    });

    describe('getAllComponents', () => {
        it('should return empty object when no components exist', async () => {
            const components = await componentLibrary.getAllComponents();

            expect(components).toEqual({});
        });

        it('should return all saved components', async () => {
            const componentData1 = {
                name: 'Comp1',
                components: [],
                connections: []
            };

            const componentData2 = {
                name: 'Comp2',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('Comp1', componentData1);
            await componentLibrary.saveComponent('Comp2', componentData2);

            const components = await componentLibrary.getAllComponents();

            expect(Object.keys(components).length).toBe(2);
            expect(components.Comp1).toBeTruthy();
            expect(components.Comp2).toBeTruthy();
        });
    });

    describe('listComponents', () => {
        it('should return empty array when no components exist', async () => {
            const list = await componentLibrary.listComponents();

            expect(list).toEqual([]);
        });

        it('should return component metadata sorted alphabetically', async () => {
            const componentData1 = {
                name: 'ZComponent',
                description: 'Last alphabetically',
                components: [{ id: 1, type: 'INPUT' }],
                connections: [],
                inputPorts: [{ id: 1, label: 'In' }],
                outputPorts: [{ id: 2, label: 'Out' }]
            };

            const componentData2 = {
                name: 'AComponent',
                description: 'First alphabetically',
                components: [{ id: 1, type: 'INPUT' }, { id: 2, type: 'OUTPUT' }],
                connections: [],
                inputPorts: [{ id: 1, label: 'In' }],
                outputPorts: [{ id: 2, label: 'Out' }]
            };

            await componentLibrary.saveComponent('ZComponent', componentData1);
            await componentLibrary.saveComponent('AComponent', componentData2);

            const list = await componentLibrary.listComponents();

            expect(list.length).toBe(2);
            expect(list[0].name).toBe('AComponent'); // Alphabetically first
            expect(list[1].name).toBe('ZComponent');
            expect(list[0].inputCount).toBe(1);
            expect(list[0].outputCount).toBe(1);
            expect(list[0].internalComponentCount).toBe(2);
        });
    });

    describe('deleteComponent', () => {
        it('should delete an existing component', async () => {
            const componentData = {
                name: 'ToDelete',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('ToDelete', componentData);

            let components = await componentLibrary.getAllComponents();
            expect(components.ToDelete).toBeTruthy();

            const success = await componentLibrary.deleteComponent('ToDelete');
            expect(success).toBe(true);

            components = await componentLibrary.getAllComponents();
            expect(components.ToDelete).toBeUndefined();
        });

        it('should return false for non-existent component', async () => {
            const success = await componentLibrary.deleteComponent('NonExistent');

            expect(success).toBe(false);
        });
    });

    describe('componentExists', () => {
        it('should return true for existing component', async () => {
            const componentData = {
                name: 'ExistsTest',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('ExistsTest', componentData);

            const exists = await componentLibrary.componentExists('ExistsTest');

            expect(exists).toBe(true);
        });

        it('should return false for non-existent component', async () => {
            const exists = await componentLibrary.componentExists('DoesNotExist');

            expect(exists).toBe(false);
        });
    });

    describe('renameComponent', () => {
        it('should rename an existing component', async () => {
            const componentData = {
                name: 'OldName',
                components: [{ id: 1, type: 'INPUT' }],
                connections: []
            };

            await componentLibrary.saveComponent('OldName', componentData);

            const success = await componentLibrary.renameComponent('OldName', 'NewName');

            expect(success).toBe(true);

            const oldExists = await componentLibrary.componentExists('OldName');
            const newExists = await componentLibrary.componentExists('NewName');

            expect(oldExists).toBe(false);
            expect(newExists).toBe(true);

            const loaded = await componentLibrary.loadComponent('NewName');
            expect(loaded.components).toEqual(componentData.components);
        });

        it('should return true if old and new names are the same', async () => {
            const componentData = {
                name: 'SameName',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('SameName', componentData);

            const success = await componentLibrary.renameComponent('SameName', 'SameName');

            expect(success).toBe(true);
        });

        it('should return false if component does not exist', async () => {
            const success = await componentLibrary.renameComponent('NonExistent', 'NewName');

            expect(success).toBe(false);
        });

        it('should return false if new name already exists', async () => {
            const componentData = {
                name: 'Test',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('Comp1', componentData);
            await componentLibrary.saveComponent('Comp2', componentData);

            const success = await componentLibrary.renameComponent('Comp1', 'Comp2');

            expect(success).toBe(false);
        });
    });

    describe('clearAllComponents', () => {
        it('should clear all components', async () => {
            const componentData = {
                name: 'Test',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('Comp1', componentData);
            await componentLibrary.saveComponent('Comp2', componentData);

            let components = await componentLibrary.getAllComponents();
            expect(Object.keys(components).length).toBe(2);

            const success = await componentLibrary.clearAllComponents();
            expect(success).toBe(true);

            components = await componentLibrary.getAllComponents();
            expect(Object.keys(components).length).toBe(0);
        });
    });

    describe('duplicateComponent', () => {
        it('should duplicate an existing component with new name', async () => {
            const componentData = {
                name: 'Original',
                description: 'Original component',
                components: [{ id: 1, type: 'INPUT' }],
                connections: []
            };

            await componentLibrary.saveComponent('Original', componentData);

            const success = await componentLibrary.duplicateComponent('Original', 'Duplicate');

            expect(success).toBe(true);

            const original = await componentLibrary.loadComponent('Original');
            const duplicate = await componentLibrary.loadComponent('Duplicate');

            expect(duplicate).toBeTruthy();
            expect(duplicate.name).toBe('Duplicate');
            expect(duplicate.components).toEqual(original.components);
            expect(duplicate.description).toBe(original.description);
        });

        it('should return false if source component does not exist', async () => {
            const success = await componentLibrary.duplicateComponent('NonExistent', 'NewCopy');

            expect(success).toBe(false);
        });
    });

    describe('exportComponent', () => {
        it('should export an existing component', async () => {
            const componentData = {
                name: 'ExportTest',
                description: 'Component to export',
                components: [],
                connections: []
            };

            await componentLibrary.saveComponent('ExportTest', componentData);

            // Since exportComponent uses exportToJSON which creates a download,
            // we just verify it doesn't throw an error
            const success = await componentLibrary.exportComponent('ExportTest');

            expect(success).toBe(true);
        });

        it('should return false for non-existent component', async () => {
            const success = await componentLibrary.exportComponent('NonExistent');

            expect(success).toBe(false);
        });
    });

    describe('validation', () => {
        it('should validate component data has required fields', async () => {
            const invalidData = {
                name: 'Invalid'
                // Missing components, connections
            };

            const success = await componentLibrary.saveComponent('Invalid', invalidData);

            expect(success).toBe(false);
        });
    });
});
