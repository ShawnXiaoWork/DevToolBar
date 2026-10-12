import * as THREE from 'three';
import { PLANET_RADIUS, START_DIRECTION, surfacePoint } from './world.js';
import { DIFFICULTY_NAMES, SUBJECT_NAMES } from './education-bank.js';
import { SITE_NAMES, availableCourses, completeQuestion, courseProgress, currentBank,
  importQuestionBank, readEducationQuest, saveEducationQuest } from './education-quest.js';

const INTERACT_DISTANCE = 3.8;
const UP = new THREE.Vector3(0, 1, 0);
const SITE_LAYOUT = [[3.3, -1.1], [18, .65], [29, -.45]];

function directionAt(distance, angle) {
  const x = Math.sin(angle) * distance / PLANET_RADIUS;
  const y = Math.cos(angle) * distance / PLANET_RADIUS;
  return new THREE.Vector3(x, y, Math.sqrt(1 - x * x - y * y)).normalize();
}

function makeRelic(scene, direction, color) {
  const root = new THREE.Group();
  root.position.copy(surfacePoint(direction, .18));
  root.quaternion.setFromUnitVectors(UP, direction);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.85, 1.15, .48, 8),
    new THREE.MeshLambertMaterial({ color: '#485b69' }));
  base.position.y = .22;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.22, .36, 1.3, 6),
    new THREE.MeshLambertMaterial({ color: '#abb8af' }));
  shaft.position.y = 1.05;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 }));
  crystal.position.y = 2.04;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.18, .055, 6, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = .53;
  root.add(base, shaft, crystal, halo);
  scene.add(root);
  return { root, crystal, halo, base, shaft };
}

