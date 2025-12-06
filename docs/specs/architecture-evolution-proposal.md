# Architecture Evolution Proposal: Graceful Live Circuit Editing

**Date:** 2025-12-05
**Status:** Proposal
**Context:** Supporting dynamic circuit changes during active simulation

---

## Executive Summary

The last 5 commits introduced increasingly sophisticated handling of circuit changes during simulation:

1. Truth table resizes when I/O changes
2. Simulation doesn't crash when I/O changes
3. Input state is preserved when I/O changes (bit-mapping)
4. Deletion that invalidates circuit shows confirmation dialog
5. Code consolidation to reduce duplication

This capability—**live editing during simulation**—is now a de facto feature. This document proposes architectural changes to make it sustainable and extensible.

---

## Current State Analysis

### What We've Built

| Capability | Implementation | Complexity |
|------------|----------------|------------|
| I/O addition during simulation | Bit-mapping to preserve input state | Medium |
| I/O deletion during simulation | Predictive validation + confirmation | High |
| Truth table sync | Structure detection + rebuild/refresh paths | High |
| Invalid circuit display | "?" values in truth table, warning message | Medium |

### Current Event Flow (Deletion Example)

```
User clicks delete on component
    ↓
circuit-simulator.js: checkDeletionImpact()
    ↓
CircuitOperations: Clone state → simulate deletion → validate
    ↓
If would invalidate + simulation running:
    ↓
Show confirmation dialog
    ↓
On confirm:
    ├→ resetSimulation({ skipSimulate: true })
    ├→ handleDelete()
    └→ simulate()
    ↓
Each step emits events:
    ├→ SIMULATION_STATE_CHANGED
    ├→ BOARD_CHANGED
    ├→ TRUTH_TABLE_COMPUTED
    └→ CANVAS_REDRAW
    ↓
TruthTablePanel.refresh()
    ↓
Structure comparison → rebuild or fast-path update
```

### Pain Points

1. **Coordinator knows too much**
   `circuit-simulator.js` orchestrates deletion with specific knowledge of simulation state, validation, and UI updates.

2. **Validation is scattered**
   `checkDeletionImpact()`, `startAutoCycle()`, `stepSimulation()` all validate differently.

3. **Events are imperative**
   Events like `CANVAS_REDRAW` and `TRUTH_TABLE_UPDATE_HIGHLIGHT` tell components what to do, not what happened.

4. **State queries everywhere**
   Multiple components call `state.isAutoCyclingActive()` to decide behavior.

5. **Complex conditional logic in UI**
   `TruthTablePanel.refresh()` has extensive logic to detect structure changes and choose update strategy.

---

## Proposed Architecture

### Core Principle: Separation of Concerns via State Machines

Instead of ad-hoc checks, introduce explicit state machines for circuit validity and simulation lifecycle.

### New Module: CircuitValidityManager

**Purpose:** Single source of truth for circuit validity state.

**Location:** `src/core/CircuitValidityManager.js`

```javascript
const VALIDITY_STATES = {
    EMPTY: 'empty',           // No components
    INCOMPLETE: 'incomplete', // Has I/O but not fully connected
    VALID: 'valid'            // Ready to simulate
};

class CircuitValidityManager {
    constructor(circuitState) {
        this.circuitState = circuitState;
        this.currentValidity = VALIDITY_STATES.EMPTY;
        this.lastReason = null;

        // React to topology changes
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, () => this.revalidate());
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, () => this.revalidate());
    }

    revalidate() {
        const components = this.circuitState.getComponents();
        const connections = this.circuitState.getConnections();
        const validation = validateCircuitForTruthTable(components, connections);

        const newValidity = this.computeValidity(validation);
        const oldValidity = this.currentValidity;

        if (oldValidity !== newValidity) {
            this.currentValidity = newValidity;
            this.lastReason = validation.reason;

            eventBus.emit(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, {
                from: oldValidity,
                to: newValidity,
                canSimulate: newValidity === VALIDITY_STATES.VALID,
                reason: validation.reason,
                inputs: validation.inputs,
                outputs: validation.outputs
            });
        }
    }

    canSimulate() {
        return this.currentValidity === VALIDITY_STATES.VALID;
    }

    getValidity() {
        return {
            state: this.currentValidity,
            reason: this.lastReason
        };
    }

    // Predictive validation for proposed changes
    wouldBeValidAfter(proposedComponents, proposedConnections) {
        const validation = validateCircuitForTruthTable(proposedComponents, proposedConnections);
        return {
            isValid: validation.isValid,
            reason: validation.reason
        };
    }

    computeValidity(validation) {
        if (validation.inputs.length === 0 && validation.outputs.length === 0) {
            return VALIDITY_STATES.EMPTY;
        }
        if (!validation.isValid) {
            return VALIDITY_STATES.INCOMPLETE;
        }
        return VALIDITY_STATES.VALID;
    }
}
```

