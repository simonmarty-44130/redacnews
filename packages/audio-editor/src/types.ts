export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  clips: Clip[];
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  sourceUrl: string;
  startTime: number; // Position sur la timeline (secondes)
  duration: number; // Duree du clip
  offset: number; // Offset dans le fichier source
  fadeIn: number;
  fadeOut: number;
}

export interface Project {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  tracks: Track[];
}

export interface EditorState {
  project: Project | null;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipIds: string[];
  selectedTrackId: string | null;
}
