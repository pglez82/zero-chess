import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Chess } from 'chess.js';
import MoveTable from './MoveTable';
import { formatBestLine, GameDecorator } from '../../interfaces';

const moves = ['e4', 'e5', 'Nf3', 'Nc6'];
const advantage = [1, -1, 2, -2];
const currentIndex = 1;

const scrollIntoViewMock = jest.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

describe('MoveTable component', () => {
  it('should render the correct number of rows', () => {
    render(
      <MoveTable
        moves={moves}
        advantage={advantage}
        currentIndex={currentIndex}
      />,
    );

    const rows = screen.getAllByRole('row');

    expect(rows).toHaveLength(moves.length / 2);
  });

  it('should render the correct moves and advantages', () => {
    render(
      <MoveTable
        moves={moves}
        advantage={advantage}
        currentIndex={currentIndex}
      />,
    );

    expect(screen.getByText(moves[0])).toBeInTheDocument();
    expect(screen.getByText('+1.0')).toBeInTheDocument();
    expect(screen.getByText(moves[1])).toBeInTheDocument();
    expect(screen.getByText('-1.0')).toBeInTheDocument();
    expect(screen.getByText(moves[2])).toBeInTheDocument();
    expect(screen.getByText('+2.0')).toBeInTheDocument();
    expect(screen.getByText(moves[3])).toBeInTheDocument();
    expect(screen.getByText('-2.0')).toBeInTheDocument();
  });

  it('should apply correct styles to the current index cell', () => {
    render(
      <MoveTable
        moves={moves}
        advantage={advantage}
        currentIndex={currentIndex}
      />,
    );

    const currentCell = screen.getAllByRole('cell')[currentIndex];

    expect(currentCell).toHaveStyle({
      color: 'rgba(0, 0, 0, 0.87)',
    });
  });
});

describe('formatBestLine and parseBestLine algebraic notation', () => {
  it('should format line when Black is to move with 1... notation', () => {
    // Position after 1. e4
    const chess = new Chess();
    chess.move('e4');
    const fen = chess.fen();

    const uciLine = 'e7e5 g1f3 b8c6 f1b5 a7a6';
    const formatted = formatBestLine(uciLine, fen);

    expect(formatted).toBe('1... e5 2. Nf3 Nc6 3. Bb5 a6');
  });

  it('should format line when White is to move with 2. notation', () => {
    // Position after 1. e4 e5
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    const fen = chess.fen();

    const uciLine = 'g1f3 b8c6 f1b5 a7a6';
    const formatted = formatBestLine(uciLine, fen);

    expect(formatted).toBe('2. Nf3 Nc6 3. Bb5 a6');
  });

  it('should format line when Black is to move on move 2 with 2... notation', () => {
    // Position after 1. e4 e5 2. Nf3
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    const fen = chess.fen();

    const uciLine = 'b8c6 f1b5 a7a6';
    const formatted = formatBestLine(uciLine, fen);

    expect(formatted).toBe('2... Nc6 3. Bb5 a6');
  });

  it('should correctly format piece captures and pawn promotions', () => {
    // Position with capture and promotion
    const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/3P4/5N2/PPP1BPPP/RNBQK2R b KQkq - 0 5';
    const uciLine = 'e5d4 f3d4';
    const formatted = formatBestLine(uciLine, fen);

    expect(formatted).toBe('5... exd4 6. Nxd4');
  });

  it('should recover legacy inverted moves and output correct algebraic notation', () => {
    // Position after 1. e4 (Black to move). Old buggy invertPv turned e7e5 into e2e4!
    const chess = new Chess();
    chess.move('e4');
    const fen = chess.fen();

    const legacyInvertedLine = 'e2e4 g8f6 b1c3';
    const formatted = formatBestLine(legacyInvertedLine, fen);

    expect(formatted).toBe('1... e5 2. Nf3 Nc6');
  });

  it('should format best line via GameDecorator.parseBestLine using move index', () => {
    const game = new GameDecorator({
      id: 'test-game',
      moves: 'e4 e5 Nf3 Nc6',
      perf: 'blitz',
      speed: 'blitz',
      source: 'lichess',
      rated: false,
      status: 'mate',
      winner: 'white',
      variant: 'standard',
      createdAt: 1000,
      lastMoveAt: 2000,
      players: {
        white: { user: { id: 'w', name: 'WhitePlayer' } },
        black: { user: { id: 'b', name: 'BlackPlayer' } },
      },
    });

    // Move index 0 is after 1. e4 (Black to move on move 1)
    const line0 = game.parseBestLine('e7e5 g1f3 b8c6', 0);
    expect(line0).toBe('1... e5 2. Nf3 Nc6');

    // Move index 1 is after 1... e5 (White to move on move 2)
    const line1 = game.parseBestLine('g1f3 b8c6 f1b5', 1);
    expect(line1).toBe('2. Nf3 Nc6 3. Bb5');

    // Move index 2 is after 2. Nf3 (Black to move on move 2)
    const line2 = game.parseBestLine('b8c6 f1b5 a7a6', 2);
    expect(line2).toBe('2... Nc6 3. Bb5 a6');
  });

  it('should handle empty or whitespace lines gracefully', () => {
    expect(formatBestLine('', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('');
    expect(formatBestLine('   ')).toBe('');
  });

  it('should provide fallback when no FEN position is given', () => {
    const formatted = formatBestLine('e4 e5 Nf3 Nc6', 1);
    expect(formatted).toBe('1. e4 e5 2. Nf3 Nc6');
  });
});
