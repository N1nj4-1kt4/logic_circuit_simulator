/**
 * Tests for constants.js
 * Verifies all constants are exported and have expected structure
 */
import { describe, it, expect } from 'vitest';
import {
    GATE_SIZES,
    HIT_DETECTION_SIZES,
    COLORS,
    GRID_SIZE,
    PORT_RADIUS,
    PORT_DETECTION_RADIUS,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    FONTS,
    TRUTH_TABLE,
    TIMING,
    UI,
    STORAGE_KEYS,
    GATE_TYPES,
    MODES,
    PORT_CONFIG
} from '../../src/constants.js';

describe('constants.js', () => {
    describe('GATE_SIZES', () => {
        it('should have dimensions for all standard gate types', () => {
            const expectedTypes = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'INPUT', 'OUTPUT', 'CUSTOM'];
            expectedTypes.forEach(type => {
                expect(GATE_SIZES[type]).toBeDefined();
                expect(GATE_SIZES[type].width).toBeTypeOf('number');
                expect(GATE_SIZES[type].height).toBeTypeOf('number');
                expect(GATE_SIZES[type].halfWidth).toBeTypeOf('number');
                expect(GATE_SIZES[type].halfHeight).toBeTypeOf('number');
            });
        });

        it('should have consistent half dimensions', () => {
            Object.values(GATE_SIZES).forEach(size => {
                expect(size.halfWidth).toBe(size.width / 2);
                expect(size.halfHeight).toBe(size.height / 2);
            });
        });
    });

    describe('COLORS', () => {
        it('should have wire colors', () => {
            expect(COLORS.WIRE_OFF).toBeTypeOf('string');
            expect(COLORS.WIRE_ON).toBeTypeOf('string');
            expect(COLORS.WIRE_PREVIEW).toBeTypeOf('string');
        });

        it('should have component state colors', () => {
            expect(COLORS.VALUE_ON).toBeTypeOf('string');
            expect(COLORS.VALUE_OFF).toBeTypeOf('string');
            expect(COLORS.VALUE_UNDEFINED).toBeTypeOf('string');
        });

        it('should have custom component colors', () => {
            expect(COLORS.CUSTOM_FILL).toBeTypeOf('string');
            expect(COLORS.CUSTOM_STROKE).toBeTypeOf('string');
            expect(COLORS.CUSTOM_FILL_LIGHT).toBeTypeOf('string');
            expect(COLORS.CUSTOM_STROKE_LIGHT).toBeTypeOf('string');
        });

        it('should have port colors', () => {
            expect(COLORS.PORT_OUTPUT).toBeTypeOf('string');
            expect(COLORS.PORT_INPUT).toBeTypeOf('string');
            expect(COLORS.PORT_STROKE).toBeTypeOf('string');
        });

        it('should have dark mode variants', () => {
            expect(COLORS.DARK).toBeDefined();
            expect(COLORS.DARK.CANVAS_BG).toBeTypeOf('string');
            expect(COLORS.DARK.GRID_COLOR).toBeTypeOf('string');
            expect(COLORS.DARK.TEXT_PRIMARY).toBeTypeOf('string');
            expect(COLORS.DARK.TEXT_SECONDARY).toBeTypeOf('string');
            expect(COLORS.DARK.VALUE_UNDEFINED).toBeTypeOf('string');
            expect(COLORS.DARK.WIRE_UNDEFINED).toBeTypeOf('string');
            expect(COLORS.DARK.GATE_FILL).toBeTypeOf('string');
            expect(COLORS.DARK.GATE_STROKE).toBeTypeOf('string');
            expect(COLORS.DARK.PORT_LABEL).toBeTypeOf('string');
        });

        it('should have light mode variants', () => {
            expect(COLORS.LIGHT).toBeDefined();
            expect(COLORS.LIGHT.TEXT_PRIMARY).toBeTypeOf('string');
            expect(COLORS.LIGHT.TEXT_SECONDARY).toBeTypeOf('string');
            expect(COLORS.LIGHT.VALUE_UNDEFINED).toBeTypeOf('string');
            expect(COLORS.LIGHT.WIRE_UNDEFINED).toBeTypeOf('string');
            expect(COLORS.LIGHT.GATE_FILL).toBeTypeOf('string');
            expect(COLORS.LIGHT.GATE_STROKE).toBeTypeOf('string');
            expect(COLORS.LIGHT.PORT_LABEL).toBeTypeOf('string');
        });
    });

    describe('TIMING', () => {
        it('should have all timing constants', () => {
            expect(TIMING.AUTO_CYCLE_DELAY).toBeTypeOf('number');
            expect(TIMING.AUTO_SAVE_DEBOUNCE).toBeTypeOf('number');
            expect(TIMING.ANIMATION_DURATION).toBeTypeOf('number');
            expect(TIMING.TRUTH_TABLE_DEBOUNCE).toBeTypeOf('number');
        });

        it('should have dialog timing constants', () => {
            expect(TIMING.DIALOG_FADE_IN).toBeTypeOf('number');
            expect(TIMING.DIALOG_FADE_OUT).toBeTypeOf('number');
            expect(TIMING.DIALOG_CLEANUP_DELAY).toBeTypeOf('number');
            expect(TIMING.FOCUS_DELAY).toBeTypeOf('number');
        });

        it('should have reasonable timing values (positive numbers)', () => {
            Object.values(TIMING).forEach(value => {
                expect(value).toBeGreaterThan(0);
            });
        });
    });

    describe('UI', () => {
        it('should have all icon constants', () => {
            expect(UI.ICONS).toBeDefined();
            expect(UI.ICONS.SUN).toBeTypeOf('string');
            expect(UI.ICONS.MOON).toBeTypeOf('string');
            expect(UI.ICONS.CLOSE).toBeTypeOf('string');
            expect(UI.ICONS.CHECK).toBeTypeOf('string');
            expect(UI.ICONS.CROSS).toBeTypeOf('string');
            expect(UI.ICONS.WARNING).toBeTypeOf('string');
            expect(UI.ICONS.INFO).toBeTypeOf('string');
        });

        it('should have non-empty icon strings', () => {
            Object.values(UI.ICONS).forEach(icon => {
                expect(icon.length).toBeGreaterThan(0);
            });
        });
    });

    describe('FONTS', () => {
        it('should have all font constants', () => {
            expect(FONTS.COMPONENT_LABEL).toBeTypeOf('string');
            expect(FONTS.COMPONENT_VALUE).toBeTypeOf('string');
            expect(FONTS.CUSTOM_COMPONENT_LABEL).toBeTypeOf('string');
            expect(FONTS.PORT_INDEX).toBeTypeOf('string');
        });
    });

    describe('Layout constants', () => {
        it('should have grid size', () => {
            expect(GRID_SIZE).toBeTypeOf('number');
            expect(GRID_SIZE).toBeGreaterThan(0);
        });

        it('should have port radius constants', () => {
            expect(PORT_RADIUS).toBeTypeOf('number');
            expect(PORT_DETECTION_RADIUS).toBeTypeOf('number');
            expect(PORT_DETECTION_RADIUS).toBeGreaterThanOrEqual(PORT_RADIUS);
        });

        it('should have canvas dimensions', () => {
            expect(CANVAS_WIDTH).toBeTypeOf('number');
            expect(CANVAS_HEIGHT).toBeTypeOf('number');
            expect(CANVAS_WIDTH).toBeGreaterThan(0);
            expect(CANVAS_HEIGHT).toBeGreaterThan(0);
        });
    });

    describe('STORAGE_KEYS', () => {
        it('should have all storage keys', () => {
            expect(STORAGE_KEYS.CIRCUIT_BOARD_STATE).toBeTypeOf('string');
            expect(STORAGE_KEYS.CUSTOM_COMPONENTS).toBeTypeOf('string');
            expect(STORAGE_KEYS.SAVED_BOARDS).toBeTypeOf('string');
            expect(STORAGE_KEYS.DARK_MODE).toBeTypeOf('string');
        });
    });

    describe('GATE_TYPES', () => {
        it('should have all gate types', () => {
            const expectedTypes = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'INPUT', 'OUTPUT', 'CUSTOM'];
            expectedTypes.forEach(type => {
                expect(GATE_TYPES[type]).toBe(type);
            });
        });
    });

    describe('MODES', () => {
        it('should have all modes', () => {
            expect(MODES.NEUTRAL).toBe('neutral');
            expect(MODES.PLACE).toBe('place');
            expect(MODES.CONNECT).toBe('connect');
            expect(MODES.DELETE).toBe('delete');
        });
    });

    describe('PORT_CONFIG', () => {
        it('should have input counts for all gate types', () => {
            expect(PORT_CONFIG.INPUT_COUNTS.AND).toBe(2);
            expect(PORT_CONFIG.INPUT_COUNTS.OR).toBe(2);
            expect(PORT_CONFIG.INPUT_COUNTS.NOT).toBe(1);
            expect(PORT_CONFIG.INPUT_COUNTS.INPUT).toBe(0);
            expect(PORT_CONFIG.INPUT_COUNTS.OUTPUT).toBe(1);
        });

        it('should have output counts for all gate types', () => {
            expect(PORT_CONFIG.OUTPUT_COUNTS.AND).toBe(1);
            expect(PORT_CONFIG.OUTPUT_COUNTS.OR).toBe(1);
            expect(PORT_CONFIG.OUTPUT_COUNTS.NOT).toBe(1);
            expect(PORT_CONFIG.OUTPUT_COUNTS.INPUT).toBe(1);
            expect(PORT_CONFIG.OUTPUT_COUNTS.OUTPUT).toBe(0);
        });
    });

    describe('HIT_DETECTION_SIZES', () => {
        it('should have sizes for all component categories', () => {
            expect(HIT_DETECTION_SIZES.DEFAULT).toBeTypeOf('number');
            expect(HIT_DETECTION_SIZES.INPUT).toBeTypeOf('number');
            expect(HIT_DETECTION_SIZES.OUTPUT).toBeTypeOf('number');
            expect(HIT_DETECTION_SIZES.CUSTOM).toBeTypeOf('number');
            expect(HIT_DETECTION_SIZES.NOT).toBeTypeOf('number');
            expect(HIT_DETECTION_SIZES.STANDARD_GATE).toBeTypeOf('number');
        });
    });

    describe('TRUTH_TABLE', () => {
        it('should have panel configuration', () => {
            expect(TRUTH_TABLE.MIN_WIDTH).toBeTypeOf('number');
            expect(TRUTH_TABLE.MIN_HEIGHT).toBeTypeOf('number');
            expect(TRUTH_TABLE.PANEL_PADDING).toBeTypeOf('number');
            expect(TRUTH_TABLE.MARGIN_FROM_EDGE).toBeTypeOf('number');
        });
    });
});
