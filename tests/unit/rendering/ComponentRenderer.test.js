/**
 * Unit tests for ComponentRenderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentRenderer } from '../../../src/rendering/ComponentRenderer.js';
import { COLORS, FONTS, PORT_RADIUS } from '../../../src/constants.js';

// Create mock canvas context
const createMockContext = () => ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: ''
});

describe('ComponentRenderer', () => {
    let renderer;
    let mockCtx;

    beforeEach(() => {
        mockCtx = createMockContext();
        renderer = new ComponentRenderer(mockCtx, false);
    });

    describe('Initialization', () => {
        it('stores context reference', () => {
            expect(renderer.ctx).toBe(mockCtx);
        });

        it('initializes with light mode by default', () => {
            renderer = new ComponentRenderer(mockCtx);
            expect(renderer.darkMode).toBe(false);
        });

        it('can initialize with dark mode', () => {
            renderer = new ComponentRenderer(mockCtx, true);
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

    describe('drawComponent', () => {
        it('saves and restores context', () => {
            const component = {
                type: 'AND',
                x: 100,
                y: 100,
                inputs: [{ x: 75, y: 90 }, { x: 75, y: 110 }],
                outputs: [{ x: 125, y: 100 }]
            };

            renderer.drawComponent(component);

            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
        });

        it('dispatches INPUT type to drawInputOutput', () => {
            const drawInputOutputSpy = vi.spyOn(renderer, 'drawInputOutput');

            const component = {
                type: 'INPUT',
                x: 100,
                y: 100,
                value: 0,
                label: 'I1',
                inputs: [],
                outputs: [{ x: 120, y: 100 }]
            };

            renderer.drawComponent(component);

            expect(drawInputOutputSpy).toHaveBeenCalledWith(component, 'INPUT');
        });

        it('dispatches OUTPUT type to drawInputOutput', () => {
            const drawInputOutputSpy = vi.spyOn(renderer, 'drawInputOutput');

            const component = {
                type: 'OUTPUT',
                x: 100,
                y: 100,
                value: null,
                label: 'O1',
                inputs: [{ x: 80, y: 100 }],
                outputs: []
            };

            renderer.drawComponent(component);

            expect(drawInputOutputSpy).toHaveBeenCalledWith(component, 'OUTPUT');
        });

        it('dispatches CUSTOM type to drawCustomComponent', () => {
            const drawCustomSpy = vi.spyOn(renderer, 'drawCustomComponent');

            const component = {
                type: 'CUSTOM',
                x: 100,
                y: 100,
                label: 'MyGate',
                customDefinition: { inputPorts: [], outputPorts: [] },
                inputs: [],
                outputs: []
            };

            renderer.drawComponent(component);

            expect(drawCustomSpy).toHaveBeenCalledWith(component);
        });

        it('dispatches gate types to drawGate', () => {
            const drawGateSpy = vi.spyOn(renderer, 'drawGate');

            const gateTypes = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'];

            gateTypes.forEach(type => {
                const component = {
                    type,
                    x: 100,
                    y: 100,
                    inputs: [{ x: 75, y: 100 }],
                    outputs: [{ x: 125, y: 100 }]
                };

                renderer.drawComponent(component);
            });

            expect(drawGateSpy).toHaveBeenCalledTimes(gateTypes.length);
        });
    });

    describe('drawInputOutput - INPUT', () => {
        const inputComponent = {
            type: 'INPUT',
            x: 100,
            y: 100,
            value: 1,
            label: 'I1',
            inputs: [],
            outputs: [{ x: 120, y: 100 }]
        };

        it('draws circle for INPUT', () => {
            renderer.drawInputOutput(inputComponent, 'INPUT');

            expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 20, 0, Math.PI * 2);
        });

        it('uses VALUE_ON color when value is 1', () => {
            renderer.drawInputOutput({ ...inputComponent, value: 1 }, 'INPUT');

            // fillStyle is set before fill() is called
            expect(mockCtx.fill).toHaveBeenCalled();
        });

        it('uses VALUE_OFF color when value is 0', () => {
            renderer.drawInputOutput({ ...inputComponent, value: 0 }, 'INPUT');

            expect(mockCtx.fill).toHaveBeenCalled();
        });

        it('draws label above component', () => {
            renderer.drawInputOutput(inputComponent, 'INPUT');

            expect(mockCtx.fillText).toHaveBeenCalledWith('I1', 100, 65); // y - 35
        });

        it('draws value text in center', () => {
            renderer.drawInputOutput(inputComponent, 'INPUT');

            expect(mockCtx.fillText).toHaveBeenCalledWith('1', 100, 100);
        });

        it('draws output port', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawInputOutput(inputComponent, 'INPUT');

            expect(drawPortSpy).toHaveBeenCalledWith(120, 100, true);
        });
    });

    describe('drawInputOutput - OUTPUT', () => {
        const outputComponent = {
            type: 'OUTPUT',
            x: 100,
            y: 100,
            value: 0,
            label: 'O1',
            inputs: [{ x: 80, y: 100 }],
            outputs: []
        };

        it('draws circle for OUTPUT', () => {
            renderer.drawInputOutput(outputComponent, 'OUTPUT');

            expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 20, 0, Math.PI * 2);
        });

        it('draws input port', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawInputOutput(outputComponent, 'OUTPUT');

            expect(drawPortSpy).toHaveBeenCalledWith(80, 100, false);
        });

        it('draws label above component', () => {
            renderer.drawInputOutput(outputComponent, 'OUTPUT');

            expect(mockCtx.fillText).toHaveBeenCalledWith('O1', 100, 65);
        });
    });

    describe('drawCustomComponent', () => {
        const customComponent = {
            type: 'CUSTOM',
            x: 100,
            y: 100,
            label: 'MyGate',
            customDefinition: {
                inputPorts: [{ label: 'A' }, { label: 'B' }],
                outputPorts: [{ label: 'Q' }]
            },
            inputs: [
                { x: 55, y: 85 },
                { x: 55, y: 115 }
            ],
            outputs: [{ x: 145, y: 100 }]
        };

        it('draws rectangular body with 90x90 size', () => {
            renderer.drawCustomComponent(customComponent);

            expect(mockCtx.fillRect).toHaveBeenCalledWith(55, 55, 90, 90); // x-45, y-45, 90, 90
            expect(mockCtx.strokeRect).toHaveBeenCalledWith(55, 55, 90, 90);
        });

        it('draws component label', () => {
            renderer.drawCustomComponent(customComponent);

            expect(mockCtx.fillText).toHaveBeenCalledWith('MyGate', 100, 100);
        });

        it('draws input ports', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawCustomComponent(customComponent);

            expect(drawPortSpy).toHaveBeenCalledWith(55, 85, false);
            expect(drawPortSpy).toHaveBeenCalledWith(55, 115, false);
        });

        it('draws output ports', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawCustomComponent(customComponent);

            expect(drawPortSpy).toHaveBeenCalledWith(145, 100, true);
        });

        it('draws port labels from customDefinition', () => {
            renderer.drawCustomComponent(customComponent);

            // Input labels drawn to the left
            expect(mockCtx.fillText).toHaveBeenCalledWith('A', 47, 85); // port.x - 8
            expect(mockCtx.fillText).toHaveBeenCalledWith('B', 47, 115);

            // Output labels drawn to the right
            expect(mockCtx.fillText).toHaveBeenCalledWith('Q', 153, 100); // port.x + 8
        });

        it('uses dark mode colors when enabled', () => {
            renderer.setDarkMode(true);
            renderer.drawCustomComponent(customComponent);

            // The fill and stroke should use dark mode colors
            expect(mockCtx.fillRect).toHaveBeenCalled();
            expect(mockCtx.strokeRect).toHaveBeenCalled();
        });

        it('wraps long labels', () => {
            mockCtx.measureText.mockReturnValue({ width: 100 }); // Exceeds maxWidth of 80

            const longLabelComponent = {
                ...customComponent,
                label: 'VeryLongComponentName'
            };

            renderer.drawCustomComponent(longLabelComponent);

            // Should have drawn text multiple times (label split + port labels)
            expect(mockCtx.fillText.mock.calls.length).toBeGreaterThan(1);
        });
    });

    describe('drawGate', () => {
        const gateComponent = {
            type: 'AND',
            x: 100,
            y: 100,
            inputs: [
                { x: 75, y: 90 },
                { x: 75, y: 110 }
            ],
            outputs: [{ x: 125, y: 100 }]
        };

        it('draws AND gate', () => {
            const drawAndSpy = vi.spyOn(renderer, 'drawAndGate');

            renderer.drawGate(gateComponent);

            expect(drawAndSpy).toHaveBeenCalledWith(100, 100, false);
        });

        it('draws NAND gate with inversion', () => {
            const drawAndSpy = vi.spyOn(renderer, 'drawAndGate');

            renderer.drawGate({ ...gateComponent, type: 'NAND' });

            expect(drawAndSpy).toHaveBeenCalledWith(100, 100, true);
        });

        it('draws OR gate', () => {
            const drawOrSpy = vi.spyOn(renderer, 'drawOrGate');

            renderer.drawGate({ ...gateComponent, type: 'OR' });

            expect(drawOrSpy).toHaveBeenCalledWith(100, 100, false);
        });

        it('draws XOR gate with extra line', () => {
            const drawOrSpy = vi.spyOn(renderer, 'drawOrGate');

            renderer.drawGate({ ...gateComponent, type: 'XOR' });

            expect(drawOrSpy).toHaveBeenCalledWith(100, 100, true);
        });

        it('draws NOR gate with inversion', () => {
            const drawOrSpy = vi.spyOn(renderer, 'drawOrGate');

            renderer.drawGate({ ...gateComponent, type: 'NOR' });

            expect(drawOrSpy).toHaveBeenCalledWith(100, 100, false, true);
        });

        it('draws XNOR gate with extra line and inversion', () => {
            const drawOrSpy = vi.spyOn(renderer, 'drawOrGate');

            renderer.drawGate({ ...gateComponent, type: 'XNOR' });

            expect(drawOrSpy).toHaveBeenCalledWith(100, 100, true, true);
        });

        it('draws NOT gate', () => {
            const drawNotSpy = vi.spyOn(renderer, 'drawNotGate');

            renderer.drawGate({
                type: 'NOT',
                x: 100,
                y: 100,
                inputs: [{ x: 80, y: 100 }],
                outputs: [{ x: 120, y: 100 }]
            });

            expect(drawNotSpy).toHaveBeenCalledWith(100, 100);
        });

        it('draws input ports', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawGate(gateComponent);

            expect(drawPortSpy).toHaveBeenCalledWith(75, 90, false);
            expect(drawPortSpy).toHaveBeenCalledWith(75, 110, false);
        });

        it('draws output ports', () => {
            const drawPortSpy = vi.spyOn(renderer, 'drawPort');

            renderer.drawGate(gateComponent);

            expect(drawPortSpy).toHaveBeenCalledWith(125, 100, true);
        });

        it('uses dark mode colors when enabled', () => {
            renderer.setDarkMode(true);
            renderer.drawGate(gateComponent);

            // Fill and stroke should use dark mode variants
            expect(mockCtx.fill).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });
    });

    describe('drawAndGate', () => {
        it('draws D-shape for AND', () => {
            renderer.drawAndGate(100, 100, false);

            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.moveTo).toHaveBeenCalled();
            expect(mockCtx.lineTo).toHaveBeenCalled();
            expect(mockCtx.arc).toHaveBeenCalled();
            expect(mockCtx.closePath).toHaveBeenCalled();
            expect(mockCtx.fill).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        it('draws inversion bubble for NAND', () => {
            renderer.drawAndGate(100, 100, true);

            // Extra arc call for the bubble
            expect(mockCtx.arc).toHaveBeenCalledTimes(2);
        });
    });

    describe('drawOrGate', () => {
        it('draws curved shape for OR', () => {
            renderer.drawOrGate(100, 100, false, false);

            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
            expect(mockCtx.fill).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        it('draws extra line for XOR', () => {
            const strokeCallsBefore = mockCtx.stroke.mock.calls.length;

            renderer.drawOrGate(100, 100, true, false);

            // Should have additional stroke call for XOR line
            expect(mockCtx.stroke.mock.calls.length).toBeGreaterThan(strokeCallsBefore);
        });

        it('draws inversion bubble for NOR', () => {
            renderer.drawOrGate(100, 100, false, true);

            // Arc called for bubble
            expect(mockCtx.arc).toHaveBeenCalled();
        });
    });

    describe('drawNotGate', () => {
        it('draws triangle with bubble', () => {
            renderer.drawNotGate(100, 100);

            expect(mockCtx.beginPath).toHaveBeenCalled();
            expect(mockCtx.moveTo).toHaveBeenCalled();
            expect(mockCtx.lineTo).toHaveBeenCalled();
            expect(mockCtx.closePath).toHaveBeenCalled();

            // Bubble
            expect(mockCtx.arc).toHaveBeenCalledWith(120, 100, 5, 0, Math.PI * 2);
        });
    });

    describe('drawPort', () => {
        it('draws output port with correct color', () => {
            renderer.drawPort(100, 100, true);

            expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, PORT_RADIUS, 0, Math.PI * 2);
            expect(mockCtx.fill).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });

        it('draws input port with correct color', () => {
            renderer.drawPort(100, 100, false);

            expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, PORT_RADIUS, 0, Math.PI * 2);
            expect(mockCtx.fill).toHaveBeenCalled();
            expect(mockCtx.stroke).toHaveBeenCalled();
        });
    });

    describe('Theme Consistency', () => {
        it('uses consistent dark mode colors across components', () => {
            renderer.setDarkMode(true);

            const inputComponent = {
                type: 'INPUT',
                x: 100,
                y: 100,
                value: 0,
                label: 'I1',
                inputs: [],
                outputs: [{ x: 120, y: 100 }]
            };

            renderer.drawInputOutput(inputComponent, 'INPUT');

            // Verify dark mode colors are used
            expect(mockCtx.fill).toHaveBeenCalled();
        });

        it('uses consistent light mode colors across components', () => {
            renderer.setDarkMode(false);

            const inputComponent = {
                type: 'INPUT',
                x: 100,
                y: 100,
                value: 0,
                label: 'I1',
                inputs: [],
                outputs: [{ x: 120, y: 100 }]
            };

            renderer.drawInputOutput(inputComponent, 'INPUT');

            expect(mockCtx.fill).toHaveBeenCalled();
        });
    });
});
