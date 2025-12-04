/**
 * Utilitaires d'export audio (WAV et MP3)
 */

import type { ExportOptions, ExportResult } from '../types/editor.types';

/**
 * Exporte un AudioBuffer en WAV
 */
export function audioBufferToWav(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 = 16
): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  // Taille totale du fichier WAV
  const bufferSize = 44 + dataSize;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < numberOfChannels; channel++) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));

      if (bitDepth === 16) {
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, int16, true);
        offset += 2;
      } else {
        // 24-bit
        const int24 = sample < 0 ? sample * 0x800000 : sample * 0x7fffff;
        view.setUint8(offset, int24 & 0xff);
        view.setUint8(offset + 1, (int24 >> 8) & 0xff);
        view.setUint8(offset + 2, (int24 >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Exporte un AudioBuffer en MP3 via lamejs
 */
export async function audioBufferToMp3(
  audioBuffer: AudioBuffer,
  bitrate: number = 320
): Promise<Blob> {
  // @ts-ignore - lamejs n'a pas de types
  const lamejs = await import('lamejs');

  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;

  // Prepare les donnees en Int16
  const leftChannel = convertToInt16(audioBuffer.getChannelData(0));
  const rightChannel =
    numberOfChannels > 1
      ? convertToInt16(audioBuffer.getChannelData(1))
      : leftChannel;

  // Initialise l'encodeur MP3
  const mp3Encoder = new lamejs.Mp3Encoder(
    numberOfChannels,
    sampleRate,
    bitrate
  );

  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < samples; i += sampleBlockSize) {
    const leftChunk = leftChannel.subarray(i, i + sampleBlockSize);
    const rightChunk = rightChannel.subarray(i, i + sampleBlockSize);

    const mp3buf =
      numberOfChannels === 1
        ? mp3Encoder.encodeBuffer(leftChunk)
        : mp3Encoder.encodeBuffer(leftChunk, rightChunk);

    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  // Finalise
  const end = mp3Encoder.flush();
  if (end.length > 0) {
    mp3Data.push(new Uint8Array(end));
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Exporte un AudioBuffer selon les options specifiees
 */
export async function exportAudioBuffer(
  audioBuffer: AudioBuffer,
  options: ExportOptions
): Promise<ExportResult> {
  let blob: Blob;

  if (options.format === 'wav') {
    // 32-bit float requires a different format, fall back to 24-bit
    const bitDepth = options.bitDepth === 32 ? 24 : (options.bitDepth || 16);
    blob = audioBufferToWav(audioBuffer, bitDepth as 16 | 24);
  } else {
    blob = await audioBufferToMp3(audioBuffer, options.bitrate || 320);
  }

  return {
    blob,
    duration: audioBuffer.duration,
    metadata: {
      format: options.format,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      size: blob.size,
    },
  };
}

/**
 * Telecharge un blob comme fichier
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ HELPERS ============

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function convertToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16Array;
}

/**
 * Formate la taille d'un fichier en format lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Estime la taille du fichier avant export
 */
export function estimateFileSize(
  duration: number,
  channels: number,
  sampleRate: number,
  format: 'wav' | 'mp3',
  bitDepth?: number,
  bitrate?: number
): number {
  if (format === 'wav') {
    const bytesPerSample = (bitDepth || 16) / 8;
    return Math.ceil(duration * sampleRate * channels * bytesPerSample);
  } else {
    // MP3: bitrate en kbps
    return Math.ceil((duration * (bitrate || 320) * 1000) / 8);
  }
}
