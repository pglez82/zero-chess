import {
  FastForwardRounded,
  FastRewindRounded,
  OpenInNewRounded,
  SwapHorizRounded,
  SkipNextRounded,
  SkipPreviousRounded,
  ArrowBack,
  PsychologyRounded,
} from '@mui/icons-material';
import { Box, Button, Grid, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import AdviceSummary from './AdviceSummary/AdviceSummary';
import { GameDecorator, formatBestLine } from '../../interfaces';
import { Chessboard } from 'react-chessboard';
import AdvantageChart from './AdvantageChart';
import MoveTable from './MoveTable';
import { Chess } from 'chess.js';
import { useMemo, useState, useEffect } from 'react';

function formatScore(score: { type: 'cp'; value: number } | { type: 'mate'; value: number }): string {
  if (score.type === 'cp') {
    const pawns = (score.value / 100).toFixed(2);
    return score.value >= 0 ? `+${pawns}` : pawns;
  }
  // Mate
  const sign = score.value > 0 ? '+' : '-';
  return `${sign}M${Math.abs(score.value)}`;
}

function fenToLichessUrl(fen: string): string {
  // FEN format: pieces activeColor castling noCastling halfMove fullMove
  const parts = fen.split(' ');
  if (parts.length < 6) {
    return `https://lichess.org/analysis/${encodeURIComponent(fen)}_${parts[1] || 'w'}_KQkq_-_0_1`;
  }
  const [, activeColor, castling = 'KQkq', halfMove, fullMove] = parts;
  return `https://lichess.org/analysis/${fen}_${activeColor}_${castling}_-${halfMove}_${fullMove}`;
}

export default function GameAnalysis() {
  const { username, game, position } = useLocation().state as {
    game: GameDecorator;
    username: string;
    position?: string;
  };
  const moves = game.getGameMoves();
  
  // Find the move index that matches the loaded FEN
  const startingIndex = useMemo(() => {
    if (!position) return 0;
    const chess = new Chess();
    for (let i = 0; i < moves.length; i++) {
      chess.move(moves[i]);
      if (chess.fen() === position) {
        return i + 1; // currentIndex represents moves applied
      }
    }
    return 0;
  }, [moves, position]);

  const initialPosition = useMemo(() => {
    if (position) return position;
    if (moves.length > 0) {
      const chess = new Chess();
      try {
        chess.move(moves[0]);
        return chess.fen();
      } catch {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
      }
    }
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  }, [moves, position]);

  const [boardPosition, setBoardPosition] = useState(initialPosition);
  const [currentIndex, setCurrentIndex] = useState(startingIndex);
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const { analysis } = game.getGame();
  const navigate = useNavigate();

  function replayMoves(index: number) {
    const chess = new Chess();

    for (let i = 0; i <= index && i < moves.length; i += 1) {
      chess.move(moves[i]);
    }

    setBoardPosition(chess.fen());
    setCurrentIndex(index);
  }

  const handleBottom = () => {
    replayMoves(0);
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      replayMoves(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < moves.length) {
      replayMoves(currentIndex + 1);
    }
  };

  const handleTop = () => {
    replayMoves(moves.length);
  };

  const handleNavigate = () => {
    navigate('/games');
  };

  const handleFlipBoard = () => {
    setIsBoardFlipped(!isBoardFlipped);
  };

  const handleOpenLichess = () => {
    const url = fenToLichessUrl(boardPosition);
    window.open(url, '_blank');
  };

  // Keyboard navigation support for fluid analysis
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tagName = (event.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(tagName)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIndex > 0) {
          replayMoves(currentIndex - 1);
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex < moves.length) {
          replayMoves(currentIndex + 1);
        }
      } else if (event.key === 'Home' || event.key === 'ArrowUp') {
        event.preventDefault();
        replayMoves(0);
      } else if (event.key === 'End' || event.key === 'ArrowDown') {
        event.preventDefault();
        replayMoves(moves.length);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsBoardFlipped((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, moves]);

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ padding: '2rem 2.5rem', maxWidth: '62em', width: '100%' }}>
        <Grid container spacing={4}>
          {/* Left Column: Board and Engine Lines */}
          <Grid item xs={7}>
            <Box
              sx={{
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'inline-block',
              }}
            >
              <Chessboard
                boardWidth={490}
                position={boardPosition}
                arePiecesDraggable={false}
                boardOrientation={isBoardFlipped ? game.getOpponentSide(username) : game.getSide(username)}
                customBoardStyle={{ borderRadius: '8px' }}
                customDarkSquareStyle={{ backgroundColor: '#779756' }}
                customLightSquareStyle={{ backgroundColor: '#edeed3' }}
              />
            </Box>

            {analysis && analysis.bestLines && analysis.scores && currentIndex < moves.length && (
              <Box
                sx={{
                  mt: 1.5,
                  p: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderRadius: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Box
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    px: 1.2,
                    py: 0.35,
                    borderRadius: '6px',
                    color: '#1a1a1a',
                    backgroundColor: analysis.scores[currentIndex]?.type === 'cp'
                      ? (analysis.scores[currentIndex]!.value >= 0 ? '#a5d6a7' : '#ef9a9a')
                      : '#fff59d',
                  }}
                >
                  {formatScore(analysis.scores[currentIndex]!)}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <PsychologyRounded sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                      overflow: 'auto',
                      color: 'text.primary',
                    }}
                  >
                    {game?.parseBestLine
                      ? game.parseBestLine(analysis.bestLines[currentIndex]!, boardPosition)
                      : formatBestLine(analysis.bestLines[currentIndex]!, boardPosition)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Grid>

          {/* Right Column: Move Table */}
          <Grid item xs={5}>
            <MoveTable
              moves={moves}
              currentIndex={currentIndex}
              advantage={analysis!.advantage}
              onMoveClick={replayMoves}
              inaccuracies={analysis?.inaccuracies}
              mistakes={analysis?.mistakes}
              blunders={analysis?.blunders}
            />
          </Grid>

          {/* Bottom Left: Advantage Chart */}
          <Grid item xs={7}>
            <AdvantageChart
              advantage={analysis?.advantage || []}
              currentIndex={currentIndex}
              onMoveClick={replayMoves}
              moves={moves}
            />
          </Grid>

          {/* Bottom Right: Controls & Summary */}
          <Grid item xs={5}>
            <Stack sx={{ height: '100%' }} justifyContent="space-between" spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Navegación: ← → • F girar
                </Typography>
                <Tooltip title="Abrir esta posición en Lichess">
                  <IconButton
                    onClick={handleOpenLichess}
                    size="small"
                    sx={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                    }}
                  >
                    <OpenInNewRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-evenly"
                alignItems="center"
                sx={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 2,
                  py: 0.5,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Tooltip title="Primera jugada (Inicio)">
                  <IconButton onClick={handleBottom} size="medium">
                    <FastRewindRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Jugada anterior (←)">
                  <IconButton onClick={handleBack} size="medium">
                    <SkipPreviousRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Siguiente jugada (→)">
                  <IconButton onClick={handleNext} size="medium">
                    <SkipNextRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Última jugada (Fin)">
                  <IconButton onClick={handleTop} size="medium">
                    <FastForwardRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Girar tablero (F)">
                  <IconButton onClick={handleFlipBoard} size="medium">
                    <SwapHorizRounded />
                  </IconButton>
                </Tooltip>
              </Stack>

              <AdviceSummary game={game} />

              <Button
                fullWidth
                color="secondary"
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handleNavigate}
                size="large"
                sx={{ fontWeight: 600 }}
              >
                Atrás
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
