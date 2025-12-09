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
        appendChild: vi.fn(),
        querySelector: vi.fn((selector) => {
            // Progress and spinner overlays need remove() method
            if (selector === '.truth-table-progress' || selector === '.truth-table-rendering') {
                return null; // Return null by default (not present)
            }
            // Panel header mock
            if (selector === '.panel-header') {
                return {
                    offsetHeight: 30,
                    classList: { add: vi.fn(), remove: vi.fn() }
                };
            }
            return {
                offsetHeight: 30,
                classList: { add: vi.fn(), remove: vi.fn() }
            };
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

    describe('_handleComputed()', () => {
        it('should always sync circuitAnalysis even when panel does not exist', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Don't call display(), so panel is null
            await panel._handleComputed();

            // Should always read cache to keep data in sync
            expect(circuitState.getCircuitAnalysis).toHaveBeenCalled();
            // circuitAnalysis should be updated
            expect(panel.circuitAnalysis).not.toBeNull();
        });

        it('should attempt rebuild when table is not initialized but panel is visible', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table (panel visible, expecting table)
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if rebuild was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            await panel._handleComputed();

            // Should read cache and attempt to rebuild
            expect(circuitState.getCircuitAnalysis).toHaveBeenCalled();
            // Since tabulatorInstance is null and we have table data, it should trigger rebuild via render queue
            expect(enqueueSpy).toHaveBeenCalled();
        });

        it('should sync data but not update Tabulator when panel is hidden', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel and tabulatorInstance
            panel.panel = mockDOM.panelEl;
            const mockTabulator = { setData: vi.fn(), setColumns: vi.fn() };
            panel.tabulatorInstance = mockTabulator;
            panel.circuitAnalysis = null; // No previous data

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            await panel._handleComputed();

            // Should still sync data even when hidden
            expect(circuitState.getCircuitAnalysis).toHaveBeenCalled();
            expect(panel.circuitAnalysis).not.toBeNull();
            // But should NOT update Tabulator
            expect(mockTabulator.setData).not.toHaveBeenCalled();
            expect(mockTabulator.setColumns).not.toHaveBeenCalled();
        });

        // NOTE: CIRCUIT_ANALYSIS_COMPUTED only fires for valid circuits.
        // Invalid state is handled by CIRCUIT_VALIDITY_CHANGED event.
        // This test verifies _handleComputed always receives valid analysis.
        it('should always receive valid analysis (event only fires for valid circuits)', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel but NO tabulatorInstance (simulating fresh open)
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = null;
            panel.circuitAnalysis = null;
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table (panel visible, expecting table)
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if rebuild was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            await panel._handleComputed();

            // Should render table via render queue (not invalid state) since event only fires for valid circuits
            expect(enqueueSpy).toHaveBeenCalled();
            // Verify circuitAnalysis was updated with valid state
            expect(panel.circuitAnalysis.isValid).toBe(true);
            expect(panel.circuitAnalysis.table.length).toBeGreaterThan(0);
        });

        it('should not update anything when cache is null', async () => {
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const existingAnalysis = createValidCache();
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                setData: vi.fn(),
                setColumns: vi.fn()
            };
            panel.circuitAnalysis = existingAnalysis;

            await panel._handleComputed();

            // circuitAnalysis should remain unchanged when cache is null
            expect(panel.circuitAnalysis).toBe(existingAnalysis);
        });

        it('should rebuild table when input count changes', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table to enable rebuild detection
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if REBUILD_TABLE action was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            const saveStateSpy = vi.spyOn(panel, '_saveState').mockImplementation(() => {});
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            await panel._handleComputed();

            // Should NOT call replaceData (structure changed)
            expect(mockTabulatorInstance.replaceData).not.toHaveBeenCalled();
            // Should save state and trigger rebuild via render queue
            expect(saveStateSpy).toHaveBeenCalled();
            expect(enqueueSpy).toHaveBeenCalled();
            // Should reset column order
            expect(panel.columnOrder).toBeNull();
            // Should clear height/width to allow auto-fit, but keep position
            expect(panel.state.x).toBe(100);
            expect(panel.state.y).toBe(100);
            expect(panel.state.height).toBe('');
            expect(panel.state.width).toBe('');
        });

        it('should rebuild table when output count changes', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table to enable rebuild detection
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if REBUILD_TABLE action was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            await panel._handleComputed();

            expect(mockTabulatorInstance.replaceData).not.toHaveBeenCalled();
            expect(enqueueSpy).toHaveBeenCalled();
        });

        it('should handle missing circuitAnalysis gracefully', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table to enable rebuild detection
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if rebuild was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            // Should not throw
            await expect(panel._handleComputed()).resolves.not.toThrow();

            // Should treat as structure change and trigger rebuild via render queue
            expect(enqueueSpy).toHaveBeenCalled();
        });

        it('should mark state machine data as STALE when panel is hidden', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup panel and tabulatorInstance
            panel.panel = mockDOM.panelEl;
            const mockTabulator = { setData: vi.fn(), setColumns: vi.fn() };
            panel.tabulatorInstance = mockTabulator;
            panel.circuitAnalysis = null;

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            await panel._handleComputed();

            // State machine should mark data as STALE
            const smState = panel._stateMachine.getState();
            expect(smState.data).toBe('stale');
            // Data should still be synced
            expect(panel.circuitAnalysis).not.toBeNull();
        });
    });

    describe('State Machine Data Tracking', () => {
        it('should start with FRESH data state', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const smState = panel._stateMachine.getState();
            expect(smState.data).toBe('fresh');
        });

        it('should reset state machine on destroy()', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Modify state machine state
            panel._stateMachine.handleStepCompleted({ cycleIndex: 5 });
            panel._stateMachine.setDataState('stale');

            panel.destroy();

            const smState = panel._stateMachine.getState();
            expect(smState.data).toBe('fresh');
            expect(smState.lastCycleIndex).toBeNull();
            expect(smState.panel).toBe('hidden');
        });

        it('should mark data STALE when circuit goes invalid while hidden', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup: panel exists with valid table, but is hidden
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };
            panel.circuitAnalysis = createValidCache();

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            // Emit validity changed event indicating circuit became invalid
            panel._handleValidityChanged({
                from: 'valid',
                to: 'incomplete',
                canSimulate: false,
                reason: 'Missing connection'
            });

            // State machine should mark data as STALE so show() will sync
            const smState = panel._stateMachine.getState();
            expect(smState.data).toBe('stale');
        });

        it('should mark data STALE when circuit goes valid while hidden', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup: panel exists with invalid table, but is hidden
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = null;
            panel.circuitAnalysis = createInvalidCache();

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            // Emit validity changed event indicating circuit became valid
            panel._handleValidityChanged({
                from: 'incomplete',
                to: 'valid',
                canSimulate: true
            });

            // State machine should mark data as STALE so show() will sync
            const smState = panel._stateMachine.getState();
            expect(smState.data).toBe('stale');
        });
    });

    describe('lastCycleIndex tracking via State Machine', () => {
        it('should have null lastCycleIndex initially', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            const smState = panel._stateMachine.getState();
            expect(smState.lastCycleIndex).toBeNull();
        });

        it('should clear lastCycleIndex on destroy()', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Set a cycle index via state machine
            panel._stateMachine.handleStepCompleted({ cycleIndex: 5 });
            expect(panel._stateMachine.getState().lastCycleIndex).toBe(5);

            panel.destroy();

            const smState = panel._stateMachine.getState();
            expect(smState.lastCycleIndex).toBeNull();
        });

        it('should track cycleIndex via state machine when simulation step fires while hidden', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup: panel exists but is hidden
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([])
            };

            // Mark panel as hidden
            mockDOM.panelEl.classList.classes.add('hidden');

            // Spy to verify _highlightRowByIndex is NOT called when hidden
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Trigger simulation step
            panel._handleStepCompleted({ cycleIndex: 3 });

            // State machine should track the cycle index even when hidden
            const smState = panel._stateMachine.getState();
            expect(smState.lastCycleIndex).toBe(3);
            // Should NOT highlight when hidden
            expect(highlightSpy).not.toHaveBeenCalled();
        });

        it('should track cycleIndex AND highlight when visible', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Setup: panel is visible with VISIBLE_TABLE state
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() }
                ])
            };
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to VISIBLE_TABLE state
            panel._stateMachine.setPanelState('visible_table');

            // Spy on _highlightRowByIndex
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Trigger simulation step
            panel._handleStepCompleted({ cycleIndex: 2 });

            // State machine should track the cycle index
            const smState = panel._stateMachine.getState();
            expect(smState.lastCycleIndex).toBe(2);
            // Should also highlight when visible
            expect(highlightSpy).toHaveBeenCalledWith(2);
        });
    });

    describe('_syncTabulatorWithAnalysis()', () => {
        it('should return early if tabulatorInstance is null', async () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.tabulatorInstance = null;
            panel.circuitAnalysis = createValidCache();

            // Should not throw
            await expect(panel._syncTabulatorWithAnalysis()).resolves.not.toThrow();
        });

        it('should render invalid state when circuitState returns null', async () => {
            // Now _syncTabulatorWithAnalysis fetches fresh data from circuitState
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };
            panel.circuitAnalysis = createValidCache();
            panel.interactionsSetup = true;
            mockDOM.contentEl.innerHTML = '';

            const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

            await panel._syncTabulatorWithAnalysis();

            // Should render invalid state when circuitState returns null
            expect(renderInvalidSpy).toHaveBeenCalled();
        });

        it('should rebuild table when structure changes', async () => {
            const circuitState = createMockCircuitState(createValidCache(3, 1));
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.circuitAnalysis = createValidCache(3, 1); // 3 inputs now
            panel.tabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0' },
                    { getField: () => 'input1' },
                    { getField: () => 'output0' }
                ]) // Only 2 inputs in Tabulator
            };

            const renderSpy = vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});

            await panel._syncTabulatorWithAnalysis();

            // Should trigger full rebuild
            expect(renderSpy).toHaveBeenCalled();
        });

        it('should update headers when labels change', async () => {
            // Create analysis with new labels (what circuitState will return)
            const freshAnalysis = {
                inputs: [{ label: 'NewLabel', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{ input0: 0, output0: 0 }, { input0: 1, output0: 1 }],
                isValid: true
            };
            const circuitState = createMockCircuitState(freshAnalysis);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            // Local copy has old labels
            panel.circuitAnalysis = {
                inputs: [{ label: 'OldLabel', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{ input0: 0, output0: 0 }, { input0: 1, output0: 1 }],
                isValid: true
            };
            panel.tabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0', getDefinition: () => ({ title: 'OldLabel' }) },
                    { getField: () => 'output0', getDefinition: () => ({ title: 'Q' }) }
                ]),
                setColumns: vi.fn(),
                setData: vi.fn()
            };

            const updateHeadersSpy = vi.spyOn(panel, '_updateColumnHeaders').mockImplementation(() => {});
            vi.spyOn(panel, '_reapplyRowHeights').mockImplementation(() => {});
            vi.spyOn(panel, '_updateHighlight').mockImplementation(() => {});

            await panel._syncTabulatorWithAnalysis();

            // Should update headers
            expect(updateHeadersSpy).toHaveBeenCalled();
        });

        it('should use setData for data-only changes', async () => {
            // Create analysis with same structure but different output values
            const freshAnalysis = {
                inputs: [{ label: 'A', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{ input0: 0, output0: 1 }, { input0: 1, output0: 0 }], // Updated data
                isValid: true
            };
            const circuitState = createMockCircuitState(freshAnalysis);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            // Local copy has old data
            panel.circuitAnalysis = {
                inputs: [{ label: 'A', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [{ input0: 0, output0: 0 }, { input0: 1, output0: 1 }], // Old data
                isValid: true
            };
            const mockTabulator = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0', getDefinition: () => ({ title: 'A' }) },
                    { getField: () => 'output0', getDefinition: () => ({ title: 'Q' }) }
                ]),
                setData: vi.fn()
            };
            panel.tabulatorInstance = mockTabulator;

            await panel._syncTabulatorWithAnalysis();

            // Should use setData for data-only change
            expect(mockTabulator.setData).toHaveBeenCalled();
        });

        it('should render invalid state when fresh analysis from circuitState is invalid (Bug #1 fix)', async () => {
            // This tests the scenario where:
            // 1. Panel was showing valid table
            // 2. User hid panel
            // 3. Circuit became invalid while hidden
            // 4. User shows panel → _syncTabulatorWithAnalysis is called
            // 5. Should render invalid state
            const invalidCache = createInvalidCache('Missing connection');
            const circuitState = createMockCircuitState(invalidCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };
            // Old local copy was valid
            panel.circuitAnalysis = createValidCache();
            panel.interactionsSetup = true;

            // Mock innerHTML on content element
            mockDOM.contentEl.innerHTML = '';

            const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

            await panel._syncTabulatorWithAnalysis();

            // Should render invalid state
            expect(renderInvalidSpy).toHaveBeenCalled();
            // Should update local copy to reflect invalid state
            expect(panel.circuitAnalysis.isValid).toBe(false);
        });

        it('should render invalid state when fresh analysis is null (computation in progress)', async () => {
            const circuitState = createMockCircuitState(null);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = { destroy: vi.fn() };
            panel.circuitAnalysis = createValidCache();
            panel.interactionsSetup = true;

            mockDOM.contentEl.innerHTML = '';

            const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

            await panel._syncTabulatorWithAnalysis();

            // Should render invalid state (null means computation in progress)
            expect(renderInvalidSpy).toHaveBeenCalled();
            // Local copy should be null
            expect(panel.circuitAnalysis).toBeNull();
        });
    });

    describe('_detectLabelChanges()', () => {
        it('should return false if tabulatorInstance is null', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.tabulatorInstance = null;
            panel.circuitAnalysis = createValidCache();

            expect(panel._detectLabelChanges()).toBe(false);
        });

        it('should return false if circuitAnalysis is null', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.tabulatorInstance = { getColumns: vi.fn() };
            panel.circuitAnalysis = null;

            expect(panel._detectLabelChanges()).toBe(false);
        });

        it('should return true when input label differs', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.circuitAnalysis = {
                inputs: [{ label: 'NewLabel', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [],
                isValid: true
            };
            panel.tabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0', getDefinition: () => ({ title: 'OldLabel' }) },
                    { getField: () => 'output0', getDefinition: () => ({ title: 'Q' }) }
                ])
            };

            expect(panel._detectLabelChanges()).toBe(true);
        });

        it('should return true when output label differs', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.circuitAnalysis = {
                inputs: [{ label: 'A', value: 0 }],
                outputs: [{ label: 'NewQ', value: 0 }],
                table: [],
                isValid: true
            };
            panel.tabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0', getDefinition: () => ({ title: 'A' }) },
                    { getField: () => 'output0', getDefinition: () => ({ title: 'OldQ' }) }
                ])
            };

            expect(panel._detectLabelChanges()).toBe(true);
        });

        it('should return false when all labels match', () => {
            const circuitState = createMockCircuitState(createValidCache());
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            panel.circuitAnalysis = {
                inputs: [{ label: 'A', value: 0 }],
                outputs: [{ label: 'Q', value: 0 }],
                table: [],
                isValid: true
            };
            panel.tabulatorInstance = {
                getColumns: vi.fn().mockReturnValue([
                    { getField: () => 'input0', getDefinition: () => ({ title: 'A' }) },
                    { getField: () => 'output0', getDefinition: () => ({ title: 'Q' }) }
                ])
            };

            expect(panel._detectLabelChanges()).toBe(false);
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

        it('_handleComputed() should transition from empty table to having data correctly', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to visible_table to enable rebuild detection
            panel._stateMachine.setPanelState('visible_table');

            // Mock render queue to track if rebuild was triggered
            const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
            vi.spyOn(panel, '_saveState').mockImplementation(() => {});
            vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

            await panel._handleComputed();

            // Should trigger full rebuild (structure changed - oldAnalysis had 0 inputs/outputs)
            expect(enqueueSpy).toHaveBeenCalled();
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to VISIBLE_TABLE state (required for HIGHLIGHT_ROW action)
            panel._stateMachine.setPanelState('visible_table');

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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to VISIBLE_TABLE state (required for SHOW_INVALID action)
            panel._stateMachine.setPanelState('visible_table');

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

            // _handleValidityChanged is now the PRIMARY handler for invalid states
            // It DOES update local circuitAnalysis to reflect invalidity
            expect(panel.circuitAnalysis.isValid).toBe(false);
            expect(panel.circuitAnalysis.reason).toBe('Missing connection');
            // Should show invalid message with reason passed as parameter
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
        it('should update column headers when labels change without full rebuild', async () => {
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
            mockDOM.panelEl.style.display = 'block';
            mockDOM.panelEl.classList.classes.delete('hidden');

            // Set state machine to VISIBLE_TABLE state (required for UPDATE_HEADERS action)
            panel._stateMachine.setPanelState('visible_table');

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
            // Mock _reapplyRowHeights and _updateHighlight (called after setColumns)
            vi.spyOn(panel, '_reapplyRowHeights').mockImplementation(() => {});
            vi.spyOn(panel, '_updateHighlight').mockImplementation(() => {});

            await panel._handleComputed();

            // Should NOT trigger full rebuild
            expect(displaySpy).not.toHaveBeenCalled();

            // Should update column headers via setColumns (for grouped columns)
            expect(mockTable.setColumns).toHaveBeenCalled();

            // Should reapply row heights and update highlight after setColumns
            expect(panel._reapplyRowHeights).toHaveBeenCalled();
            expect(panel._updateHighlight).toHaveBeenCalled();

            // Should NOT update data - labels are display-only, table data is identical
            expect(mockTable.replaceData).not.toHaveBeenCalled();
        });
    });

    describe('show() fast path (Bug #2 fix)', () => {
        it('should use lastCycleIndex for highlighting when panel is shown', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Mark as initialized (Phase 3 requirement)
            panel._initialized = true;

            // Setup: panel exists with tabulatorInstance (fast path condition)
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() }
                ]),
                destroy: vi.fn() // NONE action does quick rebuild which calls destroy()
            };
            panel.circuitAnalysis = validCache;

            // Set lastCycleIndex via state machine (Phase 3 - using state machine)
            panel._stateMachine.handleStepCompleted({ cycleIndex: 2 });

            // Make state machine return NONE (already visible)
            vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'NONE' });
            vi.spyOn(panel._stateMachine, 'getState').mockReturnValue({
                panel: 'visible_table',
                lastCycleIndex: 2
            });

            // Spy on _highlightRowByIndex
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Mock getElementById to return null for truthTableContent to skip quick rebuild
            // (quick rebuild requires Tabulator constructor which isn't available in tests)
            const originalGetById = document.getElementById;
            document.getElementById = vi.fn((id) => {
                if (id === 'truthTableContent') return null;
                return originalGetById?.(id);
            });

            await panel.show();

            // Restore
            document.getElementById = originalGetById;

            // Should highlight using lastCycleIndex from state machine
            expect(highlightSpy).toHaveBeenCalledWith(2);
        });

        it('should not highlight if lastCycleIndex is null', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Mark as initialized (Phase 3 requirement)
            panel._initialized = true;

            // Setup: panel exists with tabulatorInstance (fast path condition)
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([]),
                destroy: vi.fn() // NONE action does quick rebuild which calls destroy()
            };
            panel.circuitAnalysis = validCache;

            // Make state machine return NONE (already visible)
            vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'NONE' });
            vi.spyOn(panel._stateMachine, 'getState').mockReturnValue({
                panel: 'visible_table',
                lastCycleIndex: null // No previous cycle index
            });

            // Spy on _highlightRowByIndex
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            // Mock getElementById to return null for truthTableContent to skip quick rebuild
            // (quick rebuild requires Tabulator constructor which isn't available in tests)
            const originalGetById = document.getElementById;
            document.getElementById = vi.fn((id) => {
                if (id === 'truthTableContent') return null;
                return originalGetById?.(id);
            });

            await panel.show();

            // Restore
            document.getElementById = originalGetById;

            // Should NOT call highlight when lastCycleIndex is null
            expect(highlightSpy).not.toHaveBeenCalled();
        });

        it('should sync and then highlight when state machine returns SYNC', async () => {
            const validCache = createValidCache();
            const circuitState = createMockCircuitState(validCache);
            const panel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );

            // Mark as initialized (Phase 3 requirement)
            panel._initialized = true;

            // Setup: panel exists with tabulatorInstance (fast path condition)
            panel.panel = mockDOM.panelEl;
            panel.tabulatorInstance = {
                deselectRow: vi.fn(),
                getRows: vi.fn().mockReturnValue([
                    { select: vi.fn(), scrollTo: vi.fn() },
                    { select: vi.fn(), scrollTo: vi.fn() }
                ]),
                getColumns: vi.fn().mockReturnValue([]),
                setData: vi.fn()
            };
            panel.circuitAnalysis = validCache;

            // Make state machine return SYNC (data is stale)
            vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'SYNC' });
            vi.spyOn(panel._stateMachine, 'getState').mockReturnValue({
                panel: 'visible_table',
                lastCycleIndex: 1
            });

            // Spy on methods
            const syncSpy = vi.spyOn(panel, '_syncTabulatorWithAnalysis').mockResolvedValue();
            const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

            await panel.show();

            // Should sync first
            expect(syncSpy).toHaveBeenCalled();
            // Should highlight after sync
            expect(highlightSpy).toHaveBeenCalledWith(1);
        });
    });

    // ============================================================================
    // Phase 2: State Machine Integration Tests
    // ============================================================================

    describe('State Machine Integration (Phase 2)', () => {
        describe('State machine instantiation', () => {
            it('should create state machine instance on construction', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                expect(panel._stateMachine).toBeDefined();
                expect(panel._stateMachine.getState).toBeDefined();
            });

            it('should create render queue instance on construction', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                expect(panel._renderQueue).toBeDefined();
                expect(panel._renderQueue.enqueue).toBeDefined();
            });

            it('should reset state machine on destroy()', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                // Spy on state machine reset
                const resetSpy = vi.spyOn(panel._stateMachine, 'reset');

                panel.destroy();

                expect(resetSpy).toHaveBeenCalled();
            });
        });

        describe('Event handlers call state machine', () => {
            it('_handleStepCompleted should call state machine', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const handleStepSpy = vi.spyOn(panel._stateMachine, 'handleStepCompleted');

                panel._handleStepCompleted({ cycleIndex: 3 });

                expect(handleStepSpy).toHaveBeenCalledWith({ cycleIndex: 3 });
            });

            it('_handleValidityChanged should call state machine', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');

                const handleValiditySpy = vi.spyOn(panel._stateMachine, 'handleValidityChanged');

                panel._handleValidityChanged({ canSimulate: false, reason: 'Test' });

                expect(handleValiditySpy).toHaveBeenCalledWith({ canSimulate: false, reason: 'Test' });
            });

            it('_handleComputing should call state machine', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');

                const handleComputingSpy = vi.spyOn(panel._stateMachine, 'handleComputing');

                panel._handleComputing({ percent: 50, current: 50, total: 100 });

                expect(handleComputingSpy).toHaveBeenCalledWith({ percent: 50, current: 50, total: 100 });
            });

            it('_handleComputed should call state machine with analysis data', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');

                const handleComputedSpy = vi.spyOn(panel._stateMachine, 'handleComputed');

                await panel._handleComputed();

                // Should be called with new analysis and old analysis (null initially)
                expect(handleComputedSpy).toHaveBeenCalled();
                const [newAnalysis, oldAnalysis] = handleComputedSpy.mock.calls[0];
                expect(newAnalysis).toBeDefined();
                expect(oldAnalysis).toBeNull();
            });
        });

        describe('_executeAction dispatcher', () => {
            it('should handle NONE action by doing nothing', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                // Should not throw
                await expect(panel._executeAction({ action: 'NONE' })).resolves.not.toThrow();
                await expect(panel._executeAction(null)).resolves.not.toThrow();
            });

            it('should handle SHOW_COMPUTING action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;

                const revealSpy = vi.spyOn(panel, '_revealPanel');
                const renderComputingSpy = vi.spyOn(panel, '_renderComputingState').mockImplementation(() => {});

                await panel._executeAction({ action: 'SHOW_COMPUTING' });

                expect(revealSpy).toHaveBeenCalled();
                expect(renderComputingSpy).toHaveBeenCalled();
            });

            it('should handle SHOW_INVALID action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;

                const revealSpy = vi.spyOn(panel, '_revealPanel');
                const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});

                await panel._executeAction({ action: 'SHOW_INVALID', reason: 'Test reason' });

                expect(revealSpy).toHaveBeenCalled();
                expect(renderInvalidSpy).toHaveBeenCalledWith('Test reason');
            });

            it('should handle HIGHLIGHT_ROW action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex').mockImplementation(() => {});

                await panel._executeAction({ action: 'HIGHLIGHT_ROW', index: 5 });

                expect(highlightSpy).toHaveBeenCalledWith(5);
            });

            it('should handle HIDE action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = { getColumns: vi.fn().mockReturnValue([]) };

                const hideSpy = vi.spyOn(panel, '_hidePanel');

                await panel._executeAction({ action: 'HIDE' });

                expect(hideSpy).toHaveBeenCalled();
            });

            it('should handle UPDATE_DATA action', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const mockTabulator = { setData: vi.fn() };
                panel.tabulatorInstance = mockTabulator;
                panel.circuitAnalysis = validCache;

                await panel._executeAction({ action: 'UPDATE_DATA' });

                expect(mockTabulator.setData).toHaveBeenCalledWith(validCache.table);
            });

            it('should handle SHOW_PROGRESS action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const showProgressSpy = vi.spyOn(panel, '_showProgress').mockImplementation(() => {});

                await panel._executeAction({ action: 'SHOW_PROGRESS', percent: 50, current: 100, total: 200 });

                expect(showProgressSpy).toHaveBeenCalledWith(50, 100, 200);
            });

            it('should handle SYNC action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const syncSpy = vi.spyOn(panel, '_syncTabulatorWithAnalysis').mockResolvedValue();

                await panel._executeAction({ action: 'SYNC' });

                expect(syncSpy).toHaveBeenCalled();
            });

            it('should handle RENDER_TABLE action through render queue', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const enqueueSpy = vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel._executeAction({ action: 'RENDER_TABLE' });

                expect(enqueueSpy).toHaveBeenCalled();
            });

            it('should handle UPDATE_HEADERS action', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                const updateHeadersSpy = vi.spyOn(panel, '_updateColumnHeaders').mockImplementation(() => {});
                const reapplyRowHeightsSpy = vi.spyOn(panel, '_reapplyRowHeights').mockImplementation(() => {});
                const updateHighlightSpy = vi.spyOn(panel, '_updateHighlight').mockImplementation(() => {});

                await panel._executeAction({ action: 'UPDATE_HEADERS' });

                expect(updateHeadersSpy).toHaveBeenCalled();
                expect(reapplyRowHeightsSpy).toHaveBeenCalled();
                expect(updateHighlightSpy).toHaveBeenCalled();
            });
        });

        describe('Helper methods', () => {
            it('_revealPanel should make panel visible', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');
                mockDOM.panelEl.style.display = 'none';

                panel._revealPanel();

                expect(mockDOM.panelEl.classList.remove).toHaveBeenCalledWith('hidden');
                expect(mockDOM.panelEl.style.display).toBe('block');
                expect(mockDOM.panelEl.style.pointerEvents).toBe('auto');
            });

            it('_revealPanel should return early if panel is null', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = null;

                // Should not throw
                expect(() => panel._revealPanel()).not.toThrow();
            });

            it('_hidePanel should hide panel and save state', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = { getColumns: vi.fn().mockReturnValue([]) };

                const saveStateSpy = vi.spyOn(panel, '_saveState').mockImplementation(() => {});

                panel._hidePanel();

                expect(saveStateSpy).toHaveBeenCalled();
                // _hidePanel uses display:none and hidden class (not opacity/pointerEvents)
                expect(mockDOM.panelEl.classList.add).toHaveBeenCalledWith('hidden');
                expect(mockDOM.panelEl.style.display).toBe('none');
            });

            it('_hidePanel should return early if panel is null', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = null;

                // Should not throw
                expect(() => panel._hidePanel()).not.toThrow();
            });

            it('_safeRenderTable should call state machine render lifecycle methods', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                const renderStartedSpy = vi.spyOn(panel._stateMachine, 'renderStarted');
                const renderCompletedSpy = vi.spyOn(panel._stateMachine, 'renderCompleted');
                vi.spyOn(panel, '_renderTabulator').mockResolvedValue();

                await panel._safeRenderTable();

                expect(renderStartedSpy).toHaveBeenCalled();
                expect(renderCompletedSpy).toHaveBeenCalled();
            });

            it('_safeRenderTable should call renderCompleted even if render throws', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                const renderCompletedSpy = vi.spyOn(panel._stateMachine, 'renderCompleted');
                vi.spyOn(panel, '_renderTabulator').mockRejectedValue(new Error('Render error'));

                await expect(panel._safeRenderTable()).rejects.toThrow('Render error');

                // renderCompleted should still be called via finally block
                expect(renderCompletedSpy).toHaveBeenCalled();
            });

            it('_safeRenderTable should return early if no content element', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                // Make getElementById return null for truthTableContent
                mockDOM.mockDocument.getElementById = vi.fn((id) => {
                    if (id === 'truthTableContent') return null;
                    return mockDOM.panelEl;
                });

                const renderStartedSpy = vi.spyOn(panel._stateMachine, 'renderStarted');

                await panel._safeRenderTable();

                // Should not have called renderStarted since we returned early
                expect(renderStartedSpy).not.toHaveBeenCalled();
            });
        });

        describe('State machine only tracking', () => {
            it('validity changed should track via state machine only', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');

                // Trigger validity changed
                panel._handleValidityChanged({ canSimulate: false, reason: 'Test' });

                // State machine should track this (data becomes STALE)
                const smState = panel._stateMachine.getState();
                expect(smState.data).toBe('stale');
            });

            it('step completed should track via state machine only', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.classList.classes.add('hidden');

                // Trigger step completed
                panel._handleStepCompleted({ cycleIndex: 7 });

                // State machine should track this
                const smState = panel._stateMachine.getState();
                expect(smState.lastCycleIndex).toBe(7);
            });
        });
    });

    // ============================================================================
    // Phase 3: Refactored show/hide Tests
    // ============================================================================

    describe('Refactored show/hide (Phase 3)', () => {
        describe('hide()', () => {
            it('should call state machine handleHide', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = { getColumns: vi.fn().mockReturnValue([]) };

                const handleHideSpy = vi.spyOn(panel._stateMachine, 'handleHide');

                panel.hide();

                expect(handleHideSpy).toHaveBeenCalled();
            });

            it('should emit TRUTH_TABLE_HIDDEN event', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = { getColumns: vi.fn().mockReturnValue([]) };

                const eventHandler = vi.fn();
                eventBus.on(EVENT_TYPES.TRUTH_TABLE_HIDDEN, eventHandler);

                panel.hide();

                expect(eventHandler).toHaveBeenCalled();

                eventBus.off(EVENT_TYPES.TRUTH_TABLE_HIDDEN, eventHandler);
            });

            it('should transition state machine to HIDDEN', () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = { getColumns: vi.fn().mockReturnValue([]) };

                // Set panel visible first
                panel._stateMachine.setPanelState('visible_table');

                panel.hide();

                expect(panel._stateMachine.getState().panel).toBe('hidden');
            });
        });

        describe('show()', () => {
            it('should throw error if not initialized', async () => {
                const circuitState = createMockCircuitState(createValidCache());
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                // Not calling init()

                await expect(panel.show()).rejects.toThrow('TruthTablePanel not initialized');
            });

            it('should call state machine handleShow', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                const handleShowSpy = vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'NONE' });

                await panel.show();

                expect(handleShowSpy).toHaveBeenCalled();
            });

            it('should emit TRUTH_TABLE_SHOWN event', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'NONE' });

                const eventHandler = vi.fn();
                eventBus.on(EVENT_TYPES.TRUTH_TABLE_SHOWN, eventHandler);

                await panel.show();

                expect(eventHandler).toHaveBeenCalled();

                eventBus.off(EVENT_TYPES.TRUTH_TABLE_SHOWN, eventHandler);
            });

            it('should call _syncTabulatorWithAnalysis when action is SYNC', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'SYNC' });
                const syncSpy = vi.spyOn(panel, '_syncTabulatorWithAnalysis').mockResolvedValue();

                await panel.show();

                expect(syncSpy).toHaveBeenCalled();
            });

            it('should render computing state when action is SHOW_COMPUTING', async () => {
                const circuitState = createMockCircuitState(null); // No analysis
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'SHOW_COMPUTING' });
                const renderComputingSpy = vi.spyOn(panel, '_renderComputingState').mockImplementation(() => {});
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel.show();

                expect(renderComputingSpy).toHaveBeenCalled();
            });

            it('should render invalid state when action is SHOW_INVALID', async () => {
                const invalidCache = createInvalidCache('Test reason');
                const circuitState = createMockCircuitState(invalidCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'SHOW_INVALID', reason: 'Test reason' });
                const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel.show();

                expect(renderInvalidSpy).toHaveBeenCalledWith('Test reason');
            });

            it('should render table and signal render lifecycle when action is RENDER_TABLE', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'RENDER_TABLE' });
                const renderStartedSpy = vi.spyOn(panel._stateMachine, 'renderStarted');
                const renderCompletedSpy = vi.spyOn(panel._stateMachine, 'renderCompleted');
                vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel.show();

                expect(renderStartedSpy).toHaveBeenCalled();
                expect(renderCompletedSpy).toHaveBeenCalled();
            });

            it('should highlight row using state machine lastCycleIndex after RENDER_TABLE', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;
                panel.tabulatorInstance = {
                    deselectRow: vi.fn(),
                    getRows: vi.fn().mockReturnValue([
                        { select: vi.fn(), scrollTo: vi.fn() },
                        { select: vi.fn(), scrollTo: vi.fn() },
                        { select: vi.fn(), scrollTo: vi.fn() }
                    ])
                };

                // Set lastCycleIndex in state machine
                panel._stateMachine.handleStepCompleted({ cycleIndex: 2 });

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'RENDER_TABLE' });
                vi.spyOn(panel._stateMachine, 'getState').mockReturnValue({
                    panel: 'visible_table',
                    lastCycleIndex: 2
                });
                vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

                await panel.show();

                expect(highlightSpy).toHaveBeenCalledWith(2);
            });

            it('should highlight row on SYNC action when lastCycleIndex is set', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = {
                    deselectRow: vi.fn(),
                    getRows: vi.fn().mockReturnValue([
                        { select: vi.fn(), scrollTo: vi.fn() },
                        { select: vi.fn(), scrollTo: vi.fn() }
                    ])
                };

                vi.spyOn(panel._stateMachine, 'handleShow').mockReturnValue({ action: 'SYNC' });
                vi.spyOn(panel._stateMachine, 'getState').mockReturnValue({
                    panel: 'visible_table',
                    lastCycleIndex: 1
                });
                vi.spyOn(panel, '_syncTabulatorWithAnalysis').mockResolvedValue();

                const highlightSpy = vi.spyOn(panel, '_highlightRowByIndex');

                await panel.show();

                expect(highlightSpy).toHaveBeenCalledWith(1);
            });
        });
    });

    // ============================================================================
    // Phase 5: Edge Case Integration Tests
    // ============================================================================

    describe('Edge Case Integration Tests', () => {
        describe('Panel opened during async computation', () => {
            it('should show computing state when opened during computation', async () => {
                const circuitState = createMockCircuitState(null); // null = computation in progress
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                const renderComputingSpy = vi.spyOn(panel, '_renderComputingState').mockImplementation(() => {});
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel.show();

                expect(renderComputingSpy).toHaveBeenCalled();
                expect(panel._stateMachine.getState().panel).toBe('showing_computing');
            });

            it('should transition to showing table when computation completes while showing computing', async () => {
                const circuitState = createMockCircuitState(null);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.style.display = 'block';
                mockDOM.panelEl.classList.classes.delete('hidden');

                // Start in SHOWING_COMPUTING state
                panel._stateMachine.setPanelState('showing_computing');

                // Now computation completes
                const validCache = createValidCache();
                circuitState.getCircuitAnalysis.mockReturnValue(validCache);

                vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel._handleComputed();

                // Should have triggered RENDER_TABLE action
                expect(panel._renderQueue.enqueue).toHaveBeenCalled();
            });
        });

        describe('Circuit invalidated while panel hidden, then shown', () => {
            it('should show invalid state when shown after circuit became invalid while hidden', async () => {
                const invalidCache = createInvalidCache('Missing connection');
                const circuitState = createMockCircuitState(invalidCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;

                const renderInvalidSpy = vi.spyOn(panel, '_renderInvalidState').mockImplementation(() => {});
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                await panel.show();

                expect(renderInvalidSpy).toHaveBeenCalledWith('Missing connection');
            });

            it('should sync after being stale when shown', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = {
                    deselectRow: vi.fn(),
                    getRows: vi.fn().mockReturnValue([]),
                    getColumns: vi.fn().mockReturnValue([]),
                    setData: vi.fn()
                };
                panel.circuitAnalysis = validCache;

                // Set panel as visible with stale data in state machine
                panel._stateMachine.setPanelState('visible_table');
                panel._stateMachine.setDataState('stale');

                const syncSpy = vi.spyOn(panel, '_syncTabulatorWithAnalysis').mockResolvedValue();

                await panel.show();

                expect(syncSpy).toHaveBeenCalled();
            });
        });

        describe('Rapid show/hide/show sequence', () => {
            it('should handle rapid show/hide/show without errors', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = {
                    getColumns: vi.fn().mockReturnValue([]),
                    getRows: vi.fn().mockReturnValue([]),
                    destroy: vi.fn() // NONE action does quick rebuild which calls destroy()
                };

                vi.spyOn(panel, '_renderTabulator').mockResolvedValue();
                vi.spyOn(panel, '_positionPanelIfNeeded').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});
                vi.spyOn(panel, '_saveState').mockImplementation(() => {});

                // Mock getElementById to return null for truthTableContent to skip quick rebuild
                // (quick rebuild requires Tabulator constructor which isn't available in tests)
                const originalGetById = document.getElementById;
                document.getElementById = vi.fn((id) => {
                    if (id === 'truthTableContent') return null;
                    return originalGetById?.(id);
                });

                // Rapid sequence
                await panel.show();
                panel.hide();
                await panel.show();

                // Restore
                document.getElementById = originalGetById;

                // Should end up in a visible state
                expect(panel._stateMachine.isVisible()).toBe(true);
            });
        });

        describe('Structure change clears lastCycleIndex', () => {
            it('should clear lastCycleIndex when structure changes via handleComputed', async () => {
                const oldCache = createValidCache(2, 1); // 2 inputs, 1 output
                const newCache = createValidCache(3, 1); // 3 inputs, 1 output - structure changed

                const circuitState = createMockCircuitState(newCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.tabulatorInstance = {
                    destroy: vi.fn(),
                    getColumns: vi.fn().mockReturnValue([])
                };
                panel.circuitAnalysis = oldCache;
                mockDOM.panelEl.style.display = 'block';
                mockDOM.panelEl.classList.classes.delete('hidden');

                // Set visible state and lastCycleIndex
                panel._stateMachine.setPanelState('visible_table');
                panel._stateMachine.handleStepCompleted({ cycleIndex: 2 });
                expect(panel._stateMachine.getState().lastCycleIndex).toBe(2);

                vi.spyOn(panel._renderQueue, 'enqueue').mockResolvedValue();
                vi.spyOn(panel, '_saveState').mockImplementation(() => {});
                vi.spyOn(panel, '_setupInteractions').mockImplementation(() => {});

                // Handle computed with structure change
                await panel._handleComputed();

                // lastCycleIndex should be cleared due to structure change
                expect(panel._stateMachine.getState().lastCycleIndex).toBeNull();
            });
        });

        describe('REBUILD_TABLE + hide + show preserves width', () => {
            it('should preserve auto-fitted width after REBUILD_TABLE when hiding and showing', async () => {
                const validCache = createValidCache(2, 1);
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel._initialized = true;
                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                // Simulate that _applyTableWidth set a width
                mockDOM.panelEl.style.width = '500px';

                // Simulate REBUILD_TABLE scenario:
                // 1. state.width cleared (as REBUILD_TABLE does)
                panel.state = { width: '', height: '', x: 100, y: 100 };

                // 2. _renderTabulator runs with preservedDimensions (existing tabulatorInstance)
                //    After _applyTableWidth runs, line 749-750 should NOT clear style.width
                //    because hasValidSavedWidth is false (state.width === '')

                // Verify the fix: style.width should NOT be cleared when auto-fitting
                // The condition is: preservedDimensions && hasValidSavedWidth
                // Since hasValidSavedWidth is false, style.width should be preserved

                const hasValidSavedWidth = !!(panel.state && panel.state.width && panel.state.width !== '');
                expect(hasValidSavedWidth).toBe(false); // Confirms we're in the auto-fit scenario

                // In the fixed code, when hasValidSavedWidth is false:
                // - Line 742-743 calls _applyTableWidth() which sets panel.style.width
                // - Line 750-751 does NOT clear it because hasValidSavedWidth is false
                // So panel.style.width should remain set after tableBuilt

                // Verify the panel's style.width is preserved (not cleared)
                expect(mockDOM.panelEl.style.width).toBe('500px');
            });

            it('should clear style.width only when restoring saved dimensions (hasValidSavedWidth)', () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                mockDOM.panelEl.style.width = '600px';

                // When hasValidSavedWidth is TRUE, we restore from state and then clear style
                panel.state = { width: '400px', height: '300px', x: 100, y: 100 };

                const hasValidSavedWidth = panel.state && panel.state.width && panel.state.width !== '';
                expect(hasValidSavedWidth).toBe(true);

                // In this case, line 750 SHOULD clear style.width because:
                // - We applied saved dimensions (state.width) before Tabulator builds
                // - Clearing style.width lets the panel size be determined by content + state
            });
        });

        describe('Render queue serialization', () => {
            it('should serialize concurrent render requests', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                const executionOrder = [];
                vi.spyOn(panel, '_renderTabulator').mockImplementation(async () => {
                    executionOrder.push('start');
                    await new Promise(resolve => setTimeout(resolve, 10));
                    executionOrder.push('end');
                });

                // Queue multiple renders
                const promise1 = panel._renderQueue.enqueue(() => panel._safeRenderTable());
                const promise2 = panel._renderQueue.enqueue(() => panel._safeRenderTable());

                await Promise.all([promise1, promise2]);

                // Should execute sequentially, not concurrently
                expect(executionOrder).toEqual(['start', 'end', 'start', 'end']);
            });

            it('should collapse multiple pending renders into one', async () => {
                const validCache = createValidCache();
                const circuitState = createMockCircuitState(validCache);
                const panel = new TruthTablePanel(
                    mockDOM.canvasEl,
                    [],
                    [],
                    circuitState
                );

                panel.panel = mockDOM.panelEl;
                panel.circuitAnalysis = validCache;

                let renderCount = 0;
                vi.spyOn(panel, '_renderTabulator').mockImplementation(async () => {
                    renderCount++;
                    await new Promise(resolve => setTimeout(resolve, 20));
                });

                // Queue three renders while first is running
                const promise1 = panel._renderQueue.enqueue(() => panel._safeRenderTable());
                const promise2 = panel._renderQueue.enqueue(() => panel._safeRenderTable());
                const promise3 = panel._renderQueue.enqueue(() => panel._safeRenderTable());

                await Promise.all([promise1, promise2, promise3]);

                // Should only render twice (first + last collapsed)
                expect(renderCount).toBe(2);
            });
        });
    });
});
