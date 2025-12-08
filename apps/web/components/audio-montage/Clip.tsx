'use client';

import { useRef, useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { X, GripVertical } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, MIN_CLIP_DURATION } from '@/lib/audio-montage/constants';
import type { ClipWithComputed } from '@/lib/audio-montage/types';

// Import dynamique du composant ClipWaveform pour eviter les erreurs SSR avec peaks.js
const ClipWaveform = dynamic(
  () => import('./ClipWaveform').then((mod) => mod.ClipWaveform),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded bg-blue-500/30 animate-pulse" />
    ),
  }
);

interface ClipProps {
  clip: ClipWithComputed;
  zoom: number;
  trackColor: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (startTime: number) => void;
  onTrim: (inPoint: number, outPoint: number) => void;
}

export function Clip({
  clip,
  zoom,
  trackColor,
  isSelected,
  onSelect,
  onDelete,
  onTrim,
}: ClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'left' | 'right' | null>(null);
  const [trimStart, setTrimStart] = useState({ x: 0, inPoint: 0, outPoint: 0 });

  const width = Math.max(clip.duration * zoom, 20); // Minimum 20px de large
  const left = clip.startTime * zoom;
  const clipHeight = TRACK_HEIGHT - 8; // Marge de 4px en haut et en bas

  // Configuration du drag
  const [{ opacity }, drag] = useDrag(
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

  return (
    <div
      ref={(node) => {
        (clipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        drag(node);
      }}
      className={cn(
        'absolute top-1 bottom-1 rounded cursor-grab overflow-hidden',
        'border border-white/20',
        'transition-shadow',
        isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-gray-900',
        isDragging && 'cursor-grabbing'
      )}
      style={{
        left,
        width,
        height: clipHeight,
        opacity,
        // PAS de backgroundColor ici - on laisse ClipWaveform gerer le fond
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Waveform - Couche de fond */}
      <div className="absolute inset-0">
        <ClipWaveform
          audioUrl={clip.sourceUrl}
          clipId={clip.id}
          color={trackColor}
          inPoint={clip.inPoint}
          outPoint={clip.outPoint}
          width={width}
          height={clipHeight}
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
          {isSelected && (
            <button
              className="p-0.5 hover:bg-white/20 rounded shrink-0 pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
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
}
