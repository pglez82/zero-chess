import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameDecorator } from '../../interfaces';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Alert,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import './PositionTrainer.css';

interface PositionTrainerProps {
  games: GameDecorator[];
  username: string;
}

interface MistakePosition {
  fen: string;
  count: number;
  moves: string[];
  bestMove: string; // The move that should be made from this position
  game: GameDecorator;
  side: 'white' | 'black';
}

type GameStatus = 'playing' | 'correct' | 'incorrect' | 'finished';

interface GameState {
  positions: MistakePosition[];
  currentIndex: number;
  score: { correct: number; incorrect: number };
  status: GameStatus;
  lastMoveMade: string;
  lastMoveColor: 'success' | 'error' | null;
  totalPositions: number;
}

function getBestMoveFromBestLines(
  bestLines: string[],
  moveIndex: number,
  gameMoves: string[],
): string | null {
  // The engine analysis stores bestLines AFTER each move is played:
  //   bestLines[0] = best line from position AFTER move 0 (i.e., fens[1])
  //   bestLines[1] = best line from position AFTER move 1 (i.e., fens[2])
  //   bestLines[i] = best line from fens[i + 1]
  //
  // The position the trainer shows is fens[moveIndex], which is the
  // position BEFORE move moveIndex was played.
  // Therefore, the best line for this position is bestLines[moveIndex - 1]
  // (since bestLines[moveIndex - 1] = best line from fens[moveIndex]).
  //
  // For moveIndex = 0 (first move of the game), no best line exists
  // since the engine starts analyzing from after the first move.

  if (moveIndex >= 1 && moveIndex - 1 < bestLines.length && bestLines[moveIndex - 1]) {
    const line = bestLines[moveIndex - 1];
    if (line && line.trim()) {
      const moves = line.trim().split(/\s+/);
      if (moves[0]) return moves[0];
    }
  }

  // Fallback: for first-move errors or missing best lines,
  // use the actual move played in the game as a reference.
  if (moveIndex >= 0 && moveIndex < gameMoves.length) {
    return gameMoves[moveIndex];
  }

  return null;
}

/**
 * Find the best move from the current position by matching against
 * the best line SAN notation. Returns the UCI notation if found.
 */
