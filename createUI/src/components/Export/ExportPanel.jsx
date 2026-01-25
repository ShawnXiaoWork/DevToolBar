import { useState, useMemo } from 'react';
import useUIStore from '../../store/uiStore';
import { generateUXML, generateUSS, downloadPackage } from '../../services/unityExporter';
import './ExportPanel.css';

const ExportPanel = () => {
    const {
        elements,
        canvasWidth,
        canvasHeight,
        setStep,
    } = useUIStore();

    const [filename, setFilename] = useState('game-ui');
    const [copyNotification, setCopyNotification] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Generate code previews
    const uxmlCode = useMemo(() => {
        return generateUXML(elements, canvasWidth, canvasHeight);
    }, [elements, canvasWidth, canvasHeight]);

    const ussCode = useMemo(() => {
        return generateUSS(elements, canvasWidth, canvasHeight);
    }, [elements, canvasWidth, canvasHeight]);

    const handleCopy = async (code, type) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopyNotification(`${type} 已复制到剪贴板`);
            setTimeout(() => setCopyNotification(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await downloadPackage(elements, canvasWidth, canvasHeight, filename);
            setCopyNotification('下载成功！');
            setTimeout(() => setCopyNotification(null), 2000);
        } catch (err) {
            console.error('Failed to download:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    if (elements.length === 0) {
        return (
            <div className="export-panel">
                <div className="export-toolbar">
                    <div className="export-toolbar-left">
                        <button className="btn btn-ghost" onClick={() => setStep(2)}>
                            ← 返回对比
                        </button>
                    </div>
                </div>
                <div className="export-empty">
                    <div className="export-empty-icon">📦</div>
                    <p>暂无UI元素可导出</p>
                    <button className="btn btn-primary" onClick={() => setStep(1)}>
                        返回编辑器添加元素
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="export-panel">
            <div className="export-toolbar">
                <div className="export-toolbar-left">
                    <button className="btn btn-ghost" onClick={() => setStep(1)}>
                        ← 返回编辑
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                        导出 Unity UI Toolkit 代码
                    </h2>
                </div>

                <div className="export-toolbar-right">
                    <div className="export-stats">
                        <div className="stat-item">
                            <span className="stat-label">元素数量</span>
                            <span className="stat-value">{elements.length}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">画布尺寸</span>
                            <span className="stat-value">{canvasWidth}×{canvasHeight}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="export-content">
                {/* UXML Panel */}
                <div className="code-panel">
                    <div className="code-panel-header">
                        <div className="code-panel-title">
                            <span className="code-panel-title-icon">📄</span>
                            <span>{filename}.uxml</span>
                        </div>
                        <div className="code-panel-actions">
                            <button
                                className="btn btn-ghost"
                                onClick={() => handleCopy(uxmlCode, 'UXML')}
                            >
                                📋 复制
                            </button>
                        </div>
                    </div>
                    <div className="code-panel-content">
                        <pre className="code-block">
                            {uxmlCode}
                        </pre>
                    </div>
                </div>

                {/* USS Panel */}
                <div className="code-panel">
                    <div className="code-panel-header">
                        <div className="code-panel-title">
                            <span className="code-panel-title-icon">🎨</span>
                            <span>{filename}.uss</span>
                        </div>
                        <div className="code-panel-actions">
                            <button
                                className="btn btn-ghost"
                                onClick={() => handleCopy(ussCode, 'USS')}
                            >
                                📋 复制
                            </button>
                        </div>
                    </div>
                    <div className="code-panel-content">
                        <pre className="code-block">
                            {ussCode}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Download Section */}
            <div className="download-section">
                <div className="filename-section">
                    <label className="filename-label">文件名:</label>
                    <input
                        type="text"
                        className="filename-input"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                        placeholder="game-ui"
                    />
                </div>

                <div className="download-container">
                    <div className="download-info">
                        <div className="download-title">📦 下载代码包</div>
                        <div className="download-desc">
                            包含UXML布局文件和USS样式表，可直接导入Unity项目
                        </div>
                        <div className="download-files">
                            <span className="file-badge">
                                <span className="file-badge-icon">📄</span>
                                {filename}.uxml
                            </span>
                            <span className="file-badge">
                                <span className="file-badge-icon">🎨</span>
                                {filename}.uss
                            </span>
                            <span className="file-badge">
                                <span className="file-badge-icon">🖼️</span>
                                Textures/
                            </span>
                            <span className="file-badge">
                                <span className="file-badge-icon">📝</span>
                                README.md
                            </span>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary download-btn"
                        onClick={handleDownload}
                        disabled={isDownloading}
                    >
                        {isDownloading ? (
                            <>
                                <span className="loading-spinner"></span>
                                下载中...
                            </>
                        ) : (
                            <>
                                <span className="download-btn-icon">⬇️</span>
                                下载 ZIP 包
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Copy Notification */}
            {copyNotification && (
                <div className="copy-notification">
                    ✅ {copyNotification}
                </div>
            )}
        </div>
    );
};

export default ExportPanel;
