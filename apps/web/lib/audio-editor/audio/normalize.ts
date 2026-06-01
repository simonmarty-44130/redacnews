/**
 * Normalisation audio (RMS, peak-limitée).
 *
 * Vise une cible RMS de 0.1259 (≈ -18 dBFS RMS ≈ -16 LUFS pour la parole) —
 * le niveau recommandé pour la diffusion radio voix, pour un son régulier.
 *
 * IMPORTANT — anti-saturation : le gain RMS est PLAFONNÉ pour que le pic le
 * plus fort ne dépasse jamais PEAK_CEILING (-1 dBFS). Aucun écrêtage : on
 * monte le niveau vers la cible RMS tant qu'il reste de la marge, sinon on
 * se contente de ce que le pic autorise. (Pour une vraie régularité spectrale
 * il faudrait un compresseur/limiteur — hors périmètre ici.)
 */
import { getAudioContext } from './audio-context'
import { cloneAudioBuffer } from './cut'

export const DEFAULT_RMS_TARGET = 0.1259
/** Plafond de crête : -1 dBFS (10^(-1/20)). Garantit zéro écrêtage. */
export const PEAK_CEILING = 0.891

/** RMS global (tous canaux confondus), linéaire [0, 1]. */
export function computeRMS(buffer: AudioBuffer): number {
  let sumSquares = 0
  let totalSamples = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i]
    }
    totalSamples += data.length
  }
  return totalSamples === 0 ? 0 : Math.sqrt(sumSquares / totalSamples)
}

/** Peak absolu (tous canaux), linéaire [0, 1]. */
export function computePeak(buffer: AudioBuffer): number {
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  return peak
}

/**
 * Normalise vers une cible RMS. Retourne un nouveau buffer.
 * Buffer silencieux ou cible nulle → simple clone (no-op).
 */
export function normalizeRMS(
  buffer: AudioBuffer,
  rmsTarget: number = DEFAULT_RMS_TARGET,
): AudioBuffer {
  const rms = computeRMS(buffer)
  if (rms === 0 || rmsTarget <= 0) {
    return cloneAudioBuffer(buffer)
  }

  // Gain RMS, puis plafonné par la marge de crête → le pic reste ≤ -1 dBFS.
  const peak = computePeak(buffer)
  let gain = rmsTarget / rms
  if (peak > 0) {
    gain = Math.min(gain, PEAK_CEILING / peak)
  }

  const ctx = getAudioContext()
  const result = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  )

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const src = buffer.getChannelData(channel)
    const dest = result.getChannelData(channel)
    for (let i = 0; i < src.length; i++) {
      // Pas d'écrêtage possible (pic × gain ≤ plafond) ; clamp ±1 par sécurité.
      dest[i] = Math.max(-1, Math.min(1, src[i] * gain))
    }
  }
  return result
}
