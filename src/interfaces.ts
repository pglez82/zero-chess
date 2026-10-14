import { Chess } from 'chess.js';

export interface Clock {
  initial: number;
  increment: number;
  totalTime: number;
}

export interface Player {
  rating?: number;
  aiLevel?: number;
  ratingDiff?: number;
  user?: {
    id: string;
    name: string;
  };
}

export interface AnalysisScore {
  type: 'cp' | 'mate';
  value: number;
}

export interface GameAnalysis {
  advantage?: any;
  accuracy?: any;
  mistakes?: any;
  inaccuracies?: any;
  blunders?: any;
  scores?: AnalysisScore[];
  bestLines?: any;
  [key: string]: any;
}

export interface RepeatedMistakePosition {
  fen: string;
  count: number;
  moves: string[];
  bestMove: string;
  side: 'white' | 'black';
  gameId: string;
  errorMagnitude?: number;
}

export interface Game {
  id: string;
  perf: string;
  clock?: Clock;
  speed: string;
  moves: string;
  source: string;
  rated: boolean;
  status: string;
  winner: string;
  variant: string;
  createdAt: number;
  lastMoveAt: number;
  players: {
    black: Player;
    white: Player;
  };
  analysis?: GameAnalysis;
}

export interface Engine {
  started: number;
  ready?: boolean;
  loaded?: boolean;
  quit: () => void;
  stop_moves: () => void;
  get_cue_len: () => number;
  stream?: (data: string) => void;
  send: (
    cmd: string,
    cb?: (response: string) => void,
    stream?: (response: string) => void,
  ) => void;
}

function invertUciMove(move: string): string {
  const match = move.match(/^([a-h])([1-8])([a-h])([1-8])([qrbnQRBN])?$/);
  if (match) {
    const fromFile = match[1];
    const fromRank = 8 - parseInt(match[2], 10) + 1;
    const toFile = match[3];
    const toRank = 8 - parseInt(match[4], 10) + 1;
    const promotion = match[5] || '';
    return `${fromFile}${fromRank}${toFile}${toRank}${promotion}`;
  }
  return move;
}

export function formatBestLine(
  bestLine: string,
  fenOrMoveNumber?: string | number,
): string {
  if (!bestLine || !bestLine.trim()) {
    return '';
  }

  let chess: Chess | undefined;
  if (typeof fenOrMoveNumber === 'string' && fenOrMoveNumber.includes('/')) {
    try {
      chess = new Chess(fenOrMoveNumber);
    } catch {
      chess = undefined;
    }
  }

  let movesArr = bestLine
    .trim()
    .split(/\s+/)
    .filter((m) => !/^\d+\.+$/.test(m));

  // Fallback when no valid FEN position was provided
  if (!chess) {
    const startMove = typeof fenOrMoveNumber === 'number' ? fenOrMoveNumber : 1;
    const formatted: string[] = [];
    for (let i = 0; i < movesArr.length; i += 2) {
      const num = startMove + Math.floor(i / 2);
      formatted.push(
        `${num}. ${movesArr[i]}${movesArr[i + 1] ? ` ${movesArr[i + 1]}` : ''}`,
      );
    }
    return formatted.join(' ');
  }

  // Handle potential legacy inverted moves from earlier engine bug
  if (movesArr.length > 0) {
    let firstMoveValid = false;
    try {
      const test = chess.move(movesArr[0]);
      if (test) {
        firstMoveValid = true;
        chess.undo();
      }
    } catch {
      firstMoveValid = false;
    }

    if (!firstMoveValid) {
      try {
        const testInverted = chess.move(invertUciMove(movesArr[0]));
        if (testInverted) {
          chess.undo();
          movesArr = movesArr.map(invertUciMove);
        }
      } catch {
        // Keep original movesArr
      }
    }
  }

  const formattedParts: string[] = [];
  for (let i = 0; i < movesArr.length; i += 1) {
    const uci = movesArr[i];
    const turn = chess.turn();
    const moveNum = chess.moveNumber();

    let moveObj = null;
    try {
      moveObj = chess.move(uci);
    } catch {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.slice(4) || undefined;
        moveObj = chess.move({ from, to, promotion });
      } catch {
        moveObj = null;
      }
    }

    if (!moveObj) {
      formattedParts.push(uci);
      break;
    }

    if (turn === 'w') {
      formattedParts.push(`${moveNum}. ${moveObj.san}`);
    } else if (i === 0) {
      formattedParts.push(`${moveNum}... ${moveObj.san}`);
    } else {
      formattedParts.push(moveObj.san);
    }
  }

  return formattedParts.join(' ');
}

