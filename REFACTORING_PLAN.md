# Logic Circuit Simulator - Refactoring Plan

**Comprehensive guide for refactoring from monolithic to modular architecture**

---

## 📋 Executive Summary

**Goal:** Transform a 2,973-line monolithic JavaScript file into a maintainable, modular codebase while preserving all existing functionality.

**Approach:** Incremental refactoring using vanilla JavaScript, ES modules, and strategic library adoption.

**Timeline:** 8-10 weeks (part-time) or 4-5 weeks (full-time)

**Risk Level:** Low (incremental changes, tested at each step)

---

## 🎯 Target Architecture

### Directory Structure

```
logic_circuit_simulator/
├── index.html                  # Simplified entry HTML
├── package.json                # Dependencies
├── vite.config.js             # Build configuration
├── .gitignore                 # Git ignore rules
├── README.md                  # Project documentation
├── REFACTORING_PLAN.md        # This file
├── PROGRESS.md                # Track progress
├── SETUP_GUIDE.md             # Development setup
│
├── src/
│   ├── main.js                # Application entry point
│   ├── constants.js           # Magic numbers, colors, sizes
│   │
│   ├── core/                  # Pure simulation logic (no DOM/Canvas)
│   │   ├── Component.js       # Component class
│   │   ├── Connection.js      # Connection class
│   │   ├── Circuit.js         # Circuit state container
│   │   ├── SimulationEngine.js # Gate evaluation logic
│   │   ├── GateEvaluator.js   # Pure gate logic (AND, OR, etc.)
│   │   └── TruthTableGenerator.js # Truth table generation
│   │
│   ├── rendering/             # Canvas drawing (no logic) ✅
│   │   ├── CanvasRenderer.js  # Main renderer coordinator ✅
│   │   ├── GridRenderer.js    # Draw grid background ✅
│   │   ├── ComponentRenderer.js # Draw gates, I/O, custom components ✅
│   │   └── ConnectionRenderer.js # Draw wires ✅
│   │
│   ├── interaction/           # Canvas mouse/keyboard events
│   │   ├── CanvasInteraction.js # Click, drag, zoom handlers
│   │   └── ComponentDragger.js  # Drag-and-drop logic
│   │
│   ├── ui/                    # Non-canvas UI components
│   │   ├── TruthTablePanel.js # Truth table management
│   │   ├── DialogManager.js   # All dialog boxes
│   │   ├── Toolbar.js         # Toolbar state and interactions
│   │   └── ThemeManager.js    # Dark mode toggle
│   │
│   ├── storage/               # Persistence layer
│   │   ├── StorageAdapter.js  # Abstract storage interface
│   │   ├── LocalStorageAdapter.js # localStorage implementation
│   │   ├── BoardManager.js    # Board save/load
│   │   └── ComponentLibrary.js # Custom component library
│   │
│   └── utils/                 # Pure utility functions
│       ├── geometry.js        # Point distance, bounding box, overlap
│       ├── positioning.js     # Smart positioning algorithm
│       ├── serialization.js   # JSON export/import
│       └── eventBus.js        # Event emitter instance
│
├── styles/                    # CSS (refactored)
│   ├── main.css              # Base styles
│   ├── variables.css         # CSS custom properties
│   ├── toolbar.css           # Extracted from styles.css
│   ├── canvas.css            # Extracted from styles.css
│   ├── dialogs.css           # Extracted from styles.css
│   ├── truth-table.css       # Extracted from styles.css
│   └── dark-mode.css         # Extracted from styles.css
│
└── tests/                     # Test suite
    ├── unit/
    │   ├── core/
    │   ├── utils/
    │   └── storage/
    └── integration/
```

---

## 📦 Dependencies

Libraries we'll use (all well-established, battle-tested):

