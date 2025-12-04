/**
 * DialogFactory - Creates dialog elements programmatically
 *
 * This class provides a single source of truth for all dialog structure.
 * Change dialog design (e.g., close button) in ONE place, affects ALL dialogs.
 *
 * Benefits:
 * - No HTML duplication
 * - Consistent dialog structure
 * - Easy to maintain and extend
 * - Support for various dialog types (forms, lists, custom layouts)
 */

import { TIMING, UI } from '../constants.js';

export class DialogFactory {
    /**
     * Create a dialog element programmatically
     * @param {Object} config - Dialog configuration
     * @param {string} config.id - Dialog DOM ID
     * @param {string} config.title - Dialog title
     * @param {string} config.size - 'small' (350px) | 'default' (500px) | 'large' (700px)
     * @param {HTMLElement|string} config.content - Dialog content (Element or HTML string)
     * @param {string} config.closeButtonId - Close button ID
     * @param {Function} config.onClose - Close callback (optional)
     * @param {boolean} config.showCloseButton - Show × button (default: true)
     * @param {boolean} config.backdrop - Show modal backdrop (default: false)
     * @returns {HTMLElement} Dialog element ready to append to DOM
     */
    static createDialog(config) {
        const dialog = document.createElement('div');
        dialog.id = config.id;
        dialog.className = `dialog-panel ${this._getSizeClass(config.size)}`;
        dialog.style.display = 'none';

        // Add backdrop if requested
        if (config.backdrop) {
            dialog.setAttribute('data-backdrop', 'true');
        }

        // Create header with close button
        const header = this._createHeader(
            config.title,
            config.closeButtonId,
            config.showCloseButton ?? true,
            config.onClose,
            dialog
        );
        dialog.appendChild(header);

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'dialog-content';

        if (typeof config.content === 'string') {
            contentContainer.innerHTML = config.content;
        } else if (config.content instanceof HTMLElement) {
            contentContainer.appendChild(config.content);
        }

        dialog.appendChild(contentContainer);
        return dialog;
    }

    /**
     * Create header with title and close button
     * THIS IS WHERE YOU CHANGE "×" ONCE FOR ALL DIALOGS!
     *
     * @param {string} title - Dialog title
     * @param {string} closeButtonId - Close button ID
     * @param {boolean} showCloseButton - Show close button
     * @param {Function} onClose - Close callback
     * @param {HTMLElement} dialog - Parent dialog element
     * @returns {HTMLElement} Header element
     */
    static _createHeader(title, closeButtonId, showCloseButton, onClose, dialog) {
        const header = document.createElement('div');
        header.className = 'panel-header';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        header.appendChild(h3);

        if (showCloseButton) {
            const closeBtn = document.createElement('button');
            closeBtn.id = closeButtonId;
            closeBtn.className = 'dialog-close-btn';
            closeBtn.title = 'Close';
            closeBtn.textContent = UI.ICONS.CLOSE;  // ← CHANGE HERE, AFFECTS ALL DIALOGS!

            closeBtn.addEventListener('click', () => {
                this.hideDialog(dialog);
                if (onClose) onClose();
            });

            header.appendChild(closeBtn);
        }

        return header;
    }

    /**
     * Get CSS class for dialog size
     * @param {string} size - 'small' | 'default' | 'large'
     * @returns {string} CSS class name
     */
    static _getSizeClass(size) {
        const sizeMap = {
            small: 'small-dialog',    // 350px
            default: '',              // 500px (base class)
            large: 'help-dialog'      // 700px
        };
        return sizeMap[size] || '';
    }

    /**
     * Show a dialog
     * @param {HTMLElement} dialog - Dialog element
     * @param {boolean} animate - Animate the dialog (default: true)
     */
    static showDialog(dialog, animate = true) {
        if (!dialog) return;

        // Show backdrop if configured
        if (dialog.getAttribute('data-backdrop') === 'true') {
            this._showBackdrop(dialog);
        }

        // Show dialog
        if (animate) {
            dialog.style.opacity = '0';
            dialog.style.display = 'block';

            // Fade in animation
            requestAnimationFrame(() => {
                dialog.style.transition = `opacity ${TIMING.DIALOG_FADE_IN}ms ease`;
                dialog.style.opacity = '1';
            });
        } else {
            dialog.style.display = 'block';
        }
    }

    /**
     * Hide a dialog
     * @param {HTMLElement} dialog - Dialog element
     * @param {boolean} animate - Animate the dialog (default: true)
     */
    static hideDialog(dialog, animate = true) {
        if (!dialog) return;

        // Hide backdrop if exists
        if (dialog.getAttribute('data-backdrop') === 'true') {
            this._hideBackdrop(dialog);
        }

        // Hide dialog
        if (animate) {
            dialog.style.transition = `opacity ${TIMING.DIALOG_FADE_OUT}ms ease`;
            dialog.style.opacity = '0';

            setTimeout(() => {
                dialog.style.display = 'none';
                dialog.style.opacity = '';
            }, TIMING.DIALOG_FADE_OUT);
        } else {
            dialog.style.display = 'none';
        }
    }

