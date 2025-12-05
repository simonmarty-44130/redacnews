/**
 * Opérations de CUT - Architecture DESTRUCTIVE
 *
 * Le CUT modifie RÉELLEMENT l'AudioBuffer en mémoire.
 * Ce qu'on voit = ce qu'on entend.
 */

/**
 * Coupe une portion de l'AudioBuffer (édition DESTRUCTIVE)
 * Retourne un NOUVEAU buffer = avant + après (sans la sélection)
 */
export function cutAudioBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const numberOfChannels = sourceBuffer.numberOfChannels;

  // Convertir temps en samples
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  // Valider les bornes
  const safeStartSample = Math.max(0, Math.min(startSample, sourceBuffer.length));
  const safeEndSample = Math.max(safeStartSample, Math.min(endSample, sourceBuffer.length));

  // Calculer la nouvelle longueur (sans la partie coupée)
  const cutLength = safeEndSample - safeStartSample;
  const newLength = sourceBuffer.length - cutLength;

  console.log('=== cutAudioBuffer ===');
  console.log('Source buffer length:', sourceBuffer.length, 'samples');
  console.log('Source duration:', sourceBuffer.duration.toFixed(3), 's');
  console.log('Cut from:', startTime.toFixed(3), 'to', endTime.toFixed(3));
  console.log('Cut samples:', safeStartSample, 'to', safeEndSample);
  console.log('Cut length:', cutLength, 'samples');
  console.log('New length:', newLength, 'samples');

  if (newLength <= 0) {
    throw new Error('Cannot cut entire audio - nothing would remain');
  }

  // Créer le nouveau buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  // Copier les données canal par canal
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const destData = newBuffer.getChannelData(channel);

    // Copier AVANT la sélection
    for (let i = 0; i < safeStartSample; i++) {
      destData[i] = sourceData[i];
    }

    // Copier APRÈS la sélection (décalé)
    for (let i = safeEndSample; i < sourceBuffer.length; i++) {
      destData[i - cutLength] = sourceData[i];
    }
  }

  // Appliquer un micro-crossfade au point de coupe pour éviter les clics
  applyCrossfadeAtCut(newBuffer, safeStartSample, 128); // 128 samples ≈ 3ms à 44.1kHz

  console.log('New buffer duration:', newBuffer.duration.toFixed(3), 's');
  console.log('=== cutAudioBuffer DONE ===');

  return newBuffer;
}

/**
 * Applique un crossfade au point de coupe pour éviter les clics audio
 */
function applyCrossfadeAtCut(
  buffer: AudioBuffer,
  cutPoint: number,
  fadeLength: number
): void {
  const actualFadeLength = Math.min(fadeLength, cutPoint, buffer.length - cutPoint);

  if (actualFadeLength <= 0) return;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);

    // Fade out avant le point de coupe
    for (let i = 0; i < actualFadeLength; i++) {
      const fadeOutIndex = cutPoint - actualFadeLength + i;
      if (fadeOutIndex >= 0 && fadeOutIndex < buffer.length) {
        const gain = i / actualFadeLength;
        data[fadeOutIndex] *= gain;
      }
    }

    // Fade in après le point de coupe
    for (let i = 0; i < actualFadeLength; i++) {
      const fadeInIndex = cutPoint + i;
      if (fadeInIndex >= 0 && fadeInIndex < buffer.length) {
        const gain = i / actualFadeLength;
        data[fadeInIndex] *= gain;
      }
    }
  }
}

/**
 * Clone un AudioBuffer (pour l'historique undo/redo)
 */
export function cloneAudioBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer
): AudioBuffer {
  const newBuffer = audioContext.createBuffer(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const destData = newBuffer.getChannelData(channel);
    destData.set(sourceData);
  }

  return newBuffer;
}

/**
 * Normalise un AudioBuffer (peak normalization)
 */
export function normalizeAudioBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  targetPeak: number = 0.95
): AudioBuffer {
  // Trouver le pic max
  let maxPeak = 0;
  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const data = sourceBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  if (maxPeak === 0 || maxPeak >= targetPeak) {
    // Pas besoin de normaliser - retourner une copie
    return cloneAudioBuffer(audioContext, sourceBuffer);
  }

  // Appliquer le gain
  const gain = targetPeak / maxPeak;
  const newBuffer = audioContext.createBuffer(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const destData = newBuffer.getChannelData(channel);
    for (let i = 0; i < sourceData.length; i++) {
      destData[i] = sourceData[i] * gain;
    }
  }

  return newBuffer;
}

/**
 * Convertit un AudioBuffer en WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Trim : garde uniquement la sélection (inverse du cut)
 */
export function trimAudioBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const numberOfChannels = sourceBuffer.numberOfChannels;

  // Convertir temps en samples
  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.floor(endTime * sampleRate));
  const newLength = endSample - startSample;

  if (newLength <= 0) {
    throw new Error('Invalid trim selection');
  }

  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const destData = newBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      destData[i] = sourceData[startSample + i];
    }
  }

  return newBuffer;
}

/**
 * Applique un fade in au buffer
 */
export function applyFadeIn(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  duration: number
): AudioBuffer {
  const newBuffer = cloneAudioBuffer(audioContext, sourceBuffer);
  const fadeSamples = Math.floor(duration * sourceBuffer.sampleRate);

  for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    const data = newBuffer.getChannelData(channel);
    for (let i = 0; i < fadeSamples && i < data.length; i++) {
      const gain = i / fadeSamples;
      data[i] *= gain;
    }
  }

  return newBuffer;
}

/**
 * Applique un fade out au buffer
 */
export function applyFadeOut(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  duration: number
): AudioBuffer {
  const newBuffer = cloneAudioBuffer(audioContext, sourceBuffer);
  const fadeSamples = Math.floor(duration * sourceBuffer.sampleRate);
  const fadeStart = newBuffer.length - fadeSamples;

  for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    const data = newBuffer.getChannelData(channel);
    for (let i = fadeStart; i < data.length; i++) {
      const gain = (data.length - i) / fadeSamples;
      data[i] *= gain;
    }
  }

  return newBuffer;
}
