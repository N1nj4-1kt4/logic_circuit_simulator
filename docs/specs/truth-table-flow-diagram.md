# Truth Table System - Complete Flow Diagram

## Status: COMPLETE ✓

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRUTH TABLE SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌───────────────────┐    ┌────────────────────┐   │
│  │   Toolbar    │    │  TruthTablePanel  │    │CircuitAnalysisManager│  │
│  │  (UI Entry)  │    │   (UI Rendering)  │    │   (Computation)    │   │
│  └──────┬───────┘    └─────────┬─────────┘    └──────────┬─────────┘   │
│         │                      │                         │              │
│         │                      │                         │              │
│         └──────────────────────┼─────────────────────────┘              │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    │     CircuitState      │                            │
│                    │   (State Container)   │                            │
│                    │  - circuitAnalysis    │                            │
│                    │  - truthTablePanelState│                           │
│                    └───────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Separation of Concerns:**
- **CircuitAnalysisManager** = Computation engine (WHAT data to compute)
- **TruthTablePanel** = UI rendering (HOW to display)
- **CircuitState** = State container (WHERE data lives)
- **Event Bus** = Communication glue (HOW they talk)

---

## 2. USER CLICKS "TRUTH TABLE" BUTTON - COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER CLICKS "📊 Truth Table" BUTTON                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  index.html:118                                                          │
│  <button id="truthTable">📊 Truth Table</button>                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Toolbar.js:259-263                                                      │
│  Button click handler → calls this.onTruthTable() callback              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  circuit-simulator.js:103                                                │
│  Callback defined: onTruthTable: () => this.handleTruthTable()          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  circuit-simulator.js:336-339                                            │
│  handleTruthTable() → this.generateTruthTable()                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  circuit-simulator.js:756-790   generateTruthTable()                    │
│                                                                          │
│  1. Create TruthTablePanel if needed (first time or DOM removed)        │
│  2. Hook up state persistence callback (onStateChange)                   │
│  3. Restore saved state from CircuitState (position, size, columns)     │
│  4. Call panel.show() ◄─────────────────── NEW METHOD                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TruthTablePanel.show()                                                  │
│                                                                          │
│  Lifecycle: Constructor → init(savedState) → show() → _renderTabulator()│
│             → hide() → destroy()                                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  if (this.tabulatorInstance && this.panel) {                    │    │
│  │      // FAST PATH: Tabulator exists                             │    │
│  │      if (_tabulatorNeedsSync) {  ◄── Dirty flag check           │    │
│  │          await _syncTabulatorWithAnalysis()                     │    │
│  │          _tabulatorNeedsSync = false                            │    │
│  │      }                                                          │    │
│  │      panel.classList.remove('hidden')                           │    │
│  │      panel.style.display = 'block'                              │    │
│  │      panel.style.opacity = '1'                                  │    │
│  │      _updateHighlight()                                         │    │
│  │      emit(TRUTH_TABLE_SHOWN)                                    │    │
│  │      return  ◄──────────── Fast (syncs only if dirty)           │    │
│  │  }                                                              │    │
│  │                                                                 │    │
│  │  // SLOW PATH: No Tabulator exists, need to build               │    │
│  │  _setCircuitAnalysisLocalCopy()  // Sets this.circuitAnalysis   │    │
│  │  await _renderTabulator()                                       │    │
│  │  _tabulatorNeedsSync = false  // Fresh table is in sync         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────┬──────────────────────────────┬───────────────────────┘
                   │                              │
        ┌──────────┴──────────┐        ┌─────────┴─────────┐
        │   FAST PATH         │        │    SLOW PATH      │
        │  (2nd+ opens)       │        │   (1st open)      │
        └──────────┬──────────┘        └─────────┬─────────┘
                   │                             │
                   ▼                             ▼
        ┌─────────────────────┐      ┌─────────────────────────────────┐
        │  If _tabulatorNeeds │      │  _setCircuitAnalysisLocalCopy() │
        │  Sync: sync first,  │      │  - Load cache data              │
        │  then reveal panel  │      │  Sets this.circuitAnalysis:     │
        └─────────────────────┘      │  - Cache exists → deep copy it  │
                                     │  - No cache → placeholder with  │
                                     │    reason: 'Computing...'       │
                                     └───────────────┬─────────────────┘
                                                     │
                                                     ▼
                                     ┌─────────────────────────────────┐
                                     │  _renderTabulator() - Create    │
                                     │  Tabulator (async, returns      │
                                     │  Promise<void>)                 │
                                     │                                 │
                                     │  Uses pure functions from       │
                                     │  truthTableUtils.js:            │
                                     │  • buildTruthTableColumns()     │
                                     │  • calculateRowLayout()         │
                                     │  • clampPanelPosition()         │
                                     │                                 │
                                     │  1. Destroy old table if exists │
                                     │  2. Apply saved dimensions      │
                                     │  3. Create Tabulator with ALL   │
                                     │     data (virtual DOM handles   │
                                     │     large datasets)             │
                                     │  4. tableBuilt callback:        │
                                     │     - _updateHighlight()        │
                                     │     - _applyTableHeight()       │
                                     │     - _applyTableWidth()        │
                                     │     - _saveState() (if not      │
                                     │       restoring)                │
                                     │     - resolve()  ◄── Promise    │
                                     │       resolves here             │
                                     │                                 │
                                     │  Then show() handles common     │
                                     │  post-render for ALL paths:     │
                                     │  - _positionPanelIfNeeded()     │
                                     │  - _setupInteractions()         │
                                     │  - panel.style.opacity = '1'    │
                                     │  - emit(TRUTH_TABLE_SHOWN)      │
                                     └─────────────────────────────────┘
