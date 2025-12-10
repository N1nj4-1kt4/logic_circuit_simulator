/**
 * AutoSaveManager - Auto-Save Functionality Module
 *
 * Handles automatic saving of circuit state with event-driven approach.
 * Listens to board state change events and auto-saves with debouncing.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { captureCircuitSnapshot } from '../utils/stateSnapshot.js';
import { logger } from '../utils/logger.js';

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
        this.debouncedSave = (eventName) => {
            logger.debug('[AutoSaveManager] debouncedSave triggered by event:', eventName);
            // Clear existing timer
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }

            // Set new timer
            this.autoSaveTimer = setTimeout(async () => {
                logger.debug('[AutoSaveManager] debouncedSave timer fired, calling saveBoardState');
                await this.saveBoardState();
            }, this.autoSaveDelay);
        };

        // Listen to all events that modify board state
        eventBus.on(EVENT_TYPES.BOARD_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.BOARD_LOADED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.TRUTH_TABLE_PANEL_STATE_CHANGED, this.debouncedSave);
        eventBus.on(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);

        // Listen to simulation step completion to persist input values
        // During auto-cycling, save immediately (no debounce) because:
        // - Auto-cycle interval (750ms) < debounce delay (1000ms)
        // - Without immediate save, debounce resets on each step, causing stale state on refresh
        this.handleSimulationStep = () => {
            if (this.state.isAutoCyclingActive()) {
                // Save immediately during auto-cycling
                this.saveBoardState();
            } else {
                // Use debounce for manual stepping
                this.debouncedSave('SIMULATION_STEP_COMPLETED');
            }
        };
        eventBus.on(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this.handleSimulationStep);

        // When board is cleared, save immediately (no debounce) to persist the cleared state
        // This preserves lastSavedState so user can still revert to the saved version
        this.handleBoardCleared = async () => {
            await this.saveBoardState();
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
            eventBus.off(EVENT_TYPES.TRUTH_TABLE_PANEL_STATE_CHANGED, this.debouncedSave);
            eventBus.off(EVENT_TYPES.THEME_CHANGED, this.debouncedSave);
        }

        if (this.handleSimulationStep) {
            eventBus.off(EVENT_TYPES.SIMULATION_STEP_COMPLETED, this.handleSimulationStep);
        }

        if (this.handleBoardCleared) {
            eventBus.off(EVENT_TYPES.BOARD_CLEARED, this.handleBoardCleared);
        }
    }

    /**
     * Save current board state to localStorage (auto-save)
     * Persists both working state and lastSavedState for revert functionality
     */
    async saveBoardState() {
        // Capture circuit state using shared utility (includes truthTablePanelState for auto-save)
        const circuitSnapshot = captureCircuitSnapshot(this.state, { includeTruthTablePanelState: true });

        const boardData = {
            // Circuit state from shared snapshot
            ...circuitSnapshot,
            // Context-specific state
            currentBoardName: this.state.getCurrentBoardName(),
            currentComponentName: this.state.getCurrentComponentName(),
            customComponents: this.state.getCustomComponents(),
            // Base state for revert (persisted from CircuitState)
            lastSavedState: this.state.getLastSavedState(),
            // Auto-cycling state (to resume on page refresh)
            isAutoCycling: this.state.isAutoCyclingActive()
        };

        // DEBUG: Log input component values being saved
        const inputs = boardData.components.filter(c => c.type === 'INPUT');
        logger.debug('[AutoSaveManager] saveBoardState - INPUT values:', JSON.stringify(inputs.map(i => ({ id: i.id, label: i.label, value: i.value }))));

        try {
            await this.storage.setItem('currentBoard', JSON.stringify(boardData));
        } catch (error) {
            // Silently handle auto-save errors
        }
    }

    /**
     * Load board state from localStorage (on app start)
     * Handles migration from old format (no lastSavedState) to new format
     * @param {CircuitAnalysisManager} circuitAnalysisManager - Optional analysis manager for recomputation
     */
    async loadBoardState(circuitAnalysisManager = null) {
        try {
            const savedState = await this.storage.getItem('currentBoard');

            if (savedState) {
                const boardData = JSON.parse(savedState);

                // DEBUG: Log input component values being loaded
                const inputs = (boardData.components || []).filter(c => c.type === 'INPUT');
                logger.debug('[AutoSaveManager] loadBoardState - INPUT values from storage:', JSON.stringify(inputs.map(i => ({ id: i.id, label: i.label, value: i.value }))));

                // Load working state
                this.state.loadState({
                    components: boardData.components || [],
                    connections: boardData.connections || [],
                    nextId: (boardData.nextId || 0) + 1,
                    customComponents: boardData.customComponents || {}
                });

                // DEBUG: Log input values after loadState
                const loadedInputs = this.state.getComponents().filter(c => c.type === 'INPUT');
                logger.debug('[AutoSaveManager] loadBoardState - INPUT values after loadState:', JSON.stringify(loadedInputs.map(i => ({ id: i.id, label: i.label, value: i.value }))));

                // Restore current board/component names
                this.state.setCurrentBoardName(boardData.currentBoardName || null);
                this.state.setCurrentComponentName(boardData.currentComponentName || null);

                // Restore truth table panel state
                if (boardData.truthTablePanelState) {
                    this.state.setTruthTablePanelState(boardData.truthTablePanelState);
                }

                // Compute circuit analysis for the restored circuit
                if (circuitAnalysisManager) {
                    circuitAnalysisManager.recomputeAnalysis();
                }

                // Restore lastSavedState if present, otherwise null (migration case)
                // Migration: old format has no lastSavedState, treat as never saved
                if (boardData.lastSavedState !== undefined) {
                    this.state.setLastSavedState(boardData.lastSavedState);
                } else {
                    // Migration: no lastSavedState in old format
                    this.state.setLastSavedState(null);
                }

                // Restore auto-cycling state (coordinator will resume cycling after init)
                if (boardData.isAutoCycling) {
                    this.state.setPendingAutoCycle(true);
                }

                // Emit event to update toolbar displays
                eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);
            }
        } catch (error) {
            // Silently handle load errors - start with empty state
        }
    }

    /**
     * Clear auto-saved board state completely from storage
     * Note: This removes ALL state including lastSavedState.
     * For normal "Clear Board" operation, use saveBoardState() instead
     * to preserve lastSavedState for revert functionality.
     */
    async clearBoardState() {
        try {
            await this.storage.removeItem('currentBoard');
        } catch (error) {
            // Silently handle clear errors
        }
    }
}
