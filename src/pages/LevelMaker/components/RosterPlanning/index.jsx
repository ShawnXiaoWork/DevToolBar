import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import UnitDerivation from './UnitDerivation';
import MatrixGenerator from './MatrixGenerator';
import TemplateEditor from './TemplateEditor';

const RosterPlanning = ({ 
  state, 
  dispatch, 
  roleWeights, 
  setRoleWeights, 
  rosterTemplates, 
  setRosterTemplates, 
  activeTemplateId, 
  setActiveTemplateId,
  derivationParams,
  setDerivationParams,
  matrixConfig,
  setMatrixConfig,
  validationConfig,
  setValidationConfig
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="planning-dashboard"
    >
      <div className="planning-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <UnitDerivation 
          roleWeights={roleWeights} 
          setRoleWeights={setRoleWeights}
          derivationParams={derivationParams}
          setDerivationParams={setDerivationParams}
          dispatch={dispatch}
          state={state}
        />

        <div className="planning-right" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <MatrixGenerator 
            matrixConfig={matrixConfig}
            setMatrixConfig={setMatrixConfig}
            roleWeights={roleWeights}
            derivationParams={derivationParams}
            dispatch={dispatch}
          />

          <TemplateEditor 
            rosterTemplates={rosterTemplates}
            setRosterTemplates={setRosterTemplates}
            activeTemplateId={activeTemplateId}
            setActiveTemplateId={setActiveTemplateId}
          />

          <div className="planning-card glass">
            <h3><ShieldAlert size={18} color="var(--accent-danger)" /> 闭环验证参数 (Validation)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>用于模拟关卡的战斗时长和同屏压力预警。</p>
            <div className="input-row">
              <div className="input-group">
                <label>期望玩家 DPS</label>
                <input type="number" value={validationConfig.expectedDPS} onChange={e => setValidationConfig({ ...validationConfig, expectedDPS: Number(e.target.value) })} />
              </div>
              <div className="input-group">
                <label>期望通关时长(s)</label>
                <input type="number" value={validationConfig.targetDuration} onChange={e => setValidationConfig({ ...validationConfig, targetDuration: Number(e.target.value) })} />
              </div>
            </div>
            <div className="input-row">
              <div className="input-group">
                <label>最大同屏数量</label>
                <input type="number" value={validationConfig.maxDensity} onChange={e => setValidationConfig({ ...validationConfig, maxDensity: Number(e.target.value) })} />
              </div>
              <div className="input-group">
                <label>最小同屏数量</label>
                <input type="number" value={validationConfig.minDensity} onChange={e => setValidationConfig({ ...validationConfig, minDensity: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RosterPlanning;
