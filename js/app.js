import {
  ENERGY_TYPES,
  BORDER_PRESETS,
  BACKGROUND_PRESETS,
  FX_PRESETS,
  BADGE_PRESETS,
  PERSONALITY_CHIPS,
  HOBBY_CHIPS,
  BREED_QUICK_PICKS,
  SAMPLE_CARDS,
  CAT_SNACKS,
  DOG_SNACKS,
  PET_SPECIES_PRESETS,
  PET_CATALOG_BREEDS,
  CARD_RARITY_PRESETS,
  resolveAdaptiveFX,
  inferPetMoodProfile,
  computeCardRarity,
  matchCatalogBreed,
  resolveCardSpecies,
  sanitizeStreetLocation,
  formatCardGeneratedTime
} from './presets.js?v=20261128b';
import {
  loadImageCached,
  getEnergyConfig,
  getCardDisplayTitle,
  isLandscapeBackCard,
  resolveEffectiveBgId,
  renderCardFrontToCanvas,
  renderCardBackToCanvas,
  exportCard4KBlob
} from './cardRenderer.js?v=20261128b';
import { WebCutoutEngine, preloadNeuralMatting } from './cutout.js?v=20261128b';
import { getAISettings, saveAISettings, analyzePetSmart, analyzeCutoutMoodMetrics } from './ai.js?v=20261128b';
import { LEGAL_TABS, LEGAL_DOCUMENTS } from './legal.js?v=20261128c';
import { loadAllCards, upsertCard, removeCard, getTrainerLevelInfo, grantTrainerXP } from './storage.js?v=20261128b';
import { Card3DShowcase } from './showcase3d.js?v=20261128b';
import {
  getCloudSession,
  registerCloudAccount,
  loginCloudAccount,
  logoutCloudAccount,
  pushCardToCloud,
  deleteCardFromCloud,
  syncCardsBidirectional
} from './cloudSync.js?v=20261128b';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const state = {
  cards: [],
  currentCard: deepClone(SAMPLE_CARDS[0]),
  uploadedCustomSrc: null,
  activeCutoutImg: null,
  activeTab: 'capture',
  activeAxis: 'border',
  isFlipped: false,
  cardPointerDownPos: null,
  inspectPointerDownPos: null,
  locationConsent: (() => {
    try { return localStorage.getItem('CatchPet_LocationConsent_v1') || 'unasked'; } catch { return 'unasked'; }
  })(),
  renderScheduled: false,
  dexSearch: '',
  dexMode: 'cards',
  dexDimension: 'rarity',
  dexRarity: 'all',
  dexSpecies: 'all',
  dexBreed: 'all',
  dexFavOnly: false,
  dexSort: 'newest',
  catalogScope: 'all',
  catalogEnergy: 'all',
  dexThumbCache: new Map(),
  pendingDeleteId: null,
  pendingDeleteTimer: null,
  showcase: null,
  cutoutEngine: new WebCutoutEngine(),
  cutoutLoadedSrc: false,
  cutoutOriginalImg: null,
  cutoutHintSpecies: 'auto',
  cutoutHintBreed: '',
  cutoutRunId: 0,
  activeMattingPromise: null,
  cutoutDrawRect: { x: 0, y: 0, w: 640, h: 640 },
  brushMode: 'erase',
  brushSize: 26,
  isPaintingBrush: false,
  lastBrushNorm: null,
  isDraggingFraming: false,
  framingStart: { clientX: 0, clientY: 0, ox: 0, oy: 0 },
  snackSpecies: 'cat',
  captureStream: null,
  captureTorchOn: false,
  cameraTried: false,
  sessionBuff: { hpBonus: 0, exBoost: 0, count: 0 },
  inspectCardId: null,
  inspectCutoutImg: null,
  isInspectFlipped: false,
  isInspectFraming: false,
  inspectDragStart: { clientX: 0, clientY: 0, ox: 0, oy: 0 },
  editCardId: null,
  authMode: 'login',
  isSyncingCloud: false
};

const dom = {
  navPills: $$('.nav-pill[data-tab]'),
  mobileTabs: $$('.m-tab[data-tab]'),
  views: {
    capture: $('#view-capture'),
    studio: $('#view-studio'),
    showcase: $('#view-showcase'),
    dex: $('#view-dex')
  },
  dexCountDesktop: $('#dex-count-desktop'),
  btnOpenCloudAuth: $('#btn-open-cloud-auth'),
  topCloudLabel: $('#top-cloud-label'),
  btnDexCloudSync: $('#btn-dex-cloud-sync'),
  btnOpenAiSettings: $('#btn-open-ai-settings'),
  photoFileInput: $('#photo-file-input'),
  cameraFallbackInput: $('#camera-fallback-input'),

  // Capture
  captureViewport: $('#capture-viewport'),
  captureVideo: $('#capture-video'),
  captureStandby: $('#capture-standby'),
  captureStandbyMsg: $('#capture-standby-msg'),
  btnEnableCamera: $('#btn-enable-camera'),
  btnDemoCapture: $('#btn-demo-capture'),
  captureBuffPill: $('#capture-buff-pill'),
  captureBuffText: $('#capture-buff-text'),
  captureLvText: $('#capture-lv-text'),
  btnToggleTorch: $('#btn-toggle-torch'),
  captureReticle: $('#capture-reticle'),
  captureFxLayer: $('#capture-fx-layer'),
  captureFeedBadge: $('#capture-feed-badge'),
  btnToggleSnackSpecies: $('#btn-toggle-snack-species'),
  captureSnackGrid: $('#capture-snack-grid'),
  btnCaptureAlbum: $('#btn-capture-album'),
  btnShutter: $('#btn-shutter'),
  btnCaptureAi: $('#btn-capture-ai'),
  captureAiLabel: $('#capture-ai-label'),

  // Studio
  studioBadge: $('#studio-card-badge'),
  studioHint: $('#studio-interaction-hint'),
  stageHeroRow: $('.stage-hero-row'),
  btnFaceFront: $('#btn-face-front'),
  btnFaceBack: $('#btn-face-back'),
  btnToggleLandscape: $('#btn-toggle-landscape'),
  studioFaceHint: $('#studio-face-hint'),
  btnRandomize: $('#btn-randomize'),
  btnRandomizeIos: $('#btn-randomize-ios'),
  btnToggleSources: $('#btn-toggle-sources'),
  btnStudioUpload: $('#btn-studio-upload'),
  studioComboSummary: $('#studio-combo-summary'),
  cardTilt: $('#studio-card-tilt'),
  cardFlipper: $('#studio-card-flipper'),
  canvasFront: $('#studio-canvas-front'),
  canvasBack: $('#studio-canvas-back'),
  cardSheen: $('#studio-card-sheen'),
  framingGuide: $('#studio-framing-guide'),
  sampleStrip: $('#studio-sample-strip'),
  btnEnter3d: $('#btn-enter-3d'),
  btnSaveCard: $('#btn-save-card'),
  btnExport4k: $('#btn-export-4k'),

  axisTabs: $$('.axis-tab[data-axis]'),
  axisPanes: {
    border: $('#pane-border'),
    background: $('#pane-background'),
    fx: $('#pane-fx'),
    badge: $('#pane-badge'),
    framing: $('#pane-framing')
  },
  borderGrid: $('#border-grid'),
  borderLabel: $('#border-current-label'),
  bgGrid: $('#background-grid'),
  bgLabel: $('#bg-current-label'),
  petMoodBtns: $$('#pet-mood-segment button[data-mood]'),
  moodMatchHint: $('#mood-match-hint'),
  foilSlider: $('#foil-intensity-slider'),
  foilVal: $('#foil-intensity-val'),
  fxGrid: $('#fx-grid'),
  fxLabel: $('#fx-current-label'),
  badgeGrid: $('#badge-grid'),

  inputName: $('#input-card-name'),
  inputBreed: $('#input-card-breed'),
  inputCoat: $('#input-card-coat'),
  inputHp: $('#input-card-hp'),
  hpVal: $('#hp-val'),
  suffixBtns: $$('#suffix-segment button[data-suffix]'),
  energyPills: $('#energy-pills'),
  inputPersonality: $('#input-personality'),
  inputHobby: $('#input-hobby'),
  personalityChips: $('#personality-chips'),
  hobbyChips: $('#hobby-chips'),
  inputAtkName: $('#input-atk-name'),
  inputAtkDmg: $('#input-atk-dmg'),
  inputFlavor: $('#input-card-flavor'),
  studioBackStyleBtns: $$('#studio-back-style button[data-back-style]'),
  studioBackOrientBtns: $$('#studio-back-orientation button[data-back-orient]'),
  chkBackQr: $('#chk-back-qr'),
  studioGeneratedTime: $('#studio-generated-time'),
  chkLocationEnabled: $('#chk-location-enabled'),
  studioLocationRow: $('#studio-location-row'),
  inputCardLocation: $('#input-card-location'),
  btnRequestStreetLoc: $('#btn-request-street-loc'),

  adaptiveTitle: $('#adaptive-zone-title'),
  adaptiveHint: $('#adaptive-zone-hint'),
  btnResetFraming: $('#btn-reset-framing'),
  sliderOx: $('#slider-offset-x'),
  oxVal: $('#offset-x-val'),
  sliderOy: $('#slider-offset-y'),
  oyVal: $('#offset-y-val'),
  sliderScale: $('#slider-scale'),
  scaleVal: $('#scale-val'),
  btnReeditCutout: $('#btn-reedit-cutout'),

  // 3D Showcase
  showcaseTitle: $('#showcase-card-title'),
  btn3dExport4k: $('#btn-3d-export-4k'),
  webglContainer: $('#webgl-container'),
  threeCanvas: $('#three-canvas'),
  threeFallback: $('#three-fallback'),
  threeFallbackImg: $('#three-fallback-img'),
  webglLoading: $('#webgl-loading'),
  camBtns: $$('.dock-btn[data-cam]'),
  btnToggleSpin: $('#btn-toggle-spin'),
  btnToggleSlab: $('#btn-toggle-slab'),
  zoomPills: $$('.dock-pill[data-zoom]'),
  lightPills: $$('.dock-pill[data-light]'),

  // CardDex (iOS CatDexView 对齐)
  dexStatsLine: $('#dex-stats-line'),
  btnBackupExport: $('#btn-backup-export'),
  backupFileInput: $('#backup-file-input'),
  dexRingArc: $('#dex-ring-arc'),
  dexDashCount: $('#dex-dash-count'),
  dexCatProg: $('#dex-cat-prog'),
  dexDogProg: $('#dex-dog-prog'),
  dexParrotProg: $('#dex-parrot-prog'),
  dexGuineaProg: $('#dex-guinea-prog'),
  dexOtherProg: $('#dex-other-prog'),
  dexStatCrown: $('#dex-stat-crown'),
  dexStatEpic: $('#dex-stat-epic'),
  dexStatRare: $('#dex-stat-rare'),
  btnDexCloudInline: $('#btn-dex-cloud-inline'),
  dexCloudDot: $('#dex-cloud-dot'),
  dexCloudStatusLine: $('#dex-cloud-status-line'),
  dexCompletionPct: $('#dex-completion-pct'),
  dexModeBar: $('#dex-mode-bar'),
  dexModeCardsLabel: $('#dex-mode-cards-label'),
  dexModeCatalogLabel: $('#dex-mode-catalog-label'),
  dexOverviewTotalTitle: $('#dex-overview-total-title'),
  dexOverviewUnlockedBadge: $('#dex-overview-unlocked-badge'),
  dexOverviewDesc: $('#dex-overview-desc'),
  dexCardsToolbar: $('#dex-cards-toolbar'),
  dexSearch: $('#dex-search'),
  btnDexFav: $('#btn-dex-fav'),
  dexSortSelect: $('#dex-sort-select'),
  dexDimensionBar: $('#dex-dimension-bar'),
  dexSubfilterBar: $('#dex-subfilter-bar'),
  dexBreedSubfilterBar: $('#dex-breed-subfilter-bar'),
  dexCatalogWall: $('#dex-catalog-wall'),
  dexCatalogScopeBar: $('#dex-catalog-scope-bar'),
  dexCatalogEnergyBar: $('#dex-catalog-energy-bar'),
  dexCatalogGrid: $('#dex-catalog-grid'),
  dexGrid: $('#dex-grid'),

  // Modals & Toast
  modalCutout: $('#modal-cutout'),
  cutoutStatusLine: $('#cutout-status-line'),
  btnCloseCutout: $('#btn-close-cutout'),
  cutoutCanvas: $('#cutout-editor-canvas'),
  brushBtns: $$('#brush-mode-segment button[data-mode]'),
  sliderBrushSize: $('#slider-brush-size'),
  brushSizeVal: $('#brush-size-val'),
  sliderCutoutSens: $('#slider-cutout-sens'),
  cutoutSensVal: $('#cutout-sens-val'),
  sliderCutoutFeather: $('#slider-cutout-feather'),
  cutoutFeatherVal: $('#cutout-feather-val'),
  btnCutoutReset: $('#btn-cutout-reset'),
  cutoutSpeciesBtns: $$('#cutout-species-segment button[data-species]'),
  cutoutBreedPicks: $('#cutout-breed-picks'),
  chkAutoAi: $('#chk-auto-ai'),
  btnCutoutUseFull: $('#btn-cutout-use-full'),
  btnCutoutConfirm: $('#btn-cutout-confirm'),

  modalAiSettings: $('#modal-ai-settings'),
  btnCloseAiSettings: $('#btn-close-ai-settings'),
  inputVisionUrl: $('#input-vision-url'),
  chkLocalOnly: $('#chk-local-only'),
  btnSaveAiSettings: $('#btn-save-ai-settings'),

  // Inspect Modal
  modalInspect: $('#modal-card-inspect'),
  inspectCardTitle: $('#inspect-card-title'),
  btnInspectClose: $('#btn-inspect-close'),
  btnInspect3d: $('#btn-inspect-3d'),
  btnInspectEdit: $('#btn-inspect-edit'),
  btnInspectFav: $('#btn-inspect-fav'),
  btnInspectDelete: $('#btn-inspect-delete'),
  inspectCardTilt: $('#inspect-card-tilt'),
  inspectCardFlipper: $('#inspect-card-flipper'),
  inspectCanvasFront: $('#inspect-canvas-front'),
  inspectCanvasBack: $('#inspect-canvas-back'),
  inspectCardSheen: $('#inspect-card-sheen'),
  inspectFramingGuide: $('#inspect-framing-guide'),
  btnInspectFramingToggle: $('#btn-inspect-framing-toggle'),
  inspectAdaptiveBadge: $('#inspect-adaptive-badge'),
  btnInspectFramingReset: $('#btn-inspect-framing-reset'),
  inspectFramingSliders: $('#inspect-framing-sliders'),
  inspectSliderOx: $('#inspect-slider-ox'),
  inspectOxVal: $('#inspect-ox-val'),
  inspectSliderOy: $('#inspect-slider-oy'),
  inspectOyVal: $('#inspect-oy-val'),
  inspectSliderScale: $('#inspect-slider-scale'),
  inspectScaleVal: $('#inspect-scale-val'),
  btnInspectFlip: $('#btn-inspect-flip'),
  btnInspectArchive: $('#btn-inspect-archive'),
  btnInspectExport: $('#btn-inspect-export'),

  // Card Edit Modal
  modalCardEdit: $('#modal-card-edit'),
  btnCloseCardEdit: $('#btn-close-card-edit'),
  editCardNickname: $('#edit-card-nickname'),
  editCardSuffix: $('#edit-card-suffix'),
  editCardBreed: $('#edit-card-breed'),
  editCardCoat: $('#edit-card-coat'),
  editCardPersonality: $('#edit-card-personality'),
  editCardHobby: $('#edit-card-hobby'),
  editCardAtk: $('#edit-card-atk'),
  editCardHp: $('#edit-card-hp'),
  editCardFlavor: $('#edit-card-flavor'),
  editLocationEnabled: $('#edit-location-enabled'),
  editCardLocation: $('#edit-card-location'),
  editCardSerial: $('#edit-card-serial'),
  editBackStyle: $('#edit-back-style'),
  editBackOrientation: $('#edit-back-orientation'),
  editBackQr: $('#edit-back-qr'),
  btnEditOpenStudio: $('#btn-edit-open-studio'),
  btnSaveCardEdit: $('#btn-save-card-edit'),

  // Cloud Auth Modal
  modalAuth: $('#modal-auth'),
  btnCloseAuth: $('#btn-close-auth'),
  authGuestPanel: $('#auth-guest-panel'),
  authSignedInPanel: $('#auth-signedin-panel'),
  authModeBtns: $$('#auth-mode-segment button[data-auth-mode]'),
  authInputAccount: $('#auth-input-account'),
  authInputPassword: $('#auth-input-password'),
  authDisplayNameRow: $('#auth-displayname-row'),
  authInputDisplayName: $('#auth-input-displayname'),
  authErrorMsg: $('#auth-error-msg'),
  btnAuthSubmit: $('#btn-auth-submit'),
  authProfileName: $('#auth-profile-name'),
  authProfileMeta: $('#auth-profile-meta'),
  btnAuthLogout: $('#btn-auth-logout'),
  btnAuthSyncNow: $('#btn-auth-sync-now'),

  toast: $('#app-toast')
};

