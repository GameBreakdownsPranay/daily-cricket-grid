import type { GameState } from "../types/game";

export const RARITY_TURNS = 9;

export const createInitialGameState = (): GameState => ({
  lockedCells: {},
  usedPlayers: new Set(),
  cellStatus: {},
  attemptsUsed: 0,
  scoringLocked: false,
  scoredCells: {},
  gridComplete: false
});