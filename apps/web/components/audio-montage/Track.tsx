'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, SNAP_TO_GRID, SNAP_THRESHOLD_PX } from '@/lib/audio-montage/constants';

// Constantes pour l'auto-scroll pendant le drag
const AUTO_SCROLL_ZONE = 80; // Zone en pixels depuis le bord qui déclenche l'auto-scroll
const AUTO_SCROLL_SPEED = 15; // Pixels par frame
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

// Constante pour la durée maximale de crossfade autorisée (en secondes)
const MAX_CROSSFADE_DURATION = 5;

// Type pour les informations de chevauchement
interface OverlapInfo {
  clipId: string;
  overlapDuration: number; // Durée du chevauchement
  position: 'before' | 'after'; // Le clip existant est avant ou après le nouveau
}

// Type pour les zones de crossfade à afficher
interface CrossfadeZone {
  startTime: number;
  endTime: number;
  duration: number;
  clip1Id: string;
  clip2Id: string;
}

// Fonction pour détecter les zones de crossfade existantes entre clips
function detectCrossfadeZones(clips: ClipWithComputed[]): CrossfadeZone[] {
  const zones: CrossfadeZone[] = [];

  // Trier les clips par temps de début
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sortedClips.length - 1; i++) {
    const clip1 = sortedClips[i];
    const clip2 = sortedClips[i + 1];

    // Vérifier si les clips se chevauchent
    const clip1End = clip1.startTime + clip1.duration;
    const overlapStart = Math.max(clip1.startTime, clip2.startTime);
    const overlapEnd = Math.min(clip1End, clip2.startTime + clip2.duration);

    if (overlapStart < overlapEnd) {
      // Il y a un chevauchement
      zones.push({
        startTime: overlapStart,
        endTime: overlapEnd,
        duration: overlapEnd - overlapStart,
        clip1Id: clip1.id,
        clip2Id: clip2.id,
      });
    }
  }

  return zones;
}

// Fonction pour vérifier si un clip peut être placé et détecter les chevauchements
function checkClipPlacement(
  trackClips: ClipWithComputed[],
  startTime: number,
  duration: number,
  excludeClipId?: string
): { canPlace: boolean; overlaps: OverlapInfo[] } {
  const endTime = startTime + duration;
  const overlaps: OverlapInfo[] = [];

  for (const clip of trackClips) {
    if (clip.id === excludeClipId) continue;

    const clipEnd = clip.startTime + clip.duration;

    // Vérifier le chevauchement
    const hasOverlap = startTime < clipEnd && endTime > clip.startTime;

    if (hasOverlap) {
      // Calculer la durée du chevauchement
      const overlapStart = Math.max(startTime, clip.startTime);
      const overlapEnd = Math.min(endTime, clipEnd);
      const overlapDuration = overlapEnd - overlapStart;

      // Déterminer si le clip existant est avant ou après
      const position: 'before' | 'after' = clip.startTime < startTime ? 'before' : 'after';

      overlaps.push({
        clipId: clip.id,
        overlapDuration,
        position,
      });
    }
  }

  // Permettre le placement si:
  // - Pas de chevauchement, OU
  // - Chevauchement avec un seul clip ET durée <= MAX_CROSSFADE_DURATION
  const canPlace = overlaps.length === 0 ||
    (overlaps.length === 1 && overlaps[0].overlapDuration <= MAX_CROSSFADE_DURATION);

  return { canPlace, overlaps };
}

// Version simplifiée pour la compatibilité
function canPlaceClip(
  trackClips: ClipWithComputed[],
  startTime: number,
  duration: number,
  excludeClipId?: string
): boolean {
  return checkClipPlacement(trackClips, startTime, duration, excludeClipId).canPlace;
}

// Type pour la prévisualisation de drop
export interface DropPreview {
  trackId: string;
  startTime: number;
  duration: number;
  canPlace: boolean;
}

// Type pour les informations de crossfade
export interface CrossfadeInfo {
  existingClipId: string;
  newClipId: string; // Peut être temporaire pour les nouveaux clips
  overlapDuration: number;
  position: 'before' | 'after'; // Le clip existant est avant ou après le nouveau
}

interface TrackProps {
  track: Omit<TrackType, 'clips'> & { clips: ClipWithComputed[] };
  allClips: ClipWithComputed[]; // Tous les clips de toutes les pistes (pour snap inter-pistes)
  zoom: number;
  scrollLeft: number;
  viewportWidth: number; // Largeur visible de la timeline
  selectedClipId: string | null;
  clipRefs: Map<string, ClipRef | null>;
  editMode: 'select' | 'razor';
  snapIndicator: number | null; // Position du snap indicator à afficher
  dropPreview: DropPreview | null; // Prévisualisation de drop
  onSnapIndicatorChange: (position: number | null) => void;
  onDropPreviewChange: (preview: DropPreview | null) => void;
  onScrollChange: (scrollLeft: number) => void; // Pour l'auto-scroll pendant le drag
  onSelectClip: (clipId: string | null) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClip: (clipId: string, trackId: string, startTime: number) => void;
  onTrimClip: (clipId: string, inPoint: number, outPoint: number) => void;
  onAddClip: (trackId: string, item: DragItem, startTime: number) => void;
  onClipReady?: (clipId: string) => void;
  onSplitClip?: (clipId: string, globalTime: number) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void;
  onClipVolumeChange?: (clipId: string, volume: number) => void;
  onClipFadeChange?: (clipId: string, fadeInDuration: number, fadeOutDuration: number) => void;
  onCrossfade?: (crossfadeInfo: CrossfadeInfo) => void; // Callback pour appliquer le crossfade automatique
}

