import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  Track,
  Selection,
  Marker,
  EditorState,
  HistoryEntry,
  FadeConfig,
} from '../types/editor.types';
import {
  cutAudioBuffer,
  cloneAudioBuffer,
  trimAudioBuffer,
  audioBufferToWav,
  applyFadeIn,
  applyFadeOut,
  normalizeAudioBuffer,
} from '../operations/cut';
import { DEFAULTS, EDITOR_THEME, ZOOM_LEVELS } from '../constants/shortcuts';

// Nombre maximum d'entrées dans l'historique
const MAX_HISTORY = 20;

// ============ STORE INTERFACE ============

interface EditorActions {
  // Init
  initAudioContext: () => void;

  // Track management
  loadTrack: (src: string, name: string) => Promise<string>;
  addTrackFromBuffer: (buffer: AudioBuffer, name: string) => string;
  removeTrack: (trackId: string) => void;
  setActiveTrack: (trackId: string | null) => void;

  // Transport
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;

  // Selection
  setInPoint: (time?: number) => void;
  setOutPoint: (time?: number) => void;
  clearSelection: () => void;

  // Edit operations (DESTRUCTIVE)
  cutSelection: () => void;
  trimToSelection: () => void;
  applyFadeIn: (duration: number) => void;
  applyFadeOut: (duration: number) => void;
  normalize: () => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: (action: string) => void;

  // Zoom
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Mix
  setTrackGain: (trackId: string, gain: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;

  // Markers
  addMarker: (time: number, label: string) => void;
  removeMarker: (markerId: string) => void;

  // Getters
  getActiveTrack: () => Track | null;
  getAudioContext: () => AudioContext | null;

  // Export helpers
  getBufferForExport: () => AudioBuffer | null;
}

// ============ INITIAL STATE ============

const initialState: EditorState = {
  tracks: [],
  activeTrackId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  selection: null,
  inPoint: null,
  outPoint: null,
  zoom: DEFAULTS.zoom,
  history: [],
  historyIndex: -1,
  audioContext: null,
};

// ============ STORE ============

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    ...initialState,

    // ============ INIT ============

    initAudioContext: () => {
      if (!get().audioContext) {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        set({ audioContext: ctx });
      }
    },

    // ============ TRACK MANAGEMENT ============

    loadTrack: async (src: string, name: string) => {
      const { initAudioContext } = get();

      // Ensure audio context exists
      initAudioContext();
      const ctx = get().audioContext!;

      try {
        // Fetch and decode audio file
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const id = nanoid();
        const trackIndex = get().tracks.length;
        const color =
          EDITOR_THEME.dark.trackColors[
            trackIndex % EDITOR_THEME.dark.trackColors.length
          ];

        const track: Track = {
          id,
          name,
          src,
          audioBuffer,
          duration: audioBuffer.duration,
          markers: [],
          color,
          gain: 1,
          pan: 0,
          muted: false,
          soloed: false,
        };

        set((state) => {
          state.tracks.push(track);
          state.activeTrackId = track.id;
          state.duration = audioBuffer.duration;
          // Reset history for new track
          state.history = [];
          state.historyIndex = -1;
        });

        // Save initial state to history
        get().pushHistory('Chargement');

        return id;
      } catch (error) {
        console.error('Error loading audio:', error);
        throw error;
      }
    },

    addTrackFromBuffer: (buffer: AudioBuffer, name: string) => {
      const id = nanoid();
      const trackIndex = get().tracks.length;
      const color =
        EDITOR_THEME.dark.trackColors[
          trackIndex % EDITOR_THEME.dark.trackColors.length
        ];

      const track: Track = {
        id,
        name,
        src: '',
        audioBuffer: buffer,
        duration: buffer.duration,
        markers: [],
        color,
        gain: 1,
        pan: 0,
        muted: false,
        soloed: false,
      };

      set((state) => {
        state.tracks.push(track);
        state.activeTrackId = track.id;
        state.duration = buffer.duration;
      });

      get().pushHistory('Import');

      return id;
    },

    removeTrack: (trackId: string) => {
      set((state) => {
        state.tracks = state.tracks.filter((t) => t.id !== trackId);
        if (state.activeTrackId === trackId) {
          state.activeTrackId = state.tracks[0]?.id ?? null;
        }
        if (state.tracks.length === 0) {
          state.duration = 0;
          state.history = [];
          state.historyIndex = -1;
        }
      });
    },

