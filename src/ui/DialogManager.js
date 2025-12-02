/**
 * DialogManager - Manages all dialog interactions
 * Handles component dialogs, rename dialogs, and board save dialogs
 */

export class DialogManager {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.elements = {};
        this.state = {
            renameTarget: null,
            pendingActionAfterSave: null
        };
    }

    /**
     * Initialize DOM references and setup event listeners
     */
    init() {
        // Cache DOM element references
        this.elements = {
            // Component dialogs
            saveComponentDialog: document.getElementById('saveComponentDialog'),
            componentName: document.getElementById('componentName'),
            componentDescription: document.getElementById('componentDescription'),
            closeSaveDialog: document.getElementById('closeSaveDialog'),
            cancelSave: document.getElementById('cancelSave'),
            confirmSave: document.getElementById('confirmSave'),

            // Manage components dialog
            manageComponentsDialog: document.getElementById('manageComponentsDialog'),
            componentLibraryList: document.getElementById('componentLibraryList'),
            closeManageDialog: document.getElementById('closeManageDialog'),

            // Rename dialog
            renameDialog: document.getElementById('renameDialog'),
            newComponentLabel: document.getElementById('newComponentLabel'),
            closeRenameDialog: document.getElementById('closeRenameDialog'),
            cancelRename: document.getElementById('cancelRename'),
            confirmRename: document.getElementById('confirmRename'),

            // Export component dialog
            exportComponentDialog: document.getElementById('exportComponentDialog'),
            exportComponentList: document.getElementById('exportComponentList'),
            closeExportDialog: document.getElementById('closeExportDialog'),

            // Board save dialogs
            saveOptionsDialog: document.getElementById('saveOptionsDialog'),
            saveAsCurrentBoard: document.getElementById('saveAsCurrentBoard'),
            currentBoardNameInDialog: document.getElementById('currentBoardNameInDialog'),
            saveAsNewBoard: document.getElementById('saveAsNewBoard'),
            saveAsNewComponent: document.getElementById('saveAsNewComponent'),
            discardChanges: document.getElementById('discardChanges'),
            closeSaveOptions: document.getElementById('closeSaveOptions'),

            // Board name prompt dialog
            boardNameDialog: document.getElementById('boardNameDialog'),
            boardNameInput: document.getElementById('boardNameInput'),
            confirmBoardName: document.getElementById('confirmBoardName'),
            cancelBoardName: document.getElementById('cancelBoardName'),
            closeBoardNameDialog: document.getElementById('closeBoardNameDialog'),

            // Import file input
            importFile: document.getElementById('importFile')
        };

        this.setupEventListeners();
    }

    /**
     * Setup all dialog event listeners
     */
    setupEventListeners() {
        // Save Component Dialog buttons
        this.elements.closeSaveDialog?.addEventListener('click', () => {
            this.elements.saveComponentDialog.style.display = 'none';
        });

        this.elements.cancelSave?.addEventListener('click', () => {
            this.elements.saveComponentDialog.style.display = 'none';
        });

        this.elements.confirmSave?.addEventListener('click', async () => {
            await this.saveCurrentCircuitAsComponent();
        });

        // Manage Components Dialog buttons
        this.elements.closeManageDialog?.addEventListener('click', () => {
            this.elements.manageComponentsDialog.style.display = 'none';
        });

        // Rename Dialog buttons
        this.elements.closeRenameDialog?.addEventListener('click', () => {
            this.elements.renameDialog.style.display = 'none';
        });

        this.elements.cancelRename?.addEventListener('click', () => {
            this.elements.renameDialog.style.display = 'none';
        });

        this.elements.confirmRename?.addEventListener('click', () => {
            this.confirmRename();
        });

        // Export Component Dialog buttons
        this.elements.closeExportDialog?.addEventListener('click', () => {
            this.elements.exportComponentDialog.style.display = 'none';
        });

        // Setup board management listeners
        this.setupBoardManagementListeners();

        // Import file input
        this.elements.importFile?.addEventListener('change', async (e) => {
            await this.callbacks.onImportComponent(e);
        });
    }

    /**
     * Setup board management dialog listeners
     */
    setupBoardManagementListeners() {
        // Save Options Dialog buttons
        this.elements.saveAsCurrentBoard?.addEventListener('click', async () => {
            const currentBoardName = this.callbacks.getCurrentBoardName();
            if (currentBoardName) {
                await this.callbacks.onSaveCurrentBoard(currentBoardName);
            }
            this.hideSaveOptionsDialog();
            if (this.state.pendingActionAfterSave) {
                this.state.pendingActionAfterSave();
                this.state.pendingActionAfterSave = null;
            }
        });

        this.elements.saveAsNewBoard?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            this.promptForBoardName(null, async (boardName) => {
                await this.callbacks.onSaveCurrentBoard(boardName);
                if (this.state.pendingActionAfterSave) {
                    this.state.pendingActionAfterSave();
                    this.state.pendingActionAfterSave = null;
                }
            });
        });

        this.elements.saveAsNewComponent?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            // Open the save component dialog
            this.showSaveComponentDialog();
            // After saving component, execute pending action
            const originalOnClick = this.elements.confirmSave.onclick;
            this.elements.confirmSave.onclick = async () => {
                if (originalOnClick) {
                    await originalOnClick();
                }
                if (this.state.pendingActionAfterSave) {
                    this.state.pendingActionAfterSave();
                    this.state.pendingActionAfterSave = null;
                }
            };
        });

        this.elements.discardChanges?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            if (this.state.pendingActionAfterSave) {
                this.state.pendingActionAfterSave();
                this.state.pendingActionAfterSave = null;
            }
        });

        this.elements.closeSaveOptions?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            this.state.pendingActionAfterSave = null; // Cancel the pending action
        });
    }

    // ==================== Component Dialogs ====================

    /**
     * Show save component dialog
     */
    showSaveComponentDialog() {
        const circuitData = this.callbacks.getCircuitData();

        if (circuitData.components.length === 0) {
            alert('Please create a circuit before saving it as a component.');
            return;
        }

        const inputs = circuitData.components.filter(c => c.type === 'INPUT');
        const outputs = circuitData.components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0 || outputs.length === 0) {
            alert('Your circuit must have at least one INPUT and one OUTPUT to be saved as a component.');
            return;
        }

        // Pre-fill with current component name if it exists
        const currentComponentName = this.callbacks.getCurrentComponentName();
        if (currentComponentName) {
            this.elements.componentName.value = currentComponentName;
            // Optionally load description from saved component
            const customComponents = this.callbacks.getCustomComponents();
            const savedComponent = customComponents[currentComponentName];
            if (savedComponent && savedComponent.description) {
                this.elements.componentDescription.value = savedComponent.description;
            } else {
                this.elements.componentDescription.value = '';
            }
        } else {
            this.elements.componentName.value = '';
            this.elements.componentDescription.value = '';
        }

        // Show dialog
        this.elements.saveComponentDialog.style.display = 'block';
    }

    /**
     * Save current circuit as a component
     */
    async saveCurrentCircuitAsComponent() {
        const name = this.elements.componentName.value.trim();
        const description = this.elements.componentDescription.value.trim();

        if (!name) {
            alert('Please enter a component name.');
            return;
        }

        // Check if name already exists
        const componentLibrary = this.callbacks.getComponentLibrary();
        const exists = await componentLibrary.componentExists(name);
        if (exists) {
            if (!confirm(`A component named "${name}" already exists. Overwrite it?`)) {
                return;
            }
        }

        // Callback to save component
        await this.callbacks.onSaveComponent(name, description);

        // Close dialog
        this.elements.saveComponentDialog.style.display = 'none';
    }

    /**
     * Show manage components dialog
     */
    showManageComponentsDialog() {
        this.updateComponentLibraryList();
        this.elements.manageComponentsDialog.style.display = 'block';
    }

    /**
     * Update component library list
     */
    updateComponentLibraryList() {
        const list = this.elements.componentLibraryList;
        const customComponents = this.callbacks.getCustomComponents();
        const componentNames = Object.keys(customComponents);

        if (componentNames.length === 0) {
            list.innerHTML = `
                <div class="empty-library">
                    <div class="empty-library-icon">📦</div>
                    <p>No custom components saved yet.</p>
                    <p style="font-size: 0.9em;">Create a circuit and click "Save as Component" to get started.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';

        componentNames.sort().forEach(name => {
            const component = customComponents[name];
            const item = document.createElement('div');
            item.className = 'library-item';

            const date = new Date(component.created).toLocaleDateString();

            item.innerHTML = `
                <div class="library-item-header">
                    <div class="library-item-name">${name}</div>
                </div>
                ${component.description ? `<div class="library-item-description">${component.description}</div>` : ''}
                <div class="library-item-info">
                    ${component.inputPorts.length} input(s), ${component.outputPorts.length} output(s) • Created: ${date}
                </div>
                <div class="library-item-actions">
                    <button class="edit-btn" data-name="${name}">Edit</button>
                    <button class="export-btn" data-name="${name}">Export</button>
                    <button class="delete-btn" data-name="${name}">Delete</button>
                </div>
            `;

            // Add edit handler
            item.querySelector('.edit-btn').addEventListener('click', () => {
                this.callbacks.onLoadComponentForEditing(name);
            });

            // Add export handler
            item.querySelector('.export-btn').addEventListener('click', async () => {
                await this.callbacks.onDownloadComponent(name);
            });

            // Add delete handler
            item.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`Delete component "${name}"?`)) {
                    await this.callbacks.onDeleteComponent(name);
                    this.updateComponentLibraryList();
                }
            });

            list.appendChild(item);
        });
    }

    // ==================== Rename Dialog ====================

    /**
     * Show rename dialog for a component
     * @param {Object} component - Component to rename
     */
    showRenameDialog(component) {
        this.state.renameTarget = component;
        this.elements.newComponentLabel.value = component.label;
        this.elements.renameDialog.style.display = 'block';

        // Focus and select the input
        setTimeout(() => {
            this.elements.newComponentLabel.focus();
            this.elements.newComponentLabel.select();
        }, 100);
    }

    /**
     * Confirm rename operation
     */
    confirmRename() {
        const newLabel = this.elements.newComponentLabel.value.trim();

        if (!newLabel) {
            alert('Please enter a label.');
            return;
        }

        if (this.state.renameTarget) {
            this.state.renameTarget.label = newLabel;
            this.callbacks.onRenameComplete();
        }

        this.elements.renameDialog.style.display = 'none';
        this.state.renameTarget = null;
    }

    // ==================== Board Save Dialogs ====================

    /**
     * Show save options dialog
     * @param {Function} onComplete - Callback to execute after save
     */
    showSaveOptionsDialog(onComplete) {
        this.state.pendingActionAfterSave = onComplete;

        const currentBoardName = this.callbacks.getCurrentBoardName();

        // Update the current board option
        if (currentBoardName) {
            this.elements.saveAsCurrentBoard.style.display = 'block';
            this.elements.currentBoardNameInDialog.textContent = currentBoardName;
        } else {
            this.elements.saveAsCurrentBoard.style.display = 'none';
        }

        this.elements.saveOptionsDialog.style.display = 'block';
    }

    /**
     * Hide save options dialog
     */
    hideSaveOptionsDialog() {
        this.elements.saveOptionsDialog.style.display = 'none';
        // Don't clear pendingActionAfterSave here - let handlers execute it first
    }

    /**
     * Prompt for board name
     * @param {string} defaultName - Default board name
     * @param {Function} onSave - Callback when save is confirmed
     */
    promptForBoardName(defaultName, onSave) {
        const dialog = this.elements.boardNameDialog;
        const input = this.elements.boardNameInput;

        // Pre-fill with: explicit default > current board name > next board name
        const currentBoardName = this.callbacks.getCurrentBoardName();
        input.value = defaultName || currentBoardName || this.getNextBoardName();
        dialog.style.display = 'block';

        const confirmBtn = this.elements.confirmBoardName;
        const cancelBtn = this.elements.cancelBoardName;
        const closeBtn = this.elements.closeBoardNameDialog;

        // Use cloneNode to remove all previous event listeners
        const cleanup = () => {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            closeBtn.replaceWith(closeBtn.cloneNode(true));
        };

        // Re-get elements after potential cloning
        const newConfirmBtn = document.getElementById('confirmBoardName');
        const newCancelBtn = document.getElementById('cancelBoardName');
        const newCloseBtn = document.getElementById('closeBoardNameDialog');

        newConfirmBtn.onclick = () => {
            const boardName = input.value.trim();
            if (!boardName) {
                alert('Please enter a board name.');
                return;
            }

            const customComponents = this.callbacks.getCustomComponents();
            if (customComponents[boardName]) {
                alert(`A component with name "${boardName}" already exists. Please choose a different name.`);
                return;
            }

            const savedBoards = this.callbacks.getSavedBoards();
            const currentBoardName = this.callbacks.getCurrentBoardName();
            if (savedBoards[boardName] && boardName !== currentBoardName) {
                if (!confirm(`Board "${boardName}" already exists. Overwrite?`)) {
                    return;
                }
            }

            dialog.style.display = 'none';
            cleanup();
            onSave(boardName);
        };

        newCancelBtn.onclick = () => {
            dialog.style.display = 'none';
            cleanup();
        };

        newCloseBtn.onclick = () => {
            dialog.style.display = 'none';
            cleanup();
        };
    }

    // ==================== Export Component Dialog ====================

    /**
     * Show export component dialog
     */
    showExportComponentDialog() {
        const customComponents = this.callbacks.getCustomComponents();
        const componentNames = Object.keys(customComponents);

        if (componentNames.length === 0) {
            alert('No custom components available to export.');
            return;
        }

        // Populate the list
        const list = this.elements.exportComponentList;
        list.innerHTML = '';

        componentNames.sort().forEach(name => {
            const component = customComponents[name];
            const item = document.createElement('div');
            item.className = 'export-component-item';

            const nameDiv = document.createElement('div');
            const nameSpan = document.createElement('div');
            nameSpan.className = 'export-component-item-name';
            nameSpan.textContent = name;
            nameDiv.appendChild(nameSpan);

            if (component.description) {
                const descSpan = document.createElement('div');
                descSpan.className = 'export-component-item-info';
                descSpan.textContent = component.description;
                nameDiv.appendChild(descSpan);
            }

            const infoDiv = document.createElement('div');
            infoDiv.className = 'export-component-item-info';
            infoDiv.textContent = `${component.inputPorts.length} inputs, ${component.outputPorts.length} outputs`;

            item.appendChild(nameDiv);
            item.appendChild(infoDiv);

            // Add click handler to export this component
            item.addEventListener('click', async () => {
                this.elements.exportComponentDialog.style.display = 'none';
                await this.callbacks.onDownloadComponent(name);
            });

            list.appendChild(item);
        });

        // Show dialog
        this.elements.exportComponentDialog.style.display = 'block';
    }

    // ==================== Board Name Management ====================

    /**
     * Get next available board name
     * @returns {string} Next board name (e.g., "Board01", "Board02", etc.)
     */
    getNextBoardName() {
        const savedBoards = this.callbacks.getSavedBoards();
        const boardNames = Object.keys(savedBoards);

        // Extract existing board numbers from names like "Board01", "Board02", etc.
        const existingNumbers = boardNames
            .filter(name => /^Board\d+$/.test(name))
            .map(name => parseInt(name.replace('Board', ''), 10))
            .filter(num => !isNaN(num));

        // Find the highest number and increment
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const nextNumber = maxNumber + 1;

        // Format with zero-padding (at least 2 digits)
        const paddedNumber = String(nextNumber).padStart(2, '0');
        return `Board${paddedNumber}`;
    }
}
