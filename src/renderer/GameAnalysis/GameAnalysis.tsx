import { FastForwardRounded, FastRewindRounded, OpenInNewRounded, SwapHorizRounded, SkipNextRounded, SkipPreviousRounded } from '@mui/icons-material';
import { Box, Button, Grid, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import AdviceSummary from './AdviceSummary/AdviceSummary';
import { GameDecorator } from '../../interfaces';
import { Chessboard } from 'react-chessboard';
import AdvantageChart from './AdvantageChart';
import MoveTable from './MoveTable';
import { Chess } from 'chess.js';
import { useMemo, useState } from 'react';

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

function formatBestLine(bestLine: string, moveNumber: number): string {
  const movesArr = bestLine.split(/\s+/);
  let formatted = '';
  for (let i = 0; i < movesArr.length; i += 2) {
    const num = moveNumber + Math.floor(i / 2) + 1;
    formatted += `${num}. ${movesArr[i]}`;
    if (i + 1 < movesArr.length) {
      formatted += ` ${movesArr[i + 1]}`;
    }
    formatted += ' ';
  }
  return formatted.trim();
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

  const [boardPosition, setBoardPosition] = useState(
    position || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  );
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

  return (
    <Box>
      <Paper sx={{ padding: '2.5em 3.5em', maxWidth: '57em' }}>
        <Grid container spacing={5}>
          <Grid item xs={7}>
            <Chessboard
              boardWidth={500}
              position={boardPosition}
              arePiecesDraggable={false}
              boardOrientation={isBoardFlipped ? game.getOpponentSide(username) : game.getSide(username)}
              customBoardStyle={{ borderRadius: '5px' }}
            />
            {analysis && analysis.bestLines && analysis.scores && currentIndex < moves.length && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    px: 1,
                    borderRadius: 1,
                    backgroundColor: analysis.scores[currentIndex]?.type === 'cp'
                      ? (analysis.scores[currentIndex]!.value >= 0 ? '#c8e6c9' : '#ffcdd2')
                      : '#fff9c4',
                  }}
                >
                  {formatScore(analysis.scores[currentIndex]!)}
                </Box>
                <Box
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    overflow: 'auto',
                    maxWidth: '100%',
                  }}
                >
                  {formatBestLine(analysis.bestLines[currentIndex]!, Math.floor(currentIndex / 2))}
                </Box>
              </Box>
            )}
          </Grid>
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
          <Grid item xs={7}>
            <AdvantageChart advantage={analysis!.advantage} />
          </Grid>
          <Grid item xs={5}>
            <Stack sx={{ height: '100%' }} justifyContent="space-between">
              <Tooltip title="Open position in Lichess">
                <IconButton onClick={handleOpenLichess}>
                  <OpenInNewRounded />
                </IconButton>
              </Tooltip>
              <Stack direction="row" justifyContent="space-evenly">
                <IconButton onClick={handleBottom}>
                  <FastRewindRounded />
                </IconButton>
                <IconButton onClick={handleBack}>
                  <SkipPreviousRounded />
                </IconButton>
                <IconButton onClick={handleNext}>
                  <SkipNextRounded />
                </IconButton>
                <IconButton onClick={handleTop}>
                  <FastForwardRounded />
                </IconButton>
                <IconButton onClick={handleFlipBoard}>
                  <SwapHorizRounded />
                </IconButton>
              </Stack>
              <AdviceSummary game={game} />
              <Button
                fullWidth
                color="secondary"
                variant="contained"
                onClick={handleNavigate}
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
