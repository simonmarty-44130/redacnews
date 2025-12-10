// apps/web/lib/audio-montage/constants.ts

export const TRACK_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
] as const;

export const DEFAULT_ZOOM = 50; // pixels par seconde
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 200;

export const TRACK_HEIGHT = 96; // px
export const TRACK_CONTROLS_WIDTH = 180; // px
export const TIMELINE_RULER_HEIGHT = 32; // px

export const SNAP_TO_GRID = 0.1; // secondes (pour le snap à la grille)
export const SNAP_THRESHOLD_PX = 10; // pixels - distance pour activer le snap vers les clips

// Couleurs de waveform par defaut
export const WAVEFORM_COLOR = 'rgba(59, 130, 246, 0.7)';
export const WAVEFORM_PLAYED_COLOR = 'rgba(59, 130, 246, 1)';

// Durees par defaut
export const DEFAULT_FADE_DURATION = 0.5; // secondes
export const MIN_CLIP_DURATION = 0.1; // secondes

// Raccourcis clavier
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ', // Espace
  STOP: 'Escape',
  DELETE: 'Delete',
  COPY: 'c',
  PASTE: 'v',
  CUT: 'x',
  UNDO: 'z',
  REDO: 'y',
  ZOOM_IN: '+',
  ZOOM_OUT: '-',
  SELECT_ALL: 'a',
} as const;

// Nombre maximum de pistes
export const MAX_TRACKS = 3;

// Pistes fixes par défaut
export const DEFAULT_TRACKS = [
  {
    id: 'rush-a',
    name: 'Rush A',
    color: '#3b82f6', // Bleu
    volume: 1,
    muted: false,
    solo: false,
    pan: 0,
  },
  {
    id: 'rush-b',
    name: 'Rush B',
    color: '#10b981', // Vert
    volume: 1,
    muted: false,
    solo: false,
    pan: 0,
  },
  {
    id: 'voix-off',
    name: 'Voix-off',
    color: '#f59e0b', // Orange
    volume: 1,
    muted: false,
    solo: false,
    pan: 0,
  },
] as const;

// Mode pistes fixes (désactive ajout/suppression de pistes)
export const FIXED_TRACKS_MODE = true;

// Formats d'export supportes
export const EXPORT_FORMATS = ['wav', 'mp3'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Sample rate par defaut pour l'export
export const DEFAULT_SAMPLE_RATE = 44100;
