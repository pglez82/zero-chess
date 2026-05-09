/* eslint-disable no-await-in-loop */
import loadEngine from './stockfish/load_engine';
import { Engine } from '../../../../interfaces';
import { Chess } from 'chess.js';

const NUM_WORKERS = navigator.hardwareConcurrency || 4;

let engine: Engine | undefined;

/**
 * Create a new engine instance (worker) for parallel analysis
 */
export function createEngine(): Engine {
  if (process.env.NODE_ENV === 'development') {
    return loadEngine('/services/engine/helpers/stockfish/stockfish.js');
  }

  throw new Error('createEngine should not be called directly in production');
}

/**
 * Get a pool of engine instances for parallel analysis
 */
export async function createEnginePool(path?: string): Promise<Engine[]> {
  const pool: Engine[] = [];
  
  for (let i = 0; i < NUM_WORKERS; i += 1) {
    const engineInstance = path
      ? loadEngine(path)
      : loadEngine(
          process.env.NODE_ENV === 'development'
            ? '/services/engine/helpers/stockfish/stockfish.js'
            : await window.electron.ipcRenderer.joinPath(
                'services/engine/helpers/stockfish/stockfish.js',
              ),
        );
    
    await new Promise<void>((resolve) => {
      engineInstance.send(
        'setoption name Use NNUE value true',
        function onDone() {
          resolve();
        },
      );
    });
    
    pool.push(engineInstance);
  }
  
  return pool;
}

function send(str: string) {
  if (!engine) {
    throw new Error('Engine not initialized');
  }
  return new Promise<string>((resolve) => {
    engine.send(str, function onDone(data) {
      resolve(data);
    });
  });
}

async function sendOnEngine(engineInstance: Engine, str: string): Promise<string> {
  return new Promise<string>((resolve) => {
    engineInstance.send(str, function onDone(data) {
      resolve(data);
    });
  });
}

export async function connectEngine() {
  const stockfishPath =
    process.env.NODE_ENV === 'development'
      ? '/services/engine/helpers/stockfish/stockfish.js'
      : await window.electron.ipcRenderer.joinPath(
          'services/engine/helpers/stockfish/stockfish.js',
        );

  engine = createEngine();
  await sendOnEngine(engine, 'setoption name Use NNUE value true');
}

export function disconnectEngine() {
  if (engine) {
    engine.quit();
    engine = undefined;
  }
}

function parseEngineScore(data: string): { type: 'cp'; value: number } | { type: 'mate'; value: number } | null {
  const mateRegex = /score\s+mate\s+(-?\d+)/;
  const cpRegex = /score\s+cp\s+(-?\d+)/;

  const mateMatch = data.match(mateRegex);
  if (mateMatch && mateMatch[1]) {
    return { type: 'mate', value: parseInt(mateMatch[1], 10) };
  }

  const cpMatch = data.match(cpRegex);
  if (cpMatch && cpMatch[1]) {
    return { type: 'cp', value: parseFloat(cpMatch[1]) };
  }

  return null;
}

function parseEnginePv(data: string): string {
  const pvRegex = /\bpv\s+(.+?)(?:\s+score|\s+depth|\s+seldepth|\s+multipv|\s+nodes|\s+nps|\s+time)\b/;
  const pvMatch = data.match(pvRegex);
  if (pvMatch && pvMatch[1]) {
    return pvMatch[1].trim();
  }
  // Fallback: capture everything after 'pv ' until end of line
  const pvFallbackRegex = /\bpv\s+(.+)/;
  const fallbackMatch = data.match(pvFallbackRegex);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].trim();
  }
  return '';
}

function invertScore(score: { type: 'cp'; value: number } | { type: 'mate'; value: number }): {
  type: 'cp';
  value: number;
} | {
  type: 'mate';
  value: number;
} {
  if (score.type === 'cp') {
    return { type: 'cp', value: -score.value };
  } else {
    return { type: 'mate', value: -score.value };
  }
}

function invertPv(pv: string, isWhiteToMoveAfter: boolean): string {
  const moves = pv.split(/\s+/);
  if (!isWhiteToMoveAfter) {
    // Black just moved, so PV starts with white's response
    // Invert the perspective: swap sides of each move
    return moves.map((move) => invertMove(move)).join(' ');
  }
  return pv;
}

