/**
 * Pipeline d'export unifié : AudioBuffer → Blob (MP3 ou WAV) + métadonnées.
 */
import type { ExportOptions, ExportResult } from '../types'
import { audioBufferToMp3 } from './mp3'
import { audioBufferToWav } from './wav'

export async function exportAudio(
  buffer: AudioBuffer,
  options: ExportOptions,
  onProgress?: (ratio: number) => void,
): Promise<ExportResult> {
  const baseName = options.filename ?? 'export'

  if (options.format === 'wav') {
    const blob = audioBufferToWav(buffer, options.wavBitDepth ?? 16)
    return {
      blob,
      format: 'wav',
      filename: `${baseName}.wav`,
      mimeType: 'audio/wav',
      sizeBytes: blob.size,
      durationSeconds: buffer.duration,
    }
  }

  const blob = await audioBufferToMp3(buffer, options.mp3Bitrate ?? 320, onProgress)
  return {
    blob,
    format: 'mp3',
    filename: `${baseName}.mp3`,
    mimeType: 'audio/mpeg',
    sizeBytes: blob.size,
    durationSeconds: buffer.duration,
  }
}

/** Déclenche le téléchargement d'un Blob (utile pour les tests manuels). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
