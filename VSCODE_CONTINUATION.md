# VSCode Session Continuation Guide

**Date Prepared:** 2025-11-27
**Branch:** `claude/logic-circuit-simulator-01M38HmZU9rT6ALdvxeHpGUK`
**Last Commit:** `2e00ab6` (Phase 2 rewrite WIP)

## Quick Start

### 1. Pull Latest Changes

```bash
cd ~/logic_circuit_simulator  # Or your local path
git pull origin claude/logic-circuit-simulator-01M38HmZU9rT6ALdvxeHpGUK
```

### 2. Install Testing Dependencies

```bash
npm install -D vitest @vitest/ui jsdom
```

### 3. Update package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 4. Create vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
  },
});
```

### 5. Create Test Setup

Create `tests/setup.js`:

```javascript
import { vi } from 'vitest';

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
```

### 6. Verify Everything Works

```bash
npm run dev     # Should start at localhost:3000
npm test        # Should run (no tests yet)
```

---

## Current State

Read these files for full context:
- **`PROGRESS.md`** - Updated with actual completion status
- **`PHASE_2_3_STATUS.md`** - Detailed analysis of what's done vs. planned

### Summary:
- ✅ **Phase 1:** Complete (constants & utilities)
- 🔄 **Phase 2:** Architecture complete, integration partial
- ⚠️ **Phase 3:** Functional implementation (diverges from OOP plan)
- ⏸️ **Phases 4-9:** Not started

---

## Immediate Tasks (Priority Order)

### Task 1: Test Current State ⭐ CRITICAL
**Before any changes, verify app still works:**

1. Run dev server: `npm run dev`
2. Open http://localhost:3000
3. Test these features:
   - [ ] Place gates (AND, OR, NOT, etc.)
   - [ ] Connect gates
   - [ ] Toggle input values
   - [ ] Simulate circuit
   - [ ] Generate truth table
   - [ ] Save board
   - [ ] Load board
   - [ ] Save custom component
   - [ ] Load custom component
   - [ ] Export component
   - [ ] Import component
   - [ ] Dark mode toggle

4. **Check browser console for errors**
   - Async warnings expected (methods called without await)
   - If functionality broken, may need to revert or fix

### Task 2: Complete Phase 2 Integration

**File:** `circuit-simulator.js`

**A. Update Board Management Methods**

Find and update these methods to use `this.boardManager`:

```javascript
// OLD PATTERN (current):
saveBoard(name) {
    this.savedBoards[name] = boardData;
    this.saveBoardsToStorage();
}

// NEW PATTERN (needed):
async saveBoard(name) {
    const success = await this.boardManager.saveBoard(name, boardData);
    if (success) {
        await this.loadSavedBoards(); // Refresh local copy
        this.updateBoardsList();
    }
}
```

Methods to update:
- `saveBoard()`
- `loadBoard()`
- `deleteBoard()` (if exists)
- Any method manipulating `this.savedBoards`

**B. Update Component Management Methods**

Find and update these methods to use `this.componentLibrary`:

```javascript
// OLD PATTERN (current):
saveComponent(name, data) {
    this.customComponents[name] = data;
    this.saveCustomComponentsToStorage();
}

// NEW PATTERN (needed):
async saveComponent(name, data) {
    const success = await this.componentLibrary.saveComponent(name, data);
    if (success) {
        await this.loadCustomComponents(); // Refresh local copy
        this.updateCustomComponentsList();
    }
}
```

Methods to update:
- `saveComponent()`
- `loadComponent()` (for editing)
- `deleteComponent()`
- `exportComponent()` - use `this.componentLibrary.exportComponent(name)`
- `importComponent()` - use `this.componentLibrary.importComponent(file)`

**C. Handle Async/Await Properly**

Review all calls to async methods:

```javascript
// If you need to wait:
await this.saveBoardState();

// If fire-and-forget is OK:
this.saveBoardState(); // Auto-save, don't wait
```

### Task 3: Write Phase 2 Tests

**Create:** `tests/unit/storage/LocalStorageAdapter.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';

describe('LocalStorageAdapter', () => {
    let adapter;

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        adapter = new LocalStorageAdapter();
    });

    it('should save and retrieve items', async () => {
        await adapter.setItem('test', { foo: 'bar' });
        const result = await adapter.getItem('test');
        expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent items', async () => {
        const result = await adapter.getItem('nonexistent');
        expect(result).toBeNull();
    });

    // Add more tests...
});
```

**Create:** `tests/unit/storage/BoardManager.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { BoardManager } from '../../../src/storage/BoardManager.js';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';

describe('BoardManager', () => {
    let boardManager;

    beforeEach(() => {
        localStorage.clear();
        const adapter = new LocalStorageAdapter();
        boardManager = new BoardManager(adapter);
    });

    it('should save a board', async () => {
        const boardData = {
            components: [],
            connections: [],
            nextId: 1
        };

        const success = await boardManager.saveBoard('TestBoard', boardData);
        expect(success).toBe(true);

        const loaded = await boardManager.loadBoard('TestBoard');
        expect(loaded).toMatchObject(boardData);
    });

    // Add more tests...
});
```

**Create:** `tests/unit/storage/ComponentLibrary.test.js` (similar pattern)

### Task 4: Write Phase 3 Tests

**Create:** `tests/unit/core/gateLogic.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { evaluateAND, evaluateOR, evaluateNOT, evaluateGate } from '../../../src/core/gateLogic.js';

