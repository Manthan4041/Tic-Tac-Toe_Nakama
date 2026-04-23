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

import {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLoop,
  matchLeave,
  matchTerminate,
  matchSignal,
} from './match_handler';

import {
  rpcFindMatch,
  rpcHealthcheck,
  onMatchmakerMatched,
  createLeaderboard,
} from './match_rpc';

import { MATCH_NAME } from './constants';

/**
 * InitModule — Nakama entry point.
 * Called once when the server starts and loads this JS module.
 */
function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  logger.info('═══════════════════════════════════════════════');
  logger.info('  Tic-Tac-Toe Server Module v1.0.0');
  logger.info('  Authoritative Match Handler — LILA Engineering');
  logger.info('═══════════════════════════════════════════════');

  // ── Register the authoritative match handler ──
  initializer.registerMatch(MATCH_NAME, {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
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
