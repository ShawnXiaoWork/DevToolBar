import { createMotionInterpreter } from './motion-gestures.js';

const NO_INPUT = Object.freeze({ tracked: false, calibrated: false, mode: 'stop', forward: 0,
  steer: 0, lookX: 0, lookY: 0, zoom: 0, cursor: null, pinch: false, events: [] });

export function createMotionControl(host, { onAction, isMenuOpen }) {
  const interpreter = createMotionInterpreter();
  const overlay = document.createElement('div');
  overlay.className = 'motion-start ui-layer';
  overlay.innerHTML = `<div class="motion-start-card" role="dialog" aria-label="启动体感操作">
    <div class="motion-star">✦</div><h2>开启体感探索</h2>
    <p>请站在摄像头前，让头部到双脚进入画面。开始后保持站立片刻完成校准。</p>
    <button type="button" class="motion-start-button">开启摄像头</button>
    <small class="motion-start-status">视频仅在本机识别，不会上传。</small>
  </div>`;
  const dock = document.createElement('div');
  dock.className = 'motion-dock ui-layer';
  dock.hidden = true;
  dock.innerHTML = `<video autoplay muted playsinline aria-label="摄像头校准画面"></video>
    <div class="motion-dock-info"><strong id="motionMode">校准中</strong><span id="motionHint">站稳并露出全身</span>
    <div><button type="button" data-motion="calibrate">重新校准</button><button type="button" data-motion="stop">关闭摄像头</button></div></div>`;
  const cursor = document.createElement('div');
  cursor.className = 'motion-cursor';
  cursor.hidden = true;
  cursor.innerHTML = '<span></span>';
  host.append(overlay, dock, cursor);

  const startButton = overlay.querySelector('.motion-start-button');
  const startStatus = overlay.querySelector('.motion-start-status');
  const video = dock.querySelector('video');
  const modeText = dock.querySelector('#motionMode');
  const hintText = dock.querySelector('#motionHint');
  let worker = null;
  let stream = null;
  let active = false;
  let busy = false;
  let lastFrameAt = 0;
  let lastResultAt = 0;
  let frameRequest = 0;
  let state = NO_INPUT;
  let hoverTarget = null;
  let hoverSince = 0;
  let draggingRange = null;
  let wasPinching = false;

  function releaseInput() {
    state = NO_INPUT;
    cursor.hidden = true;
    wasPinching = false;
    draggingRange = null;
    hoverTarget = null;
  }

  function setRangeFromCursor(input, x) {
    const rect = input.getBoundingClientRect();
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 0.01;
    const portion = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    const value = min + Math.round((portion * (max - min)) / step) * step;
    input.value = String(Math.max(min, Math.min(max, value)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function updateCursor(input, now) {
    if (!input.cursor) { cursor.hidden = true; wasPinching = false; draggingRange = null; return; }
    const x = input.cursor.x * window.innerWidth;
    const y = input.cursor.y * window.innerHeight;
    cursor.hidden = false;
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.classList.toggle('pinched', input.pinch);
    const raw = document.elementFromPoint(x, y);
    const target = raw?.closest('button, input[type="range"], label.upload-button');
    if (target !== hoverTarget) { hoverTarget = target; hoverSince = now; }
    if (draggingRange && input.pinch) setRangeFromCursor(draggingRange, x);
    if (input.pinch && !wasPinching && target && now - hoverSince > 180) {
      if (target.matches('input[type="range"]')) {
        draggingRange = target;
        setRangeFromCursor(target, x);
      } else if (!target.disabled && !target.hidden) target.click();
    }
    if (!input.pinch) draggingRange = null;
    wasPinching = input.pinch;
  }

  function processResult(message) {
    busy = false;
    if (document.hidden) { releaseInput(); return; }
    lastResultAt = performance.now();
    state = interpreter.update(message.pose, message.hands, message.timestamp / 1000,
      { menuOpen: isMenuOpen() });
    state.sample = message.timestamp;
    if (!state.tracked) {
      modeText.textContent = '未识别到全身';
      hintText.textContent = '请后退一步，让头部和双脚进入画面';
    } else if (!state.calibrated) {
      modeText.textContent = `校准中 ${Math.round((state.calibrationProgress ?? 0) * 100)}%`;
      hintText.textContent = '双脚站稳，保持全身可见';
    } else {
      modeText.textContent = { stop: '停止', walk: '行走', run: '奔跑' }[state.mode];
      hintText.textContent = isMenuOpen() ? '右手指向物品，捏合选择' : '原地踏步 · 左手举起开背包';
    }
    updateCursor(state, performance.now());
    for (const action of state.events) onAction(action);
  }

  function stop() {
    active = false;
    cancelAnimationFrame(frameRequest);
    worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.srcObject = null;
    busy = false;
    releaseInput();
    interpreter.reset();
    dock.hidden = true;
    overlay.hidden = false;
    startButton.disabled = false;
    startButton.textContent = '开启摄像头';
    startStatus.textContent = '摄像头已关闭。';
  }

  async function pump(timestamp) {
    if (!active) return;
    frameRequest = requestAnimationFrame(pump);
    if (busy && timestamp - lastFrameAt > 1800) {
      stop(); startStatus.textContent = '识别线程无响应，请重新开启摄像头。'; return;
    }
    if (busy || document.hidden || timestamp - lastFrameAt < 75 || video.readyState < 2) return;
    lastFrameAt = timestamp;
    busy = true;
    try {
      let bitmap;
      try { bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeHeight: 480 }); }
      catch { bitmap = await createImageBitmap(video); }
      if (!active || !worker) { bitmap.close(); busy = false; return; }
      worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
    } catch (error) {
      busy = false;
      stop();
      startStatus.textContent = `无法读取摄像头画面：${error.message}`;
    }
  }

  async function openCamera() {
    try {
      startStatus.textContent = '模型已就绪，正在启动摄像头…';
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器或页面地址不支持摄像头');
      stream = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
      video.srcObject = stream;
      await video.play();
      active = true;
      overlay.hidden = true;
      dock.hidden = false;
      lastFrameAt = 0;
      frameRequest = requestAnimationFrame(pump);
    } catch (error) {
      stop();
      startStatus.textContent = error.name === 'NotAllowedError'
        ? '摄像头访问被拒绝。请在浏览器地址栏允许此站点使用摄像头后重试。'
        : error.name === 'NotFoundError' ? '没有检测到摄像头。请连接设备后重试。'
        : `摄像头启动失败：${error.message}`;
    }
  }

  function start() {
    if (active) return;
    startButton.disabled = true;
    startStatus.textContent = '正在加载本地识别模型…';
    try {
      worker = new Worker(new URL('./motion-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = event => {
        if (event.data.type === 'ready') openCamera();
        else if (event.data.type === 'result') processResult(event.data);
        else if (event.data.type === 'error') {
          const message = event.data.message;
          stop(); startStatus.textContent = message;
        }
      };
      worker.onerror = error => { stop(); startStatus.textContent = `识别线程异常：${error.message}`; };
      const baseUrl = new URL(import.meta.env.BASE_URL, location.origin).href;
      worker.postMessage({ type: 'init', baseUrl });
    } catch (error) {
      stop();
      startStatus.textContent = `识别模型启动失败：${error.message}`;
    }
  }

  startButton.addEventListener('click', start);
  dock.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.motion;
    if (action === 'stop') stop();
    if (action === 'calibrate') { interpreter.reset(); releaseInput(); modeText.textContent = '校准中'; hintText.textContent = '双脚站稳，保持全身可见'; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseInput(); });
  window.addEventListener('pagehide', stop);
  return { start, stop, get state() { return active && !document.hidden && performance.now() - lastResultAt < 500 ? state : NO_INPUT; },
    get active() { return active; } };
}
