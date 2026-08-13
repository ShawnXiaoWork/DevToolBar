import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Clock3,
  ExternalLink,
  Flame,
  Gamepad2,
  Info,
  Lightbulb,
  LoaderCircle,
  ListFilter,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

type ChartKey = 'topFree' | 'grossing' | 'newGames' | 'topPaid';
type ViewKey = 'overview' | 'charts' | 'new' | 'opportunities';

type Game = {
  appId: string;
  title: string;
  developer: string;
  icon: string;
  url: string;
  score?: number;
  scoreText?: string;
  priceText?: string;
  rank: number;
  genre?: string;
  released?: string;
  minInstalls?: number;
  installs?: string;
  offersIAP?: boolean;
  summary?: string;
};

type ApiData = {
  country: string;
  category: string;
  fetchedAt: string;
  topFree: Game[];
  grossing: Game[];
  topPaid: Game[];
  newGames: Game[];
};

type RankedGame = Game & { delta: number | null; isNewEntry: boolean };
type Snapshot = Record<ChartKey, Record<string, number>>;

const COUNTRIES = [
  { value: 'us', label: '美国' },
  { value: 'jp', label: '日本' },
  { value: 'kr', label: '韩国' },
  { value: 'tw', label: '中国台湾' },
  { value: 'de', label: '德国' },
  { value: 'gb', label: '英国' },
];

const CATEGORIES = [
  { value: 'GAME', label: '全部游戏' },
  { value: 'GAME_ACTION', label: '动作' },
  { value: 'GAME_ROLE_PLAYING', label: '角色扮演' },
  { value: 'GAME_STRATEGY', label: '策略' },
  { value: 'GAME_CASUAL', label: '休闲' },
  { value: 'GAME_PUZZLE', label: '益智' },
  { value: 'GAME_SIMULATION', label: '模拟' },
];

const CHARTS: { key: ChartKey; label: string; short: string }[] = [
  { key: 'topFree', label: '免费榜', short: '免费' },
  { key: 'grossing', label: '畅销榜', short: '畅销' },
  { key: 'newGames', label: '新游榜', short: '新游' },
  { key: 'topPaid', label: '付费榜', short: '付费' },
];

function compactNumber(value?: number) {
  if (!value) return '—';
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function buildSnapshot(data: ApiData): Snapshot {
  return Object.fromEntries(CHARTS.map(({ key }) => [key, Object.fromEntries(data[key].map((game) => [game.appId, game.rank]))])) as Snapshot;
}

function applyTrend(games: Game[], previous?: Record<string, number>): RankedGame[] {
  return games.map((game) => ({
    ...game,
    delta: previous?.[game.appId] ? previous[game.appId] - game.rank : null,
    isNewEntry: Boolean(previous && !previous[game.appId]),
  }));
}

function rankTone(rank: number) {
  if (rank === 1) return 'rank first';
  if (rank <= 3) return 'rank top';
  return 'rank';
}

function GameIcon({ game, size = 'md' }: { game: Game; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`game-icon ${size}`}>
      <img src={game.icon} alt="" loading="lazy" />
    </div>
  );
}

function Trend({ game }: { game: RankedGame }) {
  if (game.isNewEntry) return <span className="trend new"><Sparkles size={12} /> 新进</span>;
  if (game.delta === null) return <span className="trend base">待对比</span>;
  if (game.delta > 0) return <span className="trend up"><ArrowUpRight size={13} /> {game.delta}</span>;
  if (game.delta < 0) return <span className="trend down"><ArrowDownRight size={13} /> {Math.abs(game.delta)}</span>;
  return <span className="trend steady">—</span>;
}

type GameCollection = { title: string; subtitle: string; games: RankedGame[] };

