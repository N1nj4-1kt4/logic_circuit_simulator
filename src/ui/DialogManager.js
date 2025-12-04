/**
 * DialogManager - Manages all dialog interactions
 * Handles component dialogs, rename dialogs, and board save dialogs
 */

import { DialogFactory } from './DialogFactory.js';
import { messages, formatMessage } from './messages.js';

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
        const msg = messages.dialogs.saveComponent;
        const content = DialogFactory.createFormContent({
            fields: [
                {
                    id: 'componentName',
                    label: msg.nameLabel,
                    type: 'text',
                    placeholder: msg.namePlaceholder
                },
                {
                    id: 'componentDescription',
                    label: msg.descriptionLabel,
                    type: 'textarea',
                    rows: 3,
                    placeholder: msg.descriptionPlaceholder
                }
            ],
            infoBox: msg.infoBox,
            buttons: [
                {
                    id: 'confirmSave',
                    label: msg.confirmButton,
                    className: 'action-btn primary-btn',
                    onClick: async () => await this.saveCurrentCircuitAsComponent()
                },
                {
                    id: 'cancelSave',
                    label: msg.cancelButton,
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.saveComponent)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'saveComponentDialog',
            title: msg.title,
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
            DialogFactory.showAlert({
                message: messages.alerts.emptyCircuit,
                type: 'warning'
            });
            return;
        }

        const inputs = circuitData.components.filter(c => c.type === 'INPUT');
        const outputs = circuitData.components.filter(c => c.type === 'OUTPUT');

        if (inputs.length === 0 || outputs.length === 0) {
            DialogFactory.showAlert({
                message: messages.alerts.missingInputsOutputs,
                type: 'warning'
            });
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
            DialogFactory.showAlert({
                message: messages.alerts.componentNameRequired,
                type: 'warning'
            });
            return;
        }

        // Check if name already exists
        const componentLibrary = this.callbacks.getComponentLibrary();
        const exists = await componentLibrary.componentExists(name);
        if (exists) {
            const confirmConfig = messages.confirms.overwriteComponent;
            DialogFactory.showConfirm({
                message: formatMessage(confirmConfig.message, name),
                title: confirmConfig.title,
                confirmLabel: confirmConfig.confirmLabel,
                cancelLabel: confirmConfig.cancelLabel,
                onConfirm: async () => {
                    // Callback to save component
                    await this.callbacks.onSaveComponent(name, description);
                    // Close dialog
                    DialogFactory.hideDialog(this.dialogs.saveComponent);
                }
            });
            return;
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
        const msg = messages.dialogs.exportComponent;
        const container = document.createElement('div');

        const p = document.createElement('p');
        p.textContent = msg.description;
        container.appendChild(p);

        const list = document.createElement('div');
        list.id = 'exportComponentList';
        list.className = 'export-component-list';
        container.appendChild(list);

        return DialogFactory.createDialog({
            id: 'exportComponentDialog',
            title: msg.title,
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
        const msg = messages.dialogs.manageComponents;
        const container = document.createElement('div');

        const p = document.createElement('p');
        p.textContent = msg.description;
        container.appendChild(p);

        const list = document.createElement('div');
        list.id = 'componentLibraryList';
        container.appendChild(list);

        return DialogFactory.createDialog({
            id: 'manageComponentsDialog',
            title: msg.title,
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
            const msg = messages.dialogs.manageComponents;
            list.innerHTML = `
                <div class="empty-library">
                    <div class="empty-library-icon">${msg.emptyIcon}</div>
                    <p>${msg.emptyMessage}</p>
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
                    ${component.inputPorts?.length || 0} input(s), ${component.outputPorts?.length || 0} output(s) • Created: ${date}
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
                // Close the manage components dialog after loading
                DialogFactory.hideDialog(this.dialogs.manageComponents);
            });

            // Add export handler
            item.querySelector('.export-btn').addEventListener('click', async () => {
                await this.callbacks.onDownloadComponent(name);
            });

            // Add delete handler
            item.querySelector('.delete-btn').addEventListener('click', () => {
                DialogFactory.showConfirm({
                    message: `Delete component "${name}"?`,
                    type: 'warning',
                    onConfirm: async () => {
                        await this.callbacks.onDeleteComponent(name);
                        this.updateComponentLibraryList();
                    }
                });
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
        const msg = messages.dialogs.rename;
        const content = DialogFactory.createFormContent({
            fields: [{
                id: 'newComponentLabel',
                label: msg.label,
                type: 'text',
                placeholder: msg.placeholder
            }],
            buttons: [
                {
                    id: 'confirmRename',
                    label: msg.confirmButton,
                    className: 'action-btn primary-btn',
                    onClick: () => this.confirmRename()
                },
                {
                    id: 'cancelRename',
                    label: msg.cancelButton,
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.rename)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'renameDialog',
            title: msg.title,
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
            DialogFactory.showAlert({
                message: messages.alerts.labelRequired,
                type: 'warning'
            });
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
        p.textContent = messages.dialogs.saveOptions.description;
        container.appendChild(p);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'save-options';

        // Create 4 option buttons
        const opts = messages.dialogs.saveOptions;
        const options = [
            {
                id: 'saveAsCurrentBoard',
                title: opts.updateCurrentBoard.title,
                desc: opts.updateCurrentBoard.desc,
                class: ''
            },
            {
                id: 'saveAsNewBoard',
                title: opts.saveAsNewBoard.title,
                desc: opts.saveAsNewBoard.desc,
                class: ''
            },
            {
                id: 'saveAsNewComponent',
                title: opts.saveAsComponent.title,
                desc: opts.saveAsComponent.desc,
                class: ''
            },
            {
                id: 'discardChanges',
                title: opts.discardChanges.title,
                desc: opts.discardChanges.desc,
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
            title: messages.dialogs.saveOptions.title,
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
        const msg = messages.dialogs.boardName;
        const content = DialogFactory.createFormContent({
            fields: [{
                id: 'boardNameInput',
                label: msg.label,
                type: 'text',
                placeholder: msg.placeholder
            }],
            buttons: [
                {
                    id: 'confirmBoardName',
                    label: msg.confirmButton,
                    className: 'action-btn primary-btn',
                    onClick: () => {} // Will be set dynamically in promptForBoardName
                },
                {
                    id: 'cancelBoardName',
                    label: msg.cancelButton,
                    className: 'action-btn',
                    onClick: () => DialogFactory.hideDialog(this.dialogs.boardName)
                }
            ]
        });

        return DialogFactory.createDialog({
            id: 'boardNameDialog',
            title: msg.title,
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
            saveAsCurrentBoardBtn.classList.remove('hidden');
            currentBoardNameSpan.textContent = currentBoardName;
        } else {
            saveAsCurrentBoardBtn.classList.add('hidden');
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
            console.log('💾 Update Current Board clicked');
            const currentBoardName = this.callbacks.getCurrentBoardName();
            console.log('Current board name:', currentBoardName);
            if (currentBoardName) {
                try {
                    console.log('Attempting to save current board:', currentBoardName);
                    await this.callbacks.onSaveCurrentBoard(currentBoardName);
                    console.log('Save completed successfully');
                    this.hideSaveOptionsDialog();
                    if (this.state.pendingActionAfterSave) {
                        this.state.pendingActionAfterSave();
                        this.state.pendingActionAfterSave = null;
                    }
                } catch (error) {
                    console.error('Error saving current board:', error);
                    const errorMessage = error.message || 'Unknown error occurred';
                    DialogFactory.showAlert({
                        message: `Failed to save board: ${errorMessage}`,
                        type: 'error'
                    });
                }
            } else {
                console.warn('No current board name to save to');
                this.hideSaveOptionsDialog();
            }
        });

        saveAsNewBoard?.addEventListener('click', () => {
            this.hideSaveOptionsDialog();
            // Pass the next board name as the default for "Save as New Board"
            this.promptForBoardName(this.getNextBoardName(), async (boardName) => {
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
                DialogFactory.showAlert({
                    message: messages.alerts.boardNameRequired,
                    type: 'warning'
                });
                return;
            }

            const customComponents = this.callbacks.getCustomComponents();
            if (customComponents[boardName]) {
                DialogFactory.showAlert({
                    message: formatMessage(messages.alerts.componentNameConflict, boardName),
                    type: 'error'
                });
                return;
            }

            const savedBoards = this.callbacks.getSavedBoards();
            const currentBoardName = this.callbacks.getCurrentBoardName();
            if (savedBoards[boardName] && boardName !== currentBoardName) {
                const confirmConfig = messages.confirms.overwriteBoard;
                DialogFactory.showConfirm({
                    message: formatMessage(confirmConfig.message, boardName),
                    title: confirmConfig.title,
                    confirmLabel: confirmConfig.confirmLabel,
                    cancelLabel: confirmConfig.cancelLabel,
                    onConfirm: () => {
                        DialogFactory.hideDialog(this.dialogs.boardName);
                        onSave(boardName);
                    }
                });
                return;
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
            DialogFactory.showAlert({
                message: messages.alerts.noComponentsToExport,
                type: 'info'
            });
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
            infoDiv.textContent = `${component.inputPorts?.length || 0} inputs, ${component.outputPorts?.length || 0} outputs`;

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
                    <li><strong>Select a component:</strong> Click any gate or I/O button in the left toolbar</li>
                    <li><strong>Place on canvas:</strong> Click on the breadboard to place the component</li>
                    <li><strong>Exit mode:</strong> Press <kbd>ESC</kbd>, <kbd>Right-click</kbd>, or click the same button again</li>
                    <li><strong>Grid alignment:</strong> Components snap to a 50px grid for clean alignment</li>
                </ul>
            </section>

            <section>
                <h4>🔌 Building Circuits</h4>
                <h5>Adding Inputs and Outputs</h5>
                <ul>
                    <li><strong>INPUT:</strong> Place on canvas, click to toggle between 0 (red) and 1 (green)</li>
                    <li><strong>OUTPUT:</strong> Place on canvas, displays circuit results automatically</li>
                    <li><strong>Rename:</strong> Double-click any INPUT/OUTPUT to give it a meaningful label (e.g., "A", "Sum", "CarryOut")</li>
                </ul>
                <h5>Connecting Components</h5>
                <ul>
                    <li>Click "Connect" button to enter connection mode</li>
                    <li>Click source component's <strong>output port</strong> (green dot)</li>
                    <li>Click target component's <strong>input port</strong> (blue dot)</li>
                    <li>Connection lines show signal values: <span style="color: green;">green=1</span>, <span style="color: red;">red=0</span>, <span style="color: gray;">gray=undefined</span></li>
                </ul>
                <h5>Port Locations</h5>
                <ul>
                    <li><strong>Inputs:</strong> One output port on the right</li>
                    <li><strong>Outputs:</strong> One input port on the left</li>
                    <li><strong>NOT Gate:</strong> One input (left), one output (right)</li>
                    <li><strong>Two-input Gates:</strong> Two inputs (left top/bottom), one output (right)</li>
                    <li><strong>Custom Components:</strong> Labeled ports showing signal names</li>
                </ul>
            </section>

            <section>
                <h4>⚡ Simulation</h4>
                <h5>Auto-Cycle Simulation</h5>
                <ul>
                    <li>Click "Simulate" to automatically cycle through all input combinations</li>
                    <li>Combination counter shows progress (e.g., "3 / 8")</li>
                    <li>Connections change color to show signal propagation</li>
                    <li>Click "Stop Simulation" to stop</li>
                </ul>
                <h5>Manual Simulation Controls</h5>
                <ul>
                    <li><strong>Next ▶:</strong> Step to next input combination</li>
                    <li><strong>◀ Previous:</strong> Step to previous combination</li>
                    <li><strong>Reset:</strong> Reset all inputs to 0</li>
                    <li>Perfect for debugging specific patterns at your own pace</li>
                </ul>
            </section>

            <section>
                <h4>✏️ Editing & Organizing</h4>
                <ul>
                    <li><strong>Move:</strong> Click and drag any component to reposition</li>
                    <li><strong>Delete Mode:</strong> Click "Delete" button, then click components or connections to remove</li>
                    <li><strong>Rename:</strong> Double-click INPUT/OUTPUT for meaningful labels</li>
                    <li><strong>Clear Board:</strong> Remove all components and connections</li>
                </ul>
            </section>

            <section>
                <h4>💾 Board Management</h4>
                <h5>Boards vs Components</h5>
                <ul>
                    <li><strong>Board:</strong> Work-in-progress circuit (like a scratch pad)</li>
                    <li><strong>Component:</strong> Finalized, reusable circuit building block</li>
                </ul>
                <h5>Workflow</h5>
                <ul>
                    <li><strong>New Board:</strong> Start fresh blank canvas</li>
                    <li><strong>Save Board:</strong> Save current work-in-progress</li>
                    <li><strong>Load Board:</strong> Resume work on previously saved board</li>
                    <li><strong>Save as Component:</strong> Finalize circuit as reusable component</li>
                </ul>
                <h5>Smart Save Options</h5>
                <p>When making changes, an intelligent save prompt offers: Update existing board, Save as new board, Save as component, or Discard changes.</p>
            </section>

            <section>
                <h4>🔧 Custom Components</h4>
                <h5>Creating Components</h5>
                <ul>
                    <li>Build and test a circuit with INPUTs and OUTPUTs</li>
                    <li>Click "Save as Component" and enter name/description</li>
                    <li>All INPUTs become input ports, OUTPUTs become output ports</li>
                    <li>Component appears in Custom Components section</li>
                </ul>
                <h5>Using Components</h5>
                <ul>
                    <li>Select your custom component from toolbar and place like any gate</li>
                    <li>Port labels show signal names (from INPUT/OUTPUT labels)</li>
                    <li>Connect and simulate normally</li>
                    <li>Multi-output components fully supported</li>
                </ul>
                <h5>Managing Library</h5>
                <ul>
                    <li><strong>Manage Library:</strong> View all saved components</li>
                    <li><strong>Edit:</strong> Load component for modifications</li>
                    <li><strong>Export:</strong> Download as .json file for backup/sharing</li>
                    <li><strong>Import:</strong> Load .json files from others</li>
                    <li><strong>Delete:</strong> Remove unused components</li>
                </ul>
            </section>

            <section>
                <h4>📊 Truth Table</h4>
                <h5>Basic Usage</h5>
                <ul>
                    <li>Build a circuit with inputs and outputs</li>
                    <li>Click "Truth Table" button to generate</li>
                    <li>Table shows all input/output combinations</li>
                </ul>
                <h5>Advanced Features</h5>
                <ul>
                    <li><strong>Active Row Highlighting:</strong> Current input combination highlighted in real-time</li>
                    <li><strong>Drag to Reposition:</strong> Drag title bar to move table anywhere</li>
                    <li><strong>Resize:</strong> Drag corner handles to resize the table</li>
                    <li><strong>Reorder Columns:</strong> Drag column headers to rearrange (Inputs stay in Input section, Outputs stay in Output section)</li>
                    <li><strong>Smart Positioning:</strong> Table automatically avoids overlapping your circuit</li>
                    <li><strong>State Persistence:</strong> Position, size, and column order saved with board/component</li>
                </ul>
            </section>

            <section>
                <h4>🎛️ Logic Gates Reference</h4>
                <table class="gates-table">
                    <tr><th>Gate</th><th>Function</th><th>Description</th></tr>
                    <tr><td>AND</td><td>A ∧ B</td><td>Output is 1 only if both inputs are 1</td></tr>
                    <tr><td>OR</td><td>A ∨ B</td><td>Output is 1 if at least one input is 1</td></tr>
                    <tr><td>NOT</td><td>¬A</td><td>Output is the inverse of the input</td></tr>
                    <tr><td>XOR</td><td>A ⊕ B</td><td>Output is 1 if inputs are different</td></tr>
                    <tr><td>NAND</td><td>¬(A ∧ B)</td><td>Output is 0 only if both inputs are 1</td></tr>
                    <tr><td>NOR</td><td>¬(A ∨ B)</td><td>Output is 0 if at least one input is 1</td></tr>
                    <tr><td>XNOR</td><td>¬(A ⊕ B)</td><td>Output is 1 if inputs are the same</td></tr>
                </table>
            </section>

            <section>
                <h4>🎨 Theme & Display</h4>
                <ul>
                    <li><strong>Dark Mode:</strong> Click the 🌙 button to toggle light/dark theme</li>
                    <li><strong>Maximized Canvas:</strong> Optimized layout for maximum work space</li>
                    <li><strong>Auto-save:</strong> Your work is automatically saved as you make changes</li>
                </ul>
            </section>

            <section>
                <h4>⌨️ Keyboard Shortcuts</h4>
                <table class="shortcuts-table">
                    <tr><td><kbd>ESC</kbd></td><td>Exit current mode, return to neutral</td></tr>
                    <tr><td><kbd>Right-click</kbd></td><td>Exit current mode (alternative to ESC)</td></tr>
                    <tr><td><kbd>?</kbd></td><td>Open this Help dialog</td></tr>
                </table>
            </section>

            <section>
                <h4>💡 Tips & Best Practices</h4>
                <h5>Circuit Design</h5>
                <ul>
                    <li>Label your inputs/outputs clearly for readability</li>
                    <li>Build and test small circuits before combining</li>
                    <li>Use Truth Table to verify logic before saving</li>
                    <li>Save circuits as components for reuse</li>
                </ul>
                <h5>Organization</h5>
                <ul>
                    <li>Use meaningful component names (e.g., "HalfAdder", "FullAdder")</li>
                    <li>Add descriptions when saving components</li>
                    <li>Export important components for backup</li>
                </ul>
                <h5>Hierarchical Design</h5>
                <p>Build complex systems from tested building blocks:</p>
                <ol>
                    <li>Create <strong>HalfAdder</strong> (XOR + AND gates)</li>
                    <li>Build <strong>FullAdder</strong> using 2 HalfAdders</li>
                    <li>Create <strong>4-bit Adder</strong> using 4 FullAdders</li>
                    <li>Design complete ALU using adder components!</li>
                </ol>
            </section>
        `;

        const dialog = DialogFactory.createDialog({
            id: 'helpDialog',
            title: messages.dialogs.help.title,
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
