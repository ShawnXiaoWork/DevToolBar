import React from 'react';
import { BarChart3, Zap } from 'lucide-react';
import { getNextIdForRole, generateMatrixUnits } from '../../utils/planningUtils';

const MatrixGenerator = ({ matrixConfig, setMatrixConfig, roleWeights, derivationParams, dispatch, state, namesPool }) => {
  return (
    <div className="planning-card glass" style={{ border: '1px solid var(--accent-primary)', boxShadow: '0 0 20px rgba(124, 77, 255, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}><BarChart3 size={18} color="var(--accent-primary)" /> 矩阵生成器 (Matrix Generator)</h3>
        <span className="badge" style={{ background: 'var(--accent-primary)', fontSize: '0.7rem' }}>BETA</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>根据高维度规划自动批量裂变兵种库。</p>

      <div className="config-matrix" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="input-row">
          <div className="input-group">
            <label>预期总关卡数</label>
            <input type="number" value={matrixConfig.totalLevels} onChange={e => setMatrixConfig({ ...matrixConfig, totalLevels: Number(e.target.value) })} />
          </div>
          <div className="input-group">
            <label>兵种迭代密度 (每N关)</label>
            <input type="number" value={matrixConfig.updateFrequency} onChange={e => setMatrixConfig({ ...matrixConfig, updateFrequency: Number(e.target.value) })} />
          </div>
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label>随机波动方差 (Randomness)</label>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{Math.round(matrixConfig.randomness * 100)}%</span>
          </div>
          <input type="range" min="0" max="0.5" step="0.05" value={matrixConfig.randomness} onChange={e => setMatrixConfig({ ...matrixConfig, randomness: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>

        <div className="role-proportions glass" style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>职能分布权重 (库级占比)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {Object.keys(matrixConfig.roleDistribution).map(role => (
              <div key={role} className="input-group">
                <label style={{ fontSize: '0.7rem' }}>{ROLE_LABELS[role] || role} %</label>
                <input type="number" step="0.05" value={matrixConfig.roleDistribution[role]} onChange={e => {
                  const newDist = { ...matrixConfig.roleDistribution, [role]: Number(e.target.value) };
                  setMatrixConfig({ ...matrixConfig, roleDistribution: newDist });
                }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: Object.values(matrixConfig.roleDistribution).reduce((a, b) => a + b, 0).toFixed(2) === '1.00' ? '#00E676' : '#FF5252' }}>
            分布系数总和: {Object.values(matrixConfig.roleDistribution).reduce((a, b) => a + b, 0).toFixed(2)} (应为 1.0)
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Boss 产出频率 (每 N 个普通怪)</label>
            <input type="number" value={matrixConfig.bossFrequency} onChange={e => setMatrixConfig({ ...matrixConfig, bossFrequency: Number(e.target.value) })} />
          </div>
          <div className="input-group">
            <label>每关强制投放 Boss 数</label>
            <input type="number" value={matrixConfig.minBossPerLevel} onChange={e => setMatrixConfig({ ...matrixConfig, minBossPerLevel: Number(e.target.value) })} />
          </div>
        </div>

        <button className="btn-primary" style={{ height: '50px', fontSize: '1rem' }} onClick={() => {
          const newUnits = generateMatrixUnits(matrixConfig, roleWeights, derivationParams, state?.units || [], namesPool);

          if (confirm(`系统即将生成 ${newUnits.length} 个兵种并加入库中，是否继续？`)) {
            dispatch({ type: 'IMPORT_UNITS', payload: newUnits });
            alert('矩阵生成完毕！');
          }
        }}>
          <Zap size={18} /> 一键批量生成兵种矩阵
        </button>
      </div>
    </div>
  );
};

export default MatrixGenerator;
