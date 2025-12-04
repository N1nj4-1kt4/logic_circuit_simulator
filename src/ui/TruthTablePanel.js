import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';
import interact from 'interactjs';
import { positionPanelSmartly } from '../utils/positioning.js';

/**
 * TruthTablePanel - Manages the truth table UI using Tabulator.js
 *
 * Responsibilities:
 * - Generate truth table data from circuit components
 * - Display truth table using Tabulator library
 * - Handle column reordering (inputs and outputs separately)
 * - Highlight rows matching current circuit state
 * - Provide drag/resize functionality via Interact.js
 * - Persist panel state (position, size, column order)
 */
export class TruthTablePanel {
    /**
     * @param {HTMLCanvasElement} canvas - Main canvas element
     * @param {Array} components - Circuit components array
     * @param {Array} connections - Circuit connections array
     * @param {Function} simulateFn - Function to simulate circuit
     */
    constructor(canvas, components, connections, simulateFn) {
        this.canvas = canvas;
        this.components = components;
        this.connections = connections;
        this.simulateFn = simulateFn;

        this.table = null;
        this.panel = null;
        this.state = null;

        // Truth table data
        this.truthTableData = null;
        this.columnOrder = null;

        // Interaction setup flag
        this.interactionsSetup = false;

        // RAF handle for debounced resize
        this.resizeRAF = null;

        // Callback for state changes (to trigger save)
        this.onStateChange = null;
    }

    /**
     * Generate and display the truth table
     */
    generate() {
        console.log('=== TruthTablePanel.generate() START ===');
        const inputs = this.components
            .filter(c => c.type === 'INPUT')
            .sort((a, b) => a.label.localeCompare(b.label));

        const outputs = this.components
            .filter(c => c.type === 'OUTPUT')
            .sort((a, b) => a.label.localeCompare(b.label));

        if (inputs.length === 0) {
            alert('Please add at least one input to generate a truth table.');
            return false;
        }

        if (outputs.length === 0) {
            alert('Please add at least one output to generate a truth table.');
            return false;
        }

        // Generate all input combinations
        const numCombinations = Math.pow(2, inputs.length);
        const table = [];

        for (let i = 0; i < numCombinations; i++) {
            const row = {};

            // Set input values
            inputs.forEach((input, index) => {
                const bitValue = (i >> (inputs.length - 1 - index)) & 1;
                input.value = bitValue;
                row[`input${index}`] = bitValue;
            });

            // Simulate circuit
            this.simulateFn();

            // Record output values
            outputs.forEach((output, index) => {
                row[`output${index}`] = output.value !== null ? output.value : '?';
            });

            table.push(row);
        }

        // Store truth table data
        this.truthTableData = {
            inputs: inputs,
            outputs: outputs,
            table: table
        };

        // Initialize column order if not set
        if (!this.columnOrder) {
            this.columnOrder = [];
            for (let i = 0; i < inputs.length + outputs.length; i++) {
                this.columnOrder.push(i);
            }
        }

        console.log('✅ Truth table generated successfully');
        console.log('=== TruthTablePanel.generate() END ===');
        return true;
    }

