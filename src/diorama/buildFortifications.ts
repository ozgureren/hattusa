import * as THREE from 'three';
import { FORTIFICATION_LINES, type Vec2, getTerrainHeight } from './hattusaData';
import type { DioramaMaterialLibrary } from './materials';

export interface FortificationsBuildResult {
  documentedGroup: THREE.Group;
  hypotheticalGroup: THREE.Group;
  disposables: THREE.BufferGeometry[];
}

interface WallSegmentInstance {
  x: number;
  y: number;
  z: number;
  len: number;
  yaw: number;
  stoneH: number;
  mudH: number;
  thick: number;
}

interface TowerInstance {
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  stoneH: number;
  mudH: number;
}

function createParabolicArchGeometry(
  outerW: number,
  outerH: number,
  archSpan: number,
  archRise: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, 0);
  shape.lineTo(outerW / 2, 0);
  shape.lineTo(outerW / 2, outerH);
  shape.lineTo(-outerW / 2, outerH);
  shape.closePath();

  // Hittite parabolic corbelled arch opening
  const hole = new THREE.Path();
  const halfSpan = archSpan / 2;
  hole.moveTo(-halfSpan, 0);
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -halfSpan + t * archSpan;
    // Pointed parabolic Hittite curve
    const u = Math.abs((x / halfSpan));
    const y = archRise * (1 - Math.pow(u, 1.65));
    hole.lineTo(x, Math.max(0.01, y));
  }
  hole.lineTo(halfSpan, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.06,
    bevelThickness: 0.06,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function buildMonumentalGate(
  type: 'lion' | 'king' | 'sphinx',
  x: number,
  yBase: number,
  z: number,
  yaw: number,
  mats: DioramaMaterialLibrary,
  disposables: THREE.BufferGeometry[]
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.position.set(x, yBase, z);
  doc.rotation.y = yaw;

  const hyp = new THREE.Group();
  hyp.position.set(x, yBase, z);
  hyp.rotation.y = yaw;

  const towerW = type === 'sphinx' ? 2.5 : 3.0;
  const towerD = type === 'sphinx' ? 2.8 : 3.6;
  const gap = type === 'sphinx' ? 2.2 : 2.5;
  const towerOffsetX = gap / 2 + towerW / 2;
  const stoneSocleH = type === 'sphinx' ? 2.1 : 2.6;
  const mudUpperH = type === 'sphinx' ? 2.3 : 3.0;

  // 1. Documented Twin Flanking Tower Stone Socles (slightly battered)
  const socleGeo = new THREE.BoxGeometry(towerW, stoneSocleH + 1.2, towerD);
  disposables.push(socleGeo);

  for (const side of [-1, 1]) {
    const socle = new THREE.Mesh(socleGeo, mats.cyclopeanStone);
    socle.position.set(side * towerOffsetX, (stoneSocleH - 1.2) * 0.5, 0);
    socle.castShadow = true;
    socle.receiveShadow = true;
    doc.add(socle);

    // Hypothetical Mudbrick Tower Superstructure + Cedar Timber Tie-Beams + Merlons
    const mudGeo = new THREE.BoxGeometry(towerW * 0.94, mudUpperH, towerD * 0.94);
    const beamGeo = new THREE.BoxGeometry(towerW * 1.01, 0.16, towerD * 1.01);
    const roofGeo = new THREE.BoxGeometry(towerW * 0.88, 0.18, towerD * 0.88);
    disposables.push(mudGeo, beamGeo, roofGeo);

    const mudTower = new THREE.Mesh(mudGeo, mats.mudbrickWall);
    mudTower.position.set(side * towerOffsetX, stoneSocleH + mudUpperH * 0.5, 0);
    mudTower.castShadow = true;
    mudTower.receiveShadow = true;
    hyp.add(mudTower);

    for (const bh of [stoneSocleH + 0.08, stoneSocleH + mudUpperH * 0.52, stoneSocleH + mudUpperH - 0.12]) {
      const beam = new THREE.Mesh(beamGeo, mats.cedarTimber);
      beam.position.set(side * towerOffsetX, bh, 0);
      hyp.add(beam);
    }

    const roof = new THREE.Mesh(roofGeo, mats.earthenRoof);
    roof.position.set(side * towerOffsetX, stoneSocleH + mudUpperH + 0.05, 0);
    hyp.add(roof);

    // Rounded Hittite crenellations around tower top
    const merlonGeo = new THREE.BoxGeometry(0.46, 0.48, 0.26);
    disposables.push(merlonGeo);
    const topY = stoneSocleH + mudUpperH + 0.24;
    for (const mx of [-0.85, 0, 0.85]) {
      for (const mz of [-towerD * 0.42, towerD * 0.42]) {
        const merlon = new THREE.Mesh(merlonGeo, mats.mudbrickWall);
        merlon.position.set(side * towerOffsetX + mx * (towerW / 2.8), topY, mz);
        hyp.add(merlon);
      }
    }
  }

  // 2. Documented Megalithic Parabolic Archways (Outer + Inner Gate Chamber)
  const archGeo = createParabolicArchGeometry(gap + 0.7, stoneSocleH + 0.35, gap * 0.72, stoneSocleH * 0.86, 0.85);
  disposables.push(archGeo);

  const outerArch = new THREE.Mesh(archGeo, mats.dressedOrthostat);
  outerArch.position.set(0, 0, towerD * 0.32);
  outerArch.castShadow = true;
  outerArch.receiveShadow = true;
  doc.add(outerArch);

  const innerArch = new THREE.Mesh(archGeo, mats.dressedOrthostat);
  innerArch.position.set(0, 0, -towerD * 0.32);
  innerArch.castShadow = true;
  innerArch.receiveShadow = true;
  doc.add(innerArch);

  // Paved stone gateway threshold
  const paveGeo = new THREE.BoxGeometry(gap + 0.4, 0.5, towerD + 1.6);
  disposables.push(paveGeo);
  const pave = new THREE.Mesh(paveGeo, mats.courtyardPaving);
  pave.position.set(0, -0.15, 0.2);
  pave.receiveShadow = true;
  doc.add(pave);

  // Hypothetical Gatehouse Upper Bridge connecting the twin towers
  const bridgeGeo = new THREE.BoxGeometry(gap + 0.4, mudUpperH * 0.62, towerD * 0.78);
  disposables.push(bridgeGeo);
  const bridge = new THREE.Mesh(bridgeGeo, mats.mudbrickWall);
  bridge.position.set(0, stoneSocleH + 0.35 + mudUpperH * 0.31, 0);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  hyp.add(bridge);

  // 3. Gate-Specific Apotropaic Sculptures (Documented Archaeological Orthostats!)
  if (type === 'lion') {
    // Roaring Lion Protomes projecting from left & right outer jambs
    const bodyGeo = new THREE.BoxGeometry(0.62, 1.15, 1.25);
    const maneGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.55, 8);
    maneGeo.rotateX(Math.PI / 2);
    const headGeo = new THREE.BoxGeometry(0.48, 0.52, 0.48);
    const pawGeo = new THREE.BoxGeometry(0.22, 0.32, 0.45);
    disposables.push(bodyGeo, maneGeo, headGeo, pawGeo);

    for (const side of [-1, 1]) {
      const lion = new THREE.Group();
      lion.position.set(side * (gap * 0.41), 0, towerD * 0.46);

      const body = new THREE.Mesh(bodyGeo, mats.carvedReliefStone);
      body.position.set(0, 0.62, -0.18);
      lion.add(body);

      const mane = new THREE.Mesh(maneGeo, mats.carvedReliefStone);
      mane.position.set(0, 0.92, 0.32);
      lion.add(mane);

      const head = new THREE.Mesh(headGeo, mats.carvedReliefStone);
      head.position.set(0, 0.88, 0.55);
      lion.add(head);

      for (const px of [-0.16, 0.16]) {
        const paw = new THREE.Mesh(pawGeo, mats.carvedReliefStone);
        paw.position.set(px, 0.18, 0.42);
        lion.add(paw);
      }
      doc.add(lion);
    }

    // Exterior stone approach ramp
    const rampGeo = new THREE.BoxGeometry(3.4, 0.9, 5.2);
    disposables.push(rampGeo);
    const ramp = new THREE.Mesh(rampGeo, mats.cyclopeanStone);
    ramp.position.set(0, -0.35, towerD * 0.5 + 2.3);
    ramp.rotation.x = 0.12;
    ramp.receiveShadow = true;
    doc.add(ramp);
  } else if (type === 'sphinx') {
    // Winged Sphinx Orthostats on Yerkapı Sphinx Gate
    const bodyGeo = new THREE.BoxGeometry(0.52, 1.05, 1.15);
    const wingGeo = new THREE.BoxGeometry(0.14, 0.82, 0.95);
    const headGeo = new THREE.SphereGeometry(0.26, 10, 8);
    const wigGeo = new THREE.BoxGeometry(0.56, 0.52, 0.34);
    disposables.push(bodyGeo, wingGeo, headGeo, wigGeo);

    for (const side of [-1, 1]) {
      const sphinx = new THREE.Group();
      sphinx.position.set(side * (gap * 0.41), 0, towerD * 0.44);

      const body = new THREE.Mesh(bodyGeo, mats.carvedReliefStone);
      body.position.set(0, 0.55, -0.1);
      sphinx.add(body);

      const wing = new THREE.Mesh(wingGeo, mats.carvedReliefStone);
      wing.position.set(side * 0.24, 0.82, -0.05);
      wing.rotation.x = -0.22;
      sphinx.add(wing);

      const wig = new THREE.Mesh(wigGeo, mats.carvedReliefStone);
      wig.position.set(0, 1.12, 0.38);
      sphinx.add(wig);

      const head = new THREE.Mesh(headGeo, mats.carvedReliefStone);
      head.position.set(0, 1.16, 0.48);
      sphinx.add(head);

      doc.add(sphinx);
    }
  } else if (type === 'king') {
    // King's Gate War-God Relief Stele on inner gate jamb + curved exterior bastion ramp
    const steleGeo = new THREE.BoxGeometry(0.32, 1.65, 0.95);
    const figureGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.25, 7);
    const rampWallGeo = new THREE.BoxGeometry(1.3, 1.9, 6.2);
    disposables.push(steleGeo, figureGeo, rampWallGeo);

    const stele = new THREE.Mesh(steleGeo, mats.carvedReliefStone);
    stele.position.set(-gap * 0.36, 0.85, -towerD * 0.32);
    doc.add(stele);

    const reliefFig = new THREE.Mesh(figureGeo, mats.carvedReliefStone);
    reliefFig.position.set(-gap * 0.26, 0.85, -towerD * 0.32);
    doc.add(reliefFig);

    // Defensive flanking ramp bastion characteristic of Kral Kapısı
    const rampBastion = new THREE.Mesh(rampWallGeo, mats.cyclopeanStone);
    rampBastion.position.set(1.9, -0.35, towerD * 0.5 + 2.6);
    rampBastion.rotation.y = -0.32;
    rampBastion.castShadow = true;
    rampBastion.receiveShadow = true;
    doc.add(rampBastion);
  }

  return { doc, hyp };
}

