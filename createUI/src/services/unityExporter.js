import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Convert CSS color to Unity USS color format
 */
const convertColor = (color) => {
    if (!color || color === 'transparent') return 'transparent';
    if (color.startsWith('#') || color.startsWith('rgb') || color === 'transparent') {
        return color;
    }
    return color;
};

/**
 * Convert pixel value to USS format
 */
const convertPx = (value) => {
    if (typeof value === 'number') {
        return value === 0 ? '0' : `${value}px`;
    }
    return value;
};

/**
 * Generate element name suitable for USS class
 */
const generateClassName = (element) => {
    const baseName = element.name
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    return baseName || `element-${element.id.slice(-6)}`;
};

/**
 * Build hierarchy based on explicit parentId from data
 */
const buildHierarchy = (elements) => {
    const childrenMap = new Map();
    const parentMap = new Map();

    elements.forEach(el => {
        childrenMap.set(el.id, []);
        if (el.parentId) {
            parentMap.set(el.id, el.parentId);
        }
    });

    elements.forEach(el => {
        if (el.parentId) {
            const children = childrenMap.get(el.parentId) || [];
            children.push(el);
            childrenMap.set(el.parentId, children);
        }
    });

    const rootElements = elements.filter(el => !el.parentId);

    return { parentMap, childrenMap, rootElements };
};

/**
 * Determine anchor type for root-level elements
 */
/**
 * Determine if element should use a placeholder image
 */
const needsPlaceholder = (element) => {
    const type = element.type || 'VisualElement';
    const name = (element.name || '').toLowerCase();

    if (type === 'Image') return true;
    if (name.includes('icon') || name.includes('avatar') ||
        name.includes('image') || name.includes('img') ||
        name.includes('logo') || name.includes('thumb')) {
        return true;
    }
    return false;
};

/**
 * Get placeholder image name
 */
const getPlaceholderName = (element) => {
    const name = (element.name || '').toLowerCase();
    if (name.includes('avatar') || name.includes('player')) return 'placeholder_avatar';
    if (name.includes('icon')) return 'placeholder_icon';
    if (name.includes('logo')) return 'placeholder_logo';
    return 'placeholder_default';
};

/**
 * Check if element is a container (has children)
 */
const isContainer = (element, childrenMap) => {
    const children = childrenMap.get(element.id) || [];
    return children.length > 0;
};

/**
 * Determine Smart Constraints for responsive layout
 * Calculates whether an element should anchor to Left, Right, Top, Bottom, or Center
 * based on its position relative to its parent.
 */
const determineSmartConstraints = (element, parentWidth, parentHeight, localX, localY) => {
    const { width, height } = element;

    // Horizontal Analysis
    let horizontalAnchor = 'left';
    let leftValue = localX;
    let rightValue = null;
    let translateX = 0;

    const centerX = localX + width / 2;
    const parentCenterX = parentWidth / 2;
    // 10% tolerance for centering
    const centerTolerance = parentWidth * 0.1;

    if (Math.abs(centerX - parentCenterX) < centerTolerance) {
        // Center Horizontal
        horizontalAnchor = 'center';
        leftValue = 50; // 50%
        translateX = -50; // -50%
        // We will store percentage as number 50, output as 50%
    } else if (centerX > parentCenterX) {
        // Right Side
        horizontalAnchor = 'right';
        rightValue = parentWidth - (localX + width);
        leftValue = null;
    }

    // Vertical Analysis
    let verticalAnchor = 'top';
    let topValue = localY;
    let bottomValue = null;
    let translateY = 0;

    const centerY = localY + height / 2;
    const parentCenterY = parentHeight / 2;
    const centerToleranceY = parentHeight * 0.1;

    if (Math.abs(centerY - parentCenterY) < centerToleranceY) {
        // Center Vertical
        verticalAnchor = 'center';
        topValue = 50; // 50%
        translateY = -50; // -50%
    } else if (centerY > parentCenterY) {
        // Bottom Side
        verticalAnchor = 'bottom';
        bottomValue = parentHeight - (localY + height);
        topValue = null;
    }

    return {
        horizontalAnchor,
        verticalAnchor,
        left: leftValue,
        right: rightValue,
        top: topValue,
        bottom: bottomValue,
        translateX,
        translateY
    };
};

/**
 * Generate UXML with proper nesting
 */
