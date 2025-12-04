import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  Track,
  Selection,
  CuePoints,
  Marker,
  PlayState,
  EditorState,
  HistoryEntry,
  FadeConfig,
} from '../types/editor.types';
import { DEFAULTS, EDITOR_THEME, ZOOM_LEVELS } from '../constants/shortcuts';

// ============ STORE INTERFACE ============

interface EditorActions {
  // Track management
  addTrack: (track: Omit<Track, 'id'> & { id?: string }) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;

  // Playback
  setPlayState: (state: PlayState) => void;
  setCurrentTime: (time: number) => void;

  // Selection
  setSelection: (selection: Selection | null) => void;
  setCuePoints: (cuePoints: Partial<CuePoints>) => void;
  selectTrack: (trackId: string, addToSelection?: boolean) => void;
  deselectTrack: (trackId: string) => void;
  clearTrackSelection: () => void;

  // Markers
  addMarker: (time: number, label: string, color?: string) => void;
  removeMarker: (markerId: string) => void;
  updateMarker: (markerId: string, updates: Partial<Marker>) => void;

  // View
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setScrollLeft: (scrollLeft: number) => void;

  // Mute/Solo
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  muteAll: () => void;
  unmuteAll: () => void;

  // Volume/Pan
  setTrackGain: (trackId: string, gain: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;

  // Fades
  setTrackFadeIn: (trackId: string, fade: FadeConfig | undefined) => void;
  setTrackFadeOut: (trackId: string, fade: FadeConfig | undefined) => void;

  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: (action: string) => void;
  clearHistory: () => void;

  // Project
  loadTracks: (tracks: Track[]) => void;
  reset: () => void;
  updateDuration: () => void;
}

// ============ INITIAL STATE ============

const initialState: EditorState = {
  tracks: [],
  duration: 0,
  sampleRate: DEFAULTS.sampleRate,
  playState: 'stopped',
  currentTime: 0,
  zoom: DEFAULTS.zoom,
  scrollLeft: 0,
  selection: null,
  cuePoints: {},
  selectedTrackIds: [],
  markers: [],
  canUndo: false,
  canRedo: false,
};

// ============ HISTORY STATE ============

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

let history: HistoryState = {
  past: [],
  future: [],
};

// ============ STORE ============

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    ...initialState,

    // ============ TRACK MANAGEMENT ============

    addTrack: (trackData) => {
      const id = trackData.id || nanoid();
      const trackIndex = get().tracks.length;
      const color =
        trackData.color ||
        EDITOR_THEME.dark.trackColors[
          trackIndex % EDITOR_THEME.dark.trackColors.length
        ];

      const newTrack: Track = {
        id,
        src: trackData.src,
        name: trackData.name,
        start: trackData.start ?? 0,
        gain: trackData.gain ?? 1,
        muted: trackData.muted ?? false,
        soloed: trackData.soloed ?? false,
        pan: trackData.pan ?? 0,
        fadeIn: trackData.fadeIn,
        fadeOut: trackData.fadeOut,
        color,
        duration: trackData.duration,
        peaks: trackData.peaks,
      };

      set((state) => {
        state.tracks.push(newTrack);
      });

      get().saveToHistory(`add-track: ${newTrack.name}`);
      get().updateDuration();

      return id;
    },

    removeTrack: (trackId) => {
      const track = get().tracks.find((t) => t.id === trackId);
      if (!track) return;

      set((state) => {
        state.tracks = state.tracks.filter((t) => t.id !== trackId);
        state.selectedTrackIds = state.selectedTrackIds.filter(
          (id) => id !== trackId
        );
      });

      get().saveToHistory(`remove-track: ${track.name}`);
      get().updateDuration();
    },

