import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLANET_RADIUS, SEA_RADIUS, terrainRadius } from '../src/planet-height.js';
import { START_DIRECTION } from '../src/world.js';
import { createEnemySystem, generateEnemySpawns, updateEnemySystem, disposeEnemySystem } from '../src/enemy-system.js';
import { createPlayerState, createDeathDrop, respawnPlayer, recoverDeathDrop, countItem, damagePlayer } from '../src/game-rules.js';
import { loadGame, saveGame } from '../src/save-game.js';
import { createLootSystem, addDeathDrop, removeDeathDrop, closestDeathDrop, disposeLootSystem } from '../src/loot-system.js';
import { addItem, equipItem, unequipItem, useItem, dropItem, BACKPACK_SLOTS } from '../src/inventory.js';
import { createItemWorld, addGroundItem, closestGroundItem, removeGroundItem, disposeItemWorld } from '../src/item-world.js';

test('enemy spawns are stable, distributed over land, and keep the respawn point clear', () => {
  const first = generateEnemySpawns();
  const second = generateEnemySpawns();
  assert.ok(first.length > 300);
  assert.deepEqual(first.map(record => record.id), second.map(record => record.id));
  for (const record of first) {
    assert.ok(terrainRadius(record.direction) > SEA_RADIUS + 3.2);
    assert.ok(record.direction.distanceTo(START_DIRECTION) * PLANET_RADIUS >= 13);
  }
  assert.ok(new Set(first.map(record => Math.sign(record.direction.x))).size === 2);
  assert.ok(new Set(first.map(record => Math.sign(record.direction.y))).size === 2);
});

test('nearby enemy attacks and player automatically defeats it, leaving pickup loot', () => {
  const system = createEnemySystem(new THREE.Scene());
  const target = system.records[0];
  const player = createPlayerState();
  const events = [];
  for (let tick = 0; tick < 80; tick++) {
    events.push(...updateEnemySystem(system, player, target.direction, .05, tick * .05, true));
    if (player.kills) break;
  }
  assert.ok(events.some(event => event.type === 'playerHit'));
  assert.ok(events.some(event => event.type === 'playerAttack'));
  assert.ok(events.some(event => event.type === 'enemyKilled'));
  assert.ok(player.health < player.maxHealth);
  const killed = events.find(event => event.type === 'enemyKilled');
  const items = createItemWorld(new THREE.Scene());
  addGroundItem(items, { id: 1, itemId: killed.loot.id, quantity: killed.loot.quantity, direction: killed.direction });
  assert.ok(closestGroundItem(items, target.spawnDirection));
  const pickup = closestGroundItem(items, target.spawnDirection);
  assert.equal(addItem(player, pickup.drop.itemId, pickup.drop.quantity).remaining, 0);
  removeGroundItem(items, pickup.drop.id);
  assert.equal(countItem(player, 'crystal'), 1);
  disposeItemWorld(items);
  disposeEnemySystem(system);
});

test('backpack stacks items, enforces slots, and supports equip, consume, and drop', () => {
  const player = createPlayerState();
  assert.equal(unequipItem(player, 'weapon'), true);
  assert.equal(countItem(player, 'wood_sword'), 1);
  assert.equal(addItem(player, 'stone_sword').added, 1);
  assert.equal(equipItem(player, 'stone_sword'), true);
  assert.equal(player.equipment.weapon, 'stone_sword');
  player.health = 50;
  assert.equal(useItem(player, 'berry'), true);
  assert.equal(player.health, 75);
  assert.deepEqual(dropItem(player, 'berry', 1), { id: 'berry', quantity: 1 });
  assert.equal(countItem(player, 'berry'), 1);
  assert.equal(addItem(player, 'crystal', 120).remaining, 0);
  assert.equal(countItem(player, 'crystal'), 120);
  const full = { inventory: [] };
  assert.equal(addItem(full, 'wood_sword', BACKPACK_SLOTS).added, BACKPACK_SLOTS);
  assert.equal(addItem(full, 'berry', 1).remaining, 1);
});

