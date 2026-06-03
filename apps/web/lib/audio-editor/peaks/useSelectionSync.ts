/**
 * Synchronise la sélection IN/OUT entre peaks.js et le store.
 *
 * - Drag souris sur la waveform → mode 'insert-segment' de peaks crée un
 *   segment → on le mirrore dans le store (et on garde un seul segment).
 * - Poignées du segment draggables (enableSegmentDragging) → 'segments.dragged'
 *   met à jour le store.
 * - Les touches I/O passent par applySelectionSegment() pour refléter la
 *   sélection du store vers l'unique segment peaks.
 */
import { useEffect } from 'react'
import type { PeaksInstance, Segment } from 'peaks.js'
import { useAudioEditorStore } from '../store'

const SELECTION_COLOR = 'rgba(37, 99, 168, 0.28)'

/** Réconcilie l'unique segment de sélection peaks sur les bornes [inT, outT]. */
export function applySelectionSegment(peaks: PeaksInstance, inT: number, outT: number): void {
  const start = Math.min(inT, outT)
  const end = Math.max(inT, outT)
  const segs = peaks.segments.getSegments()
  segs.slice(1).forEach((s) => {
    if (s.id) peaks.segments.removeById(s.id)
  })
  if (segs[0]) {
    segs[0].update({ startTime: start, endTime: end })
  } else {
    peaks.segments.add({ startTime: start, endTime: end, editable: true, color: SELECTION_COLOR })
  }
}

export function clearSelectionSegment(peaks: PeaksInstance): void {
  peaks.segments.removeAll()
}

export function useSelectionSync(peaks: PeaksInstance | null): void {
  const setSelection = useAudioEditorStore((s) => s.setSelection)

  useEffect(() => {
    if (!peaks) return

    const view = peaks.views.getView('zoomview')
    if (view) {
      view.setWaveformDragMode('insert-segment')
      view.enableSegmentDragging(true)
      view.setSegmentDragMode('no-overlap')
    }

    // Redessine la sélection mémorisée après une ré-init de peaks (ex. après un
    // gain sur sélection qui conserve la zone) pour qu'elle reste visible.
    const { selectionIn, selectionOut } = useAudioEditorStore.getState()
    if (
      selectionIn != null &&
      selectionOut != null &&
      Math.abs(selectionOut - selectionIn) > 0.005
    ) {
      applySelectionSegment(peaks, selectionIn, selectionOut)
    }

    const onInsert = (e: { segment: Segment }) => {
      const seg = e.segment
      peaks.segments.getSegments().forEach((s) => {
        if (s.id && s.id !== seg.id) peaks.segments.removeById(s.id)
      })
      setSelection(seg.startTime, seg.endTime)
    }
    const onDragged = (e: { segment: Segment }) => {
      setSelection(e.segment.startTime, e.segment.endTime)
    }

    peaks.on('segments.insert', onInsert)
    peaks.on('segments.dragged', onDragged)
    return () => {
      peaks.off('segments.insert', onInsert)
      peaks.off('segments.dragged', onDragged)
    }
  }, [peaks, setSelection])
}
