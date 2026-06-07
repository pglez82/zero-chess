import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import PositionTrainer from './PositionTrainer';
import { generateGame } from '../../main/util';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function generateGameWithAnalysis(moves: string, bestLines: string[]) {
  const game = generateGame({ moves });
  const centipawns = Array(moves.split(' ').length + 1).fill(0);
  return {
    ...game,
    analysis: {
      advantage: centipawns.map((cp) => cp / 100),
      accuracy: { whitePlayerAverage: 80, blackPlayerAverage: 80 },
      mistakes: { whitePlayer: [], blackPlayer: [] },
      inaccuracies: { whitePlayer: [], blackPlayer: [] },
      blunders: { whitePlayer: [], blackPlayer: [] },
      scores: centipawns.map((cp) => ({ type: 'cp', value: cp })),
      bestLines,
    },
  };
}

describe('PositionTrainer component', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('should render the trainer header', () => {
    const games = [
      new (require('../../interfaces').GameDecorator)(
        generateGame({ moves: 'e4 e5 Nf3 Nc6' }),
      ),
    ];

    render(
      <MemoryRouter>
        <PositionTrainer games={games} username="testuser" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Entrenador de Posiciones/i)).toBeInTheDocument();
  });

  it('should show empty message when no repeated positions', () => {
    const games = [
      new (require('../../interfaces').GameDecorator)(
        generateGame({ moves: 'e4 e5 Nf3 Nc6' }),
      ),
    ];

    render(
      <MemoryRouter>
        <PositionTrainer games={games} username="testuser" />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/No se han encontrado posiciones repetidas/i),
    ).toBeInTheDocument();
  });

  it('should show a back button that navigates to statistics', () => {
    const games = [
      new (require('../../interfaces').GameDecorator)(
        generateGame({ moves: 'e4 e5 Nf3 Nc6' }),
      ),
    ];

    render(
      <MemoryRouter>
        <PositionTrainer games={games} username="testuser" />
      </MemoryRouter>,
    );

    const backButton = screen.getByText('Atrás');
    act(() => {
      fireEvent.click(backButton);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/statistics');
  });

  it('should render without crashing when there are positions', () => {
    const games = [
      new (require('../../interfaces').GameDecorator)(
        generateGame({ moves: 'e4 e5 Nf3 Nc6' }),
      ),
    ];

    // Should not throw
    expect(() =>
      render(
        <MemoryRouter>
          <PositionTrainer games={games} username="testuser" />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});
