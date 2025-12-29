'use client';

import { useRef, useState, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, SNAP_TO_GRID, SNAP_THRESHOLD_PX } from '@/lib/audio-montage/constants';
import { Clip, type ClipRef } from './Clip';
import type { Track as TrackType, ClipWithComputed, DragItem } from '@/lib/audio-montage/types';

// Fonction pour trouver le point de snap le plus proche
function findSnapPoint(
  dragTime: number,
  clipDuration: number,
  allClips: ClipWithComputed[],
  currentClipId: string | undefined,
  pixelsPerSecond: number
): { snappedTime: number; snapIndicator: number | null } {
  // Points de snap: début de la timeline + bords de tous les clips
  const snapPoints: number[] = [0];

  // Ajouter les bords de tous les clips (sauf celui qu'on déplace)
  allClips.forEach((clip) => {
    if (clip.id !== currentClipId) {
      const clipEnd = clip.startTime + clip.duration;
      snapPoints.push(clip.startTime); // Début du clip
      snapPoints.push(clipEnd);        // Fin du clip
    }
  });

  // Positions à vérifier pour le clip qu'on déplace
  const dragStart = dragTime;
  const dragEnd = dragTime + clipDuration;

  let bestSnap: { target: number; offset: number; indicator: number } | null = null;

  // Vérifier le début du clip contre tous les points de snap
  for (const snapPoint of snapPoints) {
    const distanceStart = Math.abs(dragStart - snapPoint);
    const distancePxStart = distanceStart * pixelsPerSecond;

    if (distancePxStart < SNAP_THRESHOLD_PX) {
      const offset = snapPoint - dragStart;
      if (!bestSnap || Math.abs(offset) < Math.abs(bestSnap.offset)) {
        bestSnap = { target: snapPoint, offset, indicator: snapPoint };
      }
    }
  }

  // Vérifier la fin du clip contre tous les points de snap
  for (const snapPoint of snapPoints) {
    const distanceEnd = Math.abs(dragEnd - snapPoint);
    const distancePxEnd = distanceEnd * pixelsPerSecond;

    if (distancePxEnd < SNAP_THRESHOLD_PX) {
      const offset = snapPoint - dragEnd;
      if (!bestSnap || Math.abs(offset) < Math.abs(bestSnap.offset)) {
        bestSnap = { target: snapPoint - clipDuration, offset, indicator: snapPoint };
      }
    }
  }

  if (bestSnap) {
    return {
      snappedTime: dragTime + bestSnap.offset,
      snapIndicator: bestSnap.indicator,
    };
  }

  return { snappedTime: dragTime, snapIndicator: null };
}

// Fonction pour vérifier si un clip peut être placé sans chevauchement
function canPlaceClip(
  trackClips: ClipWithComputed[],
  startTime: number,
  duration: number,
  excludeClipId?: string
): boolean {
  const endTime = startTime + duration;

  for (const clip of trackClips) {
    if (clip.id === excludeClipId) continue;

    const clipEnd = clip.startTime + clip.duration;

    // Vérifier le chevauchement
    const overlaps = startTime < clipEnd && endTime > clip.startTime;

    if (overlaps) {
      return false;
    }
  }

  return true;
}

// Type pour la prévisualisation de drop
export interface DropPreview {
  trackId: string;
  startTime: number;
  duration: number;
  canPlace: boolean;
}

interface TrackProps {
  track: Omit<TrackType, 'clips'> & { clips: ClipWithComputed[] };
  allClips: ClipWithComputed[]; // Tous les clips de toutes les pistes (pour snap inter-pistes)
  zoom: number;
  scrollLeft: number;
  selectedClipId: string | null;
  clipRefs: Map<string, ClipRef | null>;
  editMode: 'select' | 'razor';
  snapIndicator: number | null; // Position du snap indicator à afficher
  dropPreview: DropPreview | null; // Prévisualisation de drop
  onSnapIndicatorChange: (position: number | null) => void;
  onDropPreviewChange: (preview: DropPreview | null) => void;
  onSelectClip: (clipId: string | null) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClip: (clipId: string, trackId: string, startTime: number) => void;
  onTrimClip: (clipId: string, inPoint: number, outPoint: number) => void;
  onAddClip: (trackId: string, item: DragItem, startTime: number) => void;
  onClipReady?: (clipId: string) => void;
  onSplitClip?: (clipId: string, globalTime: number) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void;
  onClipVolumeChange?: (clipId: string, volume: number) => void;
}

