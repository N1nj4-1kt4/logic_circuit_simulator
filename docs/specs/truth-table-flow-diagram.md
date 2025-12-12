# Truth Table System - Complete Flow Diagram

## Status: COMPLETE ✓

> **Before modifying Truth Table code**, read [Development Guidelines](../TRUTH_TABLE_GUIDELINES.md)

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
│         │            ┌─────────┴─────────┐               │              │
│         │            │  StateMachine     │               │              │
│         │            │  (Decision Logic) │               │              │
│         │            └─────────┬─────────┘               │              │
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
- **TruthTablePanelStateMachine** = Decision logic (WHAT action to take)
- **CircuitState** = State container (WHERE data lives)
- **Event Bus** = Communication glue (HOW they talk)

---

## 2. STATE MACHINE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│               STATE MACHINE + ACTION DISPATCHER PATTERN                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TruthTablePanelStateMachine (src/ui/TruthTablePanelStateMachine.js) │
│  │                                                                 │    │
│  │  STATE:                                                         │    │
│  │  • panel: PANEL_STATES (HIDDEN, SHOWING_*, VISIBLE_*)          │    │
│  │  • data: DATA_STATES (FRESH, STALE, COMPUTING)                 │    │
│  │  • lastCycleIndex: number|null                                  │    │
│  │  • renderInProgress: boolean                                    │    │
│  │                                                                 │    │
│  │  HANDLERS (return Action objects):                              │    │
│  │  • handleShow() → Action                                        │    │
│  │  • handleHide() → Action                                        │    │
│  │  • handleValidityChanged(data) → Action                         │    │
│  │  • handleComputing(data) → Action                               │    │
│  │  • handleComputed(analysis, oldAnalysis) → Action               │    │
│  │  • handleStepCompleted(data) → Action                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                │                                         │
│                                │ Returns { action: ACTION_TYPE, ... }   │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TruthTablePanel._executeAction(action, options)                │    │
│  │                                                                 │    │
│  │  UNIFIED DISPATCHER - Three phases:                             │    │
│  │  1. PRE-ACTION: Panel reveal, position/dimension restoration    │    │
│  │  2. DISPATCH: Action-specific execution (switch statement)      │    │
│  │  3. POST-ACTION: _finalizeAction() (interactions, highlight,    │    │
│  │                  state save, emit TRUTH_TABLE_SHOWN)            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

PANEL_STATES:
• HIDDEN - Panel not visible
• SHOWING_COMPUTING - Visible, showing progress bar (no table)
• SHOWING_INVALID - Visible, showing error message (no table)
• SHOWING_TABLE - Visible, rendering table (async)
• VISIBLE_COMPUTING - Visible with table, computing overlay
• VISIBLE_TABLE - Visible, showing valid table
• VISIBLE_INVALID - Visible, showing invalid message

DATA_STATES:
• FRESH - Local copy matches CircuitState
• STALE - Changes occurred while hidden
• COMPUTING - Async computation in progress

