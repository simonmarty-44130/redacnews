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

/**
 * Gain (en dB) appliqué UNIQUEMENT à la plage [startTime, endTime], peak-safe.
 * En amplification, le gain est plafonné par la crête DE LA PLAGE pour ne pas
 * écrêter à l'intérieur de la sélection. Le reste du buffer est inchangé.
 */
export function applyGainDbRegion(
  buffer: AudioBuffer,
  db: number,
  startTime: number,
  endTime: number,
): AudioBuffer {
  const sr = buffer.sampleRate
  const start = Math.max(0, Math.floor(Math.min(startTime, endTime) * sr))
  const end = Math.min(buffer.length, Math.floor(Math.max(startTime, endTime) * sr))
  if (end <= start) return cloneAudioBuffer(buffer)

  // Crête de la plage (pour le plafonnement en amplification).
  let regionPeak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = start; i < end; i++) {
      const a = Math.abs(data[i])
      if (a > regionPeak) regionPeak = a
    }
  }

  let gain = Math.pow(10, db / 20)
  if (db > 0 && regionPeak > 0) {
    gain = Math.min(gain, PEAK_CEILING / regionPeak)
  }

  const result = cloneAudioBuffer(buffer)
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch)
    for (let i = start; i < end; i++) {
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