**Benefits:**
- All validity checks go through one place
- Components subscribe to `CIRCUIT_VALIDITY_CHANGED` instead of checking validity themselves
- Predictive validation (`wouldBeValidAfter`) is explicit API

---

### New Module: SimulationController

**Purpose:** Owns simulation lifecycle, reacts to circuit changes.

**Location:** `src/core/SimulationController.js`

```javascript
const SIMULATION_STATES = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused'
};

class SimulationController {
    constructor(circuitState, validityManager, truthTableCache) {
        this.circuitState = circuitState;
        this.validityManager = validityManager;
        this.truthTableCache = truthTableCache;
        this.state = SIMULATION_STATES.IDLE;
        this.cycleIndex = 0;
        this.totalCombinations = 0;
        this.autoCycleTimeout = null;

        // React to validity changes
        eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, (e) => {
            this.handleValidityChange(e);
        });

        // React to I/O structure changes during simulation
        eventBus.on(EVENT_TYPES.IO_STRUCTURE_CHANGED, (e) => {
            this.handleIOStructureChange(e);
        });
    }

    // --- Public API ---

    start() {
        if (!this.validityManager.canSimulate()) {
            throw new InvalidCircuitError(this.validityManager.lastReason);
        }

        const inputs = this.getInputs();
        this.totalCombinations = Math.pow(2, inputs.length);
        this.cycleIndex = 0;
        this.state = SIMULATION_STATES.RUNNING;

        this.emitStateChange();
        this.scheduleNextStep();
    }

    stop() {
        this.clearTimeout();
        this.state = SIMULATION_STATES.IDLE;
        this.emitStateChange();
    }

    pause(reason) {
        this.clearTimeout();
        this.state = SIMULATION_STATES.PAUSED;

        eventBus.emit(EVENT_TYPES.SIMULATION_PAUSED, {
            reason,
            cycleIndex: this.cycleIndex,
            canResume: this.validityManager.canSimulate()
        });
    }

    resume() {
        if (!this.validityManager.canSimulate()) {
            throw new InvalidCircuitError('Cannot resume: circuit is incomplete');
        }

        this.state = SIMULATION_STATES.RUNNING;
        this.emitStateChange();
        this.scheduleNextStep();
    }

    step(direction = 1) {
        if (!this.validityManager.canSimulate()) {
            throw new InvalidCircuitError(this.validityManager.lastReason);
        }

        // Initialize if not started
        if (this.state === SIMULATION_STATES.IDLE) {
            const inputs = this.getInputs();
            this.totalCombinations = Math.pow(2, inputs.length);
        }

        // Calculate new index
        this.cycleIndex = (this.cycleIndex + direction + this.totalCombinations) % this.totalCombinations;

        this.applyInputsForIndex(this.cycleIndex);
        this.restoreFromCacheOrSimulate();
        this.emitStateChange();
    }

    reset() {
        this.stop();
        this.cycleIndex = 0;
        this.resetInputsToZero();
        this.emitStateChange();
    }

    isRunning() {
        return this.state === SIMULATION_STATES.RUNNING;
    }

    // --- Event Handlers ---

    handleValidityChange(event) {
        if (event.to === 'incomplete' && this.isRunning()) {
            this.pause(`Circuit became incomplete: ${event.reason}`);
        }
    }

    handleIOStructureChange(event) {
        if (!this.isRunning()) return;

        // Recalculate index based on current input values
        // This preserves user's current position in the new input space
        const inputs = this.getInputs();
        const newTotal = Math.pow(2, inputs.length);

        // Convert current input values to equivalent index
        let newIndex = 0;
        inputs.forEach(input => {
            const bitValue = input.value || 0;
            newIndex = (newIndex << 1) | bitValue;
        });

        this.cycleIndex = newIndex;
        this.totalCombinations = newTotal;

        this.emitStateChange();
    }

    // --- Private Helpers ---

    scheduleNextStep() {
        this.autoCycleTimeout = setTimeout(() => {
            this.executeAutoCycleStep();
        }, TIMING.AUTO_CYCLE_DELAY);
    }

    executeAutoCycleStep() {
        if (this.state !== SIMULATION_STATES.RUNNING) return;

        this.applyInputsForIndex(this.cycleIndex);
        this.restoreFromCacheOrSimulate();

        eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
            cycleIndex: this.cycleIndex,
            totalCombinations: this.totalCombinations,
            inputValues: this.getCurrentInputValues()
        });

        // Advance to next
        this.cycleIndex = (this.cycleIndex + 1) % this.totalCombinations;
        this.scheduleNextStep();
    }

    applyInputsForIndex(index) {
        const inputs = this.getInputs();
        inputs.forEach((input, i) => {
            input.value = (index >> (inputs.length - 1 - i)) & 1;
        });
    }

    restoreFromCacheOrSimulate() {
        const cache = this.truthTableCache.get();
        if (cache?.isValid && cache.table?.[this.cycleIndex]) {
            this.applyComponentValuesFromCache(cache.table[this.cycleIndex]);
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        } else {
            // Fallback to full simulation
            simulateCircuit(
                this.circuitState.getComponents(),
                this.circuitState.getConnections()
            );
            eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        }
    }

    emitStateChange() {
        eventBus.emit(EVENT_TYPES.SIMULATION_STATE_CHANGED, {
            state: this.state,
            isRunning: this.state === SIMULATION_STATES.RUNNING,
            cycleIndex: this.cycleIndex,
            totalCombinations: this.totalCombinations
        });
    }

    // ... other helpers
}
```

