import {
  extractMistakePositionsForGame,
  getBestMoveFromBestLines,
} from './mistakes';

describe('mistakes helper', () => {
  describe('getBestMoveFromBestLines', () => {
    it('should return the first move of the best line from position before moveIndex', () => {
      const bestLines = ['e7e5 g1f3', 'g1f3 d7d6'];
      const gameMoves = ['e4', 'e5', 'Nf3'];

      // For moveIndex 1 (error on move 1, which was played from fens[1])
      // best line is bestLines[0]
      const bestMove = getBestMoveFromBestLines(bestLines, 1, gameMoves);
      expect(bestMove).toBe('e7e5');
    });

    it('should return fallback played move when moveIndex is 0', () => {
      const bestLines = ['e7e5'];
      const gameMoves = ['e4', 'e5'];

      const bestMove = getBestMoveFromBestLines(bestLines, 0, gameMoves);
      expect(bestMove).toBe('e4');
    });

    it('should return null when no moves available', () => {
      const bestMove = getBestMoveFromBestLines([], 5, []);
      expect(bestMove).toBeNull();
    });
  });

  describe('extractMistakePositionsForGame', () => {
    it('should extract mistake positions for white and black correctly', () => {
      const game = {
        id: 'game1',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5',
        white_user_id: 'playerWhite',
        black_user_id: 'playerBlack',
        analysis: {
          mistakes: {
            whitePlayer: [0], // Error on move 0 (e4)
            blackPlayer: [1], // Error on move 1 (e5)
          },
          blunders: {
            whitePlayer: [],
            blackPlayer: [],
          },
          bestLines: ['e7e5', 'Nf3'],
        },
      };

      const results = extractMistakePositionsForGame(game);
      expect(results).toHaveLength(2);

      const whiteMistake = results.find((r) => r.side === 'white');
      expect(whiteMistake).toBeDefined();
      expect(whiteMistake?.userId).toBe('playerwhite');
      expect(whiteMistake?.moveIndex).toBe(0);
      expect(whiteMistake?.fen).toBe(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      );
      expect(whiteMistake?.errorMagnitude).toBe(1.0);
      expect(JSON.parse(whiteMistake!.moves)).toEqual([]);

      const blackMistake = results.find((r) => r.side === 'black');
      expect(blackMistake).toBeDefined();
      expect(blackMistake?.userId).toBe('playerblack');
      expect(blackMistake?.moveIndex).toBe(1);
      expect(blackMistake?.errorMagnitude).toBe(1.0);
      expect(blackMistake?.fen).toBe(
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      );
      expect(JSON.parse(blackMistake!.moves)).toEqual(['e4']);
      expect(blackMistake?.bestMove).toBe('e7e5');
    });

    it('should handle JSON string analysis and empty mistakes', () => {
      const game = {
        id: 'game2',
        moves: 'e4 e5',
        white_user_id: 'playerWhite',
        black_user_id: 'playerBlack',
        analysis: JSON.stringify({
          mistakes: { whitePlayer: [], blackPlayer: [] },
          blunders: { whitePlayer: [], blackPlayer: [] },
        }),
      };

      const results = extractMistakePositionsForGame(game);
      expect(results).toHaveLength(0);
    });

    it('should return empty array if no analysis is present', () => {
      const game = {
        id: 'game3',
        moves: 'e4 e5',
        white_user_id: 'playerWhite',
        black_user_id: 'playerBlack',
      };

      const results = extractMistakePositionsForGame(game);
      expect(results).toHaveLength(0);
    });
  });
});

