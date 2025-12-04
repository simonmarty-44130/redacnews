/**
 * Hook pour la gestion des selections audio
 */

import { useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import type { Selection, CuePoints } from '../types/editor.types';

export interface UseSelectionReturn {
  // State
  selection: Selection | null;
  cuePoints: CuePoints;
  hasSelection: boolean;
  selectionDuration: number;

  // Actions
  setSelection: (selection: Selection | null) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectRegion: (start: number, end: number) => void;
  extendSelectionTo: (time: number) => void;
  nudgeSelectionLeft: (amount?: number) => void;
  nudgeSelectionRight: (amount?: number) => void;

  // Cue points
  setCueIn: (time?: number) => void;
  setCueOut: (time?: number) => void;
  clearCuePoints: () => void;
  goToCueIn: () => void;
  goToCueOut: () => void;
  selectBetweenCuePoints: () => void;

  // Playback from selection
  playSelection: () => void;
  loopSelection: () => void;
}

export function useSelection(): UseSelectionReturn {
  const selection = useEditorStore((state) => state.selection);
  const cuePoints = useEditorStore((state) => state.cuePoints);
  const duration = useEditorStore((state) => state.duration);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setSelectionStore = useEditorStore((state) => state.setSelection);
  const setCuePointsStore = useEditorStore((state) => state.setCuePoints);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setPlayState = useEditorStore((state) => state.setPlayState);

  // Calculate selection duration
  const selectionDuration = selection ? selection.end - selection.start : 0;
  const hasSelection = selection !== null && selectionDuration > 0;

  // Set selection
  const setSelection = useCallback(
    (newSelection: Selection | null) => {
      setSelectionStore(newSelection);
    },
    [setSelectionStore]
  );

  // Select all
  const selectAll = useCallback(() => {
    setSelectionStore({ start: 0, end: duration });
  }, [setSelectionStore, duration]);

  // Clear selection
  const selectNone = useCallback(() => {
    setSelectionStore(null);
  }, [setSelectionStore]);

  // Select a region
  const selectRegion = useCallback(
    (start: number, end: number) => {
      const clampedStart = Math.max(0, Math.min(start, duration));
      const clampedEnd = Math.max(0, Math.min(end, duration));

      if (clampedStart < clampedEnd) {
        setSelectionStore({ start: clampedStart, end: clampedEnd });
      } else if (clampedEnd < clampedStart) {
        setSelectionStore({ start: clampedEnd, end: clampedStart });
      }
    },
    [setSelectionStore, duration]
  );

  // Extend selection to a point
  const extendSelectionTo = useCallback(
    (time: number) => {
      if (selection) {
        // Extend from nearest edge
        if (time < selection.start) {
          setSelectionStore({ ...selection, start: time });
        } else if (time > selection.end) {
          setSelectionStore({ ...selection, end: time });
        }
      } else {
        // Create new selection from current time
        selectRegion(currentTime, time);
      }
    },
    [selection, currentTime, setSelectionStore, selectRegion]
  );

  // Nudge selection left
  const nudgeSelectionLeft = useCallback(
    (amount = 0.1) => {
      if (selection) {
        const newStart = Math.max(0, selection.start - amount);
        const newEnd = Math.max(amount, selection.end - amount);
        setSelectionStore({ start: newStart, end: newEnd });
      }
    },
    [selection, setSelectionStore]
  );

  // Nudge selection right
  const nudgeSelectionRight = useCallback(
    (amount = 0.1) => {
      if (selection) {
        const newStart = Math.min(duration - (selection.end - selection.start), selection.start + amount);
        const newEnd = Math.min(duration, selection.end + amount);
        setSelectionStore({ start: newStart, end: newEnd });
      }
    },
    [selection, duration, setSelectionStore]
  );

  // Set cue in point
  const setCueIn = useCallback(
    (time?: number) => {
      const cueTime = time ?? currentTime;
      setCuePointsStore({ cueIn: cueTime });
    },
    [currentTime, setCuePointsStore]
  );

  // Set cue out point
  const setCueOut = useCallback(
    (time?: number) => {
      const cueTime = time ?? currentTime;
      setCuePointsStore({ cueOut: cueTime });
    },
    [currentTime, setCuePointsStore]
  );

  // Clear cue points
  const clearCuePoints = useCallback(() => {
    setCuePointsStore({ cueIn: undefined, cueOut: undefined });
  }, [setCuePointsStore]);

  // Go to cue in
  const goToCueIn = useCallback(() => {
    if (cuePoints.cueIn !== undefined) {
      setCurrentTime(cuePoints.cueIn);
    }
  }, [cuePoints.cueIn, setCurrentTime]);

  // Go to cue out
  const goToCueOut = useCallback(() => {
    if (cuePoints.cueOut !== undefined) {
      setCurrentTime(cuePoints.cueOut);
    }
  }, [cuePoints.cueOut, setCurrentTime]);

  // Select between cue points
  const selectBetweenCuePoints = useCallback(() => {
    if (cuePoints.cueIn !== undefined && cuePoints.cueOut !== undefined) {
      selectRegion(cuePoints.cueIn, cuePoints.cueOut);
    }
  }, [cuePoints, selectRegion]);

  // Play selection (placeholder - actual implementation depends on playlist)
  const playSelection = useCallback(() => {
    if (selection) {
      setCurrentTime(selection.start);
      setPlayState('playing');
    }
  }, [selection, setCurrentTime, setPlayState]);

  // Loop selection (placeholder)
  const loopSelection = useCallback(() => {
    if (selection) {
      setCurrentTime(selection.start);
      setPlayState('playing');
      // Actual looping would need to be implemented in the playlist
    }
  }, [selection, setCurrentTime, setPlayState]);

  return {
    // State
    selection,
    cuePoints,
    hasSelection,
    selectionDuration,

    // Actions
    setSelection,
    selectAll,
    selectNone,
    selectRegion,
    extendSelectionTo,
    nudgeSelectionLeft,
    nudgeSelectionRight,

    // Cue points
    setCueIn,
    setCueOut,
    clearCuePoints,
    goToCueIn,
    goToCueOut,
    selectBetweenCuePoints,

    // Playback
    playSelection,
    loopSelection,
  };
}
