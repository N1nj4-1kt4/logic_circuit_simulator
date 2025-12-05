# Architecture Flow Diagram

This document visualizes the event-driven architecture implemented for live circuit editing.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STATE LAYER                                         │
│                                                                                  │
│  ┌──────────────┐     ┌─────────────────────┐     ┌─────────────────────┐       │
│  │ CircuitState │────▶│CircuitValidityManager│────▶│SimulationController │       │
│  │              │     │                     │     │                     │       │
│  │ • components │     │ • currentValidity   │     │ • autocycleStart()  │       │
│  │ • connections│     │   (EMPTY/INCOMPLETE/│     │ • autocycleStop()   │       │
│  │ • mode       │     │   VALID)            │     │ • manualStep()      │       │
│  └──────────────┘     │ • revalidate()      │     │ • onToggleInput()   │       │
│         │             │ • wouldBeValidAfter │     └─────────────────────┘       │
│         │             └─────────────────────┘               │                    │
│         │                       │                           │                    │
│         ▼                       ▼                           ▼                    │
│    BOARD_CHANGED ──────▶ CIRCUIT_VALIDITY_CHANGED    ┌──────────────────────┐   │
│                                 │                    │ Two distinct events: │   │
│                                 │                    │                      │   │
│                                 │                    │ AUTOCYCLE_STATE_     │   │
│                                 │                    │ CHANGED              │   │
│                                 │                    │ (start/stop/error)   │   │
│                                 │                    │                      │   │
│                                 │                    │ SIMULATION_STEP_     │   │
│                                 │                    │ COMPLETED            │   │
│                                 │                    │ (all 3 sim types)    │   │
│                                 │                    └──────────────────────┘   │
└─────────────────────────────────┼───────────────────────────┼────────────────────┘
                                  │                           │
                                  ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER (Subscribers)                              │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         TruthTablePanel                                  │    │
│  │                                                                          │    │
│  │  Subscribes to:                                                          │    │
│  │  • SIMULATION_STEP_COMPLETED ──▶ highlightRowByIndex(cycleIndex)        │    │
│  │  • CIRCUIT_VALIDITY_CHANGED ───▶ show invalid message if !canSimulate   │    │
│  │  • TRUTH_TABLE_COMPUTED ───────▶ refresh() (via coordinator)            │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                            Toolbar                                       │    │
│  │  Subscribes to:                                                          │    │
│  │  • AUTOCYCLE_STATE_CHANGED ────▶ setAutocycleState(state)               │    │
│  │                                  (play/stop button, disable step btns)   │    │
│  │  • SIMULATION_STEP_COMPLETED ──▶ setSimulationProgress(idx, total)      │    │
│  │                                  (step counter "Combination X / Y")      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         CanvasRenderer                                   │    │
│  │  Subscribes to:                                                          │    │
│  │  • CANVAS_REDRAW ─────────────▶ redraw()                                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Deletion Flow (with CircuitTransaction)

```
  User clicks delete on component
           │
           ▼
  ┌────────────────────────────────┐
  │ CanvasOperations               │
  │ .checkDeletionImpact(x, y,     │
  │                  findConnection)│
  │                                │
  │  1. Find component/connection  │
  │  2. Create CircuitTransaction  │
  │  3. transaction.removeXxx()    │
  │  4. transaction.analyze()      │◀──────┐
  └────────────────────────────────┘       │
           │                               │
           ▼                               │
  ┌────────────────────────────────┐       │
  │ CircuitTransaction             │       │
  │                                │       │
  │ • Clone state (simulated)      │       │
  │ • Apply changes to clone       │───────┘
  │ • Analyze impact:              │
  │   - wouldBeValid?              │
  │   - newValidity                │
  │   - affectedComponents         │
  └────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────┐
  │ If simulation running && !wouldBeValid:     │
  │                                             │
  │   Show confirmation dialog                  │
  │        │                                    │
  │        ▼                                    │
  │   On confirm:                               │
  │     1. resetSimulation()                    │
  │     2. transaction.commit() ◀─── Apply ops │
  │     3. simulate()                           │
  │                                             │
  │ Else:                                       │
  │   transaction.commit() directly             │
  └─────────────────────────────────────────────┘
           │
           ▼
  CircuitState updated
           │
           ▼
  BOARD_CHANGED emitted
           │
           ▼
  CircuitValidityManager.revalidate()
           │
           ▼
  CIRCUIT_VALIDITY_CHANGED emitted
           │
           ▼
  All subscribers react (TruthTablePanel, etc.)
```

