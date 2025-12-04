/**
 * ThemeManager - Manages dark/light theme toggling
 *
 * Responsibilities:
 * - Apply theme to DOM (add/remove dark-mode class)
 * - Update theme toggle button icon
 * - Persist theme preference to localStorage
 * - Notify other components (e.g., CanvasRenderer) of theme changes
 *
 * @class ThemeManager
 */

import { getDarkMode, setDarkMode } from '../storage/localStorage.js';
import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { UI } from '../constants.js';

export class ThemeManager {
    /**
     * Create a ThemeManager
     * @param {Object} options - Configuration options
     * @param {Function} options.onThemeChange - Callback when theme changes (receives isDarkMode boolean)
     */
    constructor(options = {}) {
        this.isDarkMode = getDarkMode();
        this.onThemeChange = options.onThemeChange || null;

        // Cache DOM elements
        this.themeToggleButton = document.getElementById('themeToggle');

        if (!this.themeToggleButton) {
            console.warn('ThemeManager: Theme toggle button not found');
        }

        // Apply initial theme
        this.applyTheme();

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for theme toggle button
     * @private
     */
    setupEventListeners() {
        if (this.themeToggleButton) {
            this.themeToggleButton.addEventListener('click', () => {
                this.toggle();
            });
        }
    }

    /**
     * Apply current theme to the DOM
     * Updates body class and toggle button icon
     */
    applyTheme() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            if (this.themeToggleButton) {
                this.themeToggleButton.textContent = UI.ICONS.SUN;
                this.themeToggleButton.title = 'Switch to light mode';
            }
        } else {
            document.body.classList.remove('dark-mode');
            if (this.themeToggleButton) {
                this.themeToggleButton.textContent = UI.ICONS.MOON;
                this.themeToggleButton.title = 'Switch to dark mode';
            }
        }

        // Emit theme change event
        eventBus.emit(EVENT_TYPES.THEME_CHANGED, { isDarkMode: this.isDarkMode });
    }

    /**
     * Toggle between dark and light mode
     */
    toggle() {
        this.isDarkMode = !this.isDarkMode;
        setDarkMode(this.isDarkMode);
        this.applyTheme();

        // Notify callback if provided
        if (this.onThemeChange) {
            this.onThemeChange(this.isDarkMode);
        }
    }

    /**
     * Get current theme mode
     * @returns {boolean} True if dark mode is enabled
     */
    isDark() {
        return this.isDarkMode;
    }

    /**
     * Set theme mode programmatically
     * @param {boolean} isDarkMode - Whether to enable dark mode
     */
    setTheme(isDarkMode) {
        if (this.isDarkMode !== isDarkMode) {
            this.toggle();
        }
    }
}
