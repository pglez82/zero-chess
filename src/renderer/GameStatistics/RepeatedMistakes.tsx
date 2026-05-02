import React, { useMemo } from 'react';
import { GameDecorator } from '../../interfaces';
import { Chess } from 'chess.js';
import { 
  List, 
  ListItem, 
  ListItemText, 
  Typography, 
  Paper, 
  Divider,
  Box
} from '@mui/material';

interface RepeatedMistakesProps {
  games: GameDecorator[];
}

interface MistakePosition {
  fen: string;
  count: number;
  moves: string[];
}

export default function RepeatedMistakes({ games }: RepeatedMistakesProps) {
  const repeatedPositions = useMemo(() => {
    const counts: { [key: string]: { count: number; moves: string[] } } = {};

    games.forEach((game) => {
      const analysis = game.getGame().analysis;
      if (!analysis) return;

      const mistakes = analysis.mistakes as { whitePlayer?: any; blackPlayer?: any };
      const whiteMistakes = Array.isArray(mistakes.whitePlayer) ? mistakes.whitePlayer : [];
      const blackMistakes = Array.isArray(mistakes.blackPlayer) ? mistakes.blackPlayer : [];
      const allMistakeIndices = [...whiteMistakes, ...blackMistakes];

      const chess = new Chess();
      const moves = game.getGameMoves();
      
      // We need to keep track of FENs at each move
      // The indices in mistakes refer to the index in the moves array (where move i happened)
      // Actually, the way we implemented calculateErrors:
      // i is the index in parsedAdvantage where unshift(0) was called.
      // If i=0, it's before the first move.
      // If i=1, it's after the first move.
      // In getGameCentipawns, it loops i from 0 to moves.length - 1.
      // So if i=0 is the first move, then i is the index of the move that caused the error.

      // Let's re-verify the index in calculateErrors.
      // If i=0, difference = advantage[0] - advantage[1].
      // advantage[0] is the initial position.
      // advantage[1] is after move 1.
      // So the error happened WITH move 1.
      // The index in moves array is 0.

      // Wait, if we want to show the position BEFORE the mistake:
      // For index 0, it's the initial position.
      // For index 1, it's the position after move 1.

      // Let's build the FENs for each move.
      const fens: string[] = [chess.fen()];
      for (const move of moves) {
        try {
          chess.move(move);
          fens.push(chess.fen());
        } catch (e) {
          break;
        }
      }

      allMistakeIndices.forEach((idx) => {
        // idx is the index in the advantage array (after unshift).
        // Since we unshifted 0, idx 0 corresponds to the initial position.
        // If idx represents the move that was made, then the position BEFORE the move is fens[idx].
        // Let's check: if idx=0, it's the move 1. The position before move 1 is fens[0].
        // If idx=1, it's the move 2. The position before move 2 is fens[1].
        // So the FEN is fens[idx].
        
        const fen = fens[idx];
        if (fen) {
          if (counts[fen]) {
            counts[fen].count += 1;
          } else {
            counts[fen] = { count: 1, moves: moves.slice(0, idx) };
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
      }))
      .sort((a, b) => b.count - a.count);
  }, [games]);

  if (repeatedPositions.length === 0) {
    return (
      <Paper sx={{ padding: 2, mt: 2 }}>
        <Typography variant="body1">No se han encontrado errores repetidos.</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ padding: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Posiciones con errores repetidos
      </Typography>
      <List>
        {repeatedPositions.map((pos, index) => (
          <React.Fragment key={index}>
            <ListItem alignItems="flex-start">
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
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
}
