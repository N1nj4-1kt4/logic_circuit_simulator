/**
 * UndoRedoManager - Undo/Redo Functionality Module
 *
 * Captures state snapshots on circuit changes and provides undo/redo capability.
 * Uses event-driven approach, listens to state change events.
 * Supports per-board history persistence and drag coalescing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { captureCircuitSnapshot, restoreCircuitSnapshot } from '../utils/stateSnapshot.js';
import { UNDO_REDO } from '../constants.js';

export class UndoRedoManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {StorageAdapter} config.storage - Storage adapter for persistence
     * @param {number} config.maxHistorySize - Maximum undo stack size (default: 20)
     */
    constructor(config) {
        this.state = config.state;
        this.storage = config.storage;
        this.maxHistorySize = config.maxHistorySize || UNDO_REDO.MAX_HISTORY_SIZE;

        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];

        // Last known state - captured BEFORE each action
        // When an action occurs, we push this to undoStack, then update it to current state
        this.lastKnownState = null;

        // Coalescing state for drag operations
        this.isCoalescing = false;
        this.preCoalesceSnapshot = null;

        // Bound event handlers for cleanup
        this.boundHandlers = {};

        // Flag to prevent capturing during undo/redo restore
        this.isRestoring = false;
    }

    /**
     * Setup event listeners for state changes
     */
    setupListeners() {
        // Create bound handlers
        this.boundHandlers.componentAdded = () => this._onStateChange('component:added');
        this.boundHandlers.componentRemoved = () => this._onStateChange('component:removed');
        this.boundHandlers.componentMoved = () => this._onComponentMoved();
        this.boundHandlers.componentLabelChanged = () => this._onStateChange('component:labelChanged');
        this.boundHandlers.connectionAdded = () => this._onStateChange('connection:added');
        this.boundHandlers.connectionRemoved = () => this._onStateChange('connection:removed');
        this.boundHandlers.boardWillClear = () => this._onBoardWillClear();
        this.boundHandlers.dragStarted = (data) => this._onDragStarted(data);
        this.boundHandlers.dragEnded = (data) => this._onDragEnded(data);

        // Subscribe to state change events
        eventBus.on(EVENT_TYPES.COMPONENT_ADDED, this.boundHandlers.componentAdded);
        eventBus.on(EVENT_TYPES.COMPONENT_REMOVED, this.boundHandlers.componentRemoved);
        eventBus.on(EVENT_TYPES.COMPONENT_MOVED, this.boundHandlers.componentMoved);
        eventBus.on(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this.boundHandlers.componentLabelChanged);
        eventBus.on(EVENT_TYPES.CONNECTION_ADDED, this.boundHandlers.connectionAdded);
        eventBus.on(EVENT_TYPES.CONNECTION_REMOVED, this.boundHandlers.connectionRemoved);
        eventBus.on(EVENT_TYPES.BOARD_WILL_CLEAR, this.boundHandlers.boardWillClear);
        eventBus.on(EVENT_TYPES.DRAG_STARTED, this.boundHandlers.dragStarted);
        eventBus.on(EVENT_TYPES.DRAG_ENDED, this.boundHandlers.dragEnded);
    }

    /**
     * Remove all event listeners
     */
    teardownListeners() {
        eventBus.off(EVENT_TYPES.COMPONENT_ADDED, this.boundHandlers.componentAdded);
        eventBus.off(EVENT_TYPES.COMPONENT_REMOVED, this.boundHandlers.componentRemoved);
        eventBus.off(EVENT_TYPES.COMPONENT_MOVED, this.boundHandlers.componentMoved);
        eventBus.off(EVENT_TYPES.COMPONENT_LABEL_CHANGED, this.boundHandlers.componentLabelChanged);
        eventBus.off(EVENT_TYPES.CONNECTION_ADDED, this.boundHandlers.connectionAdded);
        eventBus.off(EVENT_TYPES.CONNECTION_REMOVED, this.boundHandlers.connectionRemoved);
        eventBus.off(EVENT_TYPES.BOARD_WILL_CLEAR, this.boundHandlers.boardWillClear);
        eventBus.off(EVENT_TYPES.DRAG_STARTED, this.boundHandlers.dragStarted);
        eventBus.off(EVENT_TYPES.DRAG_ENDED, this.boundHandlers.dragEnded);
    }

    // ====================================
    // Core Undo/Redo Operations
    // ====================================

    /**
     * Undo the last action
     * @returns {boolean} True if undo was performed
     */
    undo() {
        if (!this.canUndo()) {
            return false;
        }

        // Capture current state before restoring (for redo)
        const currentSnapshot = captureCircuitSnapshot(this.state);

        // Pop the entry that represents the state we want to undo TO
        // (the snapshot captured BEFORE the action we're undoing)
        const previousEntry = this.undoStack.pop();

        // Push current state to redo stack so we can redo later
        this.redoStack.push({
            action: 'undo',
            timestamp: Date.now(),
            state: currentSnapshot
        });

        // Restore the previous state
        this.isRestoring = true;
        restoreCircuitSnapshot(this.state, previousEntry.state);
        this.isRestoring = false;

        // Update lastKnownState to the restored state
        this.lastKnownState = captureCircuitSnapshot(this.state);

        // Emit state changed event
        this._emitStateChanged();

        return true;
    }

    /**
     * Redo the last undone action
     * @returns {boolean} True if redo was performed
     */
    redo() {
        if (!this.canRedo()) {
            return false;
        }

        // Get the state to restore (next state)
        const nextEntry = this.redoStack.pop();

        // Capture current state before restoring (for undo)
        const currentSnapshot = captureCircuitSnapshot(this.state);
        this.undoStack.push({
            action: 'redo',
            timestamp: Date.now(),
            state: currentSnapshot
        });

        // Restore the next state
        this.isRestoring = true;
        restoreCircuitSnapshot(this.state, nextEntry.state);
        this.isRestoring = false;

        // Update lastKnownState to the restored state
        this.lastKnownState = captureCircuitSnapshot(this.state);

        // Emit state changed event
        this._emitStateChanged();

        return true;
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get undo stack size
     * @returns {number}
     */
    getUndoStackSize() {
        return this.undoStack.length;
    }

    /**
     * Get redo stack size
     * @returns {number}
     */
    getRedoStackSize() {
        return this.redoStack.length;
    }

    // ====================================
    // History Management
    // ====================================

    /**
     * Clear all undo/redo history
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.lastKnownState = null;
        this.isCoalescing = false;
        this.preCoalesceSnapshot = null;
        this._emitStateChanged();
    }

    /**
     * Capture state change - called AFTER an action modifies the state.
     * Uses lastKnownState (captured before the action) for undo.
     * @param {string} actionType - Type of action that triggered the capture
     */
    captureSnapshot(actionType) {
        if (this.isRestoring) {
            return; // Don't capture during undo/redo restore
        }

        // If we have a previous state, push it to undo stack
        // This represents the state BEFORE the action that just happened
        if (this.lastKnownState !== null) {
            this.undoStack.push({
                action: actionType,
                timestamp: Date.now(),
                state: this.lastKnownState
            });

            // Clear redo stack on new action
            this.redoStack = [];

            // Enforce max history size (FIFO)
            while (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift(); // Remove oldest
            }

            this._emitStateChanged();
        }

        // Update lastKnownState to current state (after the action)
        this.lastKnownState = captureCircuitSnapshot(this.state);
        console.log('[DEBUG] [UndoRedoManager] captureSnapshot:', actionType,
            'undoStackSize:', this.undoStack.length,
            'lastKnownState components:', this.lastKnownState?.components?.length || 0);
    }

    /**
     * Initialize lastKnownState - call this after loading state
     */
    initializeLastKnownState() {
        this.lastKnownState = captureCircuitSnapshot(this.state);
        console.log('[DEBUG] [UndoRedoManager] initializeLastKnownState:',
            'components:', this.lastKnownState?.components?.length || 0);
    }

    // ====================================
    // Coalescing for Drag Operations
    // ====================================

    /**
     * Start coalescing mode - captures pre-drag state
     */
    startCoalescing() {
        if (this.isCoalescing) {
            return; // Already coalescing
        }
        this.isCoalescing = true;
        this.preCoalesceSnapshot = captureCircuitSnapshot(this.state);
    }

    /**
     * End coalescing mode - pushes single action for entire drag
     */
    endCoalescing() {
        if (!this.isCoalescing) {
            return; // Not coalescing
        }

        // Only push if state actually changed during drag
        const currentSnapshot = captureCircuitSnapshot(this.state);
        const stateChanged = JSON.stringify(this.preCoalesceSnapshot) !== JSON.stringify(currentSnapshot);

        if (stateChanged && this.preCoalesceSnapshot) {
            // Push pre-drag state to undo stack
            this.undoStack.push({
                action: 'component:moved',
                timestamp: Date.now(),
                state: this.preCoalesceSnapshot
            });

            // Clear redo stack on new action
            this.redoStack = [];

            // Enforce max history size
            while (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift();
            }

            this._emitStateChanged();
        }

        this.isCoalescing = false;
        this.preCoalesceSnapshot = null;
    }

    // ====================================
    // Persistence
    // ====================================

    /**
     * Save current history to localStorage
     * @param {string} boardName - Board name (null for unnamed board)
     */
    async saveHistory(boardName = null) {
        const storageKey = this._getStorageKey(boardName);

        const historyData = {
            version: 1,
            undoStack: this.undoStack,
            redoStack: this.redoStack
        };

        try {
            await this.storage.setItem(storageKey, JSON.stringify(historyData));
        } catch (error) {
            // Silently handle storage errors
        }
    }

    /**
     * Load history from localStorage
     * @param {string} boardName - Board name (null for unnamed board)
     */
    async loadHistory(boardName = null) {
        const storageKey = this._getStorageKey(boardName);

        try {
            const savedHistory = await this.storage.getItem(storageKey);

            if (savedHistory) {
                const historyData = JSON.parse(savedHistory);

                // Handle version migration if needed
                if (historyData.version === 1) {
                    this.undoStack = historyData.undoStack || [];
                    this.redoStack = historyData.redoStack || [];
                } else {
                    // Unknown version, start fresh
                    this.clearHistory();
                }
            } else {
                // No saved history, start fresh
                this.undoStack = [];
                this.redoStack = [];
            }

            this._emitStateChanged();
        } catch (error) {
            // On error, start fresh
            this.undoStack = [];
            this.redoStack = [];
            this._emitStateChanged();
        }
    }

    /**
     * Delete history for a specific board from storage
     * @param {string} boardName - Board name
     */
    async deleteHistory(boardName) {
        const storageKey = this._getStorageKey(boardName);
        try {
            await this.storage.removeItem(storageKey);
        } catch (error) {
            // Silently handle errors
        }
    }

    // ====================================
    // Board Switching
    // ====================================

    /**
     * Handle board switch - save current history and load new board's history
     * @param {string} oldBoardName - Previous board name (null for unnamed)
     * @param {string} newBoardName - New board name (null for unnamed)
     * @param {boolean} isFirstSave - True if this is unnamed→named (first save)
     */
    async onBoardSwitch(oldBoardName, newBoardName, isFirstSave = false) {
        if (isFirstSave) {
            // Unnamed → Named: Migrate history to new key
            await this.saveHistory(newBoardName);
            // Delete old unnamed history
            await this.deleteHistory(null);
        } else if (oldBoardName !== newBoardName) {
            // Different board: Save current, load new
            await this.saveHistory(oldBoardName);
            await this.loadHistory(newBoardName);
        }
        // Same board (update): No action needed, history preserved
    }

    /**
     * Handle "Save As" - current board saved with a different name
     * The new board starts with empty history
     * @param {string} originalBoardName - Original board name
     * @param {string} newBoardName - New board name
     */
    async onSaveAs(originalBoardName, newBoardName) {
        // Save current history for original board (if it has a name)
        if (originalBoardName) {
            await this.saveHistory(originalBoardName);
        }

        // Clear history for the new board context
        this.clearHistory();

        // Save empty history for new board
        await this.saveHistory(newBoardName);
    }

    // ====================================
    // Private Methods
    // ====================================

    /**
     * Get storage key for a board's undo-redo history
     * @param {string} boardName - Board name (null for unnamed)
     * @returns {string} Storage key
     */
    _getStorageKey(boardName) {
        const prefix = UNDO_REDO.STORAGE_KEY_PREFIX;
        if (boardName) {
            return `${prefix}board_${boardName}`;
        }
        return `${prefix}board__unnamed_`;
    }

    /**
     * Handle state change events (non-move)
     * @param {string} actionType - Type of action
     */
    _onStateChange(actionType) {
        if (this.isRestoring || this.isCoalescing) {
            return;
        }
        this.captureSnapshot(actionType);
    }

    /**
     * Handle component moved events
     * During coalescing, moves are ignored (handled by endCoalescing)
     */
    _onComponentMoved() {
        // Moves during coalescing are ignored
        // Final state captured when coalescing ends
        if (!this.isCoalescing && !this.isRestoring) {
            // Standalone move (not from drag) - shouldn't normally happen
            // but handle it just in case
            this.captureSnapshot('component:moved');
        }
    }

    /**
     * Handle board will clear event (fires BEFORE state is cleared)
     * Capture state before clearing for undo capability
     */
    _onBoardWillClear() {
        // Don't capture if we're restoring (from undo/redo)
        if (this.isRestoring) {
            return;
        }

        // Only capture if there's something to capture (non-empty board)
        if (this.state.getComponents().length > 0 || this.state.getConnections().length > 0) {
            this.captureSnapshot('board:cleared');
        }
    }

    /**
     * Handle drag started event
     * @param {Object} data - Event data with component info
     */
    _onDragStarted(data) {
        this.startCoalescing();
    }

    /**
     * Handle drag ended event
     * @param {Object} data - Event data with component info
     */
    _onDragEnded(data) {
        this.endCoalescing();
    }

    /**
     * Emit undo/redo state changed event
     */
    _emitStateChanged() {
        const canUndo = this.canUndo();
        const canRedo = this.canRedo();
        console.log('[DEBUG] [UndoRedoManager] _emitStateChanged:', {
            canUndo,
            canRedo,
            undoStackSize: this.undoStack.length,
            redoStackSize: this.redoStack.length
        });
        eventBus.emit(EVENT_TYPES.UNDO_REDO_STATE_CHANGED, {
            canUndo,
            canRedo
        });
    }
}
