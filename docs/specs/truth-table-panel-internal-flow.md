# TruthTablePanel Internal Control Flow

This document provides a detailed visualization of how methods call each other within TruthTablePanel.js.

---

## 1. Method Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TruthTablePanel Methods                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC API (6 methods)           PRIVATE METHODS                           │
│  ─────────────────────            ───────────────                           │
│  • constructor()                  State Machine:                            │
│  • init(savedState)               • _stateMachine (instance)                │
│  • show()                         • _renderQueue (instance)                 │
│  • hide()                                                                   │
│  • destroy()                      Event Handlers:                           │
│  • getState()                     • _setupEventListeners()                  │
│                                   • _handleStepCompleted()                  │
│                                   • _handleValidityChanged()                │
│  CALLBACK                         • _handleComputing()                      │
│  ─────────                        • _handleComputed()                       │
│  • onStateChange                  • _handleBoardChanged()                   │
│                                                                              │
│                                   Action Dispatch:                          │
│                                   • _executeAction()                        │
│                                   • _finalizeAction()                       │
│                                   • _shouldRevealPanel()                    │
│                                   • _needsFinalization()                    │
│                                   • _isTableAction()                        │
│                                                                              │
│                                   Panel Visibility:                         │
│                                   • _isVisible()                            │
│                                   • _revealPanel()                          │
│                                   • _hidePanel()                            │
│                                   • _positionPanelIfNeeded()                │
│                                                                              │
│                                   Data Management:                          │
│                                   • _deepCopyAnalysis()                     │
│                                   • _setCircuitAnalysisLocalCopy()          │
│                                                                              │
│                                   Table Rendering:                          │
│                                   • _buildTabulator()                       │
│                                   • _renderInvalidState()                   │
│                                   • _renderComputingState()                 │
│                                   • _generateColumns()                      │
│                                   • _syncTabulatorWithAnalysis()            │
│                                   • _detectLabelChanges()                   │
│                                   • _updateColumnHeaders()                  │
│                                                                              │
│                                   Row Highlighting:                         │
│                                   • _highlightRowByIndex()                  │
│                                   • _updateHighlight()                      │
│                                   • _findMatchingRow()                      │
│                                                                              │
│                                   Layout & Sizing:                          │
│                                   • _applyRowStyles()                       │
│                                   • _applyTableHeight()                     │
│                                   • _ensureTableHeight()                    │
│                                   • _applyTableWidth()                      │
│                                                                              │
│                                   Drag & Resize:                            │
│                                   • _setupInteractions()                    │
│                                   • _dragMoveListener()                     │
│                                   • _resizeMoveListener()                   │
│                                                                              │
│                                   State Persistence:                        │
│                                   • _saveState()                            │
│                                   • _saveVisibleState()                     │
│                                   • _restoreState()                         │
│                                   • _restoreSavedPosition()                 │
│                                   • _restoreSavedDimensions()               │
│                                   • _setState()                             │
│                                                                              │
│                                   Progress UI:                              │
│                                   • _showProgress()                         │
│                                   • _hideProgress()                         │
│                                   • _showRenderingSpinner()                 │
│                                   • _hideRenderingSpinner()                 │
│                                   • _setupCloseButton()                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Constructor & Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INITIALIZATION CHAIN                               │
└─────────────────────────────────────────────────────────────────────────────┘

new TruthTablePanel(canvas, components, connections, circuitState)
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  constructor()                                                               │
│                                                                              │
│  1. Store references (canvas, components, connections, circuitState)        │
│  2. Initialize instance variables:                                          │
│     • tabulatorInstance = null   (Tabulator.js library instance)            │
│     • panel = null                                                          │
│     • state = null                                                          │
│     • circuitAnalysis = null                                                │
│     • columnOrder = null                                                    │
│     • interactionsSetup = false                                             │
│     • resizeRAF = null                                                      │
│     • onStateChange = null                                                  │
│     • _initialized = false                                                  │
│  3. Bind event handlers                                                     │
│  4. Call _setupEventListeners() ─────────────────────────────────────────┐  │
│  5. Create state machine: _stateMachine = new TruthTablePanelStateMachine() │
│  6. Create render queue: _renderQueue = new RenderQueue()                  │
└──────────────────────────────────────────────────────────────────────────│──┘
                                                                           │
           ┌───────────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _setupEventListeners()                                                      │
