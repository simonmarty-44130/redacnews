'use client';

/**
 * UI d'enregistrement micro (pilotée par le hook useRecording).
 * Présentationnel : l'état vit dans le hook passé en prop, la sauvegarde
 * est gérée par le parent (MediaAudioEditor).
 *
 * VU-mètre crête temps réel + repères posables en direct (bouton ou touche M).
 * Port du composant Tanguy, re-stylé en thème slate sombre (shadcn/Tailwind).
 */
import { useEffect } from 'react';
import { Mic, Square, Flag, RotateCcw } from 'lucide-react';
import type { UseRecordingResult } from '@/lib/audio-editor/recording/useRecording';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** VU-mètre crête : vert < -3 dBFS, ambre, rouge ≥ -1 dBFS (repère anti-sat). */
function VuMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 100));
  const color =
    level >= 0.89 ? 'bg-red-500' : level >= 0.7 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="w-72 max-w-[80vw]">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div className={`h-full ${color} transition-[width] duration-75`} style={{ width: `${pct}%` }} />
        {/* Repère -1 dBFS (plafond anti-saturation). */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500/60"
          style={{ left: '89%' }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>niveau d&apos;entrée</span>
        <span>−1 dBFS</span>
      </div>
    </div>
  );
}

export function AudioRecorder({
  recording,
  onReset,
}: {
  recording: UseRecordingResult;
  onReset?: () => void;
}) {
  const { isSupported, status, elapsedMs, error, level, markers, start, stop, reset, addMarker } =
    recording;

  const handleReset = () => {
    reset();
    onReset?.();
  };

  // Touche M : pose un repère pendant l'enregistrement (hors champ de saisie).
  useEffect(() => {
    if (status !== 'recording') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm') return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      addMarker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, addMarker]);

  if (!isSupported) {
    return (
      <div className="max-w-md rounded-md bg-amber-500/15 p-4 text-[13px] text-amber-300">
        Votre navigateur ne permet pas l&apos;enregistrement micro. Utilisez Chrome, Edge ou
        Firefox récent (ou Safari 14.1+).
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Indicateur d'état + chrono */}
      <div className="flex h-8 items-center gap-3">
        {status === 'recording' && (
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-500" aria-hidden />
        )}
        <span
          className={`tabular-nums text-[22px] font-semibold ${
            status === 'recording' ? 'text-red-400' : 'text-slate-300'
          }`}
        >
          {formatTime(elapsedMs)}
        </span>
      </div>

      {/* Contrôles selon l'état */}
      {(status === 'idle' || status === 'error') && (
        <button
          onClick={start}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Mic className="h-4 w-4" /> Démarrer l&apos;enregistrement
        </button>
      )}

      {status === 'requesting' && (
        <span className="text-[13px] text-slate-400">Autorisation du micro…</span>
      )}

      {status === 'recording' && (
        <div className="flex w-full flex-col items-center gap-3">
          <VuMeter level={level} />
          <div className="flex items-center gap-2">
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              <Square className="h-4 w-4 fill-current" /> Arrêter
            </button>
            <button
              onClick={addMarker}
              className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              <Flag className="h-4 w-4" /> Repère
              <span className="opacity-50">(M)</span>
              {markers.length > 0 && <span className="ml-1">· {markers.length}</span>}
            </button>
          </div>
        </div>
      )}

      {status === 'decoding' && (
        <span className="text-[13px] text-slate-400">Préparation de l&apos;enregistrement…</span>
      )}

      {status === 'recorded' && (
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <RotateCcw className="h-4 w-4" /> Recommencer
        </button>
      )}

      {error && (
        <div className="w-full max-w-md rounded-md bg-red-500/15 p-3 text-[12.5px] text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
