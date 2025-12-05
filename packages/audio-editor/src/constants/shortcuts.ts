// Raccourcis clavier pour l'éditeur audio multitrack
// Inspirés des DAW professionnels (Pro Tools, Audacity, Reaper)
// Optimisés pour le workflow radio : I/O pour sélection, X pour CUT

export const KEYBOARD_SHORTCUTS = {
  // ============ TRANSPORT ============
  PLAY_PAUSE: 'Space',
  STOP: 'Escape',
  REWIND: 'Home',
  FAST_FORWARD: 'End',

  // Shuttle (style Avid/Pro Tools)
  SHUTTLE_BACK: 'j',
  SHUTTLE_STOP: 'k',
  SHUTTLE_FORWARD: 'l',

  // Navigation fine
  FRAME_BACK: ',',
  FRAME_FORWARD: '.',
  JUMP_BACK_5S: 'ArrowLeft',
  JUMP_FORWARD_5S: 'ArrowRight',

  // ============ SÉLECTION (workflow radio I/O) ============
  SET_IN_POINT: 'i',        // Définir point IN (début sélection)
  SET_OUT_POINT: 'o',       // Définir point OUT (fin sélection)
  GO_TO_IN_POINT: 'shift+i',
  GO_TO_OUT_POINT: 'shift+o',
  CLEAR_SELECTION: 'Escape',
  SELECT_ALL: 'mod+a',
  DESELECT: 'mod+d',

  // ============ ÉDITION (CUT = supprimer la sélection) ============
  CUT_SELECTION: ['x', 'Delete', 'Backspace'], // CUT = supprimer la sélection
  SPLIT: 's',                                   // Diviser à la position
  TRIM_TO_SELECTION: 't',                       // Garder uniquement la sélection

  // Legacy (pour compatibilité clipboard)
  COPY: 'mod+c',
  PASTE: 'mod+v',

  // ============ HISTORIQUE ============
  UNDO: 'mod+z',
  REDO: ['mod+shift+z', 'mod+y'],

  // ============ ZOOM ============
  ZOOM_IN: ['mod+=', 'mod+plus', '='],
  ZOOM_OUT: ['mod+-', '-'],
  ZOOM_FIT: 'mod+0',

  // ============ PISTES ============
  MUTE_TRACK: 'm',
  SOLO_TRACK: 'mod+m',

  // ============ MARQUEURS ============
  ADD_MARKER: 'b',
  NEXT_MARKER: ']',
  PREV_MARKER: '[',

  // ============ SAUVEGARDE ============
  SAVE: 'mod+s',
  EXPORT: 'mod+e',

  // ============ UI ============
  SHOW_SHORTCUTS: '?',
  FULLSCREEN: 'f',
} as const;

// Descriptions des raccourcis pour l'UI
export const SHORTCUT_DESCRIPTIONS: Record<string, string> = {
  // Transport
  PLAY_PAUSE: 'Lecture / Pause',
  STOP: 'Stop (retour au début)',
  REWIND: 'Retour au début',
  FAST_FORWARD: 'Aller à la fin',
  SHUTTLE_BACK: 'Recul rapide (J/K/L)',
  SHUTTLE_STOP: 'Stop shuttle',
  SHUTTLE_FORWARD: 'Avance rapide (J/K/L)',
  FRAME_BACK: 'Reculer de 0.1s',
  FRAME_FORWARD: 'Avancer de 0.1s',
  JUMP_BACK_5S: 'Reculer de 5s',
  JUMP_FORWARD_5S: 'Avancer de 5s',

  // Sélection
  SET_IN_POINT: 'Définir point IN (début)',
  SET_OUT_POINT: 'Définir point OUT (fin)',
  GO_TO_IN_POINT: 'Aller au point IN',
  GO_TO_OUT_POINT: 'Aller au point OUT',
  CLEAR_SELECTION: 'Annuler la sélection',
  SELECT_ALL: 'Tout sélectionner',
  DESELECT: 'Désélectionner',

  // Édition
  CUT_SELECTION: 'Couper (supprimer) la sélection',
  SPLIT: 'Diviser à la position du curseur',
  TRIM_TO_SELECTION: 'Garder uniquement la sélection',
  COPY: 'Copier',
  PASTE: 'Coller',

  // Historique
  UNDO: 'Annuler',
  REDO: 'Rétablir',

  // Zoom
  ZOOM_IN: 'Zoom avant',
  ZOOM_OUT: 'Zoom arrière',
  ZOOM_FIT: 'Ajuster à la fenêtre',

  // Pistes
  MUTE_TRACK: 'Mute piste active',
  SOLO_TRACK: 'Solo piste active',

  // Marqueurs
  ADD_MARKER: 'Ajouter un marqueur',
  NEXT_MARKER: 'Aller au marqueur suivant',
  PREV_MARKER: 'Aller au marqueur précédent',

  // Sauvegarde
  SAVE: 'Sauvegarder le projet',
  EXPORT: 'Exporter l\'audio',

  // UI
  SHOW_SHORTCUTS: 'Afficher les raccourcis',
  FULLSCREEN: 'Plein écran',
};

// Theme couleurs pour l'éditeur (dark mode adapté à la régie)
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
    selectionBorder: '#3B82F6',
    cursor: '#F59E0B', // amber-500
    playhead: '#EF4444', // red-500

    text: '#F8FAFC', // slate-50
    textMuted: '#94A3B8', // slate-400
    textDim: '#64748B', // slate-500

    mute: '#EF4444', // red-500
    solo: '#22C55E', // green-500
    record: '#DC2626', // red-600

    inPoint: '#22C55E', // green-500
    outPoint: '#EF4444', // red-500

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
    selectionBorder: '#2563EB',
    cursor: '#D97706', // amber-600
    playhead: '#DC2626', // red-600

    text: '#0F172A', // slate-900
    textMuted: '#64748B', // slate-500
    textDim: '#94A3B8', // slate-400

    mute: '#DC2626', // red-600
    solo: '#16A34A', // green-600
    record: '#B91C1C', // red-700

    inPoint: '#16A34A', // green-600
    outPoint: '#DC2626', // red-600

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
  crossfadeDuration: 0.01, // 10ms pour éviter les clics aux points de coupe
} as const;

// Groupes de raccourcis pour l'affichage dans l'aide
export const SHORTCUT_GROUPS = {
  transport: ['PLAY_PAUSE', 'STOP', 'SHUTTLE_BACK', 'SHUTTLE_STOP', 'SHUTTLE_FORWARD', 'JUMP_BACK_5S', 'JUMP_FORWARD_5S'],
  selection: ['SET_IN_POINT', 'SET_OUT_POINT', 'GO_TO_IN_POINT', 'GO_TO_OUT_POINT', 'CLEAR_SELECTION'],
  editing: ['CUT_SELECTION', 'SPLIT', 'TRIM_TO_SELECTION', 'UNDO', 'REDO'],
  zoom: ['ZOOM_IN', 'ZOOM_OUT', 'ZOOM_FIT'],
  tracks: ['MUTE_TRACK', 'SOLO_TRACK'],
  markers: ['ADD_MARKER', 'NEXT_MARKER', 'PREV_MARKER'],
  file: ['SAVE', 'EXPORT'],
} as const;
