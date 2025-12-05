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
        componentNeedsInputsOutputs: 'Your circuit must have at least one INPUT and one OUTPUT to be saved as a component.',
        componentNameRequired: 'Please enter a component name.',
        componentSaved: (name) => `Component "${name}" saved successfully!`,
        componentSaveFailed: 'Failed to save component. Please try again.',
        componentLoadedForEditing: (name) => `Component "${name}" loaded for editing.`,
        componentLoadFailed: (name) => `Failed to load component "${name}".`,
        componentExported: (name) => `Component "${name}" exported successfully!`,
        componentExportFailed: 'Failed to export component.',
        componentImported: (name) => `Component "${name}" imported successfully!`,
        componentImportFailed: 'Failed to import component. Please check the file format.',
        invalidComponentFile: 'Invalid component file. Please select a valid component JSON file.',
        customComponentNotFound: 'Custom component not found.',

        // Rename validation
        labelRequired: 'Please enter a label.',

        // Board management
        boardNameRequired: 'Please enter a board name.',
        boardSaved: (name) => `Board "${name}" saved successfully!`,
        boardSaveFailed: 'Failed to save board. Please try again.',
        boardLoaded: (name) => `Board "${name}" loaded successfully!`,
        boardLoadFailed: (name) => `Failed to load board "${name}".`,
        boardDeleted: (name) => `Board "${name}" deleted successfully!`,
        boardDeleteFailed: 'Failed to delete board.',
        newBoardCreated: 'New board created successfully!',
        componentNameConflict: (name) => `A component with name "${name}" already exists. Please choose a different name.`,

        // Simulation
        noInputsToSimulate: 'Please add at least one INPUT component to simulate.',
        noOutputsToSimulate: 'Please add at least one OUTPUT component to simulate.',

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
        },

        // Board deletion
        deleteBoard: (name) => `Are you sure you want to delete board "${name}"? This action cannot be undone.`,

        // Deletion during simulation
        deletionWillStopSimulation: {
            message: 'Deleting this will invalidate the circuit and stop the simulation. All inputs will be reset to 0. Continue?',
            title: 'Stop Simulation?',
            confirmLabel: 'Delete Anyway',
            cancelLabel: 'Cancel'
        },

        // Discard changes for never-saved board
        discardNeverSaved: {
            message: 'This board has never been saved. Would you like to clear it and proceed?',
            title: 'Discard Unsaved Work?',
            confirmLabel: 'Clear & Proceed',
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
