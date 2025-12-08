# Truth Table Panel - Feature Specification

**Version**: 1.0
**Date**: 2025-12-08
**Status**: Complete
**Implementation**: `src/ui/TruthTablePanel.js`

---

## 1. Overview

The Truth Table Panel displays a pre-computed truth table for the current circuit, showing all possible input combinations and their corresponding output values. It provides an interactive, draggable/resizable panel with row highlighting synchronized to the simulation state.

### 1.1 Core Responsibilities

1. **Display pre-computed truth table** from CircuitAnalysisManager cache
2. **Handle column reordering** (inputs and outputs reorderable within their groups)
3. **Highlight rows** matching current circuit state or simulation step
4. **Provide drag/resize functionality** via Interact.js
5. **Persist panel state** (position, size, column order, visibility)

### 1.2 Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Display-only** | Panel does NOT compute truth tables; it reads from pre-computed cache |
| **Event-driven** | Responds to declarative events, doesn't poll for changes |
| **Two-level lifecycle** | Table rebuild (structure changes) vs Full destroy (board switch) |
| **State persistence** | Panel state survives hide/show and is saved with board |

---

## 2. Data Structures

### 2.1 Circuit Analysis (Read from CircuitState)

```javascript
// CircuitState.getCircuitAnalysis() returns:
{
    inputs: [
        { id: 'comp_1', label: 'A', value: 0, type: 'INPUT', x: 100, y: 100 },
        { id: 'comp_2', label: 'B', value: 1, type: 'INPUT', x: 100, y: 200 }
    ],
    outputs: [
        { id: 'comp_3', label: 'Y', value: 1, type: 'OUTPUT', x: 400, y: 150 }
    ],
    table: [
        // 2^n rows for n inputs, indexed by binary input combination
        { input0: 0, input1: 0, output0: 0, componentValues: {...} },
        { input0: 0, input1: 1, output0: 1, componentValues: {...} },
        { input0: 1, input1: 0, output0: 1, componentValues: {...} },
        { input0: 1, input1: 1, output0: 1, componentValues: {...} }
    ],
    isValid: true,      // false if circuit is incomplete
    reason: null        // Error message if isValid is false
}
```

### 2.2 Panel State (Persisted with Board)

```javascript
// CircuitState.getTruthTablePanelState() returns:
{
    columnOrder: ['input0', 'input1', 'output0'],  // User's column arrangement
    width: '500px',      // Panel width (CSS value)
    height: '400px',     // Panel height (CSS value)
    x: 150,              // Transform translate X (pixels)
    y: 200,              // Transform translate Y (pixels)
    visible: true        // Whether panel was open when board was saved
}
```

### 2.3 Internal State

```javascript
// TruthTablePanel instance variables:
{
    tabulatorInstance: Tabulator,    // Tabulator.js library instance (UI)
    panel: HTMLElement,              // DOM reference to panel container
    circuitAnalysis: Object,         // Deep copy of analysis data
    columnOrder: string[],           // Current column field order
    state: Object,                   // Panel state (position, size, etc.)
    interactionsSetup: boolean,      // Whether Interact.js is configured
    _isRestoring: boolean,           // Skip saveState during restore
    _initialized: boolean            // Whether init() has been called
}
```

---

## 3. Lifecycle

### 3.1 Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TRUTH TABLE PANEL LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │  new Panel() │
                         │ (constructor)│
                         └──────┬───────┘
                                │
                                │ • Store references
                                │ • Bind event handlers
                                │ • Subscribe to EventBus
                                ▼
                         ┌──────────────┐
                         │    init()    │
                         │ (one-time)   │
                         └──────┬───────┘
                                │
                                │ • Cache DOM references
                                │ • Restore saved state
                                │ • Setup close button
                                ▼
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
       ┌─────────────┐                    ┌─────────────┐
       │   show()    │◄──────────────────►│   hide()    │
       │             │    (toggle)        │             │
       └──────┬──────┘                    └──────┬──────┘
              │                                  │
              │                                  │ • Save state
              │                                  │ • Hide panel
              │                                  │ • Preserve Tabulator
              │                                  │
              ├──────────────────────────────────┤
              │                                  │
              ▼                                  ▼
       ┌─────────────┐                    ┌─────────────┐
       │  VISIBLE    │                    │   HIDDEN    │
       │ (panel open)│                    │(panel closed)│
       └──────┬──────┘                    └─────────────┘
              │
              │ Events while visible:
              │ • SIMULATION_STEP_COMPLETED → highlight row
              │ • CIRCUIT_VALIDITY_CHANGED → show invalid msg
              │ • CIRCUIT_ANALYSIS_COMPUTING → show progress
              │ • CIRCUIT_ANALYSIS_COMPUTED → refresh data
              │
              ▼
       ┌─────────────┐
       │  destroy()  │  ◄── Called on BOARD_CLEARED or BOARD_LOADED
       │             │
       └──────┬──────┘
              │
              │ • Unsubscribe all events
              │ • Destroy Tabulator
              │ • Unset Interact.js
              │ • Clear DOM references
              ▼
       ┌─────────────┐
       │  DESTROYED  │
       └─────────────┘