let toastTimer = null;
function showToast(msg, duration = 2600) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, duration);
}

// ═══════════════════════ STUDIO SYNC & RENDER ═══════════════════════
async function ensureCutoutLoaded(card) {
  if (!card.cutoutSrc) {
    state.activeCutoutImg = null;
    return null;
  }
  const img = await loadImageCached(card.cutoutSrc);
  if (state.currentCard.cutoutSrc === card.cutoutSrc) {
    state.activeCutoutImg = img;
  }
  return img;
}

function scheduleStudioRender() {
  if (state.renderScheduled) return;
  state.renderScheduled = true;
  requestAnimationFrame(() => {
    state.renderScheduled = false;
    renderStudioNow();
  });
}

function syncStudioLandscapeUI() {
  const isLand = state.isFlipped && isLandscapeBackCard(state.currentCard, state.activeCutoutImg);
  dom.stageHeroRow?.classList.toggle('is-landscape-back', isLand);
  if (dom.btnToggleLandscape) {
    dom.btnToggleLandscape.hidden = !state.isFlipped;
    dom.btnToggleLandscape.classList.toggle('is-active', isLand);
    dom.btnToggleLandscape.textContent = isLand ? '↺ 切回竖版' : '↔ 卡片横置';
  }
}

function setStudioFlipped(nextFlipped) {
  state.isFlipped = Boolean(nextFlipped);
  dom.cardFlipper.classList.toggle('is-flipped', state.isFlipped);
  dom.cardTilt.style.transform = '';
  if (state.activeAxis === 'framing') {
    dom.studioHint.textContent = state.isFlipped
      ? '正在调整背面大图：直接拖动位置 · 滚轮缩放'
      : '正在调整正面主子：直接拖动位置 · 滚轮缩放';
  } else {
    dom.studioHint.textContent = '轻点卡面即可翻面 · 滑过可 3D 摆动';
  }
  syncStudioLandscapeUI();
  syncControlsFromCurrentCard();
  renderStudioNow();
}

async function requestStreetLocation(targetCard, { forceAsk = false } = {}) {
  if (!targetCard) return;
  if (state.locationConsent === 'unasked' || forceAsk) {
    const ok = window.confirm(
      '是否开启街区位置记录？\n系统仅精确到城市/街道，绝不记录门牌号、楼栋或精确坐标，以保护宠物安全。'
    );
    state.locationConsent = ok ? 'granted' : 'denied';
    try { localStorage.setItem('CatchPet_LocationConsent_v1', state.locationConsent); } catch {}
    if (!ok) {
      targetCard.locationEnabled = false;
      targetCard.locationName = '保密街区';
      syncControlsFromCurrentCard();
      scheduleStudioRender();
      showToast('已开启街区隐私保护，卡片不记录位置');
      return;
    }
  }
  if (state.locationConsent === 'denied') {
    targetCard.locationEnabled = false;
    syncControlsFromCurrentCard();
    scheduleStudioRender();
    return;
  }

  targetCard.locationEnabled = true;
  showToast('正在获取街道级模糊定位…', 1800);
  let rawLoc = '';
  try {
    const res = await fetch('https://ipwho.is/?lang=zh-CN');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        rawLoc = [data.city, data.region].filter(Boolean).join(' · ');
      }
    }
  } catch {}
  if (!rawLoc) {
    try {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (res.ok) {
        const data = await res.json();
        rawLoc = [data.city, data.region].filter(Boolean).join(' · ');
      }
    } catch {}
  }
  const safeLoc = sanitizeStreetLocation(rawLoc || targetCard.locationName || '所在街区');
  targetCard.locationName = safeLoc;
  syncControlsFromCurrentCard();
  scheduleStudioRender();
  showToast(`已记录街区位置（已脱敏）：${safeLoc}`);
}

function renderStudioNow() {
  const card = state.currentCard;
  renderCardFrontToCanvas(dom.canvasFront, card, state.activeCutoutImg, 2);
  renderCardBackToCanvas(dom.canvasBack, card, state.activeCutoutImg, 2, state.inspectEmblemImg || null, { presentUpright: true });
  syncStudioLandscapeUI();

  dom.studioBadge.textContent = getCardDisplayTitle(card);
  const adaptive = resolveAdaptiveFX(card);
  dom.adaptiveTitle.textContent = adaptive.title;
  dom.adaptiveHint.textContent = adaptive.hint;

  if (state.activeTab === 'showcase') {
    syncShowcaseCard();
  }
}

function syncControlsFromCurrentCard() {
  const card = state.currentCard;
  const isBack = state.isFlipped;
  dom.studioBadge.textContent = getCardDisplayTitle(card);

  // Face bar active state
  dom.btnFaceFront?.classList.toggle('is-active', !isBack);
  dom.btnFaceBack?.classList.toggle('is-active', isBack);
  if (dom.studioFaceHint) {
    dom.studioFaceHint.textContent = isBack
      ? '当前编辑：背面（边框/背景/特效/宠位独立）'
      : '当前编辑：正面（正反面风格完全独立）';
  }

  // Sample pills active state
  $$('.sample-pill', dom.sampleStrip).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.src === card.cutoutSrc);
  });

  // Border swatches (independent per face)
  const borderId = isBack ? (card.backBorderStyle || 'auto') : (card.borderStyle || 'auto');
  $$('.swatch-card', dom.borderGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === borderId);
  });
  const activeBorder = BORDER_PRESETS.find((b) => b.id === borderId) || BORDER_PRESETS[0];
  dom.borderLabel.textContent = `${isBack ? '背面 · ' : ''}${activeBorder.name}`;

  // Background swatches & smart mood alignment (independent per face)
  const bgId = isBack ? (card.backBackgroundStyle || 'auto') : (card.backgroundStyle || 'auto');
  $$('.swatch-card', dom.bgGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === bgId);
  });
  const metrics = state.activeCutoutImg ? analyzeCutoutMoodMetrics(state.activeCutoutImg) : null;
  const resolvedBgId = resolveEffectiveBgId(card, state.activeCutoutImg, { forBack: isBack });
  const resolvedBg = BACKGROUND_PRESETS.find((b) => b.id === resolvedBgId) || BACKGROUND_PRESETS[1];
  const activeBg = BACKGROUND_PRESETS.find((b) => b.id === bgId) || BACKGROUND_PRESETS[0];
  const isAutoBg = !bgId || bgId === 'auto';
  dom.bgLabel.textContent = `${isBack ? '背面 · ' : ''}${isAutoBg ? `智能 → ${resolvedBg.name}` : activeBg.name}`;

  const moodInfo = inferPetMoodProfile(card, metrics);
  const selectedMood = isBack ? (card.backPetMood || 'auto') : (card.petMood || 'auto');
  dom.petMoodBtns?.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mood === selectedMood);
  });
  if (dom.moodMatchHint) {
    dom.moodMatchHint.textContent = `${moodInfo.label} · ${resolvedBg.name}`;
  }

  // FX swatches & foil slider (independent per face)
  const foil = Number(isBack ? (card.backFoilIntensity ?? card.foilIntensity ?? 0.72) : (card.foilIntensity ?? 0.72));
  dom.foilSlider.value = String(foil);
  dom.foilVal.textContent = `${Math.round(foil * 100)}%`;

  const fxId = isBack ? (card.backFXPreset || 'auto') : (card.fxPreset || 'auto');
  $$('.swatch-card', dom.fxGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === fxId);
  });
  const activeFx = FX_PRESETS.find((f) => f.id === fxId) || FX_PRESETS[0];
  dom.fxLabel.textContent = `${isBack ? '背面 · ' : ''}${activeFx.name}`;

  if (dom.studioComboSummary) {
    dom.studioComboSummary.innerHTML = `
      <span>${isBack ? '背面' : '正面'}</span>
      <span>${activeBorder.name}</span>
      <span>${isAutoBg ? resolvedBg.name : activeBg.name}</span>
      <span>${activeFx.name}</span>
    `;
  }

  // Badge tiles & metadata inputs (badge independent per face)
  const badgeId = isBack ? (card.backBadgeIcon || 'auto') : (card.badgeIcon || 'auto');
  $$('.icon-tile', dom.badgeGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === badgeId);
  });

  dom.inputName.value = card.customNickname || card.name || '';
  dom.inputBreed.value = card.breedName || '';
  dom.inputCoat.value = card.coatPattern || '';
  dom.inputHp.value = String(card.hp ?? 180);
  dom.hpVal.textContent = String(card.hp ?? 180);

  dom.suffixBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.suffix === (card.suffix || ''));
  });

  $$('.energy-pill', dom.energyPills).forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.id === (card.energyType || 'food'));
  });

  if (dom.inputPersonality) {
    dom.inputPersonality.value = card.personalityTag || card.abilityName || '';
  }
  if (dom.inputHobby) {
    dom.inputHobby.value = card.hobbyTag || card.attackName || '';
  }
  $$('.chip-pill', dom.personalityChips).forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.val === (card.personalityTag || card.abilityName || ''));
  });
  $$('.chip-pill', dom.hobbyChips).forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.val === (card.hobbyTag || card.attackName || ''));
  });
  dom.inputAtkName.value = card.attackName || '';
  dom.inputAtkDmg.value = String(card.attackDamage ?? 120);
  dom.inputFlavor.value = card.flavorText || '';
  const bs = card.cardBackStyle || 'fullArtPet';
  dom.studioBackStyleBtns?.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.backStyle === bs));
  const bo = card.cardBackOrientation || 'auto';
  dom.studioBackOrientBtns?.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.backOrient === bo));
  if (dom.chkBackQr) {
    dom.chkBackQr.checked = card.showBackQRCode !== false;
  }
  if (dom.studioGeneratedTime) {
    dom.studioGeneratedTime.textContent = formatCardGeneratedTime(card.createdAt);
  }
  const locOn = card.locationEnabled === true;
  if (dom.chkLocationEnabled) dom.chkLocationEnabled.checked = locOn;
  if (dom.studioLocationRow) dom.studioLocationRow.hidden = !locOn;
  if (dom.inputCardLocation) dom.inputCardLocation.value = locOn ? sanitizeStreetLocation(card.locationName) : '';

  // Framing sliders (independent per face)
  const ox = Number(isBack ? (card.backSubjectOffsetX || 0) : (card.subjectOffsetX || 0));
  const oy = Number(isBack ? (card.backSubjectOffsetY || 0) : (card.subjectOffsetY || 0));
  const sc = Number(isBack ? (card.backSubjectScale || 1) : (card.subjectScale || 1));
  dom.sliderOx.value = String(ox);
  dom.oxVal.textContent = `${Math.round(ox * 100)}%`;
  dom.sliderOy.value = String(oy);
  dom.oyVal.textContent = `${Math.round(oy * 100)}%`;
  dom.sliderScale.value = String(sc);
  dom.scaleVal.textContent = `${sc.toFixed(2)}×`;
}

function buildStaticPalettes() {
  // 1. Sample Cat Strip
  renderSampleStrip();

  // 2. Border Swatches
  dom.borderGrid.innerHTML = '';
  BORDER_PRESETS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-card';
    btn.dataset.id = item.id;
    const dotStyle = `background: linear-gradient(135deg, ${item.grad.join(', ')});`;
    btn.innerHTML = `
      <span class="swatch-dot" style="${dotStyle}"></span>
      <span class="swatch-info">
        <strong>${item.name}</strong>
        <small>${item.desc}</small>
      </span>
    `;
    btn.addEventListener('click', () => {
      if (state.isFlipped) state.currentCard.backBorderStyle = item.id;
      else state.currentCard.borderStyle = item.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.borderGrid.appendChild(btn);
  });

  // 3. Background Swatches
  dom.bgGrid.innerHTML = '';
  BACKGROUND_PRESETS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-card';
    btn.dataset.id = item.id;
    const rectStyle = `background: linear-gradient(135deg, ${item.colors.join(', ')});`;
    btn.innerHTML = `
      <span class="swatch-rect" style="${rectStyle}">${item.glyph}</span>
      <span class="swatch-info">
        <strong>${item.name}</strong>
        <small>${item.desc}</small>
      </span>
    `;
    btn.addEventListener('click', () => {
      if (state.isFlipped) state.currentCard.backBackgroundStyle = item.id;
      else state.currentCard.backgroundStyle = item.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.bgGrid.appendChild(btn);
  });

  dom.petMoodBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood || 'auto';
      if (state.isFlipped) {
        state.currentCard.backPetMood = mood;
        state.currentCard.backBackgroundStyle = 'auto';
      } else {
        state.currentCard.petMood = mood;
        state.currentCard.backgroundStyle = 'auto';
      }
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
  });

  // 4. FX Swatches
  dom.fxGrid.innerHTML = '';
  FX_PRESETS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-card';
    btn.dataset.id = item.id;
    btn.innerHTML = `
      <span class="swatch-rect" style="background: var(--surface-3);">${item.icon}</span>
      <span class="swatch-info">
        <strong>${item.name}</strong>
        <small>${item.desc}</small>
      </span>
    `;
    btn.addEventListener('click', () => {
      if (state.isFlipped) state.currentCard.backFXPreset = item.id;
      else state.currentCard.fxPreset = item.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.fxGrid.appendChild(btn);
  });

  // 5. Badge Icon Grid
  dom.badgeGrid.innerHTML = '';
  BADGE_PRESETS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-tile';
    btn.dataset.id = item.id;
    btn.innerHTML = `
      <span class="glyph">${item.symbol}</span>
      <span>${item.name}</span>
    `;
    btn.addEventListener('click', () => {
      if (state.isFlipped) state.currentCard.backBadgeIcon = item.id;
      else state.currentCard.badgeIcon = item.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.badgeGrid.appendChild(btn);
  });

  // 6. Energy Pills (Studio) + Filter Pills (CardDex)
  dom.energyPills.innerHTML = '';
  ENERGY_TYPES.forEach((en) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'energy-pill';
    btn.dataset.id = en.id;
    btn.textContent = `${en.emoji} ${en.label}`;
    btn.addEventListener('click', () => {
      state.currentCard.energyType = en.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.energyPills.appendChild(btn);
  });

  renderDexSubfilters();
  renderCatalogFilters();

  // 7. Personality & Hobby Quick Chips + Cutout Breed Picks
  if (dom.personalityChips) {
    dom.personalityChips.innerHTML = '';
    PERSONALITY_CHIPS.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-pill';
      btn.dataset.val = label;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        state.currentCard.personalityTag = label;
        state.currentCard.abilityName = label;
        syncControlsFromCurrentCard();
        scheduleStudioRender();
      });
      dom.personalityChips.appendChild(btn);
    });
  }

  if (dom.hobbyChips) {
    dom.hobbyChips.innerHTML = '';
    HOBBY_CHIPS.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-pill';
      btn.dataset.val = label;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        state.currentCard.hobbyTag = label;
        syncControlsFromCurrentCard();
        scheduleStudioRender();
      });
      dom.hobbyChips.appendChild(btn);
    });
  }

  if (dom.cutoutBreedPicks) {
    dom.cutoutBreedPicks.innerHTML = '';
    BREED_QUICK_PICKS.forEach((pick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-pill';
      btn.dataset.breed = pick.label;
      btn.textContent = `${pick.species === 'dog' ? '🐶' : '🐱'} ${pick.label.replace(/\(.*?\)/g, '')}`;
      btn.addEventListener('click', () => {
        const nextBreed = state.cutoutHintBreed === pick.label ? '' : pick.label;
        state.cutoutHintBreed = nextBreed;
        if (nextBreed) state.cutoutHintSpecies = pick.species;
        syncCutoutSpeciesUI();
      });
      dom.cutoutBreedPicks.appendChild(btn);
    });
  }
}

