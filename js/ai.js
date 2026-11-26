/**
 * CatchCat Web 端云混合智能识宠引擎
 * 1. 默认尝试调用现有的 Cloudflare VisionProxy（4.5s 快速熔断超时）
 * 2. 若离线或用户开启"仅本地识别"，秒级采样透明抠图内毛色直方图匹配品种/花色/属性
 */

const LS_KEY_URL = 'CatchCat_Web_VisionProxyURL';
const LS_KEY_LOCAL_ONLY = 'CatchCat_Web_LocalOnly';
export const DEFAULT_VISION_URL = 'https://catchcat-vision-proxy.visionproxy.workers.dev';

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
  const maxDim = 640;
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
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * 本地高速毛色分布鉴宠（免外网 10ms 出结果）
 */
export function localAnalyzeCutout(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgEl, 0, 0, 96, 96);
  const data = ctx.getImageData(0, 0, 96, 96).data;

  let warmOrange = 0, darkBlack = 0, pureWhite = 0, grayBlue = 0, brownTabby = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (r + g + b) / 3;
    const sat = max === 0 ? 0 : (max - min) / max;
    total++;

    if (l < 58) darkBlack++;
    else if (l > 212 && sat < 0.16) pureWhite++;
    else if (sat < 0.18 && l >= 58 && l <= 212) grayBlue++;
    else if (r > 155 && r - b > 42 && g > 85) warmOrange++;
    else brownTabby++;
  }

  if (total === 0) total = 1;
  const rOrange = warmOrange / total;
  const rDark = darkBlack / total;
  const rWhite = pureWhite / total;
  const rGray = grayBlue / total;

  if (rOrange > 0.28 && rDark > 0.12 && rWhite > 0.14) {
    return {
      name: '三花猫', breedName: '三花猫', coatPattern: '玳瑁锦绣', energyType: 'charm',
      hp: 210, suffix: 'ex', abilityName: '招财锦鲤', attackName: '落英缤纷光波', attackDamage: 150,
      flavorText: '黑橘白三色泼墨交织，福气满格的街巷小锦鲤。'
    };
  }
  if (rOrange > 0.30) {
    return {
      name: '大橘', breedName: '中华橘猫', coatPattern: '金被银床', energyType: 'food',
      hp: 270, suffix: 'ex', abilityName: '大橘为重', attackName: '吨位泰山压顶', attackDamage: 180,
      flavorText: '金毛银肚，在阳光下散发着让人忍不住rua一把的暖意。'
    };
  }
  if (rDark > 0.42 && rWhite > 0.22) {
    return {
      name: '奶牛猫', breedName: '奶牛猫', coatPattern: '乌云盖雪', energyType: 'brawl',
      hp: 230, suffix: 'ex', abilityName: '神经二哈', attackName: '垂直墙头跑酷', attackDamage: 150,
      flavorText: '经典黑白撞色礼服，总在想一些高难度特技动作。'
    };
  }
  if (rDark > 0.58) {
    return {
      name: '玄猫', breedName: '中华玄猫', coatPattern: '踏雪乌金', energyType: 'dark',
      hp: 250, suffix: 'ex', abilityName: '辟邪遁形', attackName: '深渊夜瞳凝视', attackDamage: 170,
      flavorText: '墨缎一般漆黑的皮毛，双眸亮得像暗夜宝石。'
    };
  }
  if (rGray > 0.45) {
    return {
      name: '蓝猫大人', breedName: '英短蓝猫', coatPattern: '雾霾丝绒蓝', energyType: 'normal',
      hp: 240, suffix: 'ex', abilityName: '发腮镇场', attackName: '腮帮重锤撞击', attackDamage: 160,
      flavorText: '圆滚滚的脸蛋配上细腻短绒，质感堪比天鹅绒。'
    };
  }
  if (rWhite > 0.55) {
    return {
      name: '雪仙喵', breedName: '临清狮子猫', coatPattern: '雪里拖枪', energyType: 'charm',
      hp: 260, suffix: 'ex', abilityName: '仙气自愈', attackName: '蓬莱冰魄寒光', attackDamage: 170,
      flavorText: '通身雪白柔顺长毛，优雅得宛如冬日初雪精灵。'
    };
  }
  return {
    name: '中华狸花', breedName: '中华狸花猫', coatPattern: '铁尺鱼骨', energyType: 'swift',
    hp: 230, suffix: 'ex', abilityName: '暗影巡逻', attackName: '闪电连环爪', attackDamage: 160,
    flavorText: '经典虎斑鱼骨纹，敏捷与颜值拉满的街头王者。'
  };
}

/**
 * 端云协同识宠：带 4.5 秒超快超时保护，绝不卡死前端
 */
export async function analyzePetSmart(cutoutImgEl) {
  const fallback = localAnalyzeCutout(cutoutImgEl);
  const { endpoint, localOnly } = getAISettings();
  if (localOnly || !endpoint) return fallback;

  try {
    const dataUrl = compositeOverNeutralGray(cutoutImgEl);
    const base64 = dataUrl.split(',')[1];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return fallback;
    const json = await res.json();
    if (!json || json.isPet === false || !json.breed) return fallback;

    const speciesIsDog = json.species === 'dog';
    const cleanBreed = String(json.breed);
    const shortName = cleanBreed.replace(/\(.*?\)/g, '');
    const bcs = Number(json.bcsLevel || 5);
    const hp = Math.min(320, Math.max(120, Math.round((160 + bcs * 14) / 10) * 10));

    return {
      name: shortName,
      breedName: cleanBreed,
      coatPattern: json.coatPattern || fallback.coatPattern,
      energyType: speciesIsDog ? 'food' : (json.breed.includes('黑') ? 'dark' : fallback.energyType),
      hp,
      suffix: hp >= 220 ? 'ex' : '',
      abilityName: speciesIsDog ? '忠犬守护' : fallback.abilityName,
      attackName: speciesIsDog ? '快乐摇尾暴击' : fallback.attackName,
      attackDamage: speciesIsDog ? 170 : fallback.attackDamage,
      flavorText: json.reasoning || fallback.flavorText
    };
  } catch {
    return fallback;
  }
}

