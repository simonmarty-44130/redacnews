// apps/web/lib/audio-montage/ToneEngine.ts
// Moteur de synchronisation multi-piste base sur Tone.js
// Remplace SyncEngine.ts pour une synchronisation sample-accurate

import * as Tone from 'tone';

/**
 * Convertir un gain linéaire (0-1) en décibels
 * Tone.js n'exporte pas gainToDb, on doit l'implémenter
 */
function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Reference vers un clip audio synchronise via Tone.js
 */
export interface ToneClipRef {
  player: Tone.Player;
  volume: Tone.Volume;
  startTime: number; // Position sur la timeline globale
  inPoint: number; // Point d'entree dans le fichier source
  outPoint: number; // Point de sortie dans le fichier source
  fadeInDuration: number;
  fadeOutDuration: number;
  isReady: boolean;
}

export type TimeUpdateCallback = (time: number) => void;
export type PlayStateCallback = (isPlaying: boolean) => void;

/**
 * ToneEngine - Moteur de synchronisation multi-piste avec Tone.js
 *
 * Principe: Utilise Tone.Transport comme chef d'orchestre central.
 * Tous les clips sont des Tone.Player synchronises via .sync().
 * La synchronisation est sample-accurate (pas de drift).
 */
export class ToneEngine {
  private clips: Map<string, ToneClipRef> = new Map();
  private timeUpdateCallbacks: Set<TimeUpdateCallback> = new Set();
  private playStateCallbacks: Set<PlayStateCallback> = new Set();
  private _duration = 0;
  private updateInterval: number | null = null;
  private isInitialized = false;

  /**
   * Initialiser l'AudioContext (necessite interaction utilisateur)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Tone.start();
      console.log('[ToneEngine] AudioContext started');
      this.isInitialized = true;
    } catch (error) {
      console.error('[ToneEngine] Failed to start AudioContext:', error);
      throw error;
    }
  }

  /**
   * Enregistrer un nouveau clip
   */
  async register(
    clipId: string,
    sourceUrl: string,
    startTime: number,
    inPoint: number,
    outPoint: number,
    volume: number,
    fadeInDuration = 0,
    fadeOutDuration = 0
  ): Promise<void> {
    console.log(`[ToneEngine] Registering clip: ${clipId}`);

    // S'assurer que l'AudioContext est demarre
    await this.init();

    // Creer le noeud de volume d'abord
    const volumeNode = new Tone.Volume(gainToDb(volume)).toDestination();

    // Creer le Player Tone.js et attendre qu'il soit charge
    const player = new Tone.Player({
      url: sourceUrl,
      fadeIn: 0.001, // Fade minimal pour eviter les clics
      fadeOut: 0.001,
      onload: () => {
        console.log(`[ToneEngine] Clip ${clipId} loaded`);
        const ref = this.clips.get(clipId);
        if (ref) {
          ref.isReady = true;
          // Synchroniser APRES le chargement
          ref.player.sync().start(ref.startTime, ref.inPoint);
        }
      },
    });

    // Connecter le player au volume
    player.connect(volumeNode);

    // Stocker la reference (isReady = false jusqu'au onload)
    this.clips.set(clipId, {
      player,
      volume: volumeNode,
      startTime,
      inPoint,
      outPoint,
      fadeInDuration,
      fadeOutDuration,
      isReady: false,
    });

    this.updateDuration();
  }

  /**
   * Desenregistrer un clip
   */
  unregister(clipId: string): void {
    console.log(`[ToneEngine] Unregistering clip: ${clipId}`);
    const ref = this.clips.get(clipId);

    if (ref) {
      try {
        ref.player.unsync();
        ref.player.dispose();
        ref.volume.dispose();
      } catch (error) {
        console.warn(`[ToneEngine] Error disposing clip ${clipId}:`, error);
      }

      this.clips.delete(clipId);
      this.updateDuration();
    }
  }

  /**
   * Mettre a jour un clip existant
   */
  async updateClip(
    clipId: string,
    updates: {
      startTime?: number;
      inPoint?: number;
      outPoint?: number;
      volume?: number;
      fadeInDuration?: number;
      fadeOutDuration?: number;
    }
  ): Promise<void> {
    const ref = this.clips.get(clipId);
    if (!ref) {
      console.warn(`[ToneEngine] Clip ${clipId} not found for update`);
      return;
    }

    // Mettre a jour les proprietes
    if (updates.startTime !== undefined) ref.startTime = updates.startTime;
    if (updates.inPoint !== undefined) ref.inPoint = updates.inPoint;
    if (updates.outPoint !== undefined) ref.outPoint = updates.outPoint;
    if (updates.fadeInDuration !== undefined) ref.fadeInDuration = updates.fadeInDuration;
    if (updates.fadeOutDuration !== undefined) ref.fadeOutDuration = updates.fadeOutDuration;

    // Mettre a jour le volume
    if (updates.volume !== undefined) {
      ref.volume.volume.value = gainToDb(updates.volume);
    }

    // Re-scheduler le player si le timing a change ET que le clip est pret
    if ((updates.startTime !== undefined || updates.inPoint !== undefined) && ref.isReady) {
      ref.player.unsync();
      ref.player.sync().start(ref.startTime, ref.inPoint);
    }

    this.updateDuration();
  }

