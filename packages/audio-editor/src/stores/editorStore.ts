import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  Track,
  AudioRegion,
  Selection,
  CuePoints,
  Marker,
  PlayState,
  SelectionMode,
  EditorState,
  HistoryEntry,
  FadeConfig,
} from '../types/editor.types';
import { cutSelection } from '../operations/cut';
import { splitAtPosition } from '../operations/split';
import { deleteRegion } from '../operations/delete-region';
import { trimToSelection } from '../operations/trim';
import {
  getMontedDuration,
  montedTimeToOriginal,
} from '../utils/region-utils';
import { DEFAULTS, EDITOR_THEME, ZOOM_LEVELS } from '../constants/shortcuts';

// Nombre maximum d'entrées dans l'historique
const MAX_HISTORY = 50;

// ============ STORE INTERFACE ============

interface EditorActions {
  // Track management
  addTrack: (
    track: Partial<Track> & { src: string; name: string; id?: string }
  ) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  setActiveTrack: (trackId: string | null) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;

  // Region operations (non-destructive editing)
  cutSelectionAction: () => void;
  splitAtCursor: () => void;
  deleteRegionAction: (trackId: string, regionId: string) => void;
  trimToSelectionAction: () => void;

  // Selection
  setInPoint: () => void;
  setOutPoint: () => void;
  clearSelection: () => void;
  setSelection: (selection: Selection | null) => void;
  setCuePoints: (cuePoints: Partial<CuePoints>) => void;
  selectTrack: (trackId: string, addToSelection?: boolean) => void;
  deselectTrack: (trackId: string) => void;
  clearTrackSelection: () => void;

  // Transport
  setPlayState: (state: PlayState) => void;
  setCurrentTime: (time: number) => void;
  seek: (time: number) => void;

  // Markers
  addMarker: (trackId: string, time: number, label: string) => void;
  removeMarker: (trackId: string, markerId: string) => void;
  updateMarker: (
    trackId: string,
    markerId: string,
    updates: Partial<Marker>
  ) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: (action: string) => void;
  clearHistory: () => void;

  // Zoom & View
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setScrollLeft: (scrollLeft: number) => void;

