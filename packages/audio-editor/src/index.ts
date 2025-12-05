// Main component
export { MultitrackEditor } from './components/MultitrackEditor';

// Individual components
export { TransportControls } from './components/TransportControls';
export { Toolbar } from './components/Toolbar';
export { TrackControls, TrackList } from './components/TrackControls';
export { Timeline, WaveformContainer } from './components/Timeline';
export { ExportDialog } from './components/ExportDialog';

// Hooks
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { KeyboardShortcutHandlers } from './hooks/useKeyboardShortcuts';
export { useRecording } from './hooks/useRecording';
export type { UseRecordingReturn } from './hooks/useRecording';
export { useExport, DEFAULT_EXPORT_OPTIONS, MP3_EXPORT_OPTIONS, HQ_WAV_EXPORT_OPTIONS } from './hooks/useExport';
export type { UseExportReturn } from './hooks/useExport';
export { usePeaks } from './hooks/usePeaks';
export type { UsePeaksReturn } from './hooks/usePeaks';

// Store
export { useEditorStore } from './stores/editorStore';
export {
  selectTracks,
  selectCurrentTime,
  selectIsPlaying,
  selectZoom,
  selectSelection,
  selectCanUndo,
  selectCanRedo,
  selectActiveTrack,
  selectActiveTrackId,
  selectDuration,
  selectInPoint,
  selectOutPoint,
} from './stores/editorStore';

// Types
export type {
  Track,
  Selection,
  CuePoints,
  Marker,
  PlayState,
  EditorState,
  FadeShape,
  FadeConfig,
  HistoryEntry,
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportMetadata,
  MultitrackEditorProps,
  MultitrackEditorRef,
  PlaylistTrack,
  PlaylistOptions,
  CompressorSettings,
  EQBand,
  EQPreset,
  ActionType,
  // Legacy types kept for compatibility
  AudioRegion,
  SelectionMode,
} from './types/editor.types';

// Operations (DESTRUCTIVE editing)
export {
  cutAudioBuffer,
  cloneAudioBuffer,
  trimAudioBuffer,
  audioBufferToWav,
  applyFadeIn,
  applyFadeOut,
  normalizeAudioBuffer,
} from './operations/cut';

// Constants
export {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_DESCRIPTIONS,
  EDITOR_THEME,
  ZOOM_LEVELS,
  DEFAULTS,
  SHORTCUT_GROUPS,
} from './constants/shortcuts';

// Utils
export {
  formatTime,
  formatTimeLong,
  parseTime,
  formatDurationCompact,
  pixelsToTime,
  timeToPixels,
  snapTime,
  generateTimelineMarkers,
  estimateReadingTime,
} from './utils/time-format';

export {
  decodeAudioFile,
  fetchAndDecodeAudio,
  calculatePeaks,
  normalizeBuffer,
  calculateRMS,
  calculatePeakLevel,
  applyFadeIn as applyFadeInBuffer,
  applyFadeOut as applyFadeOutBuffer,
  mixBuffers,
  detectSilences,
  sliceBuffer,
} from './utils/audio-processing';

export {
  audioBufferToWav as exportToWav,
  audioBufferToMp3,
  exportAudioBuffer,
  downloadBlob,
  formatFileSize,
  estimateFileSize,
} from './utils/export-utils';

export {
  exportWithRegions,
  calculateRegionsDuration,
  exportTrackToWav,
} from './utils/export-regions';

export { generateId } from './utils/id';
