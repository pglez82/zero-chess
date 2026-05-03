import { FastForwardRounded, FastRewindRounded, SkipNextRounded, SkipPreviousRounded } from '@mui/icons-material';
import { Box, Button, Grid, IconButton, Paper, Stack } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import AdviceSummary from './AdviceSummary/AdviceSummary';
import { GameDecorator } from '../../interfaces';
import { Chessboard } from 'react-chessboard';
import AdvantageChart from './AdvantageChart';
import MoveTable from './MoveTable';
import { Chess } from 'chess.js';
import { useMemo, useState } from 'react';

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
  const { analysis } = game.getGame();
  const navigate = useNavigate();

  function replayMoves(index: number) {
    const chess = new Chess();

    for (let i = 0; i < index; i += 1) {
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

  return (
    <Box>
      <Paper sx={{ padding: '2.5em 3.5em', maxWidth: '57em' }}>
        <Grid container spacing={5}>
          <Grid item xs={7}>
            <Chessboard
              boardWidth={500}
              position={boardPosition}
              arePiecesDraggable={false}
              boardOrientation={game.getSide(username)}
              customBoardStyle={{ borderRadius: '5px' }}
            />
          </Grid>
          <Grid item xs={5}>
            <MoveTable
              moves={moves}
              currentIndex={currentIndex}
              advantage={analysis!.advantage}
              onMoveClick={replayMoves}
            />
          </Grid>
          <Grid item xs={7}>
            <AdvantageChart advantage={analysis!.advantage} />
          </Grid>
          <Grid item xs={5}>
            <Stack sx={{ height: '100%' }} justifyContent="space-between">
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
