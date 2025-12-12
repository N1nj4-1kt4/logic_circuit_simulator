# TruthTablePanel Bug Fix Plan

## Implementation Constraints

These fixes MUST follow these best practices:
1. **NO new events** introduced
2. **NO new event listeners** - TruthTablePanel should not listen to any events it doesn't already listen to
3. **NO new action types** - use existing ACTION_TYPES only
4. **Maximize DRY** - use common functions like `_finalizeAction()` for all action paths
5. **Fix lurking bugs** - by routing through common functions, fixes should address undiscovered issues too

---

## Testing Results Summary

### Original Audit Issues

| Issue | Status | Notes |
|-------|--------|-------|
| #1 Uninitialized `_currentRowHeight` | **No visible bug** | Row heights work, but console error observed (see Bug 1) |
| #2 REBUILD_TABLE timing | **Works correctly** | Panel auto-fits to new content |
| #3 SYNC saves old structure | **Works correctly** | Mitigated by merge logic |
| #4 `_saveState()` silent failure | **BUG CONFIRMED** | Invalid state → move/resize → refresh → loses position/size AND interactions broken |
| #5 Duplicate onStateChange | Deferred | |
| #6 Inconsistent row height | **PARTIAL BUG** | Scenario 3 confirmed: no manual resize + label rename → row height changes |

### New Bugs Identified

