import { useState, useCallback } from 'react';
import useUIStore from '../../store/uiStore';
import './ImageUpload.css';

// Process imported JSON elements and assign proper IDs, handling nested children
const processImportedElements = (elements, parentId = null) => {
    let flattened = [];

    elements.forEach((el, index) => {
        const id = `element_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        const processed = {
            id,
            type: el.type || 'VisualElement',
            name: el.name || `element_${index}`,
            x: el.x || 0,
            y: el.y || 0,
            width: el.width || 100,
            height: el.height || 40,
            text: el.text || '',
            styles: {
                backgroundColor: el.styles?.backgroundColor || 'transparent',
                borderColor: el.styles?.borderColor || 'transparent',
                borderWidth: el.styles?.borderWidth || 0,
                borderRadius: el.styles?.borderRadius || 0,
                color: el.styles?.color || '#ffffff',
                fontSize: el.styles?.fontSize || 14,
                paddingTop: el.styles?.paddingTop || 0,
                paddingRight: el.styles?.paddingRight || 0,
                paddingBottom: el.styles?.paddingBottom || 0,
                paddingLeft: el.styles?.paddingLeft || 0,
                marginTop: el.styles?.marginTop || 0,
                marginRight: el.styles?.marginRight || 0,
                marginBottom: el.styles?.marginBottom || 0,
                marginLeft: el.styles?.marginLeft || 0,
                opacity: el.styles?.opacity ?? 1,
                flexGrow: el.styles?.flexGrow || 0,
                flexShrink: el.styles?.flexShrink || 1,
                alignItems: el.styles?.alignItems || ((el.type === 'Button' || el.type === 'Label') ? 'center' : 'auto'),
                justifyContent: el.styles?.justifyContent || ((el.type === 'Button' || el.type === 'Label') ? 'center' : 'flex-start'),
                flexDirection: el.styles?.flexDirection || 'column',
            },
            parentId: parentId,
        };

        flattened.push(processed);

        if (el.children && Array.isArray(el.children)) {
            const childElements = processImportedElements(el.children, id);
            flattened = [...flattened, ...childElements];
        }
    });

    return flattened;
};

// Common canvas presets
const CANVAS_PRESETS = [
    { label: '移动端横屏', width: 1024, height: 480 },
    { label: '移动端竖屏', width: 480, height: 854 },
    { label: '平板横屏', width: 1280, height: 800 },
    { label: 'PC 1080p', width: 1920, height: 1080 },
    { label: '自定义', width: null, height: null },
];

const ImageUpload = () => {
    const {
        canvasWidth,
        canvasHeight,
        setCanvasSize,
        setElements,
        setStep,
    } = useUIStore();

    const [showImportModal, setShowImportModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [importError, setImportError] = useState(null);
    const [customWidth, setCustomWidth] = useState(canvasWidth);
    const [customHeight, setCustomHeight] = useState(canvasHeight);
    const [selectedPreset, setSelectedPreset] = useState(0);

    const handlePresetChange = useCallback((index) => {
        setSelectedPreset(index);
        const preset = CANVAS_PRESETS[index];
        if (preset.width && preset.height) {
            setCustomWidth(preset.width);
            setCustomHeight(preset.height);
            setCanvasSize(preset.width, preset.height);
        }
    }, [setCanvasSize]);

    const handleCustomSizeChange = useCallback((width, height) => {
        setCustomWidth(width);
        setCustomHeight(height);
        setCanvasSize(width, height);
        setSelectedPreset(CANVAS_PRESETS.length - 1); // Set to "custom"
    }, [setCanvasSize]);

    const validateElements = (elements) => {
        for (const el of elements) {
            if (!el.type || el.x === undefined || el.y === undefined || el.width === undefined || el.height === undefined) {
                throw new Error(`元素 "${el.name || '未命名'}" 缺少必要字段 (type, x, y, width, height)`);
            }
            if (typeof el.x !== 'number' || typeof el.y !== 'number' || typeof el.width !== 'number' || typeof el.height !== 'number') {
                throw new Error(`元素 "${el.name}" 的坐标或尺寸非数值类型`);
            }
            if (el.children && Array.isArray(el.children)) {
                validateElements(el.children);
            }
        }
    };

    const handleImportJSON = () => {
        setImportError(null);

        try {
            // Clean up the input - remove markdown code blocks if present
            let cleanJson = jsonInput.trim();
            const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                cleanJson = jsonMatch[1].trim();
            }

            const parsed = JSON.parse(cleanJson);
            const elements = Array.isArray(parsed) ? parsed : [parsed];

            // Structural validation
            validateElements(elements);

            const processedElements = processImportedElements(elements);

            setElements(processedElements);
            setShowImportModal(false);
            setJsonInput('');
            setStep(1); // Go to Editor
        } catch (error) {
            setImportError('数据验证错误: ' + error.message);
        }
    };

    const handleSkipToEditor = () => {
        setElements([]);
        setStep(1);
    };

    return (
        <div className="image-upload-page">
            <div className="upload-container">
                <div className="upload-header">
                    <h1 className="upload-title">🎮 Game UI Restorer</h1>
                    <p className="upload-subtitle">
                        通过 Antigravity 分析游戏界面参考图，生成 UI 元素数据，
                        一键导出 Unity UI Toolkit 代码
                    </p>
                </div>

                {/* Canvas Size Settings */}
                <div className="canvas-settings">
                    <div className="settings-title">📐 画布尺寸</div>
                    <div className="preset-buttons">
                        {CANVAS_PRESETS.map((preset, index) => (
                            <button
                                key={index}
                                className={`preset-btn ${selectedPreset === index ? 'active' : ''}`}
                                onClick={() => handlePresetChange(index)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <div className="size-inputs">
                        <div className="size-input-group">
                            <label>宽度</label>
                            <input
                                type="number"
                                value={customWidth}
                                onChange={(e) => handleCustomSizeChange(parseInt(e.target.value) || 1024, customHeight)}
                            />
                        </div>
                        <span className="size-separator">×</span>
                        <div className="size-input-group">
                            <label>高度</label>
                            <input
                                type="number"
                                value={customHeight}
                                onChange={(e) => handleCustomSizeChange(customWidth, parseInt(e.target.value) || 480)}
                            />
                        </div>
                    </div>
                </div>

                {/* Workflow Hint */}
                <div className="workflow-hint">
                    <div className="workflow-hint-icon">💡</div>
                    <div className="workflow-hint-content">
                        <p><strong>使用流程:</strong></p>
                        <ol>
                            <li>在 Antigravity 中发送参考图并输入 <code>/analyze-ui</code></li>
                            <li>复制生成的 JSON 数据</li>
                            <li>点击"导入 JSON"按钮粘贴数据</li>
                        </ol>
                    </div>
                </div>

                {/* Actions */}
                <div className="upload-actions">
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => setShowImportModal(true)}
                    >
                        📋 导入 JSON 数据
                    </button>
                    <button
                        className="btn btn-ghost btn-lg"
                        onClick={handleSkipToEditor}
                    >
                        跳过，手动设计
                    </button>
                </div>
            </div>

            {/* Import JSON Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📋 导入 UI 元素 JSON</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowImportModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-hint">
                                粘贴 Antigravity 生成的 JSON 数据（支持带有 markdown 代码块的格式）
                            </p>
                            <textarea
                                className="json-input"
                                placeholder='[{"type": "Button", "name": "startBtn", ...}]'
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                rows={12}
                            />
                            {importError && (
                                <div className="import-error">
                                    ⚠️ {importError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowImportModal(false)}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleImportJSON}
                                disabled={!jsonInput.trim()}
                            >
                                确认导入
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;