│                                                                              │
│  Subscribe to EventBus:                                                      │
│  • SIMULATION_STEP_COMPLETED ──▶ _handleStepCompleted()                     │
│  • CIRCUIT_VALIDITY_CHANGED ───▶ _handleValidityChanged()                   │
│  • CIRCUIT_ANALYSIS_COMPUTING ─▶ _handleComputing()                         │
│  • CIRCUIT_ANALYSIS_COMPUTED ──▶ _handleComputed()                          │
└─────────────────────────────────────────────────────────────────────────────┘

           ║
           ║ (Later, called by circuit-simulator.js)
           ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│  init(savedState)                                                            │
│                                                                              │
│  1. Cache DOM references:                                                    │
│     • this.panel = document.getElementById('truthTablePanel')               │
│     • content = document.getElementById('truthTableContent')                │
│  2. If savedState provided:                                                  │
│     └──▶ _setState(savedState) ────────────────────────────────────────────┐│
│  3. Call _setupCloseButton() ──────────────────────────────────────────────┐││
│  4. Set _initialized = true                                                │││
└────────────────────────────────────────────────────────────────────────────│┼┘
                                                                             ││
           ┌─────────────────────────────────────────────────────────────────┘│
           ▼                                                                  │
┌─────────────────────────────────────────────────────────────────────────────┐
│  _setupCloseButton()                                                         │
│                                                                              │
│  • Find close button element                                                 │
│  • Add click listener ──▶ hide()                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                              │
           ┌──────────────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _setState(state)  [private]                                                 │
│                                                                              │
│  1. If !state: set this.state = null, return                                │
│  2. Sanitize state (validate x, y positions)                                │
│  3. Remove legacy properties (left, top, transform)                         │
│  4. Set this.state = sanitizedState                                         │
│  5. If state.columnOrder exists: set this.columnOrder                       │
│  6. If state.highlightedRow: _stateMachine.setLastCycleIndex()              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Show Flow - State Machine Driven

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SHOW FLOW                                       │
│                                                                              │
│  show() delegates to state machine and unified dispatcher _executeAction(). │
│  All action handling flows through the single dispatcher.                    │
└─────────────────────────────────────────────────────────────────────────────┘

async show()
   │
   ├──▶ Guard: Check _initialized (throws if false)
   │
   ├──▶ Guard: Ensure panel DOM exists
   │
   ├──▶ Track: wasHidden = !_isVisible()
   │
   ├──▶ Get action from state machine:
   │    action = _stateMachine.handleShow()
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  State Machine handleShow() Decision Tree:                    │
   │    │                                                               │
   │    │  If already visible:                                          │
   │    │    • If data STALE → { action: SYNC }                        │
   │    │    • Otherwise → { action: NONE }                             │
   │    │                                                               │
   │    │  If HIDDEN (transitioning to visible):                        │
   │    │    • If no analysis → { action: SHOW_COMPUTING }              │
   │    │    • If !analysis.isValid → { action: SHOW_INVALID }          │
   │    │    • If tabulatorInstance && data FRESH → { action: NONE }    │
   │    │    • If tabulatorInstance && data STALE → { action: SYNC }    │
   │    │    • Otherwise → { action: RENDER_TABLE }                     │
   │    └───────────────────────────────────────────────────────────────┘
   │
   ├──▶ Delegate to unified dispatcher:
   │    await _executeAction(action, { isShowCall: true, wasHidden })
   │
   └──▶ Smart positioning on first open:
        if (wasHidden) _positionPanelIfNeeded(false)


┌─────────────────────────────────────────────────────────────────────────────┐
│  _executeAction(action, { isShowCall, wasHidden })                          │
│                                                                              │
│  UNIFIED DISPATCHER - Three phases for ALL actions                          │
└─────────────────────────────────────────────────────────────────────────────┘

