# Logic Circuit Simulator - Refactoring Plan V2

**Post-Phase 9 Architecture Improvements**

---

## Executive Summary

**Goal:** Address remaining architectural issues identified after the initial refactoring (Phases 0-9) to achieve full adherence to the refactoring principles.

**Current State:**
- 77% reduction in main file achieved
- 32 modular source files (added hitDetection.js, errors.js, logger.js, naming.js)
- 840 tests passing (~75% coverage by module)
- Event bus foundation in place
- Phase 10.1 completed ✅
- Phase 10.2 completed ✅
- Phase 10.3 completed ✅
- Phase 10.4 completed ✅
- Phase 10.5 completed ✅
- Phase 10.6 completed ✅
- Phase 11.1 completed ✅
- Phase 11.2 completed ✅
- Phase 11.3 completed ✅
- Phase 11.4 completed ✅

**Remaining Work:**
- Phase 12 optional improvements (split large files, refactor long functions)
- Event bus migration for toolbar callbacks

**Estimated Effort:** 12-16 hours (2-3 days)

**Risk Level:** Low (incremental improvements, no breaking changes)

---

## Principles (Continued from V1)

1. **Separation of Concerns:** Each module has single responsibility
2. **Event-Driven Architecture:** Decouple via event bus, not callbacks
3. **Testability:** Pure functions, no UI in business logic
4. **Single Source of Truth:** No duplicate logic
5. **Constants Extraction:** No magic numbers in code

---

## Phase 10: Architecture Cleanup

### Phase 10.1: Extract Hit Detection Utilities ✅ COMPLETED

**Goal:** Move geometric/hit detection logic from coordinator to utilities

**Status:** ✅ Completed

**Files Created:**
- `src/utils/hitDetection.js` (135 lines) - 5 pure utility functions:
  - `findComponentAt()` - Find component at coordinates
  - `findPortAt()` - Find port at coordinates (with optional type filter)
  - `findConnectionAt()` - Find connection at coordinates
  - `snapToGrid()` - Snap coordinates to grid
  - `isPointInComponent()` - Check if point is within component bounds

- `tests/unit/utils/hitDetection.test.js` (43 tests) - Full test coverage

**Files Modified:**
- `circuit-simulator.js` - Updated imports, simplified `findComponent()`, `findPort()`, `findConnection()`, `moveComponent()` to use utilities
- `src/core/CircuitOperations.js` - Updated `placeComponent()` to use `snapToGrid()`

**Results:**
- All 545 tests pass
- No geometric logic in coordinator (delegated to utilities)
- Uses constants from `HIT_DETECTION_SIZES`, `PORT_DETECTION_RADIUS`, `GRID_SIZE`
- App functionality unchanged

---

### Phase 10.2: Remove UI from Storage/Business Layers ✅ COMPLETED

**Goal:** Storage and business logic should not import or use UI components

**Status:** ✅ Completed

**Files Created:**
- `src/core/errors.js` (120 lines) - Custom error classes:
  - `CircuitError` - Base error class
  - `ValidationError` - Base validation error
  - `NoInputsError` - No inputs for simulation
  - `NoOutputsError` - No outputs for simulation
  - `EmptyCircuitError` - Empty circuit error
  - `BoardNameRequiredError` - Missing board name
  - `ComponentNotFoundError` - Component not found
  - `ComponentSaveError` - Failed to save component
  - `BoardSaveError` - Failed to save board
  - `BoardLoadError` - Failed to load board
  - `ImportExportError` - Import/export error
  - `InvalidComponentFileError` - Invalid component file
  - `ComponentExistsError` - Component already exists

**Files Modified:**
- `src/storage/ComponentLibrary.js` - Removed DialogFactory import, throws errors
- `src/storage/localStorage.js` - Removed DialogFactory import
- `src/core/CircuitOperations.js` - Removed DialogFactory/messages imports, throws errors
- `circuit-simulator.js` - Added `_handleError()` method, catches errors and displays dialogs
- Updated tests to expect thrown errors instead of false returns

**Results:**
- All 545 tests pass
- No UI imports in storage/ or core/ directories
- Errors are caught and displayed by coordinator
- CircuitOperations fully testable without UI mocks

---

**Original Plan (for reference):**

**Files to Create:**
- `src/core/errors.js` (~50 lines)

