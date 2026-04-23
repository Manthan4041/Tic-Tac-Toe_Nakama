import React from 'react';

export default function GameStatus({ isMyTurn, gameOver, userId, myMark }) {
  if (gameOver) {
    const { winner, reason } = gameOver;
    const isWinner = winner === userId;
    const isDraw = !winner;

    let message = '';
    let subMessage = '';
    let statusClass = '';

    if (isDraw) {
      message = "It's a Draw!";
      subMessage = 'Well played by both sides';
      statusClass = 'status-draw';
    } else if (isWinner) {
      message = 'You Won! 🎉';
      subMessage = reason === 'forfeit' ? 'Opponent disconnected' : reason === 'timeout' ? 'Opponent ran out of time' : 'Great game!';
      statusClass = 'status-win';
    } else {
      message = 'You Lost';
      subMessage = reason === 'forfeit' ? 'You disconnected' : reason === 'timeout' ? 'Time ran out' : 'Better luck next time';
      statusClass = 'status-lose';
    }

    return (
      <div className={`game-status ${statusClass}`}>
        <h3 className="status-message">{message}</h3>
        <p className="status-sub">{subMessage}</p>
      </div>
    );
  }

  return (
    <div className={`game-status ${isMyTurn ? 'status-your-turn' : 'status-opponent-turn'}`}>
      <h3 className="status-message">
        {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
      </h3>
      <p className="status-sub">
        {isMyTurn ? `Place your ${myMark}` : 'Waiting for opponent...'}
      </p>
    </div>
  );
}
