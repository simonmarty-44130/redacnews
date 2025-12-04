// Main component
export { MultitrackEditor } from './components/MultitrackEditor';

// Individual components
export { TransportControls } from './components/TransportControls';
export { Toolbar } from './components/Toolbar';
export { TrackControls, TrackList } from './components/TrackControls';
export { Timeline, WaveformContainer } from './components/Timeline';
export { ExportDialog } from './components/ExportDialog';

// Hooks
export { useTransport } from './hooks/useTransport';
export type { UseTransportReturn } from './hooks/useTransport';
export { useSelection } from './hooks/useSelection';
export type { UseSelectionReturn } from './hooks/useSelection';
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
  // New types for region-based editing
  AudioRegion,
  SelectionMode,
} from './types/editor.types';

// RegionRenderInfo is defined in region-utils
export type { RegionRenderInfo } from './utils/region-utils';

// Operations (non-destructive editing)
export { cutSelection } from './operations/cut';
export { splitAtPosition } from './operations/split';
export { trimToSelection } from './operations/trim';
export { deleteRegion } from './operations/delete-region';
export { mergeRegions } from './operations/merge-regions';

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

// Region utilities (non-destructive editing)
export {
  montedTimeToOriginal,
  originalTimeToMonted,
  getMontedDuration,
  getRegionsRenderInfo,
} from './utils/region-utils';

export {
  exportTrackWithRegions,
  calculateRegionsDuration,
  exportWithRegions,
} from './utils/export-regions';

export { generateId } from './utils/id';

// Effects - Exports désactivés pour éviter les warnings Tone.js ESM
// Ces fonctions sont utilisables en interne par MultitrackEditor
// Pour les réactiver: importer directement depuis './effects/compressor' etc.
//
// export {
//   createCompressor,
//   createBroadcastCompressor,
//   createBroadcastChain,
//   compressBuffer,
//   COMPRESSOR_PRESETS,
// } from './effects/compressor';
//
// export {
//   calculateLUFS,
//   normalizeToLUFS,
//   normalizeToPeak,
//   analyzeAudio,
// } from './effects/normalizer';
//
// export {
//   createEQ3,
//   applyEQToBuffer,
//   createNoiseGate,
//   applyNoiseGate,
//   EQ_PRESETS,
// } from './effects/eq-presets';
