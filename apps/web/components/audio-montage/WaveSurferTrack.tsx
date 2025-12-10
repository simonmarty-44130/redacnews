'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';

export interface WaveSurferTrackRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  isReady: () => boolean;
}

interface WaveSurferTrackProps {
  url: string;
  clipId: string;
  startTime: number; // Position sur la timeline (secondes)
  inPoint: number;
  outPoint: number;
  volume: number;
  color?: string;
  height?: number;
  onReady?: (clipId: string) => void;
  onFinish?: (clipId: string) => void;
  onError?: (clipId: string, error: string) => void;
}

export const WaveSurferTrack = forwardRef<WaveSurferTrackRef, WaveSurferTrackProps>(
  function WaveSurferTrack(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const isReadyRef = useRef(false);
    const propsRef = useRef(props);

    // Garder les props a jour pour les callbacks
    propsRef.current = props;

    // Cleanup function
    const cleanup = useCallback(() => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch {
          // Ignorer les erreurs de destruction
        }
        wavesurferRef.current = null;
      }
      isReadyRef.current = false;
    }, []);

    useEffect(() => {
      if (!containerRef.current) return;

      // Nettoyer l'instance precedente si elle existe
      cleanup();

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: props.color || '#3b82f6',
        progressColor: props.color ? `${props.color}99` : '#1d4ed8',
        height: props.height || 64,
        normalize: true,
        interact: false, // Desactiver l'interaction directe - on gere via MultiTrackEngine
        cursorWidth: 0, // Pas de curseur - on a un playhead global
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
      });

      ws.load(props.url);

      ws.on('ready', () => {
        isReadyRef.current = true;
        ws.setVolume(propsRef.current.volume);
        propsRef.current.onReady?.(propsRef.current.clipId);
      });

      ws.on('finish', () => {
        propsRef.current.onFinish?.(propsRef.current.clipId);
      });

      ws.on('error', (error) => {
        console.error(`[WaveSurferTrack ${propsRef.current.clipId}] Error:`, error);
        propsRef.current.onError?.(propsRef.current.clipId, String(error));
      });

      wavesurferRef.current = ws;

      return cleanup;
    }, [props.url, props.clipId, props.color, props.height, cleanup]);

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
      seek: (globalTime: number) => {
        if (!wavesurferRef.current || !isReadyRef.current) return;

        // Calculer le temps relatif au clip
        const relativeTime = globalTime - propsRef.current.startTime;
        const clipDuration = propsRef.current.outPoint - propsRef.current.inPoint;

        if (relativeTime >= 0 && relativeTime <= clipDuration) {
          // On est dans ce clip - positionner au bon endroit
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
    }));

    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ height: props.height || 64 }}
      />
    );
  }
);
