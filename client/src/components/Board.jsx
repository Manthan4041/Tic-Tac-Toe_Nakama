import React from 'react';
import Cell from './Cell';

export default function Board({ board, onCellClick, isMyTurn, gameOver, myMark }) {
  const winLine = gameOver?.winLine || null;

  return (
    <div className="board-container">
      <div className={`board ${gameOver ? 'board-disabled' : ''} ${isMyTurn ? 'board-active' : ''}`}>
        {board.map((cell, index) => (
          <Cell
            key={index}
            index={index}
            value={cell}
            onClick={() => onCellClick(index)}
            isClickable={isMyTurn && cell === null && !gameOver}
            isWinCell={winLine ? winLine.includes(index) : false}
            myMark={myMark}
          />
        ))}
      </div>
    </div>
  );
}
