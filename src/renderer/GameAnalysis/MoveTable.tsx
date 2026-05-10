import { TableRow, TableCell, Table, TableBody, Box, SxProps, Theme, styled } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ERROR_COLORS } from './errorColors';

// Styled components for clickable move cells
const ClickableTableCell = styled(TableCell)(
  ({ theme }) => ({
    cursor: 'pointer',
    transition: 'background-color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  }),
);

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
        color: 'black',
        backgroundColor: errorColor,
      };
    }

    return isCurrent
      ? {
          color: 'black',
          border: '2px solid white',
        }
      : {
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
      >
        <TableCell>{i / 2 + 1}</TableCell>
        <TableCell
          sx={getCellStyle(whiteMoveIndex, currentIndex === whiteMoveIndex)}
          onClick={() => handleMoveClick(whiteMoveIndex)}
          onMouseEnter={() => handleMoveMouseEnter(whiteMoveIndex)}
          onMouseLeave={handleMoveMouseLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{moves[whiteMoveIndex]}</span>
            <span>{formatAdvantage(advantage[whiteMoveIndex])}</span>
          </div>
        </TableCell>
        <TableCell
          sx={getCellStyle(blackMoveIndex, currentIndex === blackMoveIndex)}
          onClick={() => handleMoveClick(blackMoveIndex)}
          onMouseEnter={() => handleMoveMouseEnter(blackMoveIndex)}
          onMouseLeave={handleMoveMouseLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{moves[blackMoveIndex] || ''}</span>
            <span>{formatAdvantage(advantage[blackMoveIndex])}</span>
          </div>
        </TableCell>
      </TableRow>,
    );
  }

  return (
    <Box sx={{ maxHeight: '31.15em', overflow: 'auto', border: 1 }}>
      <Table>
        <TableBody>{tableRows}</TableBody>
      </Table>
    </Box>
  );
}
