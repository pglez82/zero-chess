import { Chess } from 'chess.js';
import { calculateMoveErrorMagnitude } from '../../engine/engineService';

export interface RawMistakePosition {
  gameId: string;
  userId: string;
  side: 'white' | 'black';
  fen: string;
  moveIndex: number;
  moves: string;
  bestMove: string;
  errorMagnitude: number;
}

export function getBestMoveFromBestLines(
  bestLines: string[] | undefined,
  moveIndex: number,
  gameMoves: string[],
): string | null {
  if (
    bestLines &&
    moveIndex >= 1 &&
    moveIndex - 1 < bestLines.length &&
    bestLines[moveIndex - 1]
  ) {
    const line = bestLines[moveIndex - 1];
    if (line && line.trim()) {
      const moves = line.trim().split(/\s+/);
      if (moves[0]) return moves[0];
    }
  }

  // Fallback: for first-move errors or missing best lines,
  // use the actual move played in the game as a reference.
  if (moveIndex >= 0 && moveIndex < gameMoves.length) {
    return gameMoves[moveIndex];
  }

  return null;
}

export function extractMistakePositionsForGame(game: {
  id: string;
  moves: string;
  white_user_id?: string;
  white_user_name?: string;
  black_user_id?: string;
  black_user_name?: string;
  analysis?: any;
}): RawMistakePosition[] {
  let analysis = game.analysis;
  if (!analysis) return [];
  if (typeof analysis === 'string') {
    try {
      analysis = JSON.parse(analysis);
    } catch {
      return [];
    }
  }

  const rawMoves = game.moves || '';
  const gameMoves = rawMoves.trim().split(/\s+/).filter(Boolean);
  if (gameMoves.length === 0) return [];

  const chess = new Chess();
  const fens: string[] = [chess.fen()];
  for (const move of gameMoves) {
    try {
      chess.move(move);
      fens.push(chess.fen());
    } catch {
      break;
    }
  }

  const results: RawMistakePosition[] = [];

  const players: Array<{
    userId: string | undefined;
    side: 'white' | 'black';
  }> = [
    {
      userId: game.white_user_id || game.white_user_name,
      side: 'white',
    },
    {
      userId: game.black_user_id || game.black_user_name,
      side: 'black',
    },
  ];

  for (const player of players) {
    if (!player.userId) continue;

    const mistakes = analysis.mistakes?.[`${player.side}Player`];
    const blunders = analysis.blunders?.[`${player.side}Player`];

    const errorIndices = new Set<number>();
    if (Array.isArray(mistakes)) {
      mistakes.forEach((idx: number) => errorIndices.add(idx));
    }
    if (Array.isArray(blunders)) {
      blunders.forEach((idx: number) => errorIndices.add(idx));
    }

    const sortedIndices = Array.from(errorIndices).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const fen = fens[idx];
      if (!fen) continue;

      const bestMove =
        getBestMoveFromBestLines(analysis.bestLines, idx, gameMoves) || '';
      const movesLeadingToPosition = gameMoves.slice(0, idx);

      let errorMagnitude = calculateMoveErrorMagnitude(
        analysis.advantage,
        idx,
        player.side,
        gameMoves.length,
      );

      if (errorMagnitude === 0) {
        if (blunders?.includes(idx)) {
          errorMagnitude = 1.5;
        } else if (mistakes?.includes(idx)) {
          errorMagnitude = 1.0;
        }
      }

      results.push({
        gameId: game.id,
        userId: player.userId.toLowerCase(),
        side: player.side,
        fen,
        moveIndex: idx,
        moves: JSON.stringify(movesLeadingToPosition),
        bestMove,
        errorMagnitude,
      });
    }
  }

  return results;
}

