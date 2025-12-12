/**
 * Mock factories for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 */

import { vi } from 'vitest';

/**
 * Create mock Tabulator instance
 */
export function createMockTabulator() {
    const rows = [];
    return {
        destroy: vi.fn(),
        on: vi.fn(),
        getColumns: vi.fn().mockReturnValue([]),
        getRows: vi.fn().mockReturnValue(rows),
        getData: vi.fn().mockReturnValue([]),
        deselectRow: vi.fn(),
        selectRow: vi.fn(),
        replaceData: vi.fn(),
        setHeight: vi.fn(),
        setData: vi.fn(),
        setColumns: vi.fn(),
        scrollToRow: vi.fn(),
        redraw: vi.fn(),
        _rows: rows,
        // Allow setting mock rows for row height tests
        _setMockRows: function(mockRows) {
            this._rows = mockRows;
            this.getRows.mockReturnValue(mockRows);
        }
    };
}

/**
 * Create mock interact.js
 */
export function createMockInteract() {
    const mockInteractInstance = {
        draggable: vi.fn().mockReturnThis(),
        resizable: vi.fn().mockReturnThis(),
        unset: vi.fn()
    };

    const mockInteract = vi.fn().mockReturnValue(mockInteractInstance);
    mockInteract.modifiers = {
        restrictRect: vi.fn().mockReturnValue({}),
        restrictSize: vi.fn().mockReturnValue({})
    };

    return { mockInteract, mockInteractInstance };
}

/**
 * Create mock DOM elements
 */
export function createMockDOM() {
    const panelEl = {
        classList: {
            classes: new Set(['hidden']),
            add: vi.fn(function(cls) { this.classes.add(cls); }),
            remove: vi.fn(function(cls) { this.classes.delete(cls); }),
            contains: vi.fn(function(cls) { return this.classes.has(cls); })
        },
        style: {
            display: 'none',
            width: '',
            height: '',
            transform: '',
            opacity: '0',
            pointerEvents: 'none'
        },
        getAttribute: vi.fn().mockReturnValue('0'),
        setAttribute: vi.fn(),
        appendChild: vi.fn(),
        querySelector: vi.fn((selector) => {
            if (selector === '.truth-table-progress') {
                return {
                    style: { display: '' },
                    querySelector: vi.fn().mockReturnValue({
                        style: { width: '0%' }
                    }),
                    classList: { add: vi.fn(), remove: vi.fn() },
                    remove: vi.fn()  // DOM element remove() method
                };
            }
            if (selector === '.truth-table-rendering') {
                return null;
            }
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
        innerHTML: '',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([])
    };

    const closeBtn = {
        addEventListener: vi.fn()
    };

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
            if (tag === 'div') {
                return {
                    className: '',
                    innerHTML: '',
                    style: {},
                    appendChild: vi.fn(),
                    remove: vi.fn()
                };
            }
            return {};
        }),
        body: {
            classList: {
                contains: vi.fn().mockReturnValue(false)
            }
        }
    };

    return { panelEl, contentEl, closeBtn, canvasEl, mockDocument };
}

/**
 * Create mock CircuitState
 */
export function createMockCircuitState(analysis = null) {
    const components = [];
    if (analysis && analysis.inputs) {
        analysis.inputs.forEach(input => {
            components.push({ id: input.id, type: 'INPUT', label: input.label, value: input.value });
        });
    }
    if (analysis && analysis.outputs) {
        analysis.outputs.forEach(output => {
            components.push({ id: output.id, type: 'OUTPUT', label: output.label, value: output.value });
        });
    }

    return {
        getCircuitAnalysis: vi.fn().mockReturnValue(analysis),
        getComponents: vi.fn().mockReturnValue(components),
        _analysis: analysis,
        _setAnalysis: function(newAnalysis) {
            this._analysis = newAnalysis;
            this.getCircuitAnalysis.mockReturnValue(newAnalysis);

            // Update components
            const newComponents = [];
            if (newAnalysis && newAnalysis.inputs) {
                newAnalysis.inputs.forEach(input => {
                    newComponents.push({ id: input.id, type: 'INPUT', label: input.label, value: input.value });
                });
            }
            if (newAnalysis && newAnalysis.outputs) {
                newAnalysis.outputs.forEach(output => {
                    newComponents.push({ id: output.id, type: 'OUTPUT', label: output.label, value: output.value });
                });
            }
            this.getComponents.mockReturnValue(newComponents);
        }
    };
}

/**
 * Create mock window object
 */
export function createMockWindow() {
    return {
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
        }),
        requestAnimationFrame: vi.fn((cb) => {
            cb();
            return 1;
        }),
        cancelAnimationFrame: vi.fn()
    };
}

/**
 * Create mock rows with height for row height tests
 */
export function createMockRows(count, height) {
    return Array.from({ length: count }, (_, i) => ({
        getElement: vi.fn().mockReturnValue({
            style: { height: `${height}px` },
            querySelector: vi.fn().mockReturnValue({
                style: {}
            })
        }),
        getIndex: vi.fn().mockReturnValue(i),
        getData: vi.fn().mockReturnValue({})
    }));
}
