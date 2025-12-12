'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Track as TrackType, ClipWithComputed } from '@/lib/audio-montage/types';

interface MinimapProps {
  tracks: (TrackType & { clips: ClipWithComputed[] })[];
  duration: number;
  currentTime: number;
  viewportStart: number; // scrollLeft / zoom = temps de début visible
  viewportEnd: number;   // (scrollLeft + viewportWidth) / zoom = temps de fin visible
  zoom: number;
  onSeek: (time: number) => void;
  onScrollChange: (scrollLeft: number) => void;
}

const MINIMAP_HEIGHT = 48;
const TRACK_HEIGHT_MINI = 12;

// Générateur pseudo-aléatoire déterministe basé sur une seed
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Convertir une string en nombre pour la seed
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Générer des données de waveform stylisées pour un clip
function generateMiniWaveform(clipId: string, numSamples: number): number[] {
  const random = seededRandom(stringToSeed(clipId));
  const samples: number[] = [];

  // Créer une forme d'onde avec des variations naturelles
  let currentAmplitude = 0.5;
  for (let i = 0; i < numSamples; i++) {
    // Variation lente (enveloppe)
    const envelopeNoise = (random() - 0.5) * 0.1;
    currentAmplitude = Math.max(0.2, Math.min(0.9, currentAmplitude + envelopeNoise));

    // Variation rapide (détail)
    const detail = random() * 0.3;
    const sample = currentAmplitude * (0.7 + detail);

    samples.push(sample);
  }

  return samples;
}

