# Architecture Guide

This document describes the modular architecture of the Logic Circuit Simulator after the refactoring from a monolithic codebase.

## Overview

The application follows an **event-driven modular architecture** with clear separation of concerns:

```
src/
├── core/               # Pure simulation logic (no DOM/Canvas)
├── rendering/          # Canvas drawing (no logic)
├── interaction/        # Canvas mouse/keyboard events
├── ui/                 # Non-canvas UI components
├── storage/            # Persistence layer
├── utils/              # Pure utility functions
├── constants.js        # Configuration values
└── main.js             # Application entry (loads circuit-simulator.js)

circuit-simulator.js    # Main application coordinator
```

## Core Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Event-Driven Communication**: Modules communicate via event bus, not direct calls
3. **Pure Functions**: Core logic is testable without DOM dependencies
4. **Single Source of Truth**: All state lives in `CircuitState`
5. **Explicit State Ownership**: Cross-layer state has documented ownership (see State Ownership section)

## Module Breakdown

### Core (`src/core/`)

Pure business logic with no DOM or Canvas dependencies.

| File | Purpose | Key Exports |
|------|---------|-------------|
| `CircuitState.js` | State container for all circuit data | `CircuitState` class |
| `CanvasOperations.js` | Canvas-level component manipulation | `CanvasOperations` class |
| `BoardOperations.js` | Board CRUD operations | `BoardOperations` class |
| `ComponentLibraryOperations.js` | Custom component library management | `ComponentLibraryOperations` class |
| `ContextManager.js` | Save/load circuit contexts (boards vs components) | `ContextManager` class |
| `CircuitAnalysisManager.js` | Circuit analysis computation and caching | `CircuitAnalysisManager` class |
| `AutoSaveManager.js` | Event-driven auto-save with debouncing | `AutoSaveManager` class |
| `CircuitValidityManager.js` | Single source of truth for circuit validity | `CircuitValidityManager`, `VALIDITY_STATES` |
| `SimulationController.js` | Simulation lifecycle management | `SimulationController`, `SIMULATION_STATES` |
| `CircuitTransaction.js` | Predictive analysis for destructive operations | `CircuitTransaction` |
| `circuitEvaluator.js` | Circuit simulation engine | `simulateCircuit()` |
| `gateLogic.js` | Gate truth tables | `evaluateGate()` |

#### CircuitState

Central state container using the **Single Source of Truth** pattern:

```javascript
// State properties
state.getComponents()        // Array of component objects
state.getConnections()       // Array of connection objects
state.getMode()              // 'place' | 'connect' | 'delete'
state.getSelectedTool()      // Current tool (e.g., 'AND', 'OR')
state.getCurrentBoardName()  // Name of loaded board
state.getCustomComponents()  // Saved custom component definitions

// State changes emit events
state.addComponent(component)  // Emits COMPONENT_ADDED, BOARD_CHANGED
state.setMode('connect')       // Emits mode:changed
```

#### CanvasOperations

Handles canvas-level component manipulation (placement, connection, deletion).

```javascript
const canvasOperations = new CanvasOperations({
    state,
    callbacks: {
        defineComponentPorts: (component) => { /* ... */ },
        findComponent: (x, y) => { /* ... */ },
        findPort: (x, y) => { /* ... */ }
    }
});

canvasOperations.placeComponent(x, y, 'AND');
canvasOperations.handleConnect(x, y);
canvasOperations.handleDelete(x, y, findConnection, options);
canvasOperations.checkDeletionImpact(x, y, findConnection);
```

#### BoardOperations

Handles board CRUD operations (save, load, create, delete, revert).

```javascript
const boardOperations = new BoardOperations({
    state,
    boardManager,
    contextManager
});

await boardOperations.saveCurrentBoard('MyBoard');  // Updates lastSavedState
await boardOperations.loadBoard('MyBoard');
boardOperations.createNewBoard(showSaveOptionsDialog, onCreated);  // Sets lastSavedState to null
boardOperations.revertToSaved();  // Restores from lastSavedState
await boardOperations.deleteBoard('MyBoard');
```

#### ComponentLibraryOperations

Manages custom component library (save, load, delete, export, import).

```javascript
const componentLibraryOperations = new ComponentLibraryOperations({
    state,
    componentLibrary,
    contextManager
});

await componentLibraryOperations.saveComponent('HalfAdder', 'A half adder circuit');
await componentLibraryOperations.loadComponentForEditing('HalfAdder');
await componentLibraryOperations.deleteComponent('HalfAdder');
await componentLibraryOperations.exportComponent('HalfAdder');
await componentLibraryOperations.importComponent(fileEvent);
```

