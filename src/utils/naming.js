/**
 * Naming utilities for the Logic Circuit Simulator
 * Provides pure functions for generating unique names
 */

/**
 * Generate the next available board name (Board01, Board02, etc.)
 * @param {string[]} existingNames - Array of existing board/component names to avoid
 * @returns {string} Next available board name
 */
export function generateNextBoardName(existingNames) {
    let counter = 1;
    let name;
    do {
        name = `Board${String(counter).padStart(2, '0')}`;
        counter++;
    } while (existingNames.includes(name));
    return name;
}
