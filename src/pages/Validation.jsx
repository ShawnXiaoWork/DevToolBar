import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { ShieldAlert, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateCumulativeCost } from '../services/mathUtils';

const Validation = () => {
  const { state } = useGame();
  const { playerModel, features } = state;

  // 全局审计计算逻辑
  const auditResults = useMemo(() => {
    const milestones = [1, 3, 7, 30];
    
    return milestones.map(day => {
      // 累计产出 (产出是按天累积的，全部折算为钻石价值)
      const totalProduction = features
        .filter(f => f.outputResources?.length > 0)
        .reduce((sum, f) => {
          const resId = f.outputResources[0]?.resourceId;
          const rate = state.resources.find(r => r.id === resId)?.diamondRate || 0;
          const dailyValue = playerModel.dailyTime * playerModel.efficiency * (f.auditParams?.outputPerMin || 0) * rate;
          return sum + (dailyValue * day);
        }, 0);

      // 累计刚性消耗 (基于 Progression Path 自动计算)
      const milestoneKey = `day${day}`;
      const targets = playerModel.milestones[milestoneKey]?.progressionTargets || [];
      const totalConsumption = targets.reduce((sum, target) => {
        const feat = features.find(f => f.id === target.featureId);
        if (!feat) return sum;
        const rawCost = calculateCumulativeCost(feat.growthModel, feat.params, target.targetLevel);
        return sum + (rawCost * (feat.auditParams?.valueCostRatio || 1));
      }, 0);

      const balance = totalProduction - totalConsumption;
      const ratio = totalConsumption > 0 ? totalProduction / totalConsumption : totalProduction > 0 ? 99 : 1;

      return {
        day,
        dayLabel: `Day ${day}`,
        production: totalProduction,
        consumption: totalConsumption,
        balance,
        ratio,
        status: ratio > 1.2 ? 'overflow' : ratio < 0.8 ? 'shortage' : 'balanced'
      };
    });
  }, [playerModel, features, state.resources]);

  // 生成预警信息
  const redFlags = useMemo(() => {
    const flags = [];
    const d7 = auditResults.find(r => r.day === 7);
    const d30 = auditResults.find(r => r.day === 30);

    if (d7?.status === 'overflow') {
      flags.push({ 
        type: 'error', 
        title: '第 7 天资源溢出', 
        desc: `总产出价值比消耗高出 ${((d7.ratio - 1) * 100).toFixed(0)}%。这意味着玩家账户中会有大量无法消耗的钻石价值结余。` 
      });
    } else if (d7?.status === 'shortage') {
      flags.push({ 
        type: 'warning', 
        title: '第 7 天资源紧缺', 
        desc: `当前产出价值无法覆盖目标缺口。玩家会感到非常卡关，除非额外投放资源。` 
      });
    }

    if (d30?.ratio > 2) {
      flags.push({ 
        type: 'critical', 
        title: '长期数值崩盘预警', 
        desc: '到第 30 天时，系统产出的总钻石价值已严重超标，后期通货膨胀不可控。' 
      });
    }

    // 无效解锁检测
    const coreFeatures = features.filter(f => f.type === 'Core' && f.physicalResources?.length > 0);
    if (coreFeatures.length > 0 && playerModel.milestones.day1.targetValueGap === 0) {
      flags.push({
        type: 'info',
        title: '目标配置缺失',
        desc: '已配置核心消耗系统，但第 1 天目标价值缺口为 0，导致系统无法评估早期压力。'
      });
    }

    return flags;
  }, [auditResults, features, playerModel]);

  return (
    <div className="validation-container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>全局金本位审计 (Gold Standard Audit)</h1>
        <p style={{ color: 'var(--text-secondary)' }}>基于钻石价值折算 1/3/7/30 天的总产出与总消耗平衡性</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* 左侧：趋势图表 */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--accent-primary)" /> 累计钻石价值平衡曲线
          </h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={auditResults}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5252" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF5252" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="dayLabel" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)} 💎`, '']}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="production" name="预期总价值" stroke="#00E676" fillOpacity={1} fill="url(#colorProd)" />
                <Area type="monotone" dataKey="consumption" name="刚性总消耗" stroke="#FF5252" fillOpacity={1} fill="url(#colorCons)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* 数据对比卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '2rem' }}>
            {auditResults.map(res => (
              <div key={res.day} style={{ 
                background: 'rgba(0,0,0,0.2)', 
                padding: '1rem', 
                borderRadius: '8px',
                borderBottom: `3px solid ${res.status === 'overflow' ? '#00E676' : res.status === 'shortage' ? '#FF5252' : 'var(--accent-primary)'}`
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{res.dayLabel} 结余 (钻石)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '4px 0', color: res.balance >= 0 ? '#00E676' : '#FF5252' }}>
                  {res.balance > 0 ? '+' : ''}{res.balance.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  产销比: {res.ratio.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：智能预警与建议 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="var(--accent-danger)" /> 智能审计报告
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {redFlags.length > 0 ? redFlags.map((flag, i) => (
                <div key={i} style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  background: flag.type === 'critical' ? 'rgba(255,82,82,0.1)' : flag.type === 'error' ? 'rgba(255,171,64,0.1)' : 'rgba(0,229,255,0.1)',
                  borderLeft: `4px solid ${flag.type === 'critical' ? '#FF5252' : flag.type === 'error' ? '#FFAB40' : '#00E5FF'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '0.4rem', color: '#fff' }}>
                    {flag.type === 'critical' ? <ShieldAlert size={16} /> : flag.type === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
                    {flag.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {flag.desc}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={48} style={{ marginBottom: '1rem', color: '#00E676', opacity: 0.5 }} />
                  <p>当前配置下，各阶段数值表现稳健，未发现明显崩盘风险。</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(124,77,255,0.05)' }}>
             <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)', marginBottom: '0.8rem' }}>调优建议</h4>
             <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                <li>若 D7 溢出，建议在 D6 解锁一个高频消耗点（如天赋洗炼）。</li>
                <li>核心产出系统（如挂机）的产出占比建议控制在总产出的 60%-70% 之间。</li>
                <li>战力转化系数应随天数呈对数增长，避免后期膨胀过快。</li>
             </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Validation;
