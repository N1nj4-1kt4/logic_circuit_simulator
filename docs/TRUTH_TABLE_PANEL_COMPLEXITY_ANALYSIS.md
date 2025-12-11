# Complexity Analysis: TruthTablePanel.js

This document analyzes the complexity in `src/ui/TruthTablePanel.js` (1850 lines) across two dimensions: **Tabulator library limitations** and **behavior goal requirements**.

## Summary

| Dimension | Lines of Code | % of File | Root Cause |
|-----------|---------------|-----------|------------|
| Tabulator-specific workarounds | ~450+ lines | ~25% | Library limitations/quirks |
| Behavior goals implementation | ~800+ lines | ~45% | Feature requirements |
| Shared/infrastructure | ~600 lines | ~30% | Normal code |

---

## Dimension 1: Tabulator Library Complexity (~450 lines)

### Critical Tabulator Limitations Requiring Workarounds

| Issue | Impact | Lines |
|-------|--------|-------|
| **Virtual DOM doesn't re-render after `display:none`** | Entire `isQuickRebuild` pattern; NONE action path forces table rebuild (~50ms) when panel shown | 369-389, 681, 827-832 |
| **Async initialization without Promise** | Must wrap `tableBuilt` event in Promise; all dimension logic stuck inside callback | 789-856 (60+ lines) |
| **Clears content element on init** | Progress/spinner UI must be appended to parent panel, not natural DOM location | 262, 304, 890, 906 |
| **Can't update structure after creation** | Must destroy and recreate for column changes; two-level lifecycle architecture | 754-767, 1817-1848 |
| **Destroying shrinks panel** | Must preserve dimensions before destroy, apply after | 737-752, 847-852 |
| **Virtual DOM doesn't recalculate on resize** | Must call `setHeight()` explicitly after dimension changes | 1082-1085 |
| **No row height API** | Manual CSS application to all rows/cells | 977-995, 1025-1045 |
| **`updateDefinition()` broken for grouped columns** | Must use `setColumns()` to update headers | 1571-1584 |
| **Holds reference to data array** | Must deep copy analysis data every time | 605-619 |
| **Concurrent builds cause errors** | Added 70-line RenderQueue class | State machine lines 71-141 |

### Code Patterns Forced by Tabulator

1. **Three-phase rebuild**: preserve dims → destroy → build → release dims
2. **Structure change detection**: Compare column counts before deciding rebuild vs update
3. **Sync complexity**: Must detect change type (structure/labels/data) before syncing
4. **Interact.js coupling**: Must destroy/setup interactions in sync with Tabulator lifecycle

### The `isQuickRebuild` Pattern Explained

When the panel is hidden (`display:none`) and then shown again, Tabulator's virtual DOM doesn't properly re-render. The workaround:

```javascript
// Lines 369-389: NONE action special handling
// Tabulator's virtual DOM doesn't properly re-render after display:none,
// so we rebuild it. A full rebuild (~50ms) is faster than async row rendering (~1400ms).
if (action?.action === ACTION_TYPES.NONE && isShowCall && this.tabulatorInstance) {
    await this._buildTabulator({ isQuickRebuild: true, clearDimensionsOnStructureChange: false });
}
```

This pattern propagates throughout the codebase:
- `_buildTabulator()` accepts `isQuickRebuild` parameter
- Row height logic branches on `isQuickRebuild` (lines 827-832)
- Spinner display is skipped for quick rebuilds (line 749)

---

## Dimension 2: Behavior Goals Complexity (~800 lines)

### The 9 Behavior Goals Driving Complexity

| Behavior Goal | Complexity | Key Code |
|---------------|------------|----------|
| **1. State persistence** (position, size, columns, rowHeight, highlight) | 5 properties across 3 layers (DOM, state object, localStorage) | `_saveState()`, `_restoreState()` |
| **2. Column reordering within groups** | Dual-level merge (group + strategy); legacy format migration | `mergeColumnOrderByGroup()`, `createFieldName()` |
| **3. Row highlighting during simulation** | Cycle index tracking; highlight survival across rebuilds | `_highlightRowByIndex()`, `inputValuesToIndex()` |
| **4. Smart positioning** | 8-10 position candidates scored by component overlap | `positionPanelSmartly()` (250 lines in positioning.js) |
| **5. Show/hide lifecycle** | 7 panel states × 3 data states = 21+ scenarios; 11 action types | State machine + `_executeAction()` |
| **6. Progress indicators** | Dual-layer UI (progress bar + spinner); careful timing | `_showProgress()`, `_showRenderingSpinner()` |
| **7. Invalid state handling** | Persistent error message; state transitions | `_renderInvalidState()`, `handleValidityChanged()` |
| **8. State machine pattern** | Action-driven dispatch; render serialization | 467-line state machine file |
| **9. Dimension preservation** | Conditional save/restore; structure change detection | Lines 696-735, 816-852 |

### Why Behavior Goals Create Multiplicative Complexity