    updateTrack: (trackId, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      });
      get().updateDuration();
    },

    reorderTracks: (fromIndex, toIndex) => {
      set((state) => {
        const [removed] = state.tracks.splice(fromIndex, 1);
        state.tracks.splice(toIndex, 0, removed);
      });
      get().saveToHistory('reorder-tracks');
    },

    // ============ PLAYBACK ============

    setPlayState: (playState) => {
      set((state) => {
        state.playState = playState;
      });
    },

    setCurrentTime: (time) => {
      set((state) => {
        state.currentTime = Math.max(0, Math.min(time, state.duration));
      });
    },

    // ============ SELECTION ============

    setSelection: (selection) => {
      set((state) => {
        state.selection = selection;
      });
    },

    setCuePoints: (cuePoints) => {
      set((state) => {
        state.cuePoints = { ...state.cuePoints, ...cuePoints };
      });
    },

    selectTrack: (trackId, addToSelection = false) => {
      set((state) => {
        if (addToSelection) {
          if (!state.selectedTrackIds.includes(trackId)) {
            state.selectedTrackIds.push(trackId);
          }
        } else {
          state.selectedTrackIds = [trackId];
        }
      });
    },

    deselectTrack: (trackId) => {
      set((state) => {
        state.selectedTrackIds = state.selectedTrackIds.filter(
          (id) => id !== trackId
        );
      });
    },

    clearTrackSelection: () => {
      set((state) => {
        state.selectedTrackIds = [];
      });
    },

    // ============ MARKERS ============

    addMarker: (time, label, color) => {
      const marker: Marker = {
        id: nanoid(),
        time,
        label,
        color: color || EDITOR_THEME.dark.cursor,
      };

      set((state) => {
        state.markers.push(marker);
        state.markers.sort((a, b) => a.time - b.time);
      });
    },

    removeMarker: (markerId) => {
      set((state) => {
        state.markers = state.markers.filter((m) => m.id !== markerId);
      });
    },

    updateMarker: (markerId, updates) => {
      set((state) => {
        const marker = state.markers.find((m) => m.id === markerId);
        if (marker) {
          Object.assign(marker, updates);
        }
      });
    },

    // ============ VIEW ============

    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(ZOOM_LEVELS[0], Math.min(zoom, ZOOM_LEVELS[ZOOM_LEVELS.length - 1]));
      });
    },

    zoomIn: () => {
      const currentZoom = get().zoom;
      const nextZoom = ZOOM_LEVELS.find((z) => z > currentZoom);
      if (nextZoom) {
        set((state) => {
          state.zoom = nextZoom;
        });
      }
    },

    zoomOut: () => {
      const currentZoom = get().zoom;
      const prevZoom = [...ZOOM_LEVELS].reverse().find((z) => z < currentZoom);
      if (prevZoom) {
        set((state) => {
          state.zoom = prevZoom;
        });
      }
    },

    zoomToFit: () => {
      // This would need container width to calculate
      // For now, just reset to default
      set((state) => {
        state.zoom = DEFAULTS.zoom;
        state.scrollLeft = 0;
      });
    },

    setScrollLeft: (scrollLeft) => {
      set((state) => {
        state.scrollLeft = Math.max(0, scrollLeft);
      });
    },

    // ============ MUTE/SOLO ============

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

    muteAll: () => {
      set((state) => {
        state.tracks.forEach((track) => {
          track.muted = true;
        });
      });
    },

    unmuteAll: () => {
      set((state) => {
        state.tracks.forEach((track) => {
          track.muted = false;
          track.soloed = false;
        });
      });
    },

    // ============ VOLUME/PAN ============

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

    // ============ FADES ============

    setTrackFadeIn: (trackId, fade) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeIn = fade;
        }
      });
      get().saveToHistory('fade-in');
    },

    setTrackFadeOut: (trackId, fade) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeOut = fade;
        }
      });
      get().saveToHistory('fade-out');
    },

    // ============ HISTORY ============

    saveToHistory: (action) => {
      const currentTracks = JSON.parse(JSON.stringify(get().tracks));

      history.past.push({
        tracks: currentTracks,
        timestamp: Date.now(),
        action,
      });

      // Limit history size
      if (history.past.length > DEFAULTS.maxHistorySize) {
        history.past.shift();
      }

      // Clear future when new action is performed
      history.future = [];

      set((state) => {
        state.canUndo = history.past.length > 0;
        state.canRedo = false;
      });
    },

    undo: () => {
      if (history.past.length === 0) return;

      const currentTracks = JSON.parse(JSON.stringify(get().tracks));
      const previousEntry = history.past.pop()!;

      history.future.push({
        tracks: currentTracks,
        timestamp: Date.now(),
        action: 'undo',
      });

      set((state) => {
        state.tracks = previousEntry.tracks;
        state.canUndo = history.past.length > 0;
        state.canRedo = true;
      });

      get().updateDuration();
    },

    redo: () => {
      if (history.future.length === 0) return;

      const currentTracks = JSON.parse(JSON.stringify(get().tracks));
      const nextEntry = history.future.pop()!;

      history.past.push({
        tracks: currentTracks,
        timestamp: Date.now(),
        action: 'redo',
      });

      set((state) => {
        state.tracks = nextEntry.tracks;
        state.canUndo = true;
        state.canRedo = history.future.length > 0;
      });

      get().updateDuration();
    },

    clearHistory: () => {
      history = { past: [], future: [] };
      set((state) => {
        state.canUndo = false;
        state.canRedo = false;
      });
    },

    // ============ PROJECT ============

    loadTracks: (tracks) => {
      set((state) => {
        state.tracks = tracks.map((track, index) => ({
          ...track,
          id: track.id || nanoid(),
          color:
            track.color ||
            EDITOR_THEME.dark.trackColors[
              index % EDITOR_THEME.dark.trackColors.length
            ],
          gain: track.gain ?? 1,
          muted: track.muted ?? false,
          soloed: track.soloed ?? false,
          pan: track.pan ?? 0,
          start: track.start ?? 0,
        }));
        state.currentTime = 0;
        state.selection = null;
        state.selectedTrackIds = [];
      });

      get().clearHistory();
      get().updateDuration();
    },

    reset: () => {
      set(() => ({ ...initialState }));
      history = { past: [], future: [] };
    },

    updateDuration: () => {
      const tracks = get().tracks;
      let maxDuration = 0;

      tracks.forEach((track) => {
        const trackEnd = (track.start || 0) + (track.duration || 0);
        if (trackEnd > maxDuration) {
          maxDuration = trackEnd;
        }
      });

      // Add a small buffer at the end
      set((state) => {
        state.duration = Math.max(maxDuration + 5, 30);
      });
    },
  }))
);

// ============ SELECTORS ============

export const selectTracks = (state: EditorState) => state.tracks;
export const selectCurrentTime = (state: EditorState) => state.currentTime;
export const selectPlayState = (state: EditorState) => state.playState;
export const selectZoom = (state: EditorState) => state.zoom;
export const selectSelection = (state: EditorState) => state.selection;
export const selectSelectedTrackIds = (state: EditorState) =>
  state.selectedTrackIds;
export const selectMarkers = (state: EditorState) => state.markers;
export const selectCanUndo = (state: EditorState) => state.canUndo;
export const selectCanRedo = (state: EditorState) => state.canRedo;

// Computed selectors
export const selectActiveTracks = (state: EditorState) => {
  const hasSoloedTrack = state.tracks.some((t) => t.soloed);
  return state.tracks.filter((track) => {
    if (track.muted) return false;
    if (hasSoloedTrack && !track.soloed) return false;
    return true;
  });
};

export const selectTrackById = (state: EditorState, trackId: string) =>
  state.tracks.find((t) => t.id === trackId);
