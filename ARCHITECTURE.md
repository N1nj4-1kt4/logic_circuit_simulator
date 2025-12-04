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

## Module Breakdown

### Core (`src/core/`)

Pure business logic with no DOM or Canvas dependencies.

| File | Purpose | Key Exports |
|------|---------|-------------|
| `CircuitState.js` | State container for all circuit data | `CircuitState` class |
| `CircuitOperations.js` | Business logic orchestration | `CircuitOperations` class |
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

#### CircuitOperations

Orchestrates business logic using callbacks for integration:

```javascript
const operations = new CircuitOperations({
    state,
    boardManager,
    componentLibrary,
    callbacks: {
        redraw: () => canvasRenderer.draw(),
        defineComponentPorts: (component) => { /* ... */ },
        findComponent: (x, y) => { /* ... */ },
        findPort: (x, y) => { /* ... */ }
    }
});

// Operations emit events and use callbacks
operations.placeComponent(x, y, 'AND');
operations.simulate();
operations.saveCurrentBoard('MyBoard');
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
| `TruthTablePanel.js` | Truth table display | Tabulator |
| `Toolbar.js` | Toolbar state and buttons | - |
| `DialogManager.js` | All dialog boxes | - |
| `DialogFactory.js` | Programmatic dialog creation | - |
| `ThemeManager.js` | Dark mode toggle | - |
| `messages.js` | Centralized UI strings | - |

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

## Event Bus

The event bus is the primary communication mechanism between modules.

### Event Types

```javascript
import { eventBus, EVENT_TYPES } from './utils/eventBus.js';

// Component lifecycle
EVENT_TYPES.COMPONENT_ADDED       // { component }
EVENT_TYPES.COMPONENT_REMOVED     // { componentId, component }
EVENT_TYPES.COMPONENT_MOVED       // { component, oldX, oldY }

// Connections
EVENT_TYPES.CONNECTION_ADDED      // { connection }
EVENT_TYPES.CONNECTION_REMOVED    // { connection }

// Simulation
EVENT_TYPES.SIMULATION_RUN        // {}
EVENT_TYPES.SIMULATION_COMPLETED  // {}
EVENT_TYPES.SIMULATION_RESET      // {}

// Board operations
EVENT_TYPES.BOARD_SAVE            // { boardName }
EVENT_TYPES.BOARD_LOADED          // { boardName }
EVENT_TYPES.BOARD_CHANGED         // {}
EVENT_TYPES.BOARD_CLEARED         // {}

// UI updates
EVENT_TYPES.CANVAS_REDRAW         // {}
EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS // {}
EVENT_TYPES.TRUTH_TABLE_UPDATE_HIGHLIGHT // {}
```

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
CircuitOperations.placeComponent(x, y, type)
    ↓
CircuitState.addComponent(component)
    ↓
eventBus.emit(COMPONENT_ADDED)
eventBus.emit(BOARD_CHANGED)
    ↓
CanvasRenderer.draw() [subscribes to CANVAS_REDRAW]
```

### Simulation

```
User clicks "Simulate"
    ↓
CircuitOperations.simulate()
    ↓
simulateCircuit(components, connections)
    ↓
evaluateGate() for each gate (topological order)
    ↓
eventBus.emit(CANVAS_REDRAW)
eventBus.emit(TRUTH_TABLE_UPDATE_HIGHLIGHT)
```

### Board Save/Load

```
User clicks "Save Board"
    ↓
DialogManager.showSaveDialog()
    ↓
CircuitOperations.saveCurrentBoard(name)
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

## Future Improvements

1. **IndexedDB Storage**: For larger circuits and offline support
2. **Undo/Redo**: Using command pattern with state snapshots
3. **Collaborative Editing**: WebSocket-based real-time sync
4. **Component Marketplace**: Share custom components online
5. **Mobile Support**: Touch-optimized canvas interactions