function syncCutoutSpeciesUI() {
  dom.cutoutSpeciesBtns?.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.species === state.cutoutHintSpecies);
  });
  $$('.chip-pill', dom.cutoutBreedPicks).forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.breed === state.cutoutHintBreed);
  });
}

function renderSampleStrip() {
  dom.sampleStrip.innerHTML = '';
  const items = [];
  if (state.uploadedCustomSrc) {
    items.push({
      id: 'custom-upload',
      label: '当前上传',
      src: state.uploadedCustomSrc,
      isCustom: true
    });
  }
  SAMPLE_CARDS.forEach((s) => {
    items.push({
      id: s.id,
      label: s.name,
      src: s.cutoutSrc,
      presetCard: s
    });
  });

  items.forEach((entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample-pill';
    btn.dataset.src = entry.src;
    const img = document.createElement('img');
    img.src = entry.src;
    img.alt = entry.label;
    const span = document.createElement('span');
    span.textContent = entry.label;
    btn.appendChild(img);
    btn.appendChild(span);

    btn.addEventListener('click', async () => {
      if (entry.presetCard) {
        state.currentCard = deepClone(entry.presetCard);
      } else {
        state.currentCard.cutoutSrc = entry.src;
      }
      state.isFlipped = false;
      dom.cardFlipper.classList.remove('is-flipped');
      await ensureCutoutLoaded(state.currentCard);
      syncControlsFromCurrentCard();
      renderStudioNow();
    });
    dom.sampleStrip.appendChild(btn);
  });
}

// ═══════════════════════ CAPTURE VIEWFINDER & SNACK FEEDING ═══════════════════════
function syncCaptureHUD() {
  const { level } = getTrainerLevelInfo();
  if (dom.captureLvText) dom.captureLvText.textContent = `Lv.${level}`;

  const cfg = getAISettings();
  if (dom.btnCaptureAi) {
    dom.btnCaptureAi.classList.toggle('is-on', !cfg.localOnly);
    dom.captureAiLabel.textContent = cfg.localOnly ? '本地识宠' : '云端识宠';
  }

  const { hpBonus, exBoost } = state.sessionBuff;
  if (dom.captureBuffPill) {
    if (hpBonus > 0 || exBoost > 0) {
      dom.captureBuffPill.hidden = false;
      const parts = [];
      if (hpBonus > 0) parts.push(`HP+${hpBonus}`);
      if (exBoost > 0) parts.push(`ex+${exBoost}%`);
      dom.captureBuffText.textContent = `已投喂 ${parts.join(' · ')}`;
      dom.captureReticle?.classList.add('is-buffed');
    } else {
      dom.captureBuffPill.hidden = true;
      dom.captureReticle?.classList.remove('is-buffed');
    }
  }
}

function renderSnackGrid() {
  if (!dom.captureSnackGrid) return;
  const list = state.snackSpecies === 'dog' ? DOG_SNACKS : CAT_SNACKS;
  dom.captureFeedBadge.querySelector('span:last-child').textContent =
    state.snackSpecies === 'dog'
      ? '汪星投喂区 · 投喂诱捕进入卡牌'
      : '喵星投喂区 · 投喂诱捕进入卡牌';
  dom.btnToggleSnackSpecies.textContent =
    state.snackSpecies === 'dog' ? '换猫猫零食 🐱' : '换狗狗零食 🐶';

  dom.captureSnackGrid.innerHTML = '';
  list.forEach((snack) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snack-card';
    btn.innerHTML = `
      <span class="snack-card__media">
        <img src="${snack.img}" alt="${snack.name}">
      </span>
      <strong>${snack.name}</strong>
    `;
    btn.addEventListener('click', () => {
      feedSnack(snack, btn);
    });
    dom.captureSnackGrid.appendChild(btn);
  });
}

function feedSnack(snack, btnEl) {
  state.sessionBuff.hpBonus = Math.min(60, state.sessionBuff.hpBonus + snack.hpBonus);
  state.sessionBuff.exBoost = Math.min(60, state.sessionBuff.exBoost + snack.exBoost);
  state.sessionBuff.count += 1;

  grantTrainerXP(5);
  syncCaptureHUD();

  btnEl?.classList.add('is-fed');
  setTimeout(() => btnEl?.classList.remove('is-fed'), 500);

  if (!dom.captureFxLayer) return;
  const flyer = document.createElement('img');
  flyer.src = snack.img;
  flyer.alt = '';
  flyer.className = 'flying-snack-item';
  dom.captureFxLayer.appendChild(flyer);
  flyer.addEventListener('animationend', () => flyer.remove(), { once: true });

  setTimeout(() => {
    if (!dom.captureFxLayer) return;
    const pop = document.createElement('div');
    pop.className = 'flying-snack-pop';
    pop.textContent = `${snack.name} ${snack.tag}`;
    dom.captureFxLayer.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove(), { once: true });
  }, 260);
}

function stopCameraStream() {
  if (state.captureStream) {
    state.captureStream.getTracks().forEach((t) => t.stop());
    state.captureStream = null;
  }
  if (dom.captureVideo) {
    dom.captureVideo.srcObject = null;
  }
  state.captureTorchOn = false;
  if (dom.btnToggleTorch) {
    dom.btnToggleTorch.hidden = true;
    dom.btnToggleTorch.classList.remove('is-on');
  }
}

async function startCameraStream(forcePrompt = false) {
  if (!dom.captureStandby) return;
  if (state.captureStream) return;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    dom.captureStandby.hidden = false;
    dom.captureStandbyMsg.textContent =
      '当前局域网 HTTP 暂无法开启网页实时视频流，部署 HTTPS 后解锁；直接点大快门即可呼起系统相机';
    return;
  }

  if (state.cameraTried && !forcePrompt) return;
  state.cameraTried = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      },
      audio: false
    });
    if (state.activeTab !== 'capture') {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    state.captureStream = stream;
    dom.captureVideo.srcObject = stream;
    await dom.captureVideo.play().catch(() => {});
    dom.captureStandby.hidden = true;

    const track = stream.getVideoTracks()[0];
    const caps = track?.getCapabilities?.();
    if (caps?.torch && dom.btnToggleTorch) {
      dom.btnToggleTorch.hidden = false;
    }
  } catch {
    dom.captureStandby.hidden = false;
    dom.captureStandbyMsg.textContent =
      '未开启摄像头权限或当前设备无可用镜头，点大快门可直接调用系统相机 / 相册';
  }
}

function captureFromVideoOrFallback() {
  const video = dom.captureVideo;
  if (state.captureStream && video && video.videoWidth > 0 && video.videoHeight > 0) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = Math.round((vw - size) * 0.5);
    const sy = Math.round((vh - size) * 0.5);
    const snap = document.createElement('canvas');
    snap.width = Math.min(960, size);
    snap.height = Math.min(960, size);
    snap.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, snap.width, snap.height);

    const img = new Image();
    img.onload = () => openCutoutModalWithImage(img);
    img.src = snap.toDataURL('image/png');
    return;
  }

  // HTTP LAN 或无实时镜头时平滑呼起系统相机拍照
  dom.cameraFallbackInput?.click();
}

// ═══════════════════════ NAVIGATION & PANES ═══════════════════════
async function switchTab(tabName) {
  state.activeTab = tabName;
  document.body.classList.toggle('tab-studio', tabName === 'studio');
  document.body.classList.toggle('tab-dex', tabName === 'dex');

  dom.navPills.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tabName));
  dom.mobileTabs.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tabName));
  Object.entries(dom.views).forEach(([key, el]) => {
    if (el) el.classList.toggle('is-active', key === tabName);
  });

  if (tabName === 'capture') {
    syncCaptureHUD();
    startCameraStream(false);
  } else {
    stopCameraStream();
  }

  if (tabName === 'showcase') {
    await syncShowcaseCard();
  } else if (tabName === 'dex') {
    await renderDexGrid();
  }
}

function switchAxis(axis) {
  state.activeAxis = axis;
  dom.axisTabs.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.axis === axis));
  Object.entries(dom.axisPanes).forEach(([key, pane]) => {
    if (pane) pane.classList.toggle('is-active', key === axis);
  });

  const isFraming = axis === 'framing';
  dom.cardTilt.classList.toggle('is-framing', isFraming);
  dom.framingGuide.hidden = !isFraming;
  if (isFraming) {
    dom.cardTilt.style.transform = '';
    dom.studioHint.textContent = state.isFlipped
      ? '正在调整背面大图：直接拖动位置 · 滚轮缩放'
      : '正在调整正面主子：直接拖动位置 · 滚轮缩放';
  } else {
    dom.studioHint.textContent = '轻点卡面即可翻面 · 滑过可 3D 摆动';
  }
}

// ═══════════════════════ 3D SHOWCASE INTEGRATION ═══════════════════════
async function syncShowcaseCard() {
  const card = state.currentCard;
  dom.showcaseTitle.textContent = getCardDisplayTitle(card);

  if (!state.showcase) {
    state.showcase = new Card3DShowcase({
      canvas: dom.threeCanvas,
      container: dom.webglContainer,
      fallbackEl: dom.threeFallback,
      fallbackImgEl: dom.threeFallbackImg,
      loadingEl: dom.webglLoading
    });
  }

  const cutout = state.activeCutoutImg || (await ensureCutoutLoaded(card));
  const backEmblem = await loadImageCached('assets/app-icon.png');
  const frontHiRes = document.createElement('canvas');
  const backHiRes = document.createElement('canvas');
  // 4.5x scale => ~1467 × 2049 crispy PBR card textures (63:88) for WebGL close-up zoom
  renderCardFrontToCanvas(frontHiRes, card, cutout, 4.5);
  renderCardBackToCanvas(backHiRes, card, cutout, 4.5, backEmblem);

  state.showcase.updateCardTextures(frontHiRes, backHiRes, card);
  await state.showcase.ensureInitialized();
  state.showcase.resize();
}

// ═══════════════════════ CARDDEX PERSISTENCE, DASHBOARD & GRID ═══════════════════════
function computeDexStats(cards = []) {
  const catBreeds = PET_CATALOG_BREEDS.filter((b) => b.species === 'cat');
  const dogBreeds = PET_CATALOG_BREEDS.filter((b) => b.species === 'dog');
  const parrotBreeds = PET_CATALOG_BREEDS.filter((b) => b.species === 'parrot');
  const guineaBreeds = PET_CATALOG_BREEDS.filter((b) => b.species === 'guineaPig');
  const otherBreeds = PET_CATALOG_BREEDS.filter((b) => b.species === 'other');

  const collectedCat = new Set();
  const collectedDog = new Set();
  const collectedParrot = new Set();
  const collectedGuinea = new Set();
  const collectedOther = new Set();
  const collectedAll = new Set();

  let crown = 0;
  let epic = 0;
  let rare = 0;

  for (const c of cards) {
    const r = computeCardRarity(c);
    if (r === 'crown') crown += 1;
    else if (r === 'epic') epic += 1;
    else if (r === 'rare') rare += 1;

    const match = matchCatalogBreed(c);
    if (match) {
      collectedAll.add(match.name);
      if (match.species === 'dog') collectedDog.add(match.name);
      else if (match.species === 'parrot') collectedParrot.add(match.name);
      else if (match.species === 'guineaPig') collectedGuinea.add(match.name);
      else if (match.species === 'other') collectedOther.add(match.name);
      else collectedCat.add(match.name);
    }
  }

  const totalCatalog = PET_CATALOG_BREEDS.length;
  const unlockedCount = collectedAll.size;
  const pct = totalCatalog > 0 ? Math.min(100, Math.round((unlockedCount / totalCatalog) * 100)) : 0;

  return {
    catCount: collectedCat.size,
    catTotal: catBreeds.length,
    dogCount: collectedDog.size,
    dogTotal: dogBreeds.length,
    parrotCount: collectedParrot.size,
    parrotTotal: parrotBreeds.length,
    guineaCount: collectedGuinea.size,
    guineaTotal: guineaBreeds.length,
    otherCount: collectedOther.size,
    otherTotal: otherBreeds.length,
    unlockedCount,
    totalCatalog,
    crown,
    epic,
    rare,
    pct
  };
}

function updateDexDashboard() {
  const stats = computeDexStats(state.cards);
  const sess = getCloudSession();
  const signedIn = Boolean(sess?.user);
  const circ = 201.06;

  if (dom.dexRingArc) {
    const offset = circ * (1 - stats.pct / 100);
    dom.dexRingArc.style.strokeDashoffset = offset.toFixed(2);
  }
  if (dom.dexDashCount) dom.dexDashCount.textContent = String(state.cards.length);
  if (dom.dexCatProg) dom.dexCatProg.textContent = `🐱 ${stats.catCount}/${stats.catTotal}`;
  if (dom.dexDogProg) {
    dom.dexDogProg.hidden = stats.dogCount === 0 && stats.catCount > 0 ? false : false;
    dom.dexDogProg.textContent = `🐶 ${stats.dogCount}/${stats.dogTotal}`;
  }
  if (dom.dexParrotProg) {
    dom.dexParrotProg.hidden = stats.parrotCount === 0;
    dom.dexParrotProg.textContent = `🦜 ${stats.parrotCount}/${stats.parrotTotal}`;
  }
  if (dom.dexGuineaProg) {
    dom.dexGuineaProg.hidden = stats.guineaCount === 0;
    dom.dexGuineaProg.textContent = `🐹 ${stats.guineaCount}/${stats.guineaTotal}`;
  }
  if (dom.dexOtherProg) {
    dom.dexOtherProg.hidden = stats.otherCount === 0;
    dom.dexOtherProg.textContent = `🐾 ${stats.otherCount}/${stats.otherTotal}`;
  }
  if (dom.dexStatCrown) dom.dexStatCrown.textContent = String(stats.crown);
  if (dom.dexStatEpic) dom.dexStatEpic.textContent = String(stats.epic);
  if (dom.dexStatRare) dom.dexStatRare.textContent = String(stats.rare);
  if (dom.dexCompletionPct) dom.dexCompletionPct.textContent = `${stats.pct}%`;
  if (dom.dexModeCardsLabel) dom.dexModeCardsLabel.textContent = `我的闪卡 (${state.cards.length})`;
  if (dom.dexModeCatalogLabel) dom.dexModeCatalogLabel.textContent = `全套图鉴名录 · 共 ${stats.totalCatalog} 种`;
  if (dom.dexOverviewTotalTitle) dom.dexOverviewTotalTitle.textContent = `全套 ${stats.totalCatalog} 种萌宠图鉴名录`;
  if (dom.dexOverviewUnlockedBadge) dom.dexOverviewUnlockedBadge.textContent = `已点亮 ${stats.unlockedCount}/${stats.totalCatalog}`;
  if (dom.dexOverviewDesc) {
    dom.dexOverviewDesc.textContent = `覆盖猫猫(${stats.catTotal})、狗狗(${stats.dogTotal})、鹦鹉(${stats.parrotTotal})、豚鼠(${stats.guineaTotal})与其他萌宠(${stats.otherTotal})，每个品种均具备专属特性与招式档案。`;
  }

  if (dom.dexCloudDot) dom.dexCloudDot.classList.toggle('is-online', signedIn);
  if (dom.dexCloudStatusLine) {
    dom.dexCloudStatusLine.textContent = signedIn
      ? `${sess.user.displayName} · iOS / Web 已互通`
      : '登录云账号 · iOS / Web 双端互通';
  }
}

