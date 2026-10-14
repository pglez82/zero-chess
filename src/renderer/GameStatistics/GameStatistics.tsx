import { Button, Paper, Stack, Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Game, GameDecorator } from '../../interfaces';
import Carousel from 'react-material-ui-carousel';
import { useNavigate } from 'react-router-dom';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import StatsPieChart from './StatsPieChart';
import StatsBarChart from './StatsBarChart';
import RepeatedMistakes from './RepeatedMistakes';
import './GameStatistics.css';

export default function GameStatistics({
  games,
  username,
}: {
  username: string;
  games: GameDecorator[];
}) {
  const stats = {
    draws: 0,
    losses: 0,
    blunders: 0,
    mistakes: 0,
    whiteWins: 0,
    blackWins: 0,
    whiteErrors: 0,
    blackErrors: 0,
    inaccuracies: 0,
    winsAgainstLowerRating: 0,
    winsAgainstHigherRating: 0,
    errorsAgainstLowerRating: 0,
    errorsAgainstHigherRating: 0,
    modeWins: new Map<string, number>(),
    modeErrors: new Map<string, number>(),
  };

  const updateMistakes = (
    game: Game,
    playerSide: string,
    playerRating: number | undefined,
    opponentRating: number | undefined,
  ) => {
    const blunders = game.analysis!.blunders[`${playerSide}Player`];
    const mistakes = game.analysis!.mistakes[`${playerSide}Player`];
    const inaccuracies = game.analysis!.inaccuracies[`${playerSide}Player`];

    stats.blunders += Array.isArray(blunders) ? blunders.length : 0;
    stats.mistakes += Array.isArray(mistakes) ? mistakes.length : 0;
    stats.inaccuracies += Array.isArray(inaccuracies) ? inaccuracies.length : 0;

    const totalErrors = blunders.length + mistakes.length + inaccuracies.length;
    if (playerSide === 'white') {
      stats.whiteErrors += totalErrors;
    } else {
      stats.blackErrors += totalErrors;
    }

    if (playerRating && opponentRating) {
      if (playerRating > opponentRating) {
        stats.errorsAgainstLowerRating += totalErrors;
      } else {
        stats.errorsAgainstHigherRating += totalErrors;
      }
    }

    const speedErrors = stats.modeErrors.get(game.speed) || 0;
    stats.modeErrors.set(game.speed, speedErrors + totalErrors);
  };

  const updateWins = (
    gameSpeed: string,
    playerSide: string,
    playerRating: number | undefined,
    opponentRating: number | undefined,
  ) => {
    if (playerSide === 'white') {
      stats.whiteWins += 1;
    } else {
      stats.blackWins += 1;
    }

    if (playerRating && opponentRating) {
      if (playerRating > opponentRating) {
        stats.winsAgainstLowerRating += 1;
      } else {
        stats.winsAgainstHigherRating += 1;
      }
    }

    const speedWins = stats.modeWins.get(gameSpeed) || 0;
    stats.modeWins.set(gameSpeed, speedWins + 1);
  };

  const updateResults = (
    game: Game,
    playerSide: string,
    playerRating: number | undefined,
    opponentRating: number | undefined,
  ) => {
    if (game.status === 'draw') {
      stats.draws += 1;
    } else if (game.winner === playerSide) {
      updateWins(game.speed, playerSide, playerRating, opponentRating);
    } else {
      stats.losses += 1;
    }
  };

  const updateStats = (gameDecorator: GameDecorator) => {
    const game = gameDecorator.getGame();
    const playerSide = gameDecorator.getSide(username);
    const opponentSide = gameDecorator.getOpponentSide(username);

    const playerRating = game.players[playerSide].rating;
    const opponentRating = game.players[opponentSide].rating;

    if (game.analysis) {
      updateMistakes(game, playerSide, playerRating, opponentRating);
    }
    updateResults(game, playerSide, playerRating, opponentRating);
  };

  games.forEach(updateStats);

  function parseMap(map: Map<string, number>) {
    const flatArray = Array.from(map);
    const firstThree = flatArray.sort((a, b) => b[1] - a[1]).slice(0, 3);

    const keys = firstThree.map((p) => p[0]);
    const values = firstThree.map((p) => p[1]);

    return { keys, values };
  }

  const parsedWins = parseMap(stats.modeWins);
  const parsedErrors = parseMap(stats.modeErrors);

  const navigate = useNavigate();
  const handleBack = () => {
    navigate('/games');
  };

  const handleTrainer = () => {
    navigate('/trainer');
  };

  const hasErrors = stats.blunders + stats.mistakes + stats.inaccuracies > 0;

  return (
    <Paper className="paper">
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h1 className="h1-margin">Estadísticas de {username}</h1>
          <Tooltip title="Volver a partidas">
            <IconButton
              aria-label="Volver"
              onClick={handleBack}
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                p: '7px',
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Carousel
          swipe={false}
          interval={8000}
          animation="slide"
          stopAutoPlayOnHover
          className="carousel"
        >
          {/* Slide 1: Victorias */}
          <Box sx={{ p: 1 }}>
            <h2 className="stats-slide-title">
              <EmojiEventsRoundedIcon sx={{ color: '#81C784' }} />
              Victorias
            </h2>
            <Stack spacing={2} direction="row" justifyContent="space-between">
              <StatsPieChart
                title="V/T/D"
                data={[
                  {
                    value: stats.whiteWins + stats.blackWins,
                    color: '#81C784',
                    label: 'Victorias',
                  },
                  { value: stats.draws, color: '#90CAF9', label: 'Tablas' },
                  {
                    value: stats.losses,
                    color: '#E57373',
                    label: 'Derrotas',
                  },
                ]}
              />
              <StatsPieChart
                title="Blancas/Negras"
                data={[
                  {
                    value: stats.whiteWins,
                    color: '#ffffff',
                    label: 'Victorias con blancas',
                  },
                  {
                    value: stats.blackWins,
                    color: '#546E7A',
                    label: 'Victorias con negras',
                  },
                ]}
              />
              <StatsPieChart
                title="-/+ Elo"
                data={[
                  {
                    value: stats.winsAgainstLowerRating,
                    color: '#CE93D8',
                    label: 'Victorias contra jugadores de menor Elo',
                  },
                  {
                    value: stats.winsAgainstHigherRating,
                    color: '#7E57C2',
                    label: 'Victorias contra jugadores de mayor Elo',
                  },
                ]}
              />
              <StatsBarChart
                title="Por modo"
                keys={parsedWins.keys}
                values={parsedWins.values}
              />
            </Stack>
          </Box>

          {/* Slide 2: Errores */}
          <Box sx={{ p: 1 }}>
            <h2 className="stats-slide-title">
              <WarningAmberRoundedIcon sx={{ color: '#FFB74D' }} />
              Errores
            </h2>
            {hasErrors ? (
              <Stack spacing={2} direction="row" justifyContent="space-between">
                <StatsPieChart
                  title="I/E/EG"
                  data={[
                    {
                      value: stats.inaccuracies,
                      color: '#90CAF9',
                      label: 'Imprecisiones',
                    },
                    {
                      value: stats.mistakes,
                      color: '#FFB74D',
                      label: 'Errores',
                    },
                    {
                      value: stats.blunders,
                      color: '#E57373',
                      label: 'Errores graves',
                    },
                  ]}
                />
                <StatsPieChart
                  title="Blancas/Negras"
                  data={[
                    {
                      value: stats.whiteErrors,
                      color: '#ffffff',
                      label: 'Errores con blancas',
                    },
                    {
                      value: stats.blackErrors,
                      color: '#546E7A',
                      label: 'Errores con negras',
                    },
                  ]}
                />
                <StatsPieChart
                  title="-/+ Elo"
                  data={[
                    {
                      value: stats.errorsAgainstLowerRating,
                      color: '#CE93D8',
                      label: 'Errores contra jugadores de menor Elo',
                    },
                    {
                      value: stats.errorsAgainstHigherRating,
                      color: '#7E57C2',
                      label: 'Errores contra jugadores de mayor Elo',
                    },
                  ]}
                />
                <StatsBarChart
                  title="Por modo"
                  keys={parsedErrors.keys}
                  values={parsedErrors.values}
                />
              </Stack>
            ) : (
              <Box className="centered-text" sx={{ height: '16em' }}>
                <p>¡Analiza más partidas!</p>
              </Box>
            )}
          </Box>
        </Carousel>

        <Box className="flex-end" sx={{ mb: 1, mt: 1 }}>
          <Button
            variant="contained"
            startIcon={<SportsEsportsIcon />}
            onClick={handleTrainer}
            size="large"
            sx={{
              fontSize: '0.98rem',
              fontWeight: 600,
              px: 3,
              py: 1,
              background: 'linear-gradient(135deg, #ffae80 0%, #e28743 100%)',
              color: '#0f172a',
              '&:hover': {
                background: 'linear-gradient(135deg, #ffccbc 0%, #ffae80 100%)',
              },
            }}
          >
            📚 Entrenador de Posiciones
          </Button>
        </Box>

        <RepeatedMistakes games={games} username={username} />

        <Box className="flex-end">
          <Button color="secondary" variant="contained" onClick={handleBack} sx={{ fontWeight: 600 }}>
            Atrás
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
