/**
 * Circuit Builder Helpers for E2E Tests
 *
 * Provides utilities for building test circuits via localStorage injection
 * and UI interactions.
 */

/**
 * Create a basic AND gate circuit with 2 inputs and 1 output
 * @returns {Object} Circuit state object
 */
export function createAndGateCircuit() {
    return {
        components: [
            {
                id: 1,
                type: 'INPUT',
                x: 150,
                y: 200,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 200 }],
                label: 'I1',
                customName: null,
                customDefinition: null
            },
            {
                id: 2,
                type: 'INPUT',
                x: 150,
                y: 300,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 300 }],
                label: 'I2',
                customName: null,
                customDefinition: null
            },
            {
                id: 3,
                type: 'AND',
                x: 350,
                y: 250,
                value: null,
                inputs: [{ x: 323, y: 235 }, { x: 323, y: 265 }],
                outputs: [{ x: 373, y: 250 }],
                label: null,
                customName: null,
                customDefinition: null
            },
            {
                id: 4,
                type: 'OUTPUT',
                x: 550,
                y: 250,
                value: null,
                inputs: [{ x: 528, y: 250 }],
                outputs: [],
                label: 'O1',
                customName: null,
                customDefinition: null
            }
        ],
        connections: [
            { from: 1, fromPort: 0, to: 3, toPort: 0 },
            { from: 2, fromPort: 0, to: 3, toPort: 1 },
            { from: 3, fromPort: 0, to: 4, toPort: 0 }
        ],
        nextId: 5,
        truthTablePanelState: null,
        currentBoardName: null,
        currentComponentName: null,
        customComponents: {},
        lastSavedState: null,
        isAutoCycling: false
    };
}

/**
 * Create a circuit with 3 inputs for more row tests
 * @returns {Object} Circuit state object
 */
export function createThreeInputCircuit() {
    return {
        components: [
            {
                id: 1,
                type: 'INPUT',
                x: 150,
                y: 150,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 150 }],
                label: 'A',
                customName: null,
                customDefinition: null
            },
            {
                id: 2,
                type: 'INPUT',
                x: 150,
                y: 250,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 250 }],
                label: 'B',
                customName: null,
                customDefinition: null
            },
            {
                id: 3,
                type: 'INPUT',
                x: 150,
                y: 350,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 350 }],
                label: 'C',
                customName: null,
                customDefinition: null
            },
            {
                id: 4,
                type: 'AND',
                x: 350,
                y: 200,
                value: null,
                inputs: [{ x: 323, y: 185 }, { x: 323, y: 215 }],
                outputs: [{ x: 373, y: 200 }],
                label: null,
                customName: null,
                customDefinition: null
            },
            {
                id: 5,
                type: 'AND',
                x: 500,
                y: 275,
                value: null,
                inputs: [{ x: 473, y: 260 }, { x: 473, y: 290 }],
                outputs: [{ x: 523, y: 275 }],
                label: null,
                customName: null,
                customDefinition: null
            },
            {
                id: 6,
                type: 'OUTPUT',
                x: 650,
                y: 275,
                value: null,
                inputs: [{ x: 628, y: 275 }],
                outputs: [],
                label: 'Q',
                customName: null,
                customDefinition: null
            }
        ],
        connections: [
            { from: 1, fromPort: 0, to: 4, toPort: 0 },
            { from: 2, fromPort: 0, to: 4, toPort: 1 },
            { from: 4, fromPort: 0, to: 5, toPort: 0 },
            { from: 3, fromPort: 0, to: 5, toPort: 1 },
            { from: 5, fromPort: 0, to: 6, toPort: 0 }
        ],
        nextId: 7,
        truthTablePanelState: null,
        currentBoardName: null,
        currentComponentName: null,
        customComponents: {},
        lastSavedState: null,
        isAutoCycling: false
    };
}

/**
 * Create an invalid circuit (input not connected to output)
 * @returns {Object} Circuit state object
 */
export function createInvalidCircuit() {
    return {
        components: [
            {
                id: 1,
                type: 'INPUT',
                x: 150,
                y: 200,
                value: 0,
                inputs: [],
                outputs: [{ x: 173, y: 200 }],
                label: 'I1',
                customName: null,
                customDefinition: null
            },
            {
                id: 2,
                type: 'OUTPUT',
                x: 550,
                y: 250,
                value: null,
                inputs: [{ x: 528, y: 250 }],
                outputs: [],
                label: 'O1',
                customName: null,
                customDefinition: null
            }
        ],
        connections: [], // No connections - invalid
        nextId: 3,
        truthTablePanelState: null,
        currentBoardName: null,
        currentComponentName: null,
        customComponents: {},
        lastSavedState: null,
        isAutoCycling: false
    };
}

/**
 * Create a large circuit with 5 inputs (32 rows in truth table)
 * @returns {Object} Circuit state object
 */
