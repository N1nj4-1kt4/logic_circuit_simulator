# Spec: Pre-Deletion Validation During Active Simulation

## Problem Statement

When a user deletes a component (input/output/gate/wire) during an active simulation that invalidates the circuit (no valid gates remain), the current behavior is problematic:

1. Truth Table disappears (hides itself when cache becomes invalid)
2. Simulation continues running in a broken state (inputs toggle, outputs turn gray)
3. User can't reopen Truth Table (gets validation error)

## Desired Behavior

1. **Pre-deletion check**: When simulation is running, before deleting anything, check if the deletion would invalidate the last remaining valid circuit
2. **Warning dialog**: If it would invalidate, show a confirm dialog warning the user that proceeding will stop the simulation
3. **If user proceeds**: Stop simulation, reset all inputs to "0", keep Truth Table visible (no highlighted row), then delete the component
4. **If user cancels**: Do nothing, leave everything as-is

### Additional Requirement: Truth Table for Invalid Circuits

The Truth Table should be allowed to display even for invalid circuits. Only simulation requires a valid circuit. Currently:
- Truth Table refuses to open if circuit is invalid (shows error dialog)
- Truth Table auto-hides when circuit becomes invalid via `refresh()` method

**New behavior**: Truth Table remains visible for invalid circuits, showing column headers (inputs/outputs if available) with a message like "Circuit incomplete".

---

## Implementation Plan

### Phase 1: Add Pre-Deletion Validation Check

**File: `src/core/CircuitOperations.js`**

Add a new method `checkDeletionImpact()` that:
1. Finds the component or connection at the given coordinates
2. If simulation is not running, returns `{ willInvalidate: false }`
3. If simulation is running:
   - Clones the current components and connections
   - Simulates the deletion on the clones
   - Runs `validateCircuitForTruthTable()` on the result
   - Returns `{ willInvalidate: boolean, component, connection }`

```javascript
/**
 * Check if deleting a component/connection would invalidate the circuit during simulation
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Function} findConnection - Function to find connection at coordinates
 * @returns {{ willInvalidate: boolean, component: Object|null, connection: Object|null }}
 */
checkDeletionImpact(x, y, findConnection) {
    const component = this.callbacks.findComponent(x, y);
    const connection = component ? null : findConnection(x, y);

    // Nothing to delete
    if (!component && !connection) {
        return { willInvalidate: false, component: null, connection: null };
    }

    // Only check during active simulation
    if (!this.state.isAutoCyclingActive()) {
        return { willInvalidate: false, component, connection };
    }

    // Clone current circuit state
    const clonedComponents = JSON.parse(JSON.stringify(this.state.getComponents()));
    const clonedConnections = JSON.parse(JSON.stringify(this.state.getConnections()));

    let filteredComponents = clonedComponents;
    let filteredConnections = clonedConnections;

    if (component) {
        // Simulate component deletion
        const componentId = component.id;
        filteredComponents = clonedComponents.filter(c => c.id !== componentId);
        filteredConnections = clonedConnections.filter(
            conn => conn.from !== componentId && conn.to !== componentId
        );
    } else if (connection) {
        // Simulate connection deletion
        filteredConnections = clonedConnections.filter(
            conn => !(conn.from === connection.from &&
                     conn.to === connection.to &&
                     conn.fromPort === connection.fromPort &&
                     conn.toPort === connection.toPort)
        );
    }

    // Check if result would still be valid
    const validation = validateCircuitForTruthTable(filteredComponents, filteredConnections);

    return {
        willInvalidate: !validation.isValid,
        component,
        connection
    };
}
```

**Import needed**: Add `validateCircuitForTruthTable` to imports from `TruthTableComputer.js`

---

### Phase 2: Add Warning Message

**File: `src/ui/messages.js`**

Add to `confirms` section:

```javascript
deletionWillStopSimulation: {
    message: 'This deletion will invalidate the circuit and stop the simulation. All inputs will be reset to 0.',
    title: 'Stop Simulation?',
    confirmLabel: 'Delete Anyway',
    cancelLabel: 'Cancel'
}
```

---

### Phase 3: Integrate Pre-Deletion Check in Coordinator

**File: `circuit-simulator.js`**

Modify the delete mode handling in `handleCanvasClick()` (around line 399-401):

