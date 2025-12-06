/**
 * Unit tests for state snapshot utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    captureCircuitSnapshot,
    restoreCircuitSnapshot,
    snapshotsEqual
} from '../../../src/utils/stateSnapshot.js';

// Mock CircuitState for testing
function createMockState(data = {}) {
    const defaultData = {
        components: [],
        connections: [],
        nextId: 1,
        truthTableState: null
    };
    const stateData = { ...defaultData, ...data };

    return {
        getComponents: vi.fn(() => stateData.components),
        getConnections: vi.fn(() => stateData.connections),
        getNextId: vi.fn(() => stateData.nextId),
        getTruthTableState: vi.fn(() => stateData.truthTableState),
        loadState: vi.fn()
    };
}

describe('State Snapshot Utilities', () => {
    describe('captureCircuitSnapshot()', () => {
        it('should capture basic circuit state', () => {
            const mockState = createMockState({
                components: [{ id: 1, type: 'AND', x: 100, y: 100 }],
                connections: [{ from: 1, to: 2, fromPort: 0, toPort: 0 }],
                nextId: 3
            });

            const snapshot = captureCircuitSnapshot(mockState);

            expect(snapshot.components).toHaveLength(1);
            expect(snapshot.components[0].type).toBe('AND');
            expect(snapshot.connections).toHaveLength(1);
            expect(snapshot.nextId).toBe(3);
        });

        it('should deep clone components to prevent mutation', () => {
            const originalComponent = { id: 1, type: 'AND', x: 100, y: 100 };
            const mockState = createMockState({
                components: [originalComponent],
                connections: []
            });

            const snapshot = captureCircuitSnapshot(mockState);

            // Modify original
            originalComponent.x = 200;

            // Snapshot should be unchanged
            expect(snapshot.components[0].x).toBe(100);
        });

        it('should deep clone connections to prevent mutation', () => {
            const originalConnection = { from: 1, to: 2, fromPort: 0, toPort: 0 };
            const mockState = createMockState({
                components: [],
                connections: [originalConnection]
            });

            const snapshot = captureCircuitSnapshot(mockState);

            // Modify original
            originalConnection.from = 99;

            // Snapshot should be unchanged
            expect(snapshot.connections[0].from).toBe(1);
        });

        it('should exclude truthTableState by default', () => {
            const mockState = createMockState({
                truthTableState: { x: 100, y: 100, width: 400, height: 300 }
            });

            const snapshot = captureCircuitSnapshot(mockState);

            expect(snapshot.truthTableState).toBeUndefined();
        });

        it('should include truthTableState when option is set', () => {
            const mockState = createMockState({
                truthTableState: { x: 100, y: 100, width: 400, height: 300 }
            });

            const snapshot = captureCircuitSnapshot(mockState, { includeTruthTableState: true });

            expect(snapshot.truthTableState).toBeDefined();
            expect(snapshot.truthTableState.x).toBe(100);
        });

        it('should handle null truthTableState', () => {
            const mockState = createMockState({
                truthTableState: null
            });

            const snapshot = captureCircuitSnapshot(mockState, { includeTruthTableState: true });

            expect(snapshot.truthTableState).toBeNull();
        });

        it('should handle empty circuit', () => {
            const mockState = createMockState({
                components: [],
                connections: [],
                nextId: 1
            });

            const snapshot = captureCircuitSnapshot(mockState);

            expect(snapshot.components).toEqual([]);
            expect(snapshot.connections).toEqual([]);
            expect(snapshot.nextId).toBe(1);
        });

        it('should capture complex nested component data', () => {
            const mockState = createMockState({
                components: [{
                    id: 1,
                    type: 'CUSTOM',
                    x: 100,
                    y: 100,
                    customDefinition: {
                        name: 'HalfAdder',
                        components: [{ id: 1, type: 'XOR' }, { id: 2, type: 'AND' }],
                        connections: []
                    },
                    inputPorts: [{ x: 80, y: 90 }, { x: 80, y: 110 }],
                    outputPorts: [{ x: 120, y: 100 }]
                }],
                connections: [],
                nextId: 2
            });

            const snapshot = captureCircuitSnapshot(mockState);

            expect(snapshot.components[0].customDefinition.name).toBe('HalfAdder');
            expect(snapshot.components[0].inputPorts).toHaveLength(2);
        });
    });

    describe('restoreCircuitSnapshot()', () => {
        it('should call loadState with snapshot data', () => {
            const mockState = createMockState();
            const snapshot = {
                components: [{ id: 1, type: 'AND' }],
                connections: [],
                nextId: 2,
                truthTableState: null
            };

            restoreCircuitSnapshot(mockState, snapshot);

            expect(mockState.loadState).toHaveBeenCalledWith({
                components: snapshot.components,
                connections: snapshot.connections,
                nextId: snapshot.nextId,
                truthTableState: null
            });
        });

        it('should handle missing truthTableState in snapshot', () => {
            const mockState = createMockState();
            const snapshot = {
                components: [],
                connections: [],
                nextId: 1
                // No truthTableState
            };

            restoreCircuitSnapshot(mockState, snapshot);

            expect(mockState.loadState).toHaveBeenCalledWith({
                components: [],
                connections: [],
                nextId: 1,
                truthTableState: null
            });
        });

        it('should pass truthTableState when present', () => {
            const mockState = createMockState();
            const snapshot = {
                components: [],
                connections: [],
                nextId: 1,
                truthTableState: { x: 50, y: 50, width: 300, height: 200 }
            };

            restoreCircuitSnapshot(mockState, snapshot);

            expect(mockState.loadState).toHaveBeenCalledWith({
                components: [],
                connections: [],
                nextId: 1,
                truthTableState: { x: 50, y: 50, width: 300, height: 200 }
            });
        });
    });

    describe('snapshotsEqual()', () => {
        it('should return true for identical snapshots', () => {
            const snapshot1 = {
                components: [{ id: 1, type: 'AND', x: 100, y: 100 }],
                connections: [{ from: 1, to: 2 }],
                nextId: 3
            };
            const snapshot2 = {
                components: [{ id: 1, type: 'AND', x: 100, y: 100 }],
                connections: [{ from: 1, to: 2 }],
                nextId: 3
            };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
        });

        it('should return false for different components', () => {
            const snapshot1 = {
                components: [{ id: 1, type: 'AND' }],
                connections: [],
                nextId: 2
            };
            const snapshot2 = {
                components: [{ id: 1, type: 'OR' }],
                connections: [],
                nextId: 2
            };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
        });

        it('should return false for different connections', () => {
            const snapshot1 = {
                components: [],
                connections: [{ from: 1, to: 2 }],
                nextId: 1
            };
            const snapshot2 = {
                components: [],
                connections: [{ from: 1, to: 3 }],
                nextId: 1
            };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
        });

        it('should return false for different nextId', () => {
            const snapshot1 = { components: [], connections: [], nextId: 1 };
            const snapshot2 = { components: [], connections: [], nextId: 2 };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
        });

        it('should return true for both null', () => {
            expect(snapshotsEqual(null, null)).toBe(true);
        });

        it('should return true for both undefined', () => {
            expect(snapshotsEqual(undefined, undefined)).toBe(true);
        });

        it('should return false when one is null', () => {
            const snapshot = { components: [], connections: [], nextId: 1 };
            expect(snapshotsEqual(snapshot, null)).toBe(false);
            expect(snapshotsEqual(null, snapshot)).toBe(false);
        });

        it('should return true for empty snapshots', () => {
            const snapshot1 = { components: [], connections: [], nextId: 1 };
            const snapshot2 = { components: [], connections: [], nextId: 1 };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
        });

        it('should handle complex nested structures', () => {
            const snapshot1 = {
                components: [{
                    id: 1,
                    type: 'CUSTOM',
                    customDefinition: {
                        name: 'Test',
                        components: [{ id: 1, type: 'AND' }]
                    }
                }],
                connections: [],
                nextId: 2
            };
            const snapshot2 = {
                components: [{
                    id: 1,
                    type: 'CUSTOM',
                    customDefinition: {
                        name: 'Test',
                        components: [{ id: 1, type: 'AND' }]
                    }
                }],
                connections: [],
                nextId: 2
            };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
        });

        it('should detect nested differences', () => {
            const snapshot1 = {
                components: [{
                    id: 1,
                    customDefinition: { name: 'Test1' }
                }],
                connections: [],
                nextId: 2
            };
            const snapshot2 = {
                components: [{
                    id: 1,
                    customDefinition: { name: 'Test2' }
                }],
                connections: [],
                nextId: 2
            };

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
        });
    });

    describe('Integration scenarios', () => {
        it('should capture and compare unchanged state', () => {
            const mockState = createMockState({
                components: [{ id: 1, type: 'AND', x: 100, y: 100 }],
                connections: [],
                nextId: 2
            });

            const snapshot1 = captureCircuitSnapshot(mockState);
            const snapshot2 = captureCircuitSnapshot(mockState);

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
        });

        it('should detect state changes after modification', () => {
            let currentComponents = [{ id: 1, type: 'AND', x: 100, y: 100 }];

            const mockState = {
                getComponents: vi.fn(() => currentComponents),
                getConnections: vi.fn(() => []),
                getNextId: vi.fn(() => 2),
                getTruthTableState: vi.fn(() => null),
                loadState: vi.fn()
            };

            const snapshot1 = captureCircuitSnapshot(mockState);

            // Simulate modification
            currentComponents = [
                { id: 1, type: 'AND', x: 100, y: 100 },
                { id: 2, type: 'OR', x: 200, y: 200 }
            ];

            const snapshot2 = captureCircuitSnapshot(mockState);

            expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
        });
    });
});
