/**
 * Opérations de découpe — Architecture DESTRUCTIVE sur AudioBuffer.
 *
 * Chaque fonction retourne un NOUVEAU buffer (immutabilité pour l'undo/redo).
 */
import { getAudioContext } from './audio-context'

/** ~3 ms à 44.1 kHz. Indispensable : sans crossfade, clic audible au point de coupe. */
const CROSSFADE_SAMPLES = 128

/** Clone profond d'un AudioBuffer (snapshot pour l'historique). */
export function cloneAudioBuffer(source: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext()
  const clone = ctx.createBuffer(
    source.numberOfChannels,
    source.length,
    source.sampleRate,
  )
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    clone.getChannelData(channel).set(source.getChannelData(channel))
  }
  return clone
}

/**
 * Supprime la portion [startTime, endTime] : retourne avant + après recollés.
 * Applique un micro-crossfade au point de jonction pour éviter les clics.
 */
export function cutAudioBuffer(
  source: AudioBuffer,
  startTime: number,
  endTime: number,
): AudioBuffer {
  const ctx = getAudioContext()
  const { sampleRate, numberOfChannels, length } = source

  const startSample = Math.max(0, Math.min(Math.floor(startTime * sampleRate), length))
  const endSample = Math.max(startSample, Math.min(Math.floor(endTime * sampleRate), length))

  const cutLength = endSample - startSample
  const newLength = length - cutLength

  if (newLength <= 0) {
    throw new Error('Impossible de couper la totalité de l\'audio')
  }

  const result = ctx.createBuffer(numberOfChannels, newLength, sampleRate)

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const src = source.getChannelData(channel)
    const dest = result.getChannelData(channel)
    // Avant la sélection
    for (let i = 0; i < startSample; i++) {
      dest[i] = src[i]
    }
    // Après la sélection (décalé)
    for (let i = endSample; i < length; i++) {
      dest[i - cutLength] = src[i]
    }
  }

  applyCrossfadeAtCut(result, startSample, CROSSFADE_SAMPLES)
  return result
}

/**
 * Garde uniquement la sélection [startTime, endTime] (inverse du cut).
 */
export function trimAudioBuffer(
  source: AudioBuffer,
  startTime: number,
  endTime: number,
): AudioBuffer {
  const ctx = getAudioContext()
  const { sampleRate, numberOfChannels, length } = source

  const startSample = Math.max(0, Math.floor(startTime * sampleRate))
  const endSample = Math.min(length, Math.floor(endTime * sampleRate))
  const newLength = endSample - startSample

  if (newLength <= 0) {
    throw new Error('Sélection de trim invalide')
  }

  const result = ctx.createBuffer(numberOfChannels, newLength, sampleRate)
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const src = source.getChannelData(channel)
    const dest = result.getChannelData(channel)
    for (let i = 0; i < newLength; i++) {
      dest[i] = src[startSample + i]
    }
  }
  return result
}

/**
 * Micro-crossfade autour du point de jonction : fade-out juste avant,
 * fade-in juste après, pour lisser la discontinuité créée par le cut.
 */
function applyCrossfadeAtCut(
  buffer: AudioBuffer,
  cutPoint: number,
  fadeLength: number,
): void {
  const actualFade = Math.min(fadeLength, cutPoint, buffer.length - cutPoint)
  if (actualFade <= 0) return

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < actualFade; i++) {
      const gain = i / actualFade
      const outIndex = cutPoint - actualFade + i
      if (outIndex >= 0 && outIndex < buffer.length) {
        data[outIndex] *= gain
      }
      const inIndex = cutPoint + i
      if (inIndex >= 0 && inIndex < buffer.length) {
        data[inIndex] *= gain
      }
    }
  }
}
