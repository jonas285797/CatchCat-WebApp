import {
  ENERGY_TYPES,
  BORDER_PRESETS,
  BACKGROUND_PRESETS,
  FX_PRESETS,
  BADGE_PRESETS,
  SAMPLE_CARDS,
  CAT_SNACKS,
  DOG_SNACKS,
  resolveAdaptiveFX
} from './presets.js?v=20261126d';
import {
  loadImageCached,
  getEnergyConfig,
  getCardDisplayTitle,
  renderCardFrontToCanvas,
  renderCardBackToCanvas,
  exportCard4KBlob
} from './cardRenderer.js?v=20261126d';
import { WebCutoutEngine, preloadNeuralMatting } from './cutout.js?v=20261126d';
import { getAISettings, saveAISettings, analyzePetSmart } from './ai.js?v=20261126d';
import { loadAllCards, upsertCard, removeCard, getTrainerLevelInfo, grantTrainerXP } from './storage.js?v=20261126d';
import { Card3DShowcase } from './showcase3d.js?v=20261126d';

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
  lastCardTapAt: 0,
  renderScheduled: false,
  dexSearch: '',
  dexEnergy: 'all',
  dexThumbCache: new Map(),
  pendingDeleteId: null,
  pendingDeleteTimer: null,
  showcase: null,
  cutoutEngine: new WebCutoutEngine(),
  cutoutLoadedSrc: false,
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
  sessionBuff: { hpBonus: 0, exBoost: 0, count: 0 }
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
  btnRandomize: $('#btn-randomize'),
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
  inputAtkName: $('#input-atk-name'),
  inputAtkDmg: $('#input-atk-dmg'),
  inputFlavor: $('#input-card-flavor'),

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

  // CardDex
  dexStatsLine: $('#dex-stats-line'),
  btnBackupExport: $('#btn-backup-export'),
  backupFileInput: $('#backup-file-input'),
  dexSearch: $('#dex-search'),
  dexEnergyFilter: $('#dex-energy-filter'),
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
  chkAutoAi: $('#chk-auto-ai'),
  btnCutoutUseFull: $('#btn-cutout-use-full'),
  btnCutoutConfirm: $('#btn-cutout-confirm'),

  modalAiSettings: $('#modal-ai-settings'),
  btnCloseAiSettings: $('#btn-close-ai-settings'),
  inputVisionUrl: $('#input-vision-url'),
  chkLocalOnly: $('#chk-local-only'),
  btnSaveAiSettings: $('#btn-save-ai-settings'),

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

function renderStudioNow() {
  const card = state.currentCard;
  renderCardFrontToCanvas(dom.canvasFront, card, state.activeCutoutImg, 2);
  renderCardBackToCanvas(dom.canvasBack, card, 2);

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
  dom.studioBadge.textContent = getCardDisplayTitle(card);

  // Sample pills active state
  $$('.sample-pill', dom.sampleStrip).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.src === card.cutoutSrc);
  });

  // Border swatches
  $$('.swatch-card', dom.borderGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === (card.borderStyle || 'auto'));
  });
  const activeBorder = BORDER_PRESETS.find((b) => b.id === (card.borderStyle || 'auto')) || BORDER_PRESETS[0];
  dom.borderLabel.textContent = activeBorder.name;

  // Background swatches
  $$('.swatch-card', dom.bgGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === (card.backgroundStyle || 'auto'));
  });
  const activeBg = BACKGROUND_PRESETS.find((b) => b.id === (card.backgroundStyle || 'auto')) || BACKGROUND_PRESETS[0];
  dom.bgLabel.textContent = activeBg.name;

  // FX swatches & foil slider
  const foil = Number(card.foilIntensity ?? 0.72);
  dom.foilSlider.value = String(foil);
  dom.foilVal.textContent = `${Math.round(foil * 100)}%`;

  $$('.swatch-card', dom.fxGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === (card.fxPreset || 'auto'));
  });
  const activeFx = FX_PRESETS.find((f) => f.id === (card.fxPreset || 'auto')) || FX_PRESETS[0];
  dom.fxLabel.textContent = activeFx.name;

  // Badge tiles & metadata inputs
  $$('.icon-tile', dom.badgeGrid).forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === (card.badgeIcon || 'auto'));
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

  dom.inputAtkName.value = card.attackName || '';
  dom.inputAtkDmg.value = String(card.attackDamage ?? 120);
  dom.inputFlavor.value = card.flavorText || '';

  // Framing sliders
  const ox = Number(card.subjectOffsetX || 0);
  const oy = Number(card.subjectOffsetY || 0);
  const sc = Number(card.subjectScale || 1);
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
      state.currentCard.borderStyle = item.id;
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
      state.currentCard.backgroundStyle = item.id;
      syncControlsFromCurrentCard();
      scheduleStudioRender();
    });
    dom.bgGrid.appendChild(btn);
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
      state.currentCard.fxPreset = item.id;
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
      state.currentCard.badgeIcon = item.id;
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

  dom.dexEnergyFilter.innerHTML = '';
  const filterItems = [{ id: 'all', label: '全部属性' }, ...ENERGY_TYPES.map((e) => ({ id: e.id, label: `${e.emoji} ${e.label}` }))];
  filterItems.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `energy-pill${f.id === 'all' ? ' is-active' : ''}`;
    btn.dataset.energy = f.id;
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      state.dexEnergy = f.id;
      $$('.energy-pill', dom.dexEnergyFilter).forEach((el) => el.classList.toggle('is-active', el.dataset.energy === f.id));
      renderDexGrid();
    });
    dom.dexEnergyFilter.appendChild(btn);
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
      <img src="${snack.img}" alt="${snack.name}">
      <strong>${snack.name}</strong>
      <span class="snack-tag snack-tag--${snack.tone}">${snack.tag}</span>
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
    state.isFlipped = false;
    dom.cardFlipper.classList.remove('is-flipped');
    dom.studioHint.textContent = '直接在卡面上拖动调整位置 · 滚轮放大缩小';
  } else {
    dom.studioHint.textContent = '滑过/按住卡面可 3D 摆动 · 双击翻背';
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
  const frontHiRes = document.createElement('canvas');
  const backHiRes = document.createElement('canvas');
  // 4.5x scale => 1467 × 2052 crispy PBR card textures for WebGL close-up zoom
  renderCardFrontToCanvas(frontHiRes, card, cutout, 4.5);
  renderCardBackToCanvas(backHiRes, card, 4.5);

  state.showcase.updateCardTextures(frontHiRes, backHiRes, card);
  await state.showcase.ensureInitialized();
  state.showcase.resize();
}

