import {
  Checkbox,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Stack,
  ListItemText,
  IconButton,
  Chip,
  Box,
} from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import { useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import ReactTimeAgo from 'react-time-ago';
import Versus from '../../../assets/images/versus.png';
import { GameDecorator } from '../../interfaces';
import './GameList.css';

export default function GameTile({
  game,
  index,
  checked,
  username,
  handleToggle,
}: {
  index: number;
  username: string;
  checked: number[];
  game: GameDecorator;
  handleToggle: (value: number) => void;
}) {
  const navigate = useNavigate();
  const rawGame = game.getGame();
  const labelId = `checkbox-list-label-${rawGame.id}`;

  const playerSide = game.getSide(username);
  const accuracy = rawGame.analysis?.accuracy?.[`${playerSide}PlayerAverage`];

  const whiteRating = rawGame.players.white?.rating;
  const blackRating = rawGame.players.black?.rating;

  const handleClick = () => {
    const { analysis } = rawGame;
    if (analysis) {
      navigate('/analysis', { state: { username, game } });
    } else {
      handleToggle(index);
    }
  };

  return (
    <ListItem key={rawGame.id} className="game-tile-item">
      <ListItemButton
        aria-label="gameTile"
        onClick={handleClick}
        className="game-tile-button"
        sx={{ borderRadius: '10px' }}
      >
        <ListItemIcon sx={{ alignItems: 'center', minWidth: 'auto', gap: 1.5 }}>
          <Box
            sx={{
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
            }}
          >
            <Chessboard
              boardWidth={180}
              arePiecesDraggable={false}
              position={game.parsePosition()}
              boardOrientation={game.getSide(username)}
              customBoardStyle={{ borderRadius: '8px' }}
              customDarkSquareStyle={{ backgroundColor: '#779756' }}
              customLightSquareStyle={{ backgroundColor: '#edeed3' }}
            />
          </Box>
          {rawGame.analysis ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mx: 0.5 }}>
              <IconButton disableRipple sx={{ color: 'success.main', p: 0.5 }}>
                <DoneIcon />
              </IconButton>
              {typeof accuracy === 'number' && (
                <Chip
                  size="small"
                  label={`${Math.round(accuracy)}%`}
                  className="accuracy-chip"
                />
              )}
            </Box>
          ) : (
            <Checkbox
              disableRipple
              sx={{ mx: 0.5 }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(index);
              }}
              checked={checked.indexOf(index) !== -1}
              inputProps={{ 'aria-labelledby': labelId }}
            />
          )}
        </ListItemIcon>
        <ListItemText>
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
            >
              <p className="variant">{`${game.parseGameClock()} • ${rawGame.perf.toUpperCase()} • ${
                rawGame.rated ? 'POR PUNTOS' : 'AMISTOSA'
              }`}</p>
              <ReactTimeAgo date={rawGame.createdAt} locale="es" />
            </Stack>

            <Stack spacing={0.5}>
              <div className="versus-container">
                <div className="versus-player-white">
                  <span>⚪</span>
                  <p style={{ margin: 0 }}>
                    {game.parsePlayerName('white')}
                    {whiteRating ? (
                      <span className="versus-rating">{` (${whiteRating})`}</span>
                    ) : null}
                  </p>
                </div>
                <img src={Versus} alt="" style={{ height: '14px', opacity: 0.7 }} />
                <div className="versus-player-black">
                  <span>⚫</span>
                  <p style={{ margin: 0 }}>
                    {game.parsePlayerName('black')}
                    {blackRating ? (
                      <span className="versus-rating">{` (${blackRating})`}</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <p
                className={`status ${game.getStatusColor(username)}`}
              >{`${game.parseGameStatus()} ${game.parseGameWinner()}`}</p>
            </Stack>

            <p className="moves">{game.parseGameMoves()}</p>
          </Stack>
        </ListItemText>
      </ListItemButton>
    </ListItem>
  );
}
