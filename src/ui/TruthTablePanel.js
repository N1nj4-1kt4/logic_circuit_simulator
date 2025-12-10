import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';
import interact from 'interactjs';
import { positionPanelSmartly } from '../utils/positioning.js';
import { buildTruthTableColumns, inputValuesToIndex, estimatePanelHeight } from '../utils/truthTableUtils.js';
import { UI, TRUTH_TABLE } from '../constants.js';
import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import {
    TruthTablePanelStateMachine,
    RenderQueue,
    PANEL_STATES,
    DATA_STATES,
    ACTION_TYPES
} from './TruthTablePanelStateMachine.js';

/**
 * TruthTablePanel - Manages the truth table UI using Tabulator.js
 *
 * ## Architecture
 *
 * Uses an explicit state machine ({@link TruthTablePanelStateMachine}) for predictable
 * state management. The state machine handles:
 * - Panel visibility states (HIDDEN, SHOWING_*, VISIBLE_*)
 * - Data synchronization states (FRESH, STALE, COMPUTING)
 * - Simulation row tracking (lastCycleIndex)
 *
 * All event handlers delegate to the state machine, which returns action objects.
 * The panel executes these actions via {@link _executeAction}.
 *
 * ## Render Serialization
 *
 * Table renders are serialized through {@link RenderQueue} to prevent concurrent
 * Tabulator builds. Multiple rapid render requests collapse into: first + one pending.
 *
 * ## Responsibilities
 * - Display pre-computed truth table from CircuitState cache
 * - Handle column reordering (inputs and outputs separately)
 * - Highlight rows matching current simulation step
 * - Provide drag/resize functionality via Interact.js
 * - Persist panel state (position, size, column order)
 *
 * ## Event Subscriptions
 * - SIMULATION_STEP_COMPLETED: Tracks cycle index, highlights row when visible
 * - CIRCUIT_VALIDITY_CHANGED: Shows invalid message when circuit becomes incomplete
 * - CIRCUIT_ANALYSIS_COMPUTING: Shows progress bar during computation
 * - CIRCUIT_ANALYSIS_COMPUTED: Updates table when computation completes
 *
 * @see TruthTablePanelStateMachine for state machine implementation
 * @see RenderQueue for render serialization
 */
export class TruthTablePanel {
    // ============================================================================
    // SECTION: Constructor & Initialization
    // ============================================================================

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

        /**
         * Tabulator.js instance for rendering the truth table grid.
         *
         * LIFECYCLE NOTE: This is destroyed and recreated during table rebuilds
         * (structure changes) but preserved during show/hide cycles.
         * See _renderTable() and destroy() for the two-level lifecycle.
         * @type {Tabulator|null}
         */
        this.tabulatorInstance = null;
        this.panel = null;
        this.state = null;

        // Circuit analysis data (pre-computed input/output mappings)
        this.circuitAnalysis = null;
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
        this._boundHandleComputing = this._handleComputing.bind(this);
        this._boundHandleComputed = this._handleComputed.bind(this);

        // Subscribe to declarative events
        this._setupEventListeners();

        // Initialization flag
        this._initialized = false;

        /**
         * State machine for managing panel visibility and data synchronization.
         * Returns action objects that this panel executes via _executeAction().
         * @type {TruthTablePanelStateMachine}
         * @private
         */
        this._stateMachine = new TruthTablePanelStateMachine(this);

