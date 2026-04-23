import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../App';
import { findMatch, joinMatch, addMatchmaker, removeMatchmaker, getSocket, OpCode } from '../nakama';

export default function LobbyPage() {
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState('Ready to play');
  const [matchmakerTicket, setMatchmakerTicket] = useState(null);
  const { setMatchId, setGameState, setGameOver, setMyMark, setPlayers, userId, username, socketRef } = useGame();
  const navigate = useNavigate();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Set up matchmaker matched listener
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.onmatchmakermatched = async (matched) => {
      if (!mounted.current) return;
      console.log('[Lobby] Matchmaker matched:', matched);
      setStatus('Opponent found! Joining...');

      try {
        const match = await joinMatch(matched.match_id);
        setupMatchListeners(matched.match_id);
        setMatchId(matched.match_id);
      } catch (err) {
        console.error('[Lobby] Failed to join matchmaker match:', err);
        if (mounted.current) {
          setStatus('Failed to join match');
          setSearching(false);
        }
      }
    };

    return () => {
      if (socket) {
        socket.onmatchmakermatched = null;
      }
    };
  }, [socketRef.current]);

  const setupMatchListeners = (matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.onmatchdata = (result) => {
      const opCode = result.op_code;
      const dataStr = new TextDecoder().decode(result.data);
      let data;
      try {
        data = JSON.parse(dataStr);
      } catch {
        data = {};
      }

      console.log('[Game] Match data received: opCode=%d', opCode, data);

      switch (opCode) {
        case OpCode.START: {
          const mark = data.marks?.[userId] || null;
          setMyMark(mark);
          setPlayers(data.players || {});
          setGameState({
            board: data.board,
            activePlayerId: data.activePlayerId,
            moveCount: 0,
            deadlineRemainingTicks: data.deadlineRemainingTicks,
          });
          setGameOver(null);
          setMatchId(matchId);
          navigate('/game');
          break;
        }

        case OpCode.STATE: {
          setGameState({
            board: data.board,
            activePlayerId: data.activePlayerId,
            moveCount: data.moveCount,
            deadlineRemainingTicks: data.deadlineRemainingTicks,
          });
          break;
        }

        case OpCode.DONE: {
          setGameOver(data);
          setGameState((prev) => prev ? { ...prev, board: data.board } : null);
          break;
        }

        case OpCode.REJECTED:
          console.warn('[Game] Move rejected:', data.reason);
          break;

        default:
          console.warn('[Game] Unknown opCode:', opCode);
      }
    };

    socket.onmatchpresence = (presenceEvent) => {
      console.log('[Game] Presence update:', presenceEvent);
    };
  };

  const handleFindMatch = async () => {
    setSearching(true);
    setStatus('Finding a match...');
    setGameOver(null);

    try {
      const matchId = await findMatch();
      setStatus('Joining match...');

      const match = await joinMatch(matchId);
      setupMatchListeners(matchId);
      setMatchId(matchId);

      // Check if we're the first player (waiting for opponent)
      const presenceCount = match.presences?.length || 0;
      if (presenceCount < 2) {
        setStatus('Waiting for opponent...');
        // Game will start when server sends START opcode
      }
    } catch (err) {
      console.error('[Lobby] Error finding match:', err);
      if (mounted.current) {
        setStatus('Error: ' + err.message);
        setSearching(false);
      }
    }
  };

  const handleMatchmaker = async () => {
    setSearching(true);
    setStatus('Searching for opponent...');
    setGameOver(null);

    try {
      const ticket = await addMatchmaker();
      setMatchmakerTicket(ticket.ticket);
    } catch (err) {
      console.error('[Lobby] Matchmaker error:', err);
      if (mounted.current) {
        setStatus('Matchmaker error: ' + err.message);
        setSearching(false);
      }
    }
  };

  const handleCancel = async () => {
    if (matchmakerTicket) {
      try {
        await removeMatchmaker(matchmakerTicket);
      } catch (e) {
        console.warn('Failed to remove matchmaker ticket:', e);
      }
      setMatchmakerTicket(null);
    }
    setSearching(false);
    setStatus('Ready to play');
  };

  return (
    <div className="lobby-page">
      <div className="lobby-card glass-panel">
        <h2>Game Lobby</h2>
        <p className="lobby-welcome">Welcome, <strong>{username || 'Player'}</strong></p>

        <div className="lobby-status">
          {searching && <div className="pulse-ring" />}
          <p className={`status-text ${searching ? 'status-searching' : ''}`}>{status}</p>
        </div>

        {!searching ? (
          <div className="lobby-actions">
            <button
              id="btn-find-match"
              className="btn btn-primary btn-lg"
              onClick={handleFindMatch}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Find Match
            </button>

            <button
              id="btn-matchmaker"
              className="btn btn-secondary"
              onClick={handleMatchmaker}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Auto-Match
            </button>
          </div>
        ) : (
          <button
            id="btn-cancel"
            className="btn btn-danger"
            onClick={handleCancel}
          >
            Cancel
          </button>
        )}

        <div className="lobby-info">
          <div className="info-item">
            <span className="info-label">Mode</span>
            <span className="info-value">1v1 Authoritative</span>
          </div>
          <div className="info-item">
            <span className="info-label">Turn Timer</span>
            <span className="info-value">30 seconds</span>
          </div>
          <div className="info-item">
            <span className="info-label">Server</span>
            <span className="info-value live-indicator">● Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
