jest.mock('@mui/x-charts', () => ({
  SparkLineChart: jest.fn(() => null),
  LineChart: jest.fn(() => null),
  ChartsReferenceLine: jest.fn(() => null),
  BarChart: jest.fn(() => null),
  PieChart: jest.fn(() => null),
}));

const useNavigateMock = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => useNavigateMock,
}));

jest.mock('main/services/engine/helpers/engine', () => ({
  createEnginePool: jest.fn(),
  getGameCentipawnsOnEngine: jest.fn(),
}));

jest.mock('main/services/engine/engineService', () => {
  const actual = jest.requireActual('./main/services/engine/engineService');
  return {
    ...actual,
    parseAdvantage: jest.fn(actual.parseAdvantage),
    calculateAccuracyFromCentipawns: jest.fn(actual.calculateAccuracyFromCentipawns),
    calculateAdvantageFromCentipawns: jest.fn(actual.calculateAdvantageFromCentipawns),
    calculateErrors: jest.fn(actual.calculateErrors),
    calculateMoveErrorMagnitude: jest.fn(actual.calculateMoveErrorMagnitude),
  };
});

export default useNavigateMock;
