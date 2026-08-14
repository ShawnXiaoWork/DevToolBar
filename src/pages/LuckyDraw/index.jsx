import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Filter,
  FlaskConical,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  WandSparkles
} from 'lucide-react'
import { loadExcelWorkbook, saveExcelWorkbook } from '../../utils/excelSyncUtils'
import {
  applyRewardsToTargets,
  buildPoolRewards,
  filterItems,
  parseItemTable,
  parseLuckyDrawTable,
  updateLuckyDrawSheet,
  validateDraw
} from './utils/luckyDrawUtils'
import './luckyDraw.css'

const EMPTY_FILTERS = { search: '', types: [], subTypes: [], qualities: [], idRanges: '', excludedRanges: '' }
const DEFAULT_QUALITY_WEIGHTS = { 0: 0, 1: 0, 2: 0, 3: 4800, 4: 4200, 5: 1000, 6: 0 }
const RECIPE_KEY = 'devtoolbar-lucky-draw-recipes-v1'

const readRecipes = () => {
  try { return JSON.parse(localStorage.getItem(RECIPE_KEY) || '[]') } catch { return [] }
}

const Field = ({ label, children, hint }) => (
  <label className="ld-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
)

const MultiChips = ({ values, options, onChange }) => (
  <div className="ld-chips">
    {options.map(option => {
      const active = values.includes(option)
      return (
        <button key={option} type="button" className={active ? 'active' : ''} onClick={() => onChange(active ? values.filter(value => value !== option) : [...values, option])}>
          {option}
        </button>
      )
    })}
  </div>
)

const PoolTargets = ({ draw, targets, setTargets }) => {
  const choices = [
    { key: 'normal', label: '普通奖池' },
    ...draw.fixedPools.map((pool, index) => ({ key: `fixed:${index}`, label: `固定 · 第 ${pool.time} 抽` })),
    ...draw.specialPools.map((pool, index) => ({ key: `special:${index}`, label: `特殊 · 每 ${pool.time} 抽` }))
  ]
  return (
    <div className="ld-target-list">
      {choices.map(choice => (
        <label key={choice.key} className={targets.includes(choice.key) ? 'selected' : ''}>
          <input type="checkbox" checked={targets.includes(choice.key)} onChange={() => setTargets(targets.includes(choice.key) ? targets.filter(key => key !== choice.key) : [...targets, choice.key])} />
          <span>{choice.label}</span>
        </label>
      ))}
    </div>
  )
}

const getTargetRewards = (draw, key) => {
  if (!draw) return []
  if (key === 'normal') return draw.normalRewards
  if (key.startsWith('fixed:')) return draw.fixedPools[Number(key.split(':')[1])]?.rewards || []
  if (key.startsWith('special:')) return draw.specialPools[Number(key.split(':')[1])]?.rewards || []
  return []
}

