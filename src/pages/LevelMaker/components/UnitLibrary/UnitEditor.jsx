import React from 'react';

const UnitEditor = ({ unit, onSave, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content glass">
        <h3>{unit?.id ? '编辑兵种' : '新增兵种'}</h3>
        <form onSubmit={onSave}>
          <div className="input-group">
            <label>名称</label>
            <input name="name" defaultValue={unit?.name} required />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>生命值 (HP)</label>
              <input type="number" name="hp" defaultValue={unit?.hp || 100} required />
            </div>
            <div className="input-group">
              <label>攻击力 (ATK)</label>
              <input type="number" name="atk" defaultValue={unit?.atk || 10} required />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>速度 (SPD)</label>
              <input type="number" name="spd" defaultValue={unit?.spd || 10} required />
            </div>
            <div className="input-group">
              <label>技能强度 (SKL)</label>
              <input type="number" name="skillPower" defaultValue={unit?.skillPower || 0} required />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>攻击速度 (ASP)</label>
              <input type="number" step="0.1" name="atkSpeed" defaultValue={unit?.atkSpeed || 1.0} required />
            </div>
            <div className="input-group">
              <label>攻击范围 (ARNG)</label>
              <input type="number" name="atkRange" defaultValue={unit?.atkRange || 100} required />
            </div>
            <div className="input-group">
              <label>索敌范围 (DRNG)</label>
              <input type="number" name="detRange" defaultValue={unit?.detRange || 200} required />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>职能标签 (数字ID, 逗号分隔)</label>
              <input name="roles" defaultValue={unit?.roles?.join(', ') || '0'} required />
            </div>
            <div className="input-group">
              <label>ArmyTag (1-4, 9)</label>
              <input type="number" name="armyTag" defaultValue={unit?.armyTag || 1} required />
            </div>
          </div>
          <div className="input-group">
            <label>出现权重 (Spawn Weight)</label>
            <input type="number" name="spawnWeight" defaultValue={unit?.spawnWeight || 50} required />
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onCancel}>取消</button>
            <button type="submit" className="btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnitEditor;
