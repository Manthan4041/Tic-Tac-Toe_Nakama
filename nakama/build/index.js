'use strict';

/**
 * Constants for the Tic-Tac-Toe authoritative match handler.
 * Defines opcodes, game configuration, and shared types.
 */
/** Operation codes for client-server communication */
var OpCode;
(function (OpCode) {
    /** Client → Server: Player places a mark */
    OpCode[OpCode["MOVE"] = 1] = "MOVE";
    /** Server → Client: Updated game state broadcast */
    OpCode[OpCode["STATE"] = 2] = "STATE";
    /** Server → Client: Game is over (win/draw/forfeit) */
    OpCode[OpCode["DONE"] = 3] = "DONE";
    /** Server → Client: Move was rejected with reason */
    OpCode[OpCode["REJECTED"] = 4] = "REJECTED";
    /** Server → Client: Game has started, marks assigned */
    OpCode[OpCode["START"] = 5] = "START";
})(OpCode || (OpCode = {}));
/** All 8 possible winning line indices */
const WIN_LINES = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal top-left to bottom-right
    [2, 4, 6], // diagonal top-right to bottom-left
];
/** Game configuration */
const TICK_RATE = 5;
const MAX_PLAYERS = 2;
const TURN_TIMEOUT_SECONDS = 30;
const DEADLINE_TICKS = TURN_TIMEOUT_SECONDS * TICK_RATE;
const LEADERBOARD_ID = 'tic_tac_toe_wins';
const MATCH_NAME = 'tic-tac-toe';
/** Creates a fresh empty board */
function createEmptyBoard() {
    return [null, null, null, null, null, null, null, null, null];
}

/**
 * Authoritative Match Handler for Tic-Tac-Toe.
 *
 * All game logic runs server-side. The server validates every move,
 * enforces turn order, detects wins/draws, and handles disconnections.
 * Clients only send move intents; the server is the source of truth.
 */
// ─────────────────────────────────────────────────────────────
// matchInit
// ─────────────────────────────────────────────────────────────
const matchInit = function (ctx, logger, nk, params) {
    logger.info('Match created: %s', ctx.matchId);
    const state = {
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
    const label = { open: 1 };
    return {
        state,
        tickRate: TICK_RATE,
        label: JSON.stringify(label),
    };
};
// ─────────────────────────────────────────────────────────────
// matchJoinAttempt
// ─────────────────────────────────────────────────────────────
const matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
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
const matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (const presence of presences) {
        state.presences[presence.userId] = presence;
        // Assign marks in join order: first = X, second = O
        if (!state.marks[presence.userId]) {
            const assignedCount = Object.keys(state.marks).length;
            const mark = assignedCount === 0 ? 'X' : 'O';
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
        const xPlayerId = playerIds.find((id) => state.marks[id] === 'X');
        state.activePlayerId = xPlayerId;
        state.deadlineRemainingTicks = DEADLINE_TICKS;
        // Update label to indicate match is no longer open
        const label = { open: 0 };
        dispatcher.matchLabelUpdate(JSON.stringify(label));
        // Build the player info map for the START message
        const players = {};
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
const matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
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
        const loser = state.activePlayerId;
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
        let move;
        try {
            const data = JSON.parse(nk.binaryToString(message.data));
            move = data;
        }
        catch (e) {
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
        const otherPlayerId = Object.keys(state.presences).find((id) => id !== message.sender.userId);
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
const matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
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
        const label = { open: 1 };
        dispatcher.matchLabelUpdate(JSON.stringify(label));
    }
    return { state };
};
// ─────────────────────────────────────────────────────────────
// matchTerminate
// ─────────────────────────────────────────────────────────────
const matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
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
const matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    logger.info('Match signal received: %s', data);
    return { state, data: 'signal_received' };
};
// ─────────────────────────────────────────────────────────────
// Helper: Check if a mark has won
// ─────────────────────────────────────────────────────────────
function checkWin(board, mark) {
    for (const line of WIN_LINES) {
        if (board[line[0]] === mark &&
            board[line[1]] === mark &&
            board[line[2]] === mark) {
            return line;
        }
    }
    return null;
}
// ─────────────────────────────────────────────────────────────
// Helper: Increment winner's leaderboard score
// ─────────────────────────────────────────────────────────────
function writeLeaderboard(nk, logger, winnerId) {
    try {
        nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, undefined, // username — auto-resolved
        1, // score increment
        0, // subscore
        undefined, // metadata
        undefined // operator override — uses leaderboard default (INCREMENTAL)
        );
        logger.info('Leaderboard updated for winner=%s', winnerId);
    }
    catch (e) {
        logger.error('Failed to write leaderboard for winner=%s: %v', winnerId, e);
    }
}

