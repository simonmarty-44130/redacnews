/**
 * Export audio avec support des régions (non-destructif)
 * Assemble uniquement les régions définies dans la piste
 */

import { Track, ExportOptions, ExportResult } from '../types/editor.types';
import { DEFAULTS } from '../constants/shortcuts';
import { audioBufferToMp3 } from './export-utils';

/**
 * Exporte une piste en assemblant uniquement les régions
 */
export async function exportTrackWithRegions(
  track: Track,
  options: Partial<ExportOptions> = {}
): Promise<Blob> {
  const {
    sampleRate = 48000,
    bitDepth = 16,
    normalize = true,
    crossfadeDuration = DEFAULTS.crossfadeDuration,
  } = options;

  // 1. Charger le fichier original
  const response = await fetch(track.src);
  const arrayBuffer = await response.arrayBuffer();

  // 2. Créer un contexte audio pour décoder
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const originalBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  // 3. Calculer la durée totale des régions
  const totalDuration = track.regions.reduce(
    (sum, r) => sum + (r.endTime - r.startTime),
    0
  );

  if (totalDuration === 0) {
    throw new Error('Aucune région à exporter');
  }

  // 4. Créer le buffer de sortie
  const outputLength = Math.ceil(totalDuration * sampleRate);
  const outputBuffer = audioContext.createBuffer(
    originalBuffer.numberOfChannels,
    outputLength,
    sampleRate
  );

  // 5. Copier chaque région dans le buffer de sortie
  let outputOffset = 0;

  for (let i = 0; i < track.regions.length; i++) {
    const region = track.regions[i];

    // Calculer les positions en samples
    const startSample = Math.floor(region.startTime * originalBuffer.sampleRate);
    const endSample = Math.floor(region.endTime * originalBuffer.sampleRate);
    const regionSamples = endSample - startSample;

    // Calculer le nombre de samples pour le crossfade
    const crossfadeSamples = Math.floor(crossfadeDuration * sampleRate);

    // Copier pour chaque canal
    for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
      const inputData = originalBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      // Ratio de resampling si nécessaire
      const ratio = originalBuffer.sampleRate / sampleRate;

      for (let j = 0; j < regionSamples / ratio; j++) {
        const sourceIndex = startSample + Math.floor(j * ratio);
        const destIndex = outputOffset + j;

        if (sourceIndex < inputData.length && destIndex < outputData.length) {
          let sample = inputData[sourceIndex];

          // Appliquer fade in au début de la région (sauf première)
          if (i > 0 && j < crossfadeSamples) {
            const fadeGain = j / crossfadeSamples;
            sample *= fadeGain;
          }

          // Appliquer fade out à la fin de la région (sauf dernière)
          const regionOutputSamples = Math.floor(regionSamples / ratio);
          if (i < track.regions.length - 1 && j >= regionOutputSamples - crossfadeSamples) {
            const fadeGain = (regionOutputSamples - j) / crossfadeSamples;
            sample *= fadeGain;
          }

          // Appliquer le fade in de la région si défini
          if (region.fadeIn && j < region.fadeIn.duration * sampleRate) {
            const fadeProgress = j / (region.fadeIn.duration * sampleRate);
            sample *= applyFadeCurve(fadeProgress, region.fadeIn.shape);
          }

          // Appliquer le fade out de la région si défini
          if (region.fadeOut) {
            const fadeStartSample = regionOutputSamples - region.fadeOut.duration * sampleRate;
            if (j >= fadeStartSample) {
              const fadeProgress = (j - fadeStartSample) / (region.fadeOut.duration * sampleRate);
              sample *= applyFadeCurve(1 - fadeProgress, region.fadeOut.shape);
            }
          }

          outputData[destIndex] = sample;
        }
      }
    }

    outputOffset += Math.floor(regionSamples / (originalBuffer.sampleRate / sampleRate));
  }

  // 6. Normaliser si demandé
  if (normalize) {
    normalizeBuffer(outputBuffer);
  }

  // 7. Encoder en WAV
  const wavBlob = encodeWav(outputBuffer, bitDepth);

  // Cleanup
  await audioContext.close();

  return wavBlob;
}

/**
 * Applique une courbe de fade selon la forme
 */
function applyFadeCurve(
  progress: number,
  shape: 'linear' | 'logarithmic' | 'exponential' | 'sCurve'
): number {
  switch (shape) {
    case 'linear':
      return progress;
    case 'logarithmic':
      return Math.log10(1 + progress * 9) / Math.log10(10);
    case 'exponential':
      return Math.pow(progress, 2);
    case 'sCurve':
      // Courbe en S (sigmoid)
      return progress < 0.5
        ? 2 * Math.pow(progress, 2)
        : 1 - 2 * Math.pow(1 - progress, 2);
    default:
      return progress;
  }
}

