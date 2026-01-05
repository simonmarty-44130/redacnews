'use client';

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  memo,
} from 'react';
import WaveSurfer from 'wavesurfer.js';
import { cn } from '@/lib/utils';
import {
  getSyncEngine,
  type SyncedClipRef,
} from '@/lib/audio-montage/SyncEngine';

// Helper pour detecter les erreurs d'abort (normales lors du cleanup)
function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const errorStr = String(error);
  return (
    errorStr.includes('AbortError') ||
    errorStr.includes('aborted') ||
    errorStr.includes('abort') ||
    errorStr.includes('signal is aborted')
  );
}

interface SyncedWaveSurferProps {
  clipId: string;
  sourceUrl: string;
  sourceDuration?: number; // Duree totale du fichier source (secondes)
  startTime: number; // Position sur la timeline globale (secondes)
  inPoint: number; // Point d'entree dans le fichier source (secondes)
  outPoint: number; // Point de sortie dans le fichier source (secondes)
  volume: number; // 0 a 2 (0 = mute, 1 = 0dB, 2 = +6dB)
  clipVolume: number; // Volume du clip (pour affichage visuel de la waveform)
  fadeInDuration?: number; // Duree du fade in (secondes)
  fadeOutDuration?: number; // Duree du fade out (secondes)
  color: string; // Couleur de la waveform
  pixelsPerSecond: number; // Zoom de la timeline
  height?: number;
  onReady?: (clipId: string) => void;
  onError?: (clipId: string, error: string) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void; // Callback quand la vraie duree est detectee
}

/**
 * SyncedWaveSurfer - Un clip audio avec waveform synchronise
 *
 * Ce composant encapsule une instance WaveSurfer et s'enregistre
 * aupres du SyncEngine pour etre coordonne avec les autres clips.
 *
 * Inspire de AudioEditor.tsx qui fonctionne parfaitement.
 */
