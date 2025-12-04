/**
 * Presets d'equalisation pour la voix radio
 */

import * as Tone from 'tone';
import type { EQPreset, EQBand } from '../types/editor.types';

/**
 * Presets EQ optimises pour la radio
 */
export const EQ_PRESETS: Record<string, EQPreset> = {
  // Voix homme - coupe les basses, boost les mediums
  voixHomme: {
    name: 'Voix homme',
    low: { frequency: 100, gain: -3 },
    mid: { frequency: 2500, gain: 2 },
    high: { frequency: 8000, gain: 1 },
  },
  // Voix femme - coupe un peu moins les basses, boost les aigus
  voixFemme: {
    name: 'Voix femme',
    low: { frequency: 150, gain: -2 },
    mid: { frequency: 3500, gain: 2 },
    high: { frequency: 10000, gain: 1 },
  },
  // Simulation qualite telephone (bande passante limitee)
  telephone: {
    name: 'Interview telephone',
    low: { frequency: 300, gain: -12 },
    mid: { frequency: 1500, gain: 3 },
    high: { frequency: 3400, gain: -12 },
  },
  // Son exterieur / ambiance
  exterieur: {
    name: 'Son exterieur',
    low: { frequency: 80, gain: -6 },
    mid: { frequency: 1000, gain: 0 },
    high: { frequency: 6000, gain: -2 },
  },
  // Presence accrue pour voix faible
  presence: {
    name: 'Presence',
    low: { frequency: 200, gain: -1 },
    mid: { frequency: 3000, gain: 4 },
    high: { frequency: 12000, gain: 2 },
  },
  // Warm - son plus chaud
  warm: {
    name: 'Chaud',
    low: { frequency: 150, gain: 2 },
    mid: { frequency: 800, gain: 1 },
    high: { frequency: 10000, gain: -2 },
  },
  // Flat - pas de modification
  flat: {
    name: 'Neutre',
    low: { frequency: 100, gain: 0 },
    mid: { frequency: 1000, gain: 0 },
    high: { frequency: 10000, gain: 0 },
  },
};

/**
 * Cree un EQ 3 bandes avec Tone.js
 */
export function createEQ3(preset: EQPreset = EQ_PRESETS.flat): {
  low: Tone.Filter;
  mid: Tone.Filter;
  high: Tone.Filter;
  input: Tone.Gain;
  output: Tone.Gain;
  dispose: () => void;
  setPreset: (preset: EQPreset) => void;
} {
  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);

  // Low shelf filter
  const low = new Tone.Filter({
    frequency: preset.low.frequency,
    type: 'lowshelf',
    gain: preset.low.gain,
  });

  // Mid peaking filter
  const mid = new Tone.Filter({
    frequency: preset.mid.frequency,
    type: 'peaking',
    gain: preset.mid.gain,
    Q: 1,
  });

  // High shelf filter
  const high = new Tone.Filter({
    frequency: preset.high.frequency,
    type: 'highshelf',
    gain: preset.high.gain,
  });

  // Chaine de connexion
  input.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(output);

  return {
    low,
    mid,
    high,
    input,
    output,
    dispose: () => {
      input.dispose();
      output.dispose();
      low.dispose();
      mid.dispose();
      high.dispose();
    },
    setPreset: (newPreset: EQPreset) => {
      low.frequency.value = newPreset.low.frequency;
      low.gain.value = newPreset.low.gain;
      mid.frequency.value = newPreset.mid.frequency;
      mid.gain.value = newPreset.mid.gain;
      high.frequency.value = newPreset.high.frequency;
      high.gain.value = newPreset.high.gain;
    },
  };
}

/**
 * Applique un preset EQ a un AudioBuffer en offline
 */
export async function applyEQToBuffer(
  audioBuffer: AudioBuffer,
  preset: EQPreset
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Low shelf
  const lowFilter = offlineContext.createBiquadFilter();
  lowFilter.type = 'lowshelf';
  lowFilter.frequency.value = preset.low.frequency;
  lowFilter.gain.value = preset.low.gain;

  // Mid peaking
  const midFilter = offlineContext.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = preset.mid.frequency;
  midFilter.gain.value = preset.mid.gain;
  midFilter.Q.value = 1;

  // High shelf
  const highFilter = offlineContext.createBiquadFilter();
  highFilter.type = 'highshelf';
  highFilter.frequency.value = preset.high.frequency;
  highFilter.gain.value = preset.high.gain;

  // Connect chain
  source.connect(lowFilter);
  lowFilter.connect(midFilter);
  midFilter.connect(highFilter);
  highFilter.connect(offlineContext.destination);

  source.start(0);

  return offlineContext.startRendering();
}

/**
 * Noise gate simple pour eliminer le bruit de fond
 */
export function createNoiseGate(
  threshold: number = -50, // dB
  _attack: number = 0.01,
  _release: number = 0.1
): Tone.Gate {
  // Tone.Gate only accepts threshold and smoothing
  return new Tone.Gate(threshold);
}

/**
 * Applique un noise gate a un AudioBuffer
 */
export async function applyNoiseGate(
  audioBuffer: AudioBuffer,
  threshold: number = -50,
  holdTime: number = 0.1
): Promise<AudioBuffer> {
  const sampleRate = audioBuffer.sampleRate;
  const holdSamples = Math.floor(holdTime * sampleRate);
  const linearThreshold = Math.pow(10, threshold / 20);

  const audioContext = new AudioContext();
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    let gateOpen = false;
    let holdCounter = 0;

    for (let i = 0; i < inputData.length; i++) {
      const abs = Math.abs(inputData[i]);

      if (abs > linearThreshold) {
        gateOpen = true;
        holdCounter = holdSamples;
      } else if (holdCounter > 0) {
        holdCounter--;
      } else {
        gateOpen = false;
      }

      outputData[i] = gateOpen ? inputData[i] : 0;
    }
  }

  return outputBuffer;
}
