import React, { useEffect, useState } from 'react';
import { GameDecorator, RepeatedMistakePosition } from '../../interfaces';
import { Chess } from 'chess.js';
import { useNavigate } from 'react-router-dom';
import { 
  List, 
  ListItemText, 
  ListItemButton,
  Typography, 
  Paper, 
  Divider,
  Box,
  Button,
  LinearProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

interface RepeatedMistakesProps {
  games: GameDecorator[];
  username: string;
}

interface DisplayMistakePosition {
  fen: string;
  count: number;
  moves: string[];
  gameId?: string;
  game?: GameDecorator;
}

function computeRepeatedPositionsFromGames(
  games: GameDecorator[],
  username: string,
): DisplayMistakePosition[] {
  const counts: { 
    [key: string]: { count: number; moves: string[]; gameId: string; game: GameDecorator } 
  } = {};

  games.forEach((gameDecorator) => {
    const game = gameDecorator.getGame();
    const analysis = game.analysis;
    if (!analysis) return;

    const errors = {
      mistakes: analysis.mistakes as { whitePlayer?: any; blackPlayer?: any },
      blunders: analysis.blunders as { whitePlayer?: any; blackPlayer?: any },
    };
    const playerSide = gameDecorator.getSide(username);

    // Collect all error indices from mistakes and blunders
    const allErrorIndices = new Set<number>();
    for (const errorType of Object.values(errors)) {
      const indices = errorType[`${playerSide}Player`];
      if (Array.isArray(indices)) {
        indices.forEach((idx: number) => allErrorIndices.add(idx));
      }
    }
    const playerMistakeIndices = Array.from(allErrorIndices).sort((a, b) => a - b);

    const chess = new Chess();
    const moves = gameDecorator.getGameMoves();

    const fens: string[] = [chess.fen()];
    for (const move of moves) {
      try {
        chess.move(move);
        fens.push(chess.fen());
      } catch (e) {
        break;
      }
    }

    playerMistakeIndices.forEach((idx: number) => {
      const fen = fens[idx];
      if (fen) {
        if (counts[fen]) {
          counts[fen].count += 1;
        } else {
          counts[fen] = { count: 1, moves: moves.slice(0, idx), gameId: game.id, game: gameDecorator };
        }
      }
    });
  });

  return Object.entries(counts)
    .filter(([_, value]) => value.count >= 2)
    .map(([fen, value]) => ({
      fen,
      count: value.count,
      moves: value.moves,
      gameId: value.gameId,
      game: value.game,
    }))
    .sort((a, b) => b.count - a.count);
}

export default function RepeatedMistakes({ games, username }: RepeatedMistakesProps) {
  const navigate = useNavigate();

  const hasIpc =
    typeof window !== 'undefined' &&
    !!window.electron?.ipcRenderer?.getRepeatedMistakes;

  const [loading, setLoading] = useState(hasIpc);
  const [repeatedPositions, setRepeatedPositions] = useState<DisplayMistakePosition[]>(() => {
    if (!hasIpc) {
      return computeRepeatedPositionsFromGames(games, username);
    }
    return [];
  });

  useEffect(() => {
    if (!hasIpc) return;

    let isMounted = true;
    window.electron.ipcRenderer
      .getRepeatedMistakes(username)
      .then((dbPositions: RepeatedMistakePosition[]) => {
        if (!isMounted) return;
        const mapped: DisplayMistakePosition[] = dbPositions.map((pos) => ({
          fen: pos.fen,
          count: pos.count,
          moves: pos.moves,
          gameId: pos.gameId,
          game: games.find((g) => g.getGame().id === pos.gameId),
        }));
        setRepeatedPositions(mapped);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load repeated mistakes from DB:', err);
        if (isMounted) {
          setRepeatedPositions(computeRepeatedPositionsFromGames(games, username));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [username, games, hasIpc]);

  return (
    <Paper
      sx={{
        padding: 2.5,
        mt: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReplayRoundedIcon sx={{ color: 'secondary.main', fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Posiciones con errores repetidos
          </Typography>
          {repeatedPositions.length > 0 && (
            <Chip
              size="small"
              label={`${repeatedPositions.length} detectadas`}
              sx={{ fontWeight: 600, ml: 1 }}
            />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<SportsEsportsIcon />}
          onClick={() => navigate('/trainer')}
          disabled={loading || repeatedPositions.length === 0}
          size="small"
          sx={{
            fontWeight: 600,
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
      </Box>

      {loading && <LinearProgress sx={{ my: 2, borderRadius: 1 }} />}

      {!loading && repeatedPositions.length > 0 && (
        <Box sx={{ maxHeight: 360, overflow: 'auto', pr: 0.5 }}>
          <List sx={{ py: 0 }}>
            {repeatedPositions.map((pos, index) => (
              <React.Fragment key={index}>
                <ListItemButton
                  alignItems="flex-start"
                  onClick={() => {
                    const targetGame = pos.game || games.find((g) => g.getGame().id === pos.gameId);
                    if (targetGame) {
                      navigate('/analysis', { 
                        state: { 
                          username, 
                          game: targetGame,
                          position: pos.fen 
                        } 
                      });
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    my: 0.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    backgroundColor: 'rgba(255, 255, 255, 0.015)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      transform: 'translateX(3px)',
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Chip
                          size="small"
                          color="error"
                          variant="outlined"
                          label={`Repetido ${pos.count} veces`}
                          sx={{ fontWeight: 700, fontSize: '0.78rem' }}
                        />
                        <Tooltip title="Ver en análisis">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
                            <span>Analizar</span>
                            <ArrowForwardIosRoundedIcon sx={{ fontSize: 12 }} />
                          </Box>
                        </Tooltip>
                      </Box>
                    }
                    secondary={
                      <Box component="div" sx={{ mt: 0.5 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 0.5 }}
                        >
                          <strong>Movimientos previos:</strong>{' '}
                          {pos.moves.length > 0 ? pos.moves.join(' ') : 'Ninguno'}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            wordBreak: 'break-all',
                            opacity: 0.7,
                            display: 'block',
                          }}
                        >
                          FEN: {pos.fen}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
                {index < repeatedPositions.length - 1 && (
                  <Divider sx={{ my: 0.25, opacity: 0.1 }} />
                )}
              </React.Fragment>
            ))}
          </List>
        </Box>
      )}

      {!loading && repeatedPositions.length === 0 && (
        <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body1">No se han encontrado errores repetidos.</Typography>
        </Box>
      )}
    </Paper>
  );
}
