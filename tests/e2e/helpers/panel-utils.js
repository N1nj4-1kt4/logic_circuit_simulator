/**
 * Truth Table Panel Utilities for E2E Tests
 *
 * Provides utilities for interacting with and asserting on the Truth Table panel.
 */

/**
 * Open the Truth Table panel
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function openTruthTable(page) {
    await page.getByRole('button', { name: 'Truth Table' }).click();
    await page.waitForSelector('#truthTablePanel:not(.hidden)', { state: 'visible', timeout: 5000 });

    // Wait for computing to finish (wait for "Computing" text to disappear or table to render)
    await page.waitForFunction(() => {
        const panel = document.getElementById('truthTablePanel');
        if (!panel) return false;
        const content = panel.textContent;
        // Not computing anymore if we have tabulator rows or no "Computing" text
        const hasRows = document.querySelectorAll('.tabulator-row').length > 0;
        const isComputing = content.includes('Computing');
        return hasRows || !isComputing;
    }, { timeout: 10000 }).catch(() => {
        // May timeout if circuit is invalid - that's ok
    });
}

/**
 * Close the Truth Table panel
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function closeTruthTable(page) {
    const closeButton = page.locator('#closeTruthTable');
    await closeButton.click();
    // Wait for panel to have 'hidden' class (meaning it's hidden)
    await page.waitForFunction(() => {
        const panel = document.getElementById('truthTablePanel');
        return panel && panel.classList.contains('hidden');
    }, { timeout: 5000 });
}

/**
 * Check if Truth Table panel is visible
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function isPanelVisible(page) {
    const panel = page.locator('#truthTablePanel');
    return await panel.isVisible();
}

/**
 * Get panel position and dimensions
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
export async function getPanelPosition(page) {
    return await page.evaluate(() => {
        const panel = document.getElementById('truthTablePanel');
        if (!panel) return null;
        const rect = panel.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
        };
    });
}

/**
 * Get computed row height from table
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<number|null>}
 */
export async function getRowHeight(page) {
    return await page.evaluate(() => {
        const row = document.querySelector('.tabulator-row');
        if (!row) return null;
        return row.offsetHeight;
    });
}

/**
 * Get full panel state for comparison
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<{x: number, y: number, width: number, height: number, rowHeight: number|null, columnOrder: string[]}>}
 */
export async function getFullPanelState(page) {
    const position = await getPanelPosition(page);
    const rowHeight = await getRowHeight(page);
    const columnOrder = await getColumnOrder(page);
    return { ...position, rowHeight, columnOrder };
}

/**
 * Drag the panel by its header
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} deltaX - Pixels to move horizontally
 * @param {number} deltaY - Pixels to move vertically
 */
export async function dragPanel(page, deltaX, deltaY) {
    const header = page.locator('#truthTablePanel .panel-header');
    const headerBox = await header.boundingBox();

    const startX = headerBox.x + headerBox.width / 2;
    const startY = headerBox.y + headerBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();

    // Wait for state to save
    await page.waitForTimeout(300);
}

/**
 * Resize the panel by dragging its edge
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} newWidth - New width (0 to keep current)
 * @param {number} newHeight - New height (0 to keep current)
 */
export async function resizePanel(page, newWidth, newHeight) {
    const position = await getPanelPosition(page);
    if (!position) return;

    // Resize via right edge for width
    if (newWidth > 0) {
        const startX = position.x + position.width - 2;
        const startY = position.y + position.height / 2;
        const deltaX = newWidth - position.width;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + deltaX, startY, { steps: 10 });
        await page.mouse.up();
    }

    // Resize via bottom edge for height
    if (newHeight > 0) {
        const updatedPosition = await getPanelPosition(page);
        const startX = updatedPosition.x + updatedPosition.width / 2;
        const startY = updatedPosition.y + updatedPosition.height - 2;
        const deltaY = newHeight - updatedPosition.height;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + deltaY, { steps: 10 });
        await page.mouse.up();
    }

    // Wait for state to save
    await page.waitForTimeout(300);
}

