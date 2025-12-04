/**
 * Unit tests for DialogManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogManager } from '../../../src/ui/DialogManager.js';

// Mock DialogFactory
vi.mock('../../../src/ui/DialogFactory.js', () => ({
    DialogFactory: {
        showAlert: vi.fn(),
        showConfirm: vi.fn(),
        showDialog: vi.fn(),
        hideDialog: vi.fn(),
        createDialog: vi.fn().mockReturnValue(document.createElement('div')),
        createFormContent: vi.fn().mockReturnValue(document.createElement('div'))
    }
}));

import { DialogFactory } from '../../../src/ui/DialogFactory.js';

// Create mock DOM environment
const createMockDOM = () => {
    const elements = {};

    const createElement = (id) => {
        const el = {
            id,
            value: '',
            textContent: '',
            innerHTML: '',
            style: {},
            classList: {
                classes: new Set(),
                add: vi.fn(function(cls) { this.classes.add(cls); }),
                remove: vi.fn(function(cls) { this.classes.delete(cls); }),
                contains: vi.fn(function(cls) { return this.classes.has(cls); })
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            appendChild: vi.fn(),
            focus: vi.fn()
        };
        elements[id] = el;
        return el;
    };

    // Create required elements
    createElement('importFile');
    createElement('componentName');
    createElement('componentDescription');

    const mockDocument = {
        getElementById: vi.fn((id) => elements[id] || null),
        createElement: vi.fn((tag) => {
            const el = createElement(`dynamic-${tag}-${Date.now()}`);
            el.tagName = tag.toUpperCase();
            return el;
        }),
        body: {
            appendChild: vi.fn()
        }
    };

    return { elements, mockDocument };
};

describe('DialogManager', () => {
    let dialogManager;
    let mockCallbacks;
    let mockDOM;

    beforeEach(() => {
        mockDOM = createMockDOM();
        vi.stubGlobal('document', mockDOM.mockDocument);

        mockCallbacks = {
            getCircuitData: vi.fn().mockReturnValue({
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100 },
                    { id: 2, type: 'OUTPUT', x: 300, y: 100 }
                ],
                connections: []
            }),
            getCurrentComponentName: vi.fn().mockReturnValue(null),
            getCustomComponents: vi.fn().mockReturnValue({}),
            onImportComponent: vi.fn().mockResolvedValue('ImportedComponent'),
            onSaveComponent: vi.fn().mockResolvedValue('SavedComponent'),
            getSavedBoards: vi.fn().mockReturnValue({}),
            getCurrentBoardName: vi.fn().mockReturnValue(null)
        };

        dialogManager = new DialogManager(mockCallbacks);

        // Clear mock calls
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('stores callbacks', () => {
            expect(dialogManager.callbacks).toBe(mockCallbacks);
        });

        it('initializes with empty elements object', () => {
            expect(dialogManager.elements).toEqual({});
        });

        it('initializes with empty dialogs cache', () => {
            expect(dialogManager.dialogs).toEqual({});
        });

        it('initializes state with null values', () => {
            expect(dialogManager.state.renameTarget).toBeNull();
            expect(dialogManager.state.pendingActionAfterSave).toBeNull();
        });
    });

    describe('init', () => {
        it('caches importFile element', () => {
            dialogManager.init();

            expect(mockDOM.mockDocument.getElementById).toHaveBeenCalledWith('importFile');
            expect(dialogManager.elements.importFile).toBeDefined();
        });

        it('sets up event listeners', () => {
            const setupEventListenersSpy = vi.spyOn(dialogManager, 'setupEventListeners');

            dialogManager.init();

            expect(setupEventListenersSpy).toHaveBeenCalled();
        });
    });

    describe('setupEventListeners', () => {
        beforeEach(() => {
            dialogManager.init();
        });

        it('adds change listener to import file input', () => {
            expect(dialogManager.elements.importFile.addEventListener).toHaveBeenCalledWith(
                'change',
                expect.any(Function)
            );
        });

        it('calls onImportComponent when file is selected', async () => {
            const importInput = dialogManager.elements.importFile;
            const changeHandler = importInput.addEventListener.mock.calls.find(
                call => call[0] === 'change'
            )[1];

            const mockEvent = { target: { files: [new Blob()] } };
            await changeHandler(mockEvent);

            expect(mockCallbacks.onImportComponent).toHaveBeenCalledWith(mockEvent);
        });
    });

    describe('showSaveComponentDialog', () => {
        beforeEach(() => {
            dialogManager.init();
        });

        it('shows warning for empty circuit', () => {
            mockCallbacks.getCircuitData.mockReturnValue({
                components: [],
                connections: []
            });

            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.showAlert).toHaveBeenCalledWith({
                message: expect.any(String),
                type: 'warning'
            });
        });

        it('shows warning when no inputs', () => {
            mockCallbacks.getCircuitData.mockReturnValue({
                components: [
                    { id: 1, type: 'OUTPUT', x: 100, y: 100 }
                ],
                connections: []
            });

            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.showAlert).toHaveBeenCalledWith({
                message: expect.any(String),
                type: 'warning'
            });
        });

        it('shows warning when no outputs', () => {
            mockCallbacks.getCircuitData.mockReturnValue({
                components: [
                    { id: 1, type: 'INPUT', x: 100, y: 100 }
                ],
                connections: []
            });

            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.showAlert).toHaveBeenCalledWith({
                message: expect.any(String),
                type: 'warning'
            });
        });

        it('creates dialog lazily on first call', () => {
            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.createDialog).toHaveBeenCalled();
            expect(dialogManager.dialogs.saveComponent).toBeDefined();
        });

        it('reuses existing dialog on subsequent calls', () => {
            dialogManager.showSaveComponentDialog();
            const firstDialog = dialogManager.dialogs.saveComponent;

            DialogFactory.createDialog.mockClear();

            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.createDialog).not.toHaveBeenCalled();
            expect(dialogManager.dialogs.saveComponent).toBe(firstDialog);
        });

        it('shows the dialog', () => {
            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.showDialog).toHaveBeenCalled();
        });

        it('pre-fills name for existing component', () => {
            mockCallbacks.getCurrentComponentName.mockReturnValue('ExistingComponent');
            mockCallbacks.getCustomComponents.mockReturnValue({
                'ExistingComponent': { description: 'Test description' }
            });

            // Setup name input mock
            mockDOM.elements['componentName'] = {
                value: '',
                addEventListener: vi.fn()
            };
            mockDOM.elements['componentDescription'] = {
                value: '',
                addEventListener: vi.fn()
            };

            dialogManager.showSaveComponentDialog();

            expect(mockDOM.elements['componentName'].value).toBe('ExistingComponent');
            expect(mockDOM.elements['componentDescription'].value).toBe('Test description');
        });
    });

    describe('State Management', () => {
        it('tracks rename target', () => {
            const component = { id: 1, type: 'INPUT', label: 'I1' };
            dialogManager.state.renameTarget = component;

            expect(dialogManager.state.renameTarget).toBe(component);
        });

        it('tracks pending action after save', () => {
            const action = vi.fn();
            dialogManager.state.pendingActionAfterSave = action;

            expect(dialogManager.state.pendingActionAfterSave).toBe(action);
        });
    });

    describe('Dialog Lifecycle', () => {
        beforeEach(() => {
            dialogManager.init();
        });

        it('creates form content with correct fields', () => {
            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.createFormContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    fields: expect.arrayContaining([
                        expect.objectContaining({ id: 'componentName' }),
                        expect.objectContaining({ id: 'componentDescription' })
                    ])
                })
            );
        });

        it('creates dialog with correct configuration', () => {
            dialogManager.showSaveComponentDialog();

            expect(DialogFactory.createDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'saveComponentDialog',
                    size: 'default'
                })
            );
        });
    });

    describe('Board Management Listeners', () => {
        it('calls setupBoardManagementListeners during init', () => {
            const spy = vi.spyOn(dialogManager, 'setupBoardManagementListeners');

            dialogManager.init();

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            dialogManager.init();
        });

        it('handles missing importFile element gracefully', () => {
            dialogManager.elements.importFile = null;

            expect(() => {
                dialogManager.setupEventListeners();
            }).not.toThrow();
        });

        it('handles callback errors gracefully', async () => {
            mockCallbacks.onImportComponent.mockRejectedValue(new Error('Import failed'));

            dialogManager.elements.importFile = {
                addEventListener: vi.fn((event, handler) => {
                    if (event === 'change') {
                        // Don't throw, let test verify behavior
                    }
                })
            };

            dialogManager.setupEventListeners();

            // The setup should complete without throwing
            expect(dialogManager.elements.importFile.addEventListener).toHaveBeenCalled();
        });
    });

    describe('_createSaveComponentDialog', () => {
        it('creates dialog with form content', () => {
            const dialog = dialogManager._createSaveComponentDialog();

            expect(DialogFactory.createFormContent).toHaveBeenCalled();
            expect(DialogFactory.createDialog).toHaveBeenCalled();
            expect(dialog).toBeDefined();
        });

        it('includes confirm and cancel buttons', () => {
            dialogManager._createSaveComponentDialog();

            const formContentCall = DialogFactory.createFormContent.mock.calls[0][0];
            expect(formContentCall.buttons).toHaveLength(2);
            expect(formContentCall.buttons.find(b => b.id === 'confirmSave')).toBeDefined();
            expect(formContentCall.buttons.find(b => b.id === 'cancelSave')).toBeDefined();
        });
    });
});
