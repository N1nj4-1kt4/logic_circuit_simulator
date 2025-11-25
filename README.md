# Logic Circuit Simulator

A web-based interactive logic circuit simulator that allows you to design, simulate, and analyze digital logic circuits.

## Features

- **Visual Breadboard**: Grid-based canvas for placing and organizing components
- **Logic Gates**: Support for AND, OR, NOT, XOR, NAND, NOR, and XNOR gates
- **Input/Output Components**: Add inputs (toggle between 0/1) and outputs (display results)
- **Wire Connections**: Connect gates together to build complex circuits
- **Real-time Simulation**: Simulate circuit behavior and see signal propagation
- **Truth Table Generation**: Automatically generate truth tables for your entire circuit
- **Interactive Design**: Click-and-place interface with visual feedback

## How to Use

### Getting Started

1. Open `index.html` in a web browser
2. The simulator will load with an empty breadboard

### Placing Components

1. Click on any component button in the left toolbar (e.g., "AND Gate", "OR Gate", "INPUT", etc.)
2. The selected component will be highlighted
3. Click anywhere on the breadboard to place the component
4. Components snap to a grid for clean alignment

### Adding Inputs and Outputs

1. Select "Input" from the toolbar and click on the breadboard to place input nodes
2. Select "Output" from the toolbar and click on the breadboard to place output nodes
3. Inputs are labeled I1, I2, I3... and display as colored circles
4. Outputs are labeled O1, O2, O3... and display as colored squares
5. Click on an input circle to toggle its value between 0 (red) and 1 (green)

### Connecting Components

1. Click the "Connect Mode" button to enter connection mode
2. Click on an **output port** (green dot) of any component to start a connection
3. Click on an **input port** (blue dot) of another component to complete the connection
4. Connections are drawn as colored lines (green for logic 1, red for logic 0)
5. Gates have input ports on the left and output ports on the right

### Port Locations

- **Inputs**: Have one output port on the right side
- **Outputs**: Have one input port on the left side
- **NOT Gate**: Has one input port (left) and one output port (right)
- **Two-input Gates** (AND, OR, XOR, NAND, NOR, XNOR): Have two input ports (left, top and bottom) and one output port (right)

### Simulating Your Circuit

1. After building your circuit with inputs and outputs, click the "Simulate" button
2. The simulator will **automatically cycle through all input combinations**:
   - Input values change automatically (cycling through 00, 01, 10, 11, etc.)
   - Each combination is displayed for 800ms
   - The cycle repeats continuously, showing all possible input states
   - The current combination number is displayed (e.g., "Combination 3 / 8")
3. Connections will change color to show signal values:
   - **Green**: Logic 1 (HIGH)
   - **Red**: Logic 0 (LOW)
   - **Gray**: Undefined/unconnected
4. Output components will display their calculated values in real-time
5. Click "Stop Simulation" (the button changes when running) to stop the auto-cycle
6. You can also manually toggle individual inputs by clicking them when not in simulation mode

### Generating Truth Tables

1. Build a complete circuit with inputs and outputs
2. Click the "Truth Table" button
3. A table will appear showing all possible input combinations and their corresponding outputs
4. The truth table helps verify that your circuit behaves as expected

### Deleting Components

1. Click the "Delete Mode" button
2. Click on any component or connection to delete it
3. Deleting a component also removes all connections to/from it

### Clearing the Board

1. Click the "Clear Board" button
2. Confirm the action in the dialog
3. All components and connections will be removed

## Supported Logic Gates

| Gate | Function | Inputs | Description |
|------|----------|--------|-------------|
| AND | A ∧ B | 2 | Output is 1 only if both inputs are 1 |
| OR | A ∨ B | 2 | Output is 1 if at least one input is 1 |
| NOT | ¬A | 1 | Output is the inverse of the input |
| XOR | A ⊕ B | 2 | Output is 1 if inputs are different |
| NAND | ¬(A ∧ B) | 2 | Output is 0 only if both inputs are 1 |
| NOR | ¬(A ∨ B) | 2 | Output is 0 if at least one input is 1 |
| XNOR | ¬(A ⊕ B) | 2 | Output is 1 if inputs are the same |

## Example Circuits

### Half Adder
1. Place 2 inputs (I1, I2)
2. Place 1 XOR gate and 1 AND gate
3. Place 2 outputs (Sum, Carry)
4. Connect I1 and I2 to both gates
5. Connect XOR output to Sum, AND output to Carry

### Full Adder
Combine multiple gates to create a full adder circuit with carry-in and carry-out.

### 2-to-1 Multiplexer
Use AND, OR, and NOT gates to create a multiplexer circuit.

## Tips

- Components snap to a 50px grid for neat alignment
- The grid background helps visualize spacing
- Input values persist until manually changed
- Use the truth table feature to verify complex circuits
- Hover over connections in connect mode to preview the wire path
- All connections must go from output ports to input ports

## Technical Details

- Built with vanilla JavaScript (no frameworks required)
- HTML5 Canvas for rendering
- Responsive design with grid-based layout
- Supports complex multi-gate circuits
- Automatic signal propagation algorithm
- Iterative simulation engine (up to 100 iterations)

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

Modern browsers with HTML5 Canvas support required.

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `circuit-simulator.js` - Core simulation engine and logic

## License

Open source - feel free to use and modify!
