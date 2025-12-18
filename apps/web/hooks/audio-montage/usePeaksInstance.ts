'use client';

import { useRef, useEffect, useState } from 'react';
import Peaks, { PeaksInstance, PeaksOptions } from 'peaks.js';

interface UsePeaksInstanceOptions {
  audioUrl: string;
  container: HTMLElement | null;
  audioContext?: AudioContext;
  waveformColor?: string;
  playedWaveformColor?: string;
}

interface UsePeaksInstanceReturn {
  peaksInstance: PeaksInstance | null;
  isLoading: boolean;
  error: Error | null;
  audioBuffer: AudioBuffer | null;
}

export function usePeaksInstance({
  audioUrl,
  container,
  audioContext,
  waveformColor = 'rgba(59, 130, 246, 0.7)',
  playedWaveformColor = 'rgba(59, 130, 246, 1)',
}: UsePeaksInstanceOptions): UsePeaksInstanceReturn {
  const peaksRef = useRef<PeaksInstance | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!container || !audioUrl) return;

    let isMounted = true;
    const audioElement = document.createElement('audio');
    audioElement.crossOrigin = 'anonymous';

    const initPeaks = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Charger l'audio pour obtenir l'AudioBuffer
        let audioBuffer: AudioBuffer | null = null;
        if (audioContext) {
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferRef.current = audioBuffer;
        }

        // Configuration peaks.js
        const options: PeaksOptions = {
          zoomview: {
            container: container,
            waveformColor: waveformColor,
            playedWaveformColor: playedWaveformColor,
            axisLabelColor: 'transparent',
            axisGridlineColor: 'transparent',
          },
          mediaElement: audioElement,
          webAudio: audioContext && audioBuffer ? {
            audioContext: audioContext,
            audioBuffer: audioBuffer,
          } : undefined,
          keyboard: false,
          nudgeIncrement: 0.1,
          zoomLevels: [128, 256, 512, 1024, 2048],
        };

        // Initialiser peaks.js
        Peaks.init(options, (err, peaks) => {
          if (!isMounted) return;

          if (err) {
            console.error('Peaks.js init error:', err);
            setError(err);
            setIsLoading(false);
            return;
          }

          if (peaks) {
            peaksRef.current = peaks;
          }
          setIsLoading(false);
        });

        // Charger l'audio dans l'element
        audioElement.src = audioUrl;
        audioElement.load();

      } catch (err) {
        if (!isMounted) return;
        console.error('Error initializing peaks:', err);
        setError(err instanceof Error ? err : new Error('Failed to init peaks'));
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
  }, [audioUrl, container, audioContext, waveformColor, playedWaveformColor]);

  return {
    peaksInstance: peaksRef.current,
    isLoading,
    error,
    audioBuffer: audioBufferRef.current,
  };
}
