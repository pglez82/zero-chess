import { Route, Routes, MemoryRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useState } from 'react';
import GameStatistics from './GameStatistics/GameStatistics';
import GameAnalysis from './GameAnalysis/GameAnalysis';
import { GameDecorator } from '../interfaces';
import GameList from './GameList/GameList';
import Home from './Home/Home';
import PositionTrainer from './PositionTrainer/PositionTrainer';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90CAF9',
      light: '#BBDEFB',
      dark: '#42A5F5',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#FFAE80',
      light: '#FFCCBC',
      dark: '#E65100',
    },
    success: {
      main: '#81C784',
      light: '#A5D6A7',
      dark: '#388E3C',
    },
    warning: {
      main: '#FFB74D',
      light: '#FFE082',
      dark: '#F57C00',
    },
    error: {
      main: '#E57373',
      light: '#EF9A9A',
      dark: '#C62828',
    },
    background: {
      default: '#161512',
      paper: '#211F1C',
    },
    text: {
      primary: '#E6E6E6',
      secondary: '#9E9E9E',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: '"Noto Sans", "Inter", "Roboto", -apple-system, sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#211F1C',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
          transition: 'all 0.15s ease-in-out',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.18)',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
          },
        },
        notchedOutline: {
          borderColor: 'rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: '#302d28',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        },
        arrow: {
          color: '#302d28',
        },
      },
    },
  },
});

export default function App() {
  const [games, setGames] = useState<GameDecorator[]>([]);
  const [username, setUsername] = useState('');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                username={username}
                onGamesUpdate={setGames}
                onUsernameUpdate={setUsername}
              />
            }
          />
          <Route
            path="/games"
            element={
              <GameList
                games={games}
                username={username}
                onUsernameUpdate={setUsername}
              />
            }
          />
          <Route path="/analysis" element={<GameAnalysis />} />
          <Route
            path="/statistics"
            element={<GameStatistics games={games} username={username} />}
          />
          <Route
            path="/trainer"
            element={<PositionTrainer games={games} username={username} />}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