export function createLargeCircuit() {
    const components = [];
    const connections = [];
    let nextId = 1;

    // Create 5 inputs
    for (let i = 0; i < 5; i++) {
        components.push({
            id: nextId,
            type: 'INPUT',
            x: 100,
            y: 100 + i * 80,
            value: 0,
            inputs: [],
            outputs: [{ x: 123, y: 100 + i * 80 }],
            label: `I${i + 1}`,
            customName: null,
            customDefinition: null
        });
        nextId++;
    }

    // Create a chain of AND gates
    let prevGateId = null;
    for (let i = 0; i < 4; i++) {
        const gateId = nextId;
        const gateY = 140 + i * 80;
        components.push({
            id: gateId,
            type: 'AND',
            x: 250 + i * 150,
            y: gateY,
            value: null,
            inputs: [
                { x: 223 + i * 150, y: gateY - 15 },
                { x: 223 + i * 150, y: gateY + 15 }
            ],
            outputs: [{ x: 273 + i * 150, y: gateY }],
            label: null,
            customName: null,
            customDefinition: null
        });

        if (i === 0) {
            // First gate connects to first two inputs
            connections.push({ from: 1, fromPort: 0, to: gateId, toPort: 0 });
            connections.push({ from: 2, fromPort: 0, to: gateId, toPort: 1 });
        } else {
            // Subsequent gates connect to previous gate output and next input
            connections.push({ from: prevGateId, fromPort: 0, to: gateId, toPort: 0 });
            connections.push({ from: i + 2, fromPort: 0, to: gateId, toPort: 1 });
        }

        prevGateId = gateId;
        nextId++;
    }

    // Add output
    components.push({
        id: nextId,
        type: 'OUTPUT',
        x: 850,
        y: 260,
        value: null,
        inputs: [{ x: 828, y: 260 }],
        outputs: [],
        label: 'OUT',
        customName: null,
        customDefinition: null
    });
    connections.push({ from: prevGateId, fromPort: 0, to: nextId, toPort: 0 });
    nextId++;

    return {
        components,
        connections,
        nextId,
        truthTablePanelState: null,
        currentBoardName: null,
        currentComponentName: null,
        customComponents: {},
        lastSavedState: null,
        isAutoCycling: false
    };
}

/**
 * Load a circuit into the page via localStorage
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} circuitState - Circuit state object
 */
export async function loadCircuit(page, circuitState) {
    // The app stores data double-stringified:
    // - AutoSaveManager does JSON.stringify(boardData)
    // - LocalStorageAdapter.setItem does JSON.stringify(value) again
    // So we need to match that format: store as JSON.stringify(JSON.stringify(state))
    await page.evaluate((state) => {
        // Double-stringify to match the app's format
        localStorage.setItem('currentBoard', JSON.stringify(JSON.stringify(state)));
    }, circuitState);

    // Reload to pick up the circuit
    await page.reload();
    await page.waitForSelector('#breadboard', { timeout: 10000 });

    // Wait for the circuit to be loaded (check for components being rendered)
    await page.waitForTimeout(1000); // Give the app time to process localStorage and render
}

/**
 * Clear localStorage and reload page
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function clearCircuit(page) {
    await page.evaluate(() => {
        localStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('#breadboard');
}

/**
 * Add a component to the existing circuit via UI
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} type - Component type (INPUT, OUTPUT, AND, OR, etc.)
 * @param {number} canvasX - X position in canvas coordinates
 * @param {number} canvasY - Y position in canvas coordinates
 */
export async function addComponent(page, type, canvasX, canvasY) {
    // Click the appropriate toolbar button
    if (type === 'INPUT') {
        await page.getByRole('button', { name: 'Input' }).click();
    } else if (type === 'OUTPUT') {
        await page.getByRole('button', { name: 'Output' }).click();
    } else {
        await page.getByRole('button', { name: type, exact: true }).click();
    }

    // Get canvas position and scale
    const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('#breadboard');
        const rect = canvas.getBoundingClientRect();
        return {
            screenX: rect.x,
            screenY: rect.y,
            scaleX: canvas.width / rect.width,
            scaleY: canvas.height / rect.height
        };
    });

    // Convert canvas coords to screen coords and click
    const screenX = canvasX / canvasInfo.scaleX + canvasInfo.screenX;
    const screenY = canvasY / canvasInfo.scaleY + canvasInfo.screenY;
    await page.mouse.click(screenX, screenY);
}

/**
 * Delete a component via UI
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} canvasX - X position of component in canvas coordinates
 * @param {number} canvasY - Y position of component in canvas coordinates
 */
export async function deleteComponent(page, canvasX, canvasY) {
    // Enter delete mode
    await page.getByRole('button', { name: 'Delete Mode' }).click();

    // Get canvas position and scale
    const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('#breadboard');
        const rect = canvas.getBoundingClientRect();
        return {
            screenX: rect.x,
            screenY: rect.y,
            scaleX: canvas.width / rect.width,
            scaleY: canvas.height / rect.height
        };
    });

    // Click on the component
    const screenX = canvasX / canvasInfo.scaleX + canvasInfo.screenX;
    const screenY = canvasY / canvasInfo.scaleY + canvasInfo.screenY;
    await page.mouse.click(screenX, screenY);
}

/**
 * Rename a component by clicking on it
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} componentId - Component ID
 * @param {string} newLabel - New label
 */
export async function renameComponent(page, componentId, newLabel) {
    // This would require double-clicking the component and editing the label
    // For simplicity, we'll modify via localStorage
    await page.evaluate(({ componentId, newLabel }) => {
        const state = JSON.parse(localStorage.getItem('currentBoard'));
        const component = state.components.find(c => c.id === componentId);
        if (component) {
            component.label = newLabel;
            localStorage.setItem('currentBoard', JSON.stringify(state));
        }
    }, { componentId, newLabel });
    await page.reload();
    await page.waitForSelector('#breadboard');
}
