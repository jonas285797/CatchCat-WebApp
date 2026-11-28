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
  { id: 'auto', name: '智能随宠', desc: '按姿态气质自动贴合', colors: ['#187be0', '#f7b922', '#ff7ebb'], glyph: '✨', bright: true, mood: 'auto' },
  // 活泼动感 (energetic)
  { id: 'solarCelebration', name: '炽阳流金', desc: '盛典琥珀日光跃动射线', colors: ['#ff6a00', '#ffa726', '#fff29e'], glyph: '🌤', bright: true, mood: 'energetic' },
  { id: 'waveRiderCyan', name: '碧浪疾风', desc: '晴空波导疾速青蓝浪涌', colors: ['#0268d6', '#16b8f3', '#b8f4ff'], glyph: '🌊', bright: true, mood: 'energetic' },
  { id: 'emeraldGale', name: '翡翠风暴', desc: '疾风翠刃狂涌绿宝石旋涡', colors: ['#042f2a', '#09a87a', '#8affc1'], glyph: '🌪', bright: false, mood: 'energetic' },
  { id: 'sunburstArena', name: '烈日光环', desc: '金橙放射斗技光芒', colors: ['#1674e0', '#ffc42b', '#fff494'], glyph: '☀', bright: true, mood: 'energetic' },
  { id: 'rainbowPrismHolo', name: '彩虹流璃', desc: '七彩炫光菱晶折射星雨', colors: ['#ff6ec7', '#ffd644', '#49e5ff'], glyph: '🌈', bright: true, mood: 'energetic' },
  { id: 'flameCanyon', name: '炎狱熔岩', desc: '赤红火星炽烈舞台', colors: ['#3b080d', '#cf2b15', '#ffab28'], glyph: '🔥', bright: false, mood: 'energetic' },
  // 文静优雅 (serene)
  { id: 'silkChampagne', name: '丝绸暖昼', desc: '柔缎暖金流水涟漪氛围', colors: ['#fff5d9', '#f2cf88', '#d39a48'], glyph: '🪷', bright: true, mood: 'serene' },
  { id: 'sakuraPastel', name: '春樱粉梦', desc: '奶油粉黛落樱氛围', colors: ['#ffd5e6', '#fa93bf', '#db6ebb'], glyph: '🌸', bright: true, mood: 'serene' },
  { id: 'azurePaperGlow', name: '青金琉璃', desc: '皇家钴蓝金沙诗意典雅', colors: ['#0f2d70', '#1f57c3', '#80b5ff'], glyph: '💠', bright: false, mood: 'serene' },
  { id: 'frozenCrystal', name: '冰晶雪域', desc: '凛冬棱冰折射寒光', colors: ['#1d59ad', '#54d0f5', '#ddf8ff'], glyph: '❄', bright: true, mood: 'serene' },
  { id: 'emeraldForest', name: '翠林秘境', desc: '晨雾竹影草木光晕', colors: ['#0d4239', '#11ac7b', '#a8f282'], glyph: '🌿', bright: true, mood: 'serene' },
  // 高冷酷飒 (mystic)
  { id: 'cyberNeonViolet', name: '电光幻紫', desc: '霓虹紫品夜幕棱镜星流', colors: ['#15082e', '#6f22d2', '#ff47b8'], glyph: '⚡', bright: false, mood: 'mystic' },
  { id: 'abyssStarlight', name: '深渊星眸', desc: '午夜幽蓝双星轨道凝视', colors: ['#050a1f', '#143266', '#46d8ff'], glyph: '👁', bright: false, mood: 'mystic' },
  { id: 'cosmosNebula', name: '星云深空', desc: '银河紫蓝轨道星幕', colors: ['#120b3d', '#5c24c2', '#2dc6f5'], glyph: '🪐', bright: false, mood: 'mystic' },
  { id: 'obsidianStudio', name: '极简暗棚', desc: '轻烟雾霭聚光突出毛色', colors: ['#12141a', '#242936', '#101218'], glyph: '◐', bright: false, mood: 'mystic' }
];

