'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Global AbortError suppressor for WaveSurfer cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError') {
      event.preventDefault();
    }
  });
  window.addEventListener('error', (event) => {
    if (event.message?.includes('AbortError') || event.error?.name === 'AbortError') {
      event.preventDefault();
      return true;
    }
  });
}

interface AudioWaveformProps {
  url: string;
  className?: string;
  height?: number;
  waveColor?: string;
  progressColor?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioWaveform({
  url,
  className,
  height = 80,
  waveColor = '#d1d5db',
  progressColor = '#3b82f6',
}: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Reset mounted flag
    isMountedRef.current = true;

    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveColor,
      progressColor: progressColor,
      height: height,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 1,
      cursorColor: '#1d4ed8',
      normalize: true,
    });

    wavesurfer.load(url);

    wavesurfer.on('ready', () => {
      if (isMountedRef.current) {
        setIsReady(true);
        setDuration(wavesurfer.getDuration());
      }
    });

    wavesurfer.on('audioprocess', () => {
      if (isMountedRef.current) {
        setCurrentTime(wavesurfer.getCurrentTime());
      }
    });

    wavesurfer.on('seeking', () => {
      if (isMountedRef.current) {
        setCurrentTime(wavesurfer.getCurrentTime());
      }
    });

    wavesurfer.on('play', () => {
      if (isMountedRef.current) setIsPlaying(true);
    });
    wavesurfer.on('pause', () => {
      if (isMountedRef.current) setIsPlaying(false);
    });
    wavesurfer.on('finish', () => {
      if (isMountedRef.current) setIsPlaying(false);
    });

    // Handle errors silently (especially AbortError during unmount)
    wavesurfer.on('error', (error) => {
      // Only log if it's not an abort error during unmount
      if (isMountedRef.current && !String(error).includes('AbortError')) {
        console.warn('WaveSurfer error:', error);
      }
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      // Mark as unmounted first
      isMountedRef.current = false;

      // Unsubscribe all events first
      wavesurfer.unAll();

      // Destroy wavesurfer (AbortError is handled globally)
      try {
        wavesurfer.pause();
        wavesurfer.destroy();
      } catch {
        // Ignore errors
      }

      wavesurferRef.current = null;
    };
  }, [url, height, waveColor, progressColor]);

  const togglePlay = useCallback(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause();
    }
  }, [isReady]);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={containerRef}
        className={cn(
          'w-full rounded-lg bg-gray-50 overflow-hidden',
          !isReady && 'animate-pulse'
        )}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          disabled={!isReady}
          className="h-8 w-8 p-0"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <div className="text-xs text-gray-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
