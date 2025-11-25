// Logic Circuit Simulator
class CircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('breadboard');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.connections = [];
        this.selectedTool = null;
        this.mode = 'place'; // place, connect, delete
        this.connectStart = null;
        this.nextId = 1;
        this.isAutoCycling = false;
        this.autoCycleTimeout = null;
        this.currentCycleIndex = 0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.drawGrid();
    }

    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.selectedTool = e.target.dataset.type;
                this.mode = 'place';
                this.updateModeIndicator();
            });
        });

        // Action buttons
        document.getElementById('connectMode').addEventListener('click', () => {
            this.mode = 'connect';
            this.connectStart = null;
            this.updateModeIndicator();
        });

        document.getElementById('deleteMode').addEventListener('click', () => {
            this.mode = 'delete';
            this.updateModeIndicator();
        });

        document.getElementById('clearBoard').addEventListener('click', () => {
            if (confirm('Clear entire board?')) {
                this.stopAutoCycle();
                this.components = [];
                this.connections = [];
                this.redraw();
            }
        });

        document.getElementById('simulate').addEventListener('click', () => {
            if (this.isAutoCycling) {
                this.stopAutoCycle();
            } else {
                this.startAutoCycle();
            }
        });

        document.getElementById('truthTable').addEventListener('click', () => {
            this.generateTruthTable();
        });

        document.getElementById('closeTruthTable').addEventListener('click', () => {
            document.getElementById('truthTablePanel').style.display = 'none';
        });

        // Canvas click
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        // Canvas hover for connection preview
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.mode === 'connect' && this.connectStart) {
                this.redraw();
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(this.connectStart.x, this.connectStart.y);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        });
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.mode === 'place' && this.selectedTool) {
            this.placeComponent(x, y, this.selectedTool);
        } else if (this.mode === 'connect') {
            this.handleConnect(x, y);
        } else if (this.mode === 'delete') {
            this.handleDelete(x, y);
        } else {
            // Check if clicking on an input to toggle
            this.toggleInput(x, y);
        }
    }

    placeComponent(x, y, type) {
        const component = {
            id: this.nextId++,
            type: type,
            x: Math.round(x / 50) * 50,
            y: Math.round(y / 50) * 50,
            value: type === 'INPUT' ? 0 : null,
            inputs: [],
            outputs: [],
            label: type === 'INPUT' ? `I${this.getInputCount() + 1}` :
                   type === 'OUTPUT' ? `O${this.getOutputCount() + 1}` : null
        };

        // Define input/output ports
        this.defineComponentPorts(component);

        this.components.push(component);
        this.redraw();
    }

    defineComponentPorts(component) {
        const { type, x, y } = component;

        if (type === 'INPUT') {
            component.outputs.push({ x: x + 40, y: y });
        } else if (type === 'OUTPUT') {
            component.inputs.push({ x: x - 10, y: y });
        } else if (type === 'NOT') {
            component.inputs.push({ x: x - 10, y: y });
            component.outputs.push({ x: x + 50, y: y });
        } else {
            // Two-input gates
            component.inputs.push({ x: x - 10, y: y - 15 });
            component.inputs.push({ x: x - 10, y: y + 15 });
            component.outputs.push({ x: x + 50, y: y });
        }
    }

    handleConnect(x, y) {
        const port = this.findPort(x, y);

        if (!port) return;

        if (!this.connectStart) {
            // Start connection from output port only
            if (port.isOutput) {
                this.connectStart = {
                    component: port.component,
                    portIndex: port.portIndex,
                    x: port.x,
                    y: port.y
                };
            }
        } else {
            // End connection at input port only
            if (!port.isOutput) {
                this.connections.push({
                    from: this.connectStart.component,
                    fromPort: this.connectStart.portIndex,
                    to: port.component,
                    toPort: port.portIndex
                });
                this.connectStart = null;
                this.redraw();
            }
        }
    }

    handleDelete(x, y) {
        // Delete component
        const component = this.findComponent(x, y);
        if (component) {
            this.components = this.components.filter(c => c.id !== component.id);
            this.connections = this.connections.filter(
                conn => conn.from !== component.id && conn.to !== component.id
            );
            this.redraw();
            return;
        }

        // Delete connection
        const connection = this.findConnection(x, y);
        if (connection) {
            this.connections = this.connections.filter(c => c !== connection);
            this.redraw();
        }
    }

    toggleInput(x, y) {
        const component = this.findComponent(x, y);
        if (component && component.type === 'INPUT') {
            component.value = component.value === 0 ? 1 : 0;
            this.redraw();
        }
    }

    findComponent(x, y) {
        return this.components.find(c => {
            const size = c.type === 'INPUT' || c.type === 'OUTPUT' ? 30 : 40;
            return x >= c.x - size/2 && x <= c.x + size/2 &&
                   y >= c.y - size/2 && y <= c.y + size/2;
        });
    }

    findPort(x, y) {
        for (let component of this.components) {
            // Check output ports
            for (let i = 0; i < component.outputs.length; i++) {
                const port = component.outputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < 10) {
                    return { component: component.id, portIndex: i, isOutput: true, x: port.x, y: port.y };
                }
            }

            // Check input ports
            for (let i = 0; i < component.inputs.length; i++) {
                const port = component.inputs[i];
                const dist = Math.hypot(port.x - x, port.y - y);
                if (dist < 10) {
                    return { component: component.id, portIndex: i, isOutput: false, x: port.x, y: port.y };
                }
            }
        }
        return null;
    }

    findConnection(x, y) {
        for (let conn of this.connections) {
            const from = this.components.find(c => c.id === conn.from);
            const to = this.components.find(c => c.id === conn.to);
            if (!from || !to) continue;

            const fromPort = from.outputs[conn.fromPort];
            const toPort = to.inputs[conn.toPort];

            // Simple distance check to connection line
            const dist = this.distanceToLine(x, y, fromPort.x, fromPort.y, toPort.x, toPort.y);
            if (dist < 5) {
                return conn;
            }
        }
        return null;
    }

    distanceToLine(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    drawGrid() {
        // Grid is now drawn via CSS background
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections
        this.drawConnections();

        // Draw components
        this.components.forEach(component => {
            this.drawComponent(component);
        });
    }

    drawConnections() {
        this.connections.forEach(conn => {
            const from = this.components.find(c => c.id === conn.from);
            const to = this.components.find(c => c.id === conn.to);

            if (!from || !to) return;

            const fromPort = from.outputs[conn.fromPort];
            const toPort = to.inputs[conn.toPort];

            // Determine color based on signal value
            const value = this.getPortValue(from, conn.fromPort);
            this.ctx.strokeStyle = value === 1 ? '#4caf50' : value === 0 ? '#f44336' : '#666';
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();
            this.ctx.moveTo(fromPort.x, fromPort.y);

            // Draw with right angles
            const midX = (fromPort.x + toPort.x) / 2;
            this.ctx.lineTo(midX, fromPort.y);
            this.ctx.lineTo(midX, toPort.y);
            this.ctx.lineTo(toPort.x, toPort.y);

            this.ctx.stroke();
        });
    }

    drawComponent(component) {
        const { type, x, y, value } = component;

        this.ctx.save();

        if (type === 'INPUT') {
            // Draw input as a circle
            this.ctx.fillStyle = value === 1 ? '#4caf50' : '#f44336';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(component.label, x, y - 35);
            this.ctx.fillText(value.toString(), x, y);

            // Output port
            this.drawPort(component.outputs[0].x, component.outputs[0].y, true);
        } else if (type === 'OUTPUT') {
            // Draw output as a square
            const outputValue = this.getComponentValue(component);
            this.ctx.fillStyle = outputValue === 1 ? '#4caf50' :
                                outputValue === 0 ? '#f44336' : '#ccc';
            this.ctx.fillRect(x - 20, y - 20, 40, 40);
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x - 20, y - 20, 40, 40);

            // Label
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(component.label, x, y - 35);

            if (outputValue !== null) {
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(outputValue.toString(), x, y);
            }

            // Input port
            this.drawPort(component.inputs[0].x, component.inputs[0].y, false);
        } else {
            // Draw logic gate
            this.drawGate(component);
        }

        this.ctx.restore();
    }

    drawGate(component) {
        const { type, x, y } = component;

        // Draw gate body
        this.ctx.fillStyle = '#e3f2fd';
        this.ctx.strokeStyle = '#1976d2';
        this.ctx.lineWidth = 2;

        if (type === 'NOT') {
            // Triangle for NOT gate
            this.ctx.beginPath();
            this.ctx.moveTo(x - 20, y - 20);
            this.ctx.lineTo(x - 20, y + 20);
            this.ctx.lineTo(x + 20, y);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Inversion circle
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else {
            // Rectangle for other gates
            this.ctx.fillRect(x - 25, y - 25, 50, 50);
            this.ctx.strokeRect(x - 25, y - 25, 50, 50);
        }

        // Gate label
        this.ctx.fillStyle = '#1976d2';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(type, x, y);

        // Draw ports
        component.inputs.forEach(port => {
            this.drawPort(port.x, port.y, false);
        });
        component.outputs.forEach(port => {
            this.drawPort(port.x, port.y, true);
        });
    }

    drawPort(x, y, isOutput) {
        this.ctx.fillStyle = isOutput ? '#4caf50' : '#2196f3';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    simulate() {
        // Reset all component values except inputs
        this.components.forEach(c => {
            if (c.type !== 'INPUT') {
                c.value = null;
            }
        });

        // Iteratively calculate values until stable
        let changed = true;
        let iterations = 0;
        const maxIterations = 100;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            this.components.forEach(component => {
                if (component.type === 'INPUT') return;

                const oldValue = component.value;
                const newValue = this.calculateComponentValue(component);

                if (newValue !== null && newValue !== oldValue) {
                    component.value = newValue;
                    changed = true;
                }
            });
        }

        this.redraw();
    }

    calculateComponentValue(component) {
        const inputValues = [];

        // Get input values from connections
        for (let i = 0; i < component.inputs.length; i++) {
            const connection = this.connections.find(
                c => c.to === component.id && c.toPort === i
            );

            if (!connection) {
                return null; // Not all inputs connected
            }

            const sourceComponent = this.components.find(c => c.id === connection.from);
            if (!sourceComponent || sourceComponent.value === null) {
                return null; // Source not yet calculated
            }

            inputValues.push(sourceComponent.value);
        }

        // Calculate output based on gate type
        return this.evaluateGate(component.type, inputValues);
    }

    evaluateGate(type, inputs) {
        if (inputs.some(v => v === null)) return null;

        switch (type) {
            case 'AND':
                return inputs[0] && inputs[1] ? 1 : 0;
            case 'OR':
                return inputs[0] || inputs[1] ? 1 : 0;
            case 'NOT':
                return inputs[0] ? 0 : 1;
            case 'XOR':
                return inputs[0] !== inputs[1] ? 1 : 0;
            case 'NAND':
                return inputs[0] && inputs[1] ? 0 : 1;
            case 'NOR':
                return inputs[0] || inputs[1] ? 0 : 1;
            case 'XNOR':
                return inputs[0] === inputs[1] ? 1 : 0;
            case 'OUTPUT':
                return inputs[0];
            default:
                return null;
        }
    }

    getComponentValue(component) {
        if (component.type === 'INPUT') {
            return component.value;
        }
        return component.value;
    }

    getPortValue(component, portIndex) {
        return component.value;
    }

    getInputCount() {
        return this.components.filter(c => c.type === 'INPUT').length;
    }

    getOutputCount() {
        return this.components.filter(c => c.type === 'OUTPUT').length;
    }

    generateTruthTable() {
        const inputs = this.components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));
        const outputs = this.components.filter(c => c.type === 'OUTPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            alert('Please add at least one input to generate a truth table.');
            return;
        }

        if (outputs.length === 0) {
            alert('Please add at least one output to generate a truth table.');
            return;
        }

        const numCombinations = Math.pow(2, inputs.length);
        const table = [];

        // Generate all input combinations
        for (let i = 0; i < numCombinations; i++) {
            const row = { inputs: [], outputs: [] };

            // Set input values
            inputs.forEach((input, index) => {
                const bitValue = (i >> (inputs.length - 1 - index)) & 1;
                input.value = bitValue;
                row.inputs.push(bitValue);
            });

            // Simulate circuit
            this.simulate();

            // Record output values
            outputs.forEach(output => {
                row.outputs.push(output.value !== null ? output.value : '?');
            });

            table.push(row);
        }

        this.displayTruthTable(inputs, outputs, table);
    }

    displayTruthTable(inputs, outputs, table) {
        const panel = document.getElementById('truthTablePanel');
        const content = document.getElementById('truthTableContent');

        let html = '<table><thead><tr>';

        // Input columns
        inputs.forEach(input => {
            html += `<th>${input.label}</th>`;
        });

        // Output columns
        outputs.forEach(output => {
            html += `<th>${output.label}</th>`;
        });

        html += '</tr></thead><tbody>';

        // Data rows
        table.forEach(row => {
            html += '<tr>';
            row.inputs.forEach(val => {
                html += `<td>${val}</td>`;
            });
            row.outputs.forEach(val => {
                html += `<td><strong>${val}</strong></td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        content.innerHTML = html;
        panel.style.display = 'block';
    }

    updateModeIndicator() {
        const indicator = document.getElementById('modeIndicator');
        const selected = document.getElementById('selectedComponent');

        if (this.mode === 'place') {
            indicator.textContent = 'Mode: Place Component';
            selected.textContent = this.selectedTool ? `Selected: ${this.selectedTool}` : '';
        } else if (this.mode === 'connect') {
            indicator.textContent = 'Mode: Connect Components';
            selected.textContent = this.connectStart ? 'Click on input port to complete' : 'Click on output port to start';
        } else if (this.mode === 'delete') {
            indicator.textContent = 'Mode: Delete Component/Connection';
            selected.textContent = 'Click on component or connection to delete';
        }
    }

    startAutoCycle() {
        const inputs = this.components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            alert('Please add at least one input to simulate.');
            return;
        }

        const outputs = this.components.filter(c => c.type === 'OUTPUT');
        if (outputs.length === 0) {
            alert('Please add at least one output to simulate.');
            return;
        }

        this.isAutoCycling = true;
        this.currentCycleIndex = 0;
        this.totalCombinations = Math.pow(2, inputs.length);

        // Update button text
        const btn = document.getElementById('simulate');
        btn.textContent = 'Stop Simulation';
        btn.style.background = '#f44336';

        // Update mode indicator
        const indicator = document.getElementById('modeIndicator');
        indicator.textContent = 'Mode: Auto-Cycling Inputs';
        document.getElementById('selectedComponent').textContent =
            `Combination ${this.currentCycleIndex + 1} / ${this.totalCombinations}`;

        this.autoCycleStep();
    }

    stopAutoCycle() {
        this.isAutoCycling = false;
        if (this.autoCycleTimeout) {
            clearTimeout(this.autoCycleTimeout);
            this.autoCycleTimeout = null;
        }

        // Reset button text
        const btn = document.getElementById('simulate');
        btn.textContent = 'Simulate';
        btn.style.background = '#4caf50';

        // Reset mode indicator
        this.updateModeIndicator();
    }

    autoCycleStep() {
        if (!this.isAutoCycling) return;

        const inputs = this.components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (this.currentCycleIndex >= this.totalCombinations) {
            // Finished all combinations, restart
            this.currentCycleIndex = 0;
        }

        // Set input values for current combination
        inputs.forEach((input, index) => {
            const bitValue = (this.currentCycleIndex >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
        });

        // Simulate circuit
        this.simulate();

        // Update display
        document.getElementById('selectedComponent').textContent =
            `Combination ${this.currentCycleIndex + 1} / ${this.totalCombinations}`;

        // Move to next combination
        this.currentCycleIndex++;

        // Schedule next cycle
        this.autoCycleTimeout = setTimeout(() => {
            this.autoCycleStep();
        }, 800); // 800ms delay between combinations
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
