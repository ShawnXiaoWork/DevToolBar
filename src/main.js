import * as THREE from 'three';
import { createWorld, updateWorld, START_DIRECTION, PLANET_RADIUS, SEA_RADIUS, surfacePoint, getTangentFrame } from './world.js';
import { updateVoxelTerrain } from './voxel-terrain.js';
import { createPlayerState, createDeathDrop, recoverDeathDrop, respawnPlayer, useBerry, ENEMY_TYPES } from './game-rules.js';
import { createEnemySystem, updateEnemySystem, resetEnemyAggro } from './enemy-system.js';
import { createLootSystem, addDeathDrop, removeDeathDrop, closestDeathDrop, updateDeathDrops } from './loot-system.js';
import { loadGame, saveGame } from './save-game.js';
import { ITEMS as ITEM_CATALOG } from './items.js';
import { addItem } from './inventory.js';
import { createItemWorld, addGroundItem, removeGroundItem, closestGroundItem, updateGroundItems } from './item-world.js';
import { createInventoryUI } from './inventory-ui.js';
import { createMotionControl } from './motion-control.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="experience" id="experience">
    <div class="viewport" id="viewport"></div>
    <img id="referenceImage" class="reference-image" alt="本地参考画面叠加" />
    <div class="vignette"></div>
    <div class="grain"></div>

    <header class="topbar ui-layer">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <div>
          <div class="brand-kicker">THREE.JS / VISUAL STUDY</div>
          <h1>体素星球 · 生存验证关卡</h1>
        </div>
      </div>
      <div class="top-actions">
        <span class="live-pill"><span class="live-dot"></span>实时渲染</span>
        <button id="inventoryToggle" class="icon-button" type="button" title="打开背包" aria-label="打开背包">▣</button>
        <button id="captureBtn" class="icon-button" type="button" title="保存当前画面为 PNG" aria-label="保存截图">↧</button>
        <button id="panelToggle" class="icon-button" type="button" title="切换验证面板" aria-label="切换验证面板">☷</button>
      </div>
    </header>

    <section class="combat-hud ui-layer" aria-label="战斗状态">
      <div class="combat-hud-heading"><strong>生命</strong><span id="healthText">100 / 100</span></div>
      <div class="health-track"><div id="healthFill"></div></div>
      <div class="combat-hud-row"><span id="equipmentText">木剑 · 布甲</span><span id="enemyCount">敌人 0</span></div>
      <div class="combat-hud-row"><span id="inventoryText">浆果 ×3</span><span id="killCount">击败 0</span></div>
      <div class="combat-hud-actions"><button id="useBerryButton" type="button">使用浆果</button><span>靠近敌人自动攻击</span></div>
      <div id="deathDropInfo" class="death-drop-info" hidden><span id="dropDirection">遗物 0 m</span><button id="recoverButton" type="button" hidden>握拳拾回</button></div>
      <div id="groundItemInfo" class="death-drop-info" hidden><span id="groundItemText">地面物品</span><button id="pickupButton" type="button" hidden>握拳拾取</button></div>
      <div id="targetInfo" class="target-info" hidden>余烬方块怪 · 48 / 48</div>
    </section>
    <div id="eventToast" class="event-toast ui-layer" role="status" aria-live="polite"></div>
    <div id="damageFlash" class="damage-flash"></div>

    <section class="intro-card ui-layer" aria-label="关卡说明">
      <div class="eyebrow"><span class="eyebrow-line"></span> ENVIRONMENT STUDY 01</div>
      <h2>走进一颗<br /><em>方块星球</em></h2>
      <p>探索动态加载的方块星球。敌人会在警戒范围内追击；角色自动迎击，死亡后回到复活点寻找遗物。</p>
      <div class="intro-tags"><span>动态区块</span><span>自动战斗</span><span>遗物找回</span></div>
    </section>

    <aside id="controlPanel" class="control-panel ui-layer" aria-label="视觉验证控制台">
      <div class="panel-heading">
        <div><span class="panel-overline">RENDER LAB</span><h2>场景校准</h2></div>
        <span class="panel-index">01 / 03</span>
      </div>

      <div class="panel-section">
        <div class="control-heading"><label for="timeRange">星球时间</label><output id="timeOutput">10:20</output></div>
        <input id="timeRange" class="range-input" type="range" min="0" max="24" step="0.05" value="10.33" />
        <div class="range-labels"><span>黎明</span><span>正午</span><span>黄昏</span><span>深夜</span></div>
        <div class="preset-row">
          <button class="preset active" data-time="10.33" type="button">晴昼</button>
          <button class="preset" data-time="18.3" type="button">薄暮</button>
          <button class="preset" data-time="22.4" type="button">星夜</button>
        </div>
      </div>

      <div class="panel-section">
        <div class="control-heading"><label for="viewSelect">观察视角</label><span class="control-hint">举起右手旋转</span></div>
        <div class="view-row" id="viewSelect">
          <button class="view-button active" data-view="walk" type="button"><span class="view-icon">◉</span> 漫游</button>
          <button class="view-button" data-view="meadow" type="button"><span class="view-icon">▦</span> 近景</button>
          <button class="view-button" data-view="wide" type="button"><span class="view-icon">◌</span> 全景</button>
          <button class="view-button" data-view="planet" type="button"><span class="view-icon">◍</span> 星球</button>
        </div>
      </div>

      <div class="panel-section">
        <div class="control-heading"><label for="exposureRange">画面曝光</label><output id="exposureOutput">1.00</output></div>
        <input id="exposureRange" class="range-input" type="range" min="0.55" max="1.5" step="0.01" value="1" />
        <div class="control-heading cloud-heading"><label for="cloudRange">云层密度</label><output id="cloudOutput">100%</output></div>
        <input id="cloudRange" class="range-input" type="range" min="0" max="1.5" step="0.01" value="1" />
      </div>

      <div class="panel-section">
        <div class="control-heading"><label for="windStrengthRange">风力</label><output id="windStrengthOutput">75%</output></div>
        <input id="windStrengthRange" class="range-input" type="range" min="0" max="2" step="0.01" value="0.75" />
        <div class="control-heading cloud-heading"><label for="windSpeedRange">风速</label><output id="windSpeedOutput">1.0×</output></div>
        <input id="windSpeedRange" class="range-input" type="range" min="0" max="2.5" step="0.05" value="1" />
        <div class="control-heading cloud-heading"><label for="windDirectionRange">风向</label><output id="windDirectionOutput">35°</output></div>
        <input id="windDirectionRange" class="range-input" type="range" min="0" max="360" step="1" value="35" />
      </div>

      <div class="panel-section">
        <div class="control-heading"><label for="renderDistanceRange">区块加载距离</label><output id="renderDistanceOutput">105 m</output></div>
        <input id="renderDistanceRange" class="range-input" type="range" min="45" max="160" step="5" value="105" />
        <div class="control-heading cloud-heading"><span>区块状态</span><output id="chunkOutput">0 加载 / 0 排队</output></div>
        <div class="range-labels"><span id="lodOutput">近景区块</span><span>Worker 生成 · 远景 LOD</span></div>
        <div class="control-heading cloud-heading"><span>渲染统计</span><output id="performanceOutput">—</output></div>
      </div>

      <div class="panel-section reference-section">
        <div class="control-heading"><label for="referenceFile">参考图对照</label><span class="control-hint">只在本地读取</span></div>
        <label class="upload-button" for="referenceFile"><span>⊕</span><span id="uploadText">选择实机截图</span></label>
        <input id="referenceFile" type="file" accept="image/*" hidden />
        <div id="referenceControls" class="reference-controls" hidden>
          <div class="control-heading"><label for="referenceOpacity">叠加透明度</label><output id="referenceOpacityOutput">50%</output></div>
          <input id="referenceOpacity" class="range-input" type="range" min="0" max="1" step="0.01" value="0.5" />
          <button id="removeReference" class="text-button" type="button">移除参考图</button>
        </div>
      </div>

      <div class="panel-footnote"><span class="footnote-star">✧</span> 方块面合批、隐藏面剔除、区块流送与远景 LOD 同时工作。</div>
    </aside>

    <div class="scene-label ui-layer"><span class="scene-label-star">▦</span><span><strong id="sceneTitle">体素旷野</strong><small id="sceneSub">区块 · 海岸 · 晴空</small></span></div>
    <div class="movement-hint ui-layer"><span>原地踏步行走 · 加快踏步奔跑</span><i></i><span>左手举起开背包 · 右手握拳拾取 · 捏合选择</span></div>
    <div id="loading" class="loading-screen"><div class="loading-orbit">✦</div><p>正在点亮星球</p></div>
  </div>
