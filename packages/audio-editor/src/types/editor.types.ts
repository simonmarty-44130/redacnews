// ============================================
// TYPES PRINCIPAUX - ARCHITECTURE NON-DESTRUCTIVE
// ============================================

/**
 * Une région représente un segment audio à GARDER
 * C'est la brique de base de l'édition non-destructive
 *
 * L'audio original n'est JAMAIS modifié.
 * Les régions définissent quelles parties de l'original sont conservées.
 */
export interface AudioRegion {
  id: string;
  startTime: number;        // Début dans le fichier ORIGINAL (secondes)
  endTime: number;          // Fin dans le fichier ORIGINAL (secondes)
  // Calculé
  duration: number;         // endTime - startTime
  // Optionnel
  label?: string;
  color?: string;
  // Fades
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}

export type FadeShape = 'linear' | 'logarithmic' | 'sCurve' | 'exponential';

export interface FadeConfig {
  shape: FadeShape;
  duration: number; // secondes
}

/**
 * Un marqueur est un point de repère sur la timeline
 * (sans effet sur le montage)
 */
export interface Marker {
  id: string;
  time: number;             // Position dans le fichier ORIGINAL
  label: string;
  color?: string;
}

/**
 * Une piste audio avec ses régions et métadonnées
 * Architecture NON-DESTRUCTIVE : l'audio original reste intact
 */
export interface Track {
  id: string;
  name: string;
  src: string;                    // URL du fichier original (S3/CloudFront)

  // New region-based architecture
  originalDuration: number;       // Durée totale du fichier original (defaults to 0)
  regions: AudioRegion[];         // Régions = parties à garder (defaults to [])
  markers: Marker[];              // Marqueurs (defaults to [])
  color: string;                  // Couleur de la piste (defaults from theme)

  // Mix (with defaults in store)
  gain: number;                   // 0 à 2 (1 = normal)
  pan: number;                    // -1 (gauche) à 1 (droite)
  muted: boolean;
  soloed: boolean;

  // Données waveform (pré-calculées)
  peaks?: number[][];

  // Legacy properties for backwards compatibility with waveform-playlist
  start?: number;                 // Position de début sur la timeline
  duration?: number;              // Durée de la piste
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}

/**
 * Sélection en cours (zone à potentiellement supprimer)
 */
export interface Selection {
  trackId?: string;
  // New naming convention
  startTime?: number;             // Dans la timeline MONTÉE
  endTime?: number;               // Dans la timeline MONTÉE
  // Correspondance dans l'original (optional for backwards compat)
  originalStartTime?: number;
  originalEndTime?: number;
  // Legacy naming for backwards compatibility
  start: number;                  // Required - legacy alias
  end: number;                    // Required - legacy alias
}

/**
 * Points In/Out pour la sélection rapide
 */
export interface CuePoints {
  cueIn?: number;   // Point IN dans le temps MONTÉ
  cueOut?: number;  // Point OUT dans le temps MONTÉ
}

/**
 * État de lecture
 */
export type PlayState = 'stopped' | 'playing' | 'paused';

/**
 * Mode de sélection
 */
export type SelectionMode = 'none' | 'selecting' | 'selected';

/**
 * État global de l'éditeur
 */
export interface EditorState {
  // Pistes
  tracks: Track[];
  activeTrackId: string | null;

  // Transport
  playState: PlayState;
  currentTime: number;            // Position dans la timeline MONTÉE

  // Sélection
  selection: Selection | null;
  selectionMode: SelectionMode;

  // Points In/Out temporaires
  inPoint: number | null;
  outPoint: number | null;
  cuePoints: CuePoints;

  // Zoom
  zoom: number;                   // Pixels par seconde
  scrollLeft: number;

  // UI
  showWaveformOverview: boolean;
  snapToGrid: boolean;
  gridSize: number;               // En secondes (0.5, 1, 5, etc.)

  // Durées
  montedDuration?: number;        // Durée du montage (somme des régions) - new
  duration: number;               // Total duration (backwards compatibility)
  sampleRate: number;

  // Historique
  canUndo: boolean;
  canRedo: boolean;

  // Sélection de pistes multiples (pour batch operations)
  selectedTrackIds: string[];

  // Marqueurs globaux
  markers: Marker[];
}

/**
 * Historique pour undo/redo
 */
export interface HistoryEntry {
  timestamp: number;
  action: string;                 // Description de l'action
  tracks: Track[];                // Snapshot des pistes
}

// ============================================
// TYPES EXPORT
// ============================================

export type ExportFormat = 'wav' | 'mp3';

/**
 * Options d'export
 */
export interface ExportOptions {
  format: ExportFormat;
  sampleRate: 44100 | 48000;
  bitDepth?: 16 | 24 | 32;        // WAV uniquement
  bitrate?: 128 | 192 | 256 | 320; // MP3 uniquement (kbps)
  normalize: boolean;
  normalizeTarget?: number;        // LUFS (ex: -16 pour radio)
  fadeInDuration?: number;         // Fade au début du fichier final
  fadeOutDuration?: number;        // Fade à la fin du fichier final
  // Crossfade automatique aux points de coupe
  crossfadeDuration?: number;      // 0 = pas de crossfade
}

/**
 * Résultat d'export
 */
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

// ============================================
// TYPES COMPONENT PROPS
// ============================================

export interface MultitrackEditorProps {
  // Données initiales
  initialTracks?: Array<{
    id?: string;
    src: string;
    name: string;
  }>;

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
  // Méthodes exposées via ref
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;

  addTrack: (track: Partial<Track> & { src: string; name: string }) => void;
  removeTrack: (trackId: string) => void;

  getState: () => EditorState;
  exportAudio: (options: ExportOptions) => Promise<ExportResult>;

  undo: () => void;
  redo: () => void;

  // Nouvelles méthodes pour l'édition non-destructive
  setInPoint: () => void;
  setOutPoint: () => void;
  cutSelection: () => void;
  splitAtCursor: () => void;
}

// ============================================
// TYPES PEAKS.JS
// ============================================

export interface PeaksOptions {
  containers: {
    overview?: HTMLElement;
    zoomview: HTMLElement;
  };
  mediaElement: HTMLAudioElement;
  webAudio?: {
    audioContext: AudioContext;
  };
  zoomWaveformColor?: string;
  overviewWaveformColor?: string;
  playheadColor?: string;
  playheadTextColor?: string;
  axisLabelColor?: string;
  axisGridlineColor?: string;
  showPlayheadTime?: boolean;
  pointMarkerColor?: string;
  createSegmentMarker?: boolean;
  createPointMarker?: boolean;
  zoomLevels?: number[];
}

// ============================================
// TYPES ÉVÉNEMENTS
// ============================================

export type EditorEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; time: number }
  | { type: 'SET_IN_POINT'; time: number }
  | { type: 'SET_OUT_POINT'; time: number }
  | { type: 'CUT_SELECTION' }
  | { type: 'SPLIT_AT_CURSOR' }
  | { type: 'DELETE_REGION'; regionId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'ZOOM_FIT' }
  | { type: 'ADD_MARKER'; time: number; label: string }
  | { type: 'DELETE_MARKER'; markerId: string }
  | { type: 'EXPORT'; options: ExportOptions };

// ============================================
// TYPES EFFECT (conservés pour compatibilité)
// ============================================

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

// ============================================
// TYPES UTILITAIRES
// ============================================

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

// ============================================
// TYPES LEGACY (pour compatibilité waveform-playlist)
// ============================================

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  sourceUrl: string;
  startTime: number;
  duration: number;
  offset: number;
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  selected?: boolean;
}

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
