'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TransportBar } from './TransportBar';
import { Timeline } from './Timeline';
import { ClipLibrary } from './ClipLibrary';
import { ExportDialog } from './ExportDialog';
import {
  getMontageAudioEngine,
  DEFAULT_ZOOM,
  TRACK_COLORS,
  enrichClip,
} from '@/lib/audio-montage';
import type {
  MontageProject,
  Track,
  Clip,
  ClipWithComputed,
  DragItem,
} from '@/lib/audio-montage/types';

interface MontageEditorProps {
  project: MontageProject & {
    tracks: (Track & { clips: Clip[] })[];
  };
  mediaItems: {
    id: string;
    title: string;
    duration: number | null;
    s3Url: string;
    type: string;
  }[];
  onSave: (data: {
    duration: number;
    tracks: { id: string; volume: number; pan: number; muted: boolean; solo: boolean }[];
    clips: {
      id: string;
      startTime: number;
      inPoint: number;
      outPoint: number;
      volume: number;
      fadeInDuration: number;
      fadeOutDuration: number;
    }[];
  }) => Promise<void>;
  onAddTrack: (name: string, color: string) => Promise<Track>;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => Promise<void>;
  onAddClip: (
    trackId: string,
    clip: Omit<Clip, 'id' | 'trackId'>
  ) => Promise<Clip>;
  onDeleteClip: (clipId: string) => Promise<void>;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => Promise<void>;
  onMoveClip: (clipId: string, trackId: string, startTime: number) => Promise<void>;
}