ACTION_TYPES:
• NONE - No action needed (fast path)
• SHOW_COMPUTING - Display computing/progress state
• SHOW_INVALID - Display invalid circuit message
• RENDER_TABLE - Build new Tabulator instance
• REBUILD_TABLE - Rebuild due to structure change
• UPDATE_HEADERS - Update column headers only
• UPDATE_DATA - Update table data only
• SHOW_PROGRESS - Update progress bar
• HIGHLIGHT_ROW - Highlight simulation row
• HIDE - Hide the panel
• SYNC - Sync Tabulator with current analysis
```

---

## 3. USER CLICKS "TRUTH TABLE" BUTTON - COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER CLICKS "📊 Truth Table" BUTTON                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  index.html                                                              │
│  <button id="truthTable">📊 Truth Table</button>                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Toolbar.js                                                              │
│  Button click handler → calls this.onTruthTable() callback              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  circuit-simulator.js                                                    │
│  handleTruthTable() → generateTruthTable()                              │
│                                                                          │
│  1. Create TruthTablePanel if needed (first time or DOM removed)        │
│  2. Hook up state persistence callback (onStateChange)                   │
│  3. Restore saved state from CircuitState (position, size, columns)     │
│  4. Call panel.show()                                                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TruthTablePanel.show()  - STATE MACHINE DRIVEN                         │
│                                                                          │
│  Lifecycle: Constructor → init(savedState) → show() → hide() → destroy()│
│                                                                          │
│  async show() {                                                          │
│      // 1. Track if panel was hidden                                     │
│      const wasHidden = !this._isVisible();                              │
│                                                                          │
│      // 2. Get action from state machine                                 │
│      const action = this._stateMachine.handleShow();                    │
│                                                                          │
│      // 3. Delegate to unified dispatcher                                │
│      await this._executeAction(action, { isShowCall: true, wasHidden });│
│                                                                          │
│      // 4. Smart positioning on first open                               │
│      if (wasHidden) this._positionPanelIfNeeded(false);                 │
│  }                                                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────────────────┐       ┌─────────────────────────────────┐
│  State Machine Decision     │       │  _executeAction() Dispatch      │
│  _stateMachine.handleShow() │       │  (See Section 4 for details)    │
│                             │       │                                 │
│  Returns one of:            │       │  PRE-ACTION:                    │
│  • NONE (already visible)   │ ───▶  │  • Reveal panel                 │
│  • SYNC (data stale)        │       │  • Restore position/dimensions  │
│  • SHOW_COMPUTING (no data) │       │                                 │
│  • SHOW_INVALID (invalid)   │       │  DISPATCH:                      │
│  • RENDER_TABLE (need build)│       │  • Execute action-specific code │
│                             │       │                                 │
└─────────────────────────────┘       │  POST-ACTION:                   │
                                      │  • _finalizeAction()            │
                                      │  • Setup interactions           │
                                      │  • Update highlight             │
                                      │  • Save state                   │
                                      │  • Emit TRUTH_TABLE_SHOWN       │
                                      └─────────────────────────────────┘
```

---

## 4. _executeAction() - UNIFIED DISPATCHER