| Bug | Description | Severity |
|-----|-------------|----------|
| Bug 1 | Console error: "Invalid column definition option: componentId" | LOW |
| Bug 2 | Row highlighting lost after INPUT/OUTPUT add/delete while table open | MEDIUM |
| Bug 3 | Page refresh shows "Computing..." even when data is cached | MEDIUM |
| Bug 4 (from #4) | Invalid state → resize/move → refresh → interactions broken | HIGH |

---

## Bug Analysis and Fixes

### Bug 1: Invalid column definition option: componentId

**Symptom:** Console warning from Tabulator about unknown `componentId` option.

**Root Cause:** `componentId` is added to column definitions in `truthTableUtils.js` and IS used by `columnOrderStrategies.js` for sorting columns by creation order. However, Tabulator warns about unrecognized properties.

**Files:**
- [src/utils/truthTableUtils.js:37,47](src/utils/truthTableUtils.js#L37) - Adds `componentId` to column defs
- [src/utils/columnOrderStrategies.js:97-107](src/utils/columnOrderStrategies.js#L97) - Uses `componentId` for sorting

**Fix:** Tabulator supports custom properties via `accessorParams` or by accepting the warning. Since `componentId` is only used BEFORE passing to Tabulator (in sorting), we can either:
1. Remove it after sorting is done (before passing to Tabulator)
2. Or suppress the warning (low priority - it's cosmetic)

---

### Bug 2: Row highlighting lost after structure change

**Symptom:** Adding/deleting INPUT/OUTPUT while table is open causes row highlighting to disappear. Hide/reopen doesn't restore it.

**Root Cause Analysis:**
- REBUILD_TABLE action clears `lastCycleIndex` in state machine (L338 in StateMachine)
- This is intentional because row indices change when structure changes
- But the simulation is still running with the same cycle - we should re-highlight based on current input values

**Files:**
- [src/ui/TruthTablePanelStateMachine.js:338](src/ui/TruthTablePanelStateMachine.js#L338) - `this._state.lastCycleIndex = null`
- [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) - `_executeAction()` for REBUILD_TABLE

**Fix:** After REBUILD_TABLE completes, call `_updateHighlight()` to highlight row based on current input values (not stored cycle index).

---

### Bug 3: Page refresh shows "Computing..." for cached data

**Symptom:** Hide panel → Refresh page → Open panel shows "Computing..." even though data should be cached.

**Root Cause Analysis:**
- Analysis is **NOT persisted to localStorage** - only held in memory
- On page refresh, memory is cleared → analysis is `null`
- `AutoSaveManager.loadBoardState()` calls `recomputeAnalysis()` which recomputes from scratch
- For >8 inputs, async computation shows progress bar
- Hide/reopen works instantly because analysis stays in memory

**User Perspective:** Hide→Reopen and Hide→Refresh→Reopen are identical from user's view - no circuit changes occurred in either case. The inconsistent behavior (instant vs "Computing...") is confusing and should be fixed.

**Files:**
- [src/core/CircuitAnalysisManager.js:123-138](src/core/CircuitAnalysisManager.js#L123) - Sync vs async computation
- [src/storage/AutoSaveManager.js:189](src/storage/AutoSaveManager.js#L189) - Triggers recomputation on load

**Fix:** Persist analysis to localStorage alongside board data. On load, restore cached analysis immediately.

**Implementation considerations:**
1. **Storage size:** For very large circuits (10+ inputs = 1024+ rows), storage may be a concern. Consider a threshold (e.g., ≤512 rows) for caching, or always cache and let browser handle storage limits.
2. **Invalidation:** Cache is automatically invalidated when circuit changes trigger `recomputeAnalysis()`. The existing `BOARD_CHANGED` flow handles this.
3. **Storage location:** Save alongside board data in `AutoSaveManager.saveBoardState()`

---

### Bug 4 (from Issue #4): Invalid state loses interactions after refresh

**Symptom:**
1. Table open, circuit valid
2. Delete component → table shows invalid message
3. Move/resize panel (works during session)
4. Refresh page
5. Panel appears at OLD position/size, and cannot be moved/resized

**Root Cause Analysis:**

The issue is in `_saveState()` at L1303-1307:
```javascript
_saveState() {
    if (!this.panel || !this.tabulatorInstance) {
        return;  // Silent exit when showing invalid state!
    }
    // ... state never saved
}
```

When showing invalid state:
- `tabulatorInstance` is `null` (destroyed in `_renderInvalidState`)
- `_saveState()` returns early
- Position/size changes during invalid state are never persisted
- On refresh, old (pre-invalid) state is loaded

Also, interactions may not be set up after restore because `_setupInteractions()` is only called for table actions.

**Files:**
- [src/ui/TruthTablePanel.js:1303-1307](src/ui/TruthTablePanel.js#L1303-L1307) - `_saveState()` guard
- [src/ui/TruthTablePanel.js:539-548](src/ui/TruthTablePanel.js#L539-L548) - `_hidePanel()` calls `_saveState()`

**Fix:**
1. `_saveState()` should save position/size even without tabulatorInstance
2. Only skip column order saving when no tabulatorInstance
3. Ensure interactions are set up for invalid/computing states too

---

### Issue #6 Scenario 3: Row height changes on label rename (no prior manual resize)

**Symptom:** Auto-fit panel → close → rename INPUT → reopen → row height changes

**Root Cause:** In `_ensureTableHeight()` at L1159:
```javascript
if (preserveRowHeight && this.state?.rowHeight && this.state?.height) {
    options.targetRowHeight = this.state.rowHeight;
}
```

When user never manually resizes:
- `state.height` may be empty string (auto-fit doesn't set explicit height)
- Condition `this.state?.height` is falsy for empty string
- Row height not preserved

**Fix:** Check for `state.height !== ''` explicitly, or save auto-fit height to state.

---

## Prioritized Fix List

### High Priority
1. **Bug 4**: Fix `_saveState()` to save position/size even without tabulatorInstance
2. **Bug 2**: Re-highlight row after REBUILD_TABLE based on current input values
3. **Bug 3**: Persist analysis to localStorage for consistent refresh behavior

### Medium Priority
4. **Issue #6 Scenario 3**: Fix row height preservation when no manual resize

### Low Priority
5. **Bug 1**: Remove `componentId` after sorting, before passing to Tabulator
6. **Issue #5**: Investigate duplicate onStateChange (deferred)

---

## Implementation Details

### Architectural Fix: Unified `_finalizeAction()` (Fixes Bug 2, Bug 4)

**Problem:** Current implementation has scattered finalization logic:
- `_finalizeShow()` only called for show() paths
- Event-driven REBUILD_TABLE only gets `_setupInteractions()`, misses highlight
- SHOW_INVALID/SHOW_COMPUTING don't get interactions at all

**Solution:** Rename `_finalizeShow()` to `_finalizeAction()` and route all action paths through it.

**File:** [src/ui/TruthTablePanel.js:1392-1409](src/ui/TruthTablePanel.js#L1392)

**Current `_finalizeShow()`:**
```javascript
_finalizeShow(options = {}) {
    const { skipInteractions = false, skipHighlight = false } = options;

    if (!skipInteractions) {
        this._setupInteractions();
    }

    const state = this._stateMachine.getState();
    if (!skipHighlight && state.lastCycleIndex !== null && this.tabulatorInstance) {
        this._highlightRowByIndex(state.lastCycleIndex);
    }

    this._saveVisibleState();
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
}
```

**New `_finalizeAction()`:**
```javascript
/**
 * Finalize an action with common post-render setup.
 * Called after any action that changes panel content or visibility.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.isShowCall - True for show() calls (saves state, emits event)
 * @param {boolean} options.skipHighlight - Skip row highlighting
 * @private
 */
_finalizeAction(options = {}) {
    const { isShowCall = true, skipHighlight = false } = options;

    // Interactions needed for ALL visible states (including invalid/computing)
    this._setupInteractions();

    // Highlight based on current input values (recalculates, works after structure change)
    if (!skipHighlight && this.tabulatorInstance) {
        this._updateHighlight();
    }

    // State save and event only for show() calls
    if (isShowCall) {
        this._saveVisibleState();
        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
    }
}
```

**Key changes:**
1. Renamed to `_finalizeAction()` - reflects that it handles both show() and event-driven actions
2. Removed `skipInteractions` - ALL visible states get interactions (fixes Bug 4)
3. Changed highlight from `_highlightRowByIndex(lastCycleIndex)` to `_updateHighlight()` - recalculates from current input values (fixes Bug 2)
4. Added `isShowCall` flag - controls show-specific behavior (state save, event emission)

**Usage in `_executeAction()`:**

For event-driven REBUILD_TABLE:
```javascript
case ACTION_TYPES.REBUILD_TABLE:
    this._saveState();
    // ... clears dimensions
    await this._buildTabulator({ isQuickRebuild: false });
    break;
// After switch, in post-action section:
if (this._isTableAction(action) && !isShowCall) {
    this._finalizeAction({ isShowCall: false });
}
```

For show() calls (existing paths updated):
```javascript
if (this._needsFinalization(action, options)) {
    const skipHighlight = !this._isTableAction(action);
    this._finalizeAction({ isShowCall: true, skipHighlight });
}
```

---

### Fix 2: `_saveState()` should work without tabulatorInstance (Bug 4)

**File:** [src/ui/TruthTablePanel.js:1303-1340](src/ui/TruthTablePanel.js#L1303)

**Current code:**
```javascript
_saveState() {
    if (!this.panel || !this.tabulatorInstance) {
        return;  // <-- Exits early, nothing saved
    }
    // ... saves everything
}
```

**Fixed code:**
```javascript
_saveState() {
    if (!this.panel) {
        return;
    }

    // Column order only available when Tabulator exists
    const columns = this.tabulatorInstance
        ? this.tabulatorInstance.getColumns().map(col => col.getField()).filter(f => f)
        : (this.state?.columnOrder || []);

    // Position/size always available from panel
    const x = parseFloat(this.panel.getAttribute('data-x')) || 0;
    const y = parseFloat(this.panel.getAttribute('data-y')) || 0;
    const width = this.panel.style.width || (this.panel.offsetWidth + 'px');
    const height = this.panel.style.height || (this.panel.offsetHeight + 'px');

    // ... rest of state save
}
```

---

### Fix 3: Row height preservation without manual resize (Issue #6)

**File:** [src/ui/TruthTablePanel.js:1159](src/ui/TruthTablePanel.js#L1159)

**Current code:**
```javascript
if (preserveRowHeight && this.state?.rowHeight && this.state?.height) {
    options.targetRowHeight = this.state.rowHeight;
}
```

**Problem:** `this.state?.height` is falsy for empty string `''`

**Fixed code:**
```javascript
if (preserveRowHeight && this.state?.rowHeight != null) {
    options.targetRowHeight = this.state.rowHeight;
}
```

Or ensure auto-fit always saves height to state (in `_applyTableHeight` when `fitPanel` is true).

---

### Fix 4: Persist analysis to localStorage (Bug 3)

**Files:**
- [src/storage/AutoSaveManager.js](src/storage/AutoSaveManager.js) - Save/load analysis with board data
- [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) - Set analysis on load

**Implementation:**

In `AutoSaveManager.saveBoardState()`, add analysis to saved data:
```javascript
const boardData = {
    components: [...],
    connections: [...],
    truthTablePanelState: {...},
    circuitAnalysis: circuitState.getCircuitAnalysis()  // NEW
};
```

In `AutoSaveManager.loadBoardState()`, restore analysis before showing panel:
```javascript
if (boardData.circuitAnalysis) {
    circuitState.setCircuitAnalysis(boardData.circuitAnalysis);
    // Skip recomputeAnalysis() if analysis was restored
}
```

**Optional threshold:** Only cache if `analysis.table.length <= 512` to avoid storage bloat for very large circuits.

---

### Fix 5: Remove componentId before Tabulator (Bug 1)

**File:** [src/utils/truthTableUtils.js](src/utils/truthTableUtils.js) - `buildTruthTableColumns()`

After sorting is complete, strip `componentId` from columns before returning:

```javascript
// After all processing, remove componentId (internal use only, Tabulator warns about it)
const cleanColumns = finalColumns.map(col => {
    const { componentId, ...rest } = col;
    return rest;
});
return cleanColumns;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) | Rename `_finalizeShow()` → `_finalizeAction()`, update all callers, fix `_saveState()` guard, fix row height check |
| [src/utils/truthTableUtils.js](src/utils/truthTableUtils.js) | Strip `componentId` after sorting |
| [src/storage/AutoSaveManager.js](src/storage/AutoSaveManager.js) | Save/load circuitAnalysis with board data |
| [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) | Skip recompute if analysis restored from storage |
| [tests/unit/ui/TruthTablePanel.test.js](tests/unit/ui/TruthTablePanel.test.js) | Add tests for state persistence in invalid state, update tests for renamed function |

---

## Test Scenarios After Fix

1. **Bug 4 verification:** Invalid state → move/resize → refresh → position/size preserved, interactions work
2. **Bug 2 verification:** Add INPUT while table open → row still highlighted (recalculated)
3. **Bug 3 verification:** Hide panel → Refresh page → Open panel → Table appears instantly (no "Computing...")
4. **Issue #6 verification:** Auto-fit → close → rename label → reopen → row height same
5. **Bug 1 verification:** No console warning about componentId
