# Truth Table Panel - Development Guidelines

**Purpose:** This document provides guidelines for making changes to TruthTablePanel.js and related code. Following these guidelines prevents regressions.

**History:** These guidelines emerged from analysis of 44 commits where the same bugs were fixed multiple times due to refactoring regressions.

---

## Quick Reference

Before modifying Truth Table code, read:
1. [Action Path Invariants](#action-path-invariants) - What MUST happen in every code path
2. [Common Regression Patterns](#common-regression-patterns) - Bugs that have recurred
3. [Pre-Commit Checklist](#pre-commit-checklist) - Verify before committing

For detailed documentation:
- [Feature Specification](./specs/truth-table-panel-feature-spec.md) - Complete behavior spec
- [Internal Flow](./specs/truth-table-panel-internal-flow.md) - Method call graphs
- [Refactoring Lessons](./specs/truth-table-refactoring-lessons.md) - Historical analysis

---

## Action Path Invariants

TruthTablePanel has multiple action paths. **ALL paths must satisfy these invariants:**

### After ANY show() operation:
| Invariant | Method | Why |
|-----------|--------|-----|
| Panel is draggable/resizable | `_setupInteractions()` | User can reposition panel |
| Panel state is saved | `_saveState()` | Persists visible:true |
| Row is highlighted | `_updateHighlight()` | Shows current simulation row |
| Event is emitted | `emit(TRUTH_TABLE_SHOWN)` | Other components can react |
| Dimensions are restored | `_restoreSavedDimensions()` | User's sizing preserved |
| Position is restored/computed | `_positionPanelIfNeeded()` | Panel appears in right place |

### After ANY hide() operation:
| Invariant | Method | Why |
|-----------|--------|-----|
| State saved BEFORE hiding | `_saveState()` first | offsetWidth=0 after display:none |
| visible:false persisted | via `_saveState()` | Survives page refresh |

### After ANY table rebuild:
| Invariant | Method | Why |
|-----------|--------|-----|
| Row heights are correct | `_reapplyRowHeights()` | Tabulator resets styles |
| Highlight is restored | `_updateHighlight()` | Tabulator clears selection |
| Column order preserved | `_generateColumns()` with saved order | User's arrangement kept |
| Dimensions preserved (or reset) | Check `preserveDimensions` flag | Don't lose user sizing |

---

## Common Regression Patterns

These bugs have been fixed multiple times. **Watch for them:**

### 1. Interactions Bug (Fixed 3 times)
**Symptom:** Panel can't be dragged or resized
**Cause:** `_setupInteractions()` not called in some action path
**Prevention:** Ensure ALL paths through `show()` and `_executeAction()` call `_setupInteractions()`

### 2. Dimensions Bug (Fixed 5 times)
**Symptom:** Panel loses width/height on refresh or reopen
**Cause:**
- Dimensions not restored before rendering
- `_saveState()` called when panel has wrong dimensions (e.g., during computing state)
- Dimensions cleared without `preserveDimensions` flag
**Prevention:**
- Call `_restoreSavedDimensions()` in PRE-ACTION block
- Check for `preserveDimensions` flag before clearing state
- Never save state when showing "Computing..." spinner

### 3. Row Height Bug (Fixed 3 times)
**Symptom:** Rows have wrong height, text not vertically centered
**Cause:** Tabulator's `setColumns()` or `setData()` resets row styles
**Prevention:** Always call `_reapplyRowHeights()` after any Tabulator column/data operation

### 4. Row Highlighting Bug (Fixed 3 times)
**Symptom:** No row highlighted, or wrong row highlighted
**Cause:** `_updateHighlight()` not called after table operations
**Prevention:** Call `_updateHighlight()` after table rebuild, column changes, or data changes

### 5. Column Order Bug (Fixed 2 times)
**Symptom:** Columns revert to default order
**Cause:** `_generateColumns()` not receiving saved `columnOrder`
**Prevention:** Always pass `this.columnOrder` to `_generateColumns()`

---

## Testing Requirements

### Before ANY refactoring of TruthTablePanel:

1. **Write invariant tests FIRST:**
```javascript
describe.each([
    ['show() fast path'],
    ['show() slow path - RENDER_TABLE'],
    ['show() slow path - SHOW_COMPUTING'],
    ['show() slow path - SHOW_INVALID'],
    ['_handleComputed() - structure change'],
    ['_handleComputed() - labels change'],
    ['_handleComputed() - data only'],
])('%s', (actionPath) => {
    it('calls _setupInteractions()');
    it('calls _saveState() or preserves state');
    it('calls _updateHighlight() when table present');
    it('restores dimensions before rendering');
});
```

2. **Test edge case scenarios:**
- Page refresh with large table (computing state → rebuild)
- First open with large board (no cached dimensions)
- Hide during computing, reopen later
- Structure change while panel hidden

### Manual Test Scenarios

| Scenario | Expected |
|----------|----------|
| Open panel, drag to new position, close, reopen | Position preserved |
| Open panel, resize, close, reopen | Dimensions preserved |
| Reorder columns, close, reopen | Column order preserved |
| Open on large board (9+ inputs), wait for computing, close, refresh page | Dimensions preserved |
| Open panel, add new input, panel rebuilds | Position preserved, dimensions auto-fit |

---

## Code Change Guidelines

### When Adding a New Action Path:

1. Add the path to the invariant test matrix
2. Ensure path calls all required methods (see [Action Path Invariants](#action-path-invariants))
3. Document the path in [Internal Flow](./specs/truth-table-panel-internal-flow.md)

### When Modifying Existing Paths:

1. Run invariant tests
2. Don't remove calls to `_setupInteractions()`, `_saveState()`, `_updateHighlight()`
3. If consolidating paths, ensure ALL behaviors from ALL original paths are preserved

### When Refactoring:

1. **Read [Refactoring Lessons](./specs/truth-table-refactoring-lessons.md)** first
2. Create a test file that captures current behavior BEFORE refactoring
3. Make small, incremental changes with tests between each
4. Verify the invariant test matrix passes after EACH change

---

## Pre-Commit Checklist

Before committing changes to TruthTablePanel:

- [ ] All invariant tests pass
- [ ] Manually tested: open → drag → close → reopen (position preserved)
- [ ] Manually tested: open → resize → close → reopen (dimensions preserved)
- [ ] Manually tested: reorder columns → close → reopen (order preserved)
- [ ] If new action path added: documented in internal-flow.md
- [ ] If refactoring: followed incremental approach with tests

---

## File Map

| File | Purpose | When to Modify |
|------|---------|----------------|
| `src/ui/TruthTablePanel.js` | Main panel implementation | Adding features, fixing bugs |
| `src/ui/TruthTablePanelStateMachine.js` | Action dispatch logic | Changing when actions fire |
| `src/utils/truthTableUtils.js` | Pure helper functions | Layout calculations, column building |
| `tests/unit/ui/TruthTablePanel.test.js` | Unit tests | Adding test coverage |
| `docs/specs/truth-table-panel-feature-spec.md` | Behavior specification | When behavior changes |
| `docs/specs/truth-table-panel-internal-flow.md` | Method call graphs | When control flow changes |

---

## Related Documentation

- [Feature Specification](./specs/truth-table-panel-feature-spec.md) - Complete behavior spec
- [Internal Flow](./specs/truth-table-panel-internal-flow.md) - Method call graphs
- [Refactoring Lessons](./specs/truth-table-refactoring-lessons.md) - Historical analysis
- [Architecture Flow Diagram](./specs/architecture-flow-diagram.md) - Event flow
