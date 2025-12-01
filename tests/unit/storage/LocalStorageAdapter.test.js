import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter.js';

describe('LocalStorageAdapter', () => {
    let adapter;
    let mockStorage;

    beforeEach(() => {
        // Create a clean mock storage for each test
        mockStorage = {};

        // Create a mock localStorage that behaves like a real object
        const createMockStorage = () => {
            const mock = {
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

            // Make Object.keys work by copying mockStorage keys to the mock object
            return new Proxy(mock, {
                ownKeys() {
                    return Object.keys(mockStorage);
                },
                getOwnPropertyDescriptor(target, prop) {
                    if (Object.keys(mockStorage).includes(prop)) {
                        return {
                            enumerable: true,
                            configurable: true
                        };
                    }
                    return Object.getOwnPropertyDescriptor(target, prop);
                }
            });
        };

        global.localStorage = createMockStorage();
        adapter = new LocalStorageAdapter();
    });

    describe('setItem', () => {
        it('should save a string item', async () => {
            const result = await adapter.setItem('testKey', 'testValue');

            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('testKey', '"testValue"');
            expect(mockStorage.testKey).toBe('"testValue"');
        });

        it('should save an object item', async () => {
            const testObj = { foo: 'bar', num: 42 };
            const result = await adapter.setItem('testKey', testObj);

            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalled();
            expect(JSON.parse(mockStorage.testKey)).toEqual(testObj);
        });

        it('should save an array item', async () => {
            const testArray = [1, 2, 3, { nested: true }];
            const result = await adapter.setItem('testKey', testArray);

            expect(result).toBe(true);
            expect(JSON.parse(mockStorage.testKey)).toEqual(testArray);
        });

        it('should return false on error', async () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });

            const result = await adapter.setItem('testKey', 'testValue');

            expect(result).toBe(false);
        });
    });

    describe('getItem', () => {
        it('should retrieve a saved item', async () => {
            mockStorage.testKey = JSON.stringify({ foo: 'bar' });

            const result = await adapter.getItem('testKey');

            expect(result).toEqual({ foo: 'bar' });
            expect(localStorage.getItem).toHaveBeenCalledWith('testKey');
        });

        it('should return null for non-existent items', async () => {
            const result = await adapter.getItem('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null on parse error', async () => {
            mockStorage.testKey = 'invalid json {';

            const result = await adapter.getItem('testKey');

            expect(result).toBeNull();
        });

        it('should handle null values correctly', async () => {
            mockStorage.testKey = 'null';

            const result = await adapter.getItem('testKey');

            expect(result).toBeNull();
        });
    });

    describe('removeItem', () => {
        it('should remove an existing item', async () => {
            mockStorage.testKey = '"testValue"';

            const result = await adapter.removeItem('testKey');

            expect(result).toBe(true);
            expect(localStorage.removeItem).toHaveBeenCalledWith('testKey');
            expect(mockStorage.testKey).toBeUndefined();
        });

        it('should return false on error', async () => {
            localStorage.removeItem.mockImplementation(() => {
                throw new Error('Remove failed');
            });

            const result = await adapter.removeItem('testKey');

            expect(result).toBe(false);
        });
    });

    describe('clear', () => {
        it('should clear all items', async () => {
            mockStorage.key1 = '"value1"';
            mockStorage.key2 = '"value2"';

            const result = await adapter.clear();

            expect(result).toBe(true);
            expect(localStorage.clear).toHaveBeenCalled();
        });

        it('should return false on error', async () => {
            localStorage.clear.mockImplementation(() => {
                throw new Error('Clear failed');
            });

            const result = await adapter.clear();

            expect(result).toBe(false);
        });
    });

    describe('getAllKeys', () => {
        it('should return all storage keys', async () => {
            mockStorage.key1 = '"value1"';
            mockStorage.key2 = '"value2"';
            mockStorage.key3 = '"value3"';

            const keys = await adapter.getAllKeys();

            expect(keys).toEqual(['key1', 'key2', 'key3']);
        });

        it('should return empty array when storage is empty', async () => {
            const keys = await adapter.getAllKeys();

            expect(keys).toEqual([]);
        });
    });

    describe('error handling', () => {
        it('should handle quota exceeded error gracefully', async () => {
            localStorage.setItem.mockImplementation(() => {
                const error = new Error('QuotaExceededError');
                error.name = 'QuotaExceededError';
                throw error;
            });

            const result = await adapter.setItem('largeKey', 'x'.repeat(10000000));

            expect(result).toBe(false);
        });

        it('should handle circular reference in objects', async () => {
            const circular = { a: 1 };
            circular.self = circular;

            const result = await adapter.setItem('circular', circular);

            expect(result).toBe(false);
        });
    });
});
