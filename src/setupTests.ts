jest.mock('@mui/x-charts', () => ({
  SparkLineChart: jest.fn(),
  BarChart: jest.fn(),
  PieChart: jest.fn(),
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

jest.mock('main/services/engine/engineService', () => ({
  parseAdvantage: jest.fn(),
  calculateAccuracyFromCentipawns: jest.fn(),
  calculateAdvantageFromCentipawns: jest.fn(),
  calculateErrors: jest.fn(),
}));

export default useNavigateMock;