```javascript
// src/core/errors.js

/**
 * Base error for circuit operations
 */
export class CircuitError extends Error {
    constructor(message, type = 'error') {
        super(message);
        this.name = 'CircuitError';
        this.type = type; // 'error', 'warning', 'info'
    }
}

/**
 * Validation error for circuit operations
 */
export class ValidationError extends CircuitError {
    constructor(message) {
        super(message, 'warning');
        this.name = 'ValidationError';
    }
}

/**
 * No inputs error for simulation
 */
export class NoInputsError extends ValidationError {
    constructor() {
        super('Circuit has no INPUT components to simulate');
        this.name = 'NoInputsError';
    }
}

/**
 * No outputs error for simulation
 */
export class NoOutputsError extends ValidationError {
    constructor() {
        super('Circuit has no OUTPUT components');
        this.name = 'NoOutputsError';
    }
}

/**
 * Component save error
 */
export class ComponentSaveError extends CircuitError {
    constructor(message) {
        super(message, 'error');
        this.name = 'ComponentSaveError';
    }
}

/**
 * Import/export error
 */
export class ImportExportError extends CircuitError {
    constructor(message, type = 'error') {
        super(message, type);
        this.name = 'ImportExportError';
    }
}
```

**Files to Modify:**

1. **`src/storage/ComponentLibrary.js`**
   - Remove: `import { DialogFactory } from '../ui/DialogFactory.js';`
   - Change: Dialog calls → throw errors or return result objects

   ```javascript
   // Before (line 163-166)
   DialogFactory.showAlert({
       message: `Failed to export component: ${error.message}`,
       type: 'error'
   });

   // After
   throw new ImportExportError(`Failed to export component: ${error.message}`);
   ```

2. **`src/core/CircuitOperations.js`**
   - Remove: `import { DialogFactory } from '../ui/DialogFactory.js';`
   - Change: Dialog calls → throw errors

   ```javascript
   // Before (lines 213-226)
   if (inputs.length === 0) {
       DialogFactory.showAlert({
           message: messages.alerts.noInputsToSimulate,
           type: 'warning'
       });
       return;
   }

   // After
   if (inputs.length === 0) {
       throw new NoInputsError();
   }
   ```

3. **`circuit-simulator.js`**
   - Add: try/catch around operations that can throw
   - Add: Display errors using DialogFactory in catch blocks

**Success Criteria:**
- No UI imports in storage/ or core/ directories
- All errors caught and displayed by coordinator
- CircuitOperations fully testable without UI mocks

---

### Phase 10.3: Complete Constants Extraction ✅ COMPLETED

**Goal:** Extract all remaining magic values to constants.js

**Status:** ✅ Completed

**Files Modified:**
- `src/constants.js` - Added new constants:
  - `COLORS.VALUE_ON`, `COLORS.VALUE_OFF`, `COLORS.VALUE_UNDEFINED` - component state colors
  - `COLORS.CUSTOM_*` - custom component colors (fill/stroke for light/dark modes)
  - `COLORS.DARK.*` - dark mode variants (canvas bg, grid, text, gate colors, port labels)
  - `COLORS.LIGHT.*` - light mode variants for explicit contrast
  - `COLORS.PORT_OUTPUT`, `COLORS.PORT_INPUT` - port colors by type
  - `TIMING.DIALOG_FADE_IN`, `TIMING.DIALOG_FADE_OUT`, `TIMING.DIALOG_CLEANUP_DELAY`, `TIMING.FOCUS_DELAY`
  - `UI.ICONS` - centralized icon characters (SUN, MOON, CLOSE, CHECK, CROSS, WARNING, INFO)

- `src/rendering/ComponentRenderer.js` - Replaced hardcoded colors with constants
- `src/rendering/ConnectionRenderer.js` - Replaced hardcoded wire colors with constants
- `src/ui/Toolbar.js` - Replaced `#f44336` with `COLORS.VALUE_OFF`
- `src/ui/DialogFactory.js` - Replaced timing values and icons with constants
- `src/ui/ThemeManager.js` - Replaced emoji icons with `UI.ICONS.*`

**Tests Created:**
- `tests/unit/constants.test.js` (24 tests) - Full coverage of all constant exports

**Results:**
- All 569 tests pass (545 original + 24 new constants tests)
- No hardcoded colors in rendering files
- No hardcoded timing values in UI files
- All values traceable to constants.js

---

**Original Plan (for reference):**

1. **`src/constants.js`** - Add missing constants:

