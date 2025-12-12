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

    // Fond noir
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);

    // Bordure en bas
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    const { major, minor } = getTickInterval(zoom);

    // Calculer les temps visibles
    const startTime = Math.floor(scrollLeft / zoom / minor) * minor;
    const endTime = Math.ceil((scrollLeft + viewportWidth) / zoom / minor) * minor;

    ctx.font = '10px "SF Mono", Monaco, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let time = startTime; time <= endTime; time += minor) {
      const x = time * zoom - scrollLeft;

      if (x < -10 || x > width + 10) continue;

      const isMajor = time % major === 0;

      // Couleurs des ticks - gris pour thème sombre
      ctx.strokeStyle = isMajor ? '#4a4a4a' : '#2a2a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 12 : 20);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        // Texte en gris clair
        ctx.fillStyle = '#888888';
        ctx.fillText(formatTime(time), x, 2);
      }
    }

    // Curseur de lecture - Bleu vif
    const cursorX = currentTime * zoom - scrollLeft;
    if (cursorX >= 0 && cursorX <= width) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();

      // Triangle en haut - bleu
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(cursorX - 6, 0);
      ctx.lineTo(cursorX + 6, 0);
      ctx.lineTo(cursorX, 10);
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
      className="cursor-pointer bg-[#111111]"
      onClick={handleClick}
      style={{ height: TIMELINE_RULER_HEIGHT }}
    />
  );
}