**Benefits:**
- Simulation lifecycle in one place
- Clear state machine (IDLE → RUNNING → PAUSED → IDLE)
- Reacts to validity changes automatically
- I/O structure change handling is encapsulated

---

### Event System Evolution

#### Current: Imperative Events

```javascript
// Emitter knows what listener should do
eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
eventBus.emit(EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT);
```

#### Proposed: Declarative Events

```javascript
// Emitter describes what happened
eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, {
    cycleIndex: 5,
    totalCombinations: 8,
    inputValues: [1, 0, 1]
});

// Listeners decide what to do
// Canvas subscribes: "I'll redraw"
// TruthTable subscribes: "I'll highlight row 5"
// Future WaveformViewer subscribes: "I'll add a data point"
```

#### New Event Types

```javascript
// Add to EVENT_TYPES in eventBus.js

// Circuit validity (declarative)
CIRCUIT_VALIDITY_CHANGED: 'circuit:validityChanged',
// { from, to, canSimulate, reason, inputs, outputs }

// I/O structure specifically (declarative)
IO_STRUCTURE_CHANGED: 'circuit:ioStructureChanged',
// { addedInputs, removedInputs, addedOutputs, removedOutputs }

// Simulation lifecycle (declarative)
SIMULATION_STARTED: 'simulation:started',
SIMULATION_STOPPED: 'simulation:stopped',
SIMULATION_PAUSED: 'simulation:paused',
// { reason, cycleIndex, canResume }

SIMULATION_STEP_COMPLETED: 'simulation:stepCompleted',
// { cycleIndex, totalCombinations, inputValues }

// Proposed changes (for confirmation flows)
DELETION_PROPOSED: 'circuit:deletionProposed',
// { component, connection, wouldInvalidate, transaction }

DELETION_CONFIRMED: 'circuit:deletionConfirmed',
DELETION_CANCELLED: 'circuit:deletionCancelled',
```

---

### Transaction Pattern for Destructive Changes

**Purpose:** Separate "what would happen" from "make it happen".

