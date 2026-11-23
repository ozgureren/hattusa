import * as THREE from 'three';
import type { EvidenceMode } from './hattusaData';

import limestoneUrl from '../assets/images/hattusa_cyclopean_limestone_1795447103066.jpg';
import mudbrickUrl from '../assets/images/hattusa_mudbrick_plaster_1795447101827.jpg';
import steppeUrl from '../assets/images/hattusa_steppe_ground_1795447104400.jpg';

export interface DioramaMaterialLibrary {
  terrain: THREE.MeshStandardMaterial;
  strataCutaway: THREE.MeshStandardMaterial;
  plinthWood: THREE.MeshStandardMaterial;
  plinthTrim: THREE.MeshStandardMaterial;
  plaqueFace: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  roadRibbon: THREE.MeshStandardMaterial;

  // Documented materials (Archaeological stone foundations, orthostats, glacis, rock crags)
  cyclopeanStone: THREE.MeshStandardMaterial;
  dressedOrthostat: THREE.MeshStandardMaterial;
  glacisPaving: THREE.MeshStandardMaterial;
  naturalLimestoneCrag: THREE.MeshStandardMaterial;
  carvedReliefStone: THREE.MeshStandardMaterial;
  greenNephriteStone: THREE.MeshStandardMaterial;
  darkTunnelPortal: THREE.MeshStandardMaterial;
  courtyardPaving: THREE.MeshStandardMaterial;

  // Hypothetical reconstruction materials (Mudbrick upper walls, timber beams, earthen roofs)
  mudbrickWall: THREE.MeshStandardMaterial;
  mudbrickResidential: THREE.MeshStandardMaterial;
  earthenRoof: THREE.MeshStandardMaterial;
  cedarTimber: THREE.MeshStandardMaterial;
  terracottaPithos: THREE.MeshStandardMaterial;

  // Ecology & miniature scale figures
  drySteppeGrass: THREE.MeshStandardMaterial;
  anatolianFoliage: THREE.MeshStandardMaterial;
  scrubTrunk: THREE.MeshStandardMaterial;
  miniatureFigure: THREE.MeshStandardMaterial;

  applyEvidenceMode: (mode: EvidenceMode) => void;
  dispose: () => void;
}