_executeAction(action, options)
   │
   │  ════════════════════════════════════════════════════════════════════
   │  PHASE 1: PRE-ACTION (for show() calls transitioning from hidden)
   │  ════════════════════════════════════════════════════════════════════
   │
   ├──▶ Special handling for ACTION_TYPES.NONE with existing Tabulator:
   │    │  (Tabulator virtual DOM fix - needs rebuild after display:none)
   │    │
   │    ├──▶ _revealPanel()
   │    ├──▶ _restoreSavedPosition()
   │    ├──▶ _restoreSavedDimensions()
   │    ├──▶ await _buildTabulator({ isQuickRebuild: true })
   │    ├──▶ _finalizeAction({ isShowCall: true })
   │    └──▶ return
   │
   ├──▶ For slow paths (isShowCall && wasHidden && shouldRevealPanel):
   │    ├──▶ panel.classList.remove('hidden')
   │    ├──▶ panel.style.display = 'block'
   │    ├──▶ panel.style.opacity = '0'  // Hidden until render completes
   │    ├──▶ panel.style.pointerEvents = 'auto'
   │    ├──▶ _restoreSavedPosition()
   │    └──▶ _restoreSavedDimensions()
   │
   │  ════════════════════════════════════════════════════════════════════
   │  PHASE 2: DISPATCH (action-specific switch statement)
   │  ════════════════════════════════════════════════════════════════════
   │
   ├──▶ switch (action.action):
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  SHOW_COMPUTING:                                              │
   │    │  • _revealPanel() (if not show() call)                        │
   │    │  • Set default dimensions if none saved                       │
   │    │  • _renderComputingState()                                    │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  SHOW_INVALID:                                                │
   │    │  • _revealPanel() (if not show() call)                        │
   │    │  • _renderInvalidState(action.reason)                         │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  RENDER_TABLE:                                                │
   │    │  • _setCircuitAnalysisLocalCopy() (if show() call)            │
   │    │  • For large tables: position and make visible before build   │
   │    │  • _stateMachine.renderStarted()                              │
   │    │  • await _buildTabulator({ isQuickRebuild: false })           │
   │    │  • _stateMachine.renderCompleted()                            │
   │    │  • Re-position for large tables after build                   │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  REBUILD_TABLE:                                               │
   │    │  • If !preserveDimensions: _saveState() then clear dimensions │
   │    │  • _stateMachine.renderStarted()                              │
   │    │  • await _buildTabulator({ isQuickRebuild: false })           │
   │    │  • _stateMachine.renderCompleted()                            │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  UPDATE_HEADERS:                                              │
   │    │  • _updateColumnHeaders()                                     │
   │    │  • _ensureTableHeight()                                       │
   │    │  • _updateHighlight()                                         │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  UPDATE_DATA:                                                 │
   │    │  • tabulatorInstance.setData(circuitAnalysis.table)           │
   │    │  • _ensureTableHeight()                                       │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  SHOW_PROGRESS:                                               │
   │    │  • _showProgress(percent, current, total)                     │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  HIGHLIGHT_ROW:                                               │
   │    │  • _highlightRowByIndex(action.index)                         │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  HIDE:                                                        │
   │    │  • _hidePanel()                                               │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │    ┌───────────────────────────────────────────────────────────────┐
   │    │  SYNC:                                                        │
   │    │  • _revealPanel() + _restoreSavedPosition() (if show() call)  │
   │    │  • await _syncTabulatorWithAnalysis()                         │
   │    └───────────────────────────────────────────────────────────────┘
   │
   │  ════════════════════════════════════════════════════════════════════
   │  PHASE 3: POST-ACTION (finalization for applicable actions)
   │  ════════════════════════════════════════════════════════════════════
   │
   ├──▶ if (isShowCall && wasHidden):
   │    panel.style.opacity = '1'  // Make visible after render
   │
   ├──▶ if (_needsFinalization(action, options)):
   │    _finalizeAction({ isShowCall: true, skipHighlight })
   │
   └──▶ else if (_isTableAction(action) && !isShowCall):
        _finalizeAction({ isShowCall: false })
