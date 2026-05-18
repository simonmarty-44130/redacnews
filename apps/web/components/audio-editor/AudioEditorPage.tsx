'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MultitrackEditor,
  type Track,
  type ExportMetadata,
  type MultitrackEditorRef,
  useRecording,
} from '@redacnews/audio-editor';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Keyboard, Loader2, Mic, Square, Wand2 } from 'lucide-react';
import { MediaPickerDialog } from './MediaPickerDialog';
import { ExportSuccessDialog } from './ExportSuccessDialog';
import { AudioEditorSkeleton } from './AudioEditorSkeleton';

interface SourceContext {
  type: 'media' | 'story' | 'new';
  ids?: string[];
  storyId?: string;
}

// ─── VU-mètre ────────────────────────────────────────────────────────────────

function VuMeter({ level, duration }: { level: number; duration: number }) {
  // level : 0-1 (RMS normalisé)
  // Zones : vert < 0.6 | orange 0.6-0.85 | rouge > 0.85
  const bars = 20;
  const greenLimit  = Math.floor(bars * 0.60);  // 12 barres
  const orangeLimit = Math.floor(bars * 0.85);  // 17 barres
  const filled = Math.round(level * bars);

  const mm = Math.floor(duration / 60).toString().padStart(2, '0');
  const ss = Math.floor(duration % 60).toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-lg border border-slate-700 min-w-[220px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 text-xs font-semibold tracking-widest uppercase">Enregistrement</span>
      </div>

      {/* Barres VU */}
      <div className="flex gap-[2px] items-end h-8">
        {Array.from({ length: bars }).map((_, i) => {
          const active = i < filled;
          let color = 'bg-slate-700';
          if (active) {
            if (i < greenLimit)       color = 'bg-emerald-500';
            else if (i < orangeLimit) color = 'bg-amber-400';
            else                      color = 'bg-red-500';
          }
          return (
            <div
              key={i}
              className={`w-2.5 rounded-sm transition-all duration-75 ${color}`}
              style={{ height: `${60 + (i / bars) * 40}%` }}
            />
          );
        })}
      </div>

      {/* Labels zones */}
      <div className="flex w-full justify-between text-[10px] px-0.5">
        <span className="text-emerald-500">-∞</span>
        <span className="text-emerald-500">-18</span>
        <span className="text-amber-400">-6</span>
        <span className="text-red-500">0 dB</span>
      </div>

      {/* Chrono */}
      <div className="text-white font-mono text-xl tracking-widest mt-1">
        {mm}:{ss}
      </div>

      {level > 0.85 && (
        <p className="text-red-400 text-[10px] text-center">
          Niveau trop élevé — éloignez le micro
        </p>
      )}
      {level > 0 && level < 0.15 && (
        <p className="text-amber-400 text-[10px] text-center">
          Niveau faible — rapprochez le micro
        </p>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function AudioEditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editorRef = useRef<MultitrackEditorRef>(null);

  // Query params
  const mediaParam = searchParams.get('media');
  const storyParam = searchParams.get('story');

  // State
  const [initialTracks, setInitialTracks] = useState<Array<{ id?: string; src: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sourceContext, setSourceContext] = useState<SourceContext>({ type: 'new' });
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportedMedia, setExportedMedia] = useState<{
    id: string;
    title: string;
    duration: number;
    fileSize: number;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tracksInEditor, setTracksInEditor] = useState<string[]>([]);

  const {
    isRecording,
    duration: recordingDuration,
    audioLevel,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useRecording();

  // Ajoute la piste enregistrée directement (sans normalisation automatique)
  const addRecordedTrack = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    editorRef.current?.addTrack({ src: url, name });
    setHasUnsavedChanges(true);
  }, []);

  // Stop → insère la piste brute immédiatement
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;

      const date = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }).replace(/\//g, '-');
      const name = `Enregistrement_${date}_${new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      }).replace(':', 'h')}`;

      addRecordedTrack(blob, name);
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, addRecordedTrack]);

  // Normalise la piste active via le store de l'éditeur
  const handleNormalize = useCallback(() => {
    editorRef.current?.normalize();
  }, []);

  // tRPC
  const utils = trpc.useUtils();

  const mediaIds = mediaParam ? mediaParam.split(',').filter(Boolean) : [];

  const { data: mediaItems, isLoading: isLoadingMedia } = trpc.media.getMany.useQuery(
    { ids: mediaIds },
    { enabled: mediaIds.length > 0 }
  );

  const { data: story, isLoading: isLoadingStory } = trpc.story.get.useQuery(
    { id: storyParam! },
    { enabled: !!storyParam }
  );

  const createMediaMutation = trpc.media.create.useMutation({
    onSuccess: () => { utils.media.list.invalidate(); },
  });

  const getUploadUrlMutation = trpc.media.getUploadUrl.useMutation();

  const linkToStoryMutation = trpc.storyMedia.link.useMutation({
    onSuccess: () => {
      if (sourceContext.storyId) {
        utils.storyMedia.listByStory.invalidate({ storyId: sourceContext.storyId });
        utils.story.get.invalidate({ id: sourceContext.storyId });
      }
    },
  });

  const { data: storyMedia, isLoading: isLoadingStoryMedia } = trpc.storyMedia.listByStory.useQuery(
    { storyId: storyParam! },
    { enabled: !!storyParam }
  );

  // Load tracks from media IDs
  useEffect(() => {
    async function loadTracksFromMedia() {
      if (!mediaItems || mediaIds.length === 0) return;
      setIsLoading(true);
      const tracks: Array<{ id?: string; src: string; name: string }> = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const media = mediaItems[i];
        if (media.type === 'AUDIO') {
          tracks.push({ id: media.id, src: media.presignedUrl, name: media.title });
        }
        setLoadingProgress(((i + 1) / mediaItems.length) * 100);
      }
      setInitialTracks(tracks);
      setTracksInEditor(tracks.map(t => t.id!));
      setSourceContext({ type: 'media', ids: mediaIds });
      setIsLoading(false);
    }
    if (mediaIds.length > 0 && mediaItems) loadTracksFromMedia();
  }, [mediaItems, mediaParam]);

  // Load tracks from story
  useEffect(() => {
    async function loadTracksFromStory() {
      if (!storyMedia) return;
      setIsLoading(true);
      const tracks: Array<{ id?: string; src: string; name: string }> = [];
      const audioMedia = storyMedia.filter(m => m.mediaItem.type === 'AUDIO');
      for (let i = 0; i < audioMedia.length; i++) {
        const sm = audioMedia[i];
        tracks.push({ id: sm.mediaItem.id, src: sm.mediaItem.presignedUrl, name: sm.mediaItem.title });
        setLoadingProgress(((i + 1) / audioMedia.length) * 100);
      }
      setInitialTracks(tracks);
      setTracksInEditor(tracks.map(t => t.id!));
      setSourceContext({ type: 'story', storyId: storyParam! });
      setIsLoading(false);
    }
    if (storyParam && storyMedia) loadTracksFromStory();
  }, [storyMedia, storyParam]);

  useEffect(() => {
    if (!mediaParam && !storyParam) {
      setSourceContext({ type: 'new' });
      setIsLoading(false);
    }
  }, [mediaParam, storyParam]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = useCallback(async (blob: Blob, metadata: ExportMetadata) => {
    try {
      const date = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }).replace(/\//g, '-');
      const filename = generateExportName(sourceContext, initialTracks, date);
      const fullFilename = `${filename}.${metadata.format === 'mp3' ? 'mp3' : 'wav'}`;
      const contentType = metadata.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

      const { uploadUrl, key, publicUrl } = await getUploadUrlMutation.mutateAsync({
        filename: fullFilename, contentType,
      });

      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });

      const newMedia = await createMediaMutation.mutateAsync({
        title: metadata.title || filename,
        type: 'AUDIO',
        mimeType: contentType,
        fileSize: blob.size,
        duration: Math.round(metadata.duration),
        s3Key: key,
        s3Url: publicUrl,
        tags: ['montage'],
      });

      setExportedMedia({ id: newMedia.id, title: newMedia.title, duration: metadata.duration, fileSize: blob.size });
      setHasUnsavedChanges(false);
      setShowExportSuccess(true);
    } catch (error) {
      console.error('Failed to save audio:', error);
      alert('Erreur lors de la sauvegarde. Veuillez reessayer.');
    }
  }, [sourceContext, initialTracks, getUploadUrlMutation, createMediaMutation]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Vous avez des modifications non sauvegardees. Voulez-vous vraiment quitter ?');
      if (!confirmed) return;
    }
    router.back();
  }, [hasUnsavedChanges, router]);

  const handleAddTracks = useCallback((mediaItems: Array<{
    id: string; title: string; s3Url: string; duration?: number | null;
  }>) => {
    for (const media of mediaItems) {
      editorRef.current?.addTrack({ src: media.s3Url, name: media.title });
      setTracksInEditor(prev => [...prev, media.id]);
    }
    setHasUnsavedChanges(true);
    setShowMediaPicker(false);
  }, []);

  const handleTracksChange = useCallback((tracks: Track[]) => {
    setHasUnsavedChanges(true);
    setTracksInEditor(tracks.map(t => t.id));
  }, []);

  const handleAttachToStory = useCallback(async () => {
    if (!exportedMedia || !sourceContext.storyId) return;
    try {
      await linkToStoryMutation.mutateAsync({
        storyId: sourceContext.storyId,
        mediaItemId: exportedMedia.id,
        insertionType: 'REFERENCE',
      });
      setShowExportSuccess(false);
      router.push(`/sujets/${sourceContext.storyId}`);
    } catch (error) {
      console.error('Failed to attach to story:', error);
      alert('Erreur lors de l\'attachement au sujet.');
    }
  }, [exportedMedia, sourceContext.storyId, linkToStoryMutation, router]);

  const shouldShowLoading = isLoading ||
    (mediaIds.length > 0 && isLoadingMedia) ||
    (!!storyParam && isLoadingStoryMedia);

  if (shouldShowLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-900">
        <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
            <span className="text-slate-300">Chargement des pistes...</span>
            {loadingProgress > 0 && (
              <span className="text-slate-500 text-sm">{Math.round(loadingProgress)}%</span>
            )}
          </div>
        </header>
        <AudioEditorSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-white font-medium">
            {sourceContext.type === 'story' && 'Montage pour sujet'}
            {sourceContext.type === 'media' && 'Edition audio'}
            {sourceContext.type === 'new' && 'Nouveau montage'}
          </h1>
          {hasUnsavedChanges && (
            <span className="text-amber-400 text-sm">(modifications non sauvegardees)</span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMediaPicker(true)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter piste
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleRecording}
            title={recordingError ?? (isRecording ? 'Arrêter l\'enregistrement' : 'Enregistrer depuis le micro')}
            className={isRecording
              ? 'border-red-500 bg-red-600 text-white hover:bg-red-500'
              : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
            }
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 mr-2 fill-current" />
                {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{Math.floor(recordingDuration % 60).toString().padStart(2, '0')}
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {!isRecording && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNormalize}
              title="Normaliser la piste active (−16 LUFS)"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Normaliser
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* VU-mètre overlay pendant l'enregistrement */}
      {isRecording && (
        <div className="absolute top-14 right-4 z-40">
          <VuMeter level={audioLevel} duration={recordingDuration} />
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <MultitrackEditor
          ref={editorRef}
          initialTracks={initialTracks}
          onSave={handleSave}
          onTracksChange={handleTracksChange}
          onClose={handleClose}
          theme="dark"
          className="h-full"
        />
      </div>

      {/* Media Picker */}
      <MediaPickerDialog
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleAddTracks}
        excludeIds={tracksInEditor}
      />

      {/* Export Success */}
      {exportedMedia && (
        <ExportSuccessDialog
          open={showExportSuccess}
          onClose={() => setShowExportSuccess(false)}
          mediaId={exportedMedia.id}
          mediaTitle={exportedMedia.title}
          duration={exportedMedia.duration}
          fileSize={exportedMedia.fileSize}
          sourceContext={sourceContext}
          onAttachToStory={sourceContext.type === 'story' ? handleAttachToStory : undefined}
          onGoToMedia={() => router.push(`/mediatheque?highlight=${exportedMedia.id}`)}
          onContinueEditing={() => setShowExportSuccess(false)}
        />
      )}
    </div>
  );
}

function generateExportName(
  sourceContext: SourceContext,
  tracks: Array<{ id?: string; src: string; name: string }>,
  date: string
): string {
  if (sourceContext.type === 'story') return `Montage_Sujet_${date}`;
  if (tracks.length === 1) {
    const baseName = tracks[0].name.replace(/\.[^/.]+$/, '');
    return `${baseName}_edit_${date}`;
  }
  return `Montage_${date}`;
}