```

---

## 3. BACKGROUND COMPUTATION - AUTOMATIC RECOMPUTATION

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CIRCUIT CHANGES (User adds/removes/moves components or wires)          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Events emitted by CircuitState/CircuitOperations:                      │
│  - BOARD_CHANGED (structure change)                                     │
│  - COMPONENT_LABEL_CHANGED (label edit)                                 │
│  - BOARD_LOADED (load/revert)                                           │
│  - BOARD_CLEARED (new board)                                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CircuitAnalysisManager - Event Handlers                                │
│                                                                          │
│  BOARD_CHANGED ──────────► _handleBoardChanged()                        │
│  COMPONENT_LABEL_CHANGED ► _handleLabelChanged()     ──┐                │
│  BOARD_LOADED ───────────► _handleBoardLoaded()        │                │
│  BOARD_CLEARED ──────────► _handleBoardCleared()       │                │
│                                                        │                │
│                                          ┌─────────────┘                │
│                                          ▼                              │
│                           _debouncedRecomputeAnalysis()                 │
│                           (200ms debounce via TIMING.TRUTH_TABLE_DEBOUNCE)
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  recomputeAnalysis()                                                    │
│                                                                          │
│  Count inputs → numCombinations = 2^inputCount                          │
│                                                                          │
│  ┌────────────────────────────────┬────────────────────────────────┐    │
│  │  numCombinations ≤ 256         │  numCombinations > 256         │    │
│  │  (≤8 inputs, ≤256 rows)        │  (9+ inputs, 512+ rows)        │    │
│  │                                │                                │    │
│  │  _recomputeAnalysisSync()      │  _recomputeAnalysisAsync()     │    │
│  │  - Immediate computation       │  - Clear cache (triggers       │    │
│  │  - No progress events          │    "computing" state)          │    │
│  │                                │  - Compute in chunks (64 rows) │    │
│  │                                │  - Emit CIRCUIT_ANALYSIS_      │    │
│  │                                │    COMPUTING with { percent,   │    │
│  │                                │    current, total }            │    │
│  │                                │  - Yield to browser between    │    │
│  │                                │    chunks (setTimeout 0)       │    │
│  └────────────────┬───────────────┴────────────────┬───────────────┘    │
│                   │                                │                    │
│                   └────────────────┬───────────────┘                    │
│                                    ▼                                    │
│                    _handleComputationResult(result)                     │
│                    1. state.setCircuitAnalysis(result)  ◄── ALWAYS      │
│                    2. if (result.isValid):                              │
│                       emit(CIRCUIT_ANALYSIS_COMPUTED, result)           │
│                       ◄── Only fires for VALID circuits                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
        ▼                                                          ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│ _handleComputed() ALWAYS runs:          │  │ If panel VISIBLE:               │
│                                         │  │                                 │
│ 1. Syncs circuitAnalysis (deep copy)   │  │ - Also updates Tabulator        │
│ 2. If panel hidden: returns early       │  │ - Smart update detection        │
│ 3. show() fast path has current data   │  │ - (see Section 4)               │
└─────────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 4. PANEL UPDATE - WHEN DATA CHANGES (VIA _handleComputed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CIRCUIT_ANALYSIS_COMPUTED event received by TruthTablePanel            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _handleComputed() (async) - ALL update logic consolidated here         │
│                                                                          │
│  KEY CHANGE: Always syncs circuitAnalysis, even when panel is hidden.   │
│  This ensures show() fast path always has current data.                 │
│                                                                          │
│  1. _hideProgress() - remove progress bar if showing                    │
│  2. Get analysis from circuitState                                       │
│  3. If !analysis: return                                                 │
│  4. ALWAYS: this.circuitAnalysis = _deepCopyAnalysis(analysis) ◄── KEY │
│  5. If !_isVisible(): return  (data synced, but no UI update needed)   │
│  6. Smart update detection (comparing old vs new analysis):             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Smart update detection within _handleComputed():                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  STRUCTURE CHANGED? (input/output count different)               │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Full rebuild required                                     │   │
│  │        - _saveState() (preserve position)                        │   │
│  │        - Clear saved dimensions (auto-fit new content)           │   │
│  │        - await _renderTabulator() (recreate Tabulator)           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  LABELS CHANGED? (same structure, different labels)              │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Update column headers only                                │   │
│  │        - _updateColumnHeaders() (uses setColumns())              │   │
│  │        - _reapplyRowHeights()  ◄── setColumns() resets styles   │   │
│  │        - _updateHighlight()    ◄── setColumns() clears selection│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DATA ONLY CHANGED? (same structure, same labels)                │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Fast data update                                          │   │
│  │        - tabulatorInstance.setData(newData) ◄── Tabulator fast  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. HIDE / CLOSE FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER CLICKS CLOSE BUTTON (or BOARD_CLEARED event)                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  hide() (lines 1142-1151)                                               │
│                                                                          │
│  1. _saveState() - BEFORE hiding (position becomes 0 after display:none)│
│  2. panel.style.opacity = '0'                                           │
│  3. panel.style.pointerEvents = 'none'                                  │
│  4. panel.classList.add('hidden')                                       │
│  5. panel.style.display = 'none'                                        │
│                                                                          │
│  NOTE: Tabulator instance is PRESERVED (this.tabulatorInstance exists)  │
│        This is the KEY OPTIMIZATION - no rebuild on next show()         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. STATE PERSISTENCE FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER DRAGS/RESIZES PANEL or REORDERS COLUMNS                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Interact.js event handlers (_dragMoveListener / _resizeMoveListener)   │
│  or Tabulator columnMoved event                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _saveState()                                                           │
│                                                                          │
│  Captures: { columnOrder, width, height, x, y, visible }               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  this.onStateChange(state)  ◄── callback set in circuit-simulator.js   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  circuitState.setTruthTablePanelState(state)                            │
│  → emits TRUTH_TABLE_PANEL_STATE_CHANGED                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AutoSaveManager picks up change → saves to localStorage               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. EVENT MAP - WHO EMITS / WHO LISTENS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVENT BUS FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

CIRCUIT_ANALYSIS_COMPUTING
├── Emitted by: CircuitAnalysisManager._recomputeAnalysisAsync()
├── Payload: { percent, current, total }
└── Listened by: TruthTablePanel._handleComputing() → shows progress bar

CIRCUIT_ANALYSIS_COMPUTED  ◄── Only fires for VALID circuits
├── Emitted by: CircuitAnalysisManager._handleComputationResult() (when isValid)
├── Payload: { inputs, outputs, table, isValid, reason } (isValid always true)
└── Listened by: TruthTablePanel._handleComputed()
    - Always syncs circuitAnalysis (even when panel hidden)
    - Updates Tabulator when panel is visible
    - Can assume isValid === true (invalid handled by CIRCUIT_VALIDITY_CHANGED)

TRUTH_TABLE_SHOWN
├── Emitted by: TruthTablePanel.show() (inlined at end of all paths):
│   - show() fast path (table already exists) - emits directly
│   - show() slow path - emits after common post-render setup
├── Payload: (none)
└── Listened by: (internal tracking)

TRUTH_TABLE_PANEL_STATE_CHANGED
├── Emitted by: CircuitState.setTruthTablePanelState()
├── Payload: { state }
└── Listened by: AutoSaveManager → triggers save

BOARD_CHANGED
├── Emitted by: CircuitState (on component/connection changes)
└── Listened by: CircuitAnalysisManager._handleBoardChanged() → recompute

COMPONENT_LABEL_CHANGED
├── Emitted by: CircuitState
└── Listened by: CircuitAnalysisManager._handleLabelChanged() → recompute

BOARD_LOADED
├── Emitted by: CircuitOperations
└── Listened by: CircuitAnalysisManager._handleBoardLoaded() → recompute

BOARD_CLEARED
├── Emitted by: CircuitOperations
└── Listened by: CircuitAnalysisManager._handleBoardCleared() → clear cache

SIMULATION_STEP_COMPLETED
├── Emitted by: Simulation system
└── Listened by: TruthTablePanel._handleStepCompleted() → _highlightRowByIndex()

CIRCUIT_VALIDITY_CHANGED
├── Emitted by: CircuitValidityManager
└── Listened by: TruthTablePanel._handleValidityChanged()
    - PRIMARY handler for invalid states
    - Shows invalid message IMMEDIATELY (no debounce)
    - CIRCUIT_ANALYSIS_COMPUTED will NOT fire for invalid circuits
```

