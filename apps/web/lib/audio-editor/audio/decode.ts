import { getAudioContext } from './audio-context'

/**
 * Décode un fichier/blob audio en AudioBuffer via le contexte partagé.
 * Supporte tout ce que décode le navigateur (mp3, wav, webm/opus, ogg…).
 */
export async function decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  const arrayBuffer = await file.arrayBuffer()
  // decodeAudioData détache l'ArrayBuffer : on ne le réutilise pas après.
  return ctx.decodeAudioData(arrayBuffer)
}

/** Fetch + décode un audio depuis une URL (ex. URL présignée S3 de l'épisode). */
export async function fetchAndDecodeAudio(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Échec du chargement audio : ${response.status} ${response.statusText}`,
    )
  }
  const arrayBuffer = await response.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}
