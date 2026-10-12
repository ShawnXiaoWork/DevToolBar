const definitions = {
  wood_sword: {
    name: '木剑', kind: 'weapon', icon: '⚔', color: '#d8a265', rarity: 'common', stackLimit: 1,
    attack: 12, description: '结实的入门武器。装备后提高自动攻击伤害。',
  },
  stone_sword: {
    name: '石剑', kind: 'weapon', icon: '⚔', color: '#b7c8c9', rarity: 'uncommon', stackLimit: 1,
    attack: 20, description: '锋利的石刃，适合应付较强的方块怪。',
  },
  cloth_vest: {
    name: '布甲', kind: 'armor', icon: '▣', color: '#8ba8b0', rarity: 'common', stackLimit: 1,
    defense: 2, description: '轻便的护甲，减少受到的伤害。',
  },
  berry: {
    name: '浆果', kind: 'consumable', icon: '●', color: '#e97d91', rarity: 'common', stackLimit: 20,
    effect: { type: 'heal', amount: 25 }, description: '食用后恢复 25 点生命。',
  },
  crystal: {
    name: '星晶', kind: 'material', icon: '✦', color: '#8adbea', rarity: 'uncommon', stackLimit: 99,
    description: '击败方块怪后获得的材料，为后续合成系统保留。',
  },
};

export const ITEMS = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([id, definition]) => [id, Object.freeze({ id, ...definition })]),
));

export function getItem(id) { return ITEMS[id] ?? null; }
