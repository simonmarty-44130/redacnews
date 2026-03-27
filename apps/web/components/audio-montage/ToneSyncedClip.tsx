'use client';

import React, {
  useEffect,
  useRef,
  useState,
  memo,
} from 'react';
import WaveSurfer from 'wavesurfer.js';
import { cn } from '@/lib/utils';
import { getToneEngine } from '@/lib/audio-montage/ToneEngine';

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

interface ToneSyncedClipProps {
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
  pixelsPerSecond: number; // Zoom de la timeline (non utilise ici mais peut etre utile)
  height?: number;
  onReady?: (clipId: string) => void;
  onError?: (clipId: string, error: string) => void;
  onDurationDetected?: (clipId: string, realDuration: number) => void;
}

/**
 * ToneSyncedClip - Clip audio synchronise via Tone.js
 *
 * Ce composant utilise:
 * - Tone.js pour la lecture audio synchronisee (via ToneEngine)
 * - WaveSurfer pour l'affichage de la waveform UNIQUEMENT (pas de playback)
 *
 * Avantages:
 * - Synchronisation sample-accurate (pas de drift)
 * - Pas de race conditions sur isReady()
 * - Utilise l'AudioContext de Tone.js (unique et partage)
 */
const ToneSyncedClip = memo(
  ({
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
    height = 60,
    onReady,
    onError,
    onDurationDetected,
  }: ToneSyncedClipProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [hasError, setHasError] = useState(false);
    const [actualSourceDuration, setActualSourceDuration] = useState<number>(
      sourceDuration || 0
    );

    // Flag pour eviter les operations apres unmount
    const isMountedRef = useRef(true);
    const instanceIdRef = useRef(0);
    const isRegisteredRef = useRef(false); // ✅ Track si le clip est enregistré

    // Duree visible du clip
    const clipDuration = outPoint - inPoint;

    // ============ ENREGISTREMENT DANS TONE.JS ============

    useEffect(() => {
      const engine = getToneEngine();

      // Enregistrer le clip dans le moteur Tone.js (sans fades initialement)
      engine
        .register(
          clipId,
          sourceUrl,
          startTime,
          inPoint,
          outPoint,
          volume,
          0, // fadeInDuration initialisé à 0
          0  // fadeOutDuration initialisé à 0
        )
        .then(() => {
          if (isMountedRef.current) {
            isRegisteredRef.current = true; // ✅ Marquer comme enregistré
            console.log(`[ToneSyncedClip ${clipId}] Registered in ToneEngine`);
            onReady?.(clipId);
          }
        })
        .catch((error) => {
          if (!isAbortError(error) && isMountedRef.current) {
            console.error(`[ToneSyncedClip ${clipId}] Registration error:`, error);
            setHasError(true);
            onError?.(clipId, String(error));
          }
        });

      return () => {
        isRegisteredRef.current = false; // ✅ Marquer comme désenregistré
        engine.unregister(clipId);
      };
    }, [
      clipId,
      sourceUrl,
      startTime,
      inPoint,
      outPoint,
      volume,
      // fadeInDuration et fadeOutDuration retirés - gérés par updateClip
      onReady,
      onError,
    ]);

    // Mettre a jour les proprietes si elles changent
    useEffect(() => {
      // ✅ Ne mettre à jour que si le clip est enregistré
      if (!isRegisteredRef.current) {
        return;
      }

      const engine = getToneEngine();
      engine.updateClip(clipId, {
        startTime,
        inPoint,
        outPoint,
        volume,
        fadeInDuration,
        fadeOutDuration,
      });
    }, [clipId, startTime, inPoint, outPoint, volume, fadeInDuration, fadeOutDuration]);

    // ============ WAVESURFER POUR AFFICHAGE ============

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

      // Pour les fichiers tres longs (> 30 min), utiliser des parametres optimises
      const isLongFile = (sourceDuration || 0) > 1800; // Plus de 30 minutes
      const isVeryLongFile = (sourceDuration || 0) > 3600; // Plus de 1 heure

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: color,
        progressColor: `${color}cc`,
        cursorColor: 'transparent', // Pas de curseur (gere par la timeline globale)
        height: height,
        normalize: true,
        backend: 'WebAudio',
        hideScrollbar: true,
        interact: false, // PAS d'interaction - affichage uniquement
        // Optimisations pour fichiers longs/tres longs
        ...(isVeryLongFile && {
          barWidth: 3,
          barGap: 2,
          barRadius: 1,
          minPxPerSec: 0.5,
        }),
        ...(isLongFile && !isVeryLongFile && {
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
        console.log(
          `[ToneSyncedClip ${clipId}] WaveSurfer ready, duration: ${duration?.toFixed(2)}s`
        );
        setActualSourceDuration(duration);
        setIsLoading(false);

        // Notifier si la duree reelle differe
        if (
          duration > 0 &&
          onDurationDetected &&
          (!sourceDuration || Math.abs(duration - sourceDuration) > 1)
        ) {
          console.log(
            `[ToneSyncedClip ${clipId}] Duration mismatch! Real: ${duration.toFixed(2)}s, Props: ${sourceDuration?.toFixed(2) ?? 'null'}s`
          );
          onDurationDetected(clipId, duration);
        }
      });

      ws.on('error', (err) => {
        if (!isMountedRef.current || instanceIdRef.current !== currentInstanceId)
          return;
        if (isAbortError(err)) return;

        console.error(`[ToneSyncedClip ${clipId}] WaveSurfer error:`, err);
        setIsLoading(false);
        setHasError(true);
        onError?.(clipId, String(err));
      });

      // Charger l'audio
      ws.load(sourceUrl).catch((error) => {
        if (isAbortError(error)) return;
        // Les autres erreurs seront gerees par l'event 'error'
      });

      wavesurferRef.current = ws;

      return () => {
        isMountedRef.current = false;

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
    }, [sourceUrl, clipId, color, height, sourceDuration]); // Retiré onDurationDetected et onError des deps

    // ============ AFFICHAGE AVEC TRIM ============

    // Calculer le decalage et la largeur de la waveform
    // La waveform doit etre plus large que le conteneur pour montrer tout le fichier
    // et decalee vers la gauche pour cacher la partie avant inPoint
    const totalSourceDuration = actualSourceDuration || sourceDuration || outPoint;
    const waveformWidthRatio = totalSourceDuration / clipDuration;
    const offsetRatio = inPoint / totalSourceDuration;

    // Calculer le facteur de scale pour la waveform basé sur le volume du clip
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
            transform: `scaleY(${waveformScale})`,
            transformOrigin: 'center center',
          }}
        />

        {/* Indicateur de chargement avec pourcentage */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 z-10 rounded">
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
);

ToneSyncedClip.displayName = 'ToneSyncedClip';

export default ToneSyncedClip;
export { ToneSyncedClip };
export type { ToneSyncedClipProps };