```javascript
// Add to COLORS section
export const COLORS = {
    // ... existing colors ...

    // Dark mode variants
    DARK: {
        CANVAS_BG: '#1a1a2e',
        GRID_COLOR: '#2a2a4e',
        TEXT_PRIMARY: '#e9e9e9',
        TEXT_SECONDARY: '#999',
        COMPONENT_STROKE: '#ccc',
    },

    // Component state colors (used in multiple renderers)
    VALUE_ON: '#4caf50',
    VALUE_OFF: '#f44336',
    VALUE_UNDEFINED: '#999',

    // Custom component colors
    CUSTOM_FILL: '#1a1a2e',
    CUSTOM_STROKE: '#f39c12',
    CUSTOM_FILL_LIGHT: '#fff3e0',
    CUSTOM_STROKE_LIGHT: '#ff9800',
};

// Add to TIMING section
export const TIMING = {
    // ... existing timing ...
    DIALOG_FADE_IN: 200,
    DIALOG_FADE_OUT: 300,
    TOOLTIP_DELAY: 500,
};

// Add to TRUTH_TABLE section
export const TRUTH_TABLE = {
    // ... existing ...
    MIN_ROW_HEIGHT: 25,
    HEADER_HEIGHT: 40,
};

// Add UI section
export const UI = {
    ICONS: {
        SUN: '☀️',
        MOON: '🌙',
        CLOSE: '×',
        CHECK: '✓',
        CROSS: '✗',
        WARNING: '⚠',
        INFO: 'ℹ',
    },
};
```

2. **`src/rendering/ComponentRenderer.js`** - Replace hardcoded values:
   - Lines 52, 75-76: Use `COLORS.VALUE_ON`, `COLORS.VALUE_OFF`
   - Line 56, 80, 85: Use `COLORS.DARK.*` variants
   - Lines 109-110: Use `COLORS.CUSTOM_*`

3. **`src/rendering/ConnectionRenderer.js`** - Replace hardcoded values:
   - Lines 37-39: Use `COLORS.WIRE_ON`, `COLORS.WIRE_OFF`
   - Line 78: Use `COLORS.WIRE_PREVIEW`

4. **`src/ui/Toolbar.js`** - Replace inline style:
   - Line 556: Use `COLORS.VALUE_OFF` instead of `'#f44336'`

5. **`src/ui/DialogFactory.js`** - Replace timing:
   - Lines 163, 300, 413, 520: Use `TIMING.DIALOG_FADE_*`

6. **`src/ui/ThemeManager.js`** - Replace emojis:
   - Lines 60-67: Use `UI.ICONS.SUN`, `UI.ICONS.MOON`

**Success Criteria:**
- No hardcoded colors in rendering files
- No hardcoded timing values in UI files
- All values traceable to constants.js

---

### Phase 10.4: Console Logging Cleanup ✅ COMPLETED

**Goal:** Remove debug logging from production code

**Status:** ✅ Completed

**Files Created:**
- `src/utils/logger.js` - Logger utility for development debugging (Option B implemented)

**Files Modified:**
- `src/ui/TruthTablePanel.js` - Removed 85 console.log statements
- `src/core/CircuitOperations.js` - Removed 18 console.log statements
- `src/utils/positioning.js` - Removed 12 console.log statements
- `src/storage/ComponentLibrary.js` - Removed 7 console.log statements
- `src/storage/BoardManager.js` - Removed 5 console.log statements
- `src/ui/DialogManager.js` - Removed 4 console.log statements
- `src/ui/Toolbar.js` - Removed 1 console.log statement

**Results:**
- All 569 tests pass
- No `console.log` statements in production code (except logger utility)
- Errors still logged via `console.error` where critical
- Logger utility available for future development debugging needs

---

### Phase 10.5: Remove Duplicate Logic ✅ COMPLETED

**Goal:** Single source of truth for shared logic

**Status:** ✅ Completed

**Files Created:**
- `src/utils/naming.js` - Pure utility for board name generation:
  - `generateNextBoardName(existingNames)` - Generates next available board name (Board01, Board02, etc.)

- `tests/unit/utils/naming.test.js` (10 tests) - Full test coverage for naming utility

**Files Modified:**
- `src/utils/geometry.js` - Added `getComponentDimensions(type)` helper function
- `src/utils/positioning.js` - Refactored to use `getComponentDimensions()` instead of inline logic
- `src/storage/BoardManager.js` - Refactored `getNextBoardName()` to use naming utility
- `src/ui/DialogManager.js` - Removed duplicate `getNextBoardName()` method (22 lines), now uses naming utility
- `circuit-simulator.js` - Refactored `getNextBoardName()` to use naming utility
- `tests/unit/utils/geometry.test.js` - Added 12 tests for `getComponentDimensions()`