- **State combinations**: 7 visibility states × 3 data states × 2 progress states = many scenarios
- **Event sources**: 4 event types (step completed, validity changed, computing, computed) each require different handling
- **Persistence timing**: Must save before hide, restore before render, preserve during rebuild

### State Machine Architecture

The state machine (`TruthTablePanelStateMachine.js`) separates decision logic from execution:

```
StateMachine          Panel
    │                   │
    │ handleShow()      │
    │ ──────────────►   │
    │                   │
    │ { action: SYNC }  │
    │ ◄──────────────   │
    │                   │
    │                   │ _executeAction(action)
    │                   │ ──────────────────────►
```

**11 Action Types**:
- `NONE` - Quick rebuild for virtual DOM fix
- `SHOW_COMPUTING` - Display progress indicator
- `SHOW_INVALID` - Display error message
- `RENDER_TABLE` - Full table render
- `REBUILD_TABLE` - Structure changed, rebuild needed
- `UPDATE_HEADERS` - Labels changed only
- `UPDATE_DATA` - Data changed only
- `SHOW_PROGRESS` - Update progress bar
- `HIGHLIGHT_ROW` - Highlight simulation row
- `HIDE` - Hide panel
- `SYNC` - Synchronize stale data

---

## Interaction Between Dimensions

Some complexity exists because **Tabulator limitations amplify behavior goal requirements**:

| Behavior Goal | How Tabulator Makes It Harder |
|---------------|-------------------------------|
| Dimension preservation | Tabulator shrinks panel on destroy; must preserve/restore manually |
| Column order persistence | Can't update structure; must rebuild and re-apply order |
| Row highlighting | Highlight doesn't survive rebuild; must re-apply after tableBuilt |
| Show/hide lifecycle | Virtual DOM issue requires quick rebuild path (NONE action) |
| Progress indicators | Tabulator clears content element; must append to parent |

---

## Complexity Breakdown by Code Section

| Section | Lines | Primary Complexity Source |
|---------|-------|---------------------------|
| Constructor & init | 63-147 | Normal setup |
| Event handlers | 170-253 | Behavior: state machine dispatch |
| Progress UI | 265-340 | Tabulator: content clearing workaround |
| Action dispatcher | 365-510 | Behavior: 11 action types |
| Visibility helpers | 517-574 | Mixed |
| Data management | 602-653 | Tabulator: deep copy requirement |
| `_buildTabulator()` | 686-857 | **Both**: Most complex method |
| Invalid/computing render | 865-908 | Behavior: multi-state UI |
| Row highlighting | 929-965 | Behavior: simulation tracking |
| Height/width management | 977-1183 | Tabulator: no height API |
| Drag/resize | 1194-1283 | Tabulator: Interact.js coupling |
| State persistence | 1293-1398 | Behavior: 5-property sync |
| Action helpers | 1405-1486 | Behavior: dispatch logic |
| Restore helpers | 1492-1568 | Behavior: position/dimension restore |
| Column headers | 1575-1685 | Tabulator: setColumns workaround |
| show/hide/destroy | 1691-1848 | Mixed |

---

## Conclusion

**Tabulator choice adds ~450 lines of workaround code** (25% of file), primarily due to:
- Virtual DOM issues with visibility changes
- Async initialization pattern
- Inability to update structure in place
- Dimension management quirks

**Behavior goals add ~800 lines** (45% of file), primarily due to:
- Rich state persistence requirements
- State machine for handling 21+ scenarios
- Smart positioning algorithm
- Multiple UI states (table, invalid, computing)

**Neither dimension alone explains the file's complexity**. A simpler table library might save ~450 lines but the behavior goals would still require ~800 lines. Simpler behavior goals (no persistence, no smart positioning, no grouped columns) might save ~400 lines but Tabulator workarounds would still exist.

The complexity is largely **justified by the UX requirements**, though the Tabulator workarounds represent unavoidable library tax.

---

## Potential Simplifications

### If Changing Library
A simpler table library (or custom implementation) could eliminate:
- `isQuickRebuild` pattern (~50 lines)
- `tableBuilt` Promise wrapping (~70 lines)
- Content clearing workarounds (~40 lines)
- Destroy/recreate lifecycle (~60 lines)
- Dimension preservation dance (~50 lines)
- Deep copy requirements (~30 lines)
- RenderQueue (~70 lines)

**Estimated savings: ~370 lines**

### If Simplifying Behavior Goals
Removing features could eliminate:
- Smart positioning: ~50 lines (+ 250 in positioning.js)
- Column reorder persistence: ~100 lines
- Row height persistence: ~80 lines
- State machine: ~200 lines (simpler imperative code)

**Estimated savings: ~430 lines** (but significant UX regression)

---

## Related Documentation

- [TRUTH_TABLE_PANEL_REFACTORING.md](./TRUTH_TABLE_PANEL_REFACTORING.md) - Action path pattern analysis
- [TruthTablePanelStateMachine.js](../src/ui/TruthTablePanelStateMachine.js) - State machine implementation