#### ContextManager

Handles save/load of circuit contexts when switching between boards and components.

```javascript
const contextManager = new ContextManager({
    state,
    boardManager,
    componentLibrary,
    circuitAnalysisManager
});

await contextManager.saveCurrentContext();  // Save before switching
contextManager.loadCircuitContext(circuitData, { type: 'board', name: 'MyBoard' });
```

#### CircuitAnalysisManager

Manages circuit analysis computation with debouncing. Subscribes to BOARD_CHANGED events.

**Event semantics:** Emits `CIRCUIT_ANALYSIS_COMPUTED` only for **valid** circuits (`isValid === true`).
Invalid circuits are handled by `CIRCUIT_VALIDITY_CHANGED` (emitted by CircuitValidityManager).

```javascript
const circuitAnalysisManager = new CircuitAnalysisManager({ state });

circuitAnalysisManager.recomputeAnalysis();  // Manual recompute
circuitAnalysisManager.destroy();             // Cleanup event listeners
```

#### AutoSaveManager

Event-driven auto-save with debouncing. Subscribes to BOARD_CHANGED, TRUTH_TABLE_PANEL_STATE_CHANGED, etc.
Persists both working state and `lastSavedState` for revert functionality.

```javascript
const autoSaveManager = new AutoSaveManager({
    state,
    storage: storageAdapter
});

autoSaveManager.setupAutoSave();    // Start listening to events
autoSaveManager.clearAutoSave();    // Stop auto-save
await autoSaveManager.saveBoardState();   // Saves working + lastSavedState
await autoSaveManager.loadBoardState();   // Restores both, handles migration
await autoSaveManager.clearBoardState();  // Removes all persisted state
```

**Data structure persisted:**
```javascript
{
  // Working state (updated on every change)
  components, connections, nextId, customComponents,
  truthTablePanelState, currentBoardName, currentComponentName,
  // Base state for revert (updated only on explicit save/load)
  lastSavedState: { components, connections, nextId, truthTablePanelState } | null
}
```

#### CircuitValidityManager

Owns circuit validity state and emits declarative events when validity changes:

```javascript
const validityManager = new CircuitValidityManager(circuitState);

// Check validity
validityManager.canSimulate()  // true if circuit can be simulated
validityManager.getValidity()  // { state: 'valid'|'incomplete'|'empty', reason: string|null }

// Revalidate after changes (called automatically via BOARD_CHANGED)
validityManager.revalidate()   // Emits CIRCUIT_VALIDITY_CHANGED if state changed

// Predictive validation (used by CircuitTransaction)
validityManager.wouldBeValidAfter(components, connections)
```

#### SimulationController

Owns simulation lifecycle with state machine (IDLE → RUNNING).
This is the **primary simulation controller** used by the main application (`circuit-simulator.js`).
Automatically syncs with `CircuitState.setAutoCycling()` for backward compatibility.

```javascript
const controller = new SimulationController({
    circuitState,
    validityManager
});

// Auto-cycling control
controller.autocycleStart()  // Begin auto-cycling through combinations
controller.autocycleStop()   // Stop and return to IDLE

// Manual stepping (prev/next buttons)
controller.manualStep(1)     // Step forward one combination
controller.manualStep(-1)    // Step backward one combination

// Input toggle (when user clicks INPUT component)
controller.onToggleInput()   // Simulate after manual input toggle

// Reset
controller.reset()           // Reset all inputs to 0

// State queries
controller.isRunning()       // true if auto-cycling
controller.getState()        // { state, cycleIndex, totalCombinations }
```

#### CircuitTransaction

Enables predictive analysis before committing destructive changes:

```javascript
const transaction = new CircuitTransaction(circuitState, validityManager);

// Stage changes (doesn't affect real state)
transaction.removeComponent(componentId);
transaction.removeConnection(connectionIndex);

// Analyze impact
const impact = transaction.analyze();
// { wouldBeValid: boolean, newValidity: {...}, affectedComponents: [...] }

// Commit or abandon
if (userConfirmed) {
    transaction.commit();  // Apply to real state
}
// Otherwise transaction is garbage collected
```

### Rendering (`src/rendering/`)

Canvas drawing with no simulation logic.

