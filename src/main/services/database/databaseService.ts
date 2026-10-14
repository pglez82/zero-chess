import {
  COUNT_GAMES_BY_USER_ID,
  CREATE_GAME_TABLE,
  CREATE_MISTAKE_POSITION_TABLE,
  CREATE_GAME_MISTAKES_PROCESSED_TABLE,
  INSERT_GAME_OR_IGNORE,
  INSERT_MISTAKE_POSITION,
  DELETE_MISTAKES_BY_GAME_ID,
  MARK_GAME_MISTAKES_PROCESSED,
  SELECT_GAME_BY_USER_ID,
  UPDATE_GAME_ANALYSIS,
  COUNT_ANALYZED_GAMES_BY_USER_ID,
  SELECT_NEWEST_GAME_CREATED_AT_BY_USER_ID,
  SELECT_UNPROCESSED_ANALYZED_GAMES_BY_USER_ID,
  SELECT_REPEATED_MISTAKES_BY_USER_ID,
} from './helpers/queries';
import { mapGameToRow, mapRowToGame } from './helpers/mapping';
import {
  extractMistakePositionsForGame,
  RawMistakePosition,
} from './helpers/mistakes';
import { Game, RepeatedMistakePosition } from '../../../interfaces';
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

interface CountResult {
  count: number;
}

export function connectDatabase(customPath?: string) {
  const dbPath =
    customPath ||
    (app ? path.join(app.getPath('userData'), 'database.db') : ':memory:');
  const db = Database(dbPath);
  db.exec(CREATE_GAME_TABLE);
  db.exec(CREATE_MISTAKE_POSITION_TABLE);
  db.exec(CREATE_GAME_MISTAKES_PROCESSED_TABLE);

  try {
    const tableInfo = db
      .prepare("PRAGMA table_info('mistake_position')")
      .all() as Array<{ name: string }>;
    const hasErrorMagnitude = tableInfo.some(
      (col) => col.name === 'error_magnitude',
    );
    if (!hasErrorMagnitude) {
      db.exec(
        'ALTER TABLE mistake_position ADD COLUMN error_magnitude REAL DEFAULT 0',
      );
      db.exec('DELETE FROM game_mistakes_processed');
      db.exec('DELETE FROM mistake_position');
    }
  } catch {
    // Ignore migration error
  }

  return db;
}

function saveGameMistakes(
  db: Database.Database,
  gameId: string,
  mistakes: RawMistakePosition[],
) {
  const deleteStm = db.prepare(DELETE_MISTAKES_BY_GAME_ID);
  const insertStm = db.prepare(INSERT_MISTAKE_POSITION);
  const markProcessedStm = db.prepare(MARK_GAME_MISTAKES_PROCESSED);

  deleteStm.run({ gameId });
  for (const m of mistakes) {
    insertStm.run(m);
  }
  markProcessedStm.run({ gameId });
}

function syncAnalyzedGamesMistakes(db: Database.Database, userId?: string) {
  const stm = db.prepare(SELECT_UNPROCESSED_ANALYZED_GAMES_BY_USER_ID);
  const unprocessedGames = stm.all({ userId: userId || '' }) as any[];

  if (unprocessedGames.length === 0) return;

  db.transaction(() => {
    for (const gameRow of unprocessedGames) {
      const mistakes = extractMistakePositionsForGame(gameRow);
      saveGameMistakes(db, gameRow.id, mistakes);
    }
  })();
}

export function insertGames(games: Game[]) {
  const db = connectDatabase();
  const insertStm = db.prepare(INSERT_GAME_OR_IGNORE);

  db.transaction(() => {
    games.forEach((game) => {
      insertStm.run(mapGameToRow(game));
    });
  })();

  db.close();
}

export function getNewestGameCreatedAt(id: string): number | null {
  const db = connectDatabase();
  const stm = db.prepare(SELECT_NEWEST_GAME_CREATED_AT_BY_USER_ID);

  const result = stm.get({ id }) as { createdAt: number } | undefined;

  db.close();
  return result?.createdAt ?? null;
}

export function getPlayerGames(id: string) {
  const db = connectDatabase();
  const stm = db.prepare(SELECT_GAME_BY_USER_ID);

  const rows = stm.all({ id });
  const games = rows.map(mapRowToGame);

  db.close();
  return games;
}

export function getPlayerGamesCount(id: string) {
  const db = connectDatabase();
  const stm = db.prepare(COUNT_GAMES_BY_USER_ID);

  const result = stm.get({ id }) as CountResult;

  db.close();
  return result.count;
}

export function getAnalyzedGamesCount(id: string) {
  const db = connectDatabase();
  const stm = db.prepare(COUNT_ANALYZED_GAMES_BY_USER_ID);

  const result = stm.get({ id }) as CountResult;

  db.close();
  return result.count;
}

export function updateGameAnalysis(
  id: string,
  analysis: { [key: string]: any },
) {
  const db = connectDatabase();
  const stm = db.prepare(UPDATE_GAME_ANALYSIS);

  db.transaction(() => {
    stm.run({ id, analysis: JSON.stringify(analysis) });

    const gameRow = db
      .prepare(
        'SELECT id, moves, white_user_id, white_user_name, black_user_id, black_user_name FROM game WHERE id = @id',
      )
      .get({ id }) as any;

    if (gameRow) {
      gameRow.analysis = analysis;
      const mistakes = extractMistakePositionsForGame(gameRow);
      saveGameMistakes(db, id, mistakes);
    }
  })();

  db.close();
}

export function getRepeatedMistakes(userId: string): RepeatedMistakePosition[] {
  const db = connectDatabase();

  syncAnalyzedGamesMistakes(db, userId);

  const stm = db.prepare(SELECT_REPEATED_MISTAKES_BY_USER_ID);
  const rows = stm.all({ userId }) as any[];

  db.close();

  return rows.map((row) => ({
    fen: row.fen,
    count: row.count,
    errorMagnitude: row.errorMagnitude ?? 0,
    side: row.side as 'white' | 'black',
    bestMove: row.bestMove || '',
    moves: JSON.parse(row.moves || '[]'),
    gameId: row.gameId,
  }));
}