```

---

## 4. Hide Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HIDE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

hide()
   │
   ├──▶ Get action from state machine:
   │    action = _stateMachine.handleHide()  → { action: HIDE }
   │
   ├──▶ _executeAction(action)
   │    └──▶ _hidePanel()
   │
   └──▶ eventBus.emit(TRUTH_TABLE_HIDDEN)


┌─────────────────────────────────────────────────────────────────────────────┐
│  _hidePanel()                                                                │
│                                                                              │
│  1. _saveState()  (BEFORE hiding - captures dimensions while visible)       │
│  2. state.visible = false                                                   │
│  3. if (onStateChange) onStateChange(state)  (persist to localStorage)      │
│  4. panel.style.display = 'none'                                            │
│  5. panel.classList.add('hidden')                                           │
│                                                                              │
│  NOTE: Tabulator instance is PRESERVED (this.tabulatorInstance exists)      │
│        State machine preserves lastCycleIndex for scroll restoration        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Event Handler Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT HANDLERS                                    │
│                                                                              │
│  All event handlers delegate to state machine and execute returned action.  │
└─────────────────────────────────────────────────────────────────────────────┘

EventBus ════════════════════════════════════════════════════════════════════╗
         ║                                                                   ║
         ▼                                                                   ║
SIMULATION_STEP_COMPLETED { cycleIndex, ... }                                ║
         │                                                                   ║
         ▼                                                                   ║
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleStepCompleted(data)                                                 │
│                                                                             │
│  const action = _stateMachine.handleStepCompleted(data);                    │
│  _executeAction(action);                                                    │
│                                                                             │
│  State machine:                                                             │
│  • Always tracks lastCycleIndex = data.cycleIndex                          │
│  • If visible with table → { action: HIGHLIGHT_ROW, index }                │
│  • Otherwise → { action: NONE }                                            │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_VALIDITY_CHANGED { canSimulate, reason }
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleValidityChanged(data)  ◄── PRIMARY handler for invalid states      │
│                                                                             │
│  const action = _stateMachine.handleValidityChanged(data);                  │
│                                                                             │
│  // Update local analysis state when visible and invalid                    │
│  if (_isVisible() && !data.canSimulate && circuitAnalysis) {               │
│      circuitAnalysis.isValid = false;                                       │
│      circuitAnalysis.reason = data.reason;                                  │
│  }                                                                          │
│                                                                             │
│  _executeAction(action);                                                    │
│                                                                             │
│  State machine:                                                             │
│  • If hidden → mark data STALE, return { action: NONE }                    │
│  • If visible && !canSimulate → { action: SHOW_INVALID, reason }           │
│  • If visible && canSimulate → { action: NONE }                            │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_ANALYSIS_COMPUTING { percent, current, total }
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleComputing(data)                                                     │
│                                                                             │
│  const action = _stateMachine.handleComputing(data);                        │
│  _executeAction(action);                                                    │
│                                                                             │
│  State machine:                                                             │
│  • Sets data state to COMPUTING                                            │
│  • If hidden → { action: NONE }                                            │
│  • If visible → { action: SHOW_PROGRESS, percent, current, total }         │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_ANALYSIS_COMPUTED { ... }  ◄── Only fires for VALID circuits
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  async _handleComputed()   ◄── ALWAYS syncs data (even when hidden)        │
│                                                                             │
│  1. _hideProgress()                                                         │
│  2. Get analysis from circuitState                                          │
│  3. If !analysis: return                                                    │
│  4. ALWAYS: circuitAnalysis = _deepCopyAnalysis(analysis)  ◄── KEY         │
│  5. Get action from state machine:                                          │
│     action = _stateMachine.handleComputed(analysis, oldAnalysis)           │
│  6. await _executeAction(action)                                            │
│                                                                             │
│  State machine decision:                                                    │
│  • If hidden → mark STALE, return { action: NONE }                         │
│  • If structure changed → { action: REBUILD_TABLE, preserveDimensions }    │
│  • If labels changed → { action: UPDATE_HEADERS }                          │
│  • If data only changed → { action: UPDATE_DATA }                          │
│  • If from computing/invalid → { action: RENDER_TABLE }                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. _buildTabulator() - Unified Table Builder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  _buildTabulator({ isQuickRebuild, clearDimensionsOnStructureChange })      │
│                                                                              │
│  This is the SINGLE place where Tabulator instances are created.            │
│  Returns Promise<void> that resolves when tableBuilt event fires.           │
└─────────────────────────────────────────────────────────────────────────────┘

async _buildTabulator(options)
   │
   ├──▶ 1. Guard: Check circuitAnalysis and content exist
   │
   ├──▶ 2. Detect structure changes (column count mismatch):
   │    If changed → clear state.width, state.height, state.rowHeight
   │
   ├──▶ 3. Apply saved dimensions (if not quick rebuild):
   │    • panel.style.width = state.width
   │    • panel.style.height = state.height
   │
   ├──▶ 4. Generate columns:
   │    columns = _generateColumns()
   │
   ├──▶ 5. Estimate height for first open (no Tabulator yet):
   │    panel.style.height = estimatePanelHeight(...)
   │
   ├──▶ 6. Preserve dimensions before destroying old Tabulator:
   │    preservedDimensions = { width, height }
   │    panel.style.width/height = preserved values
   │
   ├──▶ 7. Show rendering spinner for large tables:
   │    if (!isQuickRebuild && (tabulatorInstance || isLargeTable)):
   │        content.innerHTML = ''  // Clear stale content
   │        _showRenderingSpinner()
   │
   ├──▶ 8. Destroy existing Tabulator & unset Interact.js:
   │    if (tabulatorInstance):
   │        tabulatorInstance.destroy()
   │        interact(panel).unset()
   │        interactionsSetup = false
   │
   ├──▶ 9. Create new Tabulator instance:
   │    tabulatorInstance = new Tabulator(content, {
   │        columns, data, layout: 'fitColumns',
   │        selectable: 1, movableColumns: true,
   │        height: '100%', renderVertical: 'virtual'
   │    })
   │
   ├──▶ 10. Apply dark mode if needed
   │
   └──▶ 11. Return Promise that resolves on 'tableBuilt':
        │
        └──▶ On tableBuilt callback:
             ├──▶ _hideRenderingSpinner()
             ├──▶ Register 'columnMoved' → _saveState()
             ├──▶ Calculate available height from panel dimensions
             ├──▶ _applyTableHeight(availableHeight, options)
             ├──▶ _applyTableWidth() (if no saved width)
             ├──▶ Release preserved dimensions (if auto-fitting)
             └──▶ resolve()
```