function buildYerkapiMonument(
  mats: DioramaMaterialLibrary,
  disposables: THREE.BufferGeometry[]
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.name = 'DOC_Yerkapi_Glacis_And_Postern';
  const hyp = new THREE.Group();
  hyp.name = 'HYP_Yerkapi_Upper_Curtain';

  const cx = 0;
  const cz = 69.0;
  const groundCenterY = getTerrainHeight(cx, cz);
  const crestY = groundCenterY + 4.9;

  // 1. Monumental Trapezoidal White Limestone-Paved Pyramidal Glacis (250m scale -> 44 units wide, 15 units deep)
  const topHalfW = 16.5;
  const botHalfW = 23.5;
  const topHalfD = 2.1;
  const botHalfD = 8.8;
  const baseDropY = groundCenterY - 3.6;

  const verts = new Float32Array([
    // Top rectangle (0..3)
    cx - topHalfW, crestY, cz - topHalfD,
    cx + topHalfW, crestY, cz - topHalfD,
    cx + topHalfW, crestY, cz + topHalfD,
    cx - topHalfW, crestY, cz + topHalfD,
    // Bottom rectangle (4..7)
    cx - botHalfW, baseDropY, cz - botHalfD,
    cx + botHalfW, baseDropY, cz - botHalfD,
    cx + botHalfW, baseDropY - 1.4, cz + botHalfD,
    cx - botHalfW, baseDropY - 1.4, cz + botHalfD,
  ]);

  const indices = [
    // Top crest platform
    0, 3, 2, 0, 2, 1,
    // South monumental outer glacis slope (+Z)
    3, 7, 6, 3, 6, 2,
    // North inner city glacis slope (-Z)
    1, 5, 4, 1, 4, 0,
    // East flank slope (+X)
    2, 6, 5, 2, 5, 1,
    // West flank slope (-X)
    0, 4, 7, 0, 7, 3,
  ];

  const uvs = new Float32Array([
    0, 1, 6, 1, 6, 0, 0, 0,
    0, 3, 8, 3, 8, 0, 0, 0,
  ]);

  const glacisGeo = new THREE.BufferGeometry();
  glacisGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  glacisGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  glacisGeo.setIndex(indices);
  glacisGeo.computeVertexNormals();
  disposables.push(glacisGeo);

  const glacisMesh = new THREE.Mesh(glacisGeo, mats.glacisPaving);
  glacisMesh.name = 'DOC_Yerkapi_Stone_Glacis';
  glacisMesh.castShadow = true;
  glacisMesh.receiveShadow = true;
  doc.add(glacisMesh);

  // 2. Twin Flanking Monumental Stone Stairways ascending the East & West Glacis Shoulders
  const stepGeo = new THREE.BoxGeometry(1.5, 0.35, 0.72);
  disposables.push(stepGeo);
  for (const side of [-1, 1]) {
    const stairGroup = new THREE.Group();
    stairGroup.name = side < 0 ? 'DOC_Yerkapi_West_Stairs' : 'DOC_Yerkapi_East_Stairs';
    const numSteps = 18;
    for (let s = 0; s < numSteps; s++) {
      const t = s / (numSteps - 1);
      const sx = side * (botHalfW - 2.2 - t * 5.6);
      const sy = baseDropY + 1.2 + t * (crestY - baseDropY - 1.15);
      const sz = cz + (botHalfD - 1.2) * (1 - t) + topHalfD * t * 0.5;
      const step = new THREE.Mesh(stepGeo, mats.dressedOrthostat);
      step.position.set(sx, sy, sz);
      step.castShadow = true;
      step.receiveShadow = true;
      stairGroup.add(step);
    }
    doc.add(stairGroup);
  }

  // 3. Yerkapı 71-Meter Corbelled Postern Tunnel Portals (South Outer Foot + North Inner Foot)
  const posternFrameGeo = createParabolicArchGeometry(2.6, 2.5, 1.35, 1.95, 1.4);
  const darkVoidGeo = new THREE.BoxGeometry(1.3, 1.9, 0.6);
  disposables.push(posternFrameGeo, darkVoidGeo);

  const southFootY = getTerrainHeight(cx, cz + botHalfD - 0.5);
  const southPortal = new THREE.Mesh(posternFrameGeo, mats.cyclopeanStone);
  southPortal.position.set(cx, southFootY - 0.2, cz + botHalfD - 0.3);
  southPortal.castShadow = true;
  doc.add(southPortal);

  const southVoid = new THREE.Mesh(darkVoidGeo, mats.darkTunnelPortal);
  southVoid.position.set(cx, southFootY + 0.75, cz + botHalfD - 0.45);
  doc.add(southVoid);

  const northFootY = getTerrainHeight(cx, cz - botHalfD + 0.5);
  const northPortal = new THREE.Mesh(posternFrameGeo, mats.cyclopeanStone);
  northPortal.position.set(cx, northFootY - 0.2, cz - botHalfD + 0.4);
  doc.add(northPortal);

  const northVoid = new THREE.Mesh(darkVoidGeo, mats.darkTunnelPortal);
  northVoid.position.set(cx, northFootY + 0.75, cz - botHalfD + 0.55);
  doc.add(northVoid);

  // 4. Sfenksli Kapı (Sphinx Gate) crowning the center of Yerkapı Crest + Curtain Wall along the Crest!
  const sphinxGate = buildMonumentalGate('sphinx', cx, crestY, cz, 0, mats, disposables);
  sphinxGate.doc.name = 'DOC_Sphinx_Gate';
  sphinxGate.hyp.name = 'HYP_Sphinx_Gate_Superstructure';
  doc.add(sphinxGate.doc);
  hyp.add(sphinxGate.hyp);

  // Crest Curtain Wall wings left and right of Sphinx Gate
  const wingLen = topHalfW - 3.6;
  const crestStoneGeo = new THREE.BoxGeometry(wingLen, 1.35, 1.65);
  const crestMudGeo = new THREE.BoxGeometry(wingLen, 1.85, 1.45);
  const crestTowerStoneGeo = new THREE.BoxGeometry(2.4, 1.8, 2.4);
  const crestTowerMudGeo = new THREE.BoxGeometry(2.25, 2.5, 2.25);
  disposables.push(crestStoneGeo, crestMudGeo, crestTowerStoneGeo, crestTowerMudGeo);

  for (const side of [-1, 1]) {
    const wx = side * (3.6 + wingLen * 0.5);
    const cStone = new THREE.Mesh(crestStoneGeo, mats.cyclopeanStone);
    cStone.position.set(wx, crestY + 0.65, cz);
    cStone.castShadow = true;
    cStone.receiveShadow = true;
    doc.add(cStone);

    const cMud = new THREE.Mesh(crestMudGeo, mats.mudbrickWall);
    cMud.position.set(wx, crestY + 1.35 + 0.92, cz);
    cMud.castShadow = true;
    cMud.receiveShadow = true;
    hyp.add(cMud);

    // End bastion towers at the corners of the Yerkapı crest
    const tx = side * (topHalfW - 0.8);
    const tStone = new THREE.Mesh(crestTowerStoneGeo, mats.cyclopeanStone);
    tStone.position.set(tx, crestY + 0.9, cz);
    tStone.castShadow = true;
    doc.add(tStone);

    const tMud = new THREE.Mesh(crestTowerMudGeo, mats.mudbrickWall);
    tMud.position.set(tx, crestY + 1.8 + 1.25, cz);
    tMud.castShadow = true;
    hyp.add(tMud);
  }

  return { doc, hyp };
}

