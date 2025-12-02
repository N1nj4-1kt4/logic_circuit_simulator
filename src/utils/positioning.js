/**
 * Smart positioning utilities
 * Handles intelligent panel placement to avoid overlapping with components
 */

import { getComponentsBoundingBox } from './geometry.js';

/**
 * Position a panel smartly to avoid overlapping with components
 * @param {HTMLElement} panel - The panel element to position
 * @param {HTMLCanvasElement} canvas - Canvas element for viewport context
 * @param {Array} components - Array of component objects
 */
export function positionPanelSmartly(panel, canvas, components) {
    console.log('=== positionPanelSmartly() called ===');

    // Reset to default centered position first to measure panel size
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.left = '50%';
    panel.style.top = '50%';

    // Force a reflow to get accurate measurements
    panel.offsetHeight;

    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width;
    const panelHeight = panelRect.height;
    console.log('Panel size:', panelWidth, 'x', panelHeight);

    const componentBox = getComponentsBoundingBox(components, canvas);
    console.log('Component box:', componentBox);

    const canvasRect = canvas.getBoundingClientRect();
    console.log('Canvas rect:', canvasRect);

    // Define margin from canvas edges and between components
    const margin = 20;
    const positions = [];

    // If no components, position in top-right corner of canvas
    if (!componentBox) {
        console.log('No components - positioning in top-right corner');
        panel.style.transform = 'none';
        panel.style.left = (canvasRect.right - panelWidth - margin) + 'px';
        panel.style.top = (canvasRect.top + margin) + 'px';
        return;
    }

    // All positions must be within canvas bounds
    const canvasLeft = canvasRect.left;
    const canvasTop = canvasRect.top;
    const canvasRight = canvasRect.right;
    const canvasBottom = canvasRect.bottom;

    // Helper function to calculate overlap with individual components
    const calculateComponentOverlap = (panelLeft, panelTop, panelWidth, panelHeight) => {
        const panelRight = panelLeft + panelWidth;
        const panelBottom = panelTop + panelHeight;
        let totalOverlapArea = 0;
        let maxOverlap = 0;

        // Check overlap with each individual component
        components.forEach(component => {
            const { x, y, type } = component;

            // Use half-widths and half-heights (same as getComponentsBoundingBox)
            let halfWidth = 25, halfHeight = 20;
            if (type === 'INPUT' || type === 'OUTPUT') {
                halfWidth = halfHeight = 20;
            } else if (type === 'CUSTOM') {
                halfWidth = halfHeight = 45;
            } else if (type === 'NOT') {
                halfWidth = 22.5;
                halfHeight = 20;
            }

            // Component bounds in canvas coordinates
            const compLeft = x - halfWidth;
            const compRight = x + halfWidth;
            const compTop = y - halfHeight;
            const compBottom = y + halfHeight;

            // Convert to viewport coordinates
            const canvasRect = canvas.getBoundingClientRect();
            const compLeftViewport = canvasRect.left + (compLeft / canvas.width) * canvasRect.width;
            const compRightViewport = canvasRect.left + (compRight / canvas.width) * canvasRect.width;
            const compTopViewport = canvasRect.top + (compTop / canvas.height) * canvasRect.height;
            const compBottomViewport = canvasRect.top + (compBottom / canvas.height) * canvasRect.height;

            // Calculate intersection with panel
            const overlapLeft = Math.max(panelLeft, compLeftViewport);
            const overlapTop = Math.max(panelTop, compTopViewport);
            const overlapRight = Math.min(panelRight, compRightViewport);
            const overlapBottom = Math.min(panelBottom, compBottomViewport);

            // If there's overlap
            if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
                const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
                totalOverlapArea += overlapArea;

                const overlapPercent = (overlapArea / (panelWidth * panelHeight)) * 100;
                maxOverlap = Math.max(maxOverlap, overlapPercent);
            }
        });

        // Return total overlap percentage (can exceed 100% if multiple components overlap)
        const totalOverlapPercent = (totalOverlapArea / (panelWidth * panelHeight)) * 100;

        return {
            total: Math.min(totalOverlapPercent, 100), // Cap at 100%
            max: maxOverlap,
            count: totalOverlapArea > 0 ? 'multiple' : 0
        };
    };

    // Always try all 4 corners and score based on overlap with actual components
    const cornerPositions = [
        {
            name: 'bottom-right',
            left: canvasRight - panelWidth - margin,
            top: canvasBottom - panelHeight - margin,
            basePriority: 100
        },
        {
            name: 'top-right',
            left: canvasRight - panelWidth - margin,
            top: canvasTop + margin,
            basePriority: 95
        },
        {
            name: 'bottom-left',
            left: canvasLeft + margin,
            top: canvasBottom - panelHeight - margin,
            basePriority: 90
        },
        {
            name: 'top-left',
            left: canvasLeft + margin,
            top: canvasTop + margin,
            basePriority: 85
        }
    ];

    // Score each corner based on overlap with actual components
    cornerPositions.forEach(corner => {
        const overlapInfo = calculateComponentOverlap(corner.left, corner.top, panelWidth, panelHeight);
        // Score: base priority - total overlap percentage
        // No overlap = full priority, 100% overlap = priority - 100
        const score = corner.basePriority - overlapInfo.total;

        console.log(`Corner ${corner.name}: overlap=${overlapInfo.total.toFixed(1)}% (max single=${overlapInfo.max.toFixed(1)}%), score=${score.toFixed(1)}`);

        positions.push({
            left: corner.left,
            top: corner.top,
            score: score,
            overlap: overlapInfo.total
        });
    });

    // Try right of components (within canvas)
    if (componentBox.right + margin + panelWidth < canvasRight - margin) {
        const topPos = Math.max(canvasTop + margin, Math.min(componentBox.top, canvasBottom - panelHeight - margin));
        if (topPos + panelHeight <= canvasBottom - margin) {
            positions.push({
                left: componentBox.right + margin,
                top: topPos,
                score: 80
            });
        }
    }

    // Try left of components (within canvas)
    if (componentBox.left - margin - panelWidth > canvasLeft + margin) {
        const topPos = Math.max(canvasTop + margin, Math.min(componentBox.top, canvasBottom - panelHeight - margin));
        if (topPos + panelHeight <= canvasBottom - margin) {
            positions.push({
                left: componentBox.left - panelWidth - margin,
                top: topPos,
                score: 75
            });
        }
    }

    // Try below components (within canvas)
    if (componentBox.bottom + margin + panelHeight < canvasBottom - margin) {
        const leftPos = Math.max(canvasLeft + margin, Math.min(componentBox.left, canvasRight - panelWidth - margin));
        if (leftPos + panelWidth <= canvasRight - margin) {
            positions.push({
                left: leftPos,
                top: componentBox.bottom + margin,
                score: 70
            });
        }
    }

    // Try above components (within canvas)
    if (componentBox.top - margin - panelHeight > canvasTop + margin) {
        const leftPos = Math.max(canvasLeft + margin, Math.min(componentBox.left, canvasRight - panelWidth - margin));
        if (leftPos + panelWidth <= canvasRight - margin) {
            positions.push({
                left: leftPos,
                top: componentBox.top - panelHeight - margin,
                score: 65
            });
        }
    }

    console.log('Candidate positions found:', positions.length);

    // If we have candidate positions, choose the best one
    if (positions.length > 0) {
        console.log('All positions:', positions);
        // Sort by score (higher is better)
        positions.sort((a, b) => b.score - a.score);
        const best = positions[0];
        console.log('Chose best position:', best);

        // Apply the position using transform (compatible with Interact.js)
        panel.style.left = '0';
        panel.style.top = '0';
        panel.style.transform = `translate(${best.left}px, ${best.top}px)`;
        panel.setAttribute('data-x', best.left);
        panel.setAttribute('data-y', best.top);
    } else {
        console.log('No valid positions found, using fallback (centered in canvas)');
        // Fallback: center within canvas, even if it overlaps components
        // This handles cases where panel is larger than available space
        const fallbackLeft = Math.max(
            canvasLeft + margin,
            Math.min(
                canvasLeft + (canvasRect.width - panelWidth) / 2,
                canvasRight - panelWidth - margin
            )
        );
        const fallbackTop = Math.max(
            canvasTop + margin,
            Math.min(
                canvasTop + (canvasRect.height - panelHeight) / 2,
                canvasBottom - panelHeight - margin
            )
        );
        console.log('Fallback position:', fallbackLeft, fallbackTop);

        // Apply the position using transform (compatible with Interact.js)
        panel.style.left = '0';
        panel.style.top = '0';
        panel.style.transform = `translate(${fallbackLeft}px, ${fallbackTop}px)`;
        panel.setAttribute('data-x', fallbackLeft);
        panel.setAttribute('data-y', fallbackTop);
    }
}
