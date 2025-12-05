# Logic Circuit Simulator - Refactoring Plan V3

**Comprehensive Architecture Improvements After V1 and V2**

---

## Executive Summary

**Goal:** Address remaining architectural issues to achieve cleaner separation of concerns, reduce file sizes, eliminate code duplication, and improve maintainability for faster feature development and debugging.

**Current State:**
- 40 source files, ~7,400 LOC (excluding tests)
- 840+ tests passing (~75% coverage)
- 4 files over 500 lines (TruthTablePanel: 1121, DialogManager: 1090, circuit-simulator: 1000, Toolbar: 659)
- 30+ console.log statements that should use logger utility
- 12 unused event types (legacy)
- 1 architectural violation (DOM in core layer)
- Significant code duplication patterns

**Priorities:**
1. Architecture compliance first (fix violations, reduce duplication)
2. Skip event bus migration for now
3. Split CircuitState.js for faster feature development/debugging
4. Tests for positioning.js as lower priority

**Estimated Effort:** 14-18 hours (2-3 days)

**Risk Level:** Low (incremental improvements, no breaking changes)

---

## Phase 14: Architecture Cleanup

### Phase 14.1: Fix DOM Violation in Core Layer

**Goal:** Remove DOM manipulation from `ComponentLibraryOperations.js`

**Problem:** Lines 133-138 use `document.createElement('a')` to trigger downloads - violates core layer principles.

**Files to Modify:**
- `src/core/ComponentLibraryOperations.js` - Return data instead of triggering download
- `circuit-simulator.js` - Handle file download in coordinator

**Current (violation):**
```javascript
// src/core/ComponentLibraryOperations.js:133-138
const a = document.createElement('a');
a.href = url;
a.download = `${name}.json`;
a.click();
```

**Target:**
```javascript
// Core returns blob URL and filename, UI handles download
async exportComponent(name) {
    const component = await this.componentLibrary.loadComponent(name);
    if (!component) throw new ComponentNotFoundError(name);
    const json = JSON.stringify(component, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    return { name, url, filename: `${name}.json` };
}
```

**Effort:** 30 minutes

---

### Phase 14.2: Extract Component Filtering Utilities

**Goal:** Eliminate 11+ duplicate filtering patterns across core modules

**File to Create:**
- `src/utils/componentFilters.js` (~50 lines)

```javascript
/**
 * Component filtering utilities - single source of truth
 */

export function getInputComponents(components) {
    return components.filter(c => c.type === 'INPUT');
}

export function getOutputComponents(components) {
    return components.filter(c => c.type === 'OUTPUT');
}

export function getGateComponents(components) {
    return components.filter(c => c.type !== 'INPUT' && c.type !== 'OUTPUT');
}

export function sortByLabel(components) {
    return [...components].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

export function getSortedInputs(components) {
    return sortByLabel(getInputComponents(components));
}

export function getSortedOutputs(components) {
    return sortByLabel(getOutputComponents(components));
}

export function getIOCounts(components) {
    return {
        inputCount: getInputComponents(components).length,
        outputCount: getOutputComponents(components).length
    };
}
```

**Files to Modify:**
- `src/core/TruthTableComputer.js` - 4+ replacements
- `src/core/SimulationController.js` - 2+ replacements
- `src/core/circuitEvaluator.js` - 2+ replacements
- `src/core/ComponentLibraryOperations.js` - 1 replacement

**Tests to Create:**
- `tests/unit/utils/componentFilters.test.js` (~80 lines)

**Effort:** 1.5 hours

---

### Phase 14.3: Console Logging Cleanup

**Goal:** Replace 30+ console.log/warn/error with logger utility

**Files to Modify:**

| File | Console Calls | Action |
|------|---------------|--------|
| `src/storage/ComponentLibrary.js` | 9 | Use logger |
| `src/storage/BoardManager.js` | 5 | Use logger |
| `src/storage/LocalStorageAdapter.js` | 5 | Use logger |
| `src/storage/localStorage.js` | 4 | Use logger |
| `src/ui/DialogManager.js` | 2 | Use logger |
| `src/ui/ThemeManager.js` | 1 | Use logger |
| `src/core/ComponentLibraryOperations.js` | 1 | Use logger |

**Pattern:**
```javascript
// Before
console.error('Invalid board name');

// After
import { logger } from '../utils/logger.js';
logger.error('Invalid board name');
```

**Effort:** 1 hour

---

### Phase 14.4: Remove Unused Event Types

**Goal:** Clean up 12 legacy event types that are never used

