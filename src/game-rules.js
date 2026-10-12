import { ITEMS } from './items.js';
import { addItem, useItem } from './inventory.js';

export { ITEMS } from './items.js';
export { addItem, countItem } from './inventory.js';

export const ENEMY_TYPES = Object.freeze({
  ember: {
    name: '余烬方块怪', maxHealth: 48, speed: 2.05,
    aggroRange: 14, disengageRange: 24, attackRange: 1.9,
    attackDamage: 10, attackCooldown: 1.45, loot: { id: 'crystal', quantity: 1 },
    spawnWeight: 1,
    visual: { body: '#803f46', head: '#9d5157', eyes: '#ffe1a3', feet: '#493038', arms: '#703740' },
  },
});

export const PLAYER_RULES = Object.freeze({
  maxHealth: 100, baseAttack: 8, attackRange: 3.25,
  attackCooldown: .72, respawnProtection: 3,
});

export function createPlayerState() {
  return {
    health: PLAYER_RULES.maxHealth,
    maxHealth: PLAYER_RULES.maxHealth,
    equipment: { weapon: 'wood_sword', armor: 'cloth_vest' },
    inventory: [{ id: 'berry', quantity: 3 }],
    nextAttackAt: 0,
    invulnerableUntil: 0,
    kills: 0,
    deaths: 0,
  };
}

export function useBerry(player) {
  return useItem(player, 'berry');
}

export function playerAttackDamage(player) {
  return PLAYER_RULES.baseAttack + (ITEMS[player.equipment.weapon]?.attack ?? 0);
}

export function damagePlayer(player, rawDamage, now) {
  if (now < player.invulnerableUntil || player.health <= 0) return 0;
  const damage = Math.max(1, rawDamage - (ITEMS[player.equipment.armor]?.defense ?? 0));
  player.health = Math.max(0, player.health - damage);
  return damage;
}

export function createDeathDrop(player, direction, id) {
  const equipment = { ...player.equipment };
  const inventory = player.inventory.map(item => ({ ...item }));
  player.equipment = { weapon: null, armor: null };
  player.inventory = [];
  player.deaths++;
  if (!equipment.weapon && !equipment.armor && inventory.length === 0) return null;
  return { id, direction: { x: direction.x, y: direction.y, z: direction.z }, equipment, inventory };
}

export function recoverDeathDrop(player, drop) {
  let recovered = 0;
  for (const slot of ['weapon', 'armor']) {
    const item = drop.equipment[slot];
    if (!item) continue;
    if (!player.equipment[slot]) {
      player.equipment[slot] = item;
      drop.equipment[slot] = null;
      recovered++;
    } else if (addItem(player, item, 1).remaining === 0) {
      drop.equipment[slot] = null;
      recovered++;
    }
  }
  for (const stack of drop.inventory) {
    const result = addItem(player, stack.id, stack.quantity);
    stack.quantity = result.remaining;
    recovered += result.added;
  }
  drop.inventory = drop.inventory.filter(stack => stack.quantity > 0);
  const empty = !drop.equipment.weapon && !drop.equipment.armor && drop.inventory.length === 0;
  return { recovered, empty };
}

export function respawnPlayer(player, now) {
  player.health = player.maxHealth;
  player.nextAttackAt = now + 1;
  player.invulnerableUntil = now + PLAYER_RULES.respawnProtection;
}