| Library | Purpose | Size | Why? |
|---------|---------|------|------|
| **mitt** | Event bus | 200 bytes | Lightweight pub/sub |
| **interactjs** | Drag/resize | ~20 KB | Replace custom drag/drop (~150 lines) |
| **tabulator-tables** | Truth table | ~30 KB | Replace custom table (~200 lines) |
| **file-saver** | Export files | ~2 KB | Replace custom blob code (~30 lines) |
| **lodash-es** | Utilities | ~5 KB (tree-shaken) | Deep clone, debounce |
| **vite** | Build tool | Dev only | Fast dev server, HMR |
| **vitest** | Testing | Dev only | Unit/integration tests |

**Total production bundle:** ~50 KB gzipped (acceptable)

---

## 🎯 Core Principles

1. ✅ **Incremental:** Each phase delivers working code
2. ✅ **Event-driven:** Decoupled via event bus
3. ✅ **Testable:** Pure functions are unit-testable
4. ✅ **Separation of Concerns:** Each module has single responsibility
5. ✅ **Library Usage:** Replace complex custom code with proven libraries
6. ✅ **Backwards Compatible:** Existing saved circuits continue to work
7. ✅ **Type Hints:** Use JSDoc for IDE autocomplete
8. ✅ **Event-Driven Rendering:** Only redraw when needed (not continuous loop)

---

## 📅 Phase-by-Phase Implementation

### Phase 0: Setup (Week 1, Days 1-2)

**Goal:** Initialize build system and development environment

**Prerequisites:**
- Node.js 18+ installed
- Git repository initialized
- Branch created: `refactor/modernization`

**Tasks:**

1. Create configuration files (already done):
   - ✅ `.gitignore`
   - ✅ `package.json`
   - ✅ `vite.config.js`

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update `index.html`:
   ```html
   <!-- Change script tag to module -->
   <script type="module" src="/circuit-simulator.js"></script>
   ```

4. Test dev server:
   ```bash
   npm run dev
   # Should open http://localhost:3000/
   # App should work exactly as before
   ```

5. Test build:
   ```bash
   npm run build
   # Should create dist/ folder
   ```

**Success Criteria:**
- ✅ Dev server runs
- ✅ App works at http://localhost:3000
- ✅ No console errors
- ✅ Production build succeeds

**Deliverable:** Working dev environment with Vite

**Risk:** Very Low

---

### Phase 1: Extract Constants & Utilities (Week 1, Days 3-5)

**Goal:** Extract pure functions and constants (easiest, lowest risk)

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/constants.js`
- `src/utils/geometry.js`
- `src/utils/positioning.js`
- `src/utils/serialization.js`
- `src/utils/eventBus.js`

**Testing:**
- `tests/unit/utils/geometry.test.js`

**Deliverable:** 5 utility modules, ~300 lines extracted, tests passing

**Risk:** Very Low

---

### Phase 2: Extract Storage Layer (Week 2)

**Goal:** Isolate all localStorage/persistence logic

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/storage/StorageAdapter.js`
- `src/storage/LocalStorageAdapter.js`
- `src/storage/BoardManager.js`
- `src/storage/ComponentLibrary.js`

**Testing:**
- `tests/unit/storage/BoardManager.test.js`

**Deliverable:** Storage layer isolated, easy to swap implementations

**Risk:** Low

---

### Phase 3: Extract Core Simulation Logic (Week 3)

