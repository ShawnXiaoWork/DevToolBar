import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import PlanRow from './PlanRow';
import { syncAllLevelTables } from '../../utils/exportUtils';

const DeploymentPlan = ({ fullLevelPlan, previewRange, units, roleWeights, derivationParams }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const exportToExcel = () => {
    const data = fullLevelPlan.map(lp => ({
      '关卡': lp.level,
      '目标阶层': lp.targetTier,
      '总预算': lp.budget,
      '是否Boss关': lp.isBossLevel ? '是' : '否',
      'HP系数': lp.hpCoeff.toFixed(2),
      'ATK系数': lp.atkCoeff.toFixed(2),
      '阵容构成': lp.selected.map(s => `${s.name}(ID:${s.id}) x${s.count}`).join('; '),
      '单位详情': lp.selected.map(s => `[${s.name}: HP:${s.hp}, ATK:${s.atk}]`).join(' | ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LevelPlan");
    XLSX.writeFile(wb, `LevelPlan_${Date.now()}.xlsx`);
  };

  const exportToJson = () => {
    const content = JSON.stringify(fullLevelPlan, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_plan_${Date.now()}.json`;
    a.click();
  };

  const handleSyncAllTables = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncAllLevelTables({
        fullLevelPlan,
        units,
        roleWeights,
        derivationParams
      });
      alert(`同步成功：${result.syncedTables.join('、')} 已更新。`);
    } catch (error) {
      const failedText = error.failedTables
        ? error.failedTables.map(item => `${item.table}: ${item.message}`).join('\n')
        : (error.message || '未知错误');
      const syncedText = error.syncedTables?.length
        ? `\n已成功同步：${error.syncedTables.join('、')}`
        : '';
      alert(`同步未全部完成，请检查以下异常：\n${failedText}${syncedText}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="full-plan-container"
    >
      <div className="plan-header glass">
        <div className="plan-info">
          <h2>全关卡自动部署规划 (Producer Plan)</h2>
          <p>基于当前难度曲线与兵种库，系统已自动计算并分配了前 {previewRange} 关的敌军阵容。</p>
        </div>
        <div className="plan-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-primary"
            style={{ background: '#4CAF50' }}
            onClick={handleSyncAllTables}
            disabled={isSyncing}
          >
            <RefreshCw size={16} /> {isSyncing ? '同步中...' : '一键同步所有配置表'}
          </button>
          <button className="btn-outline" onClick={exportToExcel}>
            <Download size={16} /> 导出汇总规划 (Excel)
          </button>
          <button className="btn-outline" onClick={exportToJson}>
            <Upload size={16} /> 导出配置 (JSON)
          </button>
        </div>
      </div>

      <div className="plan-list">
        {fullLevelPlan.map((p) => (
          <PlanRow key={p.level} plan={p} />
        ))}
      </div>
    </motion.div>
  );
};

export default DeploymentPlan;
