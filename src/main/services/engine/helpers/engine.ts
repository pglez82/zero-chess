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

function getCentipawns(invert: boolean, nodes: number = 10000) {
  if (!engine) {
    throw new Error('Engine not initialized');
  }
  let latestScore: number | string = 0;

  return new Promise<number | string>((resolve) => {
    engine.send(
      `go nodes ${nodes}`,
      function onDone() {
        if (invert) {
          if (typeof latestScore === 'number') {
            latestScore = -latestScore;
          } else {
            latestScore = `#${-parseInt(latestScore.substring(1), 10)}`;
          }
        }

        resolve(latestScore);
      },
      function onStream(data) {
        const cpRegex = /score cp (-?\d+)/;
        const mateRegex = /score mate (-?\d+)/;

        let match = data.match(mateRegex);
        if (match && match[1]) {
          latestScore = `#${match[1]}`;
        } else {
          match = data.match(cpRegex);
          if (match && match[1]) {
            latestScore = parseFloat(match[1]);
          }
        }
      },
    );
  });
}

function getCentipawnsOnEngine(
  engineInstance: Engine,
  invert: boolean,
  nodes: number = 10000,
): Promise<number | string> {
  let latestScore: number | string = 0;

  return new Promise<number | string>((resolve) => {
    engineInstance.send(
      `go nodes ${nodes}`,
      function onDone() {
        if (invert) {
          if (typeof latestScore === 'number') {
            latestScore = -latestScore;
          } else {
            latestScore = `#${-parseInt(latestScore.substring(1), 10)}`;
          }
        }

        resolve(latestScore);
      },
      function onStream(data) {
        const cpRegex = /score cp (-?\d+)/;
        const mateRegex = /score mate (-?\d+)/;

        let match = data.match(mateRegex);
        if (match && match[1]) {
          latestScore = `#${match[1]}`;
        } else {
          match = data.match(cpRegex);
          if (match && match[1]) {
            latestScore = parseFloat(match[1]);
          }
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

    centipawnsPerNode.push(await getCentipawns(i % 2 === 0));
  }

  return centipawnsPerNode;
}

/**
 * Get centipawns for a game using a specific engine instance
 */
export async function getGameCentipawnsOnEngine(
  engineInstance: Engine,
  moves: string[],
): Promise<(number | string)[]> {
  const centipawnsPerNode: (number | string)[] = [];
  const chess = new Chess();

  for (let i = 0; i < moves.length; i += 1) {
    chess.move(moves[i]);
    await sendOnEngine(engineInstance, `position fen ${chess.fen()}`);

    centipawnsPerNode.push(
      await getCentipawnsOnEngine(engineInstance, i % 2 === 0),
    );
  }

  return centipawnsPerNode;
}