`;

const viewport = document.querySelector('#viewport');
const experience = document.querySelector('#experience');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.1, 6000);
const world = createWorld();
const player = createPlayerState();
const enemies = createEnemySystem(world.scene);
const loot = createLootSystem(world.scene);
const groundItems = createItemWorld(world.scene);
const characterDirection = START_DIRECTION.clone();
const characterVelocity = new THREE.Vector3();
const characterUp = new THREE.Vector3(0, 1, 0);
const localMovement = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLookTarget = new THREE.Vector3();
const desiredCameraUp = new THREE.Vector3();
const planetOrbitDirection = new THREE.Vector3();
const planetOrbitPosition = new THREE.Vector3();
const planetNorth = new THREE.Vector3();
const meadowCameraDirection = new THREE.Vector3();
const meadowTargetDirection = new THREE.Vector3();
const planetBaseRotation = new THREE.Quaternion();
const clock = new THREE.Clock();
let timeOfDay = 10.33;
let orbitYaw = 0.24;
let orbitPitch = 0.22;
let planetYaw = 0;
let planetPitch = 0;
let view = 'walk';
let zoomDistance = 3.7;
let targetZoomDistance = 3.7;
let lastMotionSample = -1;
let referenceUrl = null;
let elapsed = 0;
let walkPhase = 0;
let walkBlend = 0;
let performanceFrames = 0;
let performanceTime = 0;
let nextDropId = 1;
let nextItemDropId = 1;
let toastUntil = 0;
let attackUntil = 0;
let hitUntil = 0;
let saveElapsed = 0;

const views = {
  walk: { radial: 3.7, tangent: -8.0, target: 2.7, lookUp: 1.15 },
  meadow: { radial: 4.2 },
  wide: { radial: 30, tangent: -28, target: 7, lookUp: 3 },
  planet: { radial: 620, tangent: 0, target: 0, lookUp: 0 },
};

let storage = null;
try { storage = window.localStorage; } catch { /* Private browsing may block storage. */ }
const savedGame = loadGame(storage);
if (savedGame) {
  Object.assign(player, savedGame.player);
  characterDirection.set(savedGame.direction.x, savedGame.direction.y, savedGame.direction.z).normalize();
  for (const drop of savedGame.drops) addDeathDrop(loot, drop);
  nextDropId = Math.max(savedGame.nextDropId, ...savedGame.drops.map(drop => drop.id + 1));
  for (const drop of savedGame.groundItems) addGroundItem(groundItems, drop);
  nextItemDropId = Math.max(savedGame.nextItemDropId, ...savedGame.groundItems.map(drop => drop.id + 1));
} else {
  const starterDirection = START_DIRECTION.clone().add(new THREE.Vector3(0, .0075, 0)).normalize();
  addGroundItem(groundItems, {
    id: nextItemDropId++, itemId: 'stone_sword', quantity: 1,
    direction: { x: starterDirection.x, y: starterDirection.y, z: starterDirection.z },
  });
}

function saveProgress() {
  saveGame(storage, player, characterDirection, loot.drops.values(), nextDropId,
    groundItems.drops.values(), nextItemDropId);
}
window.addEventListener('pagehide', saveProgress);

function syncCharacter() {
  world.character.root.position.copy(surfacePoint(characterDirection, 0.02));
  world.character.root.quaternion.setFromUnitVectors(characterUp, characterDirection);
}

function snapCameraToPlayer() {
  const { north, east } = getTangentFrame(characterDirection);
  const horizontal = north.multiplyScalar(Math.cos(orbitYaw)).addScaledVector(east, Math.sin(orbitYaw));
  cameraPosition.copy(world.character.root.position)
    .addScaledVector(characterDirection, views.walk.radial + orbitPitch * 3.5)
    .addScaledVector(horizontal, views.walk.tangent - orbitPitch * 2.3);
  lookTarget.copy(world.character.root.position)
    .addScaledVector(horizontal, views.walk.target)
    .addScaledVector(characterDirection, views.walk.lookUp);
  camera.position.copy(cameraPosition);
  camera.up.copy(characterDirection);
  camera.lookAt(lookTarget);
  world.sky.mesh.position.copy(camera.position);
  world.stars.mesh.position.copy(camera.position);
}
syncCharacter();
world.character.facing.rotation.y = Math.PI - orbitYaw;

function showToast(message, duration = 2.6) {
  const toast = document.querySelector('#eventToast');
  toast.textContent = message;
  toast.classList.add('visible');
  toastUntil = elapsed + duration;
}

function spawnDroppedItem(stack) {
  const { north, east } = getTangentFrame(characterDirection);
  const forward = north.multiplyScalar(Math.cos(orbitYaw)).addScaledVector(east, Math.sin(orbitYaw));
  const direction = characterDirection.clone().addScaledVector(forward, 1.5 / PLANET_RADIUS).normalize();
  addGroundItem(groundItems, {
    id: nextItemDropId++, itemId: stack.id, quantity: stack.quantity,
    direction: { x: direction.x, y: direction.y, z: direction.z },
  });
}

const inventoryUI = createInventoryUI(experience, player, {
  onChange: saveProgress,
  onDrop: spawnDroppedItem,
  onMessage: showToast,
});
document.querySelector('#inventoryToggle').addEventListener('click', () => inventoryUI.toggle());
const motionControl = createMotionControl(experience, {
  isMenuOpen: () => inventoryUI.isOpen,
  onAction: action => {
    if (action === 'toggleMenu') inventoryUI.toggle();
    if (action === 'interact' && !inventoryUI.isOpen) tryInteract();
    if (action === 'useItem' && !inventoryUI.isOpen) tryUseBerry();
  },
});

function onPlayerDeath() {
  const drop = createDeathDrop(player, characterDirection, nextDropId++);
  if (drop) addDeathDrop(loot, drop);
  respawnPlayer(player, elapsed);
  characterDirection.copy(START_DIRECTION);
  characterVelocity.set(0, 0, 0);
  syncCharacter();
  view = 'walk';
  zoomDistance = views.walk.radial;
  targetZoomDistance = views.walk.radial;
  document.querySelectorAll('.view-button').forEach(button => button.classList.toggle('active', button.dataset.view === 'walk'));
  snapCameraToPlayer();
  resetEnemyAggro(enemies);
  hitUntil = elapsed + 1.1;
  showToast(drop ? '已在复活点重生 · 遗物留在死亡地点' : '已在复活点重生', 4.2);
  saveProgress();
}

function tryRecoverDrop() {
  const nearest = closestDeathDrop(loot, characterDirection);
  if (!nearest || nearest.distance > 2.8) return false;
  const result = recoverDeathDrop(player, nearest.drop);
  if (result.empty) removeDeathDrop(loot, nearest.drop.id);
  showToast(result.recovered ? result.empty ? '装备与背包物品已找回' : '背包已满，部分物品留在遗物中' : '背包已满，无法拾回');
  saveProgress();
  return result.recovered > 0;
}

function tryPickupItem() {
  const nearest = closestGroundItem(groundItems, characterDirection);
  if (!nearest || nearest.distance > 2.6) return false;
  const result = addItem(player, nearest.drop.itemId, nearest.drop.quantity);
  if (!result.added) { showToast('背包已满，无法拾取'); return false; }
  const itemName = ITEM_CATALOG[nearest.drop.itemId].name;
  nearest.drop.quantity = result.remaining;
  if (!nearest.drop.quantity) removeGroundItem(groundItems, nearest.drop.id);
  showToast(`拾取 ${itemName} ×${result.added}`);
  saveProgress();
  return true;
}

function tryInteract() {
  const death = closestDeathDrop(loot, characterDirection);
  const item = closestGroundItem(groundItems, characterDirection);
  if (death?.distance <= 2.8 && (!item || death.distance <= item.distance)) return tryRecoverDrop();
  if (item?.distance <= 2.6) return tryPickupItem();
  return false;
}

function tryUseBerry() {
  if (useBerry(player)) {
    showToast('使用浆果 · 恢复 25 点生命', 1.5);
    saveProgress();
  }
}

function dropBearing(drop) {
  const destination = new THREE.Vector3(drop.direction.x, drop.direction.y, drop.direction.z);
  const tangent = destination.addScaledVector(characterDirection, -destination.dot(characterDirection)).normalize();
  if (tangent.lengthSq() < .000001) return '●';
  const { north, east } = getTangentFrame(characterDirection);
  const forward = north.multiplyScalar(Math.cos(orbitYaw)).addScaledVector(east, Math.sin(orbitYaw));
  const right = new THREE.Vector3().crossVectors(forward, characterDirection).normalize();
  const angle = Math.atan2(tangent.dot(right), tangent.dot(forward));
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

function updateCombatHud() {
  document.querySelector('#healthText').textContent = `${player.health} / ${player.maxHealth}`;
  document.querySelector('#healthFill').style.width = `${player.health / player.maxHealth * 100}%`;
  document.querySelector('#healthFill').classList.toggle('low', player.health < 30);
  document.querySelector('#equipmentText').textContent = `${ITEM_CATALOG[player.equipment.weapon]?.name ?? '空手'} · ${ITEM_CATALOG[player.equipment.armor]?.name ?? '无护甲'}`;
  document.querySelector('#inventoryText').textContent = player.inventory.length
    ? player.inventory.map(item => `${ITEM_CATALOG[item.id].name} ×${item.quantity}`).join(' · ')
    : '背包为空';
  document.querySelector('#enemyCount').textContent = `敌人 ${enemies.stats.active} · 警戒 ${enemies.stats.alerted}`;
  document.querySelector('#killCount').textContent = `击败 ${player.kills}`;
  document.querySelector('#useBerryButton').disabled = !player.inventory.some(item => item.id === 'berry') || player.health >= player.maxHealth;
  const targetInfo = document.querySelector('#targetInfo');
  targetInfo.hidden = !enemies.nearest;
  if (enemies.nearest) {
    const target = enemies.nearest.record;
    targetInfo.textContent = `${ENEMY_TYPES[target.type].name} · ${target.health} / ${ENEMY_TYPES[target.type].maxHealth} 生命 · ${Math.round(enemies.nearest.distance)} m`;
  }
  const nearestDrop = closestDeathDrop(loot, characterDirection);
  const dropInfo = document.querySelector('#deathDropInfo');
  dropInfo.hidden = !nearestDrop;
  if (nearestDrop) {
    document.querySelector('#dropDirection').textContent = `遗物 ${dropBearing(nearestDrop.drop)} ${Math.round(nearestDrop.distance)} m`;
    document.querySelector('#recoverButton').hidden = nearestDrop.distance > 2.8;
  }
  const nearestGround = closestGroundItem(groundItems, characterDirection);
  const groundInfo = document.querySelector('#groundItemInfo');
  groundInfo.hidden = !nearestGround || nearestGround.distance > 9;
  if (nearestGround && nearestGround.distance <= 9) {
    document.querySelector('#groundItemText').textContent = `${ITEM_CATALOG[nearestGround.drop.itemId].name} ×${nearestGround.drop.quantity} · ${Math.round(nearestGround.distance)} m`;
    document.querySelector('#pickupButton').hidden = nearestGround.distance > 2.6;
  }
  world.character.sword.visible = Boolean(player.equipment.weapon);
  if (player.equipment.weapon) world.character.swordBlade.material.color.set(ITEM_CATALOG[player.equipment.weapon].color);
  world.character.armor.visible = player.equipment.armor === 'cloth_vest';
  document.querySelector('#damageFlash').classList.toggle('visible', elapsed < hitUntil);
  if (elapsed >= toastUntil) document.querySelector('#eventToast').classList.remove('visible');
}

document.querySelector('#recoverButton').addEventListener('click', tryRecoverDrop);
document.querySelector('#pickupButton').addEventListener('click', tryPickupItem);
document.querySelector('#useBerryButton').addEventListener('click', tryUseBerry);

function moveCharacter(dt, motion) {
  const forwardInput = inventoryUI.isOpen ? 0 : motion.forward;
  if (forwardInput) orbitYaw += motion.steer * dt * 1.4;
  const { north, east } = getTangentFrame(characterDirection);
  const cameraForward = north.multiplyScalar(Math.cos(orbitYaw)).addScaledVector(east, Math.sin(orbitYaw));
  const targetVelocity = cameraForward.multiplyScalar(forwardInput);
  if (targetVelocity.lengthSq() > 1) targetVelocity.normalize();
  const maxSpeed = motion.mode === 'run' ? 6.2 : 2.7;
  targetVelocity.multiplyScalar(maxSpeed);
  characterVelocity.lerp(targetVelocity, 1 - Math.exp(-dt * 13));
  characterVelocity.addScaledVector(characterDirection, -characterVelocity.dot(characterDirection));
  const distance = characterVelocity.length() * dt;
  if (distance > 0.00001) {
    const next = characterDirection.clone().addScaledVector(characterVelocity, dt / surfacePoint(characterDirection).length()).normalize();
    if (surfacePoint(next).length() > SEA_RADIUS + 0.19) characterDirection.copy(next);
    else characterVelocity.set(0, 0, 0);
  }
  syncCharacter();

  const speed = characterVelocity.length();
  if (speed > 0.06) {
    localMovement.copy(characterVelocity).normalize().applyQuaternion(world.character.root.quaternion.clone().invert());
    const targetHeading = Math.atan2(localMovement.x, localMovement.z);
    const headingDelta = Math.atan2(Math.sin(targetHeading - world.character.facing.rotation.y), Math.cos(targetHeading - world.character.facing.rotation.y));
    world.character.facing.rotation.y += headingDelta * (1 - Math.exp(-dt * 14));
  }
  walkBlend += (Math.min(1, speed / maxSpeed) - walkBlend) * (1 - Math.exp(-dt * 10));
  if (speed > 0.06) walkPhase += Math.PI * Math.max(1.2, Math.min(3.8, motion.stepRate || 1.2)) * dt;
  const stride = Math.sin(walkPhase) * (motion.mode === 'run' ? 0.53 : 0.38) * walkBlend;
  world.character.leftLeg.rotation.x = stride;
  world.character.rightLeg.rotation.x = -stride;
  world.character.leftArm.rotation.x = -stride * 0.65;
  world.character.rightArm.rotation.x = stride * 0.65;
  world.character.facing.position.y = Math.abs(Math.sin(walkPhase)) * 0.025 * walkBlend;
  world.character.bodyGroup.position.y = Math.sin(elapsed * 1.6) * 0.008;
  world.character.bodyGroup.rotation.z = Math.sin(walkPhase) * 0.018 * walkBlend;
}

function updateCamera(dt) {
  zoomDistance += (targetZoomDistance - zoomDistance) * (1 - Math.exp(-dt * 5.2));
  const nearBlend = THREE.MathUtils.smoothstep(zoomDistance, views.walk.radial, views.wide.radial);
  const overviewBlend = THREE.MathUtils.smoothstep(zoomDistance, views.wide.radial, 470);
  const spaceBlend = THREE.MathUtils.smoothstep(zoomDistance, 90, 370);
  const tangent = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(views.walk.tangent, views.wide.tangent, nearBlend),
    -views.planet.tangent,
    overviewBlend,
  ) - orbitPitch * 2.3;
  const targetAhead = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(views.walk.target, views.wide.target, nearBlend),
    0,
    overviewBlend,
  );
  const targetHeight = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(views.walk.lookUp, views.wide.lookUp, nearBlend),
    0,
    overviewBlend,
  );
  const { north, east } = getTangentFrame(characterDirection);
  const horizontal = north.clone().multiplyScalar(Math.cos(orbitYaw)).addScaledVector(east, Math.sin(orbitYaw));
  const radial = Math.max(1.8, zoomDistance + orbitPitch * 3.5);
  const characterPosition = world.character.root.position;
  desiredCamera.copy(characterPosition)
    .addScaledVector(characterDirection, radial)
    .addScaledVector(horizontal, tangent);
  const orbitRadius = characterPosition.length() + zoomDistance;
  const azimuth = planetYaw + Math.atan2(tangent * Math.sin(orbitYaw), orbitRadius);
  const elevation = planetPitch + Math.atan2(tangent * Math.cos(orbitYaw), orbitRadius);
  planetOrbitDirection.set(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
  planetBaseRotation.setFromUnitVectors(START_DIRECTION, characterDirection);
  planetOrbitDirection.applyQuaternion(planetBaseRotation).normalize();
  planetOrbitPosition.copy(planetOrbitDirection).multiplyScalar(orbitRadius);
  desiredCamera.lerp(planetOrbitPosition, overviewBlend);
  const factor = 1 - Math.exp(-dt * 4.8);
  desiredLookTarget.copy(characterPosition)
    .addScaledVector(horizontal, targetAhead)
    .addScaledVector(characterDirection, targetHeight)
    .multiplyScalar(1 - overviewBlend);
  planetNorth.set(0, 1, 0).addScaledVector(planetOrbitDirection, -planetOrbitDirection.y);
  if (planetNorth.lengthSq() < 0.01) planetNorth.copy(north);
  else planetNorth.normalize();
  desiredCameraUp.copy(characterDirection).lerp(planetNorth, overviewBlend).normalize();
  if (view === 'meadow') {
    meadowCameraDirection.copy(characterDirection).addScaledVector(horizontal, -0.013).normalize();
    meadowTargetDirection.copy(characterDirection).addScaledVector(horizontal, 0.014).normalize();
    desiredCamera.copy(surfacePoint(meadowCameraDirection, 0.82));
    desiredLookTarget.copy(surfacePoint(meadowTargetDirection, -.25));
    desiredCameraUp.copy(meadowCameraDirection);
  }
  cameraPosition.lerp(desiredCamera, factor);
  lookTarget.lerp(desiredLookTarget, factor);
  camera.position.copy(cameraPosition);
  camera.up.lerp(desiredCameraUp, factor).normalize();
  camera.lookAt(lookTarget);
  world.sky.mesh.position.copy(camera.position);
  world.stars.mesh.position.copy(camera.position);
  world.sky.uniforms.uUp.value.copy(view === 'meadow' ? meadowCameraDirection : characterDirection);
  world.character.root.visible = view !== 'meadow';
  world.decorations.visible = view !== 'meadow';
  experience.classList.toggle('meadow-view', view === 'meadow');
  world.sky.uniforms.uSpace.value = spaceBlend;
  world.atmosphere.uniforms.uSpace.value = spaceBlend;
  world.atmosphere.mesh.visible = spaceBlend > 0.01;
  world.stars.material.opacity = Math.max(world.stars.material.opacity, spaceBlend * 0.9);
}

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', resize);

function formatTime(hour) {
  const hours = Math.floor(hour) % 24;
  const minutes = Math.floor((hour % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function updateTimeUI() {
  document.querySelector('#timeOutput').textContent = formatTime(timeOfDay);
  document.querySelector('#timeRange').value = timeOfDay;
  document.querySelectorAll('.preset').forEach(button => {
    button.classList.toggle('active', Math.abs(Number(button.dataset.time) - timeOfDay) < 0.1);
  });
  const title = document.querySelector('#sceneTitle');
  const sub = document.querySelector('#sceneSub');
  if (timeOfDay < 5.6 || timeOfDay >= 19.4) {
    title.textContent = '方块星夜'; sub.textContent = '体素 · 星点 · 夜色';
  } else if (timeOfDay >= 16.9 || timeOfDay < 7.0) {
    title.textContent = '暮色海岸'; sub.textContent = '方块 · 云层 · 潮汐';
  } else {
    title.textContent = '体素旷野'; sub.textContent = '区块 · 海岸 · 晴空';
  }
}

document.querySelector('#timeRange').addEventListener('input', event => {
  timeOfDay = Number(event.target.value);
  updateTimeUI();
});
document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', () => {
  timeOfDay = Number(button.dataset.time);
  updateTimeUI();
}));
document.querySelectorAll('.view-button').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  targetZoomDistance = views[view].radial;
  document.querySelectorAll('.view-button').forEach(item => item.classList.toggle('active', item === button));
}));
document.querySelector('#exposureRange').addEventListener('input', event => {
  renderer.toneMappingExposure = Number(event.target.value);
  document.querySelector('#exposureOutput').textContent = renderer.toneMappingExposure.toFixed(2);
});
document.querySelector('#cloudRange').addEventListener('input', event => {
  world.sky.uniforms.uClouds.value = Number(event.target.value);
  document.querySelector('#cloudOutput').textContent = `${Math.round(Number(event.target.value) * 100)}%`;
});
document.querySelector('#windStrengthRange').addEventListener('input', event => {
  const strength = Number(event.target.value);
  world.grass.uniforms.uWindStrength.value = strength;
  document.querySelector('#windStrengthOutput').textContent = `${Math.round(strength * 100)}%`;
});
document.querySelector('#windSpeedRange').addEventListener('input', event => {
  const speed = Number(event.target.value);
  world.grass.uniforms.uWindSpeed.value = speed;
  document.querySelector('#windSpeedOutput').textContent = `${speed.toFixed(1)}×`;
});
document.querySelector('#windDirectionRange').addEventListener('input', event => {
  const degrees = Number(event.target.value);
  const radians = degrees * Math.PI / 180;
  world.grass.uniforms.uWindDirection.value.set(Math.cos(radians), Math.sin(radians), 0);
  document.querySelector('#windDirectionOutput').textContent = `${degrees}°`;
});
document.querySelector('#renderDistanceRange').value = world.voxel.renderDistance;
document.querySelector('#renderDistanceOutput').textContent = `${world.voxel.renderDistance} m`;
document.querySelector('#renderDistanceRange').addEventListener('input', event => {
  world.voxel.renderDistance = Number(event.target.value);
  document.querySelector('#renderDistanceOutput').textContent = `${world.voxel.renderDistance} m`;
});
document.querySelector('#panelToggle').addEventListener('click', () => experience.classList.toggle('panel-hidden'));

const referenceImage = document.querySelector('#referenceImage');
document.querySelector('#referenceFile').addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  referenceImage.src = referenceUrl;
  referenceImage.style.opacity = document.querySelector('#referenceOpacity').value;
  referenceImage.classList.add('visible');
  document.querySelector('#uploadText').textContent = file.name;
  document.querySelector('#referenceControls').hidden = false;
});
document.querySelector('#referenceOpacity').addEventListener('input', event => {
  referenceImage.style.opacity = event.target.value;
  document.querySelector('#referenceOpacityOutput').textContent = `${Math.round(Number(event.target.value) * 100)}%`;
});
document.querySelector('#removeReference').addEventListener('click', () => {
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = null;
  referenceImage.removeAttribute('src');
  referenceImage.classList.remove('visible');
  document.querySelector('#referenceFile').value = '';
  document.querySelector('#uploadText').textContent = '选择实机截图';
  document.querySelector('#referenceControls').hidden = true;
});

document.querySelector('#captureBtn').addEventListener('click', () => {
  renderer.render(world.scene, camera);
  const link = document.createElement('a');
  link.download = `planet-study-${formatTime(timeOfDay).replace(':', '-')}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
});