    /**
     * Display the truth table panel
     */
    display() {
        console.log('=== TruthTablePanel.display() START ===');

        if (!this.truthTableData) {
            console.error('❌ No truth table data available. Call generate() first.');
            return;
        }
        console.log('✅ Truth table data exists:', this.truthTableData);

        this.panel = document.getElementById('truthTablePanel');
        const content = document.getElementById('truthTableContent');
        console.log('📦 Panel element:', this.panel);
        console.log('📦 Content element:', content);

        if (!this.panel || !content) {
            console.error('❌ Truth table panel elements not found in DOM');
            return;
        }

        // Check if panel was already visible BEFORE we show it
        // Support both .hidden class and inline style for backwards compatibility
        const wasVisible = !this.panel.classList.contains('hidden') && this.panel.style.display !== 'none';
        console.log('👁️ wasVisible (before showing):', wasVisible);
        console.log('📏 Panel has hidden class:', this.panel.classList.contains('hidden'));

        // If table already exists, destroy it before creating a new one
        if (this.table) {
            console.log('🗑️ Destroying existing table...');
            this.table.destroy();
            this.table = null;

            // Unset Interact.js if it was set up
            if (this.interactionsSetup && this.panel) {
                console.log('🔧 Unsetting Interact.js...');
                interact(this.panel).unset();
            }

            // Reset interactions flag when destroying table
            this.interactionsSetup = false;
            console.log('🔄 Reset interactionsSetup to false');
        } else {
            console.log('ℹ️ No existing table to destroy');
        }

        // Apply saved position BEFORE making panel visible to avoid flicker
        if (this.state && !wasVisible) {
            console.log('📍 Pre-positioning panel to avoid flicker...');
            // Apply the saved position before showing the panel
            if (this.state.width) {
                this.panel.style.width = this.state.width;
            }
            if (this.state.height) {
                this.panel.style.height = this.state.height;
            }
            if (this.state.x !== undefined && this.state.y !== undefined) {
                this.panel.style.left = '0';
                this.panel.style.top = '0';
                this.panel.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
                this.panel.setAttribute('data-x', this.state.x);
                this.panel.setAttribute('data-y', this.state.y);
                console.log(`✅ Pre-positioned at (${this.state.x}, ${this.state.y})`);
            }
        }

        // Show panel first (remove hidden class and ensure display is block)
        console.log('👁️ Removing hidden class and setting display to block...');
        this.panel.classList.remove('hidden');
        this.panel.style.display = 'block';
        console.log('✅ Panel display set to block, hidden class removed');

        // Panel in layout but invisible during construction (Tabulator can measure)
        console.log('👀 Setting panel opacity to 0 and pointer-events to auto...');
        this.panel.style.opacity = '0';
        this.panel.style.pointerEvents = 'auto';
        console.log('✅ Panel invisible but in layout for Tabulator measurement');

        // Generate Tabulator columns with groups
        console.log('📊 Generating columns...');
        const columns = this.generateColumns();
        console.log('✅ Columns generated:', columns);

        // Initialize Tabulator
        console.log('🚀 Initializing Tabulator...');
        this.table = new Tabulator(content, {
            columns: columns,
            data: this.truthTableData.table,
            layout: 'fitColumns',
            // Don't set height - let it fill the flex container naturally
            selectable: 1, // Single row selection
            movableColumns: true,
            columnHeaderVertAlign: 'bottom',
            reactiveData: false,
            maxHeight: '100%', // Limit to container height
        });
        console.log('✅ Tabulator instance created:', this.table);

        // Apply dark mode theme if needed
        const isDarkMode = document.body.classList.contains('dark-mode');
        console.log('🌙 Dark mode:', isDarkMode);
        if (isDarkMode) {
            content.classList.add('tabulator-midnight');
            console.log('✅ Added tabulator-midnight class');
        }

        // Setup after table is built
        this.table.on('tableBuilt', () => {
            console.log('🎉 tableBuilt event fired!');

            // Only setup interactions once
            if (!this.interactionsSetup) {
                console.log('🔧 Setting up interactions...');
                this.setupInteractions();
                this.interactionsSetup = true;
                console.log('✅ Interactions setup complete');
            } else {
                console.log('⏭️ Skipping interactions setup (already done)');
            }

            // Position panel on first open
            console.log('📍 Positioning panel... wasVisible:', wasVisible);
            if (!wasVisible) {
                console.log('🔍 Checking state:', this.state);
                if (this.state) {
                    console.log('  - state.x:', this.state.x);
                    console.log('  - state.left:', this.state.left);
                }

                // Check if we have a valid saved position
                // Position (0, 0) is valid but indicates no previous drag occurred
                // We only want to skip smart positioning if user has explicitly positioned the panel
                const hasValidSavedPosition = this.state &&
                    this.state.x !== undefined &&
                    this.state.y !== undefined &&
                    (this.state.x !== 0 || this.state.y !== 0);

                console.log('🤔 hasValidSavedPosition:', hasValidSavedPosition);

                if (!hasValidSavedPosition) {
                    console.log('🎯 Using smart positioning (no saved position)');
                    positionPanelSmartly(this.panel, this.canvas, this.components);
                    console.log('✅ Smart positioning complete');
                    console.log('  📍 After smart positioning:');
                    console.log('    - panel.style.left:', this.panel.style.left);
                    console.log('    - panel.style.top:', this.panel.style.top);
                    console.log('    - panel.style.transform:', this.panel.style.transform);
                    console.log('    - data-x:', this.panel.getAttribute('data-x'));
                    console.log('    - data-y:', this.panel.getAttribute('data-y'));
                } else {
                    // Position was already applied before display() to avoid flicker
                    // Just validate it here with restoreState to ensure bounds checking
                    console.log('💾 Validating pre-applied position:', this.state);
                    this.restoreState(this.state);
                }
            } else {
                console.log('⏭️ Panel was visible, skipping positioning');
            }

            // Highlight current row after table is built
            console.log('🎨 Updating highlight...');
            this.updateHighlight();
            console.log('✅ Highlight updated');

            // Apply saved height to Tabulator after table is built
            // This ensures the table fills the panel on reload/regeneration
            // Calculate from panel dimensions for accuracy
            const panelHeader = this.panel.querySelector('.panel-header');
            const headerHeight = panelHeader ? panelHeader.offsetHeight : 0;
            const panelStyles = getComputedStyle(this.panel);
            const paddingTop = parseFloat(panelStyles.paddingTop) || 0;
            const paddingBottom = parseFloat(panelStyles.paddingBottom) || 0;
            const panelHeight = this.panel.offsetHeight;
            const availableHeight = panelHeight - headerHeight - paddingTop - paddingBottom;

            if (availableHeight > 0) {
                console.log('📐 Setting table height to:', availableHeight);
                this.applyTableHeight(availableHeight);
            }

            // Reveal panel with instant transition (table is fully constructed)
            console.log('✨ Revealing fully-constructed table...');
            this.panel.style.opacity = '1';
            console.log('✅ Panel revealed instantly');

            // Save state after showing the panel
            console.log('💾 Saving state after showing panel...');
            this.saveState();
            console.log('✅ State saved');
        });

        // Listen for column reorder
        this.table.on('columnMoved', () => {
            console.log('🔀 Column moved, saving state...');
            this.saveState();
        });

        // Don't apply saved state here - let tableBuilt event handle positioning
        // This prevents premature positioning before the table is rendered
        console.log('⏭️ Skipping early restoreState() - will position in tableBuilt event');

        console.log('=== TruthTablePanel.display() END ===');
    }

