'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { TIMELINE_RULER_HEIGHT } from '@/lib/audio-montage/constants';

interface TimelineRulerProps {
  zoom: number; // pixels par seconde
  scrollLeft: number;
  viewportWidth: number;
  timelineWidth: number; // Largeur totale de la timeline
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TimelineRuler({
  zoom,
  scrollLeft,
  viewportWidth,
  timelineWidth,
  duration,
  currentTime,
  onSeek,
}: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    // Le canvas ne dessine que la portion visible (viewport), pas toute la timeline
    // Le container div parent couvre toute la timeline pour les clics
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

    // Calculer les temps visibles (basé sur scrollLeft)
    const startTime = Math.floor(scrollLeft / zoom / minor) * minor;
    const endTime = Math.ceil((scrollLeft + viewportWidth) / zoom / minor) * minor;

    ctx.font = '10px "SF Mono", Monaco, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let time = startTime; time <= endTime; time += minor) {
      // Position relative au viewport (soustraire scrollLeft pour l'affichage)
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

    // Curseur de lecture - Bleu vif (position relative au viewport)
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

  // Calculer le temps a partir de la position X relative au container
  // Le container couvre maintenant toute la timeline, donc pas besoin d'ajouter scrollLeft
  const getTimeFromX = useCallback((clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, x / zoom);
  }, [zoom]);

  // Gestion du mousedown pour commencer le drag
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    const time = getTimeFromX(e.clientX);
    onSeek(time);
  }, [getTimeFromX, onSeek]);

  // Gestion du mousemove pendant le drag
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const time = getTimeFromX(e.clientX);
    onSeek(time);
  }, [isDragging, getTimeFromX, onSeek]);

  // Gestion du mouseup pour terminer le drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Gestion du mouseleave pour terminer le drag si on sort du canvas
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Gestion globale du mouseup pour le cas ou on relache en dehors
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`${isDragging ? 'cursor-grabbing' : 'cursor-pointer'} bg-[#111111] relative`}
      style={{ height: TIMELINE_RULER_HEIGHT, width: timelineWidth }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Canvas positionné de manière sticky pour suivre le viewport */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none sticky left-0"
        style={{ height: TIMELINE_RULER_HEIGHT }}
      />
    </div>
  );
}
