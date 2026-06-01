/**
 * Limiteur de loudness (« maximizer ») — méthode radio pour gagner en présence.
 *
 * 1. Monte le gain pour viser un niveau RMS cible (loudness radio).
 * 2. Brickwall limiter (DynamicsCompressorNode, ratio 20:1, attaque rapide)
 *    qui écrête les pointes au plafond → le corps de la voix remonte sans que
 *    les pics ne saturent.
 *
 * Auto-limité : si le son est déjà au niveau cible, le gain appliqué est ~0
 * (pas d'accumulation en ré-cliquant).
 */
import { cloneAudioBuffer } from './cut'
import { computeRMS, computePeak } from './normalize'

const DEFAULT_TARGET_RMS_DB = -14 // ≈ -14 LUFS : voix radio « présente »
const DEFAULT_CEILING_DB = -1 // plafond crête
const MAX_BOOST_DB = 12 // garde-fou

function scaleBuffer(buffer: AudioBuffer, factor: number): AudioBuffer {
  const out = cloneAudioBuffer(buffer)
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch)
    for (let i = 0; i < data.length; i++) data[i] *= factor
  }
  return out
}

export async function limiterMaximize(
  buffer: AudioBuffer,
  targetRmsDb: number = DEFAULT_TARGET_RMS_DB,
  ceilingDb: number = DEFAULT_CEILING_DB,
): Promise<AudioBuffer> {
  const rms = computeRMS(buffer)
  if (rms === 0) return cloneAudioBuffer(buffer)

  const rmsDbNow = 20 * Math.log10(rms)
  // Gain pour atteindre la cible (jamais négatif ici, plafonné à +MAX_BOOST_DB).
  const gainDb = Math.max(0, Math.min(targetRmsDb - rmsDbNow, MAX_BOOST_DB))
  const gained = gainDb > 0 ? scaleBuffer(buffer, Math.pow(10, gainDb / 20)) : cloneAudioBuffer(buffer)

  // Limiteur hors-ligne.
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  const source = ctx.createBufferSource()
  source.buffer = gained
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = ceilingDb
  limiter.knee.value = 0
  limiter.ratio.value = 20 // quasi brickwall
  limiter.attack.value = 0.001 // 1 ms
  limiter.release.value = 0.05 // 50 ms
  source.connect(limiter)
  limiter.connect(ctx.destination)
  source.start()
  const limited = await ctx.startRendering()

  // Sécurité : si une pointe dépasse encore le plafond, on redescend pile dessus.
  const ceiling = Math.pow(10, ceilingDb / 20)
  const peak = computePeak(limited)
  if (peak > ceiling) {
    return scaleBuffer(limited, ceiling / peak)
  }
  return limited
}