export function Minimap({
  tracks,
  duration,
  currentTime,
  viewportStart,
  viewportEnd,
  zoom,
  onSeek,
  onScrollChange,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // État pour le drag du viewport
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  // Dessiner la minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = MINIMAP_HEIGHT;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Fond de la minimap
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Bordure en bas
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    // Si pas de durée, ne rien dessiner
    if (duration <= 0) return;

    const pixelsPerSecond = width / Math.max(duration, 1);

    // Dessiner les clips de chaque piste
    const trackCount = tracks.length;
    const trackHeightMini = Math.min(TRACK_HEIGHT_MINI, (height - 8) / Math.max(trackCount, 1));
    const startY = 4;

    tracks.forEach((track, trackIndex) => {
      const y = startY + trackIndex * (trackHeightMini + 2);

      // Fond de piste très subtil
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, y, width, trackHeightMini);

      // Dessiner chaque clip avec waveform
      track.clips.forEach((clip) => {
        const clipX = clip.startTime * pixelsPerSecond;
        const clipDuration = clip.outPoint - clip.inPoint;
        const clipWidth = Math.max(clipDuration * pixelsPerSecond, 2);

        // Fond du clip (plus sombre)
        ctx.fillStyle = `${track.color}40`;
        ctx.fillRect(clipX, y + 1, clipWidth, trackHeightMini - 2);

        // Dessiner la waveform
        const numSamples = Math.max(Math.floor(clipWidth / 2), 4);
        const waveformData = generateMiniWaveform(clip.id, numSamples);
        const barWidth = clipWidth / numSamples;
        const centerY = y + trackHeightMini / 2;
        const maxAmplitude = (trackHeightMini - 4) / 2;

        ctx.fillStyle = track.color;

        waveformData.forEach((sample, i) => {
          const barX = clipX + i * barWidth;
          const barHeight = sample * maxAmplitude * 2;
          const barY = centerY - barHeight / 2;
          ctx.fillRect(barX, barY, Math.max(barWidth - 0.5, 1), barHeight);
        });
      });
    });

    // Rectangle de viewport (zone visible)
    const viewportX = viewportStart * pixelsPerSecond;
    const viewportW = Math.max((viewportEnd - viewportStart) * pixelsPerSecond, 20);

    // Zone hors viewport assombrie
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, viewportX, height);
    ctx.fillRect(viewportX + viewportW, 0, width - viewportX - viewportW, height);

    // Bordure du viewport
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX + 1, 1, viewportW - 2, height - 2);

    // Poignées de resize du viewport (coins)
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(viewportX, 0, 4, height);
    ctx.fillRect(viewportX + viewportW - 4, 0, 4, height);

    // Curseur de lecture
    const cursorX = currentTime * pixelsPerSecond;
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();

  }, [tracks, duration, currentTime, viewportStart, viewportEnd]);

  // Vérifier si un point X est dans le viewport
  const isInViewport = useCallback((clientX: number): boolean => {
    const container = containerRef.current;
    if (!container || duration <= 0) return false;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = container.clientWidth;
    const pixelsPerSecond = width / duration;

    const viewportX = viewportStart * pixelsPerSecond;
    const viewportW = (viewportEnd - viewportStart) * pixelsPerSecond;

    return x >= viewportX && x <= viewportX + viewportW;
  }, [duration, viewportStart, viewportEnd]);

  // Gestion du mousedown
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = container.clientWidth;

    if (isInViewport(e.clientX)) {
      // Commencer le drag du viewport
      setIsDraggingViewport(true);
      dragStartRef.current = {
        x: e.clientX,
        scrollLeft: viewportStart * zoom, // Convertir temps en pixels
      };
    } else {
      // Clic en dehors du viewport : centrer la vue sur ce point et seek
      const time = (x / width) * duration;
      const clampedTime = Math.max(0, Math.min(duration, time));

      // Centrer le viewport sur le point cliqué
      const viewportDuration = viewportEnd - viewportStart;
      const newViewportStart = clampedTime - viewportDuration / 2;

      // Calculer le max scroll basé sur la vraie largeur du viewport timeline
      const viewportWidthPixels = viewportDuration * zoom;
      const maxScrollLeft = Math.max(0, duration * zoom - viewportWidthPixels);
      const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, newViewportStart * zoom));

      onScrollChange(clampedScrollLeft);

      // Seek à cette position
      onSeek(clampedTime);
    }
  }, [duration, zoom, viewportStart, viewportEnd, isInViewport, onSeek, onScrollChange]);

  // Gestion du mousemove
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingViewport || !dragStartRef.current) return;

    const container = containerRef.current;
    if (!container || duration <= 0) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const width = container.clientWidth;
    const pixelsPerSecond = width / duration;

    // Convertir le delta en temps puis en scrollLeft
    const deltaTime = deltaX / pixelsPerSecond;
    const newScrollLeft = dragStartRef.current.scrollLeft + deltaTime * zoom;

    // Calculer le max scroll basé sur la vraie largeur du viewport timeline
    const viewportDuration = viewportEnd - viewportStart;
    const viewportWidthPixels = viewportDuration * zoom;
    const maxScrollLeft = Math.max(0, duration * zoom - viewportWidthPixels);
    const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));

    onScrollChange(clampedScrollLeft);
  }, [isDraggingViewport, duration, zoom, viewportStart, viewportEnd, onScrollChange]);

  // Gestion du mouseup
  const handleMouseUp = useCallback(() => {
    setIsDraggingViewport(false);
    dragStartRef.current = null;
  }, []);

  // Gestion du mouseleave
  const handleMouseLeave = useCallback(() => {
    if (isDraggingViewport) {
      setIsDraggingViewport(false);
      dragStartRef.current = null;
    }
  }, [isDraggingViewport]);

  // Clic simple (sans drag) pour seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Si on vient de drag, ne pas seek
    if (isDraggingViewport) return;

    const container = containerRef.current;
    if (!container || duration <= 0) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = container.clientWidth;
    const time = (x / width) * duration;

    onSeek(Math.max(0, Math.min(duration, time)));
  }, [isDraggingViewport, duration, onSeek]);

  return (
    <div
      ref={containerRef}
      className="w-full bg-[#0a0a0a] border-b border-[#2a2a2a]"
      style={{ height: MINIMAP_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        className={isDraggingViewport ? 'cursor-grabbing' : 'cursor-pointer'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
