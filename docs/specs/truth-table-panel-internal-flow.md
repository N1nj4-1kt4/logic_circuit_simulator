# TruthTablePanel Internal Control Flow

This document provides a detailed visualization of how methods call each other within TruthTablePanel.js.

---

## 1. Method Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TruthTablePanel Methods                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC API (7 methods)           PRIVATE METHODS (23 methods)              │
│  ─────────────────────            ────────────────────────────              │
│  • constructor()                  • _setupCloseButton()                     │
│  • init(savedState)               • _setupEventListeners()                  │
│  • show()                         • _handleStepCompleted()                  │
│  • hide()                         • _handleValidityChanged()                │
│  • refresh()                      • _handleComputing()                      │
│  • getState()                     • _handleComputed()                       │
│  • destroy()                      • _showProgress()                         │
│                                   • _hideProgress()                         │
│                                   • _isVisible()                            │
│                                   • _setState()                             │
│  CALLBACK                         • _highlightRowByIndex()                  │
│  ─────────                        • _positionPanelIfNeeded()  ◄── NEW       │
│  • onStateChange                  • _deepCopyAnalysis()       ◄── NEW       │
│                                   • _setCircuitAnalysisLocalCopy()          │
│                                   • _renderTabulator()                       │
│                                   • _renderInvalidState()                   │
│                                   • _renderComputingState()                 │
│                                   • _generateColumns()                      │
│                                   • _updateHighlight()                      │
│                                   • _findMatchingRow()                      │
│                                   • _applyRowStyles()         ◄── NEW       │
│                                   • _applyTableHeight()                     │
│                                   • _applyTableWidth()                      │
│                                   • _setupInteractions()  (now idempotent)  │
│                                   • _dragMoveListener()                     │
│                                   • _resizeMoveListener()                   │
│                                   • _saveState()                            │
│                                   • _restoreState()                         │
│                                   • _updateColumnHeaders()                  │
│                                   • _reapplyRowHeights()                    │
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
│     • _isRestoring = false                                                  │
│     • _initialized = false                                                  │
│  3. Bind event handlers                                                     │
│  4. Call _setupEventListeners() ─────────────────────────────────────────┐  │
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
│     └──▶ Set _isRestoring = true  ◄── Prevents _saveState() during restore ││
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
│  6. If state.columnOrder exists: set this.columnOrder                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Show/Hide Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SHOW FLOW                                       │
│                                                                              │
│  show() is async and orchestrates all rendering paths.                       │
│  Common post-render setup is INLINED at the end of show() for all paths.    │
└─────────────────────────────────────────────────────────────────────────────┘

async show()
   │
   ├──▶ [FAST PATH] If tabulatorInstance && panel exist:
   │         │
   │         ├──▶ panel.classList.remove('hidden')
   │         ├──▶ panel.style.display = 'block'
   │         ├──▶ panel.style.opacity = '1'
   │         ├──▶ panel.style.pointerEvents = 'auto'
   │         ├──▶ _updateHighlight()
   │         ├──▶ eventBus.emit(TRUTH_TABLE_SHOWN)
   │         └──▶ return  ◄──────────── INSTANT! No rebuild needed
   │
   └──▶ [SLOW PATH] No Tabulator instance exists:
             │
             ├──▶ Get panel & content DOM elements
             │
             ├──▶ Compute wasVisible (before showing)
             │
             ├──▶ _setCircuitAnalysisLocalCopy()
             │         (sets this.circuitAnalysis)
             │
             ├──▶ Show panel (display:block, opacity:0, pointerEvents:auto)
             │
             ├──▶ Apply saved position if !wasVisible
             │
             ├──▶ Branch based on circuitAnalysis.table.length:
             │    │
             │    ├──▶ If table.length === 0:
             │    │    │
             │    │    ├──▶ If reason === 'Computing...'
             │    │    │    └──▶ _renderComputingState(content)  [SYNC]
             │    │    │
             │    │    └──▶ Else
             │    │         └──▶ _renderInvalidState(content)    [SYNC]
             │    │
             │    └──▶ Else (has table data):
             │         └──▶ await _renderTabulator(content, wasVisible)  [ASYNC]
             │
             └──▶ Common post-render (INLINED, runs for ALL paths):
                       │
                       ├──▶ _positionPanelIfNeeded(wasVisible)
                       ├──▶ _setupInteractions()  (idempotent)
                       ├──▶ panel.style.opacity = '1'
                       └──▶ eventBus.emit(TRUTH_TABLE_SHOWN)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         HELPER METHODS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _setCircuitAnalysisLocalCopy()                                             │
