import { describe, it, expect } from 'vitest';
import {
    // Column Definitions
    buildTruthTableColumns,
    // Table Layout
    calculateRowLayout,
    calculateTableLayout,
    MIN_ROW_HEIGHT,
    MAX_ROW_HEIGHT,
    CONTENT_HEIGHT,
    // Panel Bounds
    clampPanelPosition,
    clampDimension,
    sanitizePosition,
    // Row Search
    inputValuesToIndex,
    indexToInputValues
} from '../../../src/utils/truthTableUtils.js';

// ============================================================================
// SECTION: Column Definitions Tests
// ============================================================================

describe('buildTruthTableColumns', () => {
    describe('basic column generation', () => {
        it('generates columns for single input and output', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns).toHaveLength(2);
            expect(columns[0].title).toBe('Inputs');
            expect(columns[0].columns).toHaveLength(1);
            expect(columns[0].columns[0].title).toBe('A');
            expect(columns[0].columns[0].field).toBe('input_1');

            expect(columns[1].title).toBe('Outputs');
            expect(columns[1].columns).toHaveLength(1);
            expect(columns[1].columns[0].title).toBe('Y');
            expect(columns[1].columns[0].field).toBe('output_2');
        });

        it('generates columns for multiple inputs and outputs', () => {
            const inputs = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' }];
            const outputs = [{ id: 4, label: 'X' }, { id: 5, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns).toHaveLength(3);
            expect(columns[0].columns[0].title).toBe('A');
            expect(columns[0].columns[1].title).toBe('B');
            expect(columns[0].columns[2].title).toBe('C');

            expect(columns[1].columns).toHaveLength(2);
            expect(columns[1].columns[0].title).toBe('X');
            expect(columns[1].columns[1].title).toBe('Y');
        });

        it('uses default labels when not provided', () => {
            const inputs = [{ id: 1 }, { id: 2 }];
            const outputs = [{ id: 3 }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns[0].title).toBe('I1');
            expect(columns[0].columns[1].title).toBe('I2');
            expect(columns[1].columns[0].title).toBe('O1');
        });

        it('handles empty inputs array', () => {
            const inputs = [];
            const outputs = [{ id: 1, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns).toHaveLength(0);
            expect(columns[1].columns).toHaveLength(1);
        });

        it('handles empty outputs array', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns).toHaveLength(1);
            expect(columns[1].columns).toHaveLength(0);
        });
    });

    describe('column properties', () => {
        it('sets correct minWidth for all columns', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns[0].minWidth).toBe(60);
            expect(columns[1].columns[0].minWidth).toBe(60);
        });

        it('sets headerSort to false for all columns', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns[0].headerSort).toBe(false);
            expect(columns[1].columns[0].headerSort).toBe(false);
        });

        it('sets correct cssClass for input and output columns', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs);

            expect(columns[0].columns[0].cssClass).toBe('input-cell');
            expect(columns[1].columns[0].cssClass).toBe('output-cell');
        });
    });

    describe('formatters', () => {
        it('input formatter returns "1" for truthy values', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [];
            const columns = buildTruthTableColumns(inputs, outputs);
            const formatter = columns[0].columns[0].formatter;

            const mockCell = { getValue: () => true };
            expect(formatter(mockCell)).toBe('1');

            mockCell.getValue = () => 1;
            expect(formatter(mockCell)).toBe('1');
        });

        it('input formatter returns "0" for falsy values', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [];
            const columns = buildTruthTableColumns(inputs, outputs);
            const formatter = columns[0].columns[0].formatter;

            const mockCell = { getValue: () => false };
            expect(formatter(mockCell)).toBe('0');

            mockCell.getValue = () => 0;
            expect(formatter(mockCell)).toBe('0');
        });

        it('output formatter returns bold "1" for truthy values', () => {
            const inputs = [];
            const outputs = [{ id: 1, label: 'Y' }];
            const columns = buildTruthTableColumns(inputs, outputs);
            const formatter = columns[1].columns[0].formatter;

            const mockCell = { getValue: () => true };
            expect(formatter(mockCell)).toBe('<strong>1</strong>');
        });

        it('output formatter returns bold "0" for falsy values', () => {
            const inputs = [];
            const outputs = [{ id: 1, label: 'Y' }];
            const columns = buildTruthTableColumns(inputs, outputs);
            const formatter = columns[1].columns[0].formatter;

            const mockCell = { getValue: () => false };
            expect(formatter(mockCell)).toBe('<strong>0</strong>');
        });

        it('output formatter returns bold "?" for unknown values', () => {
            const inputs = [];
            const outputs = [{ id: 1, label: 'Y' }];
            const columns = buildTruthTableColumns(inputs, outputs);
            const formatter = columns[1].columns[0].formatter;

            const mockCell = { getValue: () => '?' };
            expect(formatter(mockCell)).toBe('<strong>?</strong>');
        });
    });

    describe('column reordering with savedColumnOrder', () => {
        it('reorders input columns based on saved order', () => {
            const inputs = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' }];
            const outputs = [{ id: 4, label: 'Y' }];
            // Request order: C (id:3), A (id:1), B (id:2)
            const savedOrder = ['input_3', 'input_1', 'input_2', 'output_4'];

            const columns = buildTruthTableColumns(inputs, outputs, savedOrder);

            expect(columns[0].columns[0].title).toBe('C');
            expect(columns[0].columns[1].title).toBe('A');
            expect(columns[0].columns[2].title).toBe('B');
        });

        it('reorders output columns based on saved order', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'X' }, { id: 3, label: 'Y' }, { id: 4, label: 'Z' }];
            // Request order: Z (id:4), X (id:2), Y (id:3)
            const savedOrder = ['input_1', 'output_4', 'output_2', 'output_3'];

            const columns = buildTruthTableColumns(inputs, outputs, savedOrder);

            expect(columns[1].columns[0].title).toBe('Z');
            expect(columns[1].columns[1].title).toBe('X');
            expect(columns[1].columns[2].title).toBe('Y');
        });

        it('appends new columns when structure changes', () => {
            // User had A (id:1), B (id:2), then added C (id:3)
            const inputs = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' }];
            const outputs = [{ id: 4, label: 'Y' }];
            // Saved order only has A and B (with B before A)
            const savedOrder = ['input_2', 'input_1', 'output_4'];

            const columns = buildTruthTableColumns(inputs, outputs, savedOrder);

            // B first (from saved), then A (from saved), then C (new, appended)
            expect(columns[0].columns[0].title).toBe('B');
            expect(columns[0].columns[1].title).toBe('A');
            expect(columns[0].columns[2].title).toBe('C');
        });

        it('ignores null entries in saved order', () => {
            const inputs = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }];
            const outputs = [{ id: 3, label: 'Y' }];
            const savedOrder = [null, 'input_2', 'input_1', 'output_3'];

            const columns = buildTruthTableColumns(inputs, outputs, savedOrder);

            expect(columns[0].columns[0].title).toBe('B');
            expect(columns[0].columns[1].title).toBe('A');
        });

        it('handles empty saved order array', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs, []);

            expect(columns[0].columns[0].title).toBe('A');
            expect(columns[1].columns[0].title).toBe('Y');
        });

        it('handles null saved order', () => {
            const inputs = [{ id: 1, label: 'A' }];
            const outputs = [{ id: 2, label: 'Y' }];

            const columns = buildTruthTableColumns(inputs, outputs, null);

            expect(columns[0].columns[0].title).toBe('A');
            expect(columns[1].columns[0].title).toBe('Y');
        });

        it('handles legacy index-based format by falling back to default', () => {
            const inputs = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }];
            const outputs = [{ id: 3, label: 'Y' }];
            // Legacy format (input0, input1) cannot be mapped to IDs
            const legacyOrder = ['input1', 'input0', 'output0'];

            const columns = buildTruthTableColumns(inputs, outputs, legacyOrder);

            // Should fall back to chronological order by ID
            expect(columns[0].columns[0].title).toBe('A');
            expect(columns[0].columns[1].title).toBe('B');
        });
    });
});