    /**
     * Show modal backdrop
     * @param {HTMLElement} dialog - Dialog element
     */
    static _showBackdrop(dialog) {
        // Check if backdrop already exists
        let backdrop = document.querySelector('.dialog-backdrop');

        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'dialog-backdrop';

            // Click backdrop to close
            backdrop.addEventListener('click', () => {
                this.hideDialog(dialog);
            });

            document.body.appendChild(backdrop);
        }

        // Fade in
        requestAnimationFrame(() => {
            backdrop.style.opacity = '1';
        });
    }

    /**
     * Hide modal backdrop
     */
    static _hideBackdrop() {
        const backdrop = document.querySelector('.dialog-backdrop');
        if (backdrop) {
            backdrop.style.opacity = '0';
            setTimeout(() => {
                backdrop.remove();
            }, TIMING.DIALOG_FADE_OUT);
        }
    }

    /**
     * Helper: Create form content with fields and buttons
     *
     * @param {Object} config - Form configuration
     * @param {string} config.description - Description text (optional)
     * @param {Array} config.fields - Form fields
     * @param {string} config.infoBox - Info box HTML (optional)
     * @param {Array} config.buttons - Action buttons
     * @returns {HTMLElement} Form content container
     */
    static createFormContent(config) {
        const container = document.createElement('div');

        // Description text
        if (config.description) {
            const p = document.createElement('p');
            p.textContent = config.description;
            container.appendChild(p);
        }

        // Form fields
        if (config.fields && config.fields.length > 0) {
            config.fields.forEach(field => {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';

                // Label
                const label = document.createElement('label');
                label.setAttribute('for', field.id);
                label.textContent = field.label;
                formGroup.appendChild(label);

                // Input/Textarea
                let input;
                if (field.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.rows = field.rows || 3;
                } else {
                    input = document.createElement('input');
                    input.type = field.type || 'text';
                }
                input.id = field.id;
                input.placeholder = field.placeholder || '';
                if (field.value !== undefined) input.value = field.value;

                formGroup.appendChild(input);
                container.appendChild(formGroup);
            });
        }

        // Info box
        if (config.infoBox) {
            const infoBox = document.createElement('div');
            infoBox.className = 'info-box';
            infoBox.innerHTML = config.infoBox;
            container.appendChild(infoBox);
        }

        // Action buttons
        if (config.buttons && config.buttons.length > 0) {
            container.appendChild(this.createActionButtons(config.buttons));
        }

        return container;
    }

    /**
     * Helper: Create action buttons
     *
     * @param {Array} buttons - Button configurations
     * @returns {HTMLElement} Action buttons container
     */
    static createActionButtons(buttons) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'dialog-actions';

        buttons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.className = btnConfig.className || 'action-btn';
            btn.id = btnConfig.id;
            btn.textContent = btnConfig.label;

            if (btnConfig.onClick) {
                btn.addEventListener('click', btnConfig.onClick);
            }

            actionsDiv.appendChild(btn);
        });

        return actionsDiv;
    }

    /**
     * Helper: Create list container for dynamic lists
     *
     * @param {string} listId - List container ID
     * @param {string} emptyMessage - Message when list is empty (optional)
     * @returns {HTMLElement} List container
     */
    static createListContainer(listId, emptyMessage) {
        const container = document.createElement('div');
        container.id = listId;

        if (emptyMessage) {
            container.setAttribute('data-empty-message', emptyMessage);
        }

        return container;
    }

    /**
     * Show alert dialog - Replaces browser alert() with styled dialog
     * @param {Object} config - Alert configuration
     * @param {string} config.message - Alert message
     * @param {string} config.type - 'success' | 'error' | 'warning' | 'info' (default: 'info')
     * @param {string} config.title - Optional title (auto-generated if not provided)
     * @param {Function} config.onClose - Optional callback when alert is dismissed
     */
    static showAlert(config) {
        const type = config.type || 'info';

        // Auto-generate title if not provided (no icons in title text)
        const titleMap = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        const title = config.title || titleMap[type];

        // Create alert content (just message, no icon)
        const content = document.createElement('div');
        content.className = 'alert-content';

        // Message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'alert-message';
        messageContainer.textContent = config.message;

        content.appendChild(messageContainer);

        // OK button
        const okButton = {
            id: 'alertOkBtn',
            label: 'OK',
            className: 'primary-btn',
            onClick: () => {
                this.hideDialog(alertDialog);
                if (config.onClose) config.onClose();
            }
        };

        const buttonsContainer = this.createActionButtons([okButton]);

        const container = document.createElement('div');
        container.appendChild(content);
        container.appendChild(buttonsContainer);

        // Create dialog
        const alertDialog = this.createDialog({
            id: `alertDialog_${Date.now()}`,
            title: title,
            size: 'small',
            content: container,
            closeButtonId: `closeAlert_${Date.now()}`,
            showCloseButton: true,
            backdrop: true,
            onClose: config.onClose
        });

        // Apply alert-specific class for styling
        alertDialog.classList.add('alert-dialog', `alert-${type}`);

        // Add icon to header via data attribute
        const iconMap = {
            success: UI.ICONS.CHECK,
            error: UI.ICONS.CROSS,
            warning: UI.ICONS.WARNING,
            info: UI.ICONS.INFO
        };
        const header = alertDialog.querySelector('.panel-header');
        if (header && iconMap[type]) {
            header.setAttribute('data-icon', iconMap[type]);
        }

        // Auto-remove dialog from DOM after it's hidden
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (alertDialog.style.display === 'none') {
                        setTimeout(() => {
                            alertDialog.remove();
                            observer.disconnect();
                        }, TIMING.DIALOG_CLEANUP_DELAY);
                    }
                }
            });
        });
        observer.observe(alertDialog, { attributes: true });

        // Add to DOM and show
        document.body.appendChild(alertDialog);
        this.showDialog(alertDialog);

        // Auto-focus OK button for keyboard accessibility
        setTimeout(() => {
            const okBtn = alertDialog.querySelector('#alertOkBtn');
            if (okBtn) okBtn.focus();
        }, TIMING.FOCUS_DELAY);

        return alertDialog;
    }

    /**
     * Show confirm dialog - Replaces browser confirm() with styled dialog
     * @param {Object} config - Confirm configuration
     * @param {string} config.message - Confirm message
     * @param {string} config.title - Optional title (default: 'Confirm')
     * @param {Function} config.onConfirm - Callback when user clicks Yes/OK
     * @param {Function} config.onCancel - Optional callback when user clicks No/Cancel
     * @param {string} config.confirmLabel - Label for confirm button (default: 'Yes')
     * @param {string} config.cancelLabel - Label for cancel button (default: 'No')
     * @param {string} config.type - 'warning' | 'info' (default: 'warning')
     */
    static showConfirm(config) {
        const type = config.type || 'warning';
        const title = config.title || 'Confirm';

        // Create confirm content (just message, no icon)
        const content = document.createElement('div');
        content.className = 'confirm-content';

        // Message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'confirm-message';
        messageContainer.textContent = config.message;

        content.appendChild(messageContainer);

        // Buttons
        const confirmButton = {
            id: 'confirmYesBtn',
            label: config.confirmLabel || 'Yes',
            className: 'primary-btn',
            onClick: () => {
                this.hideDialog(confirmDialog);
                if (config.onConfirm) config.onConfirm();
            }
        };

        const cancelButton = {
            id: 'confirmNoBtn',
            label: config.cancelLabel || 'No',
            className: 'secondary-btn',
            onClick: () => {
                this.hideDialog(confirmDialog);
                if (config.onCancel) config.onCancel();
            }
        };

        const buttonsContainer = this.createActionButtons([cancelButton, confirmButton]);

        const container = document.createElement('div');
        container.appendChild(content);
        container.appendChild(buttonsContainer);

        // Create dialog
        const confirmDialog = this.createDialog({
            id: `confirmDialog_${Date.now()}`,
            title: title,
            size: 'small',
            content: container,
            closeButtonId: `closeConfirm_${Date.now()}`,
            showCloseButton: true,
            backdrop: true,
            onClose: config.onCancel
        });

        // Apply confirm-specific class for styling
        confirmDialog.classList.add('confirm-dialog', `confirm-${type}`);

        // Add icon to header via data attribute
        const iconMap = {
            warning: UI.ICONS.WARNING,
            info: UI.ICONS.INFO
        };
        const header = confirmDialog.querySelector('.panel-header');
        if (header && iconMap[type]) {
            header.setAttribute('data-icon', iconMap[type]);
        }

        // Auto-remove dialog from DOM after it's hidden
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (confirmDialog.style.display === 'none') {
                        setTimeout(() => {
                            confirmDialog.remove();
                            observer.disconnect();
                        }, TIMING.DIALOG_CLEANUP_DELAY);
                    }
                }
            });
        });
        observer.observe(confirmDialog, { attributes: true });

        // Add to DOM and show
        document.body.appendChild(confirmDialog);
        this.showDialog(confirmDialog);

        // Auto-focus No button for safety (prevents accidental confirms)
        setTimeout(() => {
            const noBtn = confirmDialog.querySelector('#confirmNoBtn');
            if (noBtn) noBtn.focus();
        }, TIMING.FOCUS_DELAY);

        return confirmDialog;
    }
}
