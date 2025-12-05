/**
 * Hook pour la gestion des raccourcis clavier de l'éditeur audio
 * Optimisé pour le workflow radio avec I/O pour sélection, X pour CUT
 */

import { useEffect, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS } from '../constants/shortcuts';

type ShortcutHandler = () => void;

export interface ShortcutHandlers {
  // Transport
  onPlayPause?: ShortcutHandler;
  onStop?: ShortcutHandler;
  onRewind?: ShortcutHandler;
  onFastForward?: ShortcutHandler;

  // Shuttle J/K/L
  onShuttleBack?: ShortcutHandler;
  onShuttleStop?: ShortcutHandler;
  onShuttleForward?: ShortcutHandler;

  // Navigation fine
  onFrameBack?: ShortcutHandler;
  onFrameForward?: ShortcutHandler;
  onJumpBack5s?: ShortcutHandler;
  onJumpForward5s?: ShortcutHandler;

  // Sélection I/O (workflow radio)
  onSetCueIn?: ShortcutHandler;    // I = point IN
  onSetCueOut?: ShortcutHandler;   // O = point OUT
  onGoToCueIn?: ShortcutHandler;   // Shift+I
  onGoToCueOut?: ShortcutHandler;  // Shift+O
  onClearSelection?: ShortcutHandler;
  onSelectAll?: ShortcutHandler;
  onDeselect?: ShortcutHandler;

  // Édition
  onCut?: ShortcutHandler;         // X/Delete/Backspace = CUT (supprimer sélection)
  onCopy?: ShortcutHandler;
  onPaste?: ShortcutHandler;
  onDelete?: ShortcutHandler;      // Alias pour onCut
  onSplit?: ShortcutHandler;       // S = diviser à la position
  onTrimToSelection?: ShortcutHandler; // T = garder uniquement la sélection

  // Historique
  onUndo?: ShortcutHandler;
  onRedo?: ShortcutHandler;

  // Zoom
  onZoomIn?: ShortcutHandler;
  onZoomOut?: ShortcutHandler;
  onZoomFit?: ShortcutHandler;

  // Pistes
  onMuteTrack?: ShortcutHandler;
  onSoloTrack?: ShortcutHandler;

  // Marqueurs
  onAddMarker?: ShortcutHandler;
  onNextMarker?: ShortcutHandler;
  onPrevMarker?: ShortcutHandler;

  // Fichier
  onSave?: ShortcutHandler;
  onExport?: ShortcutHandler;

  // UI
  onShowShortcuts?: ShortcutHandler;
  onFullscreen?: ShortcutHandler;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  handlers: ShortcutHandlers;
}

/**
 * Parse un raccourci pour extraire les modifiers et la touche
 */
