export type EvidenceMode = 'realistic' | 'documented-only' | 'evidence-split';

export type LightingPresetId = 'afternoon' | 'golden-hour' | 'morning' | 'museum-studio';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface LandmarkInfo {
  id: string;
  code: string;
  title: string;
  hittiteName: string;
  zone: 'Genel Yerleşim' | 'Aşağı Şehir (Kuzey)' | 'Büyükkale Akropolü' | 'Yukarı Şehir (Güney)';
  period: string;
  elevationMeters: string;
  position: Vec2;
  cameraPos: Vec3Tuple;
  cameraTarget: Vec3Tuple;
  orthoZoom: number;
  summary: string;
  documentedEvidence: string;
  hypotheticalReconstruction: string;
}

export interface LightingPreset {
  id: LightingPresetId;
  label: string;
  subtitle: string;
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  exposure: number;
}

export const DIORAMA_HALF_W = 76; // X: -76 (Batı) .. +76 (Doğu)
export const DIORAMA_HALF_D = 90; // Z: -90 (Kuzey / Aşağı Şehir) .. +90 (Güney / Yerkapı)
export const BASE_CUT_BOTTOM_Y = -6.8;
export const PLINTH_BOTTOM_Y = -8.6;

// Deterministic hash & value noise for procedural Boğazkale geomorphology
function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (noise2D(x * frequency, z * frequency) * 2 - 1);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

function gaussianHill(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  height: number,
  angleRad = 0
): number {
  const dx = x - cx;
  const dz = z - cz;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const ux = (dx * cosA + dz * sinA) / rx;
  const uz = (-dx * sinA + dz * cosA) / rz;
  const d2 = ux * ux + uz * uz;
  if (d2 > 9) return 0;
  return height * Math.exp(-d2);
}

function plateauMesa(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  innerRadius: number,
  outerRadius: number,
  angleRad: number
): number {
  const dx = x - cx;
  const dz = z - cz;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const ux = (dx * cosA + dz * sinA) / rx;
  const uz = (-dx * sinA + dz * cosA) / rz;
  const r = Math.sqrt(ux * ux + uz * uz);
  return 1 - smoothstep(innerRadius, outerRadius, r);
}

/**
 * Computes the Boğazkale-Hattuşa archaeological terrain height at diorama coordinates (x, z).
 * Coordinate convention:
 *  - North = -Z (Aşağı Şehir / Lower City, ~3.0..6.5 units)
 *  - South = +Z (Yukarı Şehir / Upper City & Yerkapı, rising up to ~22.5 units)
 *  - East  = +X (Büyükkale mesa at x=30, z=-6 & Büyükkaya Deresi gorge at x=54)
 *  - West  = -X (Budaközü western ridge)
 */
