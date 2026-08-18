import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Filter,
  FlaskConical,
  Layers3,
  MousePointer2,
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
  buildInitialWeightConfig,
  buildPoolRewards,
  filterItems,
  parseArmyTable,
  parseItemTable,
  parseLuckyDrawTable,
  updateLuckyDrawSheet,
  validateDraw
} from './utils/luckyDrawUtils'
import './luckyDraw.css'

const EMPTY_FILTERS = { search: '', types: [], subTypes: [], qualities: [], idRanges: '', excludedRanges: '' }
const RECIPE_KEY = 'devtoolbar-lucky-draw-recipes-v1'

const getTargetMeta = (draw, key) => {
  if (key === 'normal') return { type: 'normal', label: '普通奖池', detail: '未命中固定或特殊规则时使用' }
  const [type, rawIndex] = String(key).split(':')
  const index = Number(rawIndex)
  if (type === 'fixed') {
    const time = draw?.fixedPools[index]?.time
    return { type, label: `固定奖池 · 第 ${time ?? '—'} 抽`, detail: '仅在指定抽数触发一次' }
  }
  const time = draw?.specialPools[index]?.time
  return { type: 'special', label: `特殊奖池 · 每 ${time ?? '—'} 抽`, detail: '按设定周期重复触发' }
}

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

