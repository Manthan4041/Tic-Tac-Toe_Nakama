import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useGame } from '../App';
import { disconnect } from '../nakama';

export default function Navbar() {
  const { setAuthenticated, setMatchId, setGameState, setGameOver, username } = useGame();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await disconnect();
    setAuthenticated(false);
    setMatchId(null);
    setGameState(null);
    setGameOver(null);
    navigate('/');
  };

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-brand">
        <span className="nav-logo-x">X</span><span className="nav-logo-o">O</span>
        <span className="nav-title">Tic-Tac-Toe</span>
      </div>

      <div className="navbar-links">
        <NavLink to="/lobby" className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Lobby
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H3v11a2 2 0 0 0 2 2h2" />
            <path d="M18 9h3v11a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="1" width="12" height="16" rx="2" />
          </svg>
          Leaderboard
        </NavLink>
      </div>

      <div className="navbar-user">
        <span className="nav-username">{username || 'Player'}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="btn-logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
