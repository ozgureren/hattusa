import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIORAMA_HALF_D,
  DIORAMA_HALF_W,
  FORTIFICATION_LINES,
  LANDMARKS,
  LIGHTING_PRESETS,
  distanceToPolyline,
  generateBlenderPythonScript,
  getTerrainHeight,
  getTerrainSlope,
} from './hattusaData';

test('Boğazkale topography rises significantly from Lower City (North) to Upper City & Yerkapı (South)', () => {
  const lowerCityGreatTempleY = getTerrainHeight(-17, -48);
  const centralUpperCityY = getTerrainHeight(0, 32);
  const yerkapiCrestY = getTerrainHeight(0, 69);

  assert.ok(
    lowerCityGreatTempleY < centralUpperCityY,
    `Expected Lower City (${lowerCityGreatTempleY}) < Central Upper City (${centralUpperCityY})`
  );
  assert.ok(
    centralUpperCityY < yerkapiCrestY,
    `Expected Central Upper City (${centralUpperCityY}) < Yerkapı Crest (${yerkapiCrestY})`
  );
  assert.ok(
    yerkapiCrestY - lowerCityGreatTempleY > 14,
    `Expected strong topographic relief > 14 units, got ${yerkapiCrestY - lowerCityGreatTempleY}`
  );
});

test('Büyükkale royal acropolis forms an elevated plateau above the eastern Büyükkaya gorge', () => {
  const buyukkaleCenterY = getTerrainHeight(30, -6);
  const easternGorgeY = getTerrainHeight(53, -6);
  const lowerCityAdjacentY = getTerrainHeight(0, -35);

  assert.ok(
    buyukkaleCenterY > easternGorgeY + 10,
    `Expected Büyükkale (${buyukkaleCenterY}) to tower >10 units above eastern gorge (${easternGorgeY})`
  );
  assert.ok(
    buyukkaleCenterY > lowerCityAdjacentY + 8,
    `Expected Büyükkale (${buyukkaleCenterY}) > Lower City (${lowerCityAdjacentY}) + 8`
  );
  // Plateau top should be relatively flat while cliff edge is steep
  const plateauSlope = getTerrainSlope(30, -6);
  const cliffSlope = getTerrainSlope(43, -6);
  assert.ok(plateauSlope < 0.25, `Expected gentle plateau slope, got ${plateauSlope}`);
  assert.ok(cliffSlope > plateauSlope, `Expected cliff slope (${cliffSlope}) > plateau slope (${plateauSlope})`);
});

test('Monumental gates and landmarks occupy archaeologically accurate relative positions within diorama bounds', () => {
  const byId = new Map(LANDMARKS.map((l) => [l.id, l]));
  const lionGate = byId.get('lions-gate')!;
  const kingGate = byId.get('kings-gate')!;
  const yerkapi = byId.get('yerkapi')!;
  const greatTemple = byId.get('great-temple')!;
  const buyukkale = byId.get('buyukkale')!;

  // Lion Gate in Southwest (-X, +Z), King's Gate in Southeast (+X, +Z), Yerkapı Southmost (0, +Z_max)
  assert.ok(lionGate.position.x < -30 && lionGate.position.z > 25);
  assert.ok(kingGate.position.x > 30 && kingGate.position.z > 25);
  assert.ok(Math.abs(yerkapi.position.x) < 5 && yerkapi.position.z > lionGate.position.z);
  // Great Temple in North (-Z), Büyükkale in East (+X)
  assert.ok(greatTemple.position.z < -30);
  assert.ok(buyukkale.position.x > 20);

  for (const lm of LANDMARKS) {
    assert.ok(Math.abs(lm.position.x) <= DIORAMA_HALF_W);
    assert.ok(Math.abs(lm.position.z) <= DIORAMA_HALF_D);
    assert.ok(lm.documentedEvidence.length > 20);
    assert.ok(lm.hypotheticalReconstruction.length > 20);
  }
});

test('Fortification lines stay within diorama platform and distanceToPolyline computes exact geometry', () => {
  for (const [name, pts] of Object.entries(FORTIFICATION_LINES)) {
    assert.ok(pts.length >= 2, `Wall ${name} has at least 2 vertices`);
    for (const p of pts) {
      assert.ok(Math.abs(p.x) < DIORAMA_HALF_W - 2, `${name} x=${p.x} within bounds`);
      assert.ok(Math.abs(p.z) < DIORAMA_HALF_D - 2, `${name} z=${p.z} within bounds`);
    }
  }

  assert.equal(distanceToPolyline(5, 3, [{ x: 0, z: 0 }, { x: 10, z: 0 }]), 3);
  assert.equal(LIGHTING_PRESETS.length, 4);

  const py = generateBlenderPythonScript();
  assert.ok(py.includes('DOCUMENTED') && py.includes('HYPOTHETICAL'));
  assert.ok(py.includes('2560') && py.includes('1440'));
});
