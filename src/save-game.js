import { ITEMS } from './items.js';
import { sanitizeInventory } from './inventory.js';
import { PLAYER_RULES } from './game-rules.js';

const STORAGE_KEY = 'voxel-planet-save-v1';

function validDirection(value) {
  return value && ['x', 'y', 'z'].every(axis => Number.isFinite(value[axis]))
    && Math.hypot(value.x, value.y, value.z) > .9;
}

function validEquipment(value) {
  return {
    weapon: ITEMS[value?.weapon]?.kind === 'weapon' ? value.weapon : null,
    armor: ITEMS[value?.armor]?.kind === 'armor' ? value.armor : null,
  };
}

export function loadGame(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (![1, 2].includes(saved.version) || !validDirection(saved.direction)) return null;
    const player = saved.player ?? {};
    return {
      player: {
        health: Math.max(1, Math.min(PLAYER_RULES.maxHealth, Math.floor(Number(player.health) || PLAYER_RULES.maxHealth))),
        equipment: validEquipment(player.equipment),
        inventory: sanitizeInventory(player.inventory),
        kills: Math.max(0, Math.floor(Number(player.kills) || 0)),
        deaths: Math.max(0, Math.floor(Number(player.deaths) || 0)),
      },
      direction: saved.direction,
      drops: Array.isArray(saved.drops) ? saved.drops.filter(drop =>
        Number.isInteger(drop.id) && validDirection(drop.direction)).map(drop => ({
        id: drop.id, direction: drop.direction,
        equipment: validEquipment(drop.equipment), inventory: sanitizeInventory(drop.inventory),
      })) : [],
      nextDropId: Math.max(1, Math.floor(Number(saved.nextDropId) || 1)),
      groundItems: Array.isArray(saved.groundItems) ? saved.groundItems.filter(drop =>
        Number.isInteger(drop.id) && ITEMS[drop.itemId] && Number.isInteger(drop.quantity)
        && drop.quantity > 0 && validDirection(drop.direction)).map(drop => ({
        id: drop.id, itemId: drop.itemId, quantity: Math.min(drop.quantity, 999),
        direction: drop.direction,
      })) : [],
      nextItemDropId: Math.max(1, Math.floor(Number(saved.nextItemDropId) || 1)),
    };
  } catch {
    return null;
  }
}

export function saveGame(storage, player, direction, drops, nextDropId, groundItems = [], nextItemDropId = 1) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      player: {
        health: player.health, equipment: player.equipment,
        inventory: player.inventory, kills: player.kills, deaths: player.deaths,
      },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      drops: [...drops], nextDropId,
      groundItems: [...groundItems], nextItemDropId,
    }));
    return true;
  } catch {
    return false;
  }
}