export class GameDecorator {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  getGame(): Game {
    return this.game;
  }

  getGameMoves(): string[] {
    return this.getGame().moves.split(' ');
  }

  getOpponentSide(id: string) {
    return this.getSide(id) === 'black' ? 'white' : 'black';
  }

  getSide(id: string) {
    return this.game.players.black.user?.id === id ? 'black' : 'white';
  }

  getStatusColor(id: string) {
    const { winner, status } = this.game;
    if (status === 'draw') {
      return '';
    }

    return winner === this.getSide(id) ? 'winner' : 'loser';
  }

  parseGameClock(): string {
    const { clock } = this.game;
    let result = '∞';

    if (clock?.initial) {
      result = `${clock.initial / 60}+${clock.increment}`;
    }

    return result;
  }

  private parseGameLoser(): string {
    let result = 'Las negras';

    if (this.game.winner === 'black') {
      result = 'Las blancas';
    }

    return result;
  }

  parseGameMoves(): string {
    const movesArray = this.game.moves.split(' ');
    let result = '';

    let turn = 1;
    for (let i = 0; i < movesArray.length && turn < 4; i += 2, turn += 1) {
      const secondMove = movesArray[i + 1] ? movesArray[i + 1] : '';
      result += `${turn}. ${movesArray[i]} ${secondMove} `;
    }

    const numberOfMoves = Math.ceil(movesArray.length / 2);
    if (numberOfMoves > 3) {
      result += `... ${Math.ceil(movesArray.length / 2)} movimientos`;
    }

    return result;
  }

  parseGameStatus(): string {
    switch (this.game.status) {
      case 'draw':
        return 'Tablas';
      case 'cheat':
        return 'Trampa detectada';
      case 'resign':
        return `${this.parseGameLoser()} abandonaron`;
      case 'outoftime':
        return `${this.parseGameLoser()} agotaron su tiempo`;
      case 'mate':
        return 'Jaque mate';
      case 'timeout':
        return `${this.parseGameLoser()} han dejado la partida`;
      default:
        return 'No definido';
    }
  }

  parseGameWinner(): string {
    const { winner, status } = this.game;
    if (status === 'draw') {
      return '';
    }

    return winner === 'black' ? ' • Las negras ganan' : ' • Las blancas ganan';
  }

  parsePlayerName(playerStr: string): string {
    let player: Player;
    if (playerStr === 'black') {
      player = this.game.players.black;
    } else {
      player = this.game.players.white;
    }

    if (player.aiLevel) {
      return `Stockfish nivel ${player.aiLevel}`;
    }
    if (!player.user || !player.user.id) {
      return 'Anónimo';
    }

    return player.user!.name;
  }

  parsePosition(): string {
    const chess = new Chess();

    try {
      chess.loadPgn(this.game.moves);
    } catch (e) {
      console.error(e as Error);
    }

    return chess.fen();
  }

  parsePositionAt(moveIndex: number): string {
    const chess = new Chess();
    const moves = this.getGameMoves();
    for (let i = 0; i <= moveIndex && i < moves.length; i += 1) {
      try {
        chess.move(moves[i]);
      } catch (e) {
        break;
      }
    }
    return chess.fen();
  }

  parseBestLine(bestLine: string, fenOrMoveIndex?: string | number): string {
    if (typeof fenOrMoveIndex === 'number') {
      const fen = this.parsePositionAt(fenOrMoveIndex);
      return formatBestLine(bestLine, fen);
    }
    return formatBestLine(bestLine, fenOrMoveIndex || this.parsePosition());
  }

  setAnalysis(analysis: GameAnalysis) {
    this.game.analysis = analysis;
  }
}
