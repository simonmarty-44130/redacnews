// apps/web/lib/audio-montage/MultiTrackEngine.ts

import type { WaveSurferTrackRef } from '@/components/audio-montage/WaveSurferTrack';
import type { MontageProject, Clip } from './types';
import { DEFAULT_SAMPLE_RATE } from './constants';

interface ClipEntry {
  id: string;
  trackId: string;
  ref: WaveSurferTrackRef | null;
  startTime: number;
  inPoint: number;
  outPoint: number;
  volume: number;
  isScheduled: boolean;
  scheduledTimeout: number | null;
}

interface TrackEntry {
  id: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export class MultiTrackEngine {
  private clips: Map<string, ClipEntry> = new Map();
  private tracks: Map<string, TrackEntry> = new Map();
  private _isPlaying = false;
  private _currentTime = 0;
  private animationFrameId: number | null = null;
  private playStartTime = 0; // performance.now() au moment du play
  private playFromTime = 0; // temps de la timeline au moment du play
  private onTimeUpdate: ((time: number) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;

  private currentProjectId: string | null = null;
  private totalDuration = 0;

  // Charger la structure du projet
  loadProjectStructure(project: MontageProject): void {
    this.currentProjectId = project.id;

    // Charger les pistes
    this.tracks.clear();
    project.tracks.forEach((track) => {
      this.tracks.set(track.id, {
        id: track.id,
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
      });
    });

    // Charger la structure des clips (sans les refs - elles seront enregistrees apres)
    this.clips.clear();
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        this.clips.set(clip.id, {
          id: clip.id,
          trackId: track.id,
          ref: null,
          startTime: clip.startTime,
          inPoint: clip.inPoint,
          outPoint: clip.outPoint,
          volume: clip.volume,
          isScheduled: false,
          scheduledTimeout: null,
        });
      });
    });

    // Calculer la duree totale
    this.totalDuration = this.calculateTotalDuration();
  }

  private calculateTotalDuration(): number {
    let maxEndTime = 0;
    this.clips.forEach((clip) => {
      const endTime = clip.startTime + (clip.outPoint - clip.inPoint);
      if (endTime > maxEndTime) {
        maxEndTime = endTime;
      }
    });
    return maxEndTime;
  }

  // Enregistrer une ref WaveSurfer pour un clip
  registerClipRef(clipId: string, ref: WaveSurferTrackRef | null): void {
    const clip = this.clips.get(clipId);
    if (clip) {
      clip.ref = ref;
    }
  }

  // Desenregistrer un clip
  unregisterClip(clipId: string): void {
    const clip = this.clips.get(clipId);
    if (clip?.scheduledTimeout) {
      clearTimeout(clip.scheduledTimeout);
    }
    this.clips.delete(clipId);
  }

  setTimeUpdateCallback(cb: (time: number) => void): void {
    this.onTimeUpdate = cb;
  }

  setPlaybackEndCallback(cb: () => void): void {
    this.onPlaybackEnd = cb;
  }

  // Demarrer la lecture
  play(fromTime?: number): void {
    const time = fromTime ?? this._currentTime;
    this._currentTime = time;
    this.playFromTime = time;
    this.playStartTime = performance.now();
    this._isPlaying = true;

    console.log('[MultiTrackEngine] play() from', time.toFixed(2));

    // Verifier si on a des pistes en solo
    const hasSolo = Array.from(this.tracks.values()).some((t) => t.solo);

    // Programmer chaque clip
    this.clips.forEach((clipEntry) => {
      const track = this.tracks.get(clipEntry.trackId);
      if (!track) return;

      // Verifier mute/solo
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const clipDuration = clipEntry.outPoint - clipEntry.inPoint;
      const clipEndTime = clipEntry.startTime + clipDuration;

      // Clip deja passe ?
      if (time >= clipEndTime) {
        return;
      }

      // Calculer le volume effectif
      const effectiveVolume = track.volume * clipEntry.volume;

      if (time >= clipEntry.startTime && time < clipEndTime) {
        // On est dans ce clip - demarrer immediatement
        if (clipEntry.ref?.isReady()) {
          clipEntry.ref.setVolume(effectiveVolume);
          clipEntry.ref.seek(time);
          clipEntry.ref.play();
          clipEntry.isScheduled = true;
          console.log(`[MultiTrackEngine] Playing clip ${clipEntry.id} immediately`);
        }
      } else if (time < clipEntry.startTime) {
        // Le clip est dans le futur - programmer le demarrage
        const delay = (clipEntry.startTime - time) * 1000;
        clipEntry.scheduledTimeout = window.setTimeout(() => {
          if (this._isPlaying && clipEntry.ref?.isReady()) {
            clipEntry.ref.setVolume(effectiveVolume);
            clipEntry.ref.seek(clipEntry.startTime);
            clipEntry.ref.play();
            clipEntry.isScheduled = true;
            console.log(`[MultiTrackEngine] Playing clip ${clipEntry.id} after delay`);
          }
        }, delay);
      }
    });

    // Demarrer la boucle de mise a jour
    this.startUpdateLoop();
  }

  pause(): void {
    if (!this._isPlaying) return;

    console.log('[MultiTrackEngine] pause()');

    this._isPlaying = false;
    this._currentTime = this.getCurrentTime();

    // Arreter tous les timeouts programmes
    this.clips.forEach((clip) => {
      if (clip.scheduledTimeout) {
        clearTimeout(clip.scheduledTimeout);
        clip.scheduledTimeout = null;
      }
    });

    // Mettre en pause toutes les instances WaveSurfer
    this.clips.forEach((clip) => {
      if (clip.ref?.isReady() && clip.isScheduled) {
        clip.ref.pause();
        clip.isScheduled = false;
      }
    });

    // Arreter la boucle d'animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  stop(): void {
    console.log('[MultiTrackEngine] stop()');

    this.pause();
    this._currentTime = 0;

    // Reinitialiser toutes les instances WaveSurfer
    this.clips.forEach((clip) => {
      if (clip.ref?.isReady()) {
        clip.ref.stop();
      }
    });

    this.onTimeUpdate?.(0);
  }

  seek(time: number): void {
    const wasPlaying = this._isPlaying;

    // Arreter la lecture actuelle
    if (wasPlaying) {
      this.pause();
    }

    this._currentTime = Math.max(0, time);
    this.onTimeUpdate?.(this._currentTime);

    // Reprendre la lecture si necessaire
    if (wasPlaying) {
      this.play(this._currentTime);
    }
  }

  private startUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const update = () => {
      if (!this._isPlaying) return;

      // Calculer le temps actuel base sur performance.now()
      const elapsed = (performance.now() - this.playStartTime) / 1000;
      this._currentTime = this.playFromTime + elapsed;

      this.onTimeUpdate?.(this._currentTime);

      // Verifier si on a atteint la fin
      if (this._currentTime >= this.totalDuration && this.totalDuration > 0) {
        console.log('[MultiTrackEngine] Reached end of project');
        this.pause();
        this._currentTime = 0;
        this.onTimeUpdate?.(0);
        this.onPlaybackEnd?.();
        return;
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  getCurrentTime(): number {
    if (!this._isPlaying) {
      return this._currentTime;
    }

    const elapsed = (performance.now() - this.playStartTime) / 1000;
    return this.playFromTime + elapsed;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get currentTime(): number {
    return this.getCurrentTime();
  }

  // Controles de volume
  setMasterVolume(volume: number): void {
    // Pour le volume master, on va recalculer le volume de chaque clip
    // Note: Dans cette implementation simplifiee, on ne stocke pas le master volume
    // car chaque clip recoit le produit track.volume * clip.volume
    // Pour un vrai master volume, il faudrait connecter tous les WaveSurfer a un gain node
    console.log('[MultiTrackEngine] setMasterVolume:', volume);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.volume = volume;
      // Mettre a jour le volume de tous les clips de cette piste qui jouent
      this.clips.forEach((clip) => {
        if (clip.trackId === trackId && clip.ref?.isReady()) {
          clip.ref.setVolume(volume * clip.volume);
        }
      });
    }
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.muted = muted;
      // Mettre a jour tous les clips de cette piste
      this.clips.forEach((clip) => {
        if (clip.trackId === trackId && clip.ref?.isReady()) {
          if (muted) {
            clip.ref.setVolume(0);
          } else {
            clip.ref.setVolume(track.volume * clip.volume);
          }
        }
      });
    }
  }

  setTrackPan(trackId: string, pan: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.pan = pan;
      // Note: WaveSurfer ne supporte pas le pan nativement
      // Pour un vrai pan, il faudrait utiliser Web Audio API avec StereoPanner
    }
  }

  setTrackSolo(trackId: string, solo: boolean): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    track.solo = solo;

    // Recalculer les volumes en tenant compte du solo
    const hasSolo = Array.from(this.tracks.values()).some((t) => t.solo);

    this.clips.forEach((clip) => {
      const clipTrack = this.tracks.get(clip.trackId);
      if (!clipTrack || !clip.ref?.isReady()) return;

      if (hasSolo) {
        // Si une piste est en solo, seules les pistes solo sont audibles
        if (clipTrack.solo) {
          clip.ref.setVolume(clipTrack.volume * clip.volume);
        } else {
          clip.ref.setVolume(0);
        }
      } else {
        // Pas de solo - respecter le mute
        if (clipTrack.muted) {
          clip.ref.setVolume(0);
        } else {
          clip.ref.setVolume(clipTrack.volume * clip.volume);
        }
      }
    });
  }

  updateClip(clipId: string, updates: Partial<Clip>): void {
    const clip = this.clips.get(clipId);
    if (clip) {
      if (updates.inPoint !== undefined) clip.inPoint = updates.inPoint;
      if (updates.outPoint !== undefined) clip.outPoint = updates.outPoint;
      if (updates.startTime !== undefined) clip.startTime = updates.startTime;
      if (updates.volume !== undefined) {
        clip.volume = updates.volume;
        const track = this.tracks.get(clip.trackId);
        if (track && clip.ref?.isReady()) {
          clip.ref.setVolume(track.volume * updates.volume);
        }
      }
    }
  }

  removeClip(clipId: string): void {
    this.unregisterClip(clipId);
  }

  // Charger un nouveau clip
  async loadClip(clip: Clip, trackId: string): Promise<void> {
    // Ajouter le clip a la structure
    this.clips.set(clip.id, {
      id: clip.id,
      trackId,
      ref: null,
      startTime: clip.startTime,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
      volume: clip.volume,
      isScheduled: false,
      scheduledTimeout: null,
    });

    // Recalculer la duree totale
    this.totalDuration = this.calculateTotalDuration();
  }

  // Export du mix (utilise OfflineAudioContext)
  async exportMix(project: MontageProject): Promise<Blob> {
    const sampleRate = DEFAULT_SAMPLE_RATE;
    const duration = Math.max(project.duration, 1);
    const offlineContext = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    const masterGain = offlineContext.createGain();
    masterGain.connect(offlineContext.destination);

    // Verifier si on a des pistes en solo
    const hasSolo = project.tracks.some((t) => t.solo);

    for (const track of project.tracks) {
      // Verifier mute/solo
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      const trackGain = offlineContext.createGain();
      const trackPan = offlineContext.createStereoPanner();
      trackGain.gain.value = track.volume;
      trackPan.pan.value = track.pan;
      trackGain.connect(trackPan);
      trackPan.connect(masterGain);

      for (const clip of track.clips) {
        try {
          const response = await fetch(clip.sourceUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

          const source = offlineContext.createBufferSource();
          const clipGain = offlineContext.createGain();

          source.buffer = audioBuffer;
          clipGain.gain.value = clip.volume;
          source.connect(clipGain);
          clipGain.connect(trackGain);

          const clipDuration = clip.outPoint - clip.inPoint;
          source.start(clip.startTime, clip.inPoint, clipDuration);
        } catch (error) {
          console.error(`Export error for clip ${clip.id}:`, error);
        }
      }
    }

    const renderedBuffer = await offlineContext.startRendering();
    return this.audioBufferToWav(renderedBuffer);
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  destroy(): void {
    this.stop();
    this.clips.clear();
    this.tracks.clear();
    this.currentProjectId = null;
    this.onTimeUpdate = null;
    this.onPlaybackEnd = null;
  }

  // Getters pour compatibilite avec l'ancien code
  getIsPlaying(): boolean {
    return this._isPlaying;
  }

  get pauseTime(): number {
    return this._currentTime;
  }

  // Ces methodes sont pour compatibilite avec l'ancien code
  getAudioContextPublic(): AudioContext | null {
    return null; // On n'expose plus d'AudioContext
  }
}

// Singleton
let engineInstance: MultiTrackEngine | null = null;

export function getMultiTrackEngine(): MultiTrackEngine {
  if (!engineInstance) {
    engineInstance = new MultiTrackEngine();
  }
  return engineInstance;
}