│                                                                             │
│  1. Get analysis from circuitState.getCircuitAnalysis()                     │
│  2. If !analysis:                                                           │
│     • Set circuitAnalysis = { inputs:[], outputs:[], table:[],              │
│                               isValid:false, reason:'Computing...' }        │
│     • Return (early exit)                                                   │
│  3. Deep copy analysis via _deepCopyAnalysis()                              │
│  4. Initialize columnOrder if not set                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _renderTabulator(content, wasVisible)  [ASYNC - returns Promise<void>]     │
│                                                                             │
│  Only handles Tabulator creation - caller handles common post-render.       │
│                                                                             │
│  1. Guard: if !circuitAnalysis || !content → resolve immediately            │
│  2. Detect structure changes (column count mismatch) → clear dimensions     │
│  3. Apply saved dimensions if !wasVisible                                   │
│  4. Call _generateColumns()                                                 │
│  5. Destroy existing Tabulator & unset Interact.js                          │
│  6. Create new Tabulator instance                                           │
│  7. Return Promise that resolves on 'tableBuilt' event:                     │
│     └──▶ On tableBuilt:                                                     │
│          ├──▶ Listen for 'columnMoved' → _saveState()                       │
│          ├──▶ _updateHighlight()                                            │
│          ├──▶ _applyTableHeight()                                           │
│          ├──▶ _applyTableWidth() (if no saved width)                        │
│          ├──▶ If !_isRestoring: _saveState()                                │
│          └──▶ resolve()  ◄── Promise resolves here                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _renderInvalidState(content, reason)  [SYNC]                               │
│                                                                             │
│  Only handles content rendering - caller handles positioning/interactions.  │
│                                                                             │
│  1. Destroy existing Tabulator if any                                       │
│  2. Set content.innerHTML with warning icon and message                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _renderComputingState(content)  [SYNC]                                     │
│                                                                             │
│  Only handles content rendering - caller handles positioning/interactions.  │
│                                                                             │
│  1. Destroy existing Tabulator if any                                       │
│  2. Set content.innerHTML with progress bar                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _positionPanelIfNeeded(wasVisible)                                         │
│                                                                             │
│  1. If wasVisible: return (already positioned)                              │
│  2. Check hasValidSavedPosition (state.x/y defined and not both 0)         │
│  3. If no valid position: positionPanelSmartly()                           │
│  4. If valid position: _restoreState(this.state)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _setupInteractions()  [IDEMPOTENT]                                         │
│                                                                             │
│  Guard inside method: if (this.interactionsSetup) return;                   │
│                                                                             │
│  Configure Interact.js on panel:                                            │
│  1. draggable:                                                               │
│     • allowFrom: '.panel-header'                                            │
│     • move: _dragMoveListener()                                             │
│     • end: _saveState()                                                     │
│  2. resizable:                                                               │
│     • edges: all                                                            │
│     • move: _resizeMoveListener()                                           │
│     • end: _saveState()                                                     │
│  3. Set this.interactionsSetup = true                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _updateHighlight()                                                         │
│                                                                             │
│  1. Check tabulatorInstance && circuitAnalysis exist                        │
│  2. Get current input values from circuitAnalysis.inputs                    │
│  3. Call _findMatchingRow(inputValues)                                      │
│  4. If found: table.deselectRow(), rows[index].select(), scrollTo()        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _generateColumns()                                                          │
│                                                                              │
│  • Delegates to buildTruthTableColumns(inputs, outputs, savedColumnOrder)  │
│  • Returns Tabulator column definitions with Input/Output groups            │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              HIDE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

hide()
   │
   ├──▶ Check panel exists
   │
   ├──▶ _saveState()  (BEFORE hiding - offsetWidth becomes 0 after display:none)
   │
   ├──▶ panel.style.opacity = '0'
   ├──▶ panel.style.pointerEvents = 'none'
   ├──▶ panel.classList.add('hidden')
   └──▶ panel.style.display = 'none'


┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYOUT HELPERS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _restoreState(state)                                                       │
│                                                                             │
│  1. Cap dimensions to viewport percentages                                  │
│  2. Apply width/height (with bounds checking)                               │
│  3. Apply position via transform (with viewport clamping)                   │
│  4. Set data-x, data-y attributes                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _applyTableHeight(availableHeight, { fitPanel })                           │
│                                                                             │
│  1. Get header height and row count                                         │
│  2. Calculate optimal row height (25-36px range)                            │
│  3. Apply row height via _applyRowStyles()                                  │
│  4. Update container heights (content, tabulator, tableholder, table)       │
│  5. If fitPanel: resize panel to fit content (cap at 80% viewport)          │
│  6. Return actual total height                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _dragMoveListener(event)                                                   │
│                                                                             │
│  • Calculate new x, y from data-x/data-y + event.dx/dy                      │
│  • Apply transform: translate(x, y)                                         │
│  • Update data-x, data-y attributes                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _resizeMoveListener(event)                                                 │
│                                                                             │
│  1. Update element width/height from event.rect                             │
│  2. Adjust position for top/left edge resizing                              │
│  3. Calculate available height for table content                            │
│  4. Debounce via requestAnimationFrame:                                     │
│     └──▶ _applyTableHeight(availableHeight)                                 │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  _saveState()                                                               │
│                                                                             │
│  1. Check panel && table exist                                              │
│  2. Get column order from table.getColumns()                                │
│  3. Read position from data-x, data-y attributes                            │
│  4. Get dimensions from style or offsetWidth/Height                         │
│  5. Build state object: { columnOrder, width, height, x, y, visible }       │
│  6. Store in this.state                                                     │
│  7. If onStateChange callback: invoke it with state                         │
│     └──▶ onStateChange(this.state) ──▶ (circuit-simulator.js persistence)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Event Handler Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT HANDLERS                                    │
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
│  If _isVisible():                                                           │
│  └──▶ _highlightRowByIndex(data.cycleIndex) ────────────────────────────┐   │
└─────────────────────────────────────────────────────────────────────────│───┘
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _highlightRowByIndex(index)                                                │
│                                                                             │
│  1. Check table exists                                                      │
│  2. table.deselectRow()                                                     │
│  3. Get rows, select row[index], scrollTo                                   │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_VALIDITY_CHANGED { canSimulate, reason }
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleValidityChanged(data)                                               │
│                                                                             │
│  If _isVisible() && !data.canSimulate && circuitAnalysis:                   │
│  1. Update circuitAnalysis.isValid = false, reason = data.reason            │
│  2. If tabulatorInstance has no data:                                       │
│     └──▶ _renderInvalidState(content, data.reason)                          │
│         (panel already visible, no need for positioning/interactions)       │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_ANALYSIS_COMPUTING { percent, current, total }
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleComputing(data)                                                     │
│                                                                             │
│  If _isVisible():                                                            
│  └──▶ _showProgress(data.percent, data.current, data.total) ────────────┐   │
└─────────────────────────────────────────────────────────────────────────│───┘
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _showProgress(percent, current, total)                                     │
│                                                                             │
│  1. Get or create .truth-table-progress element                             │
│  2. Update progress bar width                                               │
│  3. Update detail text with counts                                          │
└─────────────────────────────────────────────────────────────────────────────┘

         ║
         ▼
CIRCUIT_ANALYSIS_COMPUTED { ... }
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _handleComputed()                                                          │
│                                                                             │
│  1. _hideProgress() ────────────────────────────────────────────────────┐   │
│  2. If _isVisible():                                                    │   │
│     a. Get analysis from circuitState                                   │   │
│     b. Deep copy to this.circuitAnalysis                                │   │
│     c. If table exists: table.setData(...)                              │   │
│     d. Else if table.length > 0: await _renderTabulator() ──────────────┼─┐ │
└─────────────────────────────────────────────────────────────────────────│─│─┘
                                                                          │ │
     ┌────────────────────────────────────────────────────────────────────┘ │
     ▼                                                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│  _hideProgress()                                                            │
│                                                                             │
│  • Remove .truth-table-progress element if exists                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REFRESH FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

