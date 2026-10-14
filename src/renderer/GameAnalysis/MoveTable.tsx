import {
  TableRow,
  TableCell,
  Table,
  TableBody,
  Box,
  SxProps,
  Theme,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ERROR_COLORS } from './errorColors';

export default function MoveTable({
  moves,
  advantage,
  currentIndex,
  onMoveClick,
  inaccuracies,
  mistakes,
  blunders,
}: {
  moves: string[];
  advantage: number[];
  currentIndex: number;
  onMoveClick?: (moveIndex: number) => void;
  inaccuracies?: { whitePlayer: number[]; blackPlayer: number[] };
  mistakes?: { whitePlayer: number[]; blackPlayer: number[] };
  blunders?: { whitePlayer: number[]; blackPlayer: number[] };
}) {
  const tableRows = [];
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  function scrollTo(cellIndex: number) {
    rowRefs.current[cellIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }

  useEffect(() => {
    let cellIndex = currentIndex;
    if (currentIndex === 0) {
      cellIndex += 1;
    }
    if (currentIndex === moves.length) {
      cellIndex += -1;
    }

    scrollTo(cellIndex);
  }, [currentIndex, moves.length]);

  function formatAdvantage(rawAdvantage: number | string) {
    switch (typeof rawAdvantage) {
      case 'undefined': {
        return '';
      }
      case 'string': {
        return rawAdvantage;
      }
      default: {
        const formattedNumber = rawAdvantage.toFixed(1);
        return (rawAdvantage <= 0 ? '' : '+') + formattedNumber;
      }
    }
  }

  function getMoveErrorColor(moveIndex: number): string | undefined {
    const isWhiteMove = moveIndex % 2 === 0;
    const side = isWhiteMove ? 'whitePlayer' : 'blackPlayer';

    if (blunders?.[side]?.includes(moveIndex)) return ERROR_COLORS.blunders;
    if (mistakes?.[side]?.includes(moveIndex)) return ERROR_COLORS.mistakes;
    if (inaccuracies?.[side]?.includes(moveIndex)) return ERROR_COLORS.inaccuracies;
    return undefined;
  }

  function getCellStyle(moveIndex: number, isCurrent: boolean): SxProps<Theme> {
    const isHovered = hoveredIndex === moveIndex;
    const errorColor = getMoveErrorColor(moveIndex);

    if (errorColor) {
      return {
        color: '#1a1a1a',
        backgroundColor: errorColor,
        fontWeight: 600,
        cursor: 'pointer',
        borderRadius: '4px',
      };
    }

    return isCurrent
      ? {
          backgroundColor: 'rgba(144, 202, 249, 0.22)',
          border: '2px solid #90caf9',
          borderRadius: '4px',
          fontWeight: 700,
          cursor: 'pointer',
        }
      : {
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: isHovered
            ? (theme: Theme) => theme.palette.action.hover
            : 'inherit',
        };
  }

  function handleMoveClick(index: number) {
    if (onMoveClick) {
      onMoveClick(index);
    }
  }

  function handleMoveMouseEnter(index: number) {
    setHoveredIndex(index);
  }

  function handleMoveMouseLeave() {
    setHoveredIndex(null);
  }

  for (let i = 0; i < moves.length; i += 2) {
    const whiteMoveIndex = i;
    const blackMoveIndex = i + 1;

    tableRows.push(
      <TableRow
        key={i}
        ref={(el) => {
          rowRefs.current[i + 1] = el;
        }}
        sx={{
          '&:nth-of-type(odd)': {
            backgroundColor: 'rgba(255, 255, 255, 0.015)',
          },
        }}
      >
        <TableCell
          sx={{
            py: 1,
            px: 1.5,
            width: '45px',
            color: 'text.secondary',
            fontSize: '0.8rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {i / 2 + 1}
        </TableCell>
        <TableCell
          sx={{
            ...getCellStyle(whiteMoveIndex, currentIndex === whiteMoveIndex),
            py: 1,
            px: 1.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
          onClick={() => handleMoveClick(whiteMoveIndex)}
          onMouseEnter={() => handleMoveMouseEnter(whiteMoveIndex)}
          onMouseLeave={handleMoveMouseLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{moves[whiteMoveIndex]}</span>
            <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
              {formatAdvantage(advantage[whiteMoveIndex])}
            </span>
          </div>
        </TableCell>
        <TableCell
          sx={{
            ...getCellStyle(blackMoveIndex, currentIndex === blackMoveIndex),
            py: 1,
            px: 1.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
          onClick={() => handleMoveClick(blackMoveIndex)}
          onMouseEnter={() => handleMoveMouseEnter(blackMoveIndex)}
          onMouseLeave={handleMoveMouseLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{moves[blackMoveIndex] || ''}</span>
            <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
              {formatAdvantage(advantage[blackMoveIndex])}
            </span>
          </div>
        </TableCell>
      </TableRow>,
    );
  }

  return (
    <Box
      sx={{
        maxHeight: '31.15em',
        overflow: 'auto',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
      }}
    >
      <Table size="small" stickyHeader>
        <TableBody>{tableRows}</TableBody>
      </Table>
    </Box>
  );
}
