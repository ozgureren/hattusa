import * as THREE from 'three';
import { ROAD_NETWORK, distanceToPolyline, getTerrainHeight } from './hattusaData';
import type { DioramaMaterialLibrary } from './materials';

export interface ArchitectureBuildResult {
  documentedGroup: THREE.Group;
  hypotheticalGroup: THREE.Group;
  disposables: THREE.BufferGeometry[];
}

function addBlockWing(
  docGroup: THREE.Group,
  hypGroup: THREE.Group,
  mats: DioramaMaterialLibrary,
  unitBox: THREE.BufferGeometry,
  cfg: {
    x: number;
    z: number;
    w: number;
    d: number;
    baseY: number;
    socleH: number;
    mudH: number;
    yaw?: number;
    stoneMat?: THREE.Material;
    mudMat?: THREE.Material;
    roofTrim?: boolean;
    ruinOnly?: boolean;
  }
) {
  const yaw = cfg.yaw ?? 0;
  const sink = 0.85;
  const stoneMesh = new THREE.Mesh(unitBox, cfg.stoneMat ?? mats.dressedOrthostat);
  stoneMesh.position.set(cfg.x, cfg.baseY + (cfg.socleH - sink) * 0.5, cfg.z);
  stoneMesh.rotation.y = yaw;
  stoneMesh.scale.set(cfg.w, cfg.socleH + sink, cfg.d);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  docGroup.add(stoneMesh);

  if (cfg.ruinOnly || cfg.mudH <= 0.05) return;

  const mudMesh = new THREE.Mesh(unitBox, cfg.mudMat ?? mats.mudbrickWall);
  mudMesh.position.set(cfg.x, cfg.baseY + cfg.socleH + cfg.mudH * 0.5, cfg.z);
  mudMesh.rotation.y = yaw;
  mudMesh.scale.set(cfg.w * 0.96, cfg.mudH, cfg.d * 0.96);
  mudMesh.castShadow = true;
  mudMesh.receiveShadow = true;
  hypGroup.add(mudMesh);

  const roofMesh = new THREE.Mesh(unitBox, mats.earthenRoof);
  roofMesh.position.set(cfg.x, cfg.baseY + cfg.socleH + cfg.mudH + 0.07, cfg.z);
  roofMesh.rotation.y = yaw;
  roofMesh.scale.set(cfg.w * 0.92, 0.14, cfg.d * 0.92);
  hypGroup.add(roofMesh);

  if (cfg.roofTrim !== false) {
    const beamMesh = new THREE.Mesh(unitBox, mats.cedarTimber);
    beamMesh.position.set(cfg.x, cfg.baseY + cfg.socleH + cfg.mudH - 0.12, cfg.z);
    beamMesh.rotation.y = yaw;
    beamMesh.scale.set(cfg.w * 0.99, 0.14, cfg.d * 0.99);
    hypGroup.add(beamMesh);
  }
}

