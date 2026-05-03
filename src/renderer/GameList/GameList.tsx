/* eslint-disable no-await-in-loop */
import { calculateAccuracyFromCentipawns, calculateAdvantageFromCentipawns, calculateErrors } from '../../main/services/engine/engineService';
import { createEnginePool, getGameCentipawnsOnEngine } from '../../main/services/engine/helpers/engine';
import { Paper, List, Button, Stack, Pagination, Box, TextField, IconButton } from '@mui/material';
import LinearProgressWithLabel from '../Home/LinearProgressWithLabel';
import { ChangeEvent, useState, useEffect, useRef } from 'react';
import { Troubleshoot } from '@mui/icons-material';
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
  accuracy: { whitePlayerAverage: number; blackPlayerAverage: number };
  advantage: (string | number)[];
  moves: string[];
}> {
  const moves = game.getGameMoves();
  
  // Get centipawns for each move using the specific engine worker
  const centipawns = await getGameCentipawnsOnEngine(engine, moves);
  
  // Calculate accuracy and advantage from centipawns
  const accuracy = calculateAccuracyFromCentipawns(centipawns);
  const advantage = calculateAdvantageFromCentipawns(centipawns);
  
  return { centipawns, accuracy, advantage, moves };
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

  /* eslint-disable no-await-in-loop */
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
    const numWorkers = engines.length;

    let totalTime = 0;
    let completedGames = 0;

    // Create a work queue with game indices
    const workQueue = [...Array(totalGames).keys()];

    // Create worker tasks
    const workerPromises = engines.map((engine, workerIndex) => async () => {
      while (workQueue.length > 0) {
        const gameIndex = workQueue.shift();
        if (gameIndex === undefined) break;

        const game = gamesToAnalyse[gameIndex];
        const startTime = performance.now();

        try {
          // Analyze game using this specific engine worker
          const { centipawns, accuracy, advantage } = await analyzeGameWithWorker(
            engine,
            game,
          );

          // Calculate errors from advantage
          const mistakes = calculateErrors(advantage, 1, 1.5);
          const inaccuracies = calculateErrors(advantage, 0.5, 1);
          const blunders = calculateErrors(advantage, 1.5, Infinity);

          const analysis = { advantage, accuracy, mistakes, inaccuracies, blunders };

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

  return (
    <Box>
      {loading ? (
        <Box sx={{ width: '25vw' }}>
          <p>
            Analizando...
            {estimatedTime ? ` (Quedan ${estimatedTime})` : ''}
          </p>
          <LinearProgressWithLabel progress={progress} />
        </Box>
      ) : (
        <Paper sx={{ padding: '2.5em 3.5em', minWidth: '48em' }}>
          <Stack spacing={5}>
            <TextField
              size="small"
              value={searchTerm}
              label="Buscar por nombre del rival"
              onChange={(e) => handleSearchTermChange(e.target.value)}
            />
            <Stack spacing={5} direction="row" alignItems="center">
              <IconButton aria-label="statistics" onClick={handleStatistics}>
                <Troubleshoot />
              </IconButton>
              <Button variant="contained" onClick={handleToggleAll}>
                Seleccionar todas
              </Button>
              <TextField
                size="small"
                type="number"
                label="N"
                value={randomCount}
                onChange={(e) => setRandomCount(parseInt(e.target.value, 10) || 0)}
                sx={{ width: '80px' }}
              />
              <Button variant="contained" onClick={handleRandomSelect}>
                Random
              </Button>
              {gamesCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{analyzedCount}</span>
                  <span>/</span>
                  <span>{gamesCount}</span>
                </Box>
              )}
            </Stack>
            <List ref={listRef} sx={{ maxHeight: '45vh', overflow: 'auto' }}>
              {currentGames.map((game) => (
                <GameTile
                  game={game}
                  checked={checked}
                  username={username}
                  key={game.getGame().id}
                  index={games.indexOf(game)}
                  handleToggle={handleToggle}
                />
              ))}
            </List>
            <Pagination
              showLastButton
              showFirstButton
              page={currentPage}
              count={totalPages}
              onChange={handlePageChange}
              sx={{ alignSelf: 'center' }}
            />
            <Stack spacing={5} direction="row">
              <Button fullWidth variant="contained" onClick={handleSubmit}>
                Analizar
              </Button>
              <Button
                fullWidth
                color="secondary"
                variant="contained"
                onClick={handleBack}
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
