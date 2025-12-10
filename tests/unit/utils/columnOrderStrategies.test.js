/**
 * Tests for columnOrderStrategies.js
 */

import { describe, it, expect } from 'vitest';
import {
    COLUMN_ORDER_STRATEGIES,
    createFieldName,
    parseFieldName,
    isLegacyColumnOrder,
    sortColumnsByStrategy,
    mergeColumnOrder,
    mergeColumnOrderByGroup
} from '../../../src/utils/columnOrderStrategies.js';

describe('columnOrderStrategies', () => {
    // =========================================================================
    // Field Name Utilities
    // =========================================================================

    describe('createFieldName', () => {
        it('creates input field name with ID', () => {
            expect(createFieldName('input', 5)).toBe('input_5');
            expect(createFieldName('input', 123)).toBe('input_123');
        });

        it('creates output field name with ID', () => {
            expect(createFieldName('output', 7)).toBe('output_7');
            expect(createFieldName('output', 42)).toBe('output_42');
        });

        it('handles string IDs', () => {
            expect(createFieldName('input', '5')).toBe('input_5');
        });
    });

    describe('parseFieldName', () => {
        it('parses input field name', () => {
            expect(parseFieldName('input_5')).toEqual({ type: 'input', id: 5 });
            expect(parseFieldName('input_123')).toEqual({ type: 'input', id: 123 });
        });

        it('parses output field name', () => {
            expect(parseFieldName('output_7')).toEqual({ type: 'output', id: 7 });
            expect(parseFieldName('output_42')).toEqual({ type: 'output', id: 42 });
        });

        it('returns null for invalid field names', () => {
            expect(parseFieldName('input0')).toBeNull(); // Legacy format
            expect(parseFieldName('output1')).toBeNull(); // Legacy format
            expect(parseFieldName('invalid')).toBeNull();
            expect(parseFieldName('')).toBeNull();
            expect(parseFieldName(null)).toBeNull();
            expect(parseFieldName(undefined)).toBeNull();
        });

        it('round-trips with createFieldName', () => {
            const field = createFieldName('input', 42);
            const parsed = parseFieldName(field);
            expect(parsed).toEqual({ type: 'input', id: 42 });
        });
    });

    describe('isLegacyColumnOrder', () => {
        it('detects legacy index-based format', () => {
            expect(isLegacyColumnOrder(['input0', 'input1', 'output0'])).toBe(true);
            expect(isLegacyColumnOrder(['input0'])).toBe(true);
            expect(isLegacyColumnOrder(['output2'])).toBe(true);
        });

        it('accepts new ID-based format', () => {
            expect(isLegacyColumnOrder(['input_5', 'input_3', 'output_7'])).toBe(false);
            expect(isLegacyColumnOrder(['input_1'])).toBe(false);
        });

        it('handles edge cases', () => {
            expect(isLegacyColumnOrder(null)).toBe(false);
            expect(isLegacyColumnOrder(undefined)).toBe(false);
            expect(isLegacyColumnOrder([])).toBe(false);
            expect(isLegacyColumnOrder([null, undefined])).toBe(false);
        });

        it('detects mixed formats as legacy', () => {
            // If any column is legacy format, treat the whole order as legacy
            expect(isLegacyColumnOrder(['input_5', 'input0', 'output_7'])).toBe(true);
        });
    });

    // =========================================================================
    // Sorting Utilities
    // =========================================================================

    describe('sortColumnsByStrategy', () => {
        const columns = [
            { field: 'input_5', title: 'B', componentId: 5 },
            { field: 'input_1', title: 'A', componentId: 1 },
            { field: 'input_10', title: 'C', componentId: 10 }
        ];

        it('sorts chronologically by component ID (ascending)', () => {
            const sorted = sortColumnsByStrategy(columns, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL);
            expect(sorted.map(c => c.componentId)).toEqual([1, 5, 10]);
        });

        it('sorts reverse chronologically by component ID (descending)', () => {
            const sorted = sortColumnsByStrategy(columns, COLUMN_ORDER_STRATEGIES.REVERSE_CHRONOLOGICAL);
            expect(sorted.map(c => c.componentId)).toEqual([10, 5, 1]);
        });

        it('sorts alphabetically by title', () => {
            const sorted = sortColumnsByStrategy(columns, COLUMN_ORDER_STRATEGIES.ALPHABETICAL);
            expect(sorted.map(c => c.title)).toEqual(['A', 'B', 'C']);
        });

        it('defaults to chronological for unknown strategy', () => {
            const sorted = sortColumnsByStrategy(columns, 'unknown');
            expect(sorted.map(c => c.componentId)).toEqual([1, 5, 10]);
        });

        it('handles empty array', () => {
            expect(sortColumnsByStrategy([], COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL)).toEqual([]);
        });

        it('handles null/undefined', () => {
            expect(sortColumnsByStrategy(null, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL)).toEqual([]);
            expect(sortColumnsByStrategy(undefined, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL)).toEqual([]);
        });

        it('does not mutate original array', () => {
            const original = [...columns];
            sortColumnsByStrategy(columns, COLUMN_ORDER_STRATEGIES.ALPHABETICAL);
            expect(columns).toEqual(original);
        });
    });

    // =========================================================================
    // Column Merge Logic
    // =========================================================================

    describe('mergeColumnOrder', () => {
        const currentCols = [
            { field: 'input_1', title: 'A', componentId: 1 },
            { field: 'input_5', title: 'B', componentId: 5 },
            { field: 'input_10', title: 'C', componentId: 10 }
        ];

        it('preserves saved order for existing columns', () => {
            const savedOrder = ['input_5', 'input_1', 'input_10'];
            const result = mergeColumnOrder(currentCols, savedOrder);
            expect(result.map(c => c.field)).toEqual(['input_5', 'input_1', 'input_10']);
        });

        it('appends new columns at end when column is added', () => {
            const savedOrder = ['input_5', 'input_1']; // input_10 is new
            const result = mergeColumnOrder(currentCols, savedOrder);
            expect(result.map(c => c.field)).toEqual(['input_5', 'input_1', 'input_10']);
        });

        it('removes deleted columns from order', () => {
            const savedOrder = ['input_5', 'input_99', 'input_1', 'input_10']; // input_99 was deleted
            const result = mergeColumnOrder(currentCols, savedOrder);
            expect(result.map(c => c.field)).toEqual(['input_5', 'input_1', 'input_10']);
        });

        it('handles multiple new columns - appends chronologically', () => {
            const savedOrder = ['input_5']; // input_1 and input_10 are new
            const result = mergeColumnOrder(currentCols, savedOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL);
            expect(result.map(c => c.field)).toEqual(['input_5', 'input_1', 'input_10']);
        });

        it('handles multiple new columns - appends alphabetically', () => {
            const savedOrder = ['input_5']; // input_1 and input_10 are new
            const result = mergeColumnOrder(currentCols, savedOrder, COLUMN_ORDER_STRATEGIES.ALPHABETICAL);
            // B is preserved, then A and C are appended alphabetically
            expect(result.map(c => c.title)).toEqual(['B', 'A', 'C']);
        });

        it('falls back to strategy sort when no saved order', () => {
            const result = mergeColumnOrder(currentCols, null, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL);
            expect(result.map(c => c.componentId)).toEqual([1, 5, 10]);
        });

        it('falls back to strategy sort for legacy column order', () => {
            const legacyOrder = ['input0', 'input1', 'input2'];
            const result = mergeColumnOrder(currentCols, legacyOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL);
            expect(result.map(c => c.componentId)).toEqual([1, 5, 10]);
        });

        it('handles empty current columns', () => {
            expect(mergeColumnOrder([], ['input_5'])).toEqual([]);
        });

        it('handles empty saved order', () => {
            const result = mergeColumnOrder(currentCols, []);
            expect(result.map(c => c.componentId)).toEqual([1, 5, 10]);
        });
    });

    describe('mergeColumnOrderByGroup', () => {
        const inputCols = [
            { field: 'input_1', title: 'A', componentId: 1 },
            { field: 'input_5', title: 'B', componentId: 5 }
        ];

        const outputCols = [
            { field: 'output_7', title: 'Y', componentId: 7 },
            { field: 'output_3', title: 'X', componentId: 3 }
        ];

        it('merges inputs and outputs separately', () => {
            const savedOrder = ['input_5', 'input_1', 'output_3', 'output_7'];
            const { orderedInputCols, orderedOutputCols } = mergeColumnOrderByGroup(
                inputCols, outputCols, savedOrder
            );

            expect(orderedInputCols.map(c => c.field)).toEqual(['input_5', 'input_1']);
            expect(orderedOutputCols.map(c => c.field)).toEqual(['output_3', 'output_7']);
        });

        it('handles new inputs correctly', () => {
            const savedOrder = ['input_5', 'output_7', 'output_3']; // input_1 is new
            const { orderedInputCols, orderedOutputCols } = mergeColumnOrderByGroup(
                inputCols, outputCols, savedOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL
            );

            // input_5 first (from saved), then input_1 appended
            expect(orderedInputCols.map(c => c.field)).toEqual(['input_5', 'input_1']);
            expect(orderedOutputCols.map(c => c.field)).toEqual(['output_7', 'output_3']);
        });

        it('handles new outputs correctly', () => {
            const savedOrder = ['input_1', 'input_5', 'output_7']; // output_3 is new
            const { orderedInputCols, orderedOutputCols } = mergeColumnOrderByGroup(
                inputCols, outputCols, savedOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL
            );

            expect(orderedInputCols.map(c => c.field)).toEqual(['input_1', 'input_5']);
            // output_7 first (from saved), then output_3 appended
            expect(orderedOutputCols.map(c => c.field)).toEqual(['output_7', 'output_3']);
        });

        it('handles legacy column order by falling back to strategy', () => {
            const legacyOrder = ['input0', 'input1', 'output0', 'output1'];
            const { orderedInputCols, orderedOutputCols } = mergeColumnOrderByGroup(
                inputCols, outputCols, legacyOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL
            );

            // Falls back to chronological sort
            expect(orderedInputCols.map(c => c.componentId)).toEqual([1, 5]);
            expect(orderedOutputCols.map(c => c.componentId)).toEqual([3, 7]);
        });

        it('handles null saved order', () => {
            const { orderedInputCols, orderedOutputCols } = mergeColumnOrderByGroup(
                inputCols, outputCols, null, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL
            );

            expect(orderedInputCols.map(c => c.componentId)).toEqual([1, 5]);
            expect(orderedOutputCols.map(c => c.componentId)).toEqual([3, 7]);
        });
    });

    // =========================================================================
    // Integration Scenarios
    // =========================================================================

    describe('integration scenarios', () => {
        it('user reorders columns, then adds new input', () => {
            // Initial: A (id:1), B (id:5) - user reorders to B, A
            // User adds C (id:10)
            // Expected: B, A, C (new column at end)

            const currentCols = [
                { field: 'input_1', title: 'A', componentId: 1 },
                { field: 'input_5', title: 'B', componentId: 5 },
                { field: 'input_10', title: 'C', componentId: 10 }
            ];
            const savedOrder = ['input_5', 'input_1']; // User's custom order before addition

            const result = mergeColumnOrder(currentCols, savedOrder);
            expect(result.map(c => c.title)).toEqual(['B', 'A', 'C']);
        });

        it('user reorders columns, then removes middle column', () => {
            // Initial: A (id:1), B (id:5), C (id:10) - user reorders to C, A, B
            // User removes B (id:5)
            // Expected: C, A (relative order preserved)

            const currentCols = [
                { field: 'input_1', title: 'A', componentId: 1 },
                { field: 'input_10', title: 'C', componentId: 10 }
            ];
            const savedOrder = ['input_10', 'input_1', 'input_5']; // B was here but is now removed

            const result = mergeColumnOrder(currentCols, savedOrder);
            expect(result.map(c => c.title)).toEqual(['C', 'A']);
        });

        it('user reorders, adds two inputs, removes one', () => {
            // Complex scenario:
            // Initial: A (id:1), B (id:5) - user reorders to B, A
            // User adds C (id:10), D (id:15), removes A (id:1)
            // Expected: B, C, D (B preserved from saved, C and D appended chronologically)

            const currentCols = [
                { field: 'input_5', title: 'B', componentId: 5 },
                { field: 'input_10', title: 'C', componentId: 10 },
                { field: 'input_15', title: 'D', componentId: 15 }
            ];
            const savedOrder = ['input_5', 'input_1']; // A (id:1) was removed

            const result = mergeColumnOrder(currentCols, savedOrder, COLUMN_ORDER_STRATEGIES.CHRONOLOGICAL);
            expect(result.map(c => c.title)).toEqual(['B', 'C', 'D']);
        });
    });
});
