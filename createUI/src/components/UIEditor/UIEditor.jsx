import { useState, useCallback, useRef, useEffect } from 'react';
import useUIStore, { UI_ELEMENT_TYPES } from '../../store/uiStore';
import './UIEditor.css';

// Element type icons
const ELEMENT_ICONS = {
    VisualElement: '📦',
    Button: '🔘',
    Label: '📝',
    Image: '🖼️',
    ProgressBar: '📊',
    ScrollView: '📜',
    TextField: '✏️',
    Slider: '🎚️',
    Toggle: '🔲',
    Foldout: '📂',
};

// Property Panel Component
const PropertyPanel = () => {
    const {
        elements,
        selectedElementId,
        updateElement,
        updateElementStyle,
        removeElement,
        duplicateElement,
        reparentElement,
    } = useUIStore();

    const selectedElement = elements.find((el) => el.id === selectedElementId);

    if (!selectedElement) {
        return (
            <div className="property-panel">
                <div className="empty-selection">
                    <div className="empty-selection-icon">🎯</div>
                    <p className="empty-selection-text">
                        选择一个元素<br />查看和编辑属性
                    </p>
                </div>
            </div>
        );
    }

    const handleChange = (field, value) => {
        updateElement(selectedElementId, { [field]: value });
    };

    const handleStyleChange = (field, value) => {
        updateElementStyle(selectedElementId, { [field]: value });
    };

    const handleNumberChange = (field, value, isStyle = false) => {
        const numValue = parseFloat(value) || 0;
        if (isStyle) {
            handleStyleChange(field, numValue);
        } else {
            handleChange(field, numValue);
        }
    };

    // Filter potential parents (cannot be itself or its descendants)
    const getPotentialParents = () => {
        const isDescendant = (parentId, childId) => {
            if (!parentId) return false;
            if (parentId === childId) return true;
            const parent = elements.find(el => el.id === parentId);
            return isDescendant(parent?.parentId, childId);
        };

        return elements.filter(el =>
            el.id !== selectedElement.id &&
            !isDescendant(el.parentId, selectedElement.id) &&
            el.type === 'VisualElement'
        );
    };

    return (
        <div className="property-panel">
            <div className="property-header">
                <div className="property-title">
                    {ELEMENT_ICONS[selectedElement.type]} {selectedElement.name}
                </div>
                <div className="property-subtitle">{selectedElement.type}</div>
            </div>

            <div className="property-content">
                {/* Basic Properties */}
                <div className="property-section">
                    <div className="property-section-title">基本属性</div>
                    <div className="property-row">
                        <label className="property-label">名称</label>
                        <input
                            type="text"
                            className="property-input"
                            value={selectedElement.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                        />
                    </div>
                    <div className="property-row">
                        <label className="property-label">层级父节点</label>
                        <select
                            className="property-input"
                            value={selectedElement.parentId || ''}
                            onChange={(e) => reparentElement(selectedElement.id, e.target.value || null)}
                        >
                            <option value="">(无/根节点)</option>
                            {getPotentialParents().map(parent => (
                                <option key={parent.id} value={parent.id}>{parent.name}</option>
                            ))}
                        </select>
                    </div>
                    {(selectedElement.type === 'Button' || selectedElement.type === 'Label') && (
                        <div className="property-row">
                            <label className="property-label">文本</label>
                            <input
                                type="text"
                                className="property-input"
                                value={selectedElement.text || ''}
                                onChange={(e) => handleChange('text', e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Position & Size */}
                <div className="property-section">
                    <div className="property-section-title">位置与尺寸 (绝对坐标)</div>
                    <div className="property-row">
                        <label className="property-label">X</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.x}
                            onChange={(e) => handleNumberChange('x', e.target.value)}
                        />
                        <label className="property-label">Y</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.y}
                            onChange={(e) => handleNumberChange('y', e.target.value)}
                        />
                    </div>
                    <div className="property-row">
                        <label className="property-label">宽度</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.width}
                            onChange={(e) => handleNumberChange('width', e.target.value)}
                        />
                        <label className="property-label">高度</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.height}
                            onChange={(e) => handleNumberChange('height', e.target.value)}
                        />
                    </div>
                </div>

                {/* Appearance */}
                <div className="property-section">
                    <div className="property-section-title">外观</div>
                    <div className="property-row">
                        <label className="property-label">背景色</label>
                        <input
                            type="color"
                            className="property-input property-input-color"
                            value={selectedElement.styles.backgroundColor === 'transparent' ? '#000000' : selectedElement.styles.backgroundColor}
                            onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        />
                        <input
                            type="text"
                            className="property-input"
                            value={selectedElement.styles.backgroundColor}
                            onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        />
                    </div>
                    <div className="property-row">
                        <label className="property-label">文字色</label>
                        <input
                            type="color"
                            className="property-input property-input-color"
                            value={selectedElement.styles.color}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                        />
                        <input
                            type="text"
                            className="property-input"
                            value={selectedElement.styles.color}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                        />
                    </div>
                    <div className="property-row">
                        <label className="property-label">字号</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.styles.fontSize}
                            onChange={(e) => handleNumberChange('fontSize', e.target.value, true)}
                        />
                        <label className="property-label">圆角</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.styles.borderRadius}
                            onChange={(e) => handleNumberChange('borderRadius', e.target.value, true)}
                        />
                    </div>
                </div>

                {/* Border */}
                <div className="property-section">
                    <div className="property-section-title">边框</div>
                    <div className="property-row">
                        <label className="property-label">颜色</label>
                        <input
                            type="color"
                            className="property-input property-input-color"
                            value={selectedElement.styles.borderColor === 'transparent' ? '#000000' : selectedElement.styles.borderColor}
                            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                        />
                        <label className="property-label">宽度</label>
                        <input
                            type="number"
                            className="property-input property-input-small"
                            value={selectedElement.styles.borderWidth}
                            onChange={(e) => handleNumberChange('borderWidth', e.target.value, true)}
                        />
                    </div>
                </div>

                {/* Opacity */}
                <div className="property-section">
                    <div className="property-section-title">透明度</div>
                    <div className="property-row">
                        <label className="property-label">不透明度</label>
                        <input
                            type="range"
                            className="property-input"
                            min="0"
                            max="1"
                            step="0.01"
                            value={selectedElement.styles.opacity}
                            onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
                        />
                        <span style={{ width: '40px', textAlign: 'right', fontSize: '0.75rem' }}>
                            {Math.round(selectedElement.styles.opacity * 100)}%
                        </span>
                    </div>
                </div>

                {/* Layout (Flexbox) */}
                <div className="property-section">
                    <div className="property-section-title">布局 (Flexbox)</div>
                    <div className="property-row">
                        <label className="property-label">排列方向</label>
                        <select
                            className="property-input"
                            value={selectedElement.styles.flexDirection || 'column'}
                            onChange={(e) => handleStyleChange('flexDirection', e.target.value)}
                        >
                            <option value="column">垂直 (Column)</option>
                            <option value="row">水平 (Row)</option>
                            <option value="column-reverse">垂直反向</option>
                            <option value="row-reverse">水平反向</option>
                        </select>
                    </div>
                    <div className="property-row">
                        <label className="property-label">主轴对齐</label>
                        <select
                            className="property-input"
                            value={selectedElement.styles.justifyContent || 'flex-start'}
                            onChange={(e) => handleStyleChange('justifyContent', e.target.value)}
                        >
                            <option value="flex-start">起点 (Start)</option>
                            <option value="center">居中 (Center)</option>
                            <option value="flex-end">终点 (End)</option>
                            <option value="space-between">两端对齐</option>
                            <option value="space-around">环绕对齐</option>
                        </select>
                    </div>
                    <div className="property-row">
                        <label className="property-label">交叉轴对齐</label>
                        <select
                            className="property-input"
                            value={selectedElement.styles.alignItems || 'stretch'}
                            onChange={(e) => handleStyleChange('alignItems', e.target.value)}
                        >
                            <option value="flex-start">起点 (Start)</option>
                            <option value="center">居中 (Center)</option>
                            <option value="flex-end">终点 (End)</option>
                            <option value="stretch">拉伸 (Stretch)</option>
                        </select>
                    </div>
                    <div className="property-row">
                        <label className="property-label">自动成长</label>
                        <input
                            type="number"
                            className="property-input"
                            value={selectedElement.styles.flexGrow || 0}
                            onChange={(e) => handleStyleChange('flexGrow', parseFloat(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className="property-actions">
                <button
                    className="btn btn-secondary"
                    onClick={() => duplicateElement(selectedElementId)}
                >
                    复制
                </button>
                <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--accent-danger)' }}
                    onClick={() => removeElement(selectedElementId)}
                >
                    删除
                </button>
            </div>
        </div>
    );
};

