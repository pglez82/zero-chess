import { PieChart } from '@mui/x-charts';
import { Box } from '@mui/material';

export default function StatsPieChart({
  data,
  title,
}: {
  data: any[];
  title: string;
}) {
  const filteredData = data.filter((item) => item.value > 0);

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
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', fontWeight: 600, color: '#e0e0e0' }}>
        {title}
      </h3>
      {filteredData.length > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <PieChart
            series={[
              {
                innerRadius: 36,
                paddingAngle: 4,
                cornerRadius: 4,
                data: filteredData,
              },
            ]}
            width={180}
            height={160}
            slotProps={{ legend: { hidden: true } }}
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
