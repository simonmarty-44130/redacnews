/**
 * Hook pour la gestion des selections audio
 * Architecture DESTRUCTIVE - utilise inPoint/outPoint
 */

import { useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import type { Selection } from '../types/editor.types';

export interface UseSelectionReturn {
  // State
  selection: Selection | null;
  inPoint: number | null;
  outPoint: number | null;
  hasSelection: boolean;
  selectionDuration: number;

  // Actions
  selectAll: () => void;
  selectNone: () => void;
  selectRegion: (start: number, end: number) => void;

  // Cue points (IN/OUT)
  setCueIn: (time?: number) => void;
  setCueOut: (time?: number) => void;
  clearCuePoints: () => void;
  goToCueIn: () => void;
  goToCueOut: () => void;

  // Playback from selection
  playSelection: () => void;
}

export function useSelection(): UseSelectionReturn {
  const selection = useEditorStore((state) => state.selection);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const duration = useEditorStore((state) => state.duration);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setPlaying = useEditorStore((state) => state.setPlaying);

  // Calculate selection duration
  const selectionDuration = selection
    ? selection.endTime - selection.startTime
    : 0;
  const hasSelection = selection !== null && selectionDuration > 0;

  // Select all
  const selectAll = useCallback(() => {
    setInPoint(0);
    setOutPoint(duration);
  }, [setInPoint, setOutPoint, duration]);

  // Clear selection
  const selectNone = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Select a region
  const selectRegion = useCallback(
    (start: number, end: number) => {
      const clampedStart = Math.max(0, Math.min(start, duration));
      const clampedEnd = Math.max(0, Math.min(end, duration));

      if (clampedStart < clampedEnd) {
        setInPoint(clampedStart);
        setOutPoint(clampedEnd);
      } else if (clampedEnd < clampedStart) {
        setInPoint(clampedEnd);
        setOutPoint(clampedStart);
      }
    },
    [setInPoint, setOutPoint, duration]
  );

  // Set cue in point
  const setCueIn = useCallback(
    (time?: number) => {
      const cueTime = time ?? currentTime;
      setInPoint(cueTime);
    },
    [currentTime, setInPoint]
  );

  // Set cue out point
  const setCueOut = useCallback(
    (time?: number) => {
      const cueTime = time ?? currentTime;
      setOutPoint(cueTime);
    },
    [currentTime, setOutPoint]
  );

  // Clear cue points
  const clearCuePoints = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Go to cue in
  const goToCueIn = useCallback(() => {
    if (inPoint !== null) {
      setCurrentTime(inPoint);
    }
  }, [inPoint, setCurrentTime]);

  // Go to cue out
  const goToCueOut = useCallback(() => {
    if (outPoint !== null) {
      setCurrentTime(outPoint);
    }
  }, [outPoint, setCurrentTime]);

  // Play selection
  const playSelection = useCallback(() => {
    if (inPoint !== null) {
      setCurrentTime(inPoint);
      setPlaying(true);
    }
  }, [inPoint, setCurrentTime, setPlaying]);

  return {
    // State
    selection,
    inPoint,
    outPoint,
    hasSelection,
    selectionDuration,

    // Actions
    selectAll,
    selectNone,
    selectRegion,

    // Cue points
    setCueIn,
    setCueOut,
    clearCuePoints,
    goToCueIn,
    goToCueOut,

    // Playback
    playSelection,
  };
}
