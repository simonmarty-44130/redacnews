'use client';

/**
 * Éditeur audio plein écran (médiathèque) — port de l'éditeur Tanguy.
 *
 * MVP 1 : enregistrement micro → encodage MP3 320 (Web Worker) → sauvegarde
 * dans la médiathèque via tRPC (nouveau MediaItem ou remplacement de l'original).
 * MVP 2+ : waveform (peaks.js), sélection, cut/undo, traitements (à venir).
 *
 * Chargé en dynamic(ssr:false) par les points d'entrée médiathèque.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useRecording } from '@/lib/audio-editor/recording/useRecording';
import { useAudioEditorStore } from '@/lib/audio-editor/store';
import { audioBufferToMp3, fetchAndDecodeAudio } from '@/lib/audio-editor';
import { AudioRecorder } from './AudioRecorder';
import { AudioEditorWorkspace } from './AudioEditorWorkspace';

/** Slug ASCII pour le nom de fichier d'export. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function todayLabel(): string {
  return new Date()
    .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');
}

export interface MediaAudioEditorProps {
  /** Si fourni : édition d'un média existant (permet « remplacer l'original »). */
  mediaId?: string;
  mediaTitle?: string | null;
  /** URL présignée du son existant (re-montage) — exploité au MVP 5. */
  existingAudioUrl?: string | null;
  /** Repères de montage persistés (restaurés au chargement) — MVP 5. */
  existingMarkers?: number[];
  onClose: () => void;
  onSaved: (mediaId: string) => void;
}

