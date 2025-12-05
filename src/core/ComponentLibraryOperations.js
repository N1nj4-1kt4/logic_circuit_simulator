/**
 * ComponentLibraryOperations - Component Library Management Module
 *
 * Handles custom component library CRUD operations and import/export.
 * Uses ContextManager for context switching and state preservation.
 */

import { eventBus, EVENT_TYPES } from '../utils/eventBus.js';
import { deepClone } from '../utils/serialization.js';
import {
    NoInputsError,
    NoOutputsError,
    EmptyCircuitError,
    ComponentNotFoundError,
    ComponentSaveError,
    InvalidComponentFileError
} from './errors.js';

export class ComponentLibraryOperations {
    /**
     * @param {Object} config - Configuration object
     * @param {CircuitState} config.state - Circuit state container
     * @param {ComponentLibrary} config.componentLibrary - Component library instance
     * @param {ContextManager} config.contextManager - Context manager instance
     */
    constructor(config) {
        this.state = config.state;
        this.componentLibrary = config.componentLibrary;
        this.contextManager = config.contextManager;
    }

    /**
     * Save current circuit as a custom component
     * @param {string} name - Component name
     * @param {string} description - Component description
     * @returns {Promise<string>} Component name on success for notification
     */
    async saveComponent(name, description) {
        const components = this.state.getComponents();
        const connections = this.state.getConnections();

        if (components.length === 0) {
            throw new EmptyCircuitError();
        }

        // Validate inputs and outputs
        const inputs = components.filter(c => c.type === 'INPUT');
        const outputs = components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0) {
            throw new NoInputsError();
        }

        if (outputs.length === 0) {
            throw new NoOutputsError();
        }

        // Create component definition
        const componentDef = {
            name,
            description,
            components: deepClone(components),
            connections: deepClone(connections),
            inputPorts: inputs.map(input => ({ label: input.label, id: input.id })),
            outputPorts: outputs.map(output => ({ label: output.label, id: output.id })),
            truthTableState: this.state.getTruthTableState()
        };

        // Save to component library
        const success = await this.componentLibrary.saveComponent(name, componentDef);

        if (success) {
            // Update custom components in state
            const customComponents = await this.componentLibrary.listComponents();
            this.state.setCustomComponents(customComponents);

            // Set current component name
            this.state.setCurrentComponentName(name);
            this.state.setCurrentBoardName(null);

            // Update last saved state
            this.state.setLastSavedState(deepClone(this.state.getCurrentState()));

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return name; // Return name for success message
        } else {
            throw new ComponentSaveError(`Failed to save component "${name}"`);
        }
    }

    /**
     * Delete a component from the library
     * @param {string} name - Component name
     * @returns {Promise<boolean>} True on success
     */
    async deleteComponent(name) {
        const success = await this.componentLibrary.deleteComponent(name);

        if (success) {
            // Update custom components in state
            const customComponents = await this.componentLibrary.listComponents();
            this.state.setCustomComponents(customComponents);

            // If we deleted the current component, clear component name
            if (this.state.getCurrentComponentName() === name) {
                this.state.setCurrentComponentName(null);
            }

            // Emit event to update toolbar displays
            eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

            return true;
        }

        return false;
    }

    /**
     * Export component to file
     * @param {string} name - Component name
     * @returns {Promise<string>} Component name on success for notification
     */
    async exportComponent(name) {
        const component = await this.componentLibrary.loadComponent(name);

        if (component) {
            const json = JSON.stringify(component, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${name}.json`;
            a.click();

            URL.revokeObjectURL(url);

            return name; // Return name for success message
        } else {
            throw new ComponentNotFoundError(name);
        }
    }

    /**
     * Import component from file
     * @param {Event} event - File input change event
     * @returns {Promise<string>} Component name on success for notification
     */
    async importComponent(event) {
        const file = event.target.files[0];
        if (!file) return null;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const componentDef = JSON.parse(e.target.result);

                    // Validate component definition
                    if (!componentDef.name || !componentDef.components || !componentDef.connections) {
                        reject(new InvalidComponentFileError());
                        return;
                    }

                    // Save to component library
                    const success = await this.componentLibrary.saveComponent(componentDef.name, componentDef);

                    if (success) {
                        // Update custom components in state
                        const customComponents = await this.componentLibrary.listComponents();
                        this.state.setCustomComponents(customComponents);

                        // Emit event to update toolbar displays
                        eventBus.emit(EVENT_TYPES.TOOLBAR_UPDATE_DISPLAYS);

                        resolve(componentDef.name); // Return name for success message
                    } else {
                        reject(new ComponentSaveError(`Failed to save imported component "${componentDef.name}"`));
                    }
                } catch (error) {
                    console.error('Error importing component:', error);
                    if (error.name === 'InvalidComponentFileError' || error.name === 'ComponentSaveError') {
                        reject(error);
                    } else {
                        reject(new InvalidComponentFileError());
                    }
                }
            };

            reader.onerror = () => {
                reject(new InvalidComponentFileError());
            };

            reader.readAsText(file);

            // Reset file input
            event.target.value = '';
        });
    }

    /**
     * Load component for editing
     * @param {string} name - Component name
     * @returns {Promise<string>} Component name on success for notification
     */
    async loadComponentForEditing(name) {
        // Save current context's state before switching (including truth table changes)
        await this.contextManager.saveCurrentContext();

        const componentDef = await this.componentLibrary.loadComponent(name);

        if (componentDef) {
            // Load circuit context using context manager
            this.contextManager.loadCircuitContext(componentDef, { type: 'component', name });

            return name; // Return name for success message
        } else {
            throw new ComponentNotFoundError(name);
        }
    }
}