| File | Purpose |
|------|---------|
| `CanvasRenderer.js` | Main renderer coordinator |
| `GridRenderer.js` | Draw grid background |
| `ComponentRenderer.js` | Draw gates, I/O, custom components |
| `ConnectionRenderer.js` | Draw wires |

The renderer subscribes to `CANVAS_REDRAW` events:

```javascript
eventBus.on(EVENT_TYPES.CANVAS_REDRAW, () => {
    canvasRenderer.draw();
});
```

### Interaction (`src/interaction/`)

Handles all canvas user input.

| File | Purpose |
|------|---------|
| `CanvasInteraction.js` | Click, drag, zoom handlers |
| `ComponentDragger.js` | Drag-and-drop state management |

Interaction layer emits semantic events instead of calling methods directly:

```javascript
// Instead of: simulator.placeComponent(x, y, type)
eventBus.emit(EVENT_TYPES.COMPONENT_PLACE, { x, y, type });
```

### UI (`src/ui/`)

Non-canvas UI components using modern libraries.

| File | Purpose | Library |
|------|---------|---------|
| `TruthTablePanel.js` | Truth table display (see TruthTablePanel section below) | Tabulator |
| `Toolbar.js` | Toolbar state and buttons | - |
| `DialogManager.js` | All dialog boxes | - |
| `DialogFactory.js` | Programmatic dialog creation | - |
| `ThemeManager.js` | Dark mode toggle | - |
| `messages.js` | Centralized UI strings | - |

#### TruthTablePanel Architecture

> **Before modifying TruthTablePanel**, read [Truth Table Guidelines](docs/TRUTH_TABLE_GUIDELINES.md)

The TruthTablePanel is organized into clearly delineated sections:

| Section | Purpose |
|---------|---------|
| Constructor & Initialization | Property init, `init()` method for explicit lifecycle setup |
| Event Handling | Subscribes to `SIMULATION_STEP_COMPLETED`, `CIRCUIT_VALIDITY_CHANGED`, etc. |
| Progress UI | Shows progress bar during async computation |
| Visibility & Lifecycle | `show()`, `hide()`, `destroy()` methods |
| Data Management | `_setCircuitAnalysisLocalCopy()` loads data from CircuitState cache |
| Table Rendering | `_renderTabulator()` (async), `_renderInvalidState()`, `_renderComputingState()` |
| Row Highlighting | `_updateHighlight()`, `_highlightRowByIndex()` |
| Layout & Sizing | `_applyTableWidth()`, `_applyTableHeight()`, `_reapplyRowHeights()` |
| Drag & Resize | Interact.js integration for draggable/resizable panel |
| State Persistence | `_saveState()`, `setState()`, `getState()` |

**Public API (external callers):**
- `init(savedState)`, `show()`, `hide()`, `destroy()`, `refresh()`, `getState()`, `setState(state)`, `onStateChange`

**Private Methods (internal implementation, prefixed with `_`):**
- `_setCircuitAnalysisLocalCopy()`, `_renderTabulator()`, `_saveState()`, `_restoreState()`, `_setupInteractions()`, `_updateHighlight()`, etc.
- **Helper methods (DRY refactoring):** `_positionPanelIfNeeded()`, `_deepCopyAnalysis()`, `_applyRowStyles()`

**Lifecycle Pattern:**
```
Constructor → init(savedState) → show() → _renderTabulator() → hide() → destroy()
```

**async/await pattern:** `show()`, `_handleComputed()`, and `refresh()` are async methods.
`_renderTabulator()` returns a `Promise<void>` that resolves when Tabulator's `tableBuilt` event fires.

**Extracted Pure Functions:**
The following utilities were extracted to `src/utils/truthTableUtils.js` for testability:

| Section | Functions |
|---------|-----------|
| Column Definitions | `buildTruthTableColumns()` |
| Table Layout | `calculateRowLayout()`, `calculateTableLayout()`, `MIN_ROW_HEIGHT`, `MAX_ROW_HEIGHT`, `CONTENT_HEIGHT` |
| Panel Bounds | `clampPanelPosition()`, `clampDimension()`, `sanitizePosition()` |
| Row Search | `inputValuesToIndex()`, `indexToInputValues()` |

### Storage (`src/storage/`)

Persistence layer with abstract interface.

| File | Purpose |
|------|---------|
| `StorageAdapter.js` | Abstract storage interface |
| `LocalStorageAdapter.js` | localStorage implementation |
| `BoardManager.js` | Board save/load operations |
| `ComponentLibrary.js` | Custom component management |

