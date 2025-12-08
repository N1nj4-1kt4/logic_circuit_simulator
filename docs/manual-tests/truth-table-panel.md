# TruthTablePanel Manual Test Cases

This document provides comprehensive manual test cases for the Truth Table Panel feature, covering all code paths in `src/ui/TruthTablePanel.js`.

**Reference Documentation:**
- [Truth Table Flow Diagram](../specs/truth-table-flow-diagram.md)
- [Truth Table Panel Internal Flow](../specs/truth-table-panel-internal-flow.md)

---

## Prerequisites

Before running tests:
1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000` in browser
3. Open browser DevTools console (for observing events/errors)
4. Clear localStorage if testing fresh state: `localStorage.clear()` then refresh

---

## Test Categories

### 1. Basic Lifecycle Tests

#### TC-1.1: First Panel Open (Slow Path)
**Code Path:** `show()` → `_setCircuitAnalysisLocalCopy()` → `_renderTabulator()` → `tableBuilt` callback

**Preconditions:**
- Fresh page load (no truth table panel shown yet)
- Circuit has at least 1 input and 1 output connected through a gate

**Steps:**
1. Create a simple circuit: INPUT → AND gate → OUTPUT
2. Connect all ports
3. Click the "📊 Truth Table" button in toolbar

**Expected Results:**
- [ ] Panel appears with slight delay (~100ms for small circuits)
- [ ] Panel is positioned smartly (not overlapping components)
- [ ] Table shows correct columns: Input group + Output group
- [ ] Table shows 2 rows (2^1 = 2 combinations for 1 input)
- [ ] Current input state row is highlighted
- [ ] Panel is draggable and resizable

**Code Coverage:** Lines 1157-1221 (slow path in `show()`)

---

#### TC-1.2: Panel Re-open (Fast Path)
**Code Path:** `show()` fast path → `_updateHighlight()` → return immediately

**Preconditions:**
- Truth table panel was previously opened and then closed

**Steps:**
1. Complete TC-1.1
2. Close the panel via X button
3. Click "📊 Truth Table" button again

**Expected Results:**
- [ ] Panel appears instantly (no rebuild)
- [ ] Panel appears in same position as before closing
- [ ] Panel has same dimensions as before
- [ ] Row highlighting updates to current input state
- [ ] Column order is preserved

**Code Coverage:** Lines 1158-1170 (fast path in `show()`)

---

#### TC-1.3: Panel Close via Button
**Code Path:** `hide()` → `_saveState()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. With panel open, click the X button in panel header

**Expected Results:**
- [ ] Panel fades out smoothly
- [ ] Panel state is saved (verify in DevTools: check `localStorage` for board state)
- [ ] Tabulator instance is preserved (not destroyed)

**Code Coverage:** Lines 1142-1151 (`hide()`)

---

