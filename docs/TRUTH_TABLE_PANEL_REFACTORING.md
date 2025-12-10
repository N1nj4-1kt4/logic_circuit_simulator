# TruthTablePanel Action Path Audit & Refactoring Plan

**Created:** 2024-12-10
**Status:** Phase 2 Complete (Refactoring Implemented)

## Executive Summary

The TruthTablePanel has accumulated bugs over 14+ commits due to **action path fragmentation**. Each action path (SYNC, NONE, RENDER_TABLE, etc.) manually handles common operations, making it easy to miss operations in one path.

This document captures the investigation findings, identified gaps, and recommended refactoring approach.

---

## Problem Statement

### Symptoms
Over 14 recent commits were bug fixes for "misses" in action paths:
- State persistence issues (visibility, styles, positioning)
- Row highlighting getting lost
- Interaction setup (drag/resize) not being restored
- Virtual DOM height configuration issues

### Root Cause: Action Path Fragmentation

1. **`show()` has 4+ distinct code paths** that duplicate common post-render operations:
   - SYNC path (lines 1455-1484)
   - NONE fast path with Tabulator rebuild (lines 1487-1561)
   - NONE fallback path (lines 1564-1577)
   - Slow path for SHOW_COMPUTING/SHOW_INVALID/RENDER_TABLE (lines 1579-1643)

2. **DUPLICATE action handling exists in TWO places:**
   - `_executeAction()` (lines 362-419) - handles actions from event handlers
   - `show()` (lines 1601-1622) - has a SEPARATE switch for SHOW_COMPUTING, SHOW_INVALID, RENDER_TABLE

3. **Current call counts showing duplication:**
   - `_setupInteractions()` called 5 times (lines 374, 386, 1475, 1546, 1627)
   - `_saveVisibleState()` called 4 times (lines 765, 1481, 1554, 1574)
   - `_highlightRowByIndex()` called 5 times (lines 406, 1479, 1551, 1570, 1637)
   - `TRUTH_TABLE_SHOWN` emitted 4 times (lines 1482, 1559, 1575, 1642)

---

## Phase 1 Results: Audit Test Matrix

### Test Location
`tests/unit/ui/TruthTablePanel.test.js` - Section "Action Path Invariants (Comprehensive Test Matrix)"

### Gaps Identified by Tests

| Action Path | Gap Found | Test Status |
|-------------|-----------|-------------|
| SYNC | None | PASS |
| NONE (fallback) | None | PASS |
| RENDER_TABLE (slow path) | Missing `_saveVisibleState()` | FAIL |
| SHOW_COMPUTING | Missing `_saveVisibleState()` | FAIL |
| SHOW_INVALID | Missing `_saveVisibleState()` | FAIL |
| REBUILD_TABLE | None (correctly skips visible state) | PASS |
| UPDATE_HEADERS | None | PASS |
| HIGHLIGHT_ROW | None | PASS |
| HIDE | None | PASS |

### Required Post-Operations Matrix

| Action | `_setupInteractions` | `_saveVisibleState` | `_highlightRow` | `SHOWN` event |
|--------|---------------------|---------------------|-----------------|---------------|
| SYNC | ✓ | ✓ | ✓ (if lastCycleIndex) | ✓ |
| NONE | ✓ | ✓ | ✓ (if lastCycleIndex) | ✓ |
| RENDER_TABLE | ✓ | ✓ | ✓ (if lastCycleIndex) | ✓ |
| REBUILD_TABLE | ✓ | N/A (already visible) | N/A (cycle cleared) | N/A |
| SHOW_COMPUTING | N/A | ✓ | N/A | ✓ |
| SHOW_INVALID | N/A | ✓ | N/A | ✓ |
| UPDATE_HEADERS | N/A | N/A | ✓ | N/A |
| HIGHLIGHT_ROW | N/A | N/A | ✓ | N/A |
| HIDE | N/A | N/A (visible:false) | N/A | N/A |

---

