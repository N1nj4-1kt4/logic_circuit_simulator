# Logic Circuit Simulator - Claude Code Instructions

This document provides guidance for working with the Logic Circuit Simulator codebase.

## Architecture Overview

This is an **event-driven modular architecture** with clear separation of concerns:

```
src/
├── core/           # Pure simulation logic (NO DOM/Canvas dependencies)
├── rendering/      # Canvas drawing only (NO business logic)
├── interaction/    # Canvas mouse/keyboard event handling
├── ui/             # Non-canvas UI components (dialogs, panels, toolbar)
├── storage/        # Persistence layer (localStorage abstraction)
├── utils/          # Pure utility functions
├── constants.js    # All magic numbers, colors, configuration
└── main.js         # Entry point

circuit-simulator.js  # Main application coordinator
```

## Core Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Event-Driven Communication**: Modules communicate via event bus, not direct method calls
3. **Pure Functions**: Core logic is testable without DOM dependencies
4. **Single Source of Truth**: All state lives in `CircuitState` (`src/core/CircuitState.js`)
5. **Constants Centralization**: No magic numbers in code - use `src/constants.js`
6. **Message Centralization**: UI strings live in `src/ui/messages.js` for localization readiness

## File Organization Rules

### When Adding New Code

- **Business logic** → `src/core/`
- **Canvas drawing** → `src/rendering/`
- **User input handling** → `src/interaction/`
- **Dialogs, panels, UI widgets** → `src/ui/`
- **Data persistence** → `src/storage/`
- **Helper functions** → `src/utils/`
- **Configuration values** → `src/constants.js`
- **User-facing strings** → `src/ui/messages.js`

### Module Dependencies (Allowed Imports)

```
core/       → utils/, constants.js only (NO DOM imports)
rendering/  → core/, utils/, constants.js
interaction/→ core/, utils/, constants.js, eventBus
ui/         → core/, utils/, constants.js, eventBus
storage/    → utils/, constants.js
utils/      → constants.js only (pure functions)
```

## Event Bus Usage

All inter-module communication should use the event bus:

```javascript
import { eventBus, EVENT_TYPES } from './utils/eventBus.js';

// Subscribe
eventBus.on(EVENT_TYPES.COMPONENT_ADDED, (data) => { /* handle */ });

// Emit
eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component });

// Unsubscribe
eventBus.off(EVENT_TYPES.COMPONENT_ADDED, handler);
```

### Event Design: Declarative, Not Imperative

**Events must describe what happened, not what listeners should do.**

```javascript
// GOOD - Declarative (what happened)
eventBus.emit(EVENT_TYPES.COMPONENT_ADDED, { component });
eventBus.emit(EVENT_TYPES.SIMULATION_STEP_COMPLETED, { cycleIndex, inputValues });
eventBus.emit(EVENT_TYPES.BOARD_LOADED, { boardName, components, connections });

// BAD - Imperative (commanding listeners)
eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);  // Don't do this
eventBus.emit(EVENT_TYPES.UPDATE_TOOLBAR);  // Don't do this
eventBus.emit(EVENT_TYPES.REFRESH_PANEL);   // Don't do this
```

**Why declarative events matter:**
1. **Decoupling** - Emitters don't know or care who's listening
2. **Extensibility** - New components subscribe to existing events without modifying emitters
3. **Testability** - Events describe state changes, easy to verify
4. **Single responsibility** - Each listener decides its own response

**Pattern:** If you find yourself creating an event that tells a specific component to do something, you're doing it wrong. Instead, emit an event describing what changed, and let that component subscribe and decide how to respond.

### Available Event Types

See `src/utils/eventBus.js` for the full list. Key categories:
- `COMPONENT_*` - Component lifecycle (added, removed, moved, valueChanged)
- `CONNECTION_*` - Wire operations (added, removed)
- `SIMULATION_*` - Simulation state (started, stopped, stepCompleted)
- `BOARD_*` - Save/load operations (saved, loaded, cleared)
- `TRUTH_TABLE_*` - Truth table state (computed, shown, hidden)

## State Management

**CircuitState** (`src/core/CircuitState.js`) is the single source of truth for **circuit data**:

```javascript
// Reading state
state.getComponents()
state.getConnections()
state.getMode()
state.getCurrentBoardName()

// Modifying state (emits events automatically)
state.addComponent(component)
state.removeComponent(id)
state.setMode('connect')
```

**Never** modify state directly - always use CircuitState methods.

