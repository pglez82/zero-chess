import { Circle, PanoramaFishEye } from '@mui/icons-material';
import { GameDecorator } from '../../../interfaces';
import { Stack } from '@mui/material';
import './AdviceSummary.css';

export default function AdviceSummarySide({
  side,
  game,
}: {
  side: string;
  game: GameDecorator;
}) {
  const Icon = side === 'white' ? Circle : PanoramaFishEye;
  const analysis = game.getGame().analysis;
  const sideInaccuracies = analysis?.inaccuracies?.[`${side}Player`] ?? [];
  const sideMistakes = analysis?.mistakes?.[`${side}Player`] ?? [];
  const sideBlunders = analysis?.blunders?.[`${side}Player`] ?? [];

  return (
    <Stack className="stack">
      <div className="row">
        <Icon sx={{ flex: '0 1 4ch', fontSize: '1.5em' }} />
        <span>{game.parsePlayerName(side)}</span>
      </div>
      <div className={`row ${sideInaccuracies.length > 0 ? 'inaccuracies' : ''}`}>
        <span>{sideInaccuracies.length}</span>
        <span>{sideInaccuracies.length === 1 ? 'imprecisión' : 'imprecisiones'}</span>
      </div>
      <div className={`row ${sideMistakes.length > 0 ? 'mistakes' : ''}`}>
        <span>{sideMistakes.length}</span>
        <span>{sideMistakes.length === 1 ? 'error' : 'errores'}</span>
      </div>
      <div className={`row ${sideBlunders.length > 0 ? 'blunders' : ''}`}>
        <span>{sideBlunders.length}</span>
        <span>{sideBlunders.length === 1 ? 'error grave' : 'errores graves'}</span>
      </div>
      <div className="row">
        <span>{Math.round(analysis?.accuracy?.[`${side}PlayerAverage`] ?? 0)}%</span>
        <span>Precisión</span>
      </div>
    </Stack>
  );
}