```
┌─────────────────────────────────────────────────────────────────────────┐
│  _executeAction(action, { isShowCall, wasHidden })                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  PHASE 1: PRE-ACTION (for show() calls with wasHidden=true)             │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  if (isShowCall && wasHidden && shouldRevealPanel(action)) {            │
│      panel.classList.remove('hidden');                                  │
│      panel.style.display = 'block';                                     │
│      panel.style.opacity = '0';  // Will be set to '1' after render     │
│      panel.style.pointerEvents = 'auto';                                │
│      _restoreSavedPosition();                                           │
│      _restoreSavedDimensions();                                         │
│  }                                                                       │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  PHASE 2: DISPATCH (action-specific)                                     │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.NONE (fast path - panel already visible)          │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • If Tabulator exists: quick rebuild for virtual DOM fix       │    │
│  │  • _buildTabulator({ isQuickRebuild: true })                    │    │
│  │  • _finalizeAction()                                            │    │
│  │  Note: Tabulator virtual DOM doesn't re-render after            │    │
│  │        display:none, so we rebuild (~50ms vs ~1400ms async)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.SYNC (data changed while hidden)                  │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _syncTabulatorWithAnalysis()                                 │    │
│  │  • Detects: structure change → rebuild                          │    │
│  │             label change → update headers                       │    │
│  │             data only → setData()                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.RENDER_TABLE (first open or need rebuild)         │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _setCircuitAnalysisLocalCopy()                               │    │
│  │  • Show spinner for large tables (>1024 rows)                   │    │
│  │  • _stateMachine.renderStarted()                                │    │
│  │  • await _buildTabulator({ isQuickRebuild: false })             │    │
│  │  • _stateMachine.renderCompleted()                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.REBUILD_TABLE (structure changed)                 │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • If !preserveDimensions: _saveState() then clear dimensions   │    │
│  │  • _stateMachine.renderStarted()                                │    │
│  │  • await _buildTabulator({ isQuickRebuild: false })             │    │
│  │  • _stateMachine.renderCompleted()                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.SHOW_COMPUTING (no analysis yet)                  │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • Set default dimensions if none saved                         │    │
│  │  • _renderComputingState() → shows progress bar                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.SHOW_INVALID (circuit incomplete)                 │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _renderInvalidState(reason) → shows warning message          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.UPDATE_HEADERS (labels changed)                   │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _updateColumnHeaders()                                       │    │
│  │  • _ensureTableHeight()                                         │    │
│  │  • _updateHighlight()                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.UPDATE_DATA (data only changed)                   │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • tabulatorInstance.setData(table)                             │    │
│  │  • _ensureTableHeight()                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.SHOW_PROGRESS (during async computation)          │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _showProgress(percent, current, total)                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.HIGHLIGHT_ROW (simulation stepped)                │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _highlightRowByIndex(index)                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ACTION_TYPES.HIDE                                              │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  • _hidePanel() → saves state, sets visible=false, hides        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  PHASE 3: POST-ACTION (finalization for applicable actions)             │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  if (isShowCall && wasHidden) {                                          │
│      panel.style.opacity = '1';  // Make visible after render           │
│  }                                                                       │
│                                                                          │
│  if (_needsFinalization(action, options)) {                             │
│      _finalizeAction({ isShowCall, skipHighlight });                    │
│  }                                                                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  _finalizeAction() handles:                                     │    │
│  │  • _setupInteractions() - drag/resize (idempotent)              │    │
│  │  • _updateHighlight() - if table present                        │    │
│  │  • _saveVisibleState() - for show() calls                       │    │
│  │  • emit(TRUTH_TABLE_SHOWN) - for show() calls                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. BACKGROUND COMPUTATION - AUTOMATIC RECOMPUTATION

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
│ TruthTablePanel._handleComputed():      │  │ If panel HIDDEN:                │
│                                         │  │                                 │
│ 1. _hideProgress()                      │  │ - State machine marks data      │
│ 2. Sync circuitAnalysis (deep copy)     │  │   as STALE                      │
│ 3. Get action from state machine        │  │ - No UI update                  │
│ 4. await _executeAction(action)         │  │ - Next show() will SYNC         │
└─────────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 6. PANEL UPDATE - WHEN DATA CHANGES (VIA _handleComputed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CIRCUIT_ANALYSIS_COMPUTED event received by TruthTablePanel            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _handleComputed() (async)                                              │
│                                                                          │
│  1. _hideProgress() - remove progress bar if showing                    │
│  2. Get analysis from circuitState                                       │
│  3. If !analysis: return                                                 │
│  4. ALWAYS: this.circuitAnalysis = _deepCopyAnalysis(analysis)          │
│  5. Get action from state machine:                                       │
│     action = _stateMachine.handleComputed(analysis, oldAnalysis)        │
│  6. await _executeAction(action)                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  State Machine Decision (handleComputed):                                │
│                                                                          │
│  If panel HIDDEN:                                                        │
│  • Mark data as STALE                                                    │
│  • Return { action: NONE }                                               │
│                                                                          │
│  If panel VISIBLE:                                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  STRUCTURE CHANGED? (input/output count different)               │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → { action: REBUILD_TABLE, preserveDimensions }             │   │
│  │        - If from SHOWING_COMPUTING: preserveDimensions=true      │   │
│  │        - Otherwise: preserveDimensions=false (clear dims)        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  LABELS CHANGED? (same structure, different labels)              │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → { action: UPDATE_HEADERS }                                │   │
│  │        - _updateColumnHeaders() uses setColumns()                │   │
│  │        - _ensureTableHeight() reapplies row heights              │   │
│  │        - _updateHighlight() re-highlights current row            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  DATA ONLY CHANGED? (same structure, same labels)                │   │
│  │  ─────────────────────────────────────────────────────────────── │   │
│  │  YES → { action: UPDATE_DATA }                                   │   │
│  │        - tabulatorInstance.setData(newData)                      │   │
│  │        - _ensureTableHeight()                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. HIDE / CLOSE FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER CLICKS CLOSE BUTTON (or BOARD_CLEARED event)                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TruthTablePanel.hide()                                                  │
│                                                                          │
│  1. Get action from state machine:                                       │
│     action = _stateMachine.handleHide()  → { action: HIDE }             │
│                                                                          │
│  2. _executeAction(action)                                               │
│     └──► _hidePanel()                                                   │
│                                                                          │
│  3. emit(TRUTH_TABLE_HIDDEN)                                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _hidePanel()                                                            │
│                                                                          │
│  1. _saveState() - BEFORE hiding (position becomes 0 after display:none)│
│  2. state.visible = false                                                │
│  3. onStateChange(state) - persist to localStorage                       │
│  4. panel.style.display = 'none'                                         │
│  5. panel.classList.add('hidden')                                        │
│                                                                          │
│  NOTE: Tabulator instance is PRESERVED (this.tabulatorInstance exists)  │
│        This is the KEY OPTIMIZATION - no rebuild on next show()         │
│        State machine preserves lastCycleIndex for scroll restoration    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. STATE PERSISTENCE FLOW

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
│  Captures: { columnOrder, width, height, rowHeight, x, y,               │
│              visible, highlightedRow }                                  │
│                                                                          │
│  • columnOrder: from tabulatorInstance.getColumns() or preserved        │
│  • x, y: from data-x, data-y attributes (transform position)            │
│  • width, height: from style or offsetWidth/offsetHeight                │
│  • rowHeight: from _currentRowHeight (for row height restoration)       │
│  • visible: from panel.style.opacity !== '0'                            │
│  • highlightedRow: from _stateMachine.getState().lastCycleIndex         │
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

## 9. EVENT MAP - WHO EMITS / WHO LISTENS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVENT BUS FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

CIRCUIT_ANALYSIS_COMPUTING
├── Emitted by: CircuitAnalysisManager._recomputeAnalysisAsync()
├── Payload: { percent, current, total }
└── Listened by: TruthTablePanel._handleComputing()
    → State machine: handleComputing() → SHOW_PROGRESS action

CIRCUIT_ANALYSIS_COMPUTED  ◄── Only fires for VALID circuits
├── Emitted by: CircuitAnalysisManager._handleComputationResult() (when isValid)
├── Payload: { inputs, outputs, table, isValid, reason }
└── Listened by: TruthTablePanel._handleComputed()
    → State machine: handleComputed() → REBUILD_TABLE/UPDATE_HEADERS/UPDATE_DATA

TRUTH_TABLE_SHOWN
├── Emitted by: TruthTablePanel._finalizeAction() (for show() calls)
├── Payload: (none)
└── Listened by: (internal tracking)

TRUTH_TABLE_HIDDEN
├── Emitted by: TruthTablePanel.hide()
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
└── Listened by: TruthTablePanel._handleStepCompleted()
    → State machine: handleStepCompleted() → HIGHLIGHT_ROW action

CIRCUIT_VALIDITY_CHANGED
├── Emitted by: CircuitValidityManager
└── Listened by: TruthTablePanel._handleValidityChanged()
    → State machine: handleValidityChanged() → SHOW_INVALID action
    - PRIMARY handler for invalid states
    - Shows invalid message IMMEDIATELY (no debounce)
    - CIRCUIT_ANALYSIS_COMPUTED will NOT fire for invalid circuits
```