function invertMove(move: string): string {
  // Convert a move from black's perspective to white's (and vice versa)
  // Board flip: a-h stays the same, 1<->8 (i.e., 8 - rank + 1)
  const fromRegex = /^([a-h])([1-8])([a-h])([1-8])([qrbnQRBN])?$/;
  const match = move.match(fromRegex);
  if (match) {
    const fromFile = match[1];
    const fromRank = 8 - parseInt(match[2], 10) + 1;
    const toFile = match[3];
    const toRank = 8 - parseInt(match[4], 10) + 1;
    const promotion = match[5] || '';
    return `${fromFile}${fromRank}${toFile}${toRank}${promotion}`;
  }
  // Handle special moves like O-O, O-O-O
  if (move === 'O-O' || move === 'o-o') return 'O-O';
  if (move === 'O-O-O' || move === 'o-o-o') return 'O-O-O';
  return move;
}

function getCentipawns(invert: boolean, nodes: number = 10000) {
  if (!engine) {
    throw new Error('Engine not initialized');
  }
  let latestScore: { type: 'cp'; value: number } | { type: 'mate'; value: number } | null = null;
  let bestLine = '';

  return new Promise<{ score: { type: 'cp'; value: number } | { type: 'mate'; value: number }; bestLine: string }>((resolve) => {
    engine.send(
      `go nodes ${nodes}`,
      function onDone() {
        let score = latestScore;
        let line = bestLine;

        if (score && invert) {
          score = invertScore(score);
        }

        if (invert) {
          line = invertPv(bestLine, false);
        }

        resolve({ score: score || { type: 'cp', value: 0 }, bestLine: line });
      },
      function onStream(data) {
        const score = parseEngineScore(data);
        if (score) {
          latestScore = score;
        }

        const pv = parseEnginePv(data);
        if (pv) {
          bestLine = pv;
        }
      },
    );
  });
}

function getCentipawnsOnEngine(
  engineInstance: Engine,
  invert: boolean,
  nodes: number = 10000,
): Promise<{ score: { type: 'cp'; value: number } | { type: 'mate'; value: number }; bestLine: string }> {
  let latestScore: { type: 'cp'; value: number } | { type: 'mate'; value: number } | null = null;
  let bestLine = '';

  return new Promise<{ score: { type: 'cp'; value: number } | { type: 'mate'; value: number }; bestLine: string }>((resolve) => {
    engineInstance.send(
      `go nodes ${nodes}`,
      function onDone() {
        let score = latestScore;
        let line = bestLine;

        if (score && invert) {
          score = invertScore(score);
        }

        if (invert) {
          line = invertPv(bestLine, false);
        }

        resolve({ score: score || { type: 'cp', value: 0 }, bestLine: line });
      },
      function onStream(data) {
        const score = parseEngineScore(data);
        if (score) {
          latestScore = score;
        }

        const pv = parseEnginePv(data);
        if (pv) {
          bestLine = pv;
        }
      },
    );
  });
}

export async function getGameCentipawns(moves: string[]) {
  const centipawnsPerNode: (number | string)[] = [];
  const chess = new Chess();

  for (let i = 0; i < moves.length; i += 1) {
    chess.move(moves[i]);
    await send(`position fen ${chess.fen()}`);

    const result = await getCentipawns(i % 2 === 0);
    const cp = result.score.type === 'cp' ? result.score.value : `#${result.score.value}`;
    centipawnsPerNode.push(cp);
  }

  return centipawnsPerNode;
}

/**
 * Get centipawns, scores, and best lines for a game using a specific engine instance
 */
export async function getGameCentipawnsOnEngine(
  engineInstance: Engine,
  moves: string[],
): Promise<{
  centipawns: (number | string)[];
  scores: Array<{ type: 'cp'; value: number } | { type: 'mate'; value: number }>;
  bestLines: string[];
}> {
  const centipawns: (number | string)[] = [];
  const scores: Array<{ type: 'cp'; value: number } | { type: 'mate'; value: number }> = [];
  const bestLines: string[] = [];
  const chess = new Chess();

  for (let i = 0; i < moves.length; i += 1) {
    chess.move(moves[i]);
    await sendOnEngine(engineInstance, `position fen ${chess.fen()}`);

    const result = await getCentipawnsOnEngine(engineInstance, i % 2 === 0);
    const cp = result.score.type === 'cp' ? result.score.value : `#${result.score.value}`;
    centipawns.push(cp);
    scores.push(result.score);
    bestLines.push(result.bestLine);
  }

  return { centipawns, scores, bestLines };
}