/**
 * Get the column headers in order
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<string[]>}
 */
export async function getColumnOrder(page) {
    return await page.evaluate(() => {
        // Try multiple selectors for column headers
        let headers = document.querySelectorAll('.tabulator-col:not(.tabulator-col-group) .tabulator-col-title');
        if (headers.length === 0) {
            // Alternative: look for column headers in the header row
            headers = document.querySelectorAll('.tabulator-header .tabulator-col-title');
        }
        if (headers.length === 0) {
            // Try looking for any visible column headers
            headers = document.querySelectorAll('[class*="tabulator"] [class*="col-title"]');
        }
        return Array.from(headers).map(h => h.textContent.trim()).filter(t => t && t !== 'Inputs' && t !== 'Outputs');
    });
}

/**
 * Reorder a column by dragging
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} columnName - Name of column to drag
 * @param {number} targetIndex - Target position index (0-based)
 */
export async function reorderColumn(page, columnName, targetIndex) {
    // Find the column header
    const columns = await page.locator('.tabulator-col:not(.tabulator-col-group)').all();

    let sourceCol = null;
    let sourceIndex = -1;
    for (let i = 0; i < columns.length; i++) {
        const text = await columns[i].locator('.tabulator-col-title').textContent();
        if (text.trim() === columnName) {
            sourceCol = columns[i];
            sourceIndex = i;
            break;
        }
    }

    if (!sourceCol || sourceIndex === targetIndex) return;

    const sourceBox = await sourceCol.boundingBox();
    const targetCol = columns[targetIndex];
    const targetBox = await targetCol.boundingBox();

    // Drag from source to target
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
    await page.mouse.up();

    // Wait for state to save
    await page.waitForTimeout(300);
}

/**
 * Get table data as 2D array
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<string[][]>}
 */
export async function getTableData(page) {
    return await page.evaluate(() => {
        const rows = document.querySelectorAll('.tabulator-row');
        return Array.from(rows).map(row => {
            const cells = row.querySelectorAll('.tabulator-cell');
            return Array.from(cells).map(cell => cell.textContent.trim());
        });
    });
}

/**
 * Get the number of rows in the table
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<number>}
 */
export async function getRowCount(page) {
    return await page.evaluate(() => {
        return document.querySelectorAll('.tabulator-row').length;
    });
}

/**
 * Get the index of the highlighted row (0-based)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<number|null>}
 */
export async function getHighlightedRowIndex(page) {
    return await page.evaluate(() => {
        const rows = document.querySelectorAll('.tabulator-row');
        for (let i = 0; i < rows.length; i++) {
            // Tabulator uses 'tabulator-selected' class for selected rows
            if (rows[i].classList.contains('tabulator-selected') ||
                rows[i].classList.contains('truth-table-highlight') ||
                rows[i].style.backgroundColor.includes('rgba')) {
                return i;
            }
        }
        return null;
    });
}

/**
 * Check if the panel shows an invalid circuit message
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function showsInvalidMessage(page) {
    const panel = page.locator('#truthTablePanel');
    const text = await panel.textContent();
    return text.includes('Invalid') || text.includes('invalid') ||
        text.includes('not valid') || text.includes('incomplete');
}

/**
 * Check if the panel shows a computing/progress indicator
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function showsComputingIndicator(page) {
    const panel = page.locator('#truthTablePanel');
    const text = await panel.textContent();
    return text.includes('Computing') || text.includes('computing') ||
        text.includes('Loading') || text.includes('Progress');
}

/**
 * Wait for table to finish rendering
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} expectedRows - Expected number of rows
 * @param {number} timeout - Timeout in ms
 */
export async function waitForTableRows(page, expectedRows, timeout = 5000) {
    await page.waitForFunction(
        (expected) => document.querySelectorAll('.tabulator-row').length === expected,
        expectedRows,
        { timeout }
    );
}