export function getTerrainHeight(x: number, z: number): number {
  // 1. Regional North-to-South Anatolian cuesta rise (Lower City in North -> Upper City in South)
  const southT = smoothstep(-78, 76, z);
  let h = 3.2 + Math.pow(southT, 1.32) * 16.6;

  // Step transition along the central Poternenmauer ridge (dividing Lower & Upper City around z = -16)
  h += smoothstep(-26, -6, z) * 2.4;

  // 2. Southern Yerkapı natural ridge crest (crowning the southern perimeter around z = 66..72)
  h += gaussianHill(x, z, 0, 69, 44, 15, 3.6, 0);
  // Slight drop behind Yerkapı outside the southern city wall (z > 74) so the rampart commands the valley
  if (z > 71) {
    h -= smoothstep(71, 89, z) * 4.2;
  }

  // 3. Multi-scale natural Anatolian hill & ridge undulations
  const macroNoise = fbm2D(x * 0.022 + 3.1, z * 0.022 - 1.7, 4);
  const microCrag = fbm2D(x * 0.085 - 5.4, z * 0.085 + 2.3, 3);
  h += macroNoise * 1.65 + microCrag * 0.35;

  // 4. Büyükkale Royal Citadel: Steep flat-topped limestone plateau on East-Central ridge
  const bkMask = plateauMesa(x, z, 30, -6, 13.5, 19.5, 0.68, 1.18, -0.26);
  const bkTargetY = 17.2 + fbm2D(x * 0.06, z * 0.06, 2) * 0.35 + (z + 6) * 0.045;
  h = h * (1 - bkMask) + Math.max(h, bkTargetY) * bkMask;

  // 5. Büyükkaya Deresi deep river gorge along the eastern flank (separating Büyükkale & Kral Kapısı from Büyükkaya)
  const gorgeCenterX = 53 + Math.sin(z * 0.032) * 5.5 - z * 0.05;
  const distToGorge = Math.abs(x - gorgeCenterX);
  const gorgeMask = 1 - smoothstep(3.5, 15.5, distToGorge);
  const gorgeFloorY = 1.6 + smoothstep(-85, 80, z) * 5.2;
  h = h * (1 - gorgeMask * 0.88) + gorgeFloorY * (gorgeMask * 0.88);

  // Büyükkaya rocky outcrop northeast across the gorge
  h += gaussianHill(x, z, 65, -42, 10.5, 20, 7.8, 0.2);

  // Western Budaközü valley slope drop-off beyond the western walls
  if (x < -50) {
    h -= smoothstep(-50, -75, -x < 0 ? x : x) * 0; // handled cleanly below
    const westDrop = smoothstep(50, 75, -x);
    h -= westDrop * 4.4;
  }

  // 6. Signature Boğazkale Limestone Outcrops inside Hattuşa (Kesikkaya, Sarıkale, Yenicekale, Nişantepe, Ambarlıkaya)
  // Kesikkaya (near Potern wall)
  h += gaussianHill(x, z, -5, -18, 4.8, 3.6, 3.6, 0.18);
  // Nişantepe (rock inscription crag in Upper City)
  h += gaussianHill(x, z, 13, 14, 5.2, 4.2, 4.1, -0.3);
  // Sarıkale (western Upper City rock fortress)
  h += gaussianHill(x, z, -31, 13, 6.2, 5.0, 4.5, 0.25);
  // Yenicekale (central-west rock platform)
  h += gaussianHill(x, z, -18, 28, 5.4, 4.6, 3.8, -0.15);
  // Ambarlıkaya (between Lower City and Büyükkale)
  h += gaussianHill(x, z, 11, -28, 4.5, 3.8, 2.9, 0.1);

  // 7. Graded Archaeological Terraces (so monumental temple complexes & ponds sit naturally on prepared platforms)
  // Büyük Tapınak (Great Temple) terrace in Lower City (-17, -48)
  const gtMask = plateauMesa(x, z, -17, -48, 17.5, 20.5, 0.72, 1.08, 0.12);
  const gtTerraceY = 5.4;
  h = h * (1 - gtMask * 0.88) + gtTerraceY * (gtMask * 0.88);

  // Southern Sacred Ponds (Güney Göletleri) basin at (19, 32)
  const pondMask = plateauMesa(x, z, 19, 32, 9.2, 6.8, 0.65, 1.05, -0.18);
  const pondBasinY = 14.3;
  h = h * (1 - pondMask * 0.92) + pondBasinY * (pondMask * 0.92);

  // Temple 5 Upper Terrace (25, 45)
  const t5Mask = plateauMesa(x, z, 25, 45, 9.0, 8.5, 0.68, 1.05, -0.2);
  const t5Y = 17.4;
  h = h * (1 - t5Mask * 0.82) + t5Y * (t5Mask * 0.82);

  return Math.max(0.8, h);
}

/**
 * Computes approximate terrain slope magnitude (rise over run) at (x, z).
 */
export function getTerrainSlope(x: number, z: number, eps = 0.75): number {
  const hx1 = getTerrainHeight(x + eps, z);
  const hx0 = getTerrainHeight(x - eps, z);
  const hz1 = getTerrainHeight(x, z + eps);
  const hz0 = getTerrainHeight(x, z - eps);
  const dx = (hx1 - hx0) / (2 * eps);
  const dz = (hz1 - hz0) / (2 * eps);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Evaluates distance from point (x, z) to a polyline for road / wall blending.
 */
export function distanceToPolyline(x: number, z: number, pts: readonly Vec2[]): number {
  let minD2 = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const wx = x - a.x;
    const wz = z - a.z;
    const len2 = vx * vx + vz * vz;
    const t = len2 > 1e-6 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / len2)) : 0;
    const px = a.x + t * vx;
    const pz = a.z + t * vz;
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

// Fortification Wall Polylines (matching Hattuşa's UNESCO archaeological site plan)
export const FORTIFICATION_LINES: Record<
  'upperWestToLion' | 'lionToYerkapi' | 'yerkapiToKing' | 'kingToEastCliff' | 'posternWall' | 'lowerCityWall' | 'buyukkaleWall',
  readonly Vec2[]