export function buildFortifications(mats: DioramaMaterialLibrary): FortificationsBuildResult {
  const documentedGroup = new THREE.Group();
  documentedGroup.name = 'DOCUMENTED_FORTIFICATIONS';

  const hypotheticalGroup = new THREE.Group();
  hypotheticalGroup.name = 'HYPOTHETICAL_FORTIFICATIONS';

  const disposables: THREE.BufferGeometry[] = [];

  const wallSegments: WallSegmentInstance[] = [];
  const towers: TowerInstance[] = [];

  const sampleWallLine = (
    pts: readonly Vec2[],
    opts: { stoneH: number; mudH: number; thick: number; towerEvery: number; skipStartTower?: boolean }
  ) => {
    let distSinceTower = opts.skipStartTower ? 0 : opts.towerEvery;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const totalLen = Math.sqrt(dx * dx + dz * dz);
      const yaw = Math.atan2(dx, dz);
      const steps = Math.max(1, Math.ceil(totalLen / 2.6));
      const segLen = totalLen / steps;

      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const mx = a.x + dx * ((t0 + t1) * 0.5);
        const mz = a.z + dz * ((t0 + t1) * 0.5);
        const y0 = getTerrainHeight(a.x + dx * t0, a.z + dz * t0);
        const y1 = getTerrainHeight(a.x + dx * t1, a.z + dz * t1);
        const baseMinY = Math.min(y0, y1);
        const extraSlopeH = Math.abs(y1 - y0) * 0.75;

        wallSegments.push({
          x: mx,
          y: baseMinY,
          z: mz,
          len: segLen + 0.22,
          yaw,
          stoneH: opts.stoneH + extraSlopeH,
          mudH: opts.mudH,
          thick: opts.thick,
        });

        distSinceTower += segLen;
        if (distSinceTower >= opts.towerEvery) {
          distSinceTower = 0;
          towers.push({
            x: mx,
            y: getTerrainHeight(mx, mz),
            z: mz,
            yaw,
            w: opts.thick + 0.95,
            d: opts.thick + 0.95,
            stoneH: opts.stoneH + 0.55,
            mudH: opts.mudH + 0.95,
          });
        }
      }
    }
  };

  sampleWallLine(FORTIFICATION_LINES.upperWestToLion, { stoneH: 1.55, mudH: 1.85, thick: 1.55, towerEvery: 9.5 });
  sampleWallLine(FORTIFICATION_LINES.lionToYerkapi, {
    stoneH: 1.65,
    mudH: 1.95,
    thick: 1.6,
    towerEvery: 9.2,
    skipStartTower: true,
  });
  sampleWallLine(FORTIFICATION_LINES.yerkapiToKing, {
    stoneH: 1.65,
    mudH: 1.95,
    thick: 1.6,
    towerEvery: 9.2,
    skipStartTower: true,
  });
  sampleWallLine(FORTIFICATION_LINES.kingToEastCliff, {
    stoneH: 1.5,
    mudH: 1.8,
    thick: 1.5,
    towerEvery: 9.5,
    skipStartTower: true,
  });
  sampleWallLine(FORTIFICATION_LINES.posternWall, { stoneH: 1.5, mudH: 1.75, thick: 1.45, towerEvery: 8.8 });
  sampleWallLine(FORTIFICATION_LINES.lowerCityWall, { stoneH: 1.35, mudH: 1.65, thick: 1.4, towerEvery: 10.2 });
  sampleWallLine(FORTIFICATION_LINES.buyukkaleWall, { stoneH: 1.55, mudH: 1.85, thick: 1.45, towerEvery: 8.0 });

  // Batch into InstancedMeshes for crisp detail & ultra-low VRAM / draw calls
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(unitBox);

  const stoneWallInst = new THREE.InstancedMesh(unitBox, mats.cyclopeanStone, wallSegments.length);
  stoneWallInst.name = 'DOC_Casemate_Wall_Stone_Socles';
  stoneWallInst.castShadow = true;
  stoneWallInst.receiveShadow = true;

  const mudWallInst = new THREE.InstancedMesh(unitBox, mats.mudbrickWall, wallSegments.length);
  mudWallInst.name = 'HYP_Casemate_Wall_Mudbrick_Curtains';
  mudWallInst.castShadow = true;
  mudWallInst.receiveShadow = true;

  const timberBeamInst = new THREE.InstancedMesh(unitBox, mats.cedarTimber, wallSegments.length + towers.length * 2);
  timberBeamInst.name = 'HYP_Wall_And_Tower_Cedar_Beams';

  const merlonCount = wallSegments.length * 2 + towers.length * 4;
  const merlonInst = new THREE.InstancedMesh(unitBox, mats.mudbrickWall, merlonCount);
  merlonInst.name = 'HYP_Battlement_Merlons';

  const dummy = new THREE.Object3D();
  let beamIdx = 0;
  let merlonIdx = 0;

  wallSegments.forEach((seg, i) => {
    // Sink stone socle 1.1 units below ground so zero gaps appear on steep Boğazkale slopes
    const totalStoneH = seg.stoneH + 1.1;
    dummy.position.set(seg.x, seg.y + seg.stoneH - totalStoneH * 0.5, seg.z);
    dummy.rotation.set(0, seg.yaw, 0);
    dummy.scale.set(seg.thick, totalStoneH, seg.len);
    dummy.updateMatrix();
    stoneWallInst.setMatrixAt(i, dummy.matrix);

    // Mudbrick upper curtain
    dummy.position.set(seg.x, seg.y + seg.stoneH + seg.mudH * 0.5, seg.z);
    dummy.scale.set(seg.thick * 0.88, seg.mudH, seg.len);
    dummy.updateMatrix();
    mudWallInst.setMatrixAt(i, dummy.matrix);

    // Horizontal cedar tie-beam course between stone socle and mudbrick
    dummy.position.set(seg.x, seg.y + seg.stoneH + 0.06, seg.z);
    dummy.scale.set(seg.thick * 0.94, 0.13, seg.len);
    dummy.updateMatrix();
    timberBeamInst.setMatrixAt(beamIdx++, dummy.matrix);

    // Outer parapet merlons
    const sinY = Math.sin(seg.yaw);
    const cosY = Math.cos(seg.yaw);
    for (const zOff of [-seg.len * 0.24, seg.len * 0.24]) {
      const mx = seg.x + sinY * zOff + cosY * (seg.thick * 0.34);
      const mz = seg.z + cosY * zOff - sinY * (seg.thick * 0.34);
      dummy.position.set(mx, seg.y + seg.stoneH + seg.mudH + 0.18, mz);
      dummy.rotation.set(0, seg.yaw, 0);
      dummy.scale.set(0.24, 0.36, 0.42);
      dummy.updateMatrix();
      merlonInst.setMatrixAt(merlonIdx++, dummy.matrix);
    }
  });

  const stoneTowerInst = new THREE.InstancedMesh(unitBox, mats.cyclopeanStone, towers.length);
  stoneTowerInst.name = 'DOC_Defensive_Tower_Stone_Plinths';
  stoneTowerInst.castShadow = true;
  stoneTowerInst.receiveShadow = true;

  const mudTowerInst = new THREE.InstancedMesh(unitBox, mats.mudbrickWall, towers.length);
  mudTowerInst.name = 'HYP_Defensive_Tower_Mudbrick_Superstructures';
  mudTowerInst.castShadow = true;
  mudTowerInst.receiveShadow = true;

  const roofTowerInst = new THREE.InstancedMesh(unitBox, mats.earthenRoof, towers.length);
  roofTowerInst.name = 'HYP_Defensive_Tower_Roofs';

  towers.forEach((tw, i) => {
    const totalStoneH = tw.stoneH + 1.4;
    dummy.position.set(tw.x, tw.y + tw.stoneH - totalStoneH * 0.5, tw.z);
    dummy.rotation.set(0, tw.yaw, 0);
    dummy.scale.set(tw.w, totalStoneH, tw.d);
    dummy.updateMatrix();
    stoneTowerInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tw.x, tw.y + tw.stoneH + tw.mudH * 0.5, tw.z);
    dummy.scale.set(tw.w * 0.92, tw.mudH, tw.d * 0.92);
    dummy.updateMatrix();
    mudTowerInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tw.x, tw.y + tw.stoneH + tw.mudH + 0.06, tw.z);
    dummy.scale.set(tw.w * 0.84, 0.14, tw.d * 0.84);
    dummy.updateMatrix();
    roofTowerInst.setMatrixAt(i, dummy.matrix);

    // Two timber lacing courses per tower
    for (const bh of [tw.y + tw.stoneH + 0.08, tw.y + tw.stoneH + tw.mudH - 0.14]) {
      dummy.position.set(tw.x, bh, tw.z);
      dummy.scale.set(tw.w * 0.97, 0.14, tw.d * 0.97);
      dummy.updateMatrix();
      timberBeamInst.setMatrixAt(beamIdx++, dummy.matrix);
    }

    // 4 corner merlons per tower
    const sinY = Math.sin(tw.yaw);
    const cosY = Math.cos(tw.yaw);
    const cxOff = tw.w * 0.36;
    const czOff = tw.d * 0.36;
    for (const sx of [-cxOff, cxOff]) {
      for (const sz of [-czOff, czOff]) {
        const mx = tw.x + cosY * sx + sinY * sz;
        const mz = tw.z - sinY * sx + cosY * sz;
        dummy.position.set(mx, tw.y + tw.stoneH + tw.mudH + 0.24, mz);
        dummy.rotation.set(0, tw.yaw, 0);
        dummy.scale.set(0.38, 0.44, 0.38);
        dummy.updateMatrix();
        merlonInst.setMatrixAt(merlonIdx++, dummy.matrix);
      }
    }
  });

  for (const inst of [stoneWallInst, mudWallInst, timberBeamInst, merlonInst, stoneTowerInst, mudTowerInst, roofTowerInst]) {
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }

  documentedGroup.add(stoneWallInst, stoneTowerInst);
  hypotheticalGroup.add(mudWallInst, mudTowerInst, roofTowerInst, timberBeamInst, merlonInst);

  // 2. Monumental Gates: Aslanlı Kapı (SW), Kral Kapısı (SE), and Yerkapı + Sfenksli Kapı (South)
  const lionPos = { x: -44.5, z: 38.8 };
  const lionGate = buildMonumentalGate(
    'lion',
    lionPos.x,
    getTerrainHeight(lionPos.x, lionPos.z),
    lionPos.z,
    -0.68,
    mats,
    disposables
  );
  lionGate.doc.name = 'DOC_Aslanli_Kapi_Lion_Gate';
  lionGate.hyp.name = 'HYP_Aslanli_Kapi_Towers';
  documentedGroup.add(lionGate.doc);
  hypotheticalGroup.add(lionGate.hyp);

  const kingPos = { x: 43.8, z: 39.8 };
  const kingGate = buildMonumentalGate(
    'king',
    kingPos.x,
    getTerrainHeight(kingPos.x, kingPos.z),
    kingPos.z,
    0.72,
    mats,
    disposables
  );
  kingGate.doc.name = 'DOC_Kral_Kapisi_Kings_Gate';
  kingGate.hyp.name = 'HYP_Kral_Kapisi_Towers';
  documentedGroup.add(kingGate.doc);
  hypotheticalGroup.add(kingGate.hyp);

  const yerkapi = buildYerkapiMonument(mats, disposables);
  documentedGroup.add(yerkapi.doc);
  hypotheticalGroup.add(yerkapi.hyp);

  return { documentedGroup, hypotheticalGroup, disposables };
}
