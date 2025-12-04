/**
 * Utilitaires de traitement audio
 */

/**
 * Decode un fichier audio en AudioBuffer
 */
export async function decodeAudioFile(
  file: File | Blob,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Fetch et decode un fichier audio depuis une URL
 */
export async function fetchAndDecodeAudio(
  url: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Calcule les peaks d'un AudioBuffer pour l'affichage waveform
 */
export function calculatePeaks(
  audioBuffer: AudioBuffer,
  samplesPerPeak: number = 256
): number[][] {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const peaks: number[][] = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const channelPeaks: number[] = [];

    for (let i = 0; i < channelData.length; i += samplesPerPeak) {
      let max = 0;
      const end = Math.min(i + samplesPerPeak, channelData.length);

      for (let j = i; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) {
          max = abs;
        }
      }

      channelPeaks.push(max);
    }

    peaks.push(channelPeaks);
  }

  return peaks;
}

/**
 * Normalise un AudioBuffer au niveau de peak specifie
 */
export function normalizeBuffer(
  audioBuffer: AudioBuffer,
  targetPeak: number = 0.95
): AudioBuffer {
  const audioContext = new AudioContext();
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Trouve le peak max sur tous les canaux
  let maxPeak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > maxPeak) {
        maxPeak = abs;
      }
    }
  }

  // Calcule le facteur de normalisation
  const normalizationFactor = maxPeak > 0 ? targetPeak / maxPeak : 1;

  // Applique la normalisation
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = normalizedBuffer.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * normalizationFactor;
    }
  }

  return normalizedBuffer;
}

/**
 * Calcule le niveau RMS d'un AudioBuffer (en dB)
 */
export function calculateRMS(audioBuffer: AudioBuffer): number {
  let sumSquares = 0;
  let totalSamples = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
      totalSamples++;
    }
  }

  const rms = Math.sqrt(sumSquares / totalSamples);
  return 20 * Math.log10(rms);
}

/**
 * Calcule le niveau peak d'un AudioBuffer (en dB)
 */
export function calculatePeakLevel(audioBuffer: AudioBuffer): number {
  let maxPeak = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > maxPeak) {
        maxPeak = abs;
      }
    }
  }

  return maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
}

/**
 * Applique un fade in a un AudioBuffer
 */
export function applyFadeIn(
  audioBuffer: AudioBuffer,
  fadeDuration: number,
  shape: 'linear' | 'logarithmic' | 'sCurve' | 'exponential' = 'linear'
): AudioBuffer {
  const audioContext = new AudioContext();
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const fadeSamples = Math.floor(fadeDuration * audioBuffer.sampleRate);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      let gain = 1;

      if (i < fadeSamples) {
        const progress = i / fadeSamples;
        gain = calculateFadeGain(progress, shape);
      }

      outputData[i] = inputData[i] * gain;
    }
  }

  return outputBuffer;
}

/**
 * Applique un fade out a un AudioBuffer
 */
export function applyFadeOut(
  audioBuffer: AudioBuffer,
  fadeDuration: number,
  shape: 'linear' | 'logarithmic' | 'sCurve' | 'exponential' = 'linear'
): AudioBuffer {
  const audioContext = new AudioContext();
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const fadeSamples = Math.floor(fadeDuration * audioBuffer.sampleRate);
  const fadeStart = audioBuffer.length - fadeSamples;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      let gain = 1;

      if (i >= fadeStart) {
        const progress = 1 - (i - fadeStart) / fadeSamples;
        gain = calculateFadeGain(progress, shape);
      }

      outputData[i] = inputData[i] * gain;
    }
  }

  return outputBuffer;
}

/**
 * Calcule le gain pour un fade selon la forme
 */
function calculateFadeGain(
  progress: number,
  shape: 'linear' | 'logarithmic' | 'sCurve' | 'exponential'
): number {
  switch (shape) {
    case 'linear':
      return progress;
    case 'logarithmic':
      return Math.log10(1 + 9 * progress);
    case 'exponential':
      return Math.pow(progress, 2);
    case 'sCurve':
      return progress < 0.5
        ? 2 * Math.pow(progress, 2)
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    default:
      return progress;
  }
}

/**
 * Mixe plusieurs AudioBuffers en un seul
 */
export function mixBuffers(
  buffers: { buffer: AudioBuffer; gain: number; startTime: number }[],
  sampleRate: number = 44100
): AudioBuffer {
  // Calcule la duree totale
  let totalDuration = 0;
  buffers.forEach(({ buffer, startTime }) => {
    const endTime = startTime + buffer.duration;
    if (endTime > totalDuration) {
      totalDuration = endTime;
    }
  });

  const audioContext = new AudioContext();
  const outputLength = Math.ceil(totalDuration * sampleRate);
  const outputBuffer = audioContext.createBuffer(2, outputLength, sampleRate);

  // Mixe chaque buffer
  buffers.forEach(({ buffer, gain, startTime }) => {
    const startSample = Math.floor(startTime * sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      const inputChannel = Math.min(channel, buffer.numberOfChannels - 1);
      const inputData = buffer.getChannelData(inputChannel);

      for (let i = 0; i < inputData.length; i++) {
        const outputIndex = startSample + i;
        if (outputIndex < outputLength) {
          outputData[outputIndex] += inputData[i] * gain;
        }
      }
    }
  });

  // Normalise si necessaire pour eviter le clipping
  let maxSample = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = outputBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxSample) {
        maxSample = abs;
      }
    }
  }

  if (maxSample > 1) {
    const normalize = 0.95 / maxSample;
    for (let channel = 0; channel < 2; channel++) {
      const data = outputBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] *= normalize;
      }
    }
  }

  return outputBuffer;
}

/**
 * Detecte les silences dans un AudioBuffer
 */
export function detectSilences(
  audioBuffer: AudioBuffer,
  threshold: number = -40, // dB
  minDuration: number = 0.5 // secondes
): { start: number; end: number }[] {
  const silences: { start: number; end: number }[] = [];
  const linearThreshold = Math.pow(10, threshold / 20);
  const minSamples = Math.floor(minDuration * audioBuffer.sampleRate);

  let silenceStart: number | null = null;
  let silenceLength = 0;

  // Analyse le premier canal
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < channelData.length; i++) {
    const isSilent = Math.abs(channelData[i]) < linearThreshold;

    if (isSilent) {
      if (silenceStart === null) {
        silenceStart = i;
      }
      silenceLength++;
    } else {
      if (silenceStart !== null && silenceLength >= minSamples) {
        silences.push({
          start: silenceStart / audioBuffer.sampleRate,
          end: i / audioBuffer.sampleRate,
        });
      }
      silenceStart = null;
      silenceLength = 0;
    }
  }

  // Verifie le dernier silence
  if (silenceStart !== null && silenceLength >= minSamples) {
    silences.push({
      start: silenceStart / audioBuffer.sampleRate,
      end: channelData.length / audioBuffer.sampleRate,
    });
  }

  return silences;
}

/**
 * Coupe une portion d'un AudioBuffer
 */
export function sliceBuffer(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const audioContext = new AudioContext();
  const startSample = Math.floor(startTime * audioBuffer.sampleRate);
  const endSample = Math.floor(endTime * audioBuffer.sampleRate);
  const length = endSample - startSample;

  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      outputData[i] = inputData[startSample + i];
    }
  }

  return outputBuffer;
}