function buildGreatTempleComplex(
  mats: DioramaMaterialLibrary,
  unitBox: THREE.BufferGeometry,
  disposables: THREE.BufferGeometry[]
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.name = 'DOC_Buyuk_Tapinak_Temple1';
  const hyp = new THREE.Group();
  hyp.name = 'HYP_Buyuk_Tapinak_Superstructure';

  const cx = -17;
  const cz = -48;
  const ty = getTerrainHeight(cx, cz);
  const yaw = 0.12;

  doc.position.set(cx, ty, cz);
  doc.rotation.y = yaw;
  hyp.position.set(cx, ty, cz);
  hyp.rotation.y = yaw;

  // 1. Monumental Raised Orthostat Terrace Platform (14,500 m² scale -> 25 x 31 units)
  const terraceW = 24.6;
  const terraceD = 30.4;
  const terraceH = 1.05;
  const terrace = new THREE.Mesh(unitBox, mats.cyclopeanStone);
  terrace.position.set(0, terraceH * 0.5 - 0.4, 0);
  terrace.scale.set(terraceW, terraceH + 0.8, terraceD);
  terrace.castShadow = true;
  terrace.receiveShadow = true;
  doc.add(terrace);

  // Paved inner ceremonial terrace & central courtyard
  const pave = new THREE.Mesh(unitBox, mats.courtyardPaving);
  pave.position.set(0, terraceH + 0.04, 0);
  pave.scale.set(terraceW - 0.8, 0.08, terraceD - 0.8);
  pave.receiveShadow = true;
  doc.add(pave);

  const floorY = terraceH + 0.08;

  // 2. Surrounding Double-Ring Magazine Storerooms (82+ elongated bays around the central sanctuary!)
  // North, South, West, and East magazine wings with internal partition walls
  const wingSpecs = [
    // West magazine gallery
    { x: -9.6, z: -1.0, w: 4.2, d: 26.8, socleH: 0.72, mudH: 1.55 },
    // East magazine gallery (southern section left at documented cutaway height to show buried pithoi!)
    { x: 9.6, z: -5.4, w: 4.2, d: 18.0, socleH: 0.72, mudH: 1.55 },
    { x: 9.6, z: 8.2, w: 4.2, d: 8.6, socleH: 0.78, mudH: 0.0, ruinOnly: true },
    // North outer magazine gallery (behind twin adytons)
    { x: 0, z: -12.6, w: 15.0, d: 3.8, socleH: 0.72, mudH: 1.65 },
    // South flank storerooms left & right of Propylon gatehouse
    { x: -5.2, z: 12.6, w: 6.4, d: 3.8, socleH: 0.72, mudH: 1.55 },
    { x: 5.2, z: 12.6, w: 6.4, d: 3.8, socleH: 0.72, mudH: 1.55 },
  ];

  for (const ws of wingSpecs) {
    addBlockWing(doc, hyp, mats, unitBox, {
      x: ws.x,
      z: ws.z,
      w: ws.w,
      d: ws.d,
      baseY: floorY,
      socleH: ws.socleH,
      mudH: ws.mudH,
      ruinOnly: ws.ruinOnly,
    });
  }

  // Partition cross-walls inside magazine bays & giant terracotta Pithoi jars in SE archaeological cutaway bay!
  const pithosGeo = new THREE.CylinderGeometry(0.24, 0.16, 0.58, 8);
  disposables.push(pithosGeo);
  for (let row = 0; row < 5; row++) {
    const pz = 4.6 + row * 1.65;
    const partWall = new THREE.Mesh(unitBox, mats.dressedOrthostat);
    partWall.position.set(9.6, floorY + 0.38, pz - 0.8);
    partWall.scale.set(4.1, 0.76, 0.22);
    doc.add(partWall);

    for (const px of [8.3, 9.2, 10.1, 10.9]) {
      const jar = new THREE.Mesh(pithosGeo, mats.terracottaPithos);
      jar.position.set(px, floorY + 0.29, pz);
      doc.add(jar);
    }
  }

  // 3. Monumental Propylon Entrance Gatehouse (South-East Axis)
  addBlockWing(doc, hyp, mats, unitBox, {
    x: 0,
    z: 12.8,
    w: 3.8,
    d: 4.6,
    baseY: floorY,
    socleH: 0.95,
    mudH: 2.15,
  });

  // Exterior stone ceremonial stairs leading up to Propylon
  for (let s = 0; s < 5; s++) {
    const step = new THREE.Mesh(unitBox, mats.dressedOrthostat);
    step.position.set(0, s * 0.22, 15.6 + (4 - s) * 0.42);
    step.scale.set(4.6, 0.24, 0.5);
    doc.add(step);
  }

  // 4. Inner Sanctuary Complex (Asymmetric Central Court + Twin Cult Cellas of Storm God & Sun Goddess)
  // West Sanctuary Wing
  addBlockWing(doc, hyp, mats, unitBox, {
    x: -4.4,
    z: 0.8,
    w: 2.6,
    d: 12.4,
    baseY: floorY,
    socleH: 0.92,
    mudH: 2.25,
  });
  // East Sanctuary Wing
  addBlockWing(doc, hyp, mats, unitBox, {
    x: 4.4,
    z: 0.8,
    w: 2.6,
    d: 12.4,
    baseY: floorY,
    socleH: 0.92,
    mudH: 2.25,
  });
  // South Inner Vestibule
  addBlockWing(doc, hyp, mats, unitBox, {
    x: -2.4,
    z: 6.8,
    w: 4.6,
    d: 2.2,
    baseY: floorY,
    socleH: 0.88,
    mudH: 1.95,
  });

  // Twin Elevated Cult Adytons (Northern Holy of Holies — protruding asymmetrically as in Boğazkale plan!)
  addBlockWing(doc, hyp, mats, unitBox, {
    x: -2.4,
    z: -6.8,
    w: 5.2,
    d: 4.8,
    baseY: floorY,
    socleH: 1.15,
    mudH: 2.95,
  });
  addBlockWing(doc, hyp, mats, unitBox, {
    x: 2.8,
    z: -6.4,
    w: 4.8,
    d: 5.4,
    baseY: floorY,
    socleH: 1.15,
    mudH: 3.15,
  });

  // Colonnaded Cedar Portico Pillars facing the Inner Cult Courtyard
  for (const px of [-2.4, -0.8, 0.8, 2.4]) {
    const base = new THREE.Mesh(unitBox, mats.dressedOrthostat);
    base.position.set(px, floorY + 0.18, -3.6);
    base.scale.set(0.45, 0.36, 0.45);
    doc.add(base);

    const pillar = new THREE.Mesh(unitBox, mats.cedarTimber);
    pillar.position.set(px, floorY + 1.55, -3.6);
    pillar.scale.set(0.28, 2.4, 0.28);
    hyp.add(pillar);
  }

  // Iconic "Yeşiltaş" (Polished Dark Green Nephrite Ritual Cube) + Courtyard Lustration Basin
  const yesiltas = new THREE.Mesh(unitBox, mats.greenNephriteStone);
  yesiltas.name = 'DOC_Yesiltas_Nephrite_Block';
  yesiltas.position.set(2.1, floorY + 0.42, 4.5);
  yesiltas.scale.set(0.75, 0.75, 0.75);
  yesiltas.castShadow = true;
  doc.add(yesiltas);

  const basinRim = new THREE.Mesh(unitBox, mats.dressedOrthostat);
  basinRim.position.set(-1.5, floorY + 0.2, 2.2);
  basinRim.scale.set(1.6, 0.4, 1.2);
  doc.add(basinRim);

  const basinWater = new THREE.Mesh(unitBox, mats.water);
  basinWater.position.set(-1.5, floorY + 0.41, 2.2);
  basinWater.scale.set(1.25, 0.04, 0.88);
  doc.add(basinWater);

  return { doc, hyp };
}