**Important:** UI interaction state (like drag state) should NOT be stored in CircuitState. Keep interaction state local to the interaction layer modules (e.g., `ComponentDragger` manages its own `dragState` object).

## Constants Usage

All configuration values must be in `src/constants.js`:

```javascript
import { GATE_SIZES, COLORS, GRID_SIZE, TIMING, UI } from './constants.js';

// Good
const width = GATE_SIZES.AND.width;
const wireColor = COLORS.WIRE_ON;
const fillColor = darkMode ? COLORS.DARK.GATE_FILL : COLORS.LIGHT.GATE_FILL;
const fadeTime = TIMING.DIALOG_FADE_IN;
const icon = UI.ICONS.CLOSE;

// Bad - no magic numbers
const width = 50;
const wireColor = '#4caf50';
const fadeTime = 200;
```

**Available constant categories:**
- `GATE_SIZES` - Component dimensions (width, height, halfWidth, halfHeight)
- `COLORS` - All colors including `COLORS.DARK.*` and `COLORS.LIGHT.*` variants
- `TIMING` - Animation durations, delays, debounce intervals
- `UI.ICONS` - Icon characters (SUN, MOON, CLOSE, CHECK, CROSS, WARNING, INFO)
- `FONTS` - Font definitions for labels
- `GRID_SIZE`, `PORT_RADIUS`, `PORT_DETECTION_RADIUS` - Layout constants

## Utility Functions

### Component Dimensions

Use `getComponentDimensions()` from `src/utils/geometry.js` instead of hardcoding dimensions:

```javascript
import { getComponentDimensions } from './utils/geometry.js';

// Good - uses centralized helper
const { halfWidth, halfHeight } = getComponentDimensions(component.type);

// Bad - hardcoded dimensions
let halfWidth = 25, halfHeight = 20;
if (type === 'INPUT') { halfWidth = halfHeight = 20; }
```

### Board Name Generation

Use `generateNextBoardName()` from `src/utils/naming.js` for consistent board naming:

```javascript
import { generateNextBoardName } from './utils/naming.js';

// Good - uses centralized utility
const nextName = generateNextBoardName(existingBoardNames);

// Bad - duplicate logic
let counter = 1;
while (names.includes(`Board${counter}`)) counter++;
```

## Adding New Features

### Adding a New Gate Type

1. Add gate dimensions to `src/constants.js` → `GATE_SIZES`
2. Add gate logic to `src/core/gateLogic.js`
3. Add rendering to `src/rendering/ComponentRenderer.js`
4. Add port config to `src/constants.js` → `PORT_CONFIG`
5. Add toolbar button to `index.html`
6. Add tests to `tests/unit/core/gateLogic.test.js`

### Adding a New UI Component

1. Create class in `src/ui/YourComponent.js`
2. Add styles to `styles/your-component.css`
3. Import styles in `styles/main.css`
4. Add UI strings to `src/ui/messages.js`
5. Integrate via event bus in `circuit-simulator.js`

### Adding New Events

1. Add event type to `EVENT_TYPES` in `src/utils/eventBus.js`
2. Document the event payload in comments
3. Emit from appropriate module
4. Subscribe in consuming modules

## CSS Architecture

Styles are modular in `styles/`:
- `variables.css` - CSS custom properties (theme colors, spacing)
- `base.css` - Reset, body, scrollbar
- `utilities.css` - `.hidden`, `.icon-lg`, animations
- Component-specific files for each UI section

### CSS Best Practices

```css
/* Use CSS variables for theming */
.toolbar-button {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

/* Use utility classes for visibility */
element.classList.add('hidden');    /* Good */
element.style.display = 'none';     /* Avoid */
```

## Testing Requirements

- **Core logic**: Must have unit tests (100% coverage target)
- **Storage**: Must have unit tests
- **Utils**: Must have unit tests
- **Interaction/Rendering/UI**: Should have unit tests with mocks

### Mandatory Testing for All Changes

**Every code change or bug fix MUST include:**
1. **New tests** - Add tests that cover the new functionality or verify the fix
2. **Test review** - Review existing tests affected by your changes and update them as needed
3. **Run full test suite** - Ensure all tests pass before considering work complete

**When modifying existing code:**
- Check if existing tests still accurately reflect the expected behavior
- Update test assertions if the intended behavior has changed
- Remove obsolete tests that no longer apply
- Add missing test cases discovered during the change

Test location mirrors source: `tests/unit/core/` for `src/core/`

