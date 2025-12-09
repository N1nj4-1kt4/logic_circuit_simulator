# Event Fanning Visualization

This document provides a comprehensive view of how events propagate through the Logic Circuit Simulator when users take actions. It covers the impact on CircuitOperations, CircuitAnalysis, State Storage, Truth Table visualization, and Toolbar synchronization.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Event Types Reference](#2-event-types-reference)
3. [Category 1: Component & Connection Operations](#3-category-1-component--connection-operations)
4. [Category 2: Simulation Operations](#4-category-2-simulation-operations)
5. [Category 3: Board Lifecycle](#5-category-3-board-lifecycle)
6. [Category 4: Truth Table Manipulation](#6-category-4-truth-table-manipulation)
7. [Module Subscription Summary](#7-module-subscription-summary)
8. [Visual Flow Diagrams](#8-visual-flow-diagrams)

---

## 1. Architecture Overview

### Event Bus Pattern

All inter-module communication uses a **declarative event bus**. Events describe **what happened**, not what listeners should do.

```
Good: COMPONENT_ADDED, BOARD_LOADED, SIMULATION_STEP_COMPLETED
Bad:  REFRESH_TOOLBAR, UPDATE_TABLE, REDRAW_CANVAS
```

### Single Source of Truth

**CircuitState** (`src/core/CircuitState.js`) owns all circuit data:
- `components[]` - All circuit components
- `connections[]` - All wire connections
- `circuitAnalysis` - Cached truth table data
- `truthTablePanelState` - Panel position/size/visibility

### Key Architectural Patterns

| Pattern | Description |
|---------|-------------|
| **Debouncing** | CircuitAnalysisManager debounces recomputation (100ms) to batch rapid changes |
| **Deferred Sync** | TruthTablePanel uses `_tabulatorNeedsSync` flag when hidden |
| **Drag Coalescing** | UndoRedoManager groups drag movements into single undo entry |
| **Async Computation** | Large circuits (>8 inputs) use async analysis with progress events |

### CircuitValidityManager vs CircuitAnalysisManager: Independent Parallel Processing

A critical architectural decision: **both managers independently listen to `BOARD_CHANGED`** and process in parallel, not sequentially.

```
BOARD_CHANGED
    │
    ├─► CircuitValidityManager._handleBoardChanged()  [SYNCHRONOUS]
    │       │
    │       └─► revalidate()
    │               │
    │               └─► CIRCUIT_VALIDITY_CHANGED (immediate)
    │                       │
    │                       └─► TruthTablePanel shows invalid state
    │
    └─► CircuitAnalysisManager._handleBoardChanged()  [DEBOUNCED 100ms]
            │
            └─► _debouncedRecomputeAnalysis()
                    │
                    └─► recomputeAnalysis()
                            │
                            └─► computeCircuitAnalysis()
                                    │
                                    ├─► validateCircuitForAnalysis() [CHEAP]
                                    │   Returns early if invalid
                                    │
                                    └─► enumerate combinations [EXPENSIVE]
                                        Only runs if valid
```

**Why This Design?**

| Concern | Solution |
|---------|----------|
| **Immediate feedback** | ValidityManager runs synchronously → instant "Circuit incomplete" message |
| **Performance** | AnalysisManager debounces → batches rapid changes (e.g., drag-and-drop) |
| **Wasted computation?** | No - `computeCircuitAnalysis()` validates first and returns early if invalid |
| **Event coupling?** | Avoided - managers don't depend on each other's events |

**Key Insight:** The validity check inside `computeCircuitAnalysis()` is O(n) on components/connections (cheap), while truth table enumeration is O(2^n) on inputs (expensive). The expensive part only runs for valid circuits.

### Shared Validation Logic

Both managers use the **same validation function** - there is no disparity in validation logic:

```
                    ┌─────────────────────────────────────┐
                    │      validateCircuitForAnalysis()   │
                    │         (CircuitAnalyzer.js)        │
                    │                                     │
                    │  - Check has inputs                 │
                    │  - Check has outputs                │
                    │  - Check has gates                  │
                    │  - Check gate connectivity          │
                    │                                     │
                    │  Returns: { isValid, reason,        │
                    │             inputs, outputs }       │
                    └─────────────────────────────────────┘
                                     ▲
                    ┌────────────────┴────────────────┐
                    │                                 │
    ┌───────────────┴───────────────┐   ┌────────────┴────────────────┐
    │   CircuitValidityManager      │   │   computeCircuitAnalysis()  │
    │   (src/core/)                 │   │   (CircuitAnalyzer.js)      │
    │                               │   │                             │
    │ revalidate() {                │   │ Line 188:                   │
    │   validation =                │   │   validation =              │
    │     validateCircuitForAnalysis│   │     validateCircuitForAnalysis
    │   ...emit event...            │   │   if (!validation.isValid)  │
    │ }                             │   │     return early            │
    └───────────────────────────────┘   └─────────────────────────────┘
```

**Why validate twice?**

| Validation | Timing | Purpose |
|------------|--------|---------|
| CircuitValidityManager | Synchronous (immediate) | Instant UI feedback |
| computeCircuitAnalysis() | After 100ms debounce | Gate expensive O(2^n) work |

The O(n) validation cost is negligible compared to the O(2^n) enumeration, so running it twice (at different times) is acceptable. This keeps the managers decoupled - neither depends on the other's events.

**What CircuitAnalysisManager Does NOT Do:**
- Does NOT persist to storage (AutoSaveManager handles that independently)
- Does NOT emit `CIRCUIT_ANALYSIS_COMPUTED` for invalid circuits
- Does NOT wait for `CIRCUIT_VALIDITY_CHANGED` before computing

**TruthTablePanel Dual-Event Handling:**

Because validity and analysis are independent, TruthTablePanel subscribes to BOTH:

| Event | Purpose | Timing |
|-------|---------|--------|
| `CIRCUIT_VALIDITY_CHANGED` | Show "Circuit incomplete" immediately | Synchronous |
| `CIRCUIT_ANALYSIS_COMPUTED` | Update table with computed data | After 100ms debounce |

This ensures users see immediate feedback ("incomplete") while the analysis computation is still pending or skipped entirely for invalid circuits.

---

## 2. Event Types Reference

### Component Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `COMPONENT_ADDED` | `{ component }` | CircuitState.addComponent() | New component placed |
| `COMPONENT_REMOVED` | `{ componentId, component }` | CircuitState.removeComponent() | Component deleted |
| `COMPONENT_MOVED` | `{ component, oldState, updates }` | CircuitState.updateComponent() | Component position changed |
| `COMPONENT_VALUE_CHANGED` | `{ component, oldValue, newValue }` | toggleInput() | INPUT value toggled |
| `COMPONENT_LABEL_CHANGED` | `{ component, oldLabel, newLabel }` | rename operation | Component relabeled |

### Connection Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `CONNECTION_ADDED` | `{ connection }` | CircuitState.addConnection() | New wire connected |
| `CONNECTION_REMOVED` | `{ connection }` | CircuitState.removeConnection() | Wire deleted |
| `CONNECTION_START_CHANGED` | `{ connectStart }` | CircuitState.setConnectStart() | Connection in progress |

### Board Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `BOARD_CHANGED` | `{}` | CircuitState mutations | Any topology change |
| `BOARD_LOADED` | `{ state }` | CircuitState.loadState() | Board loaded from storage |
| `BOARD_CLEARED` | `{}` | CircuitState.clearComponents() | Board cleared |
| `BOARD_WILL_CLEAR` | `{}` | Before clearComponents() | Pre-clear for undo capture |
| `BOARD_SAVE` | `{}` | BoardManager.saveBoard() | Board saved |
| `BOARD_DELETED` | `{}` | BoardManager.deleteBoard() | Board deleted |

### Simulation Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `SIMULATION_STEP_COMPLETED` | `{ cycleIndex, totalCombinations, inputValues }` | SimulationController | Step executed |
| `AUTOCYCLE_STATE_CHANGED` | `{ state: 'running'\|'stopped'\|'error', error? }` | SimulationController | Auto-cycle state changed |

### Circuit Analysis Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `CIRCUIT_ANALYSIS_COMPUTED` | `{ inputs, outputs, table, isValid, reason }` | CircuitAnalysisManager | Analysis complete (valid only) |
| `CIRCUIT_ANALYSIS_COMPUTING` | `{ current, total, percent }` | CircuitAnalysisManager | Progress updates (async) |
| `CIRCUIT_VALIDITY_CHANGED` | `{ from, to, canSimulate, reason, inputs, outputs, isValid }` | CircuitValidityManager | Validity state changed |
| `IO_STRUCTURE_CHANGED` | `{ previousInputCount, previousOutputCount, newInputCount, newOutputCount, inputs, outputs }` | CircuitValidityManager | Input/output count changed |

### Truth Table Panel Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `TRUTH_TABLE_SHOWN` | `{}` | TruthTablePanel.show() | Panel opened |
| `TRUTH_TABLE_HIDDEN` | `{}` | TruthTablePanel.hide() | Panel closed |
| `TRUTH_TABLE_PANEL_STATE_CHANGED` | `{ columnOrder, width, height, x, y, visible }` | TruthTablePanel._saveState() | Position/size/order changed |

### UI Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `TOOLBAR_UPDATE_DISPLAYS` | `{}` | BoardOperations | Update toolbar displays |
| `CANVAS_REDRAW` | `{}` | Various | Trigger canvas repaint |
| `THEME_CHANGED` | `{ isDark }` | Theme toggle | Theme switched |

### Undo/Redo Events

| Event | Payload | Emitted By | Purpose |
|-------|---------|------------|---------|
| `UNDO_REDO_STATE_CHANGED` | `{ canUndo, canRedo }` | UndoRedoManager | Stack state changed |
| `DRAG_STARTED` | `{ component }` | CanvasInteraction | Begin drag coalescing |
| `DRAG_ENDED` | `{ component }` | CanvasInteraction | End drag coalescing |

---

## 3. Category 1: Component & Connection Operations

### 3.1 Adding/Removing Components

#### Add INPUT/OUTPUT/Gate Component

```
User clicks canvas to place component
    │
    ├─► CanvasOperations.placeComponent(x, y, type)
    │       Creates component object
    │
    └─► state.addComponent(component)
            │
            ├─► COMPONENT_ADDED ─────────────────────────┐
            │                                            │
            │   ┌────────────────────────────────────────┤
            │   │                                        │
            │   ▼                                        ▼
            │   UndoRedoManager                    CircuitAnalysisManager
            │   captures state snapshot            marks for recomputation
            │                                      (debounced 100ms)
            │
            └─► BOARD_CHANGED ───────────────────────────┐
                                                         │
                ┌────────────────────────────────────────┤
                │                                        │
                ▼                                        ▼
                CircuitValidityManager              UndoRedoManager
                revalidates circuit                 (additional capture)
                        │
                        ▼
                CIRCUIT_VALIDITY_CHANGED
                { from: 'empty', to: 'incomplete', ... }
                        │
                        ├─► TruthTablePanel._handleValidityChanged()
                        │   Shows "Circuit incomplete" if visible
                        │   Sets _tabulatorNeedsSync if hidden
                        │
                        └─► SimulationController (if auto-cycling)
                            Stops with error if circuit invalid
```

**Impact Summary:**

| Module | Impact |
|--------|--------|
| CircuitState | Component added to components[] |
| UndoRedoManager | State snapshot captured |
| CircuitAnalysisManager | Analysis marked stale (recomputes after debounce) |
| CircuitValidityManager | Validity re-evaluated, may emit CIRCUIT_VALIDITY_CHANGED |
| TruthTablePanel | Shows invalid state OR marks for sync |
| Toolbar | No direct update (validity handled separately) |

#### Remove Component (with Cascade)

```
User deletes component
    │
    └─► state.removeComponent(componentId)
            │
            ├─► Cascade: Remove all connections to/from this component
            │   For each connection:
            │       └─► CONNECTION_REMOVED
            │
            ├─► COMPONENT_REMOVED
            │       └─► UndoRedoManager, CircuitAnalysisManager
            │
            └─► BOARD_CHANGED
                    └─► CircuitValidityManager
                            │
                            ▼
                        CIRCUIT_VALIDITY_CHANGED
                        { from: 'valid', to: 'incomplete', ... }
                                │
                                └─► Subscribers react to invalidation
```

**Key Point:** Removing a component automatically removes all its connections (cascade delete).

### 3.2 Adding/Removing Connections

#### Add Connection

```
User connects output port → input port
    │
    ├─► First click: state.setConnectStart(portInfo)
    │       └─► CONNECTION_START_CHANGED
    │               └─► Toolbar updates mode indicator
    │
    └─► Second click: state.addConnection(connection)
            │
            ├─► CONNECTION_ADDED
            │       └─► UndoRedoManager, CircuitAnalysisManager
            │
            ├─► BOARD_CHANGED
            │       └─► CircuitValidityManager
            │               │
            │               ▼
            │           CIRCUIT_VALIDITY_CHANGED
            │           { from: 'incomplete', to: 'valid', canSimulate: true }
            │                   │
            │                   └─► TruthTablePanel: Clear invalid message
            │
            └─► state.setConnectStart(null)
                    └─► CONNECTION_START_CHANGED { connectStart: null }
                            └─► Toolbar: Reset mode indicator
```

**Validity Transition:** Adding a connection may transition circuit from `incomplete` → `valid`.

### 3.3 Relabeling Components

```
User renames component via right-click menu
    │
    └─► component.label = newLabel
            │
            └─► COMPONENT_LABEL_CHANGED
                { component, oldLabel, newLabel }
                    │
                    ├─► UndoRedoManager
                    │   captures state for undo
                    │
                    └─► CircuitAnalysisManager._handleLabelChanged()
                            │
                            ├─► Does NOT trigger full recomputation
                            │
                            └─► Patches label in existing analysis
                                    │
                                    ▼
                                CIRCUIT_ANALYSIS_COMPUTED
                                (with updated labels)
                                    │
                                    └─► TruthTablePanel._handleComputed()
                                        Updates column headers only
```

**Key Difference from Add/Remove:**
- NO `BOARD_CHANGED` event (label doesn't affect circuit topology)
- NO `CIRCUIT_VALIDITY_CHANGED` (validity unchanged)
- NO full analysis recomputation (label is metadata only)
- Direct patch to existing analysis

### 3.4 Undo/Redo Operations

#### Drag Coalescing

```
Mouse down on component (start drag)
    │
    └─► DRAG_STARTED { component }
            │
            └─► UndoRedoManager._onDragStarted()
                isCoalescing = true
                preCoalesceSnapshot = currentState

[Multiple mouse move events - NO events emitted]

Mouse up (end drag)
    │
    └─► DRAG_ENDED { component }
            │
            └─► UndoRedoManager._onDragEnded()
                isCoalescing = false
                captureSnapshot() ─► Single undo entry for entire drag
```

**Result:** User can undo a 100-pixel drag with one Ctrl+Z.

#### Undo Operation

```
User presses Ctrl+Z
    │
    └─► UndoRedoManager.undo()
            │
            ├─► Pop from undoStack
            │
            ├─► isRestoring = true (prevent recursive capture)
            │
            └─► restoreCircuitSnapshot(previousState)
                    │
                    ├─► state.components = previousState.components
                    ├─► state.connections = previousState.connections
                    ├─► state.truthTablePanelState = previousState.truthTablePanelState
                    │
                    └─► BOARD_LOADED ───────────────────────────┐
                        (Same as loading a board)               │
                                                                │
                        ┌───────────────────────────────────────┤
                        │               │                       │
                        ▼               ▼                       ▼
                CircuitValidity  CircuitAnalysis    TruthTablePanel
                Manager          Manager            marks for sync
                revalidates      recomputes

            └─► UNDO_REDO_STATE_CHANGED { canUndo, canRedo }
                    │
                    └─► Toolbar.updateUndoRedoButtonStates()
                        Enable/disable undo/redo buttons
```

**Key Insight:** Undo/Redo uses `BOARD_LOADED` to restore state, triggering the same validation/recomputation chain as loading a saved board.

---

## 4. Category 2: Simulation Operations

### 4.1 Input Node Toggle

```
User clicks INPUT component
    │
    └─► CircuitSimulator.toggleInput(x, y)
            │
            ├─► component.value = 1 - component.value
            │
            └─► simulationController.onToggleInput()
                    │
                    ├─► Recalculate cycleIndex from input values
                    │
                    └─► _simulateAndEmit()
                            │
                            ├─► _restoreFromCacheOrAnalysis()
                            │   Restore values from pre-computed analysis
                            │   OR run full simulation
                            │
                            ├─► CANVAS_REDRAW
                            │
                            └─► SIMULATION_STEP_COMPLETED
                                { cycleIndex, totalCombinations, inputValues }
                                    │
                                    ├─► TruthTablePanel._handleStepCompleted()
                                    │   Highlight matching row
                                    │
                                    └─► Toolbar.setSimulationProgress()
                                        Update step counter
```

### 4.2 Manual Step (Next/Previous)

```
User clicks Next/Previous step button
    │
    └─► simulationController.manualStep(direction)
            │
            ├─► cycleIndex = (cycleIndex + direction) % total
            │
            ├─► _applyInputsForIndex(cycleIndex)
            │   Set INPUT values for this combination
            │
            └─► _simulateAndEmit()
                    │
                    └─► SIMULATION_STEP_COMPLETED
                        { cycleIndex, totalCombinations, inputValues }
                            │
                            ├─► TruthTablePanel: Highlight row
                            └─► Toolbar: Update counter
```

### 4.3 Auto-Cycling

```
User clicks Play button
    │
    └─► simulationController.autocycleStart()
            │
            ├─► Validate circuit is simulatable
            │
            ├─► state = RUNNING
            │
            └─► AUTOCYCLE_STATE_CHANGED { state: 'running' }
                    │
                    └─► Toolbar.setAutocycleState()
                        ├─► Button: "▶ Simulation" → "■ Simulation"
                        ├─► Disable step buttons
                        └─► Mode indicator: "Auto-Cycling Inputs"

[Auto-cycle loop begins]
    │
    └─► _executeAutoCycleStep() ─────────────────────────────────┐
            │                                                    │
            ├─► _applyInputsForIndex(cycleIndex)                 │
            │                                                    │
            ├─► _simulateAndEmit()                               │
            │       │                                            │
            │       └─► SIMULATION_STEP_COMPLETED                │
            │           { cycleIndex, totalCombinations }        │
            │               │                                    │
            │               ├─► TruthTablePanel: Highlight row   │
            │               └─► Toolbar: "Combination N / M"     │
            │                                                    │
            ├─► cycleIndex++                                     │
            │                                                    │
            └─► setTimeout(_executeAutoCycleStep) ───────────────┘
                [Loop continues until stopped or all combinations done]

User clicks Stop button (or all combinations complete)
    │
    └─► simulationController.autocycleStop()
            │
            ├─► Clear timeout
            │
            └─► AUTOCYCLE_STATE_CHANGED { state: 'stopped' }
                    │
                    └─► Toolbar.setAutocycleState()
                        ├─► Button: "■ Simulation" → "▶ Simulation"
                        ├─► Enable step buttons
                        └─► Restore mode indicator
```

#### Error During Auto-Cycle

```
Circuit becomes invalid during auto-cycle
(e.g., user deletes component while cycling)
    │
    └─► CIRCUIT_VALIDITY_CHANGED { canSimulate: false }
            │
            └─► SimulationController._handleValidityChange()
                    │
                    ├─► autocycleStop()
                    │
                    └─► AUTOCYCLE_STATE_CHANGED
                        { state: 'error', error: 'Circuit became invalid' }
                            │
                            └─► Toolbar shows error state
```

---

## 5. Category 3: Board Lifecycle

### 5.1 Loading a Board

```
User selects board from dropdown
    │
    └─► circuit-simulator.js._loadBoardInternal(boardName)
            │
            └─► BoardOperations.loadBoard(boardName)
                    │
                    └─► ContextManager.loadCircuitContext(boardData)
                            │
                            ├─► CircuitAnalysisManager.clearCurrentAnalysis()
                            │
                            ├─► state.loadState(boardData)
                            │       │
                            │       └─► BOARD_LOADED ─────────────────────┐
                            │                                             │
                            │   ┌─────────────────────────────────────────┤
                            │   │               │                         │
                            │   ▼               ▼                         ▼
                            │   circuit-    CircuitValidity         CircuitAnalysis
                            │   simulator   Manager                 Manager
                            │   .js         revalidates             recomputes
                            │       │           │                       │
                            │       ▼           ▼                       ▼
                            │   Destroy     CIRCUIT_VALIDITY       CIRCUIT_ANALYSIS
                            │   old         _CHANGED               _COMPUTED
                            │   TruthTable                         (if valid)
                            │   Panel
                            │
                            ├─► UndoRedoManager.clearHistory()
                            │       │
                            │       └─► UNDO_REDO_STATE_CHANGED
                            │           { canUndo: false, canRedo: false }
                            │               │
                            │               └─► Toolbar: Disable undo/redo
                            │
                            ├─► state.setLastSavedState(currentState)
                            │
                            ├─► CANVAS_REDRAW
                            │
                            └─► TOOLBAR_UPDATE_DISPLAYS
                                    │
                                    └─► Toolbar updates:
                                        ├─► Board dropdown
                                        ├─► Circuit name display
                                        └─► Unsaved changes indicator
```

### 5.2 Clearing a Board

```
User clicks "Clear Board"
    │
    ├─► Check hasUnsavedChanges()
    │   If true: Show save dialog
    │
    └─► _clearBoardInternal()
            │
            └─► state.clearComponents()
                    │
                    ├─► BOARD_WILL_CLEAR ─────────────────────────┐
                    │   (Pre-clear event for undo capture)        │
                    │                                             │
                    │   └─► UndoRedoManager._onBoardWillClear()   │
                    │       Capture state BEFORE clearing         │
                    │                                             │
                    ├─► Clear: components=[], connections=[]      │
                    │                                             │
                    └─► BOARD_CLEARED ────────────────────────────┤
                                                                  │
                        ┌─────────────────────────────────────────┤
                        │               │                         │
                        ▼               ▼                         ▼
                    circuit-     CircuitAnalysis          AutoSaveManager
                    simulator    Manager                  immediate save
                    .js          clear analysis
                        │
                        ▼
                    truthTablePanel.destroy()
                    state.setTruthTablePanelState(null)
                        │
                        └─► TRUTH_TABLE_PANEL_STATE_CHANGED
                            (with null state)

                    └─► BOARD_CHANGED
                            │
                            └─► CircuitValidityManager
                                    │
                                    └─► CIRCUIT_VALIDITY_CHANGED
                                        { to: 'empty', canSimulate: false }
```

**State After Clear:**
- `components = []`
- `connections = []`
- `nextId = 1`
- `currentBoardName = null`
- `circuitAnalysis = null`
- `truthTablePanelState = null`

### 5.3 Reverting to Saved State

```
User clicks "Revert to Saved"
    │
    └─► BoardOperations.revertToSaved()
            │
            ├─► Read lastSavedState from CircuitState
            │
            └─► state.loadState(savedState)
                    │
                    └─► BOARD_LOADED ─────────────────────────────┐
                        (Same chain as loading a board)           │
                                                                  │
                        ┌─────────────────────────────────────────┤
                        │               │                         │
                        ▼               ▼                         ▼
                    CircuitValidity  CircuitAnalysis    TruthTablePanel
                    Manager          Manager            (does NOT destroy,
                    revalidates      recomputes         just syncs data)
                        │
                        └─► CANVAS_REDRAW
                            TOOLBAR_UPDATE_DISPLAYS
```

**Key Difference from Load:**
- TruthTablePanel is NOT destroyed/recreated (preserves position)
- Context (board name) is preserved
- UndoRedoManager history is NOT cleared

### 5.4 Saving a Board

```
User clicks "Save Board"
    │
    └─► BoardOperations.saveCurrentBoard(boardName)
            │
            ├─► Validate board name
            │
            ├─► Create board data:
            │   { components, connections, nextId,
            │     customComponents, truthTablePanelState }
            │
            ├─► boardManager.saveBoard(boardName, boardData)
            │   └─► localStorage persist
            │
            ├─► state.setSavedBoards(allBoards)
            │
            ├─► state.setCurrentBoardName(boardName)
            │
            ├─► state.setLastSavedState(deepClone(currentState))
            │   (Enables hasUnsavedChanges detection)
            │
            └─► TOOLBAR_UPDATE_DISPLAYS
                    │
                    └─► Toolbar updates:
                        ├─► Board dropdown (new board appears)
                        ├─► Circuit name display
                        └─► Unsaved indicator = false
```

---

## 6. Category 4: Truth Table Manipulation

### 6.1 Panel Sizing

```
User drags panel edge to resize
    │
    └─► Interact.js resizeMoveListener
            │
            ├─► Update panel.style.width/height
            │
            └─► requestAnimationFrame (debounced)
                    │
                    └─► TruthTablePanel._applyTableHeight(availableHeight)
                            ├─► Recalculate row heights
                            └─► Update table/cell styles

On drag end:
    │
    └─► TruthTablePanel._saveState()
            │
            ├─► Read dimensions from DOM
            ├─► Read position from data-x/data-y
            ├─► Read columns from Tabulator
            │
            ├─► Create state:
            │   { columnOrder, width, height, x, y, visible }
            │
            └─► onStateChange(state) callback
                    │
                    └─► state.setTruthTablePanelState(state)
                            │
                            └─► TRUTH_TABLE_PANEL_STATE_CHANGED
                                    │
                                    └─► AutoSaveManager (debounced 1s)
                                        Persists to localStorage
```

### 6.2 Panel Repositioning

```
User drags panel header to move
    │
    └─► Interact.js dragMoveListener
            │
            ├─► Update panel.style.transform = translate(x, y)
            └─► Update data-x, data-y attributes

On drag end:
    │
    └─► _saveState() ─► TRUTH_TABLE_PANEL_STATE_CHANGED
            │
            └─► AutoSaveManager persists
```

### 6.3 Column Order Change

```
User drags column header to reorder
    │
    └─► Tabulator internal reorder
            │
            └─► 'columnMoved' event
                    │
                    └─► TruthTablePanel handler
                            │
                            └─► _saveState()
                                    │
                                    ├─► columns = tabulatorInstance
                                    │       .getColumns()
                                    │       .map(col => col.getField())
                                    │
                                    └─► TRUTH_TABLE_PANEL_STATE_CHANGED
                                        { columnOrder: [...new order...] }
```

**Persistence:** Column order is restored on next panel open via `buildTruthTableColumns()` which reorders columns based on `savedColumnOrder`.

### 6.4 The `_tabulatorNeedsSync` Flag

This flag enables efficient deferred synchronization when the panel is hidden.

```
                    PANEL HIDDEN
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
CIRCUIT_VALIDITY   CIRCUIT_ANALYSIS    SIMULATION_STEP
_CHANGED           _COMPUTED           _COMPLETED
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                         ▼
              _tabulatorNeedsSync = true
              (Track that Tabulator is stale)


                    PANEL SHOWN
                         │
                         ▼
                 Check _tabulatorNeedsSync
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
           false                  true
              │                     │
              ▼                     ▼
         Fast path           _syncTabulatorWithAnalysis()
         (no update)                │
                             ┌──────┴──────┐
                             │             │
                             ▼             ▼
                        Structure      Data only
                        changed        changed
                             │             │
                             ▼             ▼
                        Full table    setData()
                        rebuild       only
                             │             │
                             └──────┬──────┘
                                    │
                                    ▼
                          _tabulatorNeedsSync = false
```

**Why Needed:**
- Avoids DOM operations on hidden panel
- Batches multiple analysis updates into single sync
- Detects whether full rebuild or data update is needed

---

## 7. Module Subscription Summary

### What Each Module Subscribes To

| Module | Events Subscribed |
|--------|-------------------|
| **CircuitState** | *(none - source of events)* |
| **CircuitValidityManager** | `BOARD_CHANGED`, `BOARD_CLEARED`, `BOARD_LOADED` |
| **CircuitAnalysisManager** | `BOARD_CHANGED`, `COMPONENT_LABEL_CHANGED`, `BOARD_CLEARED`, `BOARD_LOADED` |
| **SimulationController** | `CIRCUIT_VALIDITY_CHANGED`, `IO_STRUCTURE_CHANGED` |
| **TruthTablePanel** | `SIMULATION_STEP_COMPLETED`, `CIRCUIT_VALIDITY_CHANGED`, `CIRCUIT_ANALYSIS_COMPUTING`, `CIRCUIT_ANALYSIS_COMPUTED` |
| **Toolbar** | `TOOLBAR_UPDATE_DISPLAYS`, `AUTOCYCLE_STATE_CHANGED`, `SIMULATION_STEP_COMPLETED`, `CONNECTION_START_CHANGED`, `UNDO_REDO_STATE_CHANGED` |
| **UndoRedoManager** | `COMPONENT_ADDED`, `COMPONENT_REMOVED`, `COMPONENT_MOVED`, `COMPONENT_LABEL_CHANGED`, `CONNECTION_ADDED`, `CONNECTION_REMOVED`, `BOARD_WILL_CLEAR`, `DRAG_STARTED`, `DRAG_ENDED` |
| **AutoSaveManager** | `BOARD_CHANGED`, `BOARD_LOADED`, `TRUTH_TABLE_PANEL_STATE_CHANGED`, `THEME_CHANGED`, `BOARD_CLEARED` |
| **CanvasRenderer** | `CANVAS_REDRAW` |

### What Each Module Emits

| Module | Events Emitted |
|--------|----------------|
| **CircuitState** | All component/connection/board events |
| **CircuitValidityManager** | `CIRCUIT_VALIDITY_CHANGED`, `IO_STRUCTURE_CHANGED` |
| **CircuitAnalysisManager** | `CIRCUIT_ANALYSIS_COMPUTED`, `CIRCUIT_ANALYSIS_COMPUTING` |
| **SimulationController** | `SIMULATION_STEP_COMPLETED`, `AUTOCYCLE_STATE_CHANGED`, `CANVAS_REDRAW` |
| **TruthTablePanel** | `TRUTH_TABLE_SHOWN`, `TRUTH_TABLE_HIDDEN`, `TRUTH_TABLE_PANEL_STATE_CHANGED` |
| **BoardOperations** | `TOOLBAR_UPDATE_DISPLAYS`, `CANVAS_REDRAW` |
| **UndoRedoManager** | `UNDO_REDO_STATE_CHANGED` |

### Event Propagation Order

```
1. Primary Event (e.g., COMPONENT_ADDED)
   │
   ├─► UndoRedoManager (synchronous) - captures state
   │
   └─► Triggers BOARD_CHANGED
           │
           ├─► CircuitValidityManager (synchronous)
           │       └─► CIRCUIT_VALIDITY_CHANGED
           │               └─► TruthTablePanel, SimulationController
           │
           └─► CircuitAnalysisManager (debounced 100ms)
                   └─► CIRCUIT_ANALYSIS_COMPUTED (after debounce)
                           └─► TruthTablePanel
```

---

## 8. Visual Flow Diagrams

### Complete Add Component → Show Truth Table Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           USER ADDS INPUT COMPONENT                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │     CanvasOperations.placeComponent  │
                    │         Creates INPUT component      │
                    └──────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │      state.addComponent(input)       │
                    └──────────────────────────────────────┘
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                 │
              ▼                                                 ▼
   ┌─────────────────────┐                          ┌─────────────────────┐
   │   COMPONENT_ADDED   │                          │    BOARD_CHANGED    │
   └─────────────────────┘                          └─────────────────────┘
              │                                                 │
              ▼                                                 │
   ┌─────────────────────┐                 ┌───────────────────┴───────────────┐
   │   UndoRedoManager   │                 │                                   │
   │   captures snapshot │                 ▼                                   ▼
   └─────────────────────┘      ┌─────────────────────┐          ┌─────────────────────┐
                                │CircuitValidityMgr   │          │CircuitAnalysisMgr   │
                                │   revalidates       │          │   (debounced)       │
                                └─────────────────────┘          └─────────────────────┘
                                           │                                │
                                           ▼                                │
                                ┌─────────────────────┐                     │
                                │CIRCUIT_VALIDITY_    │                     │
                                │CHANGED              │                     │
                                │{to:'incomplete'}    │                     │
                                └─────────────────────┘                     │
                                           │                                │
                           ┌───────────────┴──────────────┐                 │
                           │                              │                 │
                           ▼                              ▼                 │
              ┌─────────────────────┐        ┌─────────────────────┐       │
              │  TruthTablePanel    │        │SimulationController │       │
              │ Shows "incomplete"  │        │(stops if running)   │       │
              │ OR sets sync flag   │        └─────────────────────┘       │
              └─────────────────────┘                                      │
                                                                           │
                         [100ms debounce expires]                          │
                                                                           ▼
                                                            ┌─────────────────────┐
                                                            │CIRCUIT_ANALYSIS_    │
                                                            │COMPUTED             │
                                                            │(if circuit valid)   │
                                                            └─────────────────────┘
                                                                           │
                                                                           ▼
                                                            ┌─────────────────────┐
                                                            │  TruthTablePanel    │
                                                            │ Updates or marks    │
                                                            │ for sync            │
                                                            └─────────────────────┘
```

### Simulation Step Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS INPUT TO TOGGLE                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │    CircuitSimulator.toggleInput()    │
                    │    component.value = 1 - value       │
                    └──────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │ simulationController.onToggleInput() │
                    │    Recalculate cycleIndex            │
                    └──────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │       _restoreFromCacheOrAnalysis()  │
                    │   Restore values from truth table    │
                    │   OR run full simulation             │
                    └──────────────────────────────────────┘
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                 │
              ▼                                                 ▼
   ┌─────────────────────┐                          ┌─────────────────────┐
   │    CANVAS_REDRAW    │                          │SIMULATION_STEP_     │
   │                     │                          │COMPLETED            │
   │   CanvasRenderer    │                          │{cycleIndex, total,  │
   │   repaints          │                          │ inputValues}        │
   └─────────────────────┘                          └─────────────────────┘
                                                               │
                                       ┌───────────────────────┴───────────────┐
                                       │                                       │
                                       ▼                                       ▼
                          ┌─────────────────────┐                 ┌─────────────────────┐
                          │  TruthTablePanel    │                 │      Toolbar        │
                          │_handleStepCompleted │                 │setSimulationProgress│
                          │   Highlight row     │                 │"Combination N / M"  │
                          └─────────────────────┘                 └─────────────────────┘
```

### Board Load Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         USER LOADS SAVED BOARD                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │ ContextManager.loadCircuitContext()  │
                    └──────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │clearCurrentAnalysis│   │state.loadState() │   │setLastSavedState │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
                                       │
                                       ▼
                           ┌─────────────────────┐
                           │    BOARD_LOADED     │
                           └─────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌─────────────────┐        ┌─────────────────────┐        ┌─────────────────┐
│circuit-simulator│        │CircuitValidityMgr   │        │CircuitAnalysisMgr│
│    .js          │        │   revalidates       │        │   recomputes    │
│                 │        └─────────────────────┘        └─────────────────┘
│ Destroy old     │                   │                            │
│ TruthTablePanel │                   ▼                            ▼
│                 │        ┌─────────────────────┐       ┌─────────────────────┐
│ Optionally show │        │CIRCUIT_VALIDITY_    │       │CIRCUIT_ANALYSIS_    │
│ new one         │        │CHANGED              │       │COMPUTED (if valid)  │
└─────────────────┘        └─────────────────────┘       └─────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│         UndoRedoManager.clearHistory()              │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│         UNDO_REDO_STATE_CHANGED                     │
│         { canUndo: false, canRedo: false }          │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│         Toolbar: Disable undo/redo buttons          │
└─────────────────────────────────────────────────────┘
```

---

## Summary

The event architecture ensures:

1. **Decoupling** - Modules don't call each other directly; they communicate via events
2. **Declarative** - Events describe what happened, not what to do
3. **Predictable** - Event order is consistent across operations
4. **Efficient** - Debouncing and deferred sync prevent redundant work
5. **Testable** - Events can be mocked and verified independently

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Validity and Analysis are independent** | Both listen to `BOARD_CHANGED` separately; no event coupling between them |
| **Validity is synchronous** | Immediate user feedback ("Circuit incomplete") |
| **Analysis is debounced** | Batches rapid changes, avoids redundant computation |
| **Analysis validates before computing** | Cheap O(n) check before expensive O(2^n) enumeration |
| **Shared validation function** | Both managers call `validateCircuitForAnalysis()` from `CircuitAnalyzer.js` - single source of truth |
| **TruthTablePanel subscribes to both** | Handles invalid state immediately, valid data when ready |
| **AutoSaveManager handles persistence** | Separate from analysis computation; both react to `BOARD_CHANGED` independently |

### Alternative Considered but Rejected

**Sequential approach:** Have CircuitAnalysisManager wait for `CIRCUIT_VALIDITY_CHANGED` before computing.

**Why rejected:**
- Adds event coupling (fragile ordering dependency)
- No performance benefit (validation inside computation is already cheap)
- Complicates BOARD_LOADED handling (both need independent paths)
- Current design is simpler and more robust
