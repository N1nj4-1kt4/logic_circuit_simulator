/**
 * Unit tests for Toolbar
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toolbar } from '../../../src/ui/Toolbar.js';

// Mock DOM environment
const createMockDOM = () => {
    // Create mock elements
    const elements = {};

    const createElement = (id, type = 'div') => {
        const el = {
            id,
            className: '',
            classList: {
                classes: new Set(),
                add: vi.fn(function(cls) { this.classes.add(cls); }),
                remove: vi.fn(function(cls) { this.classes.delete(cls); }),
                contains: vi.fn(function(cls) { return this.classes.has(cls); })
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            style: {},
            dataset: {},
            innerHTML: '',
            value: '',
            textContent: '',
            options: [],
            appendChild: vi.fn(),
            querySelectorAll: vi.fn().mockReturnValue([]),
            onchange: null
        };
        elements[id] = el;
        return el;
    };

    // Create common toolbar elements
    createElement('modeIndicator');
    createElement('selectedComponent');
    createElement('customComponentsDropdown', 'select');
    createElement('customComponentsSection');
    createElement('savedBoardsDropdown', 'select');
    createElement('savedBoardsSection');
    createElement('currentCircuitName');
    createElement('simulate', 'button');
    createElement('connectMode', 'button');
    createElement('deleteMode', 'button');
    createElement('clearBoard', 'button');
    createElement('truthTable', 'button');

    // Create tool buttons
    const toolButtons = [];
    ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'INPUT', 'OUTPUT'].forEach(type => {
        const btn = createElement(`tool-${type}`, 'button');
        btn.dataset.type = type;
        btn.classList.add('tool-btn');
        toolButtons.push(btn);
    });

    // Mock document
    const mockDocument = {
        getElementById: vi.fn((id) => elements[id] || null),
        querySelectorAll: vi.fn((selector) => {
            if (selector === '.tool-btn') {
                return toolButtons;
            }
            if (selector === '.action-btn') {
                return [elements['connectMode'], elements['deleteMode']].filter(Boolean);
            }
            return [];
        }),
        createElement: vi.fn(() => createElement('dynamic'))
    };

    return { elements, mockDocument, toolButtons };
};

describe('Toolbar', () => {
    let toolbar;
    let mockCallbacks;
    let mockDOM;

    beforeEach(() => {
        mockDOM = createMockDOM();

        // Replace global document
        vi.stubGlobal('document', mockDOM.mockDocument);

        mockCallbacks = {
            onToolSelect: vi.fn(),
            onModeChange: vi.fn(),
            onClearBoard: vi.fn(),
            onSimulate: vi.fn(),
            onTruthTable: vi.fn(),
            onSaveComponent: vi.fn(),
            onManageComponents: vi.fn(),
            onExportComponent: vi.fn(),
            onImportComponent: vi.fn(),
            onNewBoard: vi.fn(),
            onSaveBoard: vi.fn(),
            onLoadBoard: vi.fn(),
            onSimulationStep: vi.fn()
        };

        toolbar = new Toolbar(mockCallbacks);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('stores callback functions', () => {
            expect(toolbar.onToolSelect).toBe(mockCallbacks.onToolSelect);
            expect(toolbar.onModeChange).toBe(mockCallbacks.onModeChange);
            expect(toolbar.onClearBoard).toBe(mockCallbacks.onClearBoard);
            expect(toolbar.onSimulate).toBe(mockCallbacks.onSimulate);
        });

        it('initializes with neutral mode', () => {
            expect(toolbar.mode).toBe('neutral');
        });

        it('initializes with no selected tool', () => {
            expect(toolbar.selectedTool).toBeNull();
        });

        it('initializes with null connectStart', () => {
            expect(toolbar.connectStart).toBeNull();
        });
    });

    describe('init', () => {
        it('caches DOM elements', () => {
            toolbar.init();

            expect(toolbar.elements.modeIndicator).toBeDefined();
            expect(toolbar.elements.selectedComponent).toBeDefined();
            expect(toolbar.elements.customComponentsDropdown).toBeDefined();
            expect(toolbar.elements.savedBoardsDropdown).toBeDefined();
            expect(toolbar.elements.circuitNameDisplay).toBeDefined();
            expect(toolbar.elements.simulateBtn).toBeDefined();
        });

        it('calls setup methods', () => {
            const spyCacheElements = vi.spyOn(toolbar, 'cacheElements');
            const spySetupToolSelection = vi.spyOn(toolbar, 'setupToolSelection');
            const spySetupActionButtons = vi.spyOn(toolbar, 'setupActionButtons');
            const spyUpdateModeIndicator = vi.spyOn(toolbar, 'updateModeIndicator');

            toolbar.init();

            expect(spyCacheElements).toHaveBeenCalled();
            expect(spySetupToolSelection).toHaveBeenCalled();
            expect(spySetupActionButtons).toHaveBeenCalled();
            expect(spyUpdateModeIndicator).toHaveBeenCalled();
        });
    });

    describe('Tool Selection', () => {
        beforeEach(() => {
            toolbar.init();
        });

        it('adds event listeners to tool buttons', () => {
            mockDOM.toolButtons.forEach(btn => {
                expect(btn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            });
        });

        describe('clicking tool button', () => {
            it('selects tool and enters place mode', () => {
                const andButton = mockDOM.toolButtons.find(b => b.dataset.type === 'AND');
                const clickHandler = andButton.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                // Simulate click
                const mockEvent = {
                    currentTarget: andButton
                };
                andButton.classList.contains.mockReturnValue(false);

                clickHandler(mockEvent);

                expect(toolbar.selectedTool).toBe('AND');
                expect(toolbar.mode).toBe('place');
                expect(mockCallbacks.onToolSelect).toHaveBeenCalledWith('AND');
                expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('place');
            });

            it('toggles off when clicking already selected tool', () => {
                const andButton = mockDOM.toolButtons.find(b => b.dataset.type === 'AND');
                const clickHandler = andButton.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                // Tool is already selected
                andButton.classList.contains.mockReturnValue(true);

                const mockEvent = {
                    currentTarget: andButton
                };

                clickHandler(mockEvent);

                expect(toolbar.selectedTool).toBeNull();
                expect(toolbar.mode).toBe('neutral');
                expect(mockCallbacks.onToolSelect).toHaveBeenCalledWith(null);
                expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('neutral');
            });
        });

        describe('custom components dropdown', () => {
            it('sets up change handler', () => {
                expect(toolbar.elements.customComponentsDropdown.onchange).not.toBeNull();
            });

            it('selects custom component when dropdown changes', () => {
                const dropdown = toolbar.elements.customComponentsDropdown;
                dropdown.value = 'CUSTOM:MyGate';

                // Trigger onchange
                dropdown.onchange({ target: dropdown });

                expect(toolbar.selectedTool).toBe('CUSTOM:MyGate');
                expect(toolbar.mode).toBe('place');
                expect(mockCallbacks.onToolSelect).toHaveBeenCalledWith('CUSTOM:MyGate');
            });

            it('does nothing when dropdown cleared', () => {
                const dropdown = toolbar.elements.customComponentsDropdown;
                dropdown.value = '';

                mockCallbacks.onToolSelect.mockClear();

                dropdown.onchange({ target: dropdown });

                expect(mockCallbacks.onToolSelect).not.toHaveBeenCalled();
            });
        });
    });

    describe('Action Buttons', () => {
        beforeEach(() => {
            toolbar.init();
        });

        describe('Connect Mode Button', () => {
            it('adds click listener', () => {
                const connectBtn = mockDOM.elements['connectMode'];
                expect(connectBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            });

            it('activates connect mode when clicked', () => {
                const connectBtn = mockDOM.elements['connectMode'];
                const clickHandler = connectBtn.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                connectBtn.classList.contains.mockReturnValue(false);

                clickHandler();

                expect(toolbar.mode).toBe('connect');
                expect(toolbar.selectedTool).toBeNull();
                expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('connect');
            });

            it('returns to neutral mode when toggled off', () => {
                const connectBtn = mockDOM.elements['connectMode'];
                const clickHandler = connectBtn.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                // Already active
                connectBtn.classList.contains.mockReturnValue(true);

                clickHandler();

                expect(toolbar.mode).toBe('neutral');
                expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('neutral');
            });

            it('clears connectStart when toggled off', () => {
                toolbar.connectStart = { x: 100, y: 100 };

                const connectBtn = mockDOM.elements['connectMode'];
                const clickHandler = connectBtn.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                connectBtn.classList.contains.mockReturnValue(true);

                clickHandler();

                expect(toolbar.connectStart).toBeNull();
            });
        });

        describe('Delete Mode Button', () => {
            it('adds click listener', () => {
                const deleteBtn = mockDOM.elements['deleteMode'];
                expect(deleteBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            });

            it('activates delete mode when clicked', () => {
                const deleteBtn = mockDOM.elements['deleteMode'];
                const clickHandler = deleteBtn.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                deleteBtn.classList.contains.mockReturnValue(false);

                clickHandler();

                expect(toolbar.mode).toBe('delete');
                expect(toolbar.selectedTool).toBeNull();
                expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('delete');
            });

            it('returns to neutral mode when toggled off', () => {
                const deleteBtn = mockDOM.elements['deleteMode'];
                const clickHandler = deleteBtn.addEventListener.mock.calls.find(
                    call => call[0] === 'click'
                )[1];

                deleteBtn.classList.contains.mockReturnValue(true);

                clickHandler();

                expect(toolbar.mode).toBe('neutral');
            });
        });
    });

    describe('State Management', () => {
        beforeEach(() => {
            toolbar.init();
        });

        it('clears tool selections when entering connect mode', () => {
            toolbar.selectedTool = 'AND';

            const connectBtn = mockDOM.elements['connectMode'];
            const clickHandler = connectBtn.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )[1];

            connectBtn.classList.contains.mockReturnValue(false);
            clickHandler();

            expect(toolbar.selectedTool).toBeNull();
        });

        it('clears tool selections when entering delete mode', () => {
            toolbar.selectedTool = 'AND';

            const deleteBtn = mockDOM.elements['deleteMode'];
            const clickHandler = deleteBtn.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )[1];

            deleteBtn.classList.contains.mockReturnValue(false);
            clickHandler();

            expect(toolbar.selectedTool).toBeNull();
        });
    });

    describe('Mode Indicator Update', () => {
        beforeEach(() => {
            toolbar.init();
        });

        it('updates mode indicator element', () => {
            toolbar.mode = 'connect';
            toolbar.updateModeIndicator();

            expect(toolbar.elements.modeIndicator.textContent).toBeDefined();
        });

        it('handles missing mode indicator gracefully', () => {
            toolbar.elements.modeIndicator = null;

            expect(() => {
                toolbar.updateModeIndicator();
            }).not.toThrow();
        });
    });

    describe('Callback Safety', () => {
        it('handles missing callbacks gracefully', () => {
            // Create toolbar with missing callbacks
            const partialCallbacks = {
                onToolSelect: vi.fn()
                // Other callbacks missing
            };

            const safeToolbar = new Toolbar(partialCallbacks);
            safeToolbar.init();

            // Simulate tool click - should not throw
            const andButton = mockDOM.toolButtons.find(b => b.dataset.type === 'AND');
            const clickHandler = andButton.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];

            if (clickHandler) {
                andButton.classList.contains.mockReturnValue(false);

                expect(() => {
                    clickHandler({ currentTarget: andButton });
                }).not.toThrow();
            }
        });
    });

    describe('Element Caching', () => {
        it('caches all required elements', () => {
            toolbar.cacheElements();

            expect(document.getElementById).toHaveBeenCalledWith('modeIndicator');
            expect(document.getElementById).toHaveBeenCalledWith('selectedComponent');
            expect(document.getElementById).toHaveBeenCalledWith('customComponentsDropdown');
            expect(document.getElementById).toHaveBeenCalledWith('customComponentsSection');
            expect(document.getElementById).toHaveBeenCalledWith('savedBoardsDropdown');
            expect(document.getElementById).toHaveBeenCalledWith('savedBoardsSection');
            expect(document.getElementById).toHaveBeenCalledWith('currentCircuitName');
            expect(document.getElementById).toHaveBeenCalledWith('simulate');
        });
    });
});
