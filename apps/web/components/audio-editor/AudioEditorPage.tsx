'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MultitrackEditor,
  type Track,
  type ExportMetadata,
  type MultitrackEditorRef,
} from '@redacnews/audio-editor';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Keyboard, Loader2 } from 'lucide-react';
import { MediaPickerDialog } from './MediaPickerDialog';
import { ExportSuccessDialog } from './ExportSuccessDialog';
import { AudioEditorSkeleton } from './AudioEditorSkeleton';

interface SourceContext {
  type: 'media' | 'story' | 'new';
  ids?: string[];
  storyId?: string;
}

export function AudioEditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editorRef = useRef<MultitrackEditorRef>(null);

  // Query params
  const mediaParam = searchParams.get('media');
  const storyParam = searchParams.get('story');

  // State
  const [initialTracks, setInitialTracks] = useState<Track[]>([]);
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

  // tRPC
  const utils = trpc.useUtils();

  // Query to get multiple media items with presigned URLs
  const mediaIds = mediaParam ? mediaParam.split(',').filter(Boolean) : [];

  const { data: mediaItems, isLoading: isLoadingMedia } = trpc.media.getMany.useQuery(
    { ids: mediaIds },
    { enabled: mediaIds.length > 0 }
  );

  // Query to get story with media
  const { data: story, isLoading: isLoadingStory } = trpc.story.get.useQuery(
    { id: storyParam! },
    { enabled: !!storyParam }
  );

  // Mutation to create new media item
  const createMediaMutation = trpc.media.create.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
    },
  });

  // Mutation to get presigned URL for upload
  const getUploadUrlMutation = trpc.media.getUploadUrl.useMutation();

  // Mutation to attach media to story
  const linkToStoryMutation = trpc.storyMedia.link.useMutation({
    onSuccess: () => {
      if (sourceContext.storyId) {
        utils.storyMedia.listByStory.invalidate({ storyId: sourceContext.storyId });
        utils.story.get.invalidate({ id: sourceContext.storyId });
      }
    },
  });

  // Query for story media
  const { data: storyMedia, isLoading: isLoadingStoryMedia } = trpc.storyMedia.listByStory.useQuery(
    { storyId: storyParam! },
    { enabled: !!storyParam }
  );

  // Load tracks from media IDs
  useEffect(() => {
    async function loadTracksFromMedia() {
      if (!mediaItems || mediaIds.length === 0) return;

      setIsLoading(true);
      const tracks: Track[] = [];

      // mediaItems from getMany already has presignedUrl
      for (let i = 0; i < mediaItems.length; i++) {
        const media = mediaItems[i];
        if (media.type === 'AUDIO') {
          tracks.push({
            id: media.id,
            src: media.presignedUrl, // Use presigned URL instead of s3Url
            name: media.title,
            start: 0, // All tracks start at 0
          });
        }
        setLoadingProgress(((i + 1) / mediaItems.length) * 100);
      }

      setInitialTracks(tracks);
      setTracksInEditor(tracks.map(t => t.id));
      setSourceContext({ type: 'media', ids: mediaIds });
      setIsLoading(false);
    }

    if (mediaIds.length > 0 && mediaItems) {
      loadTracksFromMedia();
    }
  }, [mediaItems, mediaParam]);

  // Load tracks from story
  useEffect(() => {
    async function loadTracksFromStory() {
      if (!storyMedia) return;

      setIsLoading(true);
      const tracks: Track[] = [];

      const audioMedia = storyMedia.filter(m => m.mediaItem.type === 'AUDIO');

      for (let i = 0; i < audioMedia.length; i++) {
        const sm = audioMedia[i];
        tracks.push({
          id: sm.mediaItem.id,
          src: sm.mediaItem.presignedUrl, // Use presigned URL instead of s3Url
          name: sm.mediaItem.title,
          start: 0, // All tracks start at 0
        });
        setLoadingProgress(((i + 1) / audioMedia.length) * 100);
      }

      setInitialTracks(tracks);
      setTracksInEditor(tracks.map(t => t.id));
      setSourceContext({ type: 'story', storyId: storyParam! });
      setIsLoading(false);
    }

    if (storyParam && storyMedia) {
      loadTracksFromStory();
    }
  }, [storyMedia, storyParam]);

  // Set new context if no params
  useEffect(() => {
    if (!mediaParam && !storyParam) {
      setSourceContext({ type: 'new' });
      setIsLoading(false);
    }
  }, [mediaParam, storyParam]);

  // Handle beforeunload for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle save/export
  const handleSave = useCallback(async (blob: Blob, metadata: ExportMetadata) => {
    try {
      const date = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).replace(/\//g, '-');

      const filename = generateExportName(sourceContext, initialTracks, date);
      const fullFilename = `${filename}.${metadata.format === 'mp3' ? 'mp3' : 'wav'}`;
      const contentType = metadata.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

      // Get presigned URL for upload
      const { uploadUrl, key, publicUrl } = await getUploadUrlMutation.mutateAsync({
        filename: fullFilename,
        contentType,
      });

      // Upload to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': contentType,
        },
      });

      // Create media item in database
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

      setExportedMedia({
        id: newMedia.id,
        title: newMedia.title,
        duration: metadata.duration,
        fileSize: blob.size,
      });
      setHasUnsavedChanges(false);
      setShowExportSuccess(true);

    } catch (error) {
      console.error('Failed to save audio:', error);
      alert('Erreur lors de la sauvegarde. Veuillez reessayer.');
    }
  }, [sourceContext, initialTracks, getUploadUrlMutation, createMediaMutation]);

  // Handle close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Vous avez des modifications non sauvegardees. Voulez-vous vraiment quitter ?'
      );
      if (!confirmed) return;
    }
    router.back();
  }, [hasUnsavedChanges, router]);

  // Handle add track from picker
  const handleAddTracks = useCallback((mediaItems: Array<{
    id: string;
    title: string;
    s3Url: string;
    duration?: number | null;
  }>) => {
    const currentTracks = editorRef.current?.getState()?.tracks || [];
    const lastEnd = currentTracks.reduce((max, t) => Math.max(max, (t.start || 0) + (t.duration || 0)), 0);

    let startOffset = lastEnd;

    for (const media of mediaItems) {
      const track: Track = {
        id: media.id,
        src: media.s3Url,
        name: media.title,
        start: startOffset,
      };

      editorRef.current?.addTrack(track);
      setTracksInEditor(prev => [...prev, media.id]);
      startOffset += (media.duration || 30) + 1; // Add 1 second gap
    }

    setHasUnsavedChanges(true);
    setShowMediaPicker(false);
  }, []);

  // Handle tracks change
  const handleTracksChange = useCallback((tracks: Track[]) => {
    setHasUnsavedChanges(true);
    setTracksInEditor(tracks.map(t => t.id));
  }, []);

  // Handle attach to story
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

  // Show loading state - only check relevant loading states based on params
  const shouldShowLoading = isLoading ||
    (mediaIds.length > 0 && isLoadingMedia) ||
    (!!storyParam && isLoadingStoryMedia);

  if (shouldShowLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-900">
        {/* Header */}
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
        {/* Left: Navigation */}
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

        {/* Right: Actions */}
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
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </header>

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

      {/* Media Picker Dialog */}
      <MediaPickerDialog
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleAddTracks}
        excludeIds={tracksInEditor}
      />

      {/* Export Success Dialog */}
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
          onGoToMedia={() => {
            router.push(`/mediatheque?highlight=${exportedMedia.id}`);
          }}
          onContinueEditing={() => setShowExportSuccess(false)}
        />
      )}
    </div>
  );
}

function generateExportName(
  sourceContext: SourceContext,
  tracks: Track[],
  date: string
): string {
  if (sourceContext.type === 'story') {
    return `Montage_Sujet_${date}`;
  }

  if (tracks.length === 1) {
    // If single track, use its name
    const baseName = tracks[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
    return `${baseName}_edit_${date}`;
  }

  return `Montage_${date}`;
}
