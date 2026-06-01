'use client';

/**
 * Espace de montage : toolbar + waveform (peaks.js) + transport.
 *
 * Lit la piste courante depuis le store (mise à jour à chaque édition → peaks se
 * ré-initialise sur le nouveau buffer). Câble la sélection souris, les raccourcis
 * clavier et les opérations d'édition destructive.
 */
import { useState } from 'react';
import { usePeaks } from '@/lib/audio-editor/peaks/usePeaks';
import { useSelectionSync } from '@/lib/audio-editor/peaks/useSelectionSync';
import { useMarkersSync } from '@/lib/audio-editor/peaks/useMarkersSync';
import { useAudioEditing } from '@/lib/audio-editor/editing/useAudioEditing';
import { useEditorShortcuts } from '@/lib/audio-editor/keyboard/useEditorShortcuts';
import { useAudioEditorStore } from '@/lib/audio-editor/store';
import { Waveform } from './Waveform';
import { EditorToolbar } from './EditorToolbar';
import { TransportBar } from './TransportBar';

export function AudioEditorWorkspace({ exportBaseName }: { exportBaseName: string }) {
  const audioBuffer = useAudioEditorStore((s) => s.audioBuffer);
  const blobUrl = useAudioEditorStore((s) => s.blobUrl);

  const [zoomEl, setZoomEl] = useState<HTMLDivElement | null>(null);
  const [overviewEl, setOverviewEl] = useState<HTMLDivElement | null>(null);
  const [mediaEl, setMediaEl] = useState<HTMLAudioElement | null>(null);

  const { peaks, ready, error } = usePeaks({
    audioBuffer,
    mediaElement: mediaEl,
    zoomContainer: zoomEl,
    overviewContainer: overviewEl,
  });

  const activePeaks = ready ? peaks : null;
  const editing = useAudioEditing();
  useSelectionSync(activePeaks);
  useMarkersSync(activePeaks);
  useEditorShortcuts(activePeaks, editing);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <EditorToolbar peaks={activePeaks} editing={editing} exportBaseName={exportBaseName} />
      <Waveform
        zoomRef={setZoomEl}
        overviewRef={setOverviewEl}
        mediaRef={setMediaEl}
        blobUrl={blobUrl}
        error={error}
      />
      <TransportBar peaks={activePeaks} />
      <p className="text-[11.5px] text-slate-500">
        Sélection : glisse sur la forme d&apos;onde, ou touches <strong>I</strong>/<strong>O</strong>.
        Couper : <strong>X</strong>. Annuler : <strong>⌘/Ctrl+Z</strong>. Molette = défilement.
      </p>
    </div>
  );
}
