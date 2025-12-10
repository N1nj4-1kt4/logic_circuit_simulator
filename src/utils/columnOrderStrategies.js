/**
 * Column Order Strategies for Truth Table
 *
 * Centralizes column ordering logic for the Truth Table panel.
 * Supports multiple ordering strategies for future user preferences.
 */

// ============================================================================
// SECTION: Strategy Constants
// ============================================================================

/**
 * Available column ordering strategies
 */
export const COLUMN_ORDER_STRATEGIES = {
    CHRONOLOGICAL: 'chronological',           // Sort by component ID (creation order)
    ALPHABETICAL: 'alphabetical',             // Sort by label
    REVERSE_CHRONOLOGICAL: 'reverse_chronological', // Newest first
    CUSTOM: 'custom'                          // User's drag-drop order preserved
};

// ============================================================================
// SECTION: Field Name Utilities
// ============================================================================

/**
 * Create a field name for a column
 * @param {string} type - 'input' or 'output'
 * @param {number|string} id - Component ID
 * @returns {string} Field name like 'input_5' or 'output_3'
 */
export function createFieldName(type, id) {
    return `${type}_${id}`;
}

/**
 * Parse a field name to extract type and ID
 * @param {string} fieldName - Field name like 'input_5' or 'output_3'
 * @returns {{ type: string, id: number }|null} Parsed result or null if invalid
 */
export function parseFieldName(fieldName) {
    if (!fieldName || typeof fieldName !== 'string') {
        return null;
    }

    const match = fieldName.match(/^(input|output)_(\d+)$/);
    if (!match) {
        return null;
    }

    return {
        type: match[1],
        id: parseInt(match[2], 10)
    };
}

/**
 * Check if column order uses legacy index-based format (input0, output1)
 * @param {Array<string>} columnOrder - Array of field names
 * @returns {boolean} True if legacy format detected
 */
export function isLegacyColumnOrder(columnOrder) {
    if (!columnOrder || !Array.isArray(columnOrder) || columnOrder.length === 0) {
        return false;
    }
    return columnOrder.some(f => f && /^(input|output)\d+$/.test(f));
}

// ============================================================================
// SECTION: Sorting Utilities
// ============================================================================

/**
 * Sort columns by the specified strategy
 * @param {Array} columns - Array of column objects with field and component properties
 * @param {string} strategy - Ordering strategy from COLUMN_ORDER_STRATEGIES
 * @returns {Array} Sorted columns
 */
export function sortColumnsByStrategy(columns, strategy) {
    if (!columns || columns.length === 0) {
        return [];
    }

    const sorted = [...columns];

    switch (strategy) {
        case COLUMN_ORDER_STRATEGIES.ALPHABETICAL:
            sorted.sort((a, b) => {
                const labelA = a.title || '';
                const labelB = b.title || '';
                return labelA.localeCompare(labelB);
            });
            break;

        case COLUMN_ORDER_STRATEGIES.REVERSE_CHRONOLOGICAL:
            sorted.sort((a, b) => {
                const idA = a.componentId || 0;
                const idB = b.componentId || 0;
                return idB - idA; // Descending order (newest first)
            });
            break;

        case COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL:
        default:
            sorted.sort((a, b) => {
                const idA = a.componentId || 0;
                const idB = b.componentId || 0;
                return idA - idB; // Ascending order (oldest first)
            });
            break;
    }

    return sorted;
}

// ============================================================================
// SECTION: Column Merge Logic
// ============================================================================

/**
 * Merge saved column order with current columns.
 * Preserves order of existing columns, appends new columns according to strategy.
 *
 * @param {Array} currentCols - Current column definitions with field and componentId
 * @param {Array<string>|null} savedOrder - Saved field names ['input_5', 'input_3']
 * @param {string} strategy - Ordering strategy for new columns
 * @returns {Array} Ordered column definitions
 */
export function mergeColumnOrder(currentCols, savedOrder, strategy = COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL) {
    if (!currentCols || currentCols.length === 0) {
        return [];
    }

    // If no saved order or legacy format, sort all columns by strategy
    if (!savedOrder || savedOrder.length === 0 || isLegacyColumnOrder(savedOrder)) {
        return sortColumnsByStrategy(currentCols, strategy);
    }

    // Build lookup map for current columns
    const colMap = new Map(currentCols.map(col => [col.field, col]));

    const orderedCols = [];
    const usedFields = new Set();

    // First pass: add columns in saved order (if they still exist)
    for (const fieldName of savedOrder) {
        if (fieldName && colMap.has(fieldName)) {
            orderedCols.push(colMap.get(fieldName));
            usedFields.add(fieldName);
        }
    }

    // Second pass: collect new columns (not in saved order)
    const newCols = currentCols.filter(col => !usedFields.has(col.field));

    // Sort new columns by strategy and append
    const sortedNewCols = sortColumnsByStrategy(newCols, strategy);
    orderedCols.push(...sortedNewCols);

    return orderedCols;
}

/**
 * Separate columns into inputs and outputs, then merge each group
 *
 * @param {Array} inputCols - Input column definitions
 * @param {Array} outputCols - Output column definitions
 * @param {Array<string>|null} savedOrder - Saved field names for all columns
 * @param {string} strategy - Ordering strategy for new columns
 * @returns {{ orderedInputCols: Array, orderedOutputCols: Array }}
 */
export function mergeColumnOrderByGroup(inputCols, outputCols, savedOrder, strategy = COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL) {
    // Extract saved order for inputs and outputs separately
    const savedInputOrder = [];
    const savedOutputOrder = [];

    if (savedOrder && Array.isArray(savedOrder) && !isLegacyColumnOrder(savedOrder)) {
        for (const field of savedOrder) {
            if (!field) continue;
            if (field.startsWith('input_')) {
                savedInputOrder.push(field);
            } else if (field.startsWith('output_')) {
                savedOutputOrder.push(field);
            }
        }
    }

    return {
        orderedInputCols: mergeColumnOrder(inputCols, savedInputOrder, strategy),
        orderedOutputCols: mergeColumnOrder(outputCols, savedOutputOrder, strategy)
    };
}