export const generateUXML = (elements, canvasWidth, canvasHeight, ussFilename = 'game-ui-export') => {
    const { childrenMap, rootElements } = buildHierarchy(elements);

    const generateElementXML = (element, indent = 4) => {
        const spaces = ' '.repeat(indent);
        const className = generateClassName(element);
        const tag = element.type || 'VisualElement';
        const children = childrenMap.get(element.id) || [];

        let attributes = `name="${element.name}" class="${className}"`;

        if (element.text && (tag === 'Button' || tag === 'Label')) {
            attributes += ` text="${element.text.replace(/"/g, '&quot;')}"`;
        }

        if (children.length === 0) {
            return `${spaces}<ui:${tag} ${attributes} />`;
        }

        const sortedChildren = [...children].sort((a, b) => {
            if (Math.abs(a.y - b.y) < 10) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        const childrenXML = sortedChildren
            .map(child => generateElementXML(child, indent + 2))
            .join('\n');

        return `${spaces}<ui:${tag} ${attributes}>\n${childrenXML}\n${spaces}</ui:${tag}>`;
    };

    const sortedRoots = [...rootElements].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) {
            return a.x - b.x;
        }
        return a.y - b.y;
    });

    const elementsXML = sortedRoots
        .map(el => generateElementXML(el))
        .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<ui:UXML xmlns:ui="UnityEngine.UIElements" xmlns:uie="UnityEditor.UIElements"
    xsi="http://www.w3.org/2001/XMLSchema-instance"
    engine="UnityEngine.UIElements"
    editor="UnityEditor.UIElements"
    noNamespaceSchemaLocation="../UIElementsSchema/UIElements.xsd"
    editor-extension-mode="False">
  
  <Style src="${ussFilename}.uss" />
  
  <!-- Root Container -->
  <ui:VisualElement name="root" class="root-container">
${elementsXML}
  </ui:VisualElement>
  