function changeZoom(amount) {
  targetZoomDistance = THREE.MathUtils.clamp(targetZoomDistance * Math.exp(amount * .0018), 2.4, 1100);
  view = null;
  document.querySelectorAll('.view-button').forEach(button => button.classList.remove('active'));
}

function applyMotionCamera(motion) {
  if (motion.sample === lastMotionSample) return;
  lastMotionSample = motion.sample;
  if (inventoryUI.isOpen) return;
  if (motion.zoom) changeZoom(motion.zoom * 1200);
  const orbitWeight = THREE.MathUtils.smoothstep(zoomDistance, 100, 400);
  orbitYaw -= motion.lookX * 1.1 * (1 - orbitWeight);
  orbitPitch = THREE.MathUtils.clamp(orbitPitch + motion.lookY * 0.9 * (1 - orbitWeight), -0.75, 1.15);
  planetYaw -= motion.lookX * 1.3 * orbitWeight;
  planetPitch = THREE.MathUtils.clamp(planetPitch + motion.lookY * 1.1 * orbitWeight, -1.15, 1.15);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const motion = motionControl.state;
  applyMotionCamera(motion);
  moveCharacter(dt, motion);
  updateWorld(world, timeOfDay, elapsed);
  updateCamera(dt);
  updateVoxelTerrain(world.voxel, camera, characterDirection, dt);
  const combatEnabled = zoomDistance < 55 && view !== 'meadow' && !inventoryUI.isOpen
    && motion.tracked && motion.calibrated;
  const combatEvents = updateEnemySystem(enemies, player, characterDirection, dt, elapsed, combatEnabled);
  for (const event of combatEvents) {
    if (event.type === 'playerHit') hitUntil = elapsed + .24;
    if (event.type === 'playerAttack') attackUntil = elapsed + .25;
    if (event.type === 'enemyKilled') {
      addGroundItem(groundItems, {
        id: nextItemDropId++, itemId: event.loot.id, quantity: event.loot.quantity,
        direction: event.direction,
      });
      showToast(`击败 ${ENEMY_TYPES[event.enemy.type].name} · 掉落 ${ITEM_CATALOG[event.loot.id].name}`);
      saveProgress();
    }
  }
  if (player.health <= 0) onPlayerDeath();
  if (elapsed < attackUntil) world.character.rightArm.rotation.x = -1.15;
  updateDeathDrops(loot, elapsed, characterDirection);
  updateGroundItems(groundItems, elapsed, characterDirection);
  updateCombatHud();
  saveElapsed += dt;
  if (saveElapsed >= 2) { saveProgress(); saveElapsed = 0; }
  document.querySelector('#chunkOutput').textContent = `${world.voxel.stats.active}/${world.voxel.maxChunks} 区块 · ${world.voxel.stats.pending} 生成`;
  document.querySelector('#lodOutput').textContent = `${world.voxel.stats.mode} · ${world.voxel.stats.candidate} 候选`;
  renderer.render(world.scene, camera);
  performanceFrames++;
  performanceTime += dt;
  if (performanceTime >= .6) {
    const fps = Math.round(performanceFrames / performanceTime);
    document.querySelector('#performanceOutput').textContent = `${fps} FPS · ${renderer.info.render.calls} Draw`;
    performanceFrames = 0;
    performanceTime = 0;
  }
  requestAnimationFrame(animate);
}
snapCameraToPlayer();
updateTimeUI();
animate();
setTimeout(() => document.querySelector('#loading').classList.add('done'), 700);
