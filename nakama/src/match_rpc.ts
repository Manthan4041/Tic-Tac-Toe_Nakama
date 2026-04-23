/**
 * RPC handlers and matchmaker hook for Tic-Tac-Toe.
 *
 * - rpcFindMatch: Finds an open match or creates a new one
 * - rpcHealthcheck: Simple health check endpoint
 * - onMatchmakerMatched: Creates a match when the matchmaker pairs two players
 */

import { MATCH_NAME, LEADERBOARD_ID } from './constants';

/** Payload returned by find_match RPC */
interface FindMatchResponse {
  matchIds: string[];
}

/**
 * RPC: find_match
 *
 * Called by clients to find an open match. If no open matches exist,
 * a new match is created. Returns the matchId for the client to join.
 */
export const rpcFindMatch: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  logger.info('rpcFindMatch called by userId=%s', ctx.userId);

  const matches = nk.matchList(10, true, null, 0, 1, '+label.open:1');
  const matchIds: string[] = [];

  if (matches && matches.length > 0) {
    // Return the first open match
    matchIds.push(matches[0].matchId);
    logger.info('Found open match: %s', matches[0].matchId);
  } else {
    // No open matches — create a new one
    const matchId = nk.matchCreate(MATCH_NAME, {});
    matchIds.push(matchId);
    logger.info('Created new match: %s', matchId);
  }

  const response: FindMatchResponse = { matchIds };
  return JSON.stringify(response);
};

/**
 * RPC: healthcheck
 *
 * Returns a simple success response. Used for container health checks
 * and verifying the runtime module is loaded correctly.
 */
export const rpcHealthcheck: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
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
export const onMatchmakerMatched: nkruntime.MatchmakerMatchedFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string {
  logger.info(
    'Matchmaker matched %d players',
    matches.length
  );

  // Create a new authoritative match
  const matchId = nk.matchCreate(MATCH_NAME, {});
  logger.info('Matchmaker created match: %s', matchId);

  return matchId;
};

/**
 * Creates the leaderboard if it doesn't exist.
 * Called once during module initialization.
 */
export function createLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger
): void {
  try {
    nk.leaderboardCreate(
      LEADERBOARD_ID,
      false, // not authoritative (any user can submit)
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.INCREMENTAL,
      undefined, // no reset schedule
      undefined  // no metadata
    );
    logger.info('Leaderboard created/verified: %s', LEADERBOARD_ID);
  } catch (e) {
    // Leaderboard may already exist — that's fine
    logger.info('Leaderboard already exists or creation skipped: %s', LEADERBOARD_ID);
  }
}
