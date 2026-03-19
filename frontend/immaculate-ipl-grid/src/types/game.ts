export type CellStatus =
  | "empty"
  | "incorrect"
  | "ambiguous"
  | "correct"
  | "locked";

export interface GameState {
  lockedCells: Record<string, string>;
  usedPlayers: Set<string>;
  cellStatus: Record<string, CellStatus>;
  attemptsUsed: number;
  scoringLocked: boolean;
  scoredCells: Record<string, string>;
  gridComplete: boolean;
}