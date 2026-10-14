import {
  Button,
  TextField,
  Stack,
  Box,
  Paper,
  LinearProgress,
  InputAdornment,
  Typography,
} from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import LinearProgressWithLabel from './LinearProgressWithLabel';
import { checkPlayer, handleGameStream } from '../../http';
import { GameDecorator } from '../../interfaces';
import { useNavigate } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import './Home.css';

export default function Home({
  username,
  onGamesUpdate,
  onUsernameUpdate,
}: {
  username: string;
  onUsernameUpdate: (username: string) => void;
  onGamesUpdate: (games: GameDecorator[]) => void;
}) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [homeError, setHomeError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [homeHelperText, setHomeHelperText] = useState('');

  function showHomeError(isShown: boolean, text: string = '') {
    if (isShown) {
      onUsernameUpdate('');
    }

    setHomeHelperText(text);
    setHomeError(isShown);
    setDownloading(false);
    setLoading(false);
  }

  function showUserGames(games: GameDecorator[]) {
    const validGames = games.filter((d) => {
      const game = d.getGame();
      return game.variant !== 'fromPosition' && game.moves;
    });

    if (validGames.length > 0) {
      onGamesUpdate(validGames);
      navigate('/games');

      setDownloading(false);
      setLoading(false);
    } else {
      showHomeError(true, 'El usuario no ha jugado partidas válidas.');
    }
  }

  async function retrieveNewGames(totalGames: number, since?: number) {
    try {
      const games = await handleGameStream(username, totalGames, setProgress, since);
      window.electron.ipcRenderer.insertGames(games);

      // After inserting, load from database to preserve any analysis data
      const gamesWithAnalysis = await window.electron.ipcRenderer.getPlayerGames(username);
      showUserGames(gamesWithAnalysis.map((game) => new GameDecorator(game)));
    } catch (_e) {
      showHomeError(true, 'Hubo un error al cargar las partidas.');
    }
  }

  async function retrieveOldGames() {
    showUserGames(
      (await window.electron.ipcRenderer.getPlayerGames(username)).map(
        (game) => new GameDecorator(game),
      ),
    );
  }

  async function checkForNewGames(gamesCount: number) {
    const gamesCountDB =
      await window.electron.ipcRenderer.getPlayerGamesCount(username);
    if (gamesCount !== gamesCountDB) {
      // Count differs — check if we can do a delta fetch
      const newestLocalCreatedAt =
        await window.electron.ipcRenderer.getNewestGameCreatedAt(username);
      if (newestLocalCreatedAt) {
        // Has local games — fetch only games newer than the newest local one
        setDownloading(true);
        await retrieveNewGames(gamesCount, newestLocalCreatedAt + 1);
      } else {
        // No local games yet — download all
        setDownloading(true);
        await retrieveNewGames(gamesCount);
      }
    } else {
      await retrieveOldGames();
    }
  }

  async function verifyPlayer() {
    setLoading(true);

    try {
      const { exists, gamesCount } = await checkPlayer(username);
      if (exists) {
        if (gamesCount !== 0) {
          await checkForNewGames(gamesCount);
        } else {
          showHomeError(true, 'El usuario no ha jugado partidas.');
        }
      } else {
        showHomeError(true, 'El usuario introducido no existe.');
      }
    } catch (_e) {
      showHomeError(true, 'Hubo un error al verificar el usuario.');
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    showHomeError(false);

    if (!/^\s*$/.test(username)) {
      verifyPlayer();
    } else {
      showHomeError(true, 'Ingrese un nombre de usuario.');
    }
  };

  return (
    <Box className="home-container">
      {loading ? (
        <Paper className="download-card">
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(144, 202, 249, 0.1)',
                color: 'primary.main',
              }}
            >
              <CloudDownloadOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>
            {downloading ? (
              <Box sx={{ width: '100%' }}>
                <p style={{ margin: '0 0 1rem 0', fontWeight: 600, color: '#e0e0e0' }}>
                  Descargando partidas...
                </p>
                <LinearProgressWithLabel progress={progress} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Descargando y sincronizando partidas desde Lichess
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                  Verificando jugador en Lichess...
                </Typography>
                <LinearProgress sx={{ borderRadius: 2, height: 6 }} />
              </Box>
            )}
          </Stack>
        </Paper>
      ) : (
        <Paper className="home-card">
          <div className="home-brand">
            <div className="home-logo-badge">
              <SportsEsportsRoundedIcon sx={{ fontSize: 36 }} />
            </div>
            <h2 className="home-brand-title">ZeroChess</h2>
            <p className="home-brand-subtitle">
              Analizador de precisión y entrenador de aperturas con Stockfish
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <h1 className="home-heading">Importar partidas:</h1>
              <TextField
                required
                fullWidth
                size="medium"
                error={homeError}
                label="Nombre de usuario"
                placeholder="ej. magnuscarlsen"
                helperText={homeHelperText}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircleOutlinedIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                onChange={(e) =>
                  onUsernameUpdate(e.target.value.toLowerCase().trim())
                }
              />
              <Button
                variant="contained"
                type="submit"
                size="large"
                startIcon={<CloudDownloadOutlinedIcon />}
                sx={{
                  py: 1.3,
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #90caf9 0%, #64b5f6 100%)',
                  color: '#0f172a',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #bbdefb 0%, #90caf9 100%)',
                  },
                }}
              >
                Importar partidas
              </Button>
            </Stack>
          </form>

          <div className="home-features">
            <span className="home-feature-pill">⚡ Motor Stockfish</span>
            <span className="home-feature-pill">🎯 Gráfica de ventaja</span>
            <span className="home-feature-pill">📚 Entrenador de errores</span>
          </div>
        </Paper>
      )}
    </Box>
  );
}
