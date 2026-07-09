import React from 'react';
import { BarChart3, Zap, RotateCcw } from 'lucide-react';
import { getNextIdForRole, generateMatrixUnits } from '../../utils/planningUtils';
import { ROLE_LABELS } from '../../utils/constants';

const MatrixGenerator = ({ matrixConfig, setMatrixConfig, roleWeights, derivationParams, dispatch, state, namesPool, namesSource, loadNamesPool }) => {
  const namesCount = React.useMemo(() => {
    if (!namesPool) return 0;
    let count = 0;
    Object.values(namesPool).forEach(rolePool => {
      Object.values(rolePool).forEach(list => {
        if (Array.isArray(list)) count += list.length;
      });
    });
    return count;
  }, [namesPool]);

  return (
    <div className="planning-card glass" style={{ border: '1px solid var(--accent-primary)', boxShadow: '0 0 20px rgba(124, 77, 255, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}><BarChart3 size={18} color="var(--accent-primary)" /> 矩阵生成器 (Matrix Generator)</h3>
        <span className="badge" style={{ background: 'var(--accent-primary)', fontSize: '0.7rem' }}>BETA</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>根据高维度规划自动批量裂变兵种库。</p>

      {/* 名字库状态展示与重新加载 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        marginBottom: '1.25rem',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', flexFlow: 'column nowrap', gap: '2px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>名称数据源: </span>
            <span style={{
              fontWeight: '600',
              color: namesSource === 'default' ? '#FF5252' : '#00E676',
              marginLeft: '0.25rem'
            }}>
              {namesSource === 'default' ? '系统内置默认名字库' : namesSource}
            </span>
          </div>
          {namesPool && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              当前加载名额总量: <strong style={{ color: 'var(--accent-primary)' }}>{namesCount}</strong> 个可用名称
            </div>
          )}
        </div>
        <button
          className="btn-outline"
          style={{
            padding: '6px 10px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            color: 'var(--text-primary)',
            background: 'rgba(255, 255, 255, 0.05)',
            cursor: 'pointer',
            borderRadius: '6px',
            transition: 'all 0.2s'
          }}
          onClick={async () => {
            if (loadNamesPool) {
              await loadNamesPool(false);
            }
          }}
          title="点击重新读取 public 目录下的名字库文件"
        >
          <RotateCcw size={12} /> 重新加载
        </button>
      </div>

      <div className="config-matrix" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="input-row">
          <div className="input-group" style={{ gridColumn: 'span 2' }}>
            <label>兵种库生成总量 (库建模数量)</label>
            <input type="number" value={matrixConfig.totalUnits || 0} onChange={e => setMatrixConfig({ ...matrixConfig, totalUnits: Number(e.target.value) })} />
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
            <label>Boss关强制投放 Boss 数</label>
            <input type="number" value={matrixConfig.minBossPerLevel} onChange={e => setMatrixConfig({ ...matrixConfig, minBossPerLevel: Number(e.target.value) })} />
          </div>
        </div>

        <button className="btn-primary" style={{ height: '50px', fontSize: '1rem' }} onClick={async () => {
          let activePool = namesPool;
          if (loadNamesPool) {
            // 静默更新最新文件数据，保证最新写入的名字能实时应用
            const freshPool = await loadNamesPool(true);
            if (freshPool) {
              activePool = freshPool;
            }
          }

          const newUnits = generateMatrixUnits(matrixConfig, roleWeights, derivationParams, state?.units || [], activePool);

          if (confirm(`系统已动态同步最新名字库，即将批量裂变生成 ${newUnits.length} 个兵种并加入库中，是否继续？`)) {
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