## Simulation Type 1: Auto-Cycle Flow

```
  User clicks ▶ Simulation button
           │
           ▼
  SimulationController.autocycleStart()
           │
           ├──▶ Validate circuit (via validityManager)
           │
           ├──▶ Calculate totalCombinations = 2^inputCount
           │
           ├──▶ Set state = RUNNING, sync CircuitState.setAutoCycling(true)
           │
           ├──▶ Emit AUTOCYCLE_STATE_CHANGED ────▶ Toolbar.setAutocycleState('running')
           │    { state: 'running' }                (disables step btns, shows ■)
           │
           └──▶ Schedule _executeAutoCycleStep() timer
                     │
                     ▼
  _executeAutoCycleStep() (on each timer tick)
           │
           ├──▶ _applyInputsForIndex(cycleIndex)
           │
           ├──▶ _simulateAndEmit()
           │         │
           │         ├──▶ _restoreFromCacheOrSimulate()
           │         │         │
           │         │         ├──▶ If cache hit: restore component values from cache
           │         │         │
           │         │         └──▶ If cache miss: _simulate() (full simulation)
           │         │
           │         ├──▶ Emit CANVAS_REDRAW ────────────────▶ CanvasRenderer.redraw()
           │         │
           │         └──▶ Emit SIMULATION_STEP_COMPLETED ───▶ TruthTablePanel.highlightRowByIndex()
           │                   { cycleIndex: 3,               Toolbar.setSimulationProgress(3, 8)
           │                     totalCombinations: 8,
           │                     inputValues: [0, 1, 1] }
           │
           ├──▶ Advance cycleIndex, schedule next step
                     │
                     ▼
               (repeats until user clicks ■ to stop)
                     │
                     ▼
  SimulationController.autocycleStop()
           │
           ├──▶ Clear timeout, set state = IDLE
           │
           └──▶ Emit AUTOCYCLE_STATE_CHANGED ────▶ Toolbar.setAutocycleState('stopped')
                { state: 'stopped' }                (enables step btns, shows ▶)
```

## Simulation Type 2: Input Toggle Flow

```
  User clicks INPUT component on canvas
           │
           ▼
  toggleInput(x, y) in circuit-simulator.js
           │
           ├──▶ component.value = 1 - component.value
           │
           └──▶ SimulationController.onToggleInput()
                     │
                     ├──▶ Calculate cycleIndex from current input values
                     │
                     └──▶ _simulateAndEmit()
                               │
                               ├──▶ _restoreFromCacheOrSimulate()
                               │         │
                               │         ├──▶ If cache hit: restore component values
                               │         │
                               │         └──▶ If cache miss: _simulate()
                               │
                               ├──▶ Emit CANVAS_REDRAW ────────────────▶ CanvasRenderer.redraw()
                               │
                               └──▶ Emit SIMULATION_STEP_COMPLETED ───▶ TruthTablePanel.highlightRowByIndex()
                               { cycleIndex: 5,               Toolbar.setSimulationProgress(5, 8)
                                 totalCombinations: 8,
                                 inputValues: [1, 0, 1] }

  NOTE: No AUTOCYCLE_STATE_CHANGED emitted - this is manual input control,
        not auto-cycling lifecycle change.
```

## Simulation Type 3: Manual Step Flow

```
  User clicks ◀ or ▶ step button in toolbar
           │
           ▼
  SimulationController.manualStep(direction)   // direction: -1 or +1
           │
           ├──▶ Validate circuit (via validityManager)
           │
           ├──▶ Initialize if needed: cycleIndex from current inputs
           │
           ├──▶ Calculate new cycleIndex with wrap-around:
           │    cycleIndex = (cycleIndex + direction + total) % total
           │
           ├──▶ _applyInputsForIndex(cycleIndex)
           │
           └──▶ _simulateAndEmit()
                     │
                     ├──▶ _restoreFromCacheOrSimulate()
                     │         │
                     │         ├──▶ If cache hit: restore component values
                     │         │
                     │         └──▶ If cache miss: _simulate()
                     │
                     ├──▶ Emit CANVAS_REDRAW ────────────────▶ CanvasRenderer.redraw()
                     │
                     └──▶ Emit SIMULATION_STEP_COMPLETED ───▶ TruthTablePanel.highlightRowByIndex()
                               { cycleIndex: 2,               Toolbar.setSimulationProgress(2, 8)
                                 totalCombinations: 8,
                                 inputValues: [0, 1, 0] }

  NOTE: No AUTOCYCLE_STATE_CHANGED emitted - manual stepping doesn't
        change auto-cycle state (it's only 'running' or 'stopped').
```

