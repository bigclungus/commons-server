// Tile map: chunk generation and walkability
// Tile IDs: 0=grass, 1=path, 2=water, 3=building, 4=tree, 5=rock, 6=fountain

import type { ChunkData } from "./protocol.ts";

export const TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  BUILDING: 3,
  TREE: 4,
  ROCK: 5,
  FOUNTAIN: 6,
} as const;

// Tile types that are not walkable
const SOLID_TILES = new Set([TILE.WATER, TILE.BUILDING, TILE.TREE, TILE.ROCK, TILE.FOUNTAIN]);

export const CHUNK_TILES_W = 25;  // tiles per chunk (width)
export const CHUNK_TILES_H = 19;  // tiles per chunk (height)
export const TILE_SIZE = 32;      // pixels per tile

// mulberry32 PRNG — deterministic per seed
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunkSeed(cx: number, cy: number): number {
  // Deterministic hash of chunk coordinates
  return (((cx * 73856093) ^ (cy * 19349663)) >>> 0);
}

/**
 * Build the hand-crafted chunk (0,0) tile grid.
 * This mirrors the grazing.html chunk(0,0) layout.
 */
function buildChunk00(): number[][] {
  const W = CHUNK_TILES_W;
  const H = CHUNK_TILES_H;
  const tiles: number[][] = Array.from({ length: W }, () => Array(H).fill(TILE.GRASS));

  // Cross paths
  for (let x = 0; x < W; x++) tiles[x][9] = TILE.PATH;    // horizontal mid path
  for (let y = 0; y < H; y++) tiles[12][y] = TILE.PATH;   // vertical mid path

  // Congress building at tiles (2-8, 2-6)
  for (let x = 2; x <= 8; x++) {
    for (let y = 2; y <= 6; y++) {
      tiles[x][y] = TILE.BUILDING;
    }
  }
  // Doorway at (5,5) — override to path so NPCs can enter
  tiles[5][5] = TILE.PATH;
  tiles[5][6] = TILE.PATH;

  // Pond (water) — roughly 3 tiles around (18, 5)
  const pondCenterX = 18, pondCenterY = 5;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 2) {
        const tx = pondCenterX + dx;
        const ty = pondCenterY + dy;
        if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
          tiles[tx][ty] = TILE.WATER;
        }
      }
    }
  }

  // Small building (right side)
  for (let x = 16; x <= 20; x++) {
    for (let y = 12; y <= 16; y++) {
      tiles[x][y] = TILE.BUILDING;
    }
  }

  // Fountain 3×3 at center area around (12, 9) — tile intersection
  // Actually near the path intersection — use coords (11,8)
  tiles[11][8] = TILE.FOUNTAIN;
  tiles[12][8] = TILE.FOUNTAIN;
  tiles[11][9] = TILE.PATH;  // path stays walkable through fountain area
  tiles[13][8] = TILE.FOUNTAIN;

  // Some trees scattered
  const treeTiles: [number, number][] = [
    [1, 1], [3, 14], [6, 15], [20, 2], [22, 3],
    [23, 12], [22, 15], [8, 17], [2, 17], [15, 1],
  ];
  for (const [tx, ty] of treeTiles) {
    if (tiles[tx][ty] === TILE.GRASS) {
      tiles[tx][ty] = TILE.TREE;
    }
  }

  // Rocks
  const rockTiles: [number, number][] = [
    [9, 13], [21, 8], [4, 11],
  ];
  for (const [tx, ty] of rockTiles) {
    if (tiles[tx][ty] === TILE.GRASS) {
      tiles[tx][ty] = TILE.ROCK;
    }
  }

  // Path from congress building to main cross-path
  for (let y = 6; y <= 9; y++) tiles[5][y] = TILE.PATH;
  for (let x = 5; x <= 12; x++) tiles[x][6] = TILE.PATH;

  return tiles;
}

/**
 * Build a procedurally generated chunk using deterministic PRNG.
 */
function buildProceduralChunk(cx: number, cy: number): number[][] {
  const W = CHUNK_TILES_W;
  const H = CHUNK_TILES_H;
  const rand = mulberry32(chunkSeed(cx, cy));
  const tiles: number[][] = Array.from({ length: W }, () => Array(H).fill(TILE.GRASS));

  // Trees ~10%
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (rand() < 0.10) tiles[x][y] = TILE.TREE;
    }
  }

  // Water ponds (1-2 per chunk)
  const numPonds = rand() < 0.5 ? 1 : 2;
  for (let p = 0; p < numPonds; p++) {
    const px = Math.floor(rand() * (W - 6)) + 3;
    const py = Math.floor(rand() * (H - 6)) + 3;
    const radius = 1 + Math.floor(rand() * 2);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          const tx = px + dx;
          const ty = py + dy;
          if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
            tiles[tx][ty] = TILE.WATER;
          }
        }
      }
    }
  }

  // Rocks
  for (let i = 0; i < 3; i++) {
    const rx = Math.floor(rand() * W);
    const ry = Math.floor(rand() * H);
    if (tiles[rx][ry] === TILE.GRASS) tiles[rx][ry] = TILE.ROCK;
  }

  // Entry/exit corridors cleared (connect to adjacent chunks)
  const midH = Math.floor(H / 2);
  const midW = Math.floor(W / 2);
  for (let y = midH - 1; y <= midH + 1; y++) {
    for (let x = 0; x < W; x++) {
      tiles[x][y] = TILE.PATH;
    }
  }
  for (let x = midW - 1; x <= midW + 1; x++) {
    for (let y = 0; y < H; y++) {
      tiles[x][y] = TILE.PATH;
    }
  }

  return tiles;
}

/**
 * Derive walkability grid from tile grid.
 * walkable[x][y] = true if a character can stand on that tile.
 */
function buildWalkability(tiles: number[][]): boolean[][] {
  const W = tiles.length;
  const H = tiles[0].length;
  return tiles.map((col) =>
    col.map((tile) => !SOLID_TILES.has(tile))
  );
}

/**
 * Build or retrieve a ChunkData for the given chunk coordinates.
 */
export function buildChunk(cx: number, cy: number): ChunkData {
  let tiles: number[][];
  if (cx === 0 && cy === 0) {
    tiles = buildChunk00();
  } else {
    tiles = buildProceduralChunk(cx, cy);
  }
  const walkable = buildWalkability(tiles);
  return { cx, cy, tiles, walkable };
}

/**
 * Convert pixel coordinates to tile coordinates.
 */
export function pixelToTile(px: number, py: number): { tx: number; ty: number } {
  return {
    tx: Math.floor(px / TILE_SIZE),
    ty: Math.floor(py / TILE_SIZE),
  };
}

/**
 * Check if a pixel position is walkable within a chunk.
 */
export function isPixelWalkable(px: number, py: number, chunk: ChunkData): boolean {
  const { tx, ty } = pixelToTile(px, py);
  if (tx < 0 || ty < 0 || tx >= CHUNK_TILES_W || ty >= CHUNK_TILES_H) return false;
  return chunk.walkable[tx][ty];
}
