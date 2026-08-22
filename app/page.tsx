"use client";

import { ChangeEvent, DragEvent, useCallback, useRef, useState } from "react";

type Mode = "auto" | "fixed-width" | "fixed-height";
type Bounds = { x1: number; x2: number; y1: number; y2: number };
type Item = {
  id: string;
  file: File;
  sourceUrl: string;
  outputUrl?: string;
  original?: string;
  output?: string;
  status: "waiting" | "processing" | "done" | "error";
};

function Icon({ name }: { name: "upload" | "download" | "spark" | "grid" | "trash" }) {
  const paths = {
    upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 15v4h14v-4"/></>,
    download: <><path d="M12 4v12m0 0l4.5-4.5M12 16l-4.5-4.5"/><path d="M5 20h14"/></>,
    spark: <><path d="M12 3l1.4 4.1L17.5 9l-4.1 1.4L12 14.5l-1.4-4.1L6.5 9l4.1-1.9L12 3z"/><path d="M18.5 15l.7 2.1 2.1.9-2.1.7-.7 2.3-.8-2.3-2.2-.7 2.2-.9.8-2.1z"/></>,
    grid: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16"/></>,
    trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function findBounds(image: ImageBitmap, tolerance: number, purity: number): Bounds {
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const w = canvas.width, h = canvas.height, data = ctx.getImageData(0, 0, w, h).data;
  const sample = Math.max(1, Math.min(4, Math.floor(Math.min(w, h) / 20)));
  let rr = 0, gg = 0, bb = 0, aa = 0, n = 0;
  for (let y = Math.max(0, Math.floor(h / 2 - sample)); y <= Math.min(h - 1, Math.floor(h / 2 + sample)); y++) {
    for (let x = Math.max(0, Math.floor(w / 2 - sample)); x <= Math.min(w - 1, Math.floor(w / 2 + sample)); x++) {
      const i = (y * w + x) * 4; rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; aa += data[i + 3]; n++;
    }
  }
  const ref = [rr / n, gg / n, bb / n, aa / n];
  const matches = (x: number, y: number) => { const i = (y * w + x) * 4; return Math.max(Math.abs(data[i] - ref[0]), Math.abs(data[i + 1] - ref[1]), Math.abs(data[i + 2] - ref[2]), Math.abs(data[i + 3] - ref[3])) <= tolerance; };
  const minX = Math.floor(w * .18), maxX = Math.ceil(w * .82), minY = Math.floor(h * .18), maxY = Math.ceil(h * .82);
  const colOk = (x: number) => { let hit = 0; for (let y = minY; y < maxY; y++) if (matches(x, y)) hit++; return hit / Math.max(1, maxY - minY) >= purity; };
  const rowOk = (y: number) => { let hit = 0; for (let x = minX; x < maxX; x++) if (matches(x, y)) hit++; return hit / Math.max(1, maxX - minX) >= purity; };
  let x1 = Math.floor(w / 2), x2 = x1 + 1, y1 = Math.floor(h / 2), y2 = y1 + 1;
  if (colOk(x1)) { while (x1 > 0 && colOk(x1 - 1)) x1--; while (x2 < w && colOk(x2)) x2++; }
  if (rowOk(y1)) { while (y1 > 0 && rowOk(y1 - 1)) y1--; while (y2 < h && rowOk(y2)) y2++; }
  return { x1, x2, y1, y2 };
}

function findAlignedStart(image: ImageBitmap, bounds: Bounds, axis: "x" | "y", keep: number) {
  const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data, w = image.width, h = image.height;
  const diff = (a: number, b: number) => Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]) + Math.abs(data[a + 3] - data[b + 3]);
  const from = axis === "x" ? bounds.x1 : bounds.y1, to = (axis === "x" ? bounds.x2 : bounds.y2) - keep;
  if (to <= from) return from;
  const sampleLength = axis === "x" ? h : w, step = Math.max(1, Math.floor(sampleLength / 256));
  let best = from, bestScore = Number.POSITIVE_INFINITY;
  for (let candidate = from; candidate <= to; candidate++) {
    let score = 0;
    for (let p = 0; p < sampleLength; p += step) {
      if (axis === "x") {
        if (bounds.x1 > 0) score += diff((p * w + bounds.x1 - 1) * 4, (p * w + candidate) * 4);
        if (bounds.x2 < w) score += diff((p * w + bounds.x2) * 4, (p * w + candidate + keep - 1) * 4);
      } else {
        if (bounds.y1 > 0) score += diff(((bounds.y1 - 1) * w + p) * 4, (candidate * w + p) * 4);
        if (bounds.y2 < h) score += diff((bounds.y2 * w + p) * 4, ((candidate + keep - 1) * w + p) * 4);
      }
    }
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

async function trim(file: File, mode: Mode, tolerance: number, purity: number, reserve: number, alignPixels: boolean) {
  const image = await createImageBitmap(file), bounds = findBounds(image, tolerance, purity / 100);
  const originalWidth = image.width, originalHeight = image.height;
  const fullX = mode === "fixed-width", fullY = mode === "fixed-height";
  const keepX = Math.max(1, Math.min(reserve, bounds.x2 - bounds.x1)), keepY = Math.max(1, Math.min(reserve, bounds.y2 - bounds.y1));
  const centerX = alignPixels ? findAlignedStart(image, bounds, "x", keepX) : Math.floor((bounds.x1 + bounds.x2 - keepX) / 2);
  const centerY = alignPixels ? findAlignedStart(image, bounds, "y", keepY) : Math.floor((bounds.y1 + bounds.y2 - keepY) / 2);
  const xs = fullX ? [[0, image.width]] : [[0, bounds.x1], [centerX, keepX], [bounds.x2, image.width - bounds.x2]];
  const ys = fullY ? [[0, image.height]] : [[0, bounds.y1], [centerY, keepY], [bounds.y2, image.height - bounds.y2]];
  const canvas = document.createElement("canvas");
  canvas.width = xs.reduce((sum, x) => sum + x[1], 0); canvas.height = ys.reduce((sum, y) => sum + y[1], 0);
  const ctx = canvas.getContext("2d")!; let dy = 0;
  for (const [sy, sh] of ys) { let dx = 0; for (const [sx, sw] of xs) { if (sw > 0 && sh > 0) ctx.drawImage(image, sx, sy, sw, sh, dx, dy, sw, sh); dx += sw; } dy += sh; }
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("导出失败")), "image/png"));
  return { outputUrl: URL.createObjectURL(blob), original: `${originalWidth} × ${originalHeight}`, output: `${canvas.width} × ${canvas.height}` };
}

