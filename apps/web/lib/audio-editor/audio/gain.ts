/**
 * Gain manuel (en dB), peak-safe.
 *
 * Multiplie le signal par 10^(dB/20). En amplification, le gain est plafonné
 * pour que le pic ne dépasse jamais PEAK_CEILING (-1 dBFS) → jamais d'écrêtage.
 * En atténuation, appliqué directement.
 */
import { cloneAudioBuffer } from './cut'
import { computePeak, computeRMS, PEAK_CEILING } from './normalize'

export function applyGainDb(buffer: AudioBuffer, db: number): AudioBuffer {
  let gain = Math.pow(10, db / 20)

  if (db > 0) {
    const peak = computePeak(buffer)
    if (peak > 0) {
      gain = Math.min(gain, PEAK_CEILING / peak) // jamais au-dessus du plafond
    }
  }

  const result = cloneAudioBuffer(buffer)
  for (let channel = 0; channel < result.numberOfChannels; channel++) {
    const data = result.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.max(-1, Math.min(1, data[i] * gain))
    }
  }
  return result
}

/** Niveau crête en dBFS ( -Infinity si silence ). */
export function peakDb(buffer: AudioBuffer): number {
  const peak = computePeak(buffer)
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}

/** Niveau RMS (loudness perçue) en dBFS ( -Infinity si silence ). */
export function rmsDb(buffer: AudioBuffer): number {
  const rms = computeRMS(buffer)
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity
}
