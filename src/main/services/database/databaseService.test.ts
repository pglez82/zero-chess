import {
  INSERT_GAME_OR_IGNORE,
  UPDATE_GAME_ANALYSIS,
  DELETE_MISTAKES_BY_GAME_ID,
  INSERT_MISTAKE_POSITION,
  MARK_GAME_MISTAKES_PROCESSED,
  SELECT_UNPROCESSED_ANALYZED_GAMES_BY_USER_ID,
  SELECT_REPEATED_MISTAKES_BY_USER_ID,
} from './helpers/queries';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: () => '/mock/path',
  },
}));

// In-memory mock tables for better-sqlite3
const gamesTable: Map<string, any> = new Map();
const mistakePositionsTable: any[] = [];
const processedGamesTable: Set<string> = new Set();

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => {
    return {
      exec: jest.fn(),
      close: jest.fn(),
      transaction: (fn: any) => () => fn(),
      prepare: (sql: string) => {
        const trimmedSql = sql.trim();

        if (trimmedSql.includes('INSERT OR IGNORE INTO game')) {
          return {
            run: (params: any) => {
              if (!gamesTable.has(params.id)) {
                gamesTable.set(params.id, { ...params });
              }
            },
          };
        }

        if (trimmedSql.includes('UPDATE game SET analysis = @analysis')) {
          return {
            run: (params: any) => {
              const game = gamesTable.get(params.id);
              if (game) {
                game.analysis = params.analysis;
              }
            },
          };
        }

        if (trimmedSql.includes('WHERE id = @id')) {
          return {
            get: (params: any) => {
              return gamesTable.get(params.id);
            },
          };
        }

        if (trimmedSql.includes('DELETE FROM mistake_position WHERE game_id = @gameId')) {
          return {
            run: (params: any) => {
              const remaining = mistakePositionsTable.filter(
                (m) => m.game_id !== params.gameId,
              );
              mistakePositionsTable.length = 0;
              mistakePositionsTable.push(...remaining);
            },
          };
        }

        if (trimmedSql.includes('INSERT INTO mistake_position')) {
          return {
            run: (params: any) => {
              mistakePositionsTable.push({
                game_id: params.gameId,
                user_id: params.userId.toLowerCase(),
                side: params.side,
                fen: params.fen,
                move_index: params.moveIndex,
                moves: params.moves,
                best_move: params.bestMove,
              });
            },
          };
        }

        if (trimmedSql.includes('INSERT OR REPLACE INTO game_mistakes_processed')) {
          return {
            run: (params: any) => {
              processedGamesTable.add(params.gameId);
            },
          };
        }

        if (trimmedSql.includes('FROM game') && trimmedSql.includes('game_mistakes_processed')) {
          return {
            all: (params: any) => {
              const userId = (params.userId || '').toLowerCase();
              return Array.from(gamesTable.values()).filter((g) => {
                const whiteId = (g.white_user_id || g.white_user_name || '').toLowerCase();
                const blackId = (g.black_user_id || g.black_user_name || '').toLowerCase();
                const matchesUser = whiteId === userId || blackId === userId;
                return (
                  matchesUser &&
                  g.analysis != null &&
                  !processedGamesTable.has(g.id)
                );
              });
            },
          };
        }

        if (trimmedSql.includes('FROM mistake_position')) {
          return {
            all: (params: any) => {
              const userId = (params.userId || '').toLowerCase();
              const userMistakes = mistakePositionsTable.filter(
                (m) => m.user_id.toLowerCase() === userId,
              );

              // Group by fen
              const groups = new Map<string, any[]>();
              for (const m of userMistakes) {
                if (!groups.has(m.fen)) {
                  groups.set(m.fen, []);
                }
                groups.get(m.fen)!.push(m);
              }

              const results: any[] = [];
              for (const [fen, list] of groups.entries()) {
                if (list.length >= 2) {
                  results.push({
                    fen,
                    count: list.length,
                    side: list[0].side,
                    bestMove: list[0].best_move,
                    moves: list[0].moves,
                    gameId: list[0].game_id,
                  });
                }
              }

              return results.sort((a, b) => b.count - a.count);
            },
          };
        }

        return {
          run: jest.fn(),
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      },
    };
  });
});