function buildBuyukkalePalace(
  mats: DioramaMaterialLibrary,
  unitBox: THREE.BufferGeometry
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.name = 'DOC_Buyukkale_Royal_Palace';
  const hyp = new THREE.Group();
  hyp.name = 'HYP_Buyukkale_Royal_Palace';

  // Royal Buildings A–M arranged around Lower, Middle, and Upper Courtyards on the rocky plateau (x~30, z~-6)
  const palaceWings = [
    // Building D: Monumental Square Pillared Audience Hall on NW cliff edge overlooking Hattuşa!
    { x: 24.2, z: -9.5, w: 6.8, d: 7.4, socleH: 1.25, mudH: 3.15, yaw: -0.26 },
    // Building A: Royal Cuneiform Tablet Archive (SE side)
    { x: 35.2, z: 0.8, w: 4.2, d: 7.2, socleH: 0.95, mudH: 2.1, yaw: -0.26 },
    // Building E & F: Northern Royal Apartments
    { x: 28.5, z: -16.8, w: 6.2, d: 4.4, socleH: 1.05, mudH: 2.55, yaw: -0.22 },
    { x: 35.0, z: -14.2, w: 4.8, d: 5.2, socleH: 1.0, mudH: 2.35, yaw: -0.26 },
    // Building B & C: Central Sanctuary & Banquet Wing
    { x: 34.8, z: -6.8, w: 4.6, d: 5.8, socleH: 0.95, mudH: 2.4, yaw: -0.26 },
    // Building G, H & M: Lower Courtyard Administrative & Guard Galleries
    { x: 24.4, z: 1.8, w: 3.6, d: 7.6, socleH: 0.9, mudH: 1.85, yaw: -0.26 },
    { x: 30.8, z: 6.4, w: 7.2, d: 3.2, socleH: 0.9, mudH: 1.9, yaw: -0.26 },
    // Building K: Southwest Gatehouse & Archive
    { x: 21.5, z: 6.8, w: 3.8, d: 3.8, socleH: 1.2, mudH: 2.6, yaw: -0.26 },
  ];

  for (const pw of palaceWings) {
    const by = getTerrainHeight(pw.x, pw.z);
    addBlockWing(doc, hyp, mats, unitBox, {
      x: pw.x,
      z: pw.z,
      w: pw.w,
      d: pw.d,
      baseY: by,
      socleH: pw.socleH,
      mudH: pw.mudH,
      yaw: pw.yaw,
    });
  }

  // Paved Royal Courtyards (Lower, Middle, Upper) + Stoa Colonnades
  const courts = [
    { x: 28.8, z: 2.2, w: 6.6, d: 7.4 },
    { x: 29.8, z: -6.4, w: 6.8, d: 7.8 },
    { x: 31.2, z: -13.2, w: 5.4, d: 4.8 },
  ];
  for (const c of courts) {
    const cy = getTerrainHeight(c.x, c.z);
    const pave = new THREE.Mesh(unitBox, mats.courtyardPaving);
    pave.position.set(c.x, cy + 0.08, c.z);
    pave.rotation.y = -0.26;
    pave.scale.set(c.w, 0.14, c.d);
    pave.receiveShadow = true;
    doc.add(pave);
  }

  // Monumental Southwest Stone Viaduct / Causeway Ramp climbing up to Büyükkale Gate
  const rampSteps = 7;
  for (let i = 0; i < rampSteps; i++) {
    const t = i / (rampSteps - 1);
    const rx = 13.5 + t * 7.2;
    const rz = 9.2 - t * 2.0;
    const groundY = getTerrainHeight(rx, rz);
    const targetY = 12.2 + t * 5.2;
    const pierH = Math.max(1.2, targetY - groundY + 0.8);
    const pier = new THREE.Mesh(unitBox, mats.cyclopeanStone);
    pier.position.set(rx, targetY - pierH * 0.5, rz);
    pier.rotation.y = -0.26;
    pier.scale.set(1.6, pierH, 2.2);
    pier.castShadow = true;
    pier.receiveShadow = true;
    doc.add(pier);
  }

  return { doc, hyp };
}

