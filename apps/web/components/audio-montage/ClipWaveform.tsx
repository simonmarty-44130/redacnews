'use client';

import { useRef, useEffect, useState, memo } from 'react';
import { cn } from '@/lib/utils';

interface ClipWaveformProps {
  audioUrl: string;
  clipId: string;
  color?: string;
  inPoint: number;
  outPoint: number;
  width: number;
  height?: number;
  className?: string;
}

export const ClipWaveform = memo(function ClipWaveform({
  audioUrl,
  clipId,
  color = '#3B82F6',
  inPoint,
  outPoint,
  width,
  height = 64,
  className,
}: ClipWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);

  // Charger et analyser l'audio pour générer les données de waveform
  // IMPORTANT: Utilise OfflineAudioContext pour éviter le blocage Chrome
  useEffect(() => {
    if (!audioUrl || width <= 0) return;

    let isMounted = true;
    const controller = new AbortController();

    const loadWaveform = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Charger le fichier audio
        const response = await fetch(audioUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();

        if (!isMounted) return;

        // Utiliser OfflineAudioContext pour décoder l'audio
        // Cela n'a PAS besoin de geste utilisateur (contrairement à AudioContext)
        // On crée un contexte temporaire juste pour le décodage
        const tempContext = new OfflineAudioContext(1, 1, 44100);
        const audioBuffer = await tempContext.decodeAudioData(arrayBuffer.slice(0));

        if (!isMounted) return;

        // Extraire les données de waveform
        const channelData = audioBuffer.getChannelData(0);

        // Calculer quels échantillons correspondent à inPoint/outPoint
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(inPoint * sampleRate);
        const endSample = Math.floor(outPoint * sampleRate);
        const samplesInRange = endSample - startSample;

        // Nombre de barres à afficher
        const numBars = Math.max(10, Math.floor(width / 2)); // Une barre tous les 2 pixels, min 10
        const samplesPerBar = Math.max(1, Math.floor(samplesInRange / numBars));

        const bars: number[] = [];
        for (let i = 0; i < numBars; i++) {
          const start = startSample + i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, channelData.length);

          if (start >= channelData.length) {
            bars.push(0);
            continue;
          }

          // Calculer le RMS (Root Mean Square) pour ce segment
          let sum = 0;
          let count = 0;
          for (let j = start; j < end && j < channelData.length; j++) {
            sum += channelData[j] * channelData[j];
            count++;
          }
          
          if (count === 0) {
            bars.push(0);
            continue;
          }

          const rms = Math.sqrt(sum / count);

          // Normaliser entre 0 et 1, puis convertir en pourcentage
          // RMS typique pour l'audio est entre 0 et 0.5
          const normalized = Math.min(1, rms * 3);
          bars.push(normalized * 100);
        }

        if (isMounted) {
          setWaveformData(bars);
          setIsLoading(false);
        }

      } catch (err) {
        if (!isMounted) return;
        if (err instanceof Error && err.name === 'AbortError') return;

        console.error(`[ClipWaveform ${clipId}] Error:`, err);
        setError('Erreur');
        setIsLoading(false);
      }
    };

    loadWaveform();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [audioUrl, clipId, inPoint, outPoint, width]);

  // Dessiner la waveform sur le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurer le canvas pour le DPI de l'écran
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Effacer
    ctx.clearRect(0, 0, width, height);

    // Dessiner les barres
    const barWidth = Math.max(1, (width / waveformData.length) - 1);
    const gap = 1;

    ctx.fillStyle = color;

    waveformData.forEach((value, index) => {
      const barHeight = Math.max(2, (value / 100) * (height * 0.9)); // Min 2px, 90% de la hauteur max
      const x = index * (barWidth + gap);
      const y = (height - barHeight) / 2; // Centré verticalement

      // Dessiner une barre symétrique (haut et bas)
      ctx.fillRect(x, y, barWidth, barHeight);
    });

  }, [waveformData, width, height, color]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded',
        className
      )}
      style={{
        width,
        height,
        backgroundColor: color + '30',
      }}
      ref={containerRef}
    >
      {/* Canvas pour la waveform */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width, height }}
      />

      {/* Chargement */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Erreur */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-white/60">{error}</span>
        </div>
      )}
    </div>
  );
});
