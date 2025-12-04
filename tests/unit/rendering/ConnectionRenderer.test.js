/**
 * Unit tests for ConnectionRenderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionRenderer } from '../../../src/rendering/ConnectionRenderer.js';
import { COLORS } from '../../../src/constants.js';

// Create mock canvas context
const createMockContext = () => ({
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    lineWidth: 0
});

describe('ConnectionRenderer', () => {
    let renderer;
    let mockCtx;

    beforeEach(() => {
        mockCtx = createMockContext();
        renderer = new ConnectionRenderer(mockCtx, false);
    });

    describe('Initialization', () => {
        it('stores context reference', () => {
            expect(renderer.ctx).toBe(mockCtx);
        });

        it('initializes with light mode by default', () => {
            renderer = new ConnectionRenderer(mockCtx);
            expect(renderer.darkMode).toBe(false);
        });

        it('can initialize with dark mode', () => {
            renderer = new ConnectionRenderer(mockCtx, true);
            expect(renderer.darkMode).toBe(true);
        });
    });

    describe('setDarkMode', () => {
        it('updates dark mode state', () => {
            renderer.setDarkMode(true);
            expect(renderer.darkMode).toBe(true);

            renderer.setDarkMode(false);
            expect(renderer.darkMode).toBe(false);
        });
    });

    describe('drawConnections', () => {
        const components = [
            {
                id: 1,
                type: 'INPUT',
                x: 100,
                y: 100,
                value: 1,
                outputs: [{ x: 120, y: 100, value: 1 }],
                inputs: []
            },
            {
                id: 2,
                type: 'AND',
                x: 200,
                y: 100,
                outputs: [{ x: 225, y: 100 }],
                inputs: [
                    { x: 175, y: 90 },
                    { x: 175, y: 110 }
                ]
            },
            {
                id: 3,
                type: 'OUTPUT',
                x: 300,
                y: 100,
                outputs: [],
                inputs: [{ x: 280, y: 100 }]
            }
        ];

        it('draws connection line between components', () => {
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];

            renderer.drawConnections(connections, components);

            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.moveTo).toHaveBeenCalledWith(120, 100); // From port
            expect(mockCtx.lineTo).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        it('draws multiple connections', () => {
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 },
                { from: 2, fromPort: 0, to: 3, toPort: 0 }
            ];

            renderer.drawConnections(connections, components);

            expect(mockCtx.beginPath).toHaveBeenCalledTimes(2);
            expect(mockCtx.stroke).toHaveBeenCalledTimes(2);
        });

        it('skips connections with missing source component', () => {
            const connections = [
                { from: 999, fromPort: 0, to: 2, toPort: 0 } // Non-existent source
            ];

            renderer.drawConnections(connections, components);

            expect(mockCtx.beginPath).not.toHaveBeenCalled();
        });

        it('skips connections with missing target component', () => {
            const connections = [
                { from: 1, fromPort: 0, to: 999, toPort: 0 } // Non-existent target
            ];

            renderer.drawConnections(connections, components);

            expect(mockCtx.beginPath).not.toHaveBeenCalled();
        });

        it('sets line width to 3', () => {
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];

            renderer.drawConnections(connections, components);

            expect(mockCtx.lineWidth).toBe(3);
        });

        describe('Wire Color Based on Signal Value', () => {
            it('uses VALUE_ON color when signal is 1', () => {
                // Component 1 has value 1
                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, components);

                expect(mockCtx.strokeStyle).toBe(COLORS.VALUE_ON);
            });

            it('uses VALUE_OFF color when signal is 0', () => {
                const componentsWithZero = [
                    { ...components[0], value: 0 },
                    components[1],
                    components[2]
                ];

                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, componentsWithZero);

                expect(mockCtx.strokeStyle).toBe(COLORS.VALUE_OFF);
            });

            it('uses undefined color for null value in light mode', () => {
                const componentsWithNull = [
                    { ...components[0], value: null },
                    components[1],
                    components[2]
                ];

                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, componentsWithNull);

                expect(mockCtx.strokeStyle).toBe(COLORS.LIGHT.WIRE_UNDEFINED);
            });

            it('uses undefined color for null value in dark mode', () => {
                renderer.setDarkMode(true);

                const componentsWithNull = [
                    { ...components[0], value: null },
                    components[1],
                    components[2]
                ];

                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, componentsWithNull);

                expect(mockCtx.strokeStyle).toBe(COLORS.DARK.WIRE_UNDEFINED);
            });
        });

        describe('Wire Routing', () => {
            it('uses horizontal routing when dx > dy', () => {
                // From (120, 100) to (175, 90) - mostly horizontal
                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, components);

                // Should call lineTo multiple times for routing
                expect(mockCtx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(2);
            });

            it('uses vertical routing when dy > dx', () => {
                // Create components that require vertical routing
                const verticalComponents = [
                    {
                        id: 1,
                        type: 'INPUT',
                        value: 1,
                        outputs: [{ x: 100, y: 100 }],
                        inputs: []
                    },
                    {
                        id: 2,
                        type: 'OUTPUT',
                        outputs: [],
                        inputs: [{ x: 100, y: 250 }] // Mostly vertical
                    }
                ];

                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 }
                ];

                renderer.drawConnections(connections, verticalComponents);

                expect(mockCtx.lineTo).toHaveBeenCalled();
            });

            it('applies offset based on port index for overlapping wires', () => {
                // Multiple connections to same component
                const connections = [
                    { from: 1, fromPort: 0, to: 2, toPort: 0 },
                    { from: 1, fromPort: 0, to: 2, toPort: 1 }
                ];

                renderer.drawConnections(connections, components);

                // Both should draw with slight offset
                expect(mockCtx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(4);
            });
        });
    });

    describe('drawConnectionPreview', () => {
        it('draws dashed preview line', () => {
            renderer.drawConnectionPreview(100, 100, 200, 150);

            expect(mockCtx.setLineDash).toHaveBeenCalledWith([5, 5]);
            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.moveTo).toHaveBeenCalledWith(100, 100);
            expect(mockCtx.lineTo).toHaveBeenCalledWith(200, 150);
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        it('uses preview color', () => {
            renderer.drawConnectionPreview(100, 100, 200, 150);

            expect(mockCtx.strokeStyle).toBe(COLORS.WIRE_PREVIEW);
        });

        it('sets line width to 2', () => {
            renderer.drawConnectionPreview(100, 100, 200, 150);

            expect(mockCtx.lineWidth).toBe(2);
        });

        it('resets line dash after drawing', () => {
            renderer.drawConnectionPreview(100, 100, 200, 150);

            // Should be called twice: once to set, once to reset
            expect(mockCtx.setLineDash).toHaveBeenCalledWith([5, 5]);
            expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty connections array', () => {
            const testComponents = [
                { id: 1, type: 'INPUT', value: 1, outputs: [{ x: 120, y: 100 }], inputs: [] }
            ];
            renderer.drawConnections([], testComponents);

            expect(mockCtx.beginPath).not.toHaveBeenCalled();
        });

        it('handles empty components array', () => {
            const connections = [
                { from: 1, fromPort: 0, to: 2, toPort: 0 }
            ];

            renderer.drawConnections(connections, []);

            expect(mockCtx.beginPath).not.toHaveBeenCalled();
        });

        it('handles connection to same component', () => {
            const loopComponents = [
                {
                    id: 1,
                    type: 'NOT',
                    value: 1,
                    outputs: [{ x: 120, y: 100 }],
                    inputs: [{ x: 80, y: 100 }]
                }
            ];

            const connections = [
                { from: 1, fromPort: 0, to: 1, toPort: 0 } // Self-loop
            ];

            // Should not throw
            expect(() => {
                renderer.drawConnections(connections, loopComponents);
            }).not.toThrow();
        });

        it('draws preview line of zero length', () => {
            renderer.drawConnectionPreview(100, 100, 100, 100);

            expect(mockCtx.moveTo).toHaveBeenCalledWith(100, 100);
            expect(mockCtx.lineTo).toHaveBeenCalledWith(100, 100);
        });
    });

    describe('Theme Consistency', () => {
        const components = [
            {
                id: 1,
                type: 'INPUT',
                value: 1,
                outputs: [{ x: 120, y: 100 }],
                inputs: []
            },
            {
                id: 2,
                type: 'OUTPUT',
                outputs: [],
                inputs: [{ x: 280, y: 100 }]
            }
        ];

        const connections = [
            { from: 1, fromPort: 0, to: 2, toPort: 0 }
        ];

        it('uses same VALUE_ON color in both modes for active signal', () => {
            renderer.setDarkMode(false);
            renderer.drawConnections(connections, components);
            const lightColor = mockCtx.strokeStyle;

            mockCtx.strokeStyle = '';
            renderer.setDarkMode(true);
            renderer.drawConnections(connections, components);
            const darkColor = mockCtx.strokeStyle;

            expect(lightColor).toBe(darkColor);
            expect(lightColor).toBe(COLORS.VALUE_ON);
        });

        it('uses same VALUE_OFF color in both modes for inactive signal', () => {
            const componentsOff = [
                { ...components[0], value: 0 },
                components[1]
            ];

            renderer.setDarkMode(false);
            renderer.drawConnections(connections, componentsOff);
            const lightColor = mockCtx.strokeStyle;

            mockCtx.strokeStyle = '';
            renderer.setDarkMode(true);
            renderer.drawConnections(connections, componentsOff);
            const darkColor = mockCtx.strokeStyle;

            expect(lightColor).toBe(darkColor);
            expect(lightColor).toBe(COLORS.VALUE_OFF);
        });
    });
});