export function Track({
  track,
  allClips,
  zoom,
  scrollLeft,
  viewportWidth,
  selectedClipId,
  clipRefs,
  editMode,
  snapIndicator,
  dropPreview,
  onSnapIndicatorChange,
  onDropPreviewChange,
  onScrollChange,
  onSelectClip,
  onDeleteClip,
  onMoveClip,
  onTrimClip,
  onAddClip,
  onClipReady,
  onSplitClip,
  onDurationDetected,
  onClipVolumeChange,
  onClipFadeChange,
  onCrossfade,
}: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<'left' | 'right' | null>(null);
  const scrollLeftRef = useRef(scrollLeft);
  const initialScrollLeftRef = useRef<number | null>(null); // Scroll au début du drag

  // Garder scrollLeft à jour dans le ref pour l'animation
  useEffect(() => {
    scrollLeftRef.current = scrollLeft;
  }, [scrollLeft]);

  // Fonction pour démarrer l'auto-scroll
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollRef.current !== null && scrollDirectionRef.current === direction) {
      return; // Déjà en cours dans cette direction
    }

    // Arrêter l'auto-scroll précédent
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
    }

    scrollDirectionRef.current = direction;

    const scroll = () => {
      const currentScroll = scrollLeftRef.current;
      let newScroll: number;

      if (direction === 'left') {
        newScroll = Math.max(0, currentScroll - AUTO_SCROLL_SPEED);
      } else {
        newScroll = currentScroll + AUTO_SCROLL_SPEED;
      }

      if (newScroll !== currentScroll) {
        onScrollChange(newScroll);
      }

      // Continuer l'animation si on n'a pas atteint la limite
      if (direction === 'left' && newScroll > 0) {
        autoScrollRef.current = requestAnimationFrame(scroll);
      } else if (direction === 'right') {
        autoScrollRef.current = requestAnimationFrame(scroll);
      } else {
        autoScrollRef.current = null;
        scrollDirectionRef.current = null;
      }
    };

    autoScrollRef.current = requestAnimationFrame(scroll);
  }, [onScrollChange]);

  // Fonction pour arrêter l'auto-scroll et réinitialiser l'état du drag
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
      scrollDirectionRef.current = null;
    }
    // Réinitialiser le scroll initial du drag
    initialScrollLeftRef.current = null;
  }, []);

  // Nettoyer l'auto-scroll au démontage
  useEffect(() => {
    return () => {
      if (autoScrollRef.current !== null) {
        cancelAnimationFrame(autoScrollRef.current);
      }
    };
  }, []);

  // Détecter les zones de crossfade existantes
  const crossfadeZones = useMemo(() => detectCrossfadeZones(track.clips), [track.clips]);

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
          stopAutoScroll();
          return;
        }

        // Auto-scroll: détecter si le curseur est près des bords de la zone visible
        const cursorXInTrack = clientOffset.x - trackRect.left;
        if (cursorXInTrack < AUTO_SCROLL_ZONE && scrollLeft > 0) {
          // Proche du bord gauche et pas encore au début -> scroll vers la gauche
          startAutoScroll('left');
        } else if (cursorXInTrack > viewportWidth - AUTO_SCROLL_ZONE) {
          // Proche du bord droit -> scroll vers la droite
          startAutoScroll('right');
        } else {
          // Au milieu -> arrêter l'auto-scroll
          stopAutoScroll();
        }

        // Calculer où le curseur se trouve dans la timeline (en tenant compte du scroll)
        // clientOffset.x = position du curseur à l'écran
        // trackRect.left = position du bord gauche de la piste à l'écran
        // scrollLeft = défilement horizontal de la timeline
        const cursorInTimeline = clientOffset.x - trackRect.left + scrollLeft;

        // Pour les clips existants, on veut que le clip suive le curseur de façon intuitive
        // On utilise la position initiale du clip (startTime) stockée dans l'item
        // et le décalage depuis le début du drag + le défilement qui s'est produit
        let targetClipLeft: number;
        if (item.type === 'CLIP' && item.startTime !== undefined) {
          // Mémoriser le scroll au début du drag si pas encore fait
          if (initialScrollLeftRef.current === null) {
            initialScrollLeftRef.current = scrollLeft;
          }

          // Calculer le delta de déplacement en pixels depuis le début du drag
          const initialDrag = monitor.getInitialClientOffset();
          if (initialDrag) {
            const deltaX = clientOffset.x - initialDrag.x;
            // Calculer le delta de scroll depuis le début du drag
            const scrollDelta = scrollLeft - initialScrollLeftRef.current;
            // La nouvelle position = position originale + delta curseur - delta scroll
            // (on soustrait le scrollDelta car quand on scrolle vers la gauche, scrollLeft diminue,
            // et le clip doit aller plus tôt sur la timeline)
            const originalLeft = item.startTime * zoom;
            targetClipLeft = originalLeft + deltaX - scrollDelta;
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
        // Arrêter l'auto-scroll
        stopAutoScroll();

        const clientOffset = monitor.getClientOffset();
        const trackRect = trackRef.current?.getBoundingClientRect();

        // Effacer l'indicateur de snap et la prévisualisation
        onSnapIndicatorChange(null);
        onDropPreviewChange(null);

        if (!clientOffset || !trackRect) return;

        // Calculer où le curseur se trouve dans la timeline (en tenant compte du scroll)
        const cursorInTimeline = clientOffset.x - trackRect.left + scrollLeft;

        // Pour les clips existants, on utilise le delta de déplacement depuis la position originale
        // en tenant compte du scroll qui s'est produit pendant le drag
        let targetClipLeft: number;
        if (item.type === 'CLIP' && item.startTime !== undefined) {
          const initialDrag = monitor.getInitialClientOffset();
          if (initialDrag) {
            const deltaX = clientOffset.x - initialDrag.x;
            // Calculer le delta de scroll depuis le début du drag
            const scrollDelta = initialScrollLeftRef.current !== null
              ? scrollLeft - initialScrollLeftRef.current
              : 0;
            // La nouvelle position = position originale + delta curseur - delta scroll
            const originalLeft = item.startTime * zoom;
            targetClipLeft = originalLeft + deltaX - scrollDelta;
          } else {
            targetClipLeft = cursorInTimeline;
          }
        } else {
          targetClipLeft = cursorInTimeline;
        }

        // Réinitialiser le ref de scroll initial
        initialScrollLeftRef.current = null;

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
        const { canPlace, overlaps } = checkClipPlacement(
          track.clips,
          startTime,
          clipDuration,
          item.type === 'CLIP' ? item.id : undefined
        );

        if (!canPlace) {
          // Ne pas placer le clip s'il y a chevauchement trop important
          console.log('[Track] Cannot place clip: overlap too large or multiple overlaps');
          return;
        }

        // D'abord, déplacer ou ajouter le clip
        if (item.type === 'CLIP') {
          // Deplacement d'un clip existant
          onMoveClip(item.id, track.id, startTime);
        } else {
          // Ajout d'un nouvel item depuis la bibliotheque
          onAddClip(track.id, item, startTime);
        }

        // Ensuite, si il y a un chevauchement autorisé (crossfade), appliquer les fades
        if (overlaps.length === 1 && onCrossfade) {
          const overlap = overlaps[0];
          console.log('[Track] Applying crossfade:', overlap);

          // Le newClipId sera l'ID du clip déplacé ou un ID temporaire pour le nouveau clip
          // Le MontageEditor devra gérer le cas où c'est un nouveau clip
          onCrossfade({
            existingClipId: overlap.clipId,
            newClipId: item.type === 'CLIP' ? item.id : 'NEW_CLIP', // Marqueur spécial pour les nouveaux clips
            overlapDuration: overlap.overlapDuration,
            position: overlap.position,
          });
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [track.id, track.clips, zoom, scrollLeft, viewportWidth, allClips, onMoveClip, onAddClip, onSnapIndicatorChange, onDropPreviewChange, startAutoScroll, stopAutoScroll, onCrossfade]
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
          onFadeChange={onClipFadeChange}
        />
      ))}

      {/* Indicateurs de crossfade - zones où deux clips se chevauchent */}
      {crossfadeZones.map((zone) => (
        <div
          key={`crossfade-${zone.clip1Id}-${zone.clip2Id}`}
          className="absolute top-0 bottom-0 pointer-events-none z-30"
          style={{
            left: zone.startTime * zoom,
            width: Math.max(zone.duration * zoom, 4),
          }}
        >
          {/* Icône/badge de crossfade centré */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div
              className="bg-purple-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-purple-300/50 flex items-center gap-0.5"
              title={`Crossfade: ${zone.duration.toFixed(2)}s`}
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {/* Icône de crossfade - deux lignes qui se croisent */}
                <path d="M2 12 L14 4" strokeLinecap="round" />
                <path d="M2 4 L14 12" strokeLinecap="round" />
              </svg>
              <span>{zone.duration.toFixed(1)}s</span>
            </div>
          </div>
          {/* Zone de mélange avec motif */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `repeating-linear-gradient(
                45deg,
                rgba(168, 85, 247, 0.3),
                rgba(168, 85, 247, 0.3) 2px,
                transparent 2px,
                transparent 6px
              )`,
            }}
          />
          {/* Lignes verticales de délimitation */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-400/60" />
          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-purple-400/60" />
        </div>
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