        /**
         * Render queue to serialize async table renders.
         * Prevents concurrent Tabulator builds; collapses multiple pending into one.
         * @type {RenderQueue}
         * @private
         */
        this._renderQueue = new RenderQueue();
    }

    /**
     * Initialize the panel (first-time setup)
     * Call once after construction before show()
     * @param {Object} savedState - Optional saved state to restore
     */
    init(savedState = null) {
        // 1. Cache DOM references
        this.panel = document.getElementById('truthTablePanel');
        const content = document.getElementById('truthTableContent');

        if (!this.panel || !content) {
            throw new Error('TruthTablePanel: Required DOM elements not found');
        }

        // 2. Restore saved state
        if (savedState) {
            this._setState(savedState);
        }

        // 3. Setup close button (one-time)
        this._setupCloseButton();

        // 4. Mark as initialized
        this._initialized = true;
    }

    /**
     * Setup close button listener
     * @private
     */
    _setupCloseButton() {
        const closeButton = document.getElementById('closeTruthTable');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.hide();
            });
        }
    }

    // ============================================================================
    // SECTION: Event Handling
    // ============================================================================

    /**
     * Setup event listeners for declarative events
     * @private
     */
    _setupEventListeners() {
        // Highlight row when simulation steps
        eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this._boundHandleStepCompleted);

        // Show invalid message when circuit becomes incomplete
        eventBus.on(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._boundHandleValidityChanged);

        // Progress updates during async computation
        eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTING, this._boundHandleComputing);

        // Computation complete - refresh table if visible
        eventBus.on(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, this._boundHandleComputed);
    }

    /**
     * Handle simulation step completed event.
     * State machine tracks the cycle index and returns appropriate action.
     * @private
     */
    _handleStepCompleted(data) {
        const action = this._stateMachine.handleStepCompleted(data);
        this._executeAction(action);
    }

    /**
     * Handle circuit validity changed event.
     * This is the PRIMARY handler for invalid circuit states.
     * CIRCUIT_ANALYSIS_COMPUTED only fires for valid circuits, so this handler
     * is responsible for ALL invalid state display.
     * @private
     */
    _handleValidityChanged(data) {
        const action = this._stateMachine.handleValidityChanged(data);

        // Update local analysis state to reflect invalidity when visible and invalid
        if (this._isVisible() && !data.canSimulate && this.circuitAnalysis) {
            this.circuitAnalysis.isValid = false;
            this.circuitAnalysis.reason = data.reason;
        }

        this._executeAction(action);
    }

    /**
     * Handle truth table computing progress event.
     * State machine tracks computing state and returns appropriate action.
     * @private
     */
    _handleComputing(data) {
        const action = this._stateMachine.handleComputing(data);
        this._executeAction(action);
    }

    /**
     * Handle circuit analysis computed event.
     *
     * NOTE: This event only fires for VALID circuits (isValid === true).
     * Invalid circuits are handled by CIRCUIT_VALIDITY_CHANGED.
     * Therefore, we can assume analysis.isValid === true and analysis.table.length > 0.
     *
     * Always keeps circuitAnalysis in sync with events (even when hidden).
     * State machine determines appropriate action based on panel state and what changed.
     * @private
     */
    async _handleComputed() {
        // Hide progress indicator
        this._hideProgress();

        // Always keep local analysis in sync (even when panel is hidden)
        const analysis = this.circuitState.getCircuitAnalysis();
        if (!analysis) {
            return;
        }

        const oldAnalysis = this.circuitAnalysis;
        this.circuitAnalysis = this._deepCopyAnalysis(analysis);

        // State machine determines appropriate action based on what changed
        const action = this._stateMachine.handleComputed(analysis, oldAnalysis);

        await this._executeAction(action);
    }

    // ============================================================================
    // SECTION: Progress UI
    // ============================================================================

    /**
     * Show progress indicator in the panel.
     * NOTE: Progress is inserted into the panel container (not #truthTableContent)
     * because Tabulator clears the content element when it initializes.
     * @private
     */
    _showProgress(percent, current, total) {
        if (!this.panel) {
            return;
        }

        let progressEl = this.panel.querySelector('.truth-table-progress');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.className = 'truth-table-progress';
            progressEl.innerHTML = `
                <div class="progress-text">Computing truth table...</div>
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
                <div class="progress-detail"></div>
            `;
            this.panel.appendChild(progressEl);
        }

        const bar = progressEl.querySelector('.progress-bar');
        const detail = progressEl.querySelector('.progress-detail');
        if (bar) bar.style.width = `${percent}%`;
        if (detail) detail.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} rows (${percent}%)`;
    }

    /**
     * Hide progress indicator
     * @private
     */
    _hideProgress() {
        if (!this.panel) return;

        const progressEl = this.panel.querySelector('.truth-table-progress');
        if (progressEl) {
            progressEl.remove();
        }
    }

    /**
     * Show rendering spinner during Tabulator build.
     * NOTE: Spinner is inserted into the panel container (not #truthTableContent)
     * because Tabulator clears the content element when it initializes.
     * @private
     */
    _showRenderingSpinner() {
        if (!this.panel) {
            return;
        }

        // Remove computing progress if present
        this._hideProgress();

        let spinnerEl = this.panel.querySelector('.truth-table-rendering');
        if (!spinnerEl) {
            spinnerEl = document.createElement('div');
            spinnerEl.className = 'truth-table-rendering';
            spinnerEl.innerHTML = `
                <div class="rendering-spinner"></div>
                <div class="rendering-text">Rendering table...</div>
            `;
            this.panel.appendChild(spinnerEl);
        }
    }

    /**
     * Hide rendering spinner
     * @private
     */
    _hideRenderingSpinner() {
        if (!this.panel) return;

        const spinnerEl = this.panel.querySelector('.truth-table-rendering');
        if (spinnerEl) {
            spinnerEl.remove();
        }
    }

    // ============================================================================
    // SECTION: State Machine Action Dispatcher
    // ============================================================================

    /**
     * Execute an action returned by the state machine.
     * This is the central dispatcher that translates state machine actions
     * into actual UI operations.
     *
     * @param {Object} action - Action object with `action` type and optional parameters
     * @returns {Promise<void>}
     * @private
     */
    async _executeAction(action) {
        if (!action || action.action === ACTION_TYPES.NONE) {
            return;
        }

        switch (action.action) {
            case ACTION_TYPES.SHOW_COMPUTING:
                this._revealPanel();
                this._renderComputingState();
                break;

            case ACTION_TYPES.SHOW_INVALID:
                this._revealPanel();
                this._renderInvalidState(action.reason);
                break;

            case ACTION_TYPES.RENDER_TABLE:
                await this._renderQueue.enqueue(() => this._safeRenderTable());
                this._setupInteractions();
                break;

            case ACTION_TYPES.REBUILD_TABLE:
                // Structure changed - clear saved dimensions before rebuild
                this._saveState();
                if (this.state) {
                    this.state.height = '';
                    this.state.width = '';
                }
                this.columnOrder = null;
                await this._renderQueue.enqueue(() => this._safeRenderTable());
                this._setupInteractions();
                break;

            case ACTION_TYPES.UPDATE_HEADERS:
                this._updateColumnHeaders();
                this._reapplyRowHeights();
                this._updateHighlight();
                break;

            case ACTION_TYPES.UPDATE_DATA:
                if (this.tabulatorInstance) {
                    this.tabulatorInstance.setData(this.circuitAnalysis.table);
                }
                break;

            case ACTION_TYPES.SHOW_PROGRESS:
                this._showProgress(action.percent, action.current, action.total);
                break;

            case ACTION_TYPES.HIGHLIGHT_ROW:
                this._highlightRowByIndex(action.index);
                break;

            case ACTION_TYPES.HIDE:
                this._hidePanel();
                break;

            case ACTION_TYPES.SYNC:
                await this._syncTabulatorWithAnalysis();
                break;

            default:
                // Unknown action - ignore
                break;
        }
    }

    /**
     * Reveal the panel (make visible but potentially with opacity 0).
     * Used by state machine actions before rendering content.
     * @private
     */
    _revealPanel() {
        if (!this.panel) return;
        this.panel.classList.remove('hidden');
        this.panel.style.display = 'block';
        this.panel.style.pointerEvents = 'auto';
    }

    /**
     * Hide the panel completely.
     * Used by state machine HIDE action.
     * @private
     */
    _hidePanel() {
        if (!this.panel) return;
        // Save state BEFORE hiding (captures position, size, columns)
        this._saveState();
        // Override visible to false since we're hiding
        if (this.state) {
            this.state.visible = false;
            if (this.onStateChange) {
                this.onStateChange(this.state);
            }
        }
        this.panel.style.display = 'none';
        this.panel.classList.add('hidden');
    }

    /**
     * Safe wrapper around _renderTabulator that integrates with state machine.
     * Notifies state machine of render lifecycle.
     * @returns {Promise<void>}
     * @private
     */
    async _safeRenderTable() {
        const content = document.getElementById('truthTableContent');
        if (!content || !this.circuitAnalysis) return;

        // Compute wasVisible for positioning logic
        const wasVisible = this._isVisible() && this.tabulatorInstance !== null;

        this._stateMachine.renderStarted();
        try {
            await this._renderTabulator(content, wasVisible);
        } finally {
            this._stateMachine.renderCompleted();
        }
    }

    // ============================================================================
    // SECTION: Visibility & Lifecycle
    // ============================================================================

    /**
     * Check if panel is visible
     * @returns {boolean}
     * @private
     */
    _isVisible() {
        return this.panel &&
               !this.panel.classList.contains('hidden') &&
               this.panel.style.display !== 'none';
    }

    /**
     * Highlight row by cycle index (used by SIMULATION_STEP_COMPLETED)
     * @param {number} index - The row index to highlight
     * @private
     */
    _highlightRowByIndex(index) {
        if (!this.tabulatorInstance) return;

        this.tabulatorInstance.deselectRow();

        const rows = this.tabulatorInstance.getRows();
        if (rows[index]) {
            rows[index].select();
            rows[index].scrollTo();
        }
    }

    /**
     * Position panel on first open - either smart position or restore saved position
     * @param {boolean} wasVisible - Whether panel was already visible before this call
     * @private
     */
    _positionPanelIfNeeded(wasVisible) {
        if (wasVisible) return;

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
            this._restoreState(this.state);
        }
    }

    // ============================================================================
    // SECTION: Data Management
    // ============================================================================

    /**
     * Create a deep copy of circuit analysis data.
     * Deep copy provides lifecycle safety - Tabulator holds reference to table array.
     * @param {Object} analysis - The analysis object to copy
     * @returns {Object} Deep copied analysis with inputs, outputs, table, isValid, reason
     * @private
     */
    _deepCopyAnalysis(analysis) {
        const { inputs, outputs, table, isValid, reason } = analysis;
        return {
            inputs: (inputs || []).map(inp => ({ ...inp })),
            outputs: (outputs || []).map(out => ({ ...out })),
            table: table || [],
            isValid: isValid,
            reason: reason
        };
    }

    /**
     * Set local copy of circuit analysis from circuitState.
     * Deep copy provides lifecycle safety - Tabulator holds reference to table array.
     * @private
     */
    _setCircuitAnalysisLocalCopy() {
        // Read from pre-computed circuit analysis
        const analysis = this.circuitState.getCircuitAnalysis();

        if (!analysis) {
            // Analysis not available yet - show panel with "computing" state
            // Initialize with empty data so panel can display
            this.circuitAnalysis = {
                inputs: [],
                outputs: [],
                table: [],
                isValid: false,
                reason: 'Computing truth table...'
            };
            return;
        }

        this.circuitAnalysis = this._deepCopyAnalysis(analysis);

        // Initialize column order if not set (only for valid circuits with columns)
        const columnCount = this.circuitAnalysis.inputs.length + this.circuitAnalysis.outputs.length;
        if (!this.columnOrder && columnCount > 0) {
            this.columnOrder = [];
            for (let i = 0; i < columnCount; i++) {
                this.columnOrder.push(i);
            }
        }
    }

    // ============================================================================
    // SECTION: Table Rendering (Tabulator)
    // ============================================================================

    /**
     * Build Tabulator instance and return Promise that resolves when table is ready.
     * Only handles Tabulator creation - caller (show()) handles common post-render setup.
     *
     * ## Two-Level Lifecycle Architecture
     *
     * This method implements "Table Rebuild" - the fine-grained lifecycle level:
     * - Destroys only the Tabulator instance and Interact.js bindings
     * - Preserves panel state (position, size, column order)
     * - Called when circuit structure changes (inputs/outputs added/removed)
     *
     * This is distinct from destroy() which implements "Full Destroy":
     * - Destroys the entire TruthTablePanel object
     * - Unsubscribes all EventBus listeners
     * - Called by coordinator when switching/clearing boards
     *
     * | Level          | Method             | When                    | Preserves                     |
     * |----------------|--------------------|-------------------------|-------------------------------|
     * | Table Rebuild  | _renderTabulator() | Structure changes       | Position, size, subscriptions |
     * | Full Destroy   | destroy()          | Board switch/clear      | Nothing (fresh start)         |
     *
     * @param {HTMLElement} content - The content container element
     * @param {boolean} wasVisible - Whether panel was already visible before this call
     * @returns {Promise<void>} Resolves when tableBuilt event fires
     * @private
     */
    _renderTabulator(content, wasVisible) {
        if (!this.circuitAnalysis || !content) {
            return Promise.resolve();
        }

        // Detect if structure changed since state was saved (e.g., inputs/outputs added while panel was closed)
        // If structure changed, clear saved dimensions so panel auto-fits to new content
        if (this.state && this.state.columnOrder) {
            const currentColumnCount = this.circuitAnalysis.inputs.length + this.circuitAnalysis.outputs.length;
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

        // Apply saved dimensions BEFORE Tabulator builds (so it can measure correctly)
        if (this.state && !wasVisible) {
            if (this.state.width) {
                this.panel.style.width = this.state.width;
            }
            if (this.state.height) {
                this.panel.style.height = this.state.height;
            }
        }

        // Generate Tabulator columns with groups
        const columns = this._generateColumns();

        // Estimate height upfront when panel wasn't visible and no Tabulator exists
        // This prevents the rendering spinner from appearing in a too-small panel
        if (!wasVisible && !this.tabulatorInstance && this.circuitAnalysis?.table?.length) {
            const estimatedHeight = estimatePanelHeight(
                this.circuitAnalysis.table.length,
                TRUTH_TABLE
            );
            this.panel.style.height = `${estimatedHeight}px`;
        }

        // PRESERVE DIMENSIONS before destroying old Tabulator (prevents panel shrink)
        // This keeps the panel visually stable during the rebuild transition
        let preservedDimensions = null;
        if (this.tabulatorInstance && this.panel) {
            preservedDimensions = {
                width: this.panel.offsetWidth,
                height: this.panel.offsetHeight
            };
            this.panel.style.width = `${preservedDimensions.width}px`;
            this.panel.style.height = `${preservedDimensions.height}px`;

            // Show rendering spinner before destroying old table
            this._showRenderingSpinner();
        }

        // Destroy existing Tabulator instance right before creating a new one
        // (kept close to recreation for clearer lifecycle management)
        if (this.tabulatorInstance) {
            this.tabulatorInstance.destroy();
            this.tabulatorInstance = null;

            // Unset Interact.js if it was set up
            if (this.interactionsSetup && this.panel) {
                interact(this.panel).unset();
            }

            // Reset interactions flag when destroying Tabulator
            this.interactionsSetup = false;
        }

        // Initialize Tabulator with virtual DOM - it handles large datasets efficiently
        this.tabulatorInstance = new Tabulator(content, {
            columns: columns,
            data: this.circuitAnalysis.table,
            layout: 'fitColumns',
            selectable: 1, // Single row selection
            movableColumns: true,
            columnHeaderVertAlign: 'bottom',
            reactiveData: false,
            // Virtual DOM rendering - only renders visible rows for performance
            height: '100%', // Required for virtual DOM
            renderVertical: 'virtual', // Enable virtual rendering
        });

        // Apply dark mode theme if needed
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (isDarkMode) {
            content.classList.add('tabulator-midnight');
        }

        // Return Promise that resolves when tableBuilt fires
        // Tabulator.js uses asynchronous initialization. The 'tableBuilt' event is fired
        // internally by Tabulator after the table DOM is fully rendered and ready.
        // We must wait for this event before calling Tabulator methods (getRows, deselectRow, etc.)
        // or manipulating table DOM elements - doing so earlier causes inconsistent behavior or errors.
        // See: https://tabulator.info/docs/6.3/events
        return new Promise((resolve) => {
            this.tabulatorInstance.on('tableBuilt', () => {
                // Hide rendering spinner now that table is ready
                this._hideRenderingSpinner();

                // Listen for column reorder (save state when user drags columns)
                this.tabulatorInstance.on('columnMoved', () => {
                    this._saveState();
                });

                // Apply height to Tabulator after table is built
                // Calculate from panel dimensions for accuracy
                // IMPORTANT: Do this BEFORE releasing preserved dimensions so Tabulator
                // has stable container dimensions for virtual rendering calculations
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
                    this._applyTableHeight(availableHeight, { fitPanel: !hasValidSavedHeight });
                }

                // Fit width if no saved width
                if (!hasValidSavedWidth) {
                    this._applyTableWidth();
                }

                // Release preserved dimensions AFTER height/width applied
                // This ensures Tabulator's virtual rendering has stable container dimensions
                // Only clear dimensions when auto-fitting (no saved values)
                // Keep saved dimensions intact to preserve user's panel size
                if (preservedDimensions && !hasValidSavedWidth) {
                    this.panel.style.width = '';
                }
                if (preservedDimensions && !hasValidSavedHeight) {
                    this.panel.style.height = '';
                }

                // Save state after showing the panel
                this._saveState();
                // Override visible to true since panel is now visible
                if (this.state) {
                    this.state.visible = true;
                    if (this.onStateChange) {
                        this.onStateChange(this.state);
                    }
                }

                // Highlight current row AFTER height is applied (for proper scrollTo)
                this._updateHighlight();

                // Signal that table is ready for common post-render setup
                resolve();
            });
        });
    }

    /**
     * Render an invalid circuit message instead of the truth table.
     * Only handles content rendering - caller is responsible for positioning, interactions, and visibility.
     * @param {string} [reason] - Optional reason (overrides cached analysis reason)
     * @private
     */
    _renderInvalidState(reason = null) {
        const content = document.getElementById('truthTableContent');
        if (!content) return;

        // Destroy existing Tabulator instance if any
        if (this.tabulatorInstance) {
            this.tabulatorInstance.destroy();
            this.tabulatorInstance = null;
        }

        // Use provided reason, or fall back to cached analysis reason
        const displayReason = reason ?? this.circuitAnalysis?.reason ?? 'Circuit incomplete';

        // Clear content and show invalid message
        content.innerHTML = `
            <div class="truth-table-invalid-message">
                <div class="icon">${UI.ICONS.WARNING}</div>
                <div class="message">${displayReason}</div>
            </div>
        `;
    }

    /**
     * Render a computing message with progress bar.
     * Only handles content rendering - caller is responsible for positioning, interactions, and visibility.
     * NOTE: Uses _showProgress which appends to the panel (not content) to avoid Tabulator clearing it.
     * @private
     */
    _renderComputingState() {
        // Destroy existing Tabulator instance if any
        if (this.tabulatorInstance) {
            this.tabulatorInstance.destroy();
            this.tabulatorInstance = null;
        }

        // Clear the content area
        const content = document.getElementById('truthTableContent');
        if (content) {
            content.innerHTML = '';
        }

        // Show progress overlay on the panel (not in content which Tabulator clears)
        this._showProgress(0, 0, 1);
    }

    // ============================================================================
    // SECTION: Row Highlighting
    // ============================================================================

    /**
     * Generate Tabulator column definitions with groups
     * Delegates to pure function buildTruthTableColumns()
     * @private
     */
    _generateColumns() {
        const { inputs, outputs } = this.circuitAnalysis;
        const savedColumnOrder = this.state?.columnOrder || null;
        return buildTruthTableColumns(inputs, outputs, savedColumnOrder);
    }

    /**
     * Update row highlighting to match current circuit state
     * @private
     */
    _updateHighlight() {
        if (!this.tabulatorInstance || !this.circuitAnalysis) return;

        // No highlighting if there's no table data
        if (!this.circuitAnalysis.table || this.circuitAnalysis.table.length === 0) {
            return;
        }

        const { inputs } = this.circuitAnalysis;

        // Get current input values
        const inputValues = inputs.map(input => input.value);

        // Find matching row index
        const matchingIndex = this._findMatchingRow(inputValues);

        if (matchingIndex !== -1) {
            this.tabulatorInstance.deselectRow();

            // Get all rows and select by position
            const rows = this.tabulatorInstance.getRows();
            if (rows[matchingIndex]) {
                rows[matchingIndex].select();
                rows[matchingIndex].scrollTo();
            }
        }
    }

    /**
     * Find row index matching given input values
     * O(m) where m = number of inputs, using binary conversion
     * @private
     */
    _findMatchingRow(inputValues) {
        if (!this.tabulatorInstance || !inputValues || inputValues.length === 0) return -1;
        return inputValuesToIndex(inputValues);
    }

    // ============================================================================
    // SECTION: Layout & Sizing
    // ============================================================================

    /**
     * Apply row height styles to all rows in the table content
     * @param {HTMLElement} content - The content container element
     * @param {number} rowHeight - The height to apply to each row
     * @private
     */
    _applyRowStyles(content, rowHeight) {
        // Calculate padding to vertically center content (assuming ~20px content height)
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
     * Apply height to table, distributing space across rows
     * Similar to fitColumns but for row heights
     * @param {number} availableHeight - Maximum available height for the table content
     * @param {Object} options - Options object
     * @param {boolean} options.fitPanel - If true, resize the panel to fit content
     * @private
     */
    _applyTableHeight(availableHeight, { fitPanel = false } = {}) {
        if (!this.tabulatorInstance) return;

        const content = document.getElementById('truthTableContent');
        if (!content) return;

        // Get the header height to calculate available space for rows
        const headerEl = content.querySelector('.tabulator-header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 0;

        // Calculate available height for rows
        const rowAreaHeight = availableHeight - headerHeight;

        // Get number of rows
        const rows = this.tabulatorInstance.getRows();
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
            this._applyRowStyles(content, rowHeight);
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

        // Notify Tabulator of the height change so virtual DOM recalculates
        // This is critical for tables with many rows (7+ inputs = 128+ rows)
        // Without this, virtual DOM may not render any rows
        this.tabulatorInstance.setHeight(actualTotalHeight);

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

            let newPanelHeight = panelHeaderHeight + headerMarginBottom + paddingTop + paddingBottom + actualTotalHeight + bottomGap;

            // Cap panel height to 80% of viewport to prevent absurdly tall panels for large tables
            const maxPanelHeight = window.innerHeight * 0.8;
            if (newPanelHeight > maxPanelHeight) {
                newPanelHeight = maxPanelHeight;
            }

            this.panel.style.height = newPanelHeight + 'px';
        }
        // Note: We use setHeight() above instead of redraw() because setHeight()
        // properly updates virtual DOM without resetting column/row styles
    }

    /**
     * Apply width to panel to fit table content
     * Called when panel needs to auto-fit to new column structure
     * @private
     */
    _applyTableWidth() {
        if (!this.panel || !this.tabulatorInstance) {
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

    // ============================================================================
    // SECTION: Drag & Resize (Interact.js)
    // ============================================================================

    /**
     * Setup Interact.js for drag and resize (idempotent - safe to call multiple times)
     * Note: Close button is setup in init() via _setupCloseButton()
     * @private
     */
    _setupInteractions() {
        if (this.interactionsSetup) return;

        const panel = this.panel;

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
                    move: this._dragMoveListener.bind(this),
                    end: () => this._saveState()
                }
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                listeners: {
                    move: this._resizeMoveListener.bind(this),
                    end: () => this._saveState()
                },
                modifiers: [
                    interact.modifiers.restrictSize({
                        min: { width: 200, height: 150 }
                    })
                ]
            });

        this.interactionsSetup = true;
    }

    /**
     * Handle drag move events
     * @private
     */
    _dragMoveListener(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    /**
     * Handle resize move events
     * @private
     */
    _resizeMoveListener(event) {
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
            if (this.tabulatorInstance && availableHeight > 0) {
                this._applyTableHeight(availableHeight);
            }
        });
    }

    // ============================================================================
    // SECTION: State Persistence
    // ============================================================================

    /**
     * Save panel state
     * @private
     */
    _saveState() {
        if (!this.panel || !this.tabulatorInstance) {
            return;
        }

        const columns = this.tabulatorInstance.getColumns().map(col => col.getField()).filter(f => f);

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
            visible: this.panel.style.opacity !== '0',
            highlightedRow: this._stateMachine.getState().lastCycleIndex
        };

        // Trigger callback to save to localStorage
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Restore panel state
     * @private
     */
    _restoreState(state) {
        if (!state || !this.panel) return;

        // Cap dimensions to reasonable viewport percentages to prevent
        // restoring absurdly large saved dimensions from large tables
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        // Restore size (only if valid and within reasonable bounds)
        if (state.width && state.width !== '') {
            const savedWidth = parseFloat(state.width);
            if (savedWidth > 0 && savedWidth <= maxWidth) {
                this.panel.style.width = state.width;
            } else if (savedWidth > maxWidth) {
                this.panel.style.width = maxWidth + 'px';
            }
        }
        if (state.height && state.height !== '') {
            const savedHeight = parseFloat(state.height);
            if (savedHeight > 0 && savedHeight <= maxHeight) {
                this.panel.style.height = state.height;
            } else if (savedHeight > maxHeight) {
                this.panel.style.height = maxHeight + 'px';
            }
        }

        // Restore position (prefer transform over left/top)
        if (state.x !== undefined && state.y !== undefined) {
            // Validate position to ensure panel stays within viewport
            let x = state.x;
            let y = state.y;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Get panel dimensions from ACTUAL applied styles (after capping above)
            // This ensures we use the capped dimensions, not the potentially corrupted saved values
            const computedStyle = window.getComputedStyle(this.panel);
            let panelWidth = parseFloat(computedStyle.width) || 400; // Default 400px
            let panelHeight = parseFloat(computedStyle.height) || 300; // Default 300px

            // Ensure dimensions don't exceed viewport for clamping calculations
            panelWidth = Math.min(panelWidth, maxWidth);
            panelHeight = Math.min(panelHeight, maxHeight);

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
     * Update column headers when labels change (without full table rebuild)
     * Uses setColumns() since updateDefinition() doesn't work on grouped columns
     * @private
     */
    _updateColumnHeaders() {
        if (!this.tabulatorInstance) return;

        // Generate new column definitions with updated labels from this.circuitAnalysis
        const newColumns = this._generateColumns();

        // Use setColumns to update all column headers at once
        // This is more efficient than full table rebuild and preserves data
        this.tabulatorInstance.setColumns(newColumns);
    }

    /**
     * Re-apply row heights to maintain consistent appearance after data updates
     * Called after replaceData() which resets Tabulator's internal row styles
     * @private
     */
    _reapplyRowHeights() {
        const content = document.getElementById('truthTableContent');
        if (!content) return;

        const rowHeight = 36; // Use max row height for consistent display
        this._applyRowStyles(content, rowHeight);
    }

    /**
     * Sync Tabulator with current circuitAnalysis.
     * Called when panel becomes visible after changes occurred while hidden.
     * Gets fresh data from circuitState to ensure we have the latest state.
     * @private
     */
    async _syncTabulatorWithAnalysis() {
        // Get FRESH analysis from circuitState (not stale local copy)
        const freshAnalysis = this.circuitState.getCircuitAnalysis();

        // Handle invalid state first - circuit may have become invalid while hidden
        if (!freshAnalysis || !freshAnalysis.isValid) {
            this.circuitAnalysis = freshAnalysis ? this._deepCopyAnalysis(freshAnalysis) : null;
            this._renderInvalidState(freshAnalysis?.reason);
            return;
        }

        // Update local copy with fresh data
        const oldAnalysis = this.circuitAnalysis;
        this.circuitAnalysis = this._deepCopyAnalysis(freshAnalysis);

        if (!this.tabulatorInstance) return;

        // Get the state that Tabulator currently shows
        const currentColumns = this.tabulatorInstance.getColumns();
        const currentInputCount = currentColumns.filter(c => c.getField()?.startsWith('input')).length;
        const currentOutputCount = currentColumns.filter(c => c.getField()?.startsWith('output')).length;

        // Compare with fresh analysis
        const newInputCount = this.circuitAnalysis.inputs.length;
        const newOutputCount = this.circuitAnalysis.outputs.length;

        const structureChanged =
            currentInputCount !== newInputCount ||
            currentOutputCount !== newOutputCount;

        if (structureChanged) {
            // Full rebuild needed - structure changed while panel was hidden
            // Clear saved dimensions so panel auto-fits to new column structure
            this._saveState();
            if (this.state) {
                this.state.height = '';
                this.state.width = '';
            }
            this.panel.style.width = '';
            this.panel.style.height = '';
            this.columnOrder = null;

            const content = document.getElementById('truthTableContent');
            if (content) {
                // Pass wasVisible=false since we cleared dimensions and want fresh auto-fit
                await this._renderTabulator(content, false);
            }
            return;
        }

        // Check for label changes by comparing current headers
        const labelsChanged = this._detectLabelChanges();

        if (labelsChanged) {
            this._updateColumnHeaders();
            this._reapplyRowHeights();
            this._updateHighlight();
            return;
        }

        // Data only change
        this.tabulatorInstance.setData(this.circuitAnalysis.table);
    }

    /**
     * Detect if labels changed by comparing Tabulator headers with circuitAnalysis.
     * @returns {boolean}
     * @private
     */
    _detectLabelChanges() {
        if (!this.tabulatorInstance || !this.circuitAnalysis) return false;

        const columns = this.tabulatorInstance.getColumns();
        const { inputs, outputs } = this.circuitAnalysis;

        // Check input labels
        for (let i = 0; i < inputs.length; i++) {
            const col = columns.find(c => c.getField() === `input${i}`);
            if (col && col.getDefinition().title !== inputs[i].label) {
                return true;
            }
        }

        // Check output labels
        for (let i = 0; i < outputs.length; i++) {
            const col = columns.find(c => c.getField() === `output${i}`);
            if (col && col.getDefinition().title !== outputs[i].label) {
                return true;
            }
        }

        return false;
    }

    /**
     * Hide the truth table panel.
     * Uses state machine to determine action.
     */
    hide() {
        const action = this._stateMachine.handleHide();
        this._executeAction(action);
        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_HIDDEN);
    }

    /**
     * Show the truth table panel.
     * Uses state machine to determine appropriate rendering action.
     * Orchestrates visibility, positioning, interactions, and delegates to appropriate render method.
     */
    async show() {
        if (!this._initialized) {
            throw new Error('TruthTablePanel not initialized. Call init() first.');
        }

        // Ensure DOM references are set
        if (!this.panel) {
            this.panel = document.getElementById('truthTablePanel');
            if (!this.panel) return;
        }

        // Track if panel was visible before (for positioning logic)
        const wasVisible = this._isVisible();

        // Get action from state machine
        const action = this._stateMachine.handleShow();

        // Handle SYNC action - sync Tabulator with analysis data
        // SYNC is returned when: (1) panel already visible with stale data, OR
        // (2) panel was hidden, has Tabulator, but data changed while hidden
        if (action.action === ACTION_TYPES.SYNC) {
            // If panel was hidden, make it visible BEFORE sync (so Tabulator can measure correctly)
            if (!wasVisible) {
                this.panel.classList.remove('hidden');
                this.panel.style.display = 'block';
                this.panel.style.pointerEvents = 'auto';

                // Apply saved position
                if (this.state) {
                    if (this.state.x !== undefined && this.state.y !== undefined) {
                        this.panel.style.left = '0';
                        this.panel.style.top = '0';
                        this.panel.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
                        this.panel.setAttribute('data-x', this.state.x);
                        this.panel.setAttribute('data-y', this.state.y);
                    }
                }
            }

            await this._syncTabulatorWithAnalysis();
            this._setupInteractions();
            // Update highlight using tracked cycle index
            const state = this._stateMachine.getState();
            if (state.lastCycleIndex !== null) {
                this._highlightRowByIndex(state.lastCycleIndex);
            }
            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
            return;
        }

        // Handle NONE action (reusing existing Tabulator, or already visible)
        if (action.action === ACTION_TYPES.NONE) {
            // Make panel visible (it may be hidden from previous hide() call)
            this.panel.classList.remove('hidden');
            this.panel.style.display = 'block';
            this.panel.style.pointerEvents = 'auto';

            // Since Tabulator's virtual DOM doesn't properly rerender after display:none,
            // we need to trigger a rebuild. A full rebuild (~50ms) is faster than
            // Tabulator's async row rendering after visibility change (~1400ms).
            if (this.tabulatorInstance) {
                const content = document.getElementById('truthTableContent');
                if (content && this.circuitAnalysis) {
                    // Unset Interact.js before destroying Tabulator
                    if (this.interactionsSetup && this.panel) {
                        interact(this.panel).unset();
                        this.interactionsSetup = false;
                    }

                    // Destroy old instance
                    this.tabulatorInstance.destroy();
                    this.tabulatorInstance = null;

                    // Quick rebuild - reuse existing column config and data
                    const columns = buildTruthTableColumns(
                        this.circuitAnalysis.inputs,
                        this.circuitAnalysis.outputs,
                        this.columnOrder
                    );

                    this.tabulatorInstance = new Tabulator(content, {
                        columns: columns,
                        data: this.circuitAnalysis.table,
                        layout: 'fitColumns',
                        selectable: 1,
                        movableColumns: true,
                        columnHeaderVertAlign: 'bottom',
                        reactiveData: false,
                        height: '100%',
                        renderVertical: 'virtual',
                    });

                    // Re-setup interactions after rebuild
                    this._setupInteractions();
                }
            }

            // Update highlight
            const state = this._stateMachine.getState();
            if (state.lastCycleIndex !== null && this.tabulatorInstance) {
                this._highlightRowByIndex(state.lastCycleIndex);
            }

            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
            return;
        }

        // Slow path: Transitioning from hidden to visible
        // Ensure we have analysis data for local copy
        this._setCircuitAnalysisLocalCopy();

        // Show panel (display:block, but opacity:0 until content ready)
        this.panel.classList.remove('hidden');
        this.panel.style.display = 'block';
        this.panel.style.opacity = '0';
        this.panel.style.pointerEvents = 'auto';

        // Apply saved position before rendering (avoids flicker)
        if (this.state && !wasVisible) {
            if (this.state.x !== undefined && this.state.y !== undefined) {
                this.panel.style.left = '0';
                this.panel.style.top = '0';
                this.panel.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
                this.panel.setAttribute('data-x', this.state.x);
                this.panel.setAttribute('data-y', this.state.y);
            }
        }

        // Execute action based on state machine decision
        switch (action.action) {
            case ACTION_TYPES.SHOW_COMPUTING:
                this._renderComputingState();
                break;

            case ACTION_TYPES.SHOW_INVALID:
                this._renderInvalidState(action.reason);
                break;

            case ACTION_TYPES.RENDER_TABLE: {
                const content = document.getElementById('truthTableContent');
                if (content && this.circuitAnalysis) {
                    // Signal render lifecycle to state machine
                    this._stateMachine.renderStarted();
                    try {
                        await this._renderTabulator(content, wasVisible);
                    } finally {
                        this._stateMachine.renderCompleted();
                    }
                }
                break;
            }
        }

        // Common post-render setup for ALL paths
        this._positionPanelIfNeeded(wasVisible);
        this._setupInteractions();
        this.panel.style.opacity = '1';

        // Update highlight using tracked cycle index (if panel is showing table)
        const state = this._stateMachine.getState();
        if (state.lastCycleIndex !== null &&
            state.panel === PANEL_STATES.VISIBLE_TABLE &&
            this.tabulatorInstance) {
            this._highlightRowByIndex(state.lastCycleIndex);
        }

        eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Set state (for loading from localStorage)
     * @private
     */
    _setState(state) {
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
        // Restore highlighted row to state machine for scroll position restoration
        if (sanitizedState.highlightedRow !== undefined && sanitizedState.highlightedRow !== null) {
            this._stateMachine.setLastCycleIndex(sanitizedState.highlightedRow);
        }
    }

    /**
     * Clean up all resources and event listeners.
     *
     * ## Two-Level Lifecycle Architecture
     *
     * This method implements "Full Destroy" - the coarse-grained lifecycle level:
     * - Unsubscribes all EventBus listeners
     * - Destroys Tabulator instance
     * - Unsets Interact.js bindings
     * - Clears all DOM references
     *
     * Called by circuit-simulator.js when:
     * - BOARD_CLEARED event fires (new board)
     * - BOARD_LOADED event fires (switching boards)
     *
     * This is distinct from the partial cleanup in _renderTable() which only
     * destroys Tabulator/Interact.js when rebuilding the table for structure changes.
     *
     * @see _renderTable() for the fine-grained "Table Rebuild" lifecycle
     */
    destroy() {
        // Unsubscribe from events
        eventBus.off(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this._boundHandleStepCompleted);
        eventBus.off(EVENT_TYPES.CIRCUIT_VALIDITY_CHANGED, this._boundHandleValidityChanged);
        eventBus.off(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTING, this._boundHandleComputing);
        eventBus.off(EVENT_TYPES.CIRCUIT_ANALYSIS_COMPUTED, this._boundHandleComputed);

        // Destroy Tabulator instance
        if (this.tabulatorInstance) {
            this.tabulatorInstance.destroy();
            this.tabulatorInstance = null;
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

        // Clear DOM references and initialization flag (reverse of init)
        this.panel = null;
        this._initialized = false;

        // Reset state machine to initial state
        this._stateMachine.reset();
    }
}