export function MontageEditor({
  project: initialProject,
  mediaItems,
  onSave,
  onAddTrack,
  onDeleteTrack,
  onUpdateTrack,
  onAddClip,
  onDeleteClip,
  onUpdateClip,
  onMoveClip,
}: MontageEditorProps) {
  // State local du projet (pour modifications en temps reel)
  const [project, setProject] = useState(initialProject);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State de lecture
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(1);

  // State de la timeline
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // State de la bibliotheque
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);

  // State de l'export
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Reference au moteur audio
  const engineRef = useRef(getMontageAudioEngine());

  // Calculer la duree totale
  const calculateDuration = useCallback(() => {
    let maxEndTime = 0;
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const endTime = clip.startTime + (clip.outPoint - clip.inPoint);
        if (endTime > maxEndTime) {
          maxEndTime = endTime;
        }
      });
    });
    return maxEndTime;
  }, [project.tracks]);

  const duration = calculateDuration();

  // Enrichir les clips avec les proprietes calculees
  const enrichedTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map(enrichClip),
  }));

  // Initialiser le moteur audio
  useEffect(() => {
    const engine = engineRef.current;

    engine.init().then(() => {
      engine.setTimeUpdateCallback(setCurrentTime);
      engine.setPlaybackEndCallback(() => setIsPlaying(false));
      engine.loadProject(project);
    });

    return () => {
      engine.pause();
    };
  }, []);

  // Recharger le projet quand il change
  useEffect(() => {
    const engine = engineRef.current;
    engine.loadProject(project);
  }, [project]);

  // Controles de lecture
  const handlePlay = async () => {
    await engineRef.current.play(currentTime);
    setIsPlaying(true);
  };

  const handlePause = () => {
    engineRef.current.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    engineRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (time: number) => {
    engineRef.current.seek(time);
    setCurrentTime(time);
  };

  const handleMasterVolumeChange = (volume: number) => {
    setMasterVolume(volume);
    engineRef.current.setMasterVolume(volume);
  };

  // Sauvegarde
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        duration,
        tracks: project.tracks.map((t) => ({
          id: t.id,
          volume: t.volume,
          pan: t.pan,
          muted: t.muted,
          solo: t.solo,
        })),
        clips: project.tracks.flatMap((t) =>
          t.clips.map((c) => ({
            id: c.id,
            startTime: c.startTime,
            inPoint: c.inPoint,
            outPoint: c.outPoint,
            volume: c.volume,
            fadeInDuration: c.fadeInDuration,
            fadeOutDuration: c.fadeOutDuration,
          }))
        ),
      });
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Gestion des pistes
  const handleAddTrack = async () => {
    const trackNumber = project.tracks.length + 1;
    const color = TRACK_COLORS[project.tracks.length % TRACK_COLORS.length];
    const newTrack = await onAddTrack(`Piste ${trackNumber}`, color);

    setProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, { ...newTrack, clips: [] }],
    }));
    setHasUnsavedChanges(true);
  };

  const handleDeleteTrack = async (trackId: string) => {
    await onDeleteTrack(trackId);
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
    }));
    setHasUnsavedChanges(true);
  };

  const handleUpdateTrack = async (trackId: string, updates: Partial<Track>) => {
    // Mise a jour locale immediate
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    }));

    // Mise a jour du moteur audio
    if (updates.volume !== undefined) {
      engineRef.current.setTrackVolume(trackId, updates.volume);
    }
    if (updates.pan !== undefined) {
      engineRef.current.setTrackPan(trackId, updates.pan);
    }
    if (updates.muted !== undefined) {
      engineRef.current.setTrackMute(trackId, updates.muted);
    }
    if (updates.solo !== undefined) {
      engineRef.current.setTrackSolo(trackId, updates.solo);
    }

    // Sauvegarder en arriere-plan
    await onUpdateTrack(trackId, updates);
    setHasUnsavedChanges(true);
  };

  // Gestion des clips
  const handleAddClipFromLibrary = async (
    trackId: string,
    item: DragItem,
    startTime: number
  ) => {
    const newClip = await onAddClip(trackId, {
      name: item.name,
      mediaItemId: item.mediaItemId,
      sourceUrl: item.sourceUrl,
      sourceDuration: item.duration,
      startTime,
      inPoint: 0,
      outPoint: item.duration,
      volume: 1,
      fadeInDuration: 0,
      fadeOutDuration: 0,
    });

    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
    }));
    setHasUnsavedChanges(true);

    // Recharger le moteur audio
    await engineRef.current.loadClip(newClip, trackId);
  };

  const handleDeleteClip = async (clipId: string) => {
    await onDeleteClip(clipId);
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      })),
    }));
    engineRef.current.removeClip(clipId);
    setSelectedClipId(null);
    setHasUnsavedChanges(true);
  };

  const handleMoveClip = async (
    clipId: string,
    trackId: string,
    startTime: number
  ) => {
    await onMoveClip(clipId, trackId, startTime);

    setProject((prev) => {
      // Trouver le clip
      let movedClip: Clip | null = null;
      const newTracks = prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => {
          if (c.id === clipId) {
            movedClip = { ...c, startTime, trackId };
            return false;
          }
          return true;
        }),
      }));

      // Ajouter le clip a la nouvelle piste
      if (movedClip) {
        return {
          ...prev,
          tracks: newTracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, movedClip!] }
              : t
          ),
        };
      }
      return prev;
    });
    setHasUnsavedChanges(true);
  };

  const handleTrimClip = async (
    clipId: string,
    inPoint: number,
    outPoint: number
  ) => {
    await onUpdateClip(clipId, { inPoint, outPoint });

    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, inPoint, outPoint } : c
        ),
      })),
    }));
    engineRef.current.updateClip(clipId, { inPoint, outPoint });
    setHasUnsavedChanges(true);
  };

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on tape dans un input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            handlePause();
          } else {
            handlePlay();
          }
          break;
        case 'Escape':
          handleStop();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            handleDeleteClip(selectedClipId);
          }
          break;
        case 'KeyS':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedClipId]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-2 border-b">
          <Link href="/audio-montage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{project.name}</h1>
            {hasUnsavedChanges && (
              <span className="text-xs text-muted-foreground">
                Modifications non sauvegardees
              </span>
            )}
          </div>
        </div>

        {/* Transport */}
        <TransportBar
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          masterVolume={masterVolume}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSeek={handleSeek}
          onMasterVolumeChange={handleMasterVolumeChange}
          onSave={handleSave}
          onExport={() => setIsExportDialogOpen(true)}
        />

        {/* Timeline */}
        <Timeline
          tracks={enrichedTracks}
          zoom={zoom}
          scrollLeft={scrollLeft}
          currentTime={currentTime}
          duration={duration}
          selectedClipId={selectedClipId}
          onZoomChange={setZoom}
          onScrollChange={setScrollLeft}
          onSeek={handleSeek}
          onSelectClip={setSelectedClipId}
          onDeleteClip={handleDeleteClip}
          onMoveClip={handleMoveClip}
          onTrimClip={handleTrimClip}
          onAddClip={handleAddClipFromLibrary}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          onUpdateTrack={handleUpdateTrack}
        />

        {/* Bibliotheque */}
        <ClipLibrary
          mediaItems={mediaItems}
          isLoading={false}
          isCollapsed={isLibraryCollapsed}
          onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
          onImport={() => {
            // TODO: Ouvrir dialog d'import
          }}
        />

        {/* Dialog d'export */}
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          project={project}
          duration={duration}
        />
      </div>
    </DndProvider>
  );
}