> = {
  // Western Upper City wall from Potern junction down to Aslanlı Kapı (SW)
  upperWestToLion: [
    { x: -53, z: -20 },
    { x: -56, z: -6 },
    { x: -56, z: 10 },
    { x: -53, z: 25 },
    { x: -46.5, z: 36.5 },
  ],
  // From Aslanlı Kapı (SW) curving up to Yerkapı / Sfenksli Kapı (South summit)
  lionToYerkapi: [
    { x: -42.5, z: 41.0 },
    { x: -34, z: 52 },
    { x: -22, z: 62 },
    { x: -9, z: 67.5 },
    { x: -3.2, z: 68.5 },
  ],
  // From Yerkapı / Sfenksli Kapı (South summit) curving NE to Kral Kapısı (SE)
  yerkapiToKing: [
    { x: 3.2, z: 68.5 },
    { x: 11, z: 67.2 },
    { x: 24, z: 61.5 },
    { x: 36, z: 51.5 },
    { x: 42.5, z: 42.5 },
  ],
  // From Kral Kapısı (SE) along the eastern Büyükkaya gorge rim up to Büyükkale SE corner
  kingToEastCliff: [
    { x: 45.0, z: 37.0 },
    { x: 47, z: 24 },
    { x: 45, z: 11 },
    { x: 41, z: 2 },
  ],
  // Poternli Sur (Inner dividing wall between Lower City and Upper City, passing Kesikkaya)
  posternWall: [
    { x: -53, z: -20 },
    { x: -38, z: -21 },
    { x: -22, z: -20 },
    { x: -9, z: -18.5 },
    { x: 4, z: -16.5 },
    { x: 18, z: -13 },
  ],
  // Lower City (Aşağı Şehir) Northern & Northwestern Enclosure Wall
  lowerCityWall: [
    { x: -53, z: -20 },
    { x: -52, z: -38 },
    { x: -47, z: -56 },
    { x: -36, z: -71 },
    { x: -18, z: -76 },
    { x: 2, z: -73 },
    { x: 18, z: -62 },
    { x: 28, z: -44 },
    { x: 31, z: -26 },
  ],
  // Büyükkale Royal Citadel Perimeter Wall
  buyukkaleWall: [
    { x: 21, z: -21 },
    { x: 34, z: -23 },
    { x: 42, z: -13 },
    { x: 41, z: 4 },
    { x: 32, z: 11 },
    { x: 21, z: 8 },
    { x: 18, z: -6 },
    { x: 21, z: -21 },
  ],
};

// Ceremonial avenues & dirt paths connecting gates, temples, and Büyükkale
export const ROAD_NETWORK: readonly (readonly Vec2[])[] = [
  // Main Sacred Processional Way: North Gate -> Büyük Tapınak -> Kesikkaya Pass -> Büyükkale Viaduct -> Upper City
  [
    { x: -18, z: -75 },
    { x: -16, z: -64 },
    { x: -2, z: -52 },
    { x: -1, z: -34 },
    { x: 0, z: -17 },
    { x: 7, z: -4 },
    { x: 18, z: 7 },
  ],
  // Western Ceremonial Avenue: Büyük Tapınak -> Western Postern -> Sarıkale -> Aslanlı Kapı
  [
    { x: -16, z: -32 },
    { x: -24, z: -19 },
    { x: -36, z: -2 },
    { x: -41, z: 18 },
    { x: -44.5, z: 38.5 },
  ],
  // Upper City Southern Temple Ring: Aslanlı Kapı -> Temple 2/3 -> Yerkapı Inner Stairs -> Temple 5 -> Kral Kapısı
  [
    { x: -43, z: 38 },
    { x: -25, z: 44 },
    { x: -8, z: 54 },
    { x: 0, z: 57 },
    { x: 14, z: 52 },
    { x: 31, z: 45 },
    { x: 43.5, z: 39.5 },
  ],
  // Central Royal Axis: Büyükkale SW Gate -> Nişantepe & Südburg -> Central Temples
  [
    { x: 19, z: 7 },
    { x: 9, z: 15 },
    { x: 0, z: 27 },
    { x: -4, z: 42 },
  ],
  // Exterior gate approach tracks (Lion Gate, Yerkapı Postern, King's Gate)
  [
    { x: -46, z: 40 },
    { x: -55, z: 51 },
    { x: -64, z: 62 },
  ],
  [
    { x: 0, z: 78 },
    { x: 0, z: 87 },
  ],
  [
    { x: 45, z: 40 },
    { x: 53, z: 50 },
    { x: 60, z: 61 },
  ],
];