refresh()
   │
   ├──▶ If !panel: return
   ├──▶ If panel.hidden: return
   │
   ├──▶ Get analysis from circuitState.getCircuitAnalysis()
   │
   ├──▶ If !analysis: hide() ──────────────────────────────────────────────────┐
   │                                                                           │
   ├──▶ If !table or table.length === 0:                                       │
   │    └──▶ _renderInvalidState(true) ────────────────────────────────────────┤
   │                                                                           │
   ├──▶ Detect change type:                                                    │
   │                                                                           │
   │    ┌─────────────────────────────────────────────────────────────────┐    │
   │    │  STRUCTURE CHANGED? (input/output count different)              │    │
   │    │  ─────────────────────────────────────────────────────────────  │   │
   │    │  countChanged = true                                            │   │
   │    │                                                                 │   │
   │    │  1. _saveState() ───────────────────────────────────────────────┼───┤
   │    │  2. Clear state.height, state.width                             │   │
   │    │  3. Clear panel inline styles                                   │   │
   │    │  4. Update this.circuitAnalysis (deep copy)                     │   │
   │    │  5. Reset this.columnOrder = null                               │   │
   │    │  6. _renderTable() ─────────────────────────────────────────────┼───┤
   │    └─────────────────────────────────────────────────────────────────┘   │
   │                                                                          │
   │    ┌─────────────────────────────────────────────────────────────────┐   │
   │    │  LABELS CHANGED? (same structure, different labels)             │   │
   │    │  ─────────────────────────────────────────────────────────────  │   │
   │    │  labelsChanged = true                                           │   │
   │    │                                                                 │   │
   │    │  1. Update this.circuitAnalysis (deep copy)                     │   │
   │    │  2. _updateColumnHeaders() ─────────────────────────────────────┼─┐ │
   │    │  3. table.replaceData(table)                                    │ │ │
   │    │  4. _reapplyRowHeights() ───────────────────────────────────────┼─┼┐│
   │    │  5. _updateHighlight() ─────────────────────────────────────────┼─┼┼┤
   │    └─────────────────────────────────────────────────────────────────┘ │││
   │                                                                        │││
   │    ┌─────────────────────────────────────────────────────────────────┐ │││
   │    │  DATA ONLY CHANGED? (same structure, same labels)               │ │││
   │    │  ─────────────────────────────────────────────────────────────  │ │││
   │    │  else (fast path)                                               │ │││
   │    │                                                                 │ │││
   │    │  1. Update this.circuitAnalysis (deep copy)                     │ │││
   │    │  2. table.replaceData(table)                                    │ │││
   │    │  3. _reapplyRowHeights() ───────────────────────────────────────┼ ┼┼┤
   │    │  4. _updateHighlight() ─────────────────────────────────────────┼ ┼┼┤
   │    └─────────────────────────────────────────────────────────────────┘ │││
   │                                                                        │││
   └─────────────────────────────────────────────────────────────────────── ┘││
                                                                           ││
     ┌─────────────────────────────────────────────────────────────────────┘│
     ▼                                                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│  _updateColumnHeaders()                                                      │
│                                                                              │
│  1. Generate new column definitions via _generateColumns()                  │
│  2. table.setColumns(newColumns) - updates headers without full rebuild    │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                           │
     ┌─────────────────────────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  _reapplyRowHeights()                                                        │
│                                                                              │
│  • Apply consistent row height (36px) to all .tabulator-row elements       │
│  • Set cell padding for vertical centering                                  │
│  • Called after replaceData() which resets Tabulator's internal styles     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Destroy Flow & Two-Level Lifecycle Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO-LEVEL LIFECYCLE ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

TruthTablePanel implements a two-level lifecycle for efficient resource management:

┌──────────────────┬─────────────────┬─────────────────────┬───────────────────────────┐
│ Level            │ Method          │ When                │ Preserves                 │
├──────────────────┼─────────────────┼─────────────────────┼───────────────────────────┤
│ Table Rebuild    │ _renderTabulator()│ Structure changes  │ Position, size,           │
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
│                         TABLE REBUILD (via _renderTabulator)                 │
└─────────────────────────────────────────────────────────────────────────────┘

_renderTabulator()
   │
   ├──▶ If tabulatorInstance exists:
   │    • tabulatorInstance.destroy()
   │    • Unset Interact.js bindings
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
   └──▶ Clear references:
        • panel = null
        • _initialized = false