#### TC-1.4: Panel Destroy on Board Clear
**Code Path:** `BOARD_CLEARED` event → `hide()` → `destroy()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. With panel open, click "Clear Board" in toolbar
2. Confirm the dialog

**Expected Results:**
- [ ] Panel disappears
- [ ] No errors in console
- [ ] Click "📊 Truth Table" on empty board shows appropriate message

**Code Coverage:** Lines 1281-1309 (`destroy()`)

---

#### TC-1.5: Panel Destroy on Board Load
**Code Path:** `BOARD_LOADED` event → `destroy()` → (optionally) `generateTruthTable()`

**Preconditions:**
- Truth table panel is open
- Another saved board exists

**Steps:**
1. Create and save a circuit as "Board1" with truth table open
2. Create and save a different circuit as "Board2"
3. Load "Board1"

**Expected Results:**
- [ ] Old panel is destroyed
- [ ] If Board1 had panel visible when saved, new panel is created
- [ ] New panel shows correct data for Board1's circuit

**Code Coverage:** Lines 554-575 in `circuit-simulator.js`, Lines 1281-1309 (`destroy()`)

---

### 2. Show Flow Tests

#### TC-2.1: Show with Valid Circuit (Table Data Exists)
**Code Path:** `show()` slow path → `_renderTabulator()` → Tabulator creation

**Preconditions:**
- Circuit with 2 inputs, 1 AND gate, 1 output (all connected)
- Panel has never been opened

**Steps:**
1. Build circuit: 2 INPUTs → AND gate → OUTPUT
2. Click "📊 Truth Table"

**Expected Results:**
- [ ] Panel shows with 4 rows (2^2 combinations)
- [ ] Columns are grouped: "Inputs" (2 columns) and "Outputs" (1 column)
- [ ] Each row shows correct AND gate logic (only row with both 1s has output 1)
- [ ] Current circuit state row is highlighted

**Code Coverage:** Lines 1203-1214 (has table data branch)

---

#### TC-2.2: Show with Invalid Circuit (No Outputs)
**Code Path:** `show()` → `_setCircuitAnalysisLocalCopy()` → `_renderInvalidState()`

**Preconditions:**
- Circuit has only inputs (no outputs)

**Steps:**
1. Place 2 INPUT components (no gates, no outputs)
2. Click "📊 Truth Table"

**Expected Results:**
- [ ] Panel appears with warning icon
- [ ] Message indicates "Add outputs to see truth table" or similar
- [ ] Panel is still draggable/resizable
- [ ] No JavaScript errors

**Code Coverage:** Lines 1204-1210 (table.length === 0 branch), Lines 530-549 (`_renderInvalidState()`)

---

#### TC-2.3: Show with Invalid Circuit (No Inputs)
**Code Path:** Same as TC-2.2

**Preconditions:**
- Circuit has only outputs (no inputs)

**Steps:**
1. Place 2 OUTPUT components (no gates, no inputs)
2. Click "📊 Truth Table"

**Expected Results:**
- [ ] Panel appears with warning message
- [ ] Message indicates circuit is incomplete

**Code Coverage:** Lines 1204-1210, Lines 530-549

---

#### TC-2.4: Show with Computing State (Large Circuit)
**Code Path:** `show()` → `_renderComputingState()` → (later) `_handleComputed()`

**Preconditions:**
- Circuit with 9+ inputs (512+ rows) - triggers async computation

**Steps:**
1. Build circuit: 9 INPUTs → large gate network → OUTPUT
2. Click "📊 Truth Table"

**Expected Results:**
- [ ] Panel appears immediately with "Computing truth table..." message
- [ ] Progress bar appears and updates
- [ ] Progress shows row count (e.g., "256 / 512 rows")
- [ ] When complete, table renders with all rows
- [ ] Virtual DOM handles scrolling smoothly

**Code Coverage:** Lines 1206-1207 (`_renderComputingState()`), Lines 176-180 (`_handleComputing()`), Lines 186-210 (`_handleComputed()`)

---

#### TC-2.5: Show Restores Saved Position
**Code Path:** `show()` → `_positionPanelIfNeeded()` → `_restoreState()`

**Preconditions:**
- Previously opened panel and dragged to custom position
- Closed and reopened the panel

**Steps:**
1. Open truth table panel
2. Drag panel to bottom-right corner
3. Close panel
4. Reopen panel

**Expected Results:**
- [ ] Panel appears in the saved position (bottom-right)
- [ ] Position is pixel-accurate

**Code Coverage:** Lines 1193-1201, Lines 295-311 (`_positionPanelIfNeeded()`), Lines 942-1015 (`_restoreState()`)

---

### 3. Refresh Flow Tests

#### TC-3.1: Structure Changed - Add Input (Full Rebuild)
**Code Path:** `refresh()` → countChanged=true → `_renderTabulator()`

**Preconditions:**
- Truth table panel is open
- Circuit has 1 input connected

**Steps:**
1. With panel open, add a second INPUT to the circuit
2. Connect the new input to the gate

**Expected Results:**
- [ ] Table rebuilds with new column
- [ ] Row count doubles (2 → 4)
- [ ] Panel auto-fits to new content size
- [ ] Position is preserved
- [ ] Column order resets for new structure

**Code Coverage:** Lines 1064-1090 (countChanged branch in `refresh()`)

---

#### TC-3.2: Structure Changed - Remove Input
**Code Path:** Same as TC-3.1

**Preconditions:**
- Truth table panel is open
- Circuit has 2 inputs connected

**Steps:**
1. With panel open, delete one INPUT component

**Expected Results:**
- [ ] Table rebuilds with fewer columns
- [ ] Row count halves (4 → 2)
- [ ] Panel auto-fits to smaller content

**Code Coverage:** Lines 1064-1090

---

#### TC-3.3: Labels Changed (Header Update Only)
**Code Path:** `refresh()` → labelsChanged=true → `_updateColumnHeaders()` → `replaceData()`

**Preconditions:**
- Truth table panel is open
- Circuit has labeled inputs

**Steps:**
1. With panel open, double-click an INPUT to edit its label
2. Change label from "A" to "X"
3. Press Enter

**Expected Results:**
- [ ] Column header updates immediately to "X"
- [ ] Table data remains unchanged
- [ ] No full table rebuild (smooth update)
- [ ] Row heights remain consistent

**Code Coverage:** Lines 1091-1097 (labelsChanged branch), Lines 1115-1124 (`_updateColumnHeaders()`)

---

#### TC-3.4: Data Only Changed (Fast Path)
**Code Path:** `refresh()` → else branch → `replaceData()` → `_updateHighlight()`

**Preconditions:**
- Truth table panel is open
- Simulation is running

**Steps:**
1. With panel open, toggle an INPUT value by clicking it

**Expected Results:**
- [ ] Row highlighting updates instantly
- [ ] Highlighted row scrolls into view
- [ ] No table flicker or rebuild

**Code Coverage:** Lines 1098-1107 (fast path)

---

#### TC-3.5: Transition from Invalid to Valid
**Code Path:** `refresh()` → hadNoTable=true → `_renderTabulator()`

**Preconditions:**
- Truth table panel shows invalid message (inputs but no outputs)

**Steps:**
1. With panel showing "invalid" message, add an OUTPUT
2. Connect OUTPUT to a gate

**Expected Results:**
- [ ] Invalid message disappears
- [ ] Table renders with correct data
- [ ] Panel auto-fits to content

**Code Coverage:** Lines 1048-1049 (hadNoTable check), Lines 1064-1090

---

#### TC-3.6: Transition from Computing to Valid
**Code Path:** `_handleComputed()` → `_renderTabulator()`

**Preconditions:**
- Large circuit (9+ inputs)
- Panel showing "Computing..." with progress bar

**Steps:**
1. Open panel on large circuit
2. Wait for computation to complete

**Expected Results:**
- [ ] Progress bar fills to 100%
- [ ] Progress UI disappears
- [ ] Table renders with all rows
- [ ] Scrolling works smoothly (virtual DOM)

**Code Coverage:** Lines 186-210 (`_handleComputed()`)

---

### 4. Event Handler Tests

#### TC-4.1: SIMULATION_STEP_COMPLETED - Row Highlighting
**Code Path:** `_handleStepCompleted()` → `_highlightRowByIndex()`

**Preconditions:**
- Truth table panel is open
- Simulation is in auto-cycle mode

**Steps:**
1. Open truth table on circuit with 3+ inputs
2. Start auto-cycling (Run Simulation button)
3. Observe row highlighting

**Expected Results:**
- [ ] Highlighted row changes with each simulation step
- [ ] Highlighted row scrolls into view
- [ ] Row index matches simulation cycle index

**Code Coverage:** Lines 148-152 (`_handleStepCompleted()`), Lines 278-288 (`_highlightRowByIndex()`)

---

#### TC-4.2: CIRCUIT_VALIDITY_CHANGED - Show Invalid Message
**Code Path:** `_handleValidityChanged()` → `_renderInvalidState()`

**Preconditions:**
- Truth table panel is open with valid circuit

**Steps:**
1. With panel open, delete a critical connection (making circuit incomplete)

**Expected Results:**
- [ ] Table is replaced with invalid message
- [ ] Warning icon appears
- [ ] Reason text explains why circuit is invalid

**Code Coverage:** Lines 158-170 (`_handleValidityChanged()`)

---

#### TC-4.3: CIRCUIT_ANALYSIS_COMPUTING - Progress Updates
**Code Path:** `_handleComputing()` → `_showProgress()`

**Preconditions:**
- Large circuit (9+ inputs)

**Steps:**
1. Modify large circuit while panel is open
2. Observe progress bar updates

**Expected Results:**
- [ ] Progress bar appears
- [ ] Percentage updates smoothly
- [ ] Row count updates (e.g., "128 / 512")

**Code Coverage:** Lines 176-180 (`_handleComputing()`), Lines 220-242 (`_showProgress()`)

---

#### TC-4.4: CIRCUIT_ANALYSIS_COMPUTED - Data Refresh
**Code Path:** `_handleComputed()` → `tabulatorInstance.setData()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. With panel open, modify circuit (add/remove connection)
2. Wait for debounce (200ms) and recomputation

