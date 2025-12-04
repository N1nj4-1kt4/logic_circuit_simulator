# Logic Circuit Simulator

A feature-rich, web-based interactive logic circuit simulator that allows you to design, simulate, analyze, and save digital logic circuits.

## 🌟 Key Features

- **Visual Breadboard**: Grid-based canvas for placing and organizing components
- **Comprehensive Logic Gates**: AND, OR, NOT, XOR, NAND, NOR, and XNOR gates
- **Interactive I/O Components**: Toggle inputs (0/1) and view outputs in real-time
- **Flexible Wire Connections**: Connect gates to build complex circuits
- **Real-time Simulation**: Auto-cycle through combinations or step manually
- **Interactive Truth Table**: Generate, customize, and persist truth tables
- **Board Management**: Save, load, and manage multiple circuit boards
- **Custom Components**: Create reusable components from circuits
- **Component Library**: Export/import/edit custom components
- **Dark Mode**: Built-in light/dark theme toggle
- **Smart UI**: Maximized canvas space with intelligent panel positioning
- **Help System**: Comprehensive built-in documentation (press `?`)

## 🚀 Quick Start

1. Open `index.html` in a modern web browser
2. Press `?` to open the Help dialog for detailed instructions
3. Start building circuits by selecting components from the left panel
4. Connect components, simulate, and verify with truth tables

## 📖 Core Features

### Placing Components

1. **Select**: Click any gate or I/O button in the left toolbar
2. **Place**: Click on the breadboard to place the component
3. **Exit Mode**: Press `ESC`, right-click, or click the same button again
4. Components snap to a 50px grid for clean alignment

### Building Circuits

#### Adding Inputs and Outputs
- **INPUT**: Place on canvas, click to toggle between 0 (red) and 1 (green)
- **OUTPUT**: Place on canvas, displays circuit results automatically
- **Rename**: Double-click any INPUT/OUTPUT to give it a meaningful label (e.g., "A", "Sum", "CarryOut")

#### Connecting Components
1. Click "Connect" button to enter connection mode
2. Click source component's **output port** (green dot)
3. Click target component's **input port** (blue dot)
4. Connection lines show signal values (green=1, red=0, gray=undefined)

#### Port Locations
- **Inputs**: One output port on the right
- **Outputs**: One input port on the left
- **NOT Gate**: One input (left), one output (right)
- **Two-input Gates**: Two inputs (left top/bottom), one output (right)
- **Custom Components**: Labeled ports showing signal names

### Simulation

#### Auto-Cycle Simulation
1. Click "Simulate" to automatically cycle through all input combinations
2. Each combination displays for 800ms
3. Combination counter shows progress (e.g., "3 / 8")
4. Connections change color to show signal propagation
5. Click "Stop Simulation" to stop

#### Manual Simulation Controls
- **Next ▶**: Step to next input combination
- **◀ Previous**: Step to previous combination
- **Reset**: Reset all inputs to 0
- Perfect for debugging specific patterns at your own pace

### Truth Table (Enhanced)

Generate comprehensive truth tables with advanced customization:

#### Basic Usage
1. Build a circuit with inputs and outputs
2. Click "Truth Table" button
3. Table appears showing all input/output combinations

#### Advanced Features
- **Active Row Highlighting**: Current input combination is highlighted in real-time
- **Drag to Reposition**: Drag title bar to move table anywhere on canvas
- **Resize**: Drag corner handles to resize the table
- **Reorder Columns**: Drag column headers to rearrange
  - Input columns stay in Input section
  - Output columns stay in Output section
- **Smart Positioning**: Table automatically positions to avoid overlapping your circuit
- **State Persistence**: Position, size, and column order saved with board/component
- **Equal-width Columns**: Clean, professional appearance

### Board Management

Work on multiple circuit projects:

#### Boards vs Components
- **Board**: Work-in-progress circuit (like a scratch pad)
- **Component**: Finalized, reusable circuit building block

#### Workflow
1. **New Board**: Start fresh blank canvas
2. **Save Board**: Save current work-in-progress
3. **Load Board**: Resume work on previously saved board
4. **Save as Component**: Finalize circuit as reusable component