---

## 10. DATA STRUCTURES

### Naming Clarification: tabulatorInstance vs circuitAnalysis.table
```
┌─────────────────────────────────────────────────────────────────────────┐
│  IMPORTANT NAMING DISTINCTION                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  tabulatorInstance = Tabulator.js library instance (UI component)        │
│                      - Created in _buildTabulator()                     │
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
    columnOrder: ['input_comp1', 'input_comp2', 'output_comp3'],
    width: '500px',
    height: '400px',
    rowHeight: 36,         // Saved row height for restoration
    x: 150,                // Transform translate X
    y: 200,                // Transform translate Y
    visible: true,
    highlightedRow: 3      // Last highlighted row index (for scroll restoration)
}
```

### State Machine State Object
```javascript
{
    panel: PANEL_STATES.VISIBLE_TABLE,  // Panel visibility state
    data: DATA_STATES.FRESH,            // Data sync state
    lastCycleIndex: 3,                  // Simulation row index
    renderInProgress: false             // Async render flag
}
```

---

## 11. PERFORMANCE CHARACTERISTICS

| Scenario | Time | Reason |
|----------|------|--------|
| **1st open (small circuit)** | ~100ms | Tabulator init + virtual DOM |
| **1st open (15 inputs, 32K rows)** | ~2-3s | Tabulator processes all rows at init |
| **2nd+ open (any size, NONE path)** | **~50ms** | **Quick rebuild for virtual DOM fix** |
| **2nd+ open (SYNC path)** | ~50-100ms | Depends on change type |
| **Data update while visible** | ~50-100ms | table.setData() optimized |
| **Structure change while visible** | ~2-3s | Full Tabulator rebuild required |
| **Background computation (small)** | ~10ms | Sync, no events |
| **Background computation (large)** | ~2-3s | Async with progress, debounced |

