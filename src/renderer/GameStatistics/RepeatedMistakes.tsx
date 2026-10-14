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
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';

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
    <Paper sx={{ padding: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Posiciones con errores repetidos</Typography>
        <Button
          variant="contained"
          startIcon={<SportsEsportsIcon />}
          onClick={() => navigate('/trainer')}
          disabled={loading || repeatedPositions.length === 0}
          size="small"
        >
          Entrenar posiciones
        </Button>
      </Box>
      {loading && <LinearProgress sx={{ my: 2 }} />}
      {!loading && repeatedPositions.length > 0 && (
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <List>
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
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
              >
                <ListItemText
                  primary={`Repetido ${pos.count} veces`}   
                  secondary={
                    <Box component="div">
                      <Typography variant="body2" color="text.primary" sx={{ wordBreak: 'break-all' }}>
                        FEN: {pos.fen}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Movimientos previos: {pos.moves.length > 0 ? pos.moves.join(' ') : 'Ninguno'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
              <Divider />
            </React.Fragment>
          ))}
        </List>
        </Box>
      )}
      {!loading && repeatedPositions.length === 0 && (
        <Typography variant="body1">No se han encontrado errores repetidos.</Typography>
      )}
    </Paper>
  );
}