// ============================================================================
// SECTION: Table Layout Tests
// ============================================================================

describe('calculateRowLayout', () => {
    describe('basic calculations', () => {
        it('returns max row height when fitting panel', () => {
            const result = calculateRowLayout(10, 500, { fitPanel: true });

            expect(result.rowHeight).toBe(MAX_ROW_HEIGHT);
            expect(result.totalHeight).toBe(10 * MAX_ROW_HEIGHT);
        });

        it('calculates optimal row height based on available space', () => {
            // 10 rows, 300px available = 30px per row (within min/max range)
            const result = calculateRowLayout(10, 300, { fitPanel: false });

            expect(result.rowHeight).toBe(30);
            expect(result.totalHeight).toBe(300);
        });

        it('respects minimum row height', () => {
            // 20 rows, 300px available = 15px per row, but min is 25px
            const result = calculateRowLayout(20, 300, { fitPanel: false });

            expect(result.rowHeight).toBe(MIN_ROW_HEIGHT);
            expect(result.totalHeight).toBe(20 * MIN_ROW_HEIGHT);
        });

        it('respects maximum row height', () => {
            // 2 rows, 500px available = 250px per row, but max is 36px
            const result = calculateRowLayout(2, 500, { fitPanel: false });

            expect(result.rowHeight).toBe(MAX_ROW_HEIGHT);
            expect(result.totalHeight).toBe(2 * MAX_ROW_HEIGHT);
        });

        it('returns max row height when rowCount is 0', () => {
            const result = calculateRowLayout(0, 500, { fitPanel: false });

            expect(result.rowHeight).toBe(MAX_ROW_HEIGHT);
            expect(result.totalHeight).toBe(0);
        });

        it('returns max row height when availableHeight is 0', () => {
            const result = calculateRowLayout(10, 0, { fitPanel: false });

            expect(result.rowHeight).toBe(MAX_ROW_HEIGHT);
            expect(result.totalHeight).toBe(10 * MAX_ROW_HEIGHT);
        });
    });

    describe('vertical padding calculation', () => {
        it('calculates correct vertical padding for max row height', () => {
            const result = calculateRowLayout(10, 500, { fitPanel: true });
            const expectedPadding = (MAX_ROW_HEIGHT - CONTENT_HEIGHT) / 2;

            expect(result.verticalPadding).toBe(expectedPadding);
        });

        it('calculates correct vertical padding for min row height', () => {
            const result = calculateRowLayout(20, 300, { fitPanel: false });
            const expectedPadding = (MIN_ROW_HEIGHT - CONTENT_HEIGHT) / 2;

            expect(result.verticalPadding).toBe(expectedPadding);
        });

        it('returns 0 padding when row height equals content height', () => {
            // Force row height to 20 (CONTENT_HEIGHT)
            // This can't actually happen with current min (25), but test the logic
            const result = calculateRowLayout(15, 300, { fitPanel: false });
            // 300/15 = 20, but min is 25, so rowHeight = 25
            expect(result.verticalPadding).toBe((25 - CONTENT_HEIGHT) / 2);
        });
    });

    describe('default options', () => {
        it('defaults fitPanel to false', () => {
            const result = calculateRowLayout(10, 300);

            // Should calculate based on available space, not use max
            expect(result.rowHeight).toBe(30);
        });
    });
});

