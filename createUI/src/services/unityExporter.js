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
const determineAnchor = (element, canvasWidth, canvasHeight) => {
    const x = element.x;
    const y = element.y;
    const w = element.width;
    const h = element.height;
    const right = canvasWidth - (x + w);
    const bottom = canvasHeight - (y + h);

    const threshold = 100;

    const nearLeft = x < threshold;
    const nearRight = right < threshold;
    const nearTop = y < threshold;
    const nearBottom = bottom < threshold;

    if (nearLeft && nearTop) return { anchor: 'top-left', left: x, top: y };
    if (nearRight && nearTop) return { anchor: 'top-right', right: right, top: y };
    if (nearLeft && nearBottom) return { anchor: 'bottom-left', left: x, bottom: bottom };
    if (nearRight && nearBottom) return { anchor: 'bottom-right', right: right, bottom: bottom };

    // Default based on which edge is closer
    if (nearLeft) return { anchor: 'top-left', left: x, top: y };
    if (nearRight) return { anchor: 'top-right', right: right, top: y };
    if (nearTop) return { anchor: 'top-left', left: x, top: y };
    if (nearBottom) return { anchor: 'bottom-left', left: x, bottom: bottom };

    return { anchor: 'top-left', left: x, top: y };
};

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
 * Get layout direction hint based on children positions
 */
const getLayoutDirection = (element, childrenMap) => {
    const children = childrenMap.get(element.id) || [];
    if (children.length < 2) return 'column';

    const sortedByX = [...children].sort((a, b) => a.x - b.x);
    const sortedByY = [...children].sort((a, b) => a.y - b.y);

    const xSpread = sortedByX[sortedByX.length - 1].x - sortedByX[0].x;
    const ySpread = sortedByY[sortedByY.length - 1].y - sortedByY[0].y;

    return xSpread > ySpread ? 'row' : 'column';
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
 * Generate USS - root elements use absolute positioning, children use Flexbox
 */
export const generateUSS = (elements, canvasWidth, canvasHeight) => {
    const { childrenMap, parentMap, rootElements } = buildHierarchy(elements);

    const generateElementStyle = (element) => {
        const className = generateClassName(element);
        const s = element.styles || {};
        const usePlaceholder = needsPlaceholder(element);
        const placeholderName = usePlaceholder ? getPlaceholderName(element) : null;
        const hasChildren = isContainer(element, childrenMap);
        const isRootLevel = !parentMap.has(element.id);
        const layoutDir = hasChildren ? getLayoutDirection(element, childrenMap) : null;

        const styleLines = [
            `/* ${element.name} ${hasChildren ? '(Container)' : ''} ${isRootLevel ? '[Root]' : ''} */`,
            `.${className} {`,
        ];

        // Root-level elements use absolute positioning for screen layout
        if (isRootLevel) {
            const anchor = determineAnchor(element, canvasWidth, canvasHeight);
            styleLines.push(`  position: absolute;`);

            if (anchor.left !== undefined) {
                styleLines.push(`  left: ${convertPx(anchor.left)};`);
            }
            if (anchor.right !== undefined) {
                styleLines.push(`  right: ${convertPx(anchor.right)};`);
            }
            if (anchor.top !== undefined) {
                styleLines.push(`  top: ${convertPx(anchor.top)};`);
            }
            if (anchor.bottom !== undefined) {
                styleLines.push(`  bottom: ${convertPx(anchor.bottom)};`);
            }
        } else {
            // Child elements use margin for spacing within parent's Flexbox
            styleLines.push(`  margin: 2px;`);
        }

        // Container elements use Flexbox for children layout
        if (hasChildren) {
            styleLines.push(`  /* Container: ${childrenMap.get(element.id).length} children */`);
            styleLines.push(`  flex-direction: ${s.flexDirection || layoutDir};`);
            styleLines.push(`  justify-content: ${s.justifyContent || 'flex-start'};`);
            styleLines.push(`  align-items: ${s.alignItems || 'flex-start'};`);
            styleLines.push(`  padding: 4px;`);
        }

        // Flex properties
        if (s.flexGrow) {
            styleLines.push(`  flex-grow: ${s.flexGrow};`);
        }
        if (s.flexShrink !== undefined) {
            styleLines.push(`  flex-shrink: ${s.flexShrink};`);
        }

        // Size
        styleLines.push(`  width: ${convertPx(element.width)};`);
        styleLines.push(`  height: ${convertPx(element.height)};`);

        // Flexbox for text alignment
        if (element.type === 'Button' || element.type === 'Label') {
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
 * Layout Strategy:
 * - Root-level elements: Absolute positioning with anchoring
 *   (keeps original screen positions for UI adaptation)
 * - Nested children: Flexbox flow layout within parent
 *   (auto-detected row/column based on arrangement)
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

    const readme = `# Game UI Export

## Layout Strategy

### Root-level elements (absolute positioning)
- Use \`position: absolute\` with left/right/top/bottom anchoring
- Preserves original screen positions
- Anchored to nearest edge for responsive adaptation

### Nested children (Flexbox)
- Child elements within containers use Flexbox flow
- Direction (row/column) auto-detected from arrangement
- Use margin for spacing

## Example
\`\`\`css
/* Root-level panel - absolute positioned */
.player-panel {
  position: absolute;
  left: 20px;
  top: 15px;
  width: 180px;
  height: 50px;
  flex-direction: row;  /* Children flow horizontally */
}

/* Nested child - Flexbox item */
.player-avatar {
  margin: 2px;
  width: 44px;
  height: 44px;
}
\`\`\`

## Panel Settings
- Scale Mode: Scale With Screen Size
- Reference Resolution: ${canvasWidth} x ${canvasHeight}
- Match: 0.5
`;

    zip.file('README.md', readme);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${filename}.zip`);
};

export default { generateUXML, generateUSS, downloadPackage };