const PoolTargets = ({ draw, targets, setTargets, activeTarget, onActivate, onPoolsChange }) => {
  const toggleTarget = key => setTargets(targets.includes(key) ? targets.filter(target => target !== key) : [...targets, key])
  const updateTime = (field, index, value) => {
    const pools = draw[field].map((pool, poolIndex) => poolIndex === index ? { ...pool, time: Number(value) } : pool)
    onPoolsChange(field, pools)
  }
  const addPool = field => {
    const pools = draw[field]
    const nextTime = pools.length ? Math.max(...pools.map(pool => Number(pool.time) || 0)) + 1 : 1
    const nextKey = `${field === 'fixedPools' ? 'fixed' : 'special'}:${pools.length}`
    onPoolsChange(field, [...pools, { time: nextTime, rewards: [] }], [nextKey], nextKey)
  }
  const removePool = (field, index) => {
    onPoolsChange(field, draw[field].filter((_, poolIndex) => poolIndex !== index), ['normal'], 'normal')
  }

  const renderPools = (field, title, prefix, suffix) => (
    <div className="ld-pool-group">
      <div className="ld-pool-group-head">
        <span>{title}</span>
        <button type="button" title={`添加${title}`} onClick={() => addPool(field)}><Plus size={13} /></button>
      </div>
      {draw[field].map((pool, index) => {
        const key = `${field === 'fixedPools' ? 'fixed' : 'special'}:${index}`
        return (
          <div key={key} className={`ld-pool-row ld-pool-${key.split(':')[0]} ${targets.includes(key) ? 'selected' : ''} ${activeTarget === key ? 'active' : ''}`}>
            <input type="checkbox" checked={targets.includes(key)} onChange={() => toggleTarget(key)} aria-label={`选择${title} ${pool.time}`} />
            <span>{prefix}</span>
            <input type="number" min="1" step="1" value={pool.time} onChange={event => updateTime(field, index, event.target.value)} aria-label={`${title} ${index + 1}`} />
            <span>{suffix}</span>
            <button type="button" className="ld-edit-pool" title={`编辑${title}`} onClick={() => onActivate(key)}><MousePointer2 size={12} /></button>
            <button type="button" className="danger" title={`删除${title}`} onClick={() => removePool(field, index)}><Trash2 size={13} /></button>
          </div>
        )
      })}
      {!draw[field].length && <small>暂未配置</small>}
    </div>
  )

  return (
    <div className="ld-target-list">
      <div className={`ld-normal-pool ${targets.includes('normal') ? 'selected' : ''} ${activeTarget === 'normal' ? 'active' : ''}`}>
        <label>
          <input type="checkbox" checked={targets.includes('normal')} onChange={() => toggleTarget('normal')} />
          <span>普通奖池</span>
        </label>
        <button type="button" className="ld-edit-pool" title="编辑普通奖池" onClick={() => onActivate('normal')}><MousePointer2 size={12} /></button>
      </div>
      {renderPools('fixedPools', '固定奖励次数', '第', '抽')}
      {renderPools('specialPools', '特殊奖励次数', '每', '抽')}
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
  const [itemCandidates, setItemCandidates] = useState([])
  const [armyCandidates, setArmyCandidates] = useState([])
  const [candidateSource, setCandidateSource] = useState('army')
  const [draws, setDraws] = useState([])
  const [workbookState, setWorkbookState] = useState(null)
  const [activeDrawId, setActiveDrawId] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [targets, setTargets] = useState(['normal'])
  const [activeTarget, setActiveTarget] = useState('normal')
  const [mode, setMode] = useState('quality')
  const [totalWeight, setTotalWeight] = useState(10000)
  const [qualityWeights, setQualityWeights] = useState({})
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
  const skipNextWeightInitialization = useRef(false)

  const loadTables = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [armyResult, itemResult, drawResult] = await Promise.all([
        loadExcelWorkbook('ArmyTable.xlsx'),
        loadExcelWorkbook('ItemTable.xlsx'),
        loadExcelWorkbook('LuckyDrawTable.xlsx')
      ])
      const parsedArmies = parseArmyTable(armyResult.fullData, armyResult.headers)
      const parsedItems = parseItemTable(itemResult.fullData, itemResult.headers)
      const parsedDraws = parseLuckyDrawTable(drawResult.fullData, drawResult.headers)
      setArmyCandidates(parsedArmies)
      setItemCandidates(parsedItems)
      setDraws(parsedDraws)
      setWorkbookState(drawResult)
      setActiveDrawId(parsedDraws[0]?.id ?? null)
      setSelectedIds(new Set())
      setDirty(false)
      setMessage({ type: 'success', text: `已读取 ${parsedArmies.length} 个兵种、${parsedItems.length} 个道具、${parsedDraws.length} 个奖池` })
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

  const items = candidateSource === 'army' ? armyCandidates : itemCandidates
  const activeDraw = draws.find(draw => draw.id === activeDrawId)
  const typeOptions = useMemo(() => [...new Set(items.map(item => item.type))].sort((a, b) => a - b), [items])
  const subTypeOptions = useMemo(() => [...new Set(items.map(item => item.subType))].sort((a, b) => a - b), [items])
  const qualityOptions = useMemo(() => [...new Set(items.map(item => item.quality))].sort((a, b) => a - b), [items])
  const filteredItems = useMemo(() => filterItems(items, filters), [items, filters])
  const selectedItems = useMemo(() => items.filter(item => selectedIds.has(item.id)), [items, selectedIds])
  const selectedQualityOptions = useMemo(() => [...new Set(selectedItems.map(item => item.quality))].sort((a, b) => a - b), [selectedItems])
  const selectionMatchesFilter = filteredItems.length > 0 && filteredItems.length === selectedIds.size && filteredItems.every(item => selectedIds.has(item.id))
  const activeTargetMeta = getTargetMeta(activeDraw, activeTarget)

  useEffect(() => {
    if (skipNextWeightInitialization.current) {
      skipNextWeightInitialization.current = false
      return
    }
    const initial = buildInitialWeightConfig(items, selectedIds, totalWeight)
    setQualityWeights(initial.qualityWeights)
    setRangeRules(initial.rangeRules)
    setManualOverrides({})
  }, [items, selectedIds, totalWeight])

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
  const targetChanges = useMemo(() => targets.map(key => {
    const existing = new Map(getTargetRewards(activeDraw, key).map(entry => [Number(entry[0]), entry]))
    const generated = new Map(previewRewards.map(item => [item.id, [item.id, item.quantity, item.weight]]))
    const summary = { added: 0, changed: 0, removed: 0 }
    generated.forEach((entry, id) => {
      if (!existing.has(id)) summary.added += 1
      else if (Number(existing.get(id)[1]) !== entry[1] || Number(existing.get(id)[2]) !== entry[2]) summary.changed += 1
    })
    if (!mergeMode) existing.forEach((_, id) => { if (!generated.has(id)) summary.removed += 1 })
    return { key, ...getTargetMeta(activeDraw, key), existingCount: existing.size, ...summary }
  }), [activeDraw, targets, previewRewards, mergeMode])

  const changeSummary = useMemo(() => targetChanges.reduce((total, target) => ({
    added: total.added + target.added,
    changed: total.changed + target.changed,
    removed: total.removed + target.removed
  }), { added: 0, changed: 0, removed: 0 }), [targetChanges])

  const toggleFiltered = () => {
    setSelectedIds(selectionMatchesFilter ? new Set() : new Set(filteredItems.map(item => item.id)))
  }

  const applyPreview = () => {
    if (!activeDraw || !targets.length || !previewRewards.length) {
      setMessage({ type: 'error', text: `请先选择目标奖池和至少一个有效${candidateSource === 'army' ? '兵种' : '道具'}` })
      return
    }
    const updated = applyRewardsToTargets(activeDraw, targets, previewRewards, mergeMode)
    setDraws(current => current.map(draw => draw.id === activeDraw.id ? updated : draw))
    setDirty(true)
    setMessage({ type: 'success', text: `已将 ${previewRewards.length} 项应用到 ${targets.length} 个目标，尚未写入 Excel` })
  }

  const updateActivePools = (field, pools, nextTargets = targets, nextActiveTarget = activeTarget) => {
    if (!activeDraw) return
    setDraws(current => current.map(draw => draw.id === activeDraw.id ? { ...draw, [field]: pools } : draw))
    setTargets(nextTargets)
    setActiveTarget(nextActiveTarget)
    if (nextActiveTarget !== activeTarget) {
      skipNextWeightInitialization.current = true
      setSelectedIds(new Set())
      setManualOverrides({})
      setTotalWeight(10000)
    }
    setDirty(true)
  }

  const activateTarget = key => {
    if (!activeDraw) return
    const rewards = getTargetRewards(activeDraw, key)
    const rewardIds = new Set(rewards.map(entry => Number(entry[0])))
    const armyMatches = armyCandidates.filter(item => rewardIds.has(item.id))
    const itemMatches = itemCandidates.filter(item => rewardIds.has(item.id))
    const nextSource = armyMatches.length > itemMatches.length
      ? 'army'
      : itemMatches.length > armyMatches.length ? 'item' : candidateSource
    const nextItems = nextSource === 'army' ? armyCandidates : itemCandidates
    const matchedIds = new Set(nextItems.filter(item => rewardIds.has(item.id)).map(item => item.id))
    const total = rewards.reduce((sum, entry) => sum + Number(entry[2] || 0), 0)

    skipNextWeightInitialization.current = true
    setActiveTarget(key)
    setTargets([key])
    setCandidateSource(nextSource)
    setSelectedIds(matchedIds)
    setTotalWeight(total > 0 ? total : 10000)
    setMode('equal')
    setManualOverrides(Object.fromEntries(rewards.map(entry => [Number(entry[0]), { quantity: Number(entry[1]), weight: Number(entry[2]) }])))
    setMessage(rewardIds.size > matchedIds.size
      ? { type: 'warning', text: `${getTargetMeta(activeDraw, key).label} 已载入；有 ${rewardIds.size - matchedIds.size} 项未在当前兵种/道具表中找到` }
      : { type: 'success', text: `${getTargetMeta(activeDraw, key).label} 已载入右侧编辑器，共 ${matchedIds.size} 项` })
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
    const recipe = { id: Date.now(), name, candidateSource, filters, mode, totalWeight, qualityWeights, qualityQuantities, defaultQuantity, rangeRules }
    const next = [...recipes.filter(item => item.name !== name), recipe]
    localStorage.setItem(RECIPE_KEY, JSON.stringify(next))
    setRecipes(next)
    setRecipeName('')
    setMessage({ type: 'success', text: `配方“${name}”已保存到本机` })
  }

  const loadRecipe = recipe => {
    const recipeSource = recipe.candidateSource || 'item'
    const recipeItems = recipeSource === 'army' ? armyCandidates : itemCandidates
    skipNextWeightInitialization.current = true
    setCandidateSource(recipeSource)
    setFilters(recipe.filters || EMPTY_FILTERS)
    setMode(recipe.mode || 'equal')
    setTotalWeight(recipe.totalWeight || 10000)
    setQualityWeights(recipe.qualityWeights || {})
    setQualityQuantities(recipe.qualityQuantities || {})
    setDefaultQuantity(recipe.defaultQuantity || 1)
    setRangeRules(recipe.rangeRules || [])
    const matched = filterItems(recipeItems, recipe.filters || EMPTY_FILTERS)
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
        <div><Database /><span>{candidateSource === 'army' ? '兵种源' : '道具源'}</span><strong>{items.length}</strong></div>
        <div><Layers3 /><span>候选结果</span><strong>{filteredItems.length}</strong></div>
        <div><Check /><span>已选择</span><strong>{selectedIds.size}</strong></div>
        <div><SlidersHorizontal /><span>预览总权重</span><strong className={previewWeight === Number(totalWeight) ? 'ok' : 'warn'}>{previewWeight}</strong></div>
      </div>

      <div className="ld-layout">
        <aside className="ld-sidebar">
          <section className="ld-card">
            <div className="ld-section-title"><Layers3 size={17} /> 当前奖池</div>
            <select value={activeDrawId ?? ''} onChange={event => { setActiveDrawId(Number(event.target.value)); setTargets(['normal']); setActiveTarget('normal') }}>
              {draws.map(draw => <option key={draw.id} value={draw.id}>{draw.id} · {draw.remarks}</option>)}
            </select>
            <small className="ld-target-help">方框用于批量应用；点击指针按钮载入并编辑某个奖池。</small>
            {activeDraw && <PoolTargets draw={activeDraw} targets={targets} setTargets={setTargets} activeTarget={activeTarget} onActivate={activateTarget} onPoolsChange={updateActivePools} />}
            <label className="ld-switch"><input type="checkbox" checked={mergeMode} onChange={event => setMergeMode(event.target.checked)} /><span>合并到已有奖池</span></label>
          </section>

          <section className="ld-card">
            <div className="ld-section-title"><Copy size={17} /> 建池配方</div>
            <div className="ld-inline"><input placeholder="配方名称" value={recipeName} onChange={event => setRecipeName(event.target.value)} /><button onClick={saveRecipe}><Save size={15} /></button></div>
            <div className="ld-recipes">
              {recipes.map(recipe => <div key={recipe.id}><button onClick={() => loadRecipe(recipe)}>{recipe.name}</button><button className="danger" title="删除" onClick={() => { const next = recipes.filter(item => item.id !== recipe.id); setRecipes(next); localStorage.setItem(RECIPE_KEY, JSON.stringify(next)) }}><Trash2 size={13} /></button></div>)}
              {!recipes.length && <small>保存数据源、筛选与权重规则，之后可按最新配置表重新执行。</small>}
            </div>
          </section>
        </aside>

        <main className="ld-main">
          <section className="ld-card ld-filter-card">
            <div className="ld-section-head"><div className="ld-section-title"><Filter size={17} /> 1. 筛选候选{candidateSource === 'army' ? '兵种' : '道具'}</div><button className="ld-text-button" onClick={() => setFilters(EMPTY_FILTERS)}>清空筛选</button></div>
            <div className="ld-mode-tabs">
              {[['army', 'ArmyTable 兵种'], ['item', 'ItemTable 道具']].map(([value, label]) => <button key={value} className={candidateSource === value ? 'active' : ''} onClick={() => { setCandidateSource(value); setFilters(EMPTY_FILTERS); setSelectedIds(new Set()) }}>{label}</button>)}
            </div>
            <div className="ld-filter-grid">
              <Field label="关键词"><div className="ld-search"><Search size={15} /><input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="ID / 策划备注 / Name" /></div></Field>
              <Field label="ID 范围" hint="多个范围用逗号分隔"><input value={filters.idRanges} onChange={event => setFilters({ ...filters, idRanges: event.target.value })} placeholder="20301-20610, 650001" /></Field>
              <Field label="排除 ID"><input value={filters.excludedRanges} onChange={event => setFilters({ ...filters, excludedRanges: event.target.value })} placeholder="20606-20610" /></Field>
            </div>
            <Field label={candidateSource === 'army' ? 'Roles' : 'Type'}><MultiChips values={filters.types} options={typeOptions} onChange={types => setFilters({ ...filters, types })} /></Field>
            <Field label={candidateSource === 'army' ? 'ArmyTag' : 'SubType'}><MultiChips values={filters.subTypes} options={subTypeOptions} onChange={subTypes => setFilters({ ...filters, subTypes })} /></Field>
            <Field label="品质"><MultiChips values={filters.qualities} options={qualityOptions} onChange={qualities => setFilters({ ...filters, qualities })} /></Field>
          </section>

          <section className="ld-card">
            <div className="ld-section-head"><div className="ld-section-title"><Check size={17} /> 2. 批量选择</div><button className="btn-secondary compact" onClick={toggleFiltered}>{selectionMatchesFilter ? '清空已选' : `仅选择当前 ${filteredItems.length} 项`}</button></div>
            <div className="ld-item-table-wrap">
              <table className="ld-item-table">
                <thead><tr><th></th><th>ID</th><th>策划备注</th><th>{candidateSource === 'army' ? 'Roles' : 'Type'}</th><th>{candidateSource === 'army' ? 'ArmyTag' : 'SubType'}</th><th>品质</th></tr></thead>
                <tbody>
                  {filteredItems.slice(0, 300).map(item => <tr key={item.id} className={selectedIds.has(item.id) ? 'selected' : ''} onClick={() => { const next = new Set(selectedIds); next.has(item.id) ? next.delete(item.id) : next.add(item.id); setSelectedIds(next) }}><td><input type="checkbox" readOnly checked={selectedIds.has(item.id)} /></td><td>{item.id}</td><td>{item.note}</td><td>{item.type}</td><td>{item.subType}</td><td><span className={`ld-quality q${item.quality}`}>Q{item.quality}</span></td></tr>)}
                </tbody>
              </table>
              {filteredItems.length > 300 && <div className="ld-table-note">为保证页面流畅，仅展示前 300 项；“仅选择当前结果”仍会选择全部 {filteredItems.length} 项。</div>}
            </div>
          </section>
        </main>

        <aside className="ld-rules">
          <section className="ld-card">
            <div className={`ld-active-target ld-target-${activeTargetMeta.type}`}>
              <span>正在配置</span><strong>{activeTargetMeta.label}</strong><small>{activeTargetMeta.detail}</small>
            </div>
            <div className="ld-section-title"><SlidersHorizontal size={17} /> 3. 分配权重</div>
            <div className="ld-mode-tabs">
              {[['equal', '等权'], ['quality', '按品质'], ['range', '按 ID 段']].map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}
            </div>
            <div className="ld-two-fields">
              <Field label="目标总权重"><input type="number" min="1" value={totalWeight} onChange={event => setTotalWeight(Number(event.target.value))} /></Field>
              <Field label="默认数量"><input type="number" min="1" value={defaultQuantity} onChange={event => setDefaultQuantity(Number(event.target.value))} /></Field>
            </div>

            {mode === 'quality' && <div className="ld-quality-rules">
              {!!selectedQualityOptions.length && <div className="ld-selected-scope"><span>实际参与分配</span><strong>{selectedQualityOptions.map(quality => `Q${quality}`).join('、')}</strong><small>{selectedItems.length} 项</small></div>}
              <div className="ld-rule-header"><span>品质</span><span>组权重</span><span>数量</span></div>
              {selectedQualityOptions.map(quality => <div key={quality}><span className={`ld-quality q${quality}`}>Q{quality}</span><input type="number" min="0" value={qualityWeights[quality] ?? 0} onChange={event => setQualityWeights({ ...qualityWeights, [quality]: Number(event.target.value) })} /><input type="number" min="1" placeholder={defaultQuantity} value={qualityQuantities[quality] ?? ''} onChange={event => setQualityQuantities({ ...qualityQuantities, [quality]: event.target.value === '' ? undefined : Number(event.target.value) })} /></div>)}
              {!selectedQualityOptions.length && <small>选择候选项后会自动生成品质权重。</small>}
              {!!selectedQualityOptions.length && <small>抽奖奖池采用低品质优先曲线：品质每提升一级，初始组权重约降至上一档的 40%。</small>}
            </div>}

            {mode === 'range' && <div className="ld-range-rules">
              {rangeRules.map((rule, index) => <div key={index} className="ld-range-row"><input type="number" value={rule.min} onChange={event => updateRangeRule(index, { min: Number(event.target.value) })} /><span>—</span><input type="number" value={rule.max} onChange={event => updateRangeRule(index, { max: Number(event.target.value) })} /><select value={rule.mode} onChange={event => updateRangeRule(index, { mode: event.target.value })}><option value="group">组总权重</option><option value="perItem">单项比例</option></select><input type="number" min="0" value={rule.weight} onChange={event => updateRangeRule(index, { weight: Number(event.target.value) })} /><button className="danger" onClick={() => setRangeRules(current => current.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 size={14} /></button></div>)}
              <button className="ld-add-button" onClick={addRangeRule}><Plus size={15} /> 添加 ID 段</button>
              <small>已按所选 ID 的连续区间自动初始化；更改选择会重新生成，所有权重最终归一化到目标总权重。</small>
            </div>}
          </section>

          <section className="ld-card ld-preview-card">
            <div className="ld-section-head"><div className="ld-section-title"><FlaskConical size={17} /> 4. 最终预览</div><span>{previewRewards.length} 项</span></div>
            <div className="ld-preview-targets">
              {targetChanges.map(target => <div key={target.key} className={`ld-preview-target ld-target-${target.type}`}>
                <div><strong>{target.label}</strong><small>{target.detail} · 当前 {target.existingCount} 项</small></div>
                <span>+{target.added} / ~{target.changed} / -{target.removed}</span>
              </div>)}
              {!targetChanges.length && <div className="ld-no-target">尚未勾选应用目标</div>}
            </div>
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
              {!previewRewards.length && <div className="ld-empty">选择{candidateSource === 'army' ? '兵种' : '道具'}后将在这里生成权重。</div>}
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
