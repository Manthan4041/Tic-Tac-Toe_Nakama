/**
 * Nakama Client Singleton
 *
 * Manages the Nakama client instance, authentication, socket connection,
 * and provides helper methods for match operations.
 */
import { Client, Session } from '@heroiclabs/nakama-js';

// OpCodes — must match server constants.ts
export const OpCode = {
  MOVE: 1,
  STATE: 2,
  DONE: 3,
  REJECTED: 4,
  START: 5,
};

// Nakama connection config — dynamically uses the browser's hostname so the
// game works from any device (localhost, LAN IP, or public domain).
const NAKAMA_HOST = window.location.hostname;
const NAKAMA_PORT = '7350';
const NAKAMA_USE_SSL = false;
const NAKAMA_SERVER_KEY = 'defaultkey';

/** Singleton Nakama client */
const client = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);

let session = null;
let socket = null;
let currentMatchId = null;

/**
 * Authenticate using device ID.
 * Generates a unique device ID or reuses one from localStorage.
 */
export async function authenticate() {
  let deviceId = localStorage.getItem('ttt_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('ttt_device_id', deviceId);
  }

  session = await client.authenticateDevice(deviceId, true);
  localStorage.setItem('ttt_session_token', session.token);
  localStorage.setItem('ttt_session_refresh', session.refresh_token);

  console.log('[Nakama] Authenticated:', session.user_id, session.username);
  return session;
}

/**
 * Restore a previous session if valid, or re-authenticate.
 */
export async function restoreOrAuthenticate() {
  const token = localStorage.getItem('ttt_session_token');
  const refreshToken = localStorage.getItem('ttt_session_refresh');

  if (token && refreshToken) {
    const restoredSession = Session.restore(token, refreshToken);
    if (!restoredSession.isexpired(Date.now() / 1000)) {
      session = restoredSession;
      console.log('[Nakama] Session restored:', session.user_id);
      return session;
    }
  }

  return authenticate();
}

/**
 * Update the user's display name.
 */
export async function updateDisplayName(displayName) {
  if (!session) throw new Error('Not authenticated');
  await client.updateAccount(session, { display_name: displayName });
  console.log('[Nakama] Display name updated:', displayName);
}

/**
 * Connect the WebSocket for real-time communication.
 */
export async function connectSocket() {
  if (!session) throw new Error('Not authenticated');
  socket = client.createSocket(NAKAMA_USE_SSL, false);
  await socket.connect(session, true);
  console.log('[Nakama] Socket connected');
  return socket;
}

/**
 * Get the current socket instance.
 */
export function getSocket() {
  return socket;
}

/**
 * Get the current session.
 */
export function getSession() {
  return session;
}

/**
 * Get the current user ID.
 */
export function getUserId() {
  return session?.user_id || null;
}

/**
 * Get the current match ID.
 */
export function getCurrentMatchId() {
  return currentMatchId;
}

/**
 * Find or create a match via the find_match RPC.
 * Returns the match ID.
 */
export async function findMatch() {
  if (!session) throw new Error('Not authenticated');

  const response = await client.rpc(session, 'find_match', '{}');
  const data = response.payload;
  const matchIds = data.matchIds || [];

  if (matchIds.length === 0) {
    throw new Error('No match found or created');
  }

  return matchIds[0];
}

/**
 * Join a match by ID.
 */
export async function joinMatch(matchId) {
  if (!socket) throw new Error('Socket not connected');

  const match = await socket.joinMatch(matchId);
  currentMatchId = matchId;
  console.log('[Nakama] Joined match:', matchId);
  return match;
}

/**
 * Leave the current match.
 */
export async function leaveMatch() {
  if (!socket || !currentMatchId) return;
  await socket.leaveMatch(currentMatchId);
  console.log('[Nakama] Left match:', currentMatchId);
  currentMatchId = null;
}

/**
 * Send a move to the server.
 * @param {number} position - Board position (0-8)
 */
export async function sendMove(position) {
  if (!socket || !currentMatchId) throw new Error('Not in a match');

  const data = JSON.stringify({ position });
  await socket.sendMatchState(currentMatchId, OpCode.MOVE, data);
  console.log('[Nakama] Move sent: position=%d', position);
}

/**
 * Use the matchmaker to find an opponent.
 * Returns a matchmaker ticket.
 */
export async function addMatchmaker() {
  if (!socket) throw new Error('Socket not connected');

  const ticket = await socket.addMatchmaker('*', 2, 2);
  console.log('[Nakama] Matchmaker ticket:', ticket.ticket);
  return ticket;
}

/**
 * Remove matchmaker ticket.
 */
export async function removeMatchmaker(ticket) {
  if (!socket) throw new Error('Socket not connected');
  await socket.removeMatchmaker(ticket);
  console.log('[Nakama] Matchmaker ticket removed');
}

/**
 * Fetch leaderboard records.
 */
export async function getLeaderboard(limit = 20) {
  if (!session) throw new Error('Not authenticated');

  const result = await client.listLeaderboardRecords(session, 'tic_tac_toe_wins', null, limit);
  console.log('[Nakama] Leaderboard records:', result.records?.length || 0);
  return result;
}

/**
 * Disconnect everything.
 */
export async function disconnect() {
  if (currentMatchId) {
    await leaveMatch();
  }
  if (socket) {
    socket.disconnect(true);
    socket = null;
  }
  session = null;
  console.log('[Nakama] Disconnected');
}

export default client;
