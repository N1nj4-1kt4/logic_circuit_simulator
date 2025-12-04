/**
 * Toolbar - Manages toolbar UI state and interactions
 *
 * Responsibilities:
 * - Tool selection (gates, I/O, custom components)
 * - Mode management (place, connect, delete, neutral)
 * - Action button state (simulate, connect mode, delete mode)
 * - UI updates (mode indicator, dropdowns, circuit name)
 * - Event handling for all toolbar buttons
 */
export class Toolbar {
    /**
     * @param {Object} callbacks - Callback functions for toolbar actions
     * @param {Function} callbacks.onToolSelect - Called when a tool is selected
     * @param {Function} callbacks.onModeChange - Called when mode changes
     * @param {Function} callbacks.onClearBoard - Called when clear board is clicked
     * @param {Function} callbacks.onSimulate - Called when simulate is clicked
     * @param {Function} callbacks.onTruthTable - Called when truth table is clicked
     * @param {Function} callbacks.onSaveComponent - Called when save component is clicked
     * @param {Function} callbacks.onManageComponents - Called when manage components is clicked
     * @param {Function} callbacks.onExportComponent - Called when export component is clicked
     * @param {Function} callbacks.onImportComponent - Called when import component is clicked
     * @param {Function} callbacks.onNewBoard - Called when new board is clicked
     * @param {Function} callbacks.onSaveBoard - Called when save board is clicked
     * @param {Function} callbacks.onLoadBoard - Called when a board is selected from dropdown
     * @param {Function} callbacks.onSimulationStep - Called when simulation step button is clicked
     */
    constructor(callbacks) {
        // Callback functions for toolbar actions
        this.onToolSelect = callbacks.onToolSelect;
        this.onModeChange = callbacks.onModeChange;
        this.onClearBoard = callbacks.onClearBoard;
        this.onSimulate = callbacks.onSimulate;
        this.onTruthTable = callbacks.onTruthTable;
        this.onSaveComponent = callbacks.onSaveComponent;
        this.onManageComponents = callbacks.onManageComponents;
        this.onExportComponent = callbacks.onExportComponent;
        this.onImportComponent = callbacks.onImportComponent;
        this.onNewBoard = callbacks.onNewBoard;
        this.onSaveBoard = callbacks.onSaveBoard;
        this.onLoadBoard = callbacks.onLoadBoard;
        this.onSimulationStep = callbacks.onSimulationStep;

        // State (managed by Toolbar, read by CircuitSimulator via getters)
        this.selectedTool = null;
        this.mode = 'neutral'; // 'place' | 'connect' | 'delete' | 'neutral'
        this.connectStart = null; // For showing connection status in mode indicator

        // DOM element references (cached for performance)
        this.elements = {
            modeIndicator: null,
            selectedComponent: null,
            customComponentsDropdown: null,
            customComponentsSection: null,
            savedBoardsDropdown: null,
            savedBoardsSection: null,
            circuitNameDisplay: null,
            simulateBtn: null
        };
    }

    /**
     * Initialize toolbar - cache elements and setup event listeners
     * Call after DOM is ready
     */
    init() {
        this.cacheElements();
        this.setupToolSelection();
        this.setupActionButtons();
        this.setupComponentButtons();
        this.setupBoardButtons();
        this.setupSimulationControls();
        this.updateModeIndicator();
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements.modeIndicator = document.getElementById('modeIndicator');
        this.elements.selectedComponent = document.getElementById('selectedComponent');
        this.elements.customComponentsDropdown = document.getElementById('customComponentsDropdown');
        this.elements.customComponentsSection = document.getElementById('customComponentsSection');
        this.elements.savedBoardsDropdown = document.getElementById('savedBoardsDropdown');
        this.elements.savedBoardsSection = document.getElementById('savedBoardsSection');
        this.elements.circuitNameDisplay = document.getElementById('currentCircuitName');
        this.elements.simulateBtn = document.getElementById('simulate');
    }

