/**
 * BoardOperations - Board Management Module
 *
 * Handles board CRUD operations (save, load, create new, delete).
 * Uses ContextManager for context switching and state preservation.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { deepClone } from '../utils/serialization.js';
import {
    BoardNameRequiredError,
    BoardSaveError,
    BoardLoadError
} from './errors.js';

export class BoardOperations {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {BoardManager} config.boardManager - Board management instance
     * @param {ContextManager} config.contextManager - Context manager instance
     */
    constructor(config) {
        this.state = config.state;
        this.boardManager = config.boardManager;
        this.contextManager = config.contextManager;
    }

    /**
     * Save current board to storage
     * @param {string} boardName - Name of the board
     * @returns {Promise<string>} Board name on success for notification
     */
    async saveCurrentBoard(boardName) {
        if (!boardName || boardName.trim() === '') {
            throw new BoardNameRequiredError();
        }

        const boardData = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId() - 1,
            customComponents: this.state.getCustomComponents(),
            truthTableState: this.state.getTruthTableState()
        };

        const success = await this.boardManager.saveBoard(boardName, boardData);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.getAllBoards();
            this.state.setSavedBoards(boards);

            // Update current board name
            this.state.setCurrentBoardName(boardName);
            this.state.setCurrentComponentName(null);

            // Update last saved state for change detection
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return boardName; // Return board name for success message
        } else {
            throw new BoardSaveError('Failed to save board to storage');
        }
    }

    /**
     * Load a board from storage
     * @param {string} boardName - Name of the board to load
     * @returns {Promise<string>} Board name on success for notification
     */
    async loadBoard(boardName) {
        // Save current context's state before switching (including truth table changes)
        await this.contextManager.saveCurrentContext();

        const boardData = await this.boardManager.loadBoard(boardName);

        if (boardData) {
            // Load circuit context using context manager
            this.contextManager.loadCircuitContext(boardData, { type: 'board', name: boardName });

            return boardName; // Return board name for success message
        } else {
            throw new BoardLoadError(boardName);
        }
    }

    /**
     * Create a new empty board
     * @param {Function} showSaveOptionsDialog - Callback to show save options dialog (still needed for dialog flow)
     * @param {Function} onCreated - Optional callback called when new board is created
     */
    createNewBoard(showSaveOptionsDialog, onCreated) {
        // Check for unsaved changes
        if (this.state.hasUnsavedChanges()) {
            showSaveOptionsDialog(() => {
                this._createNewBoardInternal();
                if (onCreated) onCreated();
            });
        } else {
            this._createNewBoardInternal();
            if (onCreated) onCreated();
        }
    }

    /**
     * Internal method to create a new board
     * @private
     */
    _createNewBoardInternal() {
        // Clear the board
        this.state.clearComponents();
        this.state.setCurrentBoardName(null);
        this.state.setCurrentComponentName(null);

        // New board has no saved state (never saved)
        this.state.setLastSavedState(null);

        // Emit events
        eventBus.emit(EVENT_TYPES.BOARD_CLEARED);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
    }

    /**
     * Revert current board to last saved state
     * Restores from lastSavedState and stays on the same board
     * @returns {boolean} True if revert was successful, false if no saved state exists
     */
    revertToSaved() {
        const lastSavedState = this.state.getLastSavedState();

        if (!lastSavedState) {
            // No saved state to revert to (board was never saved)
            return false;
        }

        // Restore working state from lastSavedState
        this.state.loadState({
            components: lastSavedState.components || [],
            connections: lastSavedState.connections || [],
            nextId: lastSavedState.nextId || 1,
            truthTableState: lastSavedState.truthTableState || null
        });

        // Restore truth table state if present
        if (lastSavedState.truthTableState) {
            this.state.setTruthTableState(lastSavedState.truthTableState);
        }

        // Emit events to update UI
        eventBus.emit(EVENT_TYPES.BOARD_LOADED);
        eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

        return true;
    }

    /**
     * Delete a board from storage
     * Note: Caller should confirm with user before calling this method
     * @param {string} boardName - Name of the board to delete
     * @returns {Promise<string>} Board name on success for notification
     */
    async deleteBoard(boardName) {
        const success = await this.boardManager.deleteBoard(boardName);

        if (success) {
            // Update saved boards list
            const boards = await this.boardManager.getAllBoards();
            this.state.setSavedBoards(boards);

            // If we deleted the current board, clear it
            if (this.state.getCurrentBoardName() === boardName) {
                this.state.clearComponents();
                this.state.setCurrentBoardName(null);
                this.state.setCurrentComponentName(null);
                eventBus.emit(EVENT_TYPES.CANVAS_REDRAW);
            }

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return boardName; // Return name for success message
        } else {
            throw new BoardSaveError(`Failed to delete board "${boardName}"`);
        }
    }
}