function GameDrawer({ game, charts, watched, onClose, onToggleWatch }: {
  game: RankedGame;
  charts: Record<ChartKey, RankedGame[]>;
  watched: boolean;
  onClose: () => void;
  onToggleWatch: () => void;
}) {
  const appearances = CHARTS.flatMap((chart) => {
    const match = charts[chart.key].find((item) => item.appId === game.appId);
    return match ? [{ ...chart, game: match }] : [];
  });
  const grossing = appearances.find((item) => item.key === 'grossing');
  const free = appearances.find((item) => item.key === 'topFree');
  const isNew = appearances.some((item) => item.key === 'newGames');
  const reasons = [
    isNew && '近 180 天发行且已进入免费榜头部，冷启动表现值得关注。',
    grossing && free && '同时进入免费榜和畅销榜，具备用户获取与商业化共振信号。',
    grossing && !free && '畅销排名强于免费排名，可能具备较高的用户付费效率。',
    (game.delta ?? 0) > 0 && `相比上次快照上升 ${game.delta} 位，短期动量明显。`,
  ].filter(Boolean) as string[];

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside className="game-drawer" role="dialog" aria-modal="true" aria-label={`${game.title} 分析`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-topline"><span>GAME SIGNAL BRIEF</span><button onClick={onClose} aria-label="关闭"><X size={19} /></button></div>
        <div className="drawer-hero">
          <GameIcon game={game} size="lg" />
          <div><span className="hot-label">{isNew ? '新游信号' : grossing ? '商业化信号' : '榜单样本'}</span><h2>{game.title}</h2><p>{game.developer}</p></div>
        </div>
        <div className="drawer-actions">
          <a className="primary-action" href={game.url} target="_blank" rel="noreferrer">前往 Google Play <ExternalLink size={15} /></a>
          <button className={watched ? 'watch active' : 'watch'} onClick={onToggleWatch}>{watched ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{watched ? '已关注' : '加入关注'}</button>
        </div>
        <section className="drawer-section">
          <span className="drawer-label">跨榜表现</span>
          <div className="rank-matrix">
            {CHARTS.map((chart) => {
              const appearance = appearances.find((item) => item.key === chart.key);
              return <div className={appearance ? 'present' : ''} key={chart.key}><span>{chart.label}</span><strong>{appearance ? `#${appearance.game.rank}` : '—'}</strong>{appearance && <Trend game={appearance.game} />}</div>;
            })}
          </div>
        </section>
        <section className="drawer-section">
          <span className="drawer-label">为什么值得看</span>
          <div className="reason-list">
            {(reasons.length ? reasons : ['当前处于头部榜单，是同品类市场定位与商店素材的有效参考样本。']).map((reason, index) => <p key={reason}><span>{index + 1}</span>{reason}</p>)}
          </div>
        </section>
        <section className="drawer-section">
          <span className="drawer-label">公开信息</span>
          <div className="fact-grid">
            <div><span>评分</span><strong>★ {game.score?.toFixed(1) ?? '—'}</strong></div>
            <div><span>下载区间</span><strong>{game.installs ?? '暂未公开'}</strong></div>
            <div><span>发行时间</span><strong>{game.released ?? '暂未公开'}</strong></div>
            <div><span>价格</span><strong>{game.priceText ?? (game.offersIAP ? '免费 · 含内购' : '免费')}</strong></div>
          </div>
          {game.summary && <p className="game-summary">{game.summary}</p>}
        </section>
        <div className="drawer-tip"><Lightbulb size={15} /><span><strong>下一步建议</strong>打开商店页重点拆解：图标辨识度、前 3 张截图的信息顺序、短描述关键词和评论中的重复诉求。</span></div>
      </aside>
    </div>
  );
}

function CollectionModal({ collection, watchedIds, onClose, onSelect }: {
  collection: GameCollection;
  watchedIds: string[];
  onClose: () => void;
  onSelect: (game: RankedGame) => void;
}) {
  return (
    <div className="overlay centered" role="presentation" onMouseDown={onClose}>
      <section className="collection-modal" role="dialog" aria-modal="true" aria-label={collection.title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><span className="section-kicker"><ListFilter size={14} /> 对应样本</span><h2>{collection.title}</h2><p>{collection.subtitle}</p></div><button onClick={onClose} aria-label="关闭"><X size={19} /></button></div>
        <div className="collection-list">
          {collection.games.map((game) => <button key={game.appId} onClick={() => onSelect(game)}><span className={rankTone(game.rank)}>{game.rank}</span><GameIcon game={game} /><span className="game-name"><strong>{game.title}</strong><small>{game.developer} · {game.genre ?? '游戏'}</small></span><Trend game={game} />{watchedIds.includes(game.appId) && <BookmarkCheck className="saved-mark" size={14} />}</button>)}
          {!collection.games.length && <div className="empty">当前筛选下暂无对应游戏。建立下一次榜单快照后，这里会持续更新。</div>}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [country, setCountry] = useState('us');
  const [category, setCategory] = useState('GAME');
  const [activeChart, setActiveChart] = useState<ChartKey>('grossing');
  const [data, setData] = useState<ApiData | null>(null);
  const [previous, setPrevious] = useState<Snapshot>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [selectedGame, setSelectedGame] = useState<RankedGame | null>(null);
  const [collection, setCollection] = useState<GameCollection | null>(null);
  const [watchedIds, setWatchedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('playpulse:watchlist') ?? '[]'); } catch { return []; }
  });

  const loadData = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const snapshotKey = `playpulse:${country}:${category}`;
      const stored = localStorage.getItem(snapshotKey);
      const response = await fetch(`/api/rankings?country=${country}&category=${category}${force ? '&refresh=1' : ''}`);
      if (!response.ok) throw new Error('实时数据暂时不可用');
      const next: ApiData = await response.json();
      setPrevious(stored ? JSON.parse(stored) : undefined);
      setData(next);
      localStorage.setItem(snapshotKey, JSON.stringify(buildSnapshot(next)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '实时数据暂时不可用');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, country]);

  useEffect(() => { void loadData(); }, [loadData]);

  const charts = useMemo(() => {
    if (!data) return null;
    return Object.fromEntries(CHARTS.map(({ key }) => [key, applyTrend(data[key], previous?.[key])])) as Record<ChartKey, RankedGame[]>;
  }, [data, previous]);

  const visibleGames = useMemo(() => {
    if (!charts) return [];
    const needle = query.trim().toLowerCase();
    return charts[activeChart].filter((game) => !needle || `${game.title} ${game.developer} ${game.genre}`.toLowerCase().includes(needle));
  }, [activeChart, charts, query]);

  const pulse = useMemo(() => {
    if (!charts) return null;
    const all = [...charts.grossing, ...charts.topFree];
    const risers = all.filter((game) => (game.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const breakout = risers[0] ?? charts.grossing[0];
    const monetizer = charts.grossing[0];
    const newcomer = charts.newGames[0];
    return { breakout, monetizer, newcomer, riserCount: risers.length };
  }, [charts]);

  const genreSignals = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    [...data.grossing.slice(0, 20), ...data.newGames.slice(0, 12)].forEach((game) => {
      if (game.genre) counts.set(game.genre, (counts.get(game.genre) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [data]);

  const countryLabel = COUNTRIES.find((item) => item.value === country)?.label;

  const switchView = (view: ViewKey) => {
    setActiveView(view);
    if (view === 'charts') setActiveChart('grossing');
    if (view === 'new') setActiveChart('newGames');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewCopy = {
    charts: { kicker: 'RANKING WORKSPACE', title: '榜单雷达', description: `比较${countryLabel}市场各类榜单，点击任意游戏查看跨榜表现和上榜依据。` },
    new: { kicker: 'NEW RELEASE TRACKER', title: '新品追踪', description: `聚焦近 180 天发行并进入免费榜前 15 的游戏，快速研究新品冷启动。` },
    opportunities: { kicker: 'OPPORTUNITY LAB', title: '机会洞察', description: '把榜单结果转成可执行的产品研究方向，判断今天最值得拆解的题材与样本。' },
  } as const;

  const openCollection = (title: string, subtitle: string, games: RankedGame[]) => setCollection({ title, subtitle, games });
  const openGame = (game: RankedGame) => { setCollection(null); setSelectedGame(game); };
  const toggleWatch = (appId: string) => {
    setWatchedIds((current) => {
      const next = current.includes(appId) ? current.filter((id) => id !== appId) : [...current, appId];
      localStorage.setItem('playpulse:watchlist', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!selectedGame && !collection) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelectedGame(null); setCollection(null); } };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', close);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', close); };
  }, [selectedGame, collection]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PlayPulse 首页">
          <span className="brand-mark"><BarChart3 size={20} /></span>
          <span>PLAY<span>PULSE</span></span>
        </a>
        <nav className="main-nav" aria-label="主导航">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => switchView('overview')}>市场总览</button>
          <button className={activeView === 'charts' ? 'active' : ''} onClick={() => switchView('charts')}>榜单雷达</button>
          <button className={activeView === 'new' ? 'active' : ''} onClick={() => switchView('new')}>新品追踪</button>
          <button className={activeView === 'opportunities' ? 'active' : ''} onClick={() => switchView('opportunities')}>机会洞察</button>
        </nav>
        <div className="header-actions">
          <button className="icon-btn watchlist-btn" aria-label="查看关注列表" onClick={() => charts && openCollection('我的关注', '保存在当前设备上的重点追踪游戏', [...charts.topFree, ...charts.grossing, ...charts.topPaid].filter((game, index, list) => watchedIds.includes(game.appId) && list.findIndex((item) => item.appId === game.appId) === index))}><Bell size={18} />{watchedIds.length > 0 && <span>{watchedIds.length}</span>}</button>
          <div className="avatar">DEV</div>
        </div>
      </header>

      <main id="top">
        <section className="control-bar">
          <div>
            <p className="eyebrow"><span className="live-dot" /> LIVE MARKET INTELLIGENCE</p>
            <h1>Google Play 游戏市场雷达</h1>
          </div>
          <div className="controls">
            <label className="select-wrap"><span>市场</span><select value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} /></label>
            <label className="select-wrap"><span>品类</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} /></label>
            <button className="refresh-btn" onClick={() => void loadData(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> 刷新数据</button>
          </div>
        </section>

        <nav className="mobile-workspace-nav" aria-label="工作区导航">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => switchView('overview')}>总览</button>
          <button className={activeView === 'charts' ? 'active' : ''} onClick={() => switchView('charts')}>榜单</button>
          <button className={activeView === 'new' ? 'active' : ''} onClick={() => switchView('new')}>新游</button>
          <button className={activeView === 'opportunities' ? 'active' : ''} onClick={() => switchView('opportunities')}>机会</button>
        </nav>

        {error && <div className="error-banner"><Info size={17} /> {error}。请稍后刷新，已建立的历史快照不会丢失。</div>}

        {loading ? (
          <div className="loading-state"><LoaderCircle className="spin" size={28} /><strong>正在扫描 Google Play 榜单</strong><span>同步免费、畅销、付费及新游信号…</span></div>
        ) : data && charts && pulse ? (
          <>
            {activeView === 'overview' && <section className="hero-grid" id="overview">
              <article className="pulse-card">
                <div className="pulse-head">
                  <span className="section-kicker"><Zap size={14} /> 今日市场脉搏</span>
                  <span className="updated"><Clock3 size={13} /> {new Date(data.fetchedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</span>
                </div>
                <div className="pulse-body">
                  <GameIcon game={pulse.breakout} size="lg" />
                  <div className="pulse-copy">
                    <span className="hot-label"><Flame size={13} /> 高热信号</span>
                    <h2>{pulse.breakout.title}</h2>
                    <p>{pulse.breakout.delta && pulse.breakout.delta > 0 ? `本轮对比上升 ${pulse.breakout.delta} 位，正在快速获得市场注意。` : `当前位居${activeChart === 'grossing' ? '畅销' : '核心'}榜前列，是今天最值得拆解的产品信号。`}</p>
                    <div className="game-facts"><span>#{pulse.breakout.rank} 当前排名</span><span>{pulse.breakout.genre ?? '游戏'}</span><span>★ {pulse.breakout.score?.toFixed(1) ?? '—'}</span></div>
                  </div>
                  <div className="pulse-actions"><button onClick={() => openGame(pulse.breakout)}>查看分析</button><a className="open-game" href={pulse.breakout.url} target="_blank" rel="noreferrer">Google Play <ExternalLink size={14} /></a></div>
                </div>
              </article>

              <div className="metric-stack">
                <button className="metric-card lime" onClick={() => openCollection('本轮上涨游戏', '相比本机上一次同市场、同品类快照排名上升的游戏', [...charts.topFree, ...charts.grossing].filter((game) => (game.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)))}><div className="metric-icon"><TrendingUp size={18} /></div><div><span>上涨游戏</span><strong>{pulse.riserCount || '待建立基线'}</strong><small>{pulse.riserCount ? '点击查看完整清单 →' : '下次刷新开始追踪'}</small></div></button>
                <button className="metric-card" onClick={() => openCollection('近 180 天新游', `在${countryLabel}市场进入免费榜前 15 的近期发行游戏`, charts.newGames)}><div className="metric-icon"><Rocket size={18} /></div><div><span>近 180 天新游</span><strong>{data.newGames.length}</strong><small>点击查看这 {data.newGames.length} 款 →</small></div></button>
                <button className="metric-card orange" onClick={() => openCollection('畅销头部样本', `当前${countryLabel}游戏畅销榜头部样本，可逐款查看商业化信号`, charts.grossing)}><div className="metric-icon"><WalletCards size={18} /></div><div><span>畅销头部</span><strong>{data.grossing.length}</strong><small>点击研究商业化样本 →</small></div></button>
              </div>
            </section>}

            {activeView === 'overview' && <section className="signal-strip" aria-label="重点市场信号">
              <button onClick={() => openGame(pulse.breakout)}><span className="signal-icon hot"><Flame size={19} /></span><div><small>爆发观察</small><strong>{pulse.breakout.title}</strong><p>{pulse.breakout.delta && pulse.breakout.delta > 0 ? `快速上升 ${pulse.breakout.delta} 位` : `位于${countryLabel}市场核心榜单前列`} · 查看依据 →</p></div></button>
              <button onClick={() => openGame(pulse.monetizer)}><span className="signal-icon money"><Trophy size={19} /></span><div><small>变现标杆</small><strong>{pulse.monetizer.title}</strong><p>畅销榜 #1 · {pulse.monetizer.offersIAP === false ? '买断制' : '内购驱动'} · 查看分析 →</p></div></button>
              <button id="new-games" disabled={!pulse.newcomer} onClick={() => pulse.newcomer && openGame(pulse.newcomer)}><span className="signal-icon fresh"><Sparkles size={19} /></span><div><small>新游观察</small><strong>{pulse.newcomer?.title ?? '暂无样本'}</strong><p>{pulse.newcomer?.released ? `${pulse.newcomer.released} 发布 · 查看详情 →` : '持续扫描近期发行产品'}</p></div></button>
            </section>}

            {activeView !== 'overview' && <section className={`workspace-intro ${activeView}`}>
              <div><span>{viewCopy[activeView].kicker}</span><h2>{viewCopy[activeView].title}</h2><p>{viewCopy[activeView].description}</p></div>
              <div className="workspace-stat">
                {activeView === 'charts' && <><strong>{data.topFree.length + data.grossing.length + data.topPaid.length}</strong><span>当前榜单样本</span></>}
                {activeView === 'new' && <><strong>{data.newGames.length}</strong><span>近期头部新游</span></>}
                {activeView === 'opportunities' && <><strong>{genreSignals.length}</strong><span>重点品类信号</span></>}
              </div>
            </section>}

            <section className={`content-grid view-${activeView}`} id="charts">
              {activeView !== 'opportunities' && <article className="chart-panel">
                <div className="panel-head">
                  <div><span className="section-kicker"><Target size={14} /> {activeView === 'new' ? '新品样本' : '榜单雷达'}</span><h2>{activeView === 'new' ? '近期发行并进入头部的游戏' : '看见名次，更看见动量'}</h2></div>
                  <label className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索游戏或厂商" /></label>
                </div>
                {activeView !== 'new' && <div className="chart-tabs" role="tablist">{CHARTS.map((chart) => <button role="tab" aria-selected={activeChart === chart.key} className={activeChart === chart.key ? 'active' : ''} key={chart.key} onClick={() => setActiveChart(chart.key)}>{chart.label}<span>{data[chart.key].length}</span></button>)}</div>}
                <div className="table-head"><span>排名 / 游戏</span><span>品类</span><span>口碑</span><span>规模 / 价格</span><span>趋势</span></div>
                <div className="game-list">
                  {visibleGames.slice(0, 15).map((game) => (
                    <button className="game-row" key={game.appId} onClick={() => openGame(game)}>
                      <div className="game-primary"><span className={rankTone(game.rank)}>{game.rank}</span><GameIcon game={game} /><span className="game-name"><strong>{game.title}</strong><small>{game.developer}</small></span></div>
                      <span className="genre">{game.genre ?? '—'}</span>
                      <span className="score">★ {game.score?.toFixed(1) ?? '—'}</span>
                      <span className="scale">{activeChart === 'topPaid' ? game.priceText ?? '付费' : game.installs ? `${compactNumber(game.minInstalls)}+` : game.priceText ?? '—'}</span>
                      <Trend game={game} />
                    </button>
                  ))}
                  {!visibleGames.length && <div className="empty">没有匹配的游戏</div>}
                </div>
                <div className="baseline-note"><Info size={14} /> 趋势来自同一市场、同一品类的历史快照对比。首次访问显示“待对比”，刷新后开始记录升降。</div>
              </article>}

              {(activeView === 'overview' || activeView === 'opportunities') && <aside className="insights-panel" id="opportunities">
                <div className="panel-head compact"><div><span className="section-kicker"><Lightbulb size={14} /> 开发者机会雷达</span><h2>今天值得研究什么？</h2></div></div>
                <button className="insight-card featured" onClick={() => openGame(pulse.newcomer ?? pulse.breakout)}>
                  <span className="insight-tag">建议优先拆解</span>
                  <h3>{pulse.newcomer?.title ?? pulse.breakout.title}</h3>
                  <p>近期发行且快速进入头部视野，建议重点观察首屏卖点、题材包装与前三分钟玩法呈现。</p>
                  <div className="confidence"><span>参考价值</span><strong>高</strong><div><i /></div></div>
                  <span className="insight-cta">查看游戏依据与商店页 <ArrowUpRight size={13} /></span>
                </button>
                <h3 className="mini-title">品类热度信号</h3>
                <div className="genre-list">
                  {genreSignals.map(([genre, count], index) => <div key={genre}><span className={`genre-rank g${index + 1}`}>{index + 1}</span><strong>{genre}</strong><span>{count} 款头部样本</span><i style={{ width: `${Math.min(100, count * 14)}%` }} /></div>)}
                </div>
                <div className="watch-card"><Gamepad2 size={18} /><div><strong>如何使用这些信号</strong><p>先看新游是否冲入免费榜，再看其是否同步进入畅销榜。两榜共振通常比单一下载排名更值得研究。</p></div></div>
                <div className="data-note"><span><span className="live-dot" /> 实时公开数据</span><p>畅销榜仅代表 Google Play 排名信号，不等同于精确收入；下载量为商店公开区间。</p></div>
              </aside>}
            </section>
          </>
        ) : null}
      </main>
      {collection && <CollectionModal collection={collection} watchedIds={watchedIds} onClose={() => setCollection(null)} onSelect={openGame} />}
      {selectedGame && charts && <GameDrawer game={selectedGame} charts={charts} watched={watchedIds.includes(selectedGame.appId)} onClose={() => setSelectedGame(null)} onToggleWatch={() => toggleWatch(selectedGame.appId)} />}
    </div>
  );
}