#### Save Options
When making changes, intelligent save prompt offers:
- Update existing board
- Save as new board
- Save as component
- Discard changes

### Custom Components

Build complex systems from tested building blocks:

#### Creating Components
1. Build and test a circuit with INPUTs and OUTPUTs
2. Click "Save as Component"
3. Enter name and optional description
4. All INPUTs become input ports, OUTPUTs become output ports
5. Component appears in Custom Components section

#### Using Components
1. Select your custom component from toolbar
2. Place on breadboard like any other gate
3. Port labels show signal names (from INPUT/OUTPUT labels)
4. Connect and simulate normally
5. Multi-output components fully supported

#### Managing Library
1. **Manage Library**: View all saved components
2. **Edit**: Load component for modifications
3. **Export**: Download as .json file for backup/sharing
4. **Import**: Load .json files from others
5. **Delete**: Remove unused components

#### Hierarchical Design Example
1. Create **HalfAdder** (XOR + AND gates)
2. Build **FullAdder** using 2 HalfAdders
3. Create **4-bit Adder** using 4 FullAdders
4. Design complete ALU using adder components!

### Editing & Organizing

- **Move**: Click and drag any component to reposition
- **Delete Mode**: Click components or connections to remove
- **Rename**: Double-click INPUT/OUTPUT for meaningful labels
- **Clear Board**: Remove all components and connections

### Theme & Display

- **Dark Mode**: Click 🌙 button to toggle light/dark theme
- **Maximized Canvas**: Optimized layout for maximum work space
- **Responsive Layout**: Adapts to different screen sizes
- **Smart Positioning**: Truth Table avoids circuit overlap

### Help System

Comprehensive built-in documentation:
- Press `?` anywhere to open Help dialog
- Organized sections covering all features
- Keyboard shortcuts reference
- Tips and best practices
- Works offline - no internet required

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `ESC` | Exit current mode, return to neutral |
| Right-click | Exit current mode (alternative to ESC) |
| `?` | Open Help dialog |

## 🎓 Supported Logic Gates

| Gate | Function | Inputs | Description |
|------|----------|--------|-------------|
| AND | A ∧ B | 2 | Output is 1 only if both inputs are 1 |
| OR | A ∨ B | 2 | Output is 1 if at least one input is 1 |
| NOT | ¬A | 1 | Output is the inverse of the input |
| XOR | A ⊕ B | 2 | Output is 1 if inputs are different |
| NAND | ¬(A ∧ B) | 2 | Output is 0 only if both inputs are 1 |
| NOR | ¬(A ∨ B) | 2 | Output is 0 if at least one input is 1 |
| XNOR | ¬(A ⊕ B) | 2 | Output is 1 if inputs are the same |

## 💡 Example Circuits

### Half Adder
1. Place 2 inputs (rename to A, B)
2. Place 1 XOR gate and 1 AND gate
3. Place 2 outputs (rename to Sum, Carry)
4. Connect A,B to XOR → Sum; A,B to AND → Carry
5. Verify with Truth Table
6. Save as "HalfAdder" component

### Full Adder
1. Place 3 inputs (A, B, CarryIn)
2. Place 2 HalfAdder components (if created)
3. Place 1 OR gate and outputs (Sum, CarryOut)
4. Wire according to full adder logic
5. Test and save as "FullAdder"

### 2-to-1 Multiplexer
Use AND, OR, and NOT gates with Select, Data0, Data1 inputs and Output.

### 4-bit Ripple Carry Adder
Chain 4 FullAdder components with appropriate carry connections.

## 🔧 Technical Details

### Architecture
- **Event-driven architecture** with centralized state management
- Pure JavaScript ES6+ modules (no frameworks required)
- HTML5 Canvas for rendering
- Responsive flexbox layout
- LocalStorage for persistence
- Auto-save with debouncing

