import {
  BREED_QUICK_PICKS,
  inferPetMoodProfile,
  resolveSmartBackgroundForPet
} from './presets.js?v=20261128a';

const moodMetricsCache = new WeakMap();

export function analyzeCutoutMoodMetrics(imgEl) {
  if (!imgEl || !(imgEl.naturalWidth || imgEl.width)) return null;
  if (moodMetricsCache.has(imgEl)) return moodMetricsCache.get(imgEl);
  try {
    const S = 96;
    const iw = imgEl.naturalWidth || imgEl.width;
    const ih = imgEl.naturalHeight || imgEl.height;
    const scale = Math.min(1, S / Math.max(iw, ih));
    const sw = Math.max(8, Math.round(iw * scale));
    const sh = Math.max(8, Math.round(ih * scale));
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;

    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    let opaque = 0, warm = 0, pastel = 0, dark = 0;
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const idx = (y * sw + x) * 4;
        if (d[idx + 3] <= 28) continue;
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const l = (r + g + b) / 3;
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        if (l < 66) dark += 1;
        else if (l > 192 && sat < 0.24) pastel += 1;
        else if (sat > 0.36 && r >= g && r > b) warm += 1;
      }
    }
    if (opaque < 12 || maxX < minX || maxY < minY) {
      moodMetricsCache.set(imgEl, null);
      return null;
    }
    const trimW = Math.max(1, maxX - minX + 1);
    const trimH = Math.max(1, maxY - minY + 1);
    const metrics = {
      trimAspect: trimW / trimH,
      solidity: opaque / (trimW * trimH),
      warmRatio: warm / opaque,
      pastelRatio: pastel / opaque,
      darkRatio: dark / opaque
    };
    moodMetricsCache.set(imgEl, metrics);
    return metrics;
  } catch {
    return null;
  }
}

function attachMoodMetadata(profile, imgEl, visionMood = '') {
  if (!profile) return profile;
  const metrics = analyzeCutoutMoodMetrics(imgEl);
  const { mood, label, reason } = inferPetMoodProfile({ ...profile, petMood: 'auto', visionMood }, metrics);
  const suggestedBgId = resolveSmartBackgroundForPet({ ...profile, petMood: mood, backgroundStyle: 'auto' }, metrics);
  return {
    ...profile,
    petMood: mood,
    moodLabel: label,
    moodReason: reason,
    suggestedBgId
  };
}

/**
 * CatchCat Web 端云混合智能识宠引擎
 * 1. 默认优先走同源 Netlify Function (`/.netlify/functions/vision`) 零 CORS 转发至 VisionProxy（8.5s 超时）
 * 2. 若在纯本地静态服务或用户自定义网关，直接请求配置地址
 * 3. 若离线或用户开启"仅本地识别"，结合物种提示与像素色彩特征秒级输出猫/狗/小宠档案
 */

const LS_KEY_URL = 'CatchCat_Web_VisionProxyURL';
const LS_KEY_LOCAL_ONLY = 'CatchCat_Web_LocalOnly';
export const DEFAULT_VISION_URL = 'https://catchcat-vision-proxy.visionproxy.workers.dev';
export const SAME_ORIGIN_VISION_PATH = '/.netlify/functions/vision';

export function getAISettings() {
  return {
    endpoint: localStorage.getItem(LS_KEY_URL) || DEFAULT_VISION_URL,
    localOnly: localStorage.getItem(LS_KEY_LOCAL_ONLY) === '1'
  };
}

export function saveAISettings({ endpoint, localOnly }) {
  localStorage.setItem(LS_KEY_URL, (endpoint || '').trim() || DEFAULT_VISION_URL);
  localStorage.setItem(LS_KEY_LOCAL_ONLY, localOnly ? '1' : '0');
}