**Expected Results:**
- [ ] Table data updates to reflect new circuit
- [ ] If structure unchanged, update is smooth (no flicker)
- [ ] Row highlighting updates appropriately

**Code Coverage:** Lines 186-210 (`_handleComputed()`)

---

### 5. User Interaction Tests

#### TC-5.1: Panel Drag
**Code Path:** `_dragMoveListener()` → `_saveState()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. Click and hold on panel header
2. Drag panel to new position
3. Release

**Expected Results:**
- [ ] Panel follows cursor smoothly
- [ ] Panel stays within viewport bounds
- [ ] Position is saved after drag ends
- [ ] Close and reopen panel - position persists

**Code Coverage:** Lines 848-856 (`_dragMoveListener()`), Lines 907-936 (`_saveState()`)

---

#### TC-5.2: Panel Resize - All Edges
**Code Path:** `_resizeMoveListener()` → `_applyTableHeight()` → `_saveState()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. Resize from right edge
2. Resize from bottom edge
3. Resize from top edge
4. Resize from left edge
5. Resize from corner (diagonal)

**Expected Results:**
- [ ] Panel resizes from each edge
- [ ] Minimum size enforced (200x150px)
- [ ] Table content adjusts to new size
- [ ] Row heights recalculate
- [ ] Size is saved after resize ends