const LuckyDraw = () => {
  const [items, setItems] = useState([])
  const [draws, setDraws] = useState([])
  const [workbookState, setWorkbookState] = useState(null)
  const [activeDrawId, setActiveDrawId] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [targets, setTargets] = useState(['normal'])
  const [mode, setMode] = useState('quality')
  const [totalWeight, setTotalWeight] = useState(10000)
  const [qualityWeights, setQualityWeights] = useState(DEFAULT_QUALITY_WEIGHTS)
  const [qualityQuantities, setQualityQuantities] = useState({})
  const [defaultQuantity, setDefaultQuantity] = useState(1)
  const [rangeRules, setRangeRules] = useState([])
  const [manualOverrides, setManualOverrides] = useState({})
  const [mergeMode, setMergeMode] = useState(false)
  const [recipes, setRecipes] = useState(readRecipes)
  const [recipeName, setRecipeName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [dirty, setDirty] = useState(false)

  const loadTables = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [itemResult, drawResult] = await Promise.all([
        loadExcelWorkbook('ItemTable.xlsx'),
        loadExcelWorkbook('LuckyDrawTable.xlsx')
      ])
      const parsedItems = parseItemTable(itemResult.fullData, itemResult.headers)
      const parsedDraws = parseLuckyDrawTable(drawResult.fullData, drawResult.headers)
      setItems(parsedItems)
      setDraws(parsedDraws)
      setWorkbookState(drawResult)
      setActiveDrawId(parsedDraws[0]?.id ?? null)
      setSelectedIds(new Set())
      setDirty(false)
      setMessage({ type: 'success', text: `已读取 ${parsedItems.length} 个道具、${parsedDraws.length} 个奖池` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '读取配置表失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadTables, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const activeDraw = draws.find(draw => draw.id === activeDrawId)
  const typeOptions = useMemo(() => [...new Set(items.map(item => item.type))].sort((a, b) => a - b), [items])
  const subTypeOptions = useMemo(() => [...new Set(items.map(item => item.subType))].sort((a, b) => a - b), [items])
  const qualityOptions = useMemo(() => [...new Set(items.map(item => item.quality))].sort((a, b) => a - b), [items])
  const filteredItems = useMemo(() => filterItems(items, filters), [items, filters])
  const previewRewards = useMemo(() => buildPoolRewards({
    items,
    selectedIds,
    totalWeight,
    mode,
    qualityWeights,
    rangeRules,
    defaultQuantity,
    qualityQuantities,
    manualOverrides
  }), [items, selectedIds, totalWeight, mode, qualityWeights, rangeRules, defaultQuantity, qualityQuantities, manualOverrides])

  const previewWeight = previewRewards.reduce((sum, item) => sum + item.weight, 0)
  const qualitySummary = useMemo(() => previewRewards.reduce((summary, item) => {
    summary[item.quality] = (summary[item.quality] || 0) + item.weight
    return summary
  }, {}), [previewRewards])
  const changeSummary = useMemo(() => targets.reduce((summary, key) => {
    const existing = new Map(getTargetRewards(activeDraw, key).map(entry => [Number(entry[0]), entry]))
    const generated = new Map(previewRewards.map(item => [item.id, [item.id, item.quantity, item.weight]]))
    generated.forEach((entry, id) => {
      if (!existing.has(id)) summary.added += 1
      else if (Number(existing.get(id)[1]) !== entry[1] || Number(existing.get(id)[2]) !== entry[2]) summary.changed += 1
    })
    if (!mergeMode) existing.forEach((_, id) => { if (!generated.has(id)) summary.removed += 1 })
    return summary
  }, { added: 0, changed: 0, removed: 0 }), [activeDraw, targets, previewRewards, mergeMode])

  const toggleFiltered = () => {
    const allSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id))
    const next = new Set(selectedIds)
    filteredItems.forEach(item => allSelected ? next.delete(item.id) : next.add(item.id))
    setSelectedIds(next)
  }

  const applyPreview = () => {
    if (!activeDraw || !targets.length || !previewRewards.length) {
      setMessage({ type: 'error', text: '请先选择目标奖池和至少一个有效道具' })
      return
    }
    const updated = applyRewardsToTargets(activeDraw, targets, previewRewards, mergeMode)
    setDraws(current => current.map(draw => draw.id === activeDraw.id ? updated : draw))
    setDirty(true)
    setMessage({ type: 'success', text: `已将 ${previewRewards.length} 项应用到 ${targets.length} 个目标，尚未写入 Excel` })
  }

  const saveExcel = async () => {
    if (!workbookState) return
    const validations = draws.map(draw => ({ draw, ...validateDraw(draw) }))
    const errors = validations.flatMap(result => result.errors.map(error => `${result.draw.remarks || result.draw.id}：${error}`))
    if (errors.length) {
      setMessage({ type: 'error', text: `无法保存：${errors.slice(0, 3).join('；')}${errors.length > 3 ? '…' : ''}` })
      return
    }
    setSaving(true)
    try {
      updateLuckyDrawSheet({ sheet: workbookState.sheet, headers: workbookState.headers, draws })
      const result = await saveExcelWorkbook(workbookState.workbook, 'LuckyDrawTable.xlsx')
      setDirty(false)
      const warnings = validations.flatMap(result => result.warnings)
      setMessage({ type: warnings.length ? 'warning' : 'success', text: `${result.message || 'LuckyDrawTable.xlsx 同步成功'}${warnings.length ? `；${warnings[0]}` : ''}` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const addRangeRule = () => setRangeRules(current => [...current, { min: 20301, max: 20315, mode: 'group', weight: 1000 }])
  const updateRangeRule = (index, patch) => setRangeRules(current => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule))

  const saveRecipe = () => {
    const name = recipeName.trim()
    if (!name) return setMessage({ type: 'error', text: '请先填写配方名称' })
    const recipe = { id: Date.now(), name, filters, mode, totalWeight, qualityWeights, qualityQuantities, defaultQuantity, rangeRules }
    const next = [...recipes.filter(item => item.name !== name), recipe]
    localStorage.setItem(RECIPE_KEY, JSON.stringify(next))
    setRecipes(next)
    setRecipeName('')
    setMessage({ type: 'success', text: `配方“${name}”已保存到本机` })
  }

  const loadRecipe = recipe => {
    setFilters(recipe.filters || EMPTY_FILTERS)
    setMode(recipe.mode || 'equal')
    setTotalWeight(recipe.totalWeight || 10000)
    setQualityWeights(recipe.qualityWeights || DEFAULT_QUALITY_WEIGHTS)
    setQualityQuantities(recipe.qualityQuantities || {})
    setDefaultQuantity(recipe.defaultQuantity || 1)
    setRangeRules(recipe.rangeRules || [])
    const matched = filterItems(items, recipe.filters || EMPTY_FILTERS)
    setSelectedIds(new Set(matched.map(item => item.id)))
    setMessage({ type: 'success', text: `已执行配方“${recipe.name}”，匹配 ${matched.length} 项` })
  }

  if (loading) return <div className="ld-loading"><RefreshCw className="spin" /> 正在读取奖池配置…</div>

  return (
    <div className="ld-page">
      <div className="ld-hero">
        <div>
          <div className="ld-eyebrow"><WandSparkles size={15} /> RULE-DRIVEN POOL BUILDER</div>
          <h1>奖池配置工坊</h1>
          <p>筛选一批道具，用品质或 ID 段一次生成可审计的整数权重。</p>
        </div>
        <div className="ld-hero-actions">
          <button className="btn-secondary" onClick={loadTables}><RefreshCw size={16} /> 重新读取</button>
          <button className="btn-primary" disabled={!dirty || saving} onClick={saveExcel}><Save size={16} /> {saving ? '同步中…' : '同步 Excel'}</button>
        </div>
      </div>

      {message && <div className={`ld-message ${message.type}`}>{message.type === 'error' || message.type === 'warning' ? <AlertTriangle size={17} /> : <Check size={17} />}{message.text}</div>}

      <div className="ld-overview">
        <div><Database /><span>道具源</span><strong>{items.length}</strong></div>
        <div><Layers3 /><span>候选结果</span><strong>{filteredItems.length}</strong></div>
        <div><Check /><span>已选择</span><strong>{selectedIds.size}</strong></div>
        <div><SlidersHorizontal /><span>预览总权重</span><strong className={previewWeight === Number(totalWeight) ? 'ok' : 'warn'}>{previewWeight}</strong></div>
      </div>

      <div className="ld-layout">
        <aside className="ld-sidebar">
          <section className="ld-card">
            <div className="ld-section-title"><Layers3 size={17} /> 当前奖池</div>
            <select value={activeDrawId ?? ''} onChange={event => { setActiveDrawId(Number(event.target.value)); setTargets(['normal']) }}>
              {draws.map(draw => <option key={draw.id} value={draw.id}>{draw.id} · {draw.remarks}</option>)}
            </select>
            {activeDraw && <PoolTargets draw={activeDraw} targets={targets} setTargets={setTargets} />}
            <label className="ld-switch"><input type="checkbox" checked={mergeMode} onChange={event => setMergeMode(event.target.checked)} /><span>合并到已有奖池</span></label>
          </section>

          <section className="ld-card">
            <div className="ld-section-title"><Copy size={17} /> 建池配方</div>
            <div className="ld-inline"><input placeholder="配方名称" value={recipeName} onChange={event => setRecipeName(event.target.value)} /><button onClick={saveRecipe}><Save size={15} /></button></div>
            <div className="ld-recipes">
              {recipes.map(recipe => <div key={recipe.id}><button onClick={() => loadRecipe(recipe)}>{recipe.name}</button><button className="danger" title="删除" onClick={() => { const next = recipes.filter(item => item.id !== recipe.id); setRecipes(next); localStorage.setItem(RECIPE_KEY, JSON.stringify(next)) }}><Trash2 size={13} /></button></div>)}
              {!recipes.length && <small>保存筛选与权重规则，之后可按最新 ItemTable 重新执行。</small>}
            </div>
          </section>
        </aside>

        <main className="ld-main">
          <section className="ld-card ld-filter-card">
            <div className="ld-section-head"><div className="ld-section-title"><Filter size={17} /> 1. 筛选候选道具</div><button className="ld-text-button" onClick={() => setFilters(EMPTY_FILTERS)}>清空筛选</button></div>
            <div className="ld-filter-grid">
              <Field label="关键词"><div className="ld-search"><Search size={15} /><input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="ID / 策划备注 / Name" /></div></Field>
              <Field label="ID 范围" hint="多个范围用逗号分隔"><input value={filters.idRanges} onChange={event => setFilters({ ...filters, idRanges: event.target.value })} placeholder="20301-20610, 650001" /></Field>
              <Field label="排除 ID"><input value={filters.excludedRanges} onChange={event => setFilters({ ...filters, excludedRanges: event.target.value })} placeholder="20606-20610" /></Field>
            </div>
            <Field label="Type"><MultiChips values={filters.types} options={typeOptions} onChange={types => setFilters({ ...filters, types })} /></Field>
            <Field label="SubType"><MultiChips values={filters.subTypes} options={subTypeOptions} onChange={subTypes => setFilters({ ...filters, subTypes })} /></Field>
            <Field label="品质"><MultiChips values={filters.qualities} options={qualityOptions} onChange={qualities => setFilters({ ...filters, qualities })} /></Field>
          </section>

          <section className="ld-card">
            <div className="ld-section-head"><div className="ld-section-title"><Check size={17} /> 2. 批量选择</div><button className="btn-secondary compact" onClick={toggleFiltered}>{filteredItems.length && filteredItems.every(item => selectedIds.has(item.id)) ? '取消当前结果' : `全选当前 ${filteredItems.length} 项`}</button></div>
            <div className="ld-item-table-wrap">
              <table className="ld-item-table">
                <thead><tr><th></th><th>ID</th><th>策划备注</th><th>Type</th><th>SubType</th><th>品质</th></tr></thead>
                <tbody>
                  {filteredItems.slice(0, 300).map(item => <tr key={item.id} className={selectedIds.has(item.id) ? 'selected' : ''} onClick={() => { const next = new Set(selectedIds); next.has(item.id) ? next.delete(item.id) : next.add(item.id); setSelectedIds(next) }}><td><input type="checkbox" readOnly checked={selectedIds.has(item.id)} /></td><td>{item.id}</td><td>{item.note}</td><td>{item.type}</td><td>{item.subType}</td><td><span className={`ld-quality q${item.quality}`}>Q{item.quality}</span></td></tr>)}
                </tbody>
              </table>
              {filteredItems.length > 300 && <div className="ld-table-note">为保证页面流畅，仅展示前 300 项；“全选当前结果”仍会选择全部 {filteredItems.length} 项。</div>}
            </div>
          </section>
        </main>

        <aside className="ld-rules">
          <section className="ld-card">
            <div className="ld-section-title"><SlidersHorizontal size={17} /> 3. 分配权重</div>
            <div className="ld-mode-tabs">
              {[['equal', '等权'], ['quality', '按品质'], ['range', '按 ID 段']].map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}
            </div>
            <div className="ld-two-fields">
              <Field label="目标总权重"><input type="number" min="1" value={totalWeight} onChange={event => setTotalWeight(Number(event.target.value))} /></Field>
              <Field label="默认数量"><input type="number" min="1" value={defaultQuantity} onChange={event => setDefaultQuantity(Number(event.target.value))} /></Field>
            </div>

            {mode === 'quality' && <div className="ld-quality-rules">
              <div className="ld-rule-header"><span>品质</span><span>组权重</span><span>数量</span></div>
              {qualityOptions.map(quality => <div key={quality}><span className={`ld-quality q${quality}`}>Q{quality}</span><input type="number" min="0" value={qualityWeights[quality] ?? 0} onChange={event => setQualityWeights({ ...qualityWeights, [quality]: Number(event.target.value) })} /><input type="number" min="1" placeholder={defaultQuantity} value={qualityQuantities[quality] ?? ''} onChange={event => setQualityQuantities({ ...qualityQuantities, [quality]: event.target.value === '' ? undefined : Number(event.target.value) })} /></div>)}
            </div>}

            {mode === 'range' && <div className="ld-range-rules">
              {rangeRules.map((rule, index) => <div key={index} className="ld-range-row"><input type="number" value={rule.min} onChange={event => updateRangeRule(index, { min: Number(event.target.value) })} /><span>—</span><input type="number" value={rule.max} onChange={event => updateRangeRule(index, { max: Number(event.target.value) })} /><select value={rule.mode} onChange={event => updateRangeRule(index, { mode: event.target.value })}><option value="group">组总权重</option><option value="perItem">单项比例</option></select><input type="number" min="0" value={rule.weight} onChange={event => updateRangeRule(index, { weight: Number(event.target.value) })} /><button className="danger" onClick={() => setRangeRules(current => current.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 size={14} /></button></div>)}
              <button className="ld-add-button" onClick={addRangeRule}><Plus size={15} /> 添加 ID 段</button>
              <small>靠后的范围规则优先；所有相对权重最终归一化到目标总权重。</small>
            </div>}
          </section>

          <section className="ld-card ld-preview-card">
            <div className="ld-section-head"><div className="ld-section-title"><FlaskConical size={17} /> 4. 最终预览</div><span>{previewRewards.length} 项</span></div>
            <div className="ld-quality-summary">
              {Object.entries(qualitySummary).sort(([a], [b]) => Number(a) - Number(b)).map(([quality, weight]) => <div key={quality}><span>Q{quality}</span><strong>{previewWeight ? (weight / previewWeight * 100).toFixed(2) : '0.00'}%</strong><small>{weight}</small></div>)}
            </div>
            <div className="ld-diff-summary">
              <span><b>+{changeSummary.added}</b> 新增</span>
              <span><b>~{changeSummary.changed}</b> 调整</span>
              <span className={changeSummary.removed ? 'danger' : ''}><b>-{changeSummary.removed}</b> 移除</span>
            </div>
            <div className="ld-preview-list">
              {previewRewards.slice(0, 80).map(item => <div key={item.id}><div><strong>{item.id}</strong><span>{item.note}</span><small>{item.source}</small></div><input title="数量" type="number" min="1" value={item.quantity} onChange={event => setManualOverrides(current => ({ ...current, [item.id]: { ...current[item.id], quantity: Number(event.target.value) } }))} /><input title="权重" type="number" min="1" value={item.weight} onChange={event => setManualOverrides(current => ({ ...current, [item.id]: { ...current[item.id], weight: Number(event.target.value) } }))} /><b>{previewWeight ? (item.weight / previewWeight * 100).toFixed(2) : '0.00'}%</b></div>)}
              {!previewRewards.length && <div className="ld-empty">选择道具后将在这里生成权重。</div>}
            </div>
            <button className="btn-primary ld-apply" onClick={applyPreview}><WandSparkles size={16} /> {mergeMode ? '合并到所选奖池' : '覆盖所选奖池'}</button>
            <small className="ld-save-hint">应用只更新页面草稿；点击顶部“同步 Excel”后才会写入文件。</small>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default LuckyDraw
