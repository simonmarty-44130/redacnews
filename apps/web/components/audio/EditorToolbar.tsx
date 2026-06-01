'use client';

/**
 * Barre d'outils d'édition : zoom, IN/OUT, couper, optimiser, normaliser, fondus,
 * gain, limiteur, undo/redo, export. Doublon souris des raccourcis clavier.
 *
 * Port du composant Tanguy, re-stylé en thème slate sombre.
 */
import { useMemo, useState } from 'react';
import type { PeaksInstance } from 'peaks.js';
import { useAudioEditorStore } from '@/lib/audio-editor/store';
import {
  applySelectionSegment,
  clearSelectionSegment,
} from '@/lib/audio-editor/peaks/useSelectionSync';
import { peakDb, rmsDb } from '@/lib/audio-editor/audio/gain';
import type { AudioEditingApi } from '@/lib/audio-editor/editing/useAudioEditing';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-700" />;

type Variant = 'secondary' | 'accent' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  secondary: 'border border-slate-600 text-slate-200 hover:bg-slate-700',
  accent: 'bg-blue-600 text-white hover:bg-blue-500',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-slate-300 hover:bg-slate-700',
};

function Btn({
  variant = 'secondary',
  disabled,
  onClick,
  children,
  title,
}: {
  variant?: Variant;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-40 ${VARIANT[variant]}`}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({
  peaks,
  editing,
  exportBaseName,
}: {
  peaks: PeaksInstance | null;
  editing: AudioEditingApi;
  exportBaseName: string;
}) {
  const selectionIn = useAudioEditorStore((s) => s.selectionIn);
  const selectionOut = useAudioEditorStore((s) => s.selectionOut);
  const audioBuffer = useAudioEditorStore((s) => s.audioBuffer);
  const hasBuffer = audioBuffer !== null;
  const optimized = useAudioEditorStore((s) => s.optimized);
  const canUndo = useAudioEditorStore((s) => s.past.length > 0);
  const canRedo = useAudioEditorStore((s) => s.future.length > 0);

  // Niveaux courants (recalculés seulement quand le buffer change).
  const { crestLabel, rmsLabel } = useMemo(() => {
    if (!audioBuffer) return { crestLabel: '−∞', rmsLabel: '−∞' };
    const c = peakDb(audioBuffer);
    const r = rmsDb(audioBuffer);
    return {
      crestLabel: Number.isFinite(c) ? `${c.toFixed(1)}` : '−∞',
      rmsLabel: Number.isFinite(r) ? `${r.toFixed(1)}` : '−∞',
    };
  }, [audioBuffer]);

  const [exporting, setExporting] = useState<'mp3' | 'wav' | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [limiting, setLimiting] = useState(false);

  const doOptimize = async () => {
    setOptimizing(true);
    try {
      await editing.optimize();
    } finally {
      setOptimizing(false);
    }
  };

  const doLimit = async () => {
    setLimiting(true);
    try {
      await editing.limiter();
    } finally {
      setLimiting(false);
    }
  };

  const hasSelection =
    selectionIn != null && selectionOut != null && Math.abs(selectionOut - selectionIn) > 0.005;

  const setIn = () => {
    if (!peaks) return;
    const t = peaks.player.getCurrentTime();
    const store = useAudioEditorStore.getState();
    const outT = store.selectionOut ?? store.durationSeconds;
    store.setSelection(t, outT);
    applySelectionSegment(peaks, t, outT);
  };

  const setOut = () => {
    if (!peaks) return;
    const t = peaks.player.getCurrentTime();
    const store = useAudioEditorStore.getState();
    const inT = store.selectionIn ?? 0;
    store.setSelection(inT, t);
    applySelectionSegment(peaks, inT, t);
  };

  const clearSelection = () => {
    if (peaks) clearSelectionSegment(peaks);
    useAudioEditorStore.getState().clearSelection();
  };

  const doExport = async (format: 'mp3' | 'wav') => {
    setExporting(format);
    try {
      await editing.exportTrack(format, exportBaseName);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Zoom */}
      <div className="flex items-center gap-1">
        <Btn onClick={() => peaks?.zoom.zoomOut()} disabled={!peaks} title="Dézoomer">
          🔍−
        </Btn>
        <Btn onClick={() => peaks?.zoom.zoomIn()} disabled={!peaks} title="Zoomer">
          🔍+
        </Btn>
      </div>

      <Divider />

      {/* Sélection */}
      <Btn onClick={setIn} disabled={!peaks}>
        IN <span className="ml-1 opacity-50">(I)</span>
      </Btn>
      <Btn onClick={setOut} disabled={!peaks}>
        OUT <span className="ml-1 opacity-50">(O)</span>
      </Btn>
      <span className="min-w-[92px] tabular-nums text-[12px] text-slate-400">
        {hasSelection
          ? `${formatTime(Math.min(selectionIn!, selectionOut!))} → ${formatTime(Math.max(selectionIn!, selectionOut!))}`
          : 'pas de sélection'}
      </span>
      {hasSelection && (
        <Btn variant="ghost" onClick={clearSelection}>
          ✕
        </Btn>
      )}

      <Divider />

      {/* Édition */}
      <Btn variant="danger" onClick={editing.cut} disabled={!hasSelection}>
        ✂ Couper <span className="ml-1 opacity-50">(X)</span>
      </Btn>
      <Btn variant="accent" onClick={doOptimize} disabled={!hasBuffer || optimizing || optimized}>
        {optimizing ? 'Optimisation…' : optimized ? '✓ Optimisé' : '✨ Optimiser'}
      </Btn>
      <Btn onClick={editing.normalize} disabled={!hasBuffer || optimizing}>
        Normaliser
      </Btn>
      <Btn onClick={editing.fadeIn} disabled={!hasBuffer}>
        Fondu ↗
      </Btn>
      <Btn onClick={editing.fadeOut} disabled={!hasBuffer}>
        Fondu ↘
      </Btn>

      <Divider />

      {/* Gain / niveau */}
      <Btn onClick={() => editing.gain(-1)} disabled={!hasBuffer}>
        −1 dB
      </Btn>
      <Btn onClick={() => editing.gain(1)} disabled={!hasBuffer}>
        +1 dB
      </Btn>
      <Btn onClick={doLimit} disabled={!hasBuffer || limiting}>
        {limiting ? 'Limiteur…' : 'Limiteur'}
      </Btn>
      <span
        className="whitespace-nowrap tabular-nums text-[12px] text-slate-400"
        title="Niveau RMS (loudness perçue) · crête (pic le plus fort), en dBFS"
      >
        niveau {rmsLabel} · crête {crestLabel} dB
      </span>

      <Divider />

      {/* Historique */}
      <Btn variant="ghost" onClick={editing.undo} disabled={!canUndo}>
        ↶ Annuler
      </Btn>
      <Btn variant="ghost" onClick={editing.redo} disabled={!canRedo}>
        ↷ Rétablir
      </Btn>

      <Divider />

      {/* Export (téléchargement local) */}
      <Btn variant="ghost" onClick={() => doExport('mp3')} disabled={!hasBuffer || exporting !== null}>
        {exporting === 'mp3' ? 'Export…' : '⬇ MP3'}
      </Btn>
      <Btn variant="ghost" onClick={() => doExport('wav')} disabled={!hasBuffer || exporting !== null}>
        {exporting === 'wav' ? 'Export…' : '⬇ WAV'}
      </Btn>
    </div>
  );
}
