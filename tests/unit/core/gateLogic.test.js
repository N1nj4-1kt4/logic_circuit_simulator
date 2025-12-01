import { describe, it, expect } from 'vitest';
import {
    evaluateAND,
    evaluateOR,
    evaluateNOT,
    evaluateXOR,
    evaluateNAND,
    evaluateNOR,
    evaluateXNOR,
    evaluateOUTPUT,
    evaluateGate,
    getGateTruthTable
} from '../../../src/core/gateLogic.js';

describe('Gate Logic', () => {
    describe('evaluateAND', () => {
        it('should return 1 when both inputs are 1', () => {
            expect(evaluateAND([1, 1])).toBe(1);
        });

        it('should return 0 when first input is 0', () => {
            expect(evaluateAND([0, 1])).toBe(0);
        });

        it('should return 0 when second input is 0', () => {
            expect(evaluateAND([1, 0])).toBe(0);
        });

        it('should return 0 when both inputs are 0', () => {
            expect(evaluateAND([0, 0])).toBe(0);
        });
    });

    describe('evaluateOR', () => {
        it('should return 1 when both inputs are 1', () => {
            expect(evaluateOR([1, 1])).toBe(1);
        });

        it('should return 1 when first input is 1', () => {
            expect(evaluateOR([1, 0])).toBe(1);
        });

        it('should return 1 when second input is 1', () => {
            expect(evaluateOR([0, 1])).toBe(1);
        });

        it('should return 0 when both inputs are 0', () => {
            expect(evaluateOR([0, 0])).toBe(0);
        });
    });

    describe('evaluateNOT', () => {
        it('should return 0 when input is 1', () => {
            expect(evaluateNOT([1])).toBe(0);
        });

        it('should return 1 when input is 0', () => {
            expect(evaluateNOT([0])).toBe(1);
        });
    });

    describe('evaluateXOR', () => {
        it('should return 0 when both inputs are 1', () => {
            expect(evaluateXOR([1, 1])).toBe(0);
        });

        it('should return 1 when first input is 1 and second is 0', () => {
            expect(evaluateXOR([1, 0])).toBe(1);
        });

        it('should return 1 when first input is 0 and second is 1', () => {
            expect(evaluateXOR([0, 1])).toBe(1);
        });

        it('should return 0 when both inputs are 0', () => {
            expect(evaluateXOR([0, 0])).toBe(0);
        });
    });

    describe('evaluateNAND', () => {
        it('should return 0 when both inputs are 1', () => {
            expect(evaluateNAND([1, 1])).toBe(0);
        });

        it('should return 1 when first input is 0', () => {
            expect(evaluateNAND([0, 1])).toBe(1);
        });

        it('should return 1 when second input is 0', () => {
            expect(evaluateNAND([1, 0])).toBe(1);
        });

        it('should return 1 when both inputs are 0', () => {
            expect(evaluateNAND([0, 0])).toBe(1);
        });
    });

    describe('evaluateNOR', () => {
        it('should return 0 when both inputs are 1', () => {
            expect(evaluateNOR([1, 1])).toBe(0);
        });

        it('should return 0 when first input is 1', () => {
            expect(evaluateNOR([1, 0])).toBe(0);
        });

        it('should return 0 when second input is 1', () => {
            expect(evaluateNOR([0, 1])).toBe(0);
        });

        it('should return 1 when both inputs are 0', () => {
            expect(evaluateNOR([0, 0])).toBe(1);
        });
    });

    describe('evaluateXNOR', () => {
        it('should return 1 when both inputs are 1', () => {
            expect(evaluateXNOR([1, 1])).toBe(1);
        });

        it('should return 0 when first input is 1 and second is 0', () => {
            expect(evaluateXNOR([1, 0])).toBe(0);
        });

        it('should return 0 when first input is 0 and second is 1', () => {
            expect(evaluateXNOR([0, 1])).toBe(0);
        });

        it('should return 1 when both inputs are 0', () => {
            expect(evaluateXNOR([0, 0])).toBe(1);
        });
    });

    describe('evaluateOUTPUT', () => {
        it('should return 1 when input is 1', () => {
            expect(evaluateOUTPUT([1])).toBe(1);
        });

        it('should return 0 when input is 0', () => {
            expect(evaluateOUTPUT([0])).toBe(0);
        });

        it('should pass through the input value unchanged', () => {
            expect(evaluateOUTPUT([1])).toBe(1);
            expect(evaluateOUTPUT([0])).toBe(0);
        });
    });

    describe('evaluateGate dispatcher', () => {
        it('should dispatch AND gate correctly', () => {
            expect(evaluateGate('AND', [1, 1])).toBe(1);
            expect(evaluateGate('AND', [1, 0])).toBe(0);
            expect(evaluateGate('AND', [0, 1])).toBe(0);
            expect(evaluateGate('AND', [0, 0])).toBe(0);
        });

        it('should dispatch OR gate correctly', () => {
            expect(evaluateGate('OR', [1, 1])).toBe(1);
            expect(evaluateGate('OR', [1, 0])).toBe(1);
            expect(evaluateGate('OR', [0, 1])).toBe(1);
            expect(evaluateGate('OR', [0, 0])).toBe(0);
        });

        it('should dispatch NOT gate correctly', () => {
            expect(evaluateGate('NOT', [1])).toBe(0);
            expect(evaluateGate('NOT', [0])).toBe(1);
        });

        it('should dispatch XOR gate correctly', () => {
            expect(evaluateGate('XOR', [1, 1])).toBe(0);
            expect(evaluateGate('XOR', [1, 0])).toBe(1);
            expect(evaluateGate('XOR', [0, 1])).toBe(1);
            expect(evaluateGate('XOR', [0, 0])).toBe(0);
        });

        it('should dispatch NAND gate correctly', () => {
            expect(evaluateGate('NAND', [1, 1])).toBe(0);
            expect(evaluateGate('NAND', [1, 0])).toBe(1);
            expect(evaluateGate('NAND', [0, 1])).toBe(1);
            expect(evaluateGate('NAND', [0, 0])).toBe(1);
        });

        it('should dispatch NOR gate correctly', () => {
            expect(evaluateGate('NOR', [1, 1])).toBe(0);
            expect(evaluateGate('NOR', [1, 0])).toBe(0);
            expect(evaluateGate('NOR', [0, 1])).toBe(0);
            expect(evaluateGate('NOR', [0, 0])).toBe(1);
        });

        it('should dispatch XNOR gate correctly', () => {
            expect(evaluateGate('XNOR', [1, 1])).toBe(1);
            expect(evaluateGate('XNOR', [1, 0])).toBe(0);
            expect(evaluateGate('XNOR', [0, 1])).toBe(0);
            expect(evaluateGate('XNOR', [0, 0])).toBe(1);
        });

        it('should dispatch OUTPUT gate correctly', () => {
            expect(evaluateGate('OUTPUT', [1])).toBe(1);
            expect(evaluateGate('OUTPUT', [0])).toBe(0);
        });

        it('should return null for unknown gate type', () => {
            expect(evaluateGate('UNKNOWN', [1, 1])).toBeNull();
        });

        it('should return null when any input is null', () => {
            expect(evaluateGate('AND', [null, 1])).toBeNull();
            expect(evaluateGate('AND', [1, null])).toBeNull();
            expect(evaluateGate('AND', [null, null])).toBeNull();
        });

        it('should return null when any input is undefined', () => {
            expect(evaluateGate('OR', [undefined, 1])).toBeNull();
            expect(evaluateGate('OR', [1, undefined])).toBeNull();
            expect(evaluateGate('OR', [undefined, undefined])).toBeNull();
        });

        it('should handle mixed null and undefined inputs', () => {
            expect(evaluateGate('XOR', [null, undefined])).toBeNull();
            expect(evaluateGate('XOR', [undefined, null])).toBeNull();
        });
    });

    describe('getGateTruthTable', () => {
        describe('NOT gate truth table', () => {
            it('should return correct truth table for NOT gate', () => {
                const truthTable = getGateTruthTable('NOT');

                expect(truthTable).toHaveLength(2);
                expect(truthTable[0]).toEqual({ inputs: [0], output: 1 });
                expect(truthTable[1]).toEqual({ inputs: [1], output: 0 });
            });
        });

        describe('AND gate truth table', () => {
            it('should return correct truth table for AND gate', () => {
                const truthTable = getGateTruthTable('AND');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 0 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 0 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 0 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 1 });
            });
        });

        describe('OR gate truth table', () => {
            it('should return correct truth table for OR gate', () => {
                const truthTable = getGateTruthTable('OR');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 0 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 1 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 1 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 1 });
            });
        });

        describe('XOR gate truth table', () => {
            it('should return correct truth table for XOR gate', () => {
                const truthTable = getGateTruthTable('XOR');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 0 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 1 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 1 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 0 });
            });
        });

        describe('NAND gate truth table', () => {
            it('should return correct truth table for NAND gate', () => {
                const truthTable = getGateTruthTable('NAND');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 1 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 1 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 1 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 0 });
            });
        });

        describe('NOR gate truth table', () => {
            it('should return correct truth table for NOR gate', () => {
                const truthTable = getGateTruthTable('NOR');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 1 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 0 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 0 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 0 });
            });
        });

        describe('XNOR gate truth table', () => {
            it('should return correct truth table for XNOR gate', () => {
                const truthTable = getGateTruthTable('XNOR');

                expect(truthTable).toHaveLength(4);
                expect(truthTable[0]).toEqual({ inputs: [0, 0], output: 1 });
                expect(truthTable[1]).toEqual({ inputs: [0, 1], output: 0 });
                expect(truthTable[2]).toEqual({ inputs: [1, 0], output: 0 });
                expect(truthTable[3]).toEqual({ inputs: [1, 1], output: 1 });
            });
        });

        describe('unknown gate types', () => {
            it('should return empty array for unknown gate type', () => {
                const truthTable = getGateTruthTable('UNKNOWN');

                expect(truthTable).toEqual([]);
            });

            it('should return empty array for INPUT type', () => {
                const truthTable = getGateTruthTable('INPUT');

                expect(truthTable).toEqual([]);
            });

            it('should return empty array for OUTPUT type', () => {
                const truthTable = getGateTruthTable('OUTPUT');

                expect(truthTable).toEqual([]);
            });
        });
    });

    describe('comprehensive gate behavior', () => {
        it('should verify AND gate is conjunction', () => {
            // AND is true only when all inputs are true
            expect(evaluateAND([1, 1])).toBe(1);
            expect(evaluateAND([0, 0])).toBe(0);
            expect(evaluateAND([0, 1])).toBe(0);
            expect(evaluateAND([1, 0])).toBe(0);
        });

        it('should verify OR gate is disjunction', () => {
            // OR is true when at least one input is true
            expect(evaluateOR([1, 1])).toBe(1);
            expect(evaluateOR([0, 1])).toBe(1);
            expect(evaluateOR([1, 0])).toBe(1);
            expect(evaluateOR([0, 0])).toBe(0);
        });

        it('should verify XOR is exclusive or', () => {
            // XOR is true when inputs are different
            expect(evaluateXOR([0, 1])).toBe(1);
            expect(evaluateXOR([1, 0])).toBe(1);
            expect(evaluateXOR([0, 0])).toBe(0);
            expect(evaluateXOR([1, 1])).toBe(0);
        });

        it('should verify XNOR is equivalence', () => {
            // XNOR is true when inputs are the same
            expect(evaluateXNOR([0, 0])).toBe(1);
            expect(evaluateXNOR([1, 1])).toBe(1);
            expect(evaluateXNOR([0, 1])).toBe(0);
            expect(evaluateXNOR([1, 0])).toBe(0);
        });

        it('should verify NAND is inverse of AND', () => {
            expect(evaluateNAND([0, 0])).toBe(1 - evaluateAND([0, 0]));
            expect(evaluateNAND([0, 1])).toBe(1 - evaluateAND([0, 1]));
            expect(evaluateNAND([1, 0])).toBe(1 - evaluateAND([1, 0]));
            expect(evaluateNAND([1, 1])).toBe(1 - evaluateAND([1, 1]));
        });

        it('should verify NOR is inverse of OR', () => {
            expect(evaluateNOR([0, 0])).toBe(1 - evaluateOR([0, 0]));
            expect(evaluateNOR([0, 1])).toBe(1 - evaluateOR([0, 1]));
            expect(evaluateNOR([1, 0])).toBe(1 - evaluateOR([1, 0]));
            expect(evaluateNOR([1, 1])).toBe(1 - evaluateOR([1, 1]));
        });

        it('should verify NOT inverts input', () => {
            expect(evaluateNOT([0])).toBe(1);
            expect(evaluateNOT([1])).toBe(0);
            expect(evaluateNOT([evaluateNOT([0])])).toBe(0); // Double negation
            expect(evaluateNOT([evaluateNOT([1])])).toBe(1); // Double negation
        });
    });
});
