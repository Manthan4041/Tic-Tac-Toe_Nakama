/**
 * Constants for the Tic-Tac-Toe authoritative match handler.
 * Defines opcodes, game configuration, and shared types.
 */

/** Operation codes for client-server communication */
export enum OpCode {
  /** Client → Server: Player places a mark */
  MOVE = 1,
  /** Server → Client: Updated game state broadcast */
  STATE = 2,
  /** Server → Client: Game is over (win/draw/forfeit) */
  DONE = 3,
  /** Server → Client: Move was rejected with reason */
  REJECTED = 4,
  /** Server → Client: Game has started, marks assigned */
  START = 5,
}

/** Player mark type */
export type Mark = 'X' | 'O';

/** Match label for listing */
export interface MatchLabel {
  open: number; // 1 = joinable, 0 = full/in-progress
}

/** The authoritative game state managed by the server */
export interface GameState {
  /** 9-cell board: null = empty, 'X' or 'O' = occupied */
  board: (Mark | null)[];
  /** Map of userId → assigned mark */
  marks: { [userId: string]: Mark };
  /** userId of the player whose turn it is */
  activePlayerId: string | null;
  /** Currently connected presences by userId */
  presences: { [userId: string]: nkruntime.Presence };
  /** Ticks remaining before active player forfeits due to timeout */
  deadlineRemainingTicks: number;
  /** userId of the winner, null if no winner yet */
  winner: string | null;
  /** Mark of the winner */
  winnerMark: Mark | null;
  /** Whether the game is currently in progress */
  playing: boolean;
  /** Total number of moves made */
  moveCount: number;
  /** Next game number (for rematches — future use) */
  nextGameRemainingTicks: number;
}

/** Client move message payload */
export interface MoveMessage {
  position: number;
}

/** All 8 possible winning line indices */
export const WIN_LINES: number[][] = [
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
export const TICK_RATE = 5;
export const MAX_PLAYERS = 2;
export const TURN_TIMEOUT_SECONDS = 30;
export const DEADLINE_TICKS = TURN_TIMEOUT_SECONDS * TICK_RATE;
export const LEADERBOARD_ID = 'tic_tac_toe_wins';
export const MATCH_NAME = 'tic-tac-toe';

/** Creates a fresh empty board */
export function createEmptyBoard(): (Mark | null)[] {
  return [null, null, null, null, null, null, null, null, null];
}
