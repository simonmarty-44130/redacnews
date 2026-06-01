/**
 * Mini-éditeur audio (port de Tanguy) — point d'entrée public.
 * MVP 0 : fondations audio pures (pas d'UI).
 */
export type {
  Track,
  Selection,
  CuePoints,
  MarkerConfig,
  ExportFormat,
  ExportOptions,
  ExportResult,
  EditorStatus,
  EditorState,
} from './types'

export {
  getAudioContext,
  resumeAudioContext,
  closeAudioContext,
} from './audio/audio-context'
export { decodeAudioFile, fetchAndDecodeAudio } from './audio/decode'
export { cutAudioBuffer, trimAudioBuffer, cloneAudioBuffer } from './audio/cut'
export { audioBufferToWav } from './audio/wav'
export { audioBufferToMp3 } from './audio/mp3'
export {
  normalizeRMS,
  computeRMS,
  computePeak,
  DEFAULT_RMS_TARGET,
} from './audio/normalize'
export { compressAudioBuffer } from './audio/compress'
export { limiterMaximize } from './audio/limiter'
export { exportAudio, downloadBlob } from './audio/export'
