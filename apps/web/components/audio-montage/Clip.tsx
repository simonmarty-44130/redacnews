'use client';

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { X, GripVertical, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, MIN_CLIP_DURATION } from '@/lib/audio-montage/constants';
import type { ClipWithComputed } from '@/lib/audio-montage/types';
import { SyncedWaveSurfer } from './SyncedWaveSurfer';
import type { SyncedClipRef } from '@/lib/audio-montage/SyncEngine';

// Ref exposee pour le controle de lecture du clip
// Compatible avec SyncedClipRef du SyncEngine
export interface ClipRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekToGlobalTime: (globalTime: number) => void;
  setVolume: (volume: number) => void;
  isReady: () => boolean;
  isPlaying: () => boolean;
}

interface ClipProps {
  clip: ClipWithComputed;
  zoom: number;
  trackColor: string;
  isSelected: boolean;
  trackVolume: number;
  trackMuted: boolean;
  editMode: 'select' | 'razor';
  onSelect: () => void;
  onDelete: () => void;
  onMove: (startTime: number) => void;
  onTrim: (inPoint: number, outPoint: number) => void;
  onVolumeChange?: (clipId: string, volume: number) => void;
  onClipReady?: (clipId: string) => void;
  onSplit?: (globalTime: number) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void;
}

// Conversion lineaire <-> dB
const linearToDb = (linear: number): number => {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
};

// Formater l'affichage dB
const formatDb = (linear: number): string => {
  const db = linearToDb(linear);
  if (db === -Infinity) return '-∞';
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
};