function updateDexBadgeCount() {
  if (dom.dexCountDesktop) dom.dexCountDesktop.textContent = String(state.cards.length);
  const sess = getCloudSession();
  const cloudHint = sess?.user?.displayName ? ` · 云端已互通（${sess.user.displayName}）` : ' · 点击「云同步」与 iOS 账号并集对齐';
  if (dom.dexStatsLine) {
    dom.dexStatsLine.textContent = `已收录 ${state.cards.length} 张萌宠闪卡（宝可梦 63×88mm）${cloudHint}`;
  }
  updateDexDashboard();
}

function syncDexModeUI() {
  const isCatalog = state.dexMode === 'catalog';
  if (dom.dexModeBar) {
    $$('.dex-mode-btn', dom.dexModeBar).forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.dexMode === state.dexMode);
    });
  }
  if (dom.dexCardsToolbar) dom.dexCardsToolbar.hidden = isCatalog;
  if (dom.dexGrid) dom.dexGrid.hidden = isCatalog;
  if (dom.dexCatalogWall) dom.dexCatalogWall.hidden = !isCatalog;
}

function sortDexCards(cards, sortKey = state.dexSort) {
  const rarityRank = { crown: 4, epic: 3, rare: 2, uncommon: 1, common: 0 };
  const compareNewest = (a, b) => {
    const tA = Number(a.createdAt || a.updatedAt || 0);
    const tB = Number(b.createdAt || b.updatedAt || 0);
    if (tB !== tA) return tB - tA;
    const uA = Number(a.updatedAt || 0);
    const uB = Number(b.updatedAt || 0);
    if (uB !== uA) return uB - uA;
    return String(a.id || '').localeCompare(String(b.id || ''));
  };

  return [...cards].sort((a, b) => {
    if (sortKey === 'rarity') {
      const rDiff = (rarityRank[computeCardRarity(b)] || 0) - (rarityRank[computeCardRarity(a)] || 0);
      if (rDiff !== 0) return rDiff;
      const hpDiff = Number(b.hp || 0) - Number(a.hp || 0);
      return hpDiff !== 0 ? hpDiff : compareNewest(a, b);
    }
    if (sortKey === 'hpDesc') {
      const hpDiff = Number(b.hp || 0) - Number(a.hp || 0);
      return hpDiff !== 0 ? hpDiff : compareNewest(a, b);
    }
    if (sortKey === 'encounters') {
      const encDiff = Number(b.encounters || 1) - Number(a.encounters || 1);
      return encDiff !== 0 ? encDiff : compareNewest(a, b);
    }
    return compareNewest(a, b);
  });
}

function renderDexSubfilters() {
  if (!dom.dexSubfilterBar) return;
  dom.dexSubfilterBar.innerHTML = '';

  if (state.dexDimension === 'rarity') {
    if (dom.dexBreedSubfilterBar) {
      dom.dexBreedSubfilterBar.hidden = true;
      dom.dexBreedSubfilterBar.innerHTML = '';
    }
    const items = [
      { id: 'all', label: '全部品阶' },
      ...CARD_RARITY_PRESETS.map((r) => ({ id: r.id, label: `${r.symbol} ${r.label}` }))
    ];
    for (const it of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dex-sub-pill${it.id === state.dexRarity ? ' is-active' : ''}`;
      btn.textContent = it.label;
      btn.addEventListener('click', () => {
        state.dexRarity = it.id;
        renderDexSubfilters();
        renderDexGrid();
      });
      dom.dexSubfilterBar.appendChild(btn);
    }
    return;
  }

  // 品种等级：一级按物种（猫猫/狗狗/鹦鹉/豚鼠/其他），二级展开该物种具体品种
  const speciesCounts = new Map();
  for (const c of state.cards) {
    const sp = resolveCardSpecies(c);
    speciesCounts.set(sp, (speciesCounts.get(sp) || 0) + 1);
  }
  const speciesItems = [
    { id: 'all', label: `全部物种 (${state.cards.length})` },
    ...PET_SPECIES_PRESETS.map((sp) => ({
      id: sp.id,
      label: `${sp.emoji} ${sp.label} (${speciesCounts.get(sp.id) || 0})`
    }))
  ];
  for (const it of speciesItems) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dex-sub-pill${it.id === state.dexSpecies ? ' is-active' : ''}`;
    btn.textContent = it.label;
    btn.addEventListener('click', () => {
      state.dexSpecies = it.id;
      state.dexBreed = 'all';
      renderDexSubfilters();
      renderDexGrid();
    });
    dom.dexSubfilterBar.appendChild(btn);
  }

  if (dom.dexBreedSubfilterBar) {
    dom.dexBreedSubfilterBar.hidden = false;
    dom.dexBreedSubfilterBar.innerHTML = '';
    const breedCounts = new Map();
    for (const c of state.cards) {
      if (state.dexSpecies !== 'all' && resolveCardSpecies(c) !== state.dexSpecies) continue;
      const b = String(c.breedName || '').trim() || '混血田园喵';
      breedCounts.set(b, (breedCounts.get(b) || 0) + 1);
    }
    const sortedBreeds = Array.from(breedCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (state.dexBreed !== 'all' && !breedCounts.has(state.dexBreed)) state.dexBreed = 'all';
    const breedItems = [
      { id: 'all', label: '全部品种' },
      ...sortedBreeds.map(([name, n]) => ({ id: name, label: `${name} (${n})` }))
    ];
    for (const it of breedItems) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dex-sub-pill${it.id === state.dexBreed ? ' is-active' : ''}`;
      btn.textContent = it.label;
      btn.addEventListener('click', () => {
        state.dexBreed = it.id;
        renderDexSubfilters();
        renderDexGrid();
      });
      dom.dexBreedSubfilterBar.appendChild(btn);
    }
  }
}

function speciesSilhouetteSvg(species, color) {
  const common = `width="26" height="26" viewBox="0 0 24 24" fill="${color}" aria-hidden="true"`;
  if (species === 'cat') {
    return `<svg ${common}><path d="M5 4l3 3.2A6.5 6.5 0 0 1 12 6c1.5 0 2.9.5 4 1.2L19 4v5.5c.6 1 1 2.2 1 3.5 0 4.1-3.6 7-8 7s-8-2.9-8-7c0-1.3.4-2.5 1-3.5V4z"/></svg>`;
  }
  if (species === 'dog') {
    return `<svg ${common}><path d="M4.5 6.5C3.1 7.6 2.5 9.8 3.5 12c.5 1 1.6 1 2 .2l.6-1.2v2.3c0 3.7 2.6 6.2 5.9 6.2s5.9-2.5 5.9-6.2V11l.6 1.2c.4.8 1.5.8 2-.2 1-2.2.4-4.4-1-5.5l-1.8 1.3A6.8 6.8 0 0 0 12 6c-2.1 0-4 .7-5.7 1.8L4.5 6.5z"/></svg>`;
  }
  if (species === 'parrot') {
    return `<svg ${common}><path d="M16 3c-3 0-5.5 2-6.2 4.8L6 16.5l3 1.5 1.8-2.5c2.7-.4 4.8-2.4 5.2-5.1L19 9l-2-1.2C16.8 5.2 17.5 3.6 16 3z"/></svg>`;
  }
  if (species === 'guineaPig') {
    return `<svg ${common}><path d="M5 13c0-3.5 3.1-6 7-6s7 2.5 7 6c0 2.8-2.3 5-5.5 5h-3C7.3 18 5 15.8 5 13zm2.5-5.5C6.5 6.5 5 7 5 8.5c0 .9.7 1.5 1.5 1.5h1.8c-.2-.9-.5-1.7-.8-2.5zm9 0c-.3.8-.6 1.6-.8 2.5h1.8c.8 0 1.5-.6 1.5-1.5 0-1.5-1.5-2-2.5-1z"/></svg>`;
  }
  return `<svg ${common}><circle cx="7" cy="8.5" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="8.5" r="2"/><path d="M12 11c-3.2 0-5.5 2.4-5.5 5 0 1.7 1.4 2.5 3 2.5.9 0 1.7-.3 2.5-.3s1.6.3 2.5.3c1.6 0 3-.8 3-2.5 0-2.6-2.3-5-5.5-5z"/></svg>`;
}

function renderCatalogFilters(unlockedSet = new Set()) {
  const unlockedCount = unlockedSet.size;
  const lockedCount = Math.max(0, PET_CATALOG_BREEDS.length - unlockedCount);

  if (dom.dexCatalogScopeBar) {
    dom.dexCatalogScopeBar.innerHTML = '';
    const scopes = [
      { id: 'all', label: `全部 ${PET_CATALOG_BREEDS.length}` },
      ...PET_SPECIES_PRESETS.map((sp) => {
        const n = PET_CATALOG_BREEDS.filter((b) => b.species === sp.id).length;
        const shortLabel = sp.id === 'other' ? '其他' : sp.label;
        return { id: sp.id, label: `${sp.emoji} ${shortLabel} ${n}` };
      }),
      { id: 'unlocked', label: `已解锁 ${unlockedCount}` },
      { id: 'locked', label: `待发现 ${lockedCount}` }
    ];
    for (const s of scopes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dex-sub-pill${s.id === state.catalogScope ? ' is-active' : ''}`;
      btn.textContent = s.label;
      btn.addEventListener('click', () => {
        state.catalogScope = s.id;
        renderBreedCatalogWall();
      });
      dom.dexCatalogScopeBar.appendChild(btn);
    }
  }

  if (dom.dexCatalogEnergyBar) {
    dom.dexCatalogEnergyBar.innerHTML = '';
    const energies = [
      { id: 'all', label: '全属性' },
      ...ENERGY_TYPES.map((e) => ({ id: e.id, label: `${e.emoji} ${e.label}系` }))
    ];
    for (const e of energies) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dex-sub-pill${e.id === state.catalogEnergy ? ' is-active' : ''}`;
      btn.textContent = e.label;
      btn.addEventListener('click', () => {
        state.catalogEnergy = e.id;
        renderBreedCatalogWall();
      });
      dom.dexCatalogEnergyBar.appendChild(btn);
    }
  }
}

function renderBreedCatalogWall() {
  if (!dom.dexCatalogGrid) return;

  const byBreed = new Map();
  for (const c of state.cards) {
    const match = matchCatalogBreed(c);
    if (!match) continue;
    if (!byBreed.has(match.name)) byBreed.set(match.name, []);
    byBreed.get(match.name).push(c);
  }

  const unlockedSet = new Set(byBreed.keys());
  renderCatalogFilters(unlockedSet);
  if (dom.dexOverviewUnlockedBadge) {
    dom.dexOverviewUnlockedBadge.textContent = `已点亮 ${unlockedSet.size}/${PET_CATALOG_BREEDS.length}`;
  }

  const breeds = PET_CATALOG_BREEDS.filter((b) => {
    const isUnlocked = unlockedSet.has(b.name);
    if (state.catalogScope === 'unlocked' && !isUnlocked) return false;
    if (state.catalogScope === 'locked' && isUnlocked) return false;
    if (!['all', 'unlocked', 'locked'].includes(state.catalogScope) && b.species !== state.catalogScope) return false;
    if (state.catalogEnergy !== 'all' && b.energy !== state.catalogEnergy) return false;
    return true;
  });

  dom.dexCatalogGrid.innerHTML = '';
  for (const b of breeds) {
    const matched = byBreed.get(b.name) || [];
    const unlocked = matched.length > 0;
    const energyMeta = ENERGY_TYPES.find((e) => e.id === b.energy) || ENERGY_TYPES[0];
    const energyColor = energyMeta.orb[0];

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `dex-catalog-cell${unlocked ? ' is-unlocked' : ' is-locked'}`;
    if (unlocked) {
      cell.style.borderColor = `${energyColor}8c`;
    }

    const art = document.createElement('div');
    art.className = 'dex-catalog-art';
    if (unlocked) {
      art.style.background = `${energyColor}38`;
    }

    const repCard = matched.find((c) => c.cutoutSrc) || matched[0];
    if (unlocked && repCard?.cutoutSrc) {
      const img = document.createElement('img');
      img.alt = b.name;
      img.src = repCard.cutoutSrc;
      art.appendChild(img);
    } else {
      const sil = document.createElement('div');
      sil.className = 'dex-catalog-sil';
      sil.innerHTML = speciesSilhouetteSvg(b.species, energyColor);
      art.appendChild(sil);

      const lockTxt = document.createElement('span');
      lockTxt.className = 'dex-catalog-locked-txt';
      lockTxt.textContent = '待发现';
      art.appendChild(lockTxt);
    }

    const orb = document.createElement('span');
    orb.className = 'dex-catalog-orb';
    orb.style.background = energyColor;
    orb.style.color = energyMeta.ink || '#10141c';
    orb.textContent = energyMeta.emoji;
    art.appendChild(orb);

    if (matched.length > 0) {
      const qty = document.createElement('span');
      qty.className = 'dex-catalog-qty';
      qty.textContent = `×${matched.length}`;
      art.appendChild(qty);
    }

    const meta = document.createElement('div');
    meta.className = 'dex-catalog-meta';

    const title = document.createElement('strong');
    title.textContent = b.name;
    const sub = document.createElement('span');
    sub.className = 'dex-catalog-sub';
    if (unlocked) {
      const bestHp = Math.max(...matched.map((c) => Number(c.hp || 0)));
      sub.textContent = `最高 HP ${bestHp}`;
    } else {
      sub.textContent = b.coat || '待发现';
    }
    meta.appendChild(title);
    meta.appendChild(sub);

    cell.appendChild(art);
    cell.appendChild(meta);

    cell.addEventListener('click', () => {
      if (unlocked) {
        const bestCard = [...matched].sort((a, c2) => Number(c2.hp || 0) - Number(a.hp || 0))[0] || matched[0];
        openCardInspectModal(bestCard.id);
      } else {
        showToast(`去「抓拍萌宠」拍摄或上传「${b.name}」即可点亮此图鉴卡位！`);
      }
    });

    dom.dexCatalogGrid.appendChild(cell);
  }
}

async function getCardThumbDataUrl(card) {
  const cutoutSig = card.cutoutSrc
    ? `${card.cutoutSrc.slice(0, 32)}:${card.cutoutSrc.length}:${card.cutoutSrc.slice(-36)}`
    : 'none';
  const fp = [
    card.id,
    cutoutSig,
    card.borderStyle,
    card.backgroundStyle,
    card.petMood || 'auto',
    card.fxPreset,
    card.badgeIcon,
    card.foilIntensity,
    card.name,
    card.customNickname,
    card.suffix,
    card.hp,
    card.energyType,
    card.personalityTag,
    card.hobbyTag,
    card.locationEnabled ? '1' : '0',
    card.locationName || '',
    card.cardBackStyle || 'fullArtPet',
    card.cardBackOrientation || 'auto',
    card.showBackQRCode !== false ? '1' : '0',
    card.subjectOffsetX,
    card.subjectOffsetY,
    card.subjectScale
  ].join('|');

  if (state.dexThumbCache.has(fp)) {
    return state.dexThumbCache.get(fp);
  }

  const img = await loadImageCached(card.cutoutSrc);
  const c = document.createElement('canvas');
  renderCardFrontToCanvas(c, card, img, 1.1);
  const url = c.toDataURL('image/png');
  state.dexThumbCache.set(fp, url);
  return url;
}

async function renderDexGrid() {
  updateDexBadgeCount();
  syncDexModeUI();
  renderDexSubfilters();

  if (state.dexMode === 'catalog') {
    renderBreedCatalogWall();
    return;
  }

  const q = state.dexSearch.trim().toLowerCase();
  const filtered = state.cards.filter((card) => {
    if (state.dexFavOnly && !card.isFavorite) return false;

    if (state.dexDimension === 'rarity' && state.dexRarity !== 'all') {
      if (computeCardRarity(card) !== state.dexRarity) return false;
    } else if (state.dexDimension === 'species') {
      if (state.dexSpecies !== 'all' && resolveCardSpecies(card) !== state.dexSpecies) return false;
      if (state.dexBreed !== 'all') {
        const b = String(card.breedName || '').trim() || '混血田园喵';
        if (b !== state.dexBreed) return false;
      }
    }

    if (!q) return true;
    const hay = `${card.name || ''} ${card.customNickname || ''} ${card.breedName || ''} ${card.coatPattern || ''} ${card.locationName || ''} ${card.personalityTag || ''} ${card.hobbyTag || ''} ${card.attackName || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const ordered = sortDexCards(filtered, state.dexSort);
  dom.dexGrid.innerHTML = '';

  if (ordered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column: 1 / -1; text-align:center; padding: 36px 16px; color: var(--ink-3); border: 1px dashed var(--border); border-radius: var(--r-md);';
    empty.innerHTML = '<strong style="display:block;color:var(--ink-1);margin-bottom:6px;">萌宠图鉴里还没有匹配卡片</strong><span style="font-size:12.5px;">换个筛选或关键词试试，或去「抓拍萌宠 / 制卡工坊」新铸一张闪卡存入图鉴。</span>';
    dom.dexGrid.appendChild(empty);
    return;
  }

  for (const card of ordered) {
    const item = document.createElement('article');
    item.className = 'dex-card';

    const en = getEnergyConfig(card.energyType);
    const thumb = document.createElement('div');
    thumb.className = 'dex-card__thumb';
    const img = document.createElement('img');
    img.alt = getCardDisplayTitle(card);
    if (card.cutoutSrc) img.src = card.cutoutSrc;
    thumb.appendChild(img);

    if (card.isFavorite) {
      const favDot = document.createElement('span');
      favDot.className = 'dex-fav-dot';
      favDot.textContent = '♥';
      favDot.style.color = '#ff6b7d';
      thumb.appendChild(favDot);
    }

    const meta = document.createElement('div');
    meta.className = 'dex-card__meta';
    const title = document.createElement('strong');
    title.textContent = getCardDisplayTitle(card);
    const sub = document.createElement('span');
    sub.textContent = `${en.emoji} HP ${card.hp ?? 180} · ${card.breedName || '萌宠'}`;
    meta.appendChild(title);
    meta.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'dex-card__actions';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'dex-btn';
    btnEdit.textContent = '编辑';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardEditModal(card.id);
    });

    const btn3d = document.createElement('button');
    btn3d.type = 'button';
    btn3d.className = 'dex-btn';
    btn3d.textContent = '3D';
    btn3d.addEventListener('click', async (e) => {
      e.stopPropagation();
      state.currentCard = deepClone(card);
      await ensureCutoutLoaded(state.currentCard);
      syncControlsFromCurrentCard();
      renderStudioNow();
      await switchTab('showcase');
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'dex-btn dex-btn--danger';
    btnDel.textContent = state.pendingDeleteId === card.id ? '确认删?' : '删';
    btnDel.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.pendingDeleteId !== card.id) {
        state.pendingDeleteId = card.id;
        clearTimeout(state.pendingDeleteTimer);
        btnDel.textContent = '确认删?';
        state.pendingDeleteTimer = setTimeout(() => {
          state.pendingDeleteId = null;
          if (btnDel.isConnected) btnDel.textContent = '删';
        }, 2500);
        return;
      }
      state.pendingDeleteId = null;
      clearTimeout(state.pendingDeleteTimer);
      await removeCard(card.id);
      state.cards = state.cards.filter((c) => c.id !== card.id);
      showToast(`已从萌宠图鉴移除「${getCardDisplayTitle(card)}」`);
      await renderDexGrid();
      deleteCardFromCloud(card.id).catch(() => {});
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btn3d);
    actions.appendChild(btnDel);
    actions.addEventListener('click', (e) => e.stopPropagation());

    item.addEventListener('click', () => openCardInspectModal(card.id));

    item.appendChild(thumb);
    item.appendChild(meta);
    item.appendChild(actions);
    dom.dexGrid.appendChild(item);

    // Hydrate full rendered card thumbnail asynchronously
    getCardThumbDataUrl(card).then((url) => {
      if (url && img.isConnected) img.src = url;
    });
  }
}

// ═══════════════════════ INSPECT MODAL (iOS CardInspectView 对齐) & EDIT MODAL ═══════════════════════
function getInspectedCard() {
  return state.cards.find((c) => c.id === state.inspectCardId) || null;
}

function renderInspectModalNow() {
  const card = getInspectedCard();
  if (!card || !dom.modalInspect || dom.modalInspect.hidden) return;

  dom.inspectCardTitle.textContent = `👑 ${getCardDisplayTitle(card)}`;
  dom.btnInspectFav.textContent = card.isFavorite ? '♥' : '♡';
  dom.btnInspectFav.classList.toggle('is-active', Boolean(card.isFavorite));
  dom.btnInspectFlip.textContent = state.isInspectFlipped ? '↻ 看正面' : '↻ 看背面';
  dom.inspectCardFlipper.classList.toggle('is-flipped', state.isInspectFlipped);
  const isLand = state.isInspectFlipped && isLandscapeBackCard(card, state.inspectCutoutImg);
  dom.inspectCardTilt?.classList.toggle('is-landscape-back', isLand);

  const adaptive = resolveAdaptiveFX(card);
  dom.inspectAdaptiveBadge.textContent = `✨ ${adaptive.title}`;

  const isBack = state.isInspectFlipped;
  const ox = Number(isBack ? (card.backSubjectOffsetX || 0) : (card.subjectOffsetX || 0));
  const oy = Number(isBack ? (card.backSubjectOffsetY || 0) : (card.subjectOffsetY || 0));
  const sc = Number(isBack ? (card.backSubjectScale || 1) : (card.subjectScale || 1));
  dom.inspectSliderOx.value = String(ox);
  dom.inspectOxVal.textContent = `${Math.round(ox * 100)}%`;
  dom.inspectSliderOy.value = String(oy);
  dom.inspectOyVal.textContent = `${Math.round(oy * 100)}%`;
  dom.inspectSliderScale.value = String(sc);
  dom.inspectScaleVal.textContent = `${sc.toFixed(2)}×`;

  renderCardFrontToCanvas(dom.inspectCanvasFront, card, state.inspectCutoutImg, 2.2);
  renderCardBackToCanvas(dom.inspectCanvasBack, card, state.inspectCutoutImg, 2.2, state.inspectEmblemImg || null, { presentUpright: true });
}

async function openCardInspectModal(cardId) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card || !dom.modalInspect) return;

  state.inspectCardId = card.id;
  state.isInspectFlipped = false;
  state.isInspectFraming = false;
  dom.inspectCardTilt.classList.remove('is-framing', 'is-landscape-back');
  dom.inspectFramingGuide.hidden = true;
  dom.inspectFramingSliders.hidden = true;
  dom.btnInspectFramingToggle.classList.remove('is-active');
  dom.inspectCardTilt.style.transform = '';
  dom.modalInspect.hidden = false;

  const [cutoutImg, emblemImg] = await Promise.all([
    loadImageCached(card.cutoutSrc),
    state.inspectEmblemImg ? Promise.resolve(state.inspectEmblemImg) : loadImageCached('assets/app-icon.png'),
  ]);
  state.inspectCutoutImg = cutoutImg;
  state.inspectEmblemImg = emblemImg;
  renderInspectModalNow();
}

