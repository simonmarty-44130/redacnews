/**
 * Normalisation audio pour le broadcast radio
 * Standard radio francaise: -16 LUFS
 */

/**
 * Calcule le niveau LUFS (Loudness Units relative to Full Scale)
 * Implementation simplifiee basee sur ITU-R BS.1770-4
 */
export function calculateLUFS(audioBuffer: AudioBuffer): number {
  const sampleRate = audioBuffer.sampleRate;
  const blockSize = Math.floor(0.4 * sampleRate); // 400ms blocks
  const overlapSize = Math.floor(0.1 * sampleRate); // 100ms overlap
  const stepSize = blockSize - overlapSize;

  // Pre-filter (K-weighting simplifie)
  const filteredBuffer = applyKWeighting(audioBuffer);

  // Calcule le mean square pour chaque bloc
  const blockLoudness: number[] = [];

  for (
    let i = 0;
    i + blockSize <= filteredBuffer.length;
    i += stepSize
  ) {
    let sumSquares = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = filteredBuffer.getChannelData(channel);

      for (let j = 0; j < blockSize; j++) {
        sumSquares += channelData[i + j] * channelData[i + j];
      }
    }

    const meanSquare =
      sumSquares / (blockSize * audioBuffer.numberOfChannels);

    // Convertit en LUFS
    const loudness = -0.691 + 10 * Math.log10(meanSquare);

    if (isFinite(loudness)) {
      blockLoudness.push(loudness);
    }
  }

  // Gating: ignore les blocs en dessous de -70 LUFS
  const gatedBlocks = blockLoudness.filter((l) => l > -70);

  if (gatedBlocks.length === 0) {
    return -Infinity;
  }

  // Calcule la moyenne des blocs gates
  const integratedLoudness =
    gatedBlocks.reduce((sum, l) => sum + Math.pow(10, l / 10), 0) /
    gatedBlocks.length;

  return 10 * Math.log10(integratedLoudness);
}

/**
 * Applique un filtre K-weighting simplifie
 * (approximation du filtre ITU-R BS.1770)
 */
function applyKWeighting(audioBuffer: AudioBuffer): AudioBuffer {
  const audioContext = new AudioContext();
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Coefficients de filtre simplifie (passe-haut + shelf haute frequence)
  const preGain = 1.584893192461113;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Passe-haut simple a 100Hz + gain hautes frequences
    let prev = 0;
    for (let i = 0; i < inputData.length; i++) {
      // Passe-haut
      const highPassed = inputData[i] - prev + 0.995 * (outputData[i - 1] || 0);
      prev = inputData[i];

      // Pre-gain (emphasis sur les hautes frequences)
      outputData[i] = highPassed * preGain;
    }
  }

  return outputBuffer;
}

/**
 * Normalise un AudioBuffer vers un niveau LUFS cible
 */
export async function normalizeToLUFS(
  audioBuffer: AudioBuffer,
  targetLUFS: number = -16
): Promise<AudioBuffer> {
  const currentLUFS = calculateLUFS(audioBuffer);

  if (!isFinite(currentLUFS)) {
    // Buffer silencieux, retourne tel quel
    return audioBuffer;
  }

  // Calcule le gain necessaire
  const gainDB = targetLUFS - currentLUFS;
  const gainLinear = Math.pow(10, gainDB / 20);

  // Limite le gain pour eviter la distortion
  const maxGain = 20; // +26 dB max
  const minGain = 0.001; // -60 dB min
  const finalGain = Math.max(minGain, Math.min(maxGain, gainLinear));

  // Applique le gain
  const audioContext = new AudioContext();
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Verifie si le gain ne cause pas de clipping
  let maxPeak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < inputData.length; i++) {
      const newValue = Math.abs(inputData[i] * finalGain);
      if (newValue > maxPeak) {
        maxPeak = newValue;
      }
    }
  }

  // Ajuste le gain si clipping
  const antiClipGain = maxPeak > 0.99 ? 0.99 / maxPeak : 1;
  const adjustedGain = finalGain * antiClipGain;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = normalizedBuffer.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * adjustedGain;
    }
  }

  return normalizedBuffer;
}

/**
 * Normalise au niveau de peak
 */
export function normalizeToPeak(
  audioBuffer: AudioBuffer,
  targetPeak: number = 0.95
): AudioBuffer {
  // Trouve le peak actuel
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

  if (maxPeak === 0) {
    return audioBuffer;
  }

  const gain = targetPeak / maxPeak;

  const audioContext = new AudioContext();
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = normalizedBuffer.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * gain;
    }
  }

  return normalizedBuffer;
}

/**
 * Analyse le niveau audio et retourne des metriques
 */
export function analyzeAudio(audioBuffer: AudioBuffer): {
  lufs: number;
  peakDB: number;
  rmsDB: number;
  dynamicRange: number;
  clipCount: number;
} {
  const lufs = calculateLUFS(audioBuffer);

  // Peak
  let maxPeak = 0;
  let sumSquares = 0;
  let totalSamples = 0;
  let clipCount = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > maxPeak) {
        maxPeak = abs;
      }
      sumSquares += channelData[i] * channelData[i];
      totalSamples++;

      // Compte les clips (samples >= 1.0)
      if (abs >= 0.9999) {
        clipCount++;
      }
    }
  }

  const peakDB = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
  const rms = Math.sqrt(sumSquares / totalSamples);
  const rmsDB = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const dynamicRange = peakDB - rmsDB;

  return {
    lufs,
    peakDB,
    rmsDB,
    dynamicRange,
    clipCount,
  };
}