/**
 * Normalise un AudioBuffer (peak normalization)
 */
function normalizeBuffer(buffer: AudioBuffer, targetPeak: number = 0.95): void {
  let maxPeak = 0;

  // Trouver le pic maximum
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  // Appliquer le gain
  if (maxPeak > 0 && maxPeak !== targetPeak) {
    const gain = targetPeak / maxPeak;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }
}

/**
 * Encode un AudioBuffer en WAV
 */
function encodeWav(buffer: AudioBuffer, bitDepth: number = 16): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // format (1 = PCM, 3 = float)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Audio data (interleaved)
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp
      sample = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 16) {
        const intSample = Math.floor(sample * 32767);
        view.setInt16(offset, intSample, true);
        offset += 2;
      } else if (bitDepth === 24) {
        const intSample = Math.floor(sample * 8388607);
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      } else if (bitDepth === 32) {
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Calcule la durée totale des régions d'une piste
 */
export function calculateRegionsDuration(track: Track): number {
  return track.regions.reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
}

/**
 * Exporte une piste avec ses régions et retourne un ExportResult
 */
export async function exportWithRegions(
  track: Track,
  options: ExportOptions,
  onProgress?: (progress: number) => void
): Promise<ExportResult> {
  const {
    format = 'wav',
    sampleRate = 48000,
    bitDepth = 16,
    bitrate = 192,
    normalize = true,
    crossfadeDuration = DEFAULTS.crossfadeDuration,
  } = options;

  onProgress?.(10);

  // 1. Charger le fichier original
  const response = await fetch(track.src);
  const arrayBuffer = await response.arrayBuffer();

  onProgress?.(20);

  // 2. Créer un contexte audio pour décoder
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const originalBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  onProgress?.(30);

  // 3. Calculer la durée totale des régions
  const totalDuration = track.regions.reduce(
    (sum, r) => sum + (r.endTime - r.startTime),
    0
  );

  if (totalDuration === 0) {
    await audioContext.close();
    throw new Error('Aucune région à exporter');
  }

  // 4. Créer le buffer de sortie
  const outputLength = Math.ceil(totalDuration * sampleRate);
  const outputBuffer = audioContext.createBuffer(
    originalBuffer.numberOfChannels,
    outputLength,
    sampleRate
  );

  onProgress?.(40);

  // 5. Copier chaque région dans le buffer de sortie
  let outputOffset = 0;

  for (let i = 0; i < track.regions.length; i++) {
    const region = track.regions[i];

    // Calculer les positions en samples
    const startSample = Math.floor(region.startTime * originalBuffer.sampleRate);
    const endSample = Math.floor(region.endTime * originalBuffer.sampleRate);
    const regionSamples = endSample - startSample;

    // Calculer le nombre de samples pour le crossfade
    const crossfadeSamples = Math.floor(crossfadeDuration * sampleRate);

    // Copier pour chaque canal
    for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
      const inputData = originalBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      // Ratio de resampling si nécessaire
      const ratio = originalBuffer.sampleRate / sampleRate;

      for (let j = 0; j < regionSamples / ratio; j++) {
        const sourceIndex = startSample + Math.floor(j * ratio);
        const destIndex = outputOffset + j;

        if (sourceIndex < inputData.length && destIndex < outputData.length) {
          let sample = inputData[sourceIndex];

          // Appliquer fade in au début de la région (sauf première)
          if (i > 0 && j < crossfadeSamples) {
            const fadeGain = j / crossfadeSamples;
            sample *= fadeGain;
          }

          // Appliquer fade out à la fin de la région (sauf dernière)
          const regionOutputSamples = Math.floor(regionSamples / ratio);
          if (i < track.regions.length - 1 && j >= regionOutputSamples - crossfadeSamples) {
            const fadeGain = (regionOutputSamples - j) / crossfadeSamples;
            sample *= fadeGain;
          }

          outputData[destIndex] = sample;
        }
      }
    }

    outputOffset += Math.floor(regionSamples / (originalBuffer.sampleRate / sampleRate));
    onProgress?.(40 + Math.floor((i / track.regions.length) * 30));
  }

  onProgress?.(70);

  // 6. Normaliser si demandé
  if (normalize) {
    normalizeBuffer(outputBuffer);
  }

  onProgress?.(80);

  // 7. Encoder selon le format
  let blob: Blob;
  if (format === 'mp3') {
    blob = await audioBufferToMp3(outputBuffer, bitrate);
  } else {
    blob = encodeWav(outputBuffer, bitDepth);
  }

  onProgress?.(100);

  // Cleanup
  await audioContext.close();

  return {
    blob,
    duration: totalDuration,
    metadata: {
      format,
      sampleRate,
      channels: outputBuffer.numberOfChannels,
      size: blob.size,
    },
  };
}
