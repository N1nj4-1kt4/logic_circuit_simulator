import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';
import interact from 'interactjs';
import { positionPanelSmartly } from '../utils/positioning.js';
import { DialogFactory } from './DialogFactory.js';
import { UI } from '../constants.js';
import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { logger } from '../utils/logger.js';

/**
 * TruthTablePanel - Manages the truth table UI using Tabulator.js
 *
 * Responsibilities:
 * - Display pre-computed truth table from cache
 * - Handle column reordering (inputs and outputs separately)
 * - Highlight rows matching current circuit state
 * - Provide drag/resize functionality via Interact.js
 * - Persist panel state (position, size, column order)
 *
 * Subscribes to declarative events:
 * - SIMULATION_STEP_COMPLETED: Highlights row by cycle index
 * - CIRCUIT_VALIDITY_CHANGED: Shows invalid message when circuit becomes incomplete
 */
export class TruthTablePanel {
    /**
     * @param {HTMLCanvasElement} canvas - Main canvas element
     * @param {Array} components - Circuit components array
     * @param {Array} connections - Circuit connections array
     * @param {Object} circuitState - CircuitState instance for accessing cache
     */
    constructor(canvas, components, connections, circuitState) {
        this.canvas = canvas;
        this.components = components;
        this.connections = connections;
        this.circuitState = circuitState;

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

        // Bound event handlers for cleanup
        this._boundHandleStepCompleted = this._handleStepCompleted.bind(this);
        this._boundHandleValidityChanged = this._handleValidityChanged.bind(this);

        // Subscribe to declarative events
        this._setupEventListeners();
    }

    /**
     * Setup event listeners for declarative events
     * @private
     */
    _setupEventListeners() {
        // Highlight row when simulation steps
        eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this._boundHandleStepCompleted);