function openCardEditModal(cardId) {
  const card = state.cards.find((c) => String(c.id) === String(cardId));
  if (!card || !dom.modalCardEdit) {
    showToast('未找到可编辑的卡牌档案，请刷新后重试');
    return;
  }

  state.editCardId = card.id;
  dom.editCardNickname.value = card.customNickname || card.name || '';
  const suffixVal = card.suffix || '';
  if (dom.editCardSuffix) {
    const hasOption = Array.from(dom.editCardSuffix.options).some((o) => o.value === suffixVal);
    dom.editCardSuffix.value = hasOption ? suffixVal : '';
  }
  dom.editCardBreed.value = card.breedName || '';
  dom.editCardCoat.value = card.coatPattern || '';
  dom.editCardPersonality.value = card.personalityTag || card.abilityName || '';
  dom.editCardHobby.value = card.hobbyTag || card.attackName || '';
  dom.editCardAtk.value = card.attackName || '';
  dom.editCardHp.value = String(card.hp ?? 180);
  dom.editCardFlavor.value = card.flavorText || '';
  const locOn = card.locationEnabled === true;
  if (dom.editLocationEnabled) dom.editLocationEnabled.checked = locOn;
  dom.editCardLocation.value = locOn ? sanitizeStreetLocation(card.locationName) : '';
  dom.editCardSerial.value = card.serialNumber || '001/165 ★';
  dom.editBackStyle.value = card.cardBackStyle || 'fullArtPet';
  dom.editBackOrientation.value = card.cardBackOrientation || 'auto';
  dom.editBackQr.checked = card.showBackQRCode !== false;

  const scrollBody = dom.modalCardEdit.querySelector('.form-block');
  if (scrollBody) scrollBody.scrollTop = 0;
  dom.modalCardEdit.hidden = false;
}

async function saveCardEditModal() {
  const idx = state.cards.findIndex((c) => String(c.id) === String(state.editCardId));
  if (idx < 0) return;

  const target = state.cards[idx];
  const nick = dom.editCardNickname.value.trim();
  target.customNickname = nick;
  if (nick) target.name = nick;
  target.suffix = dom.editCardSuffix.value;
  target.breedName = dom.editCardBreed.value.trim() || target.breedName;
  target.coatPattern = dom.editCardCoat.value.trim() || target.coatPattern;
  target.personalityTag = dom.editCardPersonality.value.trim();
  if (target.personalityTag) target.abilityName = target.personalityTag;
  target.hobbyTag = dom.editCardHobby.value.trim();
  target.attackName = dom.editCardAtk.value.trim() || target.attackName;
  target.hp = Math.max(60, Math.min(320, Number(dom.editCardHp.value || target.hp || 180)));
  target.flavorText = dom.editCardFlavor.value.trim();
  const locOn = Boolean(dom.editLocationEnabled?.checked);
  target.locationEnabled = locOn;
  target.locationName = locOn ? sanitizeStreetLocation(dom.editCardLocation.value.trim()) : '保密街区';
  target.serialNumber = dom.editCardSerial.value.trim() || '001/165 ★';
  target.cardBackStyle = dom.editBackStyle.value || 'fullArtPet';
  target.cardBackOrientation = dom.editBackOrientation.value || 'auto';
  target.showBackQRCode = Boolean(dom.editBackQr.checked);
  target.updatedAt = Date.now();

  await upsertCard(target);
  if (state.currentCard.id === target.id) {
    state.currentCard = deepClone(target);
    syncControlsFromCurrentCard();
    renderStudioNow();
  }
  dom.modalCardEdit.hidden = true;
  if (!dom.modalInspect.hidden && state.inspectCardId === target.id) {
    renderInspectModalNow();
  }
  await renderDexGrid();
  showToast(`已保存「${getCardDisplayTitle(target)}」的正背面信息与档案`);

  pushCardToCloud(target, { includeCutout: true }).catch(() => {});
}

// ═══════════════════════ CLOUD AUTH & SYNC UI ═══════════════════════
function refreshCloudSessionUI() {
  const sess = getCloudSession();
  const signedIn = Boolean(sess?.user);
  if (dom.topCloudLabel) {
    dom.topCloudLabel.textContent = signedIn ? `${sess.user.displayName}` : '云端登录';
  }
  dom.btnOpenCloudAuth?.classList.toggle('is-signed-in', signedIn);
  if (dom.btnDexCloudSync) {
    if (signedIn) {
      const lvl = sess.user.trainerLevel || 1;
      dom.btnDexCloudSync.innerHTML = `<span class="dex-lvl-avatar">☁</span><span>Lv.${lvl}</span>`;
    } else {
      dom.btnDexCloudSync.textContent = '💬 云端登录';
    }
    dom.btnDexCloudSync.classList.toggle('is-signed-in', signedIn);
  }
  if (dom.authGuestPanel && dom.authSignedInPanel) {
    dom.authGuestPanel.hidden = signedIn;
    dom.authSignedInPanel.hidden = !signedIn;
    if (signedIn) {
      dom.authProfileName.textContent = `🐾 ${sess.user.displayName}（${sess.user.account}）`;
      dom.authProfileMeta.textContent = `Lv.${sess.user.trainerLevel || 1} · Web 与 iOS App 登录同一账号即可双向实时同步萌宠图鉴`;
    }
  }
  updateDexBadgeCount();
}

function openAuthModal() {
  if (!dom.modalAuth) return;
  if (dom.authErrorMsg) dom.authErrorMsg.hidden = true;
  refreshCloudSessionUI();
  dom.modalAuth.hidden = false;
}

async function runCloudSync({ silent = false } = {}) {
  if (state.isSyncingCloud || !getCloudSession()) return;
  state.isSyncingCloud = true;
  try {
    const res = await syncCardsBidirectional(state.cards, upsertCard);
    state.cards = res.cards;
    state.dexThumbCache.clear();
    refreshCloudSessionUI();
    await renderDexGrid();
    if (!silent) {
      const skippedText = res.skipped ? ` · 重叠跳过 ${res.skipped} 张` : '';
      showToast(`并集同步完成 · 拉取 ${res.downloaded} 张 · 上传 ${res.uploaded} 张${skippedText}`);
    }
  } catch (err) {
    refreshCloudSessionUI();
    if (!silent) {
      showToast(String(err?.message || '云同步失败，请稍后再试'), 3400);
    }
  } finally {
    state.isSyncingCloud = false;
  }
}

