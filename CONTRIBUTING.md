# Contributing Guide

Thank you for your interest in contributing to the Logic Circuit Simulator! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- Git
- A modern web browser (Chrome, Firefox, Safari, or Edge)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/logic_circuit_simulator.git
   cd logic_circuit_simulator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

4. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

```
src/
├── core/           # Pure simulation logic
├── rendering/      # Canvas drawing
├── interaction/    # User input handling
├── ui/             # UI components
├── storage/        # Persistence
└── utils/          # Utilities

tests/
├── unit/           # Unit tests
└── integration/    # Integration tests

styles/             # CSS modules
```

## Development Workflow

### Branch Naming

- `feature/` - New features (e.g., `feature/undo-redo`)
- `fix/` - Bug fixes (e.g., `fix/connection-rendering`)
- `refactor/` - Code refactoring (e.g., `refactor/storage-layer`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

Examples:
```
feat(simulation): add support for feedback loops
fix(rendering): correct wire endpoint positioning
docs(readme): update installation instructions
```

### Pull Request Process

1. Create a branch from `main`
2. Make your changes
3. Write/update tests as needed
4. Ensure all tests pass: `npm test`
5. Create a pull request with a clear description
6. Address review feedback

## Code Style

### JavaScript

- Use ES modules (`import`/`export`)
- Use JSDoc comments for public APIs
- Prefer `const` over `let`
- Use meaningful variable names
- Keep functions focused and small

```javascript
/**
 * Calculate the output value of a gate
 * @param {string} gateType - Type of gate (AND, OR, etc.)
 * @param {number[]} inputs - Array of input values (0 or 1)
 * @returns {number} Output value (0 or 1)
 */
export function evaluateGate(gateType, inputs) {
    // Implementation
}
```

### CSS

- Use CSS custom properties for theming
- Follow BEM naming convention where applicable
- Keep selectors specific but not overly complex
- Use utility classes for common patterns

```css
/* Use variables for colors */
.toolbar-button {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

/* Utility classes */
.hidden { display: none !important; }
.icon-lg { width: 24px; height: 24px; }
```

## Testing

### Writing Tests

Tests are located in `tests/` using Vitest:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitState } from '../../src/core/CircuitState.js';

describe('CircuitState', () => {
    let state;

    beforeEach(() => {
        state = new CircuitState();
    });

    it('should add a component', () => {
        const component = { id: 1, type: 'AND', x: 100, y: 100 };
        state.addComponent(component);

        expect(state.getComponents()).toHaveLength(1);
    });
});
```

### Test Commands

```bash
npm test              # Watch mode
npm run test:run      # Single run
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

### What to Test

- **Core logic**: All pure functions in `src/core/`
- **Storage operations**: CRUD operations for boards and components
- **Utilities**: Helper functions in `src/utils/`
- **Integration**: End-to-end workflows

UI and rendering are tested manually.

## Adding New Features

### Adding a New Gate Type

1. **Add gate logic** in `src/core/gateLogic.js`:
   ```javascript
   case 'BUFFER':
       return inputs[0] ?? null;
   ```

2. **Add rendering** in `src/rendering/ComponentRenderer.js`:
   ```javascript
   case 'BUFFER':
       this.drawBuffer(ctx, component);
       break;
   ```

3. **Add to toolbar** in `index.html`:
   ```html
   <button data-tool="BUFFER" title="Buffer">BUF</button>
   ```

4. **Add tests** in `tests/unit/core/gateLogic.test.js`

5. **Update documentation** as needed

### Adding a New UI Component

1. Create module in `src/ui/`:
   ```javascript
   export class NewPanel {
       constructor(config) {
           // Initialize
       }

       show() { /* ... */ }
       hide() { /* ... */ }
   }
   ```

2. Add styles in `styles/new-panel.css`

3. Import in `styles/main.css`

4. Integrate in `circuit-simulator.js`

## Common Issues

### Development Server Not Starting

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Tests Failing

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test -- tests/unit/core/gateLogic.test.js
```

### Build Errors

```bash
# Check for TypeScript/syntax errors
npm run build 2>&1 | head -50
```

## Getting Help

- Check existing [issues](https://github.com/your-username/logic_circuit_simulator/issues)
- Read the [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions
- Open a new issue with a clear description

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Report any inappropriate behavior

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