## Phase 2: Recommended Refactoring

### Option A: Add `_finalizeShow()` Helper (Conservative)

**What changes:**
```javascript
// New helper method
_finalizeShow(options = {}) {
    const { skipInteractions = false, skipHighlight = false } = options;

    if (!skipInteractions) this._setupInteractions();

    const state = this._stateMachine.getState();
    if (!skipHighlight && state.lastCycleIndex !== null && this.tabulatorInstance) {
        this._highlightRowByIndex(state.lastCycleIndex);
    }

    this._saveVisibleState();
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
}
```

**Pros:**
- Lower risk - only adds a helper, doesn't restructure control flow
- ~50 lines of code change

**Cons:**
- Still requires discipline to call `_finalizeShow()` in new paths
- Doesn't eliminate duplicate action handling in `show()` vs `_executeAction()`

**Risk Level:** Low

### Option B: Route ALL Actions Through `_executeAction()` (Structural)

**What changes:**
1. Add SYNC and NONE to `_executeAction()`'s switch statement
2. Simplify `show()` to single dispatch + finalization pattern
3. Eliminate duplicate switch statements

**Pros:**
- Single dispatch point for all actions
- Prevents future misses - new actions only added to `_executeAction()`
- Cleaner architecture matching state machine design

**Cons:**
- Higher risk - restructures control flow
- ~150-200 lines of code change

**Risk Level:** Medium

### Recommendation

**Implement Option B (Structural Refactoring).**

Rationale:
1. **Layered architecture preserves action path value** - Each action does ONE specific thing in `_executeAction()`, while common finalization is handled once in `show()`
2. **Prevents future misses structurally** - New actions only need to be added to `_executeAction()` switch; finalization happens automatically
3. **Eliminates root cause** - The duplicate dispatch points (`show()` switch + `_executeAction()` switch) are the source of the bugs
4. **Test matrix validates the refactoring** - The audit tests will catch any regressions

The pattern is clear:
```
show() {
    1. Pre-action:  _revealPanel(), restore position
    2. Dispatch:    _executeAction(action)  ← ACTION-SPECIFIC
    3. Finalize:    _finalizeShow()         ← COMMON CLEANUP
}
```

---

## Immediate Fixes Needed

The following paths need `_saveVisibleState()` added:

### 1. SHOW_COMPUTING path (line ~1603)
```javascript
case ACTION_TYPES.SHOW_COMPUTING:
    this._renderComputingState();
    this._saveVisibleState();  // ADD THIS
    break;
```

### 2. SHOW_INVALID path (line ~1607)
```javascript
case ACTION_TYPES.SHOW_INVALID:
    this._renderInvalidState(action.reason);
    this._saveVisibleState();  // ADD THIS
    break;
```

