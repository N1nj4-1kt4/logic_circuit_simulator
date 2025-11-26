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
        this.customComponents = {};
        this.renameTarget = null;
        // Default to dark mode if no preference is saved
        this.darkMode = localStorage.getItem('darkMode') !== 'false';
        this.isDraggingComponent = false;
        this.draggedComponent = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragStartPos = null;
        this.hasMoved = false;

        this.init();
    }

    init() {
        this.loadCustomComponents();
        this.setupEventListeners();
        this.setupDraggableTruthTable();
        this.setupAutoSave();
        this.loadBoardState();
        this.drawGrid();
        this.updateCustomComponentsList();
        this.applyTheme();
    }

    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.selectedTool = e.currentTarget.dataset.type;
                this.mode = 'place';
                this.updateModeIndicator();
            });
        });

        // Action buttons
        document.getElementById('connectMode').addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
            this.selectedTool = null;
            this.mode = 'connect';
            this.connectStart = null;
            this.updateModeIndicator();
        });

        document.getElementById('deleteMode').addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
            this.selectedTool = null;
            this.mode = 'delete';
            this.updateModeIndicator();
        });

        document.getElementById('clearBoard').addEventListener('click', () => {
            const hasComponents = this.components.length > 0;
            const message = hasComponents
                ? 'Clear entire board? This will delete the auto-saved board state.'
                : 'Clear entire board?';

            if (confirm(message)) {
                this.stopAutoCycle();
                this.components = [];
                this.connections = [];
                this.clearBoardState();
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

        // Save Component
        document.getElementById('saveComponent').addEventListener('click', () => {
            this.showSaveComponentDialog();
        });

        document.getElementById('closeSaveDialog').addEventListener('click', () => {
            document.getElementById('saveComponentDialog').style.display = 'none';
        });

        document.getElementById('cancelSave').addEventListener('click', () => {
            document.getElementById('saveComponentDialog').style.display = 'none';
        });

        document.getElementById('confirmSave').addEventListener('click', () => {
            this.saveCurrentCircuitAsComponent();
        });

        // Manage Components
        document.getElementById('manageComponents').addEventListener('click', () => {
            this.showManageComponentsDialog();
        });

        document.getElementById('closeManageDialog').addEventListener('click', () => {
            document.getElementById('manageComponentsDialog').style.display = 'none';
        });

        // Export/Import Components
        document.getElementById('exportComponent').addEventListener('click', () => {
            this.exportComponentToFile();
        });

        document.getElementById('importComponent').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importComponentFromFile(e);
        });

        // Manual Simulation Controls
        document.getElementById('nextStep').addEventListener('click', () => {
            this.stepSimulation(1);
        });

        document.getElementById('prevStep').addEventListener('click', () => {
            this.stepSimulation(-1);
        });

        document.getElementById('resetSim').addEventListener('click', () => {
            this.resetSimulation();
        });

        // Rename Dialog
        document.getElementById('closeRenameDialog').addEventListener('click', () => {
            document.getElementById('renameDialog').style.display = 'none';
        });

        document.getElementById('cancelRename').addEventListener('click', () => {
            document.getElementById('renameDialog').style.display = 'none';
        });

        document.getElementById('confirmRename').addEventListener('click', () => {
            this.confirmRename();
        });

        // Theme Toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Canvas click
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        // Canvas double-click for rename
        this.canvas.addEventListener('dblclick', (e) => {
            this.handleCanvasDoubleClick(e);
        });

        // Canvas mousedown for dragging
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Reset hasMoved flag for all clicks
            this.hasMoved = false;

            // Only allow dragging if not in special modes and no tool selected for placement
            const isPlacementMode = this.mode === 'place' && this.selectedTool;
            if (this.mode !== 'connect' && this.mode !== 'delete' && !isPlacementMode) {
                const component = this.findComponent(x, y);
                if (component) {
                    // If a component is clicked, prepare for potential drag
                    this.isDraggingComponent = false; // Don't set true yet
                    this.draggedComponent = component;
                    this.dragStartPos = { x, y };
                    this.dragOffset.x = x - component.x;
                    this.dragOffset.y = y - component.y;
                }
            }
        });

        // Canvas mousemove for dragging and connection preview
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if we should start dragging (movement threshold)
            if (this.draggedComponent && !this.isDraggingComponent && this.dragStartPos) {
                const dx = Math.abs(x - this.dragStartPos.x);
                const dy = Math.abs(y - this.dragStartPos.y);
                if (dx > 3 || dy > 3) { // 3px movement threshold
                    this.isDraggingComponent = true;
                    this.hasMoved = true;
                    this.canvas.style.cursor = 'grabbing';
                }
            }

            // Handle component dragging
            if (this.isDraggingComponent && this.draggedComponent) {
                const newX = x - this.dragOffset.x;
                const newY = y - this.dragOffset.y;
                this.moveComponent(this.draggedComponent, newX, newY);
                this.redraw();
                e.preventDefault();
            }
            // Handle connection preview
            else if (this.mode === 'connect' && this.connectStart) {
                this.redraw();
                this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(this.connectStart.x, this.connectStart.y);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            // Update cursor based on hover
            else if (this.mode !== 'connect' && this.mode !== 'delete') {
                const isPlacementMode = this.mode === 'place' && this.selectedTool;
                if (!isPlacementMode) {
                    const component = this.findComponent(x, y);
                    this.canvas.style.cursor = component ? 'grab' : 'crosshair';
                } else {
                    this.canvas.style.cursor = 'crosshair';
                }
            }
        });

        // Canvas mouseup to stop dragging
        this.canvas.addEventListener('mouseup', () => {
            // Reset drag state
            this.isDraggingComponent = false;
            this.draggedComponent = null;
            this.dragStartPos = null;
            this.canvas.style.cursor = 'crosshair';
        });

        // Also handle mouseup outside canvas
        document.addEventListener('mouseup', () => {
            if (this.isDraggingComponent) {
                this.isDraggingComponent = false;
                this.draggedComponent = null;
                this.dragStartPos = null;
                this.canvas.style.cursor = 'crosshair';
            }
        });
    }

    handleCanvasClick(e) {
        // Don't process click if it was actually a drag
        if (this.hasMoved) {
            this.hasMoved = false;
            return;
        }

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
        let customName = null;
        let actualType = type;

        // Check if this is a custom component
        if (type.startsWith('CUSTOM:')) {
            customName = type.substring(7);
            actualType = 'CUSTOM';

            if (!this.customComponents[customName]) {
                alert('Custom component not found!');
                return;
            }
        }

        const component = {
            id: this.nextId++,
            type: actualType,
            x: Math.round(x / 50) * 50,
            y: Math.round(y / 50) * 50,
            value: actualType === 'INPUT' ? 0 : null,
            inputs: [],
            outputs: [],
            label: actualType === 'INPUT' ? `I${this.getInputCount() + 1}` :
                   actualType === 'OUTPUT' ? `O${this.getOutputCount() + 1}` :
                   actualType === 'CUSTOM' ? customName : null,
            customName: customName,
            customDefinition: customName ? this.customComponents[customName] : null
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
        } else if (type === 'CUSTOM') {
            // Custom component ports based on saved definition
            const def = component.customDefinition;
            const numInputs = def.inputPorts.length;
            const numOutputs = def.outputPorts.length;

            // Calculate spacing for ports
            const inputSpacing = Math.min(30, 60 / (numInputs + 1));
            const outputSpacing = Math.min(30, 60 / (numOutputs + 1));

            // Create input ports on the left
            for (let i = 0; i < numInputs; i++) {
                const offsetY = (i - (numInputs - 1) / 2) * inputSpacing;
                component.inputs.push({ x: x - 35, y: y + offsetY });
            }

            // Create output ports on the right
            for (let i = 0; i < numOutputs; i++) {
                const offsetY = (i - (numOutputs - 1) / 2) * outputSpacing;
                component.outputs.push({ x: x + 35, y: y + offsetY });
            }
        } else {
            // Two-input gates
            component.inputs.push({ x: x - 10, y: y - 15 });
            component.inputs.push({ x: x - 10, y: y + 15 });
            component.outputs.push({ x: x + 50, y: y });
        }
    }

    moveComponent(component, newX, newY) {
        // Update component position (snap to grid)
        component.x = Math.round(newX / 50) * 50;
        component.y = Math.round(newY / 50) * 50;

        // Clear and recalculate ports
        component.inputs = [];
        component.outputs = [];
        this.defineComponentPorts(component);
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
            let size = 50; // Increased default size for better detection
            if (c.type === 'INPUT' || c.type === 'OUTPUT') {
                size = 40; // Increased from 30 to cover full circle
            } else if (c.type === 'CUSTOM') {
                size = 70; // Increased from 60 for easier selection
            } else if (c.type === 'NOT') {
                size = 50; // NOT gates are smaller
            } else {
                // Logic gates (AND, OR, XOR, NAND, NOR, XNOR)
                size = 60; // Increased to cover full gate shape
            }
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
        this.connections.forEach((conn, index) => {
            const from = this.components.find(c => c.id === conn.from);
            const to = this.components.find(c => c.id === conn.to);

            if (!from || !to) return;

            const fromPort = from.outputs[conn.fromPort];
            const toPort = to.inputs[conn.toPort];

            // Determine color based on signal value and theme
            const value = this.getPortValue(from, conn.fromPort);
            this.ctx.strokeStyle = value === 1 ? '#4caf50' :
                                   value === 0 ? '#f44336' :
                                   (this.darkMode ? '#888' : '#666');
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();
            this.ctx.moveTo(fromPort.x, fromPort.y);

            // Improved routing with offset to avoid overlaps
            const dx = toPort.x - fromPort.x;
            const dy = toPort.y - fromPort.y;

            // Calculate offset based on port index to spread wires
            const offset = (conn.toPort - 0.5) * 10;

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal preference
                const midX = fromPort.x + dx * 0.6;
                this.ctx.lineTo(midX, fromPort.y);
                this.ctx.lineTo(midX, toPort.y + offset * 0.3);
                this.ctx.lineTo(toPort.x, toPort.y);
            } else {
                // Vertical preference
                const midY = fromPort.y + dy * 0.6;
                this.ctx.lineTo(fromPort.x, midY);
                this.ctx.lineTo(toPort.x, midY);
                this.ctx.lineTo(toPort.x, toPort.y);
            }

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
            this.ctx.strokeStyle = this.darkMode ? '#e9e9e9' : '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.darkMode ? '#e9e9e9' : '#333';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(component.label, x, y - 35);

            this.ctx.fillStyle = 'white';
            this.ctx.fillText(value.toString(), x, y);

            // Output port
            this.drawPort(component.outputs[0].x, component.outputs[0].y, true);
        } else if (type === 'OUTPUT') {
            // Draw output as a circle (same as input)
            const outputValue = this.getComponentValue(component);
            this.ctx.fillStyle = outputValue === 1 ? '#4caf50' :
                                outputValue === 0 ? '#f44336' : (this.darkMode ? '#555' : '#ccc');
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = this.darkMode ? '#e9e9e9' : '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.darkMode ? '#e9e9e9' : '#333';
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
        } else if (type === 'CUSTOM') {
            // Draw custom component
            this.drawCustomComponent(component);
        } else {
            // Draw logic gate
            this.drawGate(component);
        }

        this.ctx.restore();
    }

    drawCustomComponent(component) {
        const { x, y, label, customDefinition } = component;

        // Draw component body with theme colors
        this.ctx.fillStyle = this.darkMode ? '#1a1a2e' : '#fff3e0';
        this.ctx.strokeStyle = this.darkMode ? '#f39c12' : '#ff9800';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(x - 30, y - 30, 60, 60);
        this.ctx.strokeRect(x - 30, y - 30, 60, 60);

        // Draw label
        this.ctx.fillStyle = this.darkMode ? '#f39c12' : '#ff9800';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Wrap text if too long
        const maxWidth = 50;
        if (this.ctx.measureText(label).width > maxWidth) {
            const words = label.split(/(?=[A-Z])/); // Split on capital letters
            if (words.length > 1) {
                this.ctx.fillText(words[0], x, y - 5);
                this.ctx.fillText(words.slice(1).join(''), x, y + 5);
            } else {
                this.ctx.fillText(label.substring(0, 8), x, y - 5);
                this.ctx.fillText(label.substring(8), x, y + 5);
            }
        } else {
            this.ctx.fillText(label, x, y);
        }

        // Draw ports with labels
        this.ctx.font = 'bold 8px Arial';
        this.ctx.fillStyle = this.darkMode ? '#b3b3b3' : '#666';

        // Draw input ports with labels
        component.inputs.forEach((port, index) => {
            this.drawPort(port.x, port.y, false);

            // Draw input label to the left of the port
            if (customDefinition && customDefinition.inputPorts[index]) {
                const inputLabel = customDefinition.inputPorts[index].label;
                this.ctx.textAlign = 'right';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(inputLabel, port.x - 8, port.y);
            }
        });

        // Draw output ports with labels
        component.outputs.forEach((port, index) => {
            this.drawPort(port.x, port.y, true);

            // Draw output label to the right of the port
            if (customDefinition && customDefinition.outputPorts[index]) {
                const outputLabel = customDefinition.outputPorts[index].label;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(outputLabel, port.x + 8, port.y);
            }
        });
    }

    drawGate(component) {
        const { type, x, y } = component;

        const fillColor = this.darkMode ? '#0f3460' : '#e3f2fd';
        const strokeColor = this.darkMode ? '#53a8f4' : '#1976d2';
        const textColor = this.darkMode ? '#53a8f4' : '#1976d2';

        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;

        // Draw standard logic gate symbols
        switch(type) {
            case 'AND':
                this.drawAndGate(x, y, false);
                break;
            case 'OR':
                this.drawOrGate(x, y, false);
                break;
            case 'NOT':
                this.drawNotGate(x, y);
                break;
            case 'XOR':
                this.drawOrGate(x, y, true);
                break;
            case 'NAND':
                this.drawAndGate(x, y, true);
                break;
            case 'NOR':
                this.drawOrGate(x, y, false, true);
                break;
            case 'XNOR':
                this.drawOrGate(x, y, true, true);
                break;
        }

        // Draw ports
        component.inputs.forEach(port => {
            this.drawPort(port.x, port.y, false);
        });
        component.outputs.forEach(port => {
            this.drawPort(port.x, port.y, true);
        });
    }

    drawAndGate(x, y, inverted) {
        // AND gate shape (D-shape)
        this.ctx.beginPath();
        this.ctx.moveTo(x - 25, y - 20);
        this.ctx.lineTo(x, y - 20);
        this.ctx.arc(x, y, 20, -Math.PI/2, Math.PI/2);
        this.ctx.lineTo(x - 25, y + 20);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        if (inverted) {
            // Add inversion bubble for NAND
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    drawOrGate(x, y, isXor, inverted) {
        // OR/XOR gate shape
        this.ctx.beginPath();
        this.ctx.moveTo(x - 25, y - 20);
        // Curved back
        this.ctx.quadraticCurveTo(x - 15, y, x - 25, y + 20);
        // Bottom to output curve
        this.ctx.quadraticCurveTo(x - 5, y + 15, x + 20, y);
        // Top curve back
        this.ctx.quadraticCurveTo(x - 5, y - 15, x - 25, y - 20);
        this.ctx.fill();
        this.ctx.stroke();

        if (isXor) {
            // Extra line for XOR
            this.ctx.beginPath();
            this.ctx.moveTo(x - 30, y - 20);
            this.ctx.quadraticCurveTo(x - 20, y, x - 30, y + 20);
            this.ctx.stroke();
        }

        if (inverted) {
            // Add inversion bubble for NOR/XNOR
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    drawNotGate(x, y) {
        // NOT gate - triangle with bubble
        this.ctx.beginPath();
        this.ctx.moveTo(x - 20, y - 15);
        this.ctx.lineTo(x - 20, y + 15);
        this.ctx.lineTo(x + 15, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Inversion circle
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
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
            if (!sourceComponent) {
                return null; // Source component not found
            }

            // Get value from the specific output port (critical for multi-output components!)
            const portValue = this.getPortValue(sourceComponent, connection.fromPort);
            if (portValue === null) {
                return null; // Source port not yet calculated
            }

            inputValues.push(portValue);
        }

        // Calculate output based on gate type
        if (component.type === 'CUSTOM') {
            return this.evaluateCustomComponent(component, inputValues);
        } else {
            return this.evaluateGate(component.type, inputValues);
        }
    }

    evaluateCustomComponent(component, inputValues) {
        const def = component.customDefinition;

        // Create a temporary circuit for simulation
        const tempComponents = JSON.parse(JSON.stringify(def.components));
        const tempConnections = JSON.parse(JSON.stringify(def.connections));

        // Set input values on the internal INPUT components
        def.inputPorts.forEach((inputPort, index) => {
            const internalInput = tempComponents.find(c => c.id === inputPort.id);
            if (internalInput) {
                internalInput.value = inputValues[index];
            }
        });

        // Simulate the internal circuit
        let changed = true;
        let iterations = 0;
        const maxIterations = 100;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            tempComponents.forEach(comp => {
                if (comp.type === 'INPUT') return;

                const oldValue = comp.value;
                const newValue = this.calculateInternalComponentValue(comp, tempComponents, tempConnections);

                if (newValue !== null && newValue !== oldValue) {
                    comp.value = newValue;
                    changed = true;
                }
            });
        }

        // Get ALL output values (not just the first one!)
        const outputValues = [];
        def.outputPorts.forEach(outputPort => {
            const internalOutput = tempComponents.find(c => c.id === outputPort.id);
            outputValues.push(internalOutput ? internalOutput.value : null);
        });

        // Store output values in the component for multi-output support
        component.outputValues = outputValues;

        // Return first output for backward compatibility with single-output components
        return outputValues[0];
    }

    calculateInternalComponentValue(component, components, connections) {
        const inputValues = [];

        // Get input values from internal connections
        for (let i = 0; i < component.inputs.length; i++) {
            const connection = connections.find(
                c => c.to === component.id && c.toPort === i
            );

            if (!connection) {
                return null;
            }

            const sourceComponent = components.find(c => c.id === connection.from);
            if (!sourceComponent || sourceComponent.value === null) {
                return null;
            }

            inputValues.push(sourceComponent.value);
        }

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
        // For custom components with multiple outputs, return the specific output value
        if (component.type === 'CUSTOM' && component.outputValues) {
            return component.outputValues[portIndex] !== undefined ? component.outputValues[portIndex] : null;
        }
        // For regular components with single output
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

    // Custom Component Management Methods
    loadCustomComponents() {
        const saved = localStorage.getItem('customComponents');
        if (saved) {
            try {
                this.customComponents = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load custom components:', e);
                this.customComponents = {};
            }
        }
    }

    saveCustomComponentsToStorage() {
        try {
            localStorage.setItem('customComponents', JSON.stringify(this.customComponents));
        } catch (e) {
            console.error('Failed to save custom components:', e);
            alert('Failed to save components to storage.');
        }
    }

    showSaveComponentDialog() {
        if (this.components.length === 0) {
            alert('Please create a circuit before saving it as a component.');
            return;
        }

        const inputs = this.components.filter(c => c.type === 'INPUT');
        const outputs = this.components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0 || outputs.length === 0) {
            alert('Your circuit must have at least one INPUT and one OUTPUT to be saved as a component.');
            return;
        }

        // Clear form
        document.getElementById('componentName').value = '';
        document.getElementById('componentDescription').value = '';

        // Show dialog
        document.getElementById('saveComponentDialog').style.display = 'block';
    }

    saveCurrentCircuitAsComponent() {
        const name = document.getElementById('componentName').value.trim();
        const description = document.getElementById('componentDescription').value.trim();

        if (!name) {
            alert('Please enter a component name.');
            return;
        }

        // Check if name already exists
        if (this.customComponents[name]) {
            if (!confirm(`A component named "${name}" already exists. Overwrite it?`)) {
                return;
            }
        }

        // Prepare component data
        const inputs = this.components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));
        const outputs = this.components.filter(c => c.type === 'OUTPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        // Deep clone components and connections
        const componentData = {
            name: name,
            description: description,
            components: JSON.parse(JSON.stringify(this.components)),
            connections: JSON.parse(JSON.stringify(this.connections)),
            inputPorts: inputs.map(i => ({ id: i.id, label: i.label })),
            outputPorts: outputs.map(o => ({ id: o.id, label: o.label })),
            created: new Date().toISOString()
        };

        this.customComponents[name] = componentData;
        this.saveCustomComponentsToStorage();
        this.updateCustomComponentsList();

        document.getElementById('saveComponentDialog').style.display = 'none';
        alert(`Component "${name}" saved successfully!`);
    }

    updateCustomComponentsList() {
        const dropdown = document.getElementById('customComponentsDropdown');
        const section = document.getElementById('customComponentsSection');

        const componentNames = Object.keys(this.customComponents);

        if (componentNames.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select a component...</option>';

        // Add custom components as options
        componentNames.sort().forEach(name => {
            const option = document.createElement('option');
            option.value = 'CUSTOM:' + name;
            option.textContent = name;
            dropdown.appendChild(option);
        });

        // Add event listener for dropdown change
        dropdown.onchange = (e) => {
            if (e.target.value) {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                this.selectedTool = e.target.value;
                this.mode = 'place';
                this.updateModeIndicator();
            }
        };
    }

    showManageComponentsDialog() {
        this.updateComponentLibraryList();
        document.getElementById('manageComponentsDialog').style.display = 'block';
    }

    updateComponentLibraryList() {
        const list = document.getElementById('componentLibraryList');
        const componentNames = Object.keys(this.customComponents);

        if (componentNames.length === 0) {
            list.innerHTML = `
                <div class="empty-library">
                    <div class="empty-library-icon">📦</div>
                    <p>No custom components saved yet.</p>
                    <p style="font-size: 0.9em;">Create a circuit and click "Save as Component" to get started.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';

        componentNames.sort().forEach(name => {
            const component = this.customComponents[name];
            const item = document.createElement('div');
            item.className = 'library-item';

            const date = new Date(component.created).toLocaleDateString();

            item.innerHTML = `
                <div class="library-item-header">
                    <div class="library-item-name">${name}</div>
                </div>
                ${component.description ? `<div class="library-item-description">${component.description}</div>` : ''}
                <div class="library-item-info">
                    ${component.inputPorts.length} input(s), ${component.outputPorts.length} output(s) • Created: ${date}
                </div>
                <div class="library-item-actions">
                    <button class="edit-btn" data-name="${name}">Edit</button>
                    <button class="export-btn" data-name="${name}">Export</button>
                    <button class="delete-btn" data-name="${name}">Delete</button>
                </div>
            `;

            // Add edit handler
            item.querySelector('.edit-btn').addEventListener('click', () => {
                this.loadComponentForEditing(name);
            });

            // Add export handler
            item.querySelector('.export-btn').addEventListener('click', () => {
                this.downloadComponent(name);
            });

            // Add delete handler
            item.querySelector('.delete-btn').addEventListener('click', () => {
                if (confirm(`Delete component "${name}"?`)) {
                    delete this.customComponents[name];
                    this.saveCustomComponentsToStorage();
                    this.updateCustomComponentsList();
                    this.updateComponentLibraryList();
                }
            });

            list.appendChild(item);
        });
    }

    // Export/Import Methods
    exportComponentToFile() {
        const componentNames = Object.keys(this.customComponents);

        if (componentNames.length === 0) {
            alert('No custom components to export. Please save a component first.');
            return;
        }

        if (componentNames.length === 1) {
            // Export the only component
            this.downloadComponent(componentNames[0]);
        } else {
            // Let user choose which component to export
            const name = prompt('Enter component name to export:\n\n' + componentNames.join('\n'));
            if (name && this.customComponents[name]) {
                this.downloadComponent(name);
            } else if (name) {
                alert('Component not found.');
            }
        }
    }

    downloadComponent(name) {
        const component = this.customComponents[name];
        const dataStr = JSON.stringify(component, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`Component "${name}" exported successfully!`);
    }

    importComponentFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const componentData = JSON.parse(e.target.result);

                // Validate component data
                if (!componentData.name || !componentData.components || !componentData.connections) {
                    throw new Error('Invalid component file format');
                }

                // Check if component already exists
                if (this.customComponents[componentData.name]) {
                    if (!confirm(`Component "${componentData.name}" already exists. Overwrite it?`)) {
                        return;
                    }
                }

                this.customComponents[componentData.name] = componentData;
                this.saveCustomComponentsToStorage();
                this.updateCustomComponentsList();

                alert(`Component "${componentData.name}" imported successfully!`);
            } catch (error) {
                alert('Failed to import component: ' + error.message);
            }
        };
        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    }

    // Edit Component Method
    loadComponentForEditing(name) {
        if (!this.customComponents[name]) {
            alert('Component not found.');
            return;
        }

        if (this.components.length > 0) {
            // First ask if they want to continue
            const continueMessage = 'Loading this component will replace your current board.\n\n' +
                                  'Do you want to continue?';
            if (!confirm(continueMessage)) {
                return;
            }

            // Then ask if they want to save
            const saveMessage = 'Would you like to save the current board state?\n\n' +
                              'OK = Save current board (can restore by reloading page)\n' +
                              'Cancel = Discard current board';
            if (confirm(saveMessage)) {
                this.saveBoardState();
            } else {
                // User chose to discard - clear the auto-saved state
                this.clearBoardState();
            }
        }

        this.stopAutoCycle();

        const componentData = this.customComponents[name];

        // Deep clone the component data
        this.components = JSON.parse(JSON.stringify(componentData.components));
        this.connections = JSON.parse(JSON.stringify(componentData.connections));

        // Update nextId to avoid conflicts
        const maxId = Math.max(...this.components.map(c => c.id), 0);
        this.nextId = maxId + 1;

        this.redraw();
        document.getElementById('manageComponentsDialog').style.display = 'none';

        alert(`Component "${name}" loaded for editing. Make your changes and save it again.`);
    }

    // Manual Simulation Step Controls
    stepSimulation(direction) {
        const inputs = this.components.filter(c => c.type === 'INPUT').sort((a, b) =>
            a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            alert('Please add at least one input to simulate.');
            return;
        }

        const totalCombinations = Math.pow(2, inputs.length);

        // If no current index, start from 0
        if (this.currentCycleIndex === undefined || this.currentCycleIndex === null) {
            this.currentCycleIndex = 0;
        }

        // Calculate new index
        this.currentCycleIndex += direction;

        // Wrap around
        if (this.currentCycleIndex < 0) {
            this.currentCycleIndex = totalCombinations - 1;
        } else if (this.currentCycleIndex >= totalCombinations) {
            this.currentCycleIndex = 0;
        }

        // Set input values
        inputs.forEach((input, index) => {
            const bitValue = (this.currentCycleIndex >> (inputs.length - 1 - index)) & 1;
            input.value = bitValue;
        });

        // Simulate
        this.simulate();

        // Update display
        document.getElementById('selectedComponent').textContent =
            `Combination ${this.currentCycleIndex + 1} / ${totalCombinations}`;
    }

    resetSimulation() {
        const inputs = this.components.filter(c => c.type === 'INPUT');

        if (inputs.length === 0) {
            alert('No inputs to reset.');
            return;
        }

        this.currentCycleIndex = 0;

        // Set all inputs to 0
        inputs.forEach(input => {
            input.value = 0;
        });

        // Simulate
        this.simulate();

        const totalCombinations = Math.pow(2, inputs.length);
        document.getElementById('selectedComponent').textContent =
            `Combination 1 / ${totalCombinations}`;
    }

    // Rename Methods
    handleCanvasDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const component = this.findComponent(x, y);

        if (component && (component.type === 'INPUT' || component.type === 'OUTPUT')) {
            this.showRenameDialog(component);
        }
    }

    showRenameDialog(component) {
        this.renameTarget = component;
        document.getElementById('newComponentLabel').value = component.label;
        document.getElementById('renameDialog').style.display = 'block';

        // Focus and select the input
        setTimeout(() => {
            const input = document.getElementById('newComponentLabel');
            input.focus();
            input.select();
        }, 100);
    }

    confirmRename() {
        const newLabel = document.getElementById('newComponentLabel').value.trim();

        if (!newLabel) {
            alert('Please enter a label.');
            return;
        }

        if (this.renameTarget) {
            this.renameTarget.label = newLabel;
            this.redraw();
        }

        document.getElementById('renameDialog').style.display = 'none';
        this.renameTarget = null;
    }

    // Theme Management Methods
    applyTheme() {
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('themeToggle').textContent = '🌙';
        }
        this.redraw();
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        this.applyTheme();
    }

    // Draggable Truth Table
    setupDraggableTruthTable() {
        const panel = document.getElementById('truthTablePanel');
        const header = panel.querySelector('.panel-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'closeTruthTable') return; // Don't drag when clicking close button

            isDragging = true;
            initialX = e.clientX - (panel.offsetLeft || 0);
            initialY = e.clientY - (panel.offsetTop || 0);

            // Remove transform to use absolute positioning
            panel.style.transform = 'none';
            panel.style.left = panel.offsetLeft + 'px';
            panel.style.top = panel.offsetTop + 'px';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            panel.style.left = currentX + 'px';
            panel.style.top = currentY + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Auto-Save Functionality
    setupAutoSave() {
        // Auto-save on every change
        const originalRedraw = this.redraw.bind(this);
        this.redraw = () => {
            originalRedraw();
            this.saveBoardState();
        };

        // Warn before leaving page if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.components.length > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsaved work. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    saveBoardState() {
        const state = {
            components: this.components,
            connections: this.connections,
            nextId: this.nextId
        };
        localStorage.setItem('circuitBoardState', JSON.stringify(state));
    }

    loadBoardState() {
        const saved = localStorage.getItem('circuitBoardState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.components = state.components || [];
                this.connections = state.connections || [];
                this.nextId = state.nextId || 1;
            } catch (e) {
                console.error('Failed to load board state:', e);
            }
        }
    }

    clearBoardState() {
        localStorage.removeItem('circuitBoardState');
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
