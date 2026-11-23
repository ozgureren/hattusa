import * as THREE from 'three';
import {
  BASE_CUT_BOTTOM_Y,
  DIORAMA_HALF_D,
  DIORAMA_HALF_W,
  PLINTH_BOTTOM_Y,
  ROAD_NETWORK,
  distanceToPolyline,
  fbm2D,
  getTerrainHeight,
  getTerrainSlope,
} from './hattusaData';
import type { DioramaMaterialLibrary } from './materials';

export interface TerrainBuildResult {
  terrainBaseGroup: THREE.Group;
  documentedTerrainProps: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
}

function buildCutawaySkirtGeometry(nx: number, nz: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let vertOffset = 0;

  const addRibbon = (pts: Array<{ x: number; z: number }>, flipWinding: boolean) => {
    let distAccum = 0;
    for (let i = 0; i < pts.length; i++) {
      const { x, z } = pts[i];
      if (i > 0) {
        const dx = x - pts[i - 1].x;
        const dz = z - pts[i - 1].z;
        distAccum += Math.sqrt(dx * dx + dz * dz);
      }
      const topY = getTerrainHeight(x, z);
      const botY = BASE_CUT_BOTTOM_Y;

      positions.push(x, topY, z);
      positions.push(x, botY, z);

      const u = distAccum / 45;
      // Map v so strata follow world height combined with surface topsoil depth
      const vTop = 0.98;
      const vBot = Math.max(0.02, 0.98 - (topY - botY) / 34);
      uvs.push(u, vTop);
      uvs.push(u, vBot);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const a = vertOffset + i * 2;
      const b = vertOffset + i * 2 + 1;
      const c = vertOffset + (i + 1) * 2;
      const d = vertOffset + (i + 1) * 2 + 1;
      if (flipWinding) {
        indices.push(a, c, b, c, d, b);
      } else {
        indices.push(a, b, c, c, b, d);
      }
    }

    vertOffset += pts.length * 2;
  };

  // South front wall (+Z, from -W to +W)
  const southPts: Array<{ x: number; z: number }> = [];
  for (let ix = 0; ix <= nx; ix++) {
    southPts.push({ x: -DIORAMA_HALF_W + (2 * DIORAMA_HALF_W * ix) / nx, z: DIORAMA_HALF_D });
  }
  addRibbon(southPts, false);

  // North back wall (-Z, from +W to -W)
  const northPts: Array<{ x: number; z: number }> = [];
  for (let ix = nx; ix >= 0; ix--) {
    northPts.push({ x: -DIORAMA_HALF_W + (2 * DIORAMA_HALF_W * ix) / nx, z: -DIORAMA_HALF_D });
  }
  addRibbon(northPts, false);

  // East right wall (+X, from +D to -D)
  const eastPts: Array<{ x: number; z: number }> = [];
  for (let iz = nz; iz >= 0; iz--) {
    eastPts.push({ x: DIORAMA_HALF_W, z: -DIORAMA_HALF_D + (2 * DIORAMA_HALF_D * iz) / nz });
  }
  addRibbon(eastPts, false);

  // West left wall (-X, from -D to +D)
  const westPts: Array<{ x: number; z: number }> = [];
  for (let iz = 0; iz <= nz; iz++) {
    westPts.push({ x: -DIORAMA_HALF_W, z: -DIORAMA_HALF_D + (2 * DIORAMA_HALF_D * iz) / nz });
  }
  addRibbon(westPts, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCragFormation(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  height: number,
  seed: number,
  mat: THREE.Material,
  disposables: Array<{ dispose: () => void }>,
  splitCleft = false
): THREE.Group {
  const group = new THREE.Group();
  const baseY = getTerrainHeight(cx, cz);
  group.position.set(cx, baseY - 0.5, cz);

  const parts = splitCleft ? 8 : 6;
  for (let i = 0; i < parts; i++) {
    const angle = (i / parts) * Math.PI * 2 + seed;
    const dist = i === 0 ? 0 : (0.35 + ((i * 37) % 10) * 0.035);
    let ox = Math.cos(angle) * rx * dist;
    let oz = Math.sin(angle) * rz * dist;
    if (splitCleft) {
      // Kesikkaya's signature human-cut rock cleft dividing two tall crags
      ox += i % 2 === 0 ? -1.45 : 1.45;
    }

    const geo = new THREE.DodecahedronGeometry(1.0, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const n = 0.82 + 0.34 * Math.sin(vx * 3.1 + vy * 2.7 + seed + i);
      // Flatten underside and craggy top
      const sy = vy < 0 ? vy * 0.55 : vy * (0.95 + (i % 3) * 0.18);
      pos.setXYZ(v, vx * n, sy + 0.48, vz * n);
    }
    geo.computeVertexNormals();
    disposables.push(geo);

    const mesh = new THREE.Mesh(geo, mat);
    const scaleH = height * (i === 0 ? 1.0 : 0.62 + ((i * 19) % 7) * 0.055);
    mesh.scale.set(rx * 0.44, scaleH, rz * 0.44);
    mesh.position.set(ox, 0, oz);
    mesh.rotation.y = angle * 0.7;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

export function buildTerrainAndBase(mats: DioramaMaterialLibrary): TerrainBuildResult {
  const terrainBaseGroup = new THREE.Group();
  terrainBaseGroup.name = 'TERRAIN_BASE';

  const documentedTerrainProps = new THREE.Group();
  documentedTerrainProps.name = 'DOCUMENTED_TERRAIN_FEATURES';

  const disposables: Array<{ dispose: () => void }> = [];
  const geoDisposables: THREE.BufferGeometry[] = [];

  // 1. High-Resolution Boğazkale Topography Surface
  const nx = 176;
  const nz = 208;
  const planeGeo = new THREE.PlaneGeometry(DIORAMA_HALF_W * 2, DIORAMA_HALF_D * 2, nx, nz);
  planeGeo.rotateX(-Math.PI / 2);

  const posAttr = planeGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const colDryEarth = new THREE.Color(0xb89f72);
  const colSteppeOlive = new THREE.Color(0x9b9263);
  const colLimestoneRock = new THREE.Color(0xc5bfb3);
  const colDarkCliff = new THREE.Color(0x8b8479);
  const colGorgeSoil = new THREE.Color(0x7c7a55);
  const colRoadTint = new THREE.Color(0xd6c7ab);
  const scratch = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    const slope = getTerrainSlope(x, z);
    const patchNoise = fbm2D(x * 0.05 + 9.2, z * 0.05 - 4.1, 3) * 0.5 + 0.5;

    // Base soil/steppe blend
    scratch.copy(colDryEarth).lerp(colSteppeOlive, Math.min(1, Math.max(0, patchNoise * 0.85)));

    // Damp riparian greenery in Büyükkaya Deresi gorge
    const gorgeCenterX = 53 + Math.sin(z * 0.032) * 5.5 - z * 0.05;
    const distGorge = Math.abs(x - gorgeCenterX);
    if (distGorge < 10) {
      scratch.lerp(colGorgeSoil, (1 - distGorge / 10) * 0.75);
    }

    // Steep rocky slopes expose grey-buff Boğazkale limestone
    if (slope > 0.36) {
      const rockT = Math.min(1, (slope - 0.36) / 0.55);
      scratch.lerp(y > 14 ? colLimestoneRock : colDarkCliff, rockT * 0.9);
    }

    // Subtle path & ceremonial road ground tinting
    let minRoadDist = Infinity;
    for (const road of ROAD_NETWORK) {
      const d = distanceToPolyline(x, z, road);
      if (d < minRoadDist) minRoadDist = d;
    }
    if (minRoadDist < 2.2) {
      const roadT = 1 - minRoadDist / 2.2;
      scratch.lerp(colRoadTint, roadT * 0.72);
    }

    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }

  planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  planeGeo.computeVertexNormals();
  disposables.push(planeGeo);

  const terrainMesh = new THREE.Mesh(planeGeo, mats.terrain);
  terrainMesh.name = 'Bogazkale_Topography';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainBaseGroup.add(terrainMesh);

  // 2. Vertical-Cut Geological Strata Skirt (Kenarları dikey kesilmiş toprak ve kaya tabakaları)
  const skirtGeo = buildCutawaySkirtGeometry(nx, nz);
  disposables.push(skirtGeo);
  const skirtMesh = new THREE.Mesh(skirtGeo, mats.strataCutaway);
  skirtMesh.name = 'Cutaway_Geological_Strata';
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  terrainBaseGroup.add(skirtMesh);

  // 3. Clean Architectural Museum Plinth Base + Bronze Nameplate
  const plinthHeight = BASE_CUT_BOTTOM_Y - PLINTH_BOTTOM_Y;
  const plinthGeo = new THREE.BoxGeometry(DIORAMA_HALF_W * 2 + 3.2, plinthHeight, DIORAMA_HALF_D * 2 + 3.2);
  disposables.push(plinthGeo);
  const plinthMesh = new THREE.Mesh(plinthGeo, mats.plinthWood);
  plinthMesh.name = 'Museum_Display_Plinth';
  plinthMesh.position.set(0, PLINTH_BOTTOM_Y + plinthHeight * 0.5, 0);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  terrainBaseGroup.add(plinthMesh);

  // Thin brushed-bronze reveal molding between geological cut and hardwood plinth
  const trimGeo = new THREE.BoxGeometry(DIORAMA_HALF_W * 2 + 0.9, 0.28, DIORAMA_HALF_D * 2 + 0.9);
  disposables.push(trimGeo);
  const trimMesh = new THREE.Mesh(trimGeo, mats.plinthTrim);
  trimMesh.name = 'Museum_Bronze_Trim';
  trimMesh.position.set(0, BASE_CUT_BOTTOM_Y - 0.08, 0);
  terrainBaseGroup.add(trimMesh);

  // Engraved museum title plaque centered on the front (+Z) plinth face
  const plaqueGeo = new THREE.BoxGeometry(34, 1.55, 0.28);
  disposables.push(plaqueGeo);
  const southPlaque = new THREE.Mesh(plaqueGeo, mats.plaqueFace);
  southPlaque.name = 'Museum_Title_Plaque_South';
  southPlaque.position.set(0, PLINTH_BOTTOM_Y + plinthHeight * 0.5, DIORAMA_HALF_D + 1.72);
  terrainBaseGroup.add(southPlaque);

  // Seamless radial studio contact shadow beneath the diorama plinth (no rectangular seam in background)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d')!;
  const sgrad = sctx.createRadialGradient(128, 128, 36, 128, 128, 126);
  sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  sgrad.addColorStop(0.68, 'rgba(0, 0, 0, 0.32)');
  sgrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 256, 256);
  const contactTex = new THREE.CanvasTexture(shadowCanvas);

  const shadowFloorGeo = new THREE.PlaneGeometry(DIORAMA_HALF_W * 2.75, DIORAMA_HALF_D * 2.75);
  shadowFloorGeo.rotateX(-Math.PI / 2);
  disposables.push(shadowFloorGeo);
  const shadowFloorMat = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  disposables.push(contactTex, shadowFloorMat);
  const shadowFloor = new THREE.Mesh(shadowFloorGeo, shadowFloorMat);
  shadowFloor.name = 'Studio_Contact_Shadow';
  shadowFloor.position.y = PLINTH_BOTTOM_Y - 0.05;
  terrainBaseGroup.add(shadowFloor);

  // 4. Büyükkaya Deresi Gorge Stream Ribbon
  const streamPts: THREE.Vector3[] = [];
  for (let z = -DIORAMA_HALF_D + 2; z <= DIORAMA_HALF_D - 4; z += 4) {
    const sx = 53 + Math.sin(z * 0.032) * 5.5 - z * 0.05;
    const sy = getTerrainHeight(sx, z) + 0.14;
    streamPts.push(new THREE.Vector3(sx, sy, z));
  }
  const streamCurve = new THREE.CatmullRomCurve3(streamPts);
  const streamGeo = new THREE.TubeGeometry(streamCurve, 96, 1.25, 6, false);
  streamGeo.scale(1.0, 0.12, 1.0);
  disposables.push(streamGeo);
  const streamMesh = new THREE.Mesh(streamGeo, mats.water);
  streamMesh.name = 'Buyukkaya_Deresi_Stream';
  terrainBaseGroup.add(streamMesh);

  // 5. Ceremonial Stone-Curbed Road Ribbons (Offset >= 0.06 above terrain to prevent Z-fighting)
  ROAD_NETWORK.forEach((road, idx) => {
    const pts3: THREE.Vector3[] = [];
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i];
      const b = road[i + 1];
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const rx = a.x + (b.x - a.x) * t;
        const rz = a.z + (b.z - a.z) * t;
        pts3.push(new THREE.Vector3(rx, getTerrainHeight(rx, rz) + 0.09, rz));
      }
    }
    const last = road[road.length - 1];
    pts3.push(new THREE.Vector3(last.x, getTerrainHeight(last.x, last.z) + 0.09, last.z));

    const curve = new THREE.CatmullRomCurve3(pts3);
    const tubeGeo = new THREE.TubeGeometry(curve, pts3.length * 2, idx === 0 ? 0.92 : 0.68, 5, false);
    tubeGeo.scale(1, 0.08, 1);
    disposables.push(tubeGeo);
    const roadMesh = new THREE.Mesh(tubeGeo, mats.roadRibbon);
    roadMesh.name = `DOC_Ancient_Road_${idx + 1}`;
    roadMesh.receiveShadow = true;
    documentedTerrainProps.add(roadMesh);
  });

  // 6. Documented Natural Limestone Outcrops & Crags (Kesikkaya, Nişantepe, Sarıkale, Yenicekale, Ambarlıkaya, Büyükkale Cliffs)
  const kesikkaya = createCragFormation(-5, -18, 4.4, 3.3, 3.8, 1.1, mats.naturalLimestoneCrag, disposables, true);
  kesikkaya.name = 'DOC_Kesikkaya_Split_Outcrop';
  documentedTerrainProps.add(kesikkaya);

  const nisantepe = createCragFormation(13, 14, 4.8, 3.8, 4.2, 2.4, mats.naturalLimestoneCrag, disposables, false);
  nisantepe.name = 'DOC_Nisantepe_Hieroglyph_Crag';
  // Smooth carved Luwian inscription panel on Nişantepe's NE rock face
  const panelGeo = new THREE.BoxGeometry(2.6, 1.5, 0.35);
  disposables.push(panelGeo);
  const panelMesh = new THREE.Mesh(panelGeo, mats.carvedReliefStone);
  panelMesh.position.set(1.2, 1.8, -1.4);
  panelMesh.rotation.y = 0.35;
  nisantepe.add(panelMesh);
  documentedTerrainProps.add(nisantepe);

  const sarikale = createCragFormation(-31, 13, 5.6, 4.6, 4.6, 3.7, mats.naturalLimestoneCrag, disposables, false);
  sarikale.name = 'DOC_Sarikale_Rock_Outcrop';
  documentedTerrainProps.add(sarikale);

  const yenicekale = createCragFormation(-18, 28, 4.9, 4.2, 3.9, 5.1, mats.naturalLimestoneCrag, disposables, false);
  yenicekale.name = 'DOC_Yenicekale_Rock_Platform';
  documentedTerrainProps.add(yenicekale);

  const ambarlikaya = createCragFormation(11, -28, 4.1, 3.4, 2.8, 6.2, mats.naturalLimestoneCrag, disposables, false);
  ambarlikaya.name = 'DOC_Ambarlikaya_Outcrop';
  documentedTerrainProps.add(ambarlikaya);

  // Sheer craggy cliff buttresses around Büyükkale's steep eastern & northern escarpment
  const bkCliffAngles = [-1.4, -0.9, -0.4, 0.1, 0.55, 1.05, 2.3, 2.8];
  bkCliffAngles.forEach((ang, idx) => {
    const cx = 30 + Math.cos(ang) * 13.2;
    const cz = -6 + Math.sin(ang) * 18.8;
    const crag = createCragFormation(cx, cz, 3.6, 3.4, 3.9, idx * 1.3, mats.naturalLimestoneCrag, disposables, false);
    crag.name = `DOC_Buyukkale_Escarpment_${idx + 1}`;
    documentedTerrainProps.add(crag);
  });

  // 7. Excavated Southern Sacred Ponds (Güney Göletleri — 5 stone-rimmed rectangular reservoirs)
  const pondConfigs = [
    { dx: -3.8, dz: -2.0, w: 5.6, d: 3.0, rot: -0.18 },
    { dx: 3.4, dz: -2.1, w: 5.2, d: 2.9, rot: -0.18 },
    { dx: -4.0, dz: 2.0, w: 5.4, d: 2.7, rot: -0.18 },
    { dx: 2.4, dz: 2.1, w: 4.4, d: 2.6, rot: -0.18 },
    { dx: 6.8, dz: 1.9, w: 2.8, d: 2.5, rot: -0.18 },
  ];
  const pondsGroup = new THREE.Group();
  pondsGroup.name = 'DOC_Guney_Goletleri_Sacred_Ponds';
  pondConfigs.forEach((p) => {
    const px = 19 + p.dx;
    const pz = 32 + p.dz;
    const py = getTerrainHeight(px, pz);

    const rimGeo = new THREE.BoxGeometry(p.w + 0.55, 0.42, p.d + 0.55);
    const waterGeo = new THREE.PlaneGeometry(p.w, p.d);
    waterGeo.rotateX(-Math.PI / 2);
    disposables.push(rimGeo, waterGeo);

    const pondUnit = new THREE.Group();
    pondUnit.position.set(px, py, pz);
    pondUnit.rotation.y = p.rot;

    const rim = new THREE.Mesh(rimGeo, mats.dressedOrthostat);
    rim.position.y = 0.14;
    rim.receiveShadow = true;
    rim.castShadow = true;
    pondUnit.add(rim);

    const surface = new THREE.Mesh(waterGeo, mats.water);
    surface.position.y = 0.37;
    pondUnit.add(surface);

    pondsGroup.add(pondUnit);
  });
  documentedTerrainProps.add(pondsGroup);

  return { terrainBaseGroup, documentedTerrainProps, disposables: [...disposables, ...geoDisposables] };
}
