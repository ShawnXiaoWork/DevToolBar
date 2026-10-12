import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLANET_RADIUS, SEA_RADIUS, terrainRadius } from './planet-height.js';
import { START_DIRECTION, surfacePoint } from './world.js';
import { ENEMY_TYPES, PLAYER_RULES, damagePlayer, playerAttackDamage } from './game-rules.js';

const SPAWN_SAMPLES = 3000;
const STREAM_RADIUS = 52;
const MAX_ACTIVE = 24;
const STREAM_INTERVAL = .5;
const UP = new THREE.Vector3(0, 1, 0);

function hash(value) {
  const x = Math.sin(value * 127.1 + 31.7) * 43758.5453;
  return x - Math.floor(x);
}

function enemyGeometry(palette) {
  const parts = [
    [1.10, .92, .78, 0, .72, 0, palette.body],
    [.88, .67, .72, 0, 1.49, 0, palette.head],
    [.23, .23, .08, -.22, 1.54, .40, palette.eyes],
    [.23, .23, .08, .22, 1.54, .40, palette.eyes],
    [.35, .22, .53, -.31, .14, .02, palette.feet],
    [.35, .22, .53, .31, .14, .02, palette.feet],
    [.30, .47, .36, -.68, .83, 0, palette.arms],
    [.30, .47, .36, .68, .83, 0, palette.arms],
  ];
  const geometries = parts.map(([w, h, d, x, y, z, hex]) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z);
    const color = new THREE.Color(hex);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const geometry = mergeGeometries(geometries);
  geometries.forEach(part => part.dispose());
  return geometry;
}

export function generateEnemySpawns(count = SPAWN_SAMPLES) {
  const records = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const types = Object.entries(ENEMY_TYPES);
  const totalWeight = types.reduce((sum, [, type]) => sum + type.spawnWeight, 0);
  for (let index = 0; index < count; index++) {
    const y = 1 - 2 * (index + .5) / count;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * goldenAngle + (hash(index + 93) - .5) * .35;
    const direction = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
    if (terrainRadius(direction) <= SEA_RADIUS + 3.2) continue;
    if (direction.distanceTo(START_DIRECTION) * PLANET_RADIUS < 13) continue;
    let roll = hash(index + 219) * totalWeight;
    let chosen = types[0][0];
    for (const [key, type] of types) {
      roll -= type.spawnWeight;
      if (roll <= 0) { chosen = key; break; }
    }
    records.push({
      id: index, type: chosen, spawnDirection: direction.clone(), direction,
      health: ENEMY_TYPES[chosen].maxHealth, deadUntil: 0,
      alerted: false, nextAttackAt: 0, hitUntil: 0, phase: hash(index + 113) * Math.PI * 2,
    });
  }
  return records;
}

export function createEnemySystem(scene) {
  const group = new THREE.Group();
  group.name = 'enemies';
  scene.add(group);
  const resources = new Map(Object.entries(ENEMY_TYPES).map(([key, type]) => [key, {
    geometry: enemyGeometry(type.visual),
    material: new THREE.MeshLambertMaterial({ vertexColors: true }),
    hitMaterial: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  }]));
  const records = generateEnemySpawns();
  return {
    group, resources,
    records, recordsById: new Map(records.map(record => [record.id, record])), active: new Map(),
    streamElapsed: STREAM_INTERVAL,
    stats: { active: 0, total: 0, alerted: 0 },
  };
}

function addVisual(system, record) {
  const root = new THREE.Group();
  const resource = system.resources.get(record.type);
  const body = new THREE.Mesh(resource.geometry, resource.material);
  body.castShadow = false;
  root.add(body);
  root.position.copy(surfacePoint(record.direction, .04));
  root.quaternion.setFromUnitVectors(UP, record.direction);
  system.group.add(root);
  system.active.set(record.id, { root, body });
}

function removeVisual(system, id) {
  const visual = system.active.get(id);
  if (!visual) return;
  system.group.remove(visual.root);
  system.active.delete(id);
}

function streamEnemies(system, playerDirection, now, enabled) {
  const candidates = [];
  if (enabled) {
    const minDot = Math.cos(STREAM_RADIUS / PLANET_RADIUS);
    for (const record of system.records) {
      if (record.deadUntil > now) continue;
      if (record.deadUntil > 0) {
        if (record.direction.distanceTo(playerDirection) * PLANET_RADIUS < 20) continue;
        record.deadUntil = 0;
        record.health = ENEMY_TYPES[record.type].maxHealth;
        record.direction.copy(record.spawnDirection);
      }
      const dot = record.direction.dot(playerDirection);
      if (dot >= minDot) candidates.push({ record, dot });
    }
    candidates.sort((a, b) => b.dot - a.dot);
  }
  const wanted = new Set(candidates.slice(0, MAX_ACTIVE).map(item => item.record.id));
  for (const id of system.active.keys()) if (!wanted.has(id)) removeVisual(system, id);
  for (const item of candidates.slice(0, MAX_ACTIVE)) {
    if (!system.active.has(item.record.id)) addVisual(system, item.record);
  }
  system.stats.active = system.active.size;
  system.stats.total = system.records.length;
}