```

---

## 7. Complete Call Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE METHOD CALL GRAPH                                │
│                    (Who calls whom)                                          │
└─────────────────────────────────────────────────────────────────────────────┘

constructor()
    └──▶ _setupEventListeners()

init(savedState)
    ├──▶ _setState(savedState)
    └──▶ _setupCloseButton()
             └──▶ (addEventListener → hide())

async show()
    ├──▶ [FAST PATH] _updateHighlight()
    │        └──▶ _findMatchingRow()
    └──▶ [SLOW PATH]
         ├──▶ _setCircuitAnalysisLocalCopy()
         │        └──▶ _deepCopyAnalysis()  ◄── NEW
         │
         ├──▶ If circuitAnalysis.table.length === 0:
         │    ├──▶ _renderComputingState() (sync) - if reason is 'Computing...'
         │    └──▶ _renderInvalidState() (sync) - otherwise
         └──▶ Else: await _renderTabulator() (async - resolves on tableBuilt)
                       ├──▶ _generateColumns()
                       ├──▶ Create Tabulator instance
                       └──▶ On tableBuilt: _updateHighlight(), _applyTableHeight()

         // Common post-render (inlined in show() after all paths):
         ├──▶ _positionPanelIfNeeded()
         ├──▶ _setupInteractions()  (idempotent)
         ├──▶ panel.style.opacity = '1'
         └──▶ eventBus.emit(TRUTH_TABLE_SHOWN)

hide()
    └──▶ _saveState()

async refresh()
    │
    ├──▶ Guard: if !panel or panel.hidden → return
    │
    ├──▶ Get analysis from circuitState
    │
    ├──▶ If !analysis:
    │    └──▶ hide() and return
    │
    ├──▶ If table.length === 0:
    │    ├──▶ _deepCopyAnalysis()
    │    └──▶ _renderInvalidState(content) and return
    │
    └──▶ Detect change type and handle:
         │
         ├──▶ [STRUCTURE CHANGED] (countChanged):
         │    ├──▶ _saveState()
         │    ├──▶ Clear state.height/width
         │    ├──▶ _deepCopyAnalysis()
         │    ├──▶ Reset columnOrder
         │    └──▶ await _renderTabulator(content, true)
         │
         ├──▶ [LABELS CHANGED]:
         │    ├──▶ _deepCopyAnalysis()
         │    ├──▶ _updateColumnHeaders()
         │    │        └──▶ _generateColumns()
         │    ├──▶ tabulatorInstance.replaceData()
         │    ├──▶ _reapplyRowHeights()
         │    └──▶ _updateHighlight()
         │
         └──▶ [DATA ONLY CHANGED] (fast path):
              ├──▶ _deepCopyAnalysis()
              ├──▶ tabulatorInstance.replaceData()
              ├──▶ _reapplyRowHeights()
              └──▶ _updateHighlight()

_handleStepCompleted()
    └──▶ _isVisible()
         └──▶ _highlightRowByIndex()

_handleValidityChanged()
    ├──▶ _isVisible()
    └──▶ _renderInvalidState()

_handleComputing()
    ├──▶ _isVisible()
    └──▶ _showProgress()

async _handleComputed()
    │
    ├──▶ _hideProgress()
    │
    └──▶ If _isVisible():
         │
         ├──▶ Get analysis from circuitState
         │
         └──▶ If analysis:
              │
              ├──▶ _deepCopyAnalysis()
              │
              ├──▶ If tabulatorInstance exists:
              │    └──▶ tabulatorInstance.setData()
              │
              └──▶ Else if table.length > 0:
                   └──▶ await _renderTabulator(content, true)
                        (panel already visible)

destroy()
    (no internal method calls - just cleanup)

getState()
    (returns this.state)

_setState(state)  [private]
    (sets this.state, this.columnOrder)

_saveState() ──▶ onStateChange(state)  [callback to external]
```

---

## 8. State Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PANEL STATE TRANSITIONS                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   CONSTRUCTED   │
                    │   (not ready)   │
                    └────────┬────────┘
                             │
                             │ init(savedState)
                             ▼
                    ┌─────────────────┐
                    │  INITIALIZED    │
                    │  (_initialized  │
                    │   = true)       │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           │ show()          │ show()          │ show()
           │ (no cache)      │ (computing)     │ (has cache)
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   INVALID   │   │  COMPUTING  │   │   VISIBLE   │
    │   STATE     │   │   STATE     │   │   (table    │
    │ (no table)  │   │ (progress)  │   │   exists)   │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           │                 │ CIRCUIT_ANALYSIS│
           │                 │ _COMPUTED       │
           │                 ▼                 │
           │          ┌─────────────┐          │
           └─────────▶│   VISIBLE   │◀─────────┘
                      │   (table    │
                      │   exists)   │
                      └──────┬──────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        │ hide()             │ refresh()          │ close button
        ▼                    ▼                    ▼
 ┌─────────────┐      (updates in place)   ┌─────────────┐
 │   HIDDEN    │      or rebuilds table    │   HIDDEN    │
 │  (table     │◀─────────────────────────▶│  (table     │
 │  preserved) │         show()            │  preserved) │
 └──────┬──────┘                           └─────────────┘
        │
        │ destroy()
        ▼
 ┌─────────────┐
 │  DESTROYED  │
 │ (all null)  │
 └─────────────┘