```

### 3.2 Two-Level Lifecycle Architecture

The panel implements two distinct cleanup levels:

| Level | Method | Trigger | What's Destroyed | What's Preserved |
|-------|--------|---------|------------------|------------------|
| **Table Rebuild** | `_renderTabulator()` | Structure change (input/output added/removed) | Tabulator instance, Interact.js bindings | Position, EventBus subscriptions, panel DOM |
| **Full Destroy** | `destroy()` | Board switch/clear | Everything | Nothing |

**Rationale**: Structure changes (adding an input) require rebuilding the table columns, but the panel should stay in the same position. Board switches require a fresh start.

---

## 4. Show/Hide Behavior

### 4.1 Show Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            show() FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

show()
   │
   ├──▶ [FAST PATH] tabulatorInstance exists?
   │         │
   │         └── YES ─────▶ Just reveal panel
   │                       • Remove 'hidden' class
   │                       • Set display: block, opacity: 1
   │                       • Update row highlight
   │                       • Emit TRUTH_TABLE_SHOWN
   │                       • Return (~0ms)
   │
   └──▶ [SLOW PATH] Need to build content
              │
              ├──▶ Get analysis from cache
              │
              ├──▶ Show panel (opacity: 0, invisible but measuring)
              │
              ├──▶ Apply saved position (avoid flicker)
              │
              ├──▶ Branch by analysis state:
              │    │
              │    ├── table.length === 0 && reason === 'Computing...'
              │    │   └──▶ _renderComputingState()
              │    │
              │    ├── table.length === 0 (invalid circuit)
              │    │   └──▶ _renderInvalidState()
              │    │
              │    └── table.length > 0 (valid data)
              │        └──▶ await _renderTabulator()
              │
              └──▶ Common post-render (ALL paths):
                   • _positionPanelIfNeeded()
                   • _setupInteractions()
                   • Set opacity: 1
                   • Emit TRUTH_TABLE_SHOWN
```

### 4.2 Hide Flow

```
hide()
   │
   ├──▶ _saveState()  ◄── CRITICAL: Must save BEFORE display:none
   │                      (offsetWidth becomes 0 after hiding)
   │
   ├──▶ Set opacity: 0
   ├──▶ Set pointerEvents: none
   ├──▶ Add 'hidden' class
   └──▶ Set display: none
```

**Key Behavior**: Tabulator instance is **preserved** during hide. This enables the fast path on next show().

### 4.3 Refresh Flow (While Visible)

```
refresh()  ◄── Called when CIRCUIT_ANALYSIS_COMPUTED fires
   │
   ├──▶ Guard: panel must exist and be visible
   │
   ├──▶ Get fresh analysis from cache
   │
   ├──▶ Detect change type:
   │    │
   │    ├── [STRUCTURE CHANGED] Input/output count different
   │    │   └──▶ Full rebuild
   │    │        • Save position
   │    │        • Clear dimensions (auto-fit)
   │    │        • Reset column order
   │    │        • await _renderTabulator()
   │    │
   │    ├── [LABELS CHANGED] Same structure, different labels
   │    │   └──▶ Header-only update
   │    │        • _updateColumnHeaders()
   │    │        • replaceData()
   │    │        • _reapplyRowHeights()
   │    │        • _updateHighlight()
   │    │
   │    └── [DATA ONLY] Same structure and labels
   │        └──▶ Fast update
   │             • replaceData()
   │             • _reapplyRowHeights()
   │             • _updateHighlight()
```

