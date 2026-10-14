/**
 * Engine service functions for chess game analysis.
 * These functions perform calculations on centipawn data returned from the chess engine.
 */

/**
 * Calculate win percentage from centipawn evaluation
 */
function calculateWinPercentage(cp: number) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Calculate move accuracy from win percentages before and after a move
 */
function calculateAccuracy(wpBefore: number, wpAfter: number) {
  const delta = wpBefore - wpAfter;
  const penaltyFactor = delta > 0 ? delta ** 2 : delta;
  return Math.max(
    0,
    Math.min(100, 103.1668 * Math.exp(-0.04354 * penaltyFactor) - 3.1669),
  );
}

/**
 * Parse mate notation to infinite value
 */
function parseMate(mate: string) {
  return parseInt(mate.substring(1), 10) > 0 ? Infinity : -Infinity;
}

/**
 * Calculate accuracy for a game given centipawn evaluations per move.
 * @param centipawns - Array of centipawn values from the engine for each move
 * @returns Object with whitePlayerAverage and blackPlayerAverage accuracy percentages
 */
export function calculateAccuracyFromCentipawns(
  centipawns: (number | string)[],
): { whitePlayerAverage: number; blackPlayerAverage: number } {
  // We don't include the last centipawn value as it's after the last move
  const evaluationsForAccuracy = centipawns.slice(0, centipawns.length - 1);
  
  const winPercentagePerNode: number[] = evaluationsForAccuracy.map((cp) =>
    typeof cp === 'string'
      ? calculateWinPercentage(parseMate(cp))
      : calculateWinPercentage(cp),
  );
  winPercentagePerNode.unshift(50); // Starting position is 50%

  let whiteSum = 0;
  let blackSum = 0;
  let whiteCount = 0;
  let blackCount = 0;

  for (let i = 0; i < winPercentagePerNode.length - 1; i += 1) {
    if (i % 2 === 0) {
      whiteSum += calculateAccuracy(
        winPercentagePerNode[i],
        winPercentagePerNode[i + 1],
      );
      whiteCount += 1;
    } else {
      blackSum += calculateAccuracy(
        100 - winPercentagePerNode[i],
        100 - winPercentagePerNode[i + 1],
      );
      blackCount += 1;
    }
  }

  const whitePlayerAverage = whiteCount > 0 ? whiteSum / whiteCount : 100;
  const blackPlayerAverage = blackCount > 0 ? blackSum / blackCount : 100;

  return { whitePlayerAverage, blackPlayerAverage };
}

/**
 * Calculate advantage plot data from centipawn evaluations
 * @param centipawns - Array of centipawn values from the engine
 * @returns Array of advantage values in pawns (centipawns / 100) or mate notation
 */
export function calculateAdvantageFromCentipawns(
  centipawns: (number | string)[],
): (string | number)[] {
  return centipawns.map((cp) =>
    typeof cp === 'number' ? cp / 100 : cp,
  );
}

/**
 * Parse advantage data for display
 */
export function parseAdvantage(advantage: (string | number)[]) {
  let previousValue = 0;

  const parsedAdvantage = advantage.map((item, index) => {
    if (typeof item === 'string') {
      if (!(index > 0 && typeof advantage[index - 1] === 'string')) {
        const sign = item[1];
        if (sign === '+') {
          previousValue += 1;
        } else if (sign === '-') {
          previousValue -= 1;
        }
      }
    } else {
      previousValue = item;
    }

    return previousValue;
  });

  return parsedAdvantage;
}

/**
 * Calculate mistakes, inaccuracies, and blunders from advantage data
 * @param advantage - Array of advantage values (from parseAdvantage)
 * @param threshold1 - Lower threshold for error classification
 * @param threshold2 - Upper threshold for error classification
 * @returns Object with whitePlayer and blackPlayer arrays of move indices where errors occurred
 */
export function calculateErrors(
  advantage: (string | number)[],
  threshold1: number,
  threshold2: number,
) {
  const parsedAdvantage = parseAdvantage(advantage);
  parsedAdvantage.unshift(0); // Add initial zero for the starting position
  const errors = {
    whitePlayer: [] as number[],
    blackPlayer: [] as number[],
  };

  for (let i = 0; i < parsedAdvantage.length - 1; i += 1) {
    const difference = parsedAdvantage[i] - parsedAdvantage[i + 1];
    if (i % 2 === 0) {
      if (difference >= threshold1 && difference < threshold2) {
        errors.whitePlayer.push(i);
      }
    } else if (-difference >= threshold1 && -difference < threshold2) {
      errors.blackPlayer.push(i);
    }
  }

  return errors;
}

/**
 * Full game analysis result type
 */
export interface GameAnalysisResult {
  accuracy: { whitePlayerAverage: number; blackPlayerAverage: number };
  advantage: (string | number)[];
  mistakes: { whitePlayer: number[]; blackPlayer: number[] };
  inaccuracies: { whitePlayer: number[]; blackPlayer: number[] };
  blunders: { whitePlayer: number[]; blackPlayer: number[] };
}

/**
 * Combine centipawns and moves into a full analysis result
 */
export function createFullAnalysis(
  centipawns: (number | string)[],
  moves: string[],
): GameAnalysisResult {
  const accuracy = calculateAccuracyFromCentipawns(centipawns);
  const advantage = calculateAdvantageFromCentipawns(centipawns);
  const mistakes = calculateErrors(advantage, 1, 1.5);
  const inaccuracies = calculateErrors(advantage, 0.5, 1);
  const blunders = calculateErrors(advantage, 1.5, Infinity);

  return { accuracy, advantage, mistakes, inaccuracies, blunders };
}

/**
 * Calculate the magnitude of an error (eval loss in pawns) for a specific move.
 * @param advantage - Array of advantage values
 * @param moveIndex - Move index (0-based)
 * @param side - Optional player side ('white' | 'black'). If not specified, inferred from moveIndex (even=white, odd=black)
 * @param movesCount - Optional total move count to disambiguate whether advantage array includes starting position
 * @returns Error magnitude (positive number representing pawn advantage lost)
 */
export function calculateMoveErrorMagnitude(
  advantage: (string | number)[] | undefined,
  moveIndex: number,
  side?: 'white' | 'black',
  movesCount?: number,
): number {
  if (!advantage || !Array.isArray(advantage) || advantage.length === 0) {
    return 0;
  }

  const parsed = parseAdvantage(advantage);

  if (movesCount !== undefined && parsed.length === movesCount + 1) {
    // Starting position already at index 0
  } else {
    parsed.unshift(0);
  }

  if (moveIndex < 0 || moveIndex >= parsed.length - 1) {
    return 0;
  }

  const isWhite = side ? side === 'white' : moveIndex % 2 === 0;
  const difference = parsed[moveIndex] - parsed[moveIndex + 1];
  const loss = isWhite ? difference : -difference;

  return Math.max(0, Number(loss.toFixed(2)));
}
