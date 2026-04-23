import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../App';
import { authenticate, connectSocket, updateDisplayName, getUserId } from '../nakama';

export default function AuthPage() {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setAuthenticated, setUserId, setUsername, socketRef } = useGame();
  const navigate = useNavigate();

  const handleLogin = async (isGuest = false) => {
    setLoading(true);
    setError(null);

    try {
      const session = await authenticate();
      const uid = getUserId();
      setUserId(uid);

      // Update display name if provided
      const name = isGuest ? `Player_${uid.substring(0, 6)}` : displayName.trim();
      if (name) {
        await updateDisplayName(name);
        setUsername(name);
      } else {
        setUsername(session.username);
      }

      // Connect WebSocket
      const socket = await connectSocket();
      socketRef.current = socket;

      setAuthenticated(true);
      navigate('/lobby');
    } catch (err) {
      console.error('[Auth] Error:', err);
      setError('Failed to connect. Is the server running? Try: docker compose up --build');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        <div className="auth-logo">
          <div className="logo-icon">
            <span className="logo-x">X</span>
            <span className="logo-o">O</span>
          </div>
          <h1>Tic-Tac-Toe</h1>
          <p className="auth-subtitle">Real-time Multiplayer — Powered by Nakama</p>
        </div>

        <div className="auth-form">
          <div className="input-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              placeholder="Enter your name..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && displayName.trim() && handleLogin(false)}
              disabled={loading}
              maxLength={20}
              autoFocus
            />
          </div>

          <button
            id="btn-play"
            className="btn btn-primary btn-lg"
            onClick={() => handleLogin(false)}
            disabled={loading || !displayName.trim()}
          >
            {loading ? (
              <span className="spinner-inline" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Play
              </>
            )}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            id="btn-guest"
            className="btn btn-secondary"
            onClick={() => handleLogin(true)}
            disabled={loading}
          >
            Play as Guest
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        <p className="auth-footer">LILA Engineering Assignment</p>
      </div>
    </div>
  );
}