---

## 7. _syncTabulatorWithAnalysis() - Stale Data Sync

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  async _syncTabulatorWithAnalysis()                                         │
│                                                                              │
│  Called when panel becomes visible after changes occurred while hidden.      │
│  Gets FRESH data from circuitState to ensure we have the latest state.      │
└─────────────────────────────────────────────────────────────────────────────┘

async _syncTabulatorWithAnalysis()
   │
   ├──▶ 1. Get fresh analysis from circuitState (not stale local copy)
   │
   ├──▶ 2. Handle invalid state first:
   │    if (!freshAnalysis || !freshAnalysis.isValid):
   │        circuitAnalysis = deepCopy or null
   │        _renderInvalidState(reason)
   │        return
   │
   ├──▶ 3. Update local copy with fresh data:
   │    oldAnalysis = circuitAnalysis
   │    circuitAnalysis = _deepCopyAnalysis(freshAnalysis)
   │
   ├──▶ 4. Get actual component counts from circuit:
   │    (Not from cached analysis which may be stale during debounce)
   │
   ├──▶ 5. Detect structure change:
   │    if (currentColumns != actualComponents):
   │        _saveState()
   │        Clear dimensions
   │        await _buildTabulator({ clearDimensionsOnStructureChange: false })
   │        return
   │
   ├──▶ 6. Detect label changes:
   │    if (_detectLabelChanges()):
   │        _updateColumnHeaders()
   │        _ensureTableHeight()
   │        _updateHighlight()
   │        return
   │
   └──▶ 7. Data only change:
        tabulatorInstance.setData(circuitAnalysis.table)
        _ensureTableHeight()
```

---

## 8. _finalizeAction() - Post-Action Finalization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  _finalizeAction({ isShowCall, skipHighlight })                             │
│                                                                              │
│  Centralizes the finalization operations that must happen after any action  │
│  that changes panel content or visibility.                                  │
└─────────────────────────────────────────────────────────────────────────────┘

_finalizeAction(options)
   │
   ├──▶ _setupInteractions()  (idempotent - has guard inside)
   │    • Needed for ALL visible states, including invalid/computing
   │
   ├──▶ if (!skipHighlight && tabulatorInstance):
   │    _updateHighlight()
   │    • Re-highlights row based on current input values
   │    • Works after structure change (recalculates index)
   │
   └──▶ if (isShowCall):
        │  • State save and event only for show() calls
        ├──▶ _saveVisibleState()
        └──▶ eventBus.emit(TRUTH_TABLE_SHOWN)
        else if (tabulatorInstance):
        │  • Event-driven table rebuilds
        └──▶ _saveState()  (save new auto-fitted dimensions)
```

---

## 9. Complete Call Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE METHOD CALL GRAPH                                │
│                    (Who calls whom)                                          │
└─────────────────────────────────────────────────────────────────────────────┘

constructor()
    ├──▶ _setupEventListeners()
    ├──▶ new TruthTablePanelStateMachine(this)
    └──▶ new RenderQueue()

init(savedState)
    ├──▶ _setState(savedState)
    │        └──▶ _stateMachine.setLastCycleIndex()
    └──▶ _setupCloseButton()
             └──▶ (addEventListener → hide())

async show()
    ├──▶ _isVisible()
    ├──▶ _stateMachine.handleShow()
    ├──▶ await _executeAction(action, { isShowCall: true, wasHidden })
    └──▶ _positionPanelIfNeeded(false)
             └──▶ positionPanelSmartly() or _restoreState()

hide()
    ├──▶ _stateMachine.handleHide()
    ├──▶ _executeAction(action)
    │        └──▶ _hidePanel()
    │                 └──▶ _saveState()
    └──▶ eventBus.emit(TRUTH_TABLE_HIDDEN)