**Duplicates Removed:**

1. **`getNextBoardName()` - 3 implementations → 1 utility:**
   - Removed from: `src/ui/DialogManager.js` (22 lines)
   - Simplified: `src/storage/BoardManager.js`, `circuit-simulator.js`
   - Single source: `src/utils/naming.js`

2. **Component dimensions - 2 inline implementations → 1 helper:**
   - Removed inline logic from: `src/utils/geometry.js`, `src/utils/positioning.js`
   - Single source: `getComponentDimensions()` in `src/utils/geometry.js` using `GATE_SIZES` constants

**Results:**
- All 591 tests pass (569 original + 22 new)
- No duplicate function implementations
- Single source of truth for board naming and component dimensions

---

### Phase 10.6: Move Drag State to Interaction Layer ✅ COMPLETED

**Goal:** UI interaction state should not be in core circuit state

**Status:** ✅ Completed

**Files Modified:**
- `src/interaction/ComponentDragger.js` - Added local `dragState` object with all drag properties:
  - `isDragging` - Boolean flag
  - `component` - Reference to component being dragged
  - `offset` - `{x, y}` offset from mouse to component center
  - `startPos` - Initial mouse position (for threshold detection)
  - `hasMoved` - Whether movement threshold was exceeded
  - Added `getHasMoved()` and `resetHasMoved()` methods for CanvasInteraction

- `src/interaction/CanvasInteraction.js` - Updated to use `componentDragger.getHasMoved()` and `resetHasMoved()` instead of accessing state directly

- `src/core/CircuitState.js` - Removed:
  - Drag properties from constructor (5 properties)
  - Drag state section with 10 methods (setDraggingState, isDragging, etc.)
  - Drag state reset from `reset()` method

- `tests/unit/core/CircuitState.test.js` - Removed drag state tests (5 tests)

**Results:**
- All 586 tests pass
- CircuitState contains only circuit-related state
- Drag functionality unchanged (encapsulated in ComponentDragger)
- Clean separation: interaction state stays in interaction layer

---

## Phase 11: Test Coverage Expansion

### Phase 11.1: CircuitOperations Tests ✅ COMPLETED

**Goal:** Test the largest untested module

**Status:** ✅ Completed

**Files Created:**
- `tests/unit/core/CircuitOperations.test.js` (91 tests)

**Test Coverage:**
- Component Placement (12 tests): snapped coordinates, port definition, ID generation, labels
- Connections (8 tests): create, start/end validation, event emission
- Deletion (4 tests): component removal, connection removal, event emission
- Simulation (18 tests): simulate, auto-cycle, step simulation, reset
- Board Management (12 tests): save, load, create new, delete
- Component Library Management (9 tests): save, delete, load, export
- Auto-Save (5 tests): debounced save, clear on board cleared
- Truth Table Recomputation (4 tests): cache storage, event emission

**Mocking Strategy:**
- Mock BoardManager and ComponentLibrary
- Mock callbacks (redraw, defineComponentPorts, findComponent, findPort)
- Use real CircuitState

---

### Phase 11.2: Interaction Layer Tests ✅ COMPLETED

**Goal:** Test user input handling

**Status:** ✅ Completed

**Files Created:**
- `tests/unit/interaction/CanvasInteraction.test.js` (31 tests)
- `tests/unit/interaction/ComponentDragger.test.js` (30 tests)

**Test Coverage:**

ComponentDragger (30 tests):
- Initialization state
- handleMouseDown (start potential drag)
- handleMouseMove (movement threshold, drag behavior)
- handleMouseUp (state reset)
- isDragging/getHasMoved/resetHasMoved methods
- Complete drag flow scenarios

CanvasInteraction (31 tests):
- Initialization and event binding
- init/destroy lifecycle
- getScaledCoordinates (scaling and offset)
- handleClick (coordinates, drag suppression)
- handleDoubleClick
- handleContextMenu (MODE_EXIT_REQUEST)
- handleMouseDown/Move/Up delegation
- Connection preview in connect mode
- Cursor updates based on mode and hover
- Integration scenarios (click vs drag distinction)

---

### Phase 11.3: Rendering Layer Tests ✅ COMPLETED

**Goal:** Test visual output (property-based)

**Status:** ✅ Completed

**Files Created:**
- `tests/unit/rendering/ComponentRenderer.test.js` (45 tests)
- `tests/unit/rendering/ConnectionRenderer.test.js` (26 tests)