/**
 * RPC handlers and matchmaker hook for Tic-Tac-Toe.
 *
 * - rpcFindMatch: Finds an open match or creates a new one
 * - rpcHealthcheck: Simple health check endpoint
 * - onMatchmakerMatched: Creates a match when the matchmaker pairs two players
 */
/**
 * RPC: find_match
 *
 * Called by clients to find an open match. If no open matches exist,
 * a new match is created. Returns the matchId for the client to join.
 */
const rpcFindMatch = function (ctx, logger, nk, payload) {
    logger.info('rpcFindMatch called by userId=%s', ctx.userId);
    const matches = nk.matchList(10, true, null, null, 1, '{\"open\": 1}');
    const matchIds = [];
    if (matches && matches.length > 0) {
        // Return the first open match
        matchIds.push(matches[0].matchId);
        logger.info('Found open match: %s', matches[0].matchId);
    }
    else {
        // No open matches — create a new one
        const matchId = nk.matchCreate(MATCH_NAME, {});
        matchIds.push(matchId);
        logger.info('Created new match: %s', matchId);
    }
    const response = { matchIds };
    return JSON.stringify(response);
};
/**
 * RPC: healthcheck
 *
 * Returns a simple success response. Used for container health checks
 * and verifying the runtime module is loaded correctly.
 */
const rpcHealthcheck = function (ctx, logger, nk, payload) {
    logger.info('Healthcheck called');
    return JSON.stringify({ success: true, timestamp: Date.now() });
};
/**
 * Matchmaker Matched Hook
 *
 * Called when the matchmaker has found enough players (2) to start a game.
 * Creates a new authoritative match and returns the matchId so both
 * players are automatically joined.
 */
const onMatchmakerMatched = function (ctx, logger, nk, matches) {
    logger.info('Matchmaker matched %d players', matches.length);
    // Create a new authoritative match
    const matchId = nk.matchCreate(MATCH_NAME, {});
    logger.info('Matchmaker created match: %s', matchId);
    return matchId;
};
/**
 * Creates the leaderboard if it doesn't exist.
 * Called once during module initialization.
 */
function createLeaderboard(nk, logger) {
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, false, // not authoritative (any user can submit)
        "descending" /* nkruntime.SortOrder.DESCENDING */, "increment" /* nkruntime.Operator.INCREMENTAL */, undefined, // no reset schedule
        undefined // no metadata
        );
        logger.info('Leaderboard created/verified: %s', LEADERBOARD_ID);
    }
    catch (e) {
        // Leaderboard may already exist — that's fine
        logger.info('Leaderboard already exists or creation skipped: %s', LEADERBOARD_ID);
    }
}

/**
 * Tic-Tac-Toe Nakama Server Module — Entry Point
 *
 * This is the InitModule function that Nakama calls when loading
 * the TypeScript runtime module. It registers:
 *   1. The authoritative match handler (tic-tac-toe)
 *   2. RPC functions (find_match, healthcheck)
 *   3. The matchmaker matched hook
 *   4. The wins leaderboard
 */
/**
 * InitModule — Nakama entry point.
 * Called once when the server starts and loads this JS module.
 */
function InitModule(ctx, logger, nk, initializer) {
    logger.info('═══════════════════════════════════════════════');
    logger.info('  Tic-Tac-Toe Server Module v1.0.0');
    logger.info('  Authoritative Match Handler — LILA Engineering');
    logger.info('═══════════════════════════════════════════════');
    // ── Register the authoritative match handler ──
    initializer.registerMatch(MATCH_NAME, {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLoop,
        matchLeave,
        matchTerminate,
        matchSignal,
    });
    logger.info('Registered match handler: %s', MATCH_NAME);
    // ── Register RPC functions ──
    initializer.registerRpc('find_match', rpcFindMatch);
    initializer.registerRpc('healthcheck', rpcHealthcheck);
    logger.info('Registered RPCs: find_match, healthcheck');
    // ── Register matchmaker hook ──
    initializer.registerMatchmakerMatched(onMatchmakerMatched);
    logger.info('Registered matchmaker matched hook');
    // ── Create wins leaderboard ──
    createLeaderboard(nk, logger);
    logger.info('═══════════════════════════════════════════════');
    logger.info('  Module initialization complete!');
    logger.info('═══════════════════════════════════════════════');
}
// Expose to Nakama runtime
!InitModule && InitModule.bind(null);