**File to Modify:**
- `src/utils/eventBus.js`

**Events to Remove:**
```javascript
// Confirmed unused - remove these:
BOARD_DELETED: 'board:deleted',
BOARD_SAVE: 'board:save',
CIRCUIT_CLEARED: 'circuit:cleared',
COMPONENT_VALUE_CHANGED: 'component:valueChanged',
DELETION_PROPOSED: 'circuit:deletionProposed',
DELETION_CONFIRMED: 'circuit:deletionConfirmed',
DELETION_CANCELLED: 'circuit:deletionCancelled',
SIMULATION_RUN: 'simulation:run',
SIMULATION_COMPLETED: 'simulation:completed',
SIMULATION_RESET: 'simulation:reset',
TRUTH_TABLE_GENERATE: 'truthTable:generate',
TRUTH_TABLE_HIDDEN: 'truthTable:hidden',
```

**Effort:** 30 minutes

---

## Phase 15: Split Large Files

### Phase 15.1: Split CircuitState.js (571 → ~350 lines)

**Goal:** Extract truth table and simulation state for faster debugging and cleaner SRP

**CircuitState.js currently has 5 distinct sections:**
1. Component Management (lines 47-129) - ~80 lines
2. Connection Management (lines 155-190) - ~35 lines
3. Mode/Tool Management (lines 191-251) - ~60 lines
4. Custom Components & Boards (lines 253-333) - ~80 lines
5. **Truth Table State** (lines 383-450) - ~70 lines → **EXTRACT**
6. **Simulation State** (lines 452-520) - ~70 lines → **EXTRACT**
7. Bulk Operations (lines 522-571) - ~50 lines

**Files to Create:**

1. **`src/core/TruthTableState.js`** (~100 lines)
```javascript
/**
 * TruthTableState - Manages truth table related state
 * Extracted from CircuitState for SRP and easier debugging
 */
import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';

export class TruthTableState {
    constructor() {
        this.truthTableData = null;
        this.truthTableColumnOrder = null;
        this.truthTableState = null;
        this.truthTableCache = null;
    }

    // All truth table getters/setters from CircuitState
    setTruthTableData(data) { ... }
    getTruthTableData() { ... }
    setTruthTableColumnOrder(order) { ... }
    getTruthTableColumnOrder() { ... }
    setTruthTableState(state) { ... }
    getTruthTableState() { ... }
    setTruthTableCache(cache) { ... }
    getTruthTableCache() { ... }

    reset() {
        this.truthTableData = null;
        this.truthTableColumnOrder = null;
        this.truthTableState = null;
        this.truthTableCache = null;
    }
}
```

2. **`src/core/SimulationState.js`** (~80 lines)
```javascript
/**
 * SimulationState - Manages simulation lifecycle state
 * Extracted from CircuitState for SRP and easier debugging
 */
import { eventBus } from '../utils/eventBus.js';

export class SimulationState {
    constructor() {
        this.isAutoCycling = false;
        this.autoCycleTimeout = null;
        this.currentCycleIndex = 0;
        this.totalCombinations = 0;
    }

    // All simulation getters/setters from CircuitState
    setAutoCycling(isAutoCycling) { ... }
    isAutoCyclingActive() { ... }
    setAutoCycleTimeout(timeout) { ... }
    getAutoCycleTimeout() { ... }
    setCurrentCycleIndex(index) { ... }
    getCurrentCycleIndex() { ... }
    setTotalCombinations(total) { ... }
    getTotalCombinations() { ... }

    reset() {
        this.isAutoCycling = false;
        this.autoCycleTimeout = null;
        this.currentCycleIndex = 0;
        this.totalCombinations = 0;
    }
}
```

**File to Modify:**
- `src/core/CircuitState.js` - Compose TruthTableState and SimulationState

```javascript
// CircuitState.js uses composition
import { TruthTableState } from './TruthTableState.js';
import { SimulationState } from './SimulationState.js';

export class CircuitState {
    constructor() {
        // Core circuit state
        this.components = [];
        this.connections = [];
        this.nextId = 1;
        // ... other core state ...

        // Composed sub-states
        this.truthTable = new TruthTableState();
        this.simulation = new SimulationState();
    }

    // Delegate truth table methods
    getTruthTableCache() { return this.truthTable.getTruthTableCache(); }
    setTruthTableCache(cache) { this.truthTable.setTruthTableCache(cache); }
    // ... etc

    reset() {
        // ... reset core state ...
        this.truthTable.reset();
        this.simulation.reset();
    }
}
```

