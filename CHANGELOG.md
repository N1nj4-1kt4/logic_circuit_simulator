# Changelog

All notable changes to the Logic Circuit Simulator are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - 2025-12-09

### Refactored

#### TruthTablePanel Modernization
- **Section-based organization**: Code organized into clear sections (Constructor & Initialization, Event Handling, Progress UI, Visibility & Lifecycle, Data Management, Table Rendering, Row Highlighting, Layout & Sizing, Drag & Resize, State Persistence)
- **Explicit lifecycle**: Added `init(savedState)` method for explicit initialization before `show()`
- **Renamed property**: `table` → `tabulatorInstance` for clarity
- **Private methods**: All internal methods prefixed with `_` (e.g., `_renderTabulator`, `_saveState`, `_updateHighlight`)
- **Async pattern**: `show()`, `_handleComputed()`, and `refresh()` are now async methods; `_renderTabulator()` returns a Promise
- **Two-level lifecycle**: Table rebuild (structure changes) vs Full destroy (board switch) clearly documented

#### Extracted Pure Functions to truthTableUtils.js
- **Column Definitions**: `buildTruthTableColumns()` - builds Tabulator column definitions with Input/Output groups
- **Table Layout**: `calculateRowLayout()`, `calculateTableLayout()` - row height and table sizing calculations
- **Layout Constants**: `MIN_ROW_HEIGHT`, `MAX_ROW_HEIGHT`, `CONTENT_HEIGHT` exported
- **Panel Bounds**: `clampPanelPosition()`, `clampDimension()`, `sanitizePosition()` - viewport boundary enforcement
- **Row Search**: `inputValuesToIndex()`, `indexToInputValues()` - binary conversion for row lookup

### Added
- `src/utils/truthTableUtils.js` - New utility module with pure functions extracted from TruthTablePanel
- `tests/unit/utils/truthTableUtils.test.js` - Comprehensive tests for truth table utilities (714 lines)
- `docs/specs/truth-table-panel-feature-spec.md` - Complete feature specification
- `docs/specs/truth-table-panel-internal-flow.md` - Internal flow documentation
- `docs/specs/truth-table-panel-prd.md` - Product requirements document
- `docs/manual-tests/truth-table-panel.md` - Manual testing checklist

### Changed
- `circuit-simulator.js` - Updated TruthTablePanel integration with new `init()` lifecycle
- `src/core/CircuitAnalysisManager.js` - Minor updates for clarity

### Documentation
- Updated `ARCHITECTURE.md` with TruthTablePanel section details
- Updated `CLAUDE.md` with new guidelines for minimal public API and private method conventions

## [2.0.0] - 2025-12-04

### Major Refactoring Release

Complete architectural overhaul from monolithic to modular codebase.

### Added

#### New Modules
- `src/core/CircuitState.js` - Centralized state management (651 lines)
- `src/core/CircuitOperations.js` - Business logic orchestration (924 lines)
- `src/core/circuitEvaluator.js` - Circuit simulation engine
- `src/core/gateLogic.js` - Pure gate evaluation functions
- `src/interaction/CanvasInteraction.js` - Canvas event handling (184 lines)
- `src/interaction/ComponentDragger.js` - Drag-and-drop management (107 lines)
- `src/rendering/CanvasRenderer.js` - Main renderer coordinator
- `src/rendering/GridRenderer.js` - Grid background drawing
- `src/rendering/ComponentRenderer.js` - Component visualization
- `src/rendering/ConnectionRenderer.js` - Wire rendering
- `src/ui/TruthTablePanel.js` - Tabulator-based truth table
- `src/ui/Toolbar.js` - Toolbar state management
- `src/ui/DialogManager.js` - Dialog box handling
- `src/ui/DialogFactory.js` - Programmatic dialog creation
- `src/ui/ThemeManager.js` - Dark mode management
- `src/ui/messages.js` - Centralized UI strings
- `src/storage/StorageAdapter.js` - Abstract storage interface
- `src/storage/LocalStorageAdapter.js` - localStorage implementation
- `src/storage/BoardManager.js` - Board persistence
- `src/storage/ComponentLibrary.js` - Custom component management
- `src/utils/eventBus.js` - Event bus singleton with EVENT_TYPES
- `src/utils/geometry.js` - Geometric calculations
- `src/utils/positioning.js` - Smart panel positioning
- `src/utils/serialization.js` - JSON utilities
- `src/utils/svgIcons.js` - SVG icon definitions

#### CSS Modules
- `styles/variables.css` - CSS custom properties (30+ theme variables)
- `styles/base.css` - Reset and base styles
- `styles/utilities.css` - Utility classes (.hidden, .icon-lg, etc.)
- `styles/toolbar.css` - Toolbar styles
- `styles/canvas.css` - Canvas container styles
- `styles/components.css` - Component library styles
- `styles/dialogs.css` - Dialog and alert styles
- `styles/truth-table.css` - Truth table panel styles
- `styles/dark-mode.css` - Dark theme overrides

#### Testing
- Integration tests for full circuit workflow
- Unit tests for eventBus, serialization utilities
- 250+ test cases across core, storage, and utils

#### Documentation
- `ARCHITECTURE.md` - Detailed architecture guide
- `CONTRIBUTING.md` - Contribution guidelines
- `CHANGELOG.md` - This file

### Changed

- **Architecture**: From monolithic (2,973 lines) to modular (35+ files)
- **Main file**: Reduced `circuit-simulator.js` from 2,900 to 670 lines (77% reduction)
- **State management**: Single source of truth via CircuitState
- **Communication**: Event-driven via event bus
- **Truth Table**: Now uses Tabulator library with drag/resize via Interact.js
- **CSS**: Split monolithic `styles.css` (1,620 lines) into 10 focused modules
- **Dialogs**: Unified styling with pastel colors and better UX
- **Auto-cycle speed**: Changed from 500ms to 750ms for better readability

### Fixed

- Truth Table panel flicker on show (pre-position before making visible)
- Close button for Truth Table (moved to TruthTablePanel.js)
- Manage Components dialog not closing after Edit
- Save Options dialog error handling and default naming
- `--text-secondary` CSS variable was referenced but never defined
- 7 inline styles replaced with utility classes

### Removed

- `styles.css` (replaced with modular CSS)
- Duplicate code across the codebase
- Inline event handlers (moved to event bus)

### Technical Improvements

- **Context Tokens for bug fixes**: Reduced from ~29,000 to ~1,200 (-96%)
- **Testability**: Core logic is now unit-testable
- **Maintainability**: Each module has single responsibility
- **Build**: Uses Vite for fast development and optimized builds

## [1.0.0] - 2024-11-XX

### Initial Release

Original monolithic implementation with all features in a single file.

### Features

- Place logic gates (AND, OR, NOT, XOR, NAND, NOR, XNOR)
- Connect components via output-to-input ports
- Toggle INPUT values
- Simulate circuit propagation
- Auto-cycle through all input combinations
- Generate truth tables
- Save/load boards to localStorage
- Create custom components from circuits
- Export/import components as JSON
- Dark mode support
- Keyboard shortcuts (Escape, ?)
- Grid-snapped component placement
- Connection visualization with value states