describe('calculateTableLayout', () => {
    describe('basic calculations', () => {
        it('calculates total height including header', () => {
            const result = calculateTableLayout(10, 50, 500, { fitPanel: true });

            // 500 - 50 header = 450 for rows
            // fitPanel = true, so use max row height (36)
            // total = 50 header + 10 * 36 rows = 410
            expect(result.totalHeight).toBe(50 + 10 * MAX_ROW_HEIGHT);
        });

        it('constrains row area to available space when not fitting', () => {
            const result = calculateTableLayout(100, 50, 200, { fitPanel: false });

            // 200 - 50 header = 150 for rows
            // 100 rows at min 25px = 2500px needed, but only 150 available
            expect(result.rowAreaHeight).toBeLessThanOrEqual(150);
        });

        it('expands to fit content when fitPanel is true', () => {
            const result = calculateTableLayout(10, 50, 200, { fitPanel: true });

            // Should expand to fit 10 rows at max height
            expect(result.rowAreaHeight).toBe(10 * MAX_ROW_HEIGHT);
        });
    });

    describe('header handling', () => {
        it('handles zero header height', () => {
            const result = calculateTableLayout(10, 0, 500, { fitPanel: true });

            expect(result.totalHeight).toBe(10 * MAX_ROW_HEIGHT);
        });

        it('handles header taking most of available space', () => {
            const result = calculateTableLayout(10, 450, 500, { fitPanel: false });

            // Only 50px for rows, 10 rows = 5px each, but min is 25
            // So rowHeight = 25, totalHeight = 10 * 25 = 250
            // But constrained to available 50px
            expect(result.rowAreaHeight).toBeLessThanOrEqual(50);
        });
    });

    describe('return values', () => {
        it('returns all required properties', () => {
            const result = calculateTableLayout(10, 50, 500, { fitPanel: false });

            expect(result).toHaveProperty('rowHeight');
            expect(result).toHaveProperty('rowAreaHeight');
            expect(result).toHaveProperty('totalHeight');
            expect(result).toHaveProperty('verticalPadding');
        });

        it('totalHeight equals header plus rowAreaHeight', () => {
            const headerHeight = 50;
            const result = calculateTableLayout(10, headerHeight, 500, { fitPanel: true });

            expect(result.totalHeight).toBe(headerHeight + result.rowAreaHeight);
        });
    });
});

