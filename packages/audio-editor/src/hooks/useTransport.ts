/**
 * Hook pour le controle du transport (play/pause/stop/seek)
 * Architecture DESTRUCTIVE - utilise isPlaying au lieu de playState
 */

import { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import type { PlayState } from '../types/editor.types';

interface UseTransportOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSeek?: (time: number) => void;
  onTimeUpdate?: (time: number) => void;
}

export interface UseTransportReturn {
  // State
  playState: PlayState;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  rewind: () => void;
  fastForward: () => void;

  // Shuttle (J/K/L style)
  shuttleBack: () => void;
  shuttleStop: () => void;
  shuttleForward: () => void;
}

export function useTransport(options: UseTransportOptions = {}): UseTransportReturn {
  const { onPlay, onPause, onStop, onSeek, onTimeUpdate } = options;

  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);

  // Derive playState from isPlaying
  const playState: PlayState = isPlaying ? 'playing' : 'stopped';

  const shuttleSpeedRef = useRef(0); // -2, -1, 0, 1, 2
  const shuttleIntervalRef = useRef<number | null>(null);

  // Cleanup shuttle on unmount
  useEffect(() => {
    return () => {
      if (shuttleIntervalRef.current) {
        clearInterval(shuttleIntervalRef.current);
      }
    };
  }, []);

  // Play
  const play = useCallback(() => {
    setPlaying(true);
    onPlay?.();
  }, [setPlaying, onPlay]);

  // Pause
  const pause = useCallback(() => {
    setPlaying(false);
    onPause?.();
  }, [setPlaying, onPause]);

  // Stop
  const stop = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
    onStop?.();
  }, [setPlaying, setCurrentTime, onStop]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Seek to absolute time
  const seek = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(clampedTime);
      onSeek?.(clampedTime);
    },
    [duration, setCurrentTime, onSeek]
  );

  // Seek relative to current position
  const seekRelative = useCallback(
    (delta: number) => {
      seek(currentTime + delta);
    },
    [currentTime, seek]
  );

  // Rewind to start
  const rewind = useCallback(() => {
    seek(0);
  }, [seek]);

  // Fast forward to end
  const fastForward = useCallback(() => {
    seek(duration);
  }, [seek, duration]);

  // Shuttle controls (J/K/L style like in Pro Tools/Avid)
  const updateShuttleSpeed = useCallback(() => {
    if (shuttleIntervalRef.current) {
      clearInterval(shuttleIntervalRef.current);
      shuttleIntervalRef.current = null;
    }

    const speed = shuttleSpeedRef.current;

    if (speed === 0) {
      pause();
      return;
    }

    // Speed multipliers: -2 = -4x, -1 = -2x, 1 = 2x, 2 = 4x
    const multiplier = speed > 0 ? Math.pow(2, speed) : -Math.pow(2, -speed);
    const interval = 50; // Update every 50ms
    const deltaPerUpdate = (multiplier * interval) / 1000;

    shuttleIntervalRef.current = window.setInterval(() => {
      const state = useEditorStore.getState();
      const newTime = state.currentTime + deltaPerUpdate;
      const clampedTime = Math.max(0, Math.min(newTime, state.duration));
      setCurrentTime(clampedTime);
      onTimeUpdate?.(clampedTime);

      // Stop at boundaries
      if (clampedTime <= 0 || clampedTime >= state.duration) {
        if (shuttleIntervalRef.current) {
          clearInterval(shuttleIntervalRef.current);
          shuttleIntervalRef.current = null;
        }
        shuttleSpeedRef.current = 0;
      }
    }, interval);
  }, [pause, setCurrentTime, onTimeUpdate]);

  // J key - shuttle backward
  const shuttleBack = useCallback(() => {
    if (shuttleSpeedRef.current > 0) {
      shuttleSpeedRef.current = 0;
    } else if (shuttleSpeedRef.current > -2) {
      shuttleSpeedRef.current--;
    }
    updateShuttleSpeed();
  }, [updateShuttleSpeed]);

  // K key - stop shuttle
  const shuttleStop = useCallback(() => {
    shuttleSpeedRef.current = 0;
    updateShuttleSpeed();
  }, [updateShuttleSpeed]);

  // L key - shuttle forward
  const shuttleForward = useCallback(() => {
    if (shuttleSpeedRef.current < 0) {
      shuttleSpeedRef.current = 0;
    } else if (shuttleSpeedRef.current < 2) {
      shuttleSpeedRef.current++;
    }
    updateShuttleSpeed();
  }, [updateShuttleSpeed]);

  return {
    // State
    playState,
    currentTime,
    duration,
    isPlaying,
    isPaused: !isPlaying && currentTime > 0,
    isStopped: !isPlaying && currentTime === 0,

    // Actions
    play,
    pause,
    stop,
    togglePlayPause,
    seek,
    seekRelative,
    rewind,
    fastForward,

    // Shuttle
    shuttleBack,
    shuttleStop,
    shuttleForward,
  };
}