function button(label, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

export function createEducationSystem(scene, host, storage, { onToast, onStageComplete, getBearing }) {
  const quest = readEducationQuest(storage);
  const sites = SITE_LAYOUT.map(([distance, angle], index) => {
    const direction = directionAt(distance, angle);
    return { direction, visual: makeRelic(scene, direction, ['#f9dc7b', '#87dcd2', '#c5b3ff'][index]) };
  });
  const beaconDirection = directionAt(2.7, 2.35);
  const beacon = makeRelic(scene, beaconDirection, '#fff0a0');
  beacon.root.scale.setScalar(1.5);

  const mission = document.createElement('section');
  mission.className = 'education-mission ui-layer';
  mission.setAttribute('aria-label', '知识探险');
  mission.innerHTML = '<strong>✦ 知识探险</strong><span class="education-course"></span><span class="education-waypoint"></span><button type="button" class="education-interact" hidden>进入遗迹</button>';
  const overlay = document.createElement('div');
  overlay.className = 'education-overlay ui-layer';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="education-panel" role="dialog" aria-modal="true" aria-label="知识探险">
    <header><div><small>PLANET QUEST</small><h2>知识探险</h2></div><button type="button" class="education-close" aria-label="关闭">×</button></header>
    <div class="education-settings">
      <p>选择题库，探索三座遗迹。答对题目就能点亮灯塔；进度自动保存。</p>
      <div class="education-source"></div>
      <label>年级</label><div class="education-grades"></div>
      <label>学科</label><div class="education-subjects"></div>
      <div class="education-progress"></div>
      <div class="education-import"><label class="upload-button" for="educationFile">＋ 导入 JSON 题库</label><input id="educationFile" type="file" accept="application/json,.json" hidden /><button type="button" class="education-export">下载当前题库 JSON</button></div>
      <p class="education-import-note">自定义题库至少需要同一年级、同一学科的 3 道题；支持四选一和三组配对。</p>
      <button type="button" class="education-reset">重新开始当前课程</button>
      <button type="button" class="education-primary education-return">返回星球寻找遗迹</button>
    </div>
    <div class="education-question" hidden>
      <div class="education-question-meta"></div><h3 class="education-prompt"></h3>
      <div class="education-answers"></div><p class="education-feedback" role="status" aria-live="polite"></p>
      <div class="education-question-actions"><button type="button" class="education-back">返回星球</button><button type="button" class="education-primary education-next" disabled>下一题</button></div>
    </div>
  </div>`;
  host.append(mission, overlay);

  const $ = selector => overlay.querySelector(selector);
  let view = 'settings';
  let currentSite = -1;
  let currentQuestion = null;
  let chosenLeft = -1;
  let matched = new Set();
  let answered = false;
  let wrongOptions = new Set();

  function persist() {
    if (!saveEducationQuest(storage, quest)) onToast('进度未能保存，请检查浏览器存储空间');
  }

  function visualRefresh() {
    const status = courseProgress(quest);
    sites.forEach(({ visual }, index) => {
      const done = status?.stageDone[index];
      const active = status?.activeStage === index;
      visual.crystal.material.opacity = done ? 1 : active ? .95 : .22;
      visual.halo.material.opacity = done ? .8 : active ? .55 : .12;
      visual.base.material.color.set(done ? '#7a977c' : '#485b69');
    });
    const complete = status?.activeStage === -1;
    beacon.crystal.material.color.set(complete ? '#fff4a8' : '#596470');
    beacon.crystal.material.opacity = complete ? 1 : .25;
    beacon.halo.material.opacity = complete ? .85 : .1;
    mission.querySelector('.education-course').textContent = `${quest.grade}年级 ${SUBJECT_NAMES[quest.subject]} · ${quest.source === 'custom' ? '自定义题库' : '内置题库'}`;
  }

  function selectCourse(grade, subject) {
    const available = availableCourses(quest).some(course => course.grade === grade && course.subject === subject);
    if (!available) return;
    quest.grade = grade;
    quest.subject = subject;
    persist();
    renderSettings();
    visualRefresh();
  }

  function renderSettings() {
    view = 'settings';
    $('.education-settings').hidden = false;
    $('.education-question').hidden = true;
    const source = $('.education-source');
    source.replaceChildren();
    const builtin = button('内置题库', quest.source === 'builtin' ? 'active' : '');
    builtin.addEventListener('click', () => { quest.source = 'builtin'; selectCourse(5, 'english'); });
    source.append(builtin);
    if (quest.customQuestions) {
      const custom = button('自定义题库', quest.source === 'custom' ? 'active' : '');
      custom.addEventListener('click', () => {
        quest.source = 'custom';
        const first = availableCourses(quest)[0];
        selectCourse(first.grade, first.subject);
      });
      source.append(custom);
    }
    const available = availableCourses(quest);
    const grades = $('.education-grades');
    grades.replaceChildren();
    for (const grade of [5, 6]) {
      const item = button(`${grade} 年级`, quest.grade === grade ? 'active' : '');
      item.disabled = !available.some(course => course.grade === grade);
      item.addEventListener('click', () => {
        const subject = available.some(course => course.grade === grade && course.subject === quest.subject)
          ? quest.subject : available.find(course => course.grade === grade).subject;
        selectCourse(grade, subject);
      });
      grades.append(item);
    }
    const subjects = $('.education-subjects');
    subjects.replaceChildren();
    for (const subject of ['english', 'math', 'chinese']) {
      const item = button(SUBJECT_NAMES[subject], quest.subject === subject ? 'active' : '');
      item.disabled = !available.some(course => course.grade === quest.grade && course.subject === subject);
      item.addEventListener('click', () => selectCourse(quest.grade, subject));
      subjects.append(item);
    }
    const status = courseProgress(quest);
    $('.education-progress').textContent = status
      ? `已完成 ${status.completed.size} / ${status.total} 题 · 点亮 ${status.stageDone.filter(Boolean).length} / 3 座遗迹${status.activeStage < 0 ? ' · 灯塔已点亮' : ''}`
      : '当前组合没有足够的题目';
    visualRefresh();
  }

  function openSettings() {
    currentQuestion = null;
    overlay.hidden = false;
    renderSettings();
  }

  function close() {
    overlay.hidden = true;
    currentQuestion = null;
    currentSite = -1;
  }

  function finishQuestion() {
    if (answered || !currentQuestion) return;
    answered = true;
    const before = courseProgress(quest);
    completeQuestion(quest, currentQuestion.id);
    persist();
    const after = courseProgress(quest);
    const stageCleared = before.activeStage !== after.activeStage;
    if (stageCleared) {
      onStageComplete(currentSite, after.activeStage < 0);
      $('.education-next').textContent = after.activeStage < 0 ? '点亮灯塔' : '完成遗迹';
    } else $('.education-next').textContent = '下一题';
    $('.education-next').disabled = false;
    $('.education-feedback').textContent = `正确！${currentQuestion.explanation}`;
    $('.education-feedback').className = 'education-feedback correct';
    visualRefresh();
  }

  function renderChoices(question) {
    const answers = $('.education-answers');
    answers.className = 'education-answers choice-answers';
    question.options.forEach((option, index) => {
      const item = button(`${String.fromCharCode(65 + index)}. ${option}`, 'education-option');
      item.addEventListener('click', () => {
        if (answered || wrongOptions.has(index)) return;
        if (index === question.answer) { item.classList.add('correct'); finishQuestion(); }
        else {
          wrongOptions.add(index);
          item.classList.add('incorrect');
          item.disabled = true;
          $('.education-feedback').textContent = `再试一次。${question.explanation}`;
          $('.education-feedback').className = 'education-feedback incorrect';
        }
      });
      answers.append(item);
    });
  }

  function renderPairs(question) {
    const answers = $('.education-answers');
    answers.className = 'education-answers pair-answers';
    const leftColumn = document.createElement('div');
    const rightColumn = document.createElement('div');
    leftColumn.className = rightColumn.className = 'education-pair-column';
    question.pairs.forEach(([left], index) => {
      const item = button(left, 'education-option');
      item.dataset.index = index;
      item.addEventListener('click', () => {
        if (answered || matched.has(index)) return;
        chosenLeft = index;
        leftColumn.querySelectorAll('button').forEach(btn => btn.classList.toggle('selected', Number(btn.dataset.index) === index));
        $('.education-feedback').textContent = '再点选右侧对应的答案。';
        $('.education-feedback').className = 'education-feedback';
      });
      leftColumn.append(item);
    });
    for (const index of [1, 2, 0]) {
      const item = button(question.pairs[index][1], 'education-option');
      item.dataset.index = index;
      item.addEventListener('click', () => {
        if (answered) return;
        if (chosenLeft < 0) { $('.education-feedback').textContent = '先选择左侧的一项。'; return; }
        if (chosenLeft !== index) {
          $('.education-feedback').textContent = `配对不正确。${question.explanation}`;
          $('.education-feedback').className = 'education-feedback incorrect';
          return;
        }
        matched.add(index);
        leftColumn.querySelector(`button[data-index="${index}"]`).classList.add('matched');
        leftColumn.querySelector(`button[data-index="${index}"]`).disabled = true;
        item.classList.add('matched');
        item.disabled = true;
        chosenLeft = -1;
        leftColumn.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
        $('.education-feedback').textContent = `已配对 ${matched.size} / 3 组。`;
        $('.education-feedback').className = 'education-feedback correct';
        if (matched.size === 3) finishQuestion();
      });
      rightColumn.append(item);
    }
    answers.append(leftColumn, rightColumn);
  }

  function renderQuestion() {
    const status = courseProgress(quest);
    if (!status || status.activeStage !== currentSite) { close(); return; }
    currentQuestion = status.stages[currentSite].find(question => !status.completed.has(question.id));
    if (!currentQuestion) { close(); return; }
    view = 'question';
    overlay.hidden = false;
    $('.education-settings').hidden = true;
    $('.education-question').hidden = false;
    chosenLeft = -1;
    matched = new Set();
    wrongOptions = new Set();
    answered = false;
    const currentNumber = status.stages[currentSite].filter(question => status.completed.has(question.id)).length + 1;
    $('.education-question-meta').textContent = `${SITE_NAMES[currentSite]} · 第 ${currentNumber} / ${status.stages[currentSite].length} 题 · ${DIFFICULTY_NAMES[currentQuestion.difficulty]} · ${currentQuestion.type === 'pair' ? '配对' : '选择'}`;
    $('.education-prompt').textContent = currentQuestion.prompt;
    $('.education-feedback').textContent = currentQuestion.type === 'pair' ? '先选左侧，再选右侧对应的内容。' : '选择一个答案。';
    $('.education-feedback').className = 'education-feedback';
    $('.education-next').disabled = true;
    $('.education-next').textContent = '下一题';
    $('.education-answers').replaceChildren();
    if (currentQuestion.type === 'choice') renderChoices(currentQuestion);
    else renderPairs(currentQuestion);
  }

  function nearest(playerDirection) {
    const status = courseProgress(quest);
    if (!status || status.activeStage < 0) return null;
    const index = status.activeStage;
    return { index, direction: sites[index].direction,
      distance: playerDirection.distanceTo(sites[index].direction) * PLANET_RADIUS };
  }

  function interact(playerDirection) {
    const target = nearest(playerDirection);
    if (!target || target.distance > INTERACT_DISTANCE) return false;
    currentSite = target.index;
    renderQuestion();
    return true;
  }

  let lastPlayerDirection = START_DIRECTION;
  function update(playerDirection, elapsed) {
    lastPlayerDirection = playerDirection;
    const target = nearest(playerDirection);
    const waypoint = mission.querySelector('.education-waypoint');
    const action = mission.querySelector('.education-interact');
    if (target) {
      waypoint.textContent = `${SITE_NAMES[target.index]} ${getBearing(target.direction)} ${Math.round(target.distance)} m`;
      action.hidden = target.distance > INTERACT_DISTANCE;
      action.textContent = '进入遗迹 · E / 握拳';
    } else {
      waypoint.textContent = '三座遗迹已修复 · 灯塔已点亮';
      action.hidden = true;
    }
    sites.forEach(({ visual }, index) => {
      visual.crystal.rotation.y = elapsed * .65 + index;
      visual.crystal.position.y = 2.04 + Math.sin(elapsed * 2 + index) * .12;
    });
    beacon.crystal.rotation.y = elapsed * .35;
  }

  $('.education-close').addEventListener('click', close);
  $('.education-back').addEventListener('click', close);
  $('.education-return').addEventListener('click', close);
  $('.education-next').addEventListener('click', () => {
    if (!answered) return;
    const status = courseProgress(quest);
    if (status.activeStage !== currentSite) close();
    else renderQuestion();
  });
  mission.querySelector('.education-interact').addEventListener('click', () => interact(lastPlayerDirection));
  $('.education-reset').addEventListener('click', () => {
    if (!window.confirm(`重新开始 ${quest.grade} 年级${SUBJECT_NAMES[quest.subject]}课程？本课程的答题进度会清零。`)) return;
    delete quest.progress[`${quest.source}:${quest.grade}-${quest.subject}`];
    persist();
    renderSettings();
    onToast('当前课程已重新开始');
  });

  $('#educationFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 300_000) throw new Error('题库文件不能超过 300 KB');
      const data = JSON.parse(await file.text());
      const count = importQuestionBank(quest, data);
      persist();
      renderSettings();
      onToast(`已导入 ${count} 道题`);
    } catch (error) { onToast(`导入失败：${error.message}`, 4); }
    event.target.value = '';
  });
  $('.education-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentBank(quest), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = quest.source === 'builtin' ? '小学英语数学语文题库.json' : '自定义题库.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  visualRefresh();
  return { get isOpen() { return !overlay.hidden; }, close, openSettings, interact, nearest,
    update, get quest() { return quest; } };
}
