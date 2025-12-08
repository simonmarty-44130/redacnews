'use client';

import { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
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

// AudioContext partage
let sharedAudioContext: AudioContext | null = null;

async function getOrCreateAudioContext(): Promise<AudioContext> {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume();
    }
    return sharedAudioContext;
  }

  sharedAudioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return sharedAudioContext;
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaksRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peaksLoaded, setPeaksLoaded] = useState(false);
  const [userActivated, setUserActivated] = useState(false);

  // Generer les barres du faux waveform avec une seed basee sur le clipId
  const fakeBars = useMemo(() => {
    const numBars = Math.max(10, Math.floor(width / 3));
    const bars: number[] = [];

    // Utiliser une seed simple basee sur le clipId pour avoir des barres coherentes
    let seed = 0;
    for (let i = 0; i < clipId.length; i++) {
      seed = ((seed << 5) - seed) + clipId.charCodeAt(i);
      seed = seed & seed;
    }

    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff);
    };

    for (let i = 0; i < numBars; i++) {
      // Creer une forme de waveform plus realiste (plus haute au centre)
      const position = i / numBars;
      const centerBoost = 1 - Math.abs(position - 0.5) * 0.5;
      const randomHeight = 20 + seededRandom() * 60 * centerBoost;
      bars.push(randomHeight);
    }

    return bars;
  }, [width, clipId]);

  // Fonction pour initialiser peaks.js
  const initPeaks = useCallback(async () => {
    const container = containerRef.current;
    const audioElement = audioRef.current;
    if (!container || !audioElement || !audioUrl || width <= 0) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn(`[ClipWaveform ${clipId}] Container has no dimensions`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (peaksRef.current) {
        try {
          peaksRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying peaks:', e);
        }
        peaksRef.current = null;
      }

      audioElement.src = audioUrl;

      await new Promise<void>((resolve, reject) => {
        const onLoad = () => {
          audioElement.removeEventListener('loadedmetadata', onLoad);
          audioElement.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          audioElement.removeEventListener('loadedmetadata', onLoad);
          audioElement.removeEventListener('error', onError);
          reject(new Error('Failed to load audio'));
        };
        audioElement.addEventListener('loadedmetadata', onLoad);
        audioElement.addEventListener('error', onError);
        audioElement.load();
      });

      const PeaksModule = await import('peaks.js');
      const Peaks = PeaksModule.default;

      const visibleDuration = outPoint - inPoint;
      const samplesPerPixel = Math.max(256, Math.floor((visibleDuration * 44100) / width));

      const audioContext = await getOrCreateAudioContext();

      const options = {
        zoomview: {
          container: container,
          waveformColor: color,
          playedWaveformColor: color,
          playheadColor: 'transparent',
          playheadTextColor: 'transparent',
          axisLabelColor: 'transparent',
          axisGridlineColor: 'transparent',
          showPlayheadTime: false,
        },
        overview: undefined,
        mediaElement: audioElement,
        webAudio: {
          audioContext: audioContext,
        },
        keyboard: false,
        nudgeIncrement: 0.01,
        zoomLevels: [samplesPerPixel, samplesPerPixel * 2, samplesPerPixel * 4],
        logger: () => {},
      };

      Peaks.init(options, (err: Error | undefined, peaks: any) => {
        if (err) {
          console.error(`Peaks init error for clip ${clipId}:`, err);
          setError('Erreur waveform');
          setIsLoading(false);
          return;
        }

        if (peaks) {
          peaksRef.current = peaks;
          setPeaksLoaded(true);

          const view = peaks.views.getView('zoomview');
          if (view) {
            view.setStartTime(inPoint);
          }
        }

        setIsLoading(false);
      });

    } catch (err) {
      console.error(`Error loading waveform for clip ${clipId}:`, err);
      setError('Erreur');
      setIsLoading(false);
    }
  }, [audioUrl, clipId, color, inPoint, outPoint, width]);

  const handleActivate = useCallback(() => {
    if (!userActivated) {
      setUserActivated(true);
    }
  }, [userActivated]);

  useEffect(() => {
    if (userActivated && !peaksLoaded && !isLoading) {
      initPeaks();
    }
  }, [userActivated, peaksLoaded, isLoading, initPeaks]);

  useEffect(() => {
    return () => {
      if (peaksRef.current) {
        try {
          peaksRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying peaks:', e);
        }
        peaksRef.current = null;
      }
    };
  }, []);

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
        'relative overflow-hidden rounded cursor-pointer',
        className
      )}
      style={{
        width,
        height,
        backgroundColor: color + '40', // Fond semi-transparent de la couleur
      }}
      onClick={handleActivate}
      title={!userActivated ? 'Cliquez pour charger la waveform HD' : undefined}
    >
      {/* Element audio cache */}
      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />

      {/* Container pour peaks.js */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width, height }}
      />

      {/* Chargement */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Erreur */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <span className="text-xs text-white/70">{error}</span>
        </div>
      )}

      {/* Faux waveform si peaks.js pas encore charge */}
      {!isLoading && !error && !peaksLoaded && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {/* Barres de waveform simulees */}
          <div className="w-full h-full flex items-center gap-[1px] px-1">
            {fakeBars.map((h, i) => (
              <div
                key={i}
                className="flex-1 min-w-[1px] rounded-sm"
                style={{
                  backgroundColor: color,
                  height: `${h}%`,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>

          {/* Indicateur "cliquez pour HD" */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
            <span className="text-[10px] text-white/80 font-medium">Cliquez pour HD</span>
          </div>
        </div>
      )}
    </div>
  );
});
