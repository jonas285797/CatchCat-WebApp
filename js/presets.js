export const ENERGY_TYPES = [
  { id: 'food', label: '干饭', emoji: '🐟', orb: ['#ffb636', '#f47b1c'], base: ['#ffe852', '#f7b922', '#df8e0b'], bright: true, ink: '#14171c' },
  { id: 'swift', label: '疾风', emoji: '⚡', orb: ['#3fe0a8', '#15986d'], base: ['#4de896', '#21b66c', '#0e7844'], bright: true, ink: '#0d1912' },
  { id: 'brawl', label: '念斗', emoji: '🥊', orb: ['#a76bff', '#5b28c4'], base: ['#b573fb', '#7a33d8', '#4d1a99'], bright: false, ink: '#f2f5fb' },
  { id: 'charm', label: '魅惑', emoji: '✨', orb: ['#ff7ebb', '#d83b84'], base: ['#ff96c8', '#ec4796', '#b81d6d'], bright: true, ink: '#260818' },
  { id: 'dark', label: '夜行', emoji: '🌙', orb: ['#63519e', '#26184a'], base: ['#3b2561', '#22153c', '#120b22'], bright: false, ink: '#f2f5fb' },
  { id: 'normal', label: '百变', emoji: '🐾', orb: ['#e4e8f0', '#9ea9bd'], base: ['#f5f7fa', '#dbe0ea', '#b6bfd0'], bright: true, ink: '#14171c' }
];

export const BORDER_PRESETS = [
  { id: 'auto', name: '智能随性', desc: '跟随属性自动匹配', grad: ['#ffe97a', '#d7a832'], rim: '#e4bd46' },
  { id: 'classicGold', name: '经典流金', desc: 'TCG 元祖暖金雕边', grad: ['#fff085', '#e4b228', '#c68d16'], rim: '#e7b93a' },
  { id: 'platinumEx', name: '银白钻铬', desc: '高罕镀铬金属白金', grad: ['#ffffff', '#bfc7d5', '#8b95a8'], rim: '#d8dee8' },
  { id: 'blackObsidian', name: '黑金曜石', desc: '暗黑奢华双金细线', grad: ['#2d313d', '#151820', '#0a0c11'], rim: '#242732', innerGold: true },
  { id: 'roseGold', name: '玫瑰樱金', desc: '柔和金属暖粉铜边', grad: ['#ffd2c9', '#d7847d', '#a95854'], rim: '#e49891' },
  { id: 'prismaticRainbow', name: '幻彩极光', desc: '七彩 HR 折射棱框', grad: ['#5be9ff', '#f76de0', '#ffe455', '#4df0a4'], rim: '#8cd3ff' },
  { id: 'bronzeVintage', name: '复古青铜', desc: '古董铜鎏立体压边', grad: ['#cc955c', '#7a4f28', '#523117'], rim: '#a8703b', innerGold: true }
];

export const BACKGROUND_PRESETS = [
  { id: 'auto', name: '智能场景', desc: '按主子属性配景', colors: ['#187be0', '#f7b922', '#fff080'], glyph: '✨', bright: true },
  { id: 'sunburstArena', name: '烈日光环', desc: '金橙放射斗技光芒', colors: ['#1674e0', '#ffc42b', '#fff494'], glyph: '☀', bright: true },
  { id: 'emeraldForest', name: '翠林秘境', desc: '晨雾竹影草木光晕', colors: ['#0d4239', '#11ac7b', '#a8f282'], glyph: '🌿', bright: true },
  { id: 'cosmosNebula', name: '星云深空', desc: '银河紫蓝轨道星幕', colors: ['#120b3d', '#5c24c2', '#2dc6f5'], glyph: '🪐', bright: false },
  { id: 'sakuraPastel', name: '春樱粉梦', desc: '奶油粉黛落樱氛围', colors: ['#ffd5e6', '#fa93bf', '#db6ebb'], glyph: '🌸', bright: true },
  { id: 'flameCanyon', name: '炎狱熔岩', desc: '赤红火星炽烈舞台', colors: ['#3b080d', '#cf2b15', '#ffab28'], glyph: '🔥', bright: false },
  { id: 'frozenCrystal', name: '冰晶雪域', desc: '凛冬棱冰折射寒光', colors: ['#1d59ad', '#54d0f5', '#ddf8ff'], glyph: '❄', bright: true },
  { id: 'obsidianStudio', name: '极简暗棚', desc: '棚拍聚光突出毛色', colors: ['#12141a', '#242936', '#101218'], glyph: '◐', bright: false }
];

