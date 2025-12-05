/**
 * Export audio - Architecture DESTRUCTIVE
 *
 * L'export est simplifié : le buffer actuel EST déjà le résultat final.
 * Pas besoin d'assembler des régions.
 */

import { Track, ExportOptions, ExportResult } from '../types/editor.types';
import { audioBufferToWav, normalizeAudioBuffer, cloneAudioBuffer } from '../operations/cut';

/**
 * Export simplifié - le buffer EST déjà le résultat final
 */
export async function exportWithRegions(
  track: Track,
  options: ExportOptions,
  onProgress?: (progress: number) => void
): Promise<ExportResult> {
  const { format = 'wav', normalize = true } = options;

  if (!track.audioBuffer) {
    throw new Error('No audio buffer to export');
  }

  onProgress?.(10);

  let buffer = track.audioBuffer;

  // Créer un AudioContext temporaire pour les opérations
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();

  onProgress?.(30);

  // Normaliser si demandé
  if (normalize) {
    buffer = normalizeAudioBuffer(audioContext, buffer);
  }

  onProgress?.(60);

  // Encoder en WAV (MP3 nécessiterait une lib externe comme lamejs)
  let blob: Blob;
  if (format === 'wav') {
    blob = audioBufferToWav(buffer);
  } else if (format === 'mp3') {
    // Pour l'instant, fallback sur WAV
    // TODO: Intégrer lamejs pour l'encodage MP3
    console.warn('MP3 export not implemented, falling back to WAV');
    blob = audioBufferToWav(buffer);
  } else {
    blob = audioBufferToWav(buffer);
  }

  onProgress?.(100);

  // Cleanup
  await audioContext.close();

  return {
    blob,
    duration: track.duration,
    metadata: {
      format: format === 'mp3' ? 'wav' : format, // Reflect actual format
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      size: blob.size,
    },
  };
}

/**
 * Calcule la durée d'une piste
 * Avec l'architecture destructive, c'est simplement la durée du buffer
 */
export function calculateRegionsDuration(track: Track): number {
  return track.duration;
}

/**
 * Export une piste vers un Blob WAV
 */
export async function exportTrackToWav(track: Track): Promise<Blob> {
  if (!track.audioBuffer) {
    throw new Error('No audio buffer');
  }
  return audioBufferToWav(track.audioBuffer);
}