// ═══════════════════════ CUTOUT MODAL & BRUSH ═══════════════════════
function renderCutoutEditorCanvas() {
  const { previewCanvas } = state.cutoutEngine.buildCompositeResult();
  const canvas = dom.cutoutCanvas;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (!previewCanvas || previewCanvas.width === 0 || previewCanvas.height === 0) return;

  const scale = Math.min((cw - 24) / previewCanvas.width, (ch - 24) / previewCanvas.height);
  const drawW = Math.round(previewCanvas.width * scale);
  const drawH = Math.round(previewCanvas.height * scale);
  const drawX = Math.round((cw - drawW) * 0.5);
  const drawY = Math.round((ch - drawH) * 0.5);

  state.cutoutDrawRect = { x: drawX, y: drawY, w: drawW, h: drawH };
  ctx.drawImage(previewCanvas, drawX, drawY, drawW, drawH);
}

async function runMattingAndRedraw() {
  const runId = ++state.cutoutRunId;
  const sens = Number(dom.sliderCutoutSens.value || 54) / 100;
  const feather = Number(dom.sliderCutoutFeather.value || 2);
  dom.cutoutSensVal.textContent = `${Math.round(sens * 100)}%`;
  dom.cutoutFeatherVal.textContent = `${feather}px`;

  const t0 = performance.now();
  const job = state.cutoutEngine.runSmartMatting({
    sensitivity: sens,
    feather,
    onStatus: (msg) => {
      if (runId === state.cutoutRunId) dom.cutoutStatusLine.textContent = msg;
    }
  });
  state.activeMattingPromise = job;
  const out = await job;
  if (!out || runId !== state.cutoutRunId) return;

  renderCutoutEditorCanvas();
  const dt = Math.max(1, Math.round(performance.now() - t0));
  const modeLabel =
    out.mode === 'neural'
      ? '端侧 AI 神经网络精抠'
      : out.mode === 'alpha'
        ? '原图透明通道'
        : '端侧导向滤波抠图';
  dom.cutoutStatusLine.textContent = `已完成${modeLabel} (${dt}ms) · 用画笔可直接擦除多余杂物或补回猫毛`;
}

function openCutoutModalWithImage(img) {
  state.cutoutOriginalImg = img;
  state.cutoutHintSpecies = 'auto';
  state.cutoutHintBreed = '';
  syncCutoutSpeciesUI();
  state.cutoutEngine.loadImage(img, 640);
  state.cutoutLoadedSrc = true;
  dom.modalCutout.hidden = false;
  dom.modalCutout.querySelector('.cutout-workspace')?.scrollTo(0, 0);
  renderCutoutEditorCanvas();
  runMattingAndRedraw();
}

function pointerEventToCutoutNorm(e) {
  const rect = dom.cutoutCanvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * dom.cutoutCanvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * dom.cutoutCanvas.height;
  const dr = state.cutoutDrawRect;
  const normX = (cx - dr.x) / Math.max(1, dr.w);
  const normY = (cy - dr.y) / Math.max(1, dr.h);
  return { normX, normY };
}

function paintBrushStroke(prevNorm, nextNorm) {
  const dx = nextNorm.normX - prevNorm.normX;
  const dy = nextNorm.normY - prevNorm.normY;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist * 70));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const nx = prevNorm.normX + dx * t;
    const ny = prevNorm.normY + dy * t;
    if (nx >= -0.05 && nx <= 1.05 && ny >= -0.05 && ny <= 1.05) {
      state.cutoutEngine.applyBrush(nx, ny, state.brushSize, state.brushMode);
    }
  }
  renderCutoutEditorCanvas();
}