### Module Structure
```
src/
├── core/               # Core logic
│   ├── CircuitState.js      # Single source of truth for state
│   ├── CircuitOperations.js # Business logic operations
│   ├── gateLogic.js         # Gate evaluation functions
│   └── circuitEvaluator.js  # Circuit simulation engine
├── interaction/        # User interaction
│   ├── CanvasInteraction.js # Canvas event handling
│   └── ComponentDragger.js  # Drag and drop logic
├── rendering/          # Canvas drawing
│   ├── CanvasRenderer.js    # Main renderer
│   ├── ComponentRenderer.js # Component drawing
│   ├── ConnectionRenderer.js# Wire drawing
│   └── GridRenderer.js      # Grid drawing
├── storage/            # Data persistence
│   ├── BoardManager.js      # Board CRUD operations
│   ├── ComponentLibrary.js  # Component library
│   └── LocalStorageAdapter.js # Storage adapter
├── ui/                 # User interface
│   ├── Toolbar.js           # Toolbar management
│   ├── DialogManager.js     # Dialog management
│   ├── DialogFactory.js     # Programmatic dialogs
│   ├── TruthTablePanel.js   # Truth table panel
│   ├── ThemeManager.js      # Theme toggling
│   └── messages.js          # Centralized messages
└── utils/              # Utilities
    ├── eventBus.js          # Event pub/sub system
    ├── geometry.js          # Geometry calculations
    └── serialization.js     # JSON serialization
```

### Simulation Engine
- Automatic signal propagation
- Iterative simulation (up to 100 iterations)
- Cycle detection and prevention
- Multi-output component support

### UI/UX Features
- Grid-based component alignment (50px)
- Visual feedback for all interactions
- Mode indicators in status bar
- Smart panel positioning algorithms
- Draggable and resizable panels

### Data Persistence
- Boards saved to LocalStorage
- Components saved to LocalStorage
- Truth Table customization persisted
- Auto-save on circuit changes (1000ms debounce)
- Export/import via JSON files

### Testing
- **453 automated tests** covering:
  - Storage layer (60 tests)
  - Gate logic (58 tests)
  - Circuit simulation (30 tests)
  - State management (68 tests)
  - Validation (47 tests)
  - Edge cases (23 tests)
  - Event bus consistency (30 tests)
  - Auto-save (15 tests)
  - Full workflows (122 tests)

Run tests with: `npm test`

## 🌐 Browser Compatibility

Tested and supported on:
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

Requires modern browser with HTML5 Canvas and LocalStorage support.

## 📁 Files

- `index.html` - Application structure and UI layout
- `styles/` - Modular CSS files (variables, toolbar, canvas, dialogs, etc.)
- `src/` - Modular JavaScript (see Module Structure above)
- `circuit-simulator.js` - Main application coordinator
- `tests/` - Comprehensive test suite (453 tests)

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 💡 Tips & Best Practices

### Circuit Design
- Label your inputs/outputs clearly for readability
- Build and test small circuits before combining
- Use Truth Table to verify logic before saving
- Save circuits as components for reuse

### Organization
- Use meaningful component names (e.g., "8BitAdder", "ALU")
- Add descriptions when saving components
- Export important components for backup
- Organize complex circuits hierarchically

### Performance
- Avoid extremely large circuits (>50 components)
- Test components individually before integration
- Use auto-simulation for quick testing
- Use manual step for detailed debugging

### Sharing
- Export components to share with others
- Import community-created components
- Document your circuits with good labels
- Use screenshots from Truth Table for documentation

## 🎯 Use Cases

- **Education**: Learn digital logic fundamentals
- **Prototyping**: Test circuit ideas before hardware
- **Homework**: Verify logic design assignments
- **Teaching**: Demonstrate logic concepts visually
- **Practice**: Prepare for digital logic exams
- **Design**: Create and document circuit designs

## 🚦 Getting Help

- Press `?` in the application for comprehensive help
- Check this README for detailed documentation
- Experiment with example circuits
- Use Truth Table to understand circuit behavior

## 📝 License

Open source - feel free to use, modify, and share!

---

**Happy Circuit Building! 🔌⚡**

Press `?` in the app for interactive help and detailed instructions.