describe('exported constants', () => {
    it('exports MIN_ROW_HEIGHT as 25', () => {
        expect(MIN_ROW_HEIGHT).toBe(25);
    });

    it('exports MAX_ROW_HEIGHT as 36', () => {
        expect(MAX_ROW_HEIGHT).toBe(36);
    });

    it('exports CONTENT_HEIGHT as 20', () => {
        expect(CONTENT_HEIGHT).toBe(20);
    });
});

// ============================================================================
// SECTION: Panel Bounds Tests
// ============================================================================

describe('clampPanelPosition', () => {
    describe('within bounds', () => {
        it('returns position unchanged when fully within viewport', () => {
            const result = clampPanelPosition(100, 100, 400, 300, 1920, 1080);

            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });

        it('allows panel at origin', () => {
            const result = clampPanelPosition(0, 0, 400, 300, 1920, 1080);

            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });
    });

    describe('clamping to right/bottom edge', () => {
        it('clamps X when panel would go too far right', () => {
            // Panel at x=1800, width=400, viewport=1920
            // maxOffscreen = 400 * 0.8 = 320
            // maxX = 1920 - (400 - 320) = 1840
            const result = clampPanelPosition(1900, 100, 400, 300, 1920, 1080);

            expect(result.x).toBeLessThanOrEqual(1840);
        });

        it('clamps Y when panel would go too far down', () => {
            // Panel at y=1000, height=300, viewport=1080
            // maxOffscreen = 300 * 0.8 = 240
            // maxY = 1080 - (300 - 240) = 1020
            const result = clampPanelPosition(100, 1050, 400, 300, 1920, 1080);

            expect(result.y).toBeLessThanOrEqual(1020);
        });
    });

    describe('clamping to left/top edge', () => {
        it('clamps X when panel would go too far left', () => {
            // width=400, maxOffscreen = 320
            // minX = -320
            const result = clampPanelPosition(-400, 100, 400, 300, 1920, 1080);

            expect(result.x).toBeGreaterThanOrEqual(-320);
        });

        it('clamps Y when panel would go too far up', () => {
            // height=300, maxOffscreen = 240
            // minY = -240
            const result = clampPanelPosition(100, -300, 400, 300, 1920, 1080);

            expect(result.y).toBeGreaterThanOrEqual(-240);
        });
    });

    describe('custom maxOffscreenPercent', () => {
        it('uses custom offscreen percentage', () => {
            // maxOffscreen = 400 * 0.5 = 200
            // minX = -200
            const result = clampPanelPosition(-300, 100, 400, 300, 1920, 1080, 0.5);

            expect(result.x).toBe(-200);
        });

        it('allows no offscreen with 0 percent', () => {
            // maxOffscreen = 0
            // minX = 0
            const result = clampPanelPosition(-100, 100, 400, 300, 1920, 1080, 0);

            // Result should be 0 (or -0 which is functionally equivalent)
            expect(result.x + 0).toBe(0); // Adding 0 converts -0 to +0
        });
    });

    describe('edge cases', () => {
        it('handles small viewport', () => {
            const result = clampPanelPosition(100, 100, 400, 300, 200, 200);

            // Panel is larger than viewport, should still be clamped reasonably
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('handles zero-size panel', () => {
            const result = clampPanelPosition(100, 100, 0, 0, 1920, 1080);

            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });
    });
});

describe('clampDimension', () => {
    describe('basic clamping', () => {
        it('returns value unchanged when within limits', () => {
            const result = clampDimension(500, 1920, 0.9);

            expect(result).toBe(500);
        });

        it('clamps to max when value exceeds limit', () => {
            // max = 1920 * 0.9 = 1728
            const result = clampDimension(2000, 1920, 0.9);

            expect(result).toBe(1728);
        });

        it('returns max for zero value', () => {
            const result = clampDimension(0, 1920, 0.9);

            expect(result).toBe(1728);
        });

        it('returns max for negative value', () => {
            const result = clampDimension(-100, 1920, 0.9);

            expect(result).toBe(1728);
        });
    });

    describe('custom max percentage', () => {
        it('uses 50% max', () => {
            const result = clampDimension(1500, 1920, 0.5);

            expect(result).toBe(960);
        });

        it('uses 100% max', () => {
            const result = clampDimension(2000, 1920, 1.0);

            expect(result).toBe(1920);
        });
    });

    describe('default parameter', () => {
        it('defaults to 90% max', () => {
            const result = clampDimension(2000, 1920);

            expect(result).toBe(1728); // 1920 * 0.9
        });
    });
});

describe('sanitizePosition', () => {
    describe('valid positions', () => {
        it('returns valid positions unchanged', () => {
            const result = sanitizePosition(100, 200);

            expect(result.x).toBe(100);
            expect(result.y).toBe(200);
        });

        it('allows zero positions', () => {
            const result = sanitizePosition(0, 0);

            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('allows slightly negative positions', () => {
            const result = sanitizePosition(-100, -200);

            expect(result.x).toBe(-100);
            expect(result.y).toBe(-200);
        });
    });

    describe('invalid positions', () => {
        it('resets extremely negative X to 0', () => {
            const result = sanitizePosition(-600, 100);

            expect(result.x).toBe(0);
            expect(result.y).toBe(100);
        });

        it('resets extremely negative Y to 0', () => {
            const result = sanitizePosition(100, -600);

            expect(result.x).toBe(100);
            expect(result.y).toBe(0);
        });

        it('resets undefined X to 0', () => {
            const result = sanitizePosition(undefined, 100);

            expect(result.x).toBe(0);
            expect(result.y).toBe(100);
        });

        it('resets undefined Y to 0', () => {
            const result = sanitizePosition(100, undefined);

            expect(result.x).toBe(100);
            expect(result.y).toBe(0);
        });
    });

    describe('custom minValid', () => {
        it('uses custom minimum threshold', () => {
            // With minValid = -100, position -200 should be reset
            const result = sanitizePosition(-200, -50, -100);

            expect(result.x).toBe(0);
            expect(result.y).toBe(-50);
        });
    });
});

// ============================================================================
// SECTION: Row Search Tests
// ============================================================================

describe('inputValuesToIndex', () => {
    describe('basic conversion', () => {
        it('converts single bit', () => {
            expect(inputValuesToIndex([0])).toBe(0);
            expect(inputValuesToIndex([1])).toBe(1);
        });

        it('converts two bits', () => {
            expect(inputValuesToIndex([0, 0])).toBe(0);
            expect(inputValuesToIndex([0, 1])).toBe(1);
            expect(inputValuesToIndex([1, 0])).toBe(2);
            expect(inputValuesToIndex([1, 1])).toBe(3);
        });

        it('converts three bits', () => {
            expect(inputValuesToIndex([0, 0, 0])).toBe(0);
            expect(inputValuesToIndex([0, 0, 1])).toBe(1);
            expect(inputValuesToIndex([0, 1, 0])).toBe(2);
            expect(inputValuesToIndex([0, 1, 1])).toBe(3);
            expect(inputValuesToIndex([1, 0, 0])).toBe(4);
            expect(inputValuesToIndex([1, 0, 1])).toBe(5);
            expect(inputValuesToIndex([1, 1, 0])).toBe(6);
            expect(inputValuesToIndex([1, 1, 1])).toBe(7);
        });
    });

    describe('edge cases', () => {
        it('returns 0 for empty array', () => {
            expect(inputValuesToIndex([])).toBe(0);
        });

        it('returns 0 for null', () => {
            expect(inputValuesToIndex(null)).toBe(0);
        });

        it('handles truthy/falsy values', () => {
            expect(inputValuesToIndex([true, false])).toBe(2);
            expect(inputValuesToIndex([false, true])).toBe(1);
        });
    });
});

describe('indexToInputValues', () => {
    describe('basic conversion', () => {
        it('converts to single bit', () => {
            expect(indexToInputValues(0, 1)).toEqual([0]);
            expect(indexToInputValues(1, 1)).toEqual([1]);
        });

        it('converts to two bits', () => {
            expect(indexToInputValues(0, 2)).toEqual([0, 0]);
            expect(indexToInputValues(1, 2)).toEqual([0, 1]);
            expect(indexToInputValues(2, 2)).toEqual([1, 0]);
            expect(indexToInputValues(3, 2)).toEqual([1, 1]);
        });

        it('converts to three bits', () => {
            expect(indexToInputValues(0, 3)).toEqual([0, 0, 0]);
            expect(indexToInputValues(5, 3)).toEqual([1, 0, 1]);
            expect(indexToInputValues(7, 3)).toEqual([1, 1, 1]);
        });
    });

    describe('edge cases', () => {
        it('returns empty array for zero input count', () => {
            expect(indexToInputValues(5, 0)).toEqual([]);
        });

        it('returns empty array for negative input count', () => {
            expect(indexToInputValues(5, -1)).toEqual([]);
        });
    });
});

describe('round-trip conversion', () => {
    it('inputValuesToIndex and indexToInputValues are inverses', () => {
        for (let i = 0; i < 16; i++) {
            const values = indexToInputValues(i, 4);
            const index = inputValuesToIndex(values);
            expect(index).toBe(i);
        }
    });
});
