// apps/web/lib/audio-montage/SyncEngine.ts
// Coordonnateur de synchronisation pour multipiste
// Utilise performance.now() - PAS d'AudioContext

/**
 * Interface pour les refs des clips synchronises
 */
export interface SyncedClipRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (globalTime: number) => void;
  setVolume: (volume: number) => void;
  isReady: () => boolean;
  isCurrentlyPlaying: () => boolean;
  getTimeRange: () => { start: number; end: number };
}

export type TimeUpdateCallback = (time: number) => void;
export type PlayStateCallback = (isPlaying: boolean) => void;

/**
 * SyncEngine - Coordonne la lecture de plusieurs instances WaveSurfer
 *
 * Principe: Chaque clip est une instance WaveSurfer independante.
 * Le SyncEngine les coordonne via performance.now() (jamais bloque).
 */
export class SyncEngine {
  private clips: Map<string, SyncedClipRef> = new Map();
  private _isPlaying = false;
  private _globalTime = 0;
  private playStartTimestamp = 0;
  private animationFrameId: number | null = null;
  private timeUpdateCallbacks: Set<TimeUpdateCallback> = new Set();
  private playStateCallbacks: Set<PlayStateCallback> = new Set();
  private _duration = 0;

  /**
   * Enregistrer un clip
   */
  register(clipId: string, ref: SyncedClipRef): void {
    console.log(`[SyncEngine] register clip: ${clipId}`);
    this.clips.set(clipId, ref);
    // Recalculer la duree totale
    this.updateDuration();
    console.log(`[SyncEngine] registered clips: ${Array.from(this.clips.keys()).join(', ')}`);
  }

  /**
   * Desenregistrer un clip (seulement si la ref correspond)
   * Cela evite le probleme de React StrictMode qui double-mount les composants
   */
  unregister(clipId: string, ref?: SyncedClipRef): void {
    // Si une ref est fournie, ne supprimer que si elle correspond
    if (ref) {
      const currentRef = this.clips.get(clipId);
      if (currentRef !== ref) {
        console.log(`[SyncEngine] unregister ignored for ${clipId} (ref mismatch)`);
        return;
      }
    }
    console.log(`[SyncEngine] unregister clip: ${clipId}`);
    this.clips.delete(clipId);
    this.updateDuration();
  }

  /**
   * Calculer la duree totale du projet
   */
  private updateDuration(): void {
    let maxEnd = 0;
    this.clips.forEach((ref) => {
      const range = ref.getTimeRange();
      if (range.end > maxEnd) {
        maxEnd = range.end;
      }
    });
    this._duration = maxEnd;
  }

  // ============ Getters ============

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get globalTime(): number {
    return this._globalTime;
  }

  get duration(): number {
    return this._duration;
  }

  // ============ Callbacks ============

  /**
   * S'abonner aux mises a jour du temps
   * @returns fonction de desabonnement
   */
  onTimeUpdate(callback: TimeUpdateCallback): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  /**
   * S'abonner aux changements d'etat de lecture
   * @returns fonction de desabonnement
   */
  onPlayStateChange(callback: PlayStateCallback): () => void {
    this.playStateCallbacks.add(callback);
    return () => this.playStateCallbacks.delete(callback);
  }

  // ============ Transport ============

  /**
   * Demarrer la lecture
   */
  play(fromTime?: number): void {
    console.log(`[SyncEngine] play() called, fromTime: ${fromTime}, globalTime: ${this._globalTime}`);
    console.log(`[SyncEngine] registered clips: ${Array.from(this.clips.keys()).join(', ')}`);

    if (fromTime !== undefined) {
      this._globalTime = fromTime;
    }

    this.playStartTimestamp = performance.now() / 1000 - this._globalTime;
    this._isPlaying = true;
    this.notifyPlayState(true);

    // Demarrer les clips qui sont dans la plage actuelle
    this.clips.forEach((ref, clipId) => {
      const range = ref.getTimeRange();
      console.log(`[SyncEngine] clip ${clipId}: range=${range.start.toFixed(2)}-${range.end.toFixed(2)}, isReady=${ref.isReady()}`);
      if (this._globalTime >= range.start && this._globalTime < range.end) {
        if (ref.isReady()) {
          console.log(`[SyncEngine] starting clip ${clipId} immediately`);
          ref.seekTo(this._globalTime);
          ref.play();
        }
      }
    });

    this.startLoop();
  }

  /**
   * Mettre en pause
   */
  pause(): void {
    this._isPlaying = false;
    this.notifyPlayState(false);
    this.stopLoop();

    this.clips.forEach((ref) => {
      ref.pause();
    });
  }

  /**
   * Arreter et revenir au debut
   */
  stop(): void {
    this._isPlaying = false;
    this._globalTime = 0;
    this.notifyPlayState(false);
    this.notifyTimeUpdate(0);
    this.stopLoop();

    this.clips.forEach((ref) => {
      ref.stop();
    });
  }

  /**
   * Aller a un temps specifique
   */
  seek(time: number): void {
    this._globalTime = Math.max(0, time);
    this.notifyTimeUpdate(this._globalTime);

    if (this._isPlaying) {
      this.playStartTimestamp = performance.now() / 1000 - this._globalTime;
    }

    // Repositionner tous les clips
    this.clips.forEach((ref) => {
      ref.seekTo(this._globalTime);

      const range = ref.getTimeRange();
      const shouldPlay =
        this._isPlaying &&
        this._globalTime >= range.start &&
        this._globalTime < range.end;

      if (shouldPlay && ref.isReady()) {
        ref.play();
      } else {
        ref.pause();
      }
    });
  }

  // ============ Boucle principale ============

  private startLoop(): void {
    const tick = () => {
      if (!this._isPlaying) return;

      // Temps base sur performance.now() - JAMAIS bloque
      this._globalTime = performance.now() / 1000 - this.playStartTimestamp;
      this.notifyTimeUpdate(this._globalTime);

      // Verifier si on a atteint la fin
      if (this._duration > 0 && this._globalTime >= this._duration) {
        this.stop();
        return;
      }

      // Gerer le demarrage/arret des clips selon leur position
      this.clips.forEach((ref) => {
        const range = ref.getTimeRange();
        const isInRange =
          this._globalTime >= range.start && this._globalTime < range.end;
        const isPlaying = ref.isCurrentlyPlaying();

        if (isInRange && !isPlaying && ref.isReady()) {
          ref.seekTo(this._globalTime);
          ref.play();
        } else if (!isInRange && isPlaying) {
          ref.pause();
        }
      });

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ============ Notifications ============

  private notifyTimeUpdate(time: number): void {
    this.timeUpdateCallbacks.forEach((cb) => cb(time));
  }

  private notifyPlayState(isPlaying: boolean): void {
    this.playStateCallbacks.forEach((cb) => cb(isPlaying));
  }

  // ============ Cleanup ============

  /**
   * Nettoyer les ressources
   */
  destroy(): void {
    this.stopLoop();
    this.clips.clear();
    this.timeUpdateCallbacks.clear();
    this.playStateCallbacks.clear();
  }
}

// ============ Singleton ============

let engineInstance: SyncEngine | null = null;

/**
 * Obtenir l'instance du SyncEngine (singleton)
 */
export function getSyncEngine(): SyncEngine {
  if (!engineInstance) {
    engineInstance = new SyncEngine();
  }
  return engineInstance;
}

/**
 * Reinitialiser le SyncEngine
 */
export function resetSyncEngine(): void {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}