export const PET_MOOD_PRESETS = [
  { id: 'auto', label: '智能识别', emoji: '✨', badge: '姿态+AI自动分析' },
  { id: 'energetic', label: '活泼好动', emoji: '⚡', badge: '适配炫彩动感场景' },
  { id: 'serene', label: '文静优雅', emoji: '🌸', badge: '适配柔光丝绸雅景' },
  { id: 'mystic', label: '高冷酷飒', emoji: '🌙', badge: '适配深邃霓虹夜幕' }
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

export const PERSONALITY_CHIPS = [
  '干饭粘人精',
  '高冷傲娇派',
  '精力永动机',
  '社牛小甜饼',
  '安静学霸汪',
  '温柔呼噜机'
];

export const HOBBY_CHIPS = [
  '晒太阳踩奶',
  '追逗猫棒',
  '极速叼飞盘',
  '钻纸箱观察',
  '翻肚皮撒娇',
  '守门等主人'
];

export const BREED_QUICK_PICKS = [
  { label: '边境牧羊犬', species: 'dog', coat: '黑白玄冠', energy: 'swift', hobby: '极速叼飞盘', personality: '眼神控场大师' },
  { label: '威尔士柯基犬', species: 'dog', coat: '金鞍伏地', energy: 'food', hobby: '蜜桃电臀跑', personality: '短腿小太阳' },
  { label: '金毛寻回犬', species: 'dog', coat: '流金碎玉', energy: 'food', hobby: '叼飞盘贴贴', personality: '暖心大暖男' },
  { label: '日本柴犬', species: 'dog', coat: '赤柴红云', energy: 'food', hobby: '傲娇歪头杀', personality: '表情包大师' },
  { label: '哈士奇(雪橇犬)', species: 'dog', coat: '黑白三把火', energy: 'swift', hobby: '雪地撒欢跑', personality: '脑洞永动机' },
  { label: '萨摩耶犬', species: 'dog', coat: '雪域白仙', energy: 'charm', hobby: '微笑大抱抱', personality: '治愈微笑团' },
  { label: '中华橘猫', species: 'cat', coat: '金被银床', energy: 'food', hobby: '翻肚皮晒太阳', personality: '干饭粘人精' },
  { label: '中华狸花猫', species: 'cat', coat: '铁尺鱼骨', energy: 'swift', hobby: '追逗猫棒飞跃', personality: '警觉酷行者' },
  { label: '奶牛猫', species: 'cat', coat: '乌云盖雪', energy: 'brawl', hobby: '客厅跑酷巡游', personality: '脑洞永动机' },
  { label: '布偶猫', species: 'cat', coat: '海豹双色开脸', energy: 'charm', hobby: '贴腿软呼噜', personality: '仙气柔骨团' },
  { label: '英短蓝猫', species: 'cat', coat: '雾霾丝绒蓝', energy: 'normal', hobby: '揣手晒午阳', personality: '敦厚绅士派' },
  { label: '三花猫', species: 'cat', coat: '三花锦绣', energy: 'charm', hobby: '暖被窝打盹', personality: '福气小甜饼' }
];

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
    personalityTag: '干饭粘人精',
    hobbyTag: '晒太阳踩奶',
    abilityName: '干饭粘人精',
    abilityDesc: '只要听见开罐头声就立刻闪现贴腿，最爱把肚皮摊在太阳下。',
    attackName: '圆肚皮晒太阳',
    attackDamage: 180,
    flavorText: '常年盘踞地下车库 5 号柱旁，拥有把整只猫摊成暖呼呼大饼的绝技。',
    locationName: '抓宠大作战 示范馆',
    cutoutSrc: 'assets/cat-orange.png',
    borderStyle: 'blackObsidian',
    backgroundStyle: 'solarCelebration',
    petMood: 'energetic',
    fxPreset: 'crackedIce',
    badgeIcon: 'crown',
    foilIntensity: 1.15,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: true,
    showBackQRCode: true,
    cardBackStyle: 'fullArtPet',
    cardBackOrientation: 'auto',
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
    personalityTag: '警觉酷行者',
    hobbyTag: '追逗猫棒',
    abilityName: '警觉酷行者',
    abilityDesc: '独立聪明又极有分寸感，习惯站在猫爬架最高层暗中观察。',
    attackName: '草丛飞扑抓球',
    attackDamage: 160,
    flavorText: '眼神锐利、花纹清晰，被国际爱猫界认证的东方自然猫王。',
    locationName: '抓宠大作战 示范馆',
    cutoutSrc: 'assets/cat-lihua.png',
    borderStyle: 'platinumEx',
    backgroundStyle: 'emeraldGale',
    petMood: 'energetic',
    fxPreset: 'speedBlades',
    badgeIcon: 'bolt',
    foilIntensity: 1.05,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: true,
    showBackQRCode: true,
    cardBackStyle: 'fullArtPet',
    cardBackOrientation: 'auto',
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
    personalityTag: '脑洞永动机',
    hobbyTag: '客厅夜间跑酷',
    abilityName: '脑洞永动机',
    abilityDesc: '精力充沛满脑奇思妙想，每天凌晨三点准时巡游全屋。',
    attackName: '垂直墙头跑酷',
    attackDamage: 150,
    flavorText: '背黑如墨、四蹄踏雪，专注在窗台与纸箱间表演搞笑特技。',
    locationName: '抓宠大作战 示范馆',
    cutoutSrc: 'assets/cat-cow.png',
    borderStyle: 'prismaticRainbow',
    backgroundStyle: 'cyberNeonViolet',
    petMood: 'mystic',
    fxPreset: 'psychicOrbit',
    badgeIcon: 'moon',
    foilIntensity: 1.2,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: false,
    showBackQRCode: true,
    cardBackStyle: 'fullArtPet',
    cardBackOrientation: 'auto',
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
    personalityTag: '高冷傲娇派',
    hobbyTag: '揣手晒午阳',
    abilityName: '高冷傲娇派',
    abilityDesc: '无论旁边有多少罐头晃过，始终墨镜一戴保持贵族淡定。',
    attackName: '琥珀墨镜歪头',
    attackDamage: 210,
    flavorText: '戴上复古圆框琥珀墨镜之后，连胡须都透着慵懒贵族气场。',
    locationName: '抓宠大作战 示范馆',
    cutoutSrc: 'assets/cat-shades.png',
    borderStyle: 'classicGold',
    backgroundStyle: 'abyssStarlight',
    petMood: 'mystic',
    fxPreset: 'cosmosSwirl',
    badgeIcon: 'diamond',
    foilIntensity: 1.25,
    subjectOffsetX: 0,
    subjectOffsetY: 0,
    subjectScale: 1.0,
    tnrClipped: false,
    showBackQRCode: true,
    cardBackStyle: 'fullArtPet',
    cardBackOrientation: 'auto',
    createdAt: 1764070000000
  }
];