---

## 8. DATA STRUCTURES

### Naming Clarification: tabulatorInstance vs circuitAnalysis.table
```
┌─────────────────────────────────────────────────────────────────────────┐
│  IMPORTANT NAMING DISTINCTION                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  tabulatorInstance = Tabulator.js library instance (UI component)        │
│                      - Created in _renderTabulator()                    │
│                      - Has methods: .setData(), .destroy(), etc.        │
│                      - Renders the visual grid                          │
│                                                                          │
│  circuitAnalysis.table = Truth table data array                         │
│                          - Array of row objects [{input0, output0,...}] │
│                          - Pure data, no UI concerns                    │
│                          - Passed to tabulatorInstance.setData()        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Circuit Analysis Object (CircuitState.circuitAnalysis)
```javascript
{
    inputs: [
        { id: 'comp_1', label: 'A', value: 0, type: 'INPUT', ... },
        { id: 'comp_2', label: 'B', value: 0, type: 'INPUT', ... }
    ],
    outputs: [
        { id: 'comp_3', label: 'Y', value: 0, type: 'OUTPUT', ... }
    ],
    table: [
        { input0: 0, input1: 0, output0: 0, componentValues: {...} },
        { input0: 0, input1: 1, output0: 1, componentValues: {...} },
        { input0: 1, input1: 0, output0: 1, componentValues: {...} },
        { input0: 1, input1: 1, output0: 1, componentValues: {...} }
        // 2^n rows for n inputs
    ],
    isValid: true,
    reason: null  // or error message if invalid
}
```

### Panel State Object (CircuitState.truthTablePanelState)
```javascript
{
    columnOrder: ['input0', 'input1', 'output0'],  // User's column arrangement
    width: '500px',
    height: '400px',
    x: 150,        // Transform translate X
    y: 200,        // Transform translate Y
    visible: true
}
```

---

## 9. PERFORMANCE CHARACTERISTICS

| Scenario | Time | Reason |
|----------|------|--------|
| **1st open (small circuit)** | ~100ms | Tabulator init + virtual DOM |
| **1st open (15 inputs, 32K rows)** | ~2-3s | Tabulator processes all rows at init |
| **2nd+ open (any size)** | **~0ms** | **show() just reveals existing table** |
| **Data update while visible** | ~50-100ms | table.setData() optimized |
| **Structure change while visible** | ~2-3s | Full Tabulator rebuild required |
| **Background computation (small)** | ~10ms | Sync, no events |
| **Background computation (large)** | ~2-3s | Async with progress, debounced |

---

## 10. KEY CHANGES MADE (SUMMARY)

### Refactored: TruthTablePanel Architecture (Latest)

**Lifecycle symmetry with `init()` method:**
```
Constructor → init(savedState) → show() → _renderTabulator() → hide() → destroy()
```

**Method renames for clarity:**
| Old Name | New Name | Reason |
|----------|----------|--------|
| `display()` | `_renderTabulator()` | Internal, builds Tabulator, returns Promise<void> |
| `displayInvalidMessage()` | `_renderInvalidState()` | Internal, shows error, sync |
| `displayComputingMessage()` | `_renderComputingState()` | Internal, shows progress, sync |

**Extracted pure functions for testability:**
All utility functions consolidated into `src/utils/truthTableUtils.js`:

| Section | Functions | Tests |
|---------|-----------|-------|
| Column Definitions | `buildTruthTableColumns()` | 19 tests |
| Table Layout | `calculateRowLayout()`, `calculateTableLayout()` | 20 tests |
| Panel Bounds | `clampPanelPosition()`, `clampDimension()`, `sanitizePosition()` | 25 tests |
| Row Search | `inputValuesToIndex()`, `indexToInputValues()` | 12 tests |

Test file: `tests/unit/utils/truthTableUtils.test.js` (85 tests total)

**Section organization:** Added 10 clear section comment blocks in TruthTablePanel.js

**Extracted internal helper methods (latest refactoring):**

| Helper Method | Consolidated From | Purpose |
|---------------|-------------------|---------|
| `_positionPanelIfNeeded(wasVisible)` | show() | Smart panel positioning (smart position or restore) |
| `_deepCopyAnalysis(analysis)` | 5+ locations | Deep copy of circuitAnalysis to prevent reference issues |
| `_applyRowStyles(content, rowHeight)` | 2 locations | Apply consistent row/cell styles |
| `_setupInteractions()` | Made idempotent | Guard inside method (safe to call multiple times) |

**async/await refactoring:**
- `show()` is now `async show()` and uses `await _renderTabulator()`
- `_renderTabulator()` returns `Promise<void>` that resolves when `tableBuilt` fires
- Common post-render setup is inlined in `show()` for ALL paths (not duplicated in render methods)
- `_handleComputed()` is also async

**refresh() method removed:**
- All update logic consolidated into `_handleComputed()`
- `_handleComputed()` ALWAYS syncs `circuitAnalysis` (even when panel is hidden)
- This ensures `show()` fast path always has current data
- External event listener in `circuit-simulator.js` was also removed (no longer needed)

**Key architectural pattern:**
Render methods (`_renderTabulator`, `_renderInvalidState`, `_renderComputingState`) now ONLY handle content.
The caller (`show()`) handles all common post-render setup:
1. `_positionPanelIfNeeded(wasVisible)` - positioning
2. `_setupInteractions()` - drag/resize (idempotent)
3. `panel.style.opacity = '1'` - reveal
4. `eventBus.emit(TRUTH_TABLE_SHOWN)` - notify listeners

### Added: `show()` method in TruthTablePanel
- Fast path: if table exists, just reveal panel (instant)
- Slow path: if no table, call `_setCircuitAnalysisLocalCopy()` + `await _renderTabulator()`

### Removed: Progressive Loading
- Was loading initial 100 rows, then adding 500 at a time
- Unnecessary because Tabulator virtual DOM already handles large datasets
- The bottleneck was Tabulator INIT, not rendering

### Changed: circuit-simulator.js
- Now calls `panel.init(savedState)` during initialization
- Then calls `panel.show()` instead of `_setCircuitAnalysisLocalCopy()` + `display()`

### Preserved: Async Computation
- CircuitAnalysisManager still uses async for 8+ inputs
- Progress bar shows during computation (rare)
- This is separate from panel display
