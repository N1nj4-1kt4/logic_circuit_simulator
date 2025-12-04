/**
 * Custom error classes for circuit operations
 *
 * These errors allow business logic (core/) and storage layers to report errors
 * without importing UI components. The coordinator (circuit-simulator.js) catches
 * these errors and displays appropriate dialogs.
 */

/**
 * Base error for circuit operations
 */
export class CircuitError extends Error {
    constructor(message, type = 'error') {
        super(message);
        this.name = 'CircuitError';
        this.type = type; // 'error', 'warning', 'info', 'success'
    }
}

/**
 * Validation error for circuit operations
 */
export class ValidationError extends CircuitError {
    constructor(message) {
        super(message, 'warning');
        this.name = 'ValidationError';
    }
}

/**
 * No inputs error for simulation
 */
export class NoInputsError extends ValidationError {
    constructor() {
        super('Circuit has no INPUT components to simulate');
        this.name = 'NoInputsError';
    }
}

/**
 * No outputs error for simulation
 */
export class NoOutputsError extends ValidationError {
    constructor() {
        super('Circuit has no OUTPUT components');
        this.name = 'NoOutputsError';
    }
}

/**
 * Empty circuit error
 */
export class EmptyCircuitError extends ValidationError {
    constructor() {
        super('Circuit is empty');
        this.name = 'EmptyCircuitError';
    }
}

/**
 * Board name required error
 */
export class BoardNameRequiredError extends ValidationError {
    constructor() {
        super('Board name is required');
        this.name = 'BoardNameRequiredError';
    }
}

/**
 * Component not found error
 */
export class ComponentNotFoundError extends CircuitError {
    constructor(name) {
        super(`Component "${name}" not found`);
        this.name = 'ComponentNotFoundError';
        this.componentName = name;
    }
}

/**
 * Component save error
 */
export class ComponentSaveError extends CircuitError {
    constructor(message) {
        super(message, 'error');
        this.name = 'ComponentSaveError';
    }
}

/**
 * Board save error
 */
export class BoardSaveError extends CircuitError {
    constructor(message) {
        super(message, 'error');
        this.name = 'BoardSaveError';
    }
}

/**
 * Board load error
 */
export class BoardLoadError extends CircuitError {
    constructor(boardName) {
        super(`Failed to load board "${boardName}"`);
        this.name = 'BoardLoadError';
        this.boardName = boardName;
    }
}

/**
 * Import/export error
 */
export class ImportExportError extends CircuitError {
    constructor(message, type = 'error') {
        super(message, type);
        this.name = 'ImportExportError';
    }
}

/**
 * Invalid component file error
 */
export class InvalidComponentFileError extends ImportExportError {
    constructor() {
        super('Invalid component file format');
        this.name = 'InvalidComponentFileError';
    }
}

/**
 * Component exists error (for import conflicts)
 */
export class ComponentExistsError extends CircuitError {
    constructor(name) {
        super(`Component "${name}" already exists`);
        this.name = 'ComponentExistsError';
        this.componentName = name;
    }
}