## Event Summary: 3 Simulation Types

| Simulation Type | Trigger | Events Emitted |
|-----------------|---------|----------------|
| Auto-Cycle | ▶/■ button | `AUTOCYCLE_STATE_CHANGED` + `SIMULATION_STEP_COMPLETED` |
| Input Toggle | Click INPUT | `SIMULATION_STEP_COMPLETED` only |
| Manual Step | ◀/▶ step buttons | `SIMULATION_STEP_COMPLETED` only |

**Key insight:** All 3 types emit `SIMULATION_STEP_COMPLETED`, but only Auto-Cycle emits `AUTOCYCLE_STATE_CHANGED`.

### Event Payloads

```javascript
// Emitted by autocycleStart(), autocycleStop(), and on error during auto-cycle
AUTOCYCLE_STATE_CHANGED: {
    state: 'running' | 'stopped' | 'error',
    error?: string  // Only when state === 'error'
}

// Emitted by ALL 3 simulation types
SIMULATION_STEP_COMPLETED: {
    cycleIndex: number,        // Current row in truth table (0-indexed)
    totalCombinations: number, // 2^inputCount
    inputValues: number[]      // Current input values [0, 1, 1]
}
```

## Key Principles

### Declarative Events

Events describe what happened, not what listeners should do:

| ✓ Good (Declarative)           | ✗ Bad (Imperative)              |
|--------------------------------|----------------------------------|
| `SIMULATION_STEP_COMPLETED`    | `UPDATE_TRUTH_TABLE_HIGHLIGHT`   |
| `CIRCUIT_VALIDITY_CHANGED`     | `REFRESH_PANEL`                  |
| `IO_STRUCTURE_CHANGED`         | `REBUILD_TABLE`                  |

### Separation of Concerns

| Module                    | Responsibility                              |
|---------------------------|---------------------------------------------|
| `SimulationController`    | Owns simulation lifecycle (autocycleStart/Stop, manualStep, onToggleInput) |
| `CircuitValidityManager`  | Owns validity state, emits changes          |
| `CanvasOperations`        | Canvas-level component manipulation (place, connect, delete) |
| `BoardOperations`         | Board CRUD operations (save, load, create, delete) |
| `ComponentLibraryOperations` | Custom component library management      |
| `ContextManager`          | Save/load circuit contexts when switching   |
| `TruthTableManager`       | Truth table computation and caching         |
| `AutoSaveManager`         | Event-driven auto-save with debouncing      |
| `CircuitTransaction`      | Predictive analysis before destructive ops  |
| `TruthTablePanel`         | Subscribes to events, decides own response  |

### Transaction Pattern

1. **Create** transaction (clones state)
2. **Apply** operations to clone
3. **Analyze** impact (without side effects)
4. **Show UI** if needed (confirmation dialog)
5. **Commit** (apply to real state) or **abandon**

## File Locations

| Module                    | Path                                        |
|---------------------------|---------------------------------------------|
| `SimulationController`    | `src/core/SimulationController.js`          |
| `CanvasOperations`        | `src/core/CanvasOperations.js`              |
| `BoardOperations`         | `src/core/BoardOperations.js`               |
| `ComponentLibraryOperations` | `src/core/ComponentLibraryOperations.js` |
| `ContextManager`          | `src/core/ContextManager.js`                |
| `TruthTableManager`       | `src/core/TruthTableManager.js`             |
| `AutoSaveManager`         | `src/core/AutoSaveManager.js`               |
| `CircuitValidityManager`  | `src/core/CircuitValidityManager.js`        |
| `CircuitTransaction`      | `src/core/CircuitTransaction.js`            |
| `TruthTablePanel`         | `src/ui/TruthTablePanel.js`                 |
| Event Types               | `src/utils/eventBus.js`                     |

## Related Documentation

- [Architecture Evolution Proposal](./architecture-evolution-proposal.md) - Original design document
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Overall codebase architecture