test('an enemy inside its alert radius pursues the player across the sphere', () => {
  const system = createEnemySystem(new THREE.Scene());
  const record = system.records.find(item => {
    if (terrainRadius(item.direction) < SEA_RADIUS + 16) return false;
    const tangent = new THREE.Vector3(0, 1, 0).addScaledVector(item.direction, -item.direction.y).normalize();
    const ahead = item.direction.clone().addScaledVector(tangent, 9 / PLANET_RADIUS).normalize();
    return terrainRadius(ahead) > SEA_RADIUS + 10;
  });
  const tangent = new THREE.Vector3(0, 1, 0).addScaledVector(record.direction, -record.direction.y).normalize();
  const playerDirection = record.direction.clone().addScaledVector(tangent, 9 / PLANET_RADIUS).normalize();
  const initial = record.direction.distanceTo(playerDirection);
  const player = createPlayerState();
  for (let tick = 0; tick < 20; tick++) updateEnemySystem(system, player, playerDirection, .05, tick * .05, true);
  assert.equal(record.alerted, true);
  assert.ok(record.direction.distanceTo(playerDirection) < initial);
  disposeEnemySystem(system);
});

test('death moves every carried item to a recoverable drop, including after reload', () => {
  const player = createPlayerState();
  player.inventory.push({ id: 'crystal', quantity: 4 });
  for (let now = 1; player.health > 0; now++) damagePlayer(player, 30, now);
  const drop = createDeathDrop(player, START_DIRECTION, 7);
  respawnPlayer(player, 100);
  assert.equal(player.health, 100);
  assert.equal(player.equipment.weapon, null);
  assert.equal(player.equipment.armor, null);
  assert.equal(player.inventory.length, 0);
  assert.equal(drop.equipment.weapon, 'wood_sword');
  assert.equal(drop.inventory.find(item => item.id === 'crystal').quantity, 4);

  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const ground = [{ id: 3, itemId: 'crystal', quantity: 2, direction: { ...START_DIRECTION } }];
  assert.equal(saveGame(storage, player, START_DIRECTION, [drop], 8, ground, 4), true);
  const saved = loadGame(storage);
  assert.equal(saved.drops.length, 1);
  assert.equal(saved.nextDropId, 8);
  assert.equal(saved.groundItems[0].quantity, 2);
  assert.equal(saved.nextItemDropId, 4);
  const key = [...values.keys()][0];
  const legacy = JSON.parse(values.get(key));
  legacy.version = 1;
  delete legacy.groundItems;
  values.set(key, JSON.stringify(legacy));
  assert.deepEqual(loadGame(storage).groundItems, []);
  recoverDeathDrop(player, saved.drops[0]);
  assert.equal(player.equipment.weapon, 'wood_sword');
  assert.equal(player.equipment.armor, 'cloth_vest');
  assert.equal(countItem(player, 'berry'), 3);
  assert.equal(countItem(player, 'crystal'), 4);
});

test('recovering a death drop never discards items when the backpack is full', () => {
  const player = createPlayerState();
  player.inventory = [];
  addItem(player, 'wood_sword', BACKPACK_SLOTS);
  const drop = {
    equipment: { weapon: 'stone_sword', armor: 'cloth_vest' },
    inventory: [{ id: 'berry', quantity: 5 }],
  };
  const first = recoverDeathDrop(player, drop);
  assert.equal(first.empty, false);
  assert.equal(drop.inventory[0].quantity, 5);
  assert.equal(drop.equipment.weapon, 'stone_sword');
  assert.equal(countItem(player, 'berry'), 0);
  player.inventory = [];
  const second = recoverDeathDrop(player, drop);
  assert.equal(second.empty, true);
  assert.equal(countItem(player, 'berry'), 5);
  assert.equal(countItem(player, 'stone_sword'), 1);
});

test('multiple death drops keep their original locations until individually recovered', () => {
  const system = createLootSystem(new THREE.Scene());
  const north = new THREE.Vector3(.04, 0, 1).normalize();
  const far = new THREE.Vector3(-.4, .1, .91).normalize();
  addDeathDrop(system, { id: 1, direction: { ...north }, equipment: {}, inventory: [] });
  addDeathDrop(system, { id: 2, direction: { ...far }, equipment: {}, inventory: [] });
  assert.equal(closestDeathDrop(system, north).drop.id, 1);
  assert.ok(closestDeathDrop(system, north).distance < .1);
  removeDeathDrop(system, 1);
  assert.equal(closestDeathDrop(system, north).drop.id, 2);
  disposeLootSystem(system);
});