function createProceduralBumpTexture(size = 256, contrast = 38, seed = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  let s = seed * 16807;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const wave =
        Math.sin((x / size) * Math.PI * 8) * Math.cos((y / size) * Math.PI * 8) * 14 +
        Math.sin(((x + y) / size) * Math.PI * 16) * 8;
      const grain = (rand() - 0.5) * contrast;
      const v = Math.max(0, Math.min(255, Math.round(128 + wave + grain)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createStrataCutawayTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Vertical gradient representing Anatolian Boğazkale geological cross-section
  // Top (v=1 -> y=0 in canvas): Steppe topsoil -> Caliche clay -> Fractured limestone -> Deep ophiolite bedrock
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#8d7857'); // Humus & dry steppe topsoil
  grad.addColorStop(0.09, '#7a6346'); // Subsoil loam
  grad.addColorStop(0.18, '#9b8c76'); // Pale calcareous marl
  grad.addColorStop(0.32, '#867d70'); // Upper Boğazkale limestone bed
  grad.addColorStop(0.48, '#6c6459'); // Weathered karstic limestone
  grad.addColorStop(0.66, '#534c44'); // Dense lower limestone strata
  grad.addColorStop(0.84, '#3d3833'); // Deep Anatolian metamorphic basement
  grad.addColorStop(1.0, '#2a2623'); // Basal dark rock
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Add realistic horizontal sedimentary bedding planes and subtle rock fractures
  for (let i = 0; i < 46; i++) {
    const yBase = (i / 46) * h;
    ctx.beginPath();
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= w; x += 16) {
      const wy =
        yBase +
        Math.sin((x / w) * Math.PI * 4 + i * 0.7) * 3.2 +
        Math.cos((x / w) * Math.PI * 10 - i) * 1.4;
      ctx.lineTo(x, wy);
    }
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(28, 24, 20, 0.34)' : 'rgba(225, 212, 190, 0.14)';
    ctx.lineWidth = i % 5 === 0 ? 2.2 : 1.0;
    ctx.stroke();
  }

  // Fine mineral grain & embedded limestone clasts in upper horizons
  let seed = 42;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i++) {
    const rx = rand() * w;
    const ry = rand() * h;
    const rw = 1.5 + rand() * 5.5;
    const rh = 1.0 + rand() * 2.5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(220, 210, 192, 0.12)' : 'rgba(22, 19, 16, 0.16)';
    ctx.fillRect(rx, ry, rw, rh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createMuseumPlaqueTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Brushed dark bronze plaque background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2a2219');
  grad.addColorStop(0.5, '#3b3022');
  grad.addColorStop(1, '#261e16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Double engraved gold-bronze border
  ctx.strokeStyle = '#c59d5f';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = 'rgba(197, 157, 95, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = '#e7c996';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 44px Cinzel, Georgia, serif';
  ctx.fillText('HATTUŞA — HİTİT BAŞKENTİ', w / 2, 76);

  ctx.fillStyle = '#c4b293';
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('MÖ 13. YÜZYIL · ÇORUM – BOĞAZKALE · ARKEOLOJİK ARAZİ DİORAMASI', w / 2, 130);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDioramaMaterials(
  renderer: THREE.WebGLRenderer,
  onTextureLoaded: () => void
): DioramaMaterialLibrary {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const disposables: Array<{ dispose: () => void }> = [];

  const loadTiledMap = (url: string, repeatX: number, repeatY: number) => {
    const tex = loader.load(url, () => {
      onTextureLoaded();
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAniso;
    disposables.push(tex);
    return tex;
  };

  const steppeMap = loadTiledMap(steppeUrl, 10, 12);
  const stoneWallMap = loadTiledMap(limestoneUrl, 3.2, 1.4);
  const stoneFineMap = loadTiledMap(limestoneUrl, 6.0, 6.0);
  const mudbrickMap = loadTiledMap(mudbrickUrl, 2.5, 1.5);

  const stoneBump = createProceduralBumpTexture(256, 44, 11);
  stoneBump.repeat.set(5, 5);
  stoneBump.anisotropy = maxAniso;
  const mudBump = createProceduralBumpTexture(256, 28, 29);
  mudBump.repeat.set(4, 4);
  mudBump.anisotropy = maxAniso;
  const strataTex = createStrataCutawayTexture();
  strataTex.repeat.set(4, 1);
  strataTex.anisotropy = maxAniso;
  const plaqueTex = createMuseumPlaqueTexture();
  plaqueTex.anisotropy = maxAniso;

  disposables.push(stoneBump, mudBump, strataTex, plaqueTex);

  const reg = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const terrain = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: steppeMap,
      bumpMap: stoneBump,
      bumpScale: 0.14,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    })
  );

  const strataCutaway = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: strataTex,
      bumpMap: stoneBump,
      bumpScale: 0.18,
      roughness: 0.89,
      metalness: 0.04,
    })
  );

  const plinthWood = reg(
    new THREE.MeshStandardMaterial({
      color: 0x1b1714,
      roughness: 0.42,
      metalness: 0.12,
    })
  );

  const plinthTrim = reg(
    new THREE.MeshStandardMaterial({
      color: 0xa68249,
      roughness: 0.32,
      metalness: 0.78,
    })
  );

  const plaqueFace = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plaqueTex,
      roughness: 0.36,
      metalness: 0.62,
    })
  );

  const water = reg(
    new THREE.MeshStandardMaterial({
      color: 0x2b4c52,
      roughness: 0.16,
      metalness: 0.22,
    })
  );

  const roadRibbon = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc2b092,
      bumpMap: mudBump,
      bumpScale: 0.05,
      roughness: 0.94,
      metalness: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  // DOCUMENTED MATERIALS
  const cyclopeanStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stoneWallMap,
      bumpMap: stoneBump,
      bumpScale: 0.16,
      roughness: 0.86,
      metalness: 0.04,
    })
  );

  const dressedOrthostat = reg(
    new THREE.MeshStandardMaterial({
      color: 0xe6dfd2,
      map: stoneFineMap,
      bumpMap: stoneBump,
      bumpScale: 0.09,
      roughness: 0.78,
      metalness: 0.05,
    })
  );

  const glacisPaving = reg(
    new THREE.MeshStandardMaterial({
      color: 0xe8e1d3,
      map: stoneFineMap,
      bumpMap: stoneBump,
      bumpScale: 0.12,
      roughness: 0.82,
      metalness: 0.04,
    })
  );

  const naturalLimestoneCrag = reg(
    new THREE.MeshStandardMaterial({
      color: 0xa89f91,
      bumpMap: stoneBump,
      bumpScale: 0.24,
      roughness: 0.91,
      metalness: 0.03,
      flatShading: true,
    })
  );

  const carvedReliefStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0xd8cfc0,
      bumpMap: stoneBump,
      bumpScale: 0.06,
      roughness: 0.68,
      metalness: 0.06,
    })
  );

  const greenNephriteStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0x244a39,
      roughness: 0.24,
      metalness: 0.14,
    })
  );

  const darkTunnelPortal = reg(
    new THREE.MeshStandardMaterial({
      color: 0x0e0c0a,
      roughness: 0.98,
      metalness: 0.0,
    })
  );

  const courtyardPaving = reg(
    new THREE.MeshStandardMaterial({
      color: 0xd7ccb8,
      bumpMap: stoneBump,
      bumpScale: 0.06,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  // HYPOTHETICAL MATERIALS
  const mudbrickWall = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mudbrickMap,
      bumpMap: mudBump,
      bumpScale: 0.11,
      roughness: 0.85,
      metalness: 0.02,
    })
  );

  const mudbrickResidential = reg(
    new THREE.MeshStandardMaterial({
      color: 0xead8be,
      map: mudbrickMap,
      bumpMap: mudBump,
      bumpScale: 0.09,
      roughness: 0.88,
      metalness: 0.01,
    })
  );

  const earthenRoof = reg(
    new THREE.MeshStandardMaterial({
      color: 0xb59873,
      bumpMap: mudBump,
      bumpScale: 0.08,
      roughness: 0.94,
      metalness: 0.01,
    })
  );

  const cedarTimber = reg(
    new THREE.MeshStandardMaterial({
      color: 0x563a24,
      roughness: 0.62,
      metalness: 0.05,
    })
  );

  const terracottaPithos = reg(
    new THREE.MeshStandardMaterial({
      color: 0xa65838,
      roughness: 0.68,
      metalness: 0.04,
    })
  );

  // ECOLOGY & FIGURES
  const drySteppeGrass = reg(
    new THREE.MeshStandardMaterial({
      color: 0x9c8b52,
      roughness: 0.92,
      metalness: 0.0,
    })
  );

  const anatolianFoliage = reg(
    new THREE.MeshStandardMaterial({
      color: 0x5c6942,
      roughness: 0.88,
      metalness: 0.01,
      flatShading: true,
    })
  );

  const scrubTrunk = reg(
    new THREE.MeshStandardMaterial({
      color: 0x4b3a2b,
      roughness: 0.9,
      metalness: 0.0,
    })
  );

  const miniatureFigure = reg(
    new THREE.MeshStandardMaterial({
      color: 0xd8c6aa,
      roughness: 0.72,
      metalness: 0.05,
    })
  );

  const applyEvidenceMode = (mode: EvidenceMode) => {
    if (mode === 'evidence-split') {
      // Documented archaeological bases in crisp pale museum conservation limestone
      cyclopeanStone.map = null;
      cyclopeanStone.color.setHex(0xd8d2c7);
      dressedOrthostat.map = null;
      dressedOrthostat.color.setHex(0xe5e0d6);
      glacisPaving.map = null;
      glacisPaving.color.setHex(0xded8cd);

      // Hypothetical reconstructions in warm conservation terracotta-ochre model tone
      mudbrickWall.map = null;
      mudbrickWall.color.setHex(0xc97344);
      mudbrickResidential.map = null;
      mudbrickResidential.color.setHex(0xc4794e);
      earthenRoof.color.setHex(0xb36439);
      cedarTimber.color.setHex(0x8a4322);
    } else {
      // Restore full museum realistic materials
      cyclopeanStone.map = stoneWallMap;
      cyclopeanStone.color.setHex(0xffffff);
      dressedOrthostat.map = stoneFineMap;
      dressedOrthostat.color.setHex(0xe6dfd2);
      glacisPaving.map = stoneFineMap;
      glacisPaving.color.setHex(0xe8e1d3);

      mudbrickWall.map = mudbrickMap;
      mudbrickWall.color.setHex(0xffffff);
      mudbrickResidential.map = mudbrickMap;
      mudbrickResidential.color.setHex(0xead8be);
      earthenRoof.color.setHex(0xb59873);
      cedarTimber.color.setHex(0x563a24);
    }
    cyclopeanStone.needsUpdate = true;
    dressedOrthostat.needsUpdate = true;
    glacisPaving.needsUpdate = true;
    mudbrickWall.needsUpdate = true;
    mudbrickResidential.needsUpdate = true;
    earthenRoof.needsUpdate = true;
    cedarTimber.needsUpdate = true;
  };

  const dispose = () => {
    for (const item of disposables) {
      item.dispose();
    }
  };

  return {
    terrain,
    strataCutaway,
    plinthWood,
    plinthTrim,
    plaqueFace,
    water,
    roadRibbon,
    cyclopeanStone,
    dressedOrthostat,
    glacisPaving,
    naturalLimestoneCrag,
    carvedReliefStone,
    greenNephriteStone,
    darkTunnelPortal,
    courtyardPaving,
    mudbrickWall,
    mudbrickResidential,
    earthenRoof,
    cedarTimber,
    terracottaPithos,
    drySteppeGrass,
    anatolianFoliage,
    scrubTrunk,
    miniatureFigure,
    applyEvidenceMode,
    dispose,
  };
}
