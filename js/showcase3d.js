import { BORDER_PRESETS } from './presets.js?v=20261127c';
import { getCardDisplayTitle, resolveEffectiveBorderId } from './cardRenderer.js?v=20261127c';

const CARD_W = 2.6;
const CARD_H = CARD_W * (88 / 63);
const CARD_R = CARD_W * (3.0 / 63.0);

function createRoundedRectShape(w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

// Local module-level Three reference assigned lazily on first mount
let THREE = null;

export class Card3DShowcase {
  constructor({ canvas, container, fallbackEl, fallbackImgEl, loadingEl }) {
    this.canvas = canvas;
    this.container = container;
    this.fallbackEl = fallbackEl;
    this.fallbackImgEl = fallbackImgEl;
    this.loadingEl = loadingEl;

    this.initialized = false;
    this.initializing = false;
    this.failed = false;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.pmremGenerator = null;
    this.resizeObserver = null;
    this.rafId = 0;

    this.cardPivot = null;
    this.rimMesh = null;
    this.frontMesh = null;
    this.backMesh = null;
    this.slabGroup = null;
    this.plaqueMesh = null;

    this.frontTex = null;
    this.backTex = null;
    this.foilBumpTex = null;
    this.plaqueTex = null;

    this.keyLight = null;
    this.fillLight = null;
    this.rimLight = null;

    this.autoSpin = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.slabVisible = true;
    this.camPreset = 'front';
    this.zoomLevel = 1;
    this.lightMode = 'studio';

    this.lerpingCamera = false;
    this.targetCamPos = { x: 0, y: 0.12, z: 6.1 };
    this.targetLookAt = { x: 0, y: 0, z: 0 };

    this._pendingData = null;
    this._elapsed = 0;
    this._lastTime = 0;
  }

  async ensureInitialized() {
    if (this.initialized) return true;
    if (this.failed) return false;
    if (this.initializing) {
      while (this.initializing) {
        await new Promise((r) => setTimeout(r, 40));
      }
      return this.initialized;
    }

    this.initializing = true;
    if (this.loadingEl) this.loadingEl.hidden = false;

    try {
      const [threeMod, orbitMod, envMod] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/environments/RoomEnvironment.js')
      ]);

      THREE = threeMod;
      const { OrbitControls } = orbitMod;
      const { RoomEnvironment } = envMod;

      const width = Math.max(280, this.container.clientWidth || 600);
      const height = Math.max(320, this.container.clientHeight || 520);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;

      this.scene = new THREE.Scene();

      try {
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        const envRT = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
        this.scene.environment = envRT.texture;
      } catch (iblErr) {
        console.warn('Skipping optional PMREM IBL:', iblErr);
      }

      this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 80);

      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.075;
      this.controls.enablePan = true;
      this.controls.minDistance = 1.25;
      this.controls.maxDistance = 16;
      this.controls.addEventListener('start', () => {
        this.lerpingCamera = false;
      });

      this._buildLights();
      this._buildCardRig();

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);

      this.initialized = true;
      this.initializing = false;
      if (this.loadingEl) this.loadingEl.hidden = true;
      if (this.fallbackEl) this.fallbackEl.hidden = true;

      if (this._pendingData) {
        const d = this._pendingData;
        this._pendingData = null;
        this.updateCardTextures(d.frontCanvas, d.backCanvas, d.card);
      }

      this.setLighting(this.lightMode);
      this.applyCameraGoal();
      this.camera.position.set(this.targetCamPos.x, this.targetCamPos.y, this.targetCamPos.z);
      this.controls.target.set(this.targetLookAt.x, this.targetLookAt.y, this.targetLookAt.z);
      this.controls.update();
      this._startLoop();
      return true;
    } catch (err) {
      this.initializing = false;
      this.failed = true;
      this.lastError = String(err?.stack || err?.message || err);
      if (this.loadingEl) this.loadingEl.hidden = true;
      this._activateFallback();
      console.warn('3D showcase fell back to 2.5D mode:', err);
      return false;
    }
  }

  _activateFallback() {
    if (!this.fallbackEl) return;
    if (this.canvas) this.canvas.style.display = 'none';
    this.fallbackEl.hidden = false;
    this.fallbackStageEl = this.fallbackEl.querySelector('#three-fallback-stage');
    if (this.fallbackEl && !this._fallbackBound) {
      this._fallbackBound = true;
      this.fallbackEl.addEventListener('pointermove', (e) => {
        if (!this.failed || !this.fallbackStageEl) return;
        const r = this.fallbackEl.getBoundingClientRect();
        const nx = (e.clientX - r.left) / Math.max(1, r.width);
        const ny = (e.clientY - r.top) / Math.max(1, r.height);
        this._fbTiltY = (nx - 0.5) * 26;
        this._fbTiltX = -(ny - 0.5) * 20;
        this._syncFallbackVisual();
      });
      this.fallbackEl.addEventListener('pointerleave', () => {
        this._fbTiltX = 0;
        this._fbTiltY = 0;
        this._syncFallbackVisual();
      });
    }
    this._syncFallbackVisual();
  }

  _syncFallbackVisual() {
    if (!this.failed || !this.fallbackEl) return;
    const isBack = this.camPreset === 'back';
    const canvasToShow = isBack ? this._pendingData?.backCanvas : this._pendingData?.frontCanvas;
    if (canvasToShow && this.fallbackImgEl) {
      this.fallbackImgEl.src = canvasToShow.toDataURL('image/png');
    }
    const stage = this.fallbackStageEl || this.fallbackEl.querySelector('#three-fallback-stage');
    if (!stage) return;
    stage.classList.toggle('no-slab', !this.slabVisible);
    const scale = Math.min(2.2, 1 + (this.zoomLevel - 1) * 0.34);
    const baseY = this.camPreset === 'edge' ? 28 : 0;
    const rx = this._fbTiltX || 0;
    const ry = baseY + (this._fbTiltY || 0);
    stage.style.transform = `perspective(1000px) scale(${scale.toFixed(2)}) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    if (this.lightMode === 'warm') {
      stage.style.filter = 'sepia(0.14) saturate(1.18) brightness(1.03)';
    } else if (this.lightMode === 'aurora') {
      stage.style.filter = 'hue-rotate(-8deg) saturate(1.14) contrast(1.04)';
    } else {
      stage.style.filter = 'none';
    }
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);

    this.keyLight = new THREE.DirectionalLight(0xfffcf5, 1.55);
    this.keyLight.position.set(4.5, 5.8, 6.2);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xc2dcff, 0.72);
    this.fillLight.position.set(-5.2, 2.2, 4.4);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0x23d19a, 1.25);
    this.rimLight.position.set(-2.5, -3.4, -4.8);
    this.scene.add(this.rimLight);
  }

  _createFoilBumpTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = -256; i < 512; i += 6) {
      ctx.strokeStyle = i % 12 === 0 ? '#a8a8a8' : '#646464';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 256, 256);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 4);
    return tex;
  }

  _normalizeShapeUVs(geo, w, h) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv.setXY(i, (x + w * 0.5) / w, (y + h * 0.5) / h);
    }
    uv.needsUpdate = true;
  }

  _buildCardRig() {
    this.cardPivot = new THREE.Group();
    this.scene.add(this.cardPivot);

    this.foilBumpTex = this._createFoilBumpTexture();

    // 1. Extruded Metallic Card Body + Beveled Chamfer Rim
    const cardShape = createRoundedRectShape(CARD_W, CARD_H, CARD_R);
    const bodyGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 4,
      curveSegments: 18
    });
    // Center geometry along Z axis
    bodyGeo.translate(0, 0, -0.012);

    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0xe4bd46,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 0.65,
      clearcoatRoughness: 0.14
    });
    this.rimMesh = new THREE.Mesh(bodyGeo, rimMat);
    this.cardPivot.add(this.rimMesh);

    // 2. Front & Back Rounded Faces
    const faceGeo = new THREE.ShapeGeometry(cardShape, 18);
    this._normalizeShapeUVs(faceGeo, CARD_W, CARD_H);

    const frontMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.12,
      roughness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.1,
      iridescence: 0.45,
      iridescenceIOR: 1.32,
      bumpMap: this.foilBumpTex,
      bumpScale: 0.003
    });

    this.frontMesh = new THREE.Mesh(faceGeo, frontMat);
    this.frontMesh.position.z = 0.0205;
    this.cardPivot.add(this.frontMesh);

    const backMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.22,
      roughness: 0.26,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12
    });
    this.backMesh = new THREE.Mesh(faceGeo, backMat);
    this.backMesh.rotation.y = Math.PI;
    this.backMesh.position.z = -0.0205;
    this.cardPivot.add(this.backMesh);

    // 3. Toggleable Crystal Acrylic Slab Enclosure (PSA-style Display Case)
    this.slabGroup = new THREE.Group();
    this.cardPivot.add(this.slabGroup);

    const slabW = 3.04;
    const slabH = 4.62;
    const slabR = 0.14;
    const slabShape = createRoundedRectShape(slabW, slabH, slabR);
    const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 3,
      curveSegments: 14
    });
    slabGeo.translate(0, 0.2, -0.08);

    const slabMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.07,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      depthWrite: false
    });
    const slabCase = new THREE.Mesh(slabGeo, slabMat);
    this.slabGroup.add(slabCase);

    // Outer sleek edge outline around acrylic slab
    const edges = new THREE.EdgesGeometry(slabGeo, 24);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xaed9ff,
      transparent: true,
      opacity: 0.26
    });
    this.slabGroup.add(new THREE.LineSegments(edges, lineMat));

    // Top collector plaque inside acrylic header
    const plaqueGeo = new THREE.PlaneGeometry(2.62, 0.44);
    const plaqueMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.35,
      roughness: 0.25,
      clearcoat: 0.6
    });
    this.plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    this.plaqueMesh.position.set(0, CARD_H * 0.5 + 0.31, 0.05);
    this.slabGroup.add(this.plaqueMesh);

    this.slabGroup.visible = this.slabVisible;
  }

  _updatePlaqueTexture(card) {
    if (!THREE || !this.plaqueMesh) return;
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#11161f';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = '#e4bd46';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

    ctx.fillStyle = '#23d19a';
    ctx.font = '800 24px Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CATCHPET GRADING · GEM MT 10', 26, 40);

    ctx.fillStyle = '#eef2f6';
    ctx.font = '800 30px "PingFang SC", sans-serif';
    ctx.fillText(getCardDisplayTitle(card).slice(0, 14), 26, 88);

    ctx.fillStyle = '#f5b82e';
    ctx.font = '800 28px Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(card.serialNumber || '001/165 ★', c.width - 26, 86);

    if (this.plaqueTex) this.plaqueTex.dispose();
    this.plaqueTex = new THREE.CanvasTexture(c);
    this.plaqueTex.colorSpace = THREE.SRGBColorSpace;
    this.plaqueMesh.material.map = this.plaqueTex;
    this.plaqueMesh.material.needsUpdate = true;
  }

  updateCardTextures(frontCanvas, backCanvas, card) {
    this._pendingData = { frontCanvas, backCanvas, card };
    if (this.failed) {
      this._syncFallbackVisual();
      return;
    }
    if (!this.initialized || !THREE) return;

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    if (this.frontTex) this.frontTex.dispose();
    this.frontTex = new THREE.CanvasTexture(frontCanvas);
    this.frontTex.colorSpace = THREE.SRGBColorSpace;
    this.frontTex.anisotropy = maxAniso;
    this.frontMesh.material.map = this.frontTex;

    const foil = card.foilIntensity ?? 0.72;
    this.frontMesh.material.metalness = 0.08 + 0.16 * foil;
    this.frontMesh.material.roughness = Math.max(0.14, 0.34 - 0.16 * foil);
    this.frontMesh.material.iridescence = 0.15 + 0.65 * foil;
    this.frontMesh.material.bumpScale = 0.004 * foil;
    this.frontMesh.material.needsUpdate = true;

    if (this.backTex) this.backTex.dispose();
    this.backTex = new THREE.CanvasTexture(backCanvas);
    this.backTex.colorSpace = THREE.SRGBColorSpace;
    this.backTex.anisotropy = maxAniso;
    this.backMesh.material.map = this.backTex;
    this.backMesh.material.needsUpdate = true;

    const borderId = resolveEffectiveBorderId(card);
    const borderPreset = BORDER_PRESETS.find((b) => b.id === borderId) || BORDER_PRESETS[1];
    this.rimMesh.material.color.set(borderPreset.rim || '#e4bd46');

    this._updatePlaqueTexture(card);
  }

  setCameraPreset(preset) {
    this.camPreset = preset;
    this.applyCameraGoal();
    this._syncFallbackVisual();
  }

  setZoom(zoom) {
    this.zoomLevel = Number(zoom) || 1;
    this.applyCameraGoal();
    this._syncFallbackVisual();
  }

  _computeFitDistance() {
    const aspect = this.camera?.aspect || 1.2;
    const tanHalf = Math.tan(((this.camera?.fov || 34) * Math.PI) / 360);
    const objW = this.slabVisible ? 3.22 : 2.74;
    const objH = this.slabVisible ? 4.86 : 3.78;
    const distV = objH / 0.86 / (2 * tanHalf);
    const distH = objW / 0.84 / (2 * tanHalf * aspect);
    return Math.max(distV, distH);
  }

  applyCameraGoal() {
    const baseDist = this._computeFitDistance() / Math.max(0.8, this.zoomLevel);
    const yOff = this.slabVisible ? 0.18 : 0;
    if (this.camPreset === 'edge') {
      this.targetCamPos = { x: baseDist * 0.78, y: yOff + baseDist * 0.1, z: baseDist * 0.48 };
    } else if (this.camPreset === 'back') {
      this.targetCamPos = { x: -baseDist * 0.1, y: yOff, z: -baseDist };
    } else {
      this.targetCamPos = { x: 0, y: yOff, z: baseDist };
    }
    this.targetLookAt = { x: 0, y: this.slabVisible && this.zoomLevel <= 1.2 ? 0.18 : 0, z: 0 };
    this.lerpingCamera = true;
  }

  setLighting(mode) {
    this.lightMode = mode;
    this._syncFallbackVisual();
    if (!this.initialized) return;

    if (mode === 'warm') {
      this.keyLight.color.set(0xffe1ad);
      this.keyLight.intensity = 1.75;
      this.fillLight.color.set(0xffb478);
      this.fillLight.intensity = 0.72;
      this.rimLight.color.set(0xf5b82e);
      this.rimLight.intensity = 1.45;
    } else if (mode === 'aurora') {
      this.keyLight.color.set(0xe3fff7);
      this.keyLight.intensity = 1.5;
      this.fillLight.color.set(0x6bd4ff);
      this.fillLight.intensity = 0.92;
      this.rimLight.color.set(0x23d19a);
      this.rimLight.intensity = 1.75;
    } else {
      this.keyLight.color.set(0xfffdf8);
      this.keyLight.intensity = 1.55;
      this.fillLight.color.set(0xc8e0ff);
      this.fillLight.intensity = 0.78;
      this.rimLight.color.set(0x9be8d2);
      this.rimLight.intensity = 1.1;
    }
  }

  setAutoSpin(enabled) {
    this.autoSpin = Boolean(enabled);
  }

  setSlabVisible(visible) {
    this.slabVisible = Boolean(visible);
    if (this.slabGroup) {
      this.slabGroup.visible = this.slabVisible;
    }
    this.applyCameraGoal();
    this._syncFallbackVisual();
  }

  resize() {
    if (!this.initialized || !this.renderer || !this.camera || !this.container) return;
    const width = Math.max(240, this.container.clientWidth);
    const height = Math.max(280, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.zoomLevel <= 1.05) {
      this.applyCameraGoal();
    }
  }

  _startLoop() {
    this._lastTime = performance.now();
    const tick = (now) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - this._lastTime) / 1000);
      this._lastTime = now;
      this._elapsed += dt;

      if (this.cardPivot) {
        if (this.autoSpin) {
          this.cardPivot.rotation.y = Math.sin(this._elapsed * 0.75) * 0.24;
          this.cardPivot.rotation.x = Math.cos(this._elapsed * 0.55) * 0.055;
        } else {
          this.cardPivot.rotation.y += (0 - this.cardPivot.rotation.y) * 0.08;
          this.cardPivot.rotation.x += (0 - this.cardPivot.rotation.x) * 0.08;
        }
      }

      if (this.lerpingCamera && this.camera && this.controls) {
        const k = 1 - Math.exp(-dt * 6.5);
        this.camera.position.x += (this.targetCamPos.x - this.camera.position.x) * k;
        this.camera.position.y += (this.targetCamPos.y - this.camera.position.y) * k;
        this.camera.position.z += (this.targetCamPos.z - this.camera.position.z) * k;
        this.controls.target.x += (this.targetLookAt.x - this.controls.target.x) * k;
        this.controls.target.y += (this.targetLookAt.y - this.controls.target.y) * k;
        this.controls.target.z += (this.targetLookAt.z - this.controls.target.z) * k;

        const distErr =
          Math.abs(this.camera.position.x - this.targetCamPos.x) +
          Math.abs(this.camera.position.y - this.targetCamPos.y) +
          Math.abs(this.camera.position.z - this.targetCamPos.z);
        if (distErr < 0.015) this.lerpingCamera = false;
      }

      this.controls?.update();
      this.renderer?.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.frontTex?.dispose();
    this.backTex?.dispose();
    this.foilBumpTex?.dispose();
    this.plaqueTex?.dispose();
    this.pmremGenerator?.dispose();

    this.scene?.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });

    this.renderer?.dispose();
    this.initialized = false;
  }
}