describe('Gate Logic', () => {
    describe('evaluateAND', () => {
        it('should return 1 when both inputs are 1', () => {
            expect(evaluateAND([1, 1])).toBe(1);
        });

        it('should return 0 when any input is 0', () => {
            expect(evaluateAND([0, 1])).toBe(0);
            expect(evaluateAND([1, 0])).toBe(0);
            expect(evaluateAND([0, 0])).toBe(0);
        });
    });

    // Test all gate types...

    describe('evaluateGate dispatcher', () => {
        it('should handle null inputs', () => {
            expect(evaluateGate('AND', [null, 1])).toBeNull();
        });

        it('should dispatch to correct gate', () => {
            expect(evaluateGate('AND', [1, 1])).toBe(1);
            expect(evaluateGate('OR', [0, 0])).toBe(0);
            expect(evaluateGate('NOT', [1])).toBe(0);
        });
    });
});
```

**Create:** `tests/unit/core/circuitEvaluator.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { simulateCircuit } from '../../../src/core/circuitEvaluator.js';

describe('Circuit Evaluator', () => {
    it('should simulate simple AND gate', () => {
        const components = [
            { id: 1, type: 'INPUT', value: 1, inputs: [], outputs: [{x: 0, y: 0}] },
            { id: 2, type: 'INPUT', value: 1, inputs: [], outputs: [{x: 0, y: 0}] },
            { id: 3, type: 'AND', value: null, inputs: [{x: 0, y: 0}, {x: 0, y: 0}], outputs: [{x: 0, y: 0}] },
        ];

        const connections = [
            { from: 1, to: 3, fromPort: 0, toPort: 0 },
            { from: 2, to: 3, fromPort: 0, toPort: 1 },
        ];

        simulateCircuit(components, connections);

        expect(components[2].value).toBe(1);
    });

    // Add more complex circuit tests...
});
```

---

## Medium-Term Tasks

### Decision: Functional vs. OOP for Phase 3

**Review `PHASE_2_3_STATUS.md` section on this.**

**If Keeping Functional:**
- ✅ Less work
- ✅ Code is already done and works
- Extract TruthTableGenerator as functional module
- Move to Phase 4

**If Going OOP:**
- Create `Component.js`, `Connection.js`, `Circuit.js` classes
- Refactor circuit-simulator.js to use them
- Estimate: 4-6 hours work
- Better aligns with original PROGRESS.md plan

### Extract TruthTableGenerator (Either Approach)

**Create:** `src/core/TruthTableGenerator.js`

Extract the `generateTruthTable()` method from circuit-simulator.js into a standalone module.

### Continue to Phase 4: Rendering Layer

Once Phase 2 & 3 are tested and working:
- Extract all canvas drawing code
- Create `src/rendering/ComponentRenderer.js`
- Create `src/rendering/ConnectionRenderer.js`
- See PROGRESS.md for full Phase 4 plan

---

## File Structure (Current)

```
logic_circuit_simulator/
├── circuit-simulator.js (main app, still large ~2200 lines)
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── PROGRESS.md (updated)
├── REFACTORING_PLAN.md
├── PHASE_2_3_STATUS.md (read this!)
├── VSCODE_CONTINUATION.md (this file)
├── src/
│   ├── constants.js ✅
│   ├── core/
│   │   ├── gateLogic.js ✅
│   │   └── circuitEvaluator.js ✅
│   ├── storage/
│   │   ├── StorageAdapter.js ✅
│   │   ├── LocalStorageAdapter.js ✅
│   │   ├── BoardManager.js ✅
│   │   ├── ComponentLibrary.js ✅
│   │   └── localStorage.js (old, still used for darkMode)
│   └── utils/
│       ├── eventBus.js ✅
│       ├── geometry.js ✅
│       ├── positioning.js ✅
│       └── serialization.js ✅
└── tests/
    ├── setup.js (create this)
    └── unit/
        ├── core/
        │   ├── gateLogic.test.js (create)
        │   └── circuitEvaluator.test.js (create)
        ├── storage/
        │   ├── LocalStorageAdapter.test.js (create)
        │   ├── BoardManager.test.js (create)
        │   └── ComponentLibrary.test.js (create)
        └── utils/
            └── geometry.test.js (create)
```

---

## Tips for VSCode Session

### Use Claude Agent SDK Properly
- **Task tool** for complex multi-step work
- **Grep/Read** for code exploration
- Ask Claude to write tests incrementally
- Test frequently

### Test-Driven Approach
1. Write test first (red)
2. Implement/fix code (green)
3. Refactor
4. Repeat

### Git Workflow
- Commit after each phase completion
- Use descriptive commit messages
- Reference PROGRESS.md phase numbers

### When Stuck
- Review `PHASE_2_3_STATUS.md`
- Check browser console
- Run tests
- Ask Claude for specific help

---

## Success Criteria

**Phase 2 Complete:**
- [ ] All board operations use BoardManager API
- [ ] All component operations use ComponentLibrary API
- [ ] Storage tests pass
- [ ] Manual testing shows save/load works
- [ ] No console errors

**Phase 3 Complete:**
- [ ] Core logic tests pass
- [ ] Decision made: functional or OOP
- [ ] TruthTableGenerator extracted (if going functional)
- [ ] OR Component/Connection/Circuit classes created (if going OOP)
- [ ] All tests pass

**Ready for Phase 4:**
- [ ] Phases 2 & 3 fully tested
- [ ] No known bugs
- [ ] PROGRESS.md updated
- [ ] Ready to extract rendering layer

---

## Contact/Questions

If you encounter issues or have questions:
1. Check `PHASE_2_3_STATUS.md` for known issues
2. Review PROGRESS.md for original plan
3. Test in browser console
4. Ask Claude for guidance

Good luck! The foundation is solid, just needs completion and testing. 🚀
