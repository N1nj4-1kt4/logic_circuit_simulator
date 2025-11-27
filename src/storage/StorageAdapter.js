/**
 * Abstract StorageAdapter class
 * Defines the interface for all storage implementations
 *
 * This allows easy swapping between localStorage, IndexedDB, remote API, etc.
 */
export class StorageAdapter {
    /**
     * Get item from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Parsed data or null
     */
    async getItem(key) {
        throw new Error('getItem() must be implemented by subclass');
    }

    /**
     * Set item in storage
     * @param {string} key - Storage key
     * @param {any} value - Data to store (will be JSON stringified)
     * @returns {Promise<boolean>} True if successful
     */
    async setItem(key, value) {
        throw new Error('setItem() must be implemented by subclass');
    }

    /**
     * Remove item from storage
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} True if successful
     */
    async removeItem(key) {
        throw new Error('removeItem() must be implemented by subclass');
    }

    /**
     * Clear all items from storage
     * @returns {Promise<boolean>} True if successful
     */
    async clear() {
        throw new Error('clear() must be implemented by subclass');
    }

    /**
     * Get all keys in storage
     * @returns {Promise<string[]>} Array of keys
     */
    async getAllKeys() {
        throw new Error('getAllKeys() must be implemented by subclass');
    }

    /**
     * Check if storage is available
     * @returns {Promise<boolean>} True if storage is available
     */
    async isAvailable() {
        throw new Error('isAvailable() must be implemented by subclass');
    }
}
