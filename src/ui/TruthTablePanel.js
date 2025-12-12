import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';
import interact from 'interactjs';
import { positionPanelSmartly } from '../utils/positioning.js';
import { buildTruthTableColumns, inputValuesToIndex, estimatePanelHeight } from '../utils/truthTableUtils.js';
import { createFieldName } from '../utils/columnOrderStrategies.js';
import { UI, TRUTH_TABLE } from '../constants.js';
import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { logger } from '../utils/logger.js';
import {
    TruthTablePanelStateMachine,
    RenderQueue,
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
        logger.debug('[TruthTablePanel] _handleStepCompleted - cycleIndex:', data.cycleIndex, 'totalCombinations:', data.totalCombinations);
        const action = this._stateMachine.handleStepCompleted(data);
        logger.debug('[TruthTablePanel] _handleStepCompleted - action:', action);
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

    /**
     * Handle board changed event.
     * Marks data as STALE immediately so show() knows analysis is outdated
     * before debounced recomputation even starts.
     * @private
     */
    _handleBoardChanged() {
        this._stateMachine.handleBoardChanged();
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
     * This is the SINGLE dispatcher that translates ALL state machine actions
     * into actual UI operations. Both show() and event handlers use this method.
     *
     * ## Unified Dispatch Architecture
     *
     * All actions flow through this method with three phases:
     * 1. PRE-ACTION: Panel reveal, position/dimension restoration
     * 2. DISPATCH: Action-specific execution
     * 3. POST-ACTION: Finalization (interactions, highlight, state save, event)
     *
     * @param {Object} action - Action object with `action` type and optional parameters
     * @param {Object} options - Execution options
     * @param {boolean} options.isShowCall - True if called from show() (enables pre-action setup)
     * @param {boolean} options.wasHidden - True if panel was hidden before this action
     * @returns {Promise<void>}
     * @private
     */
    async _executeAction(action, options = {}) {
        const { isShowCall = false, wasHidden = false } = options;

        // ========================================================================
        // NONE action: Special handling for Tabulator virtual DOM rebuild
        // Tabulator's virtual DOM doesn't properly re-render after display:none,
        // so we rebuild it. A full rebuild (~50ms) is faster than async row rendering (~1400ms).
        // ========================================================================
        if (!action || action.action === ACTION_TYPES.NONE) {
            if (action?.action === ACTION_TYPES.NONE && isShowCall && this.tabulatorInstance && this.circuitAnalysis) {
                // PRE-ACTION: Reveal panel and restore geometry
                this._revealPanel();
                if (wasHidden && this.state) {
                    this._restoreSavedPosition();
                    this._restoreSavedDimensions();
                }

                // DISPATCH: Quick rebuild of Tabulator
                await this._buildTabulator({ isQuickRebuild: true, clearDimensionsOnStructureChange: false });

                // POST-ACTION: Finalization
                this._finalizeAction({ isShowCall: true });
            }
            return;
        }

        // ========================================================================
        // PRE-ACTION: Panel visibility and geometry restoration
        // Only for show() calls that need to reveal the panel
        // ========================================================================
        if (isShowCall && wasHidden && this._shouldRevealPanel(action)) {
            // Reveal panel with opacity 0 until content ready (for slow paths)
            this.panel.classList.remove('hidden');
            this.panel.style.display = 'block';
            this.panel.style.opacity = '0';
            this.panel.style.pointerEvents = 'auto';

            // Restore saved position before rendering (avoids flicker)
            this._restoreSavedPosition();
        }

        // ========================================================================
        // DISPATCH: Action-specific execution
        // ========================================================================
        switch (action.action) {
            case ACTION_TYPES.SHOW_COMPUTING:
                if (!isShowCall) {
                    this._revealPanel();
                }
                this._renderComputingState();
                break;

            case ACTION_TYPES.SHOW_INVALID:
                if (!isShowCall) {
                    this._revealPanel();
                }
                this._renderInvalidState(action.reason);
                break;

            case ACTION_TYPES.RENDER_TABLE:
                // Ensure we have analysis data
                if (isShowCall && wasHidden) {
                    this._setCircuitAnalysisLocalCopy();
                }
                this._stateMachine.renderStarted();
                try {
                    await this._buildTabulator({ isQuickRebuild: false });
                } finally {
                    this._stateMachine.renderCompleted();
                }
                break;

            case ACTION_TYPES.REBUILD_TABLE:
                // Structure changed - clear saved dimensions before rebuild
                // Column order is preserved - merge logic handles structure changes
                this._saveState();
                if (this.state) {
                    this.state.height = '';
                    this.state.width = '';
                    this.state.rowHeight = null;
                }
                this._stateMachine.renderStarted();
                try {
                    await this._buildTabulator({ isQuickRebuild: false });
                } finally {
                    this._stateMachine.renderCompleted();
                }
                break;

            case ACTION_TYPES.UPDATE_HEADERS:
                this._updateColumnHeaders();
                this._ensureTableHeight();
                this._updateHighlight();
                break;

            case ACTION_TYPES.UPDATE_DATA:
                if (this.tabulatorInstance) {
                    this.tabulatorInstance.setData(this.circuitAnalysis.table);
                    this._ensureTableHeight();
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
                // PRE-ACTION for SYNC: Reveal if hidden
                if (isShowCall && wasHidden) {
                    this._revealPanel();
                    this._restoreSavedPosition();
                }
                await this._syncTabulatorWithAnalysis();
                break;

            default:
                // Unknown action - ignore
                return;
        }

        // ========================================================================
        // POST-ACTION: Finalization
        // Make panel visible and run common finalization for applicable actions
        // ========================================================================
        if (isShowCall && wasHidden && this.panel) {
            // Make panel fully visible (was opacity 0 during rendering)
            this.panel.style.opacity = '1';
        }

        if (this._needsFinalization(action, options)) {
            // Full finalization for show() calls
            const skipHighlight = !this._isTableAction(action);
            this._finalizeAction({ isShowCall: true, skipHighlight });
        } else if (this._isTableAction(action) && !isShowCall) {
            // Event-driven table builds: setup interactions and re-highlight
            this._finalizeAction({ isShowCall: false });
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
     * Unified Tabulator builder. Handles both full renders and quick rebuilds.
     *
     * This is the SINGLE place where Tabulator instances are created. It handles:
     * - Destroying existing Tabulator and Interact.js bindings
     * - Creating new Tabulator with virtual DOM rendering
     * - Setting up tableBuilt callback with height/width fitting
     * - Registering columnMoved listener for state persistence
     *
     * ## Two-Level Lifecycle Architecture
     *
     * This method implements "Table Rebuild" - the fine-grained lifecycle level:
     * - Destroys only the Tabulator instance and Interact.js bindings
     * - Preserves panel state (position, size, column order)
     * - Called when circuit structure changes OR panel re-shown after hide
     *
     * This is distinct from destroy() which implements "Full Destroy":
     * - Destroys the entire TruthTablePanel object
     * - Unsubscribes all EventBus listeners
     * - Called by coordinator when switching/clearing boards
     *
     * @param {Object} options - Build options
     * @param {boolean} options.isQuickRebuild - True for NONE path (skip dimension logic)
     * @param {boolean} options.clearDimensionsOnStructureChange - Check and clear saved dims if structure changed
     * @returns {Promise<void>} Resolves when tableBuilt event fires
     * @private
     */
    async _buildTabulator({ isQuickRebuild = false, clearDimensionsOnStructureChange = true } = {}) {
        const content = document.getElementById('truthTableContent');
        if (!this.circuitAnalysis || !content) {
            return;
        }

        // Detect if structure changed since state was saved (e.g., inputs/outputs added while panel was closed)
        // If structure changed, clear saved dimensions so panel auto-fits to new content
        // NOTE: Column order is NOT reset - the merge logic in buildTruthTableColumns handles
        // preserving existing column positions and appending new columns at the end
        if (clearDimensionsOnStructureChange && this.state && this.state.columnOrder) {
            const currentColumnCount = this.circuitAnalysis.inputs.length + this.circuitAnalysis.outputs.length;
            const savedColumnCount = this.state.columnOrder.length;
            if (currentColumnCount !== savedColumnCount) {
                this.state.width = '';
                this.state.height = '';
                this.state.rowHeight = null;
                this.panel.style.width = '';
                this.panel.style.height = '';
                // Column order is preserved - merge logic handles structure changes
            }
        }

        // For full renders (not quick rebuild), apply saved dimensions BEFORE Tabulator builds
        if (!isQuickRebuild && this.state) {
            if (this.state.width && this.state.width !== '') {
                this.panel.style.width = this.state.width;
            }
            if (this.state.height && this.state.height !== '') {
                this.panel.style.height = this.state.height;
            }
        }

        // Generate Tabulator columns with groups
        const columns = this._generateColumns();

        // Estimate height upfront when no Tabulator exists AND no saved height
        // This prevents the rendering spinner from appearing in a too-small panel
        // Skip if we have a saved height - user's preference takes priority
        const hasValidSavedHeightForEstimate = this.state && this.state.height && this.state.height !== '';
        if (!isQuickRebuild && !this.tabulatorInstance && this.circuitAnalysis?.table?.length && !hasValidSavedHeightForEstimate) {
            const estimatedHeight = estimatePanelHeight(
                this.circuitAnalysis.table.length,
                TRUTH_TABLE
            );
            this.panel.style.height = `${estimatedHeight}px`;
            logger.debug('[TruthTablePanel] _buildTabulator - estimated height applied:', estimatedHeight);
        } else if (hasValidSavedHeightForEstimate) {
            logger.debug('[TruthTablePanel] _buildTabulator - skipping height estimate, using saved height:', this.state.height);
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

            // Show rendering spinner before destroying old table (only for full renders)
            if (!isQuickRebuild) {
                this._showRenderingSpinner();
            }
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
                const savedRowHeight = this.state?.rowHeight;

                logger.debug('[TruthTablePanel] tableBuilt - state:', {
                    hasValidSavedHeight,
                    savedRowHeight,
                    panelHeight: this.panel.offsetHeight,
                    isQuickRebuild
                });

                // Apply height - for quick rebuilds, always preserve existing row height
                if (availableHeight > 0) {
                    if (isQuickRebuild || (hasValidSavedHeight && savedRowHeight)) {
                        // Quick rebuild or restore saved row height
                        this._applyTableHeight(availableHeight, {
                            fitPanel: false,
                            targetRowHeight: savedRowHeight || this._currentRowHeight
                        });
                    } else {
                        this._applyTableHeight(availableHeight, { fitPanel: !hasValidSavedHeight });
                    }
                }

                // Fit width if no saved width (and not quick rebuild)
                if (!isQuickRebuild && !hasValidSavedWidth) {
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
     * @param {number|null} options.targetRowHeight - If provided, use this row height instead of calculating
     * @private
     */
    _applyTableHeight(availableHeight, { fitPanel = false, targetRowHeight = null } = {}) {
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

            if (targetRowHeight !== null) {
                // Use provided target row height (from saved state)
                rowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, targetRowHeight));
                logger.debug('[TruthTablePanel] _applyTableHeight - using targetRowHeight:', targetRowHeight);
            } else if (fitPanel) {
                // When fitting panel to content, use max row height for optimal display
                rowHeight = maxRowHeight;
            } else if (rowAreaHeight > 0) {
                // When constrained to available space, calculate best fit
                const calculatedHeight = Math.floor(rowAreaHeight / rowCount);
                rowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, calculatedHeight));
            }

            // Store current row height for state persistence
            this._currentRowHeight = rowHeight;

            // Calculate actual content height
            const neededHeight = rowCount * rowHeight;
            // When fitting panel, expand to needed height; otherwise constrain to available
            actualRowAreaHeight = fitPanel ? neededHeight : Math.min(rowAreaHeight, neededHeight);

            // Apply row height via CSS on the rows and cells
            this._applyRowStyles(content, rowHeight);

            logger.debug('[TruthTablePanel] _applyTableHeight - applied rowHeight:', rowHeight, 'rowCount:', rowCount);
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
     * Ensure table height is correctly applied.
     * Consolidates the panel→available height calculation used in multiple paths.
     *
     * Used by: UPDATE_HEADERS, UPDATE_DATA, SYNC (labels/data), NONE path
     *
     * NOT used by _renderTabulator() because that method requires:
     * 1. Conditional fitPanel based on hasValidSavedHeight (not a fixed value)
     * 2. Width fitting via _applyTableWidth() immediately after
     * 3. Preserved dimensions release in specific order after height/width applied
     * 4. These operations must happen in sequence within the tableBuilt callback
     *
     * @param {Object} options - Options object
     * @param {boolean} options.fitPanel - If true, resize the panel to fit content
     * @param {boolean} options.preserveRowHeight - If true (default), use saved rowHeight when available
     * @private
     */
    _ensureTableHeight({ fitPanel = false, preserveRowHeight = true } = {}) {
        if (!this.panel || !this.tabulatorInstance) return;

        const panelHeader = this.panel.querySelector('.panel-header');
        const headerHeight = panelHeader ? panelHeader.offsetHeight : 0;
        const panelStyles = getComputedStyle(this.panel);
        const paddingTop = parseFloat(panelStyles.paddingTop) || 0;
        const paddingBottom = parseFloat(panelStyles.paddingBottom) || 0;
        const panelHeight = this.panel.offsetHeight;
        const availableHeight = panelHeight - headerHeight - paddingTop - paddingBottom;

        if (availableHeight > 0) {
            const options = { fitPanel };

            // Preserve saved row height when available
            // This ensures user's row height preference persists across show/hide cycles
            // Note: Only check rowHeight, not height - auto-fit may not set explicit height
            // but rowHeight is always set when table is displayed
            if (preserveRowHeight && this.state?.rowHeight != null) {
                options.targetRowHeight = this.state.rowHeight;
            }

            this._applyTableHeight(availableHeight, options);
        }
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
     * Save panel state.
     * Works with or without tabulatorInstance to ensure position/size are saved
     * even when showing invalid/computing states.
     * @private
     */
    _saveState() {
        if (!this.panel) {
            logger.debug('[TruthTablePanel] _saveState - skipped, no panel');
            return;
        }

        // Column order only available when Tabulator exists
        // Preserve existing column order if no Tabulator (e.g., invalid state)
        const columns = this.tabulatorInstance
            ? this.tabulatorInstance.getColumns().map(col => col.getField()).filter(f => f)
            : (this.state?.columnOrder || []);

        // Read position from data-x/data-y attributes (set by both smart positioning and dragging)
        const x = parseFloat(this.panel.getAttribute('data-x')) || 0;
        const y = parseFloat(this.panel.getAttribute('data-y')) || 0;

        // Get dimensions - use style values if set, otherwise use computed offset dimensions
        // This ensures auto-fitted dimensions are captured after structure changes
        const width = this.panel.style.width || (this.panel.offsetWidth + 'px');
        const height = this.panel.style.height || (this.panel.offsetHeight + 'px');

        const stateMachineState = this._stateMachine.getState();
        logger.debug('[TruthTablePanel] _saveState - stateMachine.lastCycleIndex:', stateMachineState.lastCycleIndex);

        this.state = {
            columnOrder: columns,
            width: width,
            height: height,
            rowHeight: this._currentRowHeight || null,
            x: x,
            y: y,
            visible: this.panel.style.opacity !== '0',
            highlightedRow: stateMachineState.lastCycleIndex
        };

        logger.debug('[TruthTablePanel] _saveState - saving state:', JSON.stringify(this.state), 'rowHeight:', this._currentRowHeight);

        // Trigger callback to save to localStorage
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Save state with visible: true after panel is shown.
     * Used by all show() paths to ensure visibility is persisted.
     *
     * Note: This works even without a Tabulator instance (e.g., SHOW_COMPUTING,
     * SHOW_INVALID paths) by preserving existing state and only updating visibility.
     * @private
     */
    _saveVisibleState() {
        // Try to save full state if we have a table
        this._saveState();

        // Ensure visibility is persisted even if _saveState() didn't run
        // (no tabulatorInstance for SHOW_COMPUTING, SHOW_INVALID paths)
        if (!this.state) {
            // Create minimal state with just visibility and position
            this.state = {
                visible: true,
                x: parseFloat(this.panel?.getAttribute('data-x')) || 0,
                y: parseFloat(this.panel?.getAttribute('data-y')) || 0,
                width: this.panel?.style.width || (this.panel?.offsetWidth + 'px'),
                height: this.panel?.style.height || (this.panel?.offsetHeight + 'px'),
                columnOrder: [],
                highlightedRow: null
            };
        } else {
            this.state.visible = true;
        }

        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Finalize an action with common post-render setup.
     * Called after any action that changes panel content or visibility.
     *
     * This method centralizes the "finalization" operations that must happen
     * after any action:
     * - Setup drag/resize interactions (ALL visible states, including invalid/computing)
     * - Highlight based on current input values (recalculates, works after structure change)
     * - Persist visible state (only for show() calls)
     * - Emit TRUTH_TABLE_SHOWN event (only for show() calls)
     *
     * @param {Object} options - Configuration options
     * @param {boolean} options.isShowCall - True for show() calls (saves state, emits event)
     * @param {boolean} options.skipHighlight - Skip row highlighting
     * @private
     */
    _finalizeAction(options = {}) {
        const { isShowCall = true, skipHighlight = false } = options;

        // Interactions needed for ALL visible states (including invalid/computing)
        // This fixes Bug 4: interactions must work even when showing invalid state
        this._setupInteractions();

        // Highlight based on current input values (recalculates, works after structure change)
        // This fixes Bug 2: re-highlight row after REBUILD_TABLE based on current input values
        if (!skipHighlight && this.tabulatorInstance) {
            this._updateHighlight();
        }

        // State save and event only for show() calls
        if (isShowCall) {
            this._saveVisibleState();
            eventBus.emit(EVENT_TYPES.TRUTH_TABLE_SHOWN);
        }
    }

    // ============================================================================
    // SECTION: Action Dispatch Helpers
    // ============================================================================

    /**
     * Determine if an action requires revealing the panel.
     * @param {Object} action - Action object with `action` type
     * @returns {boolean}
     * @private
     */
    _shouldRevealPanel(action) {
        if (!action) return false;
        const revealActions = [
            ACTION_TYPES.SHOW_COMPUTING,
            ACTION_TYPES.SHOW_INVALID,
            ACTION_TYPES.RENDER_TABLE,
            ACTION_TYPES.SYNC
        ];
        return revealActions.includes(action.action);
    }

    /**
     * Determine if an action needs finalization (interactions, highlight, state save, event).
     * Only actions that change visibility or render tables need full finalization.
     * @param {Object} action - Action object with `action` type
     * @param {Object} options - Options passed to _executeAction
     * @returns {boolean}
     * @private
     */
    _needsFinalization(action, options = {}) {
        if (!action) return false;

        // Actions that never need finalization
        const neverFinalizeActions = [
            ACTION_TYPES.SHOW_PROGRESS,
            ACTION_TYPES.HIGHLIGHT_ROW,
            ACTION_TYPES.HIDE,
            // These are incremental updates on an already-visible panel
            // They have their own handling (height update, etc.) and don't need
            // full finalization which would emit events and re-save state
            ACTION_TYPES.UPDATE_HEADERS,
            ACTION_TYPES.UPDATE_DATA
        ];

        if (neverFinalizeActions.includes(action.action)) {
            return false;
        }

        // Only show() calls need full finalization (save state, emit event)
        // Event-driven actions on already-visible panels only need interactions setup
        // which is handled separately in _executeAction
        return options.isShowCall === true;
    }

    /**
     * Determine if an action renders/rebuilds a table (needs interactions setup).
     * @param {Object} action - Action object with `action` type
     * @returns {boolean}
     * @private
     */
    _isTableAction(action) {
        if (!action) return false;
        const tableActions = [
            ACTION_TYPES.RENDER_TABLE,
            ACTION_TYPES.REBUILD_TABLE,
            ACTION_TYPES.SYNC,
            ACTION_TYPES.NONE // NONE path rebuilds Tabulator
        ];
        return tableActions.includes(action.action);
    }

    /**
     * Restore saved dimensions from state.
     * Helper method to reduce duplication in show() paths.
     * @private
     */
    _restoreSavedDimensions() {
        if (!this.state || !this.panel) return;

        if (this.state.width && this.state.width !== '') {
            this.panel.style.width = this.state.width;
        }
        if (this.state.height && this.state.height !== '') {
            this.panel.style.height = this.state.height;
        }
    }

    /**
     * Restore panel state
     * @private
     */
    _restoreState(state) {
        if (!state || !this.panel) return;

        logger.debug('[TruthTablePanel] _restoreState - input state:', {
            width: state.width,
            height: state.height,
            x: state.x,
            y: state.y
        });

        // Restore size exactly as saved - trust the saved dimensions
        // since they were valid when the user set them
        if (state.width && state.width !== '') {
            const savedWidth = parseFloat(state.width);
            if (savedWidth > 0) {
                this.panel.style.width = state.width;
                logger.debug('[TruthTablePanel] _restoreState - applied width:', state.width);
            }
        }
        if (state.height && state.height !== '') {
            const savedHeight = parseFloat(state.height);
            if (savedHeight > 0) {
                this.panel.style.height = state.height;
                logger.debug('[TruthTablePanel] _restoreState - applied height:', state.height);
            }
        }

        logger.debug('[TruthTablePanel] _restoreState - after applying dimensions:', {
            styleWidth: this.panel.style.width,
            styleHeight: this.panel.style.height,
            offsetWidth: this.panel.offsetWidth,
            offsetHeight: this.panel.offsetHeight
        });

        // Restore position (prefer transform over left/top)
        if (state.x !== undefined && state.y !== undefined) {
            // Validate position to ensure panel stays within viewport
            let x = state.x;
            let y = state.y;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Get panel dimensions from ACTUAL applied styles
            const computedStyle = window.getComputedStyle(this.panel);
            const panelWidth = parseFloat(computedStyle.width) || 400; // Default 400px
            const panelHeight = parseFloat(computedStyle.height) || 300; // Default 300px

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

        // Compare with ACTUAL current components (not cached analysis which may be stale during debounce)
        // During the debounce window after BOARD_CHANGED, the cached analysis hasn't been recomputed yet,
        // but the actual circuit components have changed. We need to detect this.
        const components = this.circuitState.getComponents();
        const actualInputCount = components.filter(c => c.type === 'INPUT').length;
        const actualOutputCount = components.filter(c => c.type === 'OUTPUT').length;

        // Structure changed if Tabulator columns don't match actual circuit components
        const structureChanged =
            currentInputCount !== actualInputCount ||
            currentOutputCount !== actualOutputCount;

        if (structureChanged) {            
            // Clear saved dimensions so panel auto-fits to new column structure
            // Column order is preserved - merge logic handles structure changes
            this._saveState();
            if (this.state) {
                this.state.height = '';
                this.state.width = '';
                this.state.rowHeight = null;
            }
            this.panel.style.width = '';
            this.panel.style.height = '';

            // Use unified builder with fresh auto-fit
            await this._buildTabulator({ isQuickRebuild: false, clearDimensionsOnStructureChange: false });
            return;
        }

        // Check for label changes by comparing current headers
        const labelsChanged = this._detectLabelChanges();

        if (labelsChanged) {
            this._updateColumnHeaders();
            this._ensureTableHeight();
            this._updateHighlight();
            return;
        }

        // Data only change
        this.tabulatorInstance.setData(this.circuitAnalysis.table);
        this._ensureTableHeight();
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

        // Check input labels using ID-based field names
        for (const input of inputs) {
            const fieldName = createFieldName('input', input.id);
            const col = columns.find(c => c.getField() === fieldName);
            if (col && col.getDefinition().title !== input.label) {
                return true;
            }
        }

        // Check output labels using ID-based field names
        for (const output of outputs) {
            const fieldName = createFieldName('output', output.id);
            const col = columns.find(c => c.getField() === fieldName);
            if (col && col.getDefinition().title !== output.label) {
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
     *
     * ## Unified Dispatch Architecture (Phase 3 Refactoring)
     *
     * This method is now a thin wrapper that delegates to _executeAction().
     * All action handling, including pre-action setup and post-action finalization,
     * happens in the unified dispatcher. This prevents code path fragmentation
     * and ensures consistent behavior across all show scenarios.
     *
     * The only show()-specific logic is smart positioning on first open,
     * which must happen after _executeAction() makes the panel visible.
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

        // Track if panel was hidden before (for positioning and pre-action setup)
        const wasHidden = !this._isVisible();

        // Get action from state machine
        const action = this._stateMachine.handleShow();

        // Delegate to unified dispatcher
        await this._executeAction(action, { isShowCall: true, wasHidden });

        // Smart positioning only on first open (after panel is visible)
        // This must happen after _executeAction() so panel has dimensions
        if (wasHidden) {
            this._positionPanelIfNeeded(false);
        }
    }

    /**
     * Restore saved position from state.
     * Helper method to reduce duplication in show() paths.
     * @private
     */
    _restoreSavedPosition() {
        if (this.state && this.state.x !== undefined && this.state.y !== undefined) {
            this.panel.style.left = '0';
            this.panel.style.top = '0';
            this.panel.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
            this.panel.setAttribute('data-x', this.state.x);
            this.panel.setAttribute('data-y', this.state.y);
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
     * @private
     */
    _setState(state) {
        logger.debug('[TruthTablePanel] _setState - received state:', JSON.stringify(state));
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
            logger.debug('[TruthTablePanel] _setState - restoring highlightedRow:', sanitizedState.highlightedRow);
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
