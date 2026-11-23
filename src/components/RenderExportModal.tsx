import { Download, Camera, FileCode2, Box, X } from 'lucide-react';
import { generateBlenderPythonScript } from '../diorama/hattusaData';

export interface RenderedPlate {
  dataUrl: string;
  width: number;
  height: number;
  modeLabel: string;
  timestamp: string;
}

interface RenderExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plate: RenderedPlate | null;
  onGeneratePreview: () => void;
  onGenerateFinal: () => void;
  onExportGlb: () => void;
  isExportingGlb: boolean;
}

export function RenderExportModal({
  isOpen,
  onClose,
  plate,
  onGeneratePreview,
  onGenerateFinal,
  onExportGlb,
  isExportingGlb,
}: RenderExportModalProps) {
  if (!isOpen) return null;

  const handleDownloadPng = () => {
    if (!plate?.dataUrl) return;
    const link = document.createElement('a');
    link.href = plate.dataUrl;
    link.download = `hattusa_diorama_${plate.width}x${plate.height}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBlenderScript = () => {
    const scriptContent = generateBlenderPythonScript();
    const blob = new Blob([scriptContent], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hattusa_diorama_blender_scene.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-studio-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
    >
      <div className="w-full max-w-4xl bg-[#181512] border border-[#362f27] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#2b251f]">
          <div>
            <h2 id="render-studio-title" className="font-display text-lg font-semibold text-[#f5efe4]">
              Müze Render Stüdyosu ve 3D Sahne Çıktısı
            </h2>
            <p className="text-xs text-[#aba08f] mt-0.5">
              16:9 Ortografik İzometrik Stüdyo Renderı (1280×720 Önizleme · 2560×1440 Nihai PNG) ve Blender Koleksiyon Aktarımı
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Render stüdyosunu kapat"
            className="p-2 rounded-lg text-[#a89d8c] hover:text-white hover:bg-[#26211c] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Two-step Render Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13110e] border border-[#29231d] rounded-lg p-4">
            <div className="text-xs text-[#c7bca9] space-y-0.5">
              <div className="font-medium text-[#ede6da]">Aşamalı Müze Render İş Akışı</div>
              <div>
                Önce düşük çözünürlüklü 1280×720 önizlemeyi kontrol edin; kadraj ve ışık uygunsa 2560×1440 nihai çıktıyı üretin.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onGeneratePreview}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#27221c] hover:bg-[#332c25] border border-[#3e362c] text-xs font-medium text-[#ede8df] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#c79d5e]" />
                <span>1. Önizleme Render (1280×720)</span>
              </button>
              <button
                type="button"
                onClick={onGenerateFinal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c5934b] hover:bg-[#d4a359] text-xs font-semibold text-[#14110e] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>2. Nihai Render Üret (2560×1440)</span>
              </button>
            </div>
          </div>

          {/* 16:9 Rendered Output Frame */}
          <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-[#332c24] bg-[#0e0d0c] flex items-center justify-center">
            {plate ? (
              <img
                src={plate.dataUrl}
                alt={`Hattuşa 3D Arazi Dioraması ${plate.width}x${plate.height} Render`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center px-6 py-12 text-sm text-[#9c9180]">
                Render görüntüsü oluşturmak için yukarıdaki önizleme veya nihai render düğmesini seçin.
              </div>
            )}
          </div>

          {/* Metadata & Download Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#2b251f]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#b5a895] font-mono-tabular">
              {plate ? (
                <>
                  <span className="text-[#f2eadc] font-medium">{plate.modeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {plate.width} × {plate.height} px (16:9)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Orthographic Kamera</span>
                  <span aria-hidden="true">·</span>
                  <span>{plate.timestamp}</span>
                </>
              ) : (
                <span>Hedef Çıktı: 2560 × 1440 px · 16:9 PNG + Blender GLB / Python</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {plate && (
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#c5934b] hover:bg-[#d4a359] text-xs font-semibold text-[#14110e] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG İndir ({plate.width}×{plate.height})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onExportGlb}
                disabled={isExportingGlb}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#25201b] hover:bg-[#312a23] border border-[#3d342b] text-xs font-medium text-[#ede8df] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Box className="w-3.5 h-3.5 text-[#c79d5e]" />
                <span>{isExportingGlb ? 'GLB Hazırlanıyor...' : '3D Sahne İndir (.glb / Blender)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBlenderScript}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#25201b] hover:bg-[#312a23] border border-[#3d342b] text-xs font-medium text-[#ede8df] transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5 text-[#c79d5e]" />
                <span>Blender Python Betiği (.py)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