// ═══════════════════════ BIND ALL INTERACTIONS ═══════════════════════
function bindEvents() {
  // Tabs (Desktop & Mobile)
  dom.navPills.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  dom.mobileTabs.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // Axis Tabs
  dom.axisTabs.forEach((btn) => btn.addEventListener('click', () => switchAxis(btn.dataset.axis)));

  // Stage quick actions & Front/Back + Landscape controls
  dom.btnEnter3d.addEventListener('click', () => switchTab('showcase'));
  dom.btnFaceFront?.addEventListener('click', () => setStudioFlipped(false));
  dom.btnFaceBack?.addEventListener('click', () => setStudioFlipped(true));
  dom.btnToggleLandscape?.addEventListener('click', () => {
    const currentlyLand = isLandscapeBackCard(state.currentCard, state.activeCutoutImg);
    state.currentCard.cardBackOrientation = currentlyLand ? 'portrait' : 'landscape';
    syncControlsFromCurrentCard();
    renderStudioNow();
    showToast(currentlyLand ? '已切回竖版卡片展示' : '已切换横版大图展示，下方按钮已自动重排');
  });

  dom.btnRandomize.addEventListener('click', () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const realBorders = BORDER_PRESETS.filter((b) => b.id !== 'auto');
    const realBgs = BACKGROUND_PRESETS.filter((b) => b.id !== 'auto');
    const realFx = FX_PRESETS.filter((f) => f.id !== 'auto' && f.id !== 'none');
    const realBadges = BADGE_PRESETS.filter((b) => b.id !== 'auto');

    if (state.isFlipped) {
      state.currentCard.backBorderStyle = pick(realBorders).id;
      state.currentCard.backBackgroundStyle = pick(realBgs).id;
      state.currentCard.backFXPreset = pick(realFx).id;
      state.currentCard.backBadgeIcon = pick(realBadges).id;
      state.currentCard.backFoilIntensity = Number((0.65 + Math.random() * 0.75).toFixed(2));
      showToast('已为背面独立随机混搭一组高罕皮肤');
    } else {
      state.currentCard.borderStyle = pick(realBorders).id;
      state.currentCard.backgroundStyle = pick(realBgs).id;
      state.currentCard.fxPreset = pick(realFx).id;
      state.currentCard.badgeIcon = pick(realBadges).id;
      state.currentCard.foilIntensity = Number((0.65 + Math.random() * 0.75).toFixed(2));
      showToast('已为正面独立随机混搭一组高罕皮肤');
    }
    syncControlsFromCurrentCard();
    renderStudioNow();
  });

  dom.btnRandomizeIos?.addEventListener('click', () => dom.btnRandomize.click());
  dom.btnStudioUpload?.addEventListener('click', () => preloadNeuralMatting());
  dom.btnToggleSources?.addEventListener('click', () => {
    const open = dom.sampleStrip.classList.toggle('is-open');
    dom.btnToggleSources.classList.toggle('is-active', open);
  });

  // Save to CardDex + Cloud
  dom.btnSaveCard.addEventListener('click', async () => {
    const isSample = !state.currentCard.id || String(state.currentCard.id).startsWith('sample-');
    if (isSample) {
      const idx = state.cards.length + 1;
      state.currentCard.id = crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`;
      state.currentCard.serialNumber = `${String(idx).padStart(3, '0')}/165 ★`;
    }
    state.currentCard.createdAt = state.currentCard.createdAt || Date.now();
    state.currentCard.updatedAt = Date.now();
    const saved = await upsertCard(state.currentCard);
    const existingIdx = state.cards.findIndex((c) => c.id === saved.id);
    if (existingIdx >= 0) {
      state.cards[existingIdx] = saved;
    } else {
      state.cards.unshift(saved);
    }
    updateDexBadgeCount();
    showToast(`「${getCardDisplayTitle(saved)}」已存入萌宠图鉴`);
    pushCardToCloud(saved, { includeCutout: true }).catch(() => {});
  });

  // 4K Export (Studio & Showcase) -> Exact 63x88mm (3024x4224px)
  const trigger4KDownload = async () => {
    try {
      const side = state.activeTab === 'studio' && state.isFlipped ? 'back' : 'front';
      showToast('正在渲染 3024×4224（63×88mm 标准尺寸）4K PNG…', 4000);
      const blob = await exportCard4KBlob(state.currentCard, state.activeCutoutImg, { side });
      if (!blob) {
        showToast('导出失败，请重试');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = getCardDisplayTitle(state.currentCard).replace(/[\\/:*?"<>|\s]+/g, '_');
      a.href = url;
      a.download = `${safeTitle}_${side}_63x88mm_4K.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast('63×88mm 宝可梦标准 4K 无损 PNG（3024×4224）已下载');
    } catch {
      showToast('4K 渲染过程中出现错误');
    }
  };
  dom.btnExport4k.addEventListener('click', trigger4KDownload);
  dom.btn3dExport4k.addEventListener('click', trigger4KDownload);

  // Studio Card Interactive Tilt, Smooth Single-Tap Flip & Independent Front/Back Framing Drag
  dom.cardTilt.addEventListener('pointerdown', (e) => {
    if (state.activeAxis === 'framing') {
      state.isDraggingFraming = true;
      dom.cardTilt.setPointerCapture(e.pointerId);
      const isBack = state.isFlipped;
      state.framingStart = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: Number(isBack ? (state.currentCard.backSubjectOffsetX || 0) : (state.currentCard.subjectOffsetX || 0)),
        oy: Number(isBack ? (state.currentCard.backSubjectOffsetY || 0) : (state.currentCard.subjectOffsetY || 0))
      };
      return;
    }
    state.cardPointerDownPos = { x: e.clientX, y: e.clientY, t: performance.now() };
  });

  dom.cardTilt.addEventListener('pointermove', (e) => {
    const rect = dom.cardTilt.getBoundingClientRect();
    if (state.activeAxis === 'framing') {
      if (!state.isDraggingFraming) return;
      const dx = (e.clientX - state.framingStart.clientX) / Math.max(120, rect.width);
      const dy = (e.clientY - state.framingStart.clientY) / Math.max(120, rect.height);
      const nextX = Math.max(-0.4, Math.min(0.4, Number((state.framingStart.ox + dx * 1.15).toFixed(2))));
      const nextY = Math.max(-0.4, Math.min(0.4, Number((state.framingStart.oy + dy * 1.15).toFixed(2))));
      if (state.isFlipped) {
        state.currentCard.backSubjectOffsetX = nextX;
        state.currentCard.backSubjectOffsetY = nextY;
      } else {
        state.currentCard.subjectOffsetX = nextX;
        state.currentCard.subjectOffsetY = nextY;
      }
      syncControlsFromCurrentCard();
      scheduleStudioRender();
      return;
    }

    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    const ry = (nx - 0.5) * 14;
    const rx = -(ny - 0.5) * 12;
    dom.cardTilt.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    dom.cardSheen.style.setProperty('--gx', `${(nx * 100).toFixed(1)}%`);
    dom.cardSheen.style.setProperty('--gy', `${(ny * 100).toFixed(1)}%`);
  });

  const endTiltOrDrag = (e) => {
    state.isDraggingFraming = false;
    if (state.activeAxis !== 'framing') {
      dom.cardTilt.style.transform = '';
      if (e && e.type === 'pointerup' && state.cardPointerDownPos) {
        const dist = Math.hypot(e.clientX - state.cardPointerDownPos.x, e.clientY - state.cardPointerDownPos.y);
        const elapsed = performance.now() - state.cardPointerDownPos.t;
        if (dist < 10 && elapsed < 500) {
          setStudioFlipped(!state.isFlipped);
        }
      }
    }
    state.cardPointerDownPos = null;
  };
  dom.cardTilt.addEventListener('pointerleave', () => endTiltOrDrag(null));
  dom.cardTilt.addEventListener('pointerup', endTiltOrDrag);
  dom.cardTilt.addEventListener('pointercancel', () => endTiltOrDrag(null));

  dom.cardTilt.addEventListener('wheel', (e) => {
    if (state.activeAxis !== 'framing') return;
    e.preventDefault();
    const isBack = state.isFlipped;
    const cur = Number(isBack ? (state.currentCard.backSubjectScale || 1) : (state.currentCard.subjectScale || 1));
    const next = Math.max(0.7, Math.min(1.85, Number((cur - Math.sign(e.deltaY) * 0.06).toFixed(2))));
    if (isBack) state.currentCard.backSubjectScale = next;
    else state.currentCard.subjectScale = next;
    syncControlsFromCurrentCard();
    scheduleStudioRender();
  }, { passive: false });

  // Foil intensity (independent per face)
  dom.foilSlider.addEventListener('input', () => {
    const val = Number(dom.foilSlider.value);
    if (state.isFlipped) state.currentCard.backFoilIntensity = val;
    else state.currentCard.foilIntensity = val;
    dom.foilVal.textContent = `${Math.round(val * 100)}%`;
    scheduleStudioRender();
  });

  // Badge & Text Form inputs
  dom.inputName.addEventListener('input', () => {
    state.currentCard.customNickname = dom.inputName.value;
    state.currentCard.name = dom.inputName.value || '神秘猫猫';
    scheduleStudioRender();
  });
  dom.inputBreed.addEventListener('input', () => {
    state.currentCard.breedName = dom.inputBreed.value;
    scheduleStudioRender();
  });
  dom.inputCoat.addEventListener('input', () => {
    state.currentCard.coatPattern = dom.inputCoat.value;
    scheduleStudioRender();
  });
  dom.inputHp.addEventListener('input', () => {
    const val = Number(dom.inputHp.value || 180);
    state.currentCard.hp = val;
    dom.hpVal.textContent = String(val);
    scheduleStudioRender();
  });
  dom.suffixBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentCard.suffix = btn.dataset.suffix;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
  });
  dom.inputAtkName.addEventListener('input', () => {
    state.currentCard.attackName = dom.inputAtkName.value;
    scheduleStudioRender();
  });
  dom.inputAtkDmg.addEventListener('input', () => {
    state.currentCard.attackDamage = Math.max(10, Math.min(300, Number(dom.inputAtkDmg.value || 100)));
    scheduleStudioRender();
  });
  dom.inputFlavor.addEventListener('input', () => {
    state.currentCard.flavorText = dom.inputFlavor.value;
    scheduleStudioRender();
  });
  dom.inputPersonality?.addEventListener('input', () => {
    state.currentCard.personalityTag = dom.inputPersonality.value;
    state.currentCard.abilityName = dom.inputPersonality.value || state.currentCard.abilityName;
    scheduleStudioRender();
  });
  dom.inputHobby?.addEventListener('input', () => {
    state.currentCard.hobbyTag = dom.inputHobby.value;
    scheduleStudioRender();
  });
  dom.studioBackStyleBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentCard.cardBackStyle = btn.dataset.backStyle;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
  });
  dom.studioBackOrientBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentCard.cardBackOrientation = btn.dataset.backOrient;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
  });
  dom.chkBackQr?.addEventListener('change', () => {
    state.currentCard.showBackQRCode = dom.chkBackQr.checked;
    scheduleStudioRender();
  });
  dom.chkLocationEnabled?.addEventListener('change', () => {
    if (dom.chkLocationEnabled.checked) {
      requestStreetLocation(state.currentCard, { forceAsk: state.locationConsent !== 'granted' });
    } else {
      state.currentCard.locationEnabled = false;
      state.currentCard.locationName = '保密街区';
      syncControlsFromCurrentCard();
      scheduleStudioRender();
      showToast('已关闭定位显示，保护宠物安全');
    }
  });
  dom.btnRequestStreetLoc?.addEventListener('click', () => {
    requestStreetLocation(state.currentCard, { forceAsk: state.locationConsent === 'denied' });
  });
  dom.inputCardLocation?.addEventListener('change', () => {
    const safe = sanitizeStreetLocation(dom.inputCardLocation.value);
    state.currentCard.locationName = safe;
    dom.inputCardLocation.value = safe;
    scheduleStudioRender();
  });

  // Framing sliders (independent per face)
  dom.sliderOx.addEventListener('input', () => {
    const v = Number(dom.sliderOx.value);
    if (state.isFlipped) state.currentCard.backSubjectOffsetX = v;
    else state.currentCard.subjectOffsetX = v;
    dom.oxVal.textContent = `${Math.round(v * 100)}%`;
    scheduleStudioRender();
  });
  dom.sliderOy.addEventListener('input', () => {
    const v = Number(dom.sliderOy.value);
    if (state.isFlipped) state.currentCard.backSubjectOffsetY = v;
    else state.currentCard.subjectOffsetY = v;
    dom.oyVal.textContent = `${Math.round(v * 100)}%`;
    scheduleStudioRender();
  });
  dom.sliderScale.addEventListener('input', () => {
    const v = Number(dom.sliderScale.value);
    if (state.isFlipped) state.currentCard.backSubjectScale = v;
    else state.currentCard.subjectScale = v;
    dom.scaleVal.textContent = `${v.toFixed(2)}×`;
    scheduleStudioRender();
  });
  dom.btnResetFraming.addEventListener('click', () => {
    if (state.isFlipped) {
      state.currentCard.backSubjectOffsetX = 0;
      state.currentCard.backSubjectOffsetY = 0;
      state.currentCard.backSubjectScale = 1;
    } else {
      state.currentCard.subjectOffsetX = 0;
      state.currentCard.subjectOffsetY = 0;
      state.currentCard.subjectScale = 1;
    }
    syncControlsFromCurrentCard();
    scheduleStudioRender();
  });
  dom.btnReeditCutout.addEventListener('click', () => {
    if (state.cutoutLoadedSrc) {
      dom.modalCutout.hidden = false;
      dom.modalCutout.querySelector('.cutout-workspace')?.scrollTo(0, 0);
      renderCutoutEditorCanvas();
    } else {
      dom.photoFileInput.click();
    }
  });

  // 3D Showcase Dock controls
  dom.camBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.camBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      state.showcase?.setCameraPreset(btn.dataset.cam);
    });
  });
  dom.zoomPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.zoomPills.forEach((b) => b.classList.toggle('is-active', b === btn));
      state.showcase?.setZoom(Number(btn.dataset.zoom));
    });
  });
  dom.lightPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.lightPills.forEach((b) => b.classList.toggle('is-active', b === btn));
      state.showcase?.setLighting(btn.dataset.light);
    });
  });
  dom.btnToggleSpin.addEventListener('click', () => {
    const next = !dom.btnToggleSpin.classList.contains('is-on');
    dom.btnToggleSpin.classList.toggle('is-on', next);
    state.showcase?.setAutoSpin(next);
  });
  dom.btnToggleSlab.addEventListener('click', () => {
    const next = !dom.btnToggleSlab.classList.contains('is-on');
    dom.btnToggleSlab.classList.toggle('is-on', next);
    state.showcase?.setSlabVisible(next);
  });

  // CardDex Search, Filter, Mode Switch, Sort & Backup
  dom.dexSearch.addEventListener('input', () => {
    state.dexSearch = dom.dexSearch.value;
    renderDexGrid();
  });
  dom.btnDexFav?.addEventListener('click', () => {
    state.dexFavOnly = !state.dexFavOnly;
    dom.btnDexFav.classList.toggle('is-active', state.dexFavOnly);
    dom.btnDexFav.setAttribute('aria-pressed', state.dexFavOnly ? 'true' : 'false');
    dom.btnDexFav.textContent = state.dexFavOnly ? '♥ 仅收藏' : '♡ 收藏';
    renderDexGrid();
  });
  dom.dexSortSelect?.addEventListener('change', () => {
    state.dexSort = dom.dexSortSelect.value || 'newest';
    renderDexGrid();
  });
  if (dom.dexModeBar) {
    $$('.dex-mode-btn', dom.dexModeBar).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.dexMode = btn.dataset.dexMode === 'catalog' ? 'catalog' : 'cards';
        renderDexGrid();
      });
    });
  }
  if (dom.dexDimensionBar) {
    $$('.dex-dim-pill', dom.dexDimensionBar).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.dexDimension = btn.dataset.dim || 'rarity';
        $$('.dex-dim-pill', dom.dexDimensionBar).forEach((el) => {
          el.classList.toggle('is-active', el.dataset.dim === state.dexDimension);
        });
        renderDexGrid();
      });
    });
  }
  dom.btnDexCloudInline?.addEventListener('click', () => {
    if (getCloudSession()) {
      openAuthModal();
      runCloudSync({ silent: false });
    } else {
      openAuthModal();
    }
  });
  dom.btnBackupExport?.addEventListener('click', () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'CatchCat-WebApp', cards: state.cards }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catchcat-carddex-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast('已导出本机卡册 JSON 备份');
  });
  dom.backupFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.cards) ? parsed.cards : []);
      if (!list.length) {
        showToast('备份文件里没有可导入的卡牌数据');
        return;
      }
      for (const c of list) {
        if (c && c.id && c.name) await upsertCard(c);
      }
      state.cards = await loadAllCards();
      await renderDexGrid();
      showToast(`已成功恢复 ${list.length} 张主子闪卡`);
    } catch {
      showToast('备份文件格式有误，无法解析');
    }
  });

  // Capture Tab controls
  dom.btnEnableCamera?.addEventListener('click', () => {
    preloadNeuralMatting();
    startCameraStream(true);
  });
  dom.btnDemoCapture?.addEventListener('click', async () => {
    preloadNeuralMatting();
    const pick = SAMPLE_CARDS[Math.floor(Math.random() * SAMPLE_CARDS.length)];
    const img = await loadImageCached(pick.cutoutSrc);
    if (img) openCutoutModalWithImage(img);
  });
  dom.btnToggleSnackSpecies?.addEventListener('click', () => {
    state.snackSpecies = state.snackSpecies === 'cat' ? 'dog' : 'cat';
    renderSnackGrid();
  });
  dom.btnCaptureAlbum?.addEventListener('click', () => {
    preloadNeuralMatting();
    dom.photoFileInput.click();
  });
  dom.btnShutter?.addEventListener('click', () => {
    preloadNeuralMatting();
    captureFromVideoOrFallback();
  });
  dom.btnCaptureAi?.addEventListener('click', () => {
    const cfg = getAISettings();
    saveAISettings({ endpoint: cfg.endpoint, localOnly: !cfg.localOnly });
    syncCaptureHUD();
    showToast(!cfg.localOnly ? '已切换为纯浏览器端侧秒级识宠' : '已开启云端 VisionProxy 智能识宠');
  });
  dom.btnToggleTorch?.addEventListener('click', async () => {
    const track = state.captureStream?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !state.captureTorchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      state.captureTorchOn = next;
      dom.btnToggleTorch.classList.toggle('is-on', next);
    } catch {
      showToast('当前设备暂不支持网页控制闪光灯');
    }
  });

  // Photo Upload / System Camera Fallback -> Cutout Modal
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      openCutoutModalWithImage(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      showToast('无法解码这张图片，换一张试试');
    };
    img.src = objUrl;
  };
  dom.photoFileInput.addEventListener('change', handleFileInputChange);
  dom.cameraFallbackInput?.addEventListener('change', handleFileInputChange);

  // Cutout Controls & Interactive Painting
  dom.btnCloseCutout.addEventListener('click', () => {
    dom.modalCutout.hidden = true;
  });
  dom.brushBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.brushMode = btn.dataset.mode;
      dom.brushBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });
  dom.sliderBrushSize.addEventListener('input', () => {
    state.brushSize = Number(dom.sliderBrushSize.value || 26);
    dom.brushSizeVal.textContent = `${state.brushSize}px`;
  });
  dom.sliderCutoutSens.addEventListener('change', runMattingAndRedraw);
  dom.sliderCutoutSens.addEventListener('input', () => {
    dom.cutoutSensVal.textContent = `${dom.sliderCutoutSens.value}%`;
  });
  dom.sliderCutoutFeather.addEventListener('change', runMattingAndRedraw);
  dom.sliderCutoutFeather.addEventListener('input', () => {
    dom.cutoutFeatherVal.textContent = `${dom.sliderCutoutFeather.value}px`;
  });
  dom.btnCutoutReset.addEventListener('click', () => {
    state.cutoutEngine.resetManualEdits();
    runMattingAndRedraw();
  });
  dom.cutoutSpeciesBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cutoutHintSpecies = btn.dataset.species || 'auto';
      if (state.cutoutHintSpecies !== 'dog' && state.cutoutHintBreed) {
        const picked = BREED_QUICK_PICKS.find((b) => b.label === state.cutoutHintBreed);
        if (picked && picked.species !== state.cutoutHintSpecies) state.cutoutHintBreed = '';
      }
      syncCutoutSpeciesUI();
    });
  });

  dom.cutoutCanvas.addEventListener('pointerdown', (e) => {
    if (!state.cutoutLoadedSrc) return;
    state.isPaintingBrush = true;
    dom.cutoutCanvas.setPointerCapture(e.pointerId);
    const p = pointerEventToCutoutNorm(e);
    state.lastBrushNorm = p;
    paintBrushStroke(p, p);
  });
  dom.cutoutCanvas.addEventListener('pointermove', (e) => {
    if (!state.isPaintingBrush) return;
    const p = pointerEventToCutoutNorm(e);
    paintBrushStroke(state.lastBrushNorm || p, p);
    state.lastBrushNorm = p;
  });
  const endBrush = () => {
    state.isPaintingBrush = false;
    state.lastBrushNorm = null;
  };
  dom.cutoutCanvas.addEventListener('pointerup', endBrush);
  dom.cutoutCanvas.addEventListener('pointercancel', endBrush);

  const finalizePhotoIntoStudio = async (dataUrl, runAi) => {
    dom.modalCutout.hidden = true;
    state.uploadedCustomSrc = dataUrl;
    state.currentCard = {
      ...deepClone(state.currentCard),
      id: crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`,
      serialNumber: `${String(state.cards.length + 1).padStart(3, '0')}/165 ★`,
      cutoutSrc: dataUrl,
      backgroundStyle: runAi ? 'auto' : (state.currentCard.backgroundStyle || 'auto'),
      petMood: runAi ? 'auto' : (state.currentCard.petMood || 'auto'),
      cardBackStyle: state.currentCard.cardBackStyle || 'fullArtPet',
      cardBackOrientation: state.currentCard.cardBackOrientation || 'auto',
      subjectOffsetX: 0,
      subjectOffsetY: 0,
      subjectScale: 1,
      backSubjectOffsetX: 0,
      backSubjectOffsetY: 0,
      backSubjectScale: 1,
      locationEnabled: state.locationConsent === 'granted',
      locationName: '保密街区',
      createdAt: Date.now()
    };

    renderSampleStrip();
    const img = await ensureCutoutLoaded(state.currentCard);
    syncControlsFromCurrentCard();
    renderStudioNow();
    await switchTab('studio');

    let matchHintNote = '';
    if (runAi && img) {
      showToast('抠图已上线，正在智能鉴定品种、性格与炫彩场景…', 3000);
      const aiMeta = await analyzePetSmart(img, {
        originalEl: state.cutoutOriginalImg || img,
        hintSpecies: state.cutoutHintSpecies,
        hintBreed: state.cutoutHintBreed
      });
      if (aiMeta) {
        state.currentCard.name = aiMeta.name || state.currentCard.name;
        state.currentCard.customNickname = '';
        state.currentCard.breedName = aiMeta.breedName || state.currentCard.breedName;
        state.currentCard.coatPattern = aiMeta.coatPattern || state.currentCard.coatPattern;
        state.currentCard.energyType = aiMeta.energyType || state.currentCard.energyType;
        state.currentCard.hp = aiMeta.hp || state.currentCard.hp;
        state.currentCard.suffix = aiMeta.suffix ?? state.currentCard.suffix;
        state.currentCard.personalityTag = aiMeta.personalityTag || aiMeta.abilityName || state.currentCard.personalityTag;
        state.currentCard.hobbyTag = aiMeta.hobbyTag || aiMeta.attackName || state.currentCard.hobbyTag;
        state.currentCard.abilityName = aiMeta.abilityName || state.currentCard.abilityName;
        state.currentCard.abilityDesc = aiMeta.abilityDesc || state.currentCard.abilityDesc;
        state.currentCard.attackName = aiMeta.attackName || state.currentCard.attackName;
        state.currentCard.attackDamage = aiMeta.attackDamage || state.currentCard.attackDamage;
        state.currentCard.flavorText = aiMeta.flavorText || state.currentCard.flavorText;
        state.currentCard.petMood = aiMeta.petMood || 'auto';
        state.currentCard.backgroundStyle = 'auto';
        const matchedBgId = resolveEffectiveBgId(state.currentCard, img);
        const matchedBgPreset = BACKGROUND_PRESETS.find((b) => b.id === matchedBgId);
        if (aiMeta.moodLabel && matchedBgPreset) {
          matchHintNote = ` · 「${aiMeta.moodLabel}」自动贴合「${matchedBgPreset.name}」`;
        }
      }
    }

    // Apply Snack Feeding Buffs & Trainer XP
    const buffHp = state.sessionBuff.hpBonus;
    const buffEx = state.sessionBuff.exBoost;
    if (buffHp > 0) {
      state.currentCard.hp = Math.min(320, Number(state.currentCard.hp || 180) + buffHp);
    }
    if (buffEx >= 15) {
      state.currentCard.suffix = state.currentCard.suffix === 'ex' ? 'VSTAR' : 'ex';
    }
    state.sessionBuff = { hpBonus: 0, exBoost: 0, count: 0 };
    grantTrainerXP(20);
    syncCaptureHUD();

    syncControlsFromCurrentCard();
    renderStudioNow();

    const buffNote = buffHp > 0 ? `（含投喂加成 HP+${buffHp}${buffEx >= 15 ? ' · 稀有进阶' : ''}）` : '';
    showToast(`已鉴定为「${state.currentCard.breedName} · ${state.currentCard.coatPattern}」${matchHintNote}${buffNote}`, 3400);
    if (state.locationConsent === 'unasked') {
      setTimeout(() => requestStreetLocation(state.currentCard, { forceAsk: true }), 450);
    } else if (state.locationConsent === 'granted') {
      requestStreetLocation(state.currentCard, { forceAsk: false });
    }
  };

  dom.btnCutoutUseFull.addEventListener('click', () => {
    state.cutoutRunId += 1;
    const orig = state.cutoutEngine.exportUncroppedOriginal();
    if (!orig) return;
    finalizePhotoIntoStudio(orig, dom.chkAutoAi.checked);
  });

  dom.btnCutoutConfirm.addEventListener('click', async () => {
    if (state.activeMattingPromise) {
      try {
        await state.activeMattingPromise;
      } catch {}
    }
    const { tightDataUrl } = state.cutoutEngine.buildCompositeResult();
    finalizePhotoIntoStudio(tightDataUrl, dom.chkAutoAi.checked);
  });

  // AI Settings Modal
  dom.btnOpenAiSettings.addEventListener('click', () => {
    const cfg = getAISettings();
    dom.inputVisionUrl.value = cfg.endpoint;
    dom.chkLocalOnly.checked = cfg.localOnly;
    dom.modalAiSettings.hidden = false;
  });
  dom.btnCloseAiSettings.addEventListener('click', () => {
    dom.modalAiSettings.hidden = true;
  });
  dom.btnSaveAiSettings.addEventListener('click', () => {
    saveAISettings({
      endpoint: dom.inputVisionUrl.value,
      localOnly: dom.chkLocalOnly.checked
    });
    syncCaptureHUD();
    dom.modalAiSettings.hidden = true;
    showToast(dom.chkLocalOnly.checked ? '已切换为纯浏览器端侧秒级识宠' : '已保存云端 VisionProxy 配置');
  });

  // Backdrop click / Escape to close modals
  [dom.modalCutout, dom.modalAiSettings, dom.modalCardEdit, dom.modalAuth].forEach((backdrop) => {
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.hidden = true;
    });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dom.modalCutout.hidden = true;
      dom.modalAiSettings.hidden = true;
      if (dom.modalCardEdit) dom.modalCardEdit.hidden = true;
      if (dom.modalAuth) dom.modalAuth.hidden = true;
      if (dom.modalInspect) dom.modalInspect.hidden = true;
    }
  });

  // ── Inspect Modal Events (iOS CardInspectView 交互克隆) ──
  dom.btnInspectClose?.addEventListener('click', () => {
    dom.modalInspect.hidden = true;
  });
  dom.btnInspect3d?.addEventListener('click', async () => {
    const card = getInspectedCard();
    if (!card) return;
    dom.modalInspect.hidden = true;
    state.currentCard = deepClone(card);
    await ensureCutoutLoaded(state.currentCard);
    syncControlsFromCurrentCard();
    renderStudioNow();
    await switchTab('showcase');
  });
  dom.btnInspectEdit?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = state.inspectCardId || getInspectedCard()?.id;
    if (targetId) openCardEditModal(targetId);
  });
  dom.btnInspectArchive?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = state.inspectCardId || getInspectedCard()?.id;
    if (targetId) openCardEditModal(targetId);
  });
  dom.btnInspectFav?.addEventListener('click', async () => {
    const card = getInspectedCard();
    if (!card) return;
    card.isFavorite = !card.isFavorite;
    card.updatedAt = Date.now();
    await upsertCard(card);
    renderInspectModalNow();
    await renderDexGrid();
    pushCardToCloud(card, { includeCutout: false }).catch(() => {});
  });
  dom.btnInspectDelete?.addEventListener('click', async () => {
    const card = getInspectedCard();
    if (!card) return;
    if (!window.confirm(`确定从萌宠图鉴中删除「${getCardDisplayTitle(card)}」吗？`)) return;
    await removeCard(card.id);
    state.cards = state.cards.filter((c) => c.id !== card.id);
    dom.modalInspect.hidden = true;
    await renderDexGrid();
    showToast(`已移除「${getCardDisplayTitle(card)}」`);
    deleteCardFromCloud(card.id).catch(() => {});
  });
  dom.btnInspectFlip?.addEventListener('click', () => {
    state.isInspectFlipped = !state.isInspectFlipped;
    renderInspectModalNow();
  });
  dom.btnInspectFramingToggle?.addEventListener('click', () => {
    state.isInspectFraming = !state.isInspectFraming;
    dom.btnInspectFramingToggle.classList.toggle('is-active', state.isInspectFraming);
    dom.inspectCardTilt.classList.toggle('is-framing', state.isInspectFraming);
    dom.inspectFramingGuide.hidden = !state.isInspectFraming;
    dom.inspectFramingSliders.hidden = !state.isInspectFraming;
    if (state.isInspectFraming) {
      dom.inspectCardTilt.style.transform = '';
      renderInspectModalNow();
    }
  });
  dom.btnInspectFramingReset?.addEventListener('click', async () => {
    const card = getInspectedCard();
    if (!card) return;
    if (state.isInspectFlipped) {
      card.backSubjectOffsetX = 0;
      card.backSubjectOffsetY = 0;
      card.backSubjectScale = 1.0;
    } else {
      card.subjectOffsetX = 0;
      card.subjectOffsetY = 0;
      card.subjectScale = 1.0;
    }
    card.updatedAt = Date.now();
    await upsertCard(card);
    renderInspectModalNow();
    await renderDexGrid();
  });
  const updateInspectFramingValue = async () => {
    const card = getInspectedCard();
    if (!card) return;
    card.updatedAt = Date.now();
    renderInspectModalNow();
    await upsertCard(card);
    renderDexGrid();
  };
  dom.inspectSliderOx?.addEventListener('input', () => {
    const card = getInspectedCard();
    if (!card) return;
    if (state.isInspectFlipped) card.backSubjectOffsetX = Number(dom.inspectSliderOx.value);
    else card.subjectOffsetX = Number(dom.inspectSliderOx.value);
    updateInspectFramingValue();
  });
  dom.inspectSliderOy?.addEventListener('input', () => {
    const card = getInspectedCard();
    if (!card) return;
    if (state.isInspectFlipped) card.backSubjectOffsetY = Number(dom.inspectSliderOy.value);
    else card.subjectOffsetY = Number(dom.inspectSliderOy.value);
    updateInspectFramingValue();
  });
  dom.inspectSliderScale?.addEventListener('input', () => {
    const card = getInspectedCard();
    if (!card) return;
    if (state.isInspectFlipped) card.backSubjectScale = Number(dom.inspectSliderScale.value);
    else card.subjectScale = Number(dom.inspectSliderScale.value);
    updateInspectFramingValue();
  });

  let inspectFramingActive = false;
  dom.inspectCardTilt?.addEventListener('pointerdown', (e) => {
    const card = getInspectedCard();
    if (!card) return;
    if (state.isInspectFraming) {
      inspectFramingActive = true;
      dom.inspectCardTilt.setPointerCapture(e.pointerId);
      const isBack = state.isInspectFlipped;
      state.inspectDragStart = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: Number(isBack ? (card.backSubjectOffsetX || 0) : (card.subjectOffsetX || 0)),
        oy: Number(isBack ? (card.backSubjectOffsetY || 0) : (card.subjectOffsetY || 0))
      };
      return;
    }
    state.inspectPointerDownPos = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  dom.inspectCardTilt?.addEventListener('pointermove', (e) => {
    const card = getInspectedCard();
    if (!card) return;
    const rect = dom.inspectCardTilt.getBoundingClientRect();
    if (state.isInspectFraming && inspectFramingActive) {
      const dx = (e.clientX - state.inspectDragStart.clientX) / Math.max(120, rect.width);
      const dy = (e.clientY - state.inspectDragStart.clientY) / Math.max(120, rect.height);
      const nextX = Math.max(-0.4, Math.min(0.4, Number((state.inspectDragStart.ox + dx * 1.1).toFixed(2))));
      const nextY = Math.max(-0.4, Math.min(0.4, Number((state.inspectDragStart.oy + dy * 1.1).toFixed(2))));
      if (state.isInspectFlipped) {
        card.backSubjectOffsetX = nextX;
        card.backSubjectOffsetY = nextY;
      } else {
        card.subjectOffsetX = nextX;
        card.subjectOffsetY = nextY;
      }
      updateInspectFramingValue();
      return;
    }
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    dom.inspectCardTilt.style.transform = `rotateX(${(-(ny - 0.5) * 14).toFixed(2)}deg) rotateY(${((nx - 0.5) * 16).toFixed(2)}deg)`;
    dom.inspectCardSheen.style.setProperty('--gx', `${(nx * 100).toFixed(1)}%`);
    dom.inspectCardSheen.style.setProperty('--gy', `${(ny * 100).toFixed(1)}%`);
  });
  const resetInspectTilt = (e) => {
    inspectFramingActive = false;
    if (!state.isInspectFraming && dom.inspectCardTilt) {
      dom.inspectCardTilt.style.transform = '';
      if (e && e.type === 'pointerup' && state.inspectPointerDownPos) {
        const dist = Math.hypot(e.clientX - state.inspectPointerDownPos.x, e.clientY - state.inspectPointerDownPos.y);
        const elapsed = performance.now() - state.inspectPointerDownPos.t;
        if (dist < 10 && elapsed < 500) {
          state.isInspectFlipped = !state.isInspectFlipped;
          renderInspectModalNow();
        }
      }
    }
    state.inspectPointerDownPos = null;
  };
  dom.inspectCardTilt?.addEventListener('pointerup', resetInspectTilt);
  dom.inspectCardTilt?.addEventListener('pointerleave', () => resetInspectTilt(null));
  dom.inspectCardTilt?.addEventListener('pointercancel', () => resetInspectTilt(null));

  dom.btnInspectExport?.addEventListener('click', async () => {
    const card = getInspectedCard();
    if (!card) return;
    const side = state.isInspectFlipped ? 'back' : 'front';
    showToast('正在导出 63×88mm（3024×4224px）宝可梦标准 4K PNG…', 4000);
    const blob = await exportCard4KBlob(card, state.inspectCutoutImg, { side });
    if (!blob) {
      showToast('导出失败，请重试');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getCardDisplayTitle(card).replace(/[\\/:*?"<>|\s]+/g, '_')}_${side}_63x88mm_4K.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast('已下载 63×88mm 实体规格 4K PNG');
  });

  // ── Card Edit Modal Events ──
  dom.btnCloseCardEdit?.addEventListener('click', () => {
    dom.modalCardEdit.hidden = true;
  });
  dom.btnSaveCardEdit?.addEventListener('click', saveCardEditModal);
  dom.btnEditOpenStudio?.addEventListener('click', async () => {
    const card = state.cards.find((c) => c.id === state.editCardId);
    if (!card) return;
    dom.modalCardEdit.hidden = true;
    dom.modalInspect.hidden = true;
    state.currentCard = deepClone(card);
    state.isFlipped = false;
    dom.cardFlipper.classList.remove('is-flipped');
    await ensureCutoutLoaded(state.currentCard);
    syncControlsFromCurrentCard();
    renderStudioNow();
    await switchTab('studio');
  });

  // ── Cloud Auth Modal Events ──
  dom.btnOpenCloudAuth?.addEventListener('click', openAuthModal);
  dom.btnDexCloudSync?.addEventListener('click', () => {
    if (getCloudSession()) {
      openAuthModal();
      runCloudSync({ silent: false });
    } else {
      openAuthModal();
    }
  });
  dom.btnCloseAuth?.addEventListener('click', () => {
    dom.modalAuth.hidden = true;
  });
  dom.authModeBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.authMode = btn.dataset.authMode === 'register' ? 'register' : 'login';
      dom.authModeBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      if (dom.authDisplayNameRow) dom.authDisplayNameRow.hidden = state.authMode !== 'register';
      if (dom.btnAuthSubmit) {
        dom.btnAuthSubmit.textContent = state.authMode === 'register' ? '注册账号并立即同步' : '登录并同步云端图鉴';
      }
      if (dom.authErrorMsg) dom.authErrorMsg.hidden = true;
    });
  });
  dom.btnAuthSubmit?.addEventListener('click', async () => {
    const chkAgree = $('#chk-auth-agree');
    if (chkAgree && !chkAgree.checked) {
      if (dom.authErrorMsg) {
        dom.authErrorMsg.textContent = '请先勾选同意《隐私政策》《用户协议》《收集清单》';
        dom.authErrorMsg.hidden = false;
      }
      return;
    }
    const account = (dom.authInputAccount?.value || '').trim();
    const password = dom.authInputPassword?.value || '';
    const displayName = (dom.authInputDisplayName?.value || '').trim();
    if (dom.authErrorMsg) dom.authErrorMsg.hidden = true;

    dom.btnAuthSubmit.disabled = true;
    const origText = dom.btnAuthSubmit.textContent;
    dom.btnAuthSubmit.textContent = state.authMode === 'register' ? '正在注册并开启云端库…' : '正在登录并校验凭证…';

    try {
      if (state.authMode === 'register') {
        await registerCloudAccount({ account, password, displayName });
      } else {
        await loginCloudAccount({ account, password });
      }
      refreshCloudSessionUI();
      await runCloudSync({ silent: false });
      dom.modalAuth.hidden = true;
    } catch (err) {
      if (dom.authErrorMsg) {
        dom.authErrorMsg.textContent = String(err?.message || '操作失败，请检查网络或输入格式');
        dom.authErrorMsg.hidden = false;
      }
    } finally {
      dom.btnAuthSubmit.disabled = false;
      dom.btnAuthSubmit.textContent = origText;
    }
  });
  dom.btnAuthLogout?.addEventListener('click', () => {
    logoutCloudAccount();
    refreshCloudSessionUI();
    dom.modalAuth.hidden = true;
    showToast('已退出云端账号，本机图鉴数据仍安全保留');
  });
  dom.btnAuthSyncNow?.addEventListener('click', () => runCloudSync({ silent: false }));

  // ── Compliance & Legal Center + Account Deletion ──
  const openLegalModal = (tabId = 'privacy') => {
    const modal = $('#modal-legal');
    const tabsEl = $('#legal-tabs');
    const bodyEl = $('#legal-doc-body');
    if (!modal || !tabsEl || !bodyEl) return;
    const renderTab = (activeId) => {
      tabsEl.innerHTML = '';
      for (const t of LEGAL_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `legal-tab-btn${t.id === activeId ? ' is-active' : ''}`;
        btn.textContent = t.label;
        btn.addEventListener('click', () => renderTab(t.id));
        tabsEl.appendChild(btn);
      }
      bodyEl.innerHTML = LEGAL_DOCUMENTS[activeId] || LEGAL_DOCUMENTS.privacy;
    };
    renderTab(LEGAL_DOCUMENTS[tabId] ? tabId : 'privacy');
    modal.hidden = false;
  };

  $$('[data-legal-tab]').forEach((el) => {
    el.addEventListener('click', () => openLegalModal(el.dataset.legalTab || 'privacy'));
  });
  $('#btn-close-legal')?.addEventListener('click', () => { const m = $('#modal-legal'); if (m) m.hidden = true; });
  $('#btn-legal-done')?.addEventListener('click', () => { const m = $('#modal-legal'); if (m) m.hidden = true; });

  $('#btn-auth-delete-account')?.addEventListener('click', async () => {
    if (!window.confirm('确认注销账号并清除云端同步数据吗？此操作不可撤销（本机未同步的草稿仍保留）。')) return;
    try {
      for (const c of state.cards) {
        await deleteCardFromCloud(c.id).catch(() => {});
      }
      logoutCloudAccount();
      refreshCloudSessionUI();
      dom.modalAuth.hidden = true;
      showToast('已注销云端账号并清除云端卡册数据');
    } catch (err) {
      showToast('注销处理失败，请检查网络后重试');
    }
  });

  const consentKey = 'catchcat.privacy.consent.v1';
  const modalConsent = $('#modal-privacy-consent');
  if (modalConsent && localStorage.getItem(consentKey) === null) {
    modalConsent.hidden = false;
  }
  $('#btn-privacy-decline')?.addEventListener('click', () => {
    localStorage.setItem(consentKey, 'declined');
    if (modalConsent) modalConsent.hidden = true;
    showToast('已进入本地离线浏览模式');
  });
  $('#btn-privacy-accept')?.addEventListener('click', () => {
    const chk = $('#chk-privacy-consent');
    if (chk && !chk.checked) {
      showToast('请先勾选同意以上合规条款');
      return;
    }
    localStorage.setItem(consentKey, 'accepted');
    if (modalConsent) modalConsent.hidden = true;
    if (getCloudSession()) runCloudSync({ silent: true });
  });
}

// ═══════════════════════ BOOTSTRAP ═══════════════════════
async function init() {
  state.cards = await loadAllCards();
  state.currentCard = deepClone(state.cards[0] || SAMPLE_CARDS[0]);

  buildStaticPalettes();
  renderSnackGrid();
  syncCaptureHUD();
  bindEvents();
  refreshCloudSessionUI();
  updateDexBadgeCount();
  const [, emblemImg] = await Promise.all([
    ensureCutoutLoaded(state.currentCard),
    loadImageCached('assets/app-icon.png')
  ]);
  state.inspectEmblemImg = emblemImg;
  syncControlsFromCurrentCard();
  renderStudioNow();
  startCameraStream(false);
  if (getCloudSession() && localStorage.getItem('catchcat.privacy.consent.v1') === 'accepted') {
    runCloudSync({ silent: true });
  }
}

init();