async _executeAction(action, options)
    │
    ├──▶ [NONE path with Tabulator]:
    │    ├──▶ _revealPanel()
    │    ├──▶ _restoreSavedPosition()
    │    ├──▶ _restoreSavedDimensions()
    │    ├──▶ await _buildTabulator({ isQuickRebuild: true })
    │    └──▶ _finalizeAction()
    │
    ├──▶ [PRE-ACTION for slow paths]:
    │    ├──▶ _restoreSavedPosition()
    │    └──▶ _restoreSavedDimensions()
    │
    ├──▶ [DISPATCH - action specific]:
    │    ├──▶ SHOW_COMPUTING: _revealPanel(), _renderComputingState()
    │    ├──▶ SHOW_INVALID: _revealPanel(), _renderInvalidState()
    │    ├──▶ RENDER_TABLE: _setCircuitAnalysisLocalCopy(), await _buildTabulator()
    │    ├──▶ REBUILD_TABLE: _saveState(), await _buildTabulator()
    │    ├──▶ UPDATE_HEADERS: _updateColumnHeaders(), _ensureTableHeight(), _updateHighlight()
    │    ├──▶ UPDATE_DATA: tabulatorInstance.setData(), _ensureTableHeight()
    │    ├──▶ SHOW_PROGRESS: _showProgress()
    │    ├──▶ HIGHLIGHT_ROW: _highlightRowByIndex()
    │    ├──▶ HIDE: _hidePanel()
    │    └──▶ SYNC: _revealPanel(), await _syncTabulatorWithAnalysis()
    │
    └──▶ [POST-ACTION]:
         └──▶ _finalizeAction() (if applicable)

_handleStepCompleted(data)
    ├──▶ _stateMachine.handleStepCompleted(data)
    └──▶ _executeAction(action)
             └──▶ _highlightRowByIndex()

_handleValidityChanged(data)
    ├──▶ _stateMachine.handleValidityChanged(data)
    └──▶ _executeAction(action)
             └──▶ _renderInvalidState()

_handleComputing(data)
    ├──▶ _stateMachine.handleComputing(data)
    └──▶ _executeAction(action)
             └──▶ _showProgress()

async _handleComputed()
    ├──▶ _hideProgress()
    ├──▶ _deepCopyAnalysis()
    ├──▶ _stateMachine.handleComputed()
    └──▶ await _executeAction(action)

_finalizeAction(options)
    ├──▶ _setupInteractions()  (idempotent)
    ├──▶ _updateHighlight()
    │        └──▶ _findMatchingRow()
    ├──▶ _saveVisibleState()  (if isShowCall)
    │        └──▶ _saveState()
    └──▶ eventBus.emit(TRUTH_TABLE_SHOWN)  (if isShowCall)

async _buildTabulator(options)
    ├──▶ _generateColumns()
    │        └──▶ buildTruthTableColumns()  (from truthTableUtils)
    ├──▶ _showRenderingSpinner()
    ├──▶ interact(panel).unset()
    ├──▶ new Tabulator()
    └──▶ On tableBuilt:
         ├──▶ _hideRenderingSpinner()
         ├──▶ _applyTableHeight()
         │        └──▶ _applyRowStyles()
         └──▶ _applyTableWidth()

async _syncTabulatorWithAnalysis()
    ├──▶ _deepCopyAnalysis()
    ├──▶ _renderInvalidState()  (if invalid)
    ├──▶ await _buildTabulator()  (if structure changed)
    ├──▶ _updateColumnHeaders() + _ensureTableHeight() + _updateHighlight()  (if labels changed)
    └──▶ tabulatorInstance.setData() + _ensureTableHeight()  (if data only)

_saveState()
    └──▶ onStateChange(state)  (callback to external)

destroy()
    ├──▶ eventBus.off() for all subscriptions
    ├──▶ tabulatorInstance.destroy()
    ├──▶ interact(panel).unset()
    ├──▶ cancelAnimationFrame(resizeRAF)
    └──▶ _stateMachine.reset()
