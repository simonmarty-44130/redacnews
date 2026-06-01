/**
 * Raccourcis clavier de l'éditeur audio.
 *   I / O        → poser le point IN / OUT à la tête de lecture
 *   X / Delete   → couper la sélection
 *   Cmd/Ctrl+Z   → undo   (+ Shift → redo)
 *
 * Ignoré si le focus est dans un champ de saisie.
 */
import { useEffect } from 'react'
import type { PeaksInstance } from 'peaks.js'
import { useAudioEditorStore } from '../store'
import { applySelectionSegment } from '../peaks/useSelectionSync'
import type { AudioEditingApi } from '../editing/useAudioEditing'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useEditorShortcuts(peaks: PeaksInstance | null, editing: AudioEditingApi): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) editing.redo()
        else editing.undo()
        return
      }

      if (!peaks) return
      const store = useAudioEditorStore.getState()
      const playhead = peaks.player.getCurrentTime()

      if (key === 'i') {
        e.preventDefault()
        const outT = store.selectionOut ?? store.durationSeconds
        store.setSelection(playhead, outT)
        applySelectionSegment(peaks, playhead, outT)
      } else if (key === 'o') {
        e.preventDefault()
        const inT = store.selectionIn ?? 0
        store.setSelection(inT, playhead)
        applySelectionSegment(peaks, inT, playhead)
      } else if (key === 'x' || key === 'delete') {
        e.preventDefault()
        editing.cut()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [peaks, editing])
}