```

---

## 9. Extracted Helper Methods

The following helper methods were extracted to reduce code duplication:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTRACTED HELPER METHODS                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _positionPanelIfNeeded(wasVisible)                                         │
│                                                                             │
│  Called from: show() (inlined in common post-render setup)                  │
│                                                                             │
│  Handles panel positioning for ALL render paths (Tabulator, invalid,       │
│  computing). Previously duplicated across 3 render methods.                 │
│                                                                             │
│  1. If wasVisible: return (already positioned)                              │
│  2. Check hasValidSavedPosition (state.x/y defined and not both 0)         │
│  3. If no valid position: positionPanelSmartly()                           │
│  4. If valid position: _restoreState(this.state)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _deepCopyAnalysis(analysis)                                                │
│                                                                             │
│  Consolidated from 5+ locations:                                            │
│  - _handleComputed()                                                        │
│  - _setCircuitAnalysisLocalCopy()                                           │
│  - refresh() (countChanged, labelsChanged, dataOnly paths)                  │
│                                                                             │
│  Returns deep copy: {                                                       │
│      inputs: (inputs || []).map(inp => ({ ...inp })),                       │
│      outputs: (outputs || []).map(out => ({ ...out })),                     │
│      table: table || [],                                                    │
│      isValid, reason                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _applyRowStyles(content, rowHeight)                                        │
│                                                                             │
│  Consolidated from 2 locations:                                             │
│  - _applyTableHeight() (dynamic row height)                                 │
│  - _reapplyRowHeights() (fixed 36px height)                                 │
│                                                                             │
│  1. Calculate vertical padding from rowHeight                               │
│  2. Apply to .tabulator-row: height, min-height, max-height                 │
│  3. Apply to .tabulator-cell: height: auto, padding-top/bottom              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  _setupInteractions()  (idempotent)                                         │
│                                                                             │
│  Called from: show() (inlined in common post-render setup)                  │
│                                                                             │
│  Guard inside method:                                                       │
│  - if (this.interactionsSetup) return;  // Early return                     │
│  - ... setup code ...                                                       │
│  - this.interactionsSetup = true;                                           │
│                                                                             │
│  Now called from single location (show()) instead of 3 render methods.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Refactoring: Common Post-Render Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BEFORE: Post-render setup was duplicated across 3 render methods           │
│                                                                             │
│  - _renderInvalidState(): Had positioning, interactions, opacity, emit      │
│  - _renderComputingState(): Had positioning, interactions, opacity, emit    │
│  - _renderTabulator() tableBuilt: Had positioning, interactions, emit       │
│                                                                             │
│  PROBLEMS:                                                                   │
│  - Duplicated code in 3 places                                              │
│  - Inconsistent handling (some paths missing steps)                        │
│  - Hard to maintain                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER: Common post-render inlined in show() for ALL paths                  │
│                                                                             │
│  Render methods now ONLY handle content:                                    │
│  - _renderInvalidState(content): Just sets innerHTML with error message    │
│  - _renderComputingState(content): Just sets innerHTML with progress bar   │
│  - _renderTabulator(content, wasVisible): Just creates Tabulator, returns  │
│    Promise when ready                                                       │
│                                                                             │
│  show() handles ALL post-render setup in one place:                         │
│  1. _positionPanelIfNeeded(wasVisible)                                      │
│  2. _setupInteractions()  (idempotent)                                      │
│  3. panel.style.opacity = '1'                                               │
│  4. eventBus.emit(TRUTH_TABLE_SHOWN)                                        │
│                                                                             │
│  BENEFITS:                                                                   │
│  - Single source of truth for post-render setup                             │
│  - Consistent behavior across all paths                                     │
│  - Easier to maintain                                                       │
│  - Render methods have single responsibility (content only)                │
└─────────────────────────────────────────────────────────────────────────────┘
```
