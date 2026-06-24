import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import DifficultyChart from './DifficultyChart';
import SpikeConfig from './SpikeConfig';
import { getLevelBudget } from '../../utils/planningUtils';

const BudgetConfig = ({ state, dispatch, previewRange, setPreviewRange }) => {
  const { levelConfig } = state;

  const difficultyData = useMemo(() => {
    return Array.from({ length: previewRange }, (_, i) => ({
      level: i + 1,
      budget: getLevelBudget(i + 1, levelConfig)
    }));
  }, [levelConfig, previewRange]);

  const handleAutoGenerateSpikes = () => {
    const interval = 10;
    const newSpikes = [];
    for (let i = interval; i <= previewRange; i += interval) {
      const chapter = Math.floor(i / interval);
      const isMajorChapter = chapter % 5 === 0;

      newSpikes.push({
        level: i,
        hpMultiplier: isMajorChapter ? 1.4 : 1.2,
        atkMultiplier: isMajorChapter ? 1.6 : 1.3,
        type: 'peak',
        note: isMajorChapter ? `第 ${chapter / 5} 章节终极 Boss` : `第 ${chapter} 阶段精英战`
      });

      newSpikes.push({
        level: i,
        hpMultiplier: 1.1,
        atkMultiplier: 1.1,
        type: 'step',
        note: `第 ${chapter} 章节难度台阶`
      });
    }
    dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: newSpikes } });
  };

  const handleAddManualSpike = () => {
    const newSpike = { level: previewRange / 2, hpMultiplier: 1.2, atkMultiplier: 1.2, type: 'peak', note: '新越迁点' };
    dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes: [...(levelConfig.spikes || []), newSpike] } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="budget-config"
    >
      <DifficultyChart data={difficultyData} />

      <div className="config-panel glass">
        <h3><Settings size={18} /> 难度公式参数</h3>
        <div className="params-grid">
          <div className="param-item">
            <label>基础积分 (BaseScore)</label>
            <input
              type="number"
              value={levelConfig.baseScore}
              onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { baseScore: Number(e.target.value) } })}
            />
            <p>第1层关卡的起始总战力值</p>
          </div>
          <div className="param-item">
            <label>起始倍率 (StartMultiplier)</label>
            <input
              type="number"
              step="0.01"
              value={levelConfig.initialMultiplier}
              onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { initialMultiplier: Number(e.target.value) } })}
            />
            <p>控制起始难度的系数，默认 1.0 (可以设置不从1开始)</p>
          </div>
          <div className="param-item">
            <label>难度因子 (DifficultyFactor)</label>
            <input
              type="number"
              step="0.01"
              value={levelConfig.difficultyFactor}
              onChange={(e) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { difficultyFactor: Number(e.target.value) } })}
            />
            <p>数值越高，后期关卡难度飙升越快</p>
          </div>
          <div className="param-item">
            <label>波次间隔 (WaveInterval)</label>
            <input
              type="number"
              min="0"
              max="3600"
              value={levelConfig.waveInterval !== undefined ? levelConfig.waveInterval : 30}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : Number(e.target.value);
                // 资深全栈架构师安全审计：限制波次间隔在 [0, 3600] 范围内，防止异常大值或负数溢出
                const sanitized = Math.max(0, Math.min(3600, val));
                dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { waveInterval: sanitized } });
              }}
            />
            <p>关卡中每波敌人的默认开始间隔 (秒)</p>
          </div>
          <div className="param-item">
            <label>预测关卡总数 (Preview Levels)</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={previewRange}
              onChange={(e) => setPreviewRange(Number(e.target.value))}
            />
            <p>设置图表中预览展示的关卡数量</p>
          </div>
        </div>

        <SpikeConfig 
          levelConfig={levelConfig} 
          previewRange={previewRange}
          onUpdate={(spikes) => dispatch({ type: 'UPDATE_LEVEL_CONFIG', payload: { spikes } })}
          onAutoGenerate={handleAutoGenerateSpikes}
          onAddManual={handleAddManualSpike}
        />
      </div>
    </motion.div>
  );
};

export default BudgetConfig;
