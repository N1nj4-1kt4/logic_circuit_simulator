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
│  TruthTablePanel.show() - NEW METHOD (lines 1222-1246)                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  if (this.table && this.panel) {                                │    │
│  │      // FAST PATH: Table already exists, just reveal it         │    │
│  │      panel.classList.remove('hidden')                           │    │
│  │      panel.style.display = 'block'                              │    │
│  │      panel.style.opacity = '1'                                  │    │
│  │      updateHighlight()                                          │    │
│  │      emit(TRUTH_TABLE_SHOWN)                                    │    │
│  │      return true  ◄──────────────── INSTANT! No rebuild         │    │
│  │  }                                                              │    │
│  │                                                                 │    │
│  │  // SLOW PATH: No table exists, need to build                   │    │
│  │  if (!generate()) return false                                  │    │
│  │  display()                                                      │    │
│  │  return true                                                    │    │
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
        │  Panel revealed     │      │  generate() - Load cache data   │
        │  instantly!         │      │                                 │
        │  (~0ms)             │      │  Check circuitState cache:      │
        └─────────────────────┘      │  - Cache exists → use it        │
                                     │  - Computing → return 'computing'│
                                     │  - No cache → return false       │
                                     └───────────────┬─────────────────┘
                                                     │
                                                     ▼
                                     ┌─────────────────────────────────┐
                                     │  display() - Create Tabulator   │
                                     │                                 │
                                     │  1. Destroy old table if exists │
                                     │  2. Apply saved position/size   │
                                     │  3. Show panel (opacity: 0)     │
                                     │  4. Create Tabulator with ALL   │
                                     │     data (virtual DOM handles   │
                                     │     large datasets)             │
                                     │  5. tableBuilt callback:        │
                                     │     - Setup drag/resize         │
                                     │     - Position smartly          │
                                     │     - Apply dimensions          │
                                     │     - Reveal (opacity: 1)       │
                                     │  6. emit(TRUTH_TABLE_SHOWN)     │
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
│                    1. state.setCircuitAnalysis(result)                  │
│                    2. emit(CIRCUIT_ANALYSIS_COMPUTED, result)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐
│ If panel HIDDEN:  │  │ If panel VISIBLE:       │  │ circuit-simulator   │
│ Cache stored,     │  │ _handleComputed()       │  │ also listens for    │
│ ready for next    │  │ triggers refresh logic  │  │ backward compat     │
│ show()            │  │ (see Section 4)         │  │                     │
└───────────────────┘  └─────────────────────────┘  └─────────────────────┘
```

---

## 4. PANEL REFRESH - WHEN DATA CHANGES WHILE VISIBLE

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRUTH_TABLE_COMPUTED event received by TruthTablePanel                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _handleComputed() (lines 127-153)                                      │
│                                                                          │
│  1. _hideProgress() - remove progress bar if showing                    │
│  2. If panel visible:                                                    │
│     - Get cache from circuitState                                       │
│     - Update this.circuitAnalysis                                        │
│     - If table exists: table.setData(newData)  ◄── FAST UPDATE         │
│     - If no table (was showing "computing"): display()                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  refresh() - Smart update detection (lines 1028-1120)                   │
│                                                                          │
│  Compare old circuitAnalysis with new cache:                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  STRUCTURE CHANGED? (input/output count different)               │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Full rebuild required                                     │   │
│  │        - saveState() (preserve position)                         │   │
│  │        - Clear saved dimensions (auto-fit new content)           │   │
│  │        - display() (recreate Tabulator)                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  LABELS CHANGED? (same structure, different labels)              │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Update column headers only                                │   │
│  │        - _updateColumnHeaders()                                  │   │
│  │        - table.setData(newData)                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DATA ONLY CHANGED? (same structure, same labels)                │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → Fast data update                                          │   │
│  │        - table.setData(newData)  ◄── Tabulator optimizes this   │   │
│  │        - updateHighlight()                                       │   │
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
│  hide() (lines 1188-1197)                                               │
│                                                                          │
│  1. saveState() - BEFORE hiding (position becomes 0 after display:none) │
│  2. panel.style.opacity = '0'                                           │
│  3. panel.style.pointerEvents = 'none'                                  │
│  4. panel.classList.add('hidden')                                       │
│  5. panel.style.display = 'none'                                        │
│                                                                          │
│  NOTE: Tabulator instance is PRESERVED (this.table still exists)        │
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
│  Interact.js event handlers (dragMoveListener / resizeMoveListener)     │
│  or Tabulator columnMoved event                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  saveState()                                                            │
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

CIRCUIT_ANALYSIS_COMPUTED
├── Emitted by: CircuitAnalysisManager._handleComputationResult()
├── Payload: { inputs, outputs, table, isValid, reason }
└── Listened by:
    ├── TruthTablePanel._handleComputed() → updates table
    └── circuit-simulator.js → backward compat

TRUTH_TABLE_SHOWN
├── Emitted by: TruthTablePanel.display() / show() / displayInvalidMessage()
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
└── Listened by: TruthTablePanel._handleStepCompleted() → highlight row

CIRCUIT_VALIDITY_CHANGED
├── Emitted by: CircuitValidityManager
└── Listened by: TruthTablePanel._handleValidityChanged() → show invalid msg
```

---

## 8. DATA STRUCTURES

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

### Added: `show()` method in TruthTablePanel
- Fast path: if table exists, just reveal panel (instant)
- Slow path: if no table, call generate() + display()

### Removed: Progressive Loading
- Was loading initial 100 rows, then adding 500 at a time
- Unnecessary because Tabulator virtual DOM already handles large datasets
- The bottleneck was Tabulator INIT, not rendering

### Changed: circuit-simulator.js
- Now calls `panel.show()` instead of `generate()` + `display()`

### Preserved: Async Computation
- CircuitAnalysisManager still uses async for 8+ inputs
- Progress bar shows during computation (rare)
- This is separate from panel display
