# Truth Table Panel - Refactoring Lessons Learned

**Purpose:** This document analyzes historical refactoring attempts and their outcomes to prevent future regressions.

**Summary:** Between commits 7afcb8e and 56fa44f (44 commits), the same 5 bug categories were fixed 16 times total due to refactoring regressions.

---

## Historical Analysis

### The Pattern: Fix → Refactor → Regression → Re-fix

```
7afcb8e (start)
    │
    ├─ 62670a7 State Machine Refactoring ──────────────────────┐
    │                                                          │
    │   56a375a Fix progress indicators                        │ 14 bug fixes
    │   234517e Fix hide/show bugs                             │ triggered by
    │   38d2a19 Fix Virtual DOM bug                            │ State Machine
    │   dacd9dc Fix interactions #1                            │ refactoring
    │   2c543d6 Fix dimensions #1                              │
    │   1560da1 Fix interactions #2                            │
    │   93cb50e Fix Virtual DOM bug #2                         │
    │   ec0d3bc Fix persistence issues                         │
    │   ...                                                    │
    │   93acbac Fix row highlighting #1                        │
    │   5af04ce Fix row highlighting #2                        │
    │   c47ed25 Fix column order                               ◄┘
    │
    ├─ b549d68 Helper Extraction Refactoring ──────────────────┐
    │                                                          │
    │   3e6f4d4 Fix dimensions #2 / rowHeight #1               │ 5 bug fixes
    │   9540dd4 Fix rowHeight #2                               │ triggered by
    │   bc3084f Fix rowHeight #3                               │ helper
    │   fde06f9 Fix column order #2                            ◄┘ refactoring
    │
    ├─ 273e36e Unified Dispatcher Refactoring ─────────────────┐
    │                                                          │
    │   f27d049 Fix interactions #3 / highlighting #3          │ 6 bug fixes
    │   3d816a9 Fix dimensions #3                              │ triggered by
    │   e8def52 Fix dimensions #4                              │ unified
    │   09bf036 Fix dimensions #5                              │ dispatcher
    │   40ea1be Fix large table bugs                           │ refactoring
    │   4594634 Fix positioning                                ◄┘
    │
    └─ HEAD (56fa44f)
```

---

## Bug Categories That Recurred

### 1. Interactions (Drag/Resize) - Fixed 3 Times

| Fix # | Commit | What Broke It |
|-------|--------|---------------|
| 1 | dacd9dc | State Machine refactoring removed `_setupInteractions()` from some paths |
| 2 | 1560da1 | Incomplete fix #1, or dimension fix broke another path |
| 3 | f27d049 | Unified dispatcher refactoring consolidated paths incorrectly |

**Root Cause:** Each refactoring changed the code organization, and `_setupInteractions()` wasn't called in all new paths.

### 2. Panel Dimensions - Fixed 5 Times

| Fix # | Commit | What Broke It |
|-------|--------|---------------|
| 1 | 2c543d6 | REBUILD_TABLE path cleared `panel.style.width` |
| 2 | 3e6f4d4 | Helper extraction changed dimension handling |
| 3 | 3d816a9 | Unified dispatcher only restored position, not dimensions |
| 4 | e8def52 | REBUILD_TABLE from computing state cleared dimensions |
| 5 | 09bf036 | No default dimensions for computing state |

**Root Cause:** Multiple places modified dimensions, and refactorings consolidated some but missed others.

### 3. Row Height - Fixed 3 Times

| Fix # | Commit | What Broke It |
|-------|--------|---------------|
| 1 | 3e6f4d4 | Helper extraction |
| 2 | 9540dd4 | Fix #1 incomplete |
| 3 | bc3084f | Fix #2 incomplete for some action paths |

**Root Cause:** Tabulator's `setColumns()` and `setData()` reset row styles. `_reapplyRowHeights()` needed to be called after these operations, but some paths missed it.

### 4. Row Highlighting - Fixed 3 Times

| Fix # | Commit | What Broke It |
|-------|--------|---------------|
| 1 | 93acbac | State Machine refactoring |
| 2 | 5af04ce | Fix #1 missed NONE action path |
| 3 | f27d049 | Unified dispatcher refactoring |

**Root Cause:** `_updateHighlight()` calls were scattered across paths. Refactorings moved code but didn't ensure all paths called it.

### 5. Column Order - Fixed 2 Times

