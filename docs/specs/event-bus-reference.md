# Event Bus Reference

This document provides a complete reference for all events in the Logic Circuit Simulator's event-driven architecture.

## Quick Reference Table

| Event Name | Conceptual Meaning | Emitters | Subscribers |
|------------|-------------------|----------|-------------|
| [COMPONENT_ADDED](#component_added) | A component was added to the circuit | CircuitState | UndoRedoManager |
| [COMPONENT_REMOVED](#component_removed) | A component was removed from the circuit | CircuitState | UndoRedoManager |
| [COMPONENT_MOVED](#component_moved) | A component's position changed | CircuitState, circuit-simulator | UndoRedoManager |
| [COMPONENT_LABEL_CHANGED](#component_label_changed) | An INPUT/OUTPUT label was renamed | DialogManager | UndoRedoManager, CircuitAnalysisManager |
| [CONNECTION_ADDED](#connection_added) | A wire connection was created | CircuitState | UndoRedoManager |
| [CONNECTION_REMOVED](#connection_removed) | A wire connection was deleted | CircuitState | UndoRedoManager |
| [CONNECTION_START_CHANGED](#connection_start_changed) | User started/finished drawing a wire | CanvasOperations | circuit-simulator |
| [SIMULATION_STEP_COMPLETED](#simulation_step_completed) | One simulation step finished | SimulationController | TruthTablePanel, circuit-simulator |
| [AUTOCYCLE_STATE_CHANGED](#autocycle_state_changed) | Auto-cycle started/stopped | SimulationController | circuit-simulator |
| [BOARD_CHANGED](#board_changed) | Circuit topology changed | CircuitState | AutoSaveManager, CircuitValidityManager, CircuitAnalysisManager |
| [BOARD_LOADED](#board_loaded) | A saved board was loaded | CircuitState, ContextManager | Toolbar, AutoSaveManager, CircuitValidityManager, CircuitAnalysisManager, circuit-simulator |
| [BOARD_WILL_CLEAR](#board_will_clear) | Board is about to be cleared | CircuitState | UndoRedoManager |
| [BOARD_CLEARED](#board_cleared) | Board was completely cleared | CircuitState, BoardOperations, circuit-simulator | AutoSaveManager, CircuitValidityManager, CircuitAnalysisManager, circuit-simulator |
| [TRUTH_TABLE_SHOWN](#truth_table_shown) | Truth table panel became visible | TruthTablePanel | (none) |
| [TRUTH_TABLE_PANEL_STATE_CHANGED](#truth_table_panel_state_changed) | Panel position/size/columns changed | CircuitState | Toolbar, AutoSaveManager |
| [CIRCUIT_ANALYSIS_COMPUTED](#circuit_analysis_computed) | Truth table computation finished (valid circuits only) | CircuitAnalysisManager | TruthTablePanel |
| [CIRCUIT_ANALYSIS_COMPUTING](#circuit_analysis_computing) | Progress update during computation | CircuitAnalysisManager | TruthTablePanel |
| [CIRCUIT_VALIDITY_CHANGED](#circuit_validity_changed) | Circuit validity state changed | CircuitValidityManager | SimulationController, TruthTablePanel |
| [IO_STRUCTURE_CHANGED](#io_structure_changed) | Number of inputs/outputs changed | CircuitValidityManager | SimulationController |
| [THEME_CHANGED](#theme_changed) | Dark/light mode toggled | ThemeManager | AutoSaveManager |
| [UNDO_REDO_STATE_CHANGED](#undo_redo_state_changed) | Undo/redo availability changed | UndoRedoManager | Toolbar |
| [DRAG_STARTED](#drag_started) | User started dragging a component | ComponentDragger | UndoRedoManager |
| [DRAG_ENDED](#drag_ended) | User released a dragged component | ComponentDragger | UndoRedoManager |
| [MODE_EXIT_REQUEST](#mode_exit_request) | User requested to exit current mode | CanvasInteraction | circuit-simulator |
| [TOOLBAR_UPDATE_DISPLAYS](#toolbar_update_displays) | Toolbar needs refresh | ComponentLibraryOperations, BoardOperations, AutoSaveManager, ContextManager | circuit-simulator |
| [CANVAS_REDRAW](#canvas_redraw) | Canvas needs repainting | CanvasOperations, SimulationController, BoardOperations, ContextManager | circuit-simulator |

---

## Component Events

### COMPONENT_ADDED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A new component (gate, input, output) was added to the circuit |
| **Payload** | `{ component }` |
| **Emitters** | `CircuitState.addComponent()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures snapshot for undo history |

---

### COMPONENT_REMOVED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A component was removed from the circuit |
| **Payload** | `{ componentId, component }` |
| **Emitters** | `CircuitState.removeComponent()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures snapshot for undo history |

---

### COMPONENT_MOVED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A component's position on the canvas changed |
| **Payload** | `{ component, oldState, updates }` |
| **Emitters** | `CircuitState.updateComponent()` in [src/core/CircuitState.js](src/core/CircuitState.js), `moveComponent()` in [circuit-simulator.js](circuit-simulator.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures position changes for undo history |

---

### COMPONENT_LABEL_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | An INPUT or OUTPUT component's label was renamed by the user |
| **Payload** | `{ component, oldLabel, newLabel }` |
| **Emitters** | `DialogManager.showRenameDialog()` callback in [src/ui/DialogManager.js](src/ui/DialogManager.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — tracks renames for undo; `CircuitAnalysisManager._handleLabelChanged()` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) — updates truth table column headers |

---

## Connection Events

### CONNECTION_ADDED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A wire connection was created between two component ports |
| **Payload** | `{ connection }` |
| **Emitters** | `CircuitState.addConnection()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures connection for undo history |

---

### CONNECTION_REMOVED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A wire connection was deleted |
| **Payload** | `{ connection }` |
| **Emitters** | `CircuitState.removeConnection()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures removal for undo history |

---

### CONNECTION_START_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | User started or finished drawing a wire (between selecting first and second port) |
| **Payload** | `true` (connection in progress) or `false` (connection completed/cancelled) |
| **Emitters** | `CanvasOperations.handleConnect()` in [src/core/CanvasOperations.js](src/core/CanvasOperations.js) |
| **Subscribers** | Event handler in [circuit-simulator.js](circuit-simulator.js) — updates toolbar to show connection status |

---

## Simulation Events

### SIMULATION_STEP_COMPLETED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | One simulation step completed (auto-cycle, manual step, or input toggle) |
| **Payload** | `{ cycleIndex, totalCombinations, inputValues }` |
| **Emitters** | `SimulationController._simulateAndEmit()` in [src/core/SimulationController.js](src/core/SimulationController.js) |
| **Subscribers** | `TruthTablePanel` in [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) — highlights current row in truth table; Event handler in [circuit-simulator.js](circuit-simulator.js) — updates step counter display |

---

### AUTOCYCLE_STATE_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Auto-cycle simulation started, stopped, or encountered an error |
| **Payload** | `{ state: 'running' \| 'stopped' \| 'error', error?: string }` |
| **Emitters** | `SimulationController._emitAutocycleStateChanged()` in [src/core/SimulationController.js](src/core/SimulationController.js) |
| **Subscribers** | Event handler in [circuit-simulator.js](circuit-simulator.js) — toggles play/pause button state and enables/disables step buttons |

---

## Board Events

### BOARD_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Circuit topology changed (component/connection added, removed, or moved) |
| **Payload** | None |
| **Emitters** | `CircuitState.addComponent()`, `removeComponent()`, `updateComponent()`, `clearComponents()`, `addConnection()`, `removeConnection()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `AutoSaveManager` in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js) — triggers debounced auto-save; `CircuitValidityManager` in [src/core/CircuitValidityManager.js](src/core/CircuitValidityManager.js) — revalidates circuit; `CircuitAnalysisManager` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) — triggers debounced truth table recomputation |

---

### BOARD_LOADED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | A saved board was loaded or "revert to saved" was performed |
| **Payload** | `{ state }` (the loaded state object) |
| **Emitters** | `CircuitState.loadState()` in [src/core/CircuitState.js](src/core/CircuitState.js), `ContextManager.loadBoard()` in [src/core/ContextManager.js](src/core/ContextManager.js) |
| **Subscribers** | `Toolbar` in [src/ui/Toolbar.js](src/ui/Toolbar.js) — updates revert button state; `AutoSaveManager` in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js) — triggers auto-save; `CircuitValidityManager` in [src/core/CircuitValidityManager.js](src/core/CircuitValidityManager.js) — revalidates loaded circuit; `CircuitAnalysisManager` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) — recomputes truth table; Event handler in [circuit-simulator.js](circuit-simulator.js) — destroys old truth table panel and restores if it was visible |

---

### BOARD_WILL_CLEAR

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Board is about to be cleared (emitted BEFORE clearing) |
| **Payload** | `{}` (empty) |
| **Emitters** | `CircuitState.clearComponents()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — captures full snapshot before board is cleared for undo capability |

---

### BOARD_CLEARED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Board was completely cleared of all components and connections |
| **Payload** | None |
| **Emitters** | `CircuitState.clearComponents()` in [src/core/CircuitState.js](src/core/CircuitState.js), `BoardOperations.clearBoard()` in [src/core/BoardOperations.js](src/core/BoardOperations.js), `_clearBoardInternal()` in [circuit-simulator.js](circuit-simulator.js) |
| **Subscribers** | `AutoSaveManager` in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js) — saves cleared state immediately; `CircuitValidityManager` in [src/core/CircuitValidityManager.js](src/core/CircuitValidityManager.js) — revalidates (now empty); `CircuitAnalysisManager` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) — clears analysis; Event handler in [circuit-simulator.js](circuit-simulator.js) — destroys truth table panel and clears its state |

---

## Truth Table Events

### TRUTH_TABLE_SHOWN

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Truth table panel became visible |
| **Payload** | None |
| **Emitters** | `TruthTablePanel.show()` in [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) |
| **Subscribers** | None currently |

---

### TRUTH_TABLE_PANEL_STATE_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Truth table panel position, size, or column arrangement changed |
| **Payload** | `{ state }` (panel state object with position, size, column order, visibility) |
| **Emitters** | `CircuitState.setTruthTablePanelState()` in [src/core/CircuitState.js](src/core/CircuitState.js) |
| **Subscribers** | `Toolbar` in [src/ui/Toolbar.js](src/ui/Toolbar.js) — updates revert button state; `AutoSaveManager` in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js) — triggers debounced auto-save |

---

## Circuit Analysis Events

### CIRCUIT_ANALYSIS_COMPUTED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Truth table computation finished for a **valid** circuit |
| **Payload** | `analysis` (complete circuit analysis object with inputs, outputs, and truth table; guaranteed `isValid === true`) |
| **Emitters** | `CircuitAnalysisManager._handleComputationResult()`, `_handleLabelChanged()` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) |
| **Subscribers** | `TruthTablePanel` in [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) — updates Tabulator table with new analysis data |

**Important:** This event only fires when `result.isValid === true`. Invalid circuits are handled by `CIRCUIT_VALIDITY_CHANGED` instead. This separation ensures:
- No redundant invalid-state handling in subscribers
- `CIRCUIT_VALIDITY_CHANGED` provides immediate UI feedback for invalid circuits
- `CIRCUIT_ANALYSIS_COMPUTED` always delivers usable truth table data

---

### CIRCUIT_ANALYSIS_COMPUTING

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Progress update during asynchronous truth table computation |
| **Payload** | `{ current: number, total: number, percent: number }` |
| **Emitters** | `CircuitAnalysisManager.computeCircuitAnalysisAsync()` in [src/core/CircuitAnalysisManager.js](src/core/CircuitAnalysisManager.js) |
| **Subscribers** | `TruthTablePanel` in [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) — displays progress bar during computation |

---

## Circuit Validity Events

### CIRCUIT_VALIDITY_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Circuit validity state changed (e.g., incomplete → valid, or valid → incomplete) |
| **Payload** | `{ from, to, canSimulate, reason, inputs, outputs, isValid }` |
| **Emitters** | `CircuitValidityManager.revalidate()` in [src/core/CircuitValidityManager.js](src/core/CircuitValidityManager.js) |
| **Subscribers** | `SimulationController` in [src/core/SimulationController.js](src/core/SimulationController.js) — handles validity changes during simulation (error recovery); `TruthTablePanel` in [src/ui/TruthTablePanel.js](src/ui/TruthTablePanel.js) — **primary handler** for invalid states, shows invalid message when circuit becomes incomplete |

**Important:** This is the **primary handler** for invalid circuit states. When `canSimulate === false`:
- `TruthTablePanel._handleValidityChanged()` immediately renders the invalid state message
- `CIRCUIT_ANALYSIS_COMPUTED` will NOT fire (it only fires for valid circuits)
- This provides immediate UI feedback without waiting for debounced computation

---

### IO_STRUCTURE_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Number of inputs or outputs changed |
| **Payload** | `{ previousInputCount, previousOutputCount, newInputCount, newOutputCount, inputs, outputs }` |
| **Emitters** | `CircuitValidityManager._hasStructureChanged()` in [src/core/CircuitValidityManager.js](src/core/CircuitValidityManager.js) |
| **Subscribers** | `SimulationController` in [src/core/SimulationController.js](src/core/SimulationController.js) — resets simulation when inputs/outputs change |

---

## Theme Events

### THEME_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | User toggled dark/light mode |
| **Payload** | `{ isDarkMode: boolean }` |
| **Emitters** | `ThemeManager.applyTheme()` in [src/ui/ThemeManager.js](src/ui/ThemeManager.js) |
| **Subscribers** | `AutoSaveManager` in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js) — triggers auto-save (theme preference persisted) |

---

## Undo/Redo Events

### UNDO_REDO_STATE_CHANGED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Undo/redo availability changed (stacks updated) |
| **Payload** | `{ canUndo: boolean, canRedo: boolean }` |
| **Emitters** | `UndoRedoManager._emitStateChanged()` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) |
| **Subscribers** | `Toolbar` in [src/ui/Toolbar.js](src/ui/Toolbar.js) — enables/disables undo/redo buttons based on stack availability |

---

## Interaction Events

### DRAG_STARTED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | User started dragging a component (movement exceeded threshold) |
| **Payload** | `{ component }` |
| **Emitters** | `ComponentDragger.handleMouseMove()` in [src/interaction/ComponentDragger.js](src/interaction/ComponentDragger.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — starts coalescing mode to batch multiple move events into single undo step |

---

### DRAG_ENDED

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | User released a dragged component |
| **Payload** | `{ component }` |
| **Emitters** | `ComponentDragger.handleMouseUp()` in [src/interaction/ComponentDragger.js](src/interaction/ComponentDragger.js) |
| **Subscribers** | `UndoRedoManager` in [src/core/UndoRedoManager.js](src/core/UndoRedoManager.js) — ends coalescing mode and saves single snapshot for the entire drag operation |

---

## Mode Events

### MODE_EXIT_REQUEST

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | User requested to exit current mode (via right-click) |
| **Payload** | None |
| **Emitters** | `CanvasInteraction.handleContextMenu()` in [src/interaction/CanvasInteraction.js](src/interaction/CanvasInteraction.js) |
| **Subscribers** | Event handler in [circuit-simulator.js](circuit-simulator.js) — exits current mode and returns to neutral mode |

---

## Toolbar Events

### TOOLBAR_UPDATE_DISPLAYS

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Toolbar needs to refresh its displays (component list, board list) |
| **Payload** | None |
| **Emitters** | `ComponentLibraryOperations.saveComponent()`, `deleteComponent()`, `importComponent()` in [src/core/ComponentLibraryOperations.js](src/core/ComponentLibraryOperations.js); `AutoSaveManager.saveBoardState()` callback in [src/core/AutoSaveManager.js](src/core/AutoSaveManager.js); `BoardOperations.loadBoard()`, `createNewBoard()`, `revertToSaved()`, `deleteBoard()` in [src/core/BoardOperations.js](src/core/BoardOperations.js); `ContextManager.loadBoard()` in [src/core/ContextManager.js](src/core/ContextManager.js) |
| **Subscribers** | Event handler in [circuit-simulator.js](circuit-simulator.js) — calls toolbar's `updateCustomComponentsList()` and `updateBoardsList()` |

---

## Canvas Events

### CANVAS_REDRAW

| Aspect | Details |
|--------|---------|
| **Conceptual Meaning** | Canvas needs repainting (imperative redraw request) |
| **Payload** | None |
| **Emitters** | `CanvasOperations.placeComponent()`, `handleConnect()`, `handleDelete()` in [src/core/CanvasOperations.js](src/core/CanvasOperations.js); `SimulationController.onToggleInput()`, `_scheduleNextStep()` in [src/core/SimulationController.js](src/core/SimulationController.js); `BoardOperations.clearBoard()`, `loadBoard()`, `revertToSaved()` in [src/core/BoardOperations.js](src/core/BoardOperations.js); `ContextManager.loadBoard()` in [src/core/ContextManager.js](src/core/ContextManager.js) |
| **Subscribers** | Event handler in [circuit-simulator.js](circuit-simulator.js) — calls `redraw()` to update canvas rendering |

**Note:** This is an imperative event (commands what to do) rather than declarative (describes what happened). Per the architecture guidelines, it should ideally be replaced with declarative state-change events.

---

## Reserved/Unused Events

The following events are defined in `EVENT_TYPES` but not currently emitted or subscribed:

| Event Name | Reserved Purpose |
|------------|------------------|
| SIMULATION_RUN | Legacy - replaced by SIMULATION_STEP_COMPLETED |
| SIMULATION_COMPLETED | Legacy - replaced by SIMULATION_STEP_COMPLETED |
| SIMULATION_RESET | Legacy - replaced by new simulation controller events |
| TRUTH_TABLE_HIDDEN | For when truth table panel is closed |
| TRUTH_TABLE_GENERATE | For triggering truth table generation externally |
| BOARD_DELETED | For when a board is deleted from storage |
| BOARD_SAVE | For when a board is saved |
| CIRCUIT_CLEARED | Superseded by BOARD_CLEARED |
| DELETION_PROPOSED | For deletion confirmation flow |
| DELETION_CONFIRMED | For deletion confirmation flow |
| DELETION_CANCELLED | For deletion confirmation flow |

---

## Answer to Original Question

**When an input button is toggled, which event is fired?**

When a user clicks an INPUT component to toggle its value:

1. `SimulationController.onToggleInput()` is called
2. The input's value is toggled (0→1 or 1→0)
3. The circuit is simulated with the new input values
4. **`SIMULATION_STEP_COMPLETED`** is emitted with payload `{ cycleIndex, totalCombinations, inputValues }`
5. **`CANVAS_REDRAW`** is emitted to update the visual state

The `SIMULATION_STEP_COMPLETED` event allows the truth table panel to highlight the current row matching the input combination.