**Code Coverage:** Lines 862-897 (`_resizeMoveListener()`), Lines 676-769 (`_applyTableHeight()`)

---

#### TC-5.3: Column Reorder - Within Input Group
**Code Path:** Tabulator `columnMoved` event → `_saveState()`

**Preconditions:**
- Truth table panel is open
- Circuit has 2+ inputs

**Steps:**
1. Drag "B" column header to left of "A" column header
2. Release

**Expected Results:**
- [ ] Columns reorder within Inputs group
- [ ] Cannot move input column to Outputs group
- [ ] Order persists after close/reopen
- [ ] Data rows update to match new column order

**Code Coverage:** Lines 477-479 (columnMoved listener)

---

#### TC-5.4: Column Reorder - Within Output Group
**Preconditions:**
- Truth table panel is open
- Circuit has 2+ outputs

**Steps:**
1. Drag one output column to reorder within Outputs group

**Expected Results:**
- [ ] Columns reorder within Outputs group
- [ ] Cannot move output column to Inputs group
- [ ] Order persists

---

#### TC-5.5: Close Button Click
**Code Path:** Close button click → `hide()`

**Preconditions:**
- Truth table panel is open

**Steps:**
1. Click the X button in panel header

**Expected Results:**
- [ ] Panel closes
- [ ] State is saved before closing
- [ ] No errors in console

**Code Coverage:** Lines 113-120 (`_setupCloseButton()`)

---

### 6. State Persistence Tests

#### TC-6.1: Position Saved Across Sessions
**Code Path:** `_saveState()` → `onStateChange` → `circuitState.setTruthTablePanelState()`

**Preconditions:**
- Truth table panel has been positioned

**Steps:**
1. Open panel and drag to custom position
2. Save the board
3. Refresh the page
4. Load the board
5. Open truth table panel

**Expected Results:**
- [ ] Panel appears in saved position
- [ ] Position is accurate to where it was saved

**Code Coverage:** Lines 907-936 (`_saveState()`), Lines 770-773 in `circuit-simulator.js`

---

#### TC-6.2: Dimensions Saved Across Sessions
**Steps:**
1. Open panel and resize to custom dimensions
2. Save the board, refresh, load
3. Open truth table panel

**Expected Results:**
- [ ] Panel has same width and height as saved
- [ ] Table content fits appropriately