export function Track({
  track,
  allClips,
  zoom,
  scrollLeft,
  selectedClipId,
  clipRefs,
  editMode,
  snapIndicator,
  dropPreview,
  onSnapIndicatorChange,
  onDropPreviewChange,
  onSelectClip,
  onDeleteClip,
  onMoveClip,
  onTrimClip,
  onAddClip,
  onClipReady,
  onSplitClip,
  onDurationDetected,
  onClipVolumeChange,
}: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Configuration du drop
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: ['CLIP', 'LIBRARY_ITEM'],
      hover: (item: DragItem, monitor) => {
        // Calculer la position pendant le survol pour montrer le snap indicator et la prévisualisation
        const clientOffset = monitor.getClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        if (!clientOffset || !trackRect) {
          onSnapIndicatorChange(null);
          onDropPreviewChange(null);
          return;
        }

        // Calculer où le curseur se trouve dans la timeline (en tenant compte du scroll)
        // clientOffset.x = position du curseur à l'écran
        // trackRect.left = position du bord gauche de la piste à l'écran
        // scrollLeft = défilement horizontal de la timeline
        const cursorInTimeline = clientOffset.x - trackRect.left + scrollLeft;

        // Pour les clips existants, on veut que le clip suive le curseur de façon intuitive
        // On utilise la position initiale du clip (startTime) stockée dans l'item
        // et le décalage depuis le début du drag
        let targetClipLeft: number;
        if (item.type === 'CLIP' && item.startTime !== undefined) {
          // Calculer le delta de déplacement en pixels depuis le début du drag
          const initialDrag = monitor.getInitialClientOffset();
          if (initialDrag) {
            const deltaX = clientOffset.x - initialDrag.x;
            // La nouvelle position = position originale + delta converti en temps puis en pixels
            const originalLeft = item.startTime * zoom;
            targetClipLeft = originalLeft + deltaX;
          } else {
            // Fallback: placer le bord gauche du clip au curseur
            targetClipLeft = cursorInTimeline;
          }
        } else {
          // Nouvel item depuis la bibliothèque: placer au curseur
          targetClipLeft = cursorInTimeline;
        }

        // Convertir en temps
        let rawTime = targetClipLeft / zoom;
        const clipDuration = item.duration || 0;

        // Trouver le point de snap
        const { snapIndicator: indicator, snappedTime } = findSnapPoint(
          rawTime,
          clipDuration,
          allClips,
          item.type === 'CLIP' ? item.id : undefined,
          zoom
        );

        // Calculer le temps final après snap
        let finalTime = snappedTime;
        if (Math.abs(finalTime - rawTime) < 0.001 && SNAP_TO_GRID > 0) {
          finalTime = Math.round(rawTime / SNAP_TO_GRID) * SNAP_TO_GRID;
        }
        finalTime = Math.max(0, finalTime);

        // Vérifier si le clip peut être placé
        const canPlace = canPlaceClip(
          track.clips,
          finalTime,
          clipDuration,
          item.type === 'CLIP' ? item.id : undefined
        );

        onSnapIndicatorChange(indicator);
        onDropPreviewChange({
          trackId: track.id,
          startTime: finalTime,
          duration: clipDuration,
          canPlace,
        });
      },
      drop: (item: DragItem, monitor) => {
        const clientOffset = monitor.getClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        // Effacer l'indicateur de snap et la prévisualisation
        onSnapIndicatorChange(null);
        onDropPreviewChange(null);

        if (!clientOffset || !trackRect) return;

        // Calculer où le curseur se trouve dans la timeline (en tenant compte du scroll)
        const cursorInTimeline = clientOffset.x - trackRect.left + scrollLeft;

        // Pour les clips existants, on utilise le delta de déplacement depuis la position originale
        let targetClipLeft: number;
        if (item.type === 'CLIP' && item.startTime !== undefined) {
          const initialDrag = monitor.getInitialClientOffset();
          if (initialDrag) {
            const deltaX = clientOffset.x - initialDrag.x;
            const originalLeft = item.startTime * zoom;
            targetClipLeft = originalLeft + deltaX;
          } else {
            targetClipLeft = cursorInTimeline;
          }
        } else {
          targetClipLeft = cursorInTimeline;
        }

        let rawTime = targetClipLeft / zoom;
        const clipDuration = item.duration || 0;

        // Appliquer le magnétisme vers les autres clips
        const { snappedTime } = findSnapPoint(
          rawTime,
          clipDuration,
          allClips,
          item.type === 'CLIP' ? item.id : undefined,
          zoom
        );

        let startTime = snappedTime;

        // Si pas de snap aux clips, appliquer le snap à la grille
        if (Math.abs(startTime - rawTime) < 0.001 && SNAP_TO_GRID > 0) {
          startTime = Math.round(rawTime / SNAP_TO_GRID) * SNAP_TO_GRID;
        }

        startTime = Math.max(0, startTime);

        // Vérifier le chevauchement sur cette piste
        const canPlace = canPlaceClip(
          track.clips,
          startTime,
          clipDuration,
          item.type === 'CLIP' ? item.id : undefined
        );

        if (!canPlace) {
          // Ne pas placer le clip s'il y a chevauchement
          console.log('[Track] Cannot place clip: overlap detected');
          return;
        }

        if (item.type === 'CLIP') {
          // Deplacement d'un clip existant
          onMoveClip(item.id, track.id, startTime);
        } else {
          // Ajout d'un nouvel item depuis la bibliotheque
          onAddClip(track.id, item, startTime);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [track.id, track.clips, zoom, scrollLeft, allClips, onMoveClip, onAddClip, onSnapIndicatorChange, onDropPreviewChange]
  );

  return (
    <div
      ref={(node) => {
        (trackRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        drop(node);
      }}
      className={cn(
        'relative bg-[#0a0a0a] border-b border-[#1a1a1a]',
        isOver && canDrop && 'bg-[#1a1a1a]',
        track.muted && 'opacity-50'
      )}
      style={{ height: TRACK_HEIGHT }}
      onClick={() => onSelectClip(null)}
    >
      {/* Grille de fond subtile */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${zoom * 1}px 100%`,
          backgroundPosition: `${-scrollLeft % (zoom * 1)}px 0`,
        }}
      />

      {/* Séparateur de piste subtil */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2a2a2a]" />

      {/* Clips */}
      {track.clips.map((clip) => (
        <Clip
          key={clip.id}
          ref={(ref) => {
            if (ref) {
              clipRefs.set(clip.id, ref);
            } else {
              clipRefs.delete(clip.id);
            }
          }}
          clip={clip}
          zoom={zoom}
          trackColor={track.color}
          isSelected={selectedClipId === clip.id}
          trackVolume={track.volume}
          trackMuted={track.muted}
          editMode={editMode}
          onSelect={() => onSelectClip(clip.id)}
          onDelete={() => onDeleteClip(clip.id)}
          onMove={(startTime) => onMoveClip(clip.id, track.id, startTime)}
          onTrim={(inPoint, outPoint) => onTrimClip(clip.id, inPoint, outPoint)}
          onClipReady={onClipReady}
          onSplit={onSplitClip ? (globalTime) => onSplitClip(clip.id, globalTime) : undefined}
          onDurationDetected={onDurationDetected}
          onVolumeChange={onClipVolumeChange}
        />
      ))}

      {/* Prévisualisation de drop (fantôme du clip) */}
      {dropPreview && dropPreview.trackId === track.id && dropPreview.duration > 0 && (
        <div
          className={cn(
            'absolute top-1 bottom-1 rounded pointer-events-none transition-all duration-75',
            dropPreview.canPlace
              ? 'bg-[#3B82F6]/30 border-2 border-[#3B82F6] border-dashed'
              : 'bg-red-500/30 border-2 border-red-500 border-dashed'
          )}
          style={{
            left: dropPreview.startTime * zoom,
            width: Math.max(dropPreview.duration * zoom, 20),
          }}
        >
          {/* Ligne de position précise à gauche */}
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 w-0.5',
              dropPreview.canPlace ? 'bg-[#3B82F6]' : 'bg-red-500'
            )}
          />
        </div>
      )}

      {/* Indicateur de drop global sur la piste */}
      {isOver && canDrop && !dropPreview && (
        <div className="absolute inset-0 border-2 border-dashed border-[#3B82F6] rounded pointer-events-none bg-[#3B82F6]/5" />
      )}
    </div>
  );
}