export const LANDMARKS: readonly LandmarkInfo[] = [
  {
    id: 'overview',
    code: 'HTS-00',
    title: 'Hattuşa — Hitit İmparatorluk Başkenti',
    hittiteName: 'Ḫattuša (Çorum – Boğazkale)',
    zone: 'Genel Yerleşim',
    period: 'MÖ 13. Yüzyıl (III. Hattuşili – IV. Tuthaliya Dönemi)',
    elevationMeters: '1.000 m – 1.265 m (Kuzey-Güney Kot Farkı ~265 m)',
    position: { x: 0, z: 4 },
    cameraPos: { x: 76, y: 108, z: 148 },
    cameraTarget: { x: -1, y: 8.5, z: 1 },
    orthoZoom: 0.96,
    summary:
      'Budaközü ve Büyükkaya derelerinin sınırladığı sarp kayalık yamaçlar üzerine kurulan Hattuşa, 6,6 km’yi aşan sandık duvarlı (kastenmauer) surları, anıtsal kapıları, Büyükkale kraliyet sarayı ve 31 tapınağıyla Geç Tunç Çağı Anadolu mimarisinin zirvesidir.',
    documentedEvidence:
      'UNESCO Dünya Mirası (#377) kazı planları, kiklopik kalker temel örgüsü, Yerkapı taş kaplamalı seti, potern tünelleri, tapınak ortostat subasmanları, gölet tabanları ve kaya kabartmaları.',
    hypotheticalReconstruction:
      'Taş subasman üzerindeki güneşte kurutulmuş kerpiç (adobe) sur bedenleri, ahşap hatıllı ikinci katlar, düz toprak dam örtüleri ve yuvarlatılmış Hitit mazgal siperleri.',
  },
  {
    id: 'great-temple',
    code: 'HTS-01',
    title: 'Büyük Tapınak (Tapınak 1) ve Ambar Galerileri',
    hittiteName: 'É DINGIR-LIM GAL (Fırtına Tanrısı ve Arinna Güneş Tanrıçası)',
    zone: 'Aşağı Şehir (Kuzey)',
    period: 'MÖ 13. Yüzyıl Başları',
    elevationMeters: '1.035 m (Aşağı Şehir Terası)',
    position: { x: -17, z: -48 },
    cameraPos: { x: 42, y: 58, z: -2 },
    cameraTarget: { x: -17, y: 6.5, z: -48 },
    orthoZoom: 2.55,
    summary:
      'Aşağı Şehir’in merkezinde yaklaşık 14.500 m²’lik yapay teras üzerinde yükselen en büyük Hitit dini kompleksi. Merkezdeki kutsal avlu ve ikiz kült odalarını (cella), dört yönden 80’den fazla uzun erzak/tablet depo galerisi kuşatır.',
    documentedEvidence:
      'Devasa işlenmiş kalker blok (ortostat) temeller, anıtsal propylon girişi, avludaki arınma havuzu, nefrit "Yeşiltaş" kült bloğu ve toprağa gömülü dev erzak küpleri (pithoi).',
    hypotheticalReconstruction:
      'Çift katlı ahşap karkaslı kerpiç depo üst yapısı, yükseltilmiş kült odası çatı fenerleri ve düz sıkıştırılmış toprak teras çatıları.',
  },
  {
    id: 'buyukkale',
    code: 'HTS-02',
    title: 'Büyükkale Kraliyet Akropolü ve Saray Kompleksi',
    hittiteName: 'Büyükkale — Büyük Kral’ın İkametgâhı',
    zone: 'Büyükkale Akropolü',
    period: 'MÖ 14. – 13. Yüzyıl',
    elevationMeters: '1.145 m (Doğal Kalker Platosu)',
    position: { x: 30, z: -6 },
    cameraPos: { x: 92, y: 68, z: 42 },
    cameraTarget: { x: 30, y: 18, z: -6 },
    orthoZoom: 2.65,
    summary:
      'Doğu vadiye hâkim sarp kayalık bir masa-tepe üzerinde yükselen müstahkem kraliyet sarayı. Sütunlu galerilerle çevrili ardışık avlulardan, D Binası kabul salonundan, çivi yazılı kraliyet arşivlerinden ve özel tapınak yapılarından oluşur.',
    documentedEvidence:
      '250 × 140 m kayalık plato üzerindeki A–M saray yapılarının taş temelleri, güneybatı viyadük rampası, sütun kaideleri ve binlerce çivi yazılı kil tablet arşivi.',
    hypotheticalReconstruction:
      'D Binası’nın çok sütunlu ahşap tavanlı kabul salonu, revaklı avlu sundurmaları ve iki katlı kerpiç kraliyet daireleri.',
  },
  {
    id: 'yerkapi',
    code: 'HTS-03',
    title: 'Yerkapı Anıtsal Seti, Potern Tüneli ve Sfenksli Kapı',
    hittiteName: 'Yerkapı Glacis & Sfenksli Kapı',
    zone: 'Yukarı Şehir (Güney)',
    period: 'MÖ 13. Yüzyıl (IV. Tuthaliya Dönemi)',
    elevationMeters: '1.265 m (Hattuşa’nın En Yüksek Noktası)',
    position: { x: 0, z: 69 },
    cameraPos: { x: 54, y: 66, z: 122 },
    cameraTarget: { x: 0, y: 23.5, z: 69 },
    orthoZoom: 2.55,
    summary:
      'Şehrin en güney ucunda 250 m uzunluğunda, 80 m genişliğinde kireçtaşı kaplamalı yapay piramidal toprak/taş set (glacis). Tabanından 71 m uzunluğunda bindirme taş tonozlu Potern tüneli geçer; zirvesinde Sfenksli Kapı ve çift merdiven yer alır.',
    documentedEvidence:
      'Eğimli beyaz kalker taş kaplama yüzeyi (glacis), iki uçtaki taş merdivenler, 71 m’lik sağlam bindirme tonozlu yaya tüneli ve dört kanatlı sfenks yontusu.',
    hypotheticalReconstruction:
      'Setin sırtındaki kerpiç sur perdesi, kule üst örtüleri ve Sfenksli Kapı’nın üst ahşap/kerpiç geçit kulesi.',
  },
  {
    id: 'lions-gate',
    code: 'HTS-04',
    title: 'Aslanlı Kapı (Güneybatı Anıtsal Şehir Kapısı)',
    hittiteName: 'Aslanlı Kapı',
    zone: 'Yukarı Şehir (Güney)',
    period: 'MÖ 13. Yüzyıl',
    elevationMeters: '1.195 m (Güneybatı Sur Hattı)',
    position: { x: -44.5, z: 38.8 },
    cameraPos: { x: -92, y: 54, z: 78 },
    cameraTarget: { x: -44.5, y: 17.5, z: 38.8 },
    orthoZoom: 3.1,
    summary:
      'Yukarı Şehir’in güneybatı girişini koruyan çift kuleli anıtsal kapı. Parabolik bindirme taş kemerin dış sövelerine yekpare kalker bloklardan kükreyen iki koruyucu aslan (apotropaik protom) yüksek kabartma olarak işlenmiştir.',
    documentedEvidence:
      'Yerinde korunan aslanlı monolit kapı söveleri, kule taş subasmanları, kapı içi sürgü yuvaları ve dış taş yaklaşım rampası.',
    hypotheticalReconstruction:
      'Parabolik taş kemerin tamamlanan tepe kilit bloğu ile iki yan savunma kulesinin kerpiç üst katları ve siperlikleri.',
  },
  {
    id: 'kings-gate',
    code: 'HTS-05',
    title: 'Kral Kapısı (Güneydoğu Anıtsal Şehir Kapısı)',
    hittiteName: 'Kral Kapısı (Savaş Tanrısı Kabartmalı Kapı)',
    zone: 'Yukarı Şehir (Güney)',
    period: 'MÖ 13. Yüzyıl',
    elevationMeters: '1.200 m (Güneydoğu Sur Hattı)',
    position: { x: 43.8, z: 39.8 },
    cameraPos: { x: 94, y: 54, z: 78 },
    cameraTarget: { x: 43.8, y: 17.5, z: 39.8 },
    orthoZoom: 3.1,
    summary:
      'Güneydoğu sur hattında Aslanlı Kapı ile simetrik kurgulanan çift kemerli kapı kompleksi. İç kapı odasının sol sövesinde miğferli, baltalı ve kısa kılıçlı anıtsal Hitit Savaş Tanrısı (Şarruma/Teşup) kabartması yer alır.',
    documentedEvidence:
      'Tamama yakın korunan iç parabolik megalitik taş kemer, Savaş Tanrısı kabartmalı monolit söve ve kavisli dış savunma rampası.',
    hypotheticalReconstruction:
      'İkiz savunma kulelerinin kerpiç beden duvarları, ahşap kapı kanatları ve mazgallı üst devriye terası.',
  },
  {
    id: 'nisantepe-sudburg',
    code: 'HTS-06',
    title: 'Nişantepe, Oda 2 (Südburg) ve Güney Göletleri',
    hittiteName: 'KASKAL.KUR — Yeraltı Dünyası Kutsal Alanı',
    zone: 'Yukarı Şehir (Güney)',
    period: 'MÖ 13. Yüzyıl Sonu (II. Şuppiluliuma)',
    elevationMeters: '1.160 m (Yukarı Şehir Doğu Havzası)',
    position: { x: 18, z: 22 },
    cameraPos: { x: 68, y: 52, z: 58 },
    cameraTarget: { x: 18, y: 15, z: 22 },
    orthoZoom: 2.75,
    summary:
      'Nişantepe kayalığındaki Luvice hiyeroglif yazıtın hemen doğusunda, II. Şuppiluliuma dönemine ait parabolik taş tonozlu Oda 2 (Südburg) ve kentin su ihtiyacını karşılayan beş büyük yapay Güney Göleti yer alır.',
    documentedEvidence:
      'Luvice hiyeroglifli taş tonozlu Oda 2, Nişantepe kaya yazıtı ve kil/kireçtaşı yalıtımlı dikdörtgen su rezervuarları.',
    hypotheticalReconstruction:
      'Kutsal havuz çevresindeki tören terası düzenlemesi ve su tutma bentlerinin özgün su kotu.',
  },
  {
    id: 'upper-temples',
    code: 'HTS-07',
    title: 'Yukarı Şehir Tapınak Mahallesi ve Sarıkale',
    hittiteName: 'Bin Tanrılı İlin Tapınakları (Tapınak 2 – 30)',
    zone: 'Yukarı Şehir (Güney)',
    period: 'MÖ 13. Yüzyıl',
    elevationMeters: '1.155 m – 1.210 m (Yukarı Şehir Terasları)',
    position: { x: -12, z: 34 },
    cameraPos: { x: -64, y: 58, z: 76 },
    cameraTarget: { x: -12, y: 16, z: 34 },
    orthoZoom: 2.35,
    summary:
      'İmparatorluğun dört bir yanındaki yerel tanrılar için inşa edilen, merkezi avlulu fakat birbirinden farklı boyut ve asimetrik planlara sahip tapınaklar topluluğu ile sarp Sarıkale ve Yenicekale kaya kaleleri.',
    documentedEvidence:
      'Tapınak 2, 3, 4, 5 ve merkezi mahalledeki 20’den fazla tapınağın taş subasman planları ile Sarıkale-Yenicekale kaya işçiliği.',
    hypotheticalReconstruction:
      'Ana tapınakların farklı yükseklikteki kerpiç kült odaları; bir kısım yapıda kazı planını doğrudan gösteren taş temel kalıntı sunumu.',
  },
  {
    id: 'potern-wall',
    code: 'HTS-08',
    title: 'Poternli Sur ve Kesikkaya Geçidi',
    hittiteName: 'Eski Şehir Suru (Aşağı – Yukarı Şehir Sınırı)',
    zone: 'Aşağı Şehir (Kuzey)',
    period: 'MÖ 16. – 13. Yüzyıl',
    elevationMeters: '1.085 m (Merkez Eşik Sırtı)',
    position: { x: -5, z: -18 },
    cameraPos: { x: -54, y: 50, z: 18 },
    cameraTarget: { x: -5, y: 10.5, z: -18 },
    orthoZoom: 2.8,
    summary:
      'Eski Hitit çekirdek kentini güneyden sınırlayan, altında sekiz adet taş tonozlu gizli yaya tüneli (potern) bulunan iç savunma hattı ve ikiye yarılmış doğal Kesikkaya kütlesi.',
    documentedEvidence:
      'Sandık duvar taş temelleri, sur altı potern tünelleri ve Kesikkaya’nın insan eliyle işlenmiş kayalık geçidi.',
    hypotheticalReconstruction:
      'Aşağı ve Yukarı Şehir arasındaki iç kontrol kulelerinin kerpiç üst örtüleri ve seğirdim yolu.',
  },
];