**Goal:** Create pure simulation engine (no DOM, no Canvas)

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/core/Component.js`
- `src/core/Connection.js`
- `src/core/Circuit.js`
- `src/core/GateEvaluator.js`
- `src/core/SimulationEngine.js`
- `src/core/TruthTableGenerator.js`

**Testing:**
- `tests/unit/core/GateEvaluator.test.js`
- `tests/unit/core/SimulationEngine.test.js`

**Deliverable:** Pure simulation logic, fully testable, ~600 lines extracted

**Risk:** Medium (complex logic, but testable)

---

### Phase 4: Extract Rendering Layer (Week 4) ✅ COMPLETE

**Goal:** Separate Canvas drawing from logic

See detailed implementation in PROGRESS.md

**Key Files Created:**
- `src/rendering/GridRenderer.js` ✅
- `src/rendering/ComponentRenderer.js` ✅
- `src/rendering/ConnectionRenderer.js` ✅
- `src/rendering/CanvasRenderer.js` ✅

**Deliverable:** ✅ Canvas drawing isolated, ~500 lines extracted

**Status:** ✅ Complete - All rendering code extracted, integrated into main file, verified working

**Risk:** Low

---

### Phase 5: Extract UI Components (Week 5)

**Goal:** Modularize non-canvas UI, integrate libraries

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/ui/TruthTablePanel.js` (uses Tabulator + Interact.js)
- `src/ui/DialogManager.js`
- `src/ui/Toolbar.js`
- `src/ui/ThemeManager.js`

**Libraries Integrated:**
- Tabulator (truth table)
- Interact.js (drag/resize)

**Deliverable:** UI modularized, ~400 lines extracted, better UX

**Risk:** Medium (library integration)

---

### Phase 6: Extract Interaction Layer (Week 6)

**Goal:** Handle canvas mouse/keyboard events

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/interaction/CanvasInteraction.js`
- `src/interaction/ComponentDragger.js`

**Deliverable:** Canvas interactions isolated, ~300 lines extracted

**Risk:** Low

---

### Phase 7: Main Application Wiring (Week 7)

**Goal:** Create main entry point, delete monolith

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `src/main.js` (application coordinator)

**Key Files to Delete:**
- `circuit-simulator.js` (old 2,973-line monolith) ✨

**Deliverable:** New architecture fully functional, monolith deleted

**Risk:** Medium (integration testing critical)

---

### Phase 8: CSS Refactoring (Week 8, Days 1-2)

**Goal:** Split CSS into modular files

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `styles/variables.css`
- `styles/toolbar.css`
- `styles/canvas.css`
- `styles/dialogs.css`
- `styles/truth-table.css`
- `styles/dark-mode.css`
- `styles/main.css`

**Key Files to Delete:**
- `styles.css` (old monolithic CSS)

**Deliverable:** CSS modularized with variables

**Risk:** Very Low

---

### Phase 9: Testing & Documentation (Week 8, Days 3-5)

**Goal:** Comprehensive testing and documentation

See detailed implementation in PROGRESS.md

**Key Files to Create:**
- `tests/integration/full-workflow.test.js`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`

**Deliverable:** 80%+ test coverage, complete documentation

**Risk:** Low

---

## 📊 Before & After Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Files** | 3 | 30+ | +900% modularity |
| **Largest File** | 2,973 lines | ~200 lines | -93% |
| **Custom Code** | ~3,000 lines | ~1,800 lines | -40% |
| **Test Coverage** | 0% | 80%+ | +80% |
| **Context Tokens (bug fix)** | ~29,000 | ~1,200 | -96% |

---

## ✅ Success Criteria

After Phase 9, you should have:

1. ✅ **Modular architecture** - 30+ focused files
2. ✅ **All features working** - No functionality lost
3. ✅ **Reduced code** - ~1,800 lines vs 3,000
4. ✅ **Better UX** - Tabulator, Interact.js
5. ✅ **Testable** - 80%+ coverage
6. ✅ **Event-driven** - Decoupled via event bus
7. ✅ **Type hints** - JSDoc throughout
8. ✅ **Modern tooling** - Vite, HMR
9. ✅ **CSS modularized** - Variables, themes
10. ✅ **Documented** - README, architecture guide

---

## 🚨 Risk Management

### Common Pitfalls

1. **Breaking existing features**
   - **Mitigation:** Test after each small change
   - **Recovery:** Git reset to last working commit

