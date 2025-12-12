/**
 * Pre-condition setup helpers for TruthTablePanel invariant tests
 *
 * INVARIANT TESTS - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
 *
 * These helpers establish known state before each test
 * so we can verify that state is preserved after actions.
 */

import { vi } from 'vitest';
import { TruthTablePanel } from '../../../src/ui/TruthTablePanel.js';
import { createMockDOM, createMockCircuitState, createMockWindow, createMockTabulator, createMockRows } from './mocks.js';
import { createCircuit, generateDefaultColumnOrder, cloneAnalysis } from '../fixtures/circuits.js';

// Known values for pre-conditions
export const KNOWN_POSITION = { x: 150, y: 200 };
export const KNOWN_SIZE = { width: '500px', height: '400px' };
export const KNOWN_ROW_HEIGHT = 28;

/**
 * Setup a panel with known position
 * @param {TruthTablePanel} panel - Panel instance
 * @param {Object} mockDOM - Mock DOM elements
 * @param {Object} position - Position to set
 */
export function setupWithPosition(panel, mockDOM, position = KNOWN_POSITION) {
    if (!panel.state) {
        panel.state = {};
    }
    panel.state.x = position.x;
    panel.state.y = position.y;

    if (mockDOM && mockDOM.panelEl) {
        mockDOM.panelEl.style.transform = `translate(${position.x}px, ${position.y}px)`;
        // Also set data-x/data-y attributes that the panel reads via getAttribute
        mockDOM.panelEl._dataX = position.x;
        mockDOM.panelEl._dataY = position.y;
        mockDOM.panelEl.getAttribute = vi.fn((attr) => {
            if (attr === 'data-x') return String(position.x);
            if (attr === 'data-y') return String(position.y);
            return '0';
        });
    }
}

/**
 * Setup a panel with known size
 * @param {TruthTablePanel} panel - Panel instance
 * @param {Object} mockDOM - Mock DOM elements
 * @param {Object} size - Size to set
 */
export function setupWithSize(panel, mockDOM, size = KNOWN_SIZE) {
    if (!panel.state) {
        panel.state = {};
    }
    panel.state.width = size.width;
    panel.state.height = size.height;

    if (mockDOM && mockDOM.panelEl) {
        mockDOM.panelEl.style.width = size.width;
        mockDOM.panelEl.style.height = size.height;
        mockDOM.panelEl.offsetWidth = parseInt(size.width);
        mockDOM.panelEl.offsetHeight = parseInt(size.height);
    }
}

/**
 * Setup a panel with known column order
 * @param {TruthTablePanel} panel - Panel instance
 * @param {Array} order - Column order array
 */
export function setupWithColumnOrder(panel, order) {
    panel.columnOrder = [...order];
    if (!panel.state) {
        panel.state = {};
    }
    panel.state.columnOrder = [...order];

    // Also set the global mock Tabulator columns so _saveState() reads them correctly
    globalThis.__mockTabulatorColumns = [...order];
}

/**
 * Setup a panel with known row height
 * @param {TruthTablePanel} panel - Panel instance
 * @param {Object} mockTabulator - Mock Tabulator instance
 * @param {number} height - Row height in pixels
 */
export function setupWithRowHeight(panel, mockTabulator, height = KNOWN_ROW_HEIGHT) {
    if (!panel.state) {
        panel.state = {};
    }
    panel.state.rowHeight = height;

    // Setup mock rows with the height
    if (mockTabulator) {
        const mockRows = createMockRows(4, height);
        mockTabulator._setMockRows(mockRows);
    }
}

/**
 * Setup all known pre-conditions at once
 * @param {TruthTablePanel} panel - Panel instance
 * @param {Object} mockDOM - Mock DOM elements
 * @param {Object} mockTabulator - Mock Tabulator instance
 * @param {Object} analysis - Circuit analysis
 */
export function setupAllPreConditions(panel, mockDOM, mockTabulator, analysis) {
    setupWithPosition(panel, mockDOM, KNOWN_POSITION);
    setupWithSize(panel, mockDOM, KNOWN_SIZE);

    if (analysis && analysis.isValid) {
        const columnOrder = generateDefaultColumnOrder(analysis);
        setupWithColumnOrder(panel, columnOrder);
        setupWithRowHeight(panel, mockTabulator, KNOWN_ROW_HEIGHT);
    }
}

/**
 * Create a complete test setup for a given circuit type
 * @param {string} circuitType - Circuit type key
 * @param {Object} options - Setup options
 * @returns {Object} Test setup with panel, mocks, and analysis
 */
export function createTestSetup(circuitType, options = {}) {
    const mockDOM = createMockDOM();
    const mockWindow = createMockWindow();
    const analysis = createCircuit(circuitType);
    const circuitState = createMockCircuitState(analysis);

    // Stub globals
    vi.stubGlobal('document', mockDOM.mockDocument);
    vi.stubGlobal('window', mockWindow);
    // Also stub getComputedStyle globally since jsdom's version won't work with mock elements
    vi.stubGlobal('getComputedStyle', mockWindow.getComputedStyle);

    // Create panel
    const panel = new TruthTablePanel(
        mockDOM.canvasEl,
        [], // components
        [], // connections
        circuitState
    );

    // Initialize panel
    panel.init(options.savedState || {});

    // Create mock Tabulator for table operations
    const mockTabulator = createMockTabulator();

    // Setup state change callback
    const onStateChange = vi.fn();
    panel.onStateChange = onStateChange;

    return {
        panel,
        mockDOM,
        mockWindow,
        mockTabulator,
        circuitState,
        analysis: cloneAnalysis(analysis), // Return a clone so tests can modify it
        onStateChange,
        // Helper to recreate panel (for refresh simulation)
        recreatePanel: (savedState) => {
            const newPanel = new TruthTablePanel(
                mockDOM.canvasEl,
                [],
                [],
                circuitState
            );
            newPanel.init(savedState);
            newPanel.onStateChange = onStateChange;
            return newPanel;
        },
        // Cleanup function
        cleanup: () => {
            vi.unstubAllGlobals();
        }
    };
}

/**
 * Get a column order that's different from default (for testing reorder)
 * @param {Object} analysis - Circuit analysis
 * @returns {Array} Reordered column array
 */
export function getReorderedColumnOrder(analysis) {
    const defaultOrder = generateDefaultColumnOrder(analysis);
    if (defaultOrder.length < 2) return defaultOrder;

    // Swap first two columns
    const reordered = [...defaultOrder];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    return reordered;
}
