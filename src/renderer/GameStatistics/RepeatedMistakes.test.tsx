import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RepeatedMistakes, {
  computeRepeatedPositionsFromGames,
} from './RepeatedMistakes';
import { GameDecorator } from '../../interfaces';
import { generateGame } from '../../main/util';
import useNavigateMock from '../../setupTests';

describe('RepeatedMistakes Component', () => {
  beforeEach(() => {
    useNavigateMock.mockReset();
    // Ensure window.electron is undefined so it uses in-memory or props directly
    delete (window as any).electron;
  });

  const createGameWithMistake = (
    id: string,
    moves: string[],
    playerSide: 'white' | 'black',
    errorIndex: number,
    advantage: number[],
  ): GameDecorator => {
    return new GameDecorator(
      generateGame({
        id,
        moves: moves.join(' '),
        players: {
          white: { user: { name: playerSide === 'white' ? 'testuser' : 'other', id: playerSide === 'white' ? 'testuser' : 'other' } },
          black: { user: { name: playerSide === 'black' ? 'testuser' : 'other', id: playerSide === 'black' ? 'testuser' : 'other' } },
        },
        analysis: {
          advantage,
          accuracy: { whitePlayerAverage: 75, blackPlayerAverage: 75 },
          mistakes: {
            whitePlayer: playerSide === 'white' ? [errorIndex] : [],
            blackPlayer: playerSide === 'black' ? [errorIndex] : [],
          },
          blunders: { whitePlayer: [], blackPlayer: [] },
          bestLines: [],
        },
      }),
    );
  };

  it('computes repeated positions with errorMagnitude from games', () => {
    // 2 games reaching same FEN after e4 e5, white makes mistake on move 2 (Nf3)
    // Game 1: loss = 0.2 - (-1.2) = 1.4
    const game1 = createGameWithMistake(
      'g1',
      ['e4', 'e5', 'Nf3', 'Nc6'],
      'white',
      2,
      [0.2, 0.2, -1.2, -1.1],
    );
    // Game 2: loss = 0.2 - (-2.0) = 2.2
    const game2 = createGameWithMistake(
      'g2',
      ['e4', 'e5', 'Nf3', 'd6'],
      'white',
      2,
      [0.2, 0.2, -2.0, -1.8],
    );

    const positions = computeRepeatedPositionsFromGames([game1, game2], 'testuser');
    expect(positions).toHaveLength(1);
    expect(positions[0].count).toBe(2);
    // Average of 1.4 and 2.2 = 1.8
    expect(positions[0].errorMagnitude).toBe(1.8);
  });

  it('displays message when no repeated errors are found', () => {
    render(<RepeatedMistakes games={[]} username="testuser" />);
    expect(screen.getByText('No se han encontrado errores repetidos.')).toBeInTheDocument();
  });

  it('displays repeated positions with repeat counts and error magnitude in the list', () => {
    // Pos A: repeated 3 times, smaller magnitude 1.2
    // Pos B: repeated 2 times, larger magnitude 2.8
    // Create games to generate these positions
    const games = [
      // Pos A (after e4 e5): 3 times
      createGameWithMistake('g1', ['e4', 'e5', 'Nf3', 'Nc6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g2', ['e4', 'e5', 'Nf3', 'd6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g3', ['e4', 'e5', 'Nf3', 'f5'], 'white', 2, [0, 0, -1.2, 0]),
      // Pos B (after d4 d5): 2 times with bigger blunder (magnitude 2.8)
      createGameWithMistake('g4', ['d4', 'd5', 'c4', 'e6'], 'white', 2, [0, 0, -2.8, 0]),
      createGameWithMistake('g5', ['d4', 'd5', 'c4', 'c6'], 'white', 2, [0, 0, -2.8, 0]),
    ];

    render(<RepeatedMistakes games={games} username="testuser" />);

    // Check header and chip
    expect(screen.getByText('Posiciones con errores repetidos')).toBeInTheDocument();
    expect(screen.getByText('2 detectadas')).toBeInTheDocument();

    // Both repeat count and magnitude chips should be displayed
    expect(screen.getByText('Repetido 3 veces')).toBeInTheDocument();
    expect(screen.getByText('Repetido 2 veces')).toBeInTheDocument();
    expect(screen.getByText('Magnitud: 1.2')).toBeInTheDocument();
    expect(screen.getByText('Magnitud: 2.8')).toBeInTheDocument();
  });

  it('sorts by repeats by default (descending) and allows switching to sort by magnitude', async () => {
    const games = [
      // Pos A (after e4 e5): 3 times, magnitude 1.2
      createGameWithMistake('g1', ['e4', 'e5', 'Nf3', 'Nc6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g2', ['e4', 'e5', 'Nf3', 'd6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g3', ['e4', 'e5', 'Nf3', 'f5'], 'white', 2, [0, 0, -1.2, 0]),
      // Pos B (after d4 d5): 2 times, magnitude 2.8
      createGameWithMistake('g4', ['d4', 'd5', 'c4', 'e6'], 'white', 2, [0, 0, -2.8, 0]),
      createGameWithMistake('g5', ['d4', 'd5', 'c4', 'c6'], 'white', 2, [0, 0, -2.8, 0]),
    ];

    render(<RepeatedMistakes games={games} username="testuser" />);

    // Default sort is repeats: Pos A (3 repeats) should appear before Pos B (2 repeats)
    const repeatChipsBefore = screen.getAllByText(/Repetido \d veces/);
    expect(repeatChipsBefore[0]).toHaveTextContent('Repetido 3 veces');
    expect(repeatChipsBefore[1]).toHaveTextContent('Repetido 2 veces');

    // Toggle sort by magnitude
    const magnitudeButton = screen.getByRole('button', { name: /magnitud del error/i });
    await act(async () => {
      fireEvent.click(magnitudeButton);
    });

    // Now sorted by magnitude: Pos B (magnitude 2.8) should appear before Pos A (magnitude 1.2)
    const repeatChipsAfter = screen.getAllByText(/Repetido \d veces/);
    expect(repeatChipsAfter[0]).toHaveTextContent('Repetido 2 veces');
    expect(repeatChipsAfter[1]).toHaveTextContent('Repetido 3 veces');

    const magnitudeChips = screen.getAllByText(/Magnitud: \d\.\d/);
    expect(magnitudeChips[0]).toHaveTextContent('Magnitud: 2.8');
    expect(magnitudeChips[1]).toHaveTextContent('Magnitud: 1.2');

    // Switch back to repeats
    const repeatsButton = screen.getByRole('button', { name: /repeticiones/i });
    await act(async () => {
      fireEvent.click(repeatsButton);
    });

    const repeatChipsRestored = screen.getAllByText(/Repetido \d veces/);
    expect(repeatChipsRestored[0]).toHaveTextContent('Repetido 3 veces');
    expect(repeatChipsRestored[1]).toHaveTextContent('Repetido 2 veces');
  });

  it('allows toggling sort order between descending and ascending', async () => {
    const games = [
      createGameWithMistake('g1', ['e4', 'e5', 'Nf3', 'Nc6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g2', ['e4', 'e5', 'Nf3', 'd6'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g3', ['e4', 'e5', 'Nf3', 'f5'], 'white', 2, [0, 0, -1.2, 0]),
      createGameWithMistake('g4', ['d4', 'd5', 'c4', 'e6'], 'white', 2, [0, 0, -2.8, 0]),
      createGameWithMistake('g5', ['d4', 'd5', 'c4', 'c6'], 'white', 2, [0, 0, -2.8, 0]),
    ];

    render(<RepeatedMistakes games={games} username="testuser" />);

    const orderButton = screen.getByRole('button', { name: /cambiar dirección de ordenamiento/i });

    // Toggle to ascending (fewer repeats first: 2 repeats before 3 repeats)
    await act(async () => {
      fireEvent.click(orderButton);
    });

    const repeatChipsAsc = screen.getAllByText(/Repetido \d veces/);
    expect(repeatChipsAsc[0]).toHaveTextContent('Repetido 2 veces');
    expect(repeatChipsAsc[1]).toHaveTextContent('Repetido 3 veces');

    // Toggle back to descending (3 repeats before 2 repeats)
    await act(async () => {
      fireEvent.click(orderButton);
    });

    const repeatChipsDesc = screen.getAllByText(/Repetido \d veces/);
    expect(repeatChipsDesc[0]).toHaveTextContent('Repetido 3 veces');
    expect(repeatChipsDesc[1]).toHaveTextContent('Repetido 2 veces');
  });

  it('loads repeated mistakes from IPC if available', async () => {
    (window as any).electron = {
      ipcRenderer: {
        getRepeatedMistakes: jest.fn().mockResolvedValue([
          {
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
            count: 4,
            errorMagnitude: 2.1,
            moves: ['e4', 'e5'],
            bestMove: 'Nf3',
            side: 'white',
            gameId: 'g1',
          },
        ]),
      },
    };

    await act(async () => {
      render(<RepeatedMistakes games={[]} username="testuser" />);
    });

    expect(screen.getByText('Repetido 4 veces')).toBeInTheDocument();
    expect(screen.getByText('Magnitud: 2.1')).toBeInTheDocument();
  });
});