  /**
   * Calculer la duree totale du projet
   */
  private updateDuration(): void {
    let maxEnd = 0;
    this.clips.forEach((ref) => {
      const clipEnd = ref.startTime + (ref.outPoint - ref.inPoint);
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd;
      }
    });
    this._duration = maxEnd;
  }

  // ============ Getters ============

  get isPlaying(): boolean {
    return Tone.Transport.state === 'started';
  }

  get globalTime(): number {
    return Tone.Transport.seconds;
  }

  get duration(): number {
    return this._duration;
  }

  // ============ Callbacks ============

  onTimeUpdate(callback: TimeUpdateCallback): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  onPlayStateChange(callback: PlayStateCallback): () => void {
    this.playStateCallbacks.add(callback);
    return () => this.playStateCallbacks.delete(callback);
  }

  private notifyTimeUpdate(time: number): void {
    this.timeUpdateCallbacks.forEach((cb) => cb(time));
  }

  private notifyPlayState(isPlaying: boolean): void {
    this.playStateCallbacks.forEach((cb) => cb(isPlaying));
  }

  private startTimeUpdates(): void {
    if (this.updateInterval !== null) return;

    this.updateInterval = window.setInterval(() => {
      if (this.isPlaying) {
        this.notifyTimeUpdate(Tone.Transport.seconds);

        // Arreter automatiquement a la fin
        if (this._duration > 0 && Tone.Transport.seconds >= this._duration) {
          this.stop();
        }
      }
    }, 50); // 20fps pour les updates UI
  }

  private stopTimeUpdates(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // ============ Transport ============

  /**
   * Demarrer la lecture
   */
  async play(fromTime?: number): Promise<void> {
    console.log(`[ToneEngine] play() called, fromTime: ${fromTime}`);

    // S'assurer que l'AudioContext est demarre
    await this.init();

    // Positionner le curseur
    if (fromTime !== undefined) {
      Tone.Transport.seconds = fromTime;
    }

    // Verifier que tous les clips sont prets
    const allReady = Array.from(this.clips.values()).every((ref) => ref.isReady);
    if (!allReady) {
      console.warn('[ToneEngine] Some clips are not ready yet');
    }

    // Demarrer le Transport
    Tone.Transport.start();
    this.notifyPlayState(true);
    this.startTimeUpdates();

    console.log(`[ToneEngine] Playing from ${Tone.Transport.seconds.toFixed(2)}s`);
  }

  /**
   * Mettre en pause
   */
  pause(): void {
    console.log('[ToneEngine] pause()');
    Tone.Transport.pause();
    this.notifyPlayState(false);
    this.stopTimeUpdates();
  }

  /**
   * Arreter et revenir au debut
   */
  stop(): void {
    console.log('[ToneEngine] stop()');
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    this.notifyPlayState(false);
    this.notifyTimeUpdate(0);
    this.stopTimeUpdates();
  }

  /**
   * Aller a un temps specifique
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      Tone.Transport.pause();
    }

    Tone.Transport.seconds = Math.max(0, Math.min(time, this._duration));
    this.notifyTimeUpdate(Tone.Transport.seconds);

    if (wasPlaying) {
      Tone.Transport.start();
    }

    console.log(`[ToneEngine] Seeked to ${Tone.Transport.seconds.toFixed(2)}s`);
  }

  // ============ Cleanup ============

  /**
   * Nettoyer les ressources
   */
  destroy(): void {
    console.log('[ToneEngine] Destroying');
    this.stop();
    this.stopTimeUpdates();

    this.clips.forEach((ref, clipId) => {
      try {
        ref.player.unsync();
        ref.player.dispose();
        ref.volume.dispose();
      } catch (error) {
        console.warn(`[ToneEngine] Error disposing clip ${clipId}:`, error);
      }
    });

    this.clips.clear();
    this.timeUpdateCallbacks.clear();
    this.playStateCallbacks.clear();
    this.isInitialized = false;
  }
}

// ============ Singleton ============

let engineInstance: ToneEngine | null = null;

/**
 * Obtenir l'instance du ToneEngine (singleton)
 */
export function getToneEngine(): ToneEngine {
  if (!engineInstance) {
    engineInstance = new ToneEngine();
  }
  return engineInstance;
}

/**
 * Reinitialiser le ToneEngine
 */
export function resetToneEngine(): void {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}
