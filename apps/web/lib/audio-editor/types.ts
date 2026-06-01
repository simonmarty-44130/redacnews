/**
 * Types du mini-éditeur audio multi-piste de Tanguy.
 *
 * Architecture DESTRUCTIVE : on édite réellement l'AudioBuffer en mémoire.
 * Ce qu'on voit = ce qu'on entend (pas de régions/clips non destructifs).
 */

/** Une piste = un AudioBuffer décodé + ses métadonnées dérivées. */
export interface Track {
  id: string
  /** Nom d'affichage (ex. nom de fichier ou « Enregistrement »). */
  name: string
  buffer: AudioBuffer
  durationSeconds: number
  sampleRate: number
  numberOfChannels: number
}

/** Sélection temporelle [startTime, endTime] en secondes. */
export interface Selection {
  startTime: number
  endTime: number
}

/** Points de cue posés au clavier (I = in, O = out). */
export interface CuePoints {
  in: number | null
  out: number | null
}

/** Marqueur positionnel sur la timeline (peaks.js point). */
export interface MarkerConfig {
  id: string
  time: number
  label?: string
  color?: string
}

export type ExportFormat = 'mp3' | 'wav'

export interface ExportOptions {
  format: ExportFormat
  /** MP3 uniquement, défaut 320 kbps (compat Open Radio / RCA / Transistor). */
  mp3Bitrate?: number
  /** WAV uniquement, défaut 16 bits. */
  wavBitDepth?: 16 | 24
  /** Nom de fichier souhaité (sans extension). */
  filename?: string
}

export interface ExportResult {
  blob: Blob
  format: ExportFormat
  filename: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
}

export type EditorStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'recording'
  | 'exporting'
  | 'error'

/**
 * État de l'éditeur (consommé par le store Zustand au MVP 2).
 * Défini ici dès le MVP 0 pour figer le contrat.
 */
export interface EditorState {
  status: EditorStatus
  track: Track | null
  selection: Selection | null
  cue: CuePoints
  isPlaying: boolean
  /** Tête de lecture en secondes. */
  currentTime: number
  error: string | null
}
