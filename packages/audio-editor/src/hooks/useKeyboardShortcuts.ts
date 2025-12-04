/**
 * Hook pour la gestion des raccourcis clavier
 */

import { useEffect, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS } from '../constants/shortcuts';

type ShortcutHandler = () => void;

interface ShortcutHandlers {
  // Transport
  onPlayPause?: ShortcutHandler;
  onStop?: ShortcutHandler;
  onRewind?: ShortcutHandler;
  onFastForward?: ShortcutHandler;

  // Shuttle
  onShuttleBack?: ShortcutHandler;
  onShuttleStop?: ShortcutHandler;
  onShuttleForward?: ShortcutHandler;

  // Edition
  onCut?: ShortcutHandler;
  onCopy?: ShortcutHandler;
  onPaste?: ShortcutHandler;
  onDelete?: ShortcutHandler;
  onSelectAll?: ShortcutHandler;
  onDeselect?: ShortcutHandler;

  // Actions
  onUndo?: ShortcutHandler;
  onRedo?: ShortcutHandler;
  onSplit?: ShortcutHandler;
  onTrimToSelection?: ShortcutHandler;

  // Cue points
  onSetCueIn?: ShortcutHandler;
  onSetCueOut?: ShortcutHandler;
  onGoToCueIn?: ShortcutHandler;
  onGoToCueOut?: ShortcutHandler;

  // Zoom
  onZoomIn?: ShortcutHandler;
  onZoomOut?: ShortcutHandler;
  onZoomFit?: ShortcutHandler;

  // Tracks
  onMuteTrack?: ShortcutHandler;
  onSoloTrack?: ShortcutHandler;

  // Save/Export
  onSave?: ShortcutHandler;
  onExport?: ShortcutHandler;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  handlers: ShortcutHandlers;
}

/**
 * Parse a shortcut string into key parts
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
 * Check if a keyboard event matches a shortcut
 */
function matchesShortcut(event: KeyboardEvent, shortcut: string | readonly string[]): boolean {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];

  return shortcuts.some((s) => {
    const parsed = parseShortcut(s);

    // Handle "mod" which is Cmd on Mac, Ctrl on Windows/Linux
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    const keyMatch =
      event.key.toLowerCase() === parsed.key ||
      event.code.toLowerCase() === parsed.key ||
      event.code.toLowerCase() === `key${parsed.key}`;

    const modMatch = parsed.meta ? modKey : !modKey || !parsed.ctrl;
    const ctrlMatch = parsed.ctrl ? event.ctrlKey : true;
    const shiftMatch = parsed.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = parsed.alt ? event.altKey : !event.altKey;

    return keyMatch && modMatch && ctrlMatch && shiftMatch && altMatch;
  });
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled = true, handlers } = options;
  const handlersRef = useRef(handlers);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const h = handlersRef.current;

      // Transport
      if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PLAY_PAUSE)) {
        event.preventDefault();
        h.onPlayPause?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.STOP)) {
        event.preventDefault();
        h.onStop?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.REWIND)) {
        event.preventDefault();
        h.onRewind?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.FAST_FORWARD)) {
        event.preventDefault();
        h.onFastForward?.();
      }

      // Shuttle (J/K/L)
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_BACK)) {
        event.preventDefault();
        h.onShuttleBack?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_STOP)) {
        event.preventDefault();
        h.onShuttleStop?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SHUTTLE_FORWARD)) {
        event.preventDefault();
        h.onShuttleForward?.();
      }

      // Edition
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.CUT)) {
        event.preventDefault();
        h.onCut?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.COPY)) {
        event.preventDefault();
        h.onCopy?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PASTE)) {
        event.preventDefault();
        h.onPaste?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.DELETE)) {
        event.preventDefault();
        h.onDelete?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SELECT_ALL)) {
        event.preventDefault();
        h.onSelectAll?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.DESELECT)) {
        event.preventDefault();
        h.onDeselect?.();
      }

      // Actions
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.UNDO)) {
        event.preventDefault();
        h.onUndo?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.REDO)) {
        event.preventDefault();
        h.onRedo?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SPLIT)) {
        event.preventDefault();
        h.onSplit?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.TRIM_TO_SELECTION)) {
        event.preventDefault();
        h.onTrimToSelection?.();
      }

      // Cue points
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SET_CUE_IN)) {
        event.preventDefault();
        h.onSetCueIn?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SET_CUE_OUT)) {
        event.preventDefault();
        h.onSetCueOut?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.GO_TO_CUE_IN)) {
        event.preventDefault();
        h.onGoToCueIn?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.GO_TO_CUE_OUT)) {
        event.preventDefault();
        h.onGoToCueOut?.();
      }

      // Zoom
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_IN)) {
        event.preventDefault();
        h.onZoomIn?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_OUT)) {
        event.preventDefault();
        h.onZoomOut?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.ZOOM_FIT)) {
        event.preventDefault();
        h.onZoomFit?.();
      }

      // Tracks
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.MUTE_TRACK)) {
        event.preventDefault();
        h.onMuteTrack?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SOLO_TRACK)) {
        event.preventDefault();
        h.onSoloTrack?.();
      }

      // Save/Export
      else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SAVE)) {
        event.preventDefault();
        h.onSave?.();
      } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.EXPORT)) {
        event.preventDefault();
        h.onExport?.();
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
