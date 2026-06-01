'use client';

/**
 * Conteneurs de forme d'onde (peaks.js) + élément <audio> de lecture.
 * Présentationnel : peaks est initialisé par le parent (workspace) via usePeaks ;
 * ici on n'expose que les conteneurs via des callback refs.
 *
 * Port du composant Tanguy, re-stylé en thème slate sombre.
 */

interface WaveformProps {
  zoomRef: (el: HTMLDivElement | null) => void;
  overviewRef: (el: HTMLDivElement | null) => void;
  mediaRef: (el: HTMLAudioElement | null) => void;
  blobUrl: string | null;
  error: string | null;
}

/**
 * Échelle de niveau (dBFS) superposée à la waveform.
 * peaks affiche l'amplitude réelle (amplitudeScale=1) : bord haut/bas = 0 dBFS,
 * centre = silence. topPct = position verticale de la ligne pour chaque niveau.
 */
const SCALE_LINES: Array<{ label: string; topPct: number; ceiling?: boolean; center?: boolean }> = [
  { label: '0 dB', topPct: 1.5, ceiling: true },
  { label: '−6', topPct: 24.9 },
  { label: '−12', topPct: 37.4 },
  { label: '−18', topPct: 43.7 },
  { label: '', topPct: 50, center: true },
  { label: '−18', topPct: 56.3 },
  { label: '−12', topPct: 62.6 },
  { label: '−6', topPct: 75.1 },
  { label: '0 dB', topPct: 98.5, ceiling: true },
];

function WaveformScale() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {SCALE_LINES.map((s, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 flex items-center gap-1"
          style={{ top: `${s.topPct}%`, transform: 'translateY(-50%)' }}
        >
          {s.label && (
            <span
              className={`rounded-sm bg-slate-900/85 px-1 py-px text-[9px] leading-none tabular-nums ${
                s.ceiling ? 'text-red-400' : 'text-slate-500'
              }`}
            >
              {s.label}
            </span>
          )}
          <div
            className={`h-px flex-1 ${s.ceiling ? 'bg-red-500/35' : s.center ? 'bg-slate-500/40' : 'bg-slate-500/20'}`}
          />
        </div>
      ))}
    </div>
  );
}

export function Waveform({ zoomRef, overviewRef, mediaRef, blobUrl, error }: WaveformProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative min-h-[180px] w-full flex-1 overflow-hidden rounded-md border border-slate-700 bg-slate-800">
        <div ref={zoomRef} className="h-full w-full" />
        <WaveformScale />
      </div>

      <div className="w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800" style={{ height: 48 }}>
        <div ref={overviewRef} className="h-full w-full" />
      </div>

      {/* Élément de lecture piloté par peaks (caché, transport custom). */}
      <audio ref={mediaRef} src={blobUrl ?? undefined} preload="auto" className="hidden" />

      {error && (
        <div className="rounded-md bg-amber-500/15 p-2 text-[12px] text-amber-300">{error}</div>
      )}
    </div>
  );
}
