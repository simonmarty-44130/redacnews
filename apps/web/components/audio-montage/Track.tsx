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

interface TrackProps {
  track: Omit<TrackType, 'clips'> & { clips: ClipWithComputed[] };
  allClips: ClipWithComputed[]; // Tous les clips de toutes les pistes (pour snap inter-pistes)
  zoom: number;
  scrollLeft: number;
  selectedClipId: string | null;
  clipRefs: Map<string, ClipRef | null>;
  editMode: 'select' | 'razor';
  snapIndicator: number | null; // Position du snap indicator à afficher
  onSnapIndicatorChange: (position: number | null) => void;
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
  onSnapIndicatorChange,
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
        // Calculer la position pendant le survol pour montrer le snap indicator
        const clientOffset = monitor.getClientOffset();
        const initialClientOffset = monitor.getInitialClientOffset();
        const initialSourceOffset = monitor.getInitialSourceClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        if (!clientOffset || !trackRect) {
          onSnapIndicatorChange(null);
          return;
        }

        // Pour les clips existants, calculer le decalage entre le point de saisie et le bord gauche du clip
        // Cela permet de deposer le clip exactement ou on le lache, pas ou on l'a saisi
        let dragOffsetX = 0;
        if (item.type === 'CLIP' && initialClientOffset && initialSourceOffset) {
          dragOffsetX = initialClientOffset.x - initialSourceOffset.x;
        }

        const x = clientOffset.x - trackRect.left + scrollLeft - dragOffsetX;
        let rawTime = x / zoom;
        const clipDuration = item.duration || 0;

        // Trouver le point de snap
        const { snapIndicator: indicator } = findSnapPoint(
          rawTime,
          clipDuration,
          allClips,
          item.type === 'CLIP' ? item.id : undefined,
          zoom
        );

        onSnapIndicatorChange(indicator);
      },
      drop: (item: DragItem, monitor) => {
        const clientOffset = monitor.getClientOffset();
        const initialClientOffset = monitor.getInitialClientOffset();
        const initialSourceOffset = monitor.getInitialSourceClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        // Effacer l'indicateur de snap
        onSnapIndicatorChange(null);

        if (!clientOffset || !trackRect) return;

        // Pour les clips existants, calculer le decalage entre le point de saisie et le bord gauche du clip
        let dragOffsetX = 0;
        if (item.type === 'CLIP' && initialClientOffset && initialSourceOffset) {
          dragOffsetX = initialClientOffset.x - initialSourceOffset.x;
        }

        // Calculer le temps de drop en tenant compte du decalage
        const x = clientOffset.x - trackRect.left + scrollLeft - dragOffsetX;
        let rawTime = x / zoom;
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
    [track.id, zoom, scrollLeft, allClips, onMoveClip, onAddClip, onSnapIndicatorChange]
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

      {/* Indicateur de drop */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-[#3B82F6] rounded pointer-events-none bg-[#3B82F6]/5" />
      )}
    </div>
  );
}