    /**
     * Setup tool selection buttons (gates, I/O, custom components)
     */
    setupToolSelection() {
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

                // Notify CircuitSimulator
                if (this.onToolSelect) {
                    this.onToolSelect(this.selectedTool);
                }
                if (this.onModeChange) {
                    this.onModeChange(this.mode);
                }
            });
        });

        // Custom components dropdown (setup event listener once)
        if (this.elements.customComponentsDropdown) {
            this.elements.customComponentsDropdown.onchange = (e) => {
                if (e.target.value) {
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));

                    this.selectedTool = e.target.value;
                    this.mode = 'place';
                    this.updateModeIndicator();

                    // Notify CircuitSimulator
                    if (this.onToolSelect) {
                        this.onToolSelect(this.selectedTool);
                    }
                    if (this.onModeChange) {
                        this.onModeChange(this.mode);
                    }
                }
            };
        }
    }

    /**
     * Setup action buttons (connect, delete, clear, simulate, truth table)
     */
    setupActionButtons() {
        // Connect Mode button
        const connectBtn = document.getElementById('connectMode');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const isAlreadyActive = connectBtn.classList.contains('active');

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
                    connectBtn.classList.add('active');
                    this.mode = 'connect';
                    this.connectStart = null;
                }

                this.updateModeIndicator();

                // Notify CircuitSimulator
                if (this.onModeChange) {
                    this.onModeChange(this.mode);
                }
            });
        }

        // Delete Mode button
        const deleteBtn = document.getElementById('deleteMode');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const isAlreadyActive = deleteBtn.classList.contains('active');

                // Clear all selections
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('selected'));
                document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
                this.selectedTool = null;

                if (isAlreadyActive) {
                    // Toggle off - return to neutral mode
                    this.mode = 'neutral';
                } else {
                    // Activate delete mode
                    deleteBtn.classList.add('active');
                    this.mode = 'delete';
                }

                this.updateModeIndicator();

                // Notify CircuitSimulator
                if (this.onModeChange) {
                    this.onModeChange(this.mode);
                }
            });
        }

        // Clear Board button
        const clearBtn = document.getElementById('clearBoard');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.onClearBoard) {
                    this.onClearBoard();
                }
            });
        }

        // Simulate button
        if (this.elements.simulateBtn) {
            this.elements.simulateBtn.addEventListener('click', () => {
                if (this.onSimulate) {
                    this.onSimulate();
                }
            });
        }

        // Truth Table button
        const truthTableBtn = document.getElementById('truthTable');
        if (truthTableBtn) {
            truthTableBtn.addEventListener('click', () => {
                if (this.onTruthTable) {
                    this.onTruthTable();
                }
            });
        }

        // Note: Close Truth Table button is now managed by TruthTablePanel itself
    }

    /**
     * Setup component management buttons
     */
    setupComponentButtons() {
        // Save Component button
        const saveComponentBtn = document.getElementById('saveComponent');
        if (saveComponentBtn) {
            saveComponentBtn.addEventListener('click', () => {
                if (this.onSaveComponent) {
                    this.onSaveComponent();
                }
            });
        }

        // Manage Components button
        const manageComponentsBtn = document.getElementById('manageComponents');
        if (manageComponentsBtn) {
            manageComponentsBtn.addEventListener('click', () => {
                if (this.onManageComponents) {
                    this.onManageComponents();
                }
            });
        }

        // Export Component button
        const exportBtn = document.getElementById('exportComponent');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (this.onExportComponent) {
                    this.onExportComponent();
                }
            });
        }

        // Import Component button
        const importBtn = document.getElementById('importComponent');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                if (this.onImportComponent) {
                    this.onImportComponent();
                }
            });
        }
    }

    /**
     * Setup board management buttons and dropdown
     */
    setupBoardButtons() {
        // New Board button
        const newBoardBtn = document.getElementById('newBoard');
        if (newBoardBtn) {
            newBoardBtn.addEventListener('click', () => {
                if (this.onNewBoard) {
                    this.onNewBoard();
                }
            });
        }

        // Save Board button
        const saveBoardBtn = document.getElementById('saveBoard');
        if (saveBoardBtn) {
            saveBoardBtn.addEventListener('click', () => {
                if (this.onSaveBoard) {
                    this.onSaveBoard();
                }
            });
        }

        // Saved Boards Dropdown (setup event listener once)
        if (this.elements.savedBoardsDropdown) {
            this.elements.savedBoardsDropdown.onchange = (e) => {
                if (e.target.value && this.onLoadBoard) {
                    this.onLoadBoard(e.target.value);
                    // Reset dropdown to show placeholder after selection
                    e.target.value = '';
                }
            };
        }
    }

    /**
     * Setup simulation control buttons (next, prev, reset)
     */
    setupSimulationControls() {
        // Next Step button
        const nextStepBtn = document.getElementById('nextStep');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                if (this.onSimulationStep) {
                    this.onSimulationStep('next');
                }
            });
        }

        // Previous Step button
        const prevStepBtn = document.getElementById('prevStep');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
                if (this.onSimulationStep) {
                    this.onSimulationStep('prev');
                }
            });
        }

        // Reset Simulation button
        const resetSimBtn = document.getElementById('resetSim');
        if (resetSimBtn) {
            resetSimBtn.addEventListener('click', () => {
                if (this.onSimulationStep) {
                    this.onSimulationStep('reset');
                }
            });
        }
    }

    /**
     * Select a tool programmatically
     * @param {string} toolType - Type of tool to select
     */
    selectTool(toolType) {
        this.selectedTool = toolType;
        this.mode = 'place';
        this.updateModeIndicator();

        // Update UI - select the corresponding button
        document.querySelectorAll('.tool-btn').forEach(btn => {
            if (btn.dataset.type === toolType) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
    }

    /**
     * Set mode programmatically
     * @param {string} mode - Mode to set ('place' | 'connect' | 'delete' | 'neutral')
     */
    setMode(mode) {
        this.mode = mode;
        this.updateModeIndicator();

        // Update UI
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        if (mode === 'connect') {
            const connectBtn = document.getElementById('connectMode');
            if (connectBtn) connectBtn.classList.add('active');
        } else if (mode === 'delete') {
            const deleteBtn = document.getElementById('deleteMode');
            if (deleteBtn) deleteBtn.classList.add('active');
        }
    }

    /**
     * Exit to neutral mode - clear all selections
     */
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

        // Visual feedback
        console.log('Exited to neutral mode');

        // Notify CircuitSimulator
        if (this.onModeChange) {
            this.onModeChange(this.mode);
        }
    }

    /**
     * Update mode indicator display
     */
    updateModeIndicator() {
        if (!this.elements.modeIndicator || !this.elements.selectedComponent) return;

        if (this.mode === 'place') {
            this.elements.modeIndicator.textContent = 'Mode: Place Component';
            this.elements.selectedComponent.textContent = this.selectedTool ? `Selected: ${this.selectedTool}` : '';
        } else if (this.mode === 'connect') {
            this.elements.modeIndicator.textContent = 'Mode: Connect Components';
            this.elements.selectedComponent.textContent = this.connectStart ? 'Click on input port to complete' : 'Click on output port to start';
        } else if (this.mode === 'delete') {
            this.elements.modeIndicator.textContent = 'Mode: Delete Component/Connection';
            this.elements.selectedComponent.textContent = 'Click on component or connection to delete';
        } else {
            // Neutral mode - clear displays
            this.elements.modeIndicator.textContent = '';
            this.elements.selectedComponent.textContent = '';
        }
    }

    /**
     * Update custom components dropdown
     * @param {Object} customComponents - Object containing custom components
     */
    updateCustomComponentsList(customComponents) {
        if (!this.elements.customComponentsDropdown || !this.elements.customComponentsSection) return;

        const componentNames = Object.keys(customComponents);

        if (componentNames.length === 0) {
            this.elements.customComponentsSection.classList.add('hidden');
            return;
        }

        this.elements.customComponentsSection.classList.remove('hidden');

        // Clear existing options except the first one
        this.elements.customComponentsDropdown.innerHTML = '<option value="">Select a component...</option>';

        // Add custom components as options
        componentNames.sort().forEach(name => {
            const option = document.createElement('option');
            option.value = 'CUSTOM:' + name;
            option.textContent = name;
            this.elements.customComponentsDropdown.appendChild(option);
        });
    }

    /**
     * Update saved boards dropdown
     * @param {Object} savedBoards - Object containing saved boards
     * @param {string} currentBoardName - Name of currently loaded board
     */
    updateBoardsList(savedBoards, currentBoardName) {
        if (!this.elements.savedBoardsDropdown || !this.elements.savedBoardsSection) return;

        const boardNames = Object.keys(savedBoards);

        if (boardNames.length === 0) {
            this.elements.savedBoardsSection.classList.add('hidden');
            return;
        }

        this.elements.savedBoardsSection.classList.remove('hidden');
        this.elements.savedBoardsDropdown.innerHTML = '<option value="">Select a board...</option>';

        // Sort all boards alphabetically
        boardNames.sort();

        // If there's a current board, show it at top with separator
        if (currentBoardName && savedBoards[currentBoardName]) {
            const currentOption = document.createElement('option');
            currentOption.value = currentBoardName;
            currentOption.textContent = `${currentBoardName} (current)`;
            this.elements.savedBoardsDropdown.appendChild(currentOption);

            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '─────';
            this.elements.savedBoardsDropdown.appendChild(separator);

            // Add other boards (excluding current)
            boardNames.forEach(name => {
                if (name !== currentBoardName) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    this.elements.savedBoardsDropdown.appendChild(option);
                }
            });
        } else {
            // No current board, just show all boards
            boardNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.elements.savedBoardsDropdown.appendChild(option);
            });
        }
    }

    /**
     * Update circuit name display in header
     * @param {string} name - Name to display
     * @param {boolean} isComponent - Whether this is a component (shows suffix)
     */
    updateCircuitNameDisplay(name, isComponent) {
        if (!this.elements.circuitNameDisplay) return;

        let displayName = name || 'Unsaved Board';
        if (isComponent && name) {
            displayName = `${name} (Component)`;
        }

        this.elements.circuitNameDisplay.textContent = displayName;
    }

    /**
     * Set simulation state and update button UI
     * @param {boolean} isRunning - Whether simulation is running
     * @param {number} currentIndex - Current combination index (optional)
     * @param {number} total - Total combinations (optional)
     */
    setSimulationState(isRunning, currentIndex = 0, total = 0) {
        if (!this.elements.simulateBtn) return;

        if (isRunning) {
            this.elements.simulateBtn.textContent = '■ Simulation';
            this.elements.simulateBtn.style.background = '#f44336';

            // Update mode indicator for simulation
            if (this.elements.modeIndicator && this.elements.selectedComponent) {
                this.elements.modeIndicator.textContent = 'Mode: Auto-Cycling Inputs';
                this.elements.selectedComponent.textContent = `Combination ${currentIndex + 1} / ${total}`;
            }
        } else {
            this.elements.simulateBtn.textContent = '▶ Simulation';
            this.elements.simulateBtn.style.background = '';

            // Restore normal mode indicator
            this.updateModeIndicator();
        }
    }

    /**
     * Set connection start state (for mode indicator in connect mode)
     * @param {boolean} hasStart - Whether a connection start point is selected
     */
    setConnectionStart(hasStart) {
        this.connectStart = hasStart;
        if (this.mode === 'connect') {
            this.updateModeIndicator();
        }
    }

    // Getters for state
    getSelectedTool() {
        return this.selectedTool;
    }

    getMode() {
        return this.mode;
    }
}