function parseShortcut(shortcut: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  return {
    key: key === 'space' ? ' ' : key,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('mod') || parts.includes('cmd') || parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

/**
 * Vérifie si un événement clavier correspond à un raccourci
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string | readonly string[]
): boolean {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];

  return shortcuts.some((s) => {
    const parsed = parseShortcut(s);

    // "mod" = Cmd sur Mac, Ctrl sur Windows/Linux
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    // Comparer la touche
    const keyMatch =
      event.key.toLowerCase() === parsed.key ||
      event.code.toLowerCase() === parsed.key ||
      event.code.toLowerCase() === `key${parsed.key}` ||
      (parsed.key === 'delete' && event.code === 'Delete') ||
      (parsed.key === 'backspace' && event.code === 'Backspace') ||
      (parsed.key === 'escape' && event.code === 'Escape') ||
      (parsed.key === 'arrowleft' && event.code === 'ArrowLeft') ||
      (parsed.key === 'arrowright' && event.code === 'ArrowRight');

    // Comparer les modifiers
    const modMatch = parsed.meta ? modKey : !modKey || !parsed.ctrl;
    const ctrlMatch = parsed.ctrl ? event.ctrlKey : true;
    const shiftMatch = parsed.shift === event.shiftKey;
    const altMatch = parsed.alt ? event.altKey : !event.altKey;

    return keyMatch && modMatch && ctrlMatch && shiftMatch && altMatch;
  });
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled = true, handlers } = options;
  const handlersRef = useRef(handlers);

  // Mettre à jour la ref quand les handlers changent
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignorer si on est dans un input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const h = handlersRef.current;

      // === TRANSPORT ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PLAY_PAUSE)) {
        event.preventDefault();
        h.onPlayPause?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.STOP)) {
        event.preventDefault();
        h.onStop?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.REWIND)) {
        event.preventDefault();
        h.onRewind?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.FAST_FORWARD)) {
        event.preventDefault();
        h.onFastForward?.();
        return;
      }

      // === SHUTTLE J/K/L ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_BACK)) {
        event.preventDefault();
        h.onShuttleBack?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_STOP)) {
        event.preventDefault();
        h.onShuttleStop?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_FORWARD)) {
        event.preventDefault();
        h.onShuttleForward?.();
        return;
      }

      // === NAVIGATION FINE ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.FRAME_BACK)) {
        event.preventDefault();
        h.onFrameBack?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.FRAME_FORWARD)) {
        event.preventDefault();
        h.onFrameForward?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.JUMP_BACK_5S)) {
        event.preventDefault();
        h.onJumpBack5s?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.JUMP_FORWARD_5S)) {
        event.preventDefault();
        h.onJumpForward5s?.();
        return;
      }

      // === SÉLECTION I/O ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SET_IN_POINT)) {
        event.preventDefault();
        h.onSetCueIn?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SET_OUT_POINT)) {
        event.preventDefault();
        h.onSetCueOut?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.GO_TO_IN_POINT)) {
        event.preventDefault();
        h.onGoToCueIn?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.GO_TO_OUT_POINT)) {
        event.preventDefault();
        h.onGoToCueOut?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.CLEAR_SELECTION)) {
        // Ne pas intercepter Escape ici, c'est aussi STOP
        // Géré par onStop
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SELECT_ALL)) {
        event.preventDefault();
        h.onSelectAll?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.DESELECT)) {
        event.preventDefault();
        h.onDeselect?.();
        return;
      }

      // === ÉDITION ===
      console.log('Key pressed:', event.key, 'Code:', event.code, 'CUT_SELECTION shortcuts:', KEYBOARD_SHORTCUTS.CUT_SELECTION);
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.CUT_SELECTION)) {
        console.log('CUT_SELECTION matched! Calling onCut...');
        event.preventDefault();
        h.onCut?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SPLIT)) {
        event.preventDefault();
        h.onSplit?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.TRIM_TO_SELECTION)) {
        event.preventDefault();
        h.onTrimToSelection?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.COPY)) {
        event.preventDefault();
        h.onCopy?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PASTE)) {
        event.preventDefault();
        h.onPaste?.();
        return;
      }

      // === HISTORIQUE ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.UNDO)) {
        event.preventDefault();
        h.onUndo?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.REDO)) {
        event.preventDefault();
        h.onRedo?.();
        return;
      }

      // === ZOOM ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_IN)) {
        event.preventDefault();
        h.onZoomIn?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_OUT)) {
        event.preventDefault();
        h.onZoomOut?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_FIT)) {
        event.preventDefault();
        h.onZoomFit?.();
        return;
      }

      // === PISTES ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.MUTE_TRACK)) {
        event.preventDefault();
        h.onMuteTrack?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SOLO_TRACK)) {
        event.preventDefault();
        h.onSoloTrack?.();
        return;
      }

      // === MARQUEURS ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ADD_MARKER)) {
        event.preventDefault();
        h.onAddMarker?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.NEXT_MARKER)) {
        event.preventDefault();
        h.onNextMarker?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PREV_MARKER)) {
        event.preventDefault();
        h.onPrevMarker?.();
        return;
      }

      // === FICHIER ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SAVE)) {
        event.preventDefault();
        h.onSave?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.EXPORT)) {
        event.preventDefault();
        h.onExport?.();
        return;
      }

      // === UI ===
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHOW_SHORTCUTS)) {
        event.preventDefault();
        h.onShowShortcuts?.();
        return;
      }

      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.FULLSCREEN)) {
        event.preventDefault();
        h.onFullscreen?.();
        return;
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export type { ShortcutHandlers as KeyboardShortcutHandlers };
