// ============ TRACK & CLIP TYPES ============

export type FadeShape = 'linear' | 'logarithmic' | 'sCurve' | 'exponential';

export interface FadeConfig {
  shape: FadeShape;
  duration: number; // secondes
}

export interface Track {
  id: string;
  src: string; // URL S3 signee ou locale
  name: string;
  start?: number; // Position sur timeline (secondes)
  gain?: number; // 0-2 (1 = normal)
  muted?: boolean;
  soloed?: boolean;
  pan?: number; // -1 (left) to 1 (right)
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  color?: string;
  // Metadonnees internes
  duration?: number;
  peaks?: number[][];
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  sourceUrl: string;
  startTime: number; // Position sur la timeline (secondes)
  duration: number; // Duree du clip
  offset: number; // Offset dans le fichier source
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  selected?: boolean;
}

// ============ SELECTION TYPES ============

export interface Selection {
  start: number; // secondes
  end: number; // secondes
}

export interface CuePoints {
  cueIn?: number;
  cueOut?: number;
}

// ============ MARKER TYPES ============

export interface Marker {
  id: string;
  time: number; // secondes
  label: string;
  color?: string;
}

// ============ EDITOR STATE TYPES ============

export type PlayState = 'stopped' | 'playing' | 'paused';

export interface EditorState {
  // Project
  tracks: Track[];
  duration: number; // duree totale (secondes)
  sampleRate: number;

  // Playback
  playState: PlayState;
  currentTime: number;

  // View
  zoom: number; // pixels per second
  scrollLeft: number;

  // Selection
  selection: Selection | null;
  cuePoints: CuePoints;
  selectedTrackIds: string[];

  // Markers
  markers: Marker[];

  // History
  canUndo: boolean;
  canRedo: boolean;
}

// ============ HISTORY/UNDO TYPES ============

export interface HistoryEntry {
  tracks: Track[];
  timestamp: number;
  action: string;
}

// ============ EXPORT TYPES ============

export type ExportFormat = 'wav' | 'mp3';

export interface ExportOptions {
  format: ExportFormat;
  sampleRate: 44100 | 48000;
  bitDepth?: 16 | 24; // WAV only
  bitrate?: 128 | 192 | 256 | 320; // MP3 only (kbps)
  normalize?: boolean;
  normalizeTarget?: number; // LUFS, ex: -16
}

export interface ExportResult {
  blob: Blob;
  duration: number;
  metadata: {
    format: string;
    sampleRate: number;
    channels: number;
    size: number;
  };
}

export interface ExportMetadata {
  title: string;
  duration: number;
  format: ExportFormat;
  sampleRate: number;
  channels: number;
}

// ============ COMPONENT PROPS ============

export interface MultitrackEditorProps {
  // Donnees
  initialTracks?: Track[];

  // Callbacks
  onSave?: (blob: Blob, metadata: ExportMetadata) => Promise<void>;
  onTracksChange?: (tracks: Track[]) => void;
  onClose?: () => void;

  // Configuration
  sampleRate?: number; // 44100 | 48000
  defaultZoom?: number; // pixels per second
  showTimecode?: boolean;

  // Styling
  className?: string;
  theme?: 'light' | 'dark';
}

export interface MultitrackEditorRef {
  // Methodes exposees via ref
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;

  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;

  getState: () => EditorState;
  exportAudio: (options: ExportOptions) => Promise<ExportResult>;

  undo: () => void;
  redo: () => void;
}

// ============ WAVEFORM-PLAYLIST TYPES ============

// Types pour waveform-playlist (pas de types officiels)
export interface PlaylistTrack {
  src: string;
  name: string;
  start?: number;
  gain?: number;
  muted?: boolean;
  soloed?: boolean;
  fadeIn?: {
    shape: string;
    duration: number;
  };
  fadeOut?: {
    shape: string;
    duration: number;
  };
  cuein?: number;
  cueout?: number;
  customClass?: string;
  waveOutlineColor?: string;
}

export interface PlaylistOptions {
  container: HTMLElement;
  samplesPerPixel?: number;
  sampleRate?: number;
  mono?: boolean;
  exclSolo?: boolean;
  timescale?: boolean;
  waveHeight?: number;
  state?: string;
  colors?: {
    waveOutlineColor?: string;
    timeColor?: string;
    fadeColor?: string;
  };
  controls?: {
    show?: boolean;
    width?: number;
  };
  seekStyle?: string;
  isAutomaticScroll?: boolean;
  zoomLevels?: number[];
}

export interface PlaylistEventMap {
  'statechange': (state: string) => void;
  'timeupdate': (time: number) => void;
  'select': (start: number, end: number, track: unknown) => void;
  'shift': (delta: number, track: unknown) => void;
  'scroll': (scrollLeft: number) => void;
  'trackschanged': (tracks: unknown[]) => void;
  'finished': () => void;
  'error': (error: Error) => void;
}

// ============ EFFECT TYPES ============

export interface CompressorSettings {
  threshold: number; // dB
  ratio: number;
  attack: number; // seconds
  release: number; // seconds
  knee: number;
}

export interface EQBand {
  frequency: number;
  gain: number; // dB
  q?: number;
}

export interface EQPreset {
  name: string;
  low: EQBand;
  mid: EQBand;
  high: EQBand;
}

// ============ UTILITY TYPES ============

export type ActionType =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'split'
  | 'trim'
  | 'fade-in'
  | 'fade-out'
  | 'normalize'
  | 'add-track'
  | 'remove-track'
  | 'move-clip'
  | 'mute'
  | 'solo'
  | 'volume'
  | 'pan';