```

---

## 10. State Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PANEL STATE TRANSITIONS                              │
│                                                                              │
│  Managed by TruthTablePanelStateMachine                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   CONSTRUCTED   │
                    │   (not ready)   │
                    └────────┬────────┘
                             │
                             │ init(savedState)
                             ▼
                    ┌─────────────────┐
                    │    HIDDEN       │◄────────────────────────────┐
                    │  (panel: HIDDEN)│                             │
                    └────────┬────────┘                             │
                             │                                      │
           ┌─────────────────┼─────────────────┐                    │
           │                 │                 │                    │
           │ show()          │ show()          │ show()             │
           │ (no analysis)   │ (invalid)       │ (has data)         │
           ▼                 ▼                 ▼                    │
    ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐         │
    │  SHOWING_   │   │  SHOWING_   │   │  SHOWING_TABLE  │         │
    │  COMPUTING  │   │  INVALID    │   │ or VISIBLE_TABLE│         │
    │ (progress)  │   │ (warning)   │   │  (table exists) │         │
    └──────┬──────┘   └──────┬──────┘   └────────┬────────┘         │
           │                 │                   │                   │
           │ CIRCUIT_ANALYSIS│                   │                   │
           │ _COMPUTED       │                   │                   │
           ▼                 │                   │                   │
    ┌─────────────────┐      │                   │                   │
    │  VISIBLE_TABLE  │◄─────┴───────────────────┘                   │
    │  (table built)  │                                              │
    └────────┬────────┘                                              │
             │                                                        │
             │ hide() or close button                                │
             └────────────────────────────────────────────────────────┘

DATA_STATES (orthogonal to panel state):
• FRESH - Local copy matches CircuitState cache
• STALE - Changes occurred while panel hidden
• COMPUTING - Async computation in progress
```

---

## 11. Action Dispatch Helper Methods

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACTION DISPATCH HELPER METHODS                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _shouldRevealPanel(action)                                                  │
│                                                                              │
│  Determines if an action requires revealing the panel.                       │
│                                                                              │
│  Returns true for:                                                          │
│  • SHOW_COMPUTING                                                            │
│  • SHOW_INVALID                                                              │
│  • RENDER_TABLE                                                              │
│  • SYNC                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _needsFinalization(action, options)                                         │
│                                                                              │
│  Determines if an action needs full finalization                             │
│  (interactions, highlight, state save, event).                               │
│                                                                              │
│  Returns false for (never need finalization):                               │
│  • SHOW_PROGRESS                                                             │
│  • HIGHLIGHT_ROW                                                             │
│  • HIDE                                                                      │
│  • UPDATE_HEADERS                                                            │
│  • UPDATE_DATA                                                               │
│                                                                              │
│  Returns true only if options.isShowCall === true                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _isTableAction(action)                                                      │
│                                                                              │
│  Determines if an action renders/rebuilds a table                            │
│  (needs interactions setup after event-driven changes).                      │
│                                                                              │
│  Returns true for:                                                          │
│  • RENDER_TABLE                                                              │
│  • REBUILD_TABLE                                                             │
│  • SYNC                                                                      │
│  • NONE (rebuilds Tabulator for virtual DOM fix)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Two-Level Lifecycle Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO-LEVEL LIFECYCLE ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

TruthTablePanel implements a two-level lifecycle for efficient resource management:

┌──────────────────┬─────────────────┬─────────────────────┬───────────────────────────┐
│ Level            │ Method          │ When                │ Preserves                 │
├──────────────────┼─────────────────┼─────────────────────┼───────────────────────────┤
│ Table Rebuild    │ _buildTabulator()│ Structure changes  │ Position, size,           │
│ (fine-grained)   │                 │ (inputs/outputs     │ subscriptions, panel DOM  │
│                  │                 │ added/removed)      │                           │
├──────────────────┼─────────────────┼─────────────────────┼───────────────────────────┤
│ Full Destroy     │ destroy()       │ Board switch/clear  │ Nothing (fresh start)     │
│ (coarse-grained) │                 │                     │                           │
└──────────────────┴─────────────────┴─────────────────────┴───────────────────────────┘

KEY INSIGHT: tabulatorInstance is destroyed and recreated during Table Rebuilds,
but EventBus subscriptions persist. This allows the panel to survive circuit
structure changes while efficiently rebuilding only the table component.

┌─────────────────────────────────────────────────────────────────────────────┐
│                         TABLE REBUILD (via _buildTabulator)                  │
└─────────────────────────────────────────────────────────────────────────────┘

_buildTabulator()
   │
   ├──▶ If tabulatorInstance exists:
   │    • tabulatorInstance.destroy()
   │    • interact(panel).unset()
   │    • interactionsSetup = false
   │
   ├──▶ Create new Tabulator instance
   │
   └──▶ Preserves: panel position, size, EventBus subscriptions, panel DOM

┌─────────────────────────────────────────────────────────────────────────────┐
│                          FULL DESTROY FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