```javascript
// New: src/core/CircuitTransaction.js

class CircuitTransaction {
    constructor(circuitState) {
        this.circuitState = circuitState;
        this.operations = [];
        this.committed = false;

        // Clone current state for simulation
        this.simulatedComponents = JSON.parse(JSON.stringify(circuitState.getComponents()));
        this.simulatedConnections = JSON.parse(JSON.stringify(circuitState.getConnections()));
    }

    removeComponent(componentId) {
        this.operations.push({ type: 'removeComponent', componentId });

        // Apply to simulated state
        this.simulatedComponents = this.simulatedComponents.filter(c => c.id !== componentId);
        this.simulatedConnections = this.simulatedConnections.filter(
            conn => conn.from !== componentId && conn.to !== componentId
        );

        return this;
    }

    removeConnection(connection) {
        this.operations.push({ type: 'removeConnection', connection });

        // Apply to simulated state
        this.simulatedConnections = this.simulatedConnections.filter(conn =>
            !(conn.from === connection.from && conn.to === connection.to &&
              conn.fromPort === connection.fromPort && conn.toPort === connection.toPort)
        );

        return this;
    }

    analyze() {
        const validation = validateCircuitForTruthTable(
            this.simulatedComponents,
            this.simulatedConnections
        );

        return {
            wouldBeValid: validation.isValid,
            newValidity: validation.isValid ? 'valid' : 'incomplete',
            reason: validation.reason,
            affectedComponents: this.getAffectedComponents(),
            inputCount: validation.inputs.length,
            outputCount: validation.outputs.length
        };
    }

    commit() {
        if (this.committed) {
            throw new Error('Transaction already committed');
        }

        // Apply operations to real state
        for (const op of this.operations) {
            switch (op.type) {
                case 'removeComponent':
                    this.circuitState.removeComponent(op.componentId);
                    break;
                case 'removeConnection':
                    this.circuitState.removeConnection(op.connection);
                    break;
            }
        }

        this.committed = true;
        return true;
    }

    getAffectedComponents() {
        // Returns list of components that would be affected
        // Useful for highlighting in UI before confirmation
    }
}
```

**Usage in Coordinator:**

```javascript
// circuit-simulator.js

handleDeleteClick(x, y) {
    const component = this.findComponent(x, y);
    const connection = component ? null : this.findConnection(x, y);

    if (!component && !connection) return;

    // Create transaction
    const transaction = new CircuitTransaction(this.state);
    if (component) {
        transaction.removeComponent(component.id);
    } else {
        transaction.removeConnection(connection);
    }

    const impact = transaction.analyze();

    // Emit proposal event (UI can react)
    eventBus.emit(EVENT_TYPES.DELETION_PROPOSED, {
        component,
        connection,
        impact,
        transaction
    });

    // If simulation running and would invalidate, confirm first
    if (this.simulationController.isRunning() && !impact.wouldBeValid) {
        DialogFactory.showConfirm({
            message: messages.confirms.deletionWillStopSimulation.message,
            onConfirm: () => {
                this.simulationController.pause('Component deleted');
                transaction.commit();
                eventBus.emit(EVENT_TYPES.DELETION_CONFIRMED);
            },
            onCancel: () => {
                eventBus.emit(EVENT_TYPES.DELETION_CANCELLED);
            }
        });
    } else {
        transaction.commit();
        eventBus.emit(EVENT_TYPES.DELETION_CONFIRMED);
    }
}
```

**Benefits:**
- Clear separation: analyze → confirm → commit
- Transactions can be cancelled
- Impact analysis is reusable (e.g., for undo preview)
- Easy to test

---

### Simplified TruthTablePanel

With declarative events, the panel becomes a pure renderer:

```javascript
// Simplified src/ui/TruthTablePanel.js

class TruthTablePanel {
    constructor(config) {
        this.panel = config.panel;
        this.circuitState = config.circuitState;
        this.table = null;

        // Subscribe to events
        eventBus.on(EVENT_TYPES.TRUTH_TABLE_COMPUTED, (cache) => {
            if (this.isVisible()) {
                this.render(cache);
            }
        });

        eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, (data) => {
            this.highlightRow(data.cycleIndex);
        });

        eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, (data) => {
            if (this.isVisible() && !data.canSimulate) {
                this.showInvalidMessage(data.reason);
            }
        });
    }

    render(cache) {
        // Always rebuild table - Tabulator handles diffing internally
        // No manual structure comparison needed

        if (!cache || cache.table.length === 0) {
            this.showInvalidMessage(cache?.reason || 'No data');
            return;
        }

        const columns = this.buildColumns(cache.inputs, cache.outputs);

        if (this.table) {
            // Tabulator's setColumns + setData handles structure changes
            this.table.setColumns(columns);
            this.table.setData(cache.table);
        } else {
            this.table = new Tabulator(this.contentEl, {
                columns,
                data: cache.table,
                // ... other config
            });
        }

        this.applyTableWidth();
    }

    highlightRow(index) {
        if (!this.table) return;

        // Clear previous highlight
        this.table.getRows().forEach(row => {
            row.getElement().classList.remove('highlighted');
        });

        // Highlight current row
        const row = this.table.getRowFromPosition(index);
        if (row) {
            row.getElement().classList.add('highlighted');
            row.scrollTo();
        }
    }

    showInvalidMessage(reason) {
        // ... show warning UI
    }

    // ... other methods (positioning, interactions)
}
```

