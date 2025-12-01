import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoardManager } from '../../../src/storage/BoardManager.js';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';

describe('BoardManager', () => {
    let boardManager;
    let mockStorage;

    beforeEach(() => {
        // Create a clean mock storage for each test
        mockStorage = {};

        global.localStorage = {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, value) => {
                mockStorage[key] = value;
            }),
            removeItem: vi.fn((key) => {
                delete mockStorage[key];
            }),
            clear: vi.fn(() => {
                mockStorage = {};
            }),
            key: vi.fn((index) => Object.keys(mockStorage)[index] || null),
            get length() {
                return Object.keys(mockStorage).length;
            }
        };

        const adapter = new LocalStorageAdapter();
        boardManager = new BoardManager(adapter);
    });

    describe('saveBoard', () => {
        it('should save a board with metadata', async () => {
            const boardData = {
                components: [
                    { id: 1, type: 'INPUT', value: 0 },
                    { id: 2, type: 'AND', value: null }
                ],
                connections: [{ from: 1, to: 2, fromPort: 0, toPort: 0 }],
                nextId: 3
            };

            const success = await boardManager.saveBoard('TestBoard', boardData);

            expect(success).toBe(true);

            const loaded = await boardManager.loadBoard('TestBoard');
            expect(loaded).toBeTruthy();
            expect(loaded.name).toBe('TestBoard');
            expect(loaded.components).toEqual(boardData.components);
            expect(loaded.connections).toEqual(boardData.connections);
            expect(loaded.nextId).toBe(3);
            expect(loaded.savedAt).toBeTruthy();
            expect(loaded.version).toBe('1.0');
        });

        it('should return false for invalid board name', async () => {
            const boardData = { components: [], connections: [] };

            const success1 = await boardManager.saveBoard('', boardData);
            const success2 = await boardManager.saveBoard(null, boardData);
            const success3 = await boardManager.saveBoard(123, boardData);

            expect(success1).toBe(false);
            expect(success2).toBe(false);
            expect(success3).toBe(false);
        });

        it('should overwrite existing board', async () => {
            const boardData1 = {
                components: [{ id: 1, type: 'INPUT', value: 0 }],
                connections: [],
                nextId: 2
            };

            const boardData2 = {
                components: [{ id: 1, type: 'OUTPUT', value: null }],
                connections: [],
                nextId: 2
            };

            await boardManager.saveBoard('TestBoard', boardData1);
            await boardManager.saveBoard('TestBoard', boardData2);

            const loaded = await boardManager.loadBoard('TestBoard');
            expect(loaded.components[0].type).toBe('OUTPUT');
        });
    });

    describe('loadBoard', () => {
        it('should load an existing board', async () => {
            const boardData = {
                components: [{ id: 1, type: 'INPUT', value: 1 }],
                connections: [],
                nextId: 2
            };

            await boardManager.saveBoard('LoadTest', boardData);
            const loaded = await boardManager.loadBoard('LoadTest');

            expect(loaded).toBeTruthy();
            expect(loaded.components).toEqual(boardData.components);
        });

        it('should return null for non-existent board', async () => {
            const loaded = await boardManager.loadBoard('NonExistent');

            expect(loaded).toBeNull();
        });
    });

    describe('getAllBoards', () => {
        it('should return empty object when no boards exist', async () => {
            const boards = await boardManager.getAllBoards();

            expect(boards).toEqual({});
        });

        it('should return all saved boards', async () => {
            const boardData1 = {
                components: [{ id: 1, type: 'INPUT', value: 0 }],
                connections: [],
                nextId: 2
            };

            const boardData2 = {
                components: [{ id: 1, type: 'OUTPUT', value: null }],
                connections: [],
                nextId: 2
            };

            await boardManager.saveBoard('Board1', boardData1);
            await boardManager.saveBoard('Board2', boardData2);

            const boards = await boardManager.getAllBoards();

            expect(Object.keys(boards).length).toBe(2);
            expect(boards.Board1).toBeTruthy();
            expect(boards.Board2).toBeTruthy();
        });
    });

    describe('listBoards', () => {
        it('should return empty array when no boards exist', async () => {
            const list = await boardManager.listBoards();

            expect(list).toEqual([]);
        });

        it('should return board metadata sorted by date', async () => {
            const boardData = {
                components: [{ id: 1, type: 'INPUT', value: 0 }],
                connections: [],
                nextId: 2
            };

            await boardManager.saveBoard('Board1', boardData);

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await boardManager.saveBoard('Board2', boardData);

            const list = await boardManager.listBoards();

            expect(list.length).toBe(2);
            expect(list[0].name).toBe('Board2'); // Most recent first
            expect(list[1].name).toBe('Board1');
            expect(list[0].componentCount).toBe(1);
            expect(list[0].connectionCount).toBe(0);
        });
    });

    describe('deleteBoard', () => {
        it('should delete an existing board', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('ToDelete', boardData);

            let boards = await boardManager.getAllBoards();
            expect(boards.ToDelete).toBeTruthy();

            const success = await boardManager.deleteBoard('ToDelete');
            expect(success).toBe(true);

            boards = await boardManager.getAllBoards();
            expect(boards.ToDelete).toBeUndefined();
        });

        it('should return false for non-existent board', async () => {
            const success = await boardManager.deleteBoard('NonExistent');

            expect(success).toBe(false);
        });
    });

    describe('boardExists', () => {
        it('should return true for existing board', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('ExistsTest', boardData);

            const exists = await boardManager.boardExists('ExistsTest');

            expect(exists).toBe(true);
        });

        it('should return false for non-existent board', async () => {
            const exists = await boardManager.boardExists('DoesNotExist');

            expect(exists).toBe(false);
        });
    });

    describe('renameBoard', () => {
        it('should rename an existing board', async () => {
            const boardData = {
                components: [{ id: 1, type: 'INPUT', value: 0 }],
                connections: [],
                nextId: 2
            };

            await boardManager.saveBoard('OldName', boardData);

            const success = await boardManager.renameBoard('OldName', 'NewName');

            expect(success).toBe(true);

            const oldExists = await boardManager.boardExists('OldName');
            const newExists = await boardManager.boardExists('NewName');

            expect(oldExists).toBe(false);
            expect(newExists).toBe(true);

            const loaded = await boardManager.loadBoard('NewName');
            expect(loaded.components).toEqual(boardData.components);
        });

        it('should return true if old and new names are the same', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('SameName', boardData);

            const success = await boardManager.renameBoard('SameName', 'SameName');

            expect(success).toBe(true);
        });

        it('should return false if board does not exist', async () => {
            const success = await boardManager.renameBoard('NonExistent', 'NewName');

            expect(success).toBe(false);
        });

        it('should return false if new name already exists', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('Board1', boardData);
            await boardManager.saveBoard('Board2', boardData);

            const success = await boardManager.renameBoard('Board1', 'Board2');

            expect(success).toBe(false);
        });
    });

    describe('clearAllBoards', () => {
        it('should clear all boards', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('Board1', boardData);
            await boardManager.saveBoard('Board2', boardData);

            let boards = await boardManager.getAllBoards();
            expect(Object.keys(boards).length).toBe(2);

            const success = await boardManager.clearAllBoards();
            expect(success).toBe(true);

            boards = await boardManager.getAllBoards();
            expect(Object.keys(boards).length).toBe(0);
        });
    });

    describe('getNextBoardName', () => {
        it('should return Board01 when no boards exist', async () => {
            const nextName = await boardManager.getNextBoardName();

            expect(nextName).toBe('Board01');
        });

        it('should return next available board name', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('Board01', boardData);
            await boardManager.saveBoard('Board02', boardData);

            const nextName = await boardManager.getNextBoardName();

            expect(nextName).toBe('Board03');
        });

        it('should skip names in existing names array', async () => {
            const boardData = {
                components: [],
                connections: [],
                nextId: 1
            };

            await boardManager.saveBoard('Board01', boardData);

            const nextName = await boardManager.getNextBoardName(['Board02', 'Board03']);

            expect(nextName).toBe('Board04');
        });
    });
});