export const BACK_STYLES = [
  { id: 'fullArtPet', name: '全幅萌宠（新）', desc: '极简炫彩底 + 全身放大萌宠' },
  { id: 'collectorOrb', name: '抓宠球徽章', desc: '经典双宠徽章球 + 纪念档案卡' }
];

export const BACK_ORIENTATIONS = [
  { id: 'auto', name: '智能识别' },
  { id: 'portrait', name: '立式竖版' },
  { id: 'landscape', name: '横向画幅' }
];

export const CAT_SNACKS = [
  { id: 'fish', name: '深海小鱼干', img: 'assets/snacks/snack_fish.png', tag: 'HP+10', hpBonus: 10, exBoost: 5, tone: 'amber' },
  { id: 'can', name: '鲜肉猫罐头', img: 'assets/snacks/snack_can.png', tag: 'HP+15', hpBonus: 15, exBoost: 8, tone: 'coral' },
  { id: 'puree', name: '鲜肉猫条', img: 'assets/snacks/snack_puree.png', tag: 'ex↑', hpBonus: 10, exBoost: 15, tone: 'rose' },
  { id: 'catnip', name: '天然猫薄荷', img: 'assets/snacks/snack_catnip.png', tag: 'HP+20', hpBonus: 20, exBoost: 10, tone: 'jade' }
];

