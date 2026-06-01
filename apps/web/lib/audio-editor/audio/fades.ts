/**
 * Fondus (fade in / fade out) — édition destructive, retourne un nouveau buffer.
 *
 * Sur une plage [startTime, endTime] :
 *  - fade in  : rampe linéaire de gain 0 → 1
 *  - fade out : rampe linéaire de gain 1 → 0
 */
import { cloneAudioBuffer } from './cut'

export function applyFadeIn(
  source: AudioBuffer,
  startTime: number,
  endTime: number,
): AudioBuffer {
  const result = cloneAudioBuffer(source)
  const sr = source.sampleRate
  const start = Math.max(0, Math.floor(startTime * sr))
  const end = Math.min(source.length, Math.floor(endTime * sr))
  const len = end - start
  if (len <= 0) return result

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch)
    for (let i = start; i < end; i++) {
      data[i] *= (i - start) / len
    }
  }
  return result
}

export function applyFadeOut(
  source: AudioBuffer,
  startTime: number,
  endTime: number,
): AudioBuffer {
  const result = cloneAudioBuffer(source)
  const sr = source.sampleRate
  const start = Math.max(0, Math.floor(startTime * sr))
  const end = Math.min(source.length, Math.floor(endTime * sr))
  const len = end - start
  if (len <= 0) return result

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch)
    for (let i = start; i < end; i++) {
      data[i] *= 1 - (i - start) / len
    }
  }
  return result
}