export const FX_PRESETS = [
  { id: 'auto', name: '智能自适应', desc: '随宠位自动择优', icon: '🪄' },
  { id: 'lightningSurge', name: '狂暴雷电', desc: '金色高频闪电脉冲', icon: '⚡' },
  { id: 'psychicOrbit', name: '念力星轨', desc: '霓虹双环飘带光束', icon: '🪩' },
  { id: 'speedBlades', name: '疾风斩刃', desc: '青绿切风弧形刃芒', icon: '🌀' },
  { id: 'rainbowSparkles', name: '彩虹四芒', desc: '琉璃碎钻十字星雨', icon: '✦' },
  { id: 'crackedIce', name: '碎冰晶箔', desc: '多面菱形碎片折射', icon: '💎' },
  { id: 'cosmosSwirl', name: '银河涡箔', desc: '同心星环涡旋闪箔', icon: '🌌' },
  { id: 'none', name: '纯净无遮', desc: '只留主子与底层光泽', icon: '◎' }
];

export const BADGE_PRESETS = [
  { id: 'auto', name: '原章', symbol: '★' },
  { id: 'bolt', name: '闪电', symbol: '⚡' },
  { id: 'crown', name: '王冠', symbol: '♛' },
  { id: 'fish', name: '小鱼', symbol: '🐟' },
  { id: 'flame', name: '烈焰', symbol: '🔥' },
  { id: 'moon', name: '星月', symbol: '🌙' },
  { id: 'paw', name: '肉垫', symbol: '🐾' },
  { id: 'diamond', name: '晶钻', symbol: '◆' },
  { id: 'heart', name: '甜心', symbol: '♥' },
  { id: 'shield', name: '盾甲', symbol: '🛡' }
];

export function resolveAdaptiveFX(card) {
  const ox = Number(card.subjectOffsetX || 0);
  const oy = Number(card.subjectOffsetY || 0);
  const sc = Number(card.subjectScale || 1);

  if (sc >= 1.24) {
    return { zone: 'closeupBurst', title: '四角全景星爆', hint: '特写放大构图 · 特效自动外扩至四角避让脸部' };
  }
  if (ox <= -0.09) {
    return { zone: 'rightSurge', title: '右翼超频破空', hint: '主子偏左占位 · 右侧自动补强高能流光' };
  }
  if (ox >= 0.09) {
    return { zone: 'leftSurge', title: '左翼狂涌电光', hint: '主子偏右占位 · 左侧自动展开平衡能量弧光' };
  }
  if (oy <= -0.09) {
    return { zone: 'groundWave', title: '贴地聚能基座', hint: '主子高位靠顶 · 特效下沉底部托起整体重心' };
  }
  if (oy >= 0.09) {
    return { zone: 'orbitCrown', title: '头顶星环光冠', hint: '主子低位留白 · 顶部自动亮起炫彩星轨光环' };
  }
  return { zone: 'centerApex', title: '黄金居中星阵', hint: '标准黄金比例 · 全卡立体光学折射已启用' };
}

