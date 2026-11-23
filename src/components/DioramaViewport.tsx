import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import {
  LANDMARKS,
  LIGHTING_PRESETS,
  type EvidenceMode,
  type LandmarkInfo,
  type LightingPresetId,
  getTerrainHeight,
} from '../diorama/hattusaData';
import { createDioramaMaterials } from '../diorama/materials';
import { buildTerrainAndBase } from '../diorama/buildTerrainAndBase';
import { buildFortifications } from '../diorama/buildFortifications';
import { buildArchitecture } from '../diorama/buildArchitecture';
import { buildEcologyAndFigures } from '../diorama/buildEcologyAndFigures';

export interface DioramaViewportHandle {
  captureRender: (width: number, height: number) => string;
  exportGlbScene: () => Promise<Blob>;
  resetOverview: () => void;
}

interface DioramaViewportProps {
  activeLandmarkId: string;
  onSelectLandmark: (id: string) => void;
  evidenceMode: EvidenceMode;
  lightingPresetId: LightingPresetId;
  sunAzimuthOffset: number;
  showMarkers: boolean;
  showVegetation: boolean;
  showFigures: boolean;
}

const FRUSTUM_SIZE = 156;
const _projVec = new THREE.Vector3();

export const DioramaViewport = forwardRef<DioramaViewportHandle, DioramaViewportProps>(
  function DioramaViewport(
    {
      activeLandmarkId,
      onSelectLandmark,
      evidenceMode,
      lightingPresetId,
      sunAzimuthOffset,
      showMarkers,
      showVegetation,
      showFigures,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const markerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const onSelectRef = useRef(onSelectLandmark);
    onSelectRef.current = onSelectLandmark;

    const engineRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.OrthographicCamera;
      controls: OrbitControls;
      dioramaRoot: THREE.Group;
      documentedRoot: THREE.Group;
      hypotheticalRoot: THREE.Group;
      ecologyGroup: THREE.Group;
      figuresGroup: THREE.Group;
      sunLight: THREE.DirectionalLight;
      hemiLight: THREE.HemisphereLight;
      rimLight: THREE.DirectionalLight;
      applyEvidenceMode: (m: EvidenceMode) => void;
      requestRender: () => void;
      flyTo: (lm: LandmarkInfo) => void;
      updateLighting: (presetId: LightingPresetId, azimuthOffset: number) => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      captureRender(targetW: number, targetH: number): string {
        const eng = engineRef.current;
        const container = mountRef.current;
        if (!eng || !container) return '';

        const { renderer, scene, camera } = eng;
        const prevPixelRatio = renderer.getPixelRatio();
        const prevSize = new THREE.Vector2();
        renderer.getSize(prevSize);

        const prevLeft = camera.left;
        const prevRight = camera.right;
        const prevTop = camera.top;
        const prevBottom = camera.bottom;

        // Configure exact museum 16:9 orthographic projection (e.g. 1280x720 or 2560x1440)
        const aspect = targetW / targetH;
        camera.left = (-FRUSTUM_SIZE * aspect) / 2;
        camera.right = (FRUSTUM_SIZE * aspect) / 2;
        camera.top = FRUSTUM_SIZE / 2;
        camera.bottom = -FRUSTUM_SIZE / 2;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(1);
        renderer.setSize(targetW, targetH, false);
        renderer.render(scene, camera);

        const dataUrl = renderer.domElement.toDataURL('image/png');

        // Restore live viewport dimensions immediately
        camera.left = prevLeft;
        camera.right = prevRight;
        camera.top = prevTop;
        camera.bottom = prevBottom;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(prevPixelRatio);
        renderer.setSize(prevSize.x, prevSize.y, false);
        renderer.render(scene, camera);

        return dataUrl;
      },

      exportGlbScene(): Promise<Blob> {
        return new Promise((resolve, reject) => {
          const eng = engineRef.current;
          if (!eng) {
            reject(new Error('Sahne henüz hazır değil.'));
            return;
          }
          const exporter = new GLTFExporter();
          exporter.parse(
            eng.dioramaRoot,
            (result) => {
              if (result instanceof ArrayBuffer) {
                resolve(new Blob([result], { type: 'model/gltf-binary' }));
              } else {
                const json = JSON.stringify(result, null, 2);
                resolve(new Blob([json], { type: 'model/gltf+json' }));
              }
            },
            (err) => reject(err),
            { binary: true }
          );
        });
      },

      resetOverview() {
        const overview = LANDMARKS[0];
        engineRef.current?.flyTo(overview);
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      // Software WebGL detection (SwiftShader / llvmpipe / WARP)
      const isSoftwareGl = (() => {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      const aspect = width / height;

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.dataset.testid = 'hattusa-webgl-canvas';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x121110);
      scene.fog = new THREE.FogExp2(0x121110, 0.0012);

      // Studio PBR Environment Map (Mandatory RoomEnvironment)
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.42;
      pmremGenerator.dispose();

      // Orthographic Three-Quarter Isometric Camera
      const camera = new THREE.OrthographicCamera(
        (-FRUSTUM_SIZE * aspect) / 2,
        (FRUSTUM_SIZE * aspect) / 2,
        FRUSTUM_SIZE / 2,
        -FRUSTUM_SIZE / 2,
        0.5,
        650
      );
      const initialLm = LANDMARKS[0];
      camera.position.set(initialLm.cameraPos.x, initialLm.cameraPos.y, initialLm.cameraPos.z);
      camera.zoom = initialLm.orthoZoom;
      camera.updateProjectionMatrix();

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(initialLm.cameraTarget.x, initialLm.cameraTarget.y, initialLm.cameraTarget.z);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.minZoom = 0.68;
      controls.maxZoom = 5.5;
      controls.minPolarAngle = 0.22;
      controls.maxPolarAngle = Math.PI * 0.465;
      controls.screenSpacePanning = true;
      controls.update();

      // Three-Point Museum Studio & Afternoon Sunlight Rig
      const hemiLight = new THREE.HemisphereLight(0xc8daf0, 0x6e5a44, 0.92);
      hemiLight.position.set(0, 120, 0);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xffe6c2, 2.65);
      sunLight.castShadow = !isSoftwareGl;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      const shadowBound = 112;
      sunLight.shadow.camera.left = -shadowBound;
      sunLight.shadow.camera.right = shadowBound;
      sunLight.shadow.camera.top = shadowBound;
      sunLight.shadow.camera.bottom = -shadowBound;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 360;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.025;
      scene.add(sunLight);
      scene.add(sunLight.target);

      const rimLight = new THREE.DirectionalLight(0x9ab8dc, 0.55);
      rimLight.position.set(-90, 65, -110);
      scene.add(rimLight);

      // Build Hierarchical Diorama Scene Collections (`TERRAIN_BASE`, `DOCUMENTED`, `HYPOTHETICAL`)
      const dioramaRoot = new THREE.Group();
      dioramaRoot.name = 'HATTUSA_MUSEUM_DIORAMA';

      const documentedRoot = new THREE.Group();
      documentedRoot.name = 'DOCUMENTED';

      const hypotheticalRoot = new THREE.Group();
      hypotheticalRoot.name = 'HYPOTHETICAL';

      let frameId = 0;
      let renderBusy = false;
      let renderDirty = false;

      // Smooth camera transition targets
      let isTransitioning = false;
      const targetCamPos = new THREE.Vector3();
      const targetLookAt = new THREE.Vector3();
      let targetZoom = 1.0;
      let lastTime = performance.now();

      function updateProjectedMarkers() {
        const cw = container?.clientWidth || window.innerWidth;
        const ch = container?.clientHeight || window.innerHeight;
        for (const lm of LANDMARKS) {
          if (lm.id === 'overview') continue;
          const btn = markerRefs.current[lm.id];
          if (!btn) continue;
          const wy = getTerrainHeight(lm.position.x, lm.position.z) + (lm.id === 'yerkapi' ? 9.5 : 5.2);
          _projVec.set(lm.position.x, wy, lm.position.z).project(camera);
          const sx = (_projVec.x * 0.5 + 0.5) * cw;
          const sy = (-_projVec.y * 0.5 + 0.5) * ch;
          const inBounds = _projVec.z < 1 && sx > 24 && sx < cw - 24 && sy > 52 && sy < ch - 60;
          btn.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          btn.style.opacity = inBounds ? '1' : '0';
          btn.style.pointerEvents = inBounds ? 'auto' : 'none';
        }
      }

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (sync && state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function requestRender() {
        if (renderBusy) {
          renderDirty = true;
          return;
        }
        renderBusy = true;
        frameId = requestAnimationFrame((now) => {
          const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
          lastTime = now;
          renderDirty = false;

          let needsMoreFrames = false;
          if (isTransitioning) {
            const k = isSoftwareGl ? 14 : 7.5;
            camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, k, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, k, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, k, dt);

            controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookAt.x, k, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookAt.y, k, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookAt.z, k, dt);

            camera.zoom = THREE.MathUtils.damp(camera.zoom, targetZoom, k, dt);
            camera.updateProjectionMatrix();

            const distPos = camera.position.distanceTo(targetCamPos);
            const distTgt = controls.target.distanceTo(targetLookAt);
            const distZoom = Math.abs(camera.zoom - targetZoom);

            if (distPos < 0.15 && distTgt < 0.12 && distZoom < 0.01) {
              camera.position.copy(targetCamPos);
              controls.target.copy(targetLookAt);
              camera.zoom = targetZoom;
              camera.updateProjectionMatrix();
              isTransitioning = false;
            } else {
              needsMoreFrames = true;
            }
          }

          if (controls.update()) {
            if (!isSoftwareGl) needsMoreFrames = true;
          }

          renderer.render(scene, camera);
          updateProjectedMarkers();

          const done = () => {
            renderBusy = false;
            if (renderDirty || needsMoreFrames) {
              requestRender();
            }
          };
          if (isSoftwareGl) afterDraw(done);
          else done();
        });
      }

      const mats = createDioramaMaterials(renderer, () => requestRender());
      const terrainRes = buildTerrainAndBase(mats);
      const fortRes = buildFortifications(mats);
      const archRes = buildArchitecture(mats);
      const ecoRes = buildEcologyAndFigures(mats);

      terrainRes.terrainBaseGroup.add(ecoRes.ecologyGroup);
      documentedRoot.add(terrainRes.documentedTerrainProps, fortRes.documentedGroup, archRes.documentedGroup);
      hypotheticalRoot.add(fortRes.hypotheticalGroup, archRes.hypotheticalGroup, ecoRes.figuresGroup);

      dioramaRoot.add(terrainRes.terrainBaseGroup, documentedRoot, hypotheticalRoot);
      scene.add(dioramaRoot);

      // Invisible simplified raycast hit proxies on Layer 1 for direct 3D monument picking
      const hitProxies: THREE.Mesh[] = [];
      const proxyGeo = new THREE.SphereGeometry(1, 8, 6);
      const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
      for (const lm of LANDMARKS) {
        if (lm.id === 'overview') continue;
        const proxy = new THREE.Mesh(proxyGeo, proxyMat);
        const py = getTerrainHeight(lm.position.x, lm.position.z) + 2.5;
        proxy.position.set(lm.position.x, py, lm.position.z);
        const radius = lm.id === 'great-temple' || lm.id === 'buyukkale' || lm.id === 'yerkapi' ? 12 : 6.5;
        proxy.scale.setScalar(radius);
        proxy.layers.set(1);
        proxy.userData.landmarkId = lm.id;
        scene.add(proxy);
        hitProxies.push(proxy);
      }

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      const updateLighting = (presetId: LightingPresetId, azimuthOffset: number) => {
        const p = LIGHTING_PRESETS.find((lp) => lp.id === presetId) ?? LIGHTING_PRESETS[0];
        const azRad = THREE.MathUtils.degToRad(p.sunAzimuthDeg + azimuthOffset);
        const elRad = THREE.MathUtils.degToRad(p.sunElevationDeg);
        const dist = 165;
        sunLight.position.set(
          Math.sin(azRad) * Math.cos(elRad) * dist,
          Math.sin(elRad) * dist,
          Math.cos(azRad) * Math.cos(elRad) * dist
        );
        sunLight.color.setHex(p.sunColor);
        sunLight.intensity = p.sunIntensity;

        hemiLight.color.setHex(p.hemiSkyColor);
        hemiLight.groundColor.setHex(p.hemiGroundColor);
        hemiLight.intensity = p.hemiIntensity;

        rimLight.color.setHex(p.rimColor);
        rimLight.intensity = p.rimIntensity;

        renderer.toneMappingExposure = p.exposure;
        requestRender();
      };

      const flyTo = (lm: LandmarkInfo) => {
        targetCamPos.set(lm.cameraPos.x, lm.cameraPos.y, lm.cameraPos.z);
        targetLookAt.set(lm.cameraTarget.x, lm.cameraTarget.y, lm.cameraTarget.z);
        targetZoom = lm.orthoZoom;
        isTransitioning = true;
        lastTime = performance.now();
        requestRender();
      };

      controls.addEventListener('start', () => {
        isTransitioning = false;
      });
      controls.addEventListener('change', () => {
        requestRender();
      });

      // Click-vs-drag raycasting on canvas
      const raycaster = new THREE.Raycaster();
      raycaster.layers.set(1);
      const pointerDownPos = new THREE.Vector2();
      const mouseNdc = new THREE.Vector2();

      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos.set(e.clientX, e.clientY);
      };

      const onPointerUp = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 5) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNdc, camera);
        const hits = raycaster.intersectObjects(hitProxies, false);
        if (hits.length > 0 && hits[0].object.userData.landmarkId) {
          onSelectRef.current(hits[0].object.userData.landmarkId);
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      const onResize = () => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        const asp = w / h;
        camera.left = (-FRUSTUM_SIZE * asp) / 2;
        camera.right = (FRUSTUM_SIZE * asp) / 2;
        camera.top = FRUSTUM_SIZE / 2;
        camera.bottom = -FRUSTUM_SIZE / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      };
      window.addEventListener('resize', onResize);

      // Keyboard navigation (WASD / Arrows pan across Hattuşa topography)
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const panStep = 6 / Math.max(0.8, camera.zoom);
        let moved = false;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          controls.target.z -= panStep;
          camera.position.z -= panStep;
          moved = true;
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          controls.target.z += panStep;
          camera.position.z += panStep;
          moved = true;
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          controls.target.x -= panStep;
          camera.position.x -= panStep;
          moved = true;
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          controls.target.x += panStep;
          camera.position.x += panStep;
          moved = true;
        }
        if (moved) {
          isTransitioning = false;
          controls.update();
          requestRender();
        }
      };
      window.addEventListener('keydown', onKeyDown);

      engineRef.current = {
        renderer,
        scene,
        camera,
        controls,
        dioramaRoot,
        documentedRoot,
        hypotheticalRoot,
        ecologyGroup: ecoRes.ecologyGroup,
        figuresGroup: ecoRes.figuresGroup,
        sunLight,
        hemiLight,
        rimLight,
        applyEvidenceMode: mats.applyEvidenceMode,
        requestRender,
        flyTo,
        updateLighting,
      };

      updateLighting('afternoon', 0);
      requestRender();

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', onKeyDown);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        proxyGeo.dispose();
        proxyMat.dispose();
        for (const g of [
          ...terrainRes.disposables,
          ...fortRes.disposables,
          ...archRes.disposables,
          ...ecoRes.disposables,
        ]) {
          g.dispose();
        }
        mats.dispose();
        envRT.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        engineRef.current = null;
      };
    }, []);

    // Sync Landmark camera choreography
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;
      const lm = LANDMARKS.find((l) => l.id === activeLandmarkId);
      if (lm) eng.flyTo(lm);
    }, [activeLandmarkId]);

    // Sync Evidence Mode (`DOCUMENTED` vs `HYPOTHETICAL` collections)
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.hypotheticalRoot.visible = evidenceMode !== 'documented-only';
      eng.applyEvidenceMode(evidenceMode);
      eng.requestRender();
    }, [evidenceMode]);

    // Sync Studio & Sunlight Presets
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.updateLighting(lightingPresetId, sunAzimuthOffset);
    }, [lightingPresetId, sunAzimuthOffset]);

    // Sync Vegetation & Miniature Figures visibility
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.ecologyGroup.visible = showVegetation;
      eng.figuresGroup.visible = showFigures && evidenceMode !== 'documented-only';
      eng.requestRender();
    }, [showVegetation, showFigures, evidenceMode]);

    return (
      <div className="relative w-full h-full overflow-hidden select-none">
        {/* Dedicated isolated WebGL Canvas Mount */}
        <div ref={mountRef} className="w-full h-full" />

        {/* Projected Accessible Museum Callout Markers */}
        <div
          className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-150 ${
            showMarkers ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!showMarkers}
        >
          {LANDMARKS.filter((l) => l.id !== 'overview').map((lm, index) => {
            const isSelected = activeLandmarkId === lm.id;
            const compactLabels: Record<string, string> = {
              'great-temple': 'Büyük Tapınak',
              buyukkale: 'Büyükkale',
              yerkapi: 'Yerkapı & Sfenksli Kapı',
              'lions-gate': 'Aslanlı Kapı',
              'kings-gate': 'Kral Kapısı',
              'nisantepe-sudburg': 'Nişantepe & Göletler',
              'upper-temples': 'Tapınak Mahallesi',
              'potern-wall': 'Poternli Sur',
            };
            const pinText = compactLabels[lm.id] ?? lm.title;
            return (
              <button
                key={lm.id}
                ref={(el) => {
                  markerRefs.current[lm.id] = el;
                }}
                type="button"
                onClick={() => onSelectLandmark(lm.id)}
                aria-label={`${lm.title} incele`}
                className={`group absolute left-0 top-0 flex flex-col items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#d4a564] ${
                  isSelected ? 'z-20' : 'z-10'
                }`}
              >
                <span
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors border shadow-md ${
                    isSelected
                      ? 'bg-[#c9964c] text-[#14110e] border-[#ebd0a4] font-semibold'
                      : 'bg-[#171411]/95 text-[#e8e1d5] border-[#3d352c] group-hover:border-[#c5934b] group-hover:text-white'
                  }`}
                >
                  <span className="font-mono-tabular text-[10px] opacity-80">0{index + 1}</span>
                  <span>{pinText}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`w-px h-2.5 ${isSelected ? 'bg-[#ebd0a4]' : 'bg-[#c5934b]/75'}`}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