    setActiveTrack: (trackId) => {
      set((state) => {
        state.activeTrackId = trackId;
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          state.duration = track.duration;
        }
      });
    },

    // ============ TRANSPORT ============

    setPlaying: (playing) => {
      set({ isPlaying: playing });
    },

    setCurrentTime: (time) => {
      set((state) => {
        state.currentTime = Math.max(0, Math.min(time, state.duration));
      });
    },

    // ============ SELECTION ============

    setInPoint: (time?: number) => {
      const timeToUse = time ?? get().currentTime;
      console.log('setInPoint:', timeToUse.toFixed(3));
      set((state) => {
        state.inPoint = timeToUse;
        if (state.outPoint !== null && state.outPoint > timeToUse) {
          state.selection = { startTime: timeToUse, endTime: state.outPoint };
        }
      });
    },

    setOutPoint: (time?: number) => {
      const timeToUse = time ?? get().currentTime;
      console.log('setOutPoint:', timeToUse.toFixed(3));
      set((state) => {
        state.outPoint = timeToUse;
        if (state.inPoint !== null && state.inPoint < timeToUse) {
          state.selection = { startTime: state.inPoint, endTime: timeToUse };
        }
      });
    },

    clearSelection: () => {
      console.log('clearSelection');
      set((state) => {
        state.inPoint = null;
        state.outPoint = null;
        state.selection = null;
      });
    },

    // ============ EDIT OPERATIONS (DESTRUCTIVE) ============

    cutSelection: () => {
      const { activeTrackId, inPoint, outPoint, tracks, audioContext } = get();

      if (!activeTrackId || inPoint === null || outPoint === null || !audioContext) {
        console.warn('Cut: missing data', { activeTrackId, inPoint, outPoint });
        return;
      }

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) {
        console.warn('Cut: no track or buffer');
        return;
      }

      const startTime = Math.min(inPoint, outPoint);
      const endTime = Math.max(inPoint, outPoint);

      console.log('=== CUT (DESTRUCTIVE) ===');
      console.log('Cutting from', startTime.toFixed(3), 'to', endTime.toFixed(3));
      console.log('Buffer duration before:', track.audioBuffer.duration.toFixed(3));

      try {
        // Save for undo BEFORE the cut
        get().pushHistory('Cut');

        // Perform the cut
        const newBuffer = cutAudioBuffer(
          audioContext,
          track.audioBuffer,
          startTime,
          endTime
        );

        console.log('Buffer duration after:', newBuffer.duration.toFixed(3));

        // Update the store
        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
          if (trackIndex !== -1) {
            state.tracks[trackIndex].audioBuffer = newBuffer;
            state.tracks[trackIndex].duration = newBuffer.duration;
          }
          state.duration = newBuffer.duration;
          state.inPoint = null;
          state.outPoint = null;
          state.selection = null;
          // Adjust currentTime if beyond new duration
          if (state.currentTime > newBuffer.duration) {
            state.currentTime = newBuffer.duration;
          }
        });

        console.log('=== CUT DONE ===');
      } catch (error) {
        console.error('Cut failed:', error);
      }
    },

    trimToSelection: () => {
      const { activeTrackId, inPoint, outPoint, tracks, audioContext } = get();

      if (!activeTrackId || inPoint === null || outPoint === null || !audioContext) {
        console.warn('Trim: missing data');
        return;
      }

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) {
        return;
      }

      const startTime = Math.min(inPoint, outPoint);
      const endTime = Math.max(inPoint, outPoint);

      try {
        get().pushHistory('Trim');

        const newBuffer = trimAudioBuffer(
          audioContext,
          track.audioBuffer,
          startTime,
          endTime
        );

        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
          if (trackIndex !== -1) {
            state.tracks[trackIndex].audioBuffer = newBuffer;
            state.tracks[trackIndex].duration = newBuffer.duration;
          }
          state.duration = newBuffer.duration;
          state.inPoint = null;
          state.outPoint = null;
          state.selection = null;
          state.currentTime = 0;
        });
      } catch (error) {
        console.error('Trim failed:', error);
      }
    },

    applyFadeIn: (duration: number) => {
      const { activeTrackId, tracks, audioContext } = get();

      if (!activeTrackId || !audioContext) return;

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) return;

      try {
        get().pushHistory('Fade In');

        const newBuffer = applyFadeIn(audioContext, track.audioBuffer, duration);

        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
          if (trackIndex !== -1) {
            state.tracks[trackIndex].audioBuffer = newBuffer;
          }
        });
      } catch (error) {
        console.error('Fade in failed:', error);
      }
    },

    applyFadeOut: (duration: number) => {
      const { activeTrackId, tracks, audioContext } = get();

      if (!activeTrackId || !audioContext) return;

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) return;

      try {
        get().pushHistory('Fade Out');

        const newBuffer = applyFadeOut(audioContext, track.audioBuffer, duration);

        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
          if (trackIndex !== -1) {
            state.tracks[trackIndex].audioBuffer = newBuffer;
          }
        });
      } catch (error) {
        console.error('Fade out failed:', error);
      }
    },

    normalize: () => {
      const { activeTrackId, tracks, audioContext } = get();

      if (!activeTrackId || !audioContext) return;

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) return;

      try {
        get().pushHistory('Normalisation');

        const newBuffer = normalizeAudioBuffer(audioContext, track.audioBuffer);

        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
          if (trackIndex !== -1) {
            state.tracks[trackIndex].audioBuffer = newBuffer;
          }
        });
      } catch (error) {
        console.error('Normalize failed:', error);
      }
    },

    // ============ HISTORY ============

    pushHistory: (action: string) => {
      const { activeTrackId, tracks, audioContext } = get();

      if (!audioContext) return;

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track || !track.audioBuffer) return;

      // Clone the current buffer
      const bufferClone = cloneAudioBuffer(audioContext, track.audioBuffer);

      const entry: HistoryEntry = {
        timestamp: Date.now(),
        action,
        audioBuffer: bufferClone,
        duration: track.duration,
      };

      set((state) => {
        // Remove entries after current index (if we did undo)
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(entry);

        // Limit size
        if (state.history.length > MAX_HISTORY) {
          state.history = state.history.slice(-MAX_HISTORY);
        }

        state.historyIndex = state.history.length - 1;
      });
    },

    undo: () => {
      const { historyIndex, history, activeTrackId } = get();

      if (historyIndex <= 0) {
        console.log('Nothing to undo');
        return;
      }

      const previousEntry = history[historyIndex - 1];

      console.log('Undo to:', previousEntry.action);

      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex].audioBuffer = previousEntry.audioBuffer;
          state.tracks[trackIndex].duration = previousEntry.duration;
        }
        state.duration = previousEntry.duration;
        state.historyIndex = historyIndex - 1;
        // Clear selection
        state.inPoint = null;
        state.outPoint = null;
        state.selection = null;
      });
    },

    redo: () => {
      const { historyIndex, history, activeTrackId } = get();

      if (historyIndex >= history.length - 1) {
        console.log('Nothing to redo');
        return;
      }

      const nextEntry = history[historyIndex + 1];

      console.log('Redo to:', nextEntry.action);

      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex].audioBuffer = nextEntry.audioBuffer;
          state.tracks[trackIndex].duration = nextEntry.duration;
        }
        state.duration = nextEntry.duration;
        state.historyIndex = historyIndex + 1;
      });
    },

    // ============ ZOOM ============

    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(ZOOM_LEVELS[0], Math.min(zoom, ZOOM_LEVELS[ZOOM_LEVELS.length - 1]));
      });
    },

    zoomIn: () => {
      const currentZoom = get().zoom;
      const nextZoom = ZOOM_LEVELS.find((z) => z > currentZoom);
      if (nextZoom) {
        set({ zoom: nextZoom });
      }
    },

    zoomOut: () => {
      const currentZoom = get().zoom;
      const prevZoom = [...ZOOM_LEVELS].reverse().find((z) => z < currentZoom);
      if (prevZoom) {
        set({ zoom: prevZoom });
      }
    },

    // ============ MIX ============

    setTrackGain: (trackId, gain) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.gain = Math.max(0, Math.min(2, gain));
        }
      });
    },

    setTrackPan: (trackId, pan) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.pan = Math.max(-1, Math.min(1, pan));
        }
      });
    },

    toggleMute: (trackId) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.muted = !track.muted;
        }
      });
    },

    toggleSolo: (trackId) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.soloed = !track.soloed;
        }
      });
    },

    // ============ MARKERS ============

    addMarker: (time, label) => {
      const { activeTrackId } = get();
      if (!activeTrackId) return;

      const marker: Marker = {
        id: nanoid(),
        time,
        label,
        color: EDITOR_THEME.dark.cursor,
      };

      set((state) => {
        const track = state.tracks.find((t) => t.id === activeTrackId);
        if (track) {
          track.markers.push(marker);
          track.markers.sort((a, b) => a.time - b.time);
        }
      });
    },

    removeMarker: (markerId) => {
      const { activeTrackId } = get();
      if (!activeTrackId) return;

      set((state) => {
        const track = state.tracks.find((t) => t.id === activeTrackId);
        if (track) {
          track.markers = track.markers.filter((m) => m.id !== markerId);
        }
      });
    },

    // ============ GETTERS ============

    getActiveTrack: () => {
      const { tracks, activeTrackId } = get();
      return tracks.find((t) => t.id === activeTrackId) ?? null;
    },

    getAudioContext: () => {
      return get().audioContext;
    },

    getBufferForExport: () => {
      const track = get().getActiveTrack();
      return track?.audioBuffer ?? null;
    },
  }))
);

// ============ SELECTORS ============

export const selectTracks = (state: EditorState) => state.tracks;
export const selectCurrentTime = (state: EditorState) => state.currentTime;
export const selectIsPlaying = (state: EditorState) => state.isPlaying;
export const selectZoom = (state: EditorState) => state.zoom;
export const selectSelection = (state: EditorState) => state.selection;
export const selectActiveTrackId = (state: EditorState) => state.activeTrackId;
export const selectDuration = (state: EditorState) => state.duration;
export const selectInPoint = (state: EditorState) => state.inPoint;
export const selectOutPoint = (state: EditorState) => state.outPoint;

export const selectCanUndo = (state: EditorState & EditorActions) =>
  state.historyIndex > 0;
export const selectCanRedo = (state: EditorState & EditorActions) =>
  state.historyIndex < state.history.length - 1;

export const selectActiveTrack = (state: EditorState) =>
  state.tracks.find((t) => t.id === state.activeTrackId) ?? null;