---

#### TC-6.3: Column Order Saved Across Sessions
**Steps:**
1. Open panel and reorder columns
2. Save the board, refresh, load
3. Open truth table panel

**Expected Results:**
- [ ] Columns appear in saved order
- [ ] Both input and output groups maintain their order

---

#### TC-6.4: Visible State Saved with Board
**Steps:**
1. Open truth table panel
2. Save the board (panel visible)
3. Refresh the page
4. Load the board

**Expected Results:**
- [ ] Panel automatically appears when board loads
- [ ] Panel has saved position/size/column order

**Code Coverage:** Lines 261, 574 in `circuit-simulator.js`

---

#### TC-6.5: Hidden State Saved with Board
**Steps:**
1. Open truth table panel, then close it
2. Save the board (panel hidden)
3. Refresh the page
4. Load the board

**Expected Results:**
- [ ] Panel does NOT automatically appear
- [ ] When manually opened, has saved position/size

---

### 7. Edge Cases & Error States

#### TC-7.1: Empty Circuit (No Components)
**Preconditions:**
- Empty canvas

**Steps:**
1. Click "📊 Truth Table"

**Expected Results:**
- [ ] Panel shows appropriate message ("Add components to see truth table")
- [ ] No JavaScript errors

---

#### TC-7.2: Very Large Table (15 Inputs = 32K Rows)
**Preconditions:**
- Circuit with 15 inputs

**Steps:**
1. Build circuit with 15 inputs connected through gates to output
2. Open truth table

**Expected Results:**
- [ ] Progress bar shows during computation
- [ ] Computation completes without freezing browser
- [ ] Table renders with virtual DOM scrolling
- [ ] Scrolling is smooth (not rendering all 32K rows)

**Code Coverage:** Async computation path in CircuitAnalysisManager

---

#### TC-7.3: Panel Position Clamping at Edges
**Steps:**
1. Drag panel partially off-screen (right edge)
2. Release
3. Close and reopen panel

**Expected Results:**
- [ ] Panel position is clamped to keep it partially visible
- [ ] At least 20% of panel remains visible

**Code Coverage:** Lines 988-1000 in `_restoreState()`

---

#### TC-7.4: Corrupted Saved State
**Steps:**
1. Manually corrupt localStorage state (set panel x to -10000)
2. Reload page and load board
3. Open truth table

**Expected Results:**
- [ ] Panel appears at valid position (sanitized)
- [ ] No errors thrown
- [ ] Panel is fully usable

**Code Coverage:** Lines 1243-1248 in `_setState()` (sanitization)

---

#### TC-7.5: Structure Change Clears Saved Dimensions
**Preconditions:**
- Panel was open with 2 inputs, saved with specific size
- Close panel

**Steps:**
1. Add a third input while panel is closed
2. Open panel

**Expected Results:**
- [ ] Panel auto-fits to new structure (3 columns instead of 2)
- [ ] Width is not the old saved width (would be too narrow)

**Code Coverage:** Lines 405-418 in `_renderTabulator()` (structure change detection)

---

#### TC-7.6: Rapid Open/Close
**Steps:**
1. Rapidly click Truth Table button 10 times

**Expected Results:**
- [ ] No duplicate panels
- [ ] Panel state is consistent
- [ ] No JavaScript errors

---

#### TC-7.7: Panel Open During Board Operations
**Steps:**
1. Open truth table panel
2. While panel is open, perform: Save, Clear, Load different board

**Expected Results:**
- [ ] Panel handles each operation gracefully
- [ ] No stale data displayed
- [ ] No errors

---

### 8. Two-Level Lifecycle Tests

#### TC-8.1: Table Rebuild (Fine-Grained)
**Code Path:** `_renderTabulator()` destroys only Tabulator, preserves EventBus subscriptions

**Preconditions:**
- Truth table panel is open

**Steps:**
1. With panel open, add a new input (structure change)
2. Observe table rebuild

**Expected Results:**
- [ ] Table rebuilds with new column
- [ ] Panel position is preserved
- [ ] Panel continues to receive events (try toggling input)
- [ ] Row highlighting still works

**Code Coverage:** Lines 433-446 in `_renderTabulator()` (destroy old, create new)