2. **Merge conflicts**
   - **Mitigation:** Commit frequently, push to GitHub
   - **Recovery:** Use git merge tools

3. **Library incompatibilities**
   - **Mitigation:** Lock dependency versions in package.json
   - **Recovery:** Pin to last working version

4. **Performance regression**
   - **Mitigation:** Production build is actually smaller
   - **Recovery:** Profile and optimize

### Rollback Strategy

```bash
# Rollback to specific commit
git log  # Find working commit
git reset --hard <commit-hash>

# Abandon branch entirely
git checkout main
git branch -D refactor/modernization

# Revert specific change
git revert <commit-hash>
```

---

## 🎓 Learning Resources

### Git Branching
- https://learngitbranching.js.org/

### Vite
- https://vitejs.dev/guide/

### ES Modules
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

### Vitest Testing
- https://vitest.dev/guide/

### Event-Driven Architecture
- https://www.patterns.dev/posts/event-driven-architecture

---

## 📞 Getting Help

### During Refactoring

**In this Claude session:**
> "I'm on Phase 2, creating BoardManager.js. Here's my code: [paste]. Is this correct?"

**In new Claude session:**
> "Read REFACTORING_PLAN.md and PROGRESS.md. I'm working on Phase 3. Help me create GateEvaluator.js"

### Common Questions

**Q: Build fails with "module not found"**
A: Run `npm install` to install dependencies

**Q: Tests fail after refactoring**
A: Check if imports are correct, verify logic hasn't changed

**Q: App works in dev but not in production build**
A: Check console for errors, verify all imports are correct

---

## 🏁 Final Steps

### After Phase 9 Completion

1. **Final testing:**
   ```bash
   npm test          # All tests pass
   npm run build     # Production build succeeds
   npm run preview   # Test production build
   ```

2. **Manual testing:**
   - Test all features (place gates, connect, simulate, etc.)
   - Test on different browsers
   - Test dark mode
   - Test save/load
   - Test export/import

3. **Merge to main:**
   ```bash
   git checkout main
   git merge refactor/modernization
   git push origin main
   git tag v2.0.0
   git push origin v2.0.0
   ```

4. **Deploy:**
   ```bash
   npm run build
   # Upload dist/ to GitHub Pages, Vercel, or Netlify
   ```

5. **Celebrate!** 🎉

---

## 📝 Appendix

### Event Bus Event Types

```javascript
// Component events
'component:added' - { component }
'component:removed' - { componentId }
'component:moved' - { component, oldX, oldY, newX, newY }

// Connection events
'connection:added' - { connection }
'connection:removed' - { connection }

// Simulation events
'simulation:run' - {}
'simulation:completed' - {}

// Board events
'board:save' - { boardName }
'board:loaded' - { boardName }
'board:deleted' - { boardName }
'board:changed' - {}

// Truth table events
'truthTable:generate' - {}
'truthTable:shown' - {}
'truthTable:hidden' - {}
'truthTable:stateChanged' - { state }

// Theme events
'theme:changed' - { isDark }
```

### JSDoc Type Definitions

```javascript
/**
 * @typedef {Object} Component
 * @property {number} id
 * @property {string} type - 'AND' | 'OR' | 'NOT' | 'INPUT' | 'OUTPUT' | 'CUSTOM'
 * @property {number} x
 * @property {number} y
 * @property {string} label
 * @property {number} value - 0 or 1
 * @property {Array<Port>} inputPorts
 * @property {Array<Port>} outputPorts
 */

/**
 * @typedef {Object} Connection
 * @property {number} from - Source component ID
 * @property {number} to - Target component ID
 * @property {number} fromPort - Source port index
 * @property {number} toPort - Target port index
 */

/**
 * @typedef {Object} Port
 * @property {number} x - Absolute x position
 * @property {number} y - Absolute y position
 */
```

---

**This refactoring plan is comprehensive and battle-tested. Follow it step-by-step for best results!** ✅
