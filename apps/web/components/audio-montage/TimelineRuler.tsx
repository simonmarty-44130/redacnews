'use client';

import { useRef, useEffect } from 'react';
import { TIMELINE_RULER_HEIGHT } from '@/lib/audio-montage/constants';

interface TimelineRulerProps {
  zoom: number; // pixels par seconde
  scrollLeft: number;
  viewportWidth: number;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TimelineRuler({
  zoom,
  scrollLeft,
  viewportWidth,
  duration,
  currentTime,
  onSeek,
}: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculer l'intervalle des marques en fonction du zoom
  const getTickInterval = (zoom: number): { major: number; minor: number } => {
    if (zoom >= 150) return { major: 1, minor: 0.1 };
    if (zoom >= 75) return { major: 5, minor: 1 };
    if (zoom >= 30) return { major: 10, minor: 2 };
    if (zoom >= 15) return { major: 30, minor: 5 };
    return { major: 60, minor: 10 };
  };

  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = viewportWidth;
    const height = TIMELINE_RULER_HEIGHT;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Border bottom
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    const { major, minor } = getTickInterval(zoom);

    // Calculer les temps visibles
    const startTime = Math.floor(scrollLeft / zoom / minor) * minor;
    const endTime = Math.ceil((scrollLeft + viewportWidth) / zoom / minor) * minor;

    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let time = startTime; time <= endTime; time += minor) {
      const x = time * zoom - scrollLeft;

      if (x < -10 || x > width + 10) continue;

      const isMajor = time % major === 0;

      ctx.strokeStyle = isMajor ? '#94a3b8' : '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 8 : 16);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#64748b';
        ctx.fillText(formatTime(time), x, 2);
      }
    }

    // Curseur de lecture
    const cursorX = currentTime * zoom - scrollLeft;
    if (cursorX >= 0 && cursorX <= width) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();

      // Triangle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(cursorX - 6, 0);
      ctx.lineTo(cursorX + 6, 0);
      ctx.lineTo(cursorX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [zoom, scrollLeft, viewportWidth, duration, currentTime]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const time = x / zoom;
    onSeek(Math.max(0, time));
  };

  return (
    <canvas
      ref={canvasRef}
      className="cursor-pointer"
      onClick={handleClick}
      style={{ height: TIMELINE_RULER_HEIGHT }}
    />
  );
}
