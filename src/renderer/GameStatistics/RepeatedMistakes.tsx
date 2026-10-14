import React, { useEffect, useState, useMemo } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { calculateMoveErrorMagnitude } from '../../main/services/engine/engineService';

interface RepeatedMistakesProps {
  games: GameDecorator[];
  username: string;
}

export interface DisplayMistakePosition {
  fen: string;
  count: number;
  errorMagnitude: number;
  moves: string[];
  gameId?: string;
  game?: GameDecorator;
  side?: 'white' | 'black';
}

export function computeRepeatedPositionsFromGames(
  games: GameDecorator[],
  username: string,
): DisplayMistakePosition[] {
  const counts: { 
    [key: string]: { 
      count: number; 
      totalMagnitude: number;
      moves: string[]; 
      gameId: string; 
      game: GameDecorator;
      side: 'white' | 'black';
    } 
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
        let mag = calculateMoveErrorMagnitude(
          analysis.advantage,
          idx,
          playerSide,
          moves.length,
        );

        if (mag === 0) {
          if (errors.blunders[`${playerSide}Player`]?.includes(idx)) {
            mag = 1.5;
          } else if (errors.mistakes[`${playerSide}Player`]?.includes(idx)) {
            mag = 1.0;
          }
        }

        if (counts[fen]) {
          counts[fen].count += 1;
          counts[fen].totalMagnitude += mag;
        } else {
          counts[fen] = { 
            count: 1, 
            totalMagnitude: mag, 
            moves: moves.slice(0, idx), 
            gameId: game.id, 
            game: gameDecorator,
            side: playerSide,
          };
        }
      }
    });
  });

  return Object.entries(counts)
    .filter(([_, value]) => value.count >= 2)
    .map(([fen, value]) => ({
      fen,
      count: value.count,
      errorMagnitude: Number((value.totalMagnitude / value.count).toFixed(2)),
      moves: value.moves,
      gameId: value.gameId,
      game: value.game,
      side: value.side,
    }))
    .sort((a, b) => b.count - a.count || b.errorMagnitude - a.errorMagnitude);
}

export default function RepeatedMistakes({ games, username }: RepeatedMistakesProps) {
  const navigate = useNavigate();

  const hasIpc =
    typeof window !== 'undefined' &&
    !!window.electron?.ipcRenderer?.getRepeatedMistakes;

  const [loading, setLoading] = useState(hasIpc);
  const [sortBy, setSortBy] = useState<'repeats' | 'magnitude'>('repeats');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
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
        const mapped: DisplayMistakePosition[] = dbPositions.map((pos) => {
          const targetGame = games.find((g) => g.getGame().id === pos.gameId);
          let errorMagnitude = pos.errorMagnitude ?? 0;

          if (errorMagnitude === 0 && targetGame?.getGame()?.analysis?.advantage) {
            errorMagnitude = calculateMoveErrorMagnitude(
              targetGame.getGame().analysis?.advantage,
              pos.moves.length,
              pos.side,
              targetGame.getGameMoves().length,
            );
          }

          return {
            fen: pos.fen,
            count: pos.count,
            errorMagnitude,
            moves: pos.moves,
            gameId: pos.gameId,
            game: targetGame,
            side: pos.side,
          };
        });
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

  const sortedPositions = useMemo(() => {
    return [...repeatedPositions].sort((a, b) => {
      if (sortBy === 'repeats') {
        const diff = sortOrder === 'desc' ? b.count - a.count : a.count - b.count;
        if (diff !== 0) return diff;
        return sortOrder === 'desc' 
          ? b.errorMagnitude - a.errorMagnitude 
          : a.errorMagnitude - b.errorMagnitude;
      }
      const diff = sortOrder === 'desc' 
        ? b.errorMagnitude - a.errorMagnitude 
        : a.errorMagnitude - b.errorMagnitude;
      if (diff !== 0) return diff;
      return sortOrder === 'desc' ? b.count - a.count : a.count - b.count;
    });
  }, [repeatedPositions, sortBy, sortOrder]);

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

      {!loading && repeatedPositions.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
            pt: 0.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' }}
            >
              Ordenar por:
            </Typography>
            <ToggleButtonGroup
              value={sortBy}
              exclusive
              onChange={(_, newSortBy) => {
                if (newSortBy !== null) {
                  setSortBy(newSortBy);
                }
              }}
              size="small"
              aria-label="Ordenar posiciones con errores"
              sx={{
                height: 28,
                '& .MuiToggleButton-root': {
                  color: 'text.secondary',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  px: 1.25,
                  py: 0,
                  fontWeight: 600,
                  '&.Mui-selected': {
                    color: '#ffae80',
                    backgroundColor: 'rgba(255, 174, 128, 0.15)',
                    borderColor: 'rgba(255, 174, 128, 0.35)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 174, 128, 0.25)',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="repeats" aria-label="Ordenar por repeticiones">
                Repeticiones
              </ToggleButton>
              <ToggleButton value="magnitude" aria-label="Ordenar por magnitud del error">
                Magnitud del error
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip
              title={
                sortOrder === 'desc'
                  ? 'Orden descendente (mayor a menor)'
                  : 'Orden ascendente (menor a mayor)'
              }
            >
              <IconButton
                size="small"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                aria-label="Cambiar dirección de ordenamiento"
                sx={{
                  color: 'text.secondary',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 1,
                  p: 0.25,
                  height: 28,
                  width: 28,
                  '&:hover': {
                    borderColor: 'rgba(255, 174, 128, 0.35)',
                    color: '#ffae80',
                  },
                }}
              >
                {sortOrder === 'desc' ? (
                  <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {loading && <LinearProgress sx={{ my: 2, borderRadius: 1 }} />}

      {!loading && sortedPositions.length > 0 && (
        <Box sx={{ maxHeight: 360, overflow: 'auto', pr: 0.5 }}>
          <List sx={{ py: 0 }}>
            {sortedPositions.map((pos, index) => (
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
                    primaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            color="error"
                            variant="outlined"
                            label={`Repetido ${pos.count} veces`}
                            sx={{ fontWeight: 700, fontSize: '0.78rem' }}
                          />
                          <Tooltip title="Magnitud media del error (pérdida de ventaja en peones)">
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Magnitud: ${pos.errorMagnitude > 0 ? pos.errorMagnitude.toFixed(1) : '-'}`}
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                color: pos.errorMagnitude >= 1.5 ? '#ff8a80' : '#ffd180',
                                borderColor: pos.errorMagnitude >= 1.5 ? 'rgba(255, 138, 128, 0.4)' : 'rgba(255, 209, 128, 0.4)',
                                backgroundColor: pos.errorMagnitude >= 1.5 ? 'rgba(255, 138, 128, 0.08)' : 'rgba(255, 209, 128, 0.08)',
                              }}
                            />
                          </Tooltip>
                        </Box>
                        <Tooltip title="Ver en análisis">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
                            <span>Analizar</span>
                            <ArrowForwardIosRoundedIcon sx={{ fontSize: 12 }} />
                          </Box>
                        </Tooltip>
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
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
                {index < sortedPositions.length - 1 && (
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