const SyncedWaveSurfer = memo(
  forwardRef<SyncedClipRef, SyncedWaveSurferProps>(
    (
      {
        clipId,
        sourceUrl,
        sourceDuration,
        startTime,
        inPoint,
        outPoint,
        volume,
        clipVolume,
        fadeInDuration = 0,
        fadeOutDuration = 0,
        color,
        pixelsPerSecond,
        height = 60,
        onReady,
        onError,
        onDurationDetected,
      },
      ref
    ) => {
      const containerRef = useRef<HTMLDivElement>(null);
      const wavesurferRef = useRef<WaveSurfer | null>(null);
      const [isReady, setIsReady] = useState(false);
      const [isPlaying, setIsPlaying] = useState(false);
      const [isLoading, setIsLoading] = useState(true);
      const [loadingProgress, setLoadingProgress] = useState(0); // Pourcentage de chargement 0-100
      const [hasError, setHasError] = useState(false);

      // Refs pour les etats (pour eviter les closures stale dans les callbacks)
      const isReadyRef = useRef(false);
      const isPlayingRef = useRef(false);

      // Flag pour eviter les operations apres unmount
      const isMountedRef = useRef(true);
      const instanceIdRef = useRef(0);

      // Refs pour les props actuelles (pour les callbacks)
      const propsRef = useRef({
        startTime,
        inPoint,
        outPoint,
        clipId,
        fadeInDuration,
        fadeOutDuration,
        volume,
      });
      propsRef.current = { startTime, inPoint, outPoint, clipId, fadeInDuration, fadeOutDuration, volume };

      // Ref pour l'intervalle de fade
      const fadeIntervalRef = useRef<number | null>(null);

      // Duree visible du clip
      const clipDuration = outPoint - inPoint;

      // Fonction pour calculer le multiplicateur de volume basé sur la position dans le clip
      const calculateFadeMultiplier = (currentLocalTime: number): number => {
        const { inPoint: ip, outPoint: op, fadeInDuration: fadeIn, fadeOutDuration: fadeOut } = propsRef.current;
        const clipDur = op - ip;
        const positionInClip = currentLocalTime - ip; // Position relative au début du clip

        let multiplier = 1;

        // Fade in: de 0 à 1 pendant fadeInDuration
        if (fadeIn > 0 && positionInClip < fadeIn) {
          multiplier = Math.max(0, positionInClip / fadeIn);
        }

        // Fade out: de 1 à 0 pendant fadeOutDuration
        if (fadeOut > 0 && positionInClip > clipDur - fadeOut) {
          const fadeOutPosition = clipDur - positionInClip;
          multiplier = Math.min(multiplier, Math.max(0, fadeOutPosition / fadeOut));
        }

        return multiplier;
      };

      // Fonction pour mettre à jour le volume avec fade
      const updateVolumeWithFade = () => {
        if (!wavesurferRef.current || !isReadyRef.current) return;

        const currentTime = wavesurferRef.current.getCurrentTime();
        const fadeMultiplier = calculateFadeMultiplier(currentTime);
        const baseVolume = propsRef.current.volume;
        const finalVolume = baseVolume * fadeMultiplier;

        wavesurferRef.current.setVolume(finalVolume);
      };

      // Démarrer/arrêter l'intervalle de fade selon l'état de lecture
      const startFadeInterval = () => {
        if (fadeIntervalRef.current) return;
        // Mettre à jour le volume toutes les 50ms pour un fade fluide
        fadeIntervalRef.current = window.setInterval(updateVolumeWithFade, 50);
        updateVolumeWithFade(); // Mise à jour immédiate
      };

      const stopFadeInterval = () => {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      };

      // Stocker la duree reelle du fichier source une fois chargee
      const [actualSourceDuration, setActualSourceDuration] = useState<number>(sourceDuration || 0);

      // Initialisation WaveSurfer - COPIE LA LOGIQUE DE AudioEditor.tsx
      useEffect(() => {
        isMountedRef.current = true;
        instanceIdRef.current += 1;
        const currentInstanceId = instanceIdRef.current;

        if (!containerRef.current) return;

        // Nettoyer l'instance precedente
        if (wavesurferRef.current) {
          try {
            wavesurferRef.current.destroy();
          } catch {
            // Ignorer les erreurs de destruction
          }
          wavesurferRef.current = null;
        }

        setIsLoading(true);
        setLoadingProgress(0);
        setHasError(false);
        setIsReady(false);
        setIsPlaying(false);
        isReadyRef.current = false;
        isPlayingRef.current = false;

        // Pour les fichiers tres longs (> 30 min), utiliser des parametres optimises
        const isLongFile = (sourceDuration || 0) > 1800; // Plus de 30 minutes
        // Pour les fichiers TRES longs (> 1h), encore plus optimise
        const isVeryLongFile = (sourceDuration || 0) > 3600; // Plus de 1 heure

        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: color,
          progressColor: `${color}cc`,
          cursorColor: 'transparent', // On gere la playhead globalement
          height: height,
          normalize: true,
          backend: 'WebAudio',
          hideScrollbar: true,
          interact: false, // Pas d'interaction directe - controlee par SyncEngine
          // Optimisations pour fichiers longs/tres longs
          ...(isVeryLongFile && {
            // Fichiers > 1h : tres simplifies pour eviter les problemes de memoire
            barWidth: 3,
            barGap: 2,
            barRadius: 1,
            minPxPerSec: 0.5, // Encore moins de resolution
          }),
          ...(isLongFile && !isVeryLongFile && {
            // Fichiers 30min-1h : modérément simplifies
            barWidth: 2,
            barGap: 1,
            barRadius: 1,
            minPxPerSec: 1,
          }),
        });

        // Ecouter la progression du chargement
        ws.on('loading', (percent: number) => {
          if (isMountedRef.current && instanceIdRef.current === currentInstanceId) {
            setLoadingProgress(Math.round(percent));
          }
        });

        ws.on('ready', () => {
          if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId)
            return;

          setLoadingProgress(100);
          const duration = ws.getDuration();
          console.log(`[SyncedWaveSurfer ${clipId}] ready, duration: ${duration?.toFixed(2)}s, sourceDuration prop: ${sourceDuration?.toFixed(2)}s`);
          setActualSourceDuration(duration);
          isReadyRef.current = true;
          setIsReady(true);
          setIsLoading(false);
          ws.setVolume(volume);

          // Notifier le parent si la duree reelle differe significativement de celle en props
          // Cela permet de corriger les clips dont la duree n'etait pas disponible a l'upload
          if (
            duration > 0 &&
            onDurationDetected &&
            (!sourceDuration || Math.abs(duration - sourceDuration) > 1)
          ) {
            console.log(`[SyncedWaveSurfer ${clipId}] Duration mismatch detected! Real: ${duration.toFixed(2)}s, Props: ${sourceDuration?.toFixed(2) ?? 'null'}s`);
            onDurationDetected(clipId, duration);
          }

          onReady?.(clipId);
        });

        ws.on('error', (err) => {
          if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId)
            return;
          if (isAbortError(err)) return;

          console.error(`[SyncedWaveSurfer ${clipId}] Error:`, err);
          setIsLoading(false);
          setHasError(true);
          onError?.(clipId, String(err));
        });

        ws.on('play', () => {
          if (isMountedRef.current && instanceIdRef.current === currentInstanceId) {
            isPlayingRef.current = true;
            setIsPlaying(true);
            // Démarrer l'intervalle de fade si des fades sont définis
            if (propsRef.current.fadeInDuration > 0 || propsRef.current.fadeOutDuration > 0) {
              startFadeInterval();
            }
          }
        });

        ws.on('pause', () => {
          if (isMountedRef.current && instanceIdRef.current === currentInstanceId) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            stopFadeInterval();
          }
        });

        ws.on('finish', () => {
          if (isMountedRef.current && instanceIdRef.current === currentInstanceId) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            stopFadeInterval();
          }
        });

        // Charger l'audio
        ws.load(sourceUrl).catch((error) => {
          if (isAbortError(error)) return;
          // Les autres erreurs seront gerees par l'event 'error'
        });

        wavesurferRef.current = ws;

        return () => {
          isMountedRef.current = false;
          stopFadeInterval();

          const wsToDestroy = wavesurferRef.current;
          wavesurferRef.current = null;

          if (wsToDestroy) {
            requestAnimationFrame(() => {
              try {
                wsToDestroy.destroy();
              } catch {
                // Ignorer les erreurs de destruction
              }
            });
          }
        };
      }, [sourceUrl, clipId, color, height, sourceDuration]);

      // Mettre a jour le volume quand il change
      useEffect(() => {
        if (wavesurferRef.current && isReady) {
          wavesurferRef.current.setVolume(volume);
        }
      }, [volume, isReady]);

      // Creer l'objet ref pour le SyncEngine
      const syncedRef: SyncedClipRef = {
        play: () => {
          console.log(`[SyncedWaveSurfer ${clipId}] play() called, isReady: ${isReadyRef.current}`);
          if (wavesurferRef.current && isReadyRef.current) {
            // Resume l'AudioContext si suspendu (autoplay policy)
            const media = wavesurferRef.current.getMediaElement();
            if (media) {
              const audioCtx = (media as HTMLAudioElement & { audioContext?: AudioContext }).audioContext;
              if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                  wavesurferRef.current?.play();
                }).catch(() => {
                  // Fallback: essayer de jouer quand meme
                  wavesurferRef.current?.play();
                });
                return;
              }
            }
            wavesurferRef.current.play();
          }
        },
        pause: () => {
          if (wavesurferRef.current) {
            wavesurferRef.current.pause();
          }
        },
        stop: () => {
          if (wavesurferRef.current) {
            wavesurferRef.current.pause();
            // Revenir au point d'entree
            wavesurferRef.current.setTime(propsRef.current.inPoint);
          }
        },
        seekTo: (globalTime: number) => {
          if (!wavesurferRef.current || !isReadyRef.current) return;

          const { startTime: st, inPoint: ip, outPoint: op } = propsRef.current;
          const clipDur = op - ip;
          const clipEnd = st + clipDur;

          // Verifier si globalTime est dans la plage de ce clip
          if (globalTime >= st && globalTime < clipEnd) {
            // Convertir le temps global en temps local dans le fichier source
            const localTime = globalTime - st + ip;
            console.log(`[SyncedWaveSurfer ${propsRef.current.clipId}] seekTo: globalTime=${globalTime.toFixed(2)}, localTime=${localTime.toFixed(2)}`);
            wavesurferRef.current.setTime(localTime);
          } else if (globalTime < st) {
            // Si avant le debut du clip, positionner au point d'entree
            wavesurferRef.current.setTime(ip);
          }
        },
        setVolume: (vol: number) => {
          if (wavesurferRef.current) {
            wavesurferRef.current.setVolume(vol);
          }
        },
        isReady: () => isReadyRef.current,
        isCurrentlyPlaying: () => isPlayingRef.current,
        getTimeRange: () => ({
          start: propsRef.current.startTime,
          end: propsRef.current.startTime + (propsRef.current.outPoint - propsRef.current.inPoint),
        }),
      };

      // Enregistrer aupres du SyncEngine une seule fois au montage
      // Note: On utilise useRef pour que syncedRef soit toujours a jour
      const syncedRefRef = useRef(syncedRef);
      syncedRefRef.current = syncedRef;

      useEffect(() => {
        const engine = getSyncEngine();
        // On enregistre un proxy qui delegue toujours vers la ref courante
        const proxyRef: SyncedClipRef = {
          play: () => syncedRefRef.current.play(),
          pause: () => syncedRefRef.current.pause(),
          stop: () => syncedRefRef.current.stop(),
          seekTo: (t) => syncedRefRef.current.seekTo(t),
          setVolume: (v) => syncedRefRef.current.setVolume(v),
          isReady: () => syncedRefRef.current.isReady(),
          isCurrentlyPlaying: () => syncedRefRef.current.isCurrentlyPlaying(),
          getTimeRange: () => syncedRefRef.current.getTimeRange(),
        };

        engine.register(clipId, proxyRef);

        return () => {
          // Passer la ref pour eviter de supprimer une registration plus recente
          // (important avec React StrictMode qui double-mount les composants)
          engine.unregister(clipId, proxyRef);
        };
      }, [clipId]); // Seulement quand clipId change

      // Exposer les methodes au parent via ref
      useImperativeHandle(ref, () => syncedRef, [isReady, isPlaying]);

      // Calculer le decalage et la largeur de la waveform
      // La waveform doit etre plus large que le conteneur pour montrer tout le fichier
      // et decalee vers la gauche pour cacher la partie avant inPoint
      const totalSourceDuration = actualSourceDuration || sourceDuration || outPoint;
      const waveformWidthRatio = totalSourceDuration / clipDuration;
      const offsetRatio = inPoint / totalSourceDuration;

      // Calculer le facteur de scale pour la waveform basé sur le volume du clip
      // Volume 1 = 0dB = pas de changement (scale 1)
      // Volume 2 = +6dB = amplitude doublée (scale 2, mais capped à 1.5 pour lisibilité)
      // Volume 0 = -∞ = amplitude nulle (scale 0.1 minimum pour voir quelque chose)
      const waveformScale = Math.max(0.1, Math.min(1.5, clipVolume));

      return (
        <div
          className={cn('w-full h-full rounded overflow-hidden relative')}
          style={{
            backgroundColor: `${color}30`,
          }}
        >
          {/* Container de la waveform avec decalage pour le trim et scaling selon volume */}
          <div
            ref={containerRef}
            className="absolute top-0 bottom-0 transition-transform duration-150"
            style={{
              // La waveform occupe toute la largeur du fichier source
              width: `${waveformWidthRatio * 100}%`,
              // Decaler vers la gauche pour afficher seulement a partir de inPoint
              left: `-${offsetRatio * waveformWidthRatio * 100}%`,
              // Scaler verticalement la waveform selon le volume du clip
              // pour donner un feedback visuel du gain appliqué
              transform: `scaleY(${waveformScale})`,
              transformOrigin: 'center center',
            }}
          />

          {/* Indicateur de chargement avec pourcentage */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 z-10 rounded">
              {/* Barre de progression ou animation si pas de pourcentage */}
              {loadingProgress > 0 ? (
                <>
                  <div className="w-3/4 h-2 bg-white/30 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-300 shadow"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-white font-medium drop-shadow">
                    Chargement {loadingProgress}%
                  </span>
                </>
              ) : (
                <>
                  {/* Animation de chargement indéterminé */}
                  <div className="w-3/4 h-2 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-white rounded-full animate-pulse" />
                  </div>
                  <span className="text-xs text-white font-medium drop-shadow animate-pulse">
                    Chargement de la waveform...
                  </span>
                </>
              )}
            </div>
          )}

          {/* Indicateur d'erreur */}
          {hasError && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-white/60">Erreur chargement</span>
            </div>
          )}
        </div>
      );
    }
  )
);

SyncedWaveSurfer.displayName = 'SyncedWaveSurfer';

export default SyncedWaveSurfer;
export { SyncedWaveSurfer };
export type { SyncedWaveSurferProps };
