import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdvantageChart from './AdvantageChart';
import { LineChart, ChartsReferenceLine } from '@mui/x-charts';

jest.mock('@mui/x-charts', () => {
  return {
    LineChart: jest.fn(({ children, onAxisClick, series, xAxis }) => (
      <div
        data-testid="mock-line-chart"
        onClick={(e: any) => onAxisClick && onAxisClick(e, { dataIndex: 2 })}
      >
        <span data-testid="series-data">
          {JSON.stringify(series[0]?.data)}
        </span>
        {children}
      </div>
    )),
    ChartsReferenceLine: jest.fn((props) => (
      <div data-testid="mock-reference-line" data-x={props.x} />
    )),
  };
});

describe('AdvantageChart component', () => {
  const advantage = [0.4, -0.3, 0.6, -0.1];
  const moves = ['e4', 'e5', 'Nf3', 'Nc6'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title and chart when data is present', () => {
    render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={0}
      />,
    );

    expect(
      screen.getByText(/Gráfico de ventaja \(\+ Blancas \/ - Negras\)/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument();
  });

  it('displays empty message when advantage data is empty', () => {
    render(<AdvantageChart advantage={[]} />);

    expect(screen.getByText('Sin datos de análisis')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-line-chart')).not.toBeInTheDocument();
  });

  it('displays correct move notation and advantage in header when navigating', () => {
    const { rerender } = render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={0}
      />,
    );

    // Move 0 is White: 1. e4 (+0.4)
    expect(screen.getByText('1. e4 (+0.4)')).toBeInTheDocument();

    // Advance to Move 1 (Black): 1... e5 (-0.3)
    rerender(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={1}
      />,
    );
    expect(screen.getByText('1... e5 (-0.3)')).toBeInTheDocument();

    // Advance to Move 2 (White): 2. Nf3 (+0.6)
    rerender(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={2}
      />,
    );
    expect(screen.getByText('2. Nf3 (+0.6)')).toBeInTheDocument();

    // Advance to Move 3 (Black): 2... Nc6 (-0.1)
    rerender(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={3}
      />,
    );
    expect(screen.getByText('2... Nc6 (-0.1)')).toBeInTheDocument();
  });

  it('renders the reference line at the current move index', () => {
    const { rerender } = render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={1}
      />,
    );

    const refLine = screen.getByTestId('mock-reference-line');
    expect(refLine).toHaveAttribute('data-x', '1');

    // Update currentIndex to 3
    rerender(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={3}
      />,
    );

    expect(screen.getByTestId('mock-reference-line')).toHaveAttribute(
      'data-x',
      '3',
    );
  });

  it('clamps the reference line to the last move when currentIndex is beyond moves', () => {
    render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={10}
      />,
    );

    expect(screen.getByTestId('mock-reference-line')).toHaveAttribute(
      'data-x',
      '3',
    );
  });

  it('calls onMoveClick when a point on the chart is clicked', () => {
    const onMoveClickMock = jest.fn();

    render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={0}
        onMoveClick={onMoveClickMock}
      />,
    );

    const chart = screen.getByTestId('mock-line-chart');
    fireEvent.click(chart);

    expect(onMoveClickMock).toHaveBeenCalledWith(2);
  });

  it('handles click via container fallback if axis click does not handle it', () => {
    const onMoveClickMock = jest.fn();

    render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={0}
        onMoveClick={onMoveClickMock}
      />,
    );

    const container = screen.getByTestId('advantage-chart-container');

    // Mock getBoundingClientRect
    jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 490,
      bottom: 220,
      width: 490,
      height: 220,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Click at x=10 (first move)
    fireEvent.click(container, { clientX: 10 });
    expect(onMoveClickMock).toHaveBeenCalledWith(0);

    // Click at x=480 (last move)
    fireEvent.click(container, { clientX: 480 });
    expect(onMoveClickMock).toHaveBeenCalledWith(3);
  });

  it('sets showMark only for the current move index', () => {
    render(
      <AdvantageChart
        advantage={advantage}
        moves={moves}
        currentIndex={2}
      />,
    );

    expect(LineChart).toHaveBeenCalled();
    const calls = (LineChart as unknown as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const showMarkFn = lastCall.series[0].showMark;

    expect(showMarkFn({ index: 0 })).toBe(false);
    expect(showMarkFn({ index: 1 })).toBe(false);
    expect(showMarkFn({ index: 2 })).toBe(true);
    expect(showMarkFn({ index: 3 })).toBe(false);
  });
});
