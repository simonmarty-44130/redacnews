/**
 * Compression dynamique (preset voix radio).
 *
 * Rend le niveau plus régulier : les passages forts sont atténués, les
 * faibles remontés (après normalisation), pour un son homogène sur tout le
 * spectre temporel. Utilise le DynamicsCompressorNode natif via un
 * OfflineAudioContext (rendu hors-ligne, pas de contexte temps réel créé).
 *
 * Réglages doux adaptés à la parole — pas de pompage audible.
 */
export async function compressAudioBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  )

  const source = ctx.createBufferSource()
  source.buffer = buffer

  // Preset voix radio (validé sur signal à forte dynamique : ramène un
  // écart fort/faible de 9:1 à ~2,2:1 — égalisation nette mais naturelle).
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -28 // dB : engage sur la majeure partie de la voix
  compressor.knee.value = 10 // transition douce
  compressor.ratio.value = 3 // 3:1 — leveling vocal classique, sans pompage
  compressor.attack.value = 0.005 // 5 ms
  compressor.release.value = 0.15 // 150 ms

  source.connect(compressor)
  compressor.connect(ctx.destination)
  source.start()

  return ctx.startRendering()
}
