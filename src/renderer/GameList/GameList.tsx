/* eslint-disable no-await-in-loop */
import {
  calculateAccuracyFromCentipawns,
  calculateAdvantageFromCentipawns,
  calculateErrors,
} from '../../main/services/engine/engineService';
import {
  createEnginePool,
  getGameCentipawnsOnEngine,
} from '../../main/services/engine/helpers/engine';
import {
  Paper,
  List,
  Button,
  Stack,
  Pagination,
  Box,
  TextField,
  IconButton,
  Chip,
  Tooltip,
  InputAdornment,
  Typography,
} from '@mui/material';
import LinearProgressWithLabel from '../Home/LinearProgressWithLabel';
import { ChangeEvent, useState, useEffect, useRef } from 'react';
import {
  Troubleshoot,
  SportsEsports,
  Search,
  SelectAll,
  Shuffle,
  PlayArrow,
  ArrowBack,
  Person,
  Clear,
} from '@mui/icons-material';
import { GameDecorator } from '../../interfaces';
import { useNavigate } from 'react-router-dom';
import GameTile from './GameTile';
import './GameList.css';

const GAMES_PER_PAGE = 10;

// Analyze a single game using a specific engine worker and return all analysis data
async function analyzeGameWithWorker(
  engine: any,
  game: GameDecorator,
): Promise<{ 
  centipawns: (number | string)[]; 
  scores: Array<{ type: 'cp'; value: number } | { type: 'mate'; value: number }>;
  bestLines: string[];
  accuracy: { whitePlayerAverage: number; blackPlayerAverage: number };
  advantage: (string | number)[];
  moves: string[];
}> {
  const moves = game.getGameMoves();
  
  // Get centipawns, scores, and best lines for each move using the specific engine worker
  const { centipawns, scores, bestLines } = await getGameCentipawnsOnEngine(engine, moves);
  
  // Calculate accuracy and advantage from centipawns
  const accuracy = calculateAccuracyFromCentipawns(centipawns);
  const advantage = calculateAdvantageFromCentipawns(centipawns);
  
  return { centipawns, scores, bestLines, accuracy, advantage, moves };
}

