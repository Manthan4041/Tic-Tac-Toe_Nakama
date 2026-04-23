import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../nakama';
import { useGame } from '../App';

export default function LeaderboardPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userId } = useGame();

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLeaderboard(20);
      setRecords(result.records || []);
    } catch (err) {
      console.error('[Leaderboard] Error:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-card glass-panel">
        <div className="leaderboard-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H3v11a2 2 0 0 0 2 2h2" />
              <path d="M18 9h3v11a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="1" width="12" height="16" rx="2" />
              <path d="M12 6v4" />
              <path d="M10 8h4" />
            </svg>
            Leaderboard
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={fetchLeaderboard} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="leaderboard-loading">
            <div className="spinner" />
            <p>Loading rankings...</p>
          </div>
        ) : error ? (
          <div className="error-banner">{error}</div>
        ) : records.length === 0 ? (
          <div className="leaderboard-empty">
            <p>No records yet. Play a game to get on the board!</p>
          </div>
        ) : (
          <div className="leaderboard-table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="col-player">Player</th>
                  <th className="col-wins">Wins</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => {
                  const isMe = record.owner_id === userId;
                  const rank = index + 1;
                  return (
                    <tr key={record.owner_id} className={`${isMe ? 'row-me' : ''} ${rank <= 3 ? 'row-top' : ''}`}>
                      <td className="col-rank">
                        {rank === 1 && <span className="medal gold">🥇</span>}
                        {rank === 2 && <span className="medal silver">🥈</span>}
                        {rank === 3 && <span className="medal bronze">🥉</span>}
                        {rank > 3 && <span className="rank-num">{rank}</span>}
                      </td>
                      <td className="col-player">
                        <span className="player-name">{record.username?.value || record.username || record.owner_id.substring(0, 8)}</span>
                        {isMe && <span className="badge-you">YOU</span>}
                      </td>
                      <td className="col-wins">
                        <span className="wins-count">{record.score}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
