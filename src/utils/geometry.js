/**
 * Geometric utility functions
 * Pure functions with no side effects
 */

import { GATE_SIZES } from '../constants.js';

/**
 * Get component dimensions (half-width and half-height) for a given type
 * @param {string} type - Component type (AND, OR, NOT, INPUT, OUTPUT, CUSTOM, etc.)
 * @returns {{halfWidth: number, halfHeight: number}} Component dimensions
 */
export function getComponentDimensions(type) {
    const sizes = GATE_SIZES[type];
    if (sizes) {
        return { halfWidth: sizes.halfWidth, halfHeight: sizes.halfHeight };
    }
    // Default fallback for unknown types (standard gate size)
    return { halfWidth: 25, halfHeight: 20 };
}

/**
 * Calculate distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Distance
 */
export function pointDistance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Calculate distance from point to line segment
 * @param {number} x - Point x
 * @param {number} y - Point y
 * @param {number} x1 - Line start x
 * @param {number} y1 - Line start y
 * @param {number} x2 - Line end x
 * @param {number} y2 - Line end y
 * @returns {number} Distance from point to line
 */
export function distanceToLine(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get bounding box for an array of components
 * @param {Array} components - Array of component objects
 * @param {HTMLCanvasElement} canvas - Canvas element for viewport conversion
 * @returns {Object|null} Bounding box {left, top, right, bottom, width, height} or null if no components
 */
export function getComponentsBoundingBox(components, canvas) {
    if (components.length === 0) {
        return null;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    components.forEach(component => {
        const { x, y, type } = component;
        const { halfWidth, halfHeight } = getComponentDimensions(type);

        minX = Math.min(minX, x - halfWidth);
        minY = Math.min(minY, y - halfHeight);
        maxX = Math.max(maxX, x + halfWidth);
        maxY = Math.max(maxY, y + halfHeight);
    });

    // Convert canvas coordinates to viewport coordinates
    const canvasRect = canvas.getBoundingClientRect();

    return {
        left: canvasRect.left + (minX / canvas.width) * canvasRect.width,
        top: canvasRect.top + (minY / canvas.height) * canvasRect.height,
        right: canvasRect.left + (maxX / canvas.width) * canvasRect.width,
        bottom: canvasRect.top + (maxY / canvas.height) * canvasRect.height,
        width: ((maxX - minX) / canvas.width) * canvasRect.width,
        height: ((maxY - minY) / canvas.height) * canvasRect.height
    };
}

/**
 * Calculate overlap area between two rectangles
 * @param {Object} rect1 - {left, right, top, bottom}
 * @param {Object} rect2 - {left, right, top, bottom}
 * @returns {number} Overlap area (0 if no overlap)
 */
export function calculateRectOverlap(rect1, rect2) {
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapRight = Math.min(rect1.right, rect2.right);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        return (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
    }
    return 0;
}

/**
 * Check if point is inside rectangle
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @param {Object} rect - {left, right, top, bottom}
 * @returns {boolean}
 */
export function pointInRect(px, py, rect) {
    return px >= rect.left && px <= rect.right &&
           py >= rect.top && py <= rect.bottom;
}

/**
 * Check if two rectangles intersect
 * @param {Object} rect1 - {left, right, top, bottom}
 * @param {Object} rect2 - {left, right, top, bottom}
 * @returns {boolean}
 */
export function rectsIntersect(rect1, rect2) {
    return rect1.left < rect2.right &&
           rect1.right > rect2.left &&
           rect1.top < rect2.bottom &&
           rect1.bottom > rect2.top;
}
