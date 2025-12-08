'use client';

import { useRef, useEffect, useState, memo } from 'react';
import Peaks, { PeaksInstance } from 'peaks.js';
import { cn } from '@/lib/utils';

interface ClipWaveformProps {
  audioUrl: string;
  clipId: string;
  color?: string;
  inPoint: number;      // Point d'entree dans la source (secondes)
  outPoint: number;     // Point de sortie dans la source (secondes)
  width: number;        // Largeur en pixels
  height?: number;      // Hauteur en pixels
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
  const peaksRef = useRef<PeaksInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !audioUrl || width <= 0) return;

    let isMounted = true;

    // Creer un element audio cache
    const audioElement = document.createElement('audio');
    audioElement.crossOrigin = 'anonymous';
    audioElement.preload = 'auto';

    const initPeaks = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Detruire l'instance precedente si elle existe
        if (peaksRef.current) {
          peaksRef.current.destroy();
          peaksRef.current = null;
        }

        // Calculer le niveau de zoom base sur la duree visible et la largeur
        const visibleDuration = outPoint - inPoint;
        const samplesPerPixel = Math.max(128, Math.floor((visibleDuration * 44100) / width));

        const options = {
          zoomview: {
            container: container,
            waveformColor: color + 'B3', // Ajouter transparence
            playedWaveformColor: color,
            axisLabelColor: 'transparent',
            axisGridlineColor: 'transparent',
          },
          overview: undefined,
          mediaElement: audioElement,
          keyboard: false,
          nudgeIncrement: 0.01,
          zoomLevels: [samplesPerPixel],
        };

        // Charger l'audio d'abord
        audioElement.src = audioUrl;

        await new Promise<void>((resolve, reject) => {
          audioElement.onloadedmetadata = () => resolve();
          audioElement.onerror = () => reject(new Error('Failed to load audio'));
          audioElement.load();
        });

        if (!isMounted) return;

        // Initialiser peaks.js
        Peaks.init(options, (err, peaks) => {
          if (!isMounted) return;

          if (err) {
            console.error(`Peaks init error for clip ${clipId}:`, err);
            setError('Erreur chargement waveform');
            setIsLoading(false);
            return;
          }

          if (peaks) {
            peaksRef.current = peaks;

            // Zoomer sur la portion visible (inPoint -> outPoint)
            const view = peaks.views.getView('zoomview');
            if (view) {
              view.setStartTime(inPoint);
            }
          }

          setIsLoading(false);
        });

      } catch (err) {
        if (!isMounted) return;
        console.error(`Error loading waveform for clip ${clipId}:`, err);
        setError('Erreur chargement');
        setIsLoading(false);
      }
    };

    initPeaks();

    return () => {
      isMounted = false;
      if (peaksRef.current) {
        peaksRef.current.destroy();
        peaksRef.current = null;
      }
    };
  }, [audioUrl, clipId, color, inPoint, outPoint, width]);

  // Mettre a jour la vue quand inPoint/outPoint changent
  useEffect(() => {
    if (peaksRef.current) {
      const view = peaksRef.current.views.getView('zoomview');
      if (view) {
        view.setStartTime(inPoint);
      }
    }
  }, [inPoint]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded',
        className
      )}
      style={{ width, height }}
    >
      {/* Container pour peaks.js */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width, height }}
      />

      {/* Etat de chargement */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Erreur */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="text-xs text-white/70">{error}</span>
        </div>
      )}

      {/* Fallback visuel si pas de waveform */}
      {!isLoading && !error && !peaksRef.current && (
        <div
          className="absolute inset-0 flex items-center"
          style={{ backgroundColor: color + '20' }}
        >
          {/* Faux waveform minimaliste */}
          <div className="w-full h-1/2 flex items-end justify-around px-1">
            {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full"
                style={{
                  backgroundColor: color,
                  height: `${20 + Math.random() * 80}%`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
