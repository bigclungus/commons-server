// SQLite persistence module — WAL mode, prepared statements
import { Database } from "bun:sqlite";
import type { WorldState } from "./protocol.ts";
import { mkdirSync } from "fs";

// Ensure db directory exists
mkdirSync("./db", { recursive: true });

export const db = new Database("./db/commons.db", { create: true });

// WAL mode for concurrent access
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS npc_positions (
    name TEXT PRIMARY KEY,
    x REAL,
    y REAL,
    facing TEXT,
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS player_sessions (
    socket_id TEXT PRIMARY KEY,
    name TEXT,
    color TEXT,
    x REAL,
    y REAL,
    chunk_x INTEGER DEFAULT 0,
    chunk_y INTEGER DEFAULT 0,
    last_seen INTEGER
  );
  CREATE TABLE IF NOT EXISTS world_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    payload TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS worn_path_tiles (
    chunk_x INTEGER,
    chunk_y INTEGER,
    tile_x INTEGER,
    tile_y INTEGER,
    visit_count INTEGER DEFAULT 0,
    last_visited INTEGER,
    PRIMARY KEY (chunk_x, chunk_y, tile_x, tile_y)
  );
  CREATE INDEX IF NOT EXISTS idx_player_last_seen ON player_sessions(last_seen);
`);

// Prepared statements
const saveNpcStmt = db.prepare(
  "INSERT OR REPLACE INTO npc_positions (name, x, y, facing, updated_at) VALUES (?, ?, ?, ?, ?)"
);
const savePlayerStmt = db.prepare(
  "INSERT OR REPLACE INTO player_sessions (socket_id, name, color, x, y, chunk_x, chunk_y, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const loadNpcsStmt = db.prepare("SELECT name, x, y, facing FROM npc_positions");
const upsertWornPathStmt = db.prepare(
  `INSERT INTO worn_path_tiles (chunk_x, chunk_y, tile_x, tile_y, visit_count, last_visited)
   VALUES (?, ?, ?, ?, 1, ?)
   ON CONFLICT (chunk_x, chunk_y, tile_x, tile_y) DO UPDATE
   SET visit_count = visit_count + 1, last_visited = excluded.last_visited`
);

const persistTx = db.transaction((world: WorldState) => {
  const now = Date.now();
  for (const npc of world.npcs.values()) {
    saveNpcStmt.run(npc.name, npc.x, npc.y, npc.facing, now);
  }
  for (const player of world.players.values()) {
    savePlayerStmt.run(
      player.socketId,
      player.name,
      player.color,
      player.x,
      player.y,
      player.chunkX,
      player.chunkY,
      player.lastSeen
    );
  }
});

export function persistState(world: WorldState): void {
  try {
    persistTx(world);
  } catch (err) {
    console.error("[persistence] persistState failed:", err);
    throw err;
  }
}

export function loadNpcPositions(): Map<string, { x: number; y: number; facing: string }> {
  const rows = loadNpcsStmt.all() as { name: string; x: number; y: number; facing: string }[];
  const result = new Map<string, { x: number; y: number; facing: string }>();
  for (const row of rows) {
    result.set(row.name, { x: row.x, y: row.y, facing: row.facing });
  }
  return result;
}

export function recordWornPath(chunkX: number, chunkY: number, tileX: number, tileY: number): void {
  try {
    upsertWornPathStmt.run(chunkX, chunkY, tileX, tileY, Date.now());
  } catch (err) {
    console.error("[persistence] recordWornPath failed:", err);
    throw err;
  }
}

const loadWornPathsStmt = db.prepare(
  "SELECT tile_x, tile_y, visit_count FROM worn_path_tiles WHERE chunk_x = ? AND chunk_y = ?"
);

export function loadWornPathsForChunk(
  chunkX: number,
  chunkY: number
): { tileX: number; tileY: number; visitCount: number }[] {
  try {
    const rows = loadWornPathsStmt.all(chunkX, chunkY) as {
      tile_x: number;
      tile_y: number;
      visit_count: number;
    }[];
    return rows.map((r) => ({ tileX: r.tile_x, tileY: r.tile_y, visitCount: r.visit_count }));
  } catch (err) {
    console.error("[persistence] loadWornPathsForChunk failed:", err);
    throw err;
  }
}

/**
 * Reset all NPC positions in the DB to the center of chunk (0,0).
 * Center is the path intersection at cols 24-25, rows 17-18:
 *   x = 24 * TILE_SIZE + TILE_SIZE/2 = 490px
 *   y = 17 * TILE_SIZE + TILE_SIZE/2 = 350px
 * Returns the target pixel coords so callers can sync in-memory state.
 */
export function resetNpcPositionsInDb(npcNames: string[]): { x: number; y: number } {
  const CENTER_X = 490; // path intersection, walkable, center of chunk (0,0)
  const CENTER_Y = 350;
  const now = Date.now();
  const resetStmt = db.prepare(
    "INSERT OR REPLACE INTO npc_positions (name, x, y, facing, updated_at) VALUES (?, ?, ?, ?, ?)"
  );
  const resetTx = db.transaction(() => {
    for (const name of npcNames) {
      resetStmt.run(name, CENTER_X, CENTER_Y, "right", now);
    }
  });
  try {
    resetTx();
    console.log(`[persistence] Reset ${npcNames.length} NPC positions to center (${CENTER_X}, ${CENTER_Y})`);
  } catch (err) {
    console.error("[persistence] resetNpcPositionsInDb failed:", err);
    throw err;
  }
  return { x: CENTER_X, y: CENTER_Y };
}