function moveEnemy(record, visual, playerDirection, dt) {
  const type = ENEMY_TYPES[record.type];
  const tangent = playerDirection.clone().addScaledVector(record.direction, -playerDirection.dot(record.direction));
  if (tangent.lengthSq() < .000001) return;
  tangent.normalize();
  const next = record.direction.clone().addScaledVector(tangent, type.speed * dt / PLANET_RADIUS).normalize();
  const nextGround = terrainRadius(next);
  const currentGround = terrainRadius(record.direction);
  if (nextGround <= SEA_RADIUS + 1.2 || nextGround > currentGround + 3.2) return;
  record.direction.copy(next);
  visual.root.position.copy(surfacePoint(record.direction, .04));
  visual.root.quaternion.setFromUnitVectors(UP, record.direction);
  const localHeading = tangent.applyQuaternion(visual.root.quaternion.clone().invert());
  visual.body.rotation.y = Math.atan2(localHeading.x, localHeading.z);
}

export function updateEnemySystem(system, player, playerDirection, dt, now, enabled) {
  system.streamElapsed += dt;
  if (system.streamElapsed >= STREAM_INTERVAL) {
    streamEnemies(system, playerDirection, now, enabled);
    system.streamElapsed = 0;
  }
  const events = [];
  if (!enabled) {
    system.nearest = null;
    system.stats.alerted = 0;
    return events;
  }
  const playerPosition = surfacePoint(playerDirection);
  let closest = null;
  let closestDistance = Infinity;
  let alerted = 0;
  for (const [id, visual] of system.active) {
    const record = system.recordsById.get(id);
    if (!record) continue;
    const type = ENEMY_TYPES[record.type];
    const distance = visual.root.position.distanceTo(playerPosition);
    if (distance < type.aggroRange) record.alerted = true;
    if (distance > type.disengageRange) record.alerted = false;
    if (record.alerted) {
      alerted++;
      if (distance > type.attackRange * .8) moveEnemy(record, visual, playerDirection, dt);
      if (distance < type.attackRange && now >= record.nextAttackAt) {
        record.nextAttackAt = now + type.attackCooldown;
        const amount = damagePlayer(player, type.attackDamage, now);
        if (amount > 0) events.push({ type: 'playerHit', amount, enemy: record });
      }
    }
    visual.body.position.y = Math.sin(now * 4.2 + record.phase) * .045;
    const resource = system.resources.get(record.type);
    visual.body.material = now < record.hitUntil ? resource.hitMaterial : resource.material;
    if (distance < closestDistance) { closest = record; closestDistance = distance; }
  }
  system.stats.alerted = alerted;
  system.nearest = closestDistance < 28 ? { record: closest, distance: closestDistance } : null;

  if (player.health > 0 && now >= player.nextAttackAt) {
    let target = null;
    let best = PLAYER_RULES.attackRange;
    for (const [id, visual] of system.active) {
      const distance = visual.root.position.distanceTo(playerPosition);
      if (distance < best) { target = system.recordsById.get(id); best = distance; }
    }
    if (target) {
      player.nextAttackAt = now + PLAYER_RULES.attackCooldown;
      target.health = Math.max(0, target.health - playerAttackDamage(player));
      target.hitUntil = now + .18;
      events.push({ type: 'playerAttack', enemy: target, amount: playerAttackDamage(player) });
      if (target.health === 0) {
        const deathDirection = { x: target.direction.x, y: target.direction.y, z: target.direction.z };
        target.deadUntil = now + 75;
        target.direction.copy(target.spawnDirection);
        target.alerted = false;
        removeVisual(system, target.id);
        player.kills++;
        const loot = ENEMY_TYPES[target.type].loot;
        events.push({ type: 'enemyKilled', enemy: target, loot, direction: deathDirection });
      }
    }
  }
  return events;
}

export function resetEnemyAggro(system) {
  for (const record of system.records) record.alerted = false;
}

export function disposeEnemySystem(system) {
  system.group.clear();
  for (const resource of system.resources.values()) {
    resource.geometry.dispose();
    resource.material.dispose();
    resource.hitMaterial.dispose();
  }
}