---

## 12. _buildTabulator() - UNIFIED TABLE BUILDER

```
┌─────────────────────────────────────────────────────────────────────────┐
│  _buildTabulator({ isQuickRebuild, clearDimensionsOnStructureChange })  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  This is the SINGLE place where Tabulator instances are created.        │
│                                                                          │
│  Options:                                                               │
│  • isQuickRebuild: true → Skip dimension logic (for NONE path)          │
│  • clearDimensionsOnStructureChange: true → Auto-fit on column changes  │
│                                                                          │
│  Steps:                                                                 │
│  1. Guard: Check circuitAnalysis and content exist                      │
│  2. Detect structure changes (column count mismatch) → clear dimensions │
│  3. Apply saved dimensions (if not quick rebuild)                       │
│  4. Estimate height for first open (no Tabulator yet)                   │
│  5. Preserve dimensions before destroying old Tabulator                 │
│  6. Show rendering spinner for large tables (>1024 rows)                │
│  7. Destroy existing Tabulator & unset Interact.js                      │
│  8. Create new Tabulator instance with virtual DOM                      │
│  9. Apply dark mode theme if needed                                     │
│  10. Return Promise that resolves on tableBuilt:                        │
│      • _applyTableHeight()                                              │
│      • _applyTableWidth() (if no saved width)                           │
│      • Register columnMoved listener for state persistence              │
│      • resolve()                                                        │
│                                                                          │
│  Two-Level Lifecycle:                                                   │
│  • Table Rebuild (_buildTabulator): Destroys Tabulator only,            │
│    preserves panel state, EventBus subscriptions                        │
│  • Full Destroy (destroy()): Destroys everything including              │
│    EventBus subscriptions                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 13. RELATED DOCUMENTATION

- [Development Guidelines](../TRUTH_TABLE_GUIDELINES.md) - **Read before making changes**
- [Refactoring Lessons](./truth-table-refactoring-lessons.md) - Historical regression analysis
- [Feature Specification](./truth-table-panel-feature-spec.md) - Complete behavior spec
- [Internal Flow](./truth-table-panel-internal-flow.md) - Method call graphs
