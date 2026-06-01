/**
 * Encodage WAV PCM (entrelacé) — 16 ou 24 bits.
 * 16 bits par défaut (archivage interne / ré-import RCA).
 */

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

/** Convertit un sample float [-1, 1] en entier signé sur `bitDepth` bits. */
function floatToPcm(sample: number, maxAmplitude: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  return clamped < 0 ? clamped * (maxAmplitude + 1) : clamped * maxAmplitude
}

export function audioBufferToWav(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 = 16,
): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const totalLength = 44 + dataLength

  const arrayBuffer = new ArrayBuffer(totalLength)
  const view = new DataView(arrayBuffer)

  // Header RIFF/WAVE
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // taille du sous-chunk fmt
  view.setUint16(20, 1, true) // format PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  const maxAmplitude = bitDepth === 16 ? 0x7fff : 0x7fffff
  let offset = 44

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const value = Math.round(floatToPcm(channels[c][i], maxAmplitude))
      if (bitDepth === 16) {
        view.setInt16(offset, value, true)
        offset += 2
      } else {
        // 24 bits little-endian (pas de setInt24 natif)
        view.setUint8(offset, value & 0xff)
        view.setUint8(offset + 1, (value >> 8) & 0xff)
        view.setUint8(offset + 2, (value >> 16) & 0xff)
        offset += 3
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
