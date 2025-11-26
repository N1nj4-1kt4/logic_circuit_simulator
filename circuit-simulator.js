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

        // Board management
        this.currentBoardName = null; // null means unsaved board
        this.currentComponentName = null; // null means not a saved component
        this.savedBoards = {};
        this.lastSavedState = null; // To track if board has been modified
        this.pendingActionAfterSave = null; // Callback after save dialog
        this.truthTableData = null; // Store truth table data for highlighting

        this.init();
    }

    init() {
        this.loadCustomComponents();
        this.loadSavedBoards();
        this.setupEventListeners();
        this.setupBoardManagementListeners();
        this.setupDraggableTruthTable();
        this.setupAutoSave();
        this.loadBoardState();
        this.drawGrid();
        this.updateCustomComponentsList();
        this.updateBoardsList();
        this.updateCircuitNameDisplay();
        this.applyTheme();
    }

    getScaledCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    exitToNeutralMode() {
        // Clear all selections
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));

        // Reset state
        this.selectedTool = null;
        this.mode = 'neutral';
        this.connectStart = null;

        // Update UI
        this.updateModeIndicator();
        this.redraw(); // Clear any visual artifacts (like incomplete connector lines)

        // Visual feedback
        console.log('Exited to neutral mode');
    }

    setupEventListeners() {
        // Tool selection with toggle
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const isAlreadySelected = e.currentTarget.classList.contains('selected');

                // Clear all selections
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));

                if (isAlreadySelected) {
                    // Toggle off - return to neutral mode
                    this.selectedTool = null;
                    this.mode = 'neutral';
                } else {
                    // Select this tool
                    e.currentTarget.classList.add('selected');
                    this.selectedTool = e.currentTarget.dataset.type;
                    this.mode = 'place';
                }
                this.updateModeIndicator();
            });
        });

        // Action buttons with toggle
        document.getElementById('connectMode').addEventListener('click', () => {
            const btn = document.getElementById('connectMode');
            const isAlreadyActive = btn.classList.contains('active');

            // Clear all selections
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
            this.selectedTool = null;

            if (isAlreadyActive) {
                // Toggle off - return to neutral mode
                this.mode = 'neutral';
                this.connectStart = null;
            } else {
                // Activate connect mode
                btn.classList.add('active');
                this.mode = 'connect';
                this.connectStart = null;
            }
            this.updateModeIndicator();
        });

        document.getElementById('deleteMode').addEventListener('click', () => {
            const btn = document.getElementById('deleteMode');
            const isAlreadyActive = btn.classList.contains('active');

            // Clear all selections
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
            this.selectedTool = null;

            if (isAlreadyActive) {
                // Toggle off - return to neutral mode
                this.mode = 'neutral';
            } else {
                // Activate delete mode
                btn.classList.add('active');
                this.mode = 'delete';
            }
            this.updateModeIndicator();
        });

        document.getElementById('clearBoard').addEventListener('click', () => {
            if (this.hasUnsavedChanges()) {
                this.showSaveOptionsDialog(() => {
                    this.createNewBoard();
                });
            } else {
                if (confirm('Clear entire board?')) {
                    this.createNewBoard();
                }
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.exitToNeutralMode();
            }
        });

        // Right-click on canvas to exit mode
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent context menu
            e.stopPropagation();
            console.log('Right-click detected - exiting to neutral mode');
            this.exitToNeutralMode();
            return false;
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
            const { x, y } = this.getScaledCoordinates(e);

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
            const { x, y } = this.getScaledCoordinates(e);

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

        const { x, y } = this.getScaledCoordinates(e);

        console.log('Canvas click - Mode:', this.mode, 'SelectedTool:', this.selectedTool);
        console.log('Scaled coords:', x.toFixed(0), y.toFixed(0));

        if (this.mode === 'place' && this.selectedTool) {
            this.placeComponent(x, y, this.selectedTool);
        } else if (this.mode === 'connect') {
            console.log('Calling handleConnect');
            this.handleConnect(x, y);
        } else if (this.mode === 'delete') {
            console.log('Calling handleDelete');
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
            // Input circle has radius 20, shift port 3px outside edge
            component.outputs.push({ x: x + 23, y: y });
        } else if (type === 'OUTPUT') {
            // Output circle has radius 20, port 2px outside left edge
            component.inputs.push({ x: x - 22, y: y });
        } else if (type === 'NOT') {
            // NOT gate: input 2px outside, output 3px outside
            component.inputs.push({ x: x - 22, y: y });
            component.outputs.push({ x: x + 28, y: y });
        } else if (type === 'NAND' || type === 'NOR' || type === 'XNOR') {
            // Inverted gates: inputs 2px outside, output 3px outside
            component.inputs.push({ x: x - 27, y: y - 15 });
            component.inputs.push({ x: x - 27, y: y + 15 });
            component.outputs.push({ x: x + 33, y: y });
        } else if (type === 'CUSTOM') {
            // Custom component ports (90x90 size - 15% larger for better visibility)
            const def = component.customDefinition;
            const numInputs = def.inputPorts.length;
            const numOutputs = def.outputPorts.length;

            // Calculate spacing for ports (based on 90x90 size)
            const inputSpacing = Math.min(40, 90 / (numInputs + 1));
            const outputSpacing = Math.min(40, 90 / (numOutputs + 1));

            // Create input ports 2px outside left edge (rect is from x - 45 to x + 45)
            for (let i = 0; i < numInputs; i++) {
                const offsetY = (i - (numInputs - 1) / 2) * inputSpacing;
                component.inputs.push({ x: x - 47, y: y + offsetY });
            }

            // Create output ports 3px outside right edge
            for (let i = 0; i < numOutputs; i++) {
                const offsetY = (i - (numOutputs - 1) / 2) * outputSpacing;
                component.outputs.push({ x: x + 48, y: y + offsetY });
            }
        } else {
            // AND, OR, XOR gates (non-inverted): inputs 2px outside, output 3px outside
            component.inputs.push({ x: x - 27, y: y - 15 });
            component.inputs.push({ x: x - 27, y: y + 15 });
            component.outputs.push({ x: x + 23, y: y });
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
        console.log('findPort result:', port);

        if (!port) {
            console.log('No port found at', x, y);
            return;
        }

        if (!this.connectStart) {
            // Start connection from output port only
            if (port.isOutput) {
                console.log('Starting connection from output port');
                this.connectStart = {
                    component: port.component,
                    portIndex: port.portIndex,
                    x: port.x,
                    y: port.y
                };
            } else {
                console.log('Clicked port is not an output port');
            }
        } else {
            // End connection at input port only
            if (!port.isOutput) {
                console.log('Completing connection to input port');
                this.connections.push({
                    from: this.connectStart.component,
                    fromPort: this.connectStart.portIndex,
                    to: port.component,
                    toPort: port.portIndex
                });
                this.connectStart = null;
                this.redraw();
            } else {
                console.log('Clicked port is not an input port');
            }
        }
    }

    handleDelete(x, y) {
        console.log('Total components on board:', this.components.length);
        console.log('Components:', this.components.map(c => ({type: c.type, x: c.x, y: c.y, id: c.id})));

        // Delete component
        const component = this.findComponent(x, y);
        console.log('findComponent result:', component);
        console.log('Clicked at:', x, y);

        if (component) {
            console.log('Deleting component:', component.type, component.id);
            this.components = this.components.filter(c => c.id !== component.id);
            this.connections = this.connections.filter(
                conn => conn.from !== component.id && conn.to !== component.id
            );
            this.redraw();
            return;
        } else {
            console.log('No component found at', x, y);
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
            this.simulate(); // Simulate to update output values
            this.redraw();
            this.updateTruthTableHighlight(); // Update truth table highlighting
        }
    }

    findComponent(x, y) {
        return this.components.find(c => {
            let size = 50; // Increased default size for better detection
            if (c.type === 'INPUT' || c.type === 'OUTPUT') {
                size = 40; // Increased from 30 to cover full circle
            } else if (c.type === 'CUSTOM') {
                size = 100; // Updated for new 90x90 component size
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

    // Recalculate port positions for a component (for migrating old saved boards)
    recalculateComponentPorts(component) {
        // Clear existing ports
        component.inputs = [];
        component.outputs = [];

        // Recalculate using current logic
        this.defineComponentPorts(component);
    }

    // Migrate all components in a board to use current port positions
    migrateComponentPorts() {
        this.components.forEach(component => {
            this.recalculateComponentPorts(component);
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

        // Draw component body with theme colors (90x90 size - 15% larger)
        this.ctx.fillStyle = this.darkMode ? '#1a1a2e' : '#fff3e0';
        this.ctx.strokeStyle = this.darkMode ? '#f39c12' : '#ff9800';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(x - 45, y - 45, 90, 90);
        this.ctx.strokeRect(x - 45, y - 45, 90, 90);

        // Draw label (larger font for better readability)
        this.ctx.fillStyle = this.darkMode ? '#f39c12' : '#ff9800';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Wrap text if too long
        const maxWidth = 80;
        if (this.ctx.measureText(label).width > maxWidth) {
            const words = label.split(/(?=[A-Z])/); // Split on capital letters
            if (words.length > 1) {
                this.ctx.fillText(words[0], x, y - 7);
                this.ctx.fillText(words.slice(1).join(''), x, y + 7);
            } else {
                this.ctx.fillText(label.substring(0, 10), x, y - 7);
                this.ctx.fillText(label.substring(10), x, y + 7);
            }
        } else {
            this.ctx.fillText(label, x, y);
        }

        // Draw ports with labels (larger font)
        this.ctx.font = 'bold 11px Arial';
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

        // Store truth table data for highlighting
        this.truthTableData = {
            inputs: inputs,
            outputs: outputs,
            table: table
        };

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
        table.forEach((row, index) => {
            html += `<tr data-row-index="${index}">`;
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

        // Highlight the row matching current circuit state
        this.updateTruthTableHighlight();

        // Position panel to avoid overlapping with circuit components
        this.positionPanelSmartly(panel);
    }

    getComponentsBoundingBox() {
        // Calculate the bounding box of all components on the canvas
        if (this.components.length === 0) {
            return null;
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.components.forEach(component => {
            const { x, y, type } = component;

            // Estimate component size based on type
            let width = 50, height = 50;
            if (type === 'INPUT' || type === 'OUTPUT') {
                width = height = 40;
            } else if (type === 'CUSTOM') {
                width = height = 90;
            } else if (type === 'NOT') {
                width = 45;
                height = 40;
            } else {
                // Logic gates
                width = 50;
                height = 40;
            }

            minX = Math.min(minX, x - width);
            minY = Math.min(minY, y - height);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });

        // Convert canvas coordinates to viewport coordinates
        const canvasRect = this.canvas.getBoundingClientRect();

        return {
            left: canvasRect.left + (minX / this.canvas.width) * canvasRect.width,
            top: canvasRect.top + (minY / this.canvas.height) * canvasRect.height,
            right: canvasRect.left + (maxX / this.canvas.width) * canvasRect.width,
            bottom: canvasRect.top + (maxY / this.canvas.height) * canvasRect.height,
            width: ((maxX - minX) / this.canvas.width) * canvasRect.width,
            height: ((maxY - minY) / this.canvas.height) * canvasRect.height
        };
    }

    positionPanelSmartly(panel) {
        // Reset to default centered position first to measure panel size
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.left = '50%';
        panel.style.top = '50%';

        // Force a reflow to get accurate measurements
        panel.offsetHeight;

        const panelRect = panel.getBoundingClientRect();
        const panelWidth = panelRect.width;
        const panelHeight = panelRect.height;

        const componentBox = this.getComponentsBoundingBox();
        const canvasRect = this.canvas.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Define candidate positions (with margins from edges)
        const margin = 20;
        const positions = [];

        // If no components, just center it
        if (!componentBox) {
            return; // Keep centered position
        }

        // Try right side of canvas
        if (canvasRect.right + margin + panelWidth < viewportWidth) {
            positions.push({
                left: canvasRect.right + margin,
                top: Math.max(margin, Math.min(canvasRect.top, viewportHeight - panelHeight - margin)),
                score: 100 // Prefer right side
            });
        }

        // Try left side of canvas
        if (canvasRect.left - margin - panelWidth > 0) {
            positions.push({
                left: canvasRect.left - panelWidth - margin,
                top: Math.max(margin, Math.min(canvasRect.top, viewportHeight - panelHeight - margin)),
                score: 90
            });
        }

        // Try below canvas
        if (canvasRect.bottom + margin + panelHeight < viewportHeight) {
            positions.push({
                left: Math.max(margin, Math.min(canvasRect.left, viewportWidth - panelWidth - margin)),
                top: canvasRect.bottom + margin,
                score: 80
            });
        }

        // Try above canvas
        if (canvasRect.top - margin - panelHeight > 0) {
            positions.push({
                left: Math.max(margin, Math.min(canvasRect.left, viewportWidth - panelWidth - margin)),
                top: canvasRect.top - panelHeight - margin,
                score: 70
            });
        }

        // Try bottom-right corner (over canvas but avoiding components)
        if (componentBox.right + margin + panelWidth < canvasRect.right) {
            positions.push({
                left: componentBox.right + margin,
                top: Math.max(canvasRect.top + margin, Math.min(componentBox.top, canvasRect.bottom - panelHeight - margin)),
                score: 60
            });
        }

        // Try top-right corner
        if (componentBox.right + margin + panelWidth < canvasRect.right) {
            positions.push({
                left: componentBox.right + margin,
                top: canvasRect.top + margin,
                score: 50
            });
        }

        // Try bottom-left corner
        if (componentBox.left - margin - panelWidth > canvasRect.left) {
            positions.push({
                left: componentBox.left - panelWidth - margin,
                top: Math.max(canvasRect.top + margin, Math.min(componentBox.top, canvasRect.bottom - panelHeight - margin)),
                score: 40
            });
        }

        // If we have candidate positions, choose the best one
        if (positions.length > 0) {
            // Sort by score (higher is better)
            positions.sort((a, b) => b.score - a.score);
            const best = positions[0];

            // Apply the position (remove transform and use absolute positioning)
            panel.style.transform = 'none';
            panel.style.left = best.left + 'px';
            panel.style.top = best.top + 'px';
        } else {
            // Fallback: position to the right of component bounding box on canvas
            const fallbackLeft = Math.min(
                componentBox.right + margin,
                canvasRect.right - panelWidth - margin
            );
            const fallbackTop = Math.max(
                margin,
                Math.min(componentBox.top, viewportHeight - panelHeight - margin)
            );

            panel.style.transform = 'none';
            panel.style.left = fallbackLeft + 'px';
            panel.style.top = fallbackTop + 'px';
        }
    }

    getCurrentInputState() {
        // Get current input values sorted by label (same order as truth table)
        const inputs = this.components
            .filter(c => c.type === 'INPUT')
            .sort((a, b) => a.label.localeCompare(b.label));

        return inputs.map(input => input.value);
    }

    findMatchingTruthTableRow() {
        if (!this.truthTableData) {
            return -1; // No truth table generated yet
        }

        const currentState = this.getCurrentInputState();

        // Check if circuit is in active state (all inputs have valid values)
        if (currentState.some(val => val === null || val === undefined)) {
            return -1; // Circuit not in active state
        }

        // Find the row that matches current input state
        return this.truthTableData.table.findIndex(row => {
            return row.inputs.every((val, index) => val === currentState[index]);
        });
    }

    updateTruthTableHighlight() {
        const panel = document.getElementById('truthTablePanel');

        // Only update if truth table is visible
        if (!panel || panel.style.display === 'none') {
            return;
        }

        if (!this.truthTableData) {
            return; // No truth table data available
        }

        // Remove existing highlighting
        const allRows = panel.querySelectorAll('tbody tr');
        allRows.forEach(row => row.classList.remove('truth-table-active'));

        // Find and highlight matching row
        const matchingRowIndex = this.findMatchingTruthTableRow();
        if (matchingRowIndex >= 0) {
            const matchingRow = panel.querySelector(`tbody tr[data-row-index="${matchingRowIndex}"]`);
            if (matchingRow) {
                matchingRow.classList.add('truth-table-active');
            }
        }
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

        // Update truth table highlighting
        this.updateTruthTableHighlight();

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

        // Pre-fill with current component name if it exists
        if (this.currentComponentName) {
            document.getElementById('componentName').value = this.currentComponentName;
            // Optionally load description from saved component
            const savedComponent = this.customComponents[this.currentComponentName];
            if (savedComponent && savedComponent.description) {
                document.getElementById('componentDescription').value = savedComponent.description;
            } else {
                document.getElementById('componentDescription').value = '';
            }
        } else {
            document.getElementById('componentName').value = '';
            document.getElementById('componentDescription').value = '';
        }

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

        // Update current circuit name to reflect it's now a saved component
        this.currentComponentName = name;
        this.currentBoardName = null; // Clear board name when saving as component
        this.lastSavedState = JSON.stringify(this.getCurrentState());
        this.updateCircuitNameDisplay();

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

        const doLoad = () => {
            this.stopAutoCycle();

            const componentData = this.customComponents[name];

            // Deep clone the component data
            this.components = JSON.parse(JSON.stringify(componentData.components));
            this.connections = JSON.parse(JSON.stringify(componentData.connections));

            // Update nextId to avoid conflicts
            const maxId = Math.max(...this.components.map(c => c.id), 0);
            this.nextId = maxId + 1;

            // Track that this is loaded from a component (not a board)
            this.currentBoardName = null;
            this.currentComponentName = name; // Set component name
            this.lastSavedState = null;

            // Recalculate port positions for all components (migrate old components to new port positions)
            this.migrateComponentPorts();

            this.redraw();
            this.updateCircuitNameDisplay();
            document.getElementById('manageComponentsDialog').style.display = 'none';
            alert(`Component "${name}" loaded for editing. Make your changes and save it again.`);
        };

        if (this.hasUnsavedChanges()) {
            this.showSaveOptionsDialog(doLoad);
        } else {
            doLoad();
        }
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

        // Update truth table highlighting
        this.updateTruthTableHighlight();
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

        // Update truth table highlighting
        this.updateTruthTableHighlight();
    }

    // Rename Methods
    handleCanvasDoubleClick(e) {
        const { x, y } = this.getScaledCoordinates(e);
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

                // Recalculate port positions for auto-saved state (migrate to new positions)
                if (this.components.length > 0) {
                    this.migrateComponentPorts();
                }
            } catch (e) {
                console.error('Failed to load board state:', e);
            }
        }
    }

    clearBoardState() {
        localStorage.removeItem('circuitBoardState');
    }

    // ===== BOARD MANAGEMENT METHODS =====

    loadSavedBoards() {
        const saved = localStorage.getItem('savedBoards');
        if (saved) {
            try {
                this.savedBoards = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load saved boards:', e);
                this.savedBoards = {};
            }
        }
    }

    saveBoardsToStorage() {
        localStorage.setItem('savedBoards', JSON.stringify(this.savedBoards));
    }

    getNextBoardName() {
        let counter = 1;
        let name;
        do {
            name = `Board${String(counter).padStart(2, '0')}`;
            counter++;
        } while (this.savedBoards[name] || this.customComponents[name]);
        return name;
    }

    getCurrentState() {
        return {
            components: JSON.parse(JSON.stringify(this.components)),
            connections: JSON.parse(JSON.stringify(this.connections)),
            nextId: this.nextId
        };
    }

    hasUnsavedChanges() {
        if (this.components.length === 0 && !this.currentBoardName) {
            return false; // Empty unsaved board
        }

        const currentState = JSON.stringify(this.getCurrentState());
        return currentState !== this.lastSavedState;
    }

    saveCurrentBoard(boardName) {
        const state = this.getCurrentState();
        this.savedBoards[boardName] = {
            ...state,
            savedAt: Date.now(),
            createdFrom: this.currentBoardName ?
                { type: 'board', name: this.currentBoardName } : null
        };
        this.saveBoardsToStorage();
        this.currentBoardName = boardName;
        this.currentComponentName = null; // Clear component name when saving as board
        this.lastSavedState = JSON.stringify(state);
        this.updateCircuitNameDisplay();
        this.updateBoardsList();
        console.log(`Board saved: ${boardName}`);
    }

    loadBoard(boardName) {
        if (!this.savedBoards[boardName]) {
            alert(`Board "${boardName}" not found.`);
            return;
        }

        const board = this.savedBoards[boardName];
        this.components = JSON.parse(JSON.stringify(board.components || []));
        this.connections = JSON.parse(JSON.stringify(board.connections || []));
        this.nextId = board.nextId || 1;
        this.currentBoardName = boardName;
        this.currentComponentName = null; // Clear component name when loading board

        // Recalculate port positions for all components (migrate old boards to new port positions)
        this.migrateComponentPorts();

        this.lastSavedState = JSON.stringify(this.getCurrentState());
        this.redraw();
        this.updateCircuitNameDisplay();
        this.updateBoardsList(); // Update dropdown to reflect current board
        console.log(`Board loaded: ${boardName}`);
    }

    createNewBoard() {
        this.components = [];
        this.connections = [];
        this.nextId = 1;
        this.currentBoardName = null;
        this.currentComponentName = null; // Clear both names
        this.lastSavedState = null;
        this.redraw();
        this.updateCircuitNameDisplay();
        this.updateBoardsList(); // Update dropdown to remove (current) marker
        console.log('New board created');
    }

    deleteBoard(boardName) {
        if (confirm(`Are you sure you want to delete board "${boardName}"?`)) {
            delete this.savedBoards[boardName];
            this.saveBoardsToStorage();
            if (this.currentBoardName === boardName) {
                this.currentBoardName = null;
            }
            this.updateBoardsList();
            this.updateCurrentBoardDisplay();
            console.log(`Board deleted: ${boardName}`);
        }
    }

    updateCircuitNameDisplay() {
        // Update canvas header circuit name
        const canvasHeaderElement = document.getElementById('currentCircuitName');
        if (canvasHeaderElement) {
            let displayName;
            if (this.currentComponentName) {
                displayName = `${this.currentComponentName} (Component)`;
            } else if (this.currentBoardName) {
                displayName = this.currentBoardName;
            } else {
                displayName = 'Unsaved Board';
            }
            canvasHeaderElement.textContent = displayName;
        }
    }

    // Legacy method name for compatibility
    updateCurrentBoardDisplay() {
        this.updateCircuitNameDisplay();
    }

    updateBoardsList() {
        const dropdown = document.getElementById('savedBoardsDropdown');
        const section = document.getElementById('savedBoardsSection');

        const boardNames = Object.keys(this.savedBoards);

        if (boardNames.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        dropdown.innerHTML = '<option value="">Select a board...</option>';

        // Sort all boards alphabetically
        boardNames.sort();

        // If there's a current board, show it at top with separator
        if (this.currentBoardName && this.savedBoards[this.currentBoardName]) {
            const currentOption = document.createElement('option');
            currentOption.value = this.currentBoardName;
            currentOption.textContent = `${this.currentBoardName} (current)`;
            dropdown.appendChild(currentOption);

            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '─────';
            dropdown.appendChild(separator);

            // Add other boards (excluding current)
            boardNames.forEach(name => {
                if (name !== this.currentBoardName) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    dropdown.appendChild(option);
                }
            });
        } else {
            // No current board, just show all boards
            boardNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                dropdown.appendChild(option);
            });
        }
    }

    showSaveOptionsDialog(onComplete) {
        this.pendingActionAfterSave = onComplete;

        const dialog = document.getElementById('saveOptionsDialog');
        const currentBoardBtn = document.getElementById('saveAsCurrentBoard');
        const boardNameDisplay = document.getElementById('currentBoardNameInDialog');

        // Update the current board option
        if (this.currentBoardName) {
            currentBoardBtn.style.display = 'block';
            boardNameDisplay.textContent = this.currentBoardName;
        } else {
            currentBoardBtn.style.display = 'none';
        }

        dialog.style.display = 'block';
    }

    hideSaveOptionsDialog() {
        document.getElementById('saveOptionsDialog').style.display = 'none';
        // Don't clear pendingActionAfterSave here - let handlers execute it first
    }

    promptForBoardName(defaultName, onSave) {
        const dialog = document.getElementById('boardNameDialog');
        const input = document.getElementById('boardNameInput');

        // Pre-fill with: explicit default > current board name > next board name
        input.value = defaultName || this.currentBoardName || this.getNextBoardName();
        dialog.style.display = 'block';

        const confirmBtn = document.getElementById('confirmBoardName');
        const cancelBtn = document.getElementById('cancelBoardName');
        const closeBtn = document.getElementById('closeBoardNameDialog');

        const cleanup = () => {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            closeBtn.replaceWith(closeBtn.cloneNode(true));
        };

        document.getElementById('confirmBoardName').onclick = () => {
            const boardName = input.value.trim();
            if (!boardName) {
                alert('Please enter a board name.');
                return;
            }
            if (this.customComponents[boardName]) {
                alert(`A component with name "${boardName}" already exists. Please choose a different name.`);
                return;
            }
            if (this.savedBoards[boardName] && boardName !== this.currentBoardName) {
                if (!confirm(`Board "${boardName}" already exists. Overwrite?`)) {
                    return;
                }
            }
            dialog.style.display = 'none';
            cleanup();
            onSave(boardName);
        };

        document.getElementById('cancelBoardName').onclick = () => {
            dialog.style.display = 'none';
            cleanup();
        };

        document.getElementById('closeBoardNameDialog').onclick = () => {
            dialog.style.display = 'none';
            cleanup();
        };
    }

    setupBoardManagementListeners() {
        // New Board button
        document.getElementById('newBoard').addEventListener('click', () => {
            if (this.hasUnsavedChanges()) {
                this.showSaveOptionsDialog(() => {
                    this.createNewBoard();
                });
            } else {
                this.createNewBoard();
            }
        });

        // Save Board button
        document.getElementById('saveBoard').addEventListener('click', () => {
            // Always prompt for name (pre-filled with current name if exists)
            // This allows saving as a new board by changing the name
            this.promptForBoardName(null, (boardName) => {
                this.saveCurrentBoard(boardName);
                alert(`Board "${boardName}" saved successfully!`);
            });
        });

        // Load Board dropdown
        document.getElementById('savedBoardsDropdown').addEventListener('change', (e) => {
            const boardName = e.target.value;
            if (!boardName) return;

            if (this.hasUnsavedChanges()) {
                this.showSaveOptionsDialog(() => {
                    this.loadBoard(boardName);
                    e.target.value = ''; // Reset dropdown
                });
            } else {
                this.loadBoard(boardName);
                e.target.value = ''; // Reset dropdown
            }
        });

        // Save Options Dialog buttons
        document.getElementById('saveAsCurrentBoard').addEventListener('click', () => {
            if (this.currentBoardName) {
                this.saveCurrentBoard(this.currentBoardName);
            }
            this.hideSaveOptionsDialog();
            if (this.pendingActionAfterSave) {
                this.pendingActionAfterSave();
                this.pendingActionAfterSave = null;
            }
        });

        document.getElementById('saveAsNewBoard').addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            this.promptForBoardName(null, (boardName) => {
                this.saveCurrentBoard(boardName);
                if (this.pendingActionAfterSave) {
                    this.pendingActionAfterSave();
                    this.pendingActionAfterSave = null;
                }
            });
        });

        document.getElementById('saveAsNewComponent').addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            // Open the save component dialog
            document.getElementById('saveComponentDialog').style.display = 'block';
            // After saving component, execute pending action
            const originalConfirm = document.getElementById('confirmSave').onclick;
            document.getElementById('confirmSave').onclick = () => {
                originalConfirm?.();
                if (this.pendingActionAfterSave) {
                    this.pendingActionAfterSave();
                    this.pendingActionAfterSave = null;
                }
            };
        });

        document.getElementById('discardChanges').addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            if (this.pendingActionAfterSave) {
                this.pendingActionAfterSave();
                this.pendingActionAfterSave = null;
            }
        });

        document.getElementById('closeSaveOptions').addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            this.pendingActionAfterSave = null; // Cancel the pending action
        });
    }
}

// Initialize the simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new CircuitSimulator();
});