function compositeOverNeutralGray(imgEl) {
  const maxDim = 768;
  const w0 = imgEl.naturalWidth || imgEl.width;
  const h0 = imgEl.naturalHeight || imgEl.height;
  const s = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(64, Math.round(w0 * s));
  const h = Math.max(64, Math.round(h0 * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dde2ea';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(imgEl, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function buildDogProfile(rOrange, rDark, rWhite, rGray) {
  if (rDark > 0.22 && rWhite > 0.16) {
    return {
      species: 'dog',
      name: '边境牧羊犬',
      breedName: '边境牧羊犬',
      coatPattern: '黑白玄冠',
      energyType: 'swift',
      hp: 260,
      suffix: 'ex',
      personalityTag: '眼神控场大师',
      hobbyTag: '极速叼飞盘',
      abilityName: '眼神控场大师',
      abilityDesc: '智商榜首小天才，只要手里举起飞盘就立刻进入百米冲刺准备状态。',
      attackName: '草坪百米叼飞盘',
      attackDamage: 180,
      flavorText: '经典黑白分界围脖配星眸专注凝视，运动神经与理解力全拉满。'
    };
  }
  if (rOrange > 0.18 && rWhite > 0.16) {
    return {
      species: 'dog',
      name: '柯基小甜心',
      breedName: '威尔士柯基犬',
      coatPattern: '金鞍伏地',
      energyType: 'food',
      hp: 250,
      suffix: 'ex',
      personalityTag: '短腿小太阳',
      hobbyTag: '蜜桃电臀跑',
      abilityName: '短腿小太阳',
      abilityDesc: '底盘低重心稳、笑容永远满格，听到零食袋响声就会踏着小碎步冲过来。',
      attackName: '蜜桃臀扭扭冲刺',
      attackDamage: 170,
      flavorText: '毛茸茸的大耳朵加上圆润柯基臀，走起路来自带开心节拍。'
    };
  }
  if (rOrange > 0.26) {
    return {
      species: 'dog',
      name: '金毛大暖男',
      breedName: '金毛寻回犬',
      coatPattern: '流金碎玉',
      energyType: 'food',
      hp: 280,
      suffix: 'ex',
      personalityTag: '暖心大暖男',
      hobbyTag: '叼球贴腿腿',
      abilityName: '暖心大暖男',
      abilityDesc: '性格温顺又极度亲人，总会轻轻把头搭在主人膝盖上讨摸摸。',
      attackName: '金色阳光大拥抱',
      attackDamage: 180,
      flavorText: '一身阳光流金披毛，是最值得信赖的温柔家庭守护者。'
    };
  }
  if (rWhite > 0.44) {
    return {
      species: 'dog',
      name: '萨摩耶微笑团',
      breedName: '萨摩耶犬',
      coatPattern: '雪域白仙',
      energyType: 'charm',
      hp: 260,
      suffix: 'ex',
      personalityTag: '治愈微笑团',
      hobbyTag: '雪地撒欢抱',
      abilityName: '治愈微笑团',
      abilityDesc: '天生自带嘴角上扬微笑弧度，蓬松白毛宛如会走路的棉花糖云朵。',
      attackName: '冰雪棉花糖抱抱',
      attackDamage: 170,
      flavorText: '纯白蓬松围脖配上月牙弯笑眼，看见就让人心情瞬间放晴。'
    };
  }
  if (rDark > 0.55) {
    return {
      species: 'dog',
      name: '玄玉拉布拉多',
      breedName: '拉布拉多猎犬',
      coatPattern: '乌金缎面',
      energyType: 'dark',
      hp: 270,
      suffix: 'ex',
      personalityTag: '稳重跟脚汪',
      hobbyTag: '守门等主人',
      abilityName: '稳重跟脚汪',
      abilityDesc: '踏实可靠又黏人，每晚都会安静趴在门垫旁等待家人回家。',
      attackName: '忠犬摆尾贴贴',
      attackDamage: 170,
      flavorText: '黑亮顺滑短毛在灯光下泛着绸缎光泽，眼神清澈忠诚。'
    };
  }
  return {
    species: 'dog',
    name: '哈士奇拆家王',
    breedName: '哈士奇(雪橇犬)',
    coatPattern: '冰蓝三把火',
    energyType: 'swift',
    hp: 250,
    suffix: 'ex',
    personalityTag: '脑洞永动机',
    hobbyTag: '雪地撒欢跑',
    abilityName: '脑洞永动机',
    abilityDesc: '每天都有使不完的雪橇犬精力，最喜欢对着空气狼嚎两嗓子。',
    attackName: '风雪涡轮撒手没',
    attackDamage: 170,
    flavorText: '颜值与喜剧天赋并存，自带三把火额纹的可爱二哈。'
  };
}

function buildSmallPetProfile(hintSpecies) {
  if (hintSpecies === 'small') {
    return {
      species: 'small',
      name: '小宠甜心',
      breedName: '萌宠小可爱',
      coatPattern: '绒绒团子',
      energyType: 'charm',
      hp: 200,
      suffix: 'ex',
      personalityTag: '软萌社牛团',
      hobbyTag: '啃菜叶发呆',
      abilityName: '软萌社牛团',
      abilityDesc: '小巧玲珑的一团毛茸茸，在手心里眨眼睛的样子能融化所有烦恼。',
      attackName: '毛球蹭蹭撒娇',
      attackDamage: 150,
      flavorText: '无论长耳、绒尾还是彩色羽毛，都是独一无二的掌心宝贝。'
    };
  }
  return null;
}

/**
 * 本地高速毛色与品种提示鉴宠（免外网 10ms 出结果）
 */
export function localAnalyzeCutout(imgEl, hintSpecies = 'auto', hintBreed = '') {
  const cleanHintBreed = (hintBreed || '').trim();
  if (cleanHintBreed) {
    const matched = BREED_QUICK_PICKS.find((b) => b.label === cleanHintBreed || b.label.includes(cleanHintBreed));
    if (matched) {
      return {
        species: matched.species,
        name: matched.label.replace(/\(.*?\)/g, ''),
        breedName: matched.label,
        coatPattern: matched.coat,
        energyType: matched.energy,
        hp: 250,
        suffix: 'ex',
        personalityTag: matched.personality,
        hobbyTag: matched.hobby,
        abilityName: matched.personality,
        abilityDesc: `天生性格「${matched.personality}」，平时最爱的日常是「${matched.hobby}」。`,
        attackName: matched.hobby,
        attackDamage: 170,
        flavorText: `特征花色：${matched.coat} · 已录为专属全息萌宠闪卡。`
      };
    }
  }

  const smallProfile = buildSmallPetProfile(hintSpecies);
  if (smallProfile) return smallProfile;

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgEl, 0, 0, 96, 96);
  const data = ctx.getImageData(0, 0, 96, 96).data;

  let warmOrange = 0, darkBlack = 0, pureWhite = 0, grayBlue = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (r + g + b) / 3;
    const sat = max === 0 ? 0 : (max - min) / max;
    total++;

    if (l < 62) darkBlack++;
    else if (l > 208 && sat < 0.17) pureWhite++;
    else if (sat < 0.18 && l >= 62 && l <= 208) grayBlue++;
    else if (r > 152 && r - b > 40 && g > 82) warmOrange++;
  }

  if (total === 0) total = 1;
  const rOrange = warmOrange / total;
  const rDark = darkBlack / total;
  const rWhite = pureWhite / total;
  const rGray = grayBlue / total;

  if (hintSpecies === 'dog') {
    return buildDogProfile(rOrange, rDark, rWhite, rGray);
  }

  if (rOrange > 0.28 && rDark > 0.12 && rWhite > 0.14) {
    return {
      species: 'cat',
      name: '三花猫', breedName: '三花猫', coatPattern: '玳瑁锦绣', energyType: 'charm',
      hp: 210, suffix: 'ex', personalityTag: '福气小甜饼', hobbyTag: '暖被窝打盹',
      abilityName: '福气小甜饼',
      abilityDesc: '温柔软糯又超爱撒娇，总在主人回家第一时间在玄关踩奶欢迎。',
      attackName: '花瓣踩奶呼噜', attackDamage: 150,
      flavorText: '黑橘白三色泼墨交织，福气满格的可爱小锦鲤。'
    };
  }
  if (rOrange > 0.30) {
    return {
      species: 'cat',
      name: '大橘', breedName: '中华橘猫', coatPattern: '金被银床', energyType: 'food',
      hp: 270, suffix: 'ex', personalityTag: '干饭粘人精', hobbyTag: '晒太阳踩奶',
      abilityName: '干饭粘人精',
      abilityDesc: '听见开罐头声就立刻闪现贴腿，最爱把暖呼呼的肚皮摊在太阳下。',
      attackName: '圆肚皮晒太阳', attackDamage: 180,
      flavorText: '金毛银肚，在阳光下散发着让人忍不住 rua 一把的暖意。'
    };
  }
  if (rDark > 0.36 && rWhite > 0.20) {
    return {
      species: 'cat',
      name: '奶牛猫', breedName: '奶牛猫', coatPattern: '乌云盖雪', energyType: 'brawl',
      hp: 230, suffix: 'ex', personalityTag: '脑洞永动机', hobbyTag: '客厅夜间跑酷',
      abilityName: '脑洞永动机',
      abilityDesc: '精力充沛满脑奇思妙想，专注在窗台与纸箱间表演高难度特技。',
      attackName: '垂直墙头跑酷', attackDamage: 150,
      flavorText: '经典黑白撞色礼服，若实际是边牧等狗狗可在抠图页一键切「狗狗」哦。'
    };
  }
  if (rDark > 0.56) {
    return {
      species: 'cat',
      name: '玄猫', breedName: '中华玄猫', coatPattern: '踏雪乌金', energyType: 'dark',
      hp: 250, suffix: 'ex', personalityTag: '沉稳小保镖', hobbyTag: '阳台观鸟发呆',
      abilityName: '沉稳小保镖',
      abilityDesc: '平时安静高冷像黑丝绒雕塑，关键时刻总是默默守在主人脚边。',
      attackName: '夜瞳静谧注视', attackDamage: 170,
      flavorText: '墨缎一般漆黑的皮毛，双眸亮得像暗夜宝石。'
    };
  }
  if (rGray > 0.45) {
    return {
      species: 'cat',
      name: '蓝猫大人', breedName: '英短蓝猫', coatPattern: '雾霾丝绒蓝', energyType: 'normal',
      hp: 240, suffix: 'ex', personalityTag: '敦厚绅士派', hobbyTag: '揣手晒午阳',
      abilityName: '敦厚绅士派',
      abilityDesc: '圆滚滚的发腮脸颊配细腻天鹅绒短毛，性格沉稳像位老绅士。',
      attackName: '软绵腮帮贴贴', attackDamage: 160,
      flavorText: '圆滚滚的脸蛋配上细腻短绒，手感堪比顶级天鹅绒。'
    };
  }
  if (rWhite > 0.52) {
    return {
      species: 'cat',
      name: '雪仙喵', breedName: '临清狮子猫', coatPattern: '雪里拖枪', energyType: 'charm',
      hp: 260, suffix: 'ex', personalityTag: '高冷小仙女', hobbyTag: '梳毛后美美入睡',
      abilityName: '高冷小仙女',
      abilityDesc: '通身雪白柔顺长毛，优雅得宛如冬日初雪里的飘逸精灵。',
      attackName: '蓬松云朵伸懒腰', attackDamage: 170,
      flavorText: '举手投足满是松弛贵气，自带温柔滤镜的白雪精灵。'
    };
  }
  return {
    species: 'cat',
    name: '中华狸花', breedName: '中华狸花猫', coatPattern: '铁尺鱼骨', energyType: 'swift',
    hp: 230, suffix: 'ex', personalityTag: '警觉酷行者', hobbyTag: '追逗猫棒飞跃',
    abilityName: '警觉酷行者',
    abilityDesc: '独立聪明又极有分寸感，习惯站在猫爬架最高层暗中观察。',
    attackName: '草丛飞扑抓球', attackDamage: 160,
    flavorText: '经典虎斑鱼骨纹，敏捷与颜值拉满的东方自然猫王。'
  };
}