The adapter pattern allows swapping storage backends:

```javascript
// Currently using localStorage
const storage = new LocalStorageAdapter();

// Could swap to IndexedDB, remote API, etc.
const storage = new IndexedDBAdapter();

const boardManager = new BoardManager(storage);
```

### Utils (`src/utils/`)

Pure utility functions with no side effects.

| File | Purpose |
|------|---------|
| `eventBus.js` | Event emitter singleton + EVENT_TYPES |
| `geometry.js` | Distance, bounding box, overlap calculations |
| `positioning.js` | Smart panel positioning |
| `serialization.js` | JSON export/import, validation |
| `svgIcons.js` | SVG icon strings |
| `truthTableUtils.js` | Truth table panel utilities (columns, layout, bounds, search) |

## Event Bus

The event bus is the primary communication mechanism between modules.

### Event Types

Events are **declarative** - they describe what happened, not what listeners should do.
This enables loose coupling where emitters don't know who's listening.

```javascript
import { eventBus, EVENT_TYPES } from './utils/eventBus.js';

// Component lifecycle
EVENT_TYPES.COMPONENT_ADDED       // { component }
EVENT_TYPES.COMPONENT_REMOVED     // { componentId, component }
EVENT_TYPES.COMPONENT_MOVED       // { component, oldX, oldY }

// Connections
EVENT_TYPES.CONNECTION_ADDED      // { connection }
EVENT_TYPES.CONNECTION_REMOVED    // { connection }

// Circuit validity (declarative)
EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED  // { from, to, canSimulate, reason, inputs, outputs }
EVENT_TYPES.IO_STRUCTURE_CHANGED      // { previousInputCount, newInputCount, previousOutputCount, newOutputCount }

// Simulation lifecycle (declarative)
EVENT_TYPES.SIMULATION_STARTED        // { cycleIndex, totalCombinations, inputValues }
EVENT_TYPES.SIMULATION_STOPPED        // { cycleIndex, totalCombinations }
EVENT_TYPES.SIMULATION_PAUSED         // { reason, cycleIndex, canResume }
EVENT_TYPES.SIMULATION_STEP_COMPLETED // { cycleIndex, totalCombinations, inputValues }
EVENT_TYPES.SIMULATION_STATE_CHANGED  // { isRunning, currentIndex, totalCombinations }

// Board operations
EVENT_TYPES.BOARD_SAVE            // { boardName }
EVENT_TYPES.BOARD_LOADED          // { boardName }
EVENT_TYPES.BOARD_CHANGED         // {}
EVENT_TYPES.BOARD_CLEARED         // {}

// Truth table
EVENT_TYPES.TRUTH_TABLE_COMPUTED  // { table, inputs, outputs }

// UI updates
EVENT_TYPES.CANVAS_REDRAW         // {}
EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS // {}
```

### Declarative vs Imperative Events

| ✓ Good (Declarative)           | ✗ Bad (Imperative)              |
|--------------------------------|----------------------------------|
| `SIMULATION_STEP_COMPLETED`    | `UPDATE_TRUTH_TABLE_HIGHLIGHT`   |
| `CIRCUIT_VALIDITY_CHANGED`     | `REFRESH_PANEL`                  |
| `IO_STRUCTURE_CHANGED`         | `REBUILD_TABLE`                  |

**Why declarative events matter:**
- **Decoupling**: Emitters don't know or care who's listening
- **Extensibility**: New components subscribe without modifying emitters
- **Testability**: Events describe state changes, easy to verify
- **Single responsibility**: Each listener decides its own response

### Usage Pattern

```javascript
// Subscribe
const handler = (data) => console.log('Component added:', data);
eventBus.on(EVENT_TYPES.COMPONENT_ADDED, handler);

// Emit
eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component });

// Unsubscribe
eventBus.off(EVENT_TYPES.COMPONENT_ADDED, handler);

// One-time subscription
eventBus.once(EVENT_TYPES.BOARD_LOADED, (data) => { /* ... */ });
```

## Data Flow

### Component Placement

```
User clicks canvas
    ↓
CanvasInteraction.handleClick()
    ↓
CanvasOperations.placeComponent(x, y, type)
    ↓
CircuitState.addComponent(component)
    ↓
eventBus.emit(COMPONENT_ADDED)
eventBus.emit(BOARD_CHANGED)
    ↓
CanvasRenderer.draw() [subscribes to CANVAS_REDRAW]
```