// Canvas Element Component
const CanvasElement = ({ element, elements, selectedElementId, isSelected, onSelect, onMove, onResize, scale }) => {
    const elementRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizeHandle, setResizeHandle] = useState(null);

    const parent = elements.find(el => el.id === element.parentId);
    const children = elements.filter(el => el.parentId === element.id);

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        e.stopPropagation();
        onSelect(element.id);
        setIsDragging(true);
        setDragStart({
            x: e.clientX / scale - element.x,
            y: e.clientY / scale - element.y,
        });
    };

    const handleResizeMouseDown = (e, handle) => {
        e.stopPropagation();
        onSelect(element.id);
        setIsResizing(true);
        setResizeHandle(handle);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            width: element.width,
            height: element.height,
            elX: element.x,
            elY: element.y,
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = e.clientX / scale - dragStart.x;
                const newY = e.clientY / scale - dragStart.y;
                onMove(element.id, Math.max(0, newX), Math.max(0, newY));
            } else if (isResizing && resizeHandle) {
                const deltaX = (e.clientX - dragStart.x) / scale;
                const deltaY = (e.clientY - dragStart.y) / scale;

                let newWidth = dragStart.width;
                let newHeight = dragStart.height;
                let newX = dragStart.elX;
                let newY = dragStart.elY;

                if (resizeHandle.includes('e')) {
                    newWidth = Math.max(20, dragStart.width + deltaX);
                }
                if (resizeHandle.includes('w')) {
                    newWidth = Math.max(20, dragStart.width - deltaX);
                    newX = dragStart.elX + deltaX;
                }
                if (resizeHandle.includes('s')) {
                    newHeight = Math.max(20, dragStart.height + deltaY);
                }
                if (resizeHandle.includes('n')) {
                    newHeight = Math.max(20, dragStart.height - deltaY);
                    newY = dragStart.elY + deltaY;
                }

                onResize(element.id, newWidth, newHeight);
                if (newX !== dragStart.elX || newY !== dragStart.elY) {
                    onMove(element.id, newX, newY);
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setResizeHandle(null);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragStart, resizeHandle, element.id, onMove, onResize, scale]);

    // Default alignment for buttons and labels in the preview
    const isTextPrimary = element.type === 'Button' || element.type === 'Label';

    const style = {
        position: 'absolute',
        left: parent ? element.x - parent.x : element.x,
        top: parent ? element.y - parent.y : element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.styles.backgroundColor,
        borderColor: element.styles.borderColor,
        borderWidth: element.styles.borderWidth,
        borderStyle: element.styles.borderWidth > 0 ? 'solid' : 'none',
        borderRadius: element.styles.borderRadius,
        color: element.styles.color,
        fontSize: element.styles.fontSize,
        opacity: element.styles.opacity,
        display: 'flex',
        flexDirection: element.styles.flexDirection || 'column',
        justifyContent: element.styles.justifyContent || (isTextPrimary ? 'center' : 'flex-start'),
        alignItems: element.styles.alignItems || (isTextPrimary ? 'center' : 'flex-start'),
        zIndex: isSelected ? 100 : 1,
        boxSizing: 'border-box',
        textAlign: isTextPrimary ? 'center' : 'left',
    };

    const placeholderIcon = ELEMENT_ICONS[element.type] || '❓';
    // Show icon if:
    // 1. It's an Image
    // 2. It's a Button with no text (common for icon buttons)
    // 3. It's a VisualElement with no text but named like an icon/graphic
    const lowerName = element.name.toLowerCase();
    const shouldShowIcon = (element.type === 'Image') ||
        (element.type === 'Button' && !element.text) ||
        (element.type === 'VisualElement' && !element.text &&
            (lowerName.includes('icon') ||
                lowerName.includes('avatar') ||
                lowerName.includes('img') ||
                lowerName.includes('image') ||
                lowerName.includes('logo') ||
                lowerName.includes('item') ||
                lowerName.includes('graphic') ||
                lowerName.includes('pass') ||
                lowerName.includes('banner')));

    return (
        <div
            ref={elementRef}
            className={`canvas-element ${isSelected ? 'selected' : ''} ${children.length > 0 ? 'container' : ''} ${element.type.toLowerCase()}`}
            style={style}
            onMouseDown={handleMouseDown}
        >
            {/* Visual representation for elements that need icons */}
            {shouldShowIcon && (
                <div className="element-placeholder">
                    <span className="placeholder-icon">{placeholderIcon}</span>
                </div>
            )}

            {element.type === 'ProgressBar' && (
                <div className="progress-bar-preview">
                    <div className="progress-fill" style={{ width: '60%', backgroundColor: 'var(--accent-primary)' }}></div>
                </div>
            )}

            {element.text && <span style={{ pointerEvents: 'none', zIndex: 2 }}>{element.text}</span>}

            {/* Recursively render children in the DOM */}
            {children.map(child => (
                <CanvasElement
                    key={child.id}
                    element={child}
                    elements={elements}
                    selectedElementId={selectedElementId}
                    isSelected={selectedElementId === child.id}
                    onSelect={onSelect}
                    onMove={onMove}
                    onResize={onResize}
                    scale={scale}
                />
            ))}

            {isSelected && (
                <>
                    <div className="resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
                    <div className="resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
                    <div className="resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
                    <div className="resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
                </>
            )}
        </div>
    );
};

