import * as THREE from 'three';
import {
  DIORAMA_HALF_D,
  DIORAMA_HALF_W,
  ROAD_NETWORK,
  distanceToPolyline,
  getTerrainHeight,
  getTerrainSlope,
} from './hattusaData';
import type { DioramaMaterialLibrary } from './materials';

export interface EcologyBuildResult {
  ecologyGroup: THREE.Group;
  figuresGroup: THREE.Group;
  disposables: THREE.BufferGeometry[];
}

export function buildEcologyAndFigures(mats: DioramaMaterialLibrary): EcologyBuildResult {
  const ecologyGroup = new THREE.Group();
  ecologyGroup.name = 'TERRAIN_STEPPE_ECOLOGY';

  const figuresGroup = new THREE.Group();
  figuresGroup.name = 'HYPOTHETICAL_SCALE_FIGURES';

  const disposables: THREE.BufferGeometry[] = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let seed = 7331;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const isOccupiedByStructure = (x: number, z: number): boolean => {
    // Great Temple terrace
    if (Math.abs(x + 17) < 15.5 && Math.abs(z + 48) < 18.5) return true;
    // Büyükkale inner court
    if (x > 20 && x < 40 && z > -20 && z < 9) return true;
    // Yerkapı glacis
    if (Math.abs(x) < 25 && z > 59 && z < 79) return true;
    // Sacred ponds
    if (Math.abs(x - 19) < 10.5 && Math.abs(z - 32) < 6.5) return true;
    // Roads
    for (const r of ROAD_NETWORK) {
      if (distanceToPolyline(x, z, r) < 2.2) return true;
    }
    return false;
  };

  // 1. Sparse Central Anatolian Scrubs / Dwarf Oaks & Junipers (Composite Trunk + Dual Canopy InstancedMeshes)
  const treePositions: Array<{ x: number; y: number; z: number; s: number; rot: number; greenShift: number }> = [];
  for (let i = 0; i < 650 && treePositions.length < 185; i++) {
    const x = (rand() * 2 - 1) * (DIORAMA_HALF_W - 3.5);
    const z = (rand() * 2 - 1) * (DIORAMA_HALF_D - 3.5);
    if (isOccupiedByStructure(x, z)) continue;
    const slope = getTerrainSlope(x, z);
    if (slope > 0.62) continue;
    // Prefer gorges, outer hillsides, and rocky margins over dense Lower City core
    const inDenseCore = x > -38 && x < 10 && z > -66 && z < -25;
    if (inDenseCore && rand() > 0.18) continue;

    treePositions.push({
      x,
      y: getTerrainHeight(x, z),
      z,
      s: 0.72 + rand() * 0.65,
      rot: rand() * Math.PI * 2,
      greenShift: rand(),
    });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.75, 5);
  trunkGeo.translate(0, 0.375, 0);
  const canopyMainGeo = new THREE.IcosahedronGeometry(0.58, 0);
  canopyMainGeo.scale(1.15, 0.78, 1.05);
  canopyMainGeo.translate(0, 0.92, 0);
  const canopySubGeo = new THREE.IcosahedronGeometry(0.42, 0);
  canopySubGeo.scale(1.0, 0.72, 1.0);
  canopySubGeo.translate(0.28, 0.78, 0.18);
  disposables.push(trunkGeo, canopyMainGeo, canopySubGeo);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, mats.scrubTrunk, treePositions.length);
  const canopy1Inst = new THREE.InstancedMesh(canopyMainGeo, mats.anatolianFoliage, treePositions.length);
  const canopy2Inst = new THREE.InstancedMesh(canopySubGeo, mats.anatolianFoliage, treePositions.length);
  trunkInst.castShadow = true;
  canopy1Inst.castShadow = true;
  canopy2Inst.castShadow = true;

  treePositions.forEach((tp, idx) => {
    dummy.position.set(tp.x, tp.y - 0.05, tp.z);
    dummy.rotation.set(0, tp.rot, 0);
    dummy.scale.setScalar(tp.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    canopy1Inst.setMatrixAt(idx, dummy.matrix);
    canopy2Inst.setMatrixAt(idx, dummy.matrix);

    // Dry olive-sage to dusty juniper tint variation
    color.setHSL(0.21 + tp.greenShift * 0.06, 0.24 + tp.greenShift * 0.1, 0.32 + tp.greenShift * 0.12);
    canopy1Inst.setColorAt(idx, color);
    color.offsetHSL(0.01, 0, -0.04);
    canopy2Inst.setColorAt(idx, color);
  });

  for (const m of [trunkInst, canopy1Inst, canopy2Inst]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }
  ecologyGroup.add(trunkInst, canopy1Inst, canopy2Inst);

  // 2. Dry Anatolian Steppe Grass Tufts (~850 instances)
  const grassGeo = new THREE.ConeGeometry(0.22, 0.42, 4);
  grassGeo.translate(0, 0.21, 0);
  disposables.push(grassGeo);

  const grassTransforms: THREE.Matrix4[] = [];
  const grassColors: THREE.Color[] = [];
  for (let i = 0; i < 1600 && grassTransforms.length < 850; i++) {
    const gx = (rand() * 2 - 1) * (DIORAMA_HALF_W - 2.0);
    const gz = (rand() * 2 - 1) * (DIORAMA_HALF_D - 2.0);
    if (isOccupiedByStructure(gx, gz)) continue;
    const slope = getTerrainSlope(gx, gz);
    if (slope > 0.75) continue;

    const gy = getTerrainHeight(gx, gz);
    dummy.position.set(gx, gy - 0.03, gz);
    dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI, (rand() - 0.5) * 0.2);
    const gs = 0.65 + rand() * 0.85;
    dummy.scale.set(gs * 1.15, gs * (0.7 + rand() * 0.5), gs * 1.15);
    dummy.updateMatrix();
    grassTransforms.push(dummy.matrix.clone());

    const c = new THREE.Color().setHSL(0.12 + rand() * 0.07, 0.32 + rand() * 0.14, 0.42 + rand() * 0.16);
    grassColors.push(c);
  }

  const grassInst = new THREE.InstancedMesh(grassGeo, mats.drySteppeGrass, grassTransforms.length);
  grassInst.name = 'Anatolian_Steppe_Grass_Tufts';
  grassTransforms.forEach((m, i) => {
    grassInst.setMatrixAt(i, m);
    grassInst.setColorAt(i, grassColors[i]);
  });
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  ecologyGroup.add(grassInst);

  // 3. Limestone Boulder & Scree Clusters (~340 instances)
  const rockGeo = new THREE.DodecahedronGeometry(0.38, 0);
  rockGeo.scale(1.2, 0.72, 1.0);
  disposables.push(rockGeo);

  const rockMatrices: THREE.Matrix4[] = [];
  const rockColors: THREE.Color[] = [];
  for (let i = 0; i < 700 && rockMatrices.length < 340; i++) {
    const rx = (rand() * 2 - 1) * (DIORAMA_HALF_W - 2.0);
    const rz = (rand() * 2 - 1) * (DIORAMA_HALF_D - 2.0);
    if (isOccupiedByStructure(rx, rz)) continue;
    const slope = getTerrainSlope(rx, rz);
    // Cluster boulders naturally near rocky slopes and valleys
    if (slope < 0.2 && rand() > 0.35) continue;

    const ry = getTerrainHeight(rx, rz);
    dummy.position.set(rx, ry + 0.08, rz);
    dummy.rotation.set(rand() * 1.5, rand() * Math.PI * 2, rand() * 1.5);
    const rs = 0.55 + rand() * 1.35;
    dummy.scale.set(rs, rs * (0.65 + rand() * 0.5), rs * (0.8 + rand() * 0.4));
    dummy.updateMatrix();
    rockMatrices.push(dummy.matrix.clone());

    const l = 0.56 + rand() * 0.22;
    rockColors.push(new THREE.Color(l, l * 0.97, l * 0.91));
  }

  const rockInst = new THREE.InstancedMesh(rockGeo, mats.naturalLimestoneCrag, rockMatrices.length);
  rockInst.name = 'Boğazkale_Limestone_Scree';
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  rockMatrices.forEach((m, i) => {
    rockInst.setMatrixAt(i, m);
    rockInst.setColorAt(i, rockColors[i]);
  });
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  ecologyGroup.add(rockInst);

  // 4. Miniature Museum Scale Human Figures (~96 figures along ceremonial avenues, temple courts, and gates!)
  const bodyGeo = new THREE.CylinderGeometry(0.055, 0.085, 0.32, 6);
  bodyGeo.translate(0, 0.16, 0);
  const headGeo = new THREE.SphereGeometry(0.052, 6, 5);
  headGeo.translate(0, 0.37, 0);
  disposables.push(bodyGeo, headGeo);

  const figSpots: Array<{ x: number; y: number; z: number; tintHex: number }> = [];
  const robePalette = [0xd8c6aa, 0xb85d3b, 0x3b5978, 0xc79c4e, 0xe6dfd3];

  // Procession along main sacred road & Great Temple Propylon
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const fx = -17 + (rand() - 0.5) * 2.2;
    const fz = -31 + t * 14;
    figSpots.push({
      x: fx,
      y: getTerrainHeight(fx, fz) + (fz < -33 ? 1.12 : 0.08),
      z: fz,
      tintHex: robePalette[i % robePalette.length],
    });
  }
  // Priests inside Great Temple central court
  for (let i = 0; i < 16; i++) {
    const fx = -17 + (rand() - 0.5) * 4.5;
    const fz = -48 + (rand() - 0.5) * 5.5;
    figSpots.push({
      x: fx,
      y: getTerrainHeight(-17, -48) + 1.13,
      z: fz,
      tintHex: robePalette[i % robePalette.length],
    });
  }
  // Royal attendants in Büyükkale courtyards
  for (let i = 0; i < 20; i++) {
    const fx = 29 + (rand() - 0.5) * 5.0;
    const fz = -4 + (rand() - 0.5) * 8.0;
    figSpots.push({
      x: fx,
      y: getTerrainHeight(fx, fz) + 0.15,
      z: fz,
      tintHex: robePalette[(i + 1) % robePalette.length],
    });
  }
  // Guards & travelers at Lion Gate, King's Gate, and Yerkapı approach
  const gateClusters = [
    { x: -46.2, z: 41.2 },
    { x: 45.2, z: 42.0 },
    { x: 0.0, z: 58.5 },
    { x: 19.0, z: 27.5 },
  ];
  for (const gc of gateClusters) {
    for (let k = 0; k < 8; k++) {
      const fx = gc.x + (rand() - 0.5) * 3.2;
      const fz = gc.z + (rand() - 0.5) * 3.2;
      figSpots.push({
        x: fx,
        y: getTerrainHeight(fx, fz) + 0.06,
        z: fz,
        tintHex: robePalette[(k + 2) % robePalette.length],
      });
    }
  }

  const figBodyInst = new THREE.InstancedMesh(bodyGeo, mats.miniatureFigure, figSpots.length);
  const figHeadInst = new THREE.InstancedMesh(headGeo, mats.miniatureFigure, figSpots.length);
  figBodyInst.name = 'HYP_Miniature_Scale_Figures_Bodies';
  figHeadInst.name = 'HYP_Miniature_Scale_Figures_Heads';

  const headSkin = new THREE.Color(0xcfa682);
  figSpots.forEach((fp, i) => {
    dummy.position.set(fp.x, fp.y, fp.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.95 + rand() * 0.18);
    dummy.updateMatrix();
    figBodyInst.setMatrixAt(i, dummy.matrix);
    figHeadInst.setMatrixAt(i, dummy.matrix);
    figBodyInst.setColorAt(i, color.setHex(fp.tintHex));
    figHeadInst.setColorAt(i, headSkin);
  });

  figBodyInst.instanceMatrix.needsUpdate = true;
  if (figBodyInst.instanceColor) figBodyInst.instanceColor.needsUpdate = true;
  figBodyInst.computeBoundingSphere();

  figHeadInst.instanceMatrix.needsUpdate = true;
  if (figHeadInst.instanceColor) figHeadInst.instanceColor.needsUpdate = true;
  figHeadInst.computeBoundingSphere();

  figuresGroup.add(figBodyInst, figHeadInst);

  return { ecologyGroup, figuresGroup, disposables };
}
