'use client';

import React, { useRef, useCallback, useMemo } from 'react';
import { generateTimelineMarkers, timeToPixels, pixelsToTime } from '../utils/time-format';
import { EDITOR_THEME, DEFAULTS } from '../constants/shortcuts';

interface TimelineProps {
  duration: number;
  currentTime: number;
  zoom: number; // pixels per second
  scrollLeft: number;
  selection?: { start: number; end: number } | null;
  markers?: { id: string; time: number; label: string; color?: string }[];
  onSeek: (time: number) => void;
  onSelectionChange?: (start: number, end: number) => void;
  theme?: 'light' | 'dark';
  className?: string;
}

export function Timeline({
  duration,
  currentTime,
  zoom,
  scrollLeft,
  selection,
  markers = [],
  onSeek,
  onSelectionChange,
  theme = 'dark',
  className = '',
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const selectionStartRef = useRef<number | null>(null);

  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  // Generate timeline markers
  const timelineMarkers = useMemo(() => {
    if (!containerRef.current) return [];
    const viewportWidth = containerRef.current.clientWidth || 1000;
    return generateTimelineMarkers(duration, zoom, viewportWidth);
  }, [duration, zoom]);

  // Calculate total width
  const totalWidth = duration * zoom;

  // Convert client X to time
  const clientXToTime = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.min(pixelsToTime(x, zoom), duration));
    },
    [scrollLeft, zoom, duration]
  );

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) return;
      const time = clientXToTime(e.clientX);
      onSeek(time);
    },
    [clientXToTime, onSeek]
  );

  // Handle mouse down for selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      if (!onSelectionChange) return;

      isDraggingRef.current = true;
      selectionStartRef.current = clientXToTime(e.clientX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current || selectionStartRef.current === null) return;

        const endTime = clientXToTime(moveEvent.clientX);
        const start = Math.min(selectionStartRef.current, endTime);
        const end = Math.max(selectionStartRef.current, endTime);

        if (end - start > 0.01) {
          onSelectionChange(start, end);
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        selectionStartRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [clientXToTime, onSelectionChange]
  );

  return (
    <div
      ref={containerRef}
      className={`relative h-8 overflow-hidden cursor-pointer ${className}`}
      style={{ backgroundColor: colors.surface }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Timeline ruler */}
      <div
        className="absolute top-0 left-0 h-full"
        style={{
          width: totalWidth,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {/* Time markers */}
        {timelineMarkers.map((marker, index) => {
          const x = timeToPixels(marker.time, zoom);
          return (
            <div
              key={`${marker.time}-${index}`}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: x }}
            >
              {/* Tick mark */}
              <div
                className={`w-px ${marker.major ? 'h-3' : 'h-2'}`}
                style={{ backgroundColor: colors.textMuted }}
              />
              {/* Label (only for major ticks) */}
              {marker.major && (
                <span
                  className="text-[10px] mt-0.5 whitespace-nowrap"
                  style={{ color: colors.textMuted }}
                >
                  {marker.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Selection overlay */}
        {selection && selection.end > selection.start && (
          <div
            className="absolute top-0 h-full"
            style={{
              left: timeToPixels(selection.start, zoom),
              width: timeToPixels(selection.end - selection.start, zoom),
              backgroundColor: colors.selection,
            }}
          />
        )}

        {/* Markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute top-0 h-full w-0.5"
            style={{
              left: timeToPixels(marker.time, zoom),
              backgroundColor: marker.color || colors.cursor,
            }}
            title={marker.label}
          />
        ))}

        {/* Playhead / Current time cursor */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{
            left: timeToPixels(currentTime, zoom),
            backgroundColor: colors.playhead,
            boxShadow: `0 0 4px ${colors.playhead}`,
          }}
        >
          {/* Playhead head */}
          <div
            className="absolute -top-1 -left-1.5 w-3 h-3"
            style={{
              backgroundColor: colors.playhead,
              clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)',
            }}
          />
        </div>
      </div>

      {/* Border bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ backgroundColor: colors.border }}
      />
    </div>
  );
}

// ============ Waveform Display Component ============

interface WaveformDisplayProps {
  duration: number;
  zoom: number;
  scrollLeft: number;
  currentTime: number;
  selection?: { start: number; end: number } | null;
  theme?: 'light' | 'dark';
  className?: string;
  children?: React.ReactNode;
}

export function WaveformContainer({
  duration,
  zoom,
  scrollLeft,
  currentTime,
  selection,
  theme = 'dark',
  className = '',
  children,
}: WaveformDisplayProps) {
  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;
  const totalWidth = duration * zoom;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Waveform container (will hold waveform-playlist) */}
      <div
        className="absolute top-0 left-0 h-full"
        style={{
          width: totalWidth,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {/* Selection overlay */}
        {selection && selection.end > selection.start && (
          <div
            className="absolute top-0 h-full pointer-events-none"
            style={{
              left: timeToPixels(selection.start, zoom),
              width: timeToPixels(selection.end - selection.start, zoom),
              backgroundColor: colors.selection,
              zIndex: 10,
            }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-px pointer-events-none"
          style={{
            left: timeToPixels(currentTime, zoom),
            backgroundColor: colors.playhead,
            boxShadow: `0 0 4px ${colors.playhead}`,
            zIndex: 20,
          }}
        />

        {/* Children (waveform-playlist element) */}
        {children}
      </div>
    </div>
  );
}
