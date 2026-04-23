import React from 'react';

export default function Cell({ index, value, onClick, isClickable, isWinCell, myMark }) {
  const cellClasses = [
    'cell',
    value ? `cell-${value.toLowerCase()}` : '',
    isClickable ? 'cell-clickable' : '',
    isWinCell ? 'cell-win' : '',
    !value && isClickable ? `cell-hover-${myMark?.toLowerCase() || 'x'}` : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={cellClasses}
      onClick={onClick}
      disabled={!isClickable}
      aria-label={`Cell ${index}: ${value || 'empty'}`}
      id={`cell-${index}`}
    >
      {value && (
        <span className={`mark mark-${value.toLowerCase()}`}>
          {value === 'X' ? (
            <svg viewBox="0 0 64 64" className="mark-svg">
              <line x1="16" y1="16" x2="48" y2="48" />
              <line x1="48" y1="16" x2="16" y2="48" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64" className="mark-svg">
              <circle cx="32" cy="32" r="16" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}