    /**
     * Generate Tabulator column definitions with groups
     */
    generateColumns() {
        const { inputs, outputs } = this.truthTableData;

        // Create all column definitions
        const inputCols = inputs.map((input, i) => ({
            title: input.label || `I${i}`,
            field: `input${i}`,
            minWidth: 60,
            headerSort: false,
            formatter: (cell) => cell.getValue() ? '1' : '0',
            cssClass: 'input-cell'
        }));

        const outputCols = outputs.map((output, i) => ({
            title: output.label || `O${i}`,
            field: `output${i}`,
            minWidth: 60,
            headerSort: false,
            formatter: (cell) => {
                const value = cell.getValue();
                return `<strong>${value === '?' ? '?' : (value ? '1' : '0')}</strong>`;
            },
            cssClass: 'output-cell'
        }));

        // If we have a saved column order, reorder the columns to match
        if (this.state && this.state.columnOrder && this.state.columnOrder.length > 0) {
            console.log('📋 Applying saved column order during generation:', this.state.columnOrder);

            const orderedInputCols = [];
            const orderedOutputCols = [];

            // Reorder based on saved state
            this.state.columnOrder.forEach(fieldName => {
                if (!fieldName) return;

                if (fieldName.startsWith('input')) {
                    const index = parseInt(fieldName.replace('input', ''));
                    if (inputCols[index]) {
                        orderedInputCols.push(inputCols[index]);
                    }
                } else if (fieldName.startsWith('output')) {
                    const index = parseInt(fieldName.replace('output', ''));
                    if (outputCols[index]) {
                        orderedOutputCols.push(outputCols[index]);
                    }
                }
            });

            // Use ordered columns if we successfully reordered them
            if (orderedInputCols.length === inputCols.length && orderedOutputCols.length === outputCols.length) {
                console.log('✅ Using reordered columns');
                return [
                    {
                        title: 'Inputs',
                        columns: orderedInputCols
                    },
                    {
                        title: 'Outputs',
                        columns: orderedOutputCols
                    }
                ];
            } else {
                console.log('⚠️ Column count mismatch, using default order');
            }
        }

        // Default: return columns in original order
        return [
            {
                title: 'Inputs',
                columns: inputCols
            },
            {
                title: 'Outputs',
                columns: outputCols
            }
        ];
    }

