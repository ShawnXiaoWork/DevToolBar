/**
 * ExcelImportPanel.jsx
 * 通用 Excel 导入面板组件（带拖拽上传 + 错误反馈）
 */
import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Download, Upload, AlertCircle, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';

const ExcelImportPanel = ({
  onDownloadTemplate,
  onImport,
  importLabel = '导入 Excel',
  templateLabel = '下载模板',
  description = '支持 .xlsx / .xls 格式',
  acceptModes = 'append', // 'append' | 'replace'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null); // { errors, count, mode }
  const [showErrors, setShowErrors] = useState(false);
  const [mode, setMode] = useState('append'); // append | replace
  const fileInputRef = useRef();

  const processFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      setResult({ errors: ['仅支持 .xlsx 或 .xls 格式的文件'], count: 0 });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const { count, errors } = await onImport(file, mode);
      setResult({ count, errors, mode });
      setShowErrors(errors.length > 0);
    } catch (e) {
      setResult({ errors: [e.message || '未知错误'], count: 0 });
      setShowErrors(true);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
  };

  return (
    <div style={{
      background: 'rgba(124, 77, 255, 0.05)',
      border: '1px dashed rgba(124, 77, 255, 0.3)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileSpreadsheet size={20} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Excel 批量导入</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{description}</span>
        </div>
        <button
          onClick={onDownloadTemplate}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0, 230, 184, 0.1)',
            border: '1px solid rgba(0, 230, 184, 0.3)',
            color: 'var(--accent-success)',
            padding: '6px 14px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 230, 184, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 230, 184, 0.1)'}
        >
          <Download size={14} />
          {templateLabel}
        </button>
      </div>

      {/* 导入模式切换 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { value: 'append', label: '追加导入', desc: '保留现有数据，添加新行' },
          { value: 'replace', label: '全量替换', desc: '清空后重新导入' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            title={opt.desc}
            style={{
              padding: '5px 14px', borderRadius: '6px', border: 'none',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
              transition: 'all 0.2s',
              background: mode === opt.value ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
              color: mode === opt.value ? 'white' : 'var(--text-secondary)',
            }}
          >
            {opt.label}
          </button>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '4px' }}>
          {mode === 'append' ? '保留现有数据，添加新行' : '⚠️ 将清空现有数据后重新导入'}
        </span>
      </div>

      {/* 拖拽区域 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '10px',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? 'rgba(124, 77, 255, 0.08)' : 'rgba(0,0,0,0.2)',
          transition: 'all 0.3s',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--accent-secondary)' }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--accent-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span>正在解析文件…</span>
          </div>
        ) : (
          <>
            <Upload size={28} color={isDragging ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '0.9rem', color: isDragging ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
              拖拽文件到此处，或 <span style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>点击选择文件</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              仅支持 .xlsx / .xls 格式
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* 结果反馈 */}
      {result && (
        <div style={{ marginTop: '1rem' }}>
          {result.count > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '0.5rem',
              background: 'rgba(0, 230, 184, 0.08)', border: '1px solid rgba(0, 230, 184, 0.2)',
              color: 'var(--accent-success)', fontSize: '0.88rem',
            }}>
              <CheckCircle2 size={16} />
              <span>
                成功导入 <strong>{result.count}</strong> 条数据
                {result.mode === 'replace' ? '（已替换全部）' : '（已追加）'}
              </span>
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{
              background: 'rgba(255, 82, 82, 0.06)', border: '1px solid rgba(255, 82, 82, 0.25)',
              borderRadius: '8px', overflow: 'hidden',
            }}>
              <button
                onClick={() => setShowErrors(!showErrors)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent-danger)', fontSize: '0.88rem',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  {result.errors.length} 条数据存在问题（点击查看）
                </span>
                {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showErrors && (
                <ul style={{ margin: 0, padding: '0 1rem 0.75rem 2.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {result.errors.map((err, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ExcelImportPanel;