function buildUpperCityTemplesAndSudburg(
  mats: DioramaMaterialLibrary,
  unitBox: THREE.BufferGeometry,
  disposables: THREE.BufferGeometry[]
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.name = 'DOC_Upper_City_Temples_And_Sudburg';
  const hyp = new THREE.Group();
  hyp.name = 'HYP_Upper_City_Temples_Superstructures';

  // 1. Oda 2 (Südburg — Sacred Hieroglyphic Parabolic Stone Vault beside Nişantepe, x=21.5, z=15.5)
  const sbX = 21.5;
  const sbZ = 15.5;
  const sbY = getTerrainHeight(sbX, sbZ);
  const vaultShape = new THREE.Shape();
  vaultShape.moveTo(-1.8, 0);
  vaultShape.lineTo(1.8, 0);
  vaultShape.lineTo(1.5, 2.1);
  vaultShape.quadraticCurveTo(0, 2.9, -1.5, 2.1);
  vaultShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.85, 0);
  hole.lineTo(0.85, 0);
  hole.quadraticCurveTo(0, 2.05, -0.85, 0);
  vaultShape.holes.push(hole);

  const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, { depth: 3.8, bevelEnabled: false });
  disposables.push(vaultGeo);
  const oda2Vault = new THREE.Mesh(vaultGeo, mats.dressedOrthostat);
  oda2Vault.name = 'DOC_Oda2_Sudburg_Hieroglyphic_Chamber';
  oda2Vault.position.set(sbX, sbY - 0.25, sbZ - 1.9);
  oda2Vault.rotation.y = -0.35;
  oda2Vault.castShadow = true;
  oda2Vault.receiveShadow = true;
  doc.add(oda2Vault);

  // 2. Varied Asymmetric Hittite Courtyard Temples in Upper City (Temples 2, 3, 4, 5 + Central Temple Quarter 6..24)
  interface TemplePlan {
    name: string;
    x: number;
    z: number;
    w: number;
    d: number;
    yaw: number;
    cellaSide: 'north' | 'west' | 'east';
    mudScale: number; // 0 = documented stone foundation ruin only, >0 = full architectural volume
  }

  const temples: TemplePlan[] = [
    // Major Southern & Flank Sanctuary Complexes (Reconstructed with distinct plans & heights)
    { name: 'Temple_5_Grand', x: 25.0, z: 45.0, w: 11.2, d: 12.6, yaw: -0.22, cellaSide: 'north', mudScale: 1.15 },
    { name: 'Temple_2_SW', x: -27.5, z: 46.5, w: 8.6, d: 9.8, yaw: 0.32, cellaSide: 'north', mudScale: 1.0 },
    { name: 'Temple_3_South', x: -15.5, z: 51.0, w: 8.2, d: 9.2, yaw: 0.18, cellaSide: 'west', mudScale: 0.95 },
    { name: 'Temple_4_West', x: -35.5, z: 30.5, w: 7.8, d: 8.6, yaw: 0.42, cellaSide: 'east', mudScale: 0.9 },
    { name: 'Temple_30_East', x: 11.5, z: 44.5, w: 7.2, d: 8.0, yaw: -0.15, cellaSide: 'north', mudScale: 0.88 },
    // Central Upper City Temple Quarter (Mixing varied sanctuaries AND documented foundation ruins!)
    { name: 'Temple_6', x: -6.5, z: 36.5, w: 6.8, d: 7.4, yaw: 0.08, cellaSide: 'north', mudScale: 0.85 },
    { name: 'Temple_7_Ruin', x: 2.5, z: 37.5, w: 6.2, d: 6.8, yaw: -0.12, cellaSide: 'east', mudScale: 0 },
    { name: 'Temple_8', x: -12.5, z: 24.0, w: 6.4, d: 7.2, yaw: 0.22, cellaSide: 'west', mudScale: 0.8 },
    { name: 'Temple_9_Ruin', x: -3.0, z: 27.5, w: 5.8, d: 6.4, yaw: 0.05, cellaSide: 'north', mudScale: 0 },
    { name: 'Temple_10', x: 5.5, z: 28.0, w: 6.5, d: 7.0, yaw: -0.18, cellaSide: 'north', mudScale: 0.82 },
    { name: 'Temple_11_Ruin', x: -19.5, z: 38.0, w: 5.6, d: 6.0, yaw: 0.28, cellaSide: 'west', mudScale: 0 },
    { name: 'Temple_12', x: -8.0, z: 45.5, w: 6.0, d: 6.8, yaw: 0.12, cellaSide: 'east', mudScale: 0.78 },
    { name: 'Temple_14_Ruin', x: 3.5, z: 47.0, w: 5.4, d: 6.2, yaw: -0.08, cellaSide: 'north', mudScale: 0 },
    { name: 'Temple_16_Ruin', x: -23.0, z: 20.5, w: 5.2, d: 5.8, yaw: 0.3, cellaSide: 'north', mudScale: 0 },
    // Sarıkale & Yenicekale Citadel Structures atop Rock Outcrops
    { name: 'Sarikale_Fort_Keep', x: -31.0, z: 13.0, w: 4.8, d: 4.4, yaw: 0.25, cellaSide: 'north', mudScale: 0.95 },
    { name: 'Yenicekale_Cistern_Keep', x: -18.0, z: 28.0, w: 4.2, d: 4.0, yaw: -0.15, cellaSide: 'east', mudScale: 0.75 },
  ];

  for (const tp of temples) {
    const tDoc = new THREE.Group();
    tDoc.name = `DOC_${tp.name}`;
    const tHyp = new THREE.Group();
    tHyp.name = `HYP_${tp.name}`;

    const by = getTerrainHeight(tp.x, tp.z);
    tDoc.position.set(tp.x, by, tp.z);
    tDoc.rotation.y = tp.yaw;
    tHyp.position.set(tp.x, by, tp.z);
    tHyp.rotation.y = tp.yaw;

    // Platform sub-terrace
    const plat = new THREE.Mesh(unitBox, mats.cyclopeanStone);
    plat.position.set(0, -0.25, 0);
    plat.scale.set(tp.w + 0.6, 1.1, tp.d + 0.6);
    plat.receiveShadow = true;
    plat.castShadow = true;
    tDoc.add(plat);

    const court = new THREE.Mesh(unitBox, mats.courtyardPaving);
    court.position.set(0, 0.33, 0);
    court.scale.set(tp.w - 0.4, 0.08, tp.d - 0.4);
    court.receiveShadow = true;
    tDoc.add(court);

    const ruinOnly = tp.mudScale === 0;
    const baseSocle = ruinOnly ? 0.58 : 0.75;
    const wingThick = tp.w * 0.24;

    // 4 asymmetric courtyard perimeter wings + protruding cult adyton cella
    // North wing
    addBlockWing(tDoc, tHyp, mats, unitBox, {
      x: 0,
      z: -tp.d * 0.36,
      w: tp.w * 0.92,
      d: wingThick,
      baseY: 0.36,
      socleH: baseSocle,
      mudH: 1.55 * tp.mudScale,
      ruinOnly,
    });
    // South gatehouse wing
    addBlockWing(tDoc, tHyp, mats, unitBox, {
      x: 0,
      z: tp.d * 0.36,
      w: tp.w * 0.88,
      d: wingThick,
      baseY: 0.36,
      socleH: baseSocle,
      mudH: 1.35 * tp.mudScale,
      ruinOnly,
    });
    // West wing
    addBlockWing(tDoc, tHyp, mats, unitBox, {
      x: -tp.w * 0.36,
      z: 0,
      w: wingThick,
      d: tp.d * 0.62,
      baseY: 0.36,
      socleH: baseSocle,
      mudH: 1.3 * tp.mudScale,
      ruinOnly,
    });
    // East wing
    addBlockWing(tDoc, tHyp, mats, unitBox, {
      x: tp.w * 0.36,
      z: 0,
      w: wingThick,
      d: tp.d * 0.62,
      baseY: 0.36,
      socleH: baseSocle,
      mudH: 1.3 * tp.mudScale,
      ruinOnly,
    });

    // Protruding Asymmetric Cult Cella (Characteristic of Hittite sacred architecture!)
    const cellaX = tp.cellaSide === 'west' ? -tp.w * 0.34 : tp.cellaSide === 'east' ? tp.w * 0.34 : tp.w * 0.14;
    const cellaZ = tp.cellaSide === 'north' ? -tp.d * 0.48 : -tp.d * 0.16;
    addBlockWing(tDoc, tHyp, mats, unitBox, {
      x: cellaX,
      z: cellaZ,
      w: tp.w * 0.42,
      d: tp.d * 0.36,
      baseY: 0.36,
      socleH: baseSocle + 0.22,
      mudH: 2.25 * tp.mudScale,
      ruinOnly,
    });

    doc.add(tDoc);
    hyp.add(tHyp);
  }

  return { doc, hyp };
}

