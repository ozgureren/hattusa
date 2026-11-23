/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  RotateCcw,
  Sun,
} from 'lucide-react';
import {
  LANDMARKS,
  LIGHTING_PRESETS,
  type EvidenceMode,
  type LightingPresetId,
} from './diorama/hattusaData';
import { DioramaViewport, type DioramaViewportHandle } from './components/DioramaViewport';
import { LandmarkPlaque } from './components/LandmarkPlaque';
import { RenderExportModal, type RenderedPlate } from './components/RenderExportModal';

type DockTab = 'landmarks' | 'collections' | 'lighting';

export default function App() {
  const viewportRef = useRef<DioramaViewportHandle | null>(null);

  const [activeLandmarkId, setActiveLandmarkId] = useState<string>('overview');
  const [plaqueOpen, setPlaqueOpen] = useState<boolean>(false);
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>('realistic');
  const [lightingPresetId, setLightingPresetId] = useState<LightingPresetId>('afternoon');
  const [sunAzimuthOffset, setSunAzimuthOffset] = useState<number>(0);

  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showVegetation, setShowVegetation] = useState<boolean>(true);
  const [showFigures, setShowFigures] = useState<boolean>(true);

  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [activeDockTab, setActiveDockTab] = useState<DockTab>('landmarks');

  const [renderModalOpen, setRenderModalOpen] = useState<boolean>(false);
  const [renderedPlate, setRenderedPlate] = useState<RenderedPlate | null>(null);
  const [isExportingGlb, setIsExportingGlb] = useState<boolean>(false);

  const activeLandmark = LANDMARKS.find((l) => l.id === activeLandmarkId) ?? LANDMARKS[0];

  const handleSelectLandmark = (id: string) => {
    setActiveLandmarkId(id);
    setPlaqueOpen(id !== 'overview');
  };

  const handleOpenRenderStudio = () => {
    // Automatically produce initial 1280x720 preview render per progressive museum render workflow
    const dataUrl = viewportRef.current?.captureRender(1280, 720) ?? '';
    if (dataUrl) {
      setRenderedPlate({
        dataUrl,
        width: 1280,
        height: 720,
        modeLabel: 'Önizleme Renderı',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    setRenderModalOpen(true);
  };

  const handleGeneratePreview = () => {
    const dataUrl = viewportRef.current?.captureRender(1280, 720) ?? '';
    if (!dataUrl) return;
    setRenderedPlate({
      dataUrl,
      width: 1280,
      height: 720,
      modeLabel: 'Önizleme Renderı',
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleGenerateFinal = () => {
    const dataUrl = viewportRef.current?.captureRender(2560, 1440) ?? '';
    if (!dataUrl) return;
    setRenderedPlate({
      dataUrl,
      width: 2560,
      height: 1440,
      modeLabel: 'Nihai Müze Renderı',
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleExportGlb = async () => {
    if (!viewportRef.current || isExportingGlb) return;
    try {
      setIsExportingGlb(true);
      const blob = await viewportRef.current.exportGlbScene();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hattusa_hitit_baskenti_diorama.glb';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingGlb(false);
    }
  };

  // Keyboard shortcut 'H' for Cinema / Museum Showcase Mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (renderModalOpen) setRenderModalOpen(false);
        else if (plaqueOpen) setPlaqueOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [renderModalOpen, plaqueOpen]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121110] text-[#ede8df] overflow-hidden">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#161412] border-b border-[#2c2620] shrink-0">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#genel"
          onClick={(e) => {
            e.preventDefault();
            handleSelectLandmark('overview');
          }}
          className="font-display text-base sm:text-lg font-semibold tracking-wide text-[#f5efe4] whitespace-nowrap shrink-0"
        >
          Hattuşa Dioraması
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav aria-label="Ana Bölgeler" className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#bdb2a0]">
          <a
            href="#genel-gorunum"
            onClick={(e) => {
              e.preventDefault();
              handleSelectLandmark('overview');
            }}
            className={`hover:text-[#f5efe4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeLandmarkId === 'overview' ? 'text-[#e8c389] underline' : ''
            }`}
          >
            Genel Görünüm
          </a>
          <a
            href="#buyuk-tapinak"
            onClick={(e) => {
              e.preventDefault();
              handleSelectLandmark('great-temple');
            }}
            className={`hover:text-[#f5efe4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeLandmarkId === 'great-temple' ? 'text-[#e8c389] underline' : ''
            }`}
          >
            Büyük Tapınak
          </a>
          <a
            href="#buyukkale"
            onClick={(e) => {
              e.preventDefault();
              handleSelectLandmark('buyukkale');
            }}
            className={`hover:text-[#f5efe4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeLandmarkId === 'buyukkale' ? 'text-[#e8c389] underline' : ''
            }`}
          >
            Büyükkale
          </a>
          <a
            href="#yerkapi"
            onClick={(e) => {
              e.preventDefault();
              handleSelectLandmark('yerkapi');
            }}
            className={`hover:text-[#f5efe4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeLandmarkId === 'yerkapi' ? 'text-[#e8c389] underline' : ''
            }`}
          >
            Yerkapı
          </a>
          <a
            href="#aslanli-kapi"
            onClick={(e) => {
              e.preventDefault();
              handleSelectLandmark('lions-gate');
            }}
            className={`hover:text-[#f5efe4] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeLandmarkId === 'lions-gate' ? 'text-[#e8c389] underline' : ''
            }`}
          >
            Aslanlı Kapı
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleOpenRenderStudio}
            className="px-4 py-2 text-xs font-semibold text-[#14110e] bg-[#c5934b] hover:bg-[#d4a359] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            2560×1440 Render ve Çıktı
          </button>
        </div>
      </header>

      {/* Main Unobstructed 3D Diorama Stage */}
      <main
        className="relative flex-1 min-h-0 w-full"
        data-active-landmark={activeLandmarkId}
        data-evidence-mode={evidenceMode}
      >
        <DioramaViewport
          ref={viewportRef}
          activeLandmarkId={activeLandmarkId}
          onSelectLandmark={handleSelectLandmark}
          evidenceMode={evidenceMode}
          lightingPresetId={lightingPresetId}
          sunAzimuthOffset={sunAzimuthOffset}
          showMarkers={showMarkers}
          showVegetation={showVegetation}
          showFigures={showFigures}
        />

        {/* Subtle Top-Left Curatorial Scale Caption (Unboxed Metadata Discipline) */}
        <div className="pointer-events-none absolute top-4 left-6 z-20 hidden sm:block">
          <div className="text-xs text-[#b5a895] flex items-center gap-2">
            <span>MÖ 13. Yüzyıl Rekonstrüksiyonu</span>
            <span aria-hidden="true">·</span>
            <span>Çorum – Boğazkale</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">Kuzey (Aşağı Şehir) ↑ · Güney (Yerkapı) ↓</span>
          </div>
        </div>

        {/* Dismissible Curatorial Plaque when inspecting a specific monument */}
        {plaqueOpen && activeLandmark.id !== 'overview' && (
          <LandmarkPlaque
            landmark={activeLandmark}
            evidenceMode={evidenceMode}
            onClose={() => setPlaqueOpen(false)}
            onResetOverview={() => handleSelectLandmark('overview')}
          />
        )}

        {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Occlusion) */}
        <section
          aria-label="Diorama Kontrol Paneli"
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(960px,95vw)] transition-transform duration-200 ease-out ${
            dockCollapsed ? 'translate-y-[calc(100%-2.1rem)]' : 'translate-y-0'
          }`}
        >
          {/* Collapse / Expand Handle */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              aria-expanded={!dockCollapsed}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg bg-[#191613] border border-b-0 border-[#342d25] text-xs font-medium text-[#cfc4b2] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>Kontrolleri Göster (H)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>Kontrolleri Gizle (H)</span>
                </>
              )}
            </button>
          </div>

          {/* Dock Surface (Solid museum surface — no backdrop-filter over WebGL) */}
          <div className="bg-[#181512] border border-[#342d25] rounded-xl shadow-2xl p-3.5 sm:p-4">
            {/* Top Mode Tabs + Quick Reset */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#29231d]">
              <div role="tablist" aria-label="Kontrol Sekmeleri" className="flex items-center gap-1 bg-[#12100d] p-1 rounded-lg border border-[#26201a]">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDockTab === 'landmarks'}
                  onClick={() => setActiveDockTab('landmarks')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDockTab === 'landmarks'
                      ? 'bg-[#2c251e] text-[#f5efe4] border border-[#453a2f]'
                      : 'text-[#a89d8c] hover:text-[#ede8df]'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>Tarihî Bölgeler ve Kapılar</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDockTab === 'collections'}
                  onClick={() => setActiveDockTab('collections')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDockTab === 'collections'
                      ? 'bg-[#2c251e] text-[#f5efe4] border border-[#453a2f]'
                      : 'text-[#a89d8c] hover:text-[#ede8df]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>Arkeolojik Katmanlar</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDockTab === 'lighting'}
                  onClick={() => setActiveDockTab('lighting')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDockTab === 'lighting'
                      ? 'bg-[#2c251e] text-[#f5efe4] border border-[#453a2f]'
                      : 'text-[#a89d8c] hover:text-[#ede8df]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>Güneş ve Stüdyo Işığı</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectLandmark('overview');
                    viewportRef.current?.resetOverview();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#231e19] hover:bg-[#2f2821] border border-[#383027] text-xs font-medium text-[#ddd4c5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#c79d5e]" />
                  <span>İzometrik Kadrajı Sıfırla</span>
                </button>
              </div>
            </div>

            {/* Tab Content 1: Landmarks & Monumental Gates */}
            {activeDockTab === 'landmarks' && (
              <div className="pt-3 flex flex-wrap items-center gap-1.5">
                {LANDMARKS.map((lm, idx) => {
                  const selected = activeLandmarkId === lm.id;
                  const dockShortNames: Record<string, string> = {
                    overview: 'Genel Maket',
                    'great-temple': 'Büyük Tapınak',
                    buyukkale: 'Büyükkale',
                    yerkapi: 'Yerkapı',
                    'lions-gate': 'Aslanlı Kapı',
                    'kings-gate': 'Kral Kapısı',
                    'nisantepe-sudburg': 'Nişantepe',
                    'upper-temples': 'Tapınaklar',
                    'potern-wall': 'Poternli Sur',
                  };
                  const shortTitle = dockShortNames[lm.id] ?? lm.title;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => handleSelectLandmark(lm.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#c5934b] text-[#14110e] border-[#e4be84] font-semibold'
                          : 'bg-[#211d18] text-[#d9d0c1] border-[#332c24] hover:border-[#6e5a41] hover:text-white'
                      }`}
                    >
                      <span className="font-mono-tabular opacity-75 mr-1">0{idx}</span>
                      <span>{shortTitle}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab Content 2: Archaeological Evidence Collections (`DOCUMENTED` vs `HYPOTHETICAL`) */}
            {activeDockTab === 'collections' && (
              <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5 bg-[#12100d] p-1 rounded-lg border border-[#26201a]">
                  <button
                    type="button"
                    onClick={() => setEvidenceMode('realistic')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      evidenceMode === 'realistic'
                        ? 'bg-[#c5934b] text-[#14110e] font-semibold'
                        : 'text-[#bdb2a0] hover:text-white'
                    }`}
                  >
                    Müze Maketi (Doğal Doku)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceMode('documented-only')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      evidenceMode === 'documented-only'
                        ? 'bg-[#c5934b] text-[#14110e] font-semibold'
                        : 'text-[#bdb2a0] hover:text-white'
                    }`}
                  >
                    Yalnızca Belgelenen (DOCUMENTED)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceMode('evidence-split')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      evidenceMode === 'evidence-split'
                        ? 'bg-[#c5934b] text-[#14110e] font-semibold'
                        : 'text-[#bdb2a0] hover:text-white'
                    }`}
                  >
                    Belge / Varsayım Ayrımı
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#cfc4b2]">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={(e) => setShowMarkers(e.target.checked)}
                      className="accent-[#c5934b] w-3.5 h-3.5 rounded"
                    />
                    <span>Yapı Etiketleri</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showVegetation}
                      onChange={(e) => setShowVegetation(e.target.checked)}
                      className="accent-[#c5934b] w-3.5 h-3.5 rounded"
                    />
                    <span>Bozkır Bitkileri</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showFigures}
                      onChange={(e) => setShowFigures(e.target.checked)}
                      className="accent-[#c5934b] w-3.5 h-3.5 rounded"
                    />
                    <span>İnsan Figürleri</span>
                  </label>
                </div>

                {evidenceMode === 'evidence-split' && (
                  <div className="w-full pt-2 border-t border-[#26201a] flex flex-wrap items-center gap-4 text-xs text-[#c7bca9]">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-[#ded8cd] border border-white/20 inline-block" />
                      <span>DOCUMENTED: Kazıyla belgelenen taş temel, ortostat, potern ve glacis</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-[#c97344] border border-white/20 inline-block" />
                      <span>HYPOTHETICAL: Bilimsel varsayıma dayalı kerpiç üst yapı ve ahşap hatıllar</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content 3: Afternoon Sunlight & Museum Studio Controls */}
            {activeDockTab === 'lighting' && (
              <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {LIGHTING_PRESETS.map((lp) => {
                    const active = lightingPresetId === lp.id;
                    return (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() => {
                          setLightingPresetId(lp.id);
                          setSunAzimuthOffset(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#c5934b] text-[#14110e] border-[#e4be84] font-semibold'
                            : 'bg-[#211d18] text-[#d9d0c1] border-[#332c24] hover:border-[#6e5a41]'
                        }`}
                      >
                        {lp.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor="sun-azimuth-slider" className="text-xs text-[#cfc4b2] whitespace-nowrap">
                    Güneş Yönü
                  </label>
                  <input
                    id="sun-azimuth-slider"
                    type="range"
                    min={-90}
                    max={90}
                    step={2}
                    value={sunAzimuthOffset}
                    onChange={(e) => setSunAzimuthOffset(Number(e.target.value))}
                    className="w-32 sm:w-40 accent-[#c5934b] cursor-pointer"
                  />
                  <span className="text-xs font-mono-tabular text-[#bdb2a0] w-11 text-right">
                    {sunAzimuthOffset > 0 ? `+${sunAzimuthOffset}°` : `${sunAzimuthOffset}°`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Progressive 1280x720 Preview & 2560x1440 Final Render + Blender Export Studio */}
      <RenderExportModal
        isOpen={renderModalOpen}
        onClose={() => setRenderModalOpen(false)}
        plate={renderedPlate}
        onGeneratePreview={handleGeneratePreview}
        onGenerateFinal={handleGenerateFinal}
        onExportGlb={handleExportGlb}
        isExportingGlb={isExportingGlb}
      />
    </div>
  );
}