export const DOG_SNACKS = [
  { id: 'bone', name: '原味大骨棒', img: 'assets/snacks/snack_bone.png', tag: 'HP+15', hpBonus: 15, exBoost: 6, tone: 'amber' },
  { id: 'beef_jerky', name: '纯牛肉干', img: 'assets/snacks/snack_beef_jerky.png', tag: 'ex↑', hpBonus: 10, exBoost: 14, tone: 'rose' },
  { id: 'cheese_roll', name: '芝士鸡肉卷', img: 'assets/snacks/snack_cheese_roll.png', tag: 'HP+20', hpBonus: 20, exBoost: 10, tone: 'amber' },
  { id: 'carrot', name: '香脆胡萝卜', img: 'assets/snacks/snack_carrot.png', tag: 'HP+10', hpBonus: 10, exBoost: 8, tone: 'jade' }
];

const ENERGETIC_KW = ['飞盘', '跑酷', '永动机', '奔', '跳', '飞扑', '冲刺', '太阳', '撒欢', '追', '闹', '皮', '电臀', '干饭', '边牧', '柯基', '哈士奇', '柴犬', '金毛', '橘猫', '狸花', '虎斑', '活泼', '好动', '顽皮', '好奇'];
const SERENE_KW = ['温柔', '呼噜', '晒午阳', '打盹', '安静', '恬静', '仙女', '绅士', '暖被窝', '发呆', '甜', '舒缓', '淑女', '睡觉', '守门', '贴贴', '学霸', '沉稳', '布偶', '银渐层', '金渐层', '蓝猫', '折耳', '狮子猫', '萨摩耶', '比熊', '龙猫', '文静', '优雅', '呆萌'];
const MYSTIC_KW = ['高冷', '傲娇', '暗影', '夜瞳', '保镖', '神秘', '侦探', '独行', '教父', '墨镜', '酷', '玄猫', '黑猫', '暹罗', '无毛', '德文', '霸总'];

export function inferPetMoodProfile(input = {}, trimMetrics = null) {
  const explicitMood = input.petMood;
  if (explicitMood === 'energetic' || explicitMood === 'serene' || explicitMood === 'mystic') {
    const preset = PET_MOOD_PRESETS.find((m) => m.id === explicitMood) || PET_MOOD_PRESETS[1];
    return { mood: explicitMood, label: preset.label, reason: preset.badge, explicit: true };
  }

  let energeticScore = 0;
  let sereneScore = 0;
  let mysticScore = 0;

  if (input.visionMood === 'energetic') energeticScore += 3.5;
  else if (input.visionMood === 'serene') sereneScore += 3.5;
  else if (input.visionMood === 'mystic') mysticScore += 3.5;

  if (trimMetrics) {
    const { solidity = 0.62, trimAspect = 1.0, warmRatio = 0, pastelRatio = 0, darkRatio = 0 } = trimMetrics;
    if (solidity < 0.56 || trimAspect >= 1.24 || trimAspect <= 0.60) energeticScore += 2.2;
    else if (solidity >= 0.65 && trimAspect >= 0.78 && trimAspect <= 1.15) sereneScore += 2.1;
    if (warmRatio > 0.24) energeticScore += 1.2;
    if (pastelRatio > 0.35) sereneScore += 1.3;
    if (darkRatio > 0.44) mysticScore += 2.0;
  }

  const hay = [
    input.breedName, input.personalityTag, input.hobbyTag,
    input.abilityName, input.attackName, input.flavorText, input.coatPattern
  ].filter(Boolean).join(' ');

  ENERGETIC_KW.forEach((kw) => { if (hay.includes(kw)) energeticScore += 1.2; });
  SERENE_KW.forEach((kw) => { if (hay.includes(kw)) sereneScore += 1.25; });
  MYSTIC_KW.forEach((kw) => { if (hay.includes(kw)) mysticScore += 1.45; });

  if (input.energyType === 'swift') energeticScore += 1.4;
  else if (input.energyType === 'food') energeticScore += 0.9;
  else if (input.energyType === 'charm' || input.energyType === 'normal') sereneScore += 1.1;
  else if (input.energyType === 'dark' || input.energyType === 'brawl') mysticScore += 1.5;

  let mood = 'energetic';
  if (mysticScore > energeticScore && mysticScore >= sereneScore && mysticScore >= 2.2) {
    mood = 'mystic';
  } else if (sereneScore > energeticScore) {
    mood = 'serene';
  }

  const preset = PET_MOOD_PRESETS.find((m) => m.id === mood) || PET_MOOD_PRESETS[1];
  const reason = mood === 'energetic'
    ? (trimMetrics && (trimMetrics.solidity < 0.56 || trimMetrics.trimAspect >= 1.24) ? '动态舒展姿态 · 活泼元气' : '活泼好动气质 · 炫彩适配')
    : mood === 'serene'
      ? (trimMetrics && trimMetrics.solidity >= 0.65 ? '乖巧端坐仪态 · 文静优雅' : '温婉恬静气质 · 柔光适配')
      : '沉稳深邃毛色 · 高冷酷飒';

  return { mood, label: preset.label, reason, explicit: false };
}

