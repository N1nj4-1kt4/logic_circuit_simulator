/**
 * Unit tests for TruthTablePanel refresh functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TruthTablePanel } from '../../../src/ui/TruthTablePanel.js';
import { eventBus, EVENT_TYPES } from '../../../src/utils/eventBus.js';

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
const createMockCircuitState = (analysis = null) => ({
    getCircuitAnalysis: vi.fn().mockReturnValue(analysis)
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
            expect(circuitState.getCircuitAnalysis).not.toHaveBeenCalled();
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

            // Simulate panel exists but tabulatorInstance is null (e.g., after displayInvalidMessage)
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = null;
            panel.circuitAnalysis = null; // No previous data

            // Mock _renderTabulator to prevent actual table creation
            const displaySpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            panel.refresh();

            // Should read cache and attempt to rebuild
            expect(circuitState.getCircuitAnalysis).toHaveBeenCalled();
            // Since circuitAnalysis was null, it should trigger rebuild
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

            // Setup panel and tabulatorInstance
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { replaceData: vi.fn() };

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            panel.refresh();

            // Should check hidden state and return early
            expect(mockDOM.panelEl.classList.contains).toHaveBeenCalledWith('hidden');
            expect(circuitState.getCircuitAnalysis).not.toHaveBeenCalled();
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

            // Setup panel and tabulatorInstance with all required methods
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                replaceData: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                destroy: vi.fn()
            };
            panel.circuitAnalysis = createValidCache();

            // Spy on _renderInvalidState method
            const displayInvalidMessageSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

            panel.refresh();

            // Should call _renderInvalidState with no args (method fetches content internally, reason comes from circuitAnalysis)
            expect(displayInvalidMessageSpy).toHaveBeenCalled();
            expect(displayInvalidMessageSpy).toHaveBeenCalledWith();
            // Verify circuitAnalysis was updated with invalid state
            expect(panel.circuitAnalysis.isValid).toBe(false);
            expect(panel.circuitAnalysis.reason).toBe('No outputs');
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
            panel.tabulatorInstance = {
                replaceData: vi.fn(),
                getColumns: vi.fn().mockReturnValue([])
            };
            panel.circuitAnalysis = createValidCache();

            const hideSpy = vi.spyOn(panel, 'hide');

            panel.refresh();

            expect(hideSpy).toHaveBeenCalled();
        });

        // Note: Previous "fast path" test removed - the scenario where refresh() is called
        // with same structure but different data never occurs in practice.
        // refresh() is only triggered by CIRCUIT_ANALYSIS_COMPUTED which fires on:
        // - BOARD_CHANGED (structure change) → countChanged = true
        // - COMPONENT_LABEL_CHANGED → labelsChanged = true
        // Input value changes use SIMULATION_STEP_COMPLETED → _highlightRowByIndex() instead.

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

            const mockTabulatorInstance = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.circuitAnalysis = initialCache;
            panel.state = { x: 100, y: 100, width: '400px', height: '300px' };

            // Spy on _renderTabulator method
            const displaySpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            const saveStateSpy = vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            panel.refresh();

            // Should NOT call replaceData (structure changed)
            expect(mockTabulatorInstance.replaceData).not.toHaveBeenCalled();
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

            const mockTabulatorInstance = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.circuitAnalysis = initialCache;

            const displaySpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            panel.refresh();

            expect(mockTabulatorInstance.replaceData).not.toHaveBeenCalled();
            expect(displaySpy).toHaveBeenCalled();
        });

        // Note: "should update highlight after replaceData" test removed - it tested
        // the fast path which is now dead code (see note at line ~295).

        it('should handle missing circuitAnalysis gracefully', () => {
            const cache = createValidCache(2, 1);
            const circuitState = createMockCircuitState(cache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTabulatorInstance = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.circuitAnalysis = null; // No existing data

            const displaySpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            // Should not throw
            expect(() => panel.refresh()).not.toThrow();

            // Should treat as structure change and rebuild
            expect(displaySpy).toHaveBeenCalled();
        });
    });

    describe('_applyTableWidth()', () => {
        it('should not apply width if panel does not exist', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = null;
            panel.tabulatorInstance = {};

            // Should not throw
            expect(() => panel._applyTableWidth()).not.toThrow();
        });

        it('should not apply width if tabulatorInstance does not exist', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = null;

            // Should not throw
            expect(() => panel._applyTableWidth()).not.toThrow();
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
            panel.tabulatorInstance = {};

            panel._applyTableWidth();

            // Width should be scrollWidth + padding (10 + 10) + buffer (2) = 372
            expect(mockDOM.panelEl.style.width).toBe('372px');
        });
    });

    describe('_reapplyRowHeights()', () => {
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
            panel.tabulatorInstance = {};

            panel._reapplyRowHeights();

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

    describe('_saveState()', () => {
        it('should capture computed dimensions when inline styles are empty', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([])
            };

            // Panel with no inline styles but with computed dimensions
            mockDOM.panelEl.style.width = '';
            mockDOM.panelEl.style.height = '';
            mockDOM.panelEl.offsetWidth = 450;
            mockDOM.panelEl.offsetHeight = 350;

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;

            panel._saveState();

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

            const mockTabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([])
            };

            // Panel with inline styles set
            mockDOM.panelEl.style.width = '500px';
            mockDOM.panelEl.style.height = '400px';
            mockDOM.panelEl.offsetWidth = 450;
            mockDOM.panelEl.offsetHeight = 350;

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;

            panel._saveState();

            // Should use inline style values
            expect(panel.state.width).toBe('500px');
            expect(panel.state.height).toBe('400px');
        });
    });

    describe('Invalid Circuit Handling', () => {
        it('_setCircuitAnalysisLocalCopy() should store data for invalid circuit cache', () => {
            const invalidCache = createInvalidCache('Please add at least one gate');
            const circuitState = createMockCircuitState(invalidCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel._setCircuitAnalysisLocalCopy();

            expect(panel.circuitAnalysis).not.toBeNull();
            expect(panel.circuitAnalysis.isValid).toBe(false);
            expect(panel.circuitAnalysis.reason).toBe('Please add at least one gate');
            expect(panel.circuitAnalysis.table).toEqual([]);
        });

        it('_setCircuitAnalysisLocalCopy() should set placeholder data when cache is null (async computation in progress)', () => {
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel._setCircuitAnalysisLocalCopy();

            // When cache is null, it means async computation is in progress
            // Panel should have placeholder circuitAnalysis for display
            expect(panel.circuitAnalysis).not.toBeNull();
            expect(panel.circuitAnalysis.isValid).toBe(false);
            expect(panel.circuitAnalysis.reason).toBe('Computing truth table...');
        });

        it('_updateHighlight() should return early when table has no data', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([])
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.circuitAnalysis = {
                inputs: [],
                outputs: [],
                table: [], // Empty table - no data to highlight
                isValid: false,
                reason: 'No gates'
            };

            panel._updateHighlight();

            // Should not call any tabulatorInstance methods when table is empty
            expect(mockTabulatorInstance.deselectRow).not.toHaveBeenCalled();
            expect(mockTabulatorInstance.getRows).not.toHaveBeenCalled();
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

            const mockTabulatorInstance = {
                replaceData: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn()
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            // Start with empty table (e.g., no inputs or outputs before)
            panel.circuitAnalysis = {
                inputs: [],
                outputs: [],
                table: [], // Empty table
                isValid: false,
                reason: 'No gates'
            };

            const displaySpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            panel.refresh();

            // Should trigger full rebuild (hadNoTable is true)
            expect(displaySpy).toHaveBeenCalled();
            // circuitAnalysis should be updated with new table data
            expect(panel.circuitAnalysis.table.length).toBeGreaterThan(0);
        });

        it('_renderInvalidState() should destroy existing tabulatorInstance', () => {
            const circuitState = createMockCircuitState(createInvalidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTabulatorInstance = {
                destroy: vi.fn()
            };

            // Setup innerHTML mock
            mockDOM.contentEl.innerHTML = '';

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.circuitAnalysis = {
                inputs: [],
                outputs: [],
                table: [],
                isValid: false,
                reason: 'Test reason'
            };
            panel.interactionsSetup = true; // Skip interaction setup

            panel._renderInvalidState(mockDOM.contentEl);

            expect(mockTabulatorInstance.destroy).toHaveBeenCalled();
            expect(panel.tabulatorInstance).toBeNull();
        });
    });

    describe('Event Subscriptions', () => {
        beforeEach(() => {
            eventBus.clear();
        });

        afterEach(() => {
            eventBus.clear();
        });

        it('should subscribe to SIMULATION_STEP_COMPLETED on construction', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel as visible with tabulatorInstance
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([
                    { select: vi.fn(), scrollTo: vi.fn() }
                ])
            };

            // Spy on _highlightRowByIndex
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Emit the event
            eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
                cycleIndex: 0,
                totalCombinations: 4,
                inputValues: [0, 0]
            });

            expect(highlightSpy).toHaveBeenCalledWith(0);
        });

        it('should not highlight row if panel is hidden', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([])
            };

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
                cycleIndex: 0,
                totalCombinations: 4,
                inputValues: [0, 0]
            });

            expect(highlightSpy).not.toHaveBeenCalled();
        });

        it('should subscribe to CIRCUIT_VALIDITY_CHANGED on construction', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel as visible with valid table data
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };
            panel.circuitAnalysis = {
                inputs: [{ label: 'I1', value: 0 }],
                outputs: [{ label: 'O1', value: 0 }],
                table: [],
                isValid: true
            };

            // Spy on _renderInvalidState
            const displayInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

            // Emit validity changed event indicating circuit became invalid
            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                from: 'valid',
                to: 'incomplete',
                canSimulate: false,
                reason: 'Missing connection',
                inputs: [],
                outputs: []
            });

            // Should NOT mutate circuitAnalysis (mutation anti-pattern was fixed)
            // Instead, reason is passed as parameter to _renderInvalidState
            expect(panel.circuitAnalysis.isValid).toBe(true); // unchanged
            // Should show invalid message with reason passed as parameter (method fetches content internally)
            expect(displayInvalidSpy).toHaveBeenCalled();
            expect(displayInvalidSpy).toHaveBeenCalledWith('Missing connection');
        });

        it('should unsubscribe from events on destroy', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };

            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Destroy the panel
            panel.destroy();

            // Emit events after destroy
            eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
                cycleIndex: 0,
                totalCombinations: 4,
                inputValues: [0, 0]
            });

            // Should not respond to events
            expect(highlightSpy).not.toHaveBeenCalled();
        });

        it('_highlightRowByIndex should select and scroll to row', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockRow = {
                select: vi.fn(),
                scrollTo: vi.fn()
            };

            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([mockRow, mockRow])
            };

            panel._highlightRowByIndex(1);

            expect(panel.tabulatorInstance.deselectRow).toHaveBeenCalled();
            expect(mockRow.select).toHaveBeenCalled();
            expect(mockRow.scrollTo).toHaveBeenCalled();
        });

        it('_isVisible should return falsy when panel is null', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = null;

            expect(panel._isVisible()).toBeFalsy();
        });

        it('_isVisible should return false when panel has display:none', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            mockDOM.panelEl.style.display = 'none';

            expect(panel._isVisible()).toBe(false);
        });

        it('_isVisible should return true when panel is visible', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            mockDOM.panelEl.style.display = 'block';
            // Make sure hidden class is not present
            mockDOM.panelEl.classList.classes.delete('hidden');

            expect(panel._isVisible()).toBe(true);
        });
    });

    describe('destroy()', () => {
        it('should clean up table and interactions', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTabulatorInstance = { destroy: vi.fn() };
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTabulatorInstance;
            panel.interactionsSetup = true;
            panel.resizeRAF = 123;

            // Mock cancelAnimationFrame
            vi.stubGlobal('cancelAnimationFrame', vi.fn());

            panel.destroy();

            expect(mockTabulatorInstance.destroy).toHaveBeenCalled();
            expect(panel.tabulatorInstance).toBeNull();
            expect(panel.interactionsSetup).toBe(false);
            expect(panel.resizeRAF).toBeNull();
        });
    });

    describe('Label Changes', () => {
        it('should update column headers when labels change without full rebuild', () => {
            // Create initial cache with original labels
            const initialCache = {
                inputs: [
                    { id: 1, label: 'I1', value: 0 },
                    { id: 2, label: 'I2', value: 0 }
                ],
                outputs: [
                    { id: 3, label: 'O1', value: 0 }
                ],
                table: [
                    { input0: 0, input1: 0, output0: 0 },
                    { input0: 0, input1: 1, output0: 0 },
                    { input0: 1, input1: 0, output0: 0 },
                    { input0: 1, input1: 1, output0: 1 }
                ],
                isValid: true
            };

            const circuitState = createMockCircuitState(initialCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const mockTable = {
                replaceData: vi.fn(),
                setColumns: vi.fn(),
                getColumns: vi.fn().mockReturnValue([]),
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([]),
                getData: vi.fn().mockReturnValue([])
            };

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = mockTable;
            // Deep copy to simulate stored data with old labels
            panel.circuitAnalysis = {
                inputs: initialCache.inputs.map(inp => ({ ...inp })),
                outputs: initialCache.outputs.map(out => ({ ...out })),
                table: initialCache.table,
                isValid: initialCache.isValid
            };

            // Create updated cache with changed labels (but same structure)
            const updatedCache = {
                inputs: [
                    { id: 1, label: 'A', value: 0 },  // Changed from I1 to A
                    { id: 2, label: 'B', value: 0 }   // Changed from I2 to B
                ],
                outputs: [
                    { id: 3, label: 'Sum', value: 0 } // Changed from O1 to Sum
                ],
                table: initialCache.table,
                isValid: true
            };

            // Update the mock to return updated cache
            circuitState.getCircuitAnalysis.mockReturnValue(updatedCache);

            // Spy on _renderTabulator to ensure full rebuild is NOT called
            const displaySpy = vi.spyOn(panel, '_renderTabulator');

            panel.refresh();

            // Should NOT trigger full rebuild
            expect(displaySpy).not.toHaveBeenCalled();

            // Should update column headers via setColumns (for grouped columns)
            expect(mockTable.setColumns).toHaveBeenCalled();

            // Should NOT update data - labels are display-only, table data is identical
            expect(mockTable.replaceData).not.toHaveBeenCalled();
        });

        // Note: "should not update columns when labels have not changed" test removed.
        // This tested the "fast path" scenario where refresh() is called with same
        // structure and same labels - a scenario that never occurs in practice.
        // refresh() is only triggered by CIRCUIT_ANALYSIS_COMPUTED which fires on:
        // - BOARD_CHANGED (structure change) → countChanged = true → rebuild path
        // - COMPONENT_LABEL_CHANGED → labelsChanged = true → label update path
        // The "same labels" fast path is unreachable dead code.
    });
});
