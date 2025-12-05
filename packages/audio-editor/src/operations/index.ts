/**
 * Operations - Architecture DESTRUCTIVE
 *
 * Toutes les opérations modifient directement l'AudioBuffer en mémoire.
 */

export {
  cutAudioBuffer,
  cloneAudioBuffer,
  trimAudioBuffer,
  audioBufferToWav,
  applyFadeIn,
  applyFadeOut,
  normalizeAudioBuffer,
} from './cut';