function findBestMoveUci(
  currentFen: string,
  bestMoveSan: string,
): string | null {
  if (!bestMoveSan || !currentFen) return null;

  const chess = new Chess(currentFen);
  const normalizedBest = bestMoveSan.trim().replace(/^\d+\.\s*/, '').trim();

  // Get all legal moves
  const moves = chess.moves({ verbose: true });

  // Try to find a matching move
  for (const move of moves) {
    const moveSan = move.san;

    // Direct SAN match
    if (moveSan === normalizedBest) {
      return move.from + move.to + (move.promotion || '');
    }

    // Handle SAN with/without capture symbol (Nxf3 vs Nf3)
    const moveSanNoCapture = moveSan.replace(/x/g, '');
    const bestSanNoCapture = normalizedBest.replace(/x/g, '');
    if (moveSanNoCapture === bestSanNoCapture) {
      return move.from + move.to + (move.promotion || '');
    }

    // Handle disambiguation: match by piece + destination
    const movePiece = moveSan.charAt(0);
    const moveDest = moveSan.replace(/[^a-h1-8=+!?#]/g, '').replace(/=/, '');
    const bestPiece = bestSanNoCapture.charAt(0);
    const bestDest = bestSanNoCapture.replace(/[^a-h1-8=+!?#]/g, '').replace(/=/, '');
    if (
      movePiece === bestPiece
      && moveDest === bestDest
      && movePiece !== 'p' // pawns are ambiguous
    ) {
      return move.from + move.to + (move.promotion || '');
    }

    // Fallback: match by destination square only
    if (moveDest === bestDest) {
      return move.from + move.to + (move.promotion || '');
    }
  }

  return null;
}


export default function PositionTrainer({
  games,
  username,
}: PositionTrainerProps) {
  const navigate = useNavigate();

  const positions = useMemo<MistakePosition[]>(() => {
    const counts: {
      [key: string]: {
        count: number;
        moves: string[];
        bestMove: string;
        game: GameDecorator;
        side: 'white' | 'black';
      };
    } = {};

    games.forEach((gameDecorator) => {
      const game = gameDecorator.getGame();
      const analysis = game.analysis;
      if (!analysis) return;

      const errors = {
        mistakes: analysis.mistakes as { whitePlayer?: number[]; blackPlayer?: number[] },
        blunders: analysis.blunders as { whitePlayer?: number[]; blackPlayer?: number[] },
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
      const gameMoves = gameDecorator.getGameMoves();

      const fens: string[] = [chess.fen()];
      for (const move of gameMoves) {
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
          // Determine the side to move at this position
          const chessAtPosition = new Chess();
          for (let i = 0; i < idx && i < gameMoves.length; i++) {
            try {
              chessAtPosition.move(gameMoves[i]);
            } catch (e) {
              break;
            }
          }
          const side = chessAtPosition.turn() === 'w' ? 'white' : 'black';

          // Get the best move from the analysis
          const bestMove = getBestMoveFromBestLines(
            analysis.bestLines,
            idx,
            gameMoves,
          ) || '';

          if (counts[fen]) {
            counts[fen].count += 1;
          } else {
            counts[fen] = {
              count: 1,
              moves: gameMoves.slice(0, idx),
              bestMove,
              game: gameDecorator,
              side,
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
        moves: value.moves,
        bestMove: value.bestMove,
        game: value.game,
        side: value.side,
      }))
      .sort((a, b) => b.count - a.count);
  }, [games, username]);

  const [gameState, setGameState] = useState<GameState>(() => ({
    positions,
    currentIndex: 0,
    score: { correct: 0, incorrect: 0 },
    status: 'playing',
    lastMoveMade: '',
    lastMoveColor: null,
    totalPositions: positions.length,
  }));

  const [boardPosition, setBoardPosition] = useState<string>(() => {
    return positions.length > 0 ? positions[0].fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  });

  const [showFinishedDialog, setShowFinishedDialog] = useState(false);

  const handleDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (gameState.status !== 'playing') return false;

      const chess = new Chess(boardPosition);

      // Validate the move is legal
      const possibleMoves = chess.moves({ verbose: true });
      const isLegal = possibleMoves.some(
        (m) => m.from === sourceSquare && m.to === targetSquare,
      );
      if (!isLegal) return false;

      // Make the move
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      } as any);

      if (!move) return false;

      const currentPos = gameState.positions[gameState.currentIndex];
      const correctMove = currentPos.bestMove;

      // Compare using UCI notation from both the played move and the best move
      const playedUci = move.from + move.to + (move.promotion || '');
      const isCorrect = correctMove == playedUci;

      const displayedMove = sourceSquare + targetSquare;

      setBoardPosition(chess.fen());
      setGameState((prev) => ({
        ...prev,
        status: isCorrect ? 'correct' : 'incorrect',
        lastMoveMade: displayedMove,
        lastMoveColor: isCorrect ? 'success' : 'error',
        score: {
          ...prev.score,
          correct: isCorrect ? prev.score.correct + 1 : prev.score.correct,
          incorrect: isCorrect ? prev.score.incorrect : prev.score.incorrect + 1,
        },
      }));

      return true;
    },
    [boardPosition, gameState.status, gameState.positions, gameState.currentIndex],
  );

  const handleNextPosition = useCallback(() => {
    const nextIndex = gameState.currentIndex + 1;
    if (nextIndex >= gameState.positions.length) {
      // Game finished
      setGameState((prev) => ({
        ...prev,
        status: 'finished',
      }));
      setShowFinishedDialog(true);
    } else {
      setGameState((prev) => ({
        ...prev,
        currentIndex: nextIndex,
        status: 'playing',
        lastMoveMade: '',
        lastMoveColor: null,
      }));
      setBoardPosition(gameState.positions[nextIndex].fen);
    }
  }, [gameState.currentIndex, gameState.positions]);

  const handleSkipPosition = useCallback(() => {
    handleNextPosition();
  }, [handleNextPosition]);

  const handleTryAgain = useCallback(() => {
    const currentPos = gameState.positions[gameState.currentIndex];
    setBoardPosition(currentPos.fen);
    setGameState((prev) => ({
      ...prev,
      status: 'playing',
      lastMoveMade: '',
      lastMoveColor: null,
    }));
  }, [gameState.positions, gameState.currentIndex]);

  const handleRestart = useCallback(() => {
    setGameState({
      positions,
      currentIndex: 0,
      score: { correct: 0, incorrect: 0 },
      status: 'playing',
      lastMoveMade: '',
      lastMoveColor: null,
      totalPositions: positions.length,
    });
    if (positions.length > 0) {
      setBoardPosition(positions[0].fen);
    }
    setShowFinishedDialog(false);
  }, [positions]);

  const handleBack = useCallback(() => {
    navigate('/statistics');
  }, [navigate]);

  const currentPos = gameState.positions[gameState.currentIndex];
  const progressPercent =
    gameState.totalPositions > 0
      ? ((gameState.currentIndex + (gameState.status === 'finished' ? 1 : 0)) /
          gameState.totalPositions) *
        100
      : 0;

  if (positions.length === 0) {
    return (
      <Box>
        <Paper sx={{ padding: '2.5em 3.5em' }}>
          <Stack spacing={3}>
            <Typography variant="h5">📚 Entrenador de Posiciones</Typography>
            <Typography variant="body1">
              No se han encontrado posiciones repetidas con errores para entrenar.
            </Typography>
            <Button color="secondary" variant="contained" onClick={handleBack}>
              Atrás
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ padding: '2.5em 3.5em' }}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              📚 Entrenador de Posiciones
            </Typography>
            <Stack direction="row" spacing={2}>
              <Chip
                label={`✅ ${gameState.score.correct}`}
                sx={{
                  backgroundColor: 'rgba(76, 175, 80, 0.15)',
                  color: '#81c784',
                  fontWeight: 600,
                }}
              />
              <Chip
                label={`❌ ${gameState.score.incorrect}`}
                sx={{
                  backgroundColor: 'rgba(244, 67, 54, 0.15)',
                  color: '#e57373',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </Stack>

          {/* Progress */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="body2" color="text.secondary">
                Posición {gameState.currentIndex + 1} de {gameState.totalPositions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round(progressPercent)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>

          {/* Main content - only show board when playing */}
          {gameState.status === 'playing' ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Chessboard
                  boardWidth={450}
                  position={boardPosition}
                  onPieceDrop={handleDrop}
                  boardOrientation={currentPos.side}
                  customBoardStyle={{ borderRadius: '5px' }}
                  customDarkSquareStyle={{ backgroundColor: '#779756' }}
                  customLightSquareStyle={{ backgroundColor: '#edeed3' }}
                  animationDuration={200}
                />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Realiza el mejor movimiento en esta posición
                </Typography>
              </Box>
            </>
          ) : null}

          {/* Feedback when move is made */}
          {(gameState.status === 'correct' || gameState.status === 'incorrect') && (
            <>
              <Alert
                severity={gameState.status === 'correct' ? 'success' : 'error'}
                variant="filled"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {gameState.status === 'correct'
                  ? '¡Correcto! Has encontrado el mejor movimiento.'
                  : `Incorrecto. Movimiento jugado: ${gameState.lastMoveMade}`}
              </Alert>

              {gameState.status === 'incorrect' && (
                <Alert severity="info" variant="outlined">
                  El mejor movimiento era:{' '}
                  <strong>{currentPos.bestMove}</strong>
                </Alert>
              )}

              {/* Show correct move on board after incorrect */}
              {gameState.status === 'incorrect' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Chessboard
                    boardWidth={350}
                    position={boardPosition}
                    arePiecesDraggable={false}
                    boardOrientation={currentPos.side}
                    customBoardStyle={{ borderRadius: '5px' }}
                    customDarkSquareStyle={{ backgroundColor: '#779756' }}
                    customLightSquareStyle={{ backgroundColor: '#edeed3' }}
                  />
                </Box>
              )}

              <Stack direction="row" spacing={2} justifyContent="center" mt={1}>
                {gameState.status === 'incorrect' && (
                  <Button
                    variant="outlined"
                    onClick={handleTryAgain}
                    color="primary"
                  >
                    Intentar de nuevo
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={handleNextPosition}
                  color="primary"
                  autoFocus
                >
                  Siguiente →
                </Button>
              </Stack>
            </>
          )}

          {/* Back button */}
          <Box className="flex-end">
            <Button color="secondary" variant="contained" onClick={handleBack}>
              Atrás
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Finished dialog */}
      <Dialog
        open={showFinishedDialog}
        onClose={() => setShowFinishedDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {gameState.score.correct > gameState.score.incorrect
            ? '🎉 ¡Buen trabajo!'
            : gameState.score.correct === gameState.score.incorrect
              ? '🤔 ¡Nada mal!'
              : '💪 ¡Sigue practicando!'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              {gameState.score.correct}/{gameState.totalPositions}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Has acertado {gameState.score.correct} de {gameState.totalPositions} posiciones.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {gameState.score.correct === gameState.totalPositions
                ? '¡Perfecto! Dominas estas posiciones.'
                : gameState.score.correct >= gameState.totalPositions * 0.7
                  ? '¡Buen conocimiento! Repasa las que fallaste.'
                  : 'Necesitas practicar más estas posiciones recurrentes.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            color="secondary"
            variant="outlined"
            onClick={() => {
              setShowFinishedDialog(false);
              navigate('/statistics');
            }}
          >
            Volver a Estadísticas
          </Button>
          <Button variant="contained" onClick={handleRestart} autoFocus>
            Reiniciar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
