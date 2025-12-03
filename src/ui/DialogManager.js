/**
 * DialogManager - Manages all dialog interactions
 * Handles component dialogs, rename dialogs, and board save dialogs
 */

import { DialogFactory } from './DialogFactory.js';

export class DialogManager {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.elements = {};
        this.dialogs = {}; // Cache for programmatically created dialogs
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
            // Component dialogs - saveComponentDialog now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Manage components dialog - now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Rename dialog - now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Export component dialog - now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Board save dialogs - now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Board name prompt dialog - now created programmatically via DialogFactory
            // (DOM elements removed from cache, created on-demand)

            // Import file input
            importFile: document.getElementById('importFile')
        };

        this.setupEventListeners();
    }

    /**
     * Setup all dialog event listeners
     */
    setupEventListeners() {
        // Save Component Dialog - event listeners now handled by DialogFactory
        // (buttons created programmatically with onClick handlers)

        // Manage Components Dialog - event listeners now handled by DialogFactory
        // (buttons created programmatically with onClick handlers)

        // Rename Dialog - event listeners now handled by DialogFactory
        // (buttons created programmatically with onClick handlers)

        // Export Component Dialog - event listeners now handled by DialogFactory
        // (buttons created programmatically with onClick handlers)

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
        // Save Options Dialog - event listeners now handled by DialogFactory
        // (buttons created programmatically with onClick handlers in _setupSaveOptionsEventListeners)
    }

    // ==================== Component Dialogs ====================

    /**
     * Create save component dialog programmatically
     * @returns {HTMLElement} Save component dialog element
     */
    _createSaveComponentDialog() {
        const content = DialogFactory.createFormContent({
            description: 'Create a reusable component from your current circuit.',
            fields: [
                {
                    id: 'componentName',
                    label: 'Component Name:',
                    type: 'text',
                    placeholder: 'e.g., FullAdder, Multiplexer'
                },
                {
                    id: 'componentDescription',
                    label: 'Description (optional):',
                    type: 'textarea',
                    rows: 3,
                    placeholder: 'Brief description of what this component does'
                }
            ],
            infoBox: `
                <strong>Requirements:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>At least one INPUT component</li>
                    <li>At least one OUTPUT component</li>
                </ul>
            `,
            buttons: [
                {
                    id: 'confirmSave',
                    label: 'Save Component',
                    className: 'action-btn primary-btn',
                    onClick: async () => await this.saveCurrentCircuitAsComponent()
                },
                {
                    id: 'cancelSave',
                    label: 'Cancel',
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.saveComponent)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'saveComponentDialog',
            title: 'Save as Component',
            size: 'default',
            content: content,
            closeButtonId: 'closeSaveDialog',
            onClose: () => {} // No special cleanup needed
        });
    }

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

        // Lazy create dialog
        if (!this.dialogs.saveComponent) {
            this.dialogs.saveComponent = this._createSaveComponentDialog();
            document.body.appendChild(this.dialogs.saveComponent);
        }

        // Get input elements
        const nameInput = document.getElementById('componentName');
        const descInput = document.getElementById('componentDescription');

        // Pre-fill with current component name if it exists
        const currentComponentName = this.callbacks.getCurrentComponentName();
        if (currentComponentName) {
            nameInput.value = currentComponentName;
            // Optionally load description from saved component
            const customComponents = this.callbacks.getCustomComponents();
            const savedComponent = customComponents[currentComponentName];
            if (savedComponent && savedComponent.description) {
                descInput.value = savedComponent.description;
            } else {
                descInput.value = '';
            }
        } else {
            nameInput.value = '';
            descInput.value = '';
        }

        // Show dialog
        DialogFactory.showDialog(this.dialogs.saveComponent);
    }

    /**
     * Save current circuit as a component
     */
    async saveCurrentCircuitAsComponent() {
        const nameInput = document.getElementById('componentName');
        const descInput = document.getElementById('componentDescription');

        const name = nameInput.value.trim();
        const description = descInput.value.trim();

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
        DialogFactory.hideDialog(this.dialogs.saveComponent);
    }

    /**
     * Create export component dialog programmatically
     * @returns {HTMLElement} Export component dialog element
     */
    _createExportComponentDialog() {
        const container = document.createElement('div');

        const p = document.createElement('p');
        p.textContent = 'Select a component to export:';
        container.appendChild(p);

        const list = document.createElement('div');
        list.id = 'exportComponentList';
        list.className = 'export-component-list';
        container.appendChild(list);

        return DialogFactory.createDialog({
            id: 'exportComponentDialog',
            title: 'Export Component',
            size: 'default',
            content: container,
            closeButtonId: 'closeExportDialog'
        });
    }

    /**
     * Create manage components dialog programmatically
     * @returns {HTMLElement} Manage components dialog element
     */
    _createManageComponentsDialog() {
        const container = document.createElement('div');

        const p = document.createElement('p');
        p.textContent = 'Manage your saved custom components.';
        container.appendChild(p);

        const list = document.createElement('div');
        list.id = 'componentLibraryList';
        container.appendChild(list);

        return DialogFactory.createDialog({
            id: 'manageComponentsDialog',
            title: 'Component Library',
            size: 'default',
            content: container,
            closeButtonId: 'closeManageDialog'
        });
    }

    /**
     * Show manage components dialog
     */
    showManageComponentsDialog() {
        // Lazy create dialog
        if (!this.dialogs.manageComponents) {
            this.dialogs.manageComponents = this._createManageComponentsDialog();
            document.body.appendChild(this.dialogs.manageComponents);
        }

        this.updateComponentLibraryList();
        DialogFactory.showDialog(this.dialogs.manageComponents);
    }

    /**
     * Update component library list
     */
    updateComponentLibraryList() {
        const list = document.getElementById('componentLibraryList');
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
     * Create rename dialog programmatically
     * @returns {HTMLElement} Rename dialog element
     */
    _createRenameDialog() {
        const content = DialogFactory.createFormContent({
            fields: [{
                id: 'newComponentLabel',
                label: 'New Label:',
                type: 'text',
                placeholder: 'Enter new label'
            }],
            buttons: [
                {
                    id: 'confirmRename',
                    label: 'Rename',
                    className: 'action-btn primary-btn',
                    onClick: () => this.confirmRename()
                },
                {
                    id: 'cancelRename',
                    label: 'Cancel',
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.rename)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'renameDialog',
            title: 'Rename Component',
            size: 'small',
            content: content,
            closeButtonId: 'closeRenameDialog',
            onClose: () => {
                this.state.renameTarget = null;
            }
        });
    }

    /**
     * Show rename dialog for a component
     * @param {Object} component - Component to rename
     */
    showRenameDialog(component) {
        // Lazy create dialog
        if (!this.dialogs.rename) {
            this.dialogs.rename = this._createRenameDialog();
            document.body.appendChild(this.dialogs.rename);
        }

        this.state.renameTarget = component;

        // Get the input element
        const input = document.getElementById('newComponentLabel');
        input.value = component.label;

        // Show dialog
        DialogFactory.showDialog(this.dialogs.rename);

        // Focus and select the input
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    }

    /**
     * Confirm rename operation
     */
    confirmRename() {
        const input = document.getElementById('newComponentLabel');
        const newLabel = input.value.trim();

        if (!newLabel) {
            alert('Please enter a label.');
            return;
        }

        if (this.state.renameTarget) {
            this.state.renameTarget.label = newLabel;
            this.callbacks.onRenameComplete();
        }

        DialogFactory.hideDialog(this.dialogs.rename);
        this.state.renameTarget = null;
    }

    // ==================== Board Save Dialogs ====================

    /**
     * Create save options dialog programmatically
     * @returns {HTMLElement} Save options dialog element
     */
    _createSaveOptionsDialog() {
        const container = document.createElement('div');

        const p = document.createElement('p');
        p.textContent = 'You have unsaved changes. How would you like to save your work?';
        container.appendChild(p);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'save-options';

        // Create 4 option buttons
        const options = [
            {
                id: 'saveAsCurrentBoard',
                title: '💾 Update Current Board',
                desc: 'Save changes to <strong id="currentBoardNameInDialog"></strong>',
                class: ''
            },
            {
                id: 'saveAsNewBoard',
                title: '📋 Save as New Board',
                desc: 'Create a new work-in-progress board',
                class: ''
            },
            {
                id: 'saveAsNewComponent',
                title: '🔧 Save as Component',
                desc: 'Finalize as a reusable component',
                class: ''
            },
            {
                id: 'discardChanges',
                title: '🗑️ Discard Changes',
                desc: "Don't save, just proceed",
                class: 'discard-btn'
            }
        ];

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = `save-option-btn ${opt.class}`;
            btn.id = opt.id;
            btn.innerHTML = `
                <div class="option-title">${opt.title}</div>
                <div class="option-desc">${opt.desc}</div>
            `;
            optionsDiv.appendChild(btn);
        });

        container.appendChild(optionsDiv);

        return DialogFactory.createDialog({
            id: 'saveOptionsDialog',
            title: 'Save Current Work',
            size: 'default',
            content: container,
            closeButtonId: 'closeSaveOptions',
            onClose: () => {
                // Cancel the pending action when closing via × button
                this.state.pendingActionAfterSave = null;
            }
        });
    }

    /**
     * Create board name dialog programmatically
     * @returns {HTMLElement} Board name dialog element
     */
    _createBoardNameDialog() {
        const content = DialogFactory.createFormContent({
            fields: [{
                id: 'boardNameInput',
                label: 'Board Name:',
                type: 'text',
                placeholder: 'Enter board name'
            }],
            buttons: [
                {
                    id: 'confirmBoardName',
                    label: 'Save',
                    className: 'action-btn primary-btn',
                    onClick: () => {} // Will be set dynamically in promptForBoardName
                },
                {
                    id: 'cancelBoardName',
                    label: 'Cancel',
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.boardName)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'boardNameDialog',
            title: 'Save Board',
            size: 'small',
            content: content,
            closeButtonId: 'closeBoardNameDialog',
            onClose: () => {} // No special cleanup needed
        });
    }

    /**
     * Show save options dialog
     * @param {Function} onComplete - Callback to execute after save
     */
    showSaveOptionsDialog(onComplete) {
        // Lazy create dialog
        if (!this.dialogs.saveOptions) {
            this.dialogs.saveOptions = this._createSaveOptionsDialog();
            document.body.appendChild(this.dialogs.saveOptions);
            this._setupSaveOptionsEventListeners();
        }

        this.state.pendingActionAfterSave = onComplete;

        const currentBoardName = this.callbacks.getCurrentBoardName();

        // Update the current board option
        const saveAsCurrentBoardBtn = document.getElementById('saveAsCurrentBoard');
        const currentBoardNameSpan = document.getElementById('currentBoardNameInDialog');

        if (currentBoardName) {
            saveAsCurrentBoardBtn.style.display = 'block';
            currentBoardNameSpan.textContent = currentBoardName;
        } else {
            saveAsCurrentBoardBtn.style.display = 'none';
        }

        DialogFactory.showDialog(this.dialogs.saveOptions);
    }

    /**
     * Setup event listeners for save options dialog buttons
     * Called once when dialog is first created
     */
    _setupSaveOptionsEventListeners() {
        const saveAsCurrentBoard = document.getElementById('saveAsCurrentBoard');
        const saveAsNewBoard = document.getElementById('saveAsNewBoard');
        const saveAsNewComponent = document.getElementById('saveAsNewComponent');
        const discardChanges = document.getElementById('discardChanges');

        saveAsCurrentBoard?.addEventListener('click', async () => {
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

        saveAsNewBoard?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            this.promptForBoardName(null, async (boardName) => {
                await this.callbacks.onSaveCurrentBoard(boardName);
                if (this.state.pendingActionAfterSave) {
                    this.state.pendingActionAfterSave();
                    this.state.pendingActionAfterSave = null;
                }
            });
        });

        saveAsNewComponent?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            // Open the save component dialog
            this.showSaveComponentDialog();
            // After saving component, execute pending action
            const confirmSaveBtn = document.getElementById('confirmSave');
            const originalOnClick = confirmSaveBtn.onclick;
            confirmSaveBtn.onclick = async () => {
                if (originalOnClick) {
                    await originalOnClick();
                }
                if (this.state.pendingActionAfterSave) {
                    this.state.pendingActionAfterSave();
                    this.state.pendingActionAfterSave = null;
                }
            };
        });

        discardChanges?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            if (this.state.pendingActionAfterSave) {
                this.state.pendingActionAfterSave();
                this.state.pendingActionAfterSave = null;
            }
        });
    }

    /**
     * Hide save options dialog
     */
    hideSaveOptionsDialog() {
        if (this.dialogs.saveOptions) {
            DialogFactory.hideDialog(this.dialogs.saveOptions);
        }
        // Don't clear pendingActionAfterSave here - let handlers execute it first
    }

    /**
     * Prompt for board name
     * @param {string} defaultName - Default board name
     * @param {Function} onSave - Callback when save is confirmed
     */
    promptForBoardName(defaultName, onSave) {
        // Lazy create dialog
        if (!this.dialogs.boardName) {
            this.dialogs.boardName = this._createBoardNameDialog();
            document.body.appendChild(this.dialogs.boardName);
        }

        // Get input element
        const input = document.getElementById('boardNameInput');

        // Pre-fill with: explicit default > current board name > next board name
        const currentBoardName = this.callbacks.getCurrentBoardName();
        input.value = defaultName || currentBoardName || this.getNextBoardName();

        // Set up the confirm handler dynamically (since onSave changes each time)
        const confirmBtn = document.getElementById('confirmBoardName');
        confirmBtn.onclick = () => {
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

            DialogFactory.hideDialog(this.dialogs.boardName);
            onSave(boardName);
        };

        // Show dialog
        DialogFactory.showDialog(this.dialogs.boardName);

        // Focus and select input
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
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

        // Lazy create dialog
        if (!this.dialogs.exportComponent) {
            this.dialogs.exportComponent = this._createExportComponentDialog();
            document.body.appendChild(this.dialogs.exportComponent);
        }

        // Populate the list
        const list = document.getElementById('exportComponentList');
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
                DialogFactory.hideDialog(this.dialogs.exportComponent);
                await this.callbacks.onDownloadComponent(name);
            });

            list.appendChild(item);
        });

        // Show dialog
        DialogFactory.showDialog(this.dialogs.exportComponent);
    }

    // ==================== Help Dialog ====================

    /**
     * Create help dialog programmatically
     * @returns {HTMLElement} Help dialog element
     */
    _createHelpDialog() {
        const content = `
            <section>
                <h4>🎯 Getting Started</h4>
                <ul>
                    <li><strong>Select a component:</strong> Click any gate or I/O button in the left panel</li>
                    <li><strong>Place on canvas:</strong> Click on the circuit board to place the selected component</li>
                    <li><strong>Exit mode:</strong> Press <kbd>ESC</kbd> or <kbd>Right-click</kbd>, or click the same button again</li>
                </ul>
            </section>

            <section>
                <h4>🔌 Building Circuits</h4>
                <ul>
                    <li><strong>Add INPUT:</strong> Select INPUT and place on canvas - click to toggle 0/1 values</li>
                    <li><strong>Add OUTPUT:</strong> Select OUTPUT and place on canvas - displays circuit results</li>
                    <li><strong>Connect components:</strong> Click "Connect" button, then click source output port, then target input port</li>
                    <li><strong>Simulate:</strong> Click "Simulate" to see circuit output with current input values</li>
                </ul>
            </section>

            <section>
                <h4>✏️ Editing</h4>
                <ul>
                    <li><strong>Move:</strong> Click and drag any component to reposition it</li>
                    <li><strong>Delete:</strong> Click "Delete" button, then click component or connection to remove</li>
                    <li><strong>Rename:</strong> Double-click an INPUT or OUTPUT to change its label</li>
                </ul>
            </section>

            <section>
                <h4>💾 Saving & Loading</h4>
                <ul>
                    <li><strong>New Board:</strong> Creates a blank work-in-progress board</li>
                    <li><strong>Save Board:</strong> Saves current circuit as a reusable board</li>
                    <li><strong>Load Board:</strong> Opens a previously saved board for editing</li>
                    <li><strong>Save as Component:</strong> Converts circuit into a reusable component (INPUTs become input ports, OUTPUTs become output ports)</li>
                </ul>
            </section>

            <section>
                <h4>📊 Truth Table</h4>
                <ul>
                    <li><strong>Generate:</strong> Click "Truth Table" to see all input/output combinations</li>
                    <li><strong>Active row highlighting:</strong> The row matching current input values is highlighted</li>
                    <li><strong>Reposition:</strong> Drag the title bar to move the table</li>
                    <li><strong>Resize:</strong> Drag corner handles to resize</li>
                    <li><strong>Reorder columns:</strong> Drag column headers to rearrange (Inputs stay in Input section, Outputs stay in Output section)</li>
                    <li><strong>Persistence:</strong> Table position, size, and column order are saved with your board/component</li>
                </ul>
            </section>

            <section>
                <h4>🎨 Theme & Display</h4>
                <ul>
                    <li><strong>Dark mode:</strong> Click the 🌙 button to toggle light/dark theme</li>
                    <li><strong>Smart positioning:</strong> Truth Table automatically positions to avoid overlapping your circuit</li>
                </ul>
            </section>

            <section>
                <h4>⌨️ Keyboard Shortcuts</h4>
                <ul>
                    <li><kbd>ESC</kbd> or <kbd>Right-click</kbd> - Exit current mode</li>
                    <li><kbd>?</kbd> - Open this Help dialog</li>
                </ul>
            </section>

            <section>
                <h4>💡 Tips</h4>
                <ul>
                    <li>Build complex circuits by saving them as components, then use those components in larger designs</li>
                    <li>Label your inputs and outputs clearly for better readability</li>
                    <li>Use the Truth Table to verify circuit logic before saving</li>
                    <li>Export components to share with others or backup your work</li>
                </ul>
            </section>
        `;

        const dialog = DialogFactory.createDialog({
            id: 'helpDialog',
            title: '📖 Help & Instructions',
            size: 'large',
            content: content,
            closeButtonId: 'closeHelp'
        });

        // Add help-content class to the dialog content
        const dialogContent = dialog.querySelector('.dialog-content');
        if (dialogContent) {
            dialogContent.classList.add('help-content');
        }

        return dialog;
    }

    /**
     * Show help dialog
     */
    showHelpDialog() {
        // Lazy create dialog
        if (!this.dialogs.help) {
            this.dialogs.help = this._createHelpDialog();
            document.body.appendChild(this.dialogs.help);
        }

        DialogFactory.showDialog(this.dialogs.help);
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
