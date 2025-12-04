# Logic Circuit Simulator - Refactoring Plan V2

**Post-Phase 9 Architecture Improvements**

---

## Executive Summary

**Goal:** Address remaining architectural issues identified after the initial refactoring (Phases 0-9) to achieve full adherence to the refactoring principles.

**Current State:**
- 77% reduction in main file achieved
- 28 modular source files (added hitDetection.js)
- 545 tests passing (~55% coverage by module)
- Event bus foundation in place
- Phase 10.1 completed ✅

**Remaining Work:**
- 3 separation of concerns violations
- 119 console.log statements to clean up
- ~55% test coverage (critical modules untested)
- Event bus underutilized

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

### Phase 10.2: Remove UI from Storage/Business Layers

**Goal:** Storage and business logic should not import or use UI components

**Timeline:** 2 hours

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

### Phase 10.3: Complete Constants Extraction

**Goal:** Extract all remaining magic values to constants.js

**Timeline:** 1-2 hours

**Files to Modify:**

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

### Phase 10.4: Console Logging Cleanup

**Goal:** Remove debug logging from production code

**Timeline:** 1 hour

**Option A: Remove All (Recommended for Production)**

Files to clean:
| File | Statements to Remove |
|------|---------------------|
| `src/ui/TruthTablePanel.js` | 86 |
| `src/core/CircuitOperations.js` | 22 |
| `src/utils/positioning.js` | 11 |

**Option B: Create Logger Service (If Debug Mode Needed)**

Create `src/utils/logger.js`:

```javascript
// src/utils/logger.js

const DEBUG = import.meta.env.DEV; // Only log in development

export const logger = {
    debug: (...args) => DEBUG && console.log('[DEBUG]', ...args),
    info: (...args) => DEBUG && console.info('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
};
```

Then replace `console.log` with `logger.debug` where needed.

**Success Criteria:**
- No `console.log` in production builds
- Errors still logged (console.error acceptable)
- Optional: Debug mode available in development

---

### Phase 10.5: Remove Duplicate Logic

**Goal:** Single source of truth for shared logic

**Timeline:** 30 minutes

**Duplicates to Remove:**

1. **`getNextBoardName()` duplication:**
   - Keep: `src/storage/BoardManager.js` (lines 217-230)
   - Remove: `src/ui/DialogManager.js` (lines 947-964)
   - Update: DialogManager to call `boardManager.getNextBoardName()`

2. **Component dimensions duplication:**
   - Already in: `src/constants.js` as `GATE_SIZES`
   - Remove duplicates from:
     - `src/utils/geometry.js` (lines 76-84)
     - `src/utils/positioning.js` (lines 56-75)
   - Create helper function:

```javascript
// Add to src/utils/geometry.js
import { GATE_SIZES } from '../constants.js';

/**
 * Get component dimensions by type
 * @param {string} type - Component type
 * @returns {{width: number, height: number, halfWidth: number, halfHeight: number}}
 */
export function getComponentDimensions(type) {
    return GATE_SIZES[type] || GATE_SIZES.CUSTOM;
}
```

**Success Criteria:**
- No duplicate function implementations
- Single source of truth for dimensions

---

### Phase 10.6: Move Drag State to Interaction Layer

**Goal:** UI interaction state should not be in core circuit state

**Timeline:** 1 hour

**Files to Modify:**

1. **`src/core/CircuitState.js`** - Remove drag properties (lines 43-48):
   ```javascript
   // REMOVE these properties:
   this.isDraggingComponent = false;
   this.draggedComponent = null;
   this.dragOffset = { x: 0, y: 0 };
   this.dragStartPos = { x: 0, y: 0 };
   this.hasMoved = false;
   ```

2. **`src/interaction/CanvasInteraction.js`** - Add local drag state:
   ```javascript
   constructor(config) {
       // ... existing code ...

       // Drag state (local to interaction layer)
       this.dragState = {
           isDragging: false,
           component: null,
           offset: { x: 0, y: 0 },
           startPos: { x: 0, y: 0 },
           hasMoved: false
       };
   }
   ```

3. **`src/interaction/ComponentDragger.js`** - Update to use local state

**Success Criteria:**
- CircuitState contains only circuit-related state
- Drag functionality unchanged
- All tests pass

---

## Phase 11: Test Coverage Expansion

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

### Phase 11.2: Interaction Layer Tests

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
| 10.2 Remove UI from Layers | HIGH | 2h | Testability | Pending |
| 10.4 Console Cleanup | HIGH | 1h | Production ready | Pending |
| 10.3 Constants | MEDIUM | 1-2h | Maintainability | Pending |
| 10.5 Remove Duplicates | MEDIUM | 30m | Single source of truth | Pending |
| 10.6 Move Drag State | MEDIUM | 1h | Clean architecture | Pending |
| 11.1 CircuitOperations Tests | HIGH | 3-4h | Coverage | Pending |
| 11.2 Interaction Tests | MEDIUM | 2h | Coverage | Pending |
| 11.3 Rendering Tests | LOW | 2h | Coverage | Pending |
| 11.4 UI Tests | LOW | 2-3h | Coverage | Pending |
| 12.x Optional | LOW | 4-6h | Polish | Pending |

---

## Success Metrics

After completing Phase 10-11:

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage (modules) | 50% | 80% |
| Console.log Statements | 119 | 0 |
| Hardcoded Colors | ~30 | 0 |
| Separation Violations | 3 | 0 |
| Files > 800 lines | 3 | 0 (Phase 12) |

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
