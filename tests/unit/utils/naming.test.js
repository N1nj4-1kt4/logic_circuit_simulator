import { describe, it, expect } from 'vitest';
import { generateNextBoardName } from '../../../src/utils/naming.js';

describe('naming utilities', () => {
    describe('generateNextBoardName', () => {
        it('should return Board01 when no existing names', () => {
            expect(generateNextBoardName([])).toBe('Board01');
        });

        it('should return Board02 when Board01 exists', () => {
            expect(generateNextBoardName(['Board01'])).toBe('Board02');
        });

        it('should return Board03 when Board01 and Board02 exist', () => {
            expect(generateNextBoardName(['Board01', 'Board02'])).toBe('Board03');
        });

        it('should find first available gap in sequence', () => {
            // Board01 and Board03 exist, so Board02 should be returned
            expect(generateNextBoardName(['Board01', 'Board03'])).toBe('Board02');
        });

        it('should skip to next available when gap filled', () => {
            expect(generateNextBoardName(['Board01', 'Board02', 'Board03'])).toBe('Board04');
        });

        it('should handle non-Board names in the list', () => {
            // Non-Board names should not affect Board numbering
            expect(generateNextBoardName(['MyCircuit', 'Test', 'Board01'])).toBe('Board02');
        });

        it('should handle mixed Board names and custom names', () => {
            expect(generateNextBoardName(['Board01', 'HalfAdder', 'Board02', 'FullAdder'])).toBe('Board03');
        });

        it('should work with large board numbers', () => {
            const names = [];
            for (let i = 1; i <= 50; i++) {
                names.push(`Board${String(i).padStart(2, '0')}`);
            }
            expect(generateNextBoardName(names)).toBe('Board51');
        });

        it('should pad single digit numbers with zero', () => {
            expect(generateNextBoardName([])).toBe('Board01');
            expect(generateNextBoardName(['Board01', 'Board02', 'Board03', 'Board04', 'Board05', 'Board06', 'Board07', 'Board08'])).toBe('Board09');
        });

        it('should handle double digit numbers without extra padding', () => {
            const names = [];
            for (let i = 1; i <= 10; i++) {
                names.push(`Board${String(i).padStart(2, '0')}`);
            }
            expect(generateNextBoardName(names)).toBe('Board11');
        });
    });
});
