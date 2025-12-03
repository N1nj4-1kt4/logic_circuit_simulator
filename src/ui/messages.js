/**
 * messages.js - Centralized message strings for all dialogs and alerts
 *
 * This file contains all user-facing text for easy maintenance and future localization.
 * To change any message, simply edit the text in this file.
 *
 * Structure:
 * - alerts: Alert dialog messages (info, warning, error, success)
 * - confirms: Confirmation dialog messages
 * - dialogs: Dialog titles, labels, and descriptions
 */

export const messages = {
    // ==================== Alert Messages ====================
    alerts: {
        // Component saving
        emptyCircuit: 'Please create a circuit before saving it as a component.',
        missingInputsOutputs: 'Your circuit must have at least one INPUT and one OUTPUT to be saved as a component.',
        componentNameRequired: 'Please enter a component name.',

        // Rename validation
        labelRequired: 'Please enter a label.',

        // Board management
        boardNameRequired: 'Please enter a board name.',
        componentNameConflict: (name) => `A component with name "${name}" already exists. Please choose a different name.`,

        // Export
        noComponentsToExport: 'No custom components available to export.'
    },

    // ==================== Confirmation Messages ====================
    confirms: {
        // Component overwrite
        overwriteComponent: {
            message: (name) => `A component named "${name}" already exists. Overwrite it?`,
            title: 'Overwrite Component?',
            confirmLabel: 'Overwrite',
            cancelLabel: 'Cancel'
        },

        // Board overwrite
        overwriteBoard: {
            message: (name) => `Board "${name}" already exists. Overwrite?`,
            title: 'Overwrite Board?',
            confirmLabel: 'Overwrite',
            cancelLabel: 'Cancel'
        }
    },

    // ==================== Dialog Content ====================
    dialogs: {
        // Save Options Dialog
        saveOptions: {
            title: 'Save Current Work',
            description: 'You have unsaved changes. How would you like to save your work?',
            updateCurrentBoard: {
                title: '💾 Update Current Board',
                desc: 'Save changes to <strong id="currentBoardNameInDialog"></strong>'
            },
            saveAsNewBoard: {
                title: '📋 Save as New Board',
                desc: 'Create a new work-in-progress board'
            },
            saveAsComponent: {
                title: '🔧 Save as Component',
                desc: 'Finalize as a reusable component'
            },
            discardChanges: {
                title: '🗑️ Discard Changes',
                desc: "Don't save, just proceed"
            }
        },

        // Save Component Dialog
        saveComponent: {
            title: 'Save as Component',
            nameLabel: 'Component Name:',
            namePlaceholder: 'e.g., Half Adder, Full Adder, Multiplexer, etc.',
            descriptionLabel: 'Description (optional):',
            descriptionPlaceholder: 'Describe what this component does...',
            infoBox: '<strong>Note:</strong> Your INPUT and OUTPUT components will become the input/output ports of the new component.',
            confirmButton: 'Save Component',
            cancelButton: 'Cancel'
        },

        // Rename Dialog
        rename: {
            title: 'Rename Component',
            label: 'New Label:',
            placeholder: 'Enter new label...',
            confirmButton: 'Rename',
            cancelButton: 'Cancel'
        },

        // Board Name Dialog
        boardName: {
            title: 'Save Board',
            label: 'Board Name:',
            placeholder: 'Enter board name...',
            confirmButton: 'Save',
            cancelButton: 'Cancel'
        },

        // Manage Components Dialog
        manageComponents: {
            title: 'Component Library',
            description: 'Manage your saved custom components.',
            emptyMessage: 'No custom components saved yet.',
            emptyIcon: '📦'
        },

        // Export Component Dialog
        exportComponent: {
            title: 'Export Component',
            description: 'Select a component to export:'
        },

        // Help Dialog
        help: {
            title: '📖 Help & Instructions'
        }
    }
};

// Helper function to format messages with parameters
export function formatMessage(messageOrFunction, ...args) {
    if (typeof messageOrFunction === 'function') {
        return messageOrFunction(...args);
    }
    return messageOrFunction;
}
