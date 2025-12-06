# Plan: Simplify by Disabling Board Editing During Simulation

**Date:** 2025-12-05
**Status:** Proposal
**Alternative to:** `architecture-evolution-proposal.md` (which embraces live-editing complexity)

---

## Goal

1. Revert live-editing complexity while keeping side benefits
2. Disable board editing when simulation is running
3. Preserve the code in a branch for potential future use

---

## Context

Five commits (`0f27d4f` through `59107e3`) added ~400 lines of complexity to support live circuit editing during simulation. After analysis, we determined:

- **Live editing during simulation is not a valid use case** - Users don't need to modify circuit structure while watching it run
- **The complexity tax is high** - Bit-mapping, predictive validation, structure detection, invalid table generation
- **Simpler behavior is expected** - Most logic simulators disable editing during simulation

This plan reverts that complexity while keeping any incidental improvements.

---

## Step 0: Preserve Current Code

**Before any changes, create a branch to preserve the live-editing implementation:**

```bash
git branch feature/live-editing-during-simulation
```

This branch will contain commits `0f27d4f` through `59107e3` intact, allowing future retrieval if needed.

---

## Step 1: Add Simulation Guard to Toolbar/Interaction

**Files to modify:**
- `src/ui/Toolbar.js`
- `src/interaction/CanvasInteraction.js`
- `src/ui/messages.js`

**What to do:**

When simulation is running (`state.isAutoCyclingActive() === true`), disable:
- Component placement buttons (INPUT, OUTPUT, AND, OR, NOT, etc.)
- Connect mode button
- Delete mode button

**Implementation:**

```javascript
// In Toolbar.js - add method
updateSimulationState(isRunning) {
    const buttonsToDisable = [
        'inputBtn', 'outputBtn', 'andBtn', 'orBtn', 'notBtn',
        'nandBtn', 'norBtn', 'xorBtn', 'xnorBtn',
        'connectBtn', 'deleteBtn'
    ];

    buttonsToDisable.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = isRunning;
            btn.title = isRunning
                ? messages.tooltips.disabledDuringSimulation
                : btn.dataset.originalTitle;
        }
    });
}

// Subscribe to simulation state changes
eventBus.on(EVENT_TYPES.SIMULATION_STATE_CHANGED, (data) => {
    this.updateSimulationState(data.isRunning);
});
```

**Add message:**
```javascript
// In messages.js
tooltips: {
    disabledDuringSimulation: 'Stop simulation to edit circuit'
}
```

---

## Step 2: Remove Live-Editing Detection from autoCycleStep

**File:** `src/core/CircuitOperations.js`

**What to remove:**

The input count change detection block (lines ~397-413):

```javascript
// REMOVE THIS BLOCK from autoCycleStep():
if (currentTotalCombinations !== storedTotalCombinations) {
    // Input count changed - recalculate index to preserve current input state
    let newIndex = 0;
    inputs.forEach(input => {
        const bitValue = input.value || 0;
        newIndex = (newIndex << 1) | bitValue;
    });
    this.state.setTotalCombinations(currentTotalCombinations);
    this.state.setCurrentCycleIndex(newIndex);
}
```

**Why safe to remove:** With toolbar disabled during simulation, input count can never change mid-simulation.

---

## Step 3: Remove checkDeletionImpact and Related Code

**Files to modify:**
- `src/core/CircuitOperations.js` - Remove `checkDeletionImpact()` method
- `circuit-simulator.js` - Simplify delete handler

**In CircuitOperations.js, remove:**
- `checkDeletionImpact()` method (~40 lines)

**In circuit-simulator.js, simplify delete handler:**

```javascript
// BEFORE (complex):
const impact = this.operations.checkDeletionImpact(x, y, findConnection);
if (impact.willInvalidate) {
    DialogFactory.showConfirm({...});
} else {
    this.operations.handleDelete(x, y, findConnection);
}

// AFTER (simple):
this.operations.handleDelete(x, y, findConnection);
```

**Why safe:** Delete button is disabled during simulation, so no need to check impact.

---

## Step 4: Remove Invalid Circuit Table Generation

**File:** `src/core/TruthTableComputer.js`

**What to remove:**
- `generateInvalidCircuitTable()` function (~60 lines)
- The call to it in `computeTruthTable()`

**Revert to simple behavior:**

```javascript
// In computeTruthTable(), restore original:
if (!validation.isValid) {
    return {
        inputs: validation.inputs,
        outputs: validation.outputs,
        table: [],
        isValid: false,
        reason: validation.reason
    };
}
```

**Why safe:** Circuit can't become invalid during simulation if editing is disabled.

---

## Step 5: Simplify TruthTablePanel.refresh()

**File:** `src/ui/TruthTablePanel.js`

**What to simplify:**

The complex `refresh()` method with structure detection can be simplified since structure won't change during simulation.

**Remove:**
- `displayInvalidMessage()` method
- Structure change detection in `refresh()`
- `reapplyRowHeights()` method (only needed for mid-simulation updates)
- `applyTableWidth()` complexity

**Simplified refresh():**