const modeCopy: Record<Mode, { title: string; note: string }> = {
  auto: { title: "自动宽高", note: "横纵纯色区都压缩" },
  "fixed-width": { title: "固定宽度", note: "保持原宽，只压缩高度" },
  "fixed-height": { title: "固定高度", note: "保持原高，只压缩宽度" },
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]), [mode, setMode] = useState<Mode>("auto"), [tolerance, setTolerance] = useState(10), [purity, setPurity] = useState(98), [reserve, setReserve] = useState(10), [alignPixels, setAlignPixels] = useState(true), [dragging, setDragging] = useState(false), [running, setRunning] = useState(false);
  const itemsRef = useRef<Item[]>([]); itemsRef.current = items;
  const reprocessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processItems = useCallback(async (targets: Item[], nextMode = mode, nextTolerance = tolerance, nextPurity = purity, nextReserve = reserve, nextAlign = alignPixels) => {
    if (!targets.length) return; setRunning(true);
    for (const target of targets) {
      setItems(current => current.map(x => x.id === target.id ? { ...x, status: "processing" } : x));
      try {
        const result = await trim(target.file, nextMode, nextTolerance, nextPurity, nextReserve, nextAlign);
        setItems(current => current.map(x => { if (x.id !== target.id) return x; if (x.outputUrl) URL.revokeObjectURL(x.outputUrl); return { ...x, ...result, status: "done" }; }));
      } catch { setItems(current => current.map(x => x.id === target.id ? { ...x, status: "error" } : x)); }
    }
    setRunning(false);
  }, [mode, tolerance, purity, reserve, alignPixels]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const added = Array.from(files).filter(file => file.type.startsWith("image/")).map(file => ({ id: crypto.randomUUID(), file, sourceUrl: URL.createObjectURL(file), status: "waiting" as const }));
    if (!added.length) return; setItems(current => [...current, ...added]); void processItems(added);
  }, [processItems]);
  const remove = (id: string) => setItems(current => { const target = current.find(x => x.id === id); if (target) { URL.revokeObjectURL(target.sourceUrl); if (target.outputUrl) URL.revokeObjectURL(target.outputUrl); } return current.filter(x => x.id !== id); });
  const clear = () => { items.forEach(x => { URL.revokeObjectURL(x.sourceUrl); if (x.outputUrl) URL.revokeObjectURL(x.outputUrl); }); setItems([]); };
  const changeMode = (next: Mode) => { setMode(next); void processItems(itemsRef.current, next, tolerance, purity, reserve, alignPixels); };
  const changeAlignment = () => { const next = !alignPixels; setAlignPixels(next); void processItems(itemsRef.current, mode, tolerance, purity, reserve, next); };
  const scheduleReprocess = (nextTolerance: number, nextPurity: number, nextReserve: number) => {
    if (reprocessTimer.current) clearTimeout(reprocessTimer.current);
    reprocessTimer.current = setTimeout(() => void processItems(itemsRef.current, mode, nextTolerance, nextPurity, nextReserve, alignPixels), 250);
  };
  const changeTolerance = (next: number) => { setTolerance(next); scheduleReprocess(next, purity, reserve); };
  const changePurity = (next: number) => { setPurity(next); scheduleReprocess(tolerance, next, reserve); };
  const changeReserve = (next: number) => { setReserve(next); scheduleReprocess(tolerance, purity, next); };
  const reprocess = () => void processItems(itemsRef.current);
  const downloadOne = (item: Item) => { if (!item.outputUrl) return; const a = document.createElement("a"); a.href = item.outputUrl; a.download = `${item.file.name.replace(/\.[^.]+$/, "")}-9slice.png`; a.click(); };
  const downloadAll = async () => { for (const item of items.filter(x => x.status === "done")) { downloadOne(item); await new Promise(resolve => setTimeout(resolve, 180)); } };
  const drop = (e: DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };
  const pick = (e: ChangeEvent<HTMLInputElement>) => { addFiles(e.target.files ?? []); e.target.value = ""; };

  return <main>
    <nav><a className="brand" href="#"><span><Icon name="grid"/></span>角纹</a><div className="nav-note">本地处理 · 支持批量</div></nav>
    <section className="hero compact"><div className="eyebrow"><Icon name="spark"/> 九宫纹理批量提取</div><h1>留下四角，<br/><em>减掉多余。</em></h1><p>固定宽、固定高或自动压缩。一次拖入多张图片，统一参数，批量得到最小九宫纹理。</p></section>
    <section className="batch-shell">
      <div className="mode-bar"><div><span className="step">处理方式</span><strong>选择尺寸约束与接缝优化</strong></div><div className="mode-options">{(Object.keys(modeCopy) as Mode[]).map(value => <button key={value} className={mode === value ? "active" : ""} onClick={() => changeMode(value)}><b>{modeCopy[value].title}</b><small>{modeCopy[value].note}</small></button>)}<button className={alignPixels ? "active alignment" : "alignment"} onClick={changeAlignment}><b>像素对齐 {alignPixels ? "开" : "关"}</b><small>搜索最低接缝误差</small></button></div></div>
      <div className="batch-controls"><label className="control"><span>颜色容差 <output>{tolerance}</output></span><input type="range" min="0" max="40" value={tolerance} onChange={e => changeTolerance(+e.target.value)}/></label><label className="control"><span>纯色比例 <output>{purity}%</output></span><input type="range" min="80" max="100" value={purity} onChange={e => changePurity(+e.target.value)}/></label><label className="control"><span>九宫预留 <output>{reserve}px</output></span><input type="range" min="1" max="30" value={reserve} onChange={e => changeReserve(+e.target.value)}/></label><button className="secondary" disabled={!items.length || running} onClick={reprocess}><Icon name="spark"/>重新处理全部</button></div>
      <label className={`batch-drop ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><span className="upload-icon"><Icon name="upload"/></span><span><strong>拖入多张图片</strong><small>或点击批量选择 · PNG / JPG / WEBP</small></span><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={pick}/></label>
    </section>
    {items.length > 0 && <section className="queue"><header><div><span className="step">处理队列</span><h2>{items.length} 张图片</h2></div><div className="queue-actions"><button onClick={clear}>清空</button><button className="download-all" disabled={running || !items.some(x => x.status === "done")} onClick={downloadAll}><Icon name="download"/>批量导出</button></div></header><div className="result-grid">{items.map(item => <article className="result-card" key={item.id}><button className="remove" aria-label={`移除 ${item.file.name}`} onClick={() => remove(item.id)}><Icon name="trash"/></button><div className="compare"><figure><img src={item.sourceUrl} alt="原图"/><figcaption>原图</figcaption></figure><span>→</span><figure className="checker">{item.outputUrl ? <img src={item.outputUrl} alt="处理结果"/> : <i>{item.status === "error" ? "处理失败" : "分析中…"}</i>}<figcaption>九宫纹理</figcaption></figure></div><div className="card-meta"><div><strong title={item.file.name}>{item.file.name}</strong><small>{item.original && item.output ? `${item.original} → ${item.output}` : "正在读取像素"}</small></div><button disabled={!item.outputUrl} onClick={() => downloadOne(item)}><Icon name="download"/></button></div></article>)}</div></section>}
    <section className="how"><div><span className="step">模式说明</span><h2>尺寸约束，加上像素级对齐</h2></div><ol><li><b>01</b><span><strong>固定宽度</strong>完整保留每一列，只裁掉纵向纯色带。</span></li><li><b>02</b><span><strong>固定高度</strong>完整保留每一行，只裁掉横向纯色带。</span></li><li><b>03</b><span><strong>像素对齐</strong>比较 RGBA 接缝误差，选择与四边最吻合的预留切片。</span></li></ol></section>
    <footer><span>角纹 · Nine-slice Trimmer</span><span>无需上传 · 无损 PNG · 批量处理</span></footer>
  </main>;
}
