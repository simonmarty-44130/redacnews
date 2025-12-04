/**
 * Hook principal pour l'intégration de peaks.js
 * Gère la visualisation waveform et les segments (régions)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Track, AudioRegion } from '../types/editor.types';

// Types are defined locally to avoid SSR issues with peaks.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PeaksInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PeaksInitOptions = any;
import { EDITOR_THEME } from '../constants/shortcuts';

interface UsePeaksOptions {
  track: Track | null;
  zoomviewContainer: HTMLElement | null;
  overviewContainer?: HTMLElement | null;
  audioElement: HTMLAudioElement | null;
  theme?: 'light' | 'dark';
  onReady?: (peaks: PeaksInstance) => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onSeek?: (time: number) => void;
  onSegmentClick?: (segmentId: string) => void;
}

interface UsePeaksReturn {
  peaks: PeaksInstance | null;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  // Actions
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (samplesPerPixel: number) => void;
  // Segments (régions visibles)
  updateSegments: (regions: AudioRegion[]) => void;
  clearSegments: () => void;
  // Points (marqueurs)
  addPoint: (time: number, labelText: string, color?: string) => void;
  removePoint: (pointId: string) => void;
  clearPoints: () => void;
}

// Niveaux de zoom en samples par pixel
const ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];

export function usePeaks(options: UsePeaksOptions): UsePeaksReturn {
  const {
    track,
    zoomviewContainer,
    overviewContainer,
    audioElement,
    theme = 'dark',
    onReady,
    onError,
    onTimeUpdate,
    onSeek,
    onSegmentClick,
  } = options;

  const peaksRef = useRef<PeaksInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const zoomLevelRef = useRef(2); // Index dans ZOOM_LEVELS
  const [initRetry, setInitRetry] = useState(0); // Retry counter for container visibility

  const colors = theme === 'dark' ? EDITOR_THEME.dark : EDITOR_THEME.light;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (peaksRef.current) {
      try {
        peaksRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying peaks instance:', e);
      }
      peaksRef.current = null;
    }
    setIsReady(false);
    setError(null);
  }, []);

  // Initialisation de peaks.js
  useEffect(() => {
    if (!zoomviewContainer || !audioElement || !track) {
      return;
    }

    // Vérifier si le conteneur est visible et a des dimensions
    const rect = zoomviewContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Conteneur pas encore visible, réessayer après un délai (max 10 retries)
      if (initRetry < 10) {
        const delay = Math.min(100 * (initRetry + 1), 500);
        const retryTimeout = setTimeout(() => {
          setInitRetry(prev => prev + 1);
        }, delay);
        return () => clearTimeout(retryTimeout);
      }
      // Après 10 retries, abandonner silencieusement
      return;
    }

    // Reset retry counter on successful dimension check
    if (initRetry > 0) {
      setInitRetry(0);
    }

    // Cleanup précédent
    cleanup();
    setIsLoading(true);

    // Créer AudioContext si nécessaire
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const peaksOptions: PeaksInitOptions = {
      zoomview: {
        container: zoomviewContainer,
        waveformColor: colors.waveform,
        playedWaveformColor: colors.waveformSelected,
        playheadColor: colors.playhead,
        playheadTextColor: colors.text,
        axisLabelColor: colors.textMuted,
        axisGridlineColor: colors.border,
        timeLabelPrecision: 2,
      },
      ...(overviewContainer && {
        overview: {
          container: overviewContainer,
          waveformColor: colors.textMuted,
          playedWaveformColor: colors.waveform,
          playheadColor: colors.playhead,
          highlightColor: colors.selection,
        },
      }),
      mediaElement: audioElement,
      webAudio: {
        audioContext: audioContextRef.current,
      },
      zoomLevels: ZOOM_LEVELS,
      // Playhead
      playheadColor: colors.playhead,
      playheadTextColor: colors.text,
      showPlayheadTime: true,
      // Apparence générale
      waveformColor: colors.waveform,
      axisLabelColor: colors.textMuted,
      axisGridlineColor: colors.border,
      // Logger (pour debug)
      logger: (...args: unknown[]) => console.log(...args),
    };

    // Dynamically import peaks.js to avoid SSR issues
    import('peaks.js').then((PeaksModule) => {
      // Vérifier que le conteneur existe toujours après l'import async
      if (!zoomviewContainer) {
        setIsLoading(false);
        return;
      }

      const Peaks = PeaksModule.default;
      Peaks.init(peaksOptions, (err: unknown, peaks: PeaksInstance) => {
        setIsLoading(false);

        if (err) {
          console.error('Peaks.js init error:', err);
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
          return;
        }

        if (!peaks) {
          const error = new Error('Peaks instance is null');
          setError(error);
          onError?.(error);
          return;
        }

        peaksRef.current = peaks;
        setIsReady(true);
        setError(null);

        // Event listeners
        peaks.on('player.timeupdate', (time: number) => {
          onTimeUpdate?.(time);
        });

        peaks.on('player.seeked', (time: number) => {
          onSeek?.(time);
        });

        peaks.on('segments.click', (event: { segment: { id?: string } }) => {
          if (event.segment.id) {
            onSegmentClick?.(event.segment.id);
          }
        });

        peaks.on('zoomview.click', (event: { time: number }) => {
          // Quand on clique sur la waveform, positionner le playhead
          peaks.player.seek(event.time);
        });

        onReady?.(peaks);
      });
    }).catch((err) => {
      console.error('Failed to load peaks.js:', err);
      setIsLoading(false);
      setError(new Error('Failed to load audio editor'));
    });

    return cleanup;
  }, [
    zoomviewContainer,
    overviewContainer,
    audioElement,
    track?.src,
    colors,
    cleanup,
    initRetry,
    onReady,
    onError,
    onTimeUpdate,
    onSeek,
    onSegmentClick,
  ]);

  // Mettre à jour les segments quand les régions changent
  const updateSegments = useCallback(
    (regions: AudioRegion[]) => {
      if (!peaksRef.current) return;

      const segments = peaksRef.current.segments;

      // Supprimer tous les segments existants
      segments.removeAll();

      // Ajouter les nouvelles régions comme segments
      regions.forEach((region, index) => {
        segments.add({
          id: region.id,
          startTime: region.startTime,
          endTime: region.endTime,
          labelText: region.label || `Région ${index + 1}`,
          color: region.color || `${colors.waveform}40`, // 40 = 25% opacity
          editable: false, // Les régions ne sont pas éditables directement via peaks
        });
      });
    },
    [colors.waveform]
  );

  const clearSegments = useCallback(() => {
    if (peaksRef.current) {
      peaksRef.current.segments.removeAll();
    }
  }, []);

  // Points (marqueurs)
  const addPoint = useCallback(
    (time: number, labelText: string, color?: string) => {
      if (!peaksRef.current) return;

      peaksRef.current.points.add({
        time,
        labelText,
        color: color || colors.cursor,
        editable: false,
      });
    },
    [colors.cursor]
  );

  const removePoint = useCallback((pointId: string) => {
    if (!peaksRef.current) return;

    const point = peaksRef.current.points.getPoint(pointId);
    if (point) {
      peaksRef.current.points.removeById(pointId);
    }
  }, []);

  const clearPoints = useCallback(() => {
    if (peaksRef.current) {
      peaksRef.current.points.removeAll();
    }
  }, []);

  // Actions de lecture
  const play = useCallback(() => {
    peaksRef.current?.player.play();
  }, []);

  const pause = useCallback(() => {
    peaksRef.current?.player.pause();
  }, []);

  const seek = useCallback((time: number) => {
    peaksRef.current?.player.seek(time);
  }, []);

  // Zoom
  const zoomIn = useCallback(() => {
    if (!peaksRef.current) return;

    if (zoomLevelRef.current > 0) {
      zoomLevelRef.current--;
      peaksRef.current.zoom.setZoom(ZOOM_LEVELS[zoomLevelRef.current]);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (!peaksRef.current) return;

    if (zoomLevelRef.current < ZOOM_LEVELS.length - 1) {
      zoomLevelRef.current++;
      peaksRef.current.zoom.setZoom(ZOOM_LEVELS[zoomLevelRef.current]);
    }
  }, []);

  const setZoom = useCallback((samplesPerPixel: number) => {
    if (!peaksRef.current) return;

    // Trouver le niveau de zoom le plus proche
    const closestIndex = ZOOM_LEVELS.reduce(
      (prev, curr, idx) =>
        Math.abs(curr - samplesPerPixel) <
        Math.abs(ZOOM_LEVELS[prev] - samplesPerPixel)
          ? idx
          : prev,
      0
    );

    zoomLevelRef.current = closestIndex;
    peaksRef.current.zoom.setZoom(ZOOM_LEVELS[closestIndex]);
  }, []);

  return {
    peaks: peaksRef.current,
    isReady,
    isLoading,
    error,
    play,
    pause,
    seek,
    zoomIn,
    zoomOut,
    setZoom,
    updateSegments,
    clearSegments,
    addPoint,
    removePoint,
    clearPoints,
  };
}

export type { UsePeaksReturn };
