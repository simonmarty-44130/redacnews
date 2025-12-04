// Main component
export { MultitrackEditor } from './components/MultitrackEditor';

// Individual components
export { TransportControls } from './components/TransportControls';
export { Toolbar } from './components/Toolbar';
export { TrackControls, TrackList } from './components/TrackControls';
export { Timeline, WaveformContainer } from './components/Timeline';
export { ExportDialog } from './components/ExportDialog';

// Hooks
export { usePlaylist } from './hooks/usePlaylist';
export type { UsePlaylistReturn } from './hooks/usePlaylist';
export { useTransport } from './hooks/useTransport';
export type { UseTransportReturn } from './hooks/useTransport';
export { useSelection } from './hooks/useSelection';
export type { UseSelectionReturn } from './hooks/useSelection';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export { useRecording } from './hooks/useRecording';
export type { UseRecordingReturn } from './hooks/useRecording';
export { useExport, DEFAULT_EXPORT_OPTIONS, MP3_EXPORT_OPTIONS, HQ_WAV_EXPORT_OPTIONS } from './hooks/useExport';
export type { UseExportReturn } from './hooks/useExport';

// Store
export { useEditorStore } from './stores/editorStore';
export {
  selectTracks,
  selectCurrentTime,
  selectPlayState,
  selectZoom,
  selectSelection,
  selectSelectedTrackIds,
  selectMarkers,
  selectCanUndo,
  selectCanRedo,
  selectActiveTracks,
  selectTrackById,
} from './stores/editorStore';

// Types
export type {
  Track,
  Clip,
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
} from './types/editor.types';

// Constants
export {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_DESCRIPTIONS,
  EDITOR_THEME,
  ZOOM_LEVELS,
  DEFAULTS,
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
  applyFadeIn,
  applyFadeOut,
  mixBuffers,
  detectSilences,
  sliceBuffer,
} from './utils/audio-processing';

export {
  audioBufferToWav,
  audioBufferToMp3,
  exportAudioBuffer,
  downloadBlob,
  formatFileSize,
  estimateFileSize,
} from './utils/export-utils';

// Effects
export {
  createCompressor,
  createBroadcastCompressor,
  createBroadcastChain,
  compressBuffer,
  COMPRESSOR_PRESETS,
} from './effects/compressor';

export {
  calculateLUFS,
  normalizeToLUFS,
  normalizeToPeak,
  analyzeAudio,
} from './effects/normalizer';

export {
  createEQ3,
  applyEQToBuffer,
  createNoiseGate,
  applyNoiseGate,
  EQ_PRESETS,
} from './effects/eq-presets';