export const LIGHTING_PRESETS: readonly LightingPreset[] = [
  {
    id: 'afternoon',
    label: 'Öğleden Sonra Güneşi',
    subtitle: 'Yumuşak Anadolu ikindi ışığı ve doğal rölyef gölgeleri',
    sunAzimuthDeg: -52,
    sunElevationDeg: 38,
    sunColor: 0xffe6c2,
    sunIntensity: 2.65,
    hemiSkyColor: 0xc8daf0,
    hemiGroundColor: 0x6e5a44,
    hemiIntensity: 0.92,
    rimColor: 0x9ab8dc,
    rimIntensity: 0.55,
    exposure: 1.08,
  },
  {
    id: 'golden-hour',
    label: 'Altın Saat',
    subtitle: 'Eğik batı güneşiyle sur ve vadi yükseltilerini vurgulayan ışık',
    sunAzimuthDeg: -74,
    sunElevationDeg: 22,
    sunColor: 0xffb974,
    sunIntensity: 2.9,
    hemiSkyColor: 0xa6bede,
    hemiGroundColor: 0x5c4632,
    hemiIntensity: 0.78,
    rimColor: 0x7c9ec9,
    rimIntensity: 0.65,
    exposure: 1.06,
  },
  {
    id: 'morning',
    label: 'Sabah Işığı (Doğu)',
    subtitle: 'Büyükkale ve Kral Kapısı cephesini aydınlatan berrak sabah güneşi',
    sunAzimuthDeg: 58,
    sunElevationDeg: 35,
    sunColor: 0xfff0d8,
    sunIntensity: 2.55,
    hemiSkyColor: 0xd4e5f7,
    hemiGroundColor: 0x6b5c49,
    hemiIntensity: 0.96,
    rimColor: 0xd9c3a3,
    rimIntensity: 0.48,
    exposure: 1.08,
  },
  {
    id: 'museum-studio',
    label: 'Müze Sergi Spotu',
    subtitle: 'Arkeoloji müzesi vitrin aydınlatması ve dengeli maket kontrastı',
    sunAzimuthDeg: -36,
    sunElevationDeg: 52,
    sunColor: 0xfff2de,
    sunIntensity: 2.35,
    hemiSkyColor: 0xd8dce2,
    hemiGroundColor: 0x544b42,
    hemiIntensity: 1.05,
    rimColor: 0xc7d2e0,
    rimIntensity: 0.72,
    exposure: 1.12,
  },
];

