/**
 * Affiche les repères (marqueurs posés à l'enregistrement) comme points
 * peaks.js sur la waveform, pour retrouver les passages à couper.
 */
import { useEffect } from 'react'
import type { PeaksInstance } from 'peaks.js'
import { useAudioEditorStore } from '../store'

const MARKER_COLOR = '#e0852b' // ambre — repère bien visible

export function useMarkersSync(peaks: PeaksInstance | null): void {
  const markers = useAudioEditorStore((s) => s.markers)

  useEffect(() => {
    if (!peaks) return
    peaks.points.removeAll()
    if (markers.length > 0) {
      peaks.points.add(
        markers.map((time, i) => ({
          time,
          color: MARKER_COLOR,
          labelText: `🚩 ${i + 1}`,
        })),
      )
    }
  }, [peaks, markers])
}
