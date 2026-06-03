/**
 * Opérations d'édition destructive : CUT, normalize, fades, undo/redo + export.
 *
 * Chaque édition produit un nouveau buffer (empilé dans l'historique, undoable) ;
 * on régénère un blob WAV pour la lecture (peaks.js re-init sur changement de
 * buffer). Les anciennes URLs blob sont révoquées au fil de l'eau.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useAudioEditorStore } from '../store'
import { cutAudioBuffer } from '../audio/cut'
import { normalizeRMS } from '../audio/normalize'
import { compressAudioBuffer } from '../audio/compress'
import { limiterMaximize } from '../audio/limiter'
import { applyGainDb, applyGainDbRegion } from '../audio/gain'
import { applyFadeIn, applyFadeOut } from '../audio/fades'
import { audioBufferToWav } from '../audio/wav'
import { exportAudio, downloadBlob } from '../audio/export'

const DEFAULT_FADE_SECONDS = 2

export interface AudioEditingApi {
  cut: () => void
  normalize: () => void
  /** Compresse (preset voix) puis normalise → son régulier prêt à diffuser. */
  optimize: () => Promise<void>
  /** Gain manuel en dB (peak-safe). */
  gain: (db: number) => void
  /** Limiteur de loudness : monte le niveau vers une cible radio + brickwall. */
  limiter: () => Promise<void>
  fadeIn: () => void
  fadeOut: () => void
  undo: () => void
  redo: () => void
  exportTrack: (format: 'mp3' | 'wav', baseName: string) => Promise<void>
}

/** Plage du fondu : la sélection si présente, sinon les `DEFAULT_FADE_SECONDS` au bord. */
function fadeRegion(buffer: AudioBuffer, edge: 'in' | 'out'): [number, number] {
  const { selectionIn, selectionOut } = useAudioEditorStore.getState()
  if (selectionIn != null && selectionOut != null && Math.abs(selectionOut - selectionIn) > 0.01) {
    return [Math.min(selectionIn, selectionOut), Math.max(selectionIn, selectionOut)]
  }
  const dur = buffer.duration
  const d = Math.min(DEFAULT_FADE_SECONDS, dur)
  return edge === 'in' ? [0, d] : [Math.max(0, dur - d), dur]
}

export function useAudioEditing(): AudioEditingApi {
  const lastUrlRef = useRef<string | null>(null)

  const makeUrl = useCallback((buf: AudioBuffer): string => {
    const blob = audioBufferToWav(buf)
    const url = URL.createObjectURL(blob)
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    lastUrlRef.current = url
    return url
  }, [])

  useEffect(
    () => () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    },
    [],
  )

  const cut = useCallback(() => {
    const state = useAudioEditorStore.getState()
    const { audioBuffer, selectionIn, selectionOut } = state
    if (!audioBuffer || selectionIn == null || selectionOut == null) return
    const start = Math.min(selectionIn, selectionOut)
    const end = Math.max(selectionIn, selectionOut)
    if (end - start < 0.005) return
    const next = cutAudioBuffer(audioBuffer, start, end)
    // Repositionne les marqueurs : on retire ceux dans la zone coupée et on
    // décale ceux situés après.
    const removed = end - start
    const adjustedMarkers = state.markers
      .filter((m) => m < start || m > end)
      .map((m) => (m > end ? m - removed : m))
    state.applyEdit(next, makeUrl(next))
    state.setMarkers(adjustedMarkers)
    // Le contenu a changé → on autorise à nouveau l'optimisation.
    state.setOptimized(false)
  }, [makeUrl])

  const normalize = useCallback(() => {
    const state = useAudioEditorStore.getState()
    if (!state.audioBuffer) return
    const next = normalizeRMS(state.audioBuffer)
    state.applyEdit(next, makeUrl(next))
  }, [makeUrl])

  const optimize = useCallback(async () => {
    const state = useAudioEditorStore.getState()
    if (!state.audioBuffer || state.optimized) return
    const compressed = await compressAudioBuffer(state.audioBuffer)
    const normalized = normalizeRMS(compressed)
    // Relit l'état au cas où il aurait changé pendant le rendu async.
    const s = useAudioEditorStore.getState()
    s.applyEdit(normalized, makeUrl(normalized))
    s.setOptimized(true) // anti double-compression
  }, [makeUrl])

  const gain = useCallback((db: number) => {
    const state = useAudioEditorStore.getState()
    if (!state.audioBuffer || db === 0) return
    // Si une sélection est en place → on n'applique le gain qu'à la sélection,
    // sinon à tout le buffer.
    const { selectionIn, selectionOut } = state
    const hasSelection =
      selectionIn != null && selectionOut != null && Math.abs(selectionOut - selectionIn) > 0.005
    const next = hasSelection
      ? applyGainDbRegion(state.audioBuffer, db, selectionIn!, selectionOut!)
      : applyGainDb(state.audioBuffer, db)
    state.applyEdit(next, makeUrl(next))
    // Le gain ne change pas la longueur → on conserve la sélection pour pouvoir
    // empiler +1/+1 sur la même zone (applyEdit l'avait remise à zéro).
    if (hasSelection) {
      useAudioEditorStore.getState().setSelection(selectionIn!, selectionOut!)
    }
  }, [makeUrl])

  const limiter = useCallback(async () => {
    const buffer = useAudioEditorStore.getState().audioBuffer
    if (!buffer) return
    const next = await limiterMaximize(buffer)
    useAudioEditorStore.getState().applyEdit(next, makeUrl(next))
  }, [makeUrl])

  const fadeIn = useCallback(() => {
    const state = useAudioEditorStore.getState()
    if (!state.audioBuffer) return
    const [start, end] = fadeRegion(state.audioBuffer, 'in')
    const next = applyFadeIn(state.audioBuffer, start, end)
    state.applyEdit(next, makeUrl(next))
  }, [makeUrl])

  const fadeOut = useCallback(() => {
    const state = useAudioEditorStore.getState()
    if (!state.audioBuffer) return
    const [start, end] = fadeRegion(state.audioBuffer, 'out')
    const next = applyFadeOut(state.audioBuffer, start, end)
    state.applyEdit(next, makeUrl(next))
  }, [makeUrl])

  const undo = useCallback(() => {
    const prev = useAudioEditorStore.getState().undo()
    if (prev) useAudioEditorStore.getState().setBlobUrl(makeUrl(prev))
  }, [makeUrl])

  const redo = useCallback(() => {
    const next = useAudioEditorStore.getState().redo()
    if (next) useAudioEditorStore.getState().setBlobUrl(makeUrl(next))
  }, [makeUrl])

  const exportTrack = useCallback(async (format: 'mp3' | 'wav', baseName: string) => {
    const buffer = useAudioEditorStore.getState().audioBuffer
    if (!buffer) return
    const result = await exportAudio(buffer, { format, filename: baseName })
    downloadBlob(result.blob, result.filename)
  }, [])

  return { cut, normalize, optimize, gain, limiter, fadeIn, fadeOut, undo, redo, exportTrack }
}