### Simulation (Auto-Cycle)

```
User clicks "Play"
    ↓
SimulationController.autocycleStart()
    ↓
Validate circuit (via validityManager)
    ↓
Set state = RUNNING, sync CircuitState.setAutoCycling(true)
    ↓
eventBus.emit(AUTOCYCLE_STATE_CHANGED)  ──▶ Toolbar.setAutocycleState('running')
    ↓
Schedule _executeAutoCycleStep() timer
    ↓
[On each timer tick]
    ↓
_executeAutoCycleStep()
    ↓
_applyInputsForIndex(cycleIndex)
    ↓
_simulateAndEmit()
    ↓
eventBus.emit(CANVAS_REDRAW)  ──▶ CanvasRenderer.redraw()
eventBus.emit(SIMULATION_STEP_COMPLETED)  ──▶ TruthTablePanel._highlightRowByIndex()
                                              Toolbar.setSimulationProgress()
```

### Input Toggle

```
User clicks on INPUT component
    ↓
toggleInput(x, y)
    ↓
component.value = 1 - component.value
    ↓
SimulationController.onToggleInput()
    ↓
Calculate cycleIndex from current input values
    ↓
_simulateAndEmit()
    ↓
eventBus.emit(CANVAS_REDRAW)  ──▶ CanvasRenderer.redraw()
eventBus.emit(SIMULATION_STEP_COMPLETED)  ──▶ TruthTablePanel._highlightRowByIndex()
                                              Toolbar.setSimulationProgress()
```

### Deletion with Transaction

```
User clicks delete on component
    ↓
CanvasOperations.checkDeletionImpact(x, y, findConnection)
    ↓
Create CircuitTransaction
    ↓
transaction.removeComponent(id)
transaction.analyze()  ──▶ { wouldBeValid, newValidity, affectedComponents }
    ↓
If simulation running && !wouldBeValid:
    ↓
    Show confirmation dialog
    ↓
    On confirm: transaction.commit()
Else:
    transaction.commit() directly
    ↓
CircuitState updated
    ↓
eventBus.emit(BOARD_CHANGED)
    ↓
CircuitValidityManager.revalidate()
    ↓
eventBus.emit(CIRCUIT_VALIDITY_CHANGED)  ──▶ All subscribers react
```

### Board Save/Load

```
User clicks "Save Board"
    ↓
DialogManager.showSaveDialog()
    ↓
BoardOperations.saveCurrentBoard(name)
    ↓
BoardManager.saveBoard(name, data)
    ↓
LocalStorageAdapter.setItem(key, data)
```

## Component Object Structure

```javascript
{
    id: 1,                    // Unique identifier
    type: 'AND',              // 'INPUT'|'OUTPUT'|'AND'|'OR'|'NOT'|'XOR'|'NAND'|'NOR'|'XNOR'|'CUSTOM'
    x: 200,                   // X position (grid-snapped)
    y: 150,                   // Y position (grid-snapped)
    value: null,              // Current output value (0, 1, or null)
    label: 'A',               // Label (for INPUT/OUTPUT)
    inputs: [null, null],     // Input values array
    inputPorts: [{x, y}, ...],  // Input port positions
    outputPorts: [{x, y}, ...], // Output port positions

    // For CUSTOM components only:
    customName: 'HalfAdder',
    customDefinition: { /* internal circuit */ }
}
```

## Connection Object Structure

```javascript
{
    from: 1,        // Source component ID
    fromPort: 0,    // Source output port index
    to: 3,          // Target component ID
    toPort: 1       // Target input port index
}
```

## Testing Strategy

### Unit Tests (`tests/unit/`)

Test pure functions and isolated classes:

```javascript
// tests/unit/core/gateLogic.test.js
describe('AND gate', () => {
    it('should return 1 when both inputs are 1', () => {
        expect(evaluateGate('AND', [1, 1])).toBe(1);
    });
});
```

### Integration Tests (`tests/integration/`)

Test multiple modules working together:

```javascript
// tests/integration/full-workflow.test.js
describe('Full Circuit Workflow', () => {
    it('should simulate a half adder correctly', () => {
        // Create components, connect them, simulate
    });
});
```

### Test Coverage Goals

| Category | Target | Status |
|----------|--------|--------|
| Core logic | 100% | ✅ |
| Storage | 100% | ✅ |
| Utils | 80%+ | ✅ |
| Rendering | n/a | Visual testing |
| UI | n/a | Manual testing |

## CSS Architecture