**Before:**
```javascript
} else if (this.state.getMode() === 'delete') {
    console.log('Calling handleDelete');
    this.operations.handleDelete(x, y, (x, y) => this.findConnection(x, y));
}
```

**After:**
```javascript
} else if (this.state.getMode() === 'delete') {
    const findConnectionFn = (x, y) => this.findConnection(x, y);
    const impact = this.operations.checkDeletionImpact(x, y, findConnectionFn);

    if (impact.willInvalidate) {
        // Show warning dialog before proceeding
        DialogFactory.showConfirm({
            message: messages.confirms.deletionWillStopSimulation.message,
            title: messages.confirms.deletionWillStopSimulation.title,
            confirmLabel: messages.confirms.deletionWillStopSimulation.confirmLabel,
            cancelLabel: messages.confirms.deletionWillStopSimulation.cancelLabel,
            type: 'warning',
            onConfirm: () => {
                // Stop simulation and reset inputs first
                this.simulationController.reset();
                // Then proceed with deletion
                this.operations.handleDelete(x, y, findConnectionFn);
            }
        });
    } else if (impact.component || impact.connection) {
        // Something to delete, no impact on validity - proceed directly
        this.operations.handleDelete(x, y, findConnectionFn);
    }
    // If nothing found at coordinates, handleDelete will just do nothing
}
```

---

### Phase 4: Modify Truth Table to Support Invalid Circuits

**File: `src/ui/TruthTablePanel.js`**

#### 4a. Modify `generate()` method (lines 52-93)

**Before:** Refuses to open if `!cache.isValid`, shows alert dialog.

**After:** Accept invalid circuits, just store the data (including `isValid` flag and `reason`):

```javascript
generate() {
    const cache = this.circuitState.getTruthTableCache();

    if (!cache) {
        DialogFactory.showAlert({
            message: 'Truth table is being computed. Please try again.',
            type: 'info'
        });
        return false;
    }

    // CHANGED: Accept invalid circuits - we'll show appropriate UI
    const { inputs, outputs, table, isValid, reason } = cache;

    this.truthTableData = {
        inputs: inputs || [],
        outputs: outputs || [],
        table: table || [],
        isValid: isValid,
        reason: reason
    };

    // Initialize column order if not set (for valid circuits with columns)
    if (!this.columnOrder && inputs && outputs) {
        this.columnOrder = [];
        for (let i = 0; i < inputs.length + outputs.length; i++) {
            this.columnOrder.push(i);
        }
    }

    return true;
}
```

#### 4b. Modify `display()` method

Add handling for invalid circuits - show a message instead of the table:

```javascript
// After checking if truthTableData exists, add:
if (!this.truthTableData.isValid) {
    this.displayInvalidState();
    return;
}
// ... rest of existing display logic for valid circuits
```

Add new method:

```javascript
/**
 * Display the panel in an invalid circuit state
 * Shows column headers if available, with a message explaining why table is empty
 */
displayInvalidState() {
    this.panel = document.getElementById('truthTablePanel');
    const content = document.getElementById('truthTableContent');

    if (!this.panel || !content) return;

    // Destroy existing table if any
    if (this.table) {
        this.table.destroy();
        this.table = null;
    }

    // Show panel
    this.panel.classList.remove('hidden');
    this.panel.style.display = 'block';

    // Display invalid state message
    const reason = this.truthTableData.reason || 'Circuit is incomplete.';
    content.innerHTML = `
        <div class="truth-table-invalid-state">
            <div class="invalid-icon">⚠️</div>
            <div class="invalid-message">${reason}</div>
        </div>
    `;

    // Restore position if saved
    this.restoreState();

    // Emit shown event
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
}
```

#### 4c. Modify `refresh()` method (lines 721-781)

**Before:** Hides panel when cache becomes invalid (lines 735-737).

**After:** Update to show invalid state instead of hiding:

```javascript
refresh() {
    if (!this.panel || !this.table) {
        return;
    }

    if (this.panel.classList.contains('hidden')) {
        return;
    }

    const cache = this.circuitState.getTruthTableCache();

    // CHANGED: Don't hide - update to show invalid state
    if (!cache || !cache.isValid) {
        // Update truthTableData with invalid state
        this.truthTableData = {
            inputs: cache?.inputs || [],
            outputs: cache?.outputs || [],
            table: [],
            isValid: false,
            reason: cache?.reason || 'Circuit is incomplete.'
        };
        this.displayInvalidState();
        return;
    }

    // ... rest of existing refresh logic for valid circuits
}
```

