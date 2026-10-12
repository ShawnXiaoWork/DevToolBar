import { ITEMS } from './items.js';

export const BACKPACK_SLOTS = 24;

export function countItem(player, id) {
  return player.inventory.filter(stack => stack.id === id)
    .reduce((total, stack) => total + stack.quantity, 0);
}

export function addItem(player, id, quantity = 1) {
  const item = ITEMS[id];
  if (!item || !Number.isInteger(quantity) || quantity < 1) return { added: 0, remaining: quantity };
  let remaining = quantity;
  for (const stack of player.inventory) {
    if (stack.id !== id || stack.quantity >= item.stackLimit) continue;
    const moved = Math.min(remaining, item.stackLimit - stack.quantity);
    stack.quantity += moved;
    remaining -= moved;
    if (!remaining) break;
  }
  while (remaining > 0 && player.inventory.length < BACKPACK_SLOTS) {
    const moved = Math.min(remaining, item.stackLimit);
    player.inventory.push({ id, quantity: moved });
    remaining -= moved;
  }
  return { added: quantity - remaining, remaining };
}

export function removeItem(player, id, quantity = 1) {
  let remaining = quantity;
  for (let index = player.inventory.length - 1; index >= 0 && remaining > 0; index--) {
    const stack = player.inventory[index];
    if (stack.id !== id) continue;
    const removed = Math.min(remaining, stack.quantity);
    stack.quantity -= removed;
    remaining -= removed;
    if (stack.quantity === 0) player.inventory.splice(index, 1);
  }
  return quantity - remaining;
}

export function equipItem(player, id) {
  const item = ITEMS[id];
  if (!item || !['weapon', 'armor'].includes(item.kind) || countItem(player, id) < 1) return false;
  const previous = player.equipment[item.kind];
  if (previous === id) return false;
  removeItem(player, id, 1);
  if (previous && addItem(player, previous, 1).remaining > 0) {
    addItem(player, id, 1);
    return false;
  }
  player.equipment[item.kind] = id;
  return true;
}

export function unequipItem(player, slot) {
  if (!['weapon', 'armor'].includes(slot)) return false;
  const id = player.equipment[slot];
  if (!id || addItem(player, id, 1).remaining > 0) return false;
  player.equipment[slot] = null;
  return true;
}

export function useItem(player, id) {
  const item = ITEMS[id];
  if (!item || item.kind !== 'consumable' || countItem(player, id) < 1 || player.health <= 0) return false;
  if (item.effect.type === 'heal') {
    if (player.health >= player.maxHealth) return false;
    player.health = Math.min(player.maxHealth, player.health + item.effect.amount);
  } else return false;
  removeItem(player, id, 1);
  return true;
}

export function dropItem(player, id, quantity = 1) {
  if (!ITEMS[id] || quantity < 1 || countItem(player, id) < quantity) return null;
  removeItem(player, id, quantity);
  return { id, quantity };
}

export function sanitizeInventory(value) {
  if (!Array.isArray(value)) return [];
  const player = { inventory: [] };
  for (const stack of value) {
    if (!ITEMS[stack?.id] || !Number.isInteger(stack.quantity) || stack.quantity < 1) continue;
    addItem(player, stack.id, Math.min(stack.quantity, 999));
  }
  return player.inventory;
}