  // Mix
  setTrackGain: (trackId: string, gain: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  muteAll: () => void;
  unmuteAll: () => void;

  // Fades
  setTrackFadeIn: (trackId: string, fade: FadeConfig | undefined) => void;
  setTrackFadeOut: (trackId: string, fade: FadeConfig | undefined) => void;

  // Project
  loadTracks: (
    tracks: Array<{
      id?: string;
      src: string;
      name: string;
      originalDuration?: number;
    }>
  ) => void;
  reset: () => void;
  recalculateMontedDuration: () => void;
  setDuration: (duration: number) => void;

  // Getters
  getActiveTrack: () => Track | null;
}

// ============ INITIAL STATE ============

const initialState: EditorState = {
  tracks: [],
  activeTrackId: null,
  playState: 'stopped',
  currentTime: 0,
  selection: null,
  selectionMode: 'none',
  inPoint: null,
  outPoint: null,
  cuePoints: {},
  zoom: DEFAULTS.zoom,
  scrollLeft: 0,
  showWaveformOverview: true,
  snapToGrid: false,
  gridSize: 1,
  montedDuration: 0,
  duration: 0,                   // Backwards compatibility alias
  sampleRate: DEFAULTS.sampleRate,
  canUndo: false,
  canRedo: false,
  selectedTrackIds: [],
  markers: [],
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

      // Par défaut, créer une région qui couvre tout le fichier original
      const originalDuration = trackData.originalDuration || 0;
      const initialRegion: AudioRegion = {
        id: nanoid(),
        startTime: 0,
        endTime: originalDuration,
        duration: originalDuration,
      };

      const newTrack: Track = {
        id,
        src: trackData.src,
        name: trackData.name,
        originalDuration,
        regions: originalDuration > 0 ? [initialRegion] : [],
        markers: trackData.markers || [],
        gain: trackData.gain ?? 1,
        pan: trackData.pan ?? 0,
        muted: trackData.muted ?? false,
        soloed: trackData.soloed ?? false,
        color,
        peaks: trackData.peaks,
      };

      set((state) => {
        state.tracks.push(newTrack);
        if (!state.activeTrackId) {
          state.activeTrackId = newTrack.id;
        }
      });

      get().pushHistory(`Ajout piste: ${newTrack.name}`);
      get().recalculateMontedDuration();

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
        if (state.activeTrackId === trackId) {
          state.activeTrackId = state.tracks[0]?.id ?? null;
        }
      });

      get().pushHistory(`Suppression piste: ${track.name}`);
      get().recalculateMontedDuration();
    },

    updateTrack: (trackId, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      });
      get().recalculateMontedDuration();
    },

    setActiveTrack: (trackId) => {
      set((state) => {
        state.activeTrackId = trackId;
      });
    },

    reorderTracks: (fromIndex, toIndex) => {
      set((state) => {
        const [removed] = state.tracks.splice(fromIndex, 1);
        state.tracks.splice(toIndex, 0, removed);
      });
      get().pushHistory('Réorganisation pistes');
    },

    // ============ REGION OPERATIONS (NON-DESTRUCTIVE) ============

    cutSelectionAction: () => {
      const { activeTrackId, inPoint, outPoint, tracks } = get();

      if (!activeTrackId || inPoint === null || outPoint === null) {
        console.warn('Cut: pas de sélection valide');
        return;
      }

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track) return;

      // Convertir les points montés vers l'original
      const origStart = montedTimeToOriginal(track, Math.min(inPoint, outPoint));
      const origEnd = montedTimeToOriginal(track, Math.max(inPoint, outPoint));

      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex] = cutSelection(
            state.tracks[trackIndex],
            origStart.originalTime,
            origEnd.originalTime
          );
        }
        // Réinitialiser la sélection
        state.inPoint = null;
        state.outPoint = null;
        state.selection = null;
        state.selectionMode = 'none';
      });

      get().recalculateMontedDuration();
      get().pushHistory('Cut sélection');
    },

    splitAtCursor: () => {
      const { activeTrackId, currentTime, tracks } = get();

      if (!activeTrackId) return;

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track) return;

      // Convertir le temps monté en temps original
      const { originalTime } = montedTimeToOriginal(track, currentTime);

      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex] = splitAtPosition(
            state.tracks[trackIndex],
            originalTime
          );
        }
      });

      get().pushHistory('Split à la position');
    },

    deleteRegionAction: (trackId, regionId) => {
      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === trackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex] = deleteRegion(
            state.tracks[trackIndex],
            regionId
          );
        }
      });
      get().recalculateMontedDuration();
      get().pushHistory('Suppression région');
    },

    trimToSelectionAction: () => {
      const { activeTrackId, inPoint, outPoint, tracks } = get();

      if (!activeTrackId || inPoint === null || outPoint === null) {
        console.warn('Trim: pas de sélection valide');
        return;
      }

      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track) return;

      const start = Math.min(inPoint, outPoint);
      const end = Math.max(inPoint, outPoint);

      // Convertir vers temps original
      const origStart = montedTimeToOriginal(track, start);
      const origEnd = montedTimeToOriginal(track, end);

      set((state) => {
        const trackIndex = state.tracks.findIndex((t) => t.id === activeTrackId);
        if (trackIndex !== -1) {
          state.tracks[trackIndex] = trimToSelection(
            state.tracks[trackIndex],
            origStart.originalTime,
            origEnd.originalTime
          );
        }
        state.inPoint = null;
        state.outPoint = null;
        state.selection = null;
        state.selectionMode = 'none';
      });

      get().recalculateMontedDuration();
      get().pushHistory('Trim vers sélection');
    },

    // ============ SELECTION ============

    setInPoint: () => {
      const { currentTime } = get();
      set((state) => {
        state.inPoint = currentTime;
        state.selectionMode = 'selecting';
        // Mettre à jour cuePoints aussi
        state.cuePoints.cueIn = currentTime;
      });
    },

    setOutPoint: () => {
      const { currentTime, inPoint, activeTrackId, tracks } = get();

      set((state) => {
        state.outPoint = currentTime;
        state.selectionMode = 'selected';
        state.cuePoints.cueOut = currentTime;

        // Créer l'objet sélection
        if (inPoint !== null && activeTrackId) {
          const start = Math.min(inPoint, currentTime);
          const end = Math.max(inPoint, currentTime);

          const track = tracks.find((t) => t.id === activeTrackId);
          if (track) {
            const origStart = montedTimeToOriginal(track, start);
            const origEnd = montedTimeToOriginal(track, end);

            state.selection = {
              trackId: activeTrackId,
              startTime: start,
              endTime: end,
              originalStartTime: origStart.originalTime,
              originalEndTime: origEnd.originalTime,
              // Legacy aliases for backwards compatibility
              start,
              end,
            };
          }
        }
      });
    },

    clearSelection: () => {
      set((state) => {
        state.inPoint = null;
        state.outPoint = null;
        state.selection = null;
        state.selectionMode = 'none';
      });
    },

    setSelection: (selection) => {
      set((state) => {
        state.selection = selection;
        state.selectionMode = selection ? 'selected' : 'none';
        if (selection) {
          // Use start/end (legacy) properties for backwards compatibility
          state.inPoint = selection.start;
          state.outPoint = selection.end;
        }
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
        state.activeTrackId = trackId;
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

    // ============ TRANSPORT ============

    setPlayState: (playState) => {
      set((state) => {
        state.playState = playState;
      });
    },

    setCurrentTime: (time) => {
      set((state) => {
        const maxTime = state.montedDuration ?? state.duration ?? 0;
        state.currentTime = Math.max(0, Math.min(time, maxTime));
      });
    },

    seek: (time) => {
      set((state) => {
        const maxTime = state.montedDuration ?? state.duration ?? 0;
        state.currentTime = Math.max(0, Math.min(time, maxTime));
      });
    },

    // ============ MARKERS ============

    addMarker: (trackId, time, label) => {
      const marker: Marker = {
        id: nanoid(),
        time,
        label,
        color: EDITOR_THEME.dark.cursor,
      };

      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.markers.push(marker);
          track.markers.sort((a, b) => a.time - b.time);
        }
      });
      get().pushHistory(`Marqueur ajouté: ${label}`);
    },

    removeMarker: (trackId, markerId) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.markers = track.markers.filter((m) => m.id !== markerId);
        }
      });
      get().pushHistory('Marqueur supprimé');
    },

    updateMarker: (trackId, markerId, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const marker = track.markers.find((m) => m.id === markerId);
          if (marker) {
            Object.assign(marker, updates);
          }
        }
      });
    },

    // ============ HISTORY ============

    pushHistory: (action) => {
      const currentTracks = JSON.parse(JSON.stringify(get().tracks));

      history.past.push({
        tracks: currentTracks,
        timestamp: Date.now(),
        action,
      });

      // Limit history size
      if (history.past.length > MAX_HISTORY) {
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

      get().recalculateMontedDuration();
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

      get().recalculateMontedDuration();
    },

    clearHistory: () => {
      history = { past: [], future: [] };
      set((state) => {
        state.canUndo = false;
        state.canRedo = false;
      });
    },

    // ============ ZOOM & VIEW ============

    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(
          ZOOM_LEVELS[0],
          Math.min(zoom, ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
        );
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

    // ============ FADES ============

    setTrackFadeIn: (trackId, fade) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track && track.regions.length > 0) {
          // Apply fade to first region
          track.regions[0].fadeIn = fade;
        }
      });
      get().pushHistory('Fade in');
    },

    setTrackFadeOut: (trackId, fade) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track && track.regions.length > 0) {
          // Apply fade to last region
          track.regions[track.regions.length - 1].fadeOut = fade;
        }
      });
      get().pushHistory('Fade out');
    },

    // ============ PROJECT ============

    loadTracks: (tracksData) => {
      set((state) => {
        state.tracks = tracksData.map((trackData, index) => {
          const id = trackData.id || nanoid();
          const originalDuration = trackData.originalDuration || 0;
          const color =
            EDITOR_THEME.dark.trackColors[
              index % EDITOR_THEME.dark.trackColors.length
            ];

          // Créer une région initiale qui couvre tout le fichier
          const initialRegion: AudioRegion = {
            id: nanoid(),
            startTime: 0,
            endTime: originalDuration,
            duration: originalDuration,
          };

          return {
            id,
            name: trackData.name,
            src: trackData.src,
            originalDuration,
            regions: originalDuration > 0 ? [initialRegion] : [],
            markers: [],
            gain: 1,
            pan: 0,
            muted: false,
            soloed: false,
            color,
          };
        });

        state.currentTime = 0;
        state.selection = null;
        state.selectionMode = 'none';
        state.inPoint = null;
        state.outPoint = null;
        state.selectedTrackIds = [];
        state.activeTrackId = state.tracks[0]?.id ?? null;
      });

      get().clearHistory();
      get().recalculateMontedDuration();
    },

    reset: () => {
      set(() => ({ ...initialState }));
      history = { past: [], future: [] };
    },

    recalculateMontedDuration: () => {
      const tracks = get().tracks;
      let maxDuration = 0;

      tracks.forEach((track) => {
        const trackDuration = getMontedDuration(track);
        if (trackDuration > maxDuration) {
          maxDuration = trackDuration;
        }
      });

      set((state) => {
        state.montedDuration = Math.max(maxDuration, 1);
      });
    },

    setDuration: (duration: number) => {
      set((state) => {
        state.montedDuration = duration;
      });
    },

    // ============ GETTERS ============

    getActiveTrack: () => {
      const { tracks, activeTrackId } = get();
      return tracks.find((t) => t.id === activeTrackId) ?? null;
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
export const selectActiveTrackId = (state: EditorState) => state.activeTrackId;
export const selectMontedDuration = (state: EditorState) => state.montedDuration;
export const selectInPoint = (state: EditorState) => state.inPoint;
export const selectOutPoint = (state: EditorState) => state.outPoint;
export const selectSelectionMode = (state: EditorState) => state.selectionMode;

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

export const selectActiveTrack = (state: EditorState) =>
  state.tracks.find((t) => t.id === state.activeTrackId) ?? null;
