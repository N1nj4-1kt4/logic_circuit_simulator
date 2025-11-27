/**
 * localStorage wrapper with JSON serialization and error handling
 * Centralizes all state persistence operations
 */

import { STORAGE_KEYS } from '../constants.js';

/**
 * Generic localStorage getter with JSON parsing
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed value or default
 */
function getItem(key, defaultValue = null) {
    try {
        const saved = localStorage.getItem(key);
        if (saved === null) {
            return defaultValue;
        }
        return JSON.parse(saved);
    } catch (e) {
        console.error(`Failed to load ${key} from localStorage:`, e);
        return defaultValue;
    }
}

/**
 * Generic localStorage setter with JSON stringification
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
function setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Failed to save ${key} to localStorage:`, e);
        return false;
    }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
function removeItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error(`Failed to remove ${key} from localStorage:`, e);
    }
}

// ==================== DARK MODE ====================

/**
 * Get dark mode preference
 * @returns {boolean} True if dark mode is enabled
 */
export function getDarkMode() {
    // Special case: localStorage stores boolean as string
    const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
    // Default to true if not set, or if it's not explicitly 'false'
    return saved !== 'false';
}

/**
 * Set dark mode preference
 * @param {boolean} enabled - Whether dark mode is enabled
 */
export function setDarkMode(enabled) {
    try {
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, enabled);
    } catch (e) {
        console.error('Failed to save dark mode preference:', e);
    }
}

// ==================== CUSTOM COMPONENTS ====================

/**
 * Get all custom components
 * @returns {Object} Custom components object
 */
export function getCustomComponents() {
    return getItem(STORAGE_KEYS.CUSTOM_COMPONENTS, {});
}

/**
 * Save custom components
 * @param {Object} components - Custom components object
 * @returns {boolean} True if successful
 */
export function setCustomComponents(components) {
    const success = setItem(STORAGE_KEYS.CUSTOM_COMPONENTS, components);
    if (!success) {
        alert('Failed to save components to storage.');
    }
    return success;
}

// ==================== CIRCUIT BOARD STATE ====================

/**
 * Get current circuit board state
 * @returns {Object|null} Board state or null if not found
 */
export function getBoardState() {
    return getItem(STORAGE_KEYS.CIRCUIT_BOARD_STATE, null);
}

/**
 * Save circuit board state
 * @param {Object} state - Board state object
 * @returns {boolean} True if successful
 */
export function setBoardState(state) {
    return setItem(STORAGE_KEYS.CIRCUIT_BOARD_STATE, state);
}

/**
 * Clear circuit board state
 */
export function clearBoardState() {
    removeItem(STORAGE_KEYS.CIRCUIT_BOARD_STATE);
}

// ==================== SAVED BOARDS ====================

/**
 * Get all saved boards
 * @returns {Object} Saved boards object
 */
export function getSavedBoards() {
    return getItem(STORAGE_KEYS.SAVED_BOARDS, {});
}

/**
 * Save boards to storage
 * @param {Object} boards - Saved boards object
 * @returns {boolean} True if successful
 */
export function setSavedBoards(boards) {
    return setItem(STORAGE_KEYS.SAVED_BOARDS, boards);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Clear all application data from localStorage
 */
export function clearAllData() {
    removeItem(STORAGE_KEYS.CIRCUIT_BOARD_STATE);
    removeItem(STORAGE_KEYS.CUSTOM_COMPONENTS);
    removeItem(STORAGE_KEYS.SAVED_BOARDS);
    removeItem(STORAGE_KEYS.DARK_MODE);
}

/**
 * Get storage usage information
 * @returns {Object} Storage info with estimated sizes
 */
export function getStorageInfo() {
    const info = {};

    Object.values(STORAGE_KEYS).forEach(key => {
        const value = localStorage.getItem(key);
        info[key] = value ? value.length : 0;
    });

    return info;
}