    /**
     * Update row highlighting to match current circuit state
     */
    updateHighlight() {
        if (!this.table || !this.truthTableData) return;

        const { inputs } = this.truthTableData;

        // Get current input values
        const inputValues = inputs.map(input => input.value);

        // Find matching row index
        const matchingIndex = this.findMatchingRow(inputValues);

        if (matchingIndex !== -1) {
            this.table.deselectRow();

            // Get all rows and select by position
            const rows = this.table.getRows();
            if (rows[matchingIndex]) {
                rows[matchingIndex].select();
                rows[matchingIndex].scrollTo();
            }
        }
    }

    /**
     * Find row index matching given input values
     */
    findMatchingRow(inputValues) {
        if (!this.table) return -1;

        const data = this.table.getData();
        return data.findIndex(row =>
            inputValues.every((val, i) => row[`input${i}`] === val)
        );
    }

    /**
     * Apply height to table, distributing space across rows
     * Similar to fitColumns but for row heights
     */
    applyTableHeight(availableHeight) {
        if (!this.table) return;

        const content = document.getElementById('truthTableContent');
        if (!content) return;

        // Set container heights
        content.style.height = availableHeight + 'px';
        const tabulatorEl = content.querySelector('.tabulator');
        if (tabulatorEl) {
            tabulatorEl.style.height = availableHeight + 'px';
        }

        // Get the header height to calculate available space for rows
        const headerEl = content.querySelector('.tabulator-header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 0;

        // Calculate available height for rows
        const rowAreaHeight = availableHeight - headerHeight;

        // Set the tableholder and table heights explicitly
        const tableholder = content.querySelector('.tabulator-tableholder');
        if (tableholder) {
            tableholder.style.height = rowAreaHeight + 'px';
        }

        const tableEl = content.querySelector('.tabulator-table');
        if (tableEl) {
            tableEl.style.height = rowAreaHeight + 'px';
            // Don't change display - Tabulator handles row layout
        }

        // Get number of rows
        const rows = this.table.getRows();
        const rowCount = rows.length;

        if (rowCount > 0 && rowAreaHeight > 0) {
            // Calculate height per row (minimum 25px)
            const minRowHeight = 25;
            const rowHeight = Math.max(minRowHeight, Math.floor(rowAreaHeight / rowCount));

            console.log('📊 Row calculation:', { availableHeight, headerHeight, rowAreaHeight, rowCount, rowHeight });

            // Apply row height via CSS on the rows and cells
            // Use setProperty to add !important without wiping existing styles
            const rowElements = content.querySelectorAll('.tabulator-row');
            rowElements.forEach(row => {
                row.style.setProperty('height', rowHeight + 'px', 'important');
                row.style.setProperty('min-height', rowHeight + 'px', 'important');
                row.style.setProperty('max-height', rowHeight + 'px', 'important');

                // Set cell heights within this row
                // Calculate padding to vertically center content (assuming ~20px content height)
                const contentHeight = 20;
                const verticalPadding = Math.max(0, (rowHeight - contentHeight) / 2);

                const cells = row.querySelectorAll('.tabulator-cell');
                cells.forEach(cell => {
                    cell.style.setProperty('height', 'auto', 'important');
                    cell.style.setProperty('padding-top', verticalPadding + 'px', 'important');
                    cell.style.setProperty('padding-bottom', verticalPadding + 'px', 'important');
                });
            });
        }

        // Don't call redraw() as it resets our styles
    }

    /**
     * Setup Interact.js for drag and resize, and close button listener
     */
    setupInteractions() {
        const panel = this.panel;

        // Setup close button
        const closeButton = document.getElementById('closeTruthTable');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.hide();
            });
        }

        interact(panel)
            .draggable({
                allowFrom: '.panel-header',
                inertia: false,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                listeners: {
                    move: this.dragMoveListener.bind(this),
                    end: () => this.saveState()
                }
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                listeners: {
                    move: this.resizeMoveListener.bind(this),
                    end: () => this.saveState()
                },
                modifiers: [
                    interact.modifiers.restrictSize({
                        min: { width: 200, height: 150 }
                    })
                ]
            });
    }

    /**
     * Handle drag move events
     */
    dragMoveListener(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    /**
     * Handle resize move events
     */
    resizeMoveListener(event) {
        const target = event.target;
        const x = parseFloat(target.getAttribute('data-x')) || 0;
        const y = parseFloat(target.getAttribute('data-y')) || 0;

        // Update element size
        target.style.width = event.rect.width + 'px';
        target.style.height = event.rect.height + 'px';

        // Translate when resizing from top or left edges
        const deltaX = x + event.deltaRect.left;
        const deltaY = y + event.deltaRect.top;

        target.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        target.setAttribute('data-x', deltaX);
        target.setAttribute('data-y', deltaY);

        // Calculate available height from panel dimensions
        // We can't rely on content.clientHeight as flex layout may not have updated yet
        const panelHeader = target.querySelector('.panel-header');
        const headerHeight = panelHeader ? panelHeader.offsetHeight : 0;
        const panelStyles = getComputedStyle(target);
        const paddingTop = parseFloat(panelStyles.paddingTop) || 0;
        const paddingBottom = parseFloat(panelStyles.paddingBottom) || 0;
        const availableHeight = event.rect.height - headerHeight - paddingTop - paddingBottom;

        console.log('📏 resizeMoveListener:', {
            'event.rect.height': event.rect.height,
            'event.rect.width': event.rect.width,
            headerHeight,
            paddingTop,
            paddingBottom,
            availableHeight,
            'this.table exists': !!this.table
        });

        // Debounce Tabulator redraw using requestAnimationFrame
        if (this.resizeRAF) {
            cancelAnimationFrame(this.resizeRAF);
        }
        this.resizeRAF = requestAnimationFrame(() => {
            console.log('🔄 RAF callback - setting height to:', availableHeight);
            if (this.table && availableHeight > 0) {
                this.applyTableHeight(availableHeight);
            } else {
                console.log('❌ this.table is null/undefined or invalid height');
            }
        });
    }

    /**
     * Save panel state
     */
    saveState() {
        if (!this.panel || !this.table) return;

        console.log('💾 saveState() called');
        console.log('  - panel.style.left:', this.panel.style.left);
        console.log('  - panel.style.top:', this.panel.style.top);
        console.log('  - panel.style.transform:', this.panel.style.transform);
        console.log('  - data-x:', this.panel.getAttribute('data-x'));
        console.log('  - data-y:', this.panel.getAttribute('data-y'));

        const columns = this.table.getColumns().map(col => col.getField()).filter(f => f);

        // Read position from data-x/data-y attributes (set by both smart positioning and dragging)
        const x = parseFloat(this.panel.getAttribute('data-x')) || 0;
        const y = parseFloat(this.panel.getAttribute('data-y')) || 0;

        this.state = {
            columnOrder: columns,
            width: this.panel.style.width,
            height: this.panel.style.height,
            x: x,
            y: y,
            visible: this.panel.style.opacity !== '0'
        };

        console.log('  📝 Saved state:', this.state);

        // Trigger callback to save to localStorage
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Restore panel state
     */
    restoreState(state) {
        if (!state || !this.panel) return;

        console.log('🔧 restoreState() called with state:', state);

        // Restore size (only if valid)
        if (state.width && state.width !== '') {
            this.panel.style.width = state.width;
        }
        if (state.height && state.height !== '') {
            this.panel.style.height = state.height;
        }

        // Restore position (prefer transform over left/top)
        if (state.x !== undefined && state.y !== undefined) {
            // Validate position to ensure panel stays within viewport
            let x = state.x;
            let y = state.y;

            console.log('📍 Original position:', { x, y });

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Get panel dimensions (use saved state or computed style)
            // Use computed style to get actual rendered dimensions
            const computedStyle = window.getComputedStyle(this.panel);
            let panelWidth = parseFloat(computedStyle.width) || 400; // Default 400px
            let panelHeight = parseFloat(computedStyle.height) || 300; // Default 300px

            // If we have valid saved dimensions, use those
            if (state.width && state.width !== '') {
                const savedWidth = parseFloat(state.width);
                if (savedWidth > 0) panelWidth = savedWidth;
            }
            if (state.height && state.height !== '') {
                const savedHeight = parseFloat(state.height);
                if (savedHeight > 0) panelHeight = savedHeight;
            }

            console.log('📏 Viewport:', { viewportWidth, viewportHeight });
            console.log('📐 Panel size:', { panelWidth, panelHeight });

            // Clamp position to keep panel at least partially visible
            // Allow panel to be positioned at most 80% off-screen
            const maxOffscreenX = panelWidth * 0.8;
            const maxOffscreenY = panelHeight * 0.8;

            const minX = -maxOffscreenX;
            const maxX = viewportWidth - (panelWidth - maxOffscreenX);
            const minY = -maxOffscreenY;
            const maxY = viewportHeight - (panelHeight - maxOffscreenY);

            console.log('🎯 Bounds:', { minX, maxX, minY, maxY });

            // Clamp values
            x = Math.max(minX, Math.min(maxX, x));
            y = Math.max(minY, Math.min(maxY, y));

            console.log('✅ Clamped position:', { x, y });

            // Apply transform positioning (compatible with Interact.js)
            this.panel.style.left = '0';
            this.panel.style.top = '0';
            this.panel.style.transform = `translate(${x}px, ${y}px)`;
            this.panel.setAttribute('data-x', x);
            this.panel.setAttribute('data-y', y);
        }

        // Column order is now handled in generateColumns() before table creation
        // No need to move columns after table is built

        // DON'T restore visibility here - we want panel to stay visible
        // The display() method already sets it to 'block'

        console.log('✅ restoreState() complete');
    }

    /**
     * Hide the truth table panel
     */
    hide() {
        console.log('=== TruthTablePanel.hide() called ===');
        if (this.panel) {
            console.log('🙈 Hiding panel...');
            this.panel.style.opacity = '0';
            this.panel.style.pointerEvents = 'none';
            this.panel.classList.add('hidden');
            this.panel.style.display = 'none';
            console.log('💾 Saving state...');
            this.saveState();
            console.log('✅ Panel hidden and state saved');
        } else {
            console.log('⚠️ No panel to hide');
        }
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Set state (for loading from localStorage)
     */
    setState(state) {
        if (!state) {
            this.state = null;
            return;
        }

        console.log('🔄 setState() called with:', state);

        const sanitizedState = { ...state };

        // Validate that positions are reasonable (not extremely negative or corrupted)
        if (sanitizedState.x !== undefined && sanitizedState.x < -500) {
            console.log(`  ⚠️ Rejecting invalid x position: ${sanitizedState.x}, resetting to 0`);
            sanitizedState.x = 0;
        }
        if (sanitizedState.y !== undefined && sanitizedState.y < -500) {
            console.log(`  ⚠️ Rejecting invalid y position: ${sanitizedState.y}, resetting to 0`);
            sanitizedState.y = 0;
        }

        // Ignore any legacy left/top/transform properties
        delete sanitizedState.left;
        delete sanitizedState.top;
        delete sanitizedState.transform;

        console.log('  ✅ Sanitized state:', sanitizedState);

        this.state = sanitizedState;
        if (sanitizedState.columnOrder) {
            this.columnOrder = sanitizedState.columnOrder;
        }
    }
}
