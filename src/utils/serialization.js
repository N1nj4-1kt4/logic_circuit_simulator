/**
 * Serialization utilities for export/import functionality
 * Pure functions for data transformation and file operations
 */

/**
 * Deep clone an object using JSON serialization
 * @param {*} obj - Object to clone
 * @returns {*} Deep cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Export data to a JSON file download
 * @param {Object} data - Data to export
 * @param {string} filename - Name of the file (without extension)
 */
export function exportToJSON(data, filename) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Import JSON data from a file
 * @param {File} file - File object to read
 * @returns {Promise<Object>} Promise that resolves with parsed JSON data
 */
export function importFromJSON(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                resolve(data);
            } catch (error) {
                reject(new Error('Failed to parse JSON: ' + error.message));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Validate component data structure
 * @param {Object} componentData - Component data to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateComponentData(componentData) {
    if (!componentData.name) {
        throw new Error('Component must have a name');
    }
    if (!componentData.components || !Array.isArray(componentData.components)) {
        throw new Error('Component must have a components array');
    }
    if (!componentData.connections || !Array.isArray(componentData.connections)) {
        throw new Error('Component must have a connections array');
    }
    return true;
}

/**
 * Validate circuit data structure
 * @param {Object} circuitData - Circuit data to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateCircuitData(circuitData) {
    if (!circuitData.components || !Array.isArray(circuitData.components)) {
        throw new Error('Circuit must have a components array');
    }
    if (!circuitData.connections || !Array.isArray(circuitData.connections)) {
        throw new Error('Circuit must have a connections array');
    }
    return true;
}
