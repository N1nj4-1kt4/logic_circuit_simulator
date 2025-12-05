/**
 * AutoSaveManager - Auto-Save Functionality Module
 *
 * Handles automatic saving of circuit state with event-driven approach.
 * Listens to board state change events and auto-saves with debouncing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { deepClone } from '../utils/serialization.js';

export class AutoSaveManager {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {StorageAdapter} config.storage - Storage adapter for persistence
     */
    constructor(config) {
        this.state = config.state;
        this.storage = config.storage;

        // Auto-save debounce timer reference
        this.autoSaveTimer = null;
        this.autoSaveDelay = 1000; // 1 second debounce delay

        // Bound handlers for cleanup
        this.debouncedSave = null;
        this.handleBoardCleared = null;
    }

    /**
     * Setup auto-save functionality using event-driven approach
     * Listens to all board state change events and auto-saves with debouncing
     */
    setupAutoSave() {
        // Create debounced save handler
        this.debouncedSave = () => {
            // Clear existing timer
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }

            // Set new timer
            this.autoSaveTimer = setTimeout(async () => {
                await this.saveBoardState();
            }, this.autoSaveDelay);
        };

        // Listen to all events that modify board state
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);

        // When board is cleared, clear the auto-saved state immediately (no debounce)
        this.handleBoardCleared = async () => {
            await this.clearBoardState();
        };
        eventBus.on(EVENT_TYPES.BOARD_CLEARED, this.handleBoardCleared);
    }

    /**
     * Clear auto-save timer and event listeners
     */
    clearAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        // Remove event listeners
        if (this.debouncedSave) {
            eventBus.off(EVENT_TYPES.BOARD_CHANGED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.BOARD_LOADED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);
        }

        if (this.handleBoardCleared) {
            eventBus.off(EVENT_TYPES.BOARD_CLEARED, this.handleBoardCleared);
        }
    }

    /**
     * Save current board state to localStorage (auto-save)
     */
    async saveBoardState() {
        const boardData = {
            components: this.state.getComponents(),
            connections: this.state.getConnections(),
            nextId: this.state.generateNextId() - 1,
            currentBoardName: this.state.getCurrentBoardName(),
            currentComponentName: this.state.getCurrentComponentName(),
            customComponents: this.state.getCustomComponents(),
            truthTableState: this.state.getTruthTableState()
        };

        try {
            await this.storage.setItem('currentBoard', JSON.stringify(boardData));
        } catch (error) {
            // Silently handle auto-save errors
        }
    }

    /**
     * Load board state from localStorage (on app start)
     * @param {TruthTableManager} truthTableManager - Optional truth table manager for recomputation
     */
    async loadBoardState(truthTableManager = null) {
        try {
            const savedState = await this.storage.getItem('currentBoard');

            if (savedState) {
                const boardData = JSON.parse(savedState);

                // Load state
                this.state.loadState({
                    components: boardData.components || [],
                    connections: boardData.connections || [],
                    nextId: (boardData.nextId || 0) + 1,
                    customComponents: boardData.customComponents || {}
                });

                // Restore current board/component names
                this.state.setCurrentBoardName(boardData.currentBoardName || null);
                this.state.setCurrentComponentName(boardData.currentComponentName || null);

                // Restore truth table state
                if (boardData.truthTableState) {
                    this.state.setTruthTableState(boardData.truthTableState);
                }

                // Compute truth table cache for the restored circuit
                if (truthTableManager) {
                    truthTableManager.recomputeTruthTable();
                }

                // Update last saved state
                this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

                // Emit event to update toolbar displays
                eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
            }
        } catch (error) {
            // Silently handle load errors - start with empty state
        }
    }

    /**
     * Clear auto-saved board state
     */
    async clearBoardState() {
        try {
            await this.storage.removeItem('currentBoard');
        } catch (error) {
            // Silently handle clear errors
        }
    }
}
