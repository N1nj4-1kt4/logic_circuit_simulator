/**
 * LocalStorageAdapter - Browser localStorage implementation
 * Implements StorageAdapter interface using browser's localStorage API
 */
import { StorageAdapter } from './StorageAdapter.js';

export class LocalStorageAdapter extends StorageAdapter {
    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Parsed data or null
     */
    async getItem(key) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) {
                return null;
            }
            return JSON.parse(value);
        } catch (error) {
            console.error(`Failed to get item "${key}" from localStorage:`, error);
            return null;
        }
    }

    /**
     * Set item in localStorage
     * @param {string} key - Storage key
     * @param {any} value - Data to store
     * @returns {Promise<boolean>} True if successful
     */
    async setItem(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error(`Failed to set item "${key}" in localStorage:`, error);
            // Check if it's a quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded!');
            }
            return false;
        }
    }

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} True if successful
     */
    async removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove item "${key}" from localStorage:`, error);
            return false;
        }
    }

    /**
     * Clear all items from localStorage
     * WARNING: This clears ALL localStorage, not just app data
     * @returns {Promise<boolean>} True if successful
     */
    async clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return false;
        }
    }

    /**
     * Get all keys in localStorage
     * @returns {Promise<string[]>} Array of keys
     */
    async getAllKeys() {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('Failed to get keys from localStorage:', error);
            return [];
        }
    }

    /**
     * Check if localStorage is available
     * @returns {Promise<boolean>} True if available
     */
    async isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.error('localStorage is not available:', error);
            return false;
        }
    }

    /**
     * Get storage usage information
     * @returns {Promise<Object>} Storage info
     */
    async getStorageInfo() {
        try {
            let totalSize = 0;
            const items = {};

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const size = value ? value.length : 0;
                totalSize += size;
                items[key] = size;
            }

            return {
                totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2),
                itemCount: localStorage.length,
                items
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                totalSize: 0,
                totalSizeKB: '0',
                itemCount: 0,
                items: {}
            };
        }
    }
}