export function resolveSmartBackgroundForPet(card = {}, trimMetrics = null) {
  if (card.backgroundStyle && card.backgroundStyle !== 'auto') {
    const exists = BACKGROUND_PRESETS.some((b) => b.id === card.backgroundStyle);
    if (exists) return card.backgroundStyle;
  }

  const { mood } = inferPetMoodProfile(card, trimMetrics);
  const pools = {
    energetic: {
      swift: ['emeraldGale', 'waveRiderCyan'],
      food: ['solarCelebration', 'sunburstArena', 'flameCanyon'],
      brawl: ['rainbowPrismHolo', 'flameCanyon'],
      charm: ['rainbowPrismHolo', 'solarCelebration'],
      default: ['solarCelebration', 'waveRiderCyan', 'sunburstArena', 'rainbowPrismHolo']
    },
    serene: {
      charm: ['sakuraPastel', 'silkChampagne'],
      normal: ['frozenCrystal', 'azurePaperGlow'],
      food: ['silkChampagne', 'emeraldForest'],
      swift: ['emeraldForest', 'azurePaperGlow'],
      default: ['silkChampagne', 'sakuraPastel', 'azurePaperGlow', 'frozenCrystal']
    },
    mystic: {
      brawl: ['cyberNeonViolet', 'cosmosNebula'],
      dark: ['abyssStarlight', 'cyberNeonViolet', 'obsidianStudio'],
      default: ['abyssStarlight', 'cyberNeonViolet', 'cosmosNebula']
    }
  };

  const bucket = pools[mood] || pools.energetic;
  const list = bucket[card.energyType] || bucket.default;
  const seedStr = `${card.name || ''}${card.breedName || ''}${card.coatPattern || ''}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length] || 'solarCelebration';
}

// 与 iOS PetBreed.allCases 1:1 对齐的全套 52 品种名录（21 猫 + 31 狗）
export const PET_CATALOG_BREEDS = [
  // 21 猫咪
  { name: '中华橘猫', shortName: '大橘', species: 'cat', coat: '金被银床', energy: 'food' },
  { name: '中华狸花猫', shortName: '中华狸花', species: 'cat', coat: '铁尺鱼骨', energy: 'swift' },
  { name: '奶牛猫', shortName: '奶牛猫', species: 'cat', coat: '乌云盖雪', energy: 'brawl' },
  { name: '三花猫', shortName: '三花猫', species: 'cat', coat: '玳瑁锦绣', energy: 'charm' },
  { name: '玄猫(纯黑)', shortName: '玄猫', species: 'cat', coat: '踏雪寻梅', energy: 'dark' },
  { name: '四川简州猫', shortName: '简州猫', species: 'cat', coat: '铁棒打樱桃', energy: 'swift' },
  { name: '临清狮子猫', shortName: '狮子猫', species: 'cat', coat: '雪里拖枪', energy: 'charm' },
  { name: '乌云盖雪', shortName: '礼服猫', species: 'cat', coat: '墨玉垂珠', energy: 'brawl' },
  { name: '混血田园喵', shortName: '街头浪喵', species: 'cat', coat: '百战灵纹', energy: 'normal' },
  { name: '英国短毛猫', shortName: '英国短毛猫', species: 'cat', coat: '蓝绒银辉', energy: 'normal' },
  { name: '英短蓝猫', shortName: '英短蓝猫', species: 'cat', coat: '雾霾丝绒蓝', energy: 'normal' },
  { name: '英短蓝白', shortName: '蓝白英短', species: 'cat', coat: '正八字蓝白', energy: 'swift' },
  { name: '英短金渐层', shortName: '金渐层', species: 'cat', coat: '鎏金黑绒', energy: 'food' },
  { name: '英短银渐层', shortName: '银渐层', species: 'cat', coat: '素裹霜雪', energy: 'charm' },
  { name: '异国短毛猫(加菲猫)', shortName: '加菲猫', species: 'cat', coat: '虎斑扁脸', energy: 'food' },
  { name: '美国短毛猫', shortName: '美国短毛猫', species: 'cat', coat: '银虎标斑', energy: 'swift' },
  { name: '布偶猫', shortName: '布偶猫', species: 'cat', coat: '海豹双色开脸', energy: 'charm' },
  { name: '暹罗猫', shortName: '暹罗猫', species: 'cat', coat: '挖煤重点色', energy: 'dark' },
  { name: '波斯猫', shortName: '波斯猫', species: 'cat', coat: '雪缎长毛', energy: 'charm' },
  { name: '缅因猫', shortName: '缅因猫', species: 'cat', coat: '荒野狮鬃', energy: 'dark' },
  { name: '斯芬克斯无毛猫', shortName: '无毛猫', species: 'cat', coat: '粉玉丝绒', energy: 'dark' },
  // 31 狗狗
  { name: '中华田园犬', shortName: '大黄/田园犬', species: 'dog', coat: '赤黄守望', energy: 'food' },
  { name: '松狮犬', shortName: '松狮犬', species: 'dog', coat: '狮鬃赤毛', energy: 'brawl' },
  { name: '西施犬', shortName: '西施犬', species: 'dog', coat: '双色长绒', energy: 'charm' },
  { name: '北京犬(京巴)', shortName: '京巴', species: 'dog', coat: '御前金缎', energy: 'charm' },
  { name: '巴哥犬', shortName: '巴哥犬', species: 'dog', coat: '黑面沙米', energy: 'food' },
  { name: '沙皮犬', shortName: '沙皮犬', species: 'dog', coat: '褶皱墨沙', energy: 'brawl' },
  { name: '贵州下司犬', shortName: '下司犬', species: 'dog', coat: '雪白虎爪', energy: 'swift' },
  { name: '藏獒', shortName: '藏獒', species: 'dog', coat: '铁包金鬃', energy: 'brawl' },
  { name: '昆明犬(狼青)', shortName: '昆明犬', species: 'dog', coat: '狼青铁脊', energy: 'swift' },
  { name: '重庆猎犬', shortName: '重庆猎犬', species: 'dog', coat: '赤褐竹尾', energy: 'swift' },
  { name: '金毛寻回犬', shortName: '金毛寻回犬', species: 'dog', coat: '流金碎玉', energy: 'food' },
  { name: '拉布拉多寻回犬', shortName: '拉布拉多', species: 'dog', coat: '奶昔米黄', energy: 'food' },
  { name: '威尔士柯基犬', shortName: '柯基犬', species: 'dog', coat: '金鞍伏地', energy: 'food' },
  { name: '日本柴犬', shortName: '日本柴犬', species: 'dog', coat: '赤柴红云', energy: 'food' },
  { name: '边境牧羊犬', shortName: '边境牧羊犬', species: 'dog', coat: '黑白玄冠', energy: 'swift' },
  { name: '哈士奇(雪橇犬)', shortName: '哈士奇', species: 'dog', coat: '黑白三把火', energy: 'swift' },
  { name: '萨摩耶犬', shortName: '萨摩耶', species: 'dog', coat: '雪域白仙', energy: 'charm' },
  { name: '德国牧羊犬', shortName: '德牧', species: 'dog', coat: '黑背金甲', energy: 'swift' },
  { name: '法国斗牛犬', shortName: '法斗', species: 'dog', coat: '奶油虎斑', energy: 'brawl' },
  { name: '贵宾犬(泰迪)', shortName: '泰迪', species: 'dog', coat: '焦糖卷毛', energy: 'charm' },
  { name: '博美犬', shortName: '博美犬', species: 'dog', coat: '蓬松金球', energy: 'charm' },
  { name: '杜宾犬', shortName: '杜宾犬', species: 'dog', coat: '墨金战甲', energy: 'swift' },
  { name: '罗威纳犬', shortName: '罗威纳', species: 'dog', coat: '乌金铠甲', energy: 'brawl' },
  { name: '迷你雪纳瑞', shortName: '雪纳瑞', species: 'dog', coat: '椒盐长须', energy: 'dark' },
  { name: '阿拉斯加雪橇犬', shortName: '阿拉斯加', species: 'dog', coat: '雪岭巨熊', energy: 'brawl' },
  { name: '比格犬', shortName: '比格犬', species: 'dog', coat: '三色垂耳', energy: 'swift' },
  { name: '吉娃娃', shortName: '吉娃娃', species: 'dog', coat: '杏眼小巧', energy: 'dark' },
  { name: '比熊犬', shortName: '比熊犬', species: 'dog', coat: '棉花糖白', energy: 'charm' },
  { name: '约克夏梗', shortName: '约克夏', species: 'dog', coat: '钢蓝鎏金', energy: 'charm' },
  { name: '腊肠犬', shortName: '腊肠犬', species: 'dog', coat: '琥珀短腿', energy: 'food' },
  { name: '马尔济斯犬', shortName: '马尔济斯', species: 'dog', coat: '白雪丝缎', energy: 'charm' }
];

export const CARD_RARITY_PRESETS = [
  { id: 'common', label: '普通', symbol: '◆', rank: 0, color: '#8e99aa' },
  { id: 'uncommon', label: '罕见', symbol: '◆◆', rank: 1, color: '#59bff2' },
  { id: 'rare', label: '稀有', symbol: '◆◆◆', rank: 2, color: '#d973f2' },
  { id: 'epic', label: '史诗', symbol: '★★★', rank: 3, color: '#fac740' },
  { id: 'crown', label: '皇冠传说', symbol: '👑', rank: 4, color: '#ffd700' }
];

export function computeCardRarity(card = {}) {
  const hp = Number(card.hp || 0);
  const sfx = String(card.suffix || '').toLowerCase();
  if (hp >= 260 || sfx === 'ex' || sfx === 'vstar') return 'crown';
  if (hp >= 200) return 'epic';
  if ((card.abilityName || card.personalityTag) && card.attackName && hp >= 165) return 'rare';
  if (hp >= 140) return 'uncommon';
  return 'common';
}

export function matchCatalogBreed(card = {}) {
  const hay = `${card.breedName || ''} ${card.name || ''}`.toLowerCase();
  const exact = PET_CATALOG_BREEDS.find((b) => b.name.toLowerCase() === String(card.breedName || '').trim().toLowerCase());
  if (exact) return exact;
  return PET_CATALOG_BREEDS.find((b) =>
    hay.includes(b.shortName.toLowerCase()) ||
    hay.includes(b.name.replace(/\(.*?\)/g, '').toLowerCase())
  ) || null;
}

export function resolveCardSpecies(card = {}) {
  if (card.species === 'dog' || card.species === 'cat') return card.species;
  const cat = matchCatalogBreed(card);
  if (cat) return cat.species;
  const hay = `${card.breedName || ''} ${card.name || ''}`.toLowerCase();
  if (hay.includes('犬') || hay.includes('狗') || hay.includes('牧羊') || hay.includes('柯基') || hay.includes('柴')) return 'dog';
  return 'cat';
}

