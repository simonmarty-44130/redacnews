import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Project, Track, Clip, EditorState } from '../types';

interface EditorActions {
  // Project
  createProject: (name: string) => void;
  loadProject: (project: Project) => void;

  // Tracks
  addTrack: (name?: string) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // Clips
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;

  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;

  // Selection
  selectClip: (clipId: string, addToSelection?: boolean) => void;
  selectTrack: (trackId: string) => void;
  clearSelection: () => void;

  // View
  setZoom: (zoom: number) => void;
}

const TRACK_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set) => ({
    // Initial state
    project: null,
    currentTime: 0,
    isPlaying: false,
    zoom: 50,
    selectedClipIds: [],
    selectedTrackId: null,

    // Project actions
    createProject: (name) => {
      set((state) => {
        state.project = {
          id: nanoid(),
          name,
          duration: 300, // 5 minutes par defaut
          sampleRate: 44100,
          tracks: [],
        };
      });
    },

    loadProject: (project) => {
      set((state) => {
        state.project = project;
        state.currentTime = 0;
        state.isPlaying = false;
        state.selectedClipIds = [];
        state.selectedTrackId = null;
      });
    },

    // Track actions
    addTrack: (name) => {
      set((state) => {
        if (!state.project) return;

        const trackIndex = state.project.tracks.length;
        state.project.tracks.push({
          id: nanoid(),
          name: name || `Piste ${trackIndex + 1}`,
          color: TRACK_COLORS[trackIndex % TRACK_COLORS.length],
          volume: 1,
          pan: 0,
          mute: false,
          solo: false,
          clips: [],
        });
      });
    },

    removeTrack: (trackId) => {
      set((state) => {
        if (!state.project) return;
        state.project.tracks = state.project.tracks.filter(
          (t) => t.id !== trackId
        );
      });
    },

    updateTrack: (trackId, updates) => {
      set((state) => {
        if (!state.project) return;
        const track = state.project.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      });
    },

    // Clip actions
    addClip: (trackId, clipData) => {
      set((state) => {
        if (!state.project) return;
        const track = state.project.tracks.find((t) => t.id === trackId);
        if (track) {
          track.clips.push({
            ...clipData,
            id: nanoid(),
            trackId,
          });
        }
      });
    },

    removeClip: (clipId) => {
      set((state) => {
        if (!state.project) return;
        for (const track of state.project.tracks) {
          track.clips = track.clips.filter((c) => c.id !== clipId);
        }
        state.selectedClipIds = state.selectedClipIds.filter(
          (id) => id !== clipId
        );
      });
    },

    moveClip: (clipId, newTrackId, newStartTime) => {
      set((state) => {
        if (!state.project) return;

        let clip: Clip | undefined;

        // Remove from current track
        for (const track of state.project.tracks) {
          const index = track.clips.findIndex((c) => c.id === clipId);
          if (index !== -1) {
            clip = track.clips.splice(index, 1)[0];
            break;
          }
        }

        // Add to new track
        if (clip) {
          const newTrack = state.project.tracks.find(
            (t) => t.id === newTrackId
          );
          if (newTrack) {
            clip.trackId = newTrackId;
            clip.startTime = Math.max(0, newStartTime);
            newTrack.clips.push(clip);
          }
        }
      });
    },

    // Playback actions
    play: () =>
      set((state) => {
        state.isPlaying = true;
      }),
    pause: () =>
      set((state) => {
        state.isPlaying = false;
      }),
    stop: () =>
      set((state) => {
        state.isPlaying = false;
        state.currentTime = 0;
      }),
    seek: (time) =>
      set((state) => {
        state.currentTime = Math.max(0, time);
      }),

    // Selection actions
    selectClip: (clipId, addToSelection = false) => {
      set((state) => {
        if (addToSelection) {
          if (!state.selectedClipIds.includes(clipId)) {
            state.selectedClipIds.push(clipId);
          }
        } else {
          state.selectedClipIds = [clipId];
        }
      });
    },

    selectTrack: (trackId) => {
      set((state) => {
        state.selectedTrackId = trackId;
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedClipIds = [];
        state.selectedTrackId = null;
      });
    },

    // View actions
    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(10, Math.min(200, zoom));
      });
    },
  }))
);