function enrichDogMetadata(cleanBreed, fallbackCoat) {
  const pick = BREED_QUICK_PICKS.find((b) =>
    b.label.includes(cleanBreed) || cleanBreed.includes(b.label.replace(/\(.*?\)/g, ''))
  );
  if (pick) {
    return {
      energyType: pick.energy,
      personalityTag: pick.personality,
      hobbyTag: pick.hobby,
      abilityName: pick.personality,
      attackName: pick.hobby,
      coatPattern: fallbackCoat || pick.coat
    };
  }
  return {
    energyType: 'food',
    personalityTag: '忠诚小太阳',
    hobbyTag: '叼球陪玩耍',
    abilityName: '忠诚小太阳',
    attackName: '快乐摇尾飞扑',
    coatPattern: fallbackCoat || '活力毛色'
  };
}

async function postVisionEndpoint(url, payload, timeoutMs = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.isPet === false || !json.breed) return null;
    return json;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * 端云协同识宠：
 * - 优先使用未裁剪全图送往云端视觉模型，确保犬种/猫种/小宠识别完整不误判
 * - Netlify 部署站点先走同源 /.netlify/functions/vision 彻底规避跨站 CORS 问题
 * - 用户在抠图台手动指定品种或物种时，以用户选择为主
 */
export async function analyzePetSmart(cutoutImgEl, options = {}) {
  const {
    originalEl = null,
    hintSpecies = 'auto',
    hintBreed = ''
  } = options;

  const fallback = attachMoodMetadata(localAnalyzeCutout(cutoutImgEl, hintSpecies, hintBreed), cutoutImgEl);

  // 若用户在抠图弹窗内直接点选了特定品种按钮，直接使用精准预设档案
  if (hintBreed && hintBreed.trim()) {
    return fallback;
  }

  const { endpoint, localOnly } = getAISettings();
  if (localOnly || !endpoint) return fallback;

  const visualSource = originalEl || cutoutImgEl;
  const dataUrl = compositeOverNeutralGray(visualSource);
  const base64 = dataUrl.split(',')[1];
  const payload = { imageBase64: base64, mimeType: 'image/jpeg', hintSpecies };

  const isHttp = typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol);
  const isDefaultProxy = endpoint === DEFAULT_VISION_URL;

  let json = null;
  if (isHttp && isDefaultProxy) {
    json = await postVisionEndpoint(SAME_ORIGIN_VISION_PATH, payload, 8500);
  }
  if (!json && endpoint) {
    json = await postVisionEndpoint(endpoint, payload, 8500);
  }
  if (!json) return fallback;

  let cleanBreed = String(json.breed).trim();
  const rawLower = cleanBreed.toLowerCase();
  const dogHints = ['犬', '狗', '边牧', '牧羊', '柯基', '柴犬', '金毛', '萨摩耶', '哈士奇', '拉布拉多', '泰迪', '比熊', '博美', '法斗', '巴哥', '雪纳瑞', '松狮', '杜宾', '罗威纳', 'collie', 'corgi', 'shiba', 'husky', 'retriever', 'poodle'];
  const looksDogByName = dogHints.some((kw) => rawLower.includes(kw));
  const speciesIsDog = hintSpecies === 'dog' || (hintSpecies === 'auto' && (json.species === 'dog' || looksDogByName));

  // 若用户明确选了狗狗但模型偶然回传奶牛猫字样，兜底修正为本地狗狗判断
  if (hintSpecies === 'dog' && !looksDogByName && json.species !== 'dog') {
    return attachMoodMetadata(localAnalyzeCutout(cutoutImgEl, 'dog', ''), cutoutImgEl, json.mood);
  }

  const shortName = cleanBreed.replace(/\(.*?\)/g, '');
  const bcs = Number(json.bcsLevel || 5);
  const hp = Math.min(320, Math.max(120, Math.round((160 + bcs * 14) / 10) * 10));

  if (speciesIsDog) {
    const dogMeta = enrichDogMetadata(cleanBreed, json.coatPattern);
    return attachMoodMetadata({
      species: 'dog',
      name: shortName,
      breedName: cleanBreed,
      coatPattern: dogMeta.coatPattern,
      energyType: dogMeta.energyType,
      hp,
      suffix: hp >= 220 ? 'ex' : '',
      personalityTag: dogMeta.personalityTag,
      hobbyTag: dogMeta.hobbyTag,
      abilityName: dogMeta.abilityName,
      attackName: dogMeta.attackName,
      attackDamage: 170,
      flavorText: json.reasoning || fallback.flavorText
    }, cutoutImgEl, json.mood);
  }

  return attachMoodMetadata({
    species: json.species || fallback.species || 'cat',
    name: shortName,
    breedName: cleanBreed,
    coatPattern: json.coatPattern || fallback.coatPattern,
    energyType: cleanBreed.includes('黑') ? 'dark' : (cleanBreed.includes('三花') ? 'charm' : fallback.energyType),
    hp,
    suffix: hp >= 220 ? 'ex' : '',
    personalityTag: fallback.personalityTag || fallback.abilityName,
    hobbyTag: fallback.hobbyTag || fallback.attackName,
    abilityName: fallback.abilityName,
    attackName: fallback.attackName,
    attackDamage: fallback.attackDamage,
    flavorText: json.reasoning || fallback.flavorText
  }, cutoutImgEl, json.mood);
}
