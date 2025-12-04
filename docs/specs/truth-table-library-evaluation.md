# Truth Table Library Evaluation: Research Findings

**Date:** December 2024
**Status:** Research complete - Retaining Tabulator for now
**Decision:** Keep current Tabulator implementation; revisit if resize issues become critical

---

## Context

The Truth Table panel uses Tabulator.js for rendering. We evaluated whether to replace it due to custom resize handling complexity (~350 lines of workarounds).

### Current Implementation Issues
- Tabulator doesn't handle dynamic parent container resizing well
- Required workarounds: RAF-debounced resize, manual DOM height distribution, opacity reveal pattern
- See [TruthTablePanel.js](../../src/ui/TruthTablePanel.js) lines 447-513, 574-622

---

## Requirements

| Feature | Priority | Notes |
|---------|----------|-------|
| Column reordering (drag) | Essential | Users reorder input/output columns |
| Row selection highlighting | Essential | Shows current circuit state in table |
| Dynamic resize with panel | Secondary | Panel is resizable via Interact.js |
| Future: Constrained inputs | Planned | Filter rows by fixing certain inputs |

---

## Libraries Evaluated

### 1. Tabulator (Current) - Keeping
- **Bundle:** ~150KB
- **Column reorder:** Built-in `movableColumns: true`
- **Row selection:** Built-in `selectable: 1`
- **Resize behavior:** Poor - requires manual workarounds
- **Verdict:** Works, known issues, keeping for now

### 2. Grid.js - Not viable
- **Bundle:** ~40KB
- **Column reorder:** Not supported ([Stack Overflow](https://stackoverflow.com/questions/73474534/show-hide-column-and-reorder-gridjs))
- **Row selection:** Plugin-based
- **Verdict:** Missing essential column reorder feature

### 3. AG Grid Community - Alternative option
- **Bundle:** ~300KB+ (modular)
- **Column reorder:** Built-in
- **Row selection:** Built-in
- **License:** MIT (Community version)
- **Docs:** [ag-grid.com](https://www.ag-grid.com/javascript-data-grid/grid-size/)

#### AG Grid Resize Behavior Research

**Automatic resize detection:**
> "If the width and/or height change after the grid is initialised, the grid will automatically resize to fill the new area."

**Flexbox issues exist:**
- [GitHub #628](https://github.com/ag-grid/ag-grid/issues/628): "Get grid to work with flexbox"
- [GitHub #1011](https://github.com/ag-grid/ag-grid/issues/1011): "Flex resize smaller" - grid resizes bigger fine, but shrinking has issues

**Workaround for flex containers:**
> "By default, the grid runs a timer that watches its container size and resizes the UI accordingly. This might interfere with the default behavior of elements with `display: flex` set. The simple workaround is to add `overflow: hidden` to the grid element parent."

**DOM Layout modes:**
- `normal` (default): Fixed height, scrolls internally
- `autoHeight`: Fits row count, no vertical scroll (not recommended for >1000 rows)
- Cannot set max-height with autoHeight

**Verdict:** AG Grid has similar flexbox resize issues. May be slightly better with the timer-based resize detection, but not a clear win over Tabulator.

### 4. Vanilla HTML Table - Considered
- **Bundle:** 0KB
- **Column reorder:** Must implement (~100 lines + edge cases)
- **Row selection:** Must implement (~30 lines)
- **Resize behavior:** Full control, no library quirks

**Code estimate:**
- Remove: ~330 lines Tabulator-specific
- Add: ~350 lines vanilla implementation
- Net: Roughly equivalent complexity

**Verdict:** No significant code savings. Trades library quirks for custom implementation maintenance.

---

## Conclusion

**Recommendation: Keep Tabulator**

1. No alternative library clearly solves the resize issues
2. AG Grid has similar flexbox problems
3. Vanilla implementation doesn't reduce code complexity
4. Tabulator works - the workarounds are isolated and documented

**When to revisit:**
- If resize bugs become blocking/critical
- If bundle size becomes a constraint
- If AG Grid releases better flex container support
- If building a major truth table redesign (e.g., constrained inputs feature)

---

## Future Feature: Constrained Inputs

When implementing "fix certain inputs and show partial truth table":

1. **Implementation approach:** Modify data generation, not table filtering
2. **Changes needed:**
   - Add `isFixed` and `fixedValue` properties to INPUT components
   - Modify `TruthTablePanel.generate()` to iterate only free inputs
   - Update auto-cycle logic in `CircuitOperations.js`
   - Add UI for toggling input constraints (lock icons in column headers)

3. **Table library impact:** Minimal - all approaches receive pre-filtered data

---

## References

- [Tabulator docs](https://tabulator.info/)
- [AG Grid Layout docs](https://www.ag-grid.com/javascript-data-grid/grid-size/)
- [AG Grid flexbox issue #628](https://github.com/ag-grid/ag-grid/issues/628)
- [Grid.js column reorder limitation](https://stackoverflow.com/questions/73474534/show-hide-column-and-reorder-gridjs)
