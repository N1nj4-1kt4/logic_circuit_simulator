/**
 * Unit tests for TruthTablePanel refresh functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TruthTablePanel } from '../../../src/ui/TruthTablePanel.js';

// Mock Tabulator
vi.mock('tabulator-tables', () => ({
    TabulatorFull: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        on: vi.fn(),
        getColumns: vi.fn().mockReturnValue([]),
        getRows: vi.fn().mockReturnValue([]),
        getData: vi.fn().mockReturnValue([]),
        deselectRow: vi.fn(),
        replaceData: vi.fn()
    }))
}));

// Mock interactjs
vi.mock('interactjs', () => ({
    default: vi.fn().mockReturnValue({
        draggable: vi.fn().mockReturnThis(),
        resizable: vi.fn().mockReturnThis(),
        unset: vi.fn()
    })
}));

// Mock positioning utility
vi.mock('../../../src/utils/positioning.js', () => ({
    positionPanelSmartly: vi.fn()
}));

// Mock DialogFactory
vi.mock('../../../src/ui/DialogFactory.js', () => ({
    DialogFactory: {
        showAlert: vi.fn()
    }
}));

// Create mock DOM elements
const createMockDOM = () => {
    const panelEl = {
        classList: {
            classes: new Set(),
            add: vi.fn(function(cls) { this.classes.add(cls); }),
            remove: vi.fn(function(cls) { this.classes.delete(cls); }),
            contains: vi.fn(function(cls) { return this.classes.has(cls); })
        },
        style: {},
        getAttribute: vi.fn().mockReturnValue('0'),
        setAttribute: vi.fn(),
        querySelector: vi.fn().mockReturnValue({
            offsetHeight: 30,
            classList: { add: vi.fn(), remove: vi.fn() }
        }),
        offsetHeight: 300,
        offsetWidth: 400
    };

    const contentEl = {
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        },
        style: {},
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([])
    };

    const closeBtn = {
        addEventListener: vi.fn()
    };

    // Mock canvas element
    const canvasEl = {
        width: 800,
        height: 600,
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
    };

    const mockDocument = {
        getElementById: vi.fn((id) => {
            if (id === 'truthTablePanel') return panelEl;
            if (id === 'truthTableContent') return contentEl;
            if (id === 'closeTruthTable') return closeBtn;
            return null;
        }),
        createElement: vi.fn((tag) => {
            if (tag === 'canvas') return canvasEl;
            return {};
        }),
        body: {
            classList: {
                contains: vi.fn().mockReturnValue(false)
            }
        }
    };

    return { panelEl, contentEl, closeBtn, canvasEl, mockDocument };
};

// Create mock CircuitState
const createMockCircuitState = (cache = null) => ({
    getTruthTableCache: vi.fn().mockReturnValue(cache)
});

// Create valid cache with specified inputs/outputs
const createValidCache = (numInputs = 2, numOutputs = 1) => {
    const inputs = Array.from({ length: numInputs }, (_, i) => ({
        id: i + 1,
        label: `I${i + 1}`,
        value: 0
    }));
    const outputs = Array.from({ length: numOutputs }, (_, i) => ({
        id: numInputs + i + 1,
        label: `O${i + 1}`,
        value: 0
    }));

    const numRows = Math.pow(2, numInputs);
    const table = Array.from({ length: numRows }, (_, rowIndex) => {
        const row = {};
        inputs.forEach((_, i) => {
            row[`input${i}`] = (rowIndex >> (numInputs - 1 - i)) & 1;
        });
        outputs.forEach((_, i) => {
            row[`output${i}`] = 0;
        });
        return row;
    });

    return { inputs, outputs, table, isValid: true };
};

// Create invalid cache
const createInvalidCache = (reason = 'Circuit incomplete') => ({
    inputs: [],
    outputs: [],
    table: [],
    isValid: false,
    reason
});

describe('TruthTablePanel', () => {
    let mockDOM;

    beforeEach(() => {
        mockDOM = createMockDOM();
        vi.stubGlobal('document', mockDOM.mockDocument);
        vi.stubGlobal('window', {
            innerWidth: 1920,
            innerHeight: 1080,
            getComputedStyle: vi.fn().mockReturnValue({
                width: '400px',
                height: '300px',
                paddingTop: '10px',
                paddingBottom: '10px',
                paddingLeft: '10px',
                paddingRight: '10px',
                marginBottom: '10px'
            })
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('refresh()', () => {
        it('should not refresh if panel does not exist', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Don't call display(), so panel is null
            panel.refresh();

            // Should not attempt to read cache since panel doesn't exist
            expect(circuitState.getTruthTableCache).not.toHaveBeenCalled();
        });

        it('should attempt rebuild when table is not initialized but panel is visible', () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Simulate panel exists but table is null (e.g., after displayInvalidMessage)
            panel.panel = mockDOM.panelEl;
            panel.table = null;
            panel.truthTableData = null; // No previous data

            // Mock display to prevent actual table creation
            const displaySpy = vi.spyOn(panel, 'display').mockImplementation(() => {});
            vi.spyOn(panel, 'saveState').mockImplementation(() => {});

            panel.refresh();

            // Should read cache and attempt to rebuild
            expect(circuitState.getTruthTableCache).toHaveBeenCalled();
            // Since truthTableData was null, it should trigger rebuild
            expect(displaySpy).toHaveBeenCalled();
        });

        it('should not refresh if panel is hidden', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel and table
            panel.panel = mockDOM.panelEl;
            panel.table = { replaceData: vi.fn() };

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            panel.refresh();

            // Should check hidden state and return early
            expect(mockDOM.panelEl.classList.contains).toHaveBeenCalledWith('hidden');
            expect(circuitState.getTruthTableCache).not.toHaveBeenCalled();
        });

        it('should show invalid message when cache becomes invalid (not hide)', () => {
            const invalidCache = createInvalidCache('No outputs');
            const circuitState = createMockCircuitState(invalidCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel and table with all required methods
            panel.panel = mockDOM.panelEl;
            panel.table = {
                replaceData: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                destroy: vi.fn()
            };
            panel.truthTableData = createValidCache();

            // Spy on displayInvalidMessage method
            const displayInvalidMessageSpy = vi.spyOn(panel, 'displayInvalidMessage').mockImplementation(() => {});

            panel.refresh();

            // Should call displayInvalidMessage instead of hide
            expect(displayInvalidMessageSpy).toHaveBeenCalledWith(true);
            // Verify truthTableData was updated with invalid state
            expect(panel.truthTableData.isValid).toBe(false);
            expect(panel.truthTableData.reason).toBe('No outputs');
        });

        it('should hide panel when cache is null', () => {
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.table = {
                replaceData: vi.fn(),
                getColumns: vi.fn().mockReturnValue([])
            };
            panel.truthTableData = createValidCache();

            const hideSpy = vi.spyOn(panel, 'hide');

            panel.refresh();

            expect(hideSpy).toHaveBeenCalled();
        });

        it('should use replaceData for same structure (fast path)', () => {
            const initialCache = createValidCache(2, 1);
            const updatedCache = createValidCache(2, 1);
            // Modify table data to simulate a change
            updatedCache.table[0].output0 = 1;

            const circuitState = createMockCircuitState(updatedCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = initialCache;

            panel.refresh();

            // Should call replaceData with new table data
            expect(mockTable.replaceData).toHaveBeenCalledWith(updatedCache.table);
            // Should update truthTableData with new cache data
            expect(panel.truthTableData.inputs.length).toBe(updatedCache.inputs.length);
            expect(panel.truthTableData.outputs.length).toBe(updatedCache.outputs.length);
            expect(panel.truthTableData.table).toBe(updatedCache.table);
        });

        it('should rebuild table when input count changes', () => {
            const initialCache = createValidCache(2, 1); // 2 inputs
            const updatedCache = createValidCache(3, 1); // 3 inputs - structure changed

            const circuitState = createMockCircuitState(updatedCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = initialCache;
            panel.state = { x: 100, y: 100, width: '400px', height: '300px' };

            // Spy on display method
            const displaySpy = vi.spyOn(panel, 'display').mockImplementation(() => {});
            const saveStateSpy = vi.spyOn(panel, 'saveState').mockImplementation(() => {});

            panel.refresh();

            // Should NOT call replaceData (structure changed)
            expect(mockTable.replaceData).not.toHaveBeenCalled();
            // Should save state and call display for rebuild
            expect(saveStateSpy).toHaveBeenCalled();
            expect(displaySpy).toHaveBeenCalled();
            // Should reset column order
            expect(panel.columnOrder).toBeNull();
            // Should clear height/width to allow auto-fit, but keep position
            expect(panel.state.x).toBe(100);
            expect(panel.state.y).toBe(100);
            expect(panel.state.height).toBe('');
            expect(panel.state.width).toBe('');
        });

        it('should rebuild table when output count changes', () => {
            const initialCache = createValidCache(2, 1); // 1 output
            const updatedCache = createValidCache(2, 2); // 2 outputs - structure changed

            const circuitState = createMockCircuitState(updatedCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = initialCache;

            const displaySpy = vi.spyOn(panel, 'display').mockImplementation(() => {});
            vi.spyOn(panel, 'saveState').mockImplementation(() => {});

            panel.refresh();

            expect(mockTable.replaceData).not.toHaveBeenCalled();
            expect(displaySpy).toHaveBeenCalled();
        });

        it('should update highlight after replaceData', () => {
            const cache = createValidCache(2, 1);
            const circuitState = createMockCircuitState(cache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue(cache.table),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = createValidCache(2, 1); // Same structure

            const updateHighlightSpy = vi.spyOn(panel, 'updateHighlight');

            panel.refresh();

            expect(updateHighlightSpy).toHaveBeenCalled();
        });

        it('should handle missing truthTableData gracefully', () => {
            const cache = createValidCache(2, 1);
            const circuitState = createMockCircuitState(cache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = null; // No existing data

            const displaySpy = vi.spyOn(panel, 'display').mockImplementation(() => {});
            vi.spyOn(panel, 'saveState').mockImplementation(() => {});

            // Should not throw
            expect(() => panel.refresh()).not.toThrow();

            // Should treat as structure change and rebuild
            expect(displaySpy).toHaveBeenCalled();
        });
    });

    describe('applyTableWidth()', () => {
        it('should not apply width if panel does not exist', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = null;
            panel.table = {};

            // Should not throw
            expect(() => panel.applyTableWidth()).not.toThrow();
        });

        it('should not apply width if table does not exist', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.table = null;

            // Should not throw
            expect(() => panel.applyTableWidth()).not.toThrow();
        });

        it('should calculate and set panel width based on table content', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Set scrollWidth on the content element (Tabulator adds .tabulator class to content element itself)
            mockDOM.contentEl.scrollWidth = 350;

            // Mock getComputedStyle as a global function
            vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({
                paddingLeft: '10px',
                paddingRight: '10px'
            }));

            panel.panel = mockDOM.panelEl;
            panel.table = {};

            panel.applyTableWidth();

            // Width should be scrollWidth + padding (10 + 10) + buffer (2) = 372
            expect(mockDOM.panelEl.style.width).toBe('372px');
        });
    });

    describe('reapplyRowHeights()', () => {
        it('should apply row heights to all rows', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Create mock row elements with cells
            const mockCell1 = { style: { setProperty: vi.fn() } };
            const mockCell2 = { style: { setProperty: vi.fn() } };
            const mockRow = {
                style: { setProperty: vi.fn() },
                querySelectorAll: vi.fn().mockReturnValue([mockCell1, mockCell2])
            };

            mockDOM.contentEl.querySelectorAll = vi.fn().mockReturnValue([mockRow]);

            panel.panel = mockDOM.panelEl;
            panel.table = {};

            panel.reapplyRowHeights();

            // Should set row height
            expect(mockRow.style.setProperty).toHaveBeenCalledWith('height', '36px', 'important');
            expect(mockRow.style.setProperty).toHaveBeenCalledWith('min-height', '36px', 'important');
            expect(mockRow.style.setProperty).toHaveBeenCalledWith('max-height', '36px', 'important');

            // Should set cell padding
            expect(mockCell1.style.setProperty).toHaveBeenCalledWith('height', 'auto', 'important');
            expect(mockCell1.style.setProperty).toHaveBeenCalledWith('padding-top', '8px', 'important');
            expect(mockCell1.style.setProperty).toHaveBeenCalledWith('padding-bottom', '8px', 'important');
        });
    });

    describe('saveState()', () => {
        it('should capture computed dimensions when inline styles are empty', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                getColumns: vi.fn().mockReturnValue([])
            };

            // Panel with no inline styles but with computed dimensions
            mockDOM.panelEl.style.width = '';
            mockDOM.panelEl.style.height = '';
            mockDOM.panelEl.offsetWidth = 450;
            mockDOM.panelEl.offsetHeight = 350;

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;

            panel.saveState();

            // Should use offsetWidth/offsetHeight as fallback
            expect(panel.state.width).toBe('450px');
            expect(panel.state.height).toBe('350px');
        });

        it('should use inline style dimensions when set', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                getColumns: vi.fn().mockReturnValue([])
            };

            // Panel with inline styles set
            mockDOM.panelEl.style.width = '500px';
            mockDOM.panelEl.style.height = '400px';
            mockDOM.panelEl.offsetWidth = 450;
            mockDOM.panelEl.offsetHeight = 350;

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;

            panel.saveState();

            // Should use inline style values
            expect(panel.state.width).toBe('500px');
            expect(panel.state.height).toBe('400px');
        });
    });

    describe('Invalid Circuit Handling', () => {
        it('generate() should return true and store data for invalid circuit cache', () => {
            const invalidCache = createInvalidCache('Please add at least one gate');
            const circuitState = createMockCircuitState(invalidCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const result = panel.generate();

            expect(result).toBe(true);
            expect(panel.truthTableData).not.toBeNull();
            expect(panel.truthTableData.isValid).toBe(false);
            expect(panel.truthTableData.reason).toBe('Please add at least one gate');
            expect(panel.truthTableData.table).toEqual([]);
        });

        it('generate() should return false only when cache is null', () => {
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const result = panel.generate();

            expect(result).toBe(false);
        });

        it('updateHighlight() should return early when table has no data', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([])
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = {
                inputs: [],
                outputs: [],
                table: [], // Empty table - no data to highlight
                isValid: false,
                reason: 'No gates'
            };

            panel.updateHighlight();

            // Should not call any table methods when table is empty
            expect(mockTable.deselectRow).not.toHaveBeenCalled();
            expect(mockTable.getRows).not.toHaveBeenCalled();
        });

        it('refresh() should transition from empty table to having data correctly', () => {
            const validCache = createValidCache(2, 1);
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            // Start with empty table (e.g., no inputs or outputs before)
            panel.truthTableData = {
                inputs: [],
                outputs: [],
                table: [], // Empty table
                isValid: false,
                reason: 'No gates'
            };

            const displaySpy = vi.spyOn(panel, 'display').mockImplementation(() => {});
            vi.spyOn(panel, 'saveState').mockImplementation(() => {});

            panel.refresh();

            // Should trigger full rebuild (hadNoTable is true)
            expect(displaySpy).toHaveBeenCalled();
            // truthTableData should be updated with new table data
            expect(panel.truthTableData.table.length).toBeGreaterThan(0);
        });

        it('displayInvalidMessage() should destroy existing table', () => {
            const circuitState = createMockCircuitState(createInvalidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                destroy: vi.fn()
            };

            // Setup innerHTML mock
            mockDOM.contentEl.innerHTML = '';

            panel.panel = mockDOM.panelEl;
            panel.table = mockTable;
            panel.truthTableData = {
                inputs: [],
                outputs: [],
                table: [],
                isValid: false,
                reason: 'Test reason'
            };
            panel.interactionsSetup = true; // Skip interaction setup

            panel.displayInvalidMessage(true);

            expect(mockTable.destroy).toHaveBeenCalled();
            expect(panel.table).toBeNull();
        });
    });
});