---

## 5. Event Handling

### 5.1 Events Subscribed To

| Event | Handler | Behavior |
|-------|---------|----------|
| `SIMULATION_STEP_COMPLETED` | `_handleStepCompleted()` | Highlight row at `cycleIndex` |
| `CIRCUIT_VALIDITY_CHANGED` | `_handleValidityChanged()` | Show invalid message if circuit becomes incomplete |
| `CIRCUIT_ANALYSIS_COMPUTING` | `_handleComputing()` | Update progress bar with percent/current/total |
| `CIRCUIT_ANALYSIS_COMPUTED` | `_handleComputed()` | Refresh table data, transition from computing→ready |

### 5.2 Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `TRUTH_TABLE_SHOWN` | End of `show()` (all paths) | None |

### 5.3 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EVENT FLOW                                       │
└─────────────────────────────────────────────────────────────────────────┘

CIRCUIT_ANALYSIS_COMPUTING ──────────────────────────────────────────────┐
  (from CircuitAnalysisManager)                                          │
     │                                                                   │
     ▼                                                                   │
  _handleComputing()                                                     │
     │                                                                   │
     └──▶ If visible: _showProgress(percent, current, total)            │
                                                                         │
CIRCUIT_ANALYSIS_COMPUTED ───────────────────────────────────────────────┤
  (from CircuitAnalysisManager)                                          │
     │                                                                   │
     ▼                                                                   │
  _handleComputed()                                                      │
     │                                                                   │
     ├──▶ _hideProgress()                                                │
     │                                                                   │
     └──▶ If visible:                                                    │
          ├── If tabulatorInstance: setData(newData)                     │
          └── Else: await _renderTabulator()                             │
                                                                         │
SIMULATION_STEP_COMPLETED ───────────────────────────────────────────────┤
  (from Simulation system)                                               │
     │                                                                   │
     ▼                                                                   │
  _handleStepCompleted({ cycleIndex })                                   │
     │                                                                   │
     └──▶ If visible: _highlightRowByIndex(cycleIndex)                   │
                                                                         │
CIRCUIT_VALIDITY_CHANGED ────────────────────────────────────────────────┘
  (from CircuitValidityManager)
     │
     ▼
  _handleValidityChanged({ canSimulate, reason })
     │
     └──▶ If visible && !canSimulate && table.length === 0:
              _renderInvalidState(content, reason)
```

---

## 6. User Interactions

### 6.1 Drag Behavior

| Aspect | Behavior |
|--------|----------|
| **Drag Handle** | Panel header only (`.panel-header`) |
| **Constraint** | Restricted to parent container |
| **Persistence** | Position saved on drag end |
| **Implementation** | Interact.js with `transform: translate()` |

### 6.2 Resize Behavior

| Aspect | Behavior |
|--------|----------|
| **Edges** | All four edges and corners |
| **Minimum Size** | 200px width × 150px height |
| **Table Adjustment** | Row heights recalculate during resize |
| **Persistence** | Dimensions saved on resize end |
| **Performance** | Resize updates debounced via `requestAnimationFrame` |

### 6.3 Column Reordering

| Aspect | Behavior |
|--------|----------|
| **Reorderable** | Yes, via drag-and-drop on column headers |
| **Group Constraint** | Inputs stay in Inputs group, Outputs stay in Outputs group |
| **Persistence** | Column order saved on reorder |
| **Reset Trigger** | Structure change (input/output added/removed) |

---

## 7. State Persistence

### 7.1 What Is Persisted

| State | Storage Location | When Saved |
|-------|------------------|------------|
| `x`, `y` (position) | CircuitState → localStorage | On drag end, hide, board save |
| `width`, `height` | CircuitState → localStorage | On resize end, hide, board save |
| `columnOrder` | CircuitState → localStorage | On column move, hide, board save |
| `visible` | CircuitState → localStorage | On show/hide, board save |

### 7.2 Persistence Flow

```
User drags panel
      │
      ▼
_dragMoveListener()
      │
      └──▶ On drag end: _saveState()
                │
                ▼
          Build state object:
          { columnOrder, width, height, x, y, visible }
                │
                ▼
          this.onStateChange(state)  ◄── Callback to coordinator
                │
                ▼
          circuitState.setTruthTablePanelState(state)
                │
                ▼
          emits TRUTH_TABLE_PANEL_STATE_CHANGED
                │
                ▼
          AutoSaveManager → localStorage
