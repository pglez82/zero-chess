import { BarChart } from '@mui/x-charts';
import { Box } from '@mui/material';

export default function StatsBarChart({
  keys,
  title,
  values,
}: {
  title: string;
  keys: string[];
  values: number[];
}) {
  return (
    <Box
      className="box"
      sx={{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 2,
        p: 1.5,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
      }}
    >
      <h3 className="h3-margin" style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', fontWeight: 600, color: '#e0e0e0' }}>
        {title}
      </h3>
      {keys.length > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <BarChart
            width={200}
            height={160}
            series={[{ data: values, color: '#FFAE80' }]}
            xAxis={[{ scaleType: 'band', data: keys }]}
          />
        </Box>
      ) : (
        <Box className="centered-text" sx={{ height: '160px' }}>
          <p style={{ margin: 0 }}>¡Juega más partidas!</p>
        </Box>
      )}
    </Box>
  );
}
