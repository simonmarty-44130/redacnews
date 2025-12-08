'use client';

import { useRef, useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRACK_HEIGHT, MIN_CLIP_DURATION } from '@/lib/audio-montage/constants';
import type { ClipWithComputed } from '@/lib/audio-montage/types';

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
  onMove,
  onTrim,
}: ClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'left' | 'right' | null>(null);
  const [trimStart, setTrimStart] = useState({ x: 0, inPoint: 0, outPoint: 0 });

  const width = clip.duration * zoom;
  const left = clip.startTime * zoom;

  // Configuration du drag
  const [{ opacity }, drag, preview] = useDrag(
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
        'transition-shadow',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        isDragging && 'cursor-grabbing'
      )}
      style={{
        left,
        width,
        backgroundColor: trackColor,
        opacity,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Waveform placeholder */}
      <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-white/20 to-transparent" />

      {/* Fade in indicator */}
      {clip.fadeInDuration > 0 && (
        <div
          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none"
          style={{ width: clip.fadeInDuration * zoom }}
        />
      )}

      {/* Fade out indicator */}
      {clip.fadeOutDuration > 0 && (
        <div
          className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-black/40 to-transparent pointer-events-none"
          style={{ width: clip.fadeOutDuration * zoom }}
        />
      )}

      {/* Contenu */}
      <div className="relative h-full flex flex-col p-1">
        {/* Header */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <GripVertical className="h-3 w-3 opacity-50 shrink-0" />
            <span className="truncate font-medium">{clip.name}</span>
          </div>
          {isSelected && (
            <button
              className="p-0.5 hover:bg-white/20 rounded shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Duration */}
        <div className="mt-auto text-white/70 text-[10px]">
          {formatDuration(clip.duration)}
        </div>
      </div>

      {/* Poignees de trim */}
      <div
        className={cn(
          'absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize',
          'hover:bg-white/30 active:bg-white/50',
          isTrimming === 'left' && 'bg-white/50'
        )}
        onMouseDown={(e) => handleTrimStart(e, 'left')}
      />
      <div
        className={cn(
          'absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize',
          'hover:bg-white/30 active:bg-white/50',
          isTrimming === 'right' && 'bg-white/50'
        )}
        onMouseDown={(e) => handleTrimStart(e, 'right')}
      />
    </div>
  );
}
