import { parseAdvantage } from '../../main/services/engine/engineService';
import { LineChart, ChartsReferenceLine } from '@mui/x-charts';
import { Box, Typography } from '@mui/material';
import { useMemo, useRef } from 'react';

export default function AdvantageChart({
  advantage,
  currentIndex,
  onMoveClick,
  moves,
}: {
  advantage: (number | string)[];
  currentIndex?: number;
  onMoveClick?: (moveIndex: number) => void;
  moves?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handledEventRef = useRef<Event | null>(null);

  const parsedAdvantage = useMemo(
    () => parseAdvantage(advantage || []),
    [advantage],
  );

  const hasValidIndex =
    typeof currentIndex === 'number' &&
    currentIndex >= 0 &&
    parsedAdvantage.length > 0;

  const activeMoveIndex = hasValidIndex
    ? Math.min(currentIndex, parsedAdvantage.length - 1)
    : -1;

  const handleAxisClick = (
    event: MouseEvent,
    data: { dataIndex?: number } | null,
  ) => {
    if (data && typeof data.dataIndex === 'number' && onMoveClick) {
      handledEventRef.current = event;
      onMoveClick(data.dataIndex);
    }
  };

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (handledEventRef.current === event.nativeEvent) {
      return;
    }
    if (!onMoveClick || parsedAdvantage.length === 0) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const svgElement = container.querySelector('svg');
    const rect = svgElement
      ? svgElement.getBoundingClientRect()
      : container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const left = 10;
    const right = 10;
    const drawingWidth = rect.width - left - right;
    if (drawingWidth <= 0) return;

    const ratio = (clickX - left) / drawingWidth;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const index = Math.round(clampedRatio * (parsedAdvantage.length - 1));
    onMoveClick(index);
  };

  const formatMoveHeader = () => {
    if (activeMoveIndex < 0 || activeMoveIndex >= parsedAdvantage.length) {
      return null;
    }
    const val = parsedAdvantage[activeMoveIndex];
    const formattedVal = (val <= 0 ? '' : '+') + val.toFixed(1);
    if (moves && moves[activeMoveIndex]) {
      const moveNumber = Math.floor(activeMoveIndex / 2) + 1;
      const isWhite = activeMoveIndex % 2 === 0;
      return `${moveNumber}${isWhite ? '.' : '...'} ${moves[activeMoveIndex]} (${formattedVal})`;
    }
    return `Jugada ${activeMoveIndex + 1} (${formattedVal})`;
  };

  return (
    <Box
      ref={containerRef}
      onClick={handleContainerClick}
      data-testid="advantage-chart-container"
      sx={{
        p: 1.5,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: onMoveClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5,
          px: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Gráfico de ventaja (+ Blancas / - Negras)
        </Typography>
        {activeMoveIndex >= 0 && (
          <Typography
            variant="caption"
            sx={{
              color: '#90caf9',
              fontWeight: 600,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {formatMoveHeader()}
          </Typography>
        )}
      </Box>

      {parsedAdvantage.length === 0 ? (
        <Box
          sx={{
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Sin datos de análisis
          </Typography>
        </Box>
      ) : (
        <LineChart
          series={[
            {
              data: parsedAdvantage,
              area: true,
              color: '#FFAE80',
              showMark: ({ index }) => index === activeMoveIndex,
              valueFormatter: (v) =>
                v !== null ? `Ventaja: ${(v <= 0 ? '' : '+') + v.toFixed(1)}` : '',
            },
          ]}
          xAxis={[
            {
              data: Array.from({ length: parsedAdvantage.length }, (_, i) => i),
              scaleType: 'point',
              valueFormatter: (index: number) => {
                if (moves && moves[index]) {
                  const moveNumber = Math.floor(index / 2) + 1;
                  const isWhite = index % 2 === 0;
                  return `${moveNumber}${isWhite ? '.' : '...'} ${moves[index]}`;
                }
                return `Jugada ${index + 1}`;
              },
            },
          ]}
          width={490}
          height={220}
          margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
          bottomAxis={null}
          leftAxis={null}
          topAxis={null}
          rightAxis={null}
          skipAnimation
          axisHighlight={{ x: 'line' }}
          onAxisClick={handleAxisClick}
          sx={{
            cursor: onMoveClick ? 'pointer' : 'default',
            '& .MuiChartsAxisHighlight-root': {
              stroke: 'rgba(255, 255, 255, 0.4)',
              strokeDasharray: '3 3',
            },
            '& .MuiMarkElement-root': {
              fill: '#90caf9',
              stroke: '#ffffff',
              strokeWidth: 2,
              r: 5,
            },
          }}
        >
          {activeMoveIndex >= 0 && (
            <ChartsReferenceLine
              x={activeMoveIndex}
              lineStyle={{
                stroke: '#90caf9',
                strokeWidth: 2,
                strokeDasharray: '4 4',
              }}
            />
          )}
        </LineChart>
      )}
    </Box>
  );
}