export default function GameList({
  games,
  username,
  onUsernameUpdate,
}: {
  username: string;
  games: GameDecorator[];
  onUsernameUpdate: (username: string) => void;
}) {
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [randomCount, setRandomCount] = useState(300);
  const [searchTerm, setSearchTerm] = useState('');
  const [gamesCount, setGamesCount] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const savedSearchTerm = localStorage.getItem('searchTerm');
    const savedPage = localStorage.getItem('currentPage');
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
    if (savedPage) {
      setCurrentPage(parseInt(savedPage, 10));
    }
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      const total = await window.electron.ipcRenderer.getPlayerGamesCount(username);
      const analyzed = await window.electron.ipcRenderer.getAnalyzedGamesCount(username);
      setGamesCount(total);
      setAnalyzedCount(analyzed);
    };

    fetchCounts();
  }, [username]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchTerm, currentPage]);

  const handleToggleAll = () => {
    if (allChecked) {
      setChecked([]);
    } else {
      const allIndexes = games
        .map((_, index) => index)
        .filter((index) => !games[index].getGame().analysis);
      setChecked(allIndexes);
    }

    setAllChecked(!allChecked);
  };

  const handleRandomSelect = () => {
    const unanalyzedIndexes = games
      .map((_, index) => index)
      .filter((index) => !games[index].getGame().analysis);

    const shuffled = [...unanalyzedIndexes].sort(() => Math.random() - 0.5);
    const selectedRandomly = shuffled.slice(0, randomCount);

    setChecked(selectedRandomly);
    setAllChecked(false);
  };

  const handleToggle = (value: number) => {
    if (!games[value].getGame().analysis) {
      const currentIndex = checked.indexOf(value);
      const newChecked = [...checked];

      if (currentIndex === -1) {
        newChecked.push(value);
      } else {
        newChecked.splice(currentIndex, 1);
      }

      setChecked(newChecked);
    }
  };

  const handleSearchTermChange = (newValue: string) => {
    setSearchTerm(newValue);
    setCurrentPage(1);
    localStorage.setItem('searchTerm', newValue);
    localStorage.setItem('currentPage', '1');
  };

  const filteredGames = games.filter((game) => {
    const opponentSide = game.getOpponentSide(username);
    const opponentName = game.parsePlayerName(opponentSide);

    return opponentName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
  const endIndex = Math.min(startIndex + GAMES_PER_PAGE, filteredGames.length);

  const currentGames = filteredGames.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredGames.length / GAMES_PER_PAGE);

  const handlePageChange = (_event: ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page.toString());
  };

  function updateEstimatedTime(
    totalGames: number,
    totalTime: number,
    completedGames: number,
  ) {
    const averageTimePerGame = totalTime / (completedGames || 1);
    const remainingGames = totalGames - completedGames;
    const estimatedTotalTime = (averageTimePerGame * remainingGames) / 1000;

    if (remainingGames <= 0) {
      setEstimatedTime(null);
      return;
    }

    const minutes = Math.floor(estimatedTotalTime / 60);
    const seconds = Math.floor(estimatedTotalTime % 60);
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(
      seconds,
    ).padStart(2, '0')}`;

    setEstimatedTime(formattedTime);
  }

  async function analyseGames(gamesToAnalyse: GameDecorator[]) {
    const totalGames = gamesToAnalyse.length;
    
    // Get the stockfish path for engine pool initialization
    const stockfishPath =
      process.env.NODE_ENV === 'development'
        ? '/services/engine/helpers/stockfish/stockfish.js'
        : await window.electron.ipcRenderer.joinPath(
            'services/engine/helpers/stockfish/stockfish.js',
          );
    
    // Create a pool of engine instances (one per CPU core)
    const engines = await createEnginePool(stockfishPath);

    let totalTime = 0;
    let completedGames = 0;

    // Create a work queue with game indices
    const workQueue = [...Array(totalGames).keys()];

    // Create worker tasks
    const workerPromises = engines.map((engine) => async () => {
      while (workQueue.length > 0) {
        const gameIndex = workQueue.shift();
        if (gameIndex === undefined) break;

        const game = gamesToAnalyse[gameIndex];
        const startTime = performance.now();

        try {
          // Analyze game using this specific engine worker
          const { scores, bestLines, accuracy, advantage } = await analyzeGameWithWorker(
            engine,
            game,
          );

          // Calculate errors from advantage
          const mistakes = calculateErrors(advantage, 1, 1.5);
          const inaccuracies = calculateErrors(advantage, 0.5, 1);
          const blunders = calculateErrors(advantage, 1.5, Infinity);

          const analysis = { advantage, accuracy, mistakes, inaccuracies, blunders, scores, bestLines };

          // Store analysis on the game object
          game.setAnalysis(analysis);
          
          // Update database
          await window.electron.ipcRenderer.updateGameAnalysis(
            game.getGame().id,
            analysis,
          );

          const endTime = performance.now();
          const gameTime = endTime - startTime;
          totalTime += gameTime;
          completedGames += 1;
          
          // Update progress
          setProgress((completedGames / totalGames) * 100);
          updateEstimatedTime(totalGames, totalTime, completedGames);
        } catch (error) {
          console.error(`Error analyzing game ${game.getGame().id}:`, error);
          completedGames += 1;
        }
      }
    });

    // Run all workers in parallel
    await Promise.all(workerPromises.map((promiseFn) => promiseFn()));

    // Clean up: quit all engine workers
    engines.forEach((engine) => {
      try {
        engine.quit();
      } catch (_e) {
        // Ignore errors during cleanup
      }
    });
    
    setChecked([]);
  }

  const handleSubmit = async () => {
    const gamesToAnalyse = games.filter((_game, index) =>
      checked.includes(index),
    );

    if (gamesToAnalyse.length > 0) {
      setLoading(true);

      await analyseGames(gamesToAnalyse);
      setLoading(false);

      setEstimatedTime(null);
      setProgress(0);

      // Refetch counts after analysis
      const total = await window.electron.ipcRenderer.getPlayerGamesCount(username);
      const analyzed = await window.electron.ipcRenderer.getAnalyzedGamesCount(username);
      setGamesCount(total);
      setAnalyzedCount(analyzed);
    }
  };

  const handleBack = () => {
    onUsernameUpdate('');
    localStorage.setItem('searchTerm', '');
    localStorage.setItem('currentPage', '1');

    navigate('/');
  };

  const handleStatistics = () => {
    navigate('/statistics');
  };

  const handleTrainer = () => {
    navigate('/trainer');
  };

  return (
    <Box>
      {loading ? (
        <Paper className="download-card" sx={{ width: '28vw', minWidth: '320px', p: 4 }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Analizando...
              {estimatedTime ? ` (Quedan ${estimatedTime})` : ''}
            </Typography>
            <p style={{ display: 'none' }}>
              Analizando...
              {estimatedTime ? ` (Quedan ${estimatedTime})` : ''}
            </p>
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgressWithLabel progress={progress} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Calculando precisión, jugadas óptimas y errores con Stockfish
            </Typography>
          </Stack>
        </Paper>
      ) : (
        <Paper className="game-list-paper">
          <Stack spacing={3}>
            {/* Header section with User Profile, Stats & Navigation Actions */}
            <div className="game-list-header">
              <div className="game-list-title">
                <Person sx={{ color: 'primary.main', fontSize: 28 }} />
                <span>Partidas de {username || 'Usuario'}</span>
                {gamesCount > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${analyzedCount} / ${gamesCount} analizadas`}
                    sx={{
                      ml: 1,
                      fontWeight: 600,
                      borderColor: 'rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                    }}
                  />
                )}
              </div>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Tooltip title="Estadísticas de juego">
                  <IconButton
                    aria-label="statistics"
                    onClick={handleStatistics}
                    sx={{
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      p: '7px',
                      '&:hover': { backgroundColor: 'rgba(144, 202, 249, 0.1)', borderColor: 'primary.main' },
                    }}
                  >
                    <Troubleshoot sx={{ color: 'primary.main', fontSize: 20 }} />
                  </IconButton>
                </Tooltip>

                <Button
                  variant="contained"
                  startIcon={<SportsEsports />}
                  onClick={handleTrainer}
                  sx={{
                    backgroundColor: 'rgba(255, 174, 128, 0.15)',
                    color: '#ffae80',
                    border: '1px solid rgba(255, 174, 128, 0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 174, 128, 0.25)',
                    },
                  }}
                >
                  Entrenar posiciones
                </Button>
              </Stack>
            </div>

            {/* Filter and Selection Tools */}
            <Stack spacing={2}>
              <TextField
                size="small"
                fullWidth
                value={searchTerm}
                label="Buscar por nombre del rival"
                onChange={(e) => handleSearchTermChange(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => handleSearchTermChange('')}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />

              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={1}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button
                    variant="outlined"
                    startIcon={<SelectAll />}
                    onClick={handleToggleAll}
                    size="small"
                    sx={{ py: 0.6 }}
                  >
                    Seleccionar todas
                  </Button>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      label="N"
                      value={randomCount}
                      onChange={(e) => setRandomCount(parseInt(e.target.value, 10) || 0)}
                      sx={{ width: '75px', '& input': { py: 0.7 } }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<Shuffle />}
                      onClick={handleRandomSelect}
                      size="small"
                      sx={{ py: 0.6 }}
                    >
                      Random
                    </Button>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  {checked.length > 0 && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${checked.length} seleccionada${checked.length > 1 ? 's' : ''}`}
                    />
                  )}
                  {gamesCount > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.85rem',
                        color: 'text.secondary',
                        px: 1,
                      }}
                    >
                      <span>{analyzedCount}</span>
                      <span>/</span>
                      <span>{gamesCount}</span>
                    </Box>
                  )}
                </Stack>
              </Stack>
            </Stack>

            {/* List of games */}
            <List
              ref={listRef}
              sx={{
                maxHeight: '48vh',
                overflow: 'auto',
                pr: 0.5,
              }}
            >
              {currentGames.length > 0 ? (
                currentGames.map((game) => (
                  <GameTile
                    game={game}
                    checked={checked}
                    username={username}
                    key={game.getGame().id}
                    index={games.indexOf(game)}
                    handleToggle={handleToggle}
                  />
                ))
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    color: 'text.secondary',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body1">
                    No se encontraron partidas para este criterio de búsqueda.
                  </Typography>
                </Box>
              )}
            </List>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                showLastButton
                showFirstButton
                page={currentPage}
                count={totalPages}
                onChange={handlePageChange}
                color="primary"
                sx={{ alignSelf: 'center', my: 1 }}
              />
            )}

            {/* Bottom Actions */}
            <Stack spacing={2} direction="row" sx={{ pt: 1 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSubmit}
                startIcon={<PlayArrow />}
                size="large"
                sx={{
                  py: 1.2,
                  fontWeight: 600,
                  background: checked.length > 0
                    ? 'linear-gradient(135deg, #90caf9 0%, #64b5f6 100%)'
                    : undefined,
                  color: checked.length > 0 ? '#0f172a' : undefined,
                }}
              >
                Analizar {checked.length > 0 ? `(${checked.length})` : ''}
              </Button>
              <Button
                fullWidth
                color="secondary"
                variant="outlined"
                onClick={handleBack}
                startIcon={<ArrowBack />}
                size="large"
                sx={{ py: 1.2, fontWeight: 600 }}
              >
                Atrás
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
