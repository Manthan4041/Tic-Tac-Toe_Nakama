import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../App';
import { sendMove, leaveMatch } from '../nakama';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import PlayerInfo from '../components/PlayerInfo';

export default function GamePage() {
  const { gameState, gameOver, myMark, players, userId, matchId, setMatchId, setGameState, setGameOver } = useGame();
  const navigate = useNavigate();

  // If there's no game state, redirect to lobby
  useEffect(() => {
    if (!gameState && !gameOver) {
      navigate('/lobby');
    }
  }, []);

  const isMyTurn = gameState?.activePlayerId === userId && !gameOver;

  const handleCellClick = async (position) => {
    if (!isMyTurn) return;
    if (gameState.board[position] !== null) return;
    if (gameOver) return;

    try {
      await sendMove(position);
    } catch (err) {
      console.error('[Game] Failed to send move:', err);
    }
  };

  const handlePlayAgain = async () => {
    try {
      await leaveMatch();
    } catch (e) {
      console.warn('Error leaving match:', e);
    }
    setMatchId(null);
    setGameState(null);
    setGameOver(null);
    navigate('/lobby');
  };

  const handleLeave = async () => {
    try {
      await leaveMatch();
    } catch (e) {
      console.warn('Error leaving match:', e);
    }
    setMatchId(null);
    setGameState(null);
    setGameOver(null);
    navigate('/lobby');
  };

  if (!gameState && !gameOver) {
    return (
      <div className="game-page">
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  // Determine opponent
  const opponentId = players ? Object.keys(players).find((id) => id !== userId) : null;
  const myInfo = players?.[userId];
  const opponentInfo = opponentId ? players[opponentId] : null;

  const board = gameOver?.board || gameState?.board || Array(9).fill(null);

  return (
    <div className="game-page">
      <div className="game-container">
        {/* Player Info Bar */}
        <div className="players-bar">
          <PlayerInfo
            username={myInfo?.username || 'You'}
            mark={myMark}
            isActive={isMyTurn}
            isYou={true}
          />
          <div className="vs-badge">VS</div>
          <PlayerInfo
            username={opponentInfo?.username || 'Opponent'}
            mark={opponentInfo?.mark || (myMark === 'X' ? 'O' : 'X')}
            isActive={!isMyTurn && !gameOver}
            isYou={false}
          />
        </div>

        {/* Game Status */}
        <GameStatus
          isMyTurn={isMyTurn}
          gameOver={gameOver}
          userId={userId}
          myMark={myMark}
        />

        {/* Game Board */}
        <Board
          board={board}
          onCellClick={handleCellClick}
          isMyTurn={isMyTurn}
          gameOver={gameOver}
          myMark={myMark}
        />

        {/* Action Buttons */}
        <div className="game-actions">
          {gameOver ? (
            <button id="btn-play-again" className="btn btn-primary btn-lg" onClick={handlePlayAgain}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Play Again
            </button>
          ) : (
            <button id="btn-leave" className="btn btn-danger btn-sm" onClick={handleLeave}>
              Leave Match
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