**Tests to Update:**
- `tests/unit/core/CircuitState.test.js` - Update for composed structure

**Tests to Create:**
- `tests/unit/core/TruthTableState.test.js`
- `tests/unit/core/SimulationState.test.js`

**Effort:** 2.5 hours

---

### Phase 15.2: Split TruthTablePanel (1121 → ~700 lines)

**Goal:** Extract focused modules from the largest UI file

**Files to Create:**

1. **`src/ui/TruthTableHeightCalculator.js`** (~120 lines)
   - `calculateOptimalHeight(rowCount, containerHeight)`
   - `applyTableHeight(table, height)`
   - `reapplyRowHeights(table)`
   - Row distribution logic

2. **`src/ui/TruthTableStateManager.js`** (~100 lines)
   - `saveState(panel)` → returns state object
   - `restoreState(panel, state)` → applies state
   - `validateState(state, viewport)` → sanitizes bounds
   - `getDefaultState()` → returns default state

3. **`src/ui/TruthTableInteractionHandler.js`** (~120 lines)
   - `setupInteractions(panel, options)` - Interact.js setup
   - `dragMoveListener(event)` - Panel drag handler
   - `resizeMoveListener(event)` - Panel resize handler
   - `destroy()` - Cleanup

**File to Modify:**
- `src/ui/TruthTablePanel.js` - Import and compose extracted modules

**Effort:** 3 hours

---

### Phase 15.3: Split DialogManager (1090 → ~650 lines)

**Goal:** Extract dialog-specific logic into separate files

**Files to Create:**

1. **`src/ui/dialogs/HelpDialogContent.js`** (~50 lines)
   - Export help HTML as template literal constant
   - Currently 200+ lines of HTML strings in `_createHelpDialog()`

2. **`src/ui/dialogs/SaveOptionsDialog.js`** (~120 lines)
   - `create()` - Creates dialog element
   - `setupEventListeners(callbacks)` - Sets up event handlers
   - Contains complex branching logic for save workflow

3. **`src/ui/dialogs/ManageComponentsDialog.js`** (~100 lines)
   - `create()` - Creates dialog element
   - `updateList(components, callbacks)` - Updates component list
   - Library rendering logic

**File to Modify:**
- `src/ui/DialogManager.js` - Import and delegate to extracted modules

**Effort:** 2.5 hours

---

### Phase 15.4: Reduce circuit-simulator.js (1000 → ~750 lines)

**Goal:** Extract port definition logic from coordinator

**File to Create:**
- `src/core/PortDefinitionManager.js` (~80 lines)

```javascript
/**
 * PortDefinitionManager - Defines port positions for components
 */
import { PORT_CONFIG, GATE_SIZES } from '../constants.js';

export function defineComponentPorts(component, customComponents) {
    const portConfig = PORT_CONFIG[component.type];
    if (!portConfig && component.type !== 'CUSTOM') {
        return;
    }

    // Port definition logic extracted from circuit-simulator.js
    // Currently at lines 562-607
}
```

**File to Modify:**
- `circuit-simulator.js` - Import and use PortDefinitionManager

**Tests to Create:**
- `tests/unit/core/PortDefinitionManager.test.js`

**Effort:** 1.5 hours

---

## Phase 16: Test Coverage (Lower Priority)

### Phase 16.1: Add Tests for positioning.js

**Goal:** Test the 250-line complex panel positioning algorithm

**File to Create:**
- `tests/unit/utils/positioning.test.js` (~200 lines)

**Test Cases:**
- `positionPanelSmartly()` with various canvas sizes
- Panel larger than canvas edge case
- Component avoidance logic
- Overlap calculation accuracy
- Boundary validation

**Effort:** 2 hours

---

### Phase 16.2: Add Tests for New Extracted Modules

**Files to Create:**
- `tests/unit/core/TruthTableState.test.js`
- `tests/unit/core/SimulationState.test.js`
- `tests/unit/core/PortDefinitionManager.test.js`
- `tests/unit/ui/TruthTableHeightCalculator.test.js`
- `tests/unit/ui/TruthTableStateManager.test.js`

**Effort:** 2.5 hours

---

## Phase 17: Documentation Updates

### Phase 17.1: Update Architecture Documentation

**Files to Modify:**
- `ARCHITECTURE.md` - Add new modules, update module breakdown table
- `CLAUDE.md` - Update with new patterns and file locations
- `REFACTORING_PLAN_V2.md` - Mark as superseded, reference V3

