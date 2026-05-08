import React from 'react';
import { motion } from 'framer-motion';
import { Sword, Zap, PieChart as PieChartIcon, ShieldAlert, Activity } from 'lucide-react';
import SimulationCharts from './SimulationCharts';
import { COLORS } from '../../utils/constants';

const LevelAnalysis = ({ analysisResult, previewLevel, setPreviewLevel }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="analysis-dashboard"
    >
      <div className="analysis-header">
        <div className="level-selector">
          <span>预览层数:</span>
          <input
            type="range" min="1" max="100"
            value={previewLevel}
            onChange={(e) => setPreviewLevel(Number(e.target.value))}
          />
          <b>Floor {previewLevel}</b>
        </div>
        <div className="budget-badge">
          当前预算: <span>{analysisResult.budget} pt</span>
        </div>
      </div>

      <div className="analysis-grid">
        {/* 敌人清单 */}
        <div className="analysis-card glass">
          <h3><Sword size={18} color="var(--accent-danger)" /> 模拟投放清单</h3>
          <div className="enemy-list">
            {analysisResult.selected.map((s, i) => (
              <div key={i} className="enemy-item">
                <div className="enemy-info">
                  <span className="enemy-name">{s.isForcedBoss ? '⭐ ' : ''}{s.name}</span>
                  <span className="enemy-count">x {s.count}</span>
                </div>
                <div className="enemy-total">{s.count * (s.scaledScore || s.score)} pt</div>
              </div>
            ))}
          </div>
          <button className="btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
            <Zap size={14} /> 重新随机配比
          </button>
        </div>

        {/* 职能分布 */}
        <div className="analysis-card glass">
          <h3><PieChartIcon size={18} color="var(--accent-secondary)" /> 兵种职能分布</h3>
          <SimulationCharts pieData={analysisResult.pieData} />
          <div className="role-legend">
            {analysisResult.pieData.map((d, i) => (
              <div key={i} className="legend-item">
                <span style={{ background: COLORS[i % COLORS.length] }}></span>
                {d.name}: {d.value}个
              </div>
            ))}
          </div>
        </div>

        {/* 分析报告 */}
        <div className="analysis-card glass report-card">
          <h3><ShieldAlert size={18} color="var(--accent-warning)" /> 平台分析报告</h3>
          <div className="warning-list">
            {analysisResult.warnings.map((w, i) => (
              <div key={i} className={`warning-item ${w.type}`}>
                <Activity size={14} />
                <p>{w.text}</p>
              </div>
            ))}
            {analysisResult.warnings.length === 0 && (
              <div className="warning-item success">
                <Zap size={14} />
                <p>当前平衡度良好，建议投放。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LevelAnalysis;
