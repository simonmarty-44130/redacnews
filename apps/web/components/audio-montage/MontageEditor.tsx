'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TransportBar } from './TransportBar';
import { Toolbar } from './Toolbar';
import { Timeline } from './Timeline';
import { Minimap } from './Minimap';
import { StatusBar } from './StatusBar';
import { ExportDialog } from './ExportDialog';
import { ImportDialog } from './ImportDialog';
import { ClipDragLayer } from './ClipDragLayer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { ClipRef } from './Clip';
import {
  DEFAULT_ZOOM,
  TRACK_COLORS,
  enrichClip,
  DEFAULT_TRACKS,
  FIXED_TRACKS_MODE,
} from '@/lib/audio-montage';
import { getSyncEngine, resetSyncEngine } from '@/lib/audio-montage/SyncEngine';
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
  const [viewportWidth, setViewportWidth] = useState(800); // Largeur visible de la timeline
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // State pour les points In/Out et mode d'édition
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<'select' | 'razor'>('select');

  // Hook d'enregistrement audio
  const { isRecording, startRecording, stopRecording, error: recordingError } = useAudioRecorder();
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0); // Position sur la timeline
  const recordingStartTimestampRef = useRef<number>(0); // Timestamp du début

  // State de l'export
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // State de l'import
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Map pour stocker les refs de tous les clips WaveSurfer
  // Note: Maintenant les clips s'enregistrent eux-memes aupres du SyncEngine
  const clipRefsRef = useRef<Map<string, ClipRef | null>>(new Map());

  // Reference au SyncEngine
  const syncEngine = getSyncEngine();

  // Initialiser les pistes par défaut si manquantes (mode FIXED_TRACKS_MODE)
  // Utilise un ref pour éviter la double exécution en React StrictMode
  const tracksInitializedRef = useRef(false);

  useEffect(() => {
    const initDefaultTracks = async () => {
      // Éviter la double exécution (React StrictMode)
      if (tracksInitializedRef.current) {
        return;
      }

      if (!FIXED_TRACKS_MODE) {
        return;
      }

      // Vérifier les pistes existantes par leur ID
      const existingTrackIds = new Set(project.tracks.map((t) => t.id));
      const missingTracks = DEFAULT_TRACKS.filter(
        (dt) => !existingTrackIds.has(dt.id)
      );

      if (missingTracks.length === 0) {
        console.log('[MontageEditor] All default tracks already exist');
        return;
      }

      tracksInitializedRef.current = true;
      console.log('[MontageEditor] Initializing missing default tracks:', missingTracks.map(t => t.name));

      // Créer les pistes manquantes une par une
      for (const defaultTrack of missingTracks) {
        try {
          const newTrack = await onAddTrack(defaultTrack.name, defaultTrack.color);
          setProject((prev) => ({
            ...prev,
            tracks: [...prev.tracks, { ...newTrack, clips: [] }],
          }));
        } catch (error) {
          console.error('[MontageEditor] Failed to create default track:', error);
        }
      }
    };
    initDefaultTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Exécuté une seule fois au montage

  // Dédupliquer les pistes si nécessaire (pour corriger les projets existants)
  useEffect(() => {
    if (FIXED_TRACKS_MODE && project.tracks.length > 3) {
      console.log('[MontageEditor] Deduplicating tracks, found:', project.tracks.length);
      const seen = new Set<string>();
      const uniqueTracks = project.tracks.filter((track) => {
        // Utiliser le nom comme clé de déduplication car les IDs peuvent différer
        const key = track.name.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      if (uniqueTracks.length !== project.tracks.length) {
        console.log('[MontageEditor] Deduplicated to:', uniqueTracks.length, 'tracks');
        setProject((prev) => ({ ...prev, tracks: uniqueTracks }));
      }
    }
  }, [project.tracks.length]);

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

  // S'abonner aux evenements du SyncEngine
  useEffect(() => {
    const unsubTime = syncEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    const unsubPlay = syncEngine.onPlayStateChange((playing) => {
      setIsPlaying(playing);
    });

    return () => {
      unsubTime();
      unsubPlay();
    };
  }, [syncEngine]);

  // Cleanup au demontage du composant
  useEffect(() => {
    return () => {
      resetSyncEngine();
    };
  }, []);

  // Controles de lecture via SyncEngine
  const handlePlay = useCallback(() => {
    console.log('[MontageEditor] play() from', currentTime.toFixed(2));
    syncEngine.play(currentTime);
  }, [currentTime, syncEngine]);

  const handlePause = useCallback(() => {
    console.log('[MontageEditor] pause()');
    syncEngine.pause();
  }, [syncEngine]);

  const handleStop = useCallback(() => {
    console.log('[MontageEditor] stop()');
    syncEngine.stop();
  }, [syncEngine]);

  const handleSeek = useCallback((time: number) => {
    console.log('[MontageEditor] seek() to', time.toFixed(2));
    syncEngine.seek(Math.max(0, time));
  }, [syncEngine]);

  const handleMasterVolumeChange = useCallback((volume: number) => {
    setMasterVolume(volume);
    // Mettre a jour le volume de tous les clips en cours de lecture
    clipRefsRef.current.forEach((ref, clipId) => {
      if (ref?.isReady()) {
        // Trouver le clip et sa piste pour calculer le volume effectif
        for (const track of project.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            const effectiveVolume = track.volume * clip.volume * volume;
            ref.setVolume(effectiveVolume);
            break;
          }
        }
      }
    });
  }, [project.tracks]);

  // Callback quand un clip est pret
  const handleClipReady = useCallback((clipId: string) => {
    console.log('[MontageEditor] Clip ready:', clipId);
  }, []);

  // Callback pour changer le volume d'un clip
  const handleClipVolumeChange = useCallback((clipId: string, volume: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId ? { ...clip, volume } : clip
        ),
      })),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Callback quand la vraie duree d'un clip est detectee
  // Cela permet de corriger les clips dont la duree etait manquante ou incorrecte
  const handleDurationDetected = useCallback(async (clipId: string, realDuration: number) => {
    console.log('[MontageEditor] Duration detected for clip:', clipId, 'Real duration:', realDuration);

    // Trouver le clip actuel
    let clipFound: Clip | null = null;
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) {
        clipFound = clip;
        break;
      }
    }

    if (!clipFound) return;

    // Si la duree en base etait 0 ou tres differente, mettre a jour
    const currentDuration = clipFound.outPoint - clipFound.inPoint;
    if (currentDuration < 1 || Math.abs(currentDuration - realDuration) > 1) {
      console.log('[MontageEditor] Updating clip duration from', currentDuration, 'to', realDuration);

      // Mettre a jour le clip avec la vraie duree
      const newOutPoint = clipFound.inPoint + realDuration;

      // Mise a jour locale immediate
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? { ...c, outPoint: newOutPoint, sourceDuration: realDuration }
              : c
          ),
        })),
      }));

      // Sauvegarder en arriere-plan
      try {
        await onUpdateClip(clipId, { outPoint: newOutPoint });
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('[MontageEditor] Failed to update clip duration:', error);
      }
    }
  }, [project.tracks, onUpdateClip]);

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

    // Mettre a jour le volume des clips de cette piste
    const track = project.tracks.find((t) => t.id === trackId);
    if (track) {
      const newVolume = updates.volume ?? track.volume;
      const newMuted = updates.muted ?? track.muted;
      const hasSolo = project.tracks.some((t) => t.solo);
      const newSolo = updates.solo ?? track.solo;

      track.clips.forEach((clip) => {
        const clipRef = clipRefsRef.current.get(clip.id);
        if (clipRef?.isReady()) {
          // Determiner si ce clip doit etre audible
          let shouldBeMuted = newMuted;
          if (hasSolo || newSolo) {
            // S'il y a du solo, seules les pistes solo sont audibles
            shouldBeMuted = !(updates.solo !== undefined ? newSolo : track.solo);
          }

          const effectiveVolume = shouldBeMuted ? 0 : newVolume * clip.volume * masterVolume;
          clipRef.setVolume(effectiveVolume);
        }
      });
    }

    // Sauvegarder en arriere-plan
    await onUpdateTrack(trackId, updates);
    setHasUnsavedChanges(true);
  };

  // Vérifier si la timeline est vide (aucun clip sur aucune piste)
  const isTimelineEmpty = useCallback(() => {
    return project.tracks.every((track) => track.clips.length === 0);
  }, [project.tracks]);

  // Gestion des clips
  const handleAddClipFromLibrary = async (
    trackId: string,
    item: DragItem,
    startTime: number
  ) => {
    // Import intelligent :
    // - Si timeline vide (aucun clip) → toujours à 0
    // - Si startTime est explicitement fourni (drag&drop précis) → utiliser cette valeur
    // - Sinon → position de la playhead
    let finalStartTime = startTime;

    // Vérifier si la timeline est vide
    const timelineEmpty = isTimelineEmpty();

    if (timelineEmpty) {
      // Timeline vide : toujours placer à 0
      finalStartTime = 0;
      console.log('[MontageEditor] Timeline empty, placing clip at 0');
    }
    // Note: Si la timeline n'est pas vide et qu'un startTime est fourni via drag&drop,
    // on utilise ce startTime tel quel (déjà calculé par Track.tsx)

    const newClip = await onAddClip(trackId, {
      name: item.name,
      mediaItemId: item.mediaItemId,
      sourceUrl: item.sourceUrl,
      sourceDuration: item.duration,
      startTime: finalStartTime,
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
    // Le clip sera automatiquement charge par WaveSurferClip via le rendu React
  };

  const handleDeleteClip = async (clipId: string) => {
    await onDeleteClip(clipId);
    // Supprimer la ref du clip
    clipRefsRef.current.delete(clipId);
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      })),
    }));
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
    // Le WaveSurferClip sera mis a jour automatiquement via les props
    setHasUnsavedChanges(true);
  };

  // Effacer les points In/Out
  const clearInOutPoints = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  // Supprimer la région entre In et Out (ripple delete)
  const deleteInOutRegion = useCallback(async () => {
    if (inPoint === null || outPoint === null || inPoint >= outPoint) {
      console.log('[MontageEditor] Invalid In/Out points for delete');
      return;
    }

    const regionStart = inPoint;
    const regionEnd = outPoint;
    const regionDuration = regionEnd - regionStart;

    console.log('[MontageEditor] Deleting region from', regionStart.toFixed(2), 'to', regionEnd.toFixed(2));

    // Pour chaque piste, traiter les clips affectés
    for (const track of project.tracks) {
      const clipsToProcess: Clip[] = [];
      const clipsToDelete: string[] = [];
      const clipsToAdd: Omit<Clip, 'id' | 'trackId'>[] = [];
      const clipsToUpdate: { id: string; updates: Partial<Clip> }[] = [];

      for (const clip of track.clips) {
        const clipDuration = clip.outPoint - clip.inPoint;
        const clipEnd = clip.startTime + clipDuration;

        // Cas 1: Clip entièrement avant la région - pas affecté
        if (clipEnd <= regionStart) {
          continue;
        }

        // Cas 2: Clip entièrement après la région - décaler vers la gauche
        if (clip.startTime >= regionEnd) {
          clipsToUpdate.push({
            id: clip.id,
            updates: { startTime: clip.startTime - regionDuration }
          });
          continue;
        }

        // Cas 3: Clip entièrement dans la région - supprimer
        if (clip.startTime >= regionStart && clipEnd <= regionEnd) {
          clipsToDelete.push(clip.id);
          continue;
        }

        // Cas 4: Clip chevauche le début de la région (clip commence avant, finit dans/après)
        if (clip.startTime < regionStart && clipEnd > regionStart) {
          // Partie avant la région
          const cutPointInSource = regionStart - clip.startTime + clip.inPoint;

          if (clipEnd <= regionEnd) {
            // Le clip finit dans la région - garder seulement la partie avant
            clipsToUpdate.push({
              id: clip.id,
              updates: { outPoint: cutPointInSource }
            });
          } else {
            // Le clip traverse toute la région - diviser en deux et supprimer le milieu
            // Garder la partie avant
            clipsToUpdate.push({
              id: clip.id,
              updates: { outPoint: cutPointInSource }
            });

            // Créer la partie après (décalée)
            const afterCutInSource = regionEnd - clip.startTime + clip.inPoint;
            clipsToAdd.push({
              name: clip.name,
              mediaItemId: clip.mediaItemId,
              sourceUrl: clip.sourceUrl,
              sourceDuration: clip.sourceDuration,
              startTime: regionStart, // Rejoint le point de coupe
              inPoint: afterCutInSource,
              outPoint: clip.outPoint,
              volume: clip.volume,
              fadeInDuration: 0,
              fadeOutDuration: clip.fadeOutDuration,
            });
          }
          continue;
        }

        // Cas 5: Clip commence dans la région mais finit après
        if (clip.startTime >= regionStart && clip.startTime < regionEnd && clipEnd > regionEnd) {
          // Couper le début et décaler
          const cutPointInSource = regionEnd - clip.startTime + clip.inPoint;
          clipsToUpdate.push({
            id: clip.id,
            updates: {
              startTime: regionStart,
              inPoint: cutPointInSource
            }
          });
          continue;
        }
      }

      // Appliquer les modifications
      for (const clipId of clipsToDelete) {
        await onDeleteClip(clipId);
      }

      for (const { id, updates } of clipsToUpdate) {
        await onUpdateClip(id, updates);
      }

      for (const clipData of clipsToAdd) {
        await onAddClip(track.id, clipData);
      }
    }

    // Mettre à jour le state local
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        let updatedClips = track.clips
          .filter((clip) => {
            const clipDuration = clip.outPoint - clip.inPoint;
            const clipEnd = clip.startTime + clipDuration;
            // Supprimer les clips entièrement dans la région
            return !(clip.startTime >= regionStart && clipEnd <= regionEnd);
          })
          .map((clip) => {
            const clipDuration = clip.outPoint - clip.inPoint;
            const clipEnd = clip.startTime + clipDuration;

            // Décaler les clips après la région
            if (clip.startTime >= regionEnd) {
              return { ...clip, startTime: clip.startTime - regionDuration };
            }

            // Tronquer les clips qui chevauchent le début
            if (clip.startTime < regionStart && clipEnd > regionStart) {
              const cutPointInSource = regionStart - clip.startTime + clip.inPoint;
              if (clipEnd <= regionEnd) {
                return { ...clip, outPoint: cutPointInSource };
              }
              // Pour les clips qui traversent - on garde juste la partie avant
              // La partie après sera ajoutée séparément
              return { ...clip, outPoint: cutPointInSource };
            }

            // Clips qui commencent dans la région mais finissent après
            if (clip.startTime >= regionStart && clip.startTime < regionEnd && clipEnd > regionEnd) {
              const cutPointInSource = regionEnd - clip.startTime + clip.inPoint;
              return {
                ...clip,
                startTime: regionStart,
                inPoint: cutPointInSource
              };
            }

            return clip;
          });

        return { ...track, clips: updatedClips };
      }),
    }));

    setHasUnsavedChanges(true);
    clearInOutPoints();
    console.log('[MontageEditor] Region deleted, clips shifted by', regionDuration.toFixed(2), 'seconds');
  }, [inPoint, outPoint, project.tracks, onDeleteClip, onUpdateClip, onAddClip, clearInOutPoints]);

  // Couper un clip à la position de la playhead
  const cutAtPlayhead = useCallback(async () => {
    // Trouver le clip sous la playhead
    let clipToCut: Clip | null = null;
    let trackId: string | null = null;

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const clipDuration = clip.outPoint - clip.inPoint;
        const clipEndTime = clip.startTime + clipDuration;
        if (currentTime > clip.startTime && currentTime < clipEndTime) {
          clipToCut = clip;
          trackId = track.id;
          break;
        }
      }
      if (clipToCut) break;
    }

    if (!clipToCut || !trackId) {
      console.log('[MontageEditor] No clip found at playhead position');
      return;
    }

    // Position relative dans le clip (en tenant compte du inPoint)
    const cutPointInSource = currentTime - clipToCut.startTime + clipToCut.inPoint;

    // Créer le premier clip (avant la coupe)
    const clipA = {
      name: clipToCut.name,
      mediaItemId: clipToCut.mediaItemId,
      sourceUrl: clipToCut.sourceUrl,
      sourceDuration: clipToCut.sourceDuration,
      startTime: clipToCut.startTime,
      inPoint: clipToCut.inPoint,
      outPoint: cutPointInSource,
      volume: clipToCut.volume,
      fadeInDuration: clipToCut.fadeInDuration,
      fadeOutDuration: 0,
    };

    // Créer le second clip (après la coupe)
    const clipB = {
      name: clipToCut.name,
      mediaItemId: clipToCut.mediaItemId,
      sourceUrl: clipToCut.sourceUrl,
      sourceDuration: clipToCut.sourceDuration,
      startTime: currentTime,
      inPoint: cutPointInSource,
      outPoint: clipToCut.outPoint,
      volume: clipToCut.volume,
      fadeInDuration: 0,
      fadeOutDuration: clipToCut.fadeOutDuration,
    };

    // Supprimer l'ancien clip et ajouter les deux nouveaux
    await onDeleteClip(clipToCut.id);
    const newClipA = await onAddClip(trackId, clipA);
    const newClipB = await onAddClip(trackId, clipB);

    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: [...t.clips.filter((c) => c.id !== clipToCut!.id), newClipA, newClipB],
        };
      }),
    }));
    setHasUnsavedChanges(true);
    console.log('[MontageEditor] Clip cut at', currentTime.toFixed(2));
  }, [project.tracks, currentTime, onDeleteClip, onAddClip]);

  // Diviser un clip à une position spécifique (pour le mode rasoir)
  const splitClipAt = useCallback(async (clipId: string, globalTime: number) => {
    let clipToSplit: Clip | null = null;
    let trackId: string | null = null;

    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) {
        clipToSplit = clip;
        trackId = track.id;
        break;
      }
    }

    if (!clipToSplit || !trackId) return;

    const clipDuration = clipToSplit.outPoint - clipToSplit.inPoint;
    const clipEndTime = clipToSplit.startTime + clipDuration;

    // Vérifier que le point de coupe est bien dans le clip
    if (globalTime <= clipToSplit.startTime || globalTime >= clipEndTime) {
      console.log('[MontageEditor] Split point outside clip bounds');
      return;
    }

    // Position relative dans le clip source
    const cutPointInSource = globalTime - clipToSplit.startTime + clipToSplit.inPoint;

    // Créer le premier clip (avant la coupe)
    const clipA = {
      name: clipToSplit.name,
      mediaItemId: clipToSplit.mediaItemId,
      sourceUrl: clipToSplit.sourceUrl,
      sourceDuration: clipToSplit.sourceDuration,
      startTime: clipToSplit.startTime,
      inPoint: clipToSplit.inPoint,
      outPoint: cutPointInSource,
      volume: clipToSplit.volume,
      fadeInDuration: clipToSplit.fadeInDuration,
      fadeOutDuration: 0,
    };

    // Créer le second clip (après la coupe)
    const clipB = {
      name: clipToSplit.name,
      mediaItemId: clipToSplit.mediaItemId,
      sourceUrl: clipToSplit.sourceUrl,
      sourceDuration: clipToSplit.sourceDuration,
      startTime: globalTime,
      inPoint: cutPointInSource,
      outPoint: clipToSplit.outPoint,
      volume: clipToSplit.volume,
      fadeInDuration: 0,
      fadeOutDuration: clipToSplit.fadeOutDuration,
    };

    // Supprimer l'ancien clip et ajouter les deux nouveaux
    await onDeleteClip(clipToSplit.id);
    const newClipA = await onAddClip(trackId, clipA);
    const newClipB = await onAddClip(trackId, clipB);

    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: [...t.clips.filter((c) => c.id !== clipToSplit!.id), newClipA, newClipB],
        };
      }),
    }));
    setHasUnsavedChanges(true);
    console.log('[MontageEditor] Clip split at', globalTime.toFixed(2));
  }, [project.tracks, onDeleteClip, onAddClip]);

  // Gestion de l'enregistrement voix-off
  const handleStartRecording = useCallback(async (trackId: string) => {
    if (isRecording) {
      // Arreter l'enregistrement en cours
      await handleStopRecording();
      return;
    }

    recordingStartTimeRef.current = currentTime;
    recordingStartTimestampRef.current = Date.now();
    setRecordingTrackId(trackId);
    await startRecording();

    console.log('[MontageEditor] Recording started on track', trackId, 'at', currentTime.toFixed(2));
  }, [isRecording, currentTime, startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording || !recordingTrackId) return;

    const blob = await stopRecording();
    const recordingDuration = Math.max(0.1, (Date.now() - recordingStartTimestampRef.current) / 1000);

    // Verifier que le blob n'est pas vide
    if (blob.size === 0) {
      console.error('[MontageEditor] Recording blob is empty');
      setRecordingTrackId(null);
      return;
    }

    // Creer une URL temporaire pour le blob
    const url = URL.createObjectURL(blob);

    try {
      // Creer un nouveau clip avec l'enregistrement
      // Note: En production, on uploaderait vers S3 et utiliserait l'URL S3
      const newClip = await onAddClip(recordingTrackId, {
        name: `Enregistrement ${new Date().toLocaleTimeString()}`,
        sourceUrl: url,
        sourceDuration: recordingDuration,
        startTime: recordingStartTimeRef.current,
        inPoint: 0,
        outPoint: recordingDuration,
        volume: 1,
        fadeInDuration: 0,
        fadeOutDuration: 0,
      });

      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === recordingTrackId ? { ...t, clips: [...t.clips, newClip] } : t
        ),
      }));

      setHasUnsavedChanges(true);
      console.log('[MontageEditor] Recording stopped, clip created with duration', recordingDuration.toFixed(2));
    } catch (error) {
      console.error('[MontageEditor] Failed to create clip from recording:', error);
      // Liberer l'URL du blob en cas d'erreur
      URL.revokeObjectURL(url);
    } finally {
      setRecordingTrackId(null);
    }
  }, [isRecording, recordingTrackId, stopRecording, onAddClip]);

  // Gestion de l'import de fichier local
  const handleImportFile = useCallback(async (file: File, fileDuration: number, trackId: string) => {
    // Creer une URL temporaire pour le fichier
    const url = URL.createObjectURL(file);

    // Determiner la position de depart
    // Si timeline vide, placer a 0, sinon a la position de la playhead
    const timelineEmpty = isTimelineEmpty();
    const startTime = timelineEmpty ? 0 : currentTime;

    try {
      const newClip = await onAddClip(trackId, {
        name: file.name.replace(/\.[^/.]+$/, ''), // Nom sans extension
        sourceUrl: url,
        sourceDuration: fileDuration,
        startTime,
        inPoint: 0,
        outPoint: fileDuration,
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
      console.log('[MontageEditor] File imported:', file.name, 'on track:', trackId, 'duration:', fileDuration.toFixed(2));
    } catch (error) {
      console.error('[MontageEditor] Failed to import file:', error);
      URL.revokeObjectURL(url);
    }
  }, [currentTime, isTimelineEmpty, onAddClip]);

  // Gestion de l'import depuis la mediatheque
  const handleImportFromLibrary = useCallback(async (
    mediaItem: { id: string; title: string; duration: number | null; s3Url: string },
    trackId: string
  ) => {
    // Determiner la position de depart
    const timelineEmpty = isTimelineEmpty();
    const startTime = timelineEmpty ? 0 : currentTime;
    const itemDuration = mediaItem.duration || 0;

    try {
      const newClip = await onAddClip(trackId, {
        name: mediaItem.title,
        mediaItemId: mediaItem.id,
        sourceUrl: mediaItem.s3Url,
        sourceDuration: itemDuration,
        startTime,
        inPoint: 0,
        outPoint: itemDuration,
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
      console.log('[MontageEditor] Media imported:', mediaItem.title, 'on track:', trackId);
    } catch (error) {
      console.error('[MontageEditor] Failed to import from library:', error);
    }
  }, [currentTime, isTimelineEmpty, onAddClip]);

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
          // Effacer aussi la sélection et les points In/Out
          setSelectedClipId(null);
          clearInOutPoints();
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
        case 'KeyI':
          // Définir le point In à la position actuelle
          e.preventDefault();
          setInPoint(currentTime);
          console.log('[MontageEditor] In point set at', currentTime.toFixed(2));
          break;
        case 'KeyO':
          // Définir le point Out à la position actuelle
          e.preventDefault();
          setOutPoint(currentTime);
          console.log('[MontageEditor] Out point set at', currentTime.toFixed(2));
          break;
        case 'KeyX':
          // Couper : si In/Out définis, supprimer la région, sinon couper à la playhead
          e.preventDefault();
          if (inPoint !== null && outPoint !== null) {
            deleteInOutRegion();
          } else {
            cutAtPlayhead();
          }
          break;
        case 'KeyR':
          // Toggle mode rasoir
          e.preventDefault();
          setEditMode((mode) => (mode === 'razor' ? 'select' : 'razor'));
          break;
        case 'ArrowUp':
          // Shift + ArrowUp : augmenter le volume du clip selectionne
          if (e.shiftKey && selectedClipId) {
            e.preventDefault();
            // Trouver le clip selectionne pour obtenir son volume actuel
            for (const track of project.tracks) {
              const clip = track.clips.find((c) => c.id === selectedClipId);
              if (clip) {
                const newVolume = Math.min(2, (clip.volume ?? 1) + 0.1); // +~1dB
                handleClipVolumeChange(selectedClipId, newVolume);
                break;
              }
            }
          }
          break;
        case 'ArrowDown':
          // Shift + ArrowDown : diminuer le volume du clip selectionne
          if (e.shiftKey && selectedClipId) {
            e.preventDefault();
            for (const track of project.tracks) {
              const clip = track.clips.find((c) => c.id === selectedClipId);
              if (clip) {
                const newVolume = Math.max(0, (clip.volume ?? 1) - 0.1); // -~1dB
                handleClipVolumeChange(selectedClipId, newVolume);
                break;
              }
            }
          }
          break;
        case 'Digit0':
        case 'Numpad0':
          // Shift + 0 : reset le volume a 0dB
          if (e.shiftKey && selectedClipId) {
            e.preventDefault();
            handleClipVolumeChange(selectedClipId, 1);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedClipId, currentTime, inPoint, outPoint, cutAtPlayhead, deleteInOutRegion, clearInOutPoints, project.tracks, handleClipVolumeChange]);

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Layer de preview personnalise pour le drag des clips */}
      <ClipDragLayer />

      <div className="h-screen flex flex-col bg-[#0a0a0a] text-white">
        {/* Header minimaliste style DAW */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#2a2a2a]">
          <div className="flex items-center gap-4">
            <Link href="/audio-montage">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-300 hover:text-white hover:bg-[#2a2a2a]">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Retour</span>
              </Button>
            </Link>
            <div className="h-6 w-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-3">
              <h1 className="text-base font-medium text-white">{project.name}</h1>
              {hasUnsavedChanges ? (
                <span className="text-xs text-amber-400 animate-pulse">
                  ● Non sauvegardé
                </span>
              ) : (
                <span className="text-xs text-green-500">
                  ✓ Sauvegardé
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2 text-gray-300 hover:text-white hover:bg-[#2a2a2a]"
            >
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
              className="gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            >
              Exporter
            </Button>
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

        {/* Toolbar d'edition */}
        <Toolbar
          editMode={editMode}
          inPoint={inPoint}
          outPoint={outPoint}
          isRecording={isRecording}
          recordingTrackId={recordingTrackId}
          onEditModeChange={setEditMode}
          onSetInPoint={() => setInPoint(currentTime)}
          onSetOutPoint={() => setOutPoint(currentTime)}
          onClearInOutPoints={clearInOutPoints}
          onCut={inPoint !== null && outPoint !== null ? deleteInOutRegion : cutAtPlayhead}
          onImport={() => setIsImportDialogOpen(true)}
        />

        {/* Minimap - vue d'ensemble */}
        <Minimap
          tracks={enrichedTracks}
          duration={duration}
          currentTime={currentTime}
          viewportStart={scrollLeft / zoom}
          viewportEnd={(scrollLeft + viewportWidth) / zoom}
          zoom={zoom}
          onSeek={handleSeek}
          onScrollChange={setScrollLeft}
        />

        {/* Timeline */}
        <Timeline
          tracks={enrichedTracks}
          zoom={zoom}
          scrollLeft={scrollLeft}
          currentTime={currentTime}
          duration={duration}
          selectedClipId={selectedClipId}
          clipRefs={clipRefsRef.current}
          inPoint={inPoint}
          outPoint={outPoint}
          editMode={editMode}
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
          onClipReady={handleClipReady}
          onSplitClip={splitClipAt}
          onDurationDetected={handleDurationDetected}
          onClipVolumeChange={handleClipVolumeChange}
          onViewportWidthChange={setViewportWidth}
          isRecording={isRecording}
          recordingTrackId={recordingTrackId}
          onStartRecording={handleStartRecording}
        />

        {/* Barre de statut en bas */}
        <StatusBar
          currentTime={currentTime}
          duration={duration}
          trackCount={enrichedTracks.length}
          clipCount={enrichedTracks.reduce((acc, t) => acc + t.clips.length, 0)}
          editMode={editMode}
          zoom={zoom}
        />

        {/* Dialog d'export */}
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          project={project}
          duration={duration}
        />

        {/* Dialog d'import */}
        <ImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          tracks={project.tracks}
          mediaItems={mediaItems}
          onImportFile={handleImportFile}
          onImportFromLibrary={handleImportFromLibrary}
        />
      </div>
    </DndProvider>
  );
}
