import { ITEMS } from './items.js';
import { BACKPACK_SLOTS, countItem, dropItem, equipItem, unequipItem, useItem } from './inventory.js';

const KIND_NAMES = { weapon: '武器', armor: '护甲', consumable: '消耗品', material: '材料' };

export function createInventoryUI(host, player, { onChange, onDrop, onMessage }) {
  const overlay = document.createElement('div');
  overlay.id = 'backpackOverlay';
  overlay.className = 'backpack-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="backpack-panel" role="dialog" aria-modal="true" aria-label="角色背包">
      <div class="backpack-header"><div><small>ADVENTURER'S PACK</small><h2>背包与装备</h2></div><button type="button" data-action="close" aria-label="关闭背包">×</button></div>
      <div class="backpack-content">
        <div class="backpack-main">
          <div class="backpack-subhead"><strong>装备</strong><span>点击查看或卸下</span></div>
          <div class="equipment-slots" id="equipmentSlots"></div>
          <div class="backpack-subhead"><strong>物品</strong><span id="slotCount">0 / ${BACKPACK_SLOTS} 格</span></div>
          <div class="item-grid" id="itemGrid"></div>
        </div>
        <div class="item-details" id="itemDetails"><p>选择一件装备或道具，查看效果与操作。</p></div>
      </div>
      <div class="backpack-footer">左手举起关闭 · 右手指向并捏合选择 · 靠近地面物品后握拳拾取</div>
    </div>`;
  host.appendChild(overlay);
  let selected = null;

  function selectedItem() {
    if (!selected) return null;
    if (selected.source === 'equipment') {
      const id = player.equipment[selected.slot];
      return id ? { id, quantity: 1, source: 'equipment', slot: selected.slot } : null;
    }
    const quantity = countItem(player, selected.id);
    return quantity ? { id: selected.id, quantity, source: 'bag' } : null;
  }

  function render() {
    const equipment = overlay.querySelector('#equipmentSlots');
    equipment.innerHTML = ['weapon', 'armor'].map(slot => {
      const id = player.equipment[slot];
      const item = ITEMS[id];
      const active = selected?.source === 'equipment' && selected.slot === slot ? ' selected' : '';
      return `<button type="button" class="equipment-slot${active}" data-slot="${slot}">
        <span class="slot-icon" style="color:${item?.color ?? '#aeb5ac'}">${item?.icon ?? '＋'}</span>
        <span><small>${slot === 'weapon' ? '武器' : '护甲'}</small><strong>${item?.name ?? '空'}</strong></span>
      </button>`;
    }).join('');
    overlay.querySelector('#slotCount').textContent = `${player.inventory.length} / ${BACKPACK_SLOTS} 格`;
    const grid = overlay.querySelector('#itemGrid');
    const slots = [];
    for (let index = 0; index < BACKPACK_SLOTS; index++) {
      const stack = player.inventory[index];
      if (!stack) { slots.push('<div class="item-slot empty" aria-hidden="true"></div>'); continue; }
      const item = ITEMS[stack.id];
      const active = selected?.source === 'bag' && selected.id === stack.id ? ' selected' : '';
      slots.push(`<button type="button" class="item-slot${active}" data-item="${stack.id}" aria-label="${item.name} ${stack.quantity} 个">
        <span class="item-icon" style="color:${item.color}">${item.icon}</span><span class="item-quantity">${stack.quantity}</span>
      </button>`);
    }
    grid.innerHTML = slots.join('');
    const current = selectedItem();
    const details = overlay.querySelector('#itemDetails');
    if (!current) {
      selected = null;
      details.innerHTML = '<p>选择一件装备或道具，查看效果与操作。</p>';
      return;
    }
    const item = ITEMS[current.id];
    const stat = item.attack ? `攻击 +${item.attack}` : item.defense ? `防御 +${item.defense}`
      : item.effect?.type === 'heal' ? `恢复 ${item.effect.amount} 生命` : '合成材料';
    let actions = '';
    if (current.source === 'equipment') actions = '<button type="button" data-action="unequip">卸下装备</button>';
    else {
      if (item.kind === 'consumable') actions += '<button type="button" data-action="use">使用</button>';
      if (item.kind === 'weapon' || item.kind === 'armor') actions += '<button type="button" data-action="equip">装备</button>';
      actions += '<button type="button" data-action="drop">丢弃 1 个</button>';
    }
    details.innerHTML = `<div class="detail-icon" style="color:${item.color}">${item.icon}</div>
      <small>${KIND_NAMES[item.kind]} · ${item.rarity === 'uncommon' ? '精良' : '普通'}</small>
      <h3>${item.name}</h3><strong>${stat}</strong><p>${item.description}</p>
      <div class="detail-actions">${actions}</div>`;
  }

  function close() {
    overlay.hidden = true;
    selected = null;
  }
  function open() {
    overlay.hidden = false;
    render();
  }
  function toggle() { if (overlay.hidden) open(); else close(); }

  overlay.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) {
      if (event.target === overlay) close();
      return;
    }
    if (button.dataset.slot) selected = { source: 'equipment', slot: button.dataset.slot };
    else if (button.dataset.item) selected = { source: 'bag', id: button.dataset.item };
    else if (button.dataset.action === 'close') { close(); return; }
    else if (button.dataset.action) {
      const current = selectedItem();
      if (!current) return;
      const action = button.dataset.action;
      let changed = false;
      if (action === 'use') {
        changed = useItem(player, current.id);
        onMessage(changed ? `使用 ${ITEMS[current.id].name}` : '现在无法使用');
      } else if (action === 'equip') {
        changed = equipItem(player, current.id);
        onMessage(changed ? `已装备 ${ITEMS[current.id].name}` : '无法装备');
      } else if (action === 'unequip') {
        changed = unequipItem(player, current.slot);
        onMessage(changed ? `已卸下 ${ITEMS[current.id].name}` : '背包已满');
      } else if (action === 'drop') {
        const stack = dropItem(player, current.id, 1);
        changed = Boolean(stack);
        if (stack) onDrop(stack);
        onMessage(changed ? `已丢弃 ${ITEMS[current.id].name}` : '无法丢弃');
      }
      if (changed) onChange();
    }
    render();
  });

  return { open, close, toggle, render, get isOpen() { return !overlay.hidden; } };
}
