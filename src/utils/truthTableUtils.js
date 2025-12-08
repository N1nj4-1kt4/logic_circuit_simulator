/**
 * Utility functions for TruthTablePanel
 * Consolidated from: tableColumns.js, tableLayout.js, panelBounds.js, truthTableSearch.js
 */

// ============================================================================
// SECTION: Layout Constants
// ============================================================================

export const MIN_ROW_HEIGHT = 25;
export const MAX_ROW_HEIGHT = 36;
export const CONTENT_HEIGHT = 20;

// ============================================================================
// SECTION: Column Definitions
// ============================================================================

/**
 * Build Tabulator column definitions for truth table
 * @param {Array} inputs - Input component descriptors [{label, ...}]
 * @param {Array} outputs - Output component descriptors [{label, ...}]
 * @param {Array|null} savedColumnOrder - Saved column field order (e.g., ['input0', 'input1', 'output0'])
 * @returns {Array} Tabulator column definitions with Input/Output groups
 */
export function buildTruthTableColumns(inputs, outputs, savedColumnOrder = null) {
    // Create all column definitions
    const inputCols = inputs.map((input, i) => ({
        title: input.label || `I${i}`,
        field: `input${i}`,
        minWidth: 60,
        headerSort: false,
        formatter: (cell) => cell.getValue() ? '1' : '0',
        cssClass: 'input-cell'
    }));

    const outputCols = outputs.map((output, i) => ({
        title: output.label || `O${i}`,
        field: `output${i}`,
        minWidth: 60,
        headerSort: false,
        formatter: (cell) => {
            const value = cell.getValue();
            return `<strong>${value === '?' ? '?' : (value ? '1' : '0')}</strong>`;
        },
        cssClass: 'output-cell'
    }));

    // If we have a saved column order, reorder the columns to match
    if (savedColumnOrder && savedColumnOrder.length > 0) {
        const orderedInputCols = [];
        const orderedOutputCols = [];

        // Reorder based on saved state
        savedColumnOrder.forEach(fieldName => {
            if (!fieldName) return;

            if (fieldName.startsWith('input')) {
                const index = parseInt(fieldName.replace('input', ''));
                if (inputCols[index]) {
                    orderedInputCols.push(inputCols[index]);
                }
            } else if (fieldName.startsWith('output')) {
                const index = parseInt(fieldName.replace('output', ''));
                if (outputCols[index]) {
                    orderedOutputCols.push(outputCols[index]);
                }
            }
        });

        // Use ordered columns if we successfully reordered them
        if (orderedInputCols.length === inputCols.length && orderedOutputCols.length === outputCols.length) {
            return [
                {
                    title: 'Inputs',
                    columns: orderedInputCols
                },
                {
                    title: 'Outputs',
                    columns: orderedOutputCols
                }
            ];
        }
    }

    // Default: return columns in original order
    return [
        {
            title: 'Inputs',
            columns: inputCols
        },
        {
            title: 'Outputs',
            columns: outputCols
        }
    ];
}

// ============================================================================
// SECTION: Table Layout
// ============================================================================

/**
 * Calculate optimal row height for truth table
 * @param {number} rowCount - Number of data rows
 * @param {number} availableHeight - Available height in pixels for rows (excluding header)
 * @param {Object} options - Options object
 * @param {boolean} options.fitPanel - If true, use max row height for optimal display
 * @returns {Object} { rowHeight, totalHeight, verticalPadding }
 */
export function calculateRowLayout(rowCount, availableHeight, { fitPanel = false } = {}) {
    let rowHeight = MAX_ROW_HEIGHT;

    if (rowCount > 0) {
        if (fitPanel) {
            // When fitting panel to content, use max row height for optimal display
            rowHeight = MAX_ROW_HEIGHT;
        } else if (availableHeight > 0) {
            // When constrained to available space, calculate best fit
            const calculatedHeight = Math.floor(availableHeight / rowCount);
            rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, calculatedHeight));
        }
    }

    const verticalPadding = Math.max(0, (rowHeight - CONTENT_HEIGHT) / 2);
    const totalHeight = rowCount * rowHeight;

    return { rowHeight, totalHeight, verticalPadding };
}

