import React from 'react';

export default function PlayerInfo({ username, mark, isActive, isYou }) {
  return (
    <div className={`player-info ${isActive ? 'player-active' : ''} ${isYou ? 'player-you' : 'player-opponent'}`}>
      <div className={`player-mark mark-badge mark-${mark?.toLowerCase() || 'x'}`}>
        {mark || '?'}
      </div>
      <div className="player-details">
        <span className="player-name-tag">{username}</span>
        {isYou && <span className="player-you-label">You</span>}
      </div>
      {isActive && <div className="active-indicator" />}
    </div>
  );
}