**Test Coverage:**

ComponentRenderer (45 tests):
- Initialization (dark mode handling)
- drawComponent dispatch (INPUT/OUTPUT/CUSTOM/gates)
- drawInputOutput (circle drawing, colors, labels, ports)
- drawCustomComponent (rectangular body, ports, labels, wrapping)
- drawGate (AND/NAND/OR/XOR/NOR/XNOR/NOT shapes)
- drawPort (input/output colors)
- Theme consistency (dark/light mode)

ConnectionRenderer (26 tests):
- Initialization
- drawConnections (line drawing, multiple connections, missing components)
- Wire color based on signal value (VALUE_ON/VALUE_OFF/undefined)
- Wire routing (horizontal/vertical preference, offset)
- drawConnectionPreview (dashed line, color, reset)
- Edge cases (empty arrays, self-loop)
- Theme consistency

---

### Phase 11.4: UI Component Tests ✅ COMPLETED

**Goal:** Test dialog and toolbar behavior

**Status:** ✅ Completed

**Files Created:**
- `tests/unit/ui/Toolbar.test.js` (24 tests)
- `tests/unit/ui/DialogManager.test.js` (18 tests)

**Test Coverage:**

Toolbar (24 tests):
- Initialization (callbacks, state)
- init method (element caching, setup)
- Tool selection (click behavior, toggle off, custom dropdown)
- Action buttons (connect mode, delete mode, toggle behavior)
- State management (tool clearing on mode change)
- Mode indicator updates
- Callback safety (missing callbacks)
- Element caching

DialogManager (18 tests):
- Initialization (callbacks, elements, state)
- init method (element caching, event listeners)
- setupEventListeners (import file handler)
- showSaveComponentDialog (validation, lazy creation, reuse)
- State management (rename target, pending action)
- Dialog lifecycle (form content, configuration)
- Error handling (missing elements, callback errors)

---

**Phase 11 Results:**
- **254 new tests added** (91 + 30 + 31 + 45 + 26 + 24 + 18 = 265, with some overlap in structure)
- **840 total tests now passing**
- Test coverage expanded from ~55% to ~75% of modules
- All critical modules now have unit tests

---

### Phase 11 (Original Plan - For Reference)

### Phase 11.1: CircuitOperations Tests (HIGH PRIORITY)

**Goal:** Test the largest untested module

**Timeline:** 3-4 hours

**File to Create:**
- `tests/unit/core/CircuitOperations.test.js`

**Test Categories:**

```javascript
describe('CircuitOperations', () => {
    describe('Component Placement', () => {
        it('places component at snapped coordinates');
        it('defines ports for standard gates');
        it('defines ports for custom components');
        it('generates unique component IDs');
    });

    describe('Connections', () => {
        it('creates connection between output and input');
        it('prevents duplicate connections');
        it('removes connections when component deleted');
    });

    describe('Simulation', () => {
        it('throws NoInputsError when no inputs');
        it('throws NoOutputsError when no outputs');
        it('simulates basic AND gate');
        it('simulates complex circuit');
        it('auto-cycles through all input combinations');
    });

    describe('Board Management', () => {
        it('saves current board');
        it('loads saved board');
        it('creates new board');
        it('deletes board');
    });

    describe('Component Library', () => {
        it('saves component to library');
        it('loads component for editing');
        it('exports component to file');
        it('imports component from file');
    });
});
```

**Mocking Strategy:**
- Mock callbacks (redraw, defineComponentPorts, etc.)
- Mock storage adapters
- Use real CircuitState

---

### Phase 11.2 (Original): Interaction Layer Tests

**Goal:** Test user input handling

**Timeline:** 2 hours

**Files to Create:**
- `tests/unit/interaction/CanvasInteraction.test.js`
- `tests/unit/interaction/ComponentDragger.test.js`

**Test Categories:**

```javascript
describe('CanvasInteraction', () => {
    describe('Click Handling', () => {
        it('places component in place mode');
        it('starts connection in connect mode');
        it('completes connection on second click');
        it('deletes component in delete mode');
        it('toggles input value on click');
    });

    describe('Drag Handling', () => {
        it('initiates drag on mousedown');
        it('moves component during drag');
        it('snaps to grid on release');
        it('cancels drag on escape');
    });

    describe('Double Click', () => {
        it('opens rename dialog for INPUT');
        it('opens rename dialog for OUTPUT');
    });
});
```

---

### Phase 11.3: Rendering Layer Tests

