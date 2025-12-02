/**
 * SVG Icon Utilities
 * Reusable SVG icon definitions for UI components
 */

/**
 * Get left arrow SVG icon
 * @param {string} color - Fill color for the arrow
 * @returns {string} SVG markup
 */
export function getLeftArrowSVG(color = 'currentColor') {
    return `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L6 10L12 16" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

/**
 * Get right arrow SVG icon
 * @param {string} color - Fill color for the arrow
 * @returns {string} SVG markup
 */
export function getRightArrowSVG(color = 'currentColor') {
    return `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 4L14 10L8 16" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}
