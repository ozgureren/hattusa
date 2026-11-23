import { X, Compass, Layers } from 'lucide-react';
import type { EvidenceMode, LandmarkInfo } from '../diorama/hattusaData';

interface LandmarkPlaqueProps {
  landmark: LandmarkInfo;
  evidenceMode: EvidenceMode;
  onClose: () => void;
  onResetOverview: () => void;
}

export function LandmarkPlaque({
  landmark,
  evidenceMode,
  onClose,
  onResetOverview,
}: LandmarkPlaqueProps) {
  if (landmark.id === 'overview') return null;

  return (
    <aside
      aria-label="Arkeolojik Yapı Envanter Kartı"
      className="fixed top-20 right-5 z-30 w-[min(390px,calc(100vw-2.5rem))] bg-[#191614] border border-[#342d25] rounded-lg p-5 shadow-2xl text-[#ede8df]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#b5a895] font-mono-tabular">
            <span>{landmark.code}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{landmark.zone}</span>
          </div>
          <h2 className="font-display text-lg font-semibold text-[#f5efe4] mt-1 leading-snug">
            {landmark.title}
          </h2>
          <p className="text-xs text-[#c79d5e] mt-0.5">{landmark.hittiteName}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Bilgi kartını kapat"
          className="p-1.5 rounded text-[#a89d8c] hover:text-[#f5efe4] hover:bg-[#28231e] transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-[#2b251f] text-xs text-[#b5a895] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{landmark.period}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">{landmark.elevationMeters}</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#ddd5c7]">{landmark.summary}</p>

      <dl className="mt-4 pt-3 border-t border-[#2b251f] space-y-3 text-xs">
        <div>
          <dt className="font-semibold text-[#e6dfd3] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#c79d5e]" />
            <span>Arkeolojik Kanıt (DOCUMENTED Koleksiyonu)</span>
          </dt>
          <dd className="mt-1 text-[#b8ae9e] leading-relaxed">{landmark.documentedEvidence}</dd>
        </div>

        <div className={evidenceMode === 'documented-only' ? 'opacity-55' : ''}>
          <dt className="font-semibold text-[#e6dfd3]">
            Bilimsel Tamamlama (HYPOTHETICAL Koleksiyonu)
          </dt>
          <dd className="mt-1 text-[#b8ae9e] leading-relaxed">
            {landmark.hypotheticalReconstruction}
          </dd>
        </div>
      </dl>

      <div className="mt-4 pt-3 border-t border-[#2b251f] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onResetOverview}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#26211c] hover:bg-[#322b24] border border-[#3d342b] text-xs font-medium text-[#ede8df] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-[#c79d5e]" />
          <span>Tüm Hattuşa Görünümü</span>
        </button>
        <span className="text-[11px] text-[#918676] font-mono-tabular">UNESCO #377</span>
      </div>
    </aside>
  );
}
