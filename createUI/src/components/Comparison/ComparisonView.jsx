import { useState, useRef, useCallback } from 'react';
import useUIStore from '../../store/uiStore';
import './ComparisonView.css';

// Render UI elements as a preview
const CanvasPreview = ({ elements, width, height, scale = 1 }) => {
    // Render all elements - they all use absolute positioning
    // Previously only rendering root elements caused empty previews
    return (
        <div
            className="canvas-render"
            style={{
                width: width * scale,
                height: height * scale,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
            }}
        >
            {elements.map((el) => (
                <div
                    key={el.id}
                    className="canvas-render-element"
                    style={{
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        backgroundColor: el.styles.backgroundColor,
                        borderColor: el.styles.borderColor,
                        borderWidth: el.styles.borderWidth,
                        borderStyle: el.styles.borderWidth > 0 ? 'solid' : 'none',
                        borderRadius: el.styles.borderRadius,
                        color: el.styles.color,
                        fontSize: el.styles.fontSize,
                        opacity: el.styles.opacity,
                    }}
                >
                    {el.text && <span>{el.text}</span>}
                </div>
            ))}
        </div>
    );
};

const ComparisonView = () => {
    const {
        referenceImage,
        canvasWidth,
        canvasHeight,
        elements,
        setStep,
    } = useUIStore();

    const [mode, setMode] = useState('side-by-side'); // side-by-side, slider, overlay
    const [sliderPosition, setSliderPosition] = useState(50);
    const [overlayOpacity, setOverlayOpacity] = useState(0.5);
    const sliderRef = useRef(null);
    const isDragging = useRef(false);

    const handleSliderMouseDown = useCallback(() => {
        isDragging.current = true;
    }, []);

    const handleSliderMouseMove = useCallback((e) => {
        if (!isDragging.current || !sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.min(100, Math.max(0, (x / rect.width) * 100));
        setSliderPosition(percent);
    }, []);

    const handleSliderMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    // Calculate scale to fit in viewport
    const calculateScale = () => {
        const maxWidth = window.innerWidth * 0.4;
        const maxHeight = window.innerHeight * 0.7;
        const scaleX = maxWidth / canvasWidth;
        const scaleY = maxHeight / canvasHeight;
        return Math.min(scaleX, scaleY, 1);
    };

    const scale = calculateScale();

    if (!referenceImage && elements.length === 0) {
        return (
            <div className="comparison-view">
                <div className="comparison-toolbar">
                    <div className="comparison-toolbar-left">
                        <button className="btn btn-ghost" onClick={() => setStep(1)}>
                            ← 返回编辑
                        </button>
                    </div>
                </div>
                <div className="comparison-content">
                    <div className="comparison-empty">
                        <div className="comparison-empty-icon">🔍</div>
                        <p>暂无内容可对比</p>
                        <button className="btn btn-primary" onClick={() => setStep(0)}>
                            上传参考图开始
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="comparison-view">
            <div className="comparison-toolbar">
                <div className="comparison-toolbar-left">
                    <button className="btn btn-ghost" onClick={() => setStep(1)}>
                        ← 返回编辑
                    </button>

                    <div className="comparison-modes">
                        <button
                            className={`comparison-mode-btn ${mode === 'side-by-side' ? 'active' : ''}`}
                            onClick={() => setMode('side-by-side')}
                        >
                            📐 左右对比
                        </button>
                        <button
                            className={`comparison-mode-btn ${mode === 'slider' ? 'active' : ''}`}
                            onClick={() => setMode('slider')}
                        >
                            ↔️ 滑动对比
                        </button>
                        <button
                            className={`comparison-mode-btn ${mode === 'overlay' ? 'active' : ''}`}
                            onClick={() => setMode('overlay')}
                        >
                            🔀 叠加对比
                        </button>
                    </div>
                </div>

                <div className="comparison-toolbar-right">
                    <button
                        className="btn btn-primary"
                        onClick={() => setStep(3)}
                    >
                        确认效果，导出代码 →
                    </button>
                </div>
            </div>

            <div className="comparison-content">
                {mode === 'side-by-side' && (
                    <div className="side-by-side">
                        <div className="comparison-panel">
                            <div className="comparison-panel-header">
                                📷 原始参考图
                            </div>
                            <div className="comparison-panel-content">
                                {referenceImage ? (
                                    <img src={referenceImage} alt="原始参考图" />
                                ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>无参考图</span>
                                )}
                            </div>
                        </div>

                        <div className="comparison-panel">
                            <div className="comparison-panel-header">
                                ✨ 还原效果
                            </div>
                            <div className="comparison-panel-content">
                                <CanvasPreview
                                    elements={elements}
                                    width={canvasWidth}
                                    height={canvasHeight}
                                    scale={scale}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'slider' && (
                    <div
                        ref={sliderRef}
                        className="slider-container"
                        onMouseMove={handleSliderMouseMove}
                        onMouseUp={handleSliderMouseUp}
                        onMouseLeave={handleSliderMouseUp}
                    >
                        {referenceImage && (
                            <img
                                src={referenceImage}
                                alt="原图"
                                className="slider-image original"
                            />
                        )}
                        <div
                            className="slider-image restored"
                            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                        >
                            <CanvasPreview
                                elements={elements}
                                width={canvasWidth}
                                height={canvasHeight}
                                scale={1}
                            />
                        </div>

                        <div
                            className="slider-divider"
                            style={{ left: `${sliderPosition}%` }}
                            onMouseDown={handleSliderMouseDown}
                        >
                            <div className="slider-handle">⇔</div>
                        </div>

                        <div className="slider-labels">
                            <span className="slider-label">原图</span>
                            <span className="slider-label">还原</span>
                        </div>
                    </div>
                )}

                {mode === 'overlay' && (
                    <div className="overlay-container">
                        <div className="overlay-original">
                            {referenceImage && (
                                <img src={referenceImage} alt="原图" />
                            )}
                        </div>
                        <div
                            className="overlay-restored"
                            style={{ opacity: overlayOpacity }}
                        >
                            <CanvasPreview
                                elements={elements}
                                width={canvasWidth}
                                height={canvasHeight}
                                scale={1}
                            />
                        </div>

                        <div className="overlay-controls">
                            <label>原图</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={overlayOpacity}
                                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                            />
                            <label>还原</label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComparisonView;
