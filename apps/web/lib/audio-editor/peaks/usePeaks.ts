/**
 * Hook d'initialisation de peaks.js.
 *
 * Pièges gérés :
 *  - Conteneur invisible / largeur 0 (modal en cours d'ouverture) → peaks
 *    s'initialise mal. On retry jusqu'à 10× en backoff (100→500ms) tant que
 *    le conteneur a une largeur nulle, et aussi en cas d'échec d'init.
 *  - Couleurs : le canvas (Konva) n'accepte pas les CSS vars ni oklch de façon
 *    fiable → on résout les tokens DS en rgb concret au moment de l'init.
 */
import { useEffect, useRef, useState } from 'react'
import Peaks from 'peaks.js'
import type { PeaksInstance } from 'peaks.js'

interface UsePeaksArgs {
  audioBuffer: AudioBuffer | null
  mediaElement: HTMLAudioElement | null
  zoomContainer: HTMLElement | null
  overviewContainer?: HTMLElement | null
}

interface UsePeaksResult {
  peaks: PeaksInstance | null
  ready: boolean
  error: string | null
}

/**
 * Couleurs de la waveform — valeurs RGB concrètes adaptées au thème slate sombre.
 * Le canvas (Konva) de peaks.js n'accepte ni CSS vars ni oklch de façon fiable :
 * on lui passe donc des hex concrets (pas de variable Tailwind/CSS ici).
 */
const WAVE_COLORS = {
  waveform: '#64748b', // slate-500 : onde non lue
  played: '#3b82f6', // blue-500 : portion déjà lue
  playhead: '#f59e0b', // amber-500 : tête de lecture (contraste sur fond sombre)
  axisLabel: '#94a3b8', // slate-400
  axisGridline: '#334155', // slate-700
}

export function usePeaks({
  audioBuffer,
  mediaElement,
  zoomContainer,
  overviewContainer,
}: UsePeaksArgs): UsePeaksResult {
  const [peaks, setPeaks] = useState<PeaksInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Conserve le niveau de zoom entre deux ré-inits (après cut/undo/optimize…),
  // pour ne pas repartir au zoom par défaut à chaque édition.
  const desiredZoomRef = useRef<number | null>(null)

  useEffect(() => {
    if (!audioBuffer || !mediaElement || !zoomContainer) return

    let cancelled = false
    let instance: PeaksInstance | null = null
    let timer: number | undefined
    let attempt = 0

    const scheduleRetry = (init: () => void): boolean => {
      if (attempt >= 10) return false
      attempt += 1
      timer = window.setTimeout(init, Math.min(100 + attempt * 50, 500))
      return true
    }

    const init = () => {
      if (cancelled) return

      // Conteneur pas encore dimensionné → on attend.
      if (zoomContainer.clientWidth === 0) {
        if (scheduleRetry(init)) return
      }

      const waveformColor = WAVE_COLORS.waveform
      const playedColor = WAVE_COLORS.played
      const playheadColor = WAVE_COLORS.playhead
      const axisLabelColor = WAVE_COLORS.axisLabel
      const axisGridlineColor = WAVE_COLORS.axisGridline

      Peaks.init(
        {
          zoomLevels: [128, 256, 512, 1024, 2048, 4096],
          zoomview: {
            container: zoomContainer,
            waveformColor,
            playedWaveformColor: playedColor,
            playheadColor,
            axisLabelColor,
            axisGridlineColor,
            wheelMode: 'scroll',
          },
          ...(overviewContainer
            ? {
                overview: {
                  container: overviewContainer,
                  waveformColor,
                  playedWaveformColor: playedColor,
                  playheadColor,
                  axisLabelColor,
                  axisGridlineColor,
                },
              }
            : {}),
          mediaElement,
          webAudio: { audioBuffer },
        },
        (err, p) => {
          if (cancelled) {
            p?.destroy()
            return
          }
          if (err || !p) {
            if (scheduleRetry(init)) return
            setError("Impossible d'afficher la forme d'onde.")
            return
          }
          instance = p
          // Restaure le zoom mémorisé avant la dernière ré-init (si possible).
          if (desiredZoomRef.current != null) {
            try {
              p.zoom.setZoom(desiredZoomRef.current)
            } catch {
              // niveau hors bornes (buffer plus court) : on garde le défaut
            }
          }
          setPeaks(p)
          setReady(true)
        },
      )
    }

    init()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      // Mémorise le zoom courant avant de détruire (restauré à la ré-init).
      if (instance) {
        try {
          desiredZoomRef.current = instance.zoom.getZoom()
        } catch {
          // ignore
        }
      }
      instance?.destroy()
      setPeaks(null)
      setReady(false)
      setError(null)
    }
  }, [audioBuffer, mediaElement, zoomContainer, overviewContainer])

  return { peaks, ready, error }
}
