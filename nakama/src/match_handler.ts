/**
 * Authoritative Match Handler for Tic-Tac-Toe.
 *
 * All game logic runs server-side. The server validates every move,
 * enforces turn order, detects wins/draws, and handles disconnections.
 * Clients only send move intents; the server is the source of truth.
 */

import {
  OpCode,
  Mark,
  GameState,
  MoveMessage,
  MatchLabel,
  WIN_LINES,
  TICK_RATE,
  MAX_PLAYERS,
  DEADLINE_TICKS,
  LEADERBOARD_ID,
  createEmptyBoard,
} from './constants';

// ─────────────────────────────────────────────────────────────
// matchInit
// ─────────────────────────────────────────────────────────────
export const matchInit: nkruntime.MatchInitFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: GameState; tickRate: number; label: string } {
  logger.info('Match created: %s', ctx.matchId);

  const state: GameState = {
    board: createEmptyBoard(),
    marks: {},
    activePlayerId: null,
    presences: {},
    deadlineRemainingTicks: 0,
    winner: null,
    winnerMark: null,
    playing: false,
    moveCount: 0,
    nextGameRemainingTicks: 0,
  };

  const label: MatchLabel = { open: 1 };

  return {
    state,
    tickRate: TICK_RATE,
    label: JSON.stringify(label),
  };
};

// ─────────────────────────────────────────────────────────────
// matchJoinAttempt
// ─────────────────────────────────────────────────────────────
export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: GameState; accept: boolean; rejectMessage?: string } | null {
  const currentPlayerCount = Object.keys(state.presences).length;

  // Reject if the match is already full
  if (currentPlayerCount >= MAX_PLAYERS) {
    logger.warn('Rejecting join: match is full. userId=%s', presence.userId);
    return { state, accept: false, rejectMessage: 'Match is full' };
  }

  // Reject if the game is already in progress
  if (state.playing) {
    logger.warn('Rejecting join: game in progress. userId=%s', presence.userId);
    return { state, accept: false, rejectMessage: 'Game already in progress' };
  }

  // Reject if this user is already in the match (duplicate join)
  if (state.presences[presence.userId]) {
    logger.warn('Rejecting join: user already present. userId=%s', presence.userId);
    return { state, accept: false, rejectMessage: 'Already joined' };
  }

  logger.info('Player join accepted: userId=%s', presence.userId);
  return { state, accept: true };
};

// ─────────────────────────────────────────────────────────────
// matchJoin
// ─────────────────────────────────────────────────────────────
export const matchJoin: nkruntime.MatchJoinFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presences: nkruntime.Presence[]
): { state: GameState } | null {
  for (const presence of presences) {
    state.presences[presence.userId] = presence;

    // Assign marks in join order: first = X, second = O
    if (!state.marks[presence.userId]) {
      const assignedCount = Object.keys(state.marks).length;
      const mark: Mark = assignedCount === 0 ? 'X' : 'O';
      state.marks[presence.userId] = mark;
      logger.info('Assigned mark %s to userId=%s', mark, presence.userId);
    }
  }

  const playerIds = Object.keys(state.presences);

  // When we have 2 players, start the game
  if (playerIds.length === MAX_PLAYERS && !state.playing) {
    state.playing = true;
    state.board = createEmptyBoard();
    state.moveCount = 0;
    state.winner = null;
    state.winnerMark = null;

    // X always goes first — find the player assigned X
    const xPlayerId = playerIds.find((id) => state.marks[id] === 'X')!;
    state.activePlayerId = xPlayerId;
    state.deadlineRemainingTicks = DEADLINE_TICKS;

    // Update label to indicate match is no longer open
    const label: MatchLabel = { open: 0 };
    dispatcher.matchLabelUpdate(JSON.stringify(label));

    // Build the player info map for the START message
    const players: { [userId: string]: { mark: Mark; username: string } } = {};
    for (const pid of playerIds) {
      const account = nk.accountGetId(pid);
      players[pid] = {
        mark: state.marks[pid],
        username: account.user?.displayName || account.user?.username || pid.substring(0, 8),
      };
    }

    // Broadcast START to all players
    const startPayload = JSON.stringify({
      board: state.board,
      marks: state.marks,
      activePlayerId: state.activePlayerId,
      players,
      deadlineRemainingTicks: state.deadlineRemainingTicks,
    });

    dispatcher.broadcastMessage(OpCode.START, startPayload, null, null, true);
    logger.info('Game started! Match=%s X=%s O=%s', ctx.matchId, xPlayerId, playerIds.find((id) => state.marks[id] === 'O'));
  }

  return { state };
};