| Fix # | Commit | What Broke It |
|-------|--------|---------------|
| 1 | c47ed25 | State Machine refactoring |
| 2 | fde06f9 | Fix #1 missed NONE action path |

**Root Cause:** `columnOrder` not passed to `_generateColumns()` in all paths.

---

## What Went Wrong in Each Refactoring

### State Machine Refactoring (62670a7)

**Goal:** Separate decision logic (what action to take) from execution logic (how to do it).

**What broke:**
- The original inline code had subtle per-path behaviors
- The new state machine returned action types, but the action handlers didn't implement all behaviors
- No tests verified invariants across all paths

**Lesson:** When extracting logic into a state machine, document every side effect of every path first.

### Helper Extraction Refactoring (b549d68)

**Goal:** Extract common code into helper methods to reduce duplication.

**What broke:**
- The "common" code had subtle differences per call site
- Extracting it unified the behavior, breaking some paths
- No tests verified the helper worked correctly in all contexts

**Lesson:** Before extracting a helper, verify ALL call sites have identical requirements.

### Unified Dispatcher Refactoring (273e36e)

**Goal:** Merge `show()`'s inline handling with `_executeAction()` to have single dispatch point.

**What broke:**
- The two paths had different dimension handling, positioning timing, opacity handling
- Unification required flags (`isShowCall`, `wasHidden`, `preserveDimensions`) that increased complexity
- The "page refresh with large table" edge case wasn't tested

**Lesson:** Unifying code paths only reduces complexity if the paths are truly identical. Otherwise, it just moves complexity into conditional flags.

---

## Successful Patterns

Some changes didn't cause regressions:

### Pattern 1: Single-Location Changes
Changes that modified ONE method without reorganizing code rarely caused regressions.

### Pattern 2: Additive Changes
Adding new functionality (like progress bars) without restructuring existing code was safe.

### Pattern 3: Test-First Refactoring
When tests were written BEFORE refactoring (rare), regressions were caught immediately.

---

## Guidelines for Future Refactoring

### DO:

1. **Write invariant tests BEFORE refactoring:**
```javascript
describe.each([
    ['NONE'], ['SYNC'], ['RENDER_TABLE'], ['SHOW_COMPUTING']
])('%s action path', (action) => {
    it('calls _setupInteractions()');
    it('preserves dimensions');
    it('calls _updateHighlight() when table present');
});
```

2. **Document all behaviors before changing:**
Create a matrix of [action path] × [required behavior] before refactoring.

3. **Make incremental changes:**
One small change → run tests → commit. Not: big refactor → fix bugs → commit.

4. **Test edge cases explicitly:**
- Page refresh scenarios
- Large table (computing state) scenarios
- Structure change while hidden scenarios

### DON'T:

1. **Don't assume "common" code is identical across call sites.**
Check each call site for subtle differences.

2. **Don't add flags to "unify" different paths.**
Flags like `isShowCall`, `wasHidden`, `preserveDimensions` indicate the paths aren't truly identical.

3. **Don't refactor without a comprehensive test matrix.**
The bugs recurred because tests didn't cover all action paths.

4. **Don't refactor multiple things at once.**
Each of the major refactorings changed too many things, making it hard to identify what broke.

---

## The Ideal Refactoring Process

1. **Identify what you want to change**
   - Is it truly duplicated code?
   - Are all instances identical?

2. **Write tests for current behavior**
   - Cover ALL action paths
   - Include edge cases

3. **Document the current state**
   - What methods are called in each path?
   - What side effects does each path have?

4. **Make ONE small change**
   - Run tests
   - Manually verify key scenarios
   - Commit

5. **Repeat step 4 until done**

6. **Update documentation**
   - Internal flow diagrams
   - Feature spec if behavior changed

---

## Summary Table

| Bug Category | Times Fixed | Root Cause |
|--------------|-------------|------------|
| Interactions | 3 | `_setupInteractions()` missing from paths |
| Dimensions | 5 | Dimension save/restore logic scattered and inconsistent |
| Row Height | 3 | `_reapplyRowHeights()` missing after table operations |
| Highlighting | 3 | `_updateHighlight()` missing from paths |
| Column Order | 2 | `columnOrder` not passed to `_generateColumns()` |
| **Total** | **16** | **Refactorings didn't preserve all behaviors** |
