'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
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

// AudioContext partage pour eviter les limitations du navigateur
// IMPORTANT: Ne pas creer avant une interaction utilisateur
let sharedAudioContext: AudioContext | null = null;
let audioContextInitPromise: Promise<AudioContext> | null = null;

// Cette fonction DOIT etre appelee suite a un geste utilisateur (click, etc.)
async function getOrCreateAudioContext(): Promise<AudioContext> {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume();
    }
    return sharedAudioContext;
  }

  if (audioContextInitPromise) {
    return audioContextInitPromise;
  }

  audioContextInitPromise = new Promise((resolve) => {
    sharedAudioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    resolve(sharedAudioContext);
  });

  return audioContextInitPromise;
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

  // Fonction pour initialiser peaks.js (appelee apres interaction utilisateur)
  const initPeaks = useCallback(async () => {
    const container = containerRef.current;
    const audioElement = audioRef.current;
    if (!container || !audioElement || !audioUrl || width <= 0) return;

    // Verifier si le conteneur est visible et a des dimensions
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn(`[ClipWaveform ${clipId}] Container has no dimensions`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Detruire l'instance precedente si elle existe
      if (peaksRef.current) {
        try {
          peaksRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying peaks:', e);
        }
        peaksRef.current = null;
      }

      // Charger l'audio d'abord
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

      // Import dynamique de peaks.js (client-only)
      const PeaksModule = await import('peaks.js');
      const Peaks = PeaksModule.default;

      // Calculer le niveau de zoom base sur la duree visible et la largeur
      const visibleDuration = outPoint - inPoint;
      const samplesPerPixel = Math.max(256, Math.floor((visibleDuration * 44100) / width));

      // Obtenir ou creer l'AudioContext (OK car appele suite a un click)
      const audioContext = await getOrCreateAudioContext();

      const options = {
        zoomview: {
          container: container,
          waveformColor: color + 'B3', // Ajouter transparence
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
        logger: () => {}, // Silencieux
      };

      // Initialiser peaks.js
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

          // Zoomer sur la portion visible (inPoint -> outPoint)
          const view = peaks.views.getView('zoomview');
          if (view) {
            view.setStartTime(inPoint);
          }
        }

        setIsLoading(false);
      });

    } catch (err) {
      console.error(`Error loading waveform for clip ${clipId}:`, err);
      setError('Erreur chargement');
      setIsLoading(false);
    }
  }, [audioUrl, clipId, color, inPoint, outPoint, width]);

  // Activer les waveforms apres un click utilisateur
  const handleActivate = useCallback(() => {
    if (!userActivated) {
      setUserActivated(true);
    }
  }, [userActivated]);

  // Initialiser peaks.js quand userActivated devient true
  useEffect(() => {
    if (userActivated && !peaksLoaded && !isLoading) {
      initPeaks();
    }
  }, [userActivated, peaksLoaded, isLoading, initPeaks]);

  // Cleanup
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

  // Mettre a jour la vue quand inPoint/outPoint changent
  useEffect(() => {
    if (peaksRef.current) {
      const view = peaksRef.current.views.getView('zoomview');
      if (view) {
        view.setStartTime(inPoint);
      }
    }
  }, [inPoint]);

  // Generer les barres du faux waveform une seule fois
  const [fakeBars] = useState(() =>
    Array.from({ length: Math.max(1, Math.floor(width / 4)) }).map(() =>
      20 + Math.random() * 80
    )
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded cursor-pointer',
        className
      )}
      style={{ width, height }}
      onClick={handleActivate}
      title={!userActivated ? 'Cliquez pour afficher la waveform' : undefined}
    >
      {/* Element audio cache pour peaks.js */}
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

      {/* Fallback visuel si pas de waveform (waveform statique) */}
      {!isLoading && !error && !peaksLoaded && (
        <div
          className="absolute inset-0 flex items-center"
          style={{ backgroundColor: color + '20' }}
        >
          {/* Faux waveform minimaliste */}
          <div className="w-full h-full flex items-center justify-around px-0.5">
            {fakeBars.map((h, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full"
                style={{
                  backgroundColor: color,
                  height: `${h}%`,
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
