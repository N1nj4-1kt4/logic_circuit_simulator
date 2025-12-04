/**
 * BoardManager - Manages saved circuit boards
 * Handles saving, loading, listing, and deleting circuit boards
 */
import { STORAGE_KEYS } from '../constants.js';

export class BoardManager {
    /**
     * @param {StorageAdapter} storageAdapter - Storage implementation
     */
    constructor(storageAdapter) {
        this.storage = storageAdapter;
        this.storageKey = STORAGE_KEYS.SAVED_BOARDS;
    }

    /**
     * Get all saved boards
     * @returns {Promise<Object>} Object mapping board names to board data
     */
    async getAllBoards() {
        const boards = await this.storage.getItem(this.storageKey);
        return boards || {};
    }

    /**
     * Save a board
     * @param {string} name - Board name
     * @param {Object} boardData - Board data (components, connections, etc.)
     * @returns {Promise<boolean>} True if successful
     */
    async saveBoard(name, boardData) {
        if (!name || typeof name !== 'string') {
            console.error('Invalid board name');
            return false;
        }

        try {
            const boards = await this.getAllBoards();

            // Add metadata
            boards[name] = {
                ...boardData,
                name,
                savedAt: new Date().toISOString(),
                version: '1.0'
            };

            const success = await this.storage.setItem(this.storageKey, boards);

            return success;
        } catch (error) {
            return false;
        }
    }

    /**
     * Load a board
     * @param {string} name - Board name
     * @returns {Promise<Object|null>} Board data or null if not found
     */
    async loadBoard(name) {
        try {
            const boards = await this.getAllBoards();
            const board = boards[name];

            if (!board) {
                console.warn(`Board "${name}" not found`);
                return null;
            }

            return board;
        } catch (error) {
            console.error(`Failed to load board "${name}":`, error);
            return null;
        }
    }

    /**
     * List all board names with metadata
     * @returns {Promise<Array>} Array of board info objects
     */
    async listBoards() {
        try {
            const boards = await this.getAllBoards();

            return Object.keys(boards).map(name => ({
                name,
                savedAt: boards[name].savedAt,
                componentCount: boards[name].components?.length || 0,
                connectionCount: boards[name].connections?.length || 0
            })).sort((a, b) => {
                // Sort by savedAt descending (most recent first)
                return new Date(b.savedAt) - new Date(a.savedAt);
            });
        } catch (error) {
            console.error('Failed to list boards:', error);
            return [];
        }
    }

    /**
     * Delete a board
     * @param {string} name - Board name
     * @returns {Promise<boolean>} True if successful
     */
    async deleteBoard(name) {
        try {
            const boards = await this.getAllBoards();

            if (!boards[name]) {
                console.warn(`Board "${name}" not found`);
                return false;
            }

            delete boards[name];

            const success = await this.storage.setItem(this.storageKey, boards);

            return success;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a board exists
     * @param {string} name - Board name
     * @returns {Promise<boolean>} True if board exists
     */
    async boardExists(name) {
        const boards = await this.getAllBoards();
        return !!boards[name];
    }

    /**
     * Rename a board
     * @param {string} oldName - Current board name
     * @param {string} newName - New board name
     * @returns {Promise<boolean>} True if successful
     */
    async renameBoard(oldName, newName) {
        if (oldName === newName) {
            return true;
        }

        try {
            const boards = await this.getAllBoards();

            if (!boards[oldName]) {
                console.warn(`Board "${oldName}" not found`);
                return false;
            }

            if (boards[newName]) {
                console.error(`Board "${newName}" already exists`);
                return false;
            }

            // Copy board with new name
            boards[newName] = {
                ...boards[oldName],
                name: newName,
                savedAt: new Date().toISOString()
            };

            // Delete old board
            delete boards[oldName];

            const success = await this.storage.setItem(this.storageKey, boards);

            return success;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all boards
     * @returns {Promise<boolean>} True if successful
     */
    async clearAllBoards() {
        try {
            const success = await this.storage.setItem(this.storageKey, {});

            return success;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get next available board name (Board01, Board02, etc.)
     * @param {Array} existingNames - Array of existing board/component names to avoid
     * @returns {Promise<string>} Next available board name
     */
    async getNextBoardName(existingNames = []) {
        const boards = await this.getAllBoards();
        const allNames = [...Object.keys(boards), ...existingNames];

        let counter = 1;
        let name;

        do {
            name = `Board${String(counter).padStart(2, '0')}`;
            counter++;
        } while (allNames.includes(name));

        return name;
    }
}
