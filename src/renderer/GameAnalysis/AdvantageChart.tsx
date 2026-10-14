import { parseAdvantage } from '../../main/services/engine/engineService';
import { SparkLineChart } from '@mui/x-charts';
import { Box, Typography } from '@mui/material';

export default function AdvantageChart({
  advantage,
}: {
  advantage: (number | string)[];
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          mb: 0.5,
          pl: 1,
        }}
      >
        Gráfico de ventaja (+ Blancas / - Negras)
      </Typography>
      <SparkLineChart
        area
        showTooltip
        width={490}
        height={220}
        showHighlight
        colors={['#FFAE80']}
        data={parseAdvantage(advantage)}
        valueFormatter={(v) => {
          return `Ventaja: ${(v! <= 0 ? '' : '+') + v!.toFixed(1)}`;
        }}
      />
    </Box>
  );
}