### Test Patterns by Module Type

**Core/Business Logic** - Mock external dependencies, test logic:
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockStorage = { save: vi.fn().mockResolvedValue(true) };

describe('CircuitOperations', () => {
    it('saves board and updates state', async () => {
        const result = await operations.saveCurrentBoard('TestBoard');
        expect(mockStorage.save).toHaveBeenCalled();
        expect(state.getCurrentBoardName()).toBe('TestBoard');
    });
});
```

**Interaction Layer** - Mock state and callbacks, test event flow:
```javascript
describe('ComponentDragger', () => {
    const mockState = { getMode: vi.fn().mockReturnValue('place') };
    const mockMoveComponent = vi.fn();

    it('starts drag when movement exceeds threshold', () => {
        dragger.handleMouseDown(100, 100, canvas);
        dragger.handleMouseMove(110, 100, canvas); // 10px > 3px threshold
        expect(dragger.isDragging()).toBe(true);
    });
});
```

**Rendering Layer** - Mock canvas context, verify draw calls:
```javascript
describe('ComponentRenderer', () => {
    const mockCtx = {
        arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
        beginPath: vi.fn(), save: vi.fn(), restore: vi.fn()
    };

    it('draws INPUT as circle with correct radius', () => {
        renderer.drawInputOutput(inputComponent, 'INPUT');
        expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 20, 0, Math.PI * 2);
    });
});
```

**UI Components** - Mock DOM, test state changes and callbacks:
```javascript
describe('Toolbar', () => {
    const mockCallbacks = { onModeChange: vi.fn() };

    it('enters connect mode when button clicked', () => {
        // Simulate button click
        clickHandler();
        expect(toolbar.mode).toBe('connect');
        expect(mockCallbacks.onModeChange).toHaveBeenCalledWith('connect');
    });
});
```

**Event Bus Integration** - Verify events are emitted/handled:
```javascript
it('emits CANVAS_REDRAW after component placement', () => {
    const handler = vi.fn();
    eventBus.on(EVENT_TYPES.CANVAS_REDRAW, handler);

    operations.placeComponent(100, 100, 'AND');

    expect(handler).toHaveBeenCalled();
});
```

### What to Test

| Module Type | Test Focus |
|-------------|------------|
| Core logic | Input/output, error cases, state changes |
| Interactions | Event handling, state transitions, thresholds |
| Rendering | Correct draw calls, colors, coordinates |
| UI | Callbacks invoked, DOM updates, validation |
| Storage | Save/load, error handling, data integrity |

Run tests: `npm test` (watch) or `npm run test:run` (single)

## Code Style

### JavaScript

- ES modules (`import`/`export`)
- JSDoc comments for public APIs
- `const` over `let`
- Meaningful names
- Small, focused functions

```javascript
/**
 * Calculate the output value of a gate
 * @param {string} gateType - Type of gate (AND, OR, etc.)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number|null} Output value (0, 1, or null if inputs incomplete)
 */
export function evaluateGate(gateType, inputs) {
    // ...
}
```

### Naming Conventions

- **Files**: PascalCase for classes (`CircuitState.js`), camelCase for utils (`geometry.js`)
- **Classes**: PascalCase (`class BoardManager`)
- **Functions**: camelCase (`function calculateDistance()`)
- **Constants**: SCREAMING_SNAKE_CASE (`const GRID_SIZE = 50`)
- **Event types**: `namespace:action` (`component:added`)

## Common Patterns

### Callback-based Integration

For modules that need bidirectional communication:

```javascript
const operations = new CircuitOperations({
    state,
    boardManager,
    callbacks: {
        redraw: () => canvasRenderer.draw(),
        showDialog: (type) => dialogManager.show(type)
    }
});
```

### Storage Adapter Pattern

Abstract storage interface allows swapping backends:

```javascript
// Currently localStorage
const storage = new LocalStorageAdapter();

// Could be IndexedDB, remote API, etc.
const storage = new IndexedDBAdapter();

const boardManager = new BoardManager(storage);
```

## Logging Best Practices

**Never use `console.log` in production code.** Use the logger utility from `src/utils/logger.js`:

```javascript
import { logger } from './utils/logger.js';

// Development-only logging (stripped in production)
logger.debug('Processing component:', component);
logger.info('Board loaded successfully');