Styles are organized in `styles/` using CSS custom properties:

```
styles/
├── main.css           # Entry point (imports all)
├── variables.css      # Theme variables
├── base.css           # Reset, body, scrollbar
├── utilities.css      # .hidden, .icon-lg, etc.
├── toolbar.css        # Toolbar styles
├── canvas.css         # Canvas container
├── components.css     # Library items
├── dialogs.css        # All dialogs
├── truth-table.css    # Truth table panel
└── dark-mode.css      # Dark theme overrides
```

### Theme Variables

```css
/* styles/variables.css */
:root {
    --bg-primary: #f8f9fa;
    --text-primary: #2d3436;
    --accent-color: #4a90d9;
    /* ... */
}

[data-theme="dark"] {
    --bg-primary: #1a1a2e;
    --text-primary: #e8e8e8;
    /* ... */
}
```

## Build System

Uses Vite for development and production builds:

```bash
npm run dev      # Start dev server with HMR
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm test         # Run unit tests
```

## Related Documentation

- [Architecture Flow Diagram](docs/specs/architecture-flow-diagram.md) - Visual flow diagrams for the event-driven architecture
- [Architecture Evolution Proposal](docs/specs/architecture-evolution-proposal.md) - Original design document for live editing
- [Truth Table Guidelines](docs/TRUTH_TABLE_GUIDELINES.md) - **Read before modifying TruthTablePanel**
- [Truth Table Refactoring Lessons](docs/specs/truth-table-refactoring-lessons.md) - Historical regression analysis

## State Ownership

Some state crosses module boundaries. This section documents ownership to prevent bugs in features like dirty tracking and revert.

### State Ownership Table

| State | Managed By | Persisted In | Comparison Included |
|-------|------------|--------------|---------------------|
| `components[]` | CircuitState | CircuitState + AutoSaveManager | Yes |
| `connections[]` | CircuitState | CircuitState + AutoSaveManager | Yes |
| `nextId` | CircuitState | AutoSaveManager | Yes |
| `truthTablePanelState` (x, y, width, height, visible, columnOrder) | TruthTablePanel (UI) | CircuitState | Yes |
| `currentBoardName` | CircuitState | AutoSaveManager | No (metadata) |
| `customComponents` | CircuitState | AutoSaveManager | No (separate concern) |
| `dragState` | ComponentDragger | Not persisted | No (ephemeral) |
| `mode` | CircuitState | Not persisted | No (ephemeral) |

### Cross-Layer State: Truth Table Panel

The truth table panel position/size is special:
- **Managed by**: `TruthTablePanel` (UI layer) - user drags/resizes the panel
- **Persisted in**: `CircuitState.truthTablePanelState` (Core layer) - survives board save/load
- **Flow**: Panel changes → `onStateChange` callback → `CircuitState.setTruthTablePanelState()` → emits `TRUTH_TABLE_PANEL_STATE_CHANGED`

This cross-layer ownership requires careful handling:
1. When loading a board, read `truthTablePanelState` BEFORE destroying the panel
2. When comparing for dirty detection, include `truthTablePanelState`
3. When reverting, restore `truthTablePanelState` along with components/connections

### Dirty State Detection (`hasUnsavedChanges`)

`CircuitState.hasUnsavedChanges()` compares current state against `lastSavedState`:

```javascript
// Comparison includes:
- components (deep comparison)
- connections (deep comparison)
- nextId
- truthTablePanelState (deep comparison)

// Comparison excludes:
- currentBoardName (metadata, not content)
- customComponents (separate library concern)
- mode, selectedTool (ephemeral UI state)
```

### Baseline Reset Events

The `lastSavedState` baseline resets on these events:

| Event | Action | Method |
|-------|--------|--------|
| Board saved | `lastSavedState = currentState` | `BoardOperations.saveCurrentBoard()` |
| Board loaded | `lastSavedState = loadedState` | `BoardOperations.loadBoard()` |
| New board | `lastSavedState = null` | `BoardOperations.createNewBoard()` |
| Auto-save restore | `lastSavedState = persisted.lastSavedState` | `AutoSaveManager.loadBoardState()` |

## Future Improvements

1. **IndexedDB Storage**: For larger circuits and offline support
2. **Undo/Redo**: Using command pattern with state snapshots
3. **Collaborative Editing**: WebSocket-based real-time sync
4. **Component Marketplace**: Share custom components online
5. **Mobile Support**: Touch-optimized canvas interactions