/**
 * Generates an editable Blender 4.x Python reconstruction script (.py) that builds
 * the exact collection hierarchy (`TERRAIN_BASE`, `DOCUMENTED`, `HYPOTHETICAL`),
 * Boğazkale topography mesh, cutaway strata base, fortifications, gates, Great Temple,
 * Büyükkale, Orthographic 3/4 camera, and 2560x1440 (16:9) afternoon studio lighting.
 */
export function generateBlenderPythonScript(): string {
  return `# -*- coding: utf-8 -*-
"""
HATTUŞA — HİTİT BAŞKENTİ (MÖ 13. YY) 3D ARAZİ DİORAMASI
Blender 4.x Düzenlenebilir Sahne Üretim Betiği (DOCUMENTED / HYPOTHETICAL Koleksiyonları)
Çözünürlük: 2560 x 1440 (16:9) | Kamera: Orthographic Üç Çeyrek İzometrik
Kullanım: Blender -> Scripting sekmesi -> Open / Run Script -> File > Save As (.blend)
"""

import bpy
import bmesh
import math

def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)

def make_collection(name, parent=None):
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col

def make_pbr_mat(name, rgba, roughness=0.85, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

def terrain_height(x, y):
    # Blender +Y = Kuzey (-Z in WebGL), -Y = Güney (+Z in WebGL)
    z_web = -y
    south_t = max(0.0, min(1.0, (z_web + 78.0) / 154.0))
    south_s = south_t * south_t * (3.0 - 2.0 * south_t)
    h = 3.2 + (south_s ** 1.32) * 16.6
    # Yerkapı güney sırtı
    h += 3.6 * math.exp(-((x / 44.0) ** 2 + ((z_web - 69.0) / 15.0) ** 2))
    # Büyükkale platosu
    bk_d = math.sqrt(((x - 30.0) / 13.5) ** 2 + ((z_web + 6.0) / 19.5) ** 2)
    if bk_d < 1.1:
        h = max(h, 17.0)
    # Büyükkaya Deresi vadisi
    gorge_d = abs(x - 53.0)
    if gorge_d < 14.0:
        t = gorge_d / 14.0
        h = h * t + 2.4 * (1.0 - t)
    return h * 0.25

def build_hattusa_diorama():
    reset_scene()
    root_col = make_collection("HATTUSA_DIORAMA")
    col_terrain = make_collection("TERRAIN_BASE", root_col)
    col_doc = make_collection("DOCUMENTED", root_col)
    col_hyp = make_collection("HYPOTHETICAL", root_col)

    mat_terrain = make_pbr_mat("MAT_Anatolian_Steppe", (0.64, 0.56, 0.41, 1.0), 0.92)
    mat_strata = make_pbr_mat("MAT_Cutaway_Strata", (0.28, 0.23, 0.19, 1.0), 0.88)
    mat_stone = make_pbr_mat("MAT_Cyclopean_Limestone_DOC", (0.76, 0.73, 0.67, 1.0), 0.86)
    mat_mudbrick = make_pbr_mat("MAT_Kerpic_Mudbrick_HYP", (0.74, 0.55, 0.38, 1.0), 0.82)
    mat_timber = make_pbr_mat("MAT_Cedar_Timber_HYP", (0.34, 0.23, 0.15, 1.0), 0.78)

    # 1. Topografya ve Dikey Kesilmiş Arazi Platformu
    mesh = bpy.data.meshes.new("Bogazkale_Terrain_Mesh")
    bm = bmesh.new()
    nx, ny = 96, 112
    w, d = 38.0, 45.0
    grid = []
    for iy in range(ny + 1):
        row = []
        yv = -d + (2.0 * d * iy / ny)
        for ix in range(nx + 1):
            xv = -w + (2.0 * w * ix / nx)
            zv = terrain_height(xv * 2.0, yv * 2.0)
            row.append(bm.verts.new((xv, yv, zv)))
        grid.append(row)
    for iy in range(ny):
        for ix in range(nx):
            bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
    bm.to_mesh(mesh)
    bm.free()
    terrain_obj = bpy.data.objects.new("Hattusa_Topography", mesh)
    terrain_obj.data.materials.append(mat_terrain)
    col_terrain.objects.link(terrain_obj)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -1.2))
    plinth = bpy.context.active_object
    plinth.name = "Diorama_Geological_Base"
    plinth.scale = (w, d, 1.2)
    plinth.data.materials.append(mat_strata)
    for c in plinth.users_collection:
        c.objects.unlink(plinth)
    col_terrain.objects.link(plinth)

    # 2. Belgelenen Taş Temeller (DOCUMENTED) ve Varsayımsal Üst Yapılar (HYPOTHETICAL)
    monuments = [
        ("Buyuk_Tapinak_Temel", (-8.5, 24.0), (6.5, 8.0, 0.45), (6.2, 7.6, 0.85)),
        ("Buyukkale_Saray_Platosu", (15.0, 3.0), (5.2, 7.8, 0.55), (4.8, 7.2, 0.95)),
        ("Yerkapi_Glacis_Seti", (0.0, -34.5), (9.5, 3.6, 1.35), (4.2, 0.9, 0.85)),
        ("Aslanli_Kapi", (-22.2, -19.4), (1.8, 1.6, 0.55), (1.7, 1.5, 1.05)),
        ("Kral_Kapisi", (21.9, -19.9), (1.8, 1.6, 0.55), (1.7, 1.5, 1.05)),
    ]
    for name, (mx, my), doc_s, hyp_s in monuments:
        gz = terrain_height(mx * 2.0, my * 2.0)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(mx, my, gz + doc_s[2] * 0.5))
        doc_obj = bpy.context.active_object
        doc_obj.name = f"DOC_{name}"
        doc_obj.scale = doc_s
        doc_obj.data.materials.append(mat_stone)
        for c in doc_obj.users_collection:
            c.objects.unlink(doc_obj)
        col_doc.objects.link(doc_obj)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(mx, my, gz + doc_s[2] + hyp_s[2] * 0.5))
        hyp_obj = bpy.context.active_object
        hyp_obj.name = f"HYP_{name}_Kerpic"
        hyp_obj.scale = hyp_s
        hyp_obj.data.materials.append(mat_mudbrick)
        for c in hyp_obj.users_collection:
            c.objects.unlink(hyp_obj)
        col_hyp.objects.link(hyp_obj)

    # 3. Orthographic Kamera & 2560x1440 Öğleden Sonra Güneşi
    cam_data = bpy.data.cameras.new("Museum_Ortho_Camera")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 96.0
    cam_obj = bpy.data.objects.new("Museum_Ortho_Camera", cam_data)
    cam_obj.location = (58.0, -62.0, 52.0)
    cam_obj.rotation_euler = (math.radians(54.0), 0.0, math.radians(43.0))
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    sun_data = bpy.data.lights.new(name="Afternoon_Anatolian_Sun", type='SUN')
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.91, 0.78)
    sun_obj = bpy.data.objects.new(name="Afternoon_Anatolian_Sun", object_data=sun_data)
    sun_obj.rotation_euler = (math.radians(52.0), math.radians(18.0), math.radians(-48.0))
    bpy.context.scene.collection.objects.link(sun_obj)

    scene = bpy.context.scene
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    if scene.world and scene.world.use_nodes:
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.055, 0.051, 0.048, 1.0)

if __name__ == "__main__":
    build_hattusa_diorama()
`;
}