export const SAMPLE_CARDS = [
  {
    id: 'sample-orange-ex',
    serialNumber: '001/165 ★',
    stage: '猫中霸王',
    name: '大橘',
    customNickname: '',
    suffix: 'ex',
    hp: 280,
    energyType: 'food',
    breedName: '中华橘猫',
    coatPattern: '金被银床',
    abilityName: '大橘为重',
    abilityDesc: '受到的饥饿与普通撞击伤害固定减少 30 点。',
    attackName: '吨位泰山压顶',
    attackDamage: 180,
    flavorText: '常年盘踞地下车库 5 号柱旁，拥有把整只猫摊成大饼的神技。',
    locationName: 'CatchCat 示范馆',
    cutoutSrc: 'assets/cat-orange.png',
    borderStyle: 'blackObsidian',
    backgroundStyle: 'cosmosNebula',
    fxPreset: 'crackedIce',
    badgeIcon: 'crown',
    foilIntensity: 1.15,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: true,
    createdAt: 1764100000000
  },
  {
    id: 'sample-lihua-ex',
    serialNumber: '024/165 ★',
    stage: '疾风侠客',
    name: '中华狸花',
    customNickname: '',
    suffix: 'ex',
    hp: 240,
    energyType: 'swift',
    breedName: '中华狸花猫',
    coatPattern: '铁尺鱼骨',
    abilityName: '暗影巡逻',
    abilityDesc: '免疫任何负面状态，敏捷回避率翻倍。',
    attackName: '草丛飞扑斩',
    attackDamage: 160,
    flavorText: '眼神锐利、花纹清晰，被国际爱猫界认证的东方自然猫王。',
    locationName: 'CatchCat 示范馆',
    cutoutSrc: 'assets/cat-lihua.png',
    borderStyle: 'platinumEx',
    backgroundStyle: 'emeraldForest',
    fxPreset: 'speedBlades',
    badgeIcon: 'bolt',
    foilIntensity: 1.05,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: true,
    createdAt: 1764090000000
  },
  {
    id: 'sample-cow-ex',
    serialNumber: '068/165 ★',
    stage: '霓虹超梦',
    name: '奶牛猫',
    customNickname: '',
    suffix: 'ex',
    hp: 220,
    energyType: 'brawl',
    breedName: '奶牛猫',
    coatPattern: '乌云盖雪',
    abilityName: '神经二哈',
    abilityDesc: '夜里三点自动满血进入客厅跑酷狂暴模式。',
    attackName: '垂直墙头跑酷',
    attackDamage: 150,
    flavorText: '背黑如墨、四蹄踏雪，专注在防盗窗表演无重力倒立。',
    locationName: 'CatchCat 示范馆',
    cutoutSrc: 'assets/cat-cow.png',
    borderStyle: 'prismaticRainbow',
    backgroundStyle: 'obsidianStudio',
    fxPreset: 'psychicOrbit',
    badgeIcon: 'moon',
    foilIntensity: 1.2,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: false,
    createdAt: 1764080000000
  },
  {
    id: 'sample-shades-vstar',
    serialNumber: '099/165 ★',
    stage: '复古教父',
    name: '墨镜蓝虎斑',
    customNickname: '',
    suffix: 'VSTAR',
    hp: 290,
    energyType: 'dark',
    breedName: '苏格兰折耳',
    coatPattern: '烟灰琥珀',
    abilityName: '冷酷墨镜',
    abilityDesc: '无论场上有多少罐头，始终保持高冷不眨眼。',
    attackName: '琥珀射线凝视',
    attackDamage: 210,
    flavorText: '戴上复古圆框琥珀墨镜之后，连胡须都带着贵族气息。',
    locationName: 'CatchCat 示范馆',
    cutoutSrc: 'assets/cat-shades.png',
    borderStyle: 'classicGold',
    backgroundStyle: 'flameCanyon',
    fxPreset: 'cosmosSwirl',
    badgeIcon: 'diamond',
    foilIntensity: 1.25,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: false,
    createdAt: 1764070000000
  }
];

export const CAT_SNACKS = [
  { id: 'fish', name: '深海小鱼干', img: 'assets/snacks/snack_fish.png', tag: 'HP+10', hpBonus: 10, exBoost: 5, tone: 'amber' },
  { id: 'freeze_meat', name: '纯肉冻干', img: 'assets/snacks/snack_freeze_meat.png', tag: 'HP+15', hpBonus: 15, exBoost: 8, tone: 'coral' },
  { id: 'puree', name: '鲜肉猫条', img: 'assets/snacks/snack_puree.png', tag: 'ex↑', hpBonus: 10, exBoost: 15, tone: 'rose' },
  { id: 'catnip', name: '天然猫薄荷', img: 'assets/snacks/snack_catnip.png', tag: 'HP+20', hpBonus: 20, exBoost: 10, tone: 'jade' }
];

export const DOG_SNACKS = [
  { id: 'bone', name: '原味大骨棒', img: 'assets/snacks/snack_bone.png', tag: 'HP+15', hpBonus: 15, exBoost: 6, tone: 'amber' },
  { id: 'beef_jerky', name: '纯牛肉干', img: 'assets/snacks/snack_beef_jerky.png', tag: 'ex↑', hpBonus: 10, exBoost: 14, tone: 'rose' },
  { id: 'cheese_roll', name: '芝士鸡肉卷', img: 'assets/snacks/snack_cheese_roll.png', tag: 'HP+20', hpBonus: 20, exBoost: 10, tone: 'amber' },
  { id: 'carrot', name: '香脆胡萝卜', img: 'assets/snacks/snack_carrot.png', tag: 'HP+10', hpBonus: 10, exBoost: 8, tone: 'jade' }
];

