# Truth Table Panel - Product Requirements Document

**Version**: 1.0
**Date**: 2025-12-08
**Status**: Implemented
**Owner**: Product

---

## 1. Overview

### 1.1 Purpose

The Truth Table Panel allows users to visualize the complete logical behavior of their circuit by displaying all possible input combinations and their corresponding outputs in a tabular format.

### 1.2 Problem Statement

When building digital logic circuits, users need to:
- Verify their circuit produces correct outputs for all input combinations
- Understand the logical relationship between inputs and outputs
- Debug unexpected behavior by comparing expected vs actual outputs
- Document circuit behavior for reference

Without a truth table, users must manually toggle each input combination and observe outputs one at a time—tedious and error-prone for circuits with multiple inputs.

### 1.3 Success Metrics

| Metric | Target |
|--------|--------|
| Time to verify circuit correctness | < 5 seconds (vs minutes manually) |
| User can identify incorrect output | Within 2 seconds of viewing table |
| Panel usability | No training required |

---

## 2. User Stories

### 2.1 Primary User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | Circuit designer | See all input/output combinations at once | I can verify my circuit is correct |
| US-2 | Student | See which row corresponds to current inputs | I can understand how inputs map to outputs |
| US-3 | User | Reorder columns | I can arrange inputs/outputs in my preferred order |
| US-4 | User | Resize and reposition the panel | It doesn't block my circuit view |
| US-5 | User | Have the panel remember its position | I don't have to reposition it every time |

### 2.2 Secondary User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-6 | User | See the table update when I modify my circuit | I get immediate feedback on changes |
| US-7 | User | See progress for large circuits | I know the system is working, not frozen |
| US-8 | User | See a helpful message for incomplete circuits | I understand what's missing |

---

## 3. Functional Requirements

### 3.1 Display Requirements

#### FR-1: Truth Table Content
- **FR-1.1**: Display one row for each possible input combination (2^n rows for n inputs)
- **FR-1.2**: Display columns for each input, labeled with component label (e.g., "A", "B")
- **FR-1.3**: Display columns for each output, labeled with component label (e.g., "Y", "Z")
- **FR-1.4**: Group columns into "Inputs" and "Outputs" sections with headers
- **FR-1.5**: Show binary values (0 or 1) in each cell

#### FR-2: Row Highlighting
- **FR-2.1**: Highlight the row that matches the current input state on the canvas
- **FR-2.2**: Update highlighting immediately when user toggles an input
- **FR-2.3**: During simulation auto-cycle, highlight the row being simulated
- **FR-2.4**: Scroll highlighted row into view if not visible

#### FR-3: Invalid Circuit Handling
- **FR-3.1**: Display informative message when circuit cannot produce a truth table
- **FR-3.2**: Message should indicate what's missing (e.g., "Add inputs and outputs")
- **FR-3.3**: Panel remains interactive (draggable/closeable) even when showing error

### 3.2 Interaction Requirements

#### FR-4: Panel Controls
- **FR-4.1**: Open panel via toolbar button ("Truth Table")
- **FR-4.2**: Close panel via X button in panel header
- **FR-4.3**: Re-opening panel should be instant (no rebuild delay)

#### FR-5: Drag & Resize
- **FR-5.1**: Drag panel by clicking and dragging the header
- **FR-5.2**: Resize panel from any edge or corner
- **FR-5.3**: Enforce minimum size to keep panel usable (approximately 200×150 pixels)
- **FR-5.4**: Keep panel within viewport bounds

#### FR-6: Column Reordering
- **FR-6.1**: Allow reordering columns by dragging column headers
- **FR-6.2**: Inputs can only be reordered within the Inputs group
- **FR-6.3**: Outputs can only be reordered within the Outputs group
- **FR-6.4**: Preserve column order across panel close/open

### 3.3 Persistence Requirements

#### FR-7: State Persistence
- **FR-7.1**: Remember panel position across close/open within session
- **FR-7.2**: Remember panel size across close/open within session
- **FR-7.3**: Remember column order across close/open within session
- **FR-7.4**: Save panel state (position, size, column order, visibility) with board
- **FR-7.5**: Restore panel state when board is loaded
- **FR-7.6**: If panel was open when board was saved, auto-open on load

### 3.4 Update Requirements

#### FR-8: Live Updates
- **FR-8.1**: Update table data when circuit connections change
- **FR-8.2**: Update column headers when input/output labels change
- **FR-8.3**: Rebuild table structure when inputs/outputs are added/removed
- **FR-8.4**: Preserve panel position during updates
- **FR-8.5**: Show computing progress for large circuits (many inputs)

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| Panel open time (≤8 inputs) | < 200ms |
| Panel re-open time | < 50ms (instant feel) |
| Row highlight update | < 100ms |
| Scrolling large tables | 60fps, no jank |

### 4.2 Usability

- **NFR-1**: No tooltip or help needed to understand basic functionality
- **NFR-2**: Panel should not obscure circuit by default (smart positioning)
- **NFR-3**: Visual feedback during long operations (progress bar)
- **NFR-4**: Consistent with application's visual theme (light/dark mode)