function buildResidentialDistricts(
  mats: DioramaMaterialLibrary,
  unitBox: THREE.BufferGeometry
): { doc: THREE.Group; hyp: THREE.Group } {
  const doc = new THREE.Group();
  doc.name = 'DOC_Residential_Stone_Foundations';
  const hyp = new THREE.Group();
  hyp.name = 'HYP_Residential_Mudbrick_Houses';

  interface HouseBlock {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    socleH: number;
    mudH: number;
    yaw: number;
  }

  const blocks: HouseBlock[] = [];
  let seed = 109;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Place varied multi-wing Anatolian courtyard houses in Lower City (North/Karum) & select Upper City Domestic Quarters
  const zones = [
    // Lower City NW & North Karum Quarter (around Great Temple, avoiding its footprint)
    { xMin: -44, xMax: 16, zMin: -69, zMax: -24, count: 135 },
    // Lower City East slope below Büyükkale
    { xMin: 2, xMax: 22, zMin: -54, zMax: -22, count: 48 },
    // Upper City Western & Northern domestic terraces
    { xMin: -46, xMax: -14, zMin: -12, zMax: 10, count: 38 },
  ];

  for (const zone of zones) {
    let placed = 0;
    let attempts = 0;
    while (placed < zone.count && attempts < zone.count * 8) {
      attempts++;
      const hx = zone.xMin + rand() * (zone.xMax - zone.xMin);
      const hz = zone.zMin + rand() * (zone.zMax - zone.zMin);

      // Avoid Great Temple precinct (-17, -48)
      if (Math.abs(hx + 17) < 16.5 && Math.abs(hz + 48) < 19.5) continue;
      // Avoid Kesikkaya & Ambarlıkaya crags
      if (Math.hypot(hx + 5, hz + 18) < 7.5 || Math.hypot(hx - 11, hz + 28) < 6.5) continue;
      // Avoid Büyükkale mesa
      if (hx > 16 && hz > -24) continue;

      // Avoid ceremonial roads
      let nearRoad = false;
      for (const r of ROAD_NETWORK) {
        if (distanceToPolyline(hx, hz, r) < 2.6) {
          nearRoad = true;
          break;
        }
      }
      if (nearRoad) continue;

      // Avoid overlap with existing houses
      let overlap = false;
      for (const b of blocks) {
        if (Math.hypot(hx - b.x, hz - b.z) < 3.4) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const hy = getTerrainHeight(hx, hz);
      const yaw = (rand() - 0.5) * 0.65;
      const mainW = 2.0 + rand() * 1.8;
      const mainD = 1.6 + rand() * 1.5;
      const mainMudH = 0.95 + rand() * 0.95;

      blocks.push({
        x: hx,
        y: hy,
        z: hz,
        w: mainW,
        d: mainD,
        socleH: 0.48,
        mudH: mainMudH,
        yaw,
      });

      // Add an L-wing or second terraced room 70% of the time so houses form authentic Anatolian courtyard compounds
      if (rand() > 0.28) {
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const lx = mainW * 0.42;
        const lz = mainD * 0.55;
        const wx = hx + cosY * lx + sinY * lz;
        const wz = hz - sinY * lx + cosY * lz;
        blocks.push({
          x: wx,
          y: getTerrainHeight(wx, wz),
          z: wz,
          w: 1.3 + rand() * 0.9,
          d: 1.5 + rand() * 1.1,
          socleH: 0.44,
          mudH: mainMudH * (0.68 + rand() * 0.5),
          yaw,
        });
      }

      placed++;
    }
  }

  const socleInst = new THREE.InstancedMesh(unitBox, mats.cyclopeanStone, blocks.length);
  socleInst.name = 'DOC_House_Stone_Socles';
  socleInst.castShadow = true;
  socleInst.receiveShadow = true;

  const mudInst = new THREE.InstancedMesh(unitBox, mats.mudbrickResidential, blocks.length);
  mudInst.name = 'HYP_House_Mudbrick_Walls';
  mudInst.castShadow = true;
  mudInst.receiveShadow = true;

  const roofInst = new THREE.InstancedMesh(unitBox, mats.earthenRoof, blocks.length);
  roofInst.name = 'HYP_House_Flat_Earthen_Roofs';

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  blocks.forEach((b, i) => {
    const sink = 0.7;
    dummy.position.set(b.x, b.y + (b.socleH - sink) * 0.5, b.z);
    dummy.rotation.set(0, b.yaw, 0);
    dummy.scale.set(b.w, b.socleH + sink, b.d);
    dummy.updateMatrix();
    socleInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(b.x, b.y + b.socleH + b.mudH * 0.5, b.z);
    dummy.scale.set(b.w * 0.95, b.mudH, b.d * 0.95);
    dummy.updateMatrix();
    mudInst.setMatrixAt(i, dummy.matrix);

    // Subtle per-house mudbrick warmth variation
    const v = 0.9 + ((i * 23) % 17) * 0.012;
    tint.setRGB(v, v * 0.97, v * 0.93);
    mudInst.setColorAt(i, tint);

    dummy.position.set(b.x, b.y + b.socleH + b.mudH + 0.05, b.z);
    dummy.scale.set(b.w * 0.9, 0.1, b.d * 0.9);
    dummy.updateMatrix();
    roofInst.setMatrixAt(i, dummy.matrix);
  });

  socleInst.instanceMatrix.needsUpdate = true;
  socleInst.computeBoundingSphere();
  mudInst.instanceMatrix.needsUpdate = true;
  if (mudInst.instanceColor) mudInst.instanceColor.needsUpdate = true;
  mudInst.computeBoundingSphere();
  roofInst.instanceMatrix.needsUpdate = true;
  roofInst.computeBoundingSphere();

  doc.add(socleInst);
  hyp.add(mudInst, roofInst);

  return { doc, hyp };
}

export function buildArchitecture(mats: DioramaMaterialLibrary): ArchitectureBuildResult {
  const documentedGroup = new THREE.Group();
  documentedGroup.name = 'DOCUMENTED_ARCHITECTURE';

  const hypotheticalGroup = new THREE.Group();
  hypotheticalGroup.name = 'HYPOTHETICAL_ARCHITECTURE';

  const disposables: THREE.BufferGeometry[] = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(unitBox);

  // 1. Great Temple (Büyük Tapınak — Lower City)
  const greatTemple = buildGreatTempleComplex(mats, unitBox, disposables);
  documentedGroup.add(greatTemple.doc);
  hypotheticalGroup.add(greatTemple.hyp);

  // 2. Büyükkale Royal Palace Acropolis
  const buyukkale = buildBuyukkalePalace(mats, unitBox);
  documentedGroup.add(buyukkale.doc);
  hypotheticalGroup.add(buyukkale.hyp);

  // 3. Upper City Temples (Temples 2–30), Oda 2 (Südburg), Sarıkale & Yenicekale
  const upperCity = buildUpperCityTemplesAndSudburg(mats, unitBox, disposables);
  documentedGroup.add(upperCity.doc);
  hypotheticalGroup.add(upperCity.hyp);

  // 4. Lower & Upper City Residential Courtyard Districts
  const houses = buildResidentialDistricts(mats, unitBox);
  documentedGroup.add(houses.doc);
  hypotheticalGroup.add(houses.hyp);

  return { documentedGroup, hypotheticalGroup, disposables };
}
