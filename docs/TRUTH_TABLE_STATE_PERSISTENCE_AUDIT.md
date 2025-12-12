# TruthTablePanel State Persistence Audit

**Date:** 2025-12-11
**Status:** Issues Identified - Ready for Bug Fixing

## Executive Summary

The action path structure (pre-ops, main-ops, post-ops) is correctly implemented per the refactoring plan. However, **state persistence logic has 6 issues** related to timing, lifecycle conflicts, and uninitialized values.

---

## Issues Summary

| Issue | Severity | Root Cause | Fix Complexity |
|-------|----------|------------|----------------|
| #1 Uninitialized `_currentRowHeight` | CRITICAL | Missing init | Low |
| #2 REBUILD_TABLE state timing | HIGH | Save-clear ordering | Medium |
| #3 SYNC saves old structure | LOW (mitigated) | Wasteful save | Low |
| #4 `_saveState()` silent failure | HIGH | No return value | Low |
| #5 Duplicate onStateChange | MEDIUM | Redundant callback | Low |
| #6 Inconsistent row height | MEDIUM | Conditional logic | Medium |

---

## Critical Issue #1: Uninitialized `_currentRowHeight`

**Location:** Constructor, L841, L1327

**Problem:** `_currentRowHeight` is never initialized. First access uses `undefined`:
```javascript
// Line 841 in NONE path tableBuilt callback:
targetRowHeight: savedRowHeight || this._currentRowHeight  // undefined!
```

**Timeline:**
```
Constructor → (no _currentRowHeight init)
First show() NONE path → L841: targetRowHeight = null || undefined
_applyTableHeight() → Math.min(36, undefined) = NaN
```

**Impact:** Row height calculation produces NaN on first show after reload.

**Fix:**
```javascript
constructor(...) {
    // ...existing code...
    this._currentRowHeight = 36;  // Default row height
}
```

---

## Issue #2: REBUILD_TABLE Saves State Before Clearing Dimensions

**Location:** Lines 450-458

**Problem:** `_saveState()` is called, THEN dimensions cleared, but `_saveState()` may early-return:
```javascript
case ACTION_TYPES.REBUILD_TABLE:
    this._saveState();           // L450 - may return early if !tabulatorInstance
    if (this.state) {
        this.state.height = '';  // L452 - only runs if state exists
        this.state.width = '';
        this.state.rowHeight = null;
    }
```

**Timeline:**
```
REBUILD_TABLE triggered
→ _saveState() checks: if (!this.tabulatorInstance) return  // early exit!
→ this.state remains from previous circuit
→ Dimension clearing silently skipped if this.state is null
→ _buildTabulator() runs with stale/null state
```

**Impact:** Position/size lost when structure changes. Column order may be stale.

**Fix:** Either:
1. Check `_saveState()` return value and handle failure, OR
2. Don't rely on `_saveState()` for position preservation - read position directly before clearing

---

## Issue #3: SYNC Path Saves Old Structure Before Rebuild (MITIGATED)

**Location:** Lines 1636-1649

**Problem:** When structure changed while hidden, SYNC saves OLD column order before rebuilding:
```javascript
if (structureChanged) {
    this._saveState();  // L1639 - saves current (OLD) column order!
    if (this.state) {
        this.state.height = '';
        this.state.width = '';
        this.state.rowHeight = null;
    }
    // Column order NOT cleared!
    await this._buildTabulator(...);
```

**Mitigation:** The `mergeColumnOrderByGroup()` function in `columnOrderStrategies.js` handles this gracefully:
- It only preserves columns that still exist in the new structure
- New columns are appended using the configured strategy (CHRONOLOGICAL by default)
- Removed columns are simply ignored

**Remaining concern:** The `_saveState()` call is still wasteful - it saves state that will be immediately invalidated. Position (x, y) preservation is the main value.

---

## Issue #4: `_saveState()` Guard Causes Silent Failures

**Location:** Lines 1303-1307

**Problem:** `_saveState()` returns early without saving if no Tabulator:
```javascript
_saveState() {
    if (!this.panel || !this.tabulatorInstance) {
        return;  // Silent exit - no state saved!
    }
```

This guard is correct for some paths (SHOW_COMPUTING) but incorrect for REBUILD_TABLE which expects state to be saved before destroying Tabulator.

**Impact:** Callers assume state was saved, but it wasn't.

**Fix:**
```javascript
_saveState() {
    if (!this.panel || !this.tabulatorInstance) {
        return false;  // Indicate state was NOT saved
    }
    // ...existing code...
    return true;  // Indicate success
}
```

---

## Issue #5: Duplicate State Save Callbacks on Hide

**Location:** Lines 542-549

**Problem:** `_hidePanel()` triggers `onStateChange` twice:
```javascript
_hidePanel() {
    this._saveState();              // Calls onStateChange inside
    if (this.state) {
        this.state.visible = false;
        if (this.onStateChange) {
            this.onStateChange(this.state);  // Called AGAIN
        }
    }
}
```

**Impact:** Inefficient, potential side effects from double callback.

**Fix:**
```javascript
_hidePanel() {
    // Save state BEFORE modifying visible flag
    this._saveState();
    if (this.state) {
        this.state.visible = false;
    }
    // Single callback at the end
    if (this.state && this.onStateChange) {
        this.onStateChange(this.state);
    }
    // ...hide panel...
}
```

---

## Issue #6: Inconsistent Row Height Preservation in SYNC