import {
  insertGames,
  updateGameAnalysis,
  getRepeatedMistakes,
} from './databaseService';
import { Game } from '../../../interfaces';

describe('databaseService mistake positions & repeated mistakes', () => {
  beforeEach(() => {
    gamesTable.clear();
    mistakePositionsTable.length = 0;
    processedGamesTable.clear();
  });

  const createMockGame = (id: string, moves: string): Game => ({
    id,
    perf: 'blitz',
    speed: 'blitz',
    moves,
    source: 'lila',
    rated: true,
    status: 'mate',
    winner: 'white',
    variant: 'standard',
    createdAt: 1000,
    lastMoveAt: 2000,
    players: {
      white: {
        user: { id: 'testplayer', name: 'TestPlayer' },
        rating: 1500,
      },
      black: {
        user: { id: 'opponent', name: 'Opponent' },
        rating: 1500,
      },
    },
  });

  it('should store mistake positions and return repeated mistakes when games are analyzed', () => {
    const game1 = createMockGame('game-1', 'e4 e5 Nf3 Nc6');
    const game2 = createMockGame('game-2', 'e4 e5 Nf3 d6');

    insertGames([game1, game2]);

    expect(getRepeatedMistakes('testplayer')).toHaveLength(0);

    // Analyze game 1: player made a mistake on move 2 (fens[2]: after e4 e5)
    updateGameAnalysis('game-1', {
      advantage: [0, 0.3, 0.2, -1.2, -1.1],
      accuracy: { whitePlayerAverage: 70, blackPlayerAverage: 80 },
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3 Nc6', 'd4 exd4', 'c3 d5', 'Nf3'],
    });

    // 1 game analyzed, count is 1, so repeated mistakes should be empty
    expect(getRepeatedMistakes('testplayer')).toHaveLength(0);

    // Analyze game 2: player made the same mistake on move 2
    updateGameAnalysis('game-2', {
      advantage: [0, 0.3, 0.2, -1.2, -1.1],
      accuracy: { whitePlayerAverage: 70, blackPlayerAverage: 80 },
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3 d6', 'Bc4 h6', 'd4 exd4'],
    });

    // Now repeated mistakes should return the position with count 2
    const repeated = getRepeatedMistakes('testplayer');
    expect(repeated).toHaveLength(1);
    expect(repeated[0].count).toBe(2);
    expect(repeated[0].side).toBe('white');
    expect(repeated[0].moves).toEqual(['e4', 'e5']);
    expect(repeated[0].fen).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    );
  });

  it('should refresh repeated mistakes when more games are analyzed', () => {
    const game1 = createMockGame('game-1', 'e4 e5 Nf3 Nc6');
    const game2 = createMockGame('game-2', 'e4 e5 Nf3 d6');
    const game3 = createMockGame('game-3', 'e4 e5 Nf3 f5');

    insertGames([game1, game2, game3]);

    updateGameAnalysis('game-1', {
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3', 'd4', 'c3'],
    });

    updateGameAnalysis('game-2', {
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3', 'Bc4', 'd4'],
    });

    expect(getRepeatedMistakes('testplayer')[0].count).toBe(2);

    // Analyze game 3 with the same mistake position
    updateGameAnalysis('game-3', {
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3', 'd4'],
    });

    // Should refresh to 3
    const refreshed = getRepeatedMistakes('testplayer');
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].count).toBe(3);
  });

  it('should be case-insensitive for username', () => {
    const game1 = createMockGame('game-1', 'e4 e5 Nf3 Nc6');
    const game2 = createMockGame('game-2', 'e4 e5 Nf3 d6');
    insertGames([game1, game2]);

    updateGameAnalysis('game-1', {
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3', 'd4'],
    });
    updateGameAnalysis('game-2', {
      mistakes: { whitePlayer: [2], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      bestLines: ['Nf3', 'd4'],
    });

    expect(getRepeatedMistakes('testplayer')).toHaveLength(1);
    expect(getRepeatedMistakes('TestPlayer')).toHaveLength(1);
    expect(getRepeatedMistakes('TESTPLAYER')).toHaveLength(1);
  });
});