        // Show invalid message when circuit becomes incomplete
        eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._boundHandleValidityChanged);
    }

    /**
     * Handle simulation step completed event
     * @private
     */
    _handleStepCompleted(data) {
        if (this.isVisible()) {
            this.highlightRowByIndex(data.cycleIndex);
        }
    }

    /**
     * Handle circuit validity changed event
     * @private
     */
    _handleValidityChanged(data) {
        // Only act if panel is visible and circuit became invalid
        if (this.isVisible() && !data.canSimulate && this.truthTableData) {
            // Update truthTableData to reflect invalid state
            this.truthTableData.isValid = false;
            this.truthTableData.reason = data.reason;

            // If we have no table data, show invalid message
            if (this.truthTableData.table.length === 0) {
                this.displayInvalidMessage(true);
            }
        }
    }

    /**
     * Check if panel is visible
     * @returns {boolean}
     */
    isVisible() {
        return this.panel &&
               !this.panel.classList.contains('hidden') &&
               this.panel.style.display !== 'none';
    }

    /**
     * Highlight row by cycle index (used by SIMULATION_STEP_COMPLETED)
     * @param {number} index - The row index to highlight
     */
    highlightRowByIndex(index) {
        if (!this.table) return;

        this.table.deselectRow();

        const rows = this.table.getRows();
        if (rows[index]) {
            rows[index].select();
            rows[index].scrollTo();
        }
    }

    /**
     * Generate and display the truth table from pre-computed cache
     */
    generate() {
        // Read from pre-computed cache
        const cache = this.circuitState.getTruthTableCache();

        if (!cache) {
            // Cache not available yet - this shouldn't normally happen
            // as cache is computed on circuit changes
            DialogFactory.showAlert({
                message: 'Truth table is being computed. Please try again.',
                type: 'info'
            });
            return false;
        }

        const { inputs, outputs, table, isValid, reason } = cache;

        // Store truth table data from cache (including invalid circuits)
        // Deep copy inputs/outputs to capture current labels (avoid reference issues)
        this.truthTableData = {
            inputs: (inputs || []).map(inp => ({ ...inp })),
            outputs: (outputs || []).map(out => ({ ...out })),
            table: table || [],
            isValid: isValid,
            reason: reason
        };

        // Initialize column order if not set (only for valid circuits with columns)
        const columnCount = (inputs || []).length + (outputs || []).length;
        if (!this.columnOrder && columnCount > 0) {
            this.columnOrder = [];
            for (let i = 0; i < columnCount; i++) {
                this.columnOrder.push(i);
            }
        }

        return true;
    }

    /**
     * Display the truth table panel
     * @param {Object} options - Display options
     * @param {boolean} options.isRestoring - If true, skip saveState on initial display (restoring from saved state)
     */
    display(options = {}) {
        const { isRestoring = false } = options;
        this._isRestoring = isRestoring;

        if (!this.truthTableData) {
            return;
        }

        this.panel = document.getElementById('truthTablePanel');
        const content = document.getElementById('truthTableContent');

        if (!this.panel || !content) {
            return;
        }

        // Check if panel was already visible BEFORE we show it
        // Support both .hidden class and inline style for backwards compatibility
        const wasVisible = !this.panel.classList.contains('hidden') && this.panel.style.display !== 'none';

        // Detect if structure changed since state was saved (e.g., inputs/outputs added while panel was closed)
        // If structure changed, clear saved dimensions so panel auto-fits to new content
        if (this.state && this.state.columnOrder) {
            const currentColumnCount = this.truthTableData.inputs.length + this.truthTableData.outputs.length;
            const savedColumnCount = this.state.columnOrder.length;
            if (currentColumnCount !== savedColumnCount) {
                this.state.width = '';
                this.state.height = '';
                this.panel.style.width = '';
                this.panel.style.height = '';
                // Reset column order for new structure
                this.columnOrder = null;
            }
        }

        // If table already exists, destroy it before creating a new one
        if (this.table) {
            this.table.destroy();
            this.table = null;

            // Unset Interact.js if it was set up
            if (this.interactionsSetup && this.panel) {
                interact(this.panel).unset();
            }

            // Reset interactions flag when destroying table
            this.interactionsSetup = false;
        }

        // Apply saved position BEFORE making panel visible to avoid flicker
        if (this.state && !wasVisible) {
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
            }
        }

        // Show panel first (remove hidden class and ensure display is block)
        this.panel.classList.remove('hidden');
        this.panel.style.display = 'block';

        // Handle cases with no table data (no inputs or no outputs)
        // If table has data, display it normally even for invalid circuits
        if (this.truthTableData.table.length === 0) {
            this.displayInvalidMessage(wasVisible);
            return;
        }

        // Panel in layout but invisible during construction (Tabulator can measure)
        this.panel.style.opacity = '0';
        this.panel.style.pointerEvents = 'auto';

        // Generate Tabulator columns with groups
        const columns = this.generateColumns();

        // Initialize Tabulator
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

        // Apply dark mode theme if needed
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (isDarkMode) {
            content.classList.add('tabulator-midnight');
        }

        // Setup after table is built
        this.table.on('tableBuilt', () => {
            // Only setup interactions once
            if (!this.interactionsSetup) {
                this.setupInteractions();
                this.interactionsSetup = true;
            }

            // Position panel on first open
            if (!wasVisible) {
                // Check if we have a valid saved position
                // Position (0, 0) is valid but indicates no previous drag occurred
                // We only want to skip smart positioning if user has explicitly positioned the panel
                const hasValidSavedPosition = this.state &&
                    this.state.x !== undefined &&
                    this.state.y !== undefined &&
                    (this.state.x !== 0 || this.state.y !== 0);

                if (!hasValidSavedPosition) {
                    positionPanelSmartly(this.panel, this.canvas, this.components);
                } else {
                    // Position was already applied before display() to avoid flicker
                    // Just validate it here with restoreState to ensure bounds checking
                    this.restoreState(this.state);
                }
            }

            // Highlight current row after table is built
            this.updateHighlight();

            // Apply height to Tabulator after table is built
            // Calculate from panel dimensions for accuracy
            const panelHeader = this.panel.querySelector('.panel-header');
            const headerHeight = panelHeader ? panelHeader.offsetHeight : 0;
            const panelStyles = getComputedStyle(this.panel);
            const paddingTop = parseFloat(panelStyles.paddingTop) || 0;
            const paddingBottom = parseFloat(panelStyles.paddingBottom) || 0;
            const panelHeight = this.panel.offsetHeight;
            const availableHeight = panelHeight - headerHeight - paddingTop - paddingBottom;

            // Determine if we should fit the panel to content
            // Fit panel when: no saved size state (new board or first open)
            const hasValidSavedHeight = this.state && this.state.height && this.state.height !== '';
            const hasValidSavedWidth = this.state && this.state.width && this.state.width !== '';

            // Fit height if no saved height
            if (availableHeight > 0) {
                this.applyTableHeight(availableHeight, { fitPanel: !hasValidSavedHeight });
            }

            // Fit width if no saved width
            if (!hasValidSavedWidth) {
                this.applyTableWidth();
            }

            // Reveal panel with instant transition (table is fully constructed)
            this.panel.style.opacity = '1';

            // Save state after showing the panel, but NOT when restoring from saved state
            // (restoring shouldn't trigger a change detection false positive)
            if (!this._isRestoring) {
                this.saveState();
            }
            // Clear the restoring flag after initial display
            this._isRestoring = false;
        });

        // Listen for column reorder
        this.table.on('columnMoved', () => {
            this.saveState();
        });
    }

    /**
     * Display an invalid circuit message instead of the truth table
     * @param {boolean} wasVisible - Whether panel was already visible before this call
     */
    displayInvalidMessage(wasVisible) {
        const content = document.getElementById('truthTableContent');
        if (!content) return;

        // Destroy existing table if any
        if (this.table) {
            this.table.destroy();
            this.table = null;
        }

        // Clear content and show invalid message
        content.innerHTML = `
            <div class="truth-table-invalid-message">
                <div class="icon">${UI.ICONS.WARNING}</div>
                <div class="message">${this.truthTableData.reason || 'Circuit incomplete'}</div>
            </div>
        `;

        // Position panel on first open
        if (!wasVisible) {
            const hasValidSavedPosition = this.state &&
                this.state.x !== undefined &&
                this.state.y !== undefined &&
                (this.state.x !== 0 || this.state.y !== 0);

            if (!hasValidSavedPosition) {
                positionPanelSmartly(this.panel, this.canvas, this.components);
            } else {
                this.restoreState(this.state);
            }
        }

        // Setup interactions if not already setup
        if (!this.interactionsSetup) {
            this.setupInteractions();
            this.interactionsSetup = true;
        }

        // Show panel
        this.panel.style.opacity = '1';
        this.panel.style.pointerEvents = 'auto';

        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
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

        // No highlighting if there's no table data
        if (!this.truthTableData.table || this.truthTableData.table.length === 0) {
            return;
        }

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
     * @param {number} availableHeight - Maximum available height for the table content
     * @param {Object} options - Options object
     * @param {boolean} options.fitPanel - If true, resize the panel to fit content
     * @returns {number} The actual height used
     */
    applyTableHeight(availableHeight, { fitPanel = false } = {}) {
        if (!this.table) return availableHeight;

        const content = document.getElementById('truthTableContent');
        if (!content) return availableHeight;

        // Get the header height to calculate available space for rows
        const headerEl = content.querySelector('.tabulator-header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 0;

        // Calculate available height for rows
        const rowAreaHeight = availableHeight - headerHeight;

        // Get number of rows
        const rows = this.table.getRows();
        const rowCount = rows.length;

        // Calculate the actual content height based on row count and appropriate row height
        let actualRowAreaHeight = rowAreaHeight;
        let rowHeight = 36; // default

        if (rowCount > 0) {
            // Calculate height per row
            // - Minimum 25px to ensure readability
            // - Maximum 36px to prevent excessive spacing (appropriate for 14px font)
            const minRowHeight = 25;
            const maxRowHeight = 36;

            if (fitPanel) {
                // When fitting panel to content, use max row height for optimal display
                rowHeight = maxRowHeight;
            } else if (rowAreaHeight > 0) {
                // When constrained to available space, calculate best fit
                const calculatedHeight = Math.floor(rowAreaHeight / rowCount);
                rowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, calculatedHeight));
            }

            // Calculate actual content height
            const neededHeight = rowCount * rowHeight;
            // When fitting panel, expand to needed height; otherwise constrain to available
            actualRowAreaHeight = fitPanel ? neededHeight : Math.min(rowAreaHeight, neededHeight);

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

        // Calculate actual total height needed (header + rows)
        const actualTotalHeight = headerHeight + actualRowAreaHeight;

        // Set all container heights to fit the actual content
        content.style.height = actualTotalHeight + 'px';

        const tabulatorEl = content.querySelector('.tabulator');
        if (tabulatorEl) {
            tabulatorEl.style.height = actualTotalHeight + 'px';
        }

        const tableholder = content.querySelector('.tabulator-tableholder');
        if (tableholder) {
            tableholder.style.height = actualRowAreaHeight + 'px';
        }

        const tableEl = content.querySelector('.tabulator-table');
        if (tableEl) {
            tableEl.style.height = actualRowAreaHeight + 'px';
        }

        // Resize the panel itself to fit the content
        if (fitPanel && this.panel) {
            const panelHeader = this.panel.querySelector('.panel-header');
            const panelHeaderHeight = panelHeader ? panelHeader.offsetHeight : 0;
            // Get the margin-bottom of the panel header (gap between header and content)
            const panelHeaderStyles = panelHeader ? getComputedStyle(panelHeader) : null;
            const headerMarginBottom = panelHeaderStyles ? parseFloat(panelHeaderStyles.marginBottom) || 0 : 0;

            const panelStyles = getComputedStyle(this.panel);
            const paddingTop = parseFloat(panelStyles.paddingTop) || 0;
            const paddingBottom = parseFloat(panelStyles.paddingBottom) || 0;

            // Add same gap at bottom as between header and content for visual balance
            const bottomGap = headerMarginBottom;

            const newPanelHeight = panelHeaderHeight + headerMarginBottom + paddingTop + paddingBottom + actualTotalHeight + bottomGap;
            this.panel.style.height = newPanelHeight + 'px';
        }

        // Don't call redraw() as it resets our styles
        return actualTotalHeight;
    }

    /**
     * Apply width to panel to fit table content
     * Called when panel needs to auto-fit to new column structure
     */
    applyTableWidth() {
        if (!this.panel || !this.table) {
            return;
        }

        // Tabulator adds the .tabulator class to the element it's initialized on
        // which is #truthTableContent itself, not a child element
        const content = document.getElementById('truthTableContent');
        if (!content) {
            return;
        }

        const panelStyles = getComputedStyle(this.panel);
        const paddingLeft = parseFloat(panelStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(panelStyles.paddingRight) || 0;

        // Get the table's natural width (scrollWidth includes overflow content)
        const tableWidth = content.scrollWidth;
        // Add panel padding and a small buffer
        const newPanelWidth = tableWidth + paddingLeft + paddingRight + 2;
        this.panel.style.width = newPanelWidth + 'px';
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

        // Debounce Tabulator redraw using requestAnimationFrame
        if (this.resizeRAF) {
            cancelAnimationFrame(this.resizeRAF);
        }
        this.resizeRAF = requestAnimationFrame(() => {
            if (this.table && availableHeight > 0) {
                this.applyTableHeight(availableHeight);
            }
        });
    }

    /**
     * Save panel state
     */
    saveState() {
        if (!this.panel || !this.table) {
            return;
        }

        const columns = this.table.getColumns().map(col => col.getField()).filter(f => f);

        // Read position from data-x/data-y attributes (set by both smart positioning and dragging)
        const x = parseFloat(this.panel.getAttribute('data-x')) || 0;
        const y = parseFloat(this.panel.getAttribute('data-y')) || 0;

        // Get dimensions - use style values if set, otherwise use computed offset dimensions
        // This ensures auto-fitted dimensions are captured after structure changes
        const width = this.panel.style.width || (this.panel.offsetWidth + 'px');
        const height = this.panel.style.height || (this.panel.offsetHeight + 'px');

        this.state = {
            columnOrder: columns,
            width: width,
            height: height,
            x: x,
            y: y,
            visible: this.panel.style.opacity !== '0'
        };

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

            // Clamp position to keep panel at least partially visible
            // Allow panel to be positioned at most 80% off-screen
            const maxOffscreenX = panelWidth * 0.8;
            const maxOffscreenY = panelHeight * 0.8;

            const minX = -maxOffscreenX;
            const maxX = viewportWidth - (panelWidth - maxOffscreenX);
            const minY = -maxOffscreenY;
            const maxY = viewportHeight - (panelHeight - maxOffscreenY);

            // Clamp values
            x = Math.max(minX, Math.min(maxX, x));
            y = Math.max(minY, Math.min(maxY, y));

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
    }

    /**
     * Refresh the truth table with updated cache data
     * Called when TRUTH_TABLE_COMPUTED event fires
     */
    refresh() {
        logger.debug('[TruthTablePanel] refresh() called');

        // Don't refresh if panel doesn't exist
        if (!this.panel) {
            logger.debug('[TruthTablePanel] refresh() - panel does not exist, returning');
            return;
        }

        // Don't refresh if panel is hidden
        if (this.panel.classList.contains('hidden')) {
            logger.debug('[TruthTablePanel] refresh() - panel is hidden, returning');
            return;
        }

        const cache = this.circuitState.getTruthTableCache();
        logger.debug('[TruthTablePanel] refresh() - cache:', {
            inputLabels: cache?.inputs?.map(i => i.label),
            outputLabels: cache?.outputs?.map(o => o.label)
        });

        // Hide panel only if no cache at all
        if (!cache) {
            this.hide();
            return;
        }

        const { inputs, outputs, table, isValid, reason } = cache;

        // If no table data (no inputs or no outputs), show invalid message
        if (!table || table.length === 0) {
            // Deep copy inputs/outputs to capture current labels (avoid reference issues)
            this.truthTableData = {
                inputs: (inputs || []).map(inp => ({ ...inp })),
                outputs: (outputs || []).map(out => ({ ...out })),
                table: [],
                isValid: false,
                reason: reason
            };
            this.displayInvalidMessage(true); // true = panel was already visible
            return;
        }

        // Check if we're transitioning from no-table state to having table
        const hadNoTable = this.truthTableData && this.truthTableData.table.length === 0;

        // Check if column structure changed (inputs/outputs added/removed)
        const countChanged =
            hadNoTable ||
            !this.truthTableData ||
            inputs.length !== this.truthTableData.inputs.length ||
            outputs.length !== this.truthTableData.outputs.length;

        // Check if labels changed (need to update column headers)
        const labelsChanged = !countChanged && this.truthTableData && (
            inputs.some((input, i) => input.label !== this.truthTableData.inputs[i]?.label) ||
            outputs.some((output, i) => output.label !== this.truthTableData.outputs[i]?.label)
        );

        logger.debug('[TruthTablePanel] refresh() - change detection:', {
            countChanged,
            labelsChanged,
            currentLabels: {
                inputs: this.truthTableData?.inputs?.map(i => i.label),
                outputs: this.truthTableData?.outputs?.map(o => o.label)
            },
            newLabels: {
                inputs: inputs.map(i => i.label),
                outputs: outputs.map(o => o.label)
            }
        });

        if (countChanged) {
            // Full rebuild needed - column count has changed
            // Save current position before rebuild
            this.saveState();

            // Clear saved height/width so panel auto-fits to new content
            // Keep position (x, y) so panel stays in same location
            if (this.state) {
                this.state.height = '';
                this.state.width = '';
            }

            // Clear inline styles so panel can auto-fit to new content
            // The CSS will handle default sizing, then applyTableHeight will fit to content
            this.panel.style.width = '';
            this.panel.style.height = '';

            // Update data and reset column order for new structure
            // Deep copy inputs/outputs to capture current labels (avoid reference issues)
            this.truthTableData = {
                inputs: inputs.map(inp => ({ ...inp })),
                outputs: outputs.map(out => ({ ...out })),
                table,
                isValid
            };
            this.columnOrder = null;

            // Rebuild table with new columns (display() will restore position from state)
            this.display();
        } else if (labelsChanged) {
            // Labels changed but column count is the same - update headers in place
            // Deep copy inputs/outputs to capture current labels (avoid reference issues)
            this.truthTableData = {
                inputs: inputs.map(inp => ({ ...inp })),
                outputs: outputs.map(out => ({ ...out })),
                table,
                isValid
            };
            this._updateColumnHeaders();
            this.table.replaceData(table);
            this.reapplyRowHeights();
            this.updateHighlight();
        } else {
            // Same structure - just update data in place (fast path)
            // Deep copy inputs/outputs to capture current labels (avoid reference issues)
            this.truthTableData = {
                inputs: inputs.map(inp => ({ ...inp })),
                outputs: outputs.map(out => ({ ...out })),
                table,
                isValid
            };
            this.table.replaceData(table);

            // Re-apply row heights after replaceData since Tabulator resets styles
            this.reapplyRowHeights();

            this.updateHighlight();
        }
    }

    /**
     * Update column headers when labels change (without full table rebuild)
     * Uses setColumns() since updateDefinition() doesn't work on grouped columns
     * @private
     */
    _updateColumnHeaders() {
        if (!this.table) return;

        // Generate new column definitions with updated labels from this.truthTableData
        const newColumns = this.generateColumns();

        // Use setColumns to update all column headers at once
        // This is more efficient than full table rebuild and preserves data
        this.table.setColumns(newColumns);
    }

    /**
     * Re-apply row heights to maintain consistent appearance after data updates
     * Called after replaceData() which resets Tabulator's internal row styles
     */
    reapplyRowHeights() {
        const content = document.getElementById('truthTableContent');
        if (!content) return;

        const rowHeight = 36; // Use max row height for consistent display
        const contentHeight = 20;
        const verticalPadding = Math.max(0, (rowHeight - contentHeight) / 2);

        const rowElements = content.querySelectorAll('.tabulator-row');
        rowElements.forEach(row => {
            row.style.setProperty('height', rowHeight + 'px', 'important');
            row.style.setProperty('min-height', rowHeight + 'px', 'important');
            row.style.setProperty('max-height', rowHeight + 'px', 'important');

            const cells = row.querySelectorAll('.tabulator-cell');
            cells.forEach(cell => {
                cell.style.setProperty('height', 'auto', 'important');
                cell.style.setProperty('padding-top', verticalPadding + 'px', 'important');
                cell.style.setProperty('padding-bottom', verticalPadding + 'px', 'important');
            });
        });
    }

    /**
     * Hide the truth table panel
     */
    hide() {
        if (this.panel) {
            // Save state BEFORE hiding - offsetWidth becomes 0 after display:none
            this.saveState();
            this.panel.style.opacity = '0';
            this.panel.style.pointerEvents = 'none';
            this.panel.classList.add('hidden');
            this.panel.style.display = 'none';
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

        const sanitizedState = { ...state };

        // Validate that positions are reasonable (not extremely negative or corrupted)
        if (sanitizedState.x !== undefined && sanitizedState.x < -500) {
            sanitizedState.x = 0;
        }
        if (sanitizedState.y !== undefined && sanitizedState.y < -500) {
            sanitizedState.y = 0;
        }

        // Ignore any legacy left/top/transform properties
        delete sanitizedState.left;
        delete sanitizedState.top;
        delete sanitizedState.transform;

        this.state = sanitizedState;
        if (sanitizedState.columnOrder) {
            this.columnOrder = sanitizedState.columnOrder;
        }
    }

    /**
     * Clean up resources and event listeners
     */
    destroy() {
        // Unsubscribe from events
        eventBus.off(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this._boundHandleStepCompleted);
        eventBus.off(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._boundHandleValidityChanged);

        // Destroy Tabulator instance
        if (this.table) {
            this.table.destroy();
            this.table = null;
        }

        // Unset Interact.js
        if (this.interactionsSetup && this.panel) {
            interact(this.panel).unset();
            this.interactionsSetup = false;
        }

        // Cancel any pending resize RAF
        if (this.resizeRAF) {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = null;
        }
    }
}