// ═══════════════════════ CARDDEX PERSISTENCE & GRID ═══════════════════════
function updateDexBadgeCount() {
  dom.dexCountDesktop.textContent = String(state.cards.length);
  dom.dexStatsLine.textContent = `本机已典藏 ${state.cards.length} 张主子闪卡 · 支持二次定制与 4K 透明导出`;
}

async function getCardThumbDataUrl(card) {
  const fp = [
    card.id,
    card.cutoutSrc?.slice(-36),
    card.borderStyle,
    card.backgroundStyle,
    card.fxPreset,
    card.badgeIcon,
    card.foilIntensity,
    card.name,
    card.customNickname,
    card.suffix,
    card.hp,
    card.energyType,
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
  const q = state.dexSearch.trim().toLowerCase();
  const filtered = state.cards.filter((card) => {
    if (state.dexEnergy !== 'all' && card.energyType !== state.dexEnergy) return false;
    if (!q) return true;
    const hay = `${card.name || ''} ${card.customNickname || ''} ${card.breedName || ''} ${card.coatPattern || ''} ${card.attackName || ''}`.toLowerCase();
    return hay.includes(q);
  });

  updateDexBadgeCount();
  dom.dexGrid.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column: 1 / -1; text-align:center; padding: 36px 16px; color: var(--ink-3); border: 1px dashed var(--border); border-radius: var(--r-md);';
    empty.innerHTML = '<strong style="display:block;color:var(--ink-1);margin-bottom:6px;">卡册里还没有匹配的主子</strong><span style="font-size:12.5px;">换个关键词试试，或去「制卡工坊」新抓一只主子存入卡册。</span>';
    dom.dexGrid.appendChild(empty);
    return;
  }

  for (const card of filtered) {
    const item = document.createElement('article');
    item.className = 'dex-card';

    const en = getEnergyConfig(card.energyType);
    const thumb = document.createElement('div');
    thumb.className = 'dex-card__thumb';
    const img = document.createElement('img');
    img.alt = getCardDisplayTitle(card);
    img.src = card.cutoutSrc || 'assets/app-icon.png';
    thumb.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'dex-card__meta';
    const title = document.createElement('strong');
    title.textContent = getCardDisplayTitle(card);
    const sub = document.createElement('span');
    sub.textContent = `${en.emoji} HP ${card.hp ?? 180} · ${card.breedName || '猫主子'}`;
    meta.appendChild(title);
    meta.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'dex-card__actions';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'dex-btn';
    btnEdit.textContent = '编辑';
    btnEdit.addEventListener('click', async () => {
      state.currentCard = deepClone(card);
      state.isFlipped = false;
      dom.cardFlipper.classList.remove('is-flipped');
      await ensureCutoutLoaded(state.currentCard);
      syncControlsFromCurrentCard();
      renderStudioNow();
      await switchTab('studio');
    });

    const btn3d = document.createElement('button');
    btn3d.type = 'button';
    btn3d.className = 'dex-btn';
    btn3d.textContent = '3D';
    btn3d.addEventListener('click', async () => {
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
    btnDel.addEventListener('click', async () => {
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
      showToast(`已从卡册移除「${getCardDisplayTitle(card)}」`);
      await renderDexGrid();
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btn3d);
    actions.appendChild(btnDel);

    thumb.addEventListener('click', () => btnEdit.click());

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

  // Stage quick actions
  dom.btnEnter3d.addEventListener('click', () => switchTab('showcase'));

  dom.btnRandomize.addEventListener('click', () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const realBorders = BORDER_PRESETS.filter((b) => b.id !== 'auto');
    const realBgs = BACKGROUND_PRESETS.filter((b) => b.id !== 'auto');
    const realFx = FX_PRESETS.filter((f) => f.id !== 'auto' && f.id !== 'none');
    const realBadges = BADGE_PRESETS.filter((b) => b.id !== 'auto');

    state.currentCard.borderStyle = pick(realBorders).id;
    state.currentCard.backgroundStyle = pick(realBgs).id;
    state.currentCard.fxPreset = pick(realFx).id;
    state.currentCard.badgeIcon = pick(realBadges).id;
    state.currentCard.foilIntensity = Number((0.65 + Math.random() * 0.75).toFixed(2));
    syncControlsFromCurrentCard();
    renderStudioNow();
    showToast('已随机混搭一组高罕卡面皮肤');
  });

  // Save to CardDex
  dom.btnSaveCard.addEventListener('click', async () => {
    const isSample = !state.currentCard.id || String(state.currentCard.id).startsWith('sample-');
    if (isSample) {
      const idx = state.cards.length + 1;
      state.currentCard.id = `card-${Date.now()}`;
      state.currentCard.serialNumber = `${String(idx).padStart(3, '0')}/165 ★`;
    }
    state.currentCard.createdAt = Date.now();
    const saved = await upsertCard(state.currentCard);
    const existingIdx = state.cards.findIndex((c) => c.id === saved.id);
    if (existingIdx >= 0) {
      state.cards[existingIdx] = saved;
    } else {
      state.cards.unshift(saved);
    }
    updateDexBadgeCount();
    showToast(`「${getCardDisplayTitle(saved)}」已存入本机卡册`);
  });

  // 4K Export (Studio & Showcase)
  const trigger4KDownload = async () => {
    try {
      showToast('正在渲染 2934×4104 4K 无边距透明卡牌…', 4000);
      const blob = await exportCard4KBlob(state.currentCard, state.activeCutoutImg);
      if (!blob) {
        showToast('导出失败，请重试');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = getCardDisplayTitle(state.currentCard).replace(/[\\/:*?"<>|\s]+/g, '_');
      a.href = url;
      a.download = `${safeTitle}_4K.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast('4K 超清透明 PNG（2934×4104）已下载');
    } catch {
      showToast('4K 渲染过程中出现错误');
    }
  };
  dom.btnExport4k.addEventListener('click', trigger4KDownload);
  dom.btn3dExport4k.addEventListener('click', trigger4KDownload);

  // Studio Card Interactive Tilt, Flip & Direct Framing Drag
  dom.cardTilt.addEventListener('pointerdown', (e) => {
    if (state.activeAxis === 'framing') {
      state.isDraggingFraming = true;
      dom.cardTilt.setPointerCapture(e.pointerId);
      state.framingStart = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: Number(state.currentCard.subjectOffsetX || 0),
        oy: Number(state.currentCard.subjectOffsetY || 0)
      };
      return;
    }

    const now = performance.now();
    if (now - state.lastCardTapAt < 320) {
      state.isFlipped = !state.isFlipped;
      dom.cardFlipper.classList.toggle('is-flipped', state.isFlipped);
      state.lastCardTapAt = 0;
    } else {
      state.lastCardTapAt = now;
    }
  });

  dom.cardTilt.addEventListener('pointermove', (e) => {
    const rect = dom.cardTilt.getBoundingClientRect();
    if (state.activeAxis === 'framing') {
      if (!state.isDraggingFraming) return;
      const dx = (e.clientX - state.framingStart.clientX) / Math.max(120, rect.width);
      const dy = (e.clientY - state.framingStart.clientY) / Math.max(120, rect.height);
      state.currentCard.subjectOffsetX = Math.max(-0.4, Math.min(0.4, Number((state.framingStart.ox + dx * 1.15).toFixed(2))));
      state.currentCard.subjectOffsetY = Math.max(-0.4, Math.min(0.4, Number((state.framingStart.oy + dy * 1.15).toFixed(2))));
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

  const endTiltOrDrag = () => {
    state.isDraggingFraming = false;
    if (state.activeAxis !== 'framing') {
      dom.cardTilt.style.transform = '';
    }
  };
  dom.cardTilt.addEventListener('pointerleave', endTiltOrDrag);
  dom.cardTilt.addEventListener('pointerup', endTiltOrDrag);
  dom.cardTilt.addEventListener('pointercancel', endTiltOrDrag);

  dom.cardTilt.addEventListener('wheel', (e) => {
    if (state.activeAxis !== 'framing') return;
    e.preventDefault();
    const cur = Number(state.currentCard.subjectScale || 1);
    const next = Math.max(0.7, Math.min(1.85, Number((cur - Math.sign(e.deltaY) * 0.06).toFixed(2))));
    state.currentCard.subjectScale = next;
    syncControlsFromCurrentCard();
    scheduleStudioRender();
  }, { passive: false });

  // Foil intensity
  dom.foilSlider.addEventListener('input', () => {
    const val = Number(dom.foilSlider.value);
    state.currentCard.foilIntensity = val;
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

  // Framing sliders
  dom.sliderOx.addEventListener('input', () => {
    const v = Number(dom.sliderOx.value);
    state.currentCard.subjectOffsetX = v;
    dom.oxVal.textContent = `${Math.round(v * 100)}%`;
    scheduleStudioRender();
  });
  dom.sliderOy.addEventListener('input', () => {
    const v = Number(dom.sliderOy.value);
    state.currentCard.subjectOffsetY = v;
    dom.oyVal.textContent = `${Math.round(v * 100)}%`;
    scheduleStudioRender();
  });
  dom.sliderScale.addEventListener('input', () => {
    const v = Number(dom.sliderScale.value);
    state.currentCard.subjectScale = v;
    dom.scaleVal.textContent = `${v.toFixed(2)}×`;
    scheduleStudioRender();
  });
  dom.btnResetFraming.addEventListener('click', () => {
    state.currentCard.subjectOffsetX = 0;
    state.currentCard.subjectOffsetY = 0;
    state.currentCard.subjectScale = 1;
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

  // CardDex Search & Backup
  dom.dexSearch.addEventListener('input', () => {
    state.dexSearch = dom.dexSearch.value;
    renderDexGrid();
  });
  dom.btnBackupExport.addEventListener('click', () => {
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
  dom.backupFileInput.addEventListener('change', async (e) => {
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
      id: `card-${Date.now()}`,
      serialNumber: `${String(state.cards.length + 1).padStart(3, '0')}/165 ★`,
      cutoutSrc: dataUrl,
      subjectOffsetX: 0,
      subjectOffsetY: 0,
      subjectScale: 1,
      locationName: '网页端工坊自制',
      createdAt: Date.now()
    };

    renderSampleStrip();
    const img = await ensureCutoutLoaded(state.currentCard);
    syncControlsFromCurrentCard();
    renderStudioNow();
    await switchTab('studio');

    if (runAi && img) {
      showToast('抠图已上线，正在智能鉴定花色与生成绝招…', 3000);
      const aiMeta = await analyzePetSmart(img);
      if (aiMeta) {
        state.currentCard.name = aiMeta.name || state.currentCard.name;
        state.currentCard.customNickname = '';
        state.currentCard.breedName = aiMeta.breedName || state.currentCard.breedName;
        state.currentCard.coatPattern = aiMeta.coatPattern || state.currentCard.coatPattern;
        state.currentCard.energyType = aiMeta.energyType || state.currentCard.energyType;
        state.currentCard.hp = aiMeta.hp || state.currentCard.hp;
        state.currentCard.suffix = aiMeta.suffix ?? state.currentCard.suffix;
        state.currentCard.abilityName = aiMeta.abilityName || state.currentCard.abilityName;
        state.currentCard.attackName = aiMeta.attackName || state.currentCard.attackName;
        state.currentCard.attackDamage = aiMeta.attackDamage || state.currentCard.attackDamage;
        state.currentCard.flavorText = aiMeta.flavorText || state.currentCard.flavorText;
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
    showToast(`已鉴定为「${state.currentCard.breedName} · ${state.currentCard.coatPattern}」${buffNote}`);
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
  [dom.modalCutout, dom.modalAiSettings].forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.hidden = true;
    });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dom.modalCutout.hidden = true;
      dom.modalAiSettings.hidden = true;
    }
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
  updateDexBadgeCount();
  await ensureCutoutLoaded(state.currentCard);
  syncControlsFromCurrentCard();
  renderStudioNow();
  startCameraStream(false);
}

init();