### 4.3 Reliability

- **NFR-5**: Panel state recovery if corrupted (sanitize invalid positions)
- **NFR-6**: Graceful handling of edge cases (empty circuit, very large circuit)
- **NFR-7**: No data loss on unexpected close (state saved before hide)

---

## 5. User Interface

### 5.1 Panel Layout

```
┌─────────────────────────────────────────────────────┐
│  Truth Table                                    [X] │  ← Header (draggable)
├─────────────────────────────────────────────────────┤
│         INPUTS           │        OUTPUTS          │  ← Column group headers
│    A     │     B         │          Y              │  ← Column labels
├──────────┼───────────────┼─────────────────────────┤
│    0     │     0         │          0              │
│    0     │     1         │    ►►    1    ◄◄        │  ← Highlighted row
│    1     │     0         │          1              │
│    1     │     1         │          1              │
└─────────────────────────────────────────────────────┘
                                            ↖ Resize handle (all edges)
```

### 5.2 Invalid State Display

```
┌─────────────────────────────────────────────────────┐
│  Truth Table                                    [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│                      ⚠                             │
│                                                     │
│       Add inputs and outputs to see the            │
│       truth table                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.3 Computing State Display

```
┌─────────────────────────────────────────────────────┐
│  Truth Table                                    [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│       Computing truth table...                      │
│       ████████████░░░░░░░░░░░░  48%                │
│       245 / 512 rows                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.4 Smart Positioning

On first open, panel should position itself to avoid obscuring circuit components:
1. Prefer right side of canvas if space available
2. Prefer bottom-right if components are centered
3. Never overlap existing components if avoidable

---

## 6. Edge Cases & Error Handling

### 6.1 Circuit Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty canvas (no components) | Show message: "Add components to build a circuit" |
| Only inputs, no outputs | Show message: "Add outputs to see truth table" |
| Only outputs, no inputs | Show message: "Add inputs to see truth table" |
| Unconnected components | Show message explaining circuit is incomplete |
| Very large circuit (10+ inputs) | Show progress bar, remain responsive |
| Maximum supported (15 inputs) | 32,768 rows - must remain scrollable and responsive |

### 6.2 Interaction Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Drag panel off-screen | Constrain to keep at least 20% visible |
| Resize very small | Enforce minimum size, content remains readable |
| Resize very large | Cap at 90% of viewport |
| Rapid open/close clicks | No duplicate panels, no errors |
| Close during computation | Clean cancellation, no residual state |

### 6.3 State Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Corrupted saved position | Reset to smart positioning |
| Saved size larger than current viewport | Scale down to fit |
| Column order doesn't match current circuit | Reset column order |
| Board loaded with different structure | Adapt panel to new structure |

---

## 7. Acceptance Criteria

### 7.1 Core Functionality

- [ ] User can open truth table panel from toolbar
- [ ] Panel displays correct truth table for any valid circuit
- [ ] Current input state row is highlighted
- [ ] Highlighted row updates when inputs change
- [ ] Panel can be closed via X button

### 7.2 Interactions

- [ ] Panel can be dragged by header
- [ ] Panel can be resized from any edge
- [ ] Columns can be reordered within their groups
- [ ] Panel stays within viewport bounds

### 7.3 Persistence

- [ ] Position persists across close/open
- [ ] Size persists across close/open
- [ ] Column order persists across close/open
- [ ] State saves with board and restores on load

### 7.4 Error Handling

- [ ] Invalid circuits show helpful message
- [ ] Large circuits show progress indicator
- [ ] Corrupted state is gracefully recovered

### 7.5 Performance

- [ ] Panel opens in under 200ms for typical circuits
- [ ] Re-opening is instant (< 50ms)
- [ ] Large tables scroll smoothly

---

## 8. Out of Scope

The following are explicitly **not** part of this feature:

| Item | Reason |
|------|--------|
| Editing circuit from truth table | Panel is read-only visualization |
| Exporting truth table to file | Future enhancement |
| Boolean expression generation | Future enhancement |
| Karnaugh map view | Future enhancement |
| Custom column formatting | Complexity vs value |
| Multiple truth table panels | Single panel sufficient |
| Truth table for sub-circuits | Future enhancement |

---

## 9. Future Considerations

Potential enhancements for future versions:

1. **Export**: Export truth table as CSV, image, or LaTeX
2. **Boolean Expression**: Derive and display boolean expression from truth table
3. **Karnaugh Map**: Alternative visualization for optimization
4. **Comparison Mode**: Compare two circuits' truth tables
5. **Search/Filter**: Find specific input combinations in large tables
6. **Cell Highlighting**: Highlight cells that differ from expected values

---

## 10. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Circuit Analysis System | Internal | Computes truth table data |
| Board Save/Load System | Internal | Persists panel state |
| Event Bus | Internal | Receives update notifications |
| Tabulator.js | External | Table rendering library |
| Interact.js | External | Drag/resize functionality |

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-08 | Product | Initial PRD |
