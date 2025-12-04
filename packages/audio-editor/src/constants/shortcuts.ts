// Raccourcis clavier pour l'editeur audio multitrack
// Inspires des DAW professionnels (Pro Tools, Audacity, Reaper)

export const KEYBOARD_SHORTCUTS = {
  // Transport
  PLAY_PAUSE: 'Space',
  STOP: 'Escape',
  REWIND: 'Home',
  FAST_FORWARD: 'End',

  // Shuttle (style Avid/Pro Tools)
  SHUTTLE_BACK: 'j',
  SHUTTLE_STOP: 'k',
  SHUTTLE_FORWARD: 'l',

  // Edition
  CUT: 'mod+x',
  COPY: 'mod+c',
  PASTE: 'mod+v',
  DELETE: ['Delete', 'Backspace'],
  SELECT_ALL: 'mod+a',
  DESELECT: 'mod+d',

  // Actions
  UNDO: 'mod+z',
  REDO: ['mod+shift+z', 'mod+y'],
  SPLIT: 's',
  TRIM_TO_SELECTION: 't',

  // Cue points
  SET_CUE_IN: 'i',
  SET_CUE_OUT: 'o',
  GO_TO_CUE_IN: 'shift+i',
  GO_TO_CUE_OUT: 'shift+o',

  // Zoom
  ZOOM_IN: ['mod+=', 'mod+plus'],
  ZOOM_OUT: 'mod+-',
  ZOOM_FIT: 'mod+0',

  // Pistes
  MUTE_TRACK: 'm',
  SOLO_TRACK: 'mod+m',

  // Sauvegarde
  SAVE: 'mod+s',
  EXPORT: 'mod+e',
} as const;

// Descriptions des raccourcis pour l'UI
export const SHORTCUT_DESCRIPTIONS: Record<string, string> = {
  PLAY_PAUSE: 'Lecture / Pause',
  STOP: 'Stop',
  REWIND: 'Retour au debut',
  FAST_FORWARD: 'Aller a la fin',
  SHUTTLE_BACK: 'Retour rapide (J/K/L)',
  SHUTTLE_STOP: 'Stop shuttle',
  SHUTTLE_FORWARD: 'Avance rapide (J/K/L)',
  CUT: 'Couper',
  COPY: 'Copier',
  PASTE: 'Coller',
  DELETE: 'Supprimer',
  SELECT_ALL: 'Tout selectionner',
  DESELECT: 'Deselectionner',
  UNDO: 'Annuler',
  REDO: 'Retablir',
  SPLIT: 'Couper a la position',
  TRIM_TO_SELECTION: 'Rogner a la selection',
  SET_CUE_IN: 'Definir point de debut',
  SET_CUE_OUT: 'Definir point de fin',
  GO_TO_CUE_IN: 'Aller au point de debut',
  GO_TO_CUE_OUT: 'Aller au point de fin',
  ZOOM_IN: 'Zoom avant',
  ZOOM_OUT: 'Zoom arriere',
  ZOOM_FIT: 'Ajuster a la fenetre',
  MUTE_TRACK: 'Mute piste',
  SOLO_TRACK: 'Solo piste',
  SAVE: 'Sauvegarder',
  EXPORT: 'Exporter',
};

// Theme couleurs pour l'editeur (dark mode adapte a la regie)
export const EDITOR_THEME = {
  dark: {
    background: '#0F172A', // slate-900
    surface: '#1E293B', // slate-800
    surfaceHover: '#334155', // slate-700
    border: '#475569', // slate-600

    waveform: '#3B82F6', // blue-500
    waveformBackground: '#1E3A5F',
    waveformSelected: '#60A5FA', // blue-400

    selection: 'rgba(59, 130, 246, 0.3)', // blue-500/30
    cursor: '#F59E0B', // amber-500
    playhead: '#EF4444', // red-500

    text: '#F8FAFC', // slate-50
    textMuted: '#94A3B8', // slate-400
    textDim: '#64748B', // slate-500

    mute: '#EF4444', // red-500
    solo: '#22C55E', // green-500
    record: '#DC2626', // red-600

    trackColors: [
      '#3B82F6', // blue-500
      '#EF4444', // red-500
      '#10B981', // emerald-500
      '#F59E0B', // amber-500
      '#8B5CF6', // violet-500
      '#EC4899', // pink-500
      '#06B6D4', // cyan-500
      '#84CC16', // lime-500
    ],
  },
  light: {
    background: '#F8FAFC', // slate-50
    surface: '#FFFFFF',
    surfaceHover: '#F1F5F9', // slate-100
    border: '#E2E8F0', // slate-200

    waveform: '#2563EB', // blue-600
    waveformBackground: '#DBEAFE', // blue-100
    waveformSelected: '#1D4ED8', // blue-700

    selection: 'rgba(37, 99, 235, 0.2)', // blue-600/20
    cursor: '#D97706', // amber-600
    playhead: '#DC2626', // red-600

    text: '#0F172A', // slate-900
    textMuted: '#64748B', // slate-500
    textDim: '#94A3B8', // slate-400

    mute: '#DC2626', // red-600
    solo: '#16A34A', // green-600
    record: '#B91C1C', // red-700

    trackColors: [
      '#2563EB', // blue-600
      '#DC2626', // red-600
      '#059669', // emerald-600
      '#D97706', // amber-600
      '#7C3AED', // violet-600
      '#DB2777', // pink-600
      '#0891B2', // cyan-600
      '#65A30D', // lime-600
    ],
  },
} as const;

// Zoom levels en pixels par seconde
export const ZOOM_LEVELS = [10, 25, 50, 100, 150, 200, 300, 500] as const;

// Default values
export const DEFAULTS = {
  sampleRate: 44100,
  zoom: 100, // pixels per second
  waveHeight: 100,
  trackControlsWidth: 180,
  timelineHeight: 30,
  minTrackHeight: 80,
  maxTracks: 16,
  maxHistorySize: 50,
  autoSaveInterval: 30000, // 30 secondes
} as const;