```

### 7.3 State Restoration

```
Board loaded
      │
      ▼
circuit-simulator.js
      │
      ├──▶ new TruthTablePanel(...)
      │
      ├──▶ panel.init(savedState)  ◄── Restores columnOrder, sets _isRestoring
      │
      └──▶ If savedState.visible: panel.show()
                │
                ▼
          show() → _positionPanelIfNeeded()
                │
                └──▶ _restoreState(state)
                     • Apply saved width/height (capped to viewport)
                     • Apply saved x/y (clamped to keep visible)
                     • Set data-x, data-y attributes
```

---

## 8. Rendering States

### 8.1 Valid Table State

**When**: Circuit has inputs AND outputs, all connected, analysis computed.

```
┌──────────────────────────────────────────┐
│ Truth Table                          [X] │
├──────────────────────────────────────────┤
│      INPUTS          │      OUTPUTS      │
│   A    │    B        │        Y          │
├────────┼─────────────┼───────────────────┤
│   0    │    0        │        0          │
│   0    │    1        │  ►     1     ◄    │  ← Highlighted row
│   1    │    0        │        1          │
│   1    │    1        │        1          │
└──────────────────────────────────────────┘
```

### 8.2 Invalid Circuit State

**When**: Circuit is incomplete (missing inputs, outputs, or connections).

```
┌──────────────────────────────────────────┐
│ Truth Table                          [X] │
├──────────────────────────────────────────┤
│                                          │
│               ⚠                          │
│    Add inputs and outputs to see         │
│    the truth table                       │
│                                          │
└──────────────────────────────────────────┘
```

### 8.3 Computing State

**When**: Large circuit (9+ inputs) with async computation in progress.

```
┌──────────────────────────────────────────┐
│ Truth Table                          [X] │
├──────────────────────────────────────────┤
│                                          │
│    Computing truth table...              │
│    ████████████░░░░░░░░  60%             │
│    307 / 512 rows                        │
│                                          │
└──────────────────────────────────────────┘
```

---

## 9. Row Highlighting

### 9.1 Highlight Trigger

| Trigger | Source | Row Selection |
|---------|--------|---------------|
| Panel opens | `show()` → `_updateHighlight()` | Row matching current input values |
| Input toggled | `CIRCUIT_ANALYSIS_COMPUTED` → `_handleComputed()` | Row matching new input values |
| Simulation step | `SIMULATION_STEP_COMPLETED` | Row at `cycleIndex` |

### 9.2 Row Matching Logic

```javascript
// Find row index matching input values
_findMatchingRow(inputValues) {
    const data = this.tabulatorInstance.getData();
    return data.findIndex(row =>
        inputValues.every((val, i) => row[`input${i}`] === val)
    );
}