/**
 * Click Step button in simulation controls
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function clickStepButton(page) {
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(100);
}

/**
 * Click Reset button in simulation controls
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function clickResetButton(page) {
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.waitForTimeout(100);
}

/**
 * Start auto-cycle simulation
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function startAutoCycle(page) {
    await page.getByRole('button', { name: 'Simulation' }).click();
    await page.waitForTimeout(100);
}

/**
 * Toggle dark/light theme
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function toggleTheme(page) {
    // Theme toggle button has id="themeToggle"
    const themeButton = page.locator('#themeToggle');
    await themeButton.click();
    await page.waitForTimeout(200);
}

/**
 * Check if page is in dark mode
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<boolean>}
 */
export async function isDarkMode(page) {
    return await page.evaluate(() => {
        return document.body.classList.contains('dark-mode') ||
            document.documentElement.classList.contains('dark-mode') ||
            document.body.getAttribute('data-theme') === 'dark';
    });
}

/**
 * Collect console errors
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {string[]} Array to collect errors into
 */
export function setupConsoleErrorCollector(page) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // Ignore favicon errors
            if (!text.includes('favicon')) {
                errors.push(text);
            }
        }
    });
    return errors;
}

/**
 * Save the current board
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} boardName - Name for the board
 */
export async function saveBoard(page, boardName) {
    await page.getByRole('button', { name: 'Save Board' }).click();
    // Handle save dialog if it appears
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dialog.locator('input').fill(boardName);
        await dialog.getByRole('button', { name: 'Save' }).click();
    }
    await page.waitForTimeout(300);
}

/**
 * Clear the board
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function clearBoard(page) {
    await page.getByRole('button', { name: 'Clear Board' }).click();
    // Handle confirmation if needed
    const confirmBtn = page.getByRole('button', { name: 'Confirm' });
    if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirmBtn.click();
    }
    await page.waitForTimeout(300);
}

/**
 * Get truthTablePanelState directly from localStorage
 * This allows verification that state was persisted before page reload
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<Object|null>} The persisted panel state
 */
export async function getPersistedPanelState(page) {
    return await page.evaluate(() => {
        const boardData = localStorage.getItem('currentBoard');
        if (!boardData) return null;
        try {
            const state = JSON.parse(JSON.parse(boardData));
            return state.truthTablePanelState || null;
        } catch {
            return null;
        }
    });
}

/**
 * Wait for localStorage to contain truthTablePanelState matching expected values
 * Polls localStorage instead of using arbitrary timeouts
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} expected - Object with expected values { x?, y?, width?, height?, columnOrder? }
 * @param {number} tolerance - Tolerance for numeric comparisons (default 5)
 * @param {number} timeout - Max wait time in ms (default 3000)
 */
export async function waitForPersistedState(page, expected, tolerance = 5, timeout = 3000) {
    await page.waitForFunction(
        ({ expected, tolerance }) => {
            const boardData = localStorage.getItem('currentBoard');
            if (!boardData) return false;
            try {
                const state = JSON.parse(JSON.parse(boardData));
                const panelState = state.truthTablePanelState;
                if (!panelState) return false;

                // Check x position if expected
                if (expected.x !== undefined) {
                    const actualX = panelState.x;
                    if (Math.abs(actualX - expected.x) > tolerance) return false;
                }

                // Check y position if expected
                if (expected.y !== undefined) {
                    const actualY = panelState.y;
                    if (Math.abs(actualY - expected.y) > tolerance) return false;
                }

                // Check width if expected
                if (expected.width !== undefined) {
                    const actualWidth = parseInt(panelState.width);
                    if (Math.abs(actualWidth - expected.width) > tolerance) return false;
                }

                // Check height if expected
                if (expected.height !== undefined) {
                    const actualHeight = parseInt(panelState.height);
                    if (Math.abs(actualHeight - expected.height) > tolerance) return false;
                }

                // Check column order if expected
                if (expected.columnOrder !== undefined) {
                    const actualOrder = panelState.columnOrder || [];
                    if (JSON.stringify(actualOrder) !== JSON.stringify(expected.columnOrder)) return false;
                }

                return true;
            } catch {
                return false;
            }
        },
        { expected, tolerance },
        { timeout }
    );
}
