/**
 * State Snapshot Utilities
 *
 * Shared utilities for capturing and restoring circuit state.
 * Used by both AutoSaveManager and UndoRedoManager for code reuse.
 */

import { deepClone } from './serialization.js';

/**
 * Capture a snapshot of the current circuit state
 * @param {CircuitState} state - The CircuitState instance
 * @param {Object} options - Options for what to include
 * @param {boolean} options.includeTruthTableState - Include truth table UI state (default: false)
 * @returns {Object} State snapshot containing components, connections, nextId
 */
export function captureCircuitSnapshot(state, options = {}) {
    const { includeTruthTableState = false } = options;

    const snapshot = {
        components: deepClone(state.getComponents()),
        connections: deepClone(state.getConnections()),
        nextId: state.getNextId()
    };

    if (includeTruthTableState) {
        const truthTableState = state.getTruthTableState();
        snapshot.truthTableState = truthTableState ? deepClone(truthTableState) : null;
    }

    return snapshot;
}

/**
 * Restore circuit state from a snapshot
 * @param {CircuitState} state - The CircuitState instance
 * @param {Object} snapshot - State snapshot to restore
 * @param {Object} options - Options for restoration
 * @param {boolean} options.emitEvents - Whether to emit events (default: true)
 */
export function restoreCircuitSnapshot(state, snapshot, options = {}) {
    const { emitEvents = true } = options;

    // Use loadState which handles deep cloning internally
    state.loadState({
        components: snapshot.components,
        connections: snapshot.connections,
        nextId: snapshot.nextId,
        truthTableState: snapshot.truthTableState || null
    });

    // loadState already emits BOARD_LOADED event if emitEvents is default
    // Additional event handling can be done by caller if needed
}

/**
 * Compare two state snapshots for equality
 * @param {Object} snapshot1 - First snapshot
 * @param {Object} snapshot2 - Second snapshot
 * @returns {boolean} True if snapshots are equal
 */
export function snapshotsEqual(snapshot1, snapshot2) {
    if (!snapshot1 && !snapshot2) return true;
    if (!snapshot1 || !snapshot2) return false;

    return JSON.stringify(snapshot1) === JSON.stringify(snapshot2);
}