**Goal:** Test visual output (snapshot or property-based)

**Timeline:** 2 hours

**Files to Create:**
- `tests/unit/rendering/ComponentRenderer.test.js`
- `tests/unit/rendering/ConnectionRenderer.test.js`

**Approach:** Test that renderer calls correct canvas methods with correct parameters

```javascript
describe('ComponentRenderer', () => {
    it('draws INPUT with correct colors based on value');
    it('draws OUTPUT with correct colors based on value');
    it('draws gates with correct dimensions');
    it('draws custom components with label');
    it('uses dark mode colors when enabled');
});
```

---

### Phase 11.4: UI Component Tests

**Goal:** Test dialog and toolbar behavior

**Timeline:** 2-3 hours

**Files to Create:**
- `tests/unit/ui/DialogManager.test.js`
- `tests/unit/ui/Toolbar.test.js`

**Approach:** Test DOM manipulation and callback invocation

---

## Phase 12: Code Quality Improvements (Optional)

### Phase 12.1: Split Large Files

**Goal:** No file > 500 lines

| File | Lines | Split Into |
|------|-------|------------|
| `CircuitOperations.js` | 1,011 | `PlacementManager.js`, `SimulationManager.js`, `BoardOperations.js` |
| `DialogManager.js` | 965 | `ComponentDialogs.js`, `BoardDialogs.js`, `RenameDialog.js` |
| `TruthTablePanel.js` | 803 | `TruthTableGenerator.js`, `TruthTableDisplay.js` |

### Phase 12.2: Refactor Long Functions

| Function | Lines | Split Into |
|----------|-------|------------|
| `positionPanelSmartly()` | 238 | `findAvailablePosition()`, `calculateOverlap()`, `tryPositions()` |
| `TruthTablePanel.display()` | ~300 | `initializeTable()`, `configureColumns()`, `setupInteractions()` |

### Phase 12.3: Event Bus Migration

**Goal:** Replace callback injection with event-driven pattern

**Current:**
```javascript
this.toolbar = new Toolbar({
    onToolSelect: (tool) => this.handleToolSelect(tool),
    onModeChange: (mode) => this.handleModeChange(mode),
    // ... 10+ callbacks
});
```

**Target:**
```javascript
this.toolbar = new Toolbar();
eventBus.on(EVENT_TYPES.TOOL_SELECTED, (tool) => this.handleToolSelect(tool));
eventBus.on(EVENT_TYPES.MODE_CHANGED, (mode) => this.handleModeChange(mode));
```

---

## Summary: Priority Order

| Phase | Priority | Effort | Impact | Status |
|-------|----------|--------|--------|--------|
| 10.1 Hit Detection | HIGH | 2-3h | Clean coordinator | ✅ Done |
| 10.2 Remove UI from Layers | HIGH | 2h | Testability | ✅ Done |
| 10.3 Constants | MEDIUM | 1-2h | Maintainability | ✅ Done |
| 10.4 Console Cleanup | HIGH | 1h | Production ready | ✅ Done |
| 10.5 Remove Duplicates | MEDIUM | 30m | Single source of truth | ✅ Done |
| 10.6 Move Drag State | MEDIUM | 1h | Clean architecture | ✅ Done |
| 11.1 CircuitOperations Tests | HIGH | 3-4h | Coverage | ✅ Done |
| 11.2 Interaction Tests | MEDIUM | 2h | Coverage | ✅ Done |
| 11.3 Rendering Tests | LOW | 2h | Coverage | ✅ Done |
| 11.4 UI Tests | LOW | 2-3h | Coverage | ✅ Done |
| 12.x Optional | LOW | 4-6h | Polish | Pending |

---

## Success Metrics

After completing Phase 10-11:

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage (modules) | ~75% ✅ | 80% |
| Console.log Statements | 0 ✅ | 0 |
| Hardcoded Colors | 0 ✅ | 0 |
| Separation Violations | 0 ✅ | 0 |
| Files > 800 lines | 3 | 0 (Phase 12) |
| Total Tests | 840 ✅ | - |

---

## Getting Started

```bash
# Create new branch
git checkout -b refactor/v2-cleanup

# Start with Phase 10.1
# Create src/utils/hitDetection.js
# Extract functions from circuit-simulator.js
# Run tests: npm test

# Commit after each sub-phase
git commit -m "Phase 10.1: Extract hit detection utilities"
```

---

**This plan builds on the solid foundation from V1 to achieve full architectural compliance.**
