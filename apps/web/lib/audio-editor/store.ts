/**
 * Store Zustand de l'éditeur audio.
 *
 * MVP 2 : piste courante + état de lecture (peaks.js).
 * MVP 3 : sélection IN/OUT + historique undo/redo (cap mémoire dynamique).
 */
import { create } from 'zustand'

/** Octets approximatifs d'un AudioBuffer (Float32 = 4 o/sample/canal). */
function bufferBytes(b: AudioBuffer): number {
  return b.length * b.numberOfChannels * 4
}

// Budget RAM pour l'historique. Le nombre d'entrées conservées est calculé
// dynamiquement selon la taille du buffer : un long fichier garde moins
// d'états (évite l'OOM), un court en garde beaucoup.
const MAX_HISTORY_BYTES = 300 * 1024 * 1024
const MAX_HISTORY_ENTRIES = 30

function historyCap(b: AudioBuffer | null): number {
  if (!b) return MAX_HISTORY_ENTRIES
  const perEntry = Math.max(1, bufferBytes(b))
  return Math.max(1, Math.min(MAX_HISTORY_ENTRIES, Math.floor(MAX_HISTORY_BYTES / perEntry)))
}

interface AudioEditorState {
  /** Buffer de la piste en cours d'édition (source de vérité destructive). */
  audioBuffer: AudioBuffer | null
  /** URL blob pour l'élément <audio> (peaks pilote la lecture). */
  blobUrl: string | null
  durationSeconds: number
  currentTime: number
  isPlaying: boolean

  /** Sélection temporelle (cue IN / OUT), en secondes. */
  selectionIn: number | null
  selectionOut: number | null

  /** Repères horodatés posés à l'enregistrement (secondes). */
  markers: number[]

  /** Vrai si le buffer courant a déjà été optimisé (anti double-compression). */
  optimized: boolean

  /** Piles undo/redo (snapshots de buffers). */
  past: AudioBuffer[]
  future: AudioBuffer[]

  loadTrack: (audioBuffer: AudioBuffer, blobUrl: string, markers?: number[]) => void
  setMarkers: (markers: number[]) => void
  setOptimized: (v: boolean) => void
  /** Remplace le buffer suite à une édition ; empile l'état précédent (undo). */
  applyEdit: (audioBuffer: AudioBuffer, blobUrl: string) => void
  undo: () => AudioBuffer | null
  redo: () => AudioBuffer | null
  setBlobUrl: (url: string) => void

  setSelectionIn: (t: number | null) => void
  setSelectionOut: (t: number | null) => void
  setSelection: (inT: number | null, outT: number | null) => void
  clearSelection: () => void

  setCurrentTime: (t: number) => void
  setIsPlaying: (v: boolean) => void
  setDuration: (d: number) => void
  reset: () => void
}

export const useAudioEditorStore = create<AudioEditorState>((set, get) => ({
  audioBuffer: null,
  blobUrl: null,
  durationSeconds: 0,
  currentTime: 0,
  isPlaying: false,
  selectionIn: null,
  selectionOut: null,
  markers: [],
  optimized: false,
  past: [],
  future: [],

  loadTrack: (audioBuffer, blobUrl, markers = []) =>
    set({
      audioBuffer,
      blobUrl,
      durationSeconds: audioBuffer.duration,
      currentTime: 0,
      isPlaying: false,
      selectionIn: null,
      selectionOut: null,
      markers,
      optimized: false,
      past: [],
      future: [],
    }),
  setMarkers: (markers) => set({ markers }),
  setOptimized: (v) => set({ optimized: v }),

  applyEdit: (audioBuffer, blobUrl) => {
    const { audioBuffer: prev, past } = get()
    const nextPast = prev ? [...past, prev] : [...past]
    const cap = historyCap(audioBuffer)
    // Conserve au plus `cap` états (les plus récents).
    const trimmed = nextPast.slice(Math.max(0, nextPast.length - cap))
    set({
      audioBuffer,
      blobUrl,
      durationSeconds: audioBuffer.duration,
      currentTime: 0,
      isPlaying: false,
      selectionIn: null,
      selectionOut: null,
      past: trimmed,
      future: [],
    })
  },

  undo: () => {
    const { past, future, audioBuffer } = get()
    if (past.length === 0 || !audioBuffer) return null
    const previous = past[past.length - 1]
    set({
      audioBuffer: previous,
      durationSeconds: previous.duration,
      past: past.slice(0, -1),
      future: [audioBuffer, ...future],
      currentTime: 0,
      isPlaying: false,
      selectionIn: null,
      selectionOut: null,
    })
    return previous
  },

  redo: () => {
    const { past, future, audioBuffer } = get()
    if (future.length === 0 || !audioBuffer) return null
    const next = future[0]
    set({
      audioBuffer: next,
      durationSeconds: next.duration,
      past: [...past, audioBuffer],
      future: future.slice(1),
      currentTime: 0,
      isPlaying: false,
      selectionIn: null,
      selectionOut: null,
    })
    return next
  },

  setBlobUrl: (url) => set({ blobUrl: url }),

  setSelectionIn: (t) => set({ selectionIn: t }),
  setSelectionOut: (t) => set({ selectionOut: t }),
  setSelection: (inT, outT) => set({ selectionIn: inT, selectionOut: outT }),
  clearSelection: () => set({ selectionIn: null, selectionOut: null }),

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setDuration: (d) => set({ durationSeconds: d }),
  reset: () =>
    set({
      audioBuffer: null,
      blobUrl: null,
      durationSeconds: 0,
      currentTime: 0,
      isPlaying: false,
      selectionIn: null,
      selectionOut: null,
      markers: [],
      optimized: false,
      past: [],
      future: [],
    }),
}))
