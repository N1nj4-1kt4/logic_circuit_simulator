/**
 * Constants for the Logic Circuit Simulator
 * All magic numbers, colors, and configuration values
 */

// ==================== GATE DIMENSIONS ====================

export const GATE_SIZES = {
    AND: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    OR: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    NOT: { width: 45, height: 40, halfWidth: 22.5, halfHeight: 20 },
    NAND: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    NOR: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    XOR: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    XNOR: { width: 50, height: 40, halfWidth: 25, halfHeight: 20 },
    INPUT: { width: 40, height: 40, halfWidth: 20, halfHeight: 20 },
    OUTPUT: { width: 40, height: 40, halfWidth: 20, halfHeight: 20 },
    CUSTOM: { width: 90, height: 90, halfWidth: 45, halfHeight: 45 }
};

// Hit detection sizes (larger for better UX)
export const HIT_DETECTION_SIZES = {
    DEFAULT: 50,
    INPUT: 40,
    OUTPUT: 40,
    CUSTOM: 100,
    NOT: 50,
    STANDARD_GATE: 60
};

// ==================== COLORS ====================

export const COLORS = {
    // Wire colors
    WIRE_OFF: '#999',
    WIRE_ON: '#4caf50',
    WIRE_PREVIEW: 'rgba(102, 126, 234, 0.5)',

    // Gate colors
    GATE_FILL: '#667eea',
    GATE_STROKE: '#764ba2',
    GATE_STROKE_WIDTH: 2,

    // Port colors
    PORT_STROKE: '#333',
    PORT_FILL_OFF: 'white',
    PORT_FILL_ON: '#4caf50',

    // Component colors
    COMPONENT_LABEL_COLOR: 'white',
    COMPONENT_VALUE_COLOR_OFF: '#999',
    COMPONENT_VALUE_COLOR_ON: '#4caf50',

    // Grid
    GRID_COLOR: '#f0f0f0',

    // Canvas background
    CANVAS_BG: 'white',

    // Truth table
    TRUTH_TABLE_ACTIVE_BG: '#4caf50',
    TRUTH_TABLE_HOVER_BG: '#f0f0f0',

    // Component state colors (used in multiple renderers)
    VALUE_ON: '#4caf50',
    VALUE_OFF: '#f44336',
    VALUE_UNDEFINED: '#999',

    // Custom component colors
    CUSTOM_FILL: '#1a1a2e',
    CUSTOM_STROKE: '#f39c12',
    CUSTOM_FILL_LIGHT: '#fff3e0',
    CUSTOM_STROKE_LIGHT: '#ff9800',

    // Dark mode variants
    DARK: {
        CANVAS_BG: '#1a1a2e',
        GRID_COLOR: '#2a2a4e',
        TEXT_PRIMARY: '#e9e9e9',
        TEXT_SECONDARY: '#999',
        COMPONENT_STROKE: '#ccc',
        VALUE_UNDEFINED: '#555',
        WIRE_UNDEFINED: '#888',
        GATE_FILL: '#0f3460',
        GATE_STROKE: '#53a8f4',
        PORT_LABEL: '#b3b3b3'
    },

    // Light mode variants (for explicit contrast with dark mode)
    LIGHT: {
        TEXT_PRIMARY: '#333',
        TEXT_SECONDARY: '#666',
        VALUE_UNDEFINED: '#ccc',
        WIRE_UNDEFINED: '#666',
        GATE_FILL: '#e3f2fd',
        GATE_STROKE: '#1976d2',
        PORT_LABEL: '#666'
    },

    // Port colors by type
    PORT_OUTPUT: '#4caf50',
    PORT_INPUT: '#2196f3'
};

// ==================== LAYOUT ====================

export const GRID_SIZE = 50;
export const PORT_RADIUS = 5;
export const PORT_DETECTION_RADIUS = 10;

// Canvas dimensions
export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 800;

// ==================== FONTS ====================

export const FONTS = {
    COMPONENT_LABEL: 'bold 14px Arial',
    COMPONENT_VALUE: 'bold 14px Arial',
    CUSTOM_COMPONENT_LABEL: 'bold 11px Arial',
    PORT_INDEX: '10px Arial'
};

// ==================== TRUTH TABLE ====================

export const TRUTH_TABLE = {
    MIN_WIDTH: 250,
    MIN_HEIGHT: 150,
    DEFAULT_POSITION: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
    PANEL_PADDING: 20,
    MARGIN_FROM_EDGE: 20
};

// ==================== TIMING ====================

export const TIMING = {
    AUTO_CYCLE_DELAY: 750, // ms
    AUTO_SAVE_DEBOUNCE: 1000, // ms
    ANIMATION_DURATION: 300, // ms
    TRUTH_TABLE_DEBOUNCE: 150, // ms - debounce before recomputing truth table
    DIALOG_FADE_IN: 200, // ms
    DIALOG_FADE_OUT: 200, // ms
    DIALOG_CLEANUP_DELAY: 100, // ms - delay before removing dialog from DOM
    TOOLTIP_DELAY: 500, // ms
    FOCUS_DELAY: 300 // ms - delay before focusing dialog buttons
};

// ==================== UI ====================

export const UI = {
    ICONS: {
        SUN: '☀️',
        MOON: '🌙',
        CLOSE: '×',
        CHECK: '✓',
        CROSS: '✗',
        WARNING: '⚠',
        INFO: 'ℹ'
    }
};

// ==================== UNDO/REDO ====================

export const UNDO_REDO = {
    MAX_HISTORY_SIZE: 20,
    STORAGE_KEY_PREFIX: 'undoredo_'
};

// ==================== STORAGE KEYS ====================

export const STORAGE_KEYS = {
    CIRCUIT_BOARD_STATE: 'circuitBoardState',
    CUSTOM_COMPONENTS: 'customComponents',
    SAVED_BOARDS: 'savedBoards',
    DARK_MODE: 'darkMode'
};

// ==================== GATE TYPES ====================

export const GATE_TYPES = {
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT',
    NAND: 'NAND',
    NOR: 'NOR',
    XOR: 'XOR',
    XNOR: 'XNOR',
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    CUSTOM: 'CUSTOM'
};

// ==================== MODES ====================

export const MODES = {
    NEUTRAL: 'neutral',
    PLACE: 'place',
    CONNECT: 'connect',
    DELETE: 'delete'
};

// ==================== PORT CONFIGURATION ====================

export const PORT_CONFIG = {
    // Number of inputs for each gate type
    INPUT_COUNTS: {
        AND: 2,
        OR: 2,
        NOT: 1,
        NAND: 2,
        NOR: 2,
        XOR: 2,
        XNOR: 2,
        INPUT: 0,
        OUTPUT: 1
    },

    // Number of outputs for each gate type
    OUTPUT_COUNTS: {
        AND: 1,
        OR: 1,
        NOT: 1,
        NAND: 1,
        NOR: 1,
        XOR: 1,
        XNOR: 1,
        INPUT: 1,
        OUTPUT: 0
    }
};