// ─────────────────────────────────────────────────────────────
// matchLoop — runs every tick
// ─────────────────────────────────────────────────────────────
export const matchLoop: nkruntime.MatchLoopFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  messages: nkruntime.MatchMessage[]
): { state: GameState } | null {
  // If the game is not active, don't process anything
  // but keep the match alive if we're waiting for players
  if (!state.playing) {
    // If no presences remain and the game isn't playing, end the match
    if (Object.keys(state.presences).length === 0) {
      return null;
    }
    return { state };
  }

  // ── Turn timeout check ──
  state.deadlineRemainingTicks--;
  if (state.deadlineRemainingTicks <= 0) {
    // Active player ran out of time — opponent wins by timeout
    const loser = state.activePlayerId!;
    const winnerEntry = Object.keys(state.presences).find((id) => id !== loser);

    if (winnerEntry) {
      state.winner = winnerEntry;
      state.winnerMark = state.marks[winnerEntry];
      state.playing = false;

      // Write leaderboard
      writeLeaderboard(nk, logger, state.winner);

      const donePayload = JSON.stringify({
        board: state.board,
        winner: state.winner,
        winnerMark: state.winnerMark,
        reason: 'timeout',
        loser,
      });
      dispatcher.broadcastMessage(OpCode.DONE, donePayload, null, null, true);
      logger.info('Game over by timeout. Winner=%s Loser=%s', state.winner, loser);
    }

    return null; // End the match
  }

  // ── Process incoming messages ──
  for (const message of messages) {
    // Only process MOVE opcodes
    if (message.opCode !== OpCode.MOVE) {
      logger.warn('Ignoring unknown opCode=%d from userId=%s', message.opCode, message.sender.userId);
      continue;
    }

    // Validate it's this player's turn
    if (message.sender.userId !== state.activePlayerId) {
      const rejectPayload = JSON.stringify({ reason: 'Not your turn' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectPayload, [message.sender], null, true);
      logger.warn('Move rejected: not their turn. userId=%s active=%s', message.sender.userId, state.activePlayerId);
      continue;
    }

    // Parse the move
    let move: MoveMessage;
    try {
      const data = JSON.parse(nk.binaryToString(message.data));
      move = data as MoveMessage;
    } catch (e) {
      const rejectPayload = JSON.stringify({ reason: 'Invalid move format' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectPayload, [message.sender], null, true);
      logger.error('Failed to parse move from userId=%s: %v', message.sender.userId, e);
      continue;
    }

    // Validate position
    if (move.position === undefined || move.position === null || move.position < 0 || move.position > 8) {
      const rejectPayload = JSON.stringify({ reason: 'Invalid position. Must be 0-8.' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectPayload, [message.sender], null, true);
      logger.warn('Move rejected: invalid position=%d userId=%s', move.position, message.sender.userId);
      continue;
    }

    // Validate cell is empty
    if (state.board[move.position] !== null) {
      const rejectPayload = JSON.stringify({ reason: 'Cell already occupied' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectPayload, [message.sender], null, true);
      logger.warn('Move rejected: cell occupied. position=%d userId=%s', move.position, message.sender.userId);
      continue;
    }

    // ── Apply the move ──
    const playerMark = state.marks[message.sender.userId];
    state.board[move.position] = playerMark;
    state.moveCount++;
    logger.info('Move applied: userId=%s mark=%s position=%d moveCount=%d', message.sender.userId, playerMark, move.position, state.moveCount);

    // ── Check for win ──
    const winResult = checkWin(state.board, playerMark);
    if (winResult) {
      state.winner = message.sender.userId;
      state.winnerMark = playerMark;
      state.playing = false;

      // Write leaderboard
      writeLeaderboard(nk, logger, state.winner);

      const donePayload = JSON.stringify({
        board: state.board,
        winner: state.winner,
        winnerMark: state.winnerMark,
        reason: 'win',
        winLine: winResult,
      });
      dispatcher.broadcastMessage(OpCode.DONE, donePayload, null, null, true);
      logger.info('Game over: WIN! Winner=%s Mark=%s Line=%v', state.winner, playerMark, winResult);

      return null; // End the match
    }

    // ── Check for draw ──
    if (state.moveCount >= 9) {
      state.playing = false;

      const donePayload = JSON.stringify({
        board: state.board,
        winner: null,
        winnerMark: null,
        reason: 'draw',
      });
      dispatcher.broadcastMessage(OpCode.DONE, donePayload, null, null, true);
      logger.info('Game over: DRAW!');

      return null; // End the match
    }

    // ── Switch turns ──
    const otherPlayerId = Object.keys(state.presences).find(
      (id) => id !== message.sender.userId
    );
    if (otherPlayerId) {
      state.activePlayerId = otherPlayerId;
      state.deadlineRemainingTicks = DEADLINE_TICKS;
    }

    // ── Broadcast updated state to all players ──
    const statePayload = JSON.stringify({
      board: state.board,
      activePlayerId: state.activePlayerId,
      moveCount: state.moveCount,
      deadlineRemainingTicks: state.deadlineRemainingTicks,
    });
    dispatcher.broadcastMessage(OpCode.STATE, statePayload, null, null, true);
  }

  return { state };
};

// ─────────────────────────────────────────────────────────────
// matchLeave
// ─────────────────────────────────────────────────────────────
export const matchLeave: nkruntime.MatchLeaveFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presences: nkruntime.Presence[]
): { state: GameState } | null {
  for (const presence of presences) {
    logger.info('Player left: userId=%s', presence.userId);
    delete state.presences[presence.userId];

    // If the game is in progress and a player leaves, the other player wins by forfeit
    if (state.playing) {
      const remainingPlayers = Object.keys(state.presences);

      if (remainingPlayers.length === 1) {
        const winnerId = remainingPlayers[0];
        state.winner = winnerId;
        state.winnerMark = state.marks[winnerId];
        state.playing = false;

        // Write leaderboard
        writeLeaderboard(nk, logger, winnerId);

        const donePayload = JSON.stringify({
          board: state.board,
          winner: state.winner,
          winnerMark: state.winnerMark,
          reason: 'forfeit',
          loser: presence.userId,
        });

        // Broadcast to remaining presences
        const remainingPresence = state.presences[winnerId];
        if (remainingPresence) {
          dispatcher.broadcastMessage(OpCode.DONE, donePayload, [remainingPresence], null, true);
        }

        logger.info('Game over by forfeit. Winner=%s Loser=%s', winnerId, presence.userId);
        return null; // End the match
      }
    }
  }

  // If no players remain, end the match
  if (Object.keys(state.presences).length === 0) {
    logger.info('No players remaining. Ending match.');
    return null;
  }

  // Update label to open if game hasn't started yet
  if (!state.playing) {
    const label: MatchLabel = { open: 1 };
    dispatcher.matchLabelUpdate(JSON.stringify(label));
  }

  return { state };
};

// ─────────────────────────────────────────────────────────────
// matchTerminate
// ─────────────────────────────────────────────────────────────
export const matchTerminate: nkruntime.MatchTerminateFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  graceSeconds: number
): { state: GameState } | null {
  logger.info('Match terminating: %s graceSeconds=%d', ctx.matchId, graceSeconds);

  // If game was in progress, broadcast termination
  if (state.playing) {
    const donePayload = JSON.stringify({
      board: state.board,
      winner: null,
      winnerMark: null,
      reason: 'terminated',
    });
    dispatcher.broadcastMessage(OpCode.DONE, donePayload, null, null, true);
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// matchSignal
// ─────────────────────────────────────────────────────────────
export const matchSignal: nkruntime.MatchSignalFunction<GameState> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  data: string
): { state: GameState; data?: string } | null {
  logger.info('Match signal received: %s', data);
  return { state, data: 'signal_received' };
};

// ─────────────────────────────────────────────────────────────
// Helper: Check if a mark has won
// ─────────────────────────────────────────────────────────────
function checkWin(board: (Mark | null)[], mark: Mark): number[] | null {
  for (const line of WIN_LINES) {
    if (
      board[line[0]] === mark &&
      board[line[1]] === mark &&
      board[line[2]] === mark
    ) {
      return line;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Helper: Increment winner's leaderboard score
// ─────────────────────────────────────────────────────────────
function writeLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  winnerId: string
): void {
  try {
    const account = nk.accountGetId(winnerId);
    const username = account.user?.displayName || account.user?.username || undefined;

    nk.leaderboardRecordWrite(
      LEADERBOARD_ID,
      winnerId,
      username,
      1, // score increment
      0, // subscore
      undefined, // metadata
      undefined  // operator override — uses leaderboard default (INCREMENTAL)
    );
    logger.info('Leaderboard updated for winner=%s', winnerId);
  } catch (e) {
    logger.error('Failed to write leaderboard for winner=%s: %v', winnerId, e);
  }
}
