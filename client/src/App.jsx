import React, { createContext, useState, useContext, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import Navbar from './components/Navbar';

/** Global game context */
const GameContext = createContext(null);

export function useGame() {
  return useContext(GameContext);
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [myMark, setMyMark] = useState(null);
  const [players, setPlayers] = useState(null);
  const socketRef = useRef(null);

  const value = {
    authenticated, setAuthenticated,
    userId, setUserId,
    username, setUsername,
    matchId, setMatchId,
    gameState, setGameState,
    gameOver, setGameOver,
    myMark, setMyMark,
    players, setPlayers,
    socketRef,
  };

  return (
    <GameContext.Provider value={value}>
      <BrowserRouter>
        <div className="app-container">
          {authenticated && <Navbar />}
          <main className="main-content">
            <Routes>
              <Route path="/" element={authenticated ? <Navigate to="/lobby" /> : <AuthPage />} />
              <Route path="/lobby" element={authenticated ? <LobbyPage /> : <Navigate to="/" />} />
              <Route path="/game" element={authenticated ? <GamePage /> : <Navigate to="/" />} />
              <Route path="/leaderboard" element={authenticated ? <LeaderboardPage /> : <Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </GameContext.Provider>
  );
}
