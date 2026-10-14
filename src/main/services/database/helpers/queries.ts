export const SELECT_GAME_BY_USER_ID = `
  SELECT * FROM game WHERE black_user_id = @id OR white_user_id = @id
`;

export const COUNT_GAMES_BY_USER_ID = `
  SELECT COUNT(*) as count FROM game WHERE black_user_id = @id OR white_user_id = @id
`;

export const COUNT_ANALYZED_GAMES_BY_USER_ID = `
  SELECT COUNT(*) as count FROM game WHERE (black_user_id = @id OR white_user_id = @id) AND analysis IS NOT NULL
`;

export const SELECT_NEWEST_GAME_CREATED_AT_BY_USER_ID = `
  SELECT MAX(createdAt) as createdAt FROM game WHERE black_user_id = @id OR white_user_id = @id
`;



export const INSERT_GAME_OR_IGNORE = `
  INSERT OR IGNORE INTO game (
    id, initial, increment, totalTime, perf, speed, moves,
    source, rated, status, winner, variant, createdAt, lastMoveAt,
    black_aiLevel, black_rating, black_ratingDiff, black_user_id, black_user_name,
    white_aiLevel, white_rating, white_ratingDiff, white_user_id, white_user_name, analysis
  ) VALUES (
    @id, @initial, @increment, @totalTime, @perf, @speed, @moves,
    @source, @rated, @status, @winner, @variant, @createdAt, @lastMoveAt,
    @black_aiLevel, @black_rating, @black_ratingDiff, @black_user_id, @black_user_name,
    @white_aiLevel, @white_rating, @white_ratingDiff, @white_user_id, @white_user_name, @analysis
  )
`;

export const UPDATE_GAME_ANALYSIS = `
  UPDATE game SET analysis = @analysis WHERE id = @id
`;

export const CREATE_GAME_TABLE = `
  CREATE TABLE IF NOT EXISTS game (
    id TEXT PRIMARY KEY,
    initial INTEGER,
    increment INTEGER,
    totalTime INTEGER,
    perf TEXT,
    speed TEXT,
    moves TEXT,
    source TEXT,
    rated INTEGER,
    status TEXT,
    winner TEXT,
    variant TEXT,
    createdAt INTEGER,
    lastMoveAt INTEGER,
    black_aiLevel INTEGER,
    black_rating INTEGER,
    black_ratingDiff INTEGER,
    black_user_id TEXT,
    black_user_name TEXT,
    white_aiLevel INTEGER,
    white_rating INTEGER,
    white_ratingDiff INTEGER,
    white_user_id TEXT,
    white_user_name TEXT
  , analysis TEXT)
`;

export const CREATE_MISTAKE_POSITION_TABLE = `
  CREATE TABLE IF NOT EXISTS mistake_position (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    side TEXT NOT NULL,
    fen TEXT NOT NULL,
    move_index INTEGER NOT NULL,
    moves TEXT NOT NULL,
    best_move TEXT,
    FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mistake_user_fen ON mistake_position (user_id, fen);
  CREATE INDEX IF NOT EXISTS idx_mistake_game ON mistake_position (game_id);
`;

export const CREATE_GAME_MISTAKES_PROCESSED_TABLE = `
  CREATE TABLE IF NOT EXISTS game_mistakes_processed (
    game_id TEXT PRIMARY KEY
  );
`;

export const INSERT_MISTAKE_POSITION = `
  INSERT INTO mistake_position (
    game_id, user_id, side, fen, move_index, moves, best_move
  ) VALUES (
    @gameId, @userId, @side, @fen, @moveIndex, @moves, @bestMove
  )
`;

export const DELETE_MISTAKES_BY_GAME_ID = `
  DELETE FROM mistake_position WHERE game_id = @gameId
`;

export const MARK_GAME_MISTAKES_PROCESSED = `
  INSERT OR REPLACE INTO game_mistakes_processed (game_id) VALUES (@gameId)
`;

export const SELECT_UNPROCESSED_ANALYZED_GAMES_BY_USER_ID = `
  SELECT id, moves, white_user_id, white_user_name, black_user_id, black_user_name, analysis
  FROM game
  WHERE (LOWER(white_user_id) = LOWER(@userId) OR LOWER(white_user_name) = LOWER(@userId)
         OR LOWER(black_user_id) = LOWER(@userId) OR LOWER(black_user_name) = LOWER(@userId))
    AND analysis IS NOT NULL
    AND id NOT IN (SELECT game_id FROM game_mistakes_processed)
`;

export const SELECT_REPEATED_MISTAKES_BY_USER_ID = `
  SELECT
    fen,
    COUNT(*) as count,
    side,
    best_move as bestMove,
    moves,
    game_id as gameId
  FROM mistake_position
  WHERE LOWER(user_id) = LOWER(@userId)
  GROUP BY fen
  HAVING count >= 2
  ORDER BY count DESC
`;

