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
 * Sécuriser un temps pour l'API Web Audio
 * Évite les erreurs RangeError dues aux imprécisions flottantes
 */
function safeTime(time: number): number {
  return Math.max(0, time);
}

/**
 * Reference vers un clip audio synchronise via Tone.js
 */
export interface ToneClipRef {
  player: Tone.Player;
  fadeGain: Tone.Gain; // Gain node pour les fades in/out
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

    // Creer la chaine audio : Player -> Fade Gain -> Volume -> Destination
    const fadeGain = new Tone.Gain(1); // Gain pour les fades (commence à 1 = pas de fade)
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

          // ⚠️ NE PAS synchroniser si le Transport joue déjà
          // Cela cause "buffer is not set" car le player n'est pas encore totalement prêt
          const transportState = Tone.Transport.state;

          if (transportState === 'stopped') {
            // Transport arrêté : on peut synchroniser normalement
            const duration = ref.outPoint - ref.inPoint;
            ref.player.sync().start(ref.startTime, ref.inPoint, duration);
            this.scheduleFades(ref);
          } else {
            // Transport en cours : on synchronise et on démarre manuellement si nécessaire
            console.warn(`[ToneEngine] Clip ${clipId} loaded while Transport is ${transportState}`);
            const duration = ref.outPoint - ref.inPoint;
            ref.player.sync();

            // Si on est déjà passé le point de départ, ne rien faire
            // Sinon, programmer le démarrage
            const currentTime = Tone.Transport.seconds;
            if (currentTime < ref.startTime) {
              ref.player.start(ref.startTime, ref.inPoint, duration);
            } else if (currentTime < ref.startTime + duration) {
              // On est au milieu du clip, démarrer avec offset
              const offset = ref.inPoint + (currentTime - ref.startTime);
              const remainingDuration = duration - (currentTime - ref.startTime);
              ref.player.start(currentTime, offset, remainingDuration);
            }

            this.scheduleFades(ref);
          }
        }
      },
    });

    // Connecter : Player -> Fade Gain -> Volume -> Destination
    player.chain(fadeGain, volumeNode);

    // Stocker la reference (isReady = false jusqu'au onload)
    this.clips.set(clipId, {
      player,
      fadeGain,
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
        ref.fadeGain.dispose();
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

    // Mémoriser les anciennes valeurs pour détecter les vrais changements
    const oldStartTime = ref.startTime;
    const oldInPoint = ref.inPoint;
    const oldOutPoint = ref.outPoint;
    const oldFadeInDuration = ref.fadeInDuration;
    const oldFadeOutDuration = ref.fadeOutDuration;

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

    // Détecter les vrais changements de timing
    const timingChanged = (
      (updates.startTime !== undefined && oldStartTime !== updates.startTime) ||
      (updates.inPoint !== undefined && oldInPoint !== updates.inPoint) ||
      (updates.outPoint !== undefined && oldOutPoint !== updates.outPoint)
    );

    // Détecter les vrais changements de fades
    const fadesChanged = (
      (updates.fadeInDuration !== undefined && oldFadeInDuration !== updates.fadeInDuration) ||
      (updates.fadeOutDuration !== undefined && oldFadeOutDuration !== updates.fadeOutDuration)
    );

    // Re-scheduler le player si le timing a changé ET que le clip est prêt
    if (timingChanged && ref.isReady) {
      ref.player.unsync();
      const duration = ref.outPoint - ref.inPoint;
      ref.player.sync().start(ref.startTime, ref.inPoint, duration);
    }

    // Re-scheduler les fades UNIQUEMENT si elles ont vraiment changé ou si le timing a changé
    if ((fadesChanged || timingChanged) && ref.isReady) {
      console.log(`[ToneEngine] updateClip: Re-scheduling fades (fades changed: ${fadesChanged}, timing changed: ${timingChanged})`);
      this.scheduleFades(ref);
    }

    this.updateDuration();
  }

  /**
   * Programmer les fades in/out pour un clip
   */
  private scheduleFades(ref: ToneClipRef): void {
    const duration = ref.outPoint - ref.inPoint;
    const now = safeTime(Tone.Transport.seconds);

    // Annuler toutes les automations précédentes sur ce gain
    ref.fadeGain.gain.cancelScheduledValues(now);

    // Si pas de fade, rester à 1 (volume normal)
    if (ref.fadeInDuration === 0 && ref.fadeOutDuration === 0) {
      ref.fadeGain.gain.setValueAtTime(1, now);
      console.log('[ToneEngine] scheduleFades: no fades, gain=1');
      return;
    }

    const startTime = safeTime(ref.startTime);
    const endTime = safeTime(startTime + duration);
    const fadeInEnd = safeTime(startTime + ref.fadeInDuration);
    const fadeOutStart = safeTime(endTime - ref.fadeOutDuration);

    console.log('[ToneEngine] scheduleFades:', {
      now,
      startTime,
      endTime,
      fadeInDuration: ref.fadeInDuration,
      fadeOutDuration: ref.fadeOutDuration,
      fadeInEnd,
      fadeOutStart,
    });

    // Stratégie simplifiée : TOUJOURS programmer depuis maintenant (now)
    // en tenant compte de où nous sommes dans la lecture

    // Point de départ : quelle est la valeur du gain MAINTENANT ?
    let currentGainValue = 1; // Par défaut

    // Si on est avant le clip, on commence à 0 si fade in
    if (now < startTime) {
      currentGainValue = ref.fadeInDuration > 0 ? 0 : 1;
      ref.fadeGain.gain.setValueAtTime(currentGainValue, now);
    }

    // ========== FADE IN ==========
    if (ref.fadeInDuration > 0) {
      if (now < startTime) {
        // Clip pas encore commencé : fade 0→1
        ref.fadeGain.gain.setValueAtTime(0, startTime);
        ref.fadeGain.gain.linearRampToValueAtTime(1, fadeInEnd);
        console.log('[ToneEngine]   → Fade IN: 0@' + startTime.toFixed(2) + ' → 1@' + fadeInEnd.toFixed(2));
      } else if (now >= startTime && now < fadeInEnd) {
        // En plein fade in : calculer où on en est
        const progress = (now - startTime) / ref.fadeInDuration;
        currentGainValue = Math.max(0.001, Math.min(1, progress)); // min 0.001 pour éviter les bugs
        ref.fadeGain.gain.setValueAtTime(currentGainValue, now);
        ref.fadeGain.gain.linearRampToValueAtTime(1, fadeInEnd);
        console.log('[ToneEngine]   → Fade IN (mid): ' + currentGainValue.toFixed(3) + '@' + now.toFixed(2) + ' → 1@' + fadeInEnd.toFixed(2));
      } else {
        // Fade in déjà passé
        currentGainValue = 1;
        ref.fadeGain.gain.setValueAtTime(1, now);
        console.log('[ToneEngine]   → Fade IN (done): 1@' + now.toFixed(2));
      }
    } else {
      // Pas de fade in : on commence à 1 dès le début du clip
      if (now >= startTime) {
        ref.fadeGain.gain.setValueAtTime(1, now);
      } else {
        ref.fadeGain.gain.setValueAtTime(1, startTime);
      }
    }

    // ========== FADE OUT ==========
    if (ref.fadeOutDuration > 0) {
      if (now < fadeOutStart) {
        // Fade out pas encore commencé : programme 1→0
        ref.fadeGain.gain.setValueAtTime(1, fadeOutStart);
        ref.fadeGain.gain.linearRampToValueAtTime(0.001, endTime); // 0.001 au lieu de 0
        console.log('[ToneEngine]   → Fade OUT: 1@' + fadeOutStart.toFixed(2) + ' → 0@' + endTime.toFixed(2));
      } else if (now >= fadeOutStart && now < endTime) {
        // En plein fade out
        const progress = (now - fadeOutStart) / ref.fadeOutDuration;
        currentGainValue = Math.max(0.001, Math.min(1, 1 - progress));
        ref.fadeGain.gain.setValueAtTime(currentGainValue, now);
        ref.fadeGain.gain.linearRampToValueAtTime(0.001, endTime);
        console.log('[ToneEngine]   → Fade OUT (mid): ' + currentGainValue.toFixed(3) + '@' + now.toFixed(2) + ' → 0@' + endTime.toFixed(2));
      } else {
        // Fade out déjà passé
        ref.fadeGain.gain.setValueAtTime(0.001, now);
        console.log('[ToneEngine]   → Fade OUT (done): 0@' + now.toFixed(2));
      }
    }
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

    // ⚠️ ATTENDRE que tous les clips soient prêts avant de démarrer
    const maxWaitTime = 5000; // 5 secondes max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const allReady = Array.from(this.clips.values()).every((ref) => ref.isReady);
      if (allReady) {
        break;
      }
      console.warn('[ToneEngine] Waiting for clips to load...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Vérifier une dernière fois
    const allReady = Array.from(this.clips.values()).every((ref) => ref.isReady);
    if (!allReady) {
      const notReady = Array.from(this.clips.entries())
        .filter(([_, ref]) => !ref.isReady)
        .map(([id]) => id);
      console.error('[ToneEngine] Cannot play: some clips are not ready:', notReady);
      throw new Error('Cannot play: some clips are not ready yet');
    }

    // Re-scheduler TOUS les fades AVANT de démarrer
    // (car ils peuvent avoir été modifiés pendant la pause)
    console.log('[ToneEngine] Re-scheduling all fades before play...');
    this.clips.forEach((ref) => {
      this.scheduleFades(ref);
    });

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
        ref.fadeGain.dispose();
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