#### 4d. Modify `updateHighlight()` method

Add early return for invalid circuits:

```javascript
updateHighlight() {
    if (!this.table || !this.truthTableData) return;

    // No highlighting for invalid circuits
    if (!this.truthTableData.isValid) {
        return;
    }

    // ... existing highlighting logic
}
```

---

### Phase 5: Add CSS for Invalid State

**File: `styles/truth-table.css`**

```css
/* Invalid circuit state display */
.truth-table-invalid-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
    min-height: 80px;
    color: var(--text-secondary);
}

.truth-table-invalid-state .invalid-icon {
    font-size: 24px;
    margin-bottom: 8px;
    opacity: 0.7;
}

.truth-table-invalid-state .invalid-message {
    font-size: 13px;
    line-height: 1.4;
    max-width: 200px;
}
```

---

## Testing Strategy

### Unit Tests

**File: `tests/unit/core/CircuitOperations.test.js`**

```javascript
describe('checkDeletionImpact', () => {
    it('returns willInvalidate: false when simulation is not running', () => {
        // Setup: valid circuit, simulation stopped
        // Action: check deletion of a component
        // Assert: willInvalidate is false
    });

    it('returns willInvalidate: false when deletion keeps circuit valid', () => {
        // Setup: circuit with 2 valid gates, simulation running
        // Action: check deletion of one gate (other still valid)
        // Assert: willInvalidate is false
    });

    it('returns willInvalidate: true when deleting last valid gate during simulation', () => {
        // Setup: circuit with 1 valid gate, simulation running
        // Action: check deletion of that gate
        // Assert: willInvalidate is true
    });

    it('returns willInvalidate: true when deleting critical wire during simulation', () => {
        // Setup: circuit with 1 valid gate (AND with 2 inputs connected), simulation running
        // Action: check deletion of one input wire
        // Assert: willInvalidate is true (AND now has only 1 input connected)
    });

    it('returns component when component found at coordinates', () => {...});

    it('returns connection when connection found at coordinates', () => {...});

    it('returns nulls when nothing at coordinates', () => {...});
});
```

**File: `tests/unit/ui/TruthTablePanel.test.js`**

```javascript
describe('Invalid Circuit Handling', () => {
    it('generate() returns true for invalid circuit cache', () => {...});

    it('displayInvalidState() shows reason message', () => {...});

    it('refresh() shows invalid state instead of hiding panel', () => {...});

    it('updateHighlight() does nothing for invalid circuit', () => {...});
});
```

### Integration Tests

**File: `tests/integration/deletion-during-simulation.test.js`** (new)

```javascript
describe('Deletion During Active Simulation', () => {
    it('shows warning dialog when deletion would invalidate circuit', () => {...});

    it('stops simulation when user confirms deletion', () => {...});

    it('resets all inputs to 0 when user confirms deletion', () => {...});

    it('keeps Truth Table visible after invalidating deletion', () => {...});

    it('Truth Table shows invalid state message after deletion', () => {...});

    it('does nothing when user cancels deletion', () => {...});

    it('proceeds without warning when deletion keeps circuit valid', () => {...});

    it('proceeds without warning when simulation is not running', () => {...});
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/core/CircuitOperations.js` | Add `checkDeletionImpact()` method, add import for `validateCircuitForTruthTable` |
| `src/ui/messages.js` | Add `deletionWillStopSimulation` confirmation message |
| `circuit-simulator.js` | Modify delete mode handling to use pre-deletion check |
| `src/ui/TruthTablePanel.js` | Modify `generate()`, `refresh()`, `updateHighlight()`, add `displayInvalidState()` |
| `styles/truth-table.css` | Add `.truth-table-invalid-state` styles |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/deletion-during-simulation.test.js` | Integration tests for the feature |

---

## Implementation Order

1. **Phase 1**: Add `checkDeletionImpact()` to CircuitOperations (pure logic, easily testable)
2. **Phase 2**: Add messages to `messages.js`
3. **Phase 5**: Add CSS for invalid state (no dependencies)
4. **Phase 4**: Modify TruthTablePanel to support invalid circuits
5. **Phase 3**: Integrate in coordinator (ties everything together)
6. **Tests**: Add unit and integration tests throughout