/**
 * Calculate total table height including header
 * @param {number} rowCount - Number of data rows
 * @param {number} headerHeight - Height of table header in pixels
 * @param {number} availableHeight - Available height for the entire table (header + rows)
 * @param {Object} options - Options object
 * @param {boolean} options.fitPanel - If true, expand to fit content
 * @returns {Object} { rowHeight, rowAreaHeight, totalHeight, verticalPadding }
 */
export function calculateTableLayout(rowCount, headerHeight, availableHeight, { fitPanel = false } = {}) {
    // Calculate available height for rows
    const rowAreaHeight = availableHeight - headerHeight;

    // Get row layout
    const { rowHeight, totalHeight: neededRowHeight, verticalPadding } = calculateRowLayout(
        rowCount,
        rowAreaHeight,
        { fitPanel }
    );

    // Calculate actual row area height
    const actualRowAreaHeight = fitPanel ? neededRowHeight : Math.min(rowAreaHeight, neededRowHeight);

    // Calculate total height (header + rows)
    const totalHeight = headerHeight + actualRowAreaHeight;

    return {
        rowHeight,
        rowAreaHeight: actualRowAreaHeight,
        totalHeight,
        verticalPadding
    };
}

// ============================================================================
// SECTION: Panel Bounds
// ============================================================================

/**
 * Clamp panel position to keep it visible within viewport
 * @param {number} x - Desired X position
 * @param {number} y - Desired Y position
 * @param {number} panelWidth - Panel width in pixels
 * @param {number} panelHeight - Panel height in pixels
 * @param {number} viewportWidth - Viewport width
 * @param {number} viewportHeight - Viewport height
 * @param {number} maxOffscreenPercent - Max % of panel allowed offscreen (default 0.8)
 * @returns {Object} { x, y } - Clamped position
 */
export function clampPanelPosition(
    x,
    y,
    panelWidth,
    panelHeight,
    viewportWidth,
    viewportHeight,
    maxOffscreenPercent = 0.8
) {
    const maxOffscreenX = panelWidth * maxOffscreenPercent;
    const maxOffscreenY = panelHeight * maxOffscreenPercent;

    const minX = -maxOffscreenX;
    const maxX = viewportWidth - (panelWidth - maxOffscreenX);
    const minY = -maxOffscreenY;
    const maxY = viewportHeight - (panelHeight - maxOffscreenY);

    return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y))
    };
}

/**
 * Clamp dimension to viewport percentage
 * @param {number} value - Dimension value in pixels
 * @param {number} viewportSize - Viewport dimension (width or height)
 * @param {number} maxPercent - Maximum percentage of viewport (default 0.9)
 * @returns {number} Clamped dimension
 */
export function clampDimension(value, viewportSize, maxPercent = 0.9) {
    const max = viewportSize * maxPercent;
    if (value <= 0) {
        return max; // Invalid value, return max
    }
    return Math.min(value, max);
}

/**
 * Validate and sanitize panel state position values
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} minValid - Minimum valid position (default -500)
 * @returns {Object} { x, y } - Sanitized position
 */
export function sanitizePosition(x, y, minValid = -500) {
    return {
        x: (x !== undefined && x >= minValid) ? x : 0,
        y: (y !== undefined && y >= minValid) ? y : 0
    };
}

// ============================================================================
// SECTION: Row Search
// ============================================================================

/**
 * Convert input values array to binary index
 * Useful for direct row lookup in standard truth tables
 * @param {Array} inputValues - Array of input values [0, 1, 0, ...]
 * @returns {number} Binary index (e.g., [0, 1, 0] -> 2)
 */
export function inputValuesToIndex(inputValues) {
    if (!inputValues || inputValues.length === 0) {
        return 0;
    }

    let index = 0;
    for (let i = 0; i < inputValues.length; i++) {
        if (inputValues[i]) {
            index |= (1 << (inputValues.length - 1 - i));
        }
    }
    return index;
}

/**
 * Convert binary index to input values array
 * Inverse of inputValuesToIndex
 * @param {number} index - Binary index
 * @param {number} inputCount - Number of inputs
 * @returns {Array} Array of input values [0, 1, 0, ...]
 */
export function indexToInputValues(index, inputCount) {
    if (inputCount <= 0) {
        return [];
    }

    const values = [];
    for (let i = inputCount - 1; i >= 0; i--) {
        values.push((index >> i) & 1);
    }
    return values;
}