**New content to add:**
- TruthTableState and SimulationState composition pattern
- Component filters utility usage
- PortDefinitionManager usage

**Effort:** 1 hour

---

## Summary: Prioritized Task Order

| # | Phase | Priority | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | 14.1 DOM Violation Fix | CRITICAL | 30m | Architecture compliance |
| 2 | 14.2 Component Filters | HIGH | 1.5h | Eliminate 11+ duplicates |
| 3 | 15.1 Split CircuitState | HIGH | 2.5h | Faster debugging |
| 4 | 14.3 Console Cleanup | MEDIUM | 1h | Code quality |
| 5 | 15.2 Split TruthTablePanel | HIGH | 3h | Maintainability |
| 6 | 15.3 Split DialogManager | HIGH | 2.5h | Maintainability |
| 7 | 15.4 Reduce circuit-simulator | MEDIUM | 1.5h | Clarity |
| 8 | 14.4 Unused Events | LOW | 30m | Dead code removal |
| 9 | 16.1 positioning.js Tests | LOW | 2h | Test coverage |
| 10 | 16.2 New Module Tests | MEDIUM | 2.5h | Test coverage |
| 11 | 17.1 Documentation | LOW | 1h | Documentation |

**Total Estimated Effort:** ~18 hours

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Files > 800 lines | 3 | 0 |
| Files > 500 lines | 4 | 2 (Toolbar, DialogManager ok) |
| CircuitState.js lines | 571 | ~350 |
| Console.log statements | 30+ | 0 (use logger) |
| Unused event types | 12 | 0 |
| DOM in core layer | 1 violation | 0 |
| Duplicate filter patterns | 11+ | 0 |

---

## Files to Create (Summary)

| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/componentFilters.js` | ~50 | Component filtering utilities |
| `src/core/TruthTableState.js` | ~100 | Truth table state management |
| `src/core/SimulationState.js` | ~80 | Simulation state management |
| `src/core/PortDefinitionManager.js` | ~80 | Port position calculation |
| `src/ui/TruthTableHeightCalculator.js` | ~120 | Table height logic |
| `src/ui/TruthTableStateManager.js` | ~100 | Panel state persistence |
| `src/ui/TruthTableInteractionHandler.js` | ~120 | Interact.js integration |
| `src/ui/dialogs/HelpDialogContent.js` | ~50 | Help dialog HTML template |
| `src/ui/dialogs/SaveOptionsDialog.js` | ~120 | Save options dialog |
| `src/ui/dialogs/ManageComponentsDialog.js` | ~100 | Manage components dialog |
| `tests/unit/utils/componentFilters.test.js` | ~80 | Filter utilities tests |
| `tests/unit/utils/positioning.test.js` | ~200 | Positioning tests |
| `tests/unit/core/TruthTableState.test.js` | ~100 | Truth table state tests |
| `tests/unit/core/SimulationState.test.js` | ~80 | Simulation state tests |
| `tests/unit/core/PortDefinitionManager.test.js` | ~100 | Port definition tests |

---

## Files to Modify (Summary)

**Core Layer:**
- `src/core/CircuitState.js` - Compose sub-states, reduce to ~350 lines
- `src/core/ComponentLibraryOperations.js` - Remove DOM, use filters
- `src/core/TruthTableComputer.js` - Use componentFilters
- `src/core/SimulationController.js` - Use componentFilters
- `src/core/circuitEvaluator.js` - Use componentFilters

**UI Layer:**
- `src/ui/TruthTablePanel.js` - Extract modules, reduce to ~700 lines
- `src/ui/DialogManager.js` - Extract dialogs, reduce to ~650 lines

**Storage Layer:**
- `src/storage/BoardManager.js` - Use logger (5 replacements)
- `src/storage/ComponentLibrary.js` - Use logger (9 replacements)
- `src/storage/LocalStorageAdapter.js` - Use logger (5 replacements)
- `src/storage/localStorage.js` - Use logger (4 replacements)

**Utils:**
- `src/utils/eventBus.js` - Remove 12 unused event types

**Coordinator:**
- `circuit-simulator.js` - Handle DOM export, use PortDefinitionManager

**Documentation:**
- `ARCHITECTURE.md` - Update with new modules
- `CLAUDE.md` - Update patterns and file locations

---

## Notes

- **Event bus migration skipped** - Toolbar/DialogManager callbacks remain for now (can be Phase 18 in future)
- **CircuitState split uses composition** - Not inheritance, keeps backward compatibility
- **Tests run after each phase** - Ensure no regressions
