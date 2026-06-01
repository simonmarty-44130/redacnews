/**
 * Hook d'enregistrement micro via MediaRecorder.
 *
 * Capture en audio/webm;codecs=opus (léger, qualité voix excellente). Sur
 * Safari < 14.1 ce codec n'est pas dispo → fallback audio/mp4, et si aucun
 * format n'est supporté, isSupported = false (message à afficher côté UI).
 *
 * À l'arrêt, le blob enregistré est décodé en AudioBuffer (réutilisé ensuite
 * pour l'encodage MP3 à la sauvegarde).
 *
 * Fournit aussi :
 *  - `level` : niveau crête temps réel (0..1) via AnalyserNode → VU-mètre.
 *  - `markers` + `addMarker()` : repères horodatés posés en direct par le
 *    technicien (ex. touche M), pour retrouver au montage les passages à couper.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAudioFile } from '../audio/decode'
import { resumeAudioContext } from '../audio/audio-context'

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'decoding' | 'recorded' | 'error'

export interface UseRecordingResult {
  isSupported: boolean
  status: RecordingStatus
  /** Temps écoulé pendant l'enregistrement, en millisecondes. */
  elapsedMs: number
  error: string | null
  /** Blob enregistré (webm/opus ou mp4), disponible après stop(). */
  blob: Blob | null
  /** AudioBuffer décodé du blob, disponible après stop(). */
  audioBuffer: AudioBuffer | null
  /** Niveau crête instantané (0..1) pendant l'enregistrement. */
  level: number
  /** Repères horodatés (secondes depuis le début), posés en direct. */
  markers: number[]
  start: () => Promise<void>
  stop: () => void
  reset: () => void
  /** Pose un repère à l'instant courant de l'enregistrement. */
  addMarker: () => void
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return null
}

export function useRecording(): UseRecordingResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [level, setLevel] = useState(0)
  const [markers, setMarkers] = useState<number[]>([])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const isSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickMimeType() !== null

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const teardownMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try {
      sourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
    } catch {
      // déjà déconnecté
    }
    sourceRef.current = null
    analyserRef.current = null
    setLevel(0)
  }, [])

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("Votre navigateur ne permet pas l'enregistrement audio.")
      setStatus('error')
      return
    }
    setError(null)
    setBlob(null)
    setAudioBuffer(null)
    setElapsedMs(0)
    setMarkers([])
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickMimeType() ?? undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        stopTimer()
        teardownMeter()
        releaseStream()
        const recordedBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setBlob(recordedBlob)
        setStatus('decoding')
        try {
          const decoded = await decodeAudioFile(recordedBlob)
          setAudioBuffer(decoded)
          setStatus('recorded')
        } catch (decodeErr) {
          setError(
            decodeErr instanceof Error
              ? `Décodage de l'enregistrement impossible : ${decodeErr.message}`
              : "Décodage de l'enregistrement impossible.",
          )
          setStatus('error')
        }
      }

      // VU-mètre : analyser branché sur le flux micro (pas de connexion à la
      // sortie → aucun larsen).
      try {
        const ctx = await resumeAudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)
        sourceRef.current = source
        analyserRef.current = analyser
        const data = new Float32Array(analyser.fftSize)
        const tick = () => {
          analyser.getFloatTimeDomainData(data)
          let peak = 0
          for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i])
            if (a > peak) peak = a
          }
          setLevel(peak)
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        // VU-mètre non critique : on continue l'enregistrement sans.
      }

      recorder.start()
      startTimeRef.current = performance.now()
      setStatus('recording')
      timerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startTimeRef.current)
      }, 200)
    } catch (err) {
      teardownMeter()
      releaseStream()
      const message =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
          ? "Accès au micro refusé. Autorisez-le dans votre navigateur puis réessayez."
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'Aucun micro détecté sur cet appareil.'
            : "Impossible de démarrer l'enregistrement."
      setError(message)
      setStatus('error')
    }
  }, [isSupported, releaseStream, stopTimer, teardownMeter])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop() // déclenche onstop (build blob + décodage)
    }
  }, [])

  const addMarker = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return
    const t = (performance.now() - startTimeRef.current) / 1000
    setMarkers((prev) => [...prev, t])
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    teardownMeter()
    releaseStream()
    recorderRef.current = null
    chunksRef.current = []
    setBlob(null)
    setAudioBuffer(null)
    setElapsedMs(0)
    setMarkers([])
    setError(null)
    setStatus('idle')
  }, [releaseStream, stopTimer, teardownMeter])

  // Cleanup au démontage : coupe le timer, le VU-mètre et libère le micro.
  useEffect(() => {
    return () => {
      stopTimer()
      teardownMeter()
      releaseStream()
    }
  }, [releaseStream, stopTimer, teardownMeter])

  return {
    isSupported,
    status,
    elapsedMs,
    error,
    blob,
    audioBuffer,
    level,
    markers,
    start,
    stop,
    reset,
    addMarker,
  }
}
