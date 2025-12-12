'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, memo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { cn } from '@/lib/utils';

// Helper pour detecter les erreurs d'abort (normales lors du cleanup)
function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const errorStr = String(error);
  return (
    errorStr.includes('AbortError') ||
    errorStr.includes('aborted') ||
    errorStr.includes('abort') ||
    errorStr.includes('signal is aborted')
  );
}

export interface WaveSurferClipRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekToGlobalTime: (globalTime: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  isReady: () => boolean;
  isPlaying: () => boolean;
}

interface WaveSurferClipProps {
  audioUrl: string;
  clipId: string;
  startTime: number; // Position sur la timeline (secondes)
  inPoint: number;
  outPoint: number;
  volume: number;
  color?: string;
  width: number;
  height?: number;
  onReady?: (clipId: string) => void;
  onFinish?: (clipId: string) => void;
  onError?: (clipId: string, error: string) => void;
}

export const WaveSurferClip = memo(forwardRef<WaveSurferClipRef, WaveSurferClipProps>(
  function WaveSurferClip(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const isReadyRef = useRef(false);
    const isPlayingRef = useRef(false);
    const propsRef = useRef(props);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Garder les props a jour pour les callbacks
    propsRef.current = props;

    // Flag pour eviter les operations apres unmount
    const isMountedRef = useRef(true);
    // Compteur d'instance pour eviter les race conditions
    const instanceIdRef = useRef(0);

    useEffect(() => {
      isMountedRef.current = true;
      instanceIdRef.current += 1;
      const currentInstanceId = instanceIdRef.current;

      if (!containerRef.current || props.width <= 0) return;

      // Nettoyer l'instance precedente si elle existe
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch {
          // Ignorer les erreurs de destruction
        }
        wavesurferRef.current = null;
      }
      isReadyRef.current = false;
      isPlayingRef.current = false;

      setIsLoading(true);
      setHasError(false);

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: props.color || '#3b82f6',
        progressColor: props.color ? `${props.color}cc` : '#1d4ed8',
        height: props.height || 64,
        normalize: true,
        interact: false, // Desactiver l'interaction directe
        cursorWidth: 0, // Pas de curseur - on a un playhead global
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        backend: 'WebAudio', // Utiliser WebAudio pour une meilleure synchronisation
      });

      // Charger l'audio avec gestion d'erreur pour les AbortError
      ws.load(props.audioUrl).catch((error) => {
        // Ignorer les AbortError qui sont normaux lors du cleanup
        if (isAbortError(error)) return;
        // Les autres erreurs seront gerees par l'event 'error'
      });

      ws.on('ready', () => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId) return;
        isReadyRef.current = true;
        setIsLoading(false);
        ws.setVolume(propsRef.current.volume);
        propsRef.current.onReady?.(propsRef.current.clipId);
      });

      ws.on('play', () => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId) return;
        isPlayingRef.current = true;
      });

      ws.on('pause', () => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId) return;
        isPlayingRef.current = false;
      });

      ws.on('finish', () => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId) return;
        isPlayingRef.current = false;
        propsRef.current.onFinish?.(propsRef.current.clipId);
      });

      ws.on('error', (error) => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId) return;
        // Ne pas logger les AbortError qui sont normaux lors du cleanup
        if (isAbortError(error)) return;
        console.error(`[WaveSurferClip ${propsRef.current.clipId}] Error:`, error);
        setIsLoading(false);
        setHasError(true);
        propsRef.current.onError?.(propsRef.current.clipId, String(error));
      });

      wavesurferRef.current = ws;

      return () => {
        isMountedRef.current = false;
        const wsToDestroy = wavesurferRef.current;
        wavesurferRef.current = null;
        isReadyRef.current = false;
        isPlayingRef.current = false;

        if (wsToDestroy) {
          // Utiliser requestAnimationFrame pour un timing de destruction plus propre
          // Cela permet aux operations en cours de se terminer avant la destruction
          requestAnimationFrame(() => {
            try {
              wsToDestroy.destroy();
            } catch {
              // Ignorer les erreurs de destruction - normal en React Strict Mode
            }
          });
        }
      };
    }, [props.audioUrl, props.clipId, props.color, props.height, props.width]);

    // Mettre a jour le volume si change
    useEffect(() => {
      if (wavesurferRef.current && isReadyRef.current) {
        wavesurferRef.current.setVolume(props.volume);
      }
    }, [props.volume]);

    // Exposer les methodes via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        if (wavesurferRef.current && isReadyRef.current) {
          wavesurferRef.current.play();
        }
      },
      pause: () => {
        if (wavesurferRef.current && isReadyRef.current) {
          wavesurferRef.current.pause();
        }
      },
      stop: () => {
        if (wavesurferRef.current && isReadyRef.current) {
          wavesurferRef.current.pause();
          wavesurferRef.current.setTime(propsRef.current.inPoint);
        }
      },
      seekToGlobalTime: (globalTime: number) => {
        if (!wavesurferRef.current || !isReadyRef.current) return;

        // Calculer le temps relatif au clip
        const clipStart = propsRef.current.startTime;
        const clipDuration = propsRef.current.outPoint - propsRef.current.inPoint;
        const clipEnd = clipStart + clipDuration;

        if (globalTime >= clipStart && globalTime < clipEnd) {
          // On est dans ce clip - positionner au bon endroit
          const relativeTime = globalTime - clipStart;
          const audioTime = propsRef.current.inPoint + relativeTime;
          wavesurferRef.current.setTime(audioTime);
        }
      },
      getCurrentTime: () => {
        return wavesurferRef.current?.getCurrentTime() || 0;
      },
      getDuration: () => {
        return wavesurferRef.current?.getDuration() || 0;
      },
      setVolume: (volume: number) => {
        if (wavesurferRef.current) {
          wavesurferRef.current.setVolume(volume);
        }
      },
      isReady: () => isReadyRef.current,
      isPlaying: () => isPlayingRef.current,
    }));

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden rounded',
        )}
        style={{
          width: props.width,
          height: props.height || 64,
          backgroundColor: (props.color || '#3b82f6') + '30',
        }}
      >
        {/* Chargement */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Erreur */}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-white/60">Erreur</span>
          </div>
        )}
      </div>
    );
  }
));
