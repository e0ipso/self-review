import React from 'react';
import { createPortal } from 'react-dom';

interface HintItem {
  label: string;
  element: HTMLElement;
  rect: DOMRect;
}

interface HintOverlayProps {
  hints: HintItem[];
  inputBuffer: string;
}

export function HintOverlay({ hints, inputBuffer }: HintOverlayProps) {
  const visibleHints = inputBuffer
    ? hints.filter((h) => h.label.startsWith(inputBuffer))
    : hints;

  if (visibleHints.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {visibleHints.map((hint) => (
        <span
          key={hint.label}
          style={{
            position: 'absolute',
            left: hint.rect.left,
            top: hint.rect.top,
            backgroundColor: '#facc15',
            color: '#000',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '1px 3px',
            borderRadius: '2px',
            lineHeight: 1,
            zIndex: 9999,
          }}
        >
          <span style={{ opacity: 0.4 }}>
            {hint.label.slice(0, inputBuffer.length)}
          </span>
          <span>{hint.label.slice(inputBuffer.length)}</span>
        </span>
      ))}
    </div>,
    document.body
  );
}
