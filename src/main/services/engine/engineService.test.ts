const {
  calculateAccuracyFromCentipawns,
  calculateAdvantageFromCentipawns,
  calculateErrors,
  calculateMoveErrorMagnitude,
} = jest.requireActual('./engineService');

describe('Chess Game Analysis Functions', () => {
  describe('calculateAccuracyFromCentipawns', () => {
    it('should calculate accuracy averages correctly for winning game', () => {
      // Positive centipawns means white is winning
      // White was winning and maintained advantage = high accuracy
      // Black has no moves evaluated in this short array, defaults to 100
      const centipawns = [1000, 500];

      const result = calculateAccuracyFromCentipawns(centipawns);
      expect(result.whitePlayerAverage).toBeCloseTo(100, 0);
      expect(result.blackPlayerAverage).toBeCloseTo(100, 0);
    });

    it('should calculate accuracy averages correctly for losing game', () => {
      // Negative centipawns means black is winning
      // Black was winning and maintained advantage = high accuracy
      // White was losing and had no moves = 0 accuracy
      const centipawns = [-1000, -500];

      const result = calculateAccuracyFromCentipawns(centipawns);
      expect(result.whitePlayerAverage).toBeCloseTo(0, 0);
      expect(result.blackPlayerAverage).toBeCloseTo(100, 0);
    });
  });

  describe('calculateAdvantageFromCentipawns', () => {
    it('should calculate advantage correctly', () => {
      const centipawns = [150, -150, '#0'];

      const result = calculateAdvantageFromCentipawns(centipawns);
      expect(result).toEqual([1.5, -1.5, '#0']);
    });
  });

  describe('calculateErrors', () => {
    it('should calculate inaccuracies correctly', () => {
      const advantage = [0.7, 0, -0.7, 0, -0.4, 0, -1, 0];

      const result = calculateErrors(advantage, 0.5, 1);
      expect(result).toEqual({
        whitePlayer: [2],
        blackPlayer: [3],
      });
    });

    it('should calculate mistakes correctly', () => {
      const advantage = [1.2, 0, -1.2, 0, -0.9, 0, -1.5, 0];

      const result = calculateErrors(advantage, 1, 1.5);
      expect(result).toEqual({
        whitePlayer: [2],
        blackPlayer: [3],
      });
    });

    it('should calculate blunders correctly', () => {
      const advantage = [1.7, 0, -1.7, 0, -1.4, 0];

      const result = calculateErrors(advantage, 1.5, Infinity);
      expect(result).toEqual({
        whitePlayer: [2],
        blackPlayer: [3],
      });
    });
  });

  describe('calculateMoveErrorMagnitude', () => {
    it('should calculate white move error magnitude correctly', () => {
      // Moves: 0: e4, 1: e5, 2: Nf3 (White blunder)
      // Advantage after moves: 0.2, 0.2, -1.8
      const advantage = [0.2, 0.2, -1.8];
      const magnitude = calculateMoveErrorMagnitude(advantage, 2, 'white', 3);
      // parsed: [0, 0.2, 0.2, -1.8], index 2 is 0.2, index 3 is -1.8 -> diff = 0.2 - (-1.8) = 2.0
      expect(magnitude).toBe(2);
    });

    it('should calculate black move error magnitude correctly', () => {
      // Moves: 0: e4, 1: e5 (Black blunder)
      // Advantage after moves: 0.2, 2.5
      const advantage = [0.2, 2.5];
      const magnitude = calculateMoveErrorMagnitude(advantage, 1, 'black', 2);
      // parsed: [0, 0.2, 2.5], index 1 is 0.2, index 2 is 2.5 -> diff for black = 2.5 - 0.2 = 2.3
      expect(magnitude).toBe(2.3);
    });

    it('should return 0 when advantage improved', () => {
      const advantage = [0.2, 1.5];
      const magnitude = calculateMoveErrorMagnitude(advantage, 0, 'white', 2);
      expect(magnitude).toBe(0);
    });

    it('should handle undefined or empty advantage', () => {
      expect(calculateMoveErrorMagnitude(undefined, 0)).toBe(0);
      expect(calculateMoveErrorMagnitude([], 0)).toBe(0);
    });
  });
});