**Benefits:**
- No `refresh()` method with complex structure detection
- No `previousTruthTableData` tracking
- Panel just renders what it's given
- Highlight is driven by events, not internal state comparison

---

## Migration Path

### Phase 1: Add New Modules (Non-Breaking)

1. Create `CircuitValidityManager` alongside existing code
2. Have it emit `CIRCUIT_VALIDITY_CHANGED` events
3. Existing code continues to work, new code can subscribe

### Phase 2: Extract SimulationController

1. Move simulation methods from `CircuitOperations` to `SimulationController`
2. `CircuitOperations` delegates to `SimulationController`
3. Gradually remove delegation as consumers migrate

### Phase 3: Add Transaction Pattern

1. Create `CircuitTransaction` class
2. Use it for delete operations first
3. Extend to other destructive operations (clear, load board)

### Phase 4: Simplify UI Components

1. Update `TruthTablePanel` to use new events
2. Remove complex structure detection logic
3. Update other UI components to subscribe to declarative events

### Phase 5: Clean Up

1. Remove deprecated methods from `CircuitOperations`
2. Remove imperative events (keep for backwards compat or remove entirely)
3. Update tests

---

## File Changes Summary

### New Files

| File | Purpose | Lines (Est.) |
|------|---------|--------------|
| `src/core/CircuitValidityManager.js` | Validity state machine | ~100 |
| `src/core/SimulationController.js` | Simulation lifecycle | ~250 |
| `src/core/CircuitTransaction.js` | Predictive changes | ~100 |

### Modified Files

| File | Changes |
|------|---------|
| `src/utils/eventBus.js` | Add new declarative event types |
| `src/core/CircuitOperations.js` | Remove simulation methods (moved to controller) |
| `src/ui/TruthTablePanel.js` | Simplify to pure renderer |
| `circuit-simulator.js` | Wire new modules, use transactions |

### Files to Eventually Simplify

| File | Current Complexity | After Refactor |
|------|-------------------|----------------|
| `TruthTablePanel.js` | ~850 lines | ~500 lines |
| `CircuitOperations.js` | ~600 lines | ~400 lines |

---

## When to Do This Refactor

**Not yet.** The current code works.

**Do it when:**
- Adding undo/redo (transactions become essential)
- Adding subcircuit expansion during simulation
- Adding additional simulation visualizations (waveform viewer)
- The current event flow becomes hard to debug

**For now:**
- Document the current event flow
- Keep this proposal as a reference
- Apply patterns incrementally when touching related code

---

## Appendix: Current vs Proposed Event Flow

### Current: Delete During Simulation

```
User clicks delete
    ↓
circuit-simulator.js
    ├→ checkDeletionImpact() - clones state, validates
    ├→ if invalid: show dialog
    ├→ on confirm: resetSimulation() → handleDelete() → simulate()
    ↓
Multiple events emitted in sequence
    ↓
TruthTablePanel.refresh() - detects structure change, rebuilds
```

### Proposed: Delete During Simulation

```
User clicks delete
    ↓
circuit-simulator.js
    ├→ Create CircuitTransaction
    ├→ transaction.analyze() - returns impact
    ├→ Emit DELETION_PROPOSED
    ├→ if invalid + running: show dialog
    ├→ on confirm:
    │   ├→ simulationController.pause()
    │   └→ transaction.commit()
    ↓
CircuitState emits COMPONENT_REMOVED
    ↓
ValidityManager.revalidate() emits CIRCUIT_VALIDITY_CHANGED
    ↓
TruthTablePanel.render() - just renders new data
SimulationController - already paused, ready for user to resume
```

**Key difference:** Each module reacts to events it cares about. No orchestration knowledge required in UI components.