</ui:UXML>`;
};

/**
 * Generate USS - All elements use Smart Absolute Anchoring
 */
export const generateUSS = (elements, canvasWidth, canvasHeight) => {
    const { childrenMap, parentMap, rootElements } = buildHierarchy(elements);

    // Create a map to quickly access elements by ID for coordinate calculations
    const elementMap = new Map(elements.map(el => [el.id, el]));

    const generateElementStyle = (element) => {
        const className = generateClassName(element);
        const s = element.styles || {};
        const usePlaceholder = needsPlaceholder(element);
        const placeholderName = usePlaceholder ? getPlaceholderName(element) : null;
        const hasChildren = isContainer(element, childrenMap);
        const isRootLevel = !parentMap.has(element.id);

        // Determine Parent Dimensions and Local Coordinates
        let parentW = canvasWidth;
        let parentH = canvasHeight;
        let localX = element.x;
        let localY = element.y;

        if (!isRootLevel) {
            const parentId = parentMap.get(element.id);
            const parent = elementMap.get(parentId);
            if (parent) {
                parentW = parent.width;
                parentH = parent.height;
                localX = element.x - parent.x;
                localY = element.y - parent.y;
            }
        }

        // CALCULATE SMART ANCHORS
        const constraints = determineSmartConstraints(element, parentW, parentH, localX, localY);

        const styleLines = [
            `/* ${element.name} [${constraints.horizontalAnchor}-${constraints.verticalAnchor}] */`,
            `.${className} {`,
        ];

        // START: Positioning Strategy - Absolute Smart Anchors
        styleLines.push(`  position: absolute;`);

        // Horizontal
        if (constraints.horizontalAnchor === 'center') {
            styleLines.push(`  left: 50%;`);
        } else if (constraints.horizontalAnchor === 'right') {
            styleLines.push(`  right: ${convertPx(constraints.right)};`);
        } else {
            styleLines.push(`  left: ${convertPx(constraints.left)};`);
        }

        // Vertical
        if (constraints.verticalAnchor === 'center') {
            styleLines.push(`  top: 50%;`);
        } else if (constraints.verticalAnchor === 'bottom') {
            styleLines.push(`  bottom: ${convertPx(constraints.bottom)};`);
        } else {
            styleLines.push(`  top: ${convertPx(constraints.top)};`);
        }

        // Translate (for centering)
        if (constraints.translateX !== 0 || constraints.translateY !== 0) {
            styleLines.push(`  translate: ${constraints.translateX}% ${constraints.translateY}%;`);
        }
        // END: Positioning Strategy

        // Container properties (Flexbox properties on parent are mostly ignored by Absolute children, keeping for safety)
        if (hasChildren) {
            styleLines.push(`  /* Container: ${childrenMap.get(element.id).length} children */`);
        }

        // Size
        styleLines.push(`  width: ${convertPx(element.width)};`);
        styleLines.push(`  height: ${convertPx(element.height)};`);

        // Flexbox for text alignment (centered content inside the element itself)
        if (element.type === 'Button' || element.type === 'Label') {
            styleLines.push(`  display: flex;`);
            styleLines.push(`  justify-content: center;`);
            styleLines.push(`  align-items: center;`);
            styleLines.push(`  -unity-text-align: middle-center;`);
        }

        // Background image placeholder
        if (usePlaceholder) {
            styleLines.push(`  background-image: resource('Textures/${placeholderName}');`);
            styleLines.push(`  -unity-background-scale-mode: scale-to-fit;`);
        }

        // Background color
        if (s.backgroundColor && s.backgroundColor !== 'transparent') {
            styleLines.push(`  background-color: ${convertColor(s.backgroundColor)};`);
        }

        // Border
        if (s.borderWidth && s.borderWidth > 0) {
            styleLines.push(`  border-width: ${convertPx(s.borderWidth)};`);
            if (s.borderColor) {
                styleLines.push(`  border-color: ${convertColor(s.borderColor)};`);
            }
        }

        // Border radius
        if (s.borderRadius && s.borderRadius > 0) {
            styleLines.push(`  border-radius: ${convertPx(s.borderRadius)};`);
        }

        // Text styling
        if (s.color) {
            styleLines.push(`  color: ${convertColor(s.color)};`);
        }
        if (s.fontSize) {
            styleLines.push(`  font-size: ${convertPx(s.fontSize)};`);
        }

        // Opacity
        if (s.opacity !== undefined && s.opacity !== 1) {
            styleLines.push(`  opacity: ${s.opacity};`);
        }

        styleLines.push('}');
        styleLines.push('');

        return styleLines.join('\n');
    };

    const header = `/* 
 * Game UI Stylesheet
 * Generated by Game UI Restoration Tool
 * Reference: ${canvasWidth} x ${canvasHeight}
 * 
 * Layout Strategy: Smart Anchoring
 * - Position: ABSOLUTE for ALL elements
 * - Responsive: Elements automatically anchor to Nearest Edge or Center
 *   (e.g., Right-side buttons stay Right; Center popups stay Center)
 * 
 * Panel Settings:
 * - Scale Mode: Scale With Screen Size
 * - Reference Resolution: ${canvasWidth} x ${canvasHeight}
 * - Match: 0.5
 */

/* Root Container - fills screen */
.root-container {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

/* ==================== UI Elements ==================== */

`;

    const elementStyles = elements.map(generateElementStyle).join('\n');

    return header + elementStyles;
};

/**
 * Generate placeholder textures
 */
const generatePlaceholderTextures = () => {
    const createSvg = (color, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect fill="${color}" width="64" height="64" rx="4"/>
  <text x="32" y="36" text-anchor="middle" fill="white" font-size="7" font-family="Arial">${label}</text>
</svg>`;

    return {
        'placeholder_default.svg': createSvg('#808080', 'DEFAULT'),
        'placeholder_icon.svg': createSvg('#6366f1', 'ICON'),
        'placeholder_avatar.svg': createSvg('#8b5cf6', 'AVATAR'),
        'placeholder_logo.svg': createSvg('#f59e0b', 'LOGO'),
    };
};

/**
 * Download package
 */
export const downloadPackage = async (elements, canvasWidth, canvasHeight, filename = 'game-ui-export') => {
    const uxml = generateUXML(elements, canvasWidth, canvasHeight, filename);
    const uss = generateUSS(elements, canvasWidth, canvasHeight);

    const zip = new JSZip();
    zip.file(`${filename}.uxml`, uxml);
    zip.file(`${filename}.uss`, uss);

    const texturesFolder = zip.folder('Resources/Textures');
    const placeholders = generatePlaceholderTextures();
    for (const [name, content] of Object.entries(placeholders)) {
        texturesFolder.file(name, content);
    }

    const readme = `# Game UI Export (Smart Responsive)

## Layout Strategy: Smart Anchoring

This export uses **Smart Absolute Anchoring** to ensure responsiveness across different aspect ratios while maintaining pixel-perfect positions.

### Anchoring Logic
- **Left/Top**: Elements closer to the top-left anchor there.
- **Right/Bottom**: Elements closer to the right/bottom edge anchor there (e.g. \`right: 20px\`).
- **Center**: Elements near the center use percentage positioning (\`left: 50%\`) and translation (\`translate: -50% -50%\`) to stay practically centered.

## How to use in Unity

1. Import the generated folder.
2. Open UI Builder with \`${filename}.uxml\`.
3. Set Panel Settings to **Scale With Screen Size** (Ref: ${canvasWidth}x${canvasHeight}).

## Troubleshooting
- If an element jumps to the wrong side, its centerpoint was likely closer to that edge in the reference.
`;

    zip.file('README.md', readme);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${filename}.zip`);
};

export default { generateUXML, generateUSS, downloadPackage };