// For simulation cycling, use direct index
_highlightRowByIndex(cycleIndex) {
    const rows = this.tabulatorInstance.getRows();
    rows[cycleIndex].select();
    rows[cycleIndex].scrollTo();
}
```

### 9.3 Scroll Behavior

When a row is highlighted:
1. Row is selected (visual highlight via Tabulator)
2. Row is scrolled into view if not visible
3. Virtual DOM ensures smooth scrolling for large tables

---

## 10. Performance Characteristics

### 10.1 Timing

| Scenario | Expected Time | Reason |
|----------|---------------|--------|
| First open (small circuit, ≤8 inputs) | ~100ms | Tabulator init + virtual DOM setup |
| First open (large circuit, 9+ inputs) | ~2-3s | Async computation + Tabulator init |
| Re-open (any size) | **~0ms** | Fast path - just reveals existing table |
| Data update while visible | ~50-100ms | `setData()` optimized by Tabulator |
| Structure change while visible | ~100ms-3s | Full Tabulator rebuild required |

### 10.2 Virtual DOM

Tabulator uses virtual DOM rendering:
- Only renders visible rows
- Handles 32K+ rows smoothly
- Scroll position maintained during updates

### 10.3 Debouncing

| Operation | Debounce Strategy |
|-----------|-------------------|
| Resize table height | `requestAnimationFrame` |
| Circuit analysis recomputation | 200ms debounce in CircuitAnalysisManager |
| State save | Immediate (but triggered only on interaction end) |

---

## 11. Edge Cases

### 11.1 Circuit States

| Scenario | Expected Behavior |
|----------|-------------------|
| **Empty circuit** (no components) | Panel shows invalid message |
| **Only inputs** (no outputs) | Panel shows invalid message: "Add outputs..." |
| **Only outputs** (no inputs) | Panel shows invalid message: "Add inputs..." |
| **Unconnected components** | Panel shows invalid message with reason |
| **Very large table** (15 inputs = 32K rows) | Progress bar during computation, virtual scroll |

### 11.2 State Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| **Position (0, 0)** | Treated as "no saved position" → smart positioning |
| **Corrupted position** (x < -500) | Sanitized to 0 |
| **Oversized dimensions** (> 90% viewport) | Capped to 90% of viewport |
| **Off-screen position** | Clamped to keep ≥20% of panel visible |
| **Structure changed while closed** | Dimensions reset, auto-fit to new content |
| **Legacy state properties** (left, top, transform) | Ignored and deleted |

### 11.3 Lifecycle Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| **Rapid open/close** | No duplicate panels, state consistent |
| **Board clear while visible** | Panel destroyed cleanly, no errors |
| **Board load while visible** | Old panel destroyed, new panel if saved as visible |
| **Structure change while visible** | Table rebuilds, position preserved |
| **Computing → structure change** | Progress hidden, new computation starts |

### 11.4 Event Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| **Event received while hidden** | Ignored (guards check `_isVisible()`) |
| **Multiple rapid COMPUTED events** | Each triggers refresh, last wins |
| **VALIDITY_CHANGED while showing table** | Only acts if `table.length === 0` |
| **STEP_COMPLETED with invalid index** | Silently ignored (row doesn't exist) |

---

## 12. Constraints and Limits

### 12.1 Size Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Minimum panel width | 200px | Enforced by Interact.js |
| Minimum panel height | 150px | Enforced by Interact.js |
| Maximum panel width | 90% viewport | Capped in `_restoreState()` |
| Maximum panel height | 80% viewport | Capped in `_applyTableHeight()` |

### 12.2 Row Layout Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Minimum row height | 25px | Ensure readability |
| Maximum row height | 36px | Prevent excessive spacing |
| Content height assumption | 20px | For vertical centering calculation |

### 12.3 Position Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Maximum off-screen | 80% of panel dimension | Keep panel grabbable |
| Corrupted position threshold | -500px | Values below are sanitized to 0 |

---

## 13. Integration Points

### 13.1 Coordinator (circuit-simulator.js)

```javascript
// Instantiation
this.truthTablePanel = new TruthTablePanel(
    this.canvas,
    this.state.getComponents(),
    this.state.getConnections(),
    this.state
);

// State persistence callback
this.truthTablePanel.onStateChange = (state) => {
    this.state.setTruthTablePanelState(state);
};

// Initialize with saved state
const truthTablePanelState = this.state.getTruthTablePanelState();
this.truthTablePanel.init(truthTablePanelState);

// Show panel
this.truthTablePanel.show();

// Cleanup on board operations
if (this.truthTablePanel) {
    this.truthTablePanel.destroy();
    this.truthTablePanel = null;
}
```

### 13.2 CircuitState

- `getCircuitAnalysis()` - Returns pre-computed truth table data
- `getTruthTablePanelState()` - Returns saved panel state
- `setTruthTablePanelState(state)` - Persists panel state, emits event

### 13.3 CircuitAnalysisManager

- Computes truth tables in background
- Emits `CIRCUIT_ANALYSIS_COMPUTING` with progress
- Emits `CIRCUIT_ANALYSIS_COMPUTED` when done
- Uses async computation for large tables (>256 rows)

---

## 14. Related Documentation

- [Truth Table Flow Diagram](./truth-table-flow-diagram.md) - Visual flow documentation
- [Truth Table Panel Internal Flow](./truth-table-panel-internal-flow.md) - Method call graphs
- [Manual Test Cases](../manual-tests/truth-table-panel.md) - Comprehensive test scenarios
- [Architecture Overview](../../ARCHITECTURE.md) - System architecture

---

## 15. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-08 | Initial complete specification |