---

#### TC-8.2: Full Destroy (Coarse-Grained)
**Code Path:** `destroy()` unsubscribes all events, destroys all resources

**Preconditions:**
- Truth table panel is open

**Steps:**
1. Clear the board (triggers BOARD_CLEARED)
2. Create new circuit
3. Open truth table panel

**Expected Results:**
- [ ] New panel is completely fresh
- [ ] No duplicate event handlers
- [ ] No memory leaks (check DevTools Memory tab if concerned)

**Code Coverage:** Lines 1281-1309 (`destroy()`)

---

## Test Matrix (Quick Reference)

| Test ID | Category | Code Path | Priority |
|---------|----------|-----------|----------|
| TC-1.1 | Lifecycle | show() slow path | High |
| TC-1.2 | Lifecycle | show() fast path | High |
| TC-1.3 | Lifecycle | hide() | High |
| TC-1.4 | Lifecycle | destroy() on clear | Medium |
| TC-1.5 | Lifecycle | destroy() on load | Medium |
| TC-2.1 | Show | Valid circuit | High |
| TC-2.2 | Show | No outputs | Medium |
| TC-2.3 | Show | No inputs | Medium |
| TC-2.4 | Show | Computing state | Medium |
| TC-2.5 | Show | Restore position | High |
| TC-3.1 | Refresh | Add input | High |
| TC-3.2 | Refresh | Remove input | High |
| TC-3.3 | Refresh | Label change | Medium |
| TC-3.4 | Refresh | Data only | High |
| TC-3.5 | Refresh | Invalid→Valid | Medium |
| TC-3.6 | Refresh | Computing→Valid | Medium |
| TC-4.1 | Events | Simulation step | High |
| TC-4.2 | Events | Validity changed | Medium |
| TC-4.3 | Events | Computing progress | Low |
| TC-4.4 | Events | Analysis computed | High |
| TC-5.1 | Interaction | Drag | High |
| TC-5.2 | Interaction | Resize | High |
| TC-5.3 | Interaction | Column reorder (input) | Medium |
| TC-5.4 | Interaction | Column reorder (output) | Medium |
| TC-5.5 | Interaction | Close button | High |
| TC-6.1 | Persistence | Position | High |
| TC-6.2 | Persistence | Dimensions | Medium |
| TC-6.3 | Persistence | Column order | Medium |
| TC-6.4 | Persistence | Visible state | Medium |
| TC-6.5 | Persistence | Hidden state | Low |
| TC-7.1 | Edge Case | Empty circuit | Medium |
| TC-7.2 | Edge Case | Large table | Medium |
| TC-7.3 | Edge Case | Position clamp | Low |
| TC-7.4 | Edge Case | Corrupted state | Low |
| TC-7.5 | Edge Case | Structure change dims | Low |
| TC-7.6 | Edge Case | Rapid open/close | Low |
| TC-7.7 | Edge Case | Board operations | Medium |
| TC-8.1 | Lifecycle | Table rebuild | Medium |
| TC-8.2 | Lifecycle | Full destroy | Medium |

---

## Code Path Coverage Summary

| Section | Lines | Methods Covered |
|---------|-------|-----------------|
| Constructor/Init | 35-120 | constructor, init, _setupCloseButton, _setupEventListeners |
| Event Handlers | 130-210 | _handleStepCompleted, _handleValidityChanged, _handleComputing, _handleComputed |
| Progress UI | 220-256 | _showProgress, _hideProgress |
| Visibility | 267-311 | _isVisible, _highlightRowByIndex, _positionPanelIfNeeded |
| Data Management | 324-367 | _deepCopyAnalysis, _setCircuitAnalysisLocalCopy |
| Rendering | 400-576 | _renderTabulator, _renderInvalidState, _renderComputingState |
| Highlighting | 587-636 | _generateColumns, _updateHighlight, _findMatchingRow |
| Layout | 648-797 | _applyRowStyles, _applyTableHeight, _applyTableWidth |
| Interactions | 808-897 | _setupInteractions, _dragMoveListener, _resizeMoveListener |
| State | 907-1015 | _saveState, _restoreState |
| Public API | 1021-1309 | refresh, hide, show, getState, _setState, destroy |
