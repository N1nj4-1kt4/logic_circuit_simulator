/**
 * ComponentLibrary - Manages custom reusable components
 * Handles saving, loading, listing, deleting, exporting, and importing components
 */
import { STORAGE_KEYS } from '../constants.js';
import { exportToJSON, importFromJSON, validateComponentData } from '../utils/serialization.js';

export class ComponentLibrary {
    /**
     * @param {StorageAdapter} storageAdapter - Storage implementation
     */
    constructor(storageAdapter) {
        this.storage = storageAdapter;
        this.storageKey = STORAGE_KEYS.CUSTOM_COMPONENTS;
    }

    /**
     * Get all custom components
     * @returns {Promise<Object>} Object mapping component names to component data
     */
    async getAllComponents() {
        const components = await this.storage.getItem(this.storageKey);
        return components || {};
    }

    /**
     * Save a custom component
     * @param {string} name - Component name
     * @param {Object} componentData - Component definition
     * @returns {Promise<boolean>} True if successful
     */
    async saveComponent(name, componentData) {
        if (!name || typeof name !== 'string') {
            console.error('Invalid component name');
            return false;
        }

        try {
            // Validate component data
            validateComponentData(componentData);

            const components = await this.getAllComponents();

            // Add metadata
            components[name] = {
                ...componentData,
                name,
                savedAt: new Date().toISOString(),
                version: '1.0'
            };

            const success = await this.storage.setItem(this.storageKey, components);

            if (success) {
                console.log(`Component "${name}" saved successfully`);
            }

            return success;
        } catch (error) {
            console.error(`Failed to save component "${name}":`, error);
            return false;
        }
    }

    /**
     * Load a custom component
     * @param {string} name - Component name
     * @returns {Promise<Object|null>} Component data or null if not found
     */
    async loadComponent(name) {
        try {
            const components = await this.getAllComponents();
            const component = components[name];

            if (!component) {
                console.warn(`Component "${name}" not found`);
                return null;
            }

            console.log(`Component "${name}" loaded successfully`);
            return component;
        } catch (error) {
            console.error(`Failed to load component "${name}":`, error);
            return null;
        }
    }

    /**
     * List all component names with metadata
     * @returns {Promise<Array>} Array of component info objects
     */
    async listComponents() {
        try {
            const components = await this.getAllComponents();

            return Object.keys(components).map(name => ({
                name,
                description: components[name].description || '',
                savedAt: components[name].savedAt,
                inputCount: components[name].inputPorts?.length || 0,
                outputCount: components[name].outputPorts?.length || 0,
                internalComponentCount: components[name].components?.length || 0
            })).sort((a, b) => {
                // Sort alphabetically by name
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error('Failed to list components:', error);
            return [];
        }
    }

    /**
     * Delete a custom component
     * @param {string} name - Component name
     * @returns {Promise<boolean>} True if successful
     */
    async deleteComponent(name) {
        try {
            const components = await this.getAllComponents();

            if (!components[name]) {
                console.warn(`Component "${name}" not found`);
                return false;
            }

            delete components[name];

            const success = await this.storage.setItem(this.storageKey, components);

            if (success) {
                console.log(`Component "${name}" deleted successfully`);
            }

            return success;
        } catch (error) {
            console.error(`Failed to delete component "${name}":`, error);
            return false;
        }
    }

    /**
     * Export component to JSON file
     * @param {string} name - Component name
     * @returns {Promise<boolean>} True if successful
     */
    async exportComponent(name) {
        try {
            const component = await this.loadComponent(name);

            if (!component) {
                return false;
            }

            // Use the serialization utility to export
            exportToJSON(component, name);

            console.log(`Component "${name}" exported successfully`);
            return true;
        } catch (error) {
            console.error(`Failed to export component "${name}":`, error);
            alert(`Failed to export component: ${error.message}`);
            return false;
        }
    }

    /**
     * Import component from JSON file
     * @param {File} file - File object from input
     * @param {boolean} overwrite - Whether to overwrite if component exists
     * @returns {Promise<Object|null>} Imported component data or null if failed
     */
    async importComponent(file, overwrite = false) {
        try {
            // Use the serialization utility to import
            const componentData = await importFromJSON(file);

            // Validate component data
            validateComponentData(componentData);

            const { name } = componentData;

            // Check if component already exists
            const exists = await this.componentExists(name);

            if (exists && !overwrite) {
                const shouldOverwrite = confirm(
                    `Component "${name}" already exists. Overwrite it?`
                );

                if (!shouldOverwrite) {
                    return null;
                }
            }

            // Save the component
            const success = await this.saveComponent(name, componentData);

            if (success) {
                console.log(`Component "${name}" imported successfully`);
                return componentData;
            }

            return null;
        } catch (error) {
            console.error('Failed to import component:', error);
            alert(`Failed to import component: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if a component exists
     * @param {string} name - Component name
     * @returns {Promise<boolean>} True if component exists
     */
    async componentExists(name) {
        const components = await this.getAllComponents();
        return !!components[name];
    }

    /**
     * Rename a component
     * @param {string} oldName - Current component name
     * @param {string} newName - New component name
     * @returns {Promise<boolean>} True if successful
     */
    async renameComponent(oldName, newName) {
        if (oldName === newName) {
            return true;
        }

        try {
            const components = await this.getAllComponents();

            if (!components[oldName]) {
                console.warn(`Component "${oldName}" not found`);
                return false;
            }

            if (components[newName]) {
                console.error(`Component "${newName}" already exists`);
                return false;
            }

            // Copy component with new name
            components[newName] = {
                ...components[oldName],
                name: newName,
                savedAt: new Date().toISOString()
            };

            // Delete old component
            delete components[oldName];

            const success = await this.storage.setItem(this.storageKey, components);

            if (success) {
                console.log(`Component renamed from "${oldName}" to "${newName}"`);
            }

            return success;
        } catch (error) {
            console.error(`Failed to rename component from "${oldName}" to "${newName}":`, error);
            return false;
        }
    }

    /**
     * Clear all components
     * @returns {Promise<boolean>} True if successful
     */
    async clearAllComponents() {
        try {
            const success = await this.storage.setItem(this.storageKey, {});

            if (success) {
                console.log('All components cleared');
            }

            return success;
        } catch (error) {
            console.error('Failed to clear all components:', error);
            return false;
        }
    }

    /**
     * Duplicate a component with a new name
     * @param {string} sourceName - Source component name
     * @param {string} newName - New component name
     * @returns {Promise<boolean>} True if successful
     */
    async duplicateComponent(sourceName, newName) {
        try {
            const sourceComponent = await this.loadComponent(sourceName);

            if (!sourceComponent) {
                return false;
            }

            // Save with new name
            return await this.saveComponent(newName, {
                ...sourceComponent,
                name: newName
            });
        } catch (error) {
            console.error(`Failed to duplicate component "${sourceName}":`, error);
            return false;
        }
    }
}
