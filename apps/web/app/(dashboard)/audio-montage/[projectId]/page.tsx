'use client';

import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MontageEditor } from '@/components/audio-montage';
import { trpc } from '@/lib/trpc/client';

export default function MontageProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Charger le projet
  const {
    data: project,
    isLoading: isProjectLoading,
    error: projectError,
  } = trpc.montage.get.useQuery({ id: projectId });

  // Charger les medias disponibles
  const { data: mediaItems, isLoading: isMediaLoading } = trpc.media.list.useQuery({
    type: 'AUDIO',
  });

  // Mutations
  const saveStateMutation = trpc.montage.saveProjectState.useMutation();
  const addTrackMutation = trpc.montage.addTrack.useMutation();
  const updateTrackMutation = trpc.montage.updateTrack.useMutation();
  const deleteTrackMutation = trpc.montage.deleteTrack.useMutation();
  const addClipMutation = trpc.montage.addClip.useMutation();
  const updateClipMutation = trpc.montage.updateClip.useMutation();
  const moveClipMutation = trpc.montage.moveClip.useMutation();
  const deleteClipMutation = trpc.montage.deleteClip.useMutation();

  if (isProjectLoading || isMediaLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Projet introuvable</h1>
          <p className="text-muted-foreground">
            Ce projet n'existe pas ou vous n'y avez pas acces.
          </p>
        </div>
      </div>
    );
  }

  // Transformer les donnees pour l'editeur
  const projectData = {
    id: project.id,
    name: project.name,
    description: project.description || undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    duration: project.duration,
    tracks: project.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      color: track.color,
      order: track.order,
      volume: track.volume,
      pan: track.pan,
      muted: track.muted,
      solo: track.solo,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        trackId: clip.trackId,
        name: clip.name,
        mediaItemId: clip.mediaItemId || undefined,
        sourceUrl: clip.sourceUrl,
        sourceDuration: clip.sourceDuration,
        startTime: clip.startTime,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        volume: clip.volume,
        fadeInDuration: clip.fadeInDuration,
        fadeOutDuration: clip.fadeOutDuration,
      })),
    })),
  };

  const mediaItemsData = (mediaItems || []).map((item) => ({
    id: item.id,
    title: item.title,
    duration: item.duration,
    s3Url: item.s3Url,
    type: item.type,
  }));

  return (
    <MontageEditor
      project={projectData}
      mediaItems={mediaItemsData}
      onSave={async (data) => {
        await saveStateMutation.mutateAsync({
          projectId,
          ...data,
        });
      }}
      onAddTrack={async (name, color) => {
        const track = await addTrackMutation.mutateAsync({
          projectId,
          name,
          color,
        });
        return {
          id: track.id,
          name: track.name,
          color: track.color,
          order: track.order,
          volume: track.volume,
          pan: track.pan,
          muted: track.muted,
          solo: track.solo,
          clips: [],
        };
      }}
      onDeleteTrack={async (trackId) => {
        await deleteTrackMutation.mutateAsync({ id: trackId });
      }}
      onUpdateTrack={async (trackId, updates) => {
        await updateTrackMutation.mutateAsync({ id: trackId, ...updates });
      }}
      onAddClip={async (trackId, clipData) => {
        const clip = await addClipMutation.mutateAsync({
          trackId,
          name: clipData.name,
          mediaItemId: clipData.mediaItemId,
          sourceUrl: clipData.sourceUrl,
          sourceDuration: clipData.sourceDuration,
          startTime: clipData.startTime,
          inPoint: clipData.inPoint,
          outPoint: clipData.outPoint,
          volume: clipData.volume,
        });
        return {
          id: clip.id,
          trackId: clip.trackId,
          name: clip.name,
          mediaItemId: clip.mediaItemId || undefined,
          sourceUrl: clip.sourceUrl,
          sourceDuration: clip.sourceDuration,
          startTime: clip.startTime,
          inPoint: clip.inPoint,
          outPoint: clip.outPoint,
          volume: clip.volume,
          fadeInDuration: clip.fadeInDuration,
          fadeOutDuration: clip.fadeOutDuration,
        };
      }}
      onDeleteClip={async (clipId) => {
        await deleteClipMutation.mutateAsync({ id: clipId });
      }}
      onUpdateClip={async (clipId, updates) => {
        await updateClipMutation.mutateAsync({ id: clipId, ...updates });
      }}
      onMoveClip={async (clipId, trackId, startTime) => {
        await moveClipMutation.mutateAsync({ id: clipId, trackId, startTime });
      }}
    />
  );
}