// Always logged (use sparingly for genuine issues)
logger.warn('Deprecated feature used');
logger.error('Failed to save:', error);
```

**Guidelines:**
- `logger.debug()` / `logger.info()` - Only log in development mode (`import.meta.env.DEV`)
- `logger.warn()` / `logger.error()` - Always logged, use for genuine runtime issues
- **Don't** use `console.log()` directly - it pollutes production builds
- **Don't** log sensitive data (user input, storage contents)
- **Do** remove debug logging before committing unless it adds value for development

**When to use each level:**
| Level | When to Use |
|-------|-------------|
| `debug` | Detailed flow tracing during development |
| `info` | Notable events (feature loaded, operation complete) |
| `warn` | Unexpected but recoverable situations |
| `error` | Failures that need attention |

## Avoiding Code Duplication

**Before creating new methods or adding code, check for existing similar functionality:**

1. **Similar methods**: If two methods share 50%+ logic, refactor to use a shared helper or add parameters to one method
2. **Similar code blocks**: If identical logic appears in multiple places, extract to a private helper method (prefix with `_`)
3. **Variations of the same operation**: Use options/parameters instead of creating separate methods

**Pattern for optional behavior:**
```javascript
// Good - single method with options
resetSimulation(options = {}) {
    const { skipSimulate = false } = options;
    // ... shared logic ...
    if (!skipSimulate) {
        this.simulate();
    }
}

// Bad - duplicate method
resetSimulation() { /* ... */ this.simulate(); }
stopAndResetSimulation() { /* same logic without simulate */ }
```

**Pattern for shared logic blocks:**
```javascript
// Good - extract shared logic to private helper
_restoreFromCacheOrSimulate(cycleIndex, components) {
    // shared cache lookup and restoration logic
}

autoCycleStep() {
    // ... setup ...
    this._restoreFromCacheOrSimulate(index, components);
}

stepSimulation() {
    // ... setup ...
    this._restoreFromCacheOrSimulate(index, components);
}
```

**When adding new functionality:**
- Search the codebase for similar patterns before writing new code
- If you find yourself copy-pasting code blocks, stop and refactor
- Consider if an existing method can be extended with a parameter instead of creating a new one

## What NOT to Do

- **Don't** put DOM manipulation in `src/core/`
- **Don't** use magic numbers - add to constants.js
- **Don't** call methods directly between modules - use event bus
- **Don't** modify state without going through CircuitState
- **Don't** store UI interaction state (drag, hover, selection) in CircuitState - keep it local to interaction modules
- **Don't** add inline styles in JavaScript - use CSS classes
- **Don't** hardcode user-facing strings - use messages.js
- **Don't** skip writing tests for core logic
- **Don't** use plain JavaScript `alert()`, `confirm()`, or `prompt()` - use DialogFactory
- **Don't** use `console.log()` - use the logger utility
- **Don't** duplicate code - extract shared logic to helper methods or use parameters

## Dialog Usage

**Never use plain browser dialogs** (`alert()`, `confirm()`, `prompt()`). Always use `DialogFactory` from `src/ui/DialogFactory.js`:

```javascript
import { DialogFactory } from './src/ui/DialogFactory.js';

// Instead of: alert('Something happened')
DialogFactory.showAlert({
    message: 'Something happened',
    type: 'info'  // 'info', 'success', 'warning', 'error'
});

// Instead of: if (confirm('Are you sure?'))
DialogFactory.showConfirm({
    message: 'Are you sure?',
    type: 'warning',
    onConfirm: () => { /* handle confirmation */ }
});
```

**Error handling in core/storage modules**: These modules should throw custom errors from `src/core/errors.js` instead of showing dialogs. The coordinator (`circuit-simulator.js`) catches and displays them via `DialogFactory`.

## Build & Development

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm test         # Run tests in watch mode
npm run test:run # Single test run
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `circuit-simulator.js` | Main coordinator, initializes all modules |
| `src/core/CircuitState.js` | Central state container |
| `src/core/CircuitOperations.js` | Business logic orchestration |
| `src/core/errors.js` | Custom error classes for business logic |
| `src/utils/eventBus.js` | Event bus singleton + EVENT_TYPES |
| `src/utils/geometry.js` | Geometric utilities + `getComponentDimensions()` |
| `src/utils/naming.js` | Board naming utilities |
| `src/utils/hitDetection.js` | Component/port/connection hit detection |
| `src/utils/logger.js` | Development logging utility |
| `src/constants.js` | All configuration values |
| `src/ui/messages.js` | User-facing strings |
| `ARCHITECTURE.md` | Detailed architecture documentation |