// Main UI Editor Component
const UIEditor = () => {
    const {
        canvasWidth,
        canvasHeight,
        canvasScale,
        setCanvasScale,
        elements,
        selectedElementId,
        selectElement,
        moveElement,
        resizeElement,
        addElement,
        setStep,
    } = useUIStore();

    const handleZoomIn = () => setCanvasScale(Math.min(canvasScale + 0.1, 2));
    const handleZoomOut = () => setCanvasScale(Math.max(canvasScale - 0.1, 0.2));
    const handleFitToView = () => {
        const container = document.querySelector('.canvas-container');
        if (container) {
            const padding = 40;
            const scaleX = (container.clientWidth - padding * 2) / canvasWidth;
            const scaleY = (container.clientHeight - padding * 2) / canvasHeight;
            setCanvasScale(Math.min(scaleX, scaleY, 1));
        }
    };

    const handleCanvasClick = (e) => {
        if (e.target === e.currentTarget) {
            selectElement(null);
        }
    };

    const handleAddElement = (type) => {
        addElement(type, {
            x: 100 + Math.random() * 100,
            y: 100 + Math.random() * 100,
            width: type === 'Label' ? 150 : type === 'Button' ? 120 : 100,
            height: type === 'Label' ? 30 : type === 'Button' ? 40 : 100,
        });
    };

    // Build hierarchy for tree display
    const renderTreeItem = (element, depth = 0) => {
        const children = elements.filter(el => el.parentId === element.id);
        const isSelected = selectedElementId === element.id;

        return (
            <div key={element.id} className="tree-item-container">
                <div
                    className={`tree-item ${isSelected ? 'selected' : ''}`}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => selectElement(element.id)}
                >
                    <span className="tree-item-icon">{ELEMENT_ICONS[element.type]}</span>
                    <span className="tree-item-name">{element.name}</span>
                    <span className="tree-item-type">{element.type}</span>
                </div>
                {children.map(child => renderTreeItem(child, depth + 1))}
            </div>
        );
    };

    const rootElements = elements.filter(el => !el.parentId);

    // Auto-fit on first load
    useEffect(() => {
        handleFitToView();
    }, [canvasWidth, canvasHeight]);

    return (
        <div className="ui-editor">
            {/* Left Sidebar - Element Tree */}
            <div className="editor-sidebar">
                <div className="sidebar-header">
                    <span className="sidebar-title">层级结构</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {elements.length}
                    </span>
                </div>

                <div className="element-tree">
                    {rootElements.map(el => renderTreeItem(el))}
                    {elements.length === 0 && (
                        <div style={{ padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center' }}>
                            暂无元素
                        </div>
                    )}
                </div>

                <div className="add-element-section">
                    <div className="add-element-title">添加元素</div>
                    <div className="add-element-grid">
                        {Object.entries(UI_ELEMENT_TYPES).slice(0, 6).map(([key, type]) => (
                            <button
                                key={key}
                                className="add-element-btn"
                                onClick={() => handleAddElement(type)}
                            >
                                <span className="add-element-btn-icon">{ELEMENT_ICONS[type]}</span>
                                <span>{type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="editor-main">
                <div className="editor-toolbar">
                    <div className="toolbar-left">
                        <button className="btn btn-ghost" onClick={() => setStep(0)}>
                            ← 返回
                        </button>
                        <span className="canvas-size-label">
                            {canvasWidth} × {canvasHeight}
                        </span>
                    </div>

                    <div className="toolbar-right">
                        <div className="zoom-controls">
                            <button className="btn btn-icon btn-ghost" onClick={handleZoomOut}>−</button>
                            <span className="zoom-value">{Math.round(canvasScale * 100)}%</span>
                            <button className="btn btn-icon btn-ghost" onClick={handleZoomIn}>+</button>
                            <button className="btn btn-ghost" onClick={handleFitToView}>适应</button>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep(2)}
                        >
                            导出代码 →
                        </button>
                    </div>
                </div>

                <div className="canvas-container">
                    <div
                        className="canvas-wrapper"
                        style={{
                            width: canvasWidth,
                            height: canvasHeight,
                            transform: `scale(${canvasScale})`,
                        }}
                    >
                        <div className="canvas" onClick={handleCanvasClick}>
                            {/* Render only root elements, children will be rendered recursively */}
                            {rootElements.map((el) => (
                                <CanvasElement
                                    key={el.id}
                                    element={el}
                                    elements={elements}
                                    selectedElementId={selectedElementId}
                                    isSelected={selectedElementId === el.id}
                                    onSelect={selectElement}
                                    onMove={moveElement}
                                    onResize={resizeElement}
                                    scale={canvasScale}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Properties */}
            <PropertyPanel />
        </div>
    );
};

export default UIEditor;