destroy()  (called by circuit-simulator.js on BOARD_CLEARED / BOARD_LOADED)
   │
   ├──▶ Unsubscribe from EventBus:
   │    • eventBus.off(SIMULATION_STEP_COMPLETED, ...)
   │    • eventBus.off(CIRCUIT_VALIDITY_CHANGED, ...)
   │    • eventBus.off(CIRCUIT_ANALYSIS_COMPUTING, ...)
   │    • eventBus.off(CIRCUIT_ANALYSIS_COMPUTED, ...)
   │
   ├──▶ Destroy Tabulator:
   │    • If tabulatorInstance: tabulatorInstance.destroy(), tabulatorInstance = null
   │
   ├──▶ Unset Interact.js:
   │    • If interactionsSetup && panel: interact(panel).unset()
   │    • interactionsSetup = false
   │
   ├──▶ Cancel pending RAF:
   │    • If resizeRAF: cancelAnimationFrame(resizeRAF)
   │    • resizeRAF = null
   │
   ├──▶ Clear references:
   │    • panel = null
   │    • _initialized = false
   │
   └──▶ Reset state machine:
        • _stateMachine.reset()
```

---

## 13. Event Subscriptions Reference

### Summary Table

| Event | Emitted From | Handler | What Handler Does |
|-------|--------------|---------|-------------------|
| `SIMULATION_STEP_COMPLETED` | `SimulationController._simulateAndEmit()` | `_handleStepCompleted()` | State machine tracks index → HIGHLIGHT_ROW |
| `CIRCUIT_VALIDITY_CHANGED` | `CircuitValidityManager.revalidate()` | `_handleValidityChanged()` | **PRIMARY** handler for invalid states → SHOW_INVALID |
| `CIRCUIT_ANALYSIS_COMPUTING` | `CircuitAnalysisManager.computeCircuitAnalysisAsync()` | `_handleComputing()` | State machine tracks computing → SHOW_PROGRESS |
| `CIRCUIT_ANALYSIS_COMPUTED` | `CircuitAnalysisManager._handleComputationResult()` | `_handleComputed()` | **Only fires for valid circuits** → REBUILD_TABLE/UPDATE_HEADERS/UPDATE_DATA |

---

## 14. Action Path Invariants (CRITICAL)

**Every code path through show() and event handlers MUST satisfy these invariants.**

See [Development Guidelines](../TRUTH_TABLE_GUIDELINES.md) for detailed checklist.

### Invariant Matrix

| Path | `_setupInteractions()` | `_saveState()` | `_updateHighlight()` | `_restoreSavedDimensions()` |
|------|------------------------|----------------|----------------------|-----------------------------|
| show() NONE path | ✓ (in finalize) | ✓ (in finalize) | ✓ (in finalize) | ✓ (PRE-ACTION) |
| show() SYNC path | ✓ (in finalize) | ✓ (in finalize) | ✓ (in sync) | ✓ (PRE-ACTION) |
| show() RENDER_TABLE | ✓ (in finalize) | ✓ (in finalize) | ✓ (in finalize) | ✓ (PRE-ACTION) |
| show() SHOW_COMPUTING | ✓ (in finalize) | ✓ (in finalize) | N/A (no table) | ✓ (PRE-ACTION) |
| show() SHOW_INVALID | ✓ (in finalize) | ✓ (in finalize) | N/A (no table) | ✓ (PRE-ACTION) |
| _handleComputed() REBUILD_TABLE | ✓ (in finalize) | ✓ (check preserveDimensions) | ✓ (in finalize) | Check preserveDimensions |
| _handleComputed() UPDATE_HEADERS | N/A | N/A | ✓ (in action) | N/A |
| _handleComputed() UPDATE_DATA | N/A | N/A | N/A | N/A |

### Common Regression Points

These operations have historically caused regressions:

1. **`_setupInteractions()` missing** - Panel becomes undraggable
2. **`_saveState()` at wrong time** - Dimensions lost (e.g., saved during computing state)
3. **`_updateHighlight()` missing** - Wrong row highlighted after table operations
4. **Dimensions cleared without `preserveDimensions`** - User sizing lost on rebuild
5. **Missing PRE-ACTION setup** - Panel appears at wrong position/size

---

## 15. Related Documentation

- [Development Guidelines](../TRUTH_TABLE_GUIDELINES.md) - **Read before making changes**
- [Refactoring Lessons](./truth-table-refactoring-lessons.md) - Historical regression analysis
- [Feature Specification](./truth-table-panel-feature-spec.md) - Complete behavior spec
- [Flow Diagram](./truth-table-flow-diagram.md) - System-level flow