**Location:** Lines 1654-1665

**Problem:** Different SYNC sub-paths handle row height differently:

| SYNC Sub-Path | Row Height Handling |
|---------------|---------------------|
| Structure changed | Cleared (L1643) |
| Labels changed | `_ensureTableHeight()` - uses saved if available |
| Data only | `_ensureTableHeight()` - uses saved if available |

But `_ensureTableHeight()` requires BOTH `state?.rowHeight` AND `state?.height`:
```javascript
if (preserveRowHeight && this.state?.rowHeight && this.state?.height) {
    options.targetRowHeight = this.state.rowHeight;
}
```

If user never manually resized (only auto-fit), `state.height` might be empty string.

**Impact:** Row height inconsistently preserved across SYNC sub-paths.

---

## State Persistence Timeline by Action Path

### REBUILD_TABLE (Event-Driven)
```
1. [READ]  _saveState() reads tabulatorInstance.getColumns() - ✓ exists
2. [WRITE] _saveState() writes this.state with columnOrder - ✓ saved
3. [WRITE] Clear this.state.height/width/rowHeight - ✓ cleared
4. [DESTROY] _buildTabulator() destroys old Tabulator
5. [CREATE] New Tabulator created
6. [READ]  _generateColumns() reads this.state.columnOrder - ⚠️ OLD structure (but mitigated by merge logic)
```

### SYNC (Show Call, Structure Changed)
```
1. [READ]  _syncTabulatorWithAnalysis() detects structure change
2. [READ]  _saveState() reads tabulatorInstance.getColumns() - OLD structure
3. [WRITE] _saveState() writes this.state.columnOrder - OLD structure!
4. [WRITE] Clear this.state.height/width/rowHeight
5. [DESTROY] _buildTabulator() destroys old Tabulator
6. [CREATE] New Tabulator created
7. [READ]  _generateColumns() reads this.state.columnOrder - ⚠️ STALE (but mitigated by merge logic)
```

### NONE (Show Call, Quick Rebuild)
```
1. [READ]  this.state.width/height for restore - ✓ OK
2. [READ]  this.state.rowHeight for targetRowHeight - ⚠️ may be null
3. [READ]  this._currentRowHeight as fallback - ⚠️ may be undefined!
4. [DESTROY] Old Tabulator destroyed
5. [CREATE] New Tabulator created
6. [WRITE] _currentRowHeight set in _applyTableHeight() - ✓ finally set
7. [WRITE] _saveState() called in _finalizeShow() - ✓ saved
```

**Issue:** Step 3 uses uninitialized fallback.

---

## Files to Modify

- `src/ui/TruthTablePanel.js` - All fixes
- `tests/unit/ui/TruthTablePanel.test.js` - Add tests for state persistence scenarios

---

## Action Path Structure (Reference)

The action path structure is correctly implemented. This section is for reference.

### show() Calls (isShowCall=true, wasHidden=true)

| Action | Reveal Panel | Restore Position | Restore Dims | Main Operation | Setup Interactions | Save State | Highlight Row | Emit SHOWN |
|--------|-------------|-----------------|--------------|----------------|-------------------|------------|---------------|------------|
| **NONE** | ✓ L385 | ✓ L389 | ✓ L390 | Quick rebuild Tabulator | ✓ via _finalizeShow | ✓ via _finalizeShow | ✓ (if lastCycleIndex) | ✓ |
| **SYNC** | ✓ L491-492 | ✓ L494 | N/A | _syncTabulatorWithAnalysis | ✓ via _finalizeShow | ✓ via _finalizeShow | ✓ (if lastCycleIndex) | ✓ |
| **RENDER_TABLE** | ✓ L405-414 | ✓ L413 | N/A | _buildTabulator | ✓ via _finalizeShow | ✓ via _finalizeShow | ✓ (if lastCycleIndex) | ✓ |
| **SHOW_COMPUTING** | ✓ L405-414 | ✓ L413 | N/A | _renderComputingState | ✗ (skipInteractions) | ✓ via _finalizeShow | ✗ (no table) | ✓ |
| **SHOW_INVALID** | ✓ L405-414 | ✓ L413 | N/A | _renderInvalidState | ✗ (skipInteractions) | ✓ via _finalizeShow | ✗ (no table) | ✓ |

### Event-Driven Calls (isShowCall=false)

| Action | Pre-Ops | Main Operation | Setup Interactions | Save State | Highlight Row | Emit SHOWN |
|--------|---------|----------------|-------------------|------------|---------------|------------|
| **REBUILD_TABLE** | N/A (visible) | _buildTabulator, clear dims | ✓ L518 | ✓ L450 (within action) | ✗ (cycle cleared) | ✗ (already visible) |
| **UPDATE_HEADERS** | N/A | _updateColumnHeaders | ✗ (incremental) | ✗ (incremental) | ✓ _updateHighlight L467 | ✗ |
| **UPDATE_DATA** | N/A | setData | ✗ | ✗ | ✗ | ✗ |
| **SHOW_PROGRESS** | N/A | _showProgress | ✗ | ✗ | ✗ | ✗ |
| **HIGHLIGHT_ROW** | N/A | _highlightRowByIndex | ✗ | ✗ | ✓ (self) | ✗ |
| **HIDE** | N/A | _hidePanel | ✗ | ✓ L542 (within action) | ✗ | ✗ (emits HIDDEN separately) |