```javascript
refresh() {
    if (!this.panel || this.panel.classList.contains('hidden')) {
        return;
    }

    const cache = this.circuitState.getTruthTableCache();
    if (!cache || !cache.isValid) {
        this.hide();
        return;
    }

    // Structure can't change during simulation, just update data
    this.truthTableData = cache;
    if (this.table) {
        this.table.replaceData(cache.table);
    }
    this.updateHighlight();
}
```

---

## Step 6: Remove InvalidCircuitError

**File:** `src/core/errors.js`

**What to remove:**
- `InvalidCircuitError` class

**Update imports in:**
- `src/core/CircuitOperations.js` - Remove from import

**Revert validation in startAutoCycle/stepSimulation:**

```javascript
// Use original simple validation:
const inputs = components.filter(c => c.type === 'INPUT');
if (inputs.length === 0) {
    throw new NoInputsError();
}
const outputs = components.filter(c => c.type === 'OUTPUT');
if (outputs.length === 0) {
    throw new NoOutputsError();
}
```

---

## Step 7: Remove Confirmation Dialog Message

**File:** `src/ui/messages.js`

**Remove:**
```javascript
deletionWillStopSimulation: {
    message: '...',
    title: '...',
    confirmLabel: '...',
    cancelLabel: '...'
}
```

---

## Step 8: Remove CSS for Invalid Message

**File:** `styles/truth-table.css`

**Remove:**
```css
.truth-table-invalid-message { ... }
.truth-table-invalid-message .icon { ... }
.truth-table-invalid-message .message { ... }
```

---

## Step 9: Update Tests

**Files:**
- `tests/unit/core/CircuitOperations.test.js`
- `tests/unit/ui/TruthTablePanel.test.js`

**Remove tests for:**
- `checkDeletionImpact()`
- Input count change during simulation
- Invalid circuit table generation
- Structure change detection in refresh()

**Add tests for:**
- Toolbar buttons disabled during simulation
- Attempting to place component during simulation shows message (if interaction layer allows click through)

---

## Step 10: Keep Useful Side Benefits

**What to KEEP from the commits:**

| Item | Why Keep |
|------|----------|
| `_restoreFromCacheOrSimulate()` helper | Good code organization, DRY |
| `validateCircuitForTruthTable()` function | Useful for truth table generation validation |
| `resetSimulation({ skipSimulate })` pattern | Clean API with options |
| Test infrastructure additions | Good test patterns |

---

## Files Changed Summary

| File | Action |
|------|--------|
| `src/ui/Toolbar.js` | Add simulation state handling |
| `src/interaction/CanvasInteraction.js` | Optional: block interactions during sim |
| `src/core/CircuitOperations.js` | Remove ~80 lines (checkDeletionImpact, input count detection) |
| `src/core/TruthTableComputer.js` | Remove ~60 lines (generateInvalidCircuitTable) |
| `src/ui/TruthTablePanel.js` | Simplify refresh(), remove ~100 lines |
| `src/core/errors.js` | Remove InvalidCircuitError |
| `src/ui/messages.js` | Remove deletion confirmation, add tooltip |
| `styles/truth-table.css` | Remove invalid message styles |
| `circuit-simulator.js` | Simplify delete handler |
| `tests/unit/core/CircuitOperations.test.js` | Update tests |
| `tests/unit/ui/TruthTablePanel.test.js` | Update tests |

---

## Net Code Change

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| CircuitOperations.js | ~600 lines | ~520 lines | -80 |
| TruthTableComputer.js | ~200 lines | ~140 lines | -60 |
| TruthTablePanel.js | ~900 lines | ~750 lines | -150 |
| **Total removed** | | | **~290 lines** |
| **Total added** (toolbar guard) | | | **~30 lines** |
| **Net reduction** | | | **~260 lines** |

---

## Verification Checklist

After implementation:

- [ ] Simulation starts correctly
- [ ] Toolbar buttons disabled during simulation
- [ ] Tooltip shows "Stop simulation to edit circuit"
- [ ] Stop simulation re-enables buttons
- [ ] Truth table displays correctly
- [ ] Truth table highlights current row during simulation
- [ ] Manual step (prev/next) works when simulation stopped
- [ ] All existing tests pass (minus removed ones)
- [ ] New toolbar disable tests pass

---

## Rollback Plan

If needed, restore live-editing:

```bash
git checkout feature/live-editing-during-simulation -- src/core/CircuitOperations.js
git checkout feature/live-editing-during-simulation -- src/ui/TruthTablePanel.js
# etc.
```

Or merge the branch back in.

---

## Future: When to Revisit Live Editing

Consider re-enabling live editing (from the preserved branch) if:

1. **Users request it** - Actual demand, not hypothetical
2. **ValidityManager is implemented** - Makes the complexity manageable
3. **SimulationController is extracted** - Clean separation of concerns

See `architecture-evolution-proposal.md` for the full architecture that would support live editing properly.

---

## Relationship to Other Proposals

| Document | Approach | When to Use |
|----------|----------|-------------|
| **This document** | Simplify, disable live editing | Now (default) |
| `architecture-evolution-proposal.md` | Embrace complexity, add ValidityManager/SimulationController | If live editing becomes a real requirement |

**Recommendation:** Implement this simplification plan now. Revisit the architecture evolution if/when you add undo/redo, collaborative editing, or users explicitly request live editing.