export const Clip = forwardRef<ClipRef, ClipProps>(function Clip({
  clip,
  zoom,
  trackColor,
  isSelected,
  trackVolume,
  trackMuted,
  editMode,
  onSelect,
  onDelete,
  onTrim,
  onVolumeChange,
  onClipReady,
  onSplit,
  onDurationDetected,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const syncedWaveSurferRef = useRef<SyncedClipRef | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'left' | 'right' | null>(null);
  const [trimStart, setTrimStart] = useState({ x: 0, inPoint: 0, outPoint: 0 });
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // Calculer le volume effectif
  const effectiveVolume = trackMuted ? 0 : trackVolume * clip.volume;

  // Exposer les methodes de controle via ref
  // Compatible avec l'ancienne interface ClipRef
  useImperativeHandle(ref, () => ({
    play: () => syncedWaveSurferRef.current?.play(),
    pause: () => syncedWaveSurferRef.current?.pause(),
    stop: () => syncedWaveSurferRef.current?.stop(),
    seekToGlobalTime: (globalTime: number) => syncedWaveSurferRef.current?.seekTo(globalTime),
    setVolume: (volume: number) => syncedWaveSurferRef.current?.setVolume(volume),
    isReady: () => syncedWaveSurferRef.current?.isReady() || false,
    isPlaying: () => syncedWaveSurferRef.current?.isCurrentlyPlaying() || false,
  }));

  const width = Math.max(clip.duration * zoom, 20); // Minimum 20px de large
  const left = clip.startTime * zoom;
  const clipHeight = TRACK_HEIGHT - 8; // Marge de 4px en haut et en bas

  // Configuration du drag
  const [{ opacity }, drag, dragPreview] = useDrag(
    () => ({
      type: 'CLIP',
      item: () => {
        setIsDragging(true);
        return {
          type: 'CLIP' as const,
          id: clip.id,
          name: clip.name,
          sourceUrl: clip.sourceUrl,
          duration: clip.duration,
          trackId: clip.trackId,
          startTime: clip.startTime,
        };
      },
      end: () => {
        setIsDragging(false);
      },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    [clip]
  );

  // Desactiver la preview HTML5 native qui capture les elements environnants
  // Cela evite le bug ou les controles de piste semblent se deplacer avec le clip
  useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true });
  }, [dragPreview]);

  // Gestion du trim
  const handleTrimStart = (
    e: React.MouseEvent,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsTrimming(side);
    setTrimStart({
      x: e.clientX,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
    });
  };

  useEffect(() => {
    if (!isTrimming) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStart.x;
      const deltaSec = deltaX / zoom;

      if (isTrimming === 'left') {
        const newInPoint = Math.max(
          0,
          Math.min(trimStart.outPoint - MIN_CLIP_DURATION, trimStart.inPoint + deltaSec)
        );
        onTrim(newInPoint, trimStart.outPoint);
      } else {
        const newOutPoint = Math.max(
          trimStart.inPoint + MIN_CLIP_DURATION,
          Math.min(clip.sourceDuration, trimStart.outPoint + deltaSec)
        );
        onTrim(trimStart.inPoint, newOutPoint);
      }
    };

    const handleMouseUp = () => {
      setIsTrimming(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isTrimming, trimStart, zoom, clip.sourceDuration, onTrim]);

  // Formater la duree
  const formatDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Volume du clip (defaut 1 si non defini)
  const clipVolume = clip.volume ?? 1;

  // Handler pour le changement de volume
  const handleVolumeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    onVolumeChange?.(clip.id, newVolume);
  };

  // Handler pour la molette (Shift + molette = ajuster volume)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey && onVolumeChange) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newVolume = Math.max(0, Math.min(2, clipVolume + delta));
      onVolumeChange(clip.id, newVolume);
    }
  };

  // Double-clic sur le volume pour reset a 0 dB
  const handleVolumeDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onVolumeChange?.(clip.id, 1);
  };

  return (
    <div
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        drag(node);
      }}
      className={cn(
        'absolute top-1 bottom-1 rounded overflow-hidden',
        'border border-white/20',
        'transition-shadow',
        isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-gray-900',
        editMode === 'razor' ? 'cursor-crosshair' : 'cursor-grab',
        isDragging && 'cursor-grabbing'
      )}
      style={{
        left,
        width,
        height: clipHeight,
        opacity,
        // PAS de backgroundColor ici - on laisse ClipWaveform gerer le fond
      }}
      onWheel={handleWheel}
      onClick={(e) => {
        e.stopPropagation();

        if (editMode === 'razor' && onSplit) {
          // Mode rasoir : diviser le clip à la position du clic
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickTimeInClip = clickX / zoom;
          const globalTime = clip.startTime + clickTimeInClip;
          onSplit(globalTime);
        } else {
          // Mode sélection normal
          onSelect();
        }
      }}
    >
      {/* SyncedWaveSurfer - Couche de fond avec lecture audio synchronisee */}
      <div className="absolute inset-0">
        <SyncedWaveSurfer
          ref={(instance) => {
            syncedWaveSurferRef.current = instance;
          }}
          clipId={clip.id}
          sourceUrl={clip.sourceUrl}
          sourceDuration={clip.sourceDuration}
          startTime={clip.startTime}
          inPoint={clip.inPoint}
          outPoint={clip.outPoint}
          volume={effectiveVolume}
          clipVolume={clipVolume}
          color={trackColor}
          pixelsPerSecond={zoom}
          height={clipHeight}
          onReady={onClipReady}
          onDurationDetected={onDurationDetected}
        />
      </div>

      {/* Overlay semi-transparent pour le contenu */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />

      {/* Fade in indicator */}
      {clip.fadeInDuration > 0 && (
        <div
          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none"
          style={{ width: Math.max(clip.fadeInDuration * zoom, 8) }}
        />
      )}

      {/* Fade out indicator */}
      {clip.fadeOutDuration > 0 && (
        <div
          className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-black/60 to-transparent pointer-events-none"
          style={{ width: Math.max(clip.fadeOutDuration * zoom, 8) }}
        />
      )}

      {/* Contenu textuel - par-dessus la waveform */}
      <div className="relative h-full flex flex-col p-1 pointer-events-none">
        {/* Header */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-1 min-w-0 pointer-events-auto">
            <GripVertical className="h-3 w-3 opacity-70 shrink-0" />
            <span className="truncate font-medium drop-shadow-md">{clip.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
            {/* Controle de volume */}
            <div
              className="relative"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => !isDraggingVolume && setShowVolumeSlider(false)}
            >
              <div
                className={cn(
                  'flex items-center gap-0.5 px-1 rounded cursor-pointer',
                  clipVolume !== 1 ? 'bg-yellow-600/60 text-yellow-200' : 'hover:bg-white/20'
                )}
                onDoubleClick={handleVolumeDoubleClick}
                title="Shift+molette pour ajuster, double-clic pour reset"
              >
                {clipVolume === 0 ? (
                  <VolumeX className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
                <span className="text-[10px] font-mono w-8 text-right">
                  {formatDb(clipVolume)}
                </span>
              </div>

              {/* Slider au hover */}
              {showVolumeSlider && (
                <div
                  className="absolute top-full right-0 mt-1 bg-gray-900/95 rounded-lg p-2 shadow-xl z-30 border border-white/20"
                  onMouseDown={() => setIsDraggingVolume(true)}
                  onMouseUp={() => setIsDraggingVolume(false)}
                  onMouseLeave={() => setIsDraggingVolume(false)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={clipVolume}
                    onChange={handleVolumeSliderChange}
                    className="w-24 h-2 accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-0.5">
                    <span>-∞</span>
                    <span>0dB</span>
                    <span>+6</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton supprimer */}
            {isSelected && (
              <button
                className="p-0.5 hover:bg-white/20 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Duration - en bas */}
        <div className="mt-auto text-white/80 text-[10px] font-medium drop-shadow-md">
          {formatDuration(clip.duration)}
        </div>
      </div>

      {/* Poignees de trim - interactives */}
      <div
        className={cn(
          'absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-10',
          'hover:bg-white/30 active:bg-white/50',
          'transition-colors',
          isTrimming === 'left' && 'bg-white/50'
        )}
        onMouseDown={(e) => handleTrimStart(e, 'left')}
      />
      <div
        className={cn(
          'absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize z-10',
          'hover:bg-white/30 active:bg-white/50',
          'transition-colors',
          isTrimming === 'right' && 'bg-white/50'
        )}
        onMouseDown={(e) => handleTrimStart(e, 'right')}
      />
    </div>
  );
});
