// apps/web/lib/audio-montage/audioEngine.ts

import { MontageProject, Track, Clip, getClipDuration } from './types';
import { DEFAULT_SAMPLE_RATE } from './constants';

interface ClipAudioNode {
  clip: Clip;
  audioBuffer: AudioBuffer;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
}

interface TrackAudioNode {
  track: Track;
  gainNode: GainNode;
  panNode: StereoPannerNode;
}

export class MontageAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private clips: Map<string, ClipAudioNode> = new Map();
  private tracks: Map<string, TrackAudioNode> = new Map();
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private animationFrameId: number | null = null;
  private onTimeUpdate: ((time: number) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;

  constructor() {}

  // Initialiser le contexte audio
  async init(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
    }

    // Reprendre le contexte si suspendu
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  // Configurer le callback de mise a jour du temps
  setTimeUpdateCallback(callback: (time: number) => void) {
    this.onTimeUpdate = callback;
  }

  setPlaybackEndCallback(callback: () => void) {
    this.onPlaybackEnd = callback;
  }

  // Charger un buffer audio depuis une URL (avec cache)
  async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url)!;
    }

    await this.init();
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    this.audioBufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  // Charger un projet complet
  async loadProject(project: MontageProject): Promise<void> {
    await this.init();

    // Nettoyer les anciennes donnees
    this.clips.clear();
    this.tracks.clear();

    // Creer les nodes pour chaque piste
    for (const track of project.tracks) {
      await this.loadTrack(track);
    }
  }

  // Charger une piste
  async loadTrack(track: Track): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;

    const gainNode = this.audioContext.createGain();
    const panNode = this.audioContext.createStereoPanner();

    gainNode.gain.value = track.muted ? 0 : track.volume;
    panNode.pan.value = track.pan;

    gainNode.connect(panNode);
    panNode.connect(this.masterGain);

    this.tracks.set(track.id, { track, gainNode, panNode });

    // Charger chaque clip de la piste
    for (const clip of track.clips) {
      await this.loadClip(clip, track.id);
    }
  }

  // Charger un clip
  async loadClip(clip: Clip, trackId: string): Promise<void> {
    if (!this.audioContext) return;

    const trackNode = this.tracks.get(trackId);
    if (!trackNode) return;

    try {
      const audioBuffer = await this.loadAudioBuffer(clip.sourceUrl);

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = clip.volume;
      gainNode.connect(trackNode.gainNode);

      this.clips.set(clip.id, {
        clip,
        audioBuffer,
        sourceNode: null,
        gainNode,
      });
    } catch (error) {
      console.error(`Failed to load clip ${clip.id}:`, error);
    }
  }

  // Mettre a jour un clip existant
  updateClip(clipId: string, updates: Partial<Clip>): void {
    const clipNode = this.clips.get(clipId);
    if (clipNode) {
      clipNode.clip = { ...clipNode.clip, ...updates };
      if (updates.volume !== undefined) {
        clipNode.gainNode.gain.value = updates.volume;
      }
    }
  }

  // Supprimer un clip
  removeClip(clipId: string): void {
    const clipNode = this.clips.get(clipId);
    if (clipNode) {
      if (clipNode.sourceNode) {
        try {
          clipNode.sourceNode.stop();
        } catch {
          // Ignorer si deja arrete
        }
      }
      clipNode.gainNode.disconnect();
      this.clips.delete(clipId);
    }
  }

  // Lecture
  play(fromTime: number = this.pauseTime): void {
    if (!this.audioContext || this.isPlaying) return;

    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - fromTime;

    // Programmer la lecture de chaque clip
    this.clips.forEach((clipNode) => {
      this.scheduleClip(clipNode, fromTime);
    });

    // Demarrer la boucle de mise a jour
    this.startTimeUpdateLoop();
  }

  private scheduleClip(clipNode: ClipAudioNode, fromTime: number): void {
    if (!this.audioContext) return;

    const { clip, audioBuffer, gainNode } = clipNode;
    const clipStart = clip.startTime;
    const clipDuration = getClipDuration(clip);
    const clipEnd = clipStart + clipDuration;

    // Le clip est-il apres le temps de lecture ?
    if (fromTime >= clipEnd) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    // Appliquer fade in/out
    if (clip.fadeInDuration > 0 || clip.fadeOutDuration > 0) {
      this.applyFades(clipNode, clipDuration);
    }

    if (fromTime >= clipStart) {
      // On est deja dans le clip
      const offset = clip.inPoint + (fromTime - clipStart);
      const duration = clipDuration - (fromTime - clipStart);
      source.start(0, offset, duration);
    } else {
      // Le clip commence plus tard
      const delay = clipStart - fromTime;
      source.start(this.audioContext.currentTime + delay, clip.inPoint, clipDuration);
    }

    clipNode.sourceNode = source;

    // Gerer la fin du clip
    source.onended = () => {
      clipNode.sourceNode = null;
    };
  }

  private applyFades(clipNode: ClipAudioNode, clipDuration: number): void {
    if (!this.audioContext) return;

    const { clip, gainNode } = clipNode;
    const now = this.audioContext.currentTime;

    // Reset gain
    gainNode.gain.cancelScheduledValues(now);

    // Fade in
    if (clip.fadeInDuration > 0) {
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(clip.volume, now + clip.fadeInDuration);
    } else {
      gainNode.gain.setValueAtTime(clip.volume, now);
    }

    // Fade out
    if (clip.fadeOutDuration > 0) {
      const fadeOutStart = now + clipDuration - clip.fadeOutDuration;
      gainNode.gain.setValueAtTime(clip.volume, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, now + clipDuration);
    }
  }

  private startTimeUpdateLoop(): void {
    const update = () => {
      if (!this.isPlaying) return;

      const currentTime = this.getCurrentTime();
      this.onTimeUpdate?.(currentTime);

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  // Pause
  pause(): void {
    if (!this.isPlaying) return;

    this.pauseTime = this.getCurrentTime();
    this.isPlaying = false;

    // Annuler la boucle de mise a jour
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Arreter tous les sources
    this.clips.forEach((clipNode) => {
      if (clipNode.sourceNode) {
        try {
          clipNode.sourceNode.stop();
        } catch {
          // Ignorer si deja arrete
        }
        clipNode.sourceNode = null;
      }
    });
  }

  // Stop (retour au debut)
  stop(): void {
    this.pause();
    this.pauseTime = 0;
    this.onTimeUpdate?.(0);
    this.onPlaybackEnd?.();
  }

  // Seek
  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseTime = Math.max(0, time);
    this.onTimeUpdate?.(this.pauseTime);
    if (wasPlaying) {
      this.play(this.pauseTime);
    }
  }

  // Temps courant
  getCurrentTime(): number {
    if (!this.audioContext) return this.pauseTime;

    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseTime;
  }

  // Volume master
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  // Volume d'une piste
  setTrackVolume(trackId: string, volume: number): void {
    const trackNode = this.tracks.get(trackId);
    if (trackNode) {
      trackNode.track.volume = volume;
      if (!trackNode.track.muted) {
        trackNode.gainNode.gain.value = volume;
      }
    }
  }

  // Mute d'une piste
  setTrackMute(trackId: string, muted: boolean): void {
    const trackNode = this.tracks.get(trackId);
    if (trackNode) {
      trackNode.track.muted = muted;
      trackNode.gainNode.gain.value = muted ? 0 : trackNode.track.volume;
    }
  }

  // Pan d'une piste
  setTrackPan(trackId: string, pan: number): void {
    const trackNode = this.tracks.get(trackId);
    if (trackNode) {
      trackNode.track.pan = pan;
      trackNode.panNode.pan.value = pan;
    }
  }

  // Solo (mute toutes les autres pistes)
  setTrackSolo(trackId: string, solo: boolean): void {
    const trackNode = this.tracks.get(trackId);
    if (!trackNode) return;

    trackNode.track.solo = solo;

    // Verifier s'il y a des pistes en solo
    const hasSolo = Array.from(this.tracks.values()).some((n) => n.track.solo);

    if (hasSolo) {
      // Seules les pistes en solo jouent
      this.tracks.forEach((node) => {
        if (node.track.solo) {
          node.gainNode.gain.value = node.track.muted ? 0 : node.track.volume;
        } else {
          node.gainNode.gain.value = 0;
        }
      });
    } else {
      // Restaurer tous les volumes normaux
      this.tracks.forEach((node) => {
        node.gainNode.gain.value = node.track.muted ? 0 : node.track.volume;
      });
    }
  }

  // Etat
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Export du mix (offline rendering)
  async exportMix(
    project: MontageProject,
    format: 'wav' | 'mp3' = 'wav'
  ): Promise<Blob> {
    const sampleRate = DEFAULT_SAMPLE_RATE;
    const duration = Math.max(project.duration, 1); // Au moins 1 seconde
    const offlineContext = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    const masterGain = offlineContext.createGain();
    masterGain.connect(offlineContext.destination);

    // Charger et programmer tous les clips
    for (const track of project.tracks) {
      if (track.muted) continue;

      const trackGain = offlineContext.createGain();
      const trackPan = offlineContext.createStereoPanner();
      trackGain.gain.value = track.volume;
      trackPan.pan.value = track.pan;
      trackGain.connect(trackPan);
      trackPan.connect(masterGain);

      for (const clip of track.clips) {
        try {
          const audioBuffer = await this.loadAudioBuffer(clip.sourceUrl);

          // Decoder pour le contexte offline
          const response = await fetch(clip.sourceUrl);
          const arrayBuffer = await response.arrayBuffer();
          const offlineBuffer = await offlineContext.decodeAudioData(arrayBuffer);

          const source = offlineContext.createBufferSource();
          const clipGain = offlineContext.createGain();

          source.buffer = offlineBuffer;
          clipGain.gain.value = clip.volume;
          source.connect(clipGain);
          clipGain.connect(trackGain);

          const clipDuration = getClipDuration(clip);
          source.start(clip.startTime, clip.inPoint, clipDuration);
        } catch (error) {
          console.error(`Failed to export clip ${clip.id}:`, error);
        }
      }
    }

    // Render
    const renderedBuffer = await offlineContext.startRendering();

    // Convertir en WAV
    if (format === 'wav') {
      return this.audioBufferToWav(renderedBuffer);
    }

    // Pour MP3, on retourne WAV pour l'instant (MP3 encoding necessiterait lamejs)
    return this.audioBufferToWav(renderedBuffer);
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // Nettoyage
  destroy(): void {
    this.stop();
    this.clips.clear();
    this.tracks.clear();
    this.audioBufferCache.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton pour l'application
let engineInstance: MontageAudioEngine | null = null;

export function getMontageAudioEngine(): MontageAudioEngine {
  if (!engineInstance) {
    engineInstance = new MontageAudioEngine();
  }
  return engineInstance;
}
