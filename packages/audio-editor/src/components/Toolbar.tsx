'use client';

import React from 'react';

interface ToolbarProps {
  // Editing state
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;

  // Callbacks
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSplit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onExport: () => void;

  className?: string;
}

export function Toolbar({
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onSplit,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onExport,
  className = '',
}: ToolbarProps) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 bg-slate-800 border-b border-slate-700 ${className}`}
    >
      {/* Undo/Redo group */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-600">
        <ToolbarButton
          icon={<UndoIcon />}
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler (Ctrl+Z)"
        />
        <ToolbarButton
          icon={<RedoIcon />}
          onClick={onRedo}
          disabled={!canRedo}
          title="Retablir (Ctrl+Shift+Z)"
        />
      </div>

      {/* Edit group */}
      <div className="flex items-center gap-1 px-2 border-r border-slate-600">
        <ToolbarButton
          icon={<CutIcon />}
          onClick={onCut}
          disabled={!hasSelection}
          title="Couper (Ctrl+X)"
        />
        <ToolbarButton
          icon={<CopyIcon />}
          onClick={onCopy}
          disabled={!hasSelection}
          title="Copier (Ctrl+C)"
        />
        <ToolbarButton
          icon={<PasteIcon />}
          onClick={onPaste}
          title="Coller (Ctrl+V)"
        />
        <ToolbarButton
          icon={<DeleteIcon />}
          onClick={onDelete}
          disabled={!hasSelection}
          title="Supprimer (Suppr)"
        />
      </div>

      {/* Actions group */}
      <div className="flex items-center gap-1 px-2 border-r border-slate-600">
        <ToolbarButton
          icon={<SplitIcon />}
          onClick={onSplit}
          title="Couper a la position (S)"
        />
      </div>

      {/* Zoom group */}
      <div className="flex items-center gap-1 px-2 border-r border-slate-600">
        <ToolbarButton
          icon={<ZoomOutIcon />}
          onClick={onZoomOut}
          title="Zoom arriere (Ctrl+-)"
        />
        <ToolbarButton
          icon={<ZoomInIcon />}
          onClick={onZoomIn}
          title="Zoom avant (Ctrl+=)"
        />
        <ToolbarButton
          icon={<ZoomFitIcon />}
          onClick={onZoomFit}
          title="Ajuster (Ctrl+0)"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export button */}
      <ToolbarButton
        icon={<ExportIcon />}
        onClick={onExport}
        title="Exporter (Ctrl+E)"
        className="bg-blue-600 hover:bg-blue-500"
      />
    </div>
  );
}

// ============ Toolbar Button ============

interface ToolbarButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

function ToolbarButton({
  icon,
  onClick,
  disabled = false,
  title,
  className = '',
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-slate-700'
      } ${className}`}
    >
      {icon}
    </button>
  );
}

// ============ Icons ============

function UndoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
    </svg>
  );
}

function CutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-4-4m4 4l4-4" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  );
}

function ZoomFitIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
