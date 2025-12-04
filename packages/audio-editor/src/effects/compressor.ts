/**
 * Compresseur audio pour le broadcast radio
 */

import * as Tone from 'tone';
import type { CompressorSettings } from '../types/editor.types';

/**
 * Presets de compression pour la radio
 */
export const COMPRESSOR_PRESETS: Record<string, CompressorSettings> = {
  // Preset par defaut pour la voix broadcast
  broadcast: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
    knee: 10,
  },
  // Compression legere pour interviews
  interview: {
    threshold: -20,
    ratio: 2.5,
    attack: 0.01,
    release: 0.3,
    knee: 15,
  },
  // Compression douce pour ambiance
  ambient: {
    threshold: -30,
    ratio: 2,
    attack: 0.02,
    release: 0.5,
    knee: 20,
  },
  // Compression forte pour limiter les pics
  limiter: {
    threshold: -6,
    ratio: 20,
    attack: 0.001,
    release: 0.1,
    knee: 0,
  },
};

/**
 * Cree un compresseur Tone.js avec les settings donnes
 */
export function createCompressor(
  settings: CompressorSettings = COMPRESSOR_PRESETS.broadcast
): Tone.Compressor {
  return new Tone.Compressor({
    threshold: settings.threshold,
    ratio: settings.ratio,
    attack: settings.attack,
    release: settings.release,
    knee: settings.knee,
  });
}

/**
 * Cree un compresseur broadcast pre-configure
 */
export function createBroadcastCompressor(): Tone.Compressor {
  return createCompressor(COMPRESSOR_PRESETS.broadcast);
}

/**
 * Applique une compression a un AudioBuffer en offline
 */
export async function compressBuffer(
  audioBuffer: AudioBuffer,
  settings: CompressorSettings = COMPRESSOR_PRESETS.broadcast
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Cree les noeuds
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const compressor = offlineContext.createDynamicsCompressor();
  compressor.threshold.value = settings.threshold;
  compressor.ratio.value = settings.ratio;
  compressor.attack.value = settings.attack;
  compressor.release.value = settings.release;
  compressor.knee.value = settings.knee;

  // Connecte les noeuds
  source.connect(compressor);
  compressor.connect(offlineContext.destination);

  // Lance la lecture
  source.start(0);

  // Render offline
  return offlineContext.startRendering();
}

/**
 * Cree une chaine de traitement broadcast complete
 * (compresseur + limiter)
 */
export function createBroadcastChain(): {
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
  connect: (input: Tone.ToneAudioNode, output: Tone.ToneAudioNode) => void;
  dispose: () => void;
} {
  const compressor = createCompressor(COMPRESSOR_PRESETS.broadcast);
  const limiter = new Tone.Limiter(-3);

  compressor.connect(limiter);

  return {
    compressor,
    limiter,
    connect: (input: Tone.ToneAudioNode, output: Tone.ToneAudioNode) => {
      input.connect(compressor);
      limiter.connect(output);
    },
    dispose: () => {
      compressor.dispose();
      limiter.dispose();
    },
  };
}