### 3. RENDER_TABLE slow path (around line 1621)
After the RENDER_TABLE case completes, ensure `_saveVisibleState()` is called.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/ui/TruthTablePanel.js` | Main refactoring target |
| `src/ui/TruthTablePanelStateMachine.js` | State machine (well-designed, no changes needed) |
| `tests/unit/ui/TruthTablePanel.test.js` | Contains audit test matrix |

---

## Historical Context

### Recent Bug Fix Commits (Last 14)

| Commit | Issue Fixed |
|--------|-------------|
| c47ed25 | More persistence misses in action paths |
| 5af04ce | Table state persistence for row highlighting in NONE path |
| 93acbac | Row highlighting lost when hidden during simulation events |
| f1165cd | Simulation stopping persistence |
| 16f5029 | Simulation stopping on page refresh |
| b2a6e95 | Circuit reset between page refreshes |
| ec0d3bc | Truth Table persistence between page refreshes |
| 93cb50e | Virtual DOM bug on 6→7 input transition |
| 1560da1 | Interactions lost in some paths |
| 2c543d6 | REBUILD_TABLE clearing panel width |
| dacd9dc | Panel losing drag/resize ability |
| 38d2a19 | Virtual DOM not re-enabled in all paths |
| 234517e | Multiple bugs after hide/show with circuit changes |
| 56a375a | Progress indicator handling for many inputs |

---

## Phase 2 Implementation Summary (Completed 2024-12-10)

### Changes Made

1. **Added `_finalizeShow()` helper method** - Centralizes all post-render operations:
   - Setup drag/resize interactions (for table paths only)
   - Highlight current simulation row (if tracking)
   - Persist visible state
   - Emit `TRUTH_TABLE_SHOWN` event

2. **Added `_restoreSavedPosition()` helper method** - Reduces duplication in show() paths

3. **Refactored `show()` method** to use unified pattern:
   ```
   show() {
       1. Pre-action:  _revealPanel(), restore position
       2. Dispatch:    Execute action-specific rendering
       3. Finalize:    _finalizeShow()  ← COMMON CLEANUP
   }
   ```

4. **Fixed `_saveVisibleState()`** to work without Tabulator (for SHOW_COMPUTING, SHOW_INVALID paths)

5. **Added 35+ new TDD tests** in "Phase 2 Refactoring: Unified Action Dispatch Architecture" section

### Architecture After Refactoring

All show() paths now follow this pattern:
- **SYNC path**: Reveal panel → sync tabulator → `_finalizeShow()`
- **NONE path**: Reveal panel → rebuild tabulator → `_finalizeShow()`
- **SHOW_COMPUTING path**: Reveal panel → render computing state → `_finalizeShow({ skipInteractions: true })`
- **SHOW_INVALID path**: Reveal panel → render invalid state → `_finalizeShow({ skipInteractions: true })`
- **RENDER_TABLE path**: Reveal panel → render tabulator → `_finalizeShow()`

### Gap Fixes Applied

| Action Path | Gap Fixed |
|-------------|-----------|
| SHOW_COMPUTING | Now calls `_saveVisibleState()` via `_finalizeShow()` |
| SHOW_INVALID | Now calls `_saveVisibleState()` via `_finalizeShow()` |
| RENDER_TABLE | Now calls `_saveVisibleState()` via `_finalizeShow()` |
| NONE | Now attaches `columnMoved` listener for column order persistence |

### Column Order Persistence Gap (Fixed 2024-12-10)

**Problem:** The NONE action path creates a new Tabulator instance with `movableColumns: true`, but did NOT attach a `columnMoved` event listener. This caused column order to be lost when:
1. User opens panel → NONE path fires → table rebuilt
2. User reorders columns by dragging
3. User closes panel
4. `columnMoved` event was never listened for → `_saveState()` never called
5. Column order is LOST

**Analysis:**
| Location | Path | Had `columnMoved` listener? |
|----------|------|----------------------------|
| `_renderTabulator()` | RENDER_TABLE | ✅ Yes |
| Inline in `show()` | NONE | ❌ **NO - GAP** |

**Why not in `_finalizeShow()`?**
- `columnMoved` must be attached inside `tableBuilt` callback (not after finalization)
- Would create duplicate listeners for RENDER_TABLE path
- Non-table paths would error

**Fix:** Added `columnMoved` listener directly in NONE path's `tableBuilt` callback (lines 1590-1594):
```javascript
this.tabulatorInstance.on('columnMoved', () => {
    this._saveState();
});
```

### Test Results

- All 1389 tests pass
- 178 TruthTablePanel tests pass
- 37+ new tests specifically for the refactoring

---

## Next Steps (If Needed)

1. ~~**Fix immediate gaps** (SHOW_COMPUTING, SHOW_INVALID, RENDER_TABLE paths)~~ ✅ Done
2. ~~**Run test suite** to verify fixes~~ ✅ Done (1387 tests pass)
3. ~~**Consider Option A refactoring** to add `_finalizeShow()` helper~~ ✅ Implemented
4. **Optional: Further consolidation** - Route ALL actions through `_executeAction()` (Option B full implementation)