export function MediaAudioEditor({
  mediaId,
  mediaTitle,
  existingAudioUrl,
  existingMarkers,
  onClose,
  onSaved,
}: MediaAudioEditorProps) {
  const recording = useRecording();
  const [title, setTitle] = useState('');
  const [savingMode, setSavingMode] = useState<'new' | 'replace' | null>(null);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTrack = useAudioEditorStore((s) => s.loadTrack);
  const resetStore = useAudioEditorStore((s) => s.reset);
  const hasTrack = useAudioEditorStore((s) => s.audioBuffer !== null);

  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const saveEdited = trpc.media.saveMontage.useMutation();

  // Titre par défaut.
  useEffect(() => {
    setTitle(mediaTitle ? `${mediaTitle} (monté)` : `Enregistrement ${todayLabel()}`);
  }, [mediaTitle]);

  // URL blob de l'enregistrement (lecture future via peaks ; placeholder MVP1).
  const blobUrl = useMemo(
    () =>
      recording.status === 'recorded' && recording.blob
        ? URL.createObjectURL(recording.blob)
        : null,
    [recording.status, recording.blob]
  );
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Charge la piste enregistrée dans le store (avec ses repères).
  useEffect(() => {
    if (blobUrl && recording.audioBuffer) {
      loadTrack(recording.audioBuffer, blobUrl, recording.markers);
    }
  }, [blobUrl, recording.audioBuffer, recording.markers, loadTrack]);

  // Charge le son EXISTANT (re-montage) : fetch + décodage → store.
  // Le bucket S3 autorise déjà le GET CORS depuis l'origine (presigned URL).
  useEffect(() => {
    if (!existingAudioUrl) return;
    let cancelled = false;
    setLoadingExisting(true);
    setLoadError(null);
    fetchAndDecodeAudio(existingAudioUrl)
      .then((buffer) => {
        if (!cancelled) loadTrack(buffer, existingAudioUrl, existingMarkers ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? `Chargement du son impossible : ${err.message}`
              : 'Chargement du son impossible.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
    // existingMarkers lu à la résolution ; on ne réagit qu'au changement d'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAudioUrl]);

  // Nettoie le store au démontage.
  useEffect(() => () => resetStore(), [resetStore]);

  const saving = savingMode !== null;
  const canSave = hasTrack && !saving && title.trim().length > 0;

  const handleSave = useCallback(
    async (mode: 'new' | 'replace') => {
      // IMPORTANT : on encode le buffer du store (montage), pas l'enregistrement brut.
      const state = useAudioEditorStore.getState();
      const buffer = state.audioBuffer ?? recording.audioBuffer;
      if (!buffer) return;
      setSavingMode(mode);
      setSaveError(null);
      setEncodeProgress(0);
      try {
        const mp3 = await audioBufferToMp3(buffer, 320, (r) =>
          setEncodeProgress(Math.round(r * 100))
        );
        const blob = new Blob([mp3], { type: 'audio/mpeg' });
        const filename = `${slugify(title) || 'montage'}-${Date.now()}.mp3`;

        const { uploadUrl, key, publicUrl } = await getUploadUrl.mutateAsync({
          filename,
          contentType: 'audio/mpeg',
        });

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'audio/mpeg' },
        });
        if (!putRes.ok) {
          throw new Error(`Échec de l'envoi du fichier (${putRes.status}).`);
        }

        const saved = await saveEdited.mutateAsync({
          mode,
          mediaId: mode === 'replace' ? mediaId : undefined,
          title: title.trim(),
          s3Key: key,
          s3Url: publicUrl,
          fileSize: blob.size,
          duration: buffer.duration,
          mimeType: 'audio/mpeg',
          markers: state.markers,
        });

        onSaved(saved.id);
        onClose();
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'audio."
        );
        setSavingMode(null);
      }
    },
    [title, mediaId, recording.audioBuffer, getUploadUrl, saveEdited, onSaved, onClose]
  );

  const closingBlocked = saving || recording.status === 'recording';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100">
      {/* En-tête */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-6 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">
            {mediaId ? 'Éditer le son' : 'Enregistrer un son'}
          </h2>
          {mediaTitle && (
            <p className="mt-0.5 max-w-[60vw] truncate text-[12px] text-slate-400">{mediaTitle}</p>
          )}
        </div>
        <button
          onClick={onClose}
          disabled={closingBlocked}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-40"
        >
          <X className="h-4 w-4" /> Fermer
        </button>
      </div>

      {/* Corps */}
      <div
        className={`flex flex-1 flex-col gap-5 overflow-auto px-6 py-6 ${
          hasTrack ? '' : 'items-center justify-center'
        }`}
      >
        {/* Une fois une piste chargée, l'enregistreur se réduit (ré-enregistrer reste possible). */}
        {recording.status === 'idle' && hasTrack ? (
          <button
            onClick={() => recording.start()}
            className="self-center rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
          >
            🎙️ Ré-enregistrer (remplace le montage en cours)
          </button>
        ) : (
          <AudioRecorder recording={recording} onReset={resetStore} />
        )}

        {hasTrack && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4">
            <AudioEditorWorkspace exportBaseName={slugify(title) || 'montage'} />
            <label className="block max-w-md text-[12px] text-slate-400">
              Titre du son
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
                placeholder="Titre du son"
              />
            </label>
          </div>
        )}

        {loadingExisting && (
          <p className="text-[13px] text-slate-400">Chargement du son…</p>
        )}
        {loadError && (
          <div className="max-w-md rounded-md bg-red-500/15 p-3 text-[12.5px] text-red-300">
            {loadError}
          </div>
        )}
        {saveError && (
          <div className="max-w-md rounded-md bg-red-500/15 p-3 text-[12.5px] text-red-300">
            {saveError}
          </div>
        )}
      </div>

      {/* Pied : actions de sauvegarde */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-700 px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onClose}
            disabled={closingBlocked}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-40"
          >
            Annuler
          </button>
          {saving && (
            <span className="inline-flex items-center gap-2 tabular-nums text-[12px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Encodage MP3 320k… {encodeProgress}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* « Remplacer » seulement si on édite un média existant. */}
          {mediaId && (
            <button
              onClick={() => handleSave('replace')}
              disabled={!canSave}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              {savingMode === 'replace' ? 'Remplacement…' : "Remplacer l'original"}
            </button>
          )}
          <button
            onClick={() => handleSave('new')}
            disabled={!canSave}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {savingMode === 'new'
              ? 'Enregistrement…'
              : mediaId
                ? 'Enregistrer comme nouveau'
                : 'Enregistrer dans la médiathèque'}
          </button>
        </div>
      </div>
    </div>
  );
}
