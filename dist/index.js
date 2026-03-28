// @bun
// src/index.ts
var {serve } = globalThis.Bun;

// src/map.ts
var TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  BUILDING: 3,
  TREE: 4,
  ROCK: 5,
  FOUNTAIN: 6
};
var SOLID_TILES = new Set([TILE.WATER, TILE.BUILDING, TILE.TREE, TILE.ROCK, TILE.FOUNTAIN]);
var CHUNK_TILES_W = 50;
var CHUNK_TILES_H = 35;
var TILE_SIZE = 20;
function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function chunkSeed(cx, cy) {
  return (cx * 73856093 ^ cy * 19349663) >>> 0;
}
function buildChunk00() {
  const W = CHUNK_TILES_W;
  const H = CHUNK_TILES_H;
  const tiles = Array.from({ length: W }, () => Array(H).fill(TILE.GRASS));
  const set = (col, row, t) => {
    if (col >= 0 && col < W && row >= 0 && row < H)
      tiles[col][row] = t;
  };
  for (let c = 0;c < W; c++) {
    set(c, 17, TILE.PATH);
    set(c, 18, TILE.PATH);
  }
  for (let r = 0;r < H; r++) {
    set(24, r, TILE.PATH);
    set(25, r, TILE.PATH);
  }
  for (let r = 22;r <= 27; r++) {
    for (let c = 4;c <= 10; c++) {
      set(c, r, TILE.WATER);
    }
  }
  for (let r = 2;r <= 6; r++) {
    for (let c = 2;c <= 8; c++) {
      set(c, r, TILE.BUILDING);
    }
  }
  for (let r = 2;r <= 6; r++) {
    for (let c = 40;c <= 47; c++) {
      set(c, r, TILE.BUILDING);
    }
  }
  for (let r = 26;r <= 31; r++) {
    for (let c = 38;c <= 46; c++) {
      set(c, r, TILE.BUILDING);
    }
  }
  const treeTiles = [
    [1, 1],
    [12, 1],
    [35, 1],
    [48, 1],
    [3, 8],
    [14, 8],
    [38, 8],
    [47, 8],
    [10, 10],
    [30, 10],
    [45, 10],
    [2, 14],
    [20, 14],
    [44, 14],
    [5, 20],
    [15, 20],
    [35, 20],
    [48, 20],
    [18, 22],
    [40, 22],
    [3, 28],
    [20, 28],
    [47, 28],
    [8, 32],
    [30, 32],
    [46, 32],
    [1, 33],
    [48, 33],
    [14, 34],
    [35, 34]
  ];
  for (const [tc, tr] of treeTiles) {
    if (tc < W && tr < H && tiles[tc][tr] === TILE.GRASS) {
      tiles[tc][tr] = TILE.TREE;
    }
  }
  const rockTiles = [
    [22, 9],
    [40, 11],
    [12, 15],
    [32, 16],
    [27, 21],
    [14, 25],
    [35, 29],
    [12, 31],
    [40, 33]
  ];
  for (const [rc, rr] of rockTiles) {
    if (rc < W && rr < H && tiles[rc][rr] === TILE.GRASS) {
      tiles[rc][rr] = TILE.ROCK;
    }
  }
  for (let r = 13;r <= 15; r++) {
    for (let c = 19;c <= 21; c++) {
      set(c, r, TILE.FOUNTAIN);
    }
  }
  return tiles;
}
function buildProceduralChunk(cx, cy) {
  const W = CHUNK_TILES_W;
  const H = CHUNK_TILES_H;
  const rand = mulberry32(chunkSeed(cx, cy));
  const tiles = Array.from({ length: W }, () => Array(H).fill(TILE.GRASS));
  for (let r = 2;r < H - 2; r++) {
    for (let c = 2;c < W - 2; c++) {
      const inCenter = c >= 15 && c <= 35 && r >= 12 && r <= 23;
      if (inCenter)
        continue;
      if (rand() < 0.1)
        tiles[c][r] = TILE.TREE;
    }
  }
  const numPonds = 1 + Math.floor(rand() * 3);
  for (let p = 0;p < numPonds; p++) {
    const pr = 5 + Math.floor(rand() * (H - 12));
    const pc = 5 + Math.floor(rand() * (W - 12));
    const pw = 3 + Math.floor(rand() * 5);
    const ph = 2 + Math.floor(rand() * 4);
    for (let wr = pr;wr < Math.min(pr + ph, H - 3); wr++) {
      for (let wc = pc;wc < Math.min(pc + pw, W - 3); wc++) {
        tiles[wc][wr] = TILE.WATER;
      }
    }
  }
  const numRocks = 3 + Math.floor(rand() * 6);
  for (let k = 0;k < numRocks; k++) {
    const rr = 2 + Math.floor(rand() * (H - 4));
    const rc = 2 + Math.floor(rand() * (W - 4));
    if (tiles[rc][rr] === TILE.GRASS)
      tiles[rc][rr] = TILE.ROCK;
  }
  const numPaths = 1 + Math.floor(rand() * 2);
  for (let pp = 0;pp < numPaths; pp++) {
    if (rand() < 0.5) {
      const pathRow = 3 + Math.floor(rand() * (H - 6));
      for (let c = 0;c < W; c++) {
        if (tiles[c][pathRow] === TILE.TREE || tiles[c][pathRow] === TILE.ROCK)
          tiles[c][pathRow] = TILE.PATH;
      }
    } else {
      const pathCol = 3 + Math.floor(rand() * (W - 6));
      for (let r = 0;r < H; r++) {
        if (tiles[pathCol][r] === TILE.TREE || tiles[pathCol][r] === TILE.ROCK)
          tiles[pathCol][r] = TILE.PATH;
      }
    }
  }
  const midC = Math.floor(W / 2);
  const midR = Math.floor(H / 2);
  for (let i = -5;i <= 5; i++) {
    if (tiles[midC + i]?.[0] !== 0)
      tiles[midC + i][0] = TILE.GRASS;
    if (tiles[midC + i]?.[1] !== 0)
      tiles[midC + i][1] = TILE.GRASS;
    if (tiles[midC + i]?.[H - 1] !== 0)
      tiles[midC + i][H - 1] = TILE.GRASS;
    if (tiles[midC + i]?.[H - 2] !== 0)
      tiles[midC + i][H - 2] = TILE.GRASS;
    if (tiles[0]?.[midR + i] !== 0)
      tiles[0][midR + i] = TILE.GRASS;
    if (tiles[1]?.[midR + i] !== 0)
      tiles[1][midR + i] = TILE.GRASS;
    if (tiles[W - 1]?.[midR + i] !== 0)
      tiles[W - 1][midR + i] = TILE.GRASS;
    if (tiles[W - 2]?.[midR + i] !== 0)
      tiles[W - 2][midR + i] = TILE.GRASS;
  }
  return tiles;
}
function buildWalkability(tiles) {
  const W = tiles.length;
  const H = tiles[0].length;
  return tiles.map((col) => col.map((tile) => !SOLID_TILES.has(tile)));
}
function buildChunk(cx, cy) {
  let tiles;
  if (cx === 0 && cy === 0) {
    tiles = buildChunk00();
  } else {
    tiles = buildProceduralChunk(cx, cy);
  }
  const walkable = buildWalkability(tiles);
  return { cx, cy, tiles, walkable };
}
function pixelToTile(px, py) {
  return {
    tx: Math.floor(px / TILE_SIZE),
    ty: Math.floor(py / TILE_SIZE)
  };
}
function isPixelWalkable(px, py, chunk) {
  const { tx, ty } = pixelToTile(px, py);
  if (tx < 0 || ty < 0 || tx >= CHUNK_TILES_W || ty >= CHUNK_TILES_H)
    return false;
  return chunk.walkable[tx][ty];
}

// src/npc-ai.ts
var NPC_PATTERNS = {
  chairman: { speed: 1.2, behavior: "wander" },
  critic: { speed: 1, behavior: "pacing" },
  architect: { speed: 0.8, behavior: "stationary" },
  ux: { speed: 1.1, behavior: "wander" },
  designer: { speed: 1, behavior: "circular" },
  galactus: { speed: 1.5, behavior: "aggressive" },
  hume: { speed: 0.9, behavior: "pacing" },
  otto: { speed: 1, behavior: "wander" },
  pm: { speed: 1.3, behavior: "directed" },
  spengler: { speed: 0.7, behavior: "stationary" },
  trump: { speed: 1.4, behavior: "aggressive" },
  "uncle-bob": { speed: 0.8, behavior: "pacing" },
  bloodfeast: { speed: 1.6, behavior: "aggressive" },
  adelbert: { speed: 0.9, behavior: "wander" },
  jhaddu: { speed: 1, behavior: "circular" },
  morgan: { speed: 1.1, behavior: "directed" },
  "the-kid": { speed: 1.3, behavior: "wander" },
  chaz: { speed: 1.1, behavior: "wander" },
  "the-correspondent": { speed: 0.9, behavior: "pacing" }
};
var COUNCIL_TARGET = { x: 5 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 };
var NPC_SPAWN_POSITIONS = {
  chairman: { x: 480, y: 360 },
  critic: { x: 300, y: 400 },
  architect: { x: 260, y: 220 },
  ux: { x: 560, y: 240 },
  designer: { x: 620, y: 340 },
  galactus: { x: 360, y: 480 },
  hume: { x: 420, y: 520 },
  otto: { x: 680, y: 300 },
  pm: { x: 540, y: 460 },
  spengler: { x: 160, y: 340 },
  trump: { x: 720, y: 200 },
  "uncle-bob": { x: 340, y: 280 },
  bloodfeast: { x: 760, y: 460 },
  adelbert: { x: 600, y: 500 },
  jhaddu: { x: 460, y: 560 },
  morgan: { x: 280, y: 550 },
  "the-kid": { x: 640, y: 420 },
  chaz: { x: 400, y: 320 },
  "the-correspondent": { x: 500, y: 480 }
};
var pacingState = new Map;
var circularState = new Map;
var directedState = new Map;
function initNpcs() {
  const npcs = new Map;
  for (const [name, pattern] of Object.entries(NPC_PATTERNS)) {
    const spawn = NPC_SPAWN_POSITIONS[name] ?? { x: 400, y: 300 };
    npcs.set(name, {
      name,
      x: spawn.x,
      y: spawn.y,
      facing: "right",
      vx: 0,
      vy: 0,
      pattern: pattern.behavior
    });
    pacingState.set(name, { ticksOnCurrent: 0, maxTicks: 20 + Math.floor(Math.random() * 40) });
    circularState.set(name, { angle: Math.random() * Math.PI * 2 });
    directedState.set(name, {
      targetX: 200 + Math.random() * 600,
      targetY: 150 + Math.random() * 400,
      stuckTicks: 0
    });
  }
  initBlurbState(Array.from(npcs.keys()));
  return npcs;
}
function isWalkablePixel(px, py, walkable) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= walkable.length || ty >= (walkable[0]?.length ?? 0))
    return false;
  return walkable[tx][ty];
}
function greedyStep(x, y, tx, ty, speed, walkable) {
  const ddx = tx - x;
  const ddy = ty - y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist < speed)
    return { dx: 0, dy: 0 };
  const nx = ddx / dist * speed;
  const ny = ddy / dist * speed;
  if (isWalkablePixel(x + nx, y + ny, walkable)) {
    return { dx: nx, dy: ny };
  }
  if (isWalkablePixel(x + nx, y, walkable)) {
    return { dx: nx, dy: 0 };
  }
  if (isWalkablePixel(x, y + ny, walkable)) {
    return { dx: 0, dy: ny };
  }
  return { dx: 0, dy: 0 };
}
function pickWalkableDirection(npc, speed, walkable) {
  const angles = Array.from({ length: 8 }, (_, i) => i * Math.PI * 2 / 8);
  for (let i = angles.length - 1;i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [angles[i], angles[j]] = [angles[j], angles[i]];
  }
  for (const angle of angles) {
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    if (isWalkablePixel(npc.x + dx, npc.y + dy, walkable)) {
      npc.vx = dx;
      npc.vy = dy;
      return;
    }
  }
  npc.vx = 0;
  npc.vy = 0;
}
function getCurrentSeason() {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const seasons = ["spring", "summer", "autumn", "winter"];
  return seasons[week % 4];
}
var NPC_QUIPS = {
  chairman: ["Order.", "The gavel is patient.", "...", "Retained.", "The record stands.", "Deliberate."],
  critic: ["That's wrong.", "Prove it works.", "No.", "Show your data.", "Unacceptable.", "Rejected."],
  architect: ["Consider the load.", "What scales here?", "Draw the diagram.", "Single source.", "Decouple this.", "The foundation matters."],
  ux: ["Is this usable?", "Who's the user?", "Friction is failure.", "Test with humans.", "Accessibility first.", "Can my gran do it?"],
  galactus: ["I HUNGER.", "YOUR SYSTEMS WILL FEED ME.", "INCONSEQUENTIAL.", "I HAVE SEEN BILLIONS OF STACKS.", "MORTAL CODE.", "FEED ME YOUR DATA."],
  designer: ["Aesthetically, no.", "More contrast.", "Wrong font.", "The kerning is off.", "Iterate the palette.", "Beauty is function."],
  "the-kid": ["FAST", "GO GO GO", "*zooms*", "CAN'T STOP", "SPEEEEED", "AAAA"],
  "uncle-bob": ["Clean this up.", "SOLID.", "One responsibility.", "Extract that method.", "No comments needed.", "Meaningful names."],
  adelbert: ["I know what you did.", "Classic Yuki move.", "Interesting choice.", "I remember.", "Some of us are watching.", "As expected."],
  spengler: ["Doomed.", "We had a good run.", "The entropy is winning.", "I called it.", "Everything decays.", "*sighs*"],
  otto: ["Chaos is order.", "I see patterns.", "Everything connects.", "The vortex knows.", "Cycles within cycles.", "Observe the flow."],
  hume: ["Where's the evidence?", "Show me the data.", "That's speculation.", "Observation first.", "Prove it empirically.", "I reject the a priori."],
  bloodfeast: ["OVERWHELMING FORCE.", "Half measures lose wars.", "Commit or go home.", "I've seen weak plans fail.", "No phased rollout. Deploy.", "The Soviets wouldn't phase."],
  pm: ["Does this move the needle?", "Cut scope.", "Ship something.", "What's the outcome?", "That's not a requirement.", "Validate it first."],
  trump: ["Tremendous.", "Nobody does it better.", "Big. Very big.", "I win. That's what I do.", "They said it couldn't be done.", "Believe me."],
  morgan: ["I need to sit with that.", "That's a lot to unpack.", "I'm not sure I have bandwidth.", "That lands differently for me.", "We should hold space here.", "I felt that."],
  jhaddu: ["As we learned at SVITEMS...", "Simply apply the Factory pattern.", "One more layer of abstraction.", "This is very simple, actually.", "The Enterprise Approach is...", "AbstractRepositoryManagerFactory."],
  chaz: ["Vibe check.", "That's giving.", "No cap.", "Understood the assignment.", "Not it.", "Main character energy."],
  "the-correspondent": ["Per my last email...", "Following up.", "To be clear.", "For the record.", "With respect.", "As previously discussed."]
};
var DEFAULT_QUIPS = ["...", "hmm.", "processing.", "interesting.", "noted.", "ok."];
var blurbState = new Map;
var BLURB_TTL_TICKS = 150;
var BLURB_COOLDOWN_MIN = 600;
var BLURB_COOLDOWN_RANGE = 600;
function initBlurbState(names) {
  for (const name of names) {
    blurbState.set(name, {
      cooldownTicks: Math.floor(Math.random() * BLURB_COOLDOWN_RANGE),
      quipIndex: Math.floor(Math.random() * (NPC_QUIPS[name] ?? DEFAULT_QUIPS).length)
    });
  }
}
function tickBlurbs(npcs) {
  const changed = new Set;
  for (const npc of npcs.values()) {
    const state = blurbState.get(npc.name);
    if (!state)
      continue;
    if (npc.blurbTtl !== undefined && npc.blurbTtl > 0) {
      npc.blurbTtl--;
      if (npc.blurbTtl <= 0) {
        npc.blurb = undefined;
        npc.blurbTtl = undefined;
        changed.add(npc.name);
        state.cooldownTicks = BLURB_COOLDOWN_MIN + Math.floor(Math.random() * BLURB_COOLDOWN_RANGE);
      }
    } else if (state.cooldownTicks > 0) {
      state.cooldownTicks--;
    } else {
      const quips = NPC_QUIPS[npc.name] ?? DEFAULT_QUIPS;
      npc.blurb = quips[state.quipIndex % quips.length];
      npc.blurbTtl = BLURB_TTL_TICKS;
      state.quipIndex++;
      changed.add(npc.name);
    }
  }
  return changed;
}
function applyWander(npc, speed, walkable) {
  if (Math.random() < 0.02) {
    pickWalkableDirection(npc, speed, walkable);
  }
}
function applyPacing(npc, speed, walkable) {
  const state = pacingState.get(npc.name);
  state.ticksOnCurrent++;
  if (state.ticksOnCurrent >= state.maxTicks) {
    npc.vx = -npc.vx || (Math.random() < 0.5 ? speed : -speed);
    npc.vy = 0;
    state.ticksOnCurrent = 0;
    state.maxTicks = 20 + Math.floor(Math.random() * 40);
  }
  if (npc.vx === 0 && npc.vy === 0) {
    npc.vx = Math.random() < 0.5 ? speed : -speed;
  }
}
function applyStationary(npc, _speed, _walkable) {
  if (Math.random() < 0.005) {
    npc.vx = (Math.random() - 0.5) * 0.5;
    npc.vy = (Math.random() - 0.5) * 0.5;
  } else {
    npc.vx *= 0.9;
    npc.vy *= 0.9;
  }
}
function applyCircular(npc, speed, _walkable) {
  const state = circularState.get(npc.name);
  state.angle += 0.03;
  npc.vx = Math.cos(state.angle) * speed;
  npc.vy = Math.sin(state.angle) * speed;
}
function applyAggressive(npc, speed, walkable) {
  if (Math.random() < 0.05) {
    pickWalkableDirection(npc, speed, walkable);
  }
}
function applyDirected(npc, speed, walkable) {
  const state = directedState.get(npc.name);
  const dist = Math.sqrt((state.targetX - npc.x) ** 2 + (state.targetY - npc.y) ** 2);
  if (dist < speed * 2 || state.stuckTicks > 40) {
    state.targetX = 100 + Math.random() * 800;
    state.targetY = 100 + Math.random() * 500;
    state.stuckTicks = 0;
  } else {
    const step = greedyStep(npc.x, npc.y, state.targetX, state.targetY, speed, walkable);
    npc.vx = step.dx;
    npc.vy = step.dy;
    if (step.dx === 0 && step.dy === 0) {
      state.stuckTicks++;
    } else {
      state.stuckTicks = 0;
    }
  }
}
function applyPatternBehavior(npc, behavior, speed, walkable) {
  switch (behavior) {
    case "wander":
      applyWander(npc, speed, walkable);
      break;
    case "pacing":
      applyPacing(npc, speed, walkable);
      break;
    case "stationary":
      applyStationary(npc, speed, walkable);
      break;
    case "circular":
      applyCircular(npc, speed, walkable);
      break;
    case "aggressive":
      applyAggressive(npc, speed, walkable);
      break;
    case "directed":
      applyDirected(npc, speed, walkable);
      break;
    default:
      applyWander(npc, speed, walkable);
      break;
  }
}
function resetNpcPositions(npcs, x, y) {
  for (const npc of npcs.values()) {
    npc.x = x;
    npc.y = y;
    npc.vx = 0;
    npc.vy = 0;
    npc.facing = "right";
    npc.congressTarget = undefined;
  }
  for (const [name, state] of directedState) {
    state.targetX = x + (Math.random() - 0.5) * 200;
    state.targetY = y + (Math.random() - 0.5) * 200;
    state.stuckTicks = 0;
  }
  console.log(`[npc-ai] Reset ${npcs.size} NPC positions to (${x}, ${y})`);
}
function tickNpcs(npcs, chunks, congressActive) {
  tickBlurbs(npcs);
  const chunk = chunks.get("0:0");
  if (!chunk)
    return;
  const season = getCurrentSeason();
  const speedMod = season === "winter" ? 0.7 : 1;
  for (const npc of npcs.values()) {
    const patternCfg = NPC_PATTERNS[npc.name];
    if (!patternCfg)
      continue;
    const speed = patternCfg.speed * speedMod;
    if (congressActive && !npc.congressTarget) {
      npc.congressTarget = COUNCIL_TARGET;
    } else if (!congressActive) {
      npc.congressTarget = undefined;
    }
    if (npc.congressTarget) {
      const step = greedyStep(npc.x, npc.y, npc.congressTarget.x, npc.congressTarget.y, speed, chunk.walkable);
      npc.vx = step.dx;
      npc.vy = step.dy;
    } else {
      applyPatternBehavior(npc, patternCfg.behavior, speed, chunk.walkable);
    }
    const targetX = npc.x + npc.vx;
    const targetY = npc.y + npc.vy;
    if (isWalkablePixel(targetX, targetY, chunk.walkable)) {
      npc.x = targetX;
      npc.y = targetY;
    } else {
      if (isWalkablePixel(targetX, npc.y, chunk.walkable)) {
        npc.x = targetX;
        npc.vy = -npc.vy * 0.5;
      } else if (isWalkablePixel(npc.x, targetY, chunk.walkable)) {
        npc.y = targetY;
        npc.vx = -npc.vx * 0.5;
      } else {
        npc.vx = 0;
        npc.vy = 0;
        pickWalkableDirection(npc, speed, chunk.walkable);
      }
    }
    const maxX = CHUNK_TILES_W * TILE_SIZE;
    const maxY = CHUNK_TILES_H * TILE_SIZE;
    npc.x = Math.max(TILE_SIZE, Math.min(maxX - TILE_SIZE, npc.x));
    npc.y = Math.max(TILE_SIZE, Math.min(maxY - TILE_SIZE, npc.y));
    if (npc.vx > 0.01)
      npc.facing = "right";
    else if (npc.vx < -0.01)
      npc.facing = "left";
  }
}

// src/persistence.ts
import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
mkdirSync("./db", { recursive: true });
var db = new Database("./db/commons.db", { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
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
var saveNpcStmt = db.prepare("INSERT OR REPLACE INTO npc_positions (name, x, y, facing, updated_at) VALUES (?, ?, ?, ?, ?)");
var savePlayerStmt = db.prepare("INSERT OR REPLACE INTO player_sessions (socket_id, name, color, x, y, chunk_x, chunk_y, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
var loadNpcsStmt = db.prepare("SELECT name, x, y, facing FROM npc_positions");
var upsertWornPathStmt = db.prepare(`INSERT INTO worn_path_tiles (chunk_x, chunk_y, tile_x, tile_y, visit_count, last_visited)
   VALUES (?, ?, ?, ?, 1, ?)
   ON CONFLICT (chunk_x, chunk_y, tile_x, tile_y) DO UPDATE
   SET visit_count = visit_count + 1, last_visited = excluded.last_visited`);
var persistTx = db.transaction((world) => {
  const now = Date.now();
  for (const npc of world.npcs.values()) {
    saveNpcStmt.run(npc.name, npc.x, npc.y, npc.facing, now);
  }
  for (const player of world.players.values()) {
    savePlayerStmt.run(player.socketId, player.name, player.color, player.x, player.y, player.chunkX, player.chunkY, player.lastSeen);
  }
});
function persistState(world) {
  try {
    persistTx(world);
  } catch (err) {
    console.error("[persistence] persistState failed:", err);
    throw err;
  }
}
function loadNpcPositions() {
  const rows = loadNpcsStmt.all();
  const result = new Map;
  for (const row of rows) {
    result.set(row.name, { x: row.x, y: row.y, facing: row.facing });
  }
  return result;
}
function recordWornPath(chunkX, chunkY, tileX, tileY) {
  try {
    upsertWornPathStmt.run(chunkX, chunkY, tileX, tileY, Date.now());
  } catch (err) {
    console.error("[persistence] recordWornPath failed:", err);
    throw err;
  }
}
var loadWornPathsStmt = db.prepare("SELECT tile_x, tile_y, visit_count FROM worn_path_tiles WHERE chunk_x = ? AND chunk_y = ? ORDER BY visit_count DESC LIMIT 500");
function loadWornPathsForChunk(chunkX, chunkY) {
  try {
    const rows = loadWornPathsStmt.all(chunkX, chunkY);
    return rows.map((r) => ({ tileX: r.tile_x, tileY: r.tile_y, visitCount: r.visit_count }));
  } catch (err) {
    console.error("[persistence] loadWornPathsForChunk failed:", err);
    throw err;
  }
}
function resetNpcPositionsInDb(npcNames) {
  const CENTER_X = 490;
  const CENTER_Y = 350;
  const now = Date.now();
  const resetTx = db.transaction(() => {
    for (const name of npcNames) {
      saveNpcStmt.run(name, CENTER_X, CENTER_Y, "right", now);
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

// src/game-loop.ts
var MAX_MOVE_PER_TICK = 20;
var STALE_THRESHOLD = 60 * 1000;
function tickWarthog(warthog, players) {
  warthog.x += warthog.vx;
  warthog.y += warthog.vy;
  warthog.facing = warthog.vx > 0 ? "right" : warthog.vx < 0 ? "left" : warthog.facing;
  warthog.x = Math.max(0, Math.min(800, warthog.x));
  warthog.y = Math.max(0, Math.min(600, warthog.y));
  for (const seatId of warthog.seats) {
    if (seatId) {
      const player = players.get(seatId);
      if (player) {
        player.x = warthog.x;
        player.y = warthog.y;
      }
    }
  }
}
function handleWarthogMessage(socketId, msg, world) {
  const player = world.players.get(socketId);
  if (!player)
    return;
  if (msg.type === "warthog_input") {
    if (world.warthog.seats[0] === socketId) {
      world.warthog.vx = msg.dx * 2;
      world.warthog.vy = msg.dy * 2;
    }
  } else if (msg.type === "warthog_join") {
    const dist = Math.sqrt((player.x - world.warthog.x) ** 2 + (player.y - world.warthog.y) ** 2);
    if (dist < 60) {
      const emptySeat = world.warthog.seats.findIndex((s) => s === null);
      if (emptySeat >= 0) {
        world.warthog.seats[emptySeat] = socketId;
      }
    }
  } else if (msg.type === "warthog_leave") {
    const seatIndex = world.warthog.seats.indexOf(socketId);
    if (seatIndex >= 0) {
      world.warthog.seats[seatIndex] = null;
    }
  }
}
function tickWalkers(walkers) {
  for (const walker of walkers) {
    if (walker.isPaused)
      continue;
    walker.x += walker.speed * (walker.direction === "right" ? 1 : -1);
    if (walker.x < 0 || walker.x > 800) {
      walker.direction = walker.direction === "right" ? "left" : "right";
    }
  }
}
function validateAndApplyMove(player, msg, world) {
  const dx = msg.x - player.x;
  const dy = msg.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let newX;
  let newY;
  if (dist > MAX_MOVE_PER_TICK) {
    const scale = MAX_MOVE_PER_TICK / dist;
    newX = player.x + dx * scale;
    newY = player.y + dy * scale;
  } else {
    newX = msg.x;
    newY = msg.y;
  }
  const chunkKey = `${msg.chunkX}:${msg.chunkY}`;
  const chunk = world.chunks.get(chunkKey);
  if (chunk) {
    const hw = 6, hh = 6;
    const corners = [
      [newX - hw, newY - hh],
      [newX + hw - 1, newY - hh],
      [newX - hw, newY + hh - 1],
      [newX + hw - 1, newY + hh - 1]
    ];
    const blocked = corners.some(([cx, cy]) => !isPixelWalkable(cx, cy, chunk));
    if (blocked) {
      const cornersH = [
        [newX - hw, player.y - hh],
        [newX + hw - 1, player.y - hh],
        [newX - hw, player.y + hh - 1],
        [newX + hw - 1, player.y + hh - 1]
      ];
      const blockedH = cornersH.some(([cx, cy]) => !isPixelWalkable(cx, cy, chunk));
      if (!blockedH) {
        newX = newX;
        newY = player.y;
      } else {
        const cornersV = [
          [player.x - hw, newY - hh],
          [player.x + hw - 1, newY - hh],
          [player.x - hw, newY + hh - 1],
          [player.x + hw - 1, newY + hh - 1]
        ];
        const blockedV = cornersV.some(([cx, cy]) => !isPixelWalkable(cx, cy, chunk));
        if (!blockedV) {
          newX = player.x;
          newY = newY;
        } else {
          newX = player.x;
          newY = player.y;
        }
      }
    }
  }
  player.x = newX;
  player.y = newY;
  player.facing = msg.facing;
  player.chunkX = msg.chunkX;
  player.chunkY = msg.chunkY;
  player.lastProcessedInput = msg.seq;
}
var chunkSubscriptionCb = null;
var forceSyncCb = null;
function setChunkSubscriptionCallback(cb) {
  chunkSubscriptionCb = cb;
}
function setForceSyncCallback(cb) {
  forceSyncCb = cb;
}
function handleClientMessage(socketId, msg, world) {
  const player = world.players.get(socketId);
  if (!player)
    return;
  if (msg.type === "move") {
    const oldChunkX = player.chunkX;
    const oldChunkY = player.chunkY;
    validateAndApplyMove(player, msg, world);
    if (player.chunkX !== oldChunkX || player.chunkY !== oldChunkY) {
      chunkSubscriptionCb?.(socketId, oldChunkX, oldChunkY, player.chunkX, player.chunkY);
    }
  } else if (msg.type === "hop") {
    player.hopFrame = 1;
  } else if (msg.type === "status") {
    player.isAway = msg.away;
  } else if (msg.type === "chunk") {
    const oldChunkX = player.chunkX;
    const oldChunkY = player.chunkY;
    player.chunkX = msg.chunkX;
    player.chunkY = msg.chunkY;
    if (player.chunkX !== oldChunkX || player.chunkY !== oldChunkY) {
      chunkSubscriptionCb?.(socketId, oldChunkX, oldChunkY, player.chunkX, player.chunkY);
    }
  } else if (msg.type === "resync") {
    forceSyncCb?.(socketId);
  } else if (msg.type === "warthog_input" || msg.type === "warthog_join" || msg.type === "warthog_leave") {
    handleWarthogMessage(socketId, msg, world);
  }
}
function evictStalePlayers(world, now) {
  for (const [socketId, player] of world.players) {
    if (now - player.lastSeen > STALE_THRESHOLD) {
      world.players.delete(socketId);
      console.log(`[game-loop] Evicted stale player ${player.name} (${socketId})`);
    }
  }
}
var lastSentState = new Map;
function hasNpcsChanged(current, last) {
  const currArray = Array.from(current.values());
  if (currArray.length !== last.length)
    return true;
  for (let i = 0;i < currArray.length; i++) {
    const c = currArray[i];
    const l = last[i];
    if (!l || c.x !== l.x || c.y !== l.y || c.facing !== l.facing || c.blurb !== l.blurb)
      return true;
  }
  return false;
}
function hasWarthogChanged(current, last) {
  return current.x !== last.x || current.y !== last.y || current.vx !== last.vx || current.vy !== last.vy || current.facing !== last.facing || JSON.stringify(current.seats) !== JSON.stringify(last.seats);
}
function buildTickPayload(world, chunkKey, chunkPlayers, seq, now) {
  const last = lastSentState.get(chunkKey) ?? {
    npcs: [],
    congress: { active: false },
    warthog: { ...world.warthog, seats: [...world.warthog.seats] }
  };
  const payload = {
    type: "tick",
    seq,
    t: now,
    serverTime: now,
    lastProcessedInput: chunkPlayers[0]?.lastProcessedInput ?? 0,
    players: Object.fromEntries(chunkPlayers.map((p) => [p.socketId, p]))
  };
  if (hasNpcsChanged(world.npcs, last.npcs)) {
    payload.npcs = Array.from(world.npcs.values());
    last.npcs = payload.npcs.map((n) => ({ ...n }));
  }
  if (world.congress.active !== last.congress.active) {
    payload.congress = { active: world.congress.active };
    last.congress = { active: world.congress.active };
  }
  if (hasWarthogChanged(world.warthog, last.warthog)) {
    payload.warthog = { ...world.warthog, seats: [...world.warthog.seats] };
    last.warthog = { ...world.warthog, seats: [...world.warthog.seats] };
  }
  lastSentState.set(chunkKey, last);
  return payload;
}
function tickHopFrames(world) {
  for (const player of world.players.values()) {
    if (player.hopFrame > 0) {
      player.hopFrame++;
      if (player.hopFrame > 12)
        player.hopFrame = 0;
    }
  }
}
function runTick(world, broadcast) {
  world.tickCount++;
  const now = Date.now();
  evictStalePlayers(world, now);
  tickHopFrames(world);
  tickNpcs(world.npcs, world.chunks, world.congress.active);
  tickWarthog(world.warthog, world.players);
  tickWalkers(world.walkers);
  const chunkGroups = groupPlayersByChunk(world.players);
  for (const [chunkKey, players] of chunkGroups) {
    const [chunkX, chunkY] = chunkKey.split(":").map(Number);
    const payload = buildTickPayload(world, chunkKey, players, world.tickCount, now);
    broadcast(chunkX, chunkY, JSON.stringify(payload));
  }
  if (world.tickCount % 20 === 0) {
    try {
      persistState(world);
    } catch (err) {
      console.error("[game-loop] Persist failed:", err);
    }
  }
}
function groupPlayersByChunk(players) {
  const groups = new Map;
  for (const player of players.values()) {
    const key = `${player.chunkX}:${player.chunkY}`;
    const group = groups.get(key);
    if (group) {
      group.push(player);
    } else {
      groups.set(key, [player]);
    }
  }
  return groups;
}

// src/audition.ts
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as childProcess from "child_process";
var AGENTS_DIR = "/mnt/data/bigclungus-meta/agents";
var DISCORD_INJECT_URL = "http://127.0.0.1:9876/inject";
var DISCORD_CHANNEL_ID = "1485343472952148008";
var walkerMeta = new Map;
function getInjectSecret() {
  const s = process.env.DISCORD_INJECT_SECRET;
  if (!s)
    throw new Error("DISCORD_INJECT_SECRET not set");
  return s;
}
var GENERATION_PROMPT_BASE = `Generate a unique AI persona for a collaborative commons. Return JSON only:
{
  "name": "First Last",
  "title": "Evocative 2-word title",
  "traits": ["trait1", "trait2", "trait3"],
  "description": "2 sentences describing their worldview and how they'd contribute to debates."
}
Make them interesting, opinionated, and specific. Not generic. Could be philosophical, technical, artistic, contrarian, etc.`;
function getGenerationPrompt(existingNames) {
  const avoidClause = existingNames.length > 0 ? `
Avoid reusing first names already on stage: ${existingNames.join(", ")}.` : "";
  return `${GENERATION_PROMPT_BASE}${avoidClause}
(Random seed for variety: ${Math.random().toString(36).slice(2)})`;
}
var CLAUDE_CLI = "/home/clungus/.local/bin/claude";
async function callClaude(existingNames) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const prompt = getGenerationPrompt(existingNames);
  if (apiKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
    }
    const msg = await response.json();
    return parsePersonaJson(msg.content[0].text);
  }
  const text = await new Promise((resolve, reject) => {
    const proc = childProcess.spawn(CLAUDE_CLI, ["-p", "You generate JSON persona definitions. Return only raw JSON, no markdown.", "--output-format", "text"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 300)}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
  return parsePersonaJson(text);
}
function parsePersonaJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new Error(`No JSON object found in LLM response: ${cleaned.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}
var AVATAR_COLORS = [
  "#e94560",
  "#4ecca3",
  "#60a5fa",
  "#f87171",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#facc15",
  "#f472b6",
  "#38bdf8",
  "#84cc16",
  "#c084fc",
  "#e879f9",
  "#fbbf24"
];
function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
async function spawnWalker(world) {
  const existingNames = world.walkers.map((w) => {
    const meta = walkerMeta.get(w.id);
    return meta?.name ?? w.id;
  });
  const MAX_ATTEMPTS = 3;
  let persona = null;
  for (let attempt = 1;attempt <= MAX_ATTEMPTS; attempt++) {
    const candidate = await callClaude(existingNames);
    const candidateFirst = candidate.name.split(" ")[0].toLowerCase();
    const duplicate = existingNames.some((n) => n.split(" ")[0].toLowerCase() === candidateFirst);
    if (!duplicate) {
      persona = candidate;
      break;
    }
    console.log(`[audition] name collision on "${candidate.name}" (attempt ${attempt}/${MAX_ATTEMPTS}), regenerating`);
  }
  if (!persona) {
    throw new Error(`Could not generate a unique persona after ${MAX_ATTEMPTS} attempts`);
  }
  const id = crypto.randomUUID();
  const walker = {
    id,
    x: -50,
    y: 280,
    speed: 5 + Math.random() * 5,
    direction: "right",
    concept: `${persona.name} \u2014 ${persona.title}`,
    isPaused: false
  };
  walkerMeta.set(id, {
    name: persona.name,
    title: persona.title,
    traits: persona.traits,
    description: persona.description,
    avatarColor: randomColor(),
    createdAt: Date.now()
  });
  world.walkers.push(walker);
  console.log(`[audition] spawned walker: ${persona.name} (${persona.title})`);
  return walker;
}
var spawnScheduleActive = false;
function startSpawnSchedule(world) {
  if (spawnScheduleActive)
    return;
  spawnScheduleActive = true;
  function scheduleNext() {
    const delay = 45000 + Math.random() * 45000;
    setTimeout(async () => {
      try {
        await spawnWalker(world);
      } catch (err) {
        console.error("[audition] spawn failed:", err);
      }
      scheduleNext();
    }, delay);
  }
  spawnWalker(world).catch((err) => console.error("[audition] initial spawn failed:", err));
  scheduleNext();
}
function getWalkersResponse(world) {
  const walkers = world.walkers.map((w) => {
    const meta = walkerMeta.get(w.id);
    return {
      id: w.id,
      name: meta?.name ?? "Unknown",
      title: meta?.title ?? "",
      traits: meta?.traits ?? [],
      description: meta?.description ?? "",
      x: w.x,
      speed: w.speed,
      paused: w.isPaused,
      created_at: meta?.createdAt ?? 0,
      avatar_color: meta?.avatarColor ?? "#ffffff"
    };
  });
  return jsonRes(walkers);
}
function pauseWalker(world, id) {
  const walker = world.walkers.find((w) => w.id === id);
  if (!walker)
    return jsonRes({ error: "walker not found" }, 404);
  walker.isPaused = true;
  return jsonRes({ ok: true, id });
}
function resumeWalker(world, id) {
  const walker = world.walkers.find((w) => w.id === id);
  if (!walker)
    return jsonRes({ error: "walker not found" }, 404);
  walker.isPaused = false;
  return jsonRes({ ok: true, id });
}
async function keepWalker(world, id) {
  const walker = world.walkers.find((w) => w.id === id);
  if (!walker)
    return jsonRes({ error: "walker not found" }, 404);
  const meta = walkerMeta.get(id);
  if (!meta)
    return jsonRes({ error: "walker metadata not found" }, 500);
  savePersonaToAgents(meta);
  try {
    await notifyDiscord(meta);
  } catch (err) {
    console.error("[audition] Discord notify failed:", err);
  }
  world.walkers = world.walkers.filter((w) => w.id !== id);
  walkerMeta.delete(id);
  return jsonRes({ ok: true, id, name: meta.name });
}
function dismissWalker(world, id) {
  const idx = world.walkers.findIndex((w) => w.id === id);
  if (idx === -1)
    return jsonRes({ error: "walker not found" }, 404);
  world.walkers.splice(idx, 1);
  walkerMeta.delete(id);
  return jsonRes({ ok: true, id });
}
function savePersonaToAgents(meta) {
  const slug = meta.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filename = path.join(AGENTS_DIR, `audition-${slug}.md`);
  const today = new Date().toISOString().split("T")[0];
  const traits = meta.traits.map((t) => `  - ${t}`).join(`
`);
  const content = `---
name: ${slug}
display_name: ${meta.name}
title: ${meta.title}
status: eligible
evolves: true
source: audition
added: ${today}
color: ${meta.avatarColor}
---

# ${meta.name} \u2014 ${meta.title}

${meta.description}

## Traits
${traits}

## Notes

Discovered via the persona audition system on ${today}. Requires a Congress session to activate and receive a formal role assignment.
`;
  fs.writeFileSync(filename, content, "utf8");
  console.log(`[audition] saved persona to ${filename}`);
}
async function notifyDiscord(meta) {
  const secret = getInjectSecret();
  const message = `\uD83C\uDF1F New persona candidate kept: **${meta.name}** ("${meta.title}") \u2014 saved to agents roster. Requires a Congress session to activate.`;
  const response = await fetch(DISCORD_INJECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-inject-secret": secret
    },
    body: JSON.stringify({
      content: message,
      chat_id: DISCORD_CHANNEL_ID,
      user: "persona-audition"
    })
  });
  if (!response.ok) {
    throw new Error(`Discord inject failed: ${response.status} ${await response.text()}`);
  }
  console.log(`[audition] notified Discord about ${meta.name}`);
}
function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// src/dungeon/dungeon-manager.ts
var globalSendFn = null;
function setManagerSendFunction(fn) {
  globalSendFn = fn;
}
function broadcastLobbyState(instance) {
  if (!globalSendFn)
    return;
  const players = Array.from(instance.players.values()).map((p) => ({
    playerId: p.id,
    name: p.name,
    personaSlug: p.personaSlug || null,
    ready: !!p.personaSlug
  }));
  const hostId = instance.players.keys().next().value ?? "";
  const msg = {
    type: "d_lobby",
    lobbyId: instance.lobbyId,
    hostId,
    players,
    status: instance.status === "lobby" ? "waiting" : "in_progress"
  };
  for (const [id, player] of instance.players) {
    if (player.connected) {
      globalSendFn(id, msg);
    }
  }
}
var instances = new Map;
var idCounter = 0;
function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}
function genSeed() {
  return Math.random().toString(36).slice(2, 10);
}
function createLobby(hostId, hostName) {
  const id = genId("dng");
  const lobbyId = genId("lob");
  const instance = {
    id,
    lobbyId,
    seed: genSeed(),
    floor: 0,
    tick: 0,
    status: "lobby",
    startedAt: 0,
    players: new Map,
    enemies: new Map,
    projectiles: new Map,
    aoeZones: new Map,
    layout: null,
    tickInterval: null
  };
  const hostPlayer = {
    id: hostId,
    socketId: "",
    name: hostName,
    personaSlug: "",
    x: 0,
    y: 0,
    facing: "right",
    hp: 0,
    maxHp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    lck: 0,
    iframeTicks: 0,
    cooldownTicks: 0,
    cooldownMax: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    diedOnFloor: null,
    powerups: [],
    inputQueue: [],
    connected: true,
    disconnectedAt: null,
    lastProcessedSeq: 0
  };
  instance.players.set(hostId, hostPlayer);
  instances.set(lobbyId, instance);
  console.log(`[dungeon] Lobby ${lobbyId} created by ${hostName}`);
  return instance;
}
function joinLobby(lobbyId, playerId, playerName) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return null;
  if (instance.status !== "lobby")
    return null;
  if (instance.players.size >= 4)
    return null;
  if (instance.players.has(playerId))
    return instance;
  const player = {
    id: playerId,
    socketId: "",
    name: playerName,
    personaSlug: "",
    x: 0,
    y: 0,
    facing: "right",
    hp: 0,
    maxHp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    lck: 0,
    iframeTicks: 0,
    cooldownTicks: 0,
    cooldownMax: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    diedOnFloor: null,
    powerups: [],
    inputQueue: [],
    connected: true,
    disconnectedAt: null,
    lastProcessedSeq: 0
  };
  instance.players.set(playerId, player);
  console.log(`[dungeon] ${playerName} joined lobby ${lobbyId}`);
  return instance;
}
function startRun(lobbyId) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return null;
  if (instance.status !== "lobby")
    return null;
  for (const [_id, player] of instance.players) {
    if (!player.personaSlug) {
      console.warn(`[dungeon] Cannot start \u2014 ${player.name} has no persona selected`);
      return null;
    }
  }
  instance.status = "running";
  instance.floor = 1;
  instance.tick = 0;
  instance.startedAt = Date.now();
  console.log(`[dungeon] Run started for lobby ${lobbyId} (${instance.players.size} players)`);
  return instance;
}
function destroyRun(lobbyId) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return;
  if (instance.tickInterval) {
    clearInterval(instance.tickInterval);
    instance.tickInterval = null;
  }
  instances.delete(lobbyId);
  console.log(`[dungeon] Instance ${lobbyId} destroyed`);
}
function getInstance(lobbyId) {
  return instances.get(lobbyId) ?? null;
}
function getAllInstances() {
  return instances;
}
function handleDisconnect(lobbyId, playerId) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return;
  const player = instance.players.get(playerId);
  if (!player)
    return;
  player.connected = false;
  player.disconnectedAt = Date.now();
  console.log(`[dungeon] ${player.name} disconnected from ${lobbyId}`);
  if (instance.status === "lobby") {
    const anyConnected = Array.from(instance.players.values()).some((p) => p.connected);
    if (!anyConnected) {
      destroyRun(lobbyId);
    }
  }
}
function handleReconnect(lobbyId, playerId, socketId) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return null;
  const player = instance.players.get(playerId);
  if (!player)
    return null;
  player.connected = true;
  player.disconnectedAt = null;
  player.socketId = socketId;
  console.log(`[dungeon] ${player.name} reconnected to ${lobbyId}`);
  return instance;
}
function handleMessage(lobbyId, playerId, msg, _send) {
  const instance = instances.get(lobbyId);
  if (!instance)
    return;
  const player = instance.players.get(playerId);
  if (!player)
    return;
  switch (msg.type) {
    case "d_ready":
      if (instance.status === "lobby") {
        player.personaSlug = msg.personaSlug;
        broadcastLobbyState(instance);
      }
      break;
    case "d_start":
      startRun(lobbyId);
      break;
    case "d_move":
      if (instance.status === "running" || instance.status === "boss") {
        player.inputQueue.push(msg);
      }
      break;
    case "d_attack":
      break;
    case "d_power":
      break;
    case "d_pick_powerup":
      break;
  }
}

// src/dungeon/dungeon-generation.ts
var Tile = {
  FLOOR: 0,
  WALL: 1,
  DOOR_CLOSED: 2,
  DOOR_OPEN: 3,
  SPAWN_POINT: 4,
  TREASURE_CHEST: 5,
  REST_SHRINE: 6,
  STAIRS: 7
};
function hashSeed(str) {
  let h = 0;
  for (let i = 0;i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

class SeededRNG {
  state;
  constructor(seed) {
    this.state = hashSeed(seed);
    if (this.state === 0)
      this.state = 1;
  }
  next() {
    let t = this.state += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    for (let i = arr.length - 1;i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
var MIN_LEAF_SIZE = 8;
var MIN_ROOM_SIZE = 5;
function splitBSP(node, depth, maxDepth, rng) {
  if (depth >= maxDepth)
    return;
  if (node.w < MIN_LEAF_SIZE * 2 && node.h < MIN_LEAF_SIZE * 2)
    return;
  let splitH;
  if (node.w > node.h * 1.4) {
    splitH = false;
  } else if (node.h > node.w * 1.4) {
    splitH = true;
  } else {
    splitH = rng.next() < 0.5;
  }
  if (splitH && node.h < MIN_LEAF_SIZE * 2)
    splitH = false;
  if (!splitH && node.w < MIN_LEAF_SIZE * 2)
    splitH = true;
  if (splitH && node.h < MIN_LEAF_SIZE * 2 || !splitH && node.w < MIN_LEAF_SIZE * 2) {
    return;
  }
  if (splitH) {
    const splitAt = rng.int(MIN_LEAF_SIZE, node.h - MIN_LEAF_SIZE);
    node.left = { x: node.x, y: node.y, w: node.w, h: splitAt, left: null, right: null, room: null };
    node.right = { x: node.x, y: node.y + splitAt, w: node.w, h: node.h - splitAt, left: null, right: null, room: null };
  } else {
    const splitAt = rng.int(MIN_LEAF_SIZE, node.w - MIN_LEAF_SIZE);
    node.left = { x: node.x, y: node.y, w: splitAt, h: node.h, left: null, right: null, room: null };
    node.right = { x: node.x + splitAt, y: node.y, w: node.w - splitAt, h: node.h, left: null, right: null, room: null };
  }
  splitBSP(node.left, depth + 1, maxDepth, rng);
  splitBSP(node.right, depth + 1, maxDepth, rng);
}
function getLeaves(node) {
  if (!node.left && !node.right)
    return [node];
  const leaves = [];
  if (node.left)
    leaves.push(...getLeaves(node.left));
  if (node.right)
    leaves.push(...getLeaves(node.right));
  return leaves;
}
function placeRooms(leaves, rng) {
  const rooms = [];
  let id = 0;
  for (const leaf of leaves) {
    const maxW = leaf.w - 2;
    const maxH = leaf.h - 2;
    if (maxW < MIN_ROOM_SIZE || maxH < MIN_ROOM_SIZE)
      continue;
    const roomW = rng.int(MIN_ROOM_SIZE, maxW);
    const roomH = rng.int(MIN_ROOM_SIZE, maxH);
    const roomX = leaf.x + rng.int(1, leaf.w - roomW - 1);
    const roomY = leaf.y + rng.int(1, leaf.h - roomH - 1);
    const room = { id: id++, x: roomX, y: roomY, w: roomW, h: roomH, type: "combat" };
    leaf.room = room;
    rooms.push(room);
  }
  return rooms;
}
function assignRoomTypes(rooms, hasBoss, rng) {
  if (rooms.length === 0)
    return;
  rooms[0].type = "start";
  if (hasBoss && rooms.length > 1) {
    rooms[rooms.length - 1].type = "boss";
  }
  for (let i = 1;i < rooms.length; i++) {
    if (rooms[i].type !== "combat")
      continue;
    const roll = rng.next();
    if (roll < 0.1) {
      rooms[i].type = "rest";
    } else if (roll < 0.25) {
      rooms[i].type = "treasure";
    } else {
      rooms[i].type = "combat";
    }
  }
  const types = new Set(rooms.map((r) => r.type));
  if (!types.has("treasure") && rooms.length > 3) {
    const candidates = rooms.filter((r) => r.type === "combat");
    if (candidates.length > 0)
      rng.pick(candidates).type = "treasure";
  }
  if (!types.has("rest") && rooms.length > 4) {
    const candidates = rooms.filter((r) => r.type === "combat");
    if (candidates.length > 0)
      rng.pick(candidates).type = "rest";
  }
}
function getRoomCenter(room) {
  return { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
}
function findRoom(node) {
  if (node.room)
    return node.room;
  if (node.left) {
    const r = findRoom(node.left);
    if (r)
      return r;
  }
  if (node.right) {
    const r = findRoom(node.right);
    if (r)
      return r;
  }
  return null;
}
function connectBSP(node, corridors) {
  if (!node.left || !node.right)
    return;
  connectBSP(node.left, corridors);
  connectBSP(node.right, corridors);
  const roomA = findRoom(node.left);
  const roomB = findRoom(node.right);
  if (!roomA || !roomB)
    return;
  const centerA = getRoomCenter(roomA);
  const centerB = getRoomCenter(roomB);
  const points = [];
  const dx = centerB.x > centerA.x ? 1 : -1;
  const dy = centerB.y > centerA.y ? 1 : -1;
  for (let x = centerA.x;x !== centerB.x; x += dx) {
    points.push({ x, y: centerA.y });
  }
  for (let y = centerA.y;y !== centerB.y + dy; y += dy) {
    points.push({ x: centerB.x, y });
  }
  corridors.push({ points, roomA: roomA.id, roomB: roomB.id });
}
function buildTileGrid(width, height, rooms, corridors) {
  const grid = new Uint8Array(width * height);
  grid.fill(Tile.WALL);
  const CORRIDOR_HALF_WIDTH = 1;
  const set = (x, y, tile) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y * width + x] = tile;
    }
  };
  const get = (x, y) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      return grid[y * width + x];
    }
    return Tile.WALL;
  };
  for (const room of rooms) {
    for (let ry = room.y;ry < room.y + room.h; ry++) {
      for (let rx = room.x;rx < room.x + room.w; rx++) {
        set(rx, ry, Tile.FLOOR);
      }
    }
  }
  for (const corridor of corridors) {
    for (const pt of corridor.points) {
      for (let dy = -CORRIDOR_HALF_WIDTH;dy <= CORRIDOR_HALF_WIDTH; dy++) {
        for (let dx = -CORRIDOR_HALF_WIDTH;dx <= CORRIDOR_HALF_WIDTH; dx++) {
          const tx = pt.x + dx;
          const ty = pt.y + dy;
          if (get(tx, ty) === Tile.WALL) {
            set(tx, ty, Tile.FLOOR);
          }
        }
      }
    }
  }
  for (const room of rooms) {
    for (let rx = room.x - 1;rx <= room.x + room.w; rx++) {
      for (let ry = room.y - 1;ry <= room.y + room.h; ry++) {
        const insideX = rx >= room.x && rx < room.x + room.w;
        const insideY = ry >= room.y && ry < room.y + room.h;
        if (insideX && insideY)
          continue;
        if (get(rx, ry) !== Tile.FLOOR)
          continue;
        const adjRoom = get(rx - 1, ry) === Tile.FLOOR && isInRoom(rx - 1, ry, room) || get(rx + 1, ry) === Tile.FLOOR && isInRoom(rx + 1, ry, room) || get(rx, ry - 1) === Tile.FLOOR && isInRoom(rx, ry - 1, room) || get(rx, ry + 1) === Tile.FLOOR && isInRoom(rx, ry + 1, room);
        if (adjRoom) {
          set(rx, ry, Tile.DOOR_CLOSED);
        }
      }
    }
  }
  for (const room of rooms) {
    const cx = Math.floor(room.x + room.w / 2);
    const cy = Math.floor(room.y + room.h / 2);
    switch (room.type) {
      case "start":
        set(cx, cy, Tile.SPAWN_POINT);
        break;
      case "treasure":
        set(cx, cy, Tile.TREASURE_CHEST);
        break;
      case "rest":
        set(cx, cy, Tile.REST_SHRINE);
        break;
      case "boss":
        set(cx, cy, Tile.SPAWN_POINT);
        break;
    }
  }
  const stairsRoom = rooms[rooms.length - 1];
  const sx = stairsRoom.x + stairsRoom.w - 2;
  const sy = stairsRoom.y + stairsRoom.h - 2;
  if (sx > stairsRoom.x && sy > stairsRoom.y) {
    set(sx, sy, Tile.STAIRS);
  }
  return grid;
}
function isInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}
function spawnEnemies(rooms, floorNumber, enemyBudget, enemyScaling, enemyVariants, rng) {
  const spawns = [];
  const available = enemyVariants.filter((v) => v.floor_min <= floorNumber);
  if (available.length === 0)
    return spawns;
  const combatRooms = rooms.filter((r) => r.type === "combat" || r.type === "boss");
  if (combatRooms.length === 0)
    return spawns;
  const totalBudget = Math.floor(enemyBudget * enemyScaling);
  let remaining = totalBudget;
  const roomBudgets = new Map;
  const basePer = Math.floor(totalBudget / combatRooms.length);
  for (const room of combatRooms) {
    const variance = rng.int(-Math.floor(basePer * 0.3), Math.floor(basePer * 0.3));
    const budget = Math.max(1, basePer + variance);
    roomBudgets.set(room.id, Math.min(budget, remaining));
    remaining -= Math.min(budget, remaining);
    if (remaining <= 0)
      break;
  }
  if (remaining > 0) {
    const bossRoom = combatRooms.find((r) => r.type === "boss");
    if (bossRoom) {
      roomBudgets.set(bossRoom.id, (roomBudgets.get(bossRoom.id) ?? 0) + remaining);
    } else {
      const first = combatRooms[0];
      roomBudgets.set(first.id, (roomBudgets.get(first.id) ?? 0) + remaining);
    }
  }
  for (const room of combatRooms) {
    let budget = roomBudgets.get(room.id) ?? 0;
    const minX = room.x + 1;
    const maxX = room.x + room.w - 2;
    const minY = room.y + 1;
    const maxY = room.y + room.h - 2;
    if (maxX <= minX || maxY <= minY)
      continue;
    let attempts = 0;
    while (budget > 0 && attempts < 100) {
      attempts++;
      const variant = rng.pick(available);
      if (variant.budget_cost > budget) {
        const cheaper = available.filter((v) => v.budget_cost <= budget);
        if (cheaper.length === 0)
          break;
        const picked = rng.pick(cheaper);
        spawns.push({
          variantId: picked.id,
          x: rng.int(minX, maxX),
          y: rng.int(minY, maxY),
          roomId: room.id
        });
        budget -= picked.budget_cost;
      } else {
        spawns.push({
          variantId: variant.id,
          x: rng.int(minX, maxX),
          y: rng.int(minY, maxY),
          roomId: room.id
        });
        budget -= variant.budget_cost;
      }
    }
  }
  return spawns;
}
function floorDimensions(floorNumber) {
  const scale = 1 + (floorNumber - 1) * 0.15;
  return {
    width: Math.floor(80 * scale),
    height: Math.floor(60 * scale)
  };
}
function splitDepth(floorNumber) {
  return Math.min(4 + Math.floor((floorNumber - 1) / 2), 6);
}
function generateFloor(seed, floorNumber, floorTemplate, enemyVariants) {
  const rng = new SeededRNG(seed);
  const { width, height } = floorDimensions(floorNumber);
  const depth = splitDepth(floorNumber);
  const root = { x: 0, y: 0, w: width, h: height, left: null, right: null, room: null };
  splitBSP(root, 0, depth, rng);
  const leaves = getLeaves(root);
  const rooms = placeRooms(leaves, rng);
  if (rooms.length === 0) {
    throw new Error(`BSP produced zero rooms for seed="${seed}" floor=${floorNumber}`);
  }
  const hasBoss = floorTemplate.boss_type_id !== null;
  assignRoomTypes(rooms, hasBoss, rng);
  const corridors = [];
  connectBSP(root, corridors);
  const tileGrid = buildTileGrid(width, height, rooms, corridors);
  const enemySpawns = spawnEnemies(rooms, floorNumber, floorTemplate.enemy_budget, floorTemplate.enemy_scaling, enemyVariants, rng);
  return {
    width,
    height,
    rooms,
    corridors,
    tileGrid,
    enemySpawns,
    seed,
    floorNumber
  };
}
var TILE_CHARS = {
  [Tile.WALL]: "#",
  [Tile.FLOOR]: ".",
  [Tile.DOOR_CLOSED]: "D",
  [Tile.DOOR_OPEN]: "d",
  [Tile.SPAWN_POINT]: "S",
  [Tile.TREASURE_CHEST]: "T",
  [Tile.REST_SHRINE]: "R",
  [Tile.STAIRS]: ">"
};
if (false) {}

// src/dungeon/collision.ts
var SOLID_TILES2 = new Set([1, 2]);
function circleVsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rSum = ar + br;
  return dx * dx + dy * dy <= rSum * rSum;
}
function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= cr * cr;
}
function pointInCone(px, py, originX, originY, facing, angleDeg, range) {
  const dx = px - originX;
  const dy = py - originY;
  const distSq = dx * dx + dy * dy;
  if (distSq > range * range)
    return false;
  const facingAngle = facing === "right" ? 0 : Math.PI;
  const angleToPoint = Math.atan2(dy, dx);
  let diff = angleToPoint - facingAngle;
  if (diff > Math.PI)
    diff -= 2 * Math.PI;
  if (diff < -Math.PI)
    diff += 2 * Math.PI;
  const halfCone = angleDeg / 2 * (Math.PI / 180);
  return Math.abs(diff) <= halfCone;
}
function lineOfSight(x1, y1, x2, y2, tileGrid, gridWidth, tileSize = 16) {
  let tx0 = Math.floor(x1 / tileSize);
  let ty0 = Math.floor(y1 / tileSize);
  const tx1 = Math.floor(x2 / tileSize);
  const ty1 = Math.floor(y2 / tileSize);
  const dx = Math.abs(tx1 - tx0);
  const dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1;
  const sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    const idx = ty0 * gridWidth + tx0;
    if (idx >= 0 && idx < tileGrid.length && SOLID_TILES2.has(tileGrid[idx])) {
      return false;
    }
    if (tx0 === tx1 && ty0 === ty1)
      break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      tx0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      ty0 += sy;
    }
  }
  return true;
}
function wallSlide(x, y, dx, dy, radius, tileGrid, gridWidth, gridHeight, tileSize = 16) {
  const nx = x + dx;
  const ny = y + dy;
  if (!collidesWithGrid(nx, ny, radius, tileGrid, gridWidth, gridHeight, tileSize)) {
    return { x: nx, y: ny };
  }
  const slideX = !collidesWithGrid(nx, y, radius, tileGrid, gridWidth, gridHeight, tileSize);
  const slideY = !collidesWithGrid(x, ny, radius, tileGrid, gridWidth, gridHeight, tileSize);
  if (slideX && slideY) {
    return Math.abs(dx) >= Math.abs(dy) ? { x: nx, y } : { x, y: ny };
  }
  if (slideX)
    return { x: nx, y };
  if (slideY)
    return { x, y: ny };
  return { x, y };
}
function collidesWithGrid(cx, cy, radius, tileGrid, gridWidth, gridHeight, tileSize) {
  const minTX = Math.max(0, Math.floor((cx - radius) / tileSize));
  const maxTX = Math.min(gridWidth - 1, Math.floor((cx + radius) / tileSize));
  const minTY = Math.max(0, Math.floor((cy - radius) / tileSize));
  const maxTY = Math.min(gridHeight - 1, Math.floor((cy + radius) / tileSize));
  for (let ty = minTY;ty <= maxTY; ty++) {
    for (let tx = minTX;tx <= maxTX; tx++) {
      const tile = tileGrid[ty * gridWidth + tx];
      if (SOLID_TILES2.has(tile)) {
        if (circleVsRect(cx, cy, radius, tx * tileSize, ty * tileSize, tileSize, tileSize)) {
          return true;
        }
      }
    }
  }
  return false;
}

// src/dungeon/combat.ts
var AUTO_ATTACK_RANGE = 44;
var HOLDEN_CONE_ANGLE = 60;
var HOLDEN_RANGE = 48;
var HOLDEN_STUN_TICKS = 24;
var HOLDEN_COOLDOWN_TICKS = 128;
var BROSEIDON_WINDOW_TICKS = 160;
var BROSEIDON_COOLDOWN_TICKS = 160;
var DECKARD_RADIUS = 48;
var DECKARD_DURATION_TICKS = 64;
var DECKARD_SLOW = 0.6;
var DECKARD_COOLDOWN_TICKS = 192;
var GALACTUS_RANGE = 36;
var GALACTUS_HP_THRESHOLD = 0.2;
var GALACTUS_HEAL_FRACTION = 0.15;
var GALACTUS_COOLDOWN_TICKS = 96;
function resolveAutoAttack(attacker, targets, tick) {
  let bestDist = Infinity;
  let bestTarget = null;
  for (const t of targets) {
    if (!t.alive)
      continue;
    if (t.iFrameUntilTick > tick)
      continue;
    const dx = attacker.x - t.x;
    const dy = attacker.y - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= AUTO_ATTACK_RANGE + attacker.radius + t.radius && dist < bestDist) {
      bestDist = dist;
      bestTarget = t;
    }
  }
  if (!bestTarget)
    return null;
  return rollDamage(attacker, bestTarget, tick);
}
function rollDamage(attacker, target, tick) {
  const variance = 1 + (Math.random() * 0.2 - 0.1);
  const rawDamage = attacker.stats.ATK * variance;
  const mitigation = target.stats.DEF * 0.5;
  let finalDamage = Math.max(1, Math.floor(rawDamage - mitigation));
  const isCrit = Math.random() < attacker.stats.critChance;
  if (isCrit) {
    finalDamage = Math.floor(finalDamage * 1.5);
  }
  return {
    hit: true,
    damage: finalDamage,
    isCrit,
    targetId: target.id,
    attackerId: attacker.id
  };
}
function resolvePower(player, enemies, aoeZones, tick) {
  if (player.powerCooldownUntilTick > tick)
    return null;
  if (!player.alive)
    return null;
  switch (player.persona) {
    case "holden":
      return resolveHolden(player, enemies, tick);
    case "broseidon":
      return resolveBroseidon(player, tick);
    case "deckard_cain":
      return resolveDeckard(player, aoeZones, tick);
    case "galactus":
      return resolveGalactus(player, enemies, tick);
  }
}
function resolveHolden(player, enemies, tick) {
  const affected = [];
  for (const e of enemies) {
    if (!e.alive)
      continue;
    if (pointInCone(e.x, e.y, player.x, player.y, player.facing, HOLDEN_CONE_ANGLE, HOLDEN_RANGE)) {
      e.stunUntilTick = tick + HOLDEN_STUN_TICKS;
      affected.push(e.id);
    }
  }
  player.powerCooldownUntilTick = tick + HOLDEN_COOLDOWN_TICKS;
  return { activated: true, powerName: "overwhelming_force", affected };
}
function resolveBroseidon(player, tick) {
  player.broseidonWindowEnd = tick + BROSEIDON_WINDOW_TICKS;
  player.broseidonStacks = 0;
  player.powerCooldownUntilTick = tick + BROSEIDON_COOLDOWN_TICKS;
  return {
    activated: true,
    powerName: "progressive_overload",
    affected: [],
    atkBonus: 0
  };
}
function resolveDeckard(player, aoeZones, tick) {
  const zoneId = `zone_${player.id}_${tick}`;
  const zone = {
    id: zoneId,
    x: player.x,
    y: player.y,
    radius: DECKARD_RADIUS,
    expiresAtTick: tick + DECKARD_DURATION_TICKS,
    owner: player.id,
    type: "deckard_slow",
    slowFactor: DECKARD_SLOW
  };
  aoeZones.push(zone);
  player.powerCooldownUntilTick = tick + DECKARD_COOLDOWN_TICKS;
  return {
    activated: true,
    powerName: "stay_awhile",
    affected: [],
    spawnedZone: zone
  };
}
function resolveGalactus(player, enemies, tick) {
  const affected = [];
  let totalHeal = 0;
  for (const e of enemies) {
    if (!e.alive)
      continue;
    const hpFraction = e.hp / e.maxHP;
    if (hpFraction >= GALACTUS_HP_THRESHOLD)
      continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GALACTUS_RANGE + player.radius + e.radius)
      continue;
    e.hp = 0;
    e.alive = false;
    affected.push(e.id);
    const heal = Math.floor(player.maxHP * GALACTUS_HEAL_FRACTION);
    totalHeal += heal;
  }
  player.hp = Math.min(player.maxHP, player.hp + totalHeal);
  player.powerCooldownUntilTick = tick + GALACTUS_COOLDOWN_TICKS;
  return {
    activated: true,
    powerName: "consume",
    affected,
    healed: totalHeal
  };
}
function tickAoEZones(zones, enemies, tick) {
  const expired = [];
  for (const zone of zones) {
    if (tick >= zone.expiresAtTick) {
      expired.push(zone.id);
      continue;
    }
    if (zone.type === "deckard_slow") {
      for (const e of enemies) {
        if (!e.alive)
          continue;
        if (circleVsCircle(e.x, e.y, e.radius, zone.x, zone.y, zone.radius)) {
          e.slowMultiplier = zone.slowFactor;
        }
      }
    }
  }
  return expired;
}

// src/dungeon/enemy-ai.ts
var AGGRO_RADIUS = 128;
var DEAGGRO_RADIUS = 192;
var BRUTE_TELEGRAPH_TICKS = 16;
var BRUTE_CHARGE_DISTANCE = 48;
var BRUTE_CHARGE_SPEED_MULT = 3;
var BRUTE_COOLDOWN_TICKS = 32;
var BRUTE_TRIGGER_RANGE = 80;
var SPITTER_MIN_DIST = 128;
var SPITTER_MAX_DIST = 192;
var SPITTER_SHOT_COOLDOWN = 32;
var SPITTER_PROJECTILE_SPEED = 3;
var SPITTER_PROJECTILE_RADIUS = 4;
var SPITTER_PROJECTILE_LIFETIME = 64;
var SPITTER_SPREAD = 0.15;
function updateEnemyAI(enemy, aiState, players, tileGrid, gridWidth, gridHeight, tick, tileSize = 16) {
  const idle = { type: "idle", dx: 0, dy: 0 };
  if (!enemy.alive)
    return idle;
  if (enemy.stunUntilTick > tick)
    return idle;
  const target = findNearestPlayer(enemy, players);
  if (!target)
    return idle;
  const dx0 = target.x - enemy.x;
  const dy0 = target.y - enemy.y;
  const distToTarget = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  if (!aiState.aggrod) {
    if (distToTarget > AGGRO_RADIUS)
      return idle;
    aiState.aggrod = true;
  } else if (distToTarget > DEAGGRO_RADIUS) {
    aiState.aggrod = false;
    return idle;
  }
  const effectiveSpeed = enemy.stats.SPD * enemy.slowMultiplier;
  switch (aiState.behavior) {
    case "melee_chase":
      return crawlerAI(enemy, target, effectiveSpeed, tileGrid, gridWidth, gridHeight, tileSize);
    case "ranged_pattern":
      return spitterAI(enemy, aiState, target, effectiveSpeed, tileGrid, gridWidth, gridHeight, tick, tileSize);
    case "slow_charge":
      return bruteAI(enemy, aiState, target, effectiveSpeed, tileGrid, gridWidth, gridHeight, tick, tileSize);
  }
}
function crawlerAI(enemy, target, speed, tileGrid, gridWidth, gridHeight, tileSize) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= enemy.radius + target.radius + 2) {
    return { type: "attack", dx: 0, dy: 0 };
  }
  const nx = dx / dist * speed;
  const ny = dy / dist * speed;
  const slid = wallSlide(enemy.x, enemy.y, nx, ny, enemy.radius, tileGrid, gridWidth, gridHeight, tileSize);
  return {
    type: "move",
    dx: slid.x - enemy.x,
    dy: slid.y - enemy.y
  };
}
function spitterAI(enemy, aiState, target, speed, tileGrid, gridWidth, gridHeight, tick, tileSize) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let moveDx = 0;
  let moveDy = 0;
  if (dist < SPITTER_MIN_DIST) {
    moveDx = -dx / dist * speed;
    moveDy = -dy / dist * speed;
  } else if (dist > SPITTER_MAX_DIST) {
    moveDx = dx / dist * speed * 0.5;
    moveDy = dy / dist * speed * 0.5;
  }
  const slid = wallSlide(enemy.x, enemy.y, moveDx, moveDy, enemy.radius, tileGrid, gridWidth, gridHeight, tileSize);
  const finalDx = slid.x - enemy.x;
  const finalDy = slid.y - enemy.y;
  if (tick >= aiState.shotCooldownUntilTick && dist <= SPITTER_MAX_DIST * 1.5) {
    if (lineOfSight(enemy.x, enemy.y, target.x, target.y, tileGrid, gridWidth, tileSize)) {
      aiState.shotCooldownUntilTick = tick + SPITTER_SHOT_COOLDOWN;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * SPITTER_SPREAD;
      const projVx = Math.cos(angle) * SPITTER_PROJECTILE_SPEED;
      const projVy = Math.sin(angle) * SPITTER_PROJECTILE_SPEED;
      return {
        type: "attack",
        dx: finalDx,
        dy: finalDy,
        projectile: {
          x: enemy.x,
          y: enemy.y,
          vx: projVx,
          vy: projVy,
          damage: enemy.stats.ATK,
          radius: SPITTER_PROJECTILE_RADIUS,
          lifetimeTicks: SPITTER_PROJECTILE_LIFETIME
        }
      };
    }
  }
  return { type: "move", dx: finalDx, dy: finalDy };
}
function bruteAI(enemy, aiState, target, speed, tileGrid, gridWidth, gridHeight, tick, tileSize) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (aiState.chargeStartTick > 0) {
    const chargeTicksElapsed = tick - aiState.chargeStartTick;
    const chargeSpeed = speed * BRUTE_CHARGE_SPEED_MULT;
    const distanceTraveled = chargeTicksElapsed * chargeSpeed;
    if (distanceTraveled >= BRUTE_CHARGE_DISTANCE) {
      aiState.chargeStartTick = 0;
      aiState.cooldownUntilTick = tick + BRUTE_COOLDOWN_TICKS;
      return { type: "idle", dx: 0, dy: 0 };
    }
    const chargeDx = aiState.chargeDx * chargeSpeed;
    const chargeDy = aiState.chargeDy * chargeSpeed;
    const slid2 = wallSlide(enemy.x, enemy.y, chargeDx, chargeDy, enemy.radius, tileGrid, gridWidth, gridHeight, tileSize);
    if (slid2.x === enemy.x && slid2.y === enemy.y) {
      aiState.chargeStartTick = 0;
      aiState.cooldownUntilTick = tick + BRUTE_COOLDOWN_TICKS;
      return { type: "idle", dx: 0, dy: 0 };
    }
    return { type: "charge", dx: slid2.x - enemy.x, dy: slid2.y - enemy.y };
  }
  if (aiState.telegraphStartTick > 0) {
    if (tick - aiState.telegraphStartTick >= BRUTE_TELEGRAPH_TICKS) {
      aiState.telegraphStartTick = 0;
      aiState.chargeStartTick = tick;
      if (dist > 0) {
        aiState.chargeDx = dx / dist;
        aiState.chargeDy = dy / dist;
      }
      return { type: "charge", dx: 0, dy: 0 };
    }
    return { type: "telegraph", dx: 0, dy: 0, telegraphTicks: tick - aiState.telegraphStartTick };
  }
  if (tick < aiState.cooldownUntilTick) {
    return { type: "idle", dx: 0, dy: 0 };
  }
  if (dist <= BRUTE_TRIGGER_RANGE) {
    aiState.telegraphStartTick = tick;
    return { type: "telegraph", dx: 0, dy: 0, telegraphTicks: 0 };
  }
  const moveDx = dx / dist * speed * 0.6;
  const moveDy = dy / dist * speed * 0.6;
  const slid = wallSlide(enemy.x, enemy.y, moveDx, moveDy, enemy.radius, tileGrid, gridWidth, gridHeight, tileSize);
  return { type: "move", dx: slid.x - enemy.x, dy: slid.y - enemy.y };
}
function findNearestPlayer(enemy, players) {
  let bestDist = Infinity;
  let best = null;
  for (const p of players) {
    if (!p.alive)
      continue;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}
function createEnemyAIState(behavior) {
  return {
    behavior,
    aggrod: false,
    telegraphStartTick: 0,
    chargeStartTick: 0,
    chargeDx: 0,
    chargeDy: 0,
    cooldownUntilTick: 0,
    shotCooldownUntilTick: 0
  };
}
function resetSlowMultipliers(enemies) {
  for (const e of enemies) {
    e.slowMultiplier = 1;
  }
}

// src/dungeon/boss-ai.ts
var HM_SPAWN_INTERVAL_P1 = 80;
var HM_SPAWN_INTERVAL_P2 = 48;
var HM_SPAWN_COUNT_P1 = 3;
var HM_SPAWN_COUNT_P2 = 5;
var HM_PHASE2_THRESHOLD = 0.5;
var SL_BURST_INTERVAL = 64;
var SL_BURST_COUNT = 8;
var SL_AIMED_COUNT = 3;
var SL_PROJ_SPEED = 2.5;
var SL_PROJ_RADIUS = 5;
var SL_PROJ_LIFETIME = 80;
var SL_PHASE2_THRESHOLD = 0.5;
var SL_POISON_RADIUS = 32;
var SL_POISON_DURATION = 96;
var SL_POISON_DAMAGE = 1;
var ARCH_SUMMON_INTERVAL = 96;
var ARCH_PHASE2_THRESHOLD = 0.6;
var ARCH_PHASE3_THRESHOLD = 0.3;
var ARCH_COMBO_TELEGRAPH = 16;
var ARCH_COMBO_STEPS = 3;
var ARCH_COMBO_STEP_TICKS = 12;
var ARCH_HAZARD_RADIUS = 40;
var ARCH_HAZARD_DURATION = 128;
var ARCH_HAZARD_DAMAGE = 2;
function updateBossAI(boss, aiState, players, enemies, tileGrid, gridWidth, tick) {
  const idle = { type: "idle", dx: 0, dy: 0 };
  if (!boss.alive)
    return idle;
  if (boss.stunUntilTick > tick)
    return idle;
  updatePhase(boss, aiState);
  switch (aiState.bossType) {
    case "hive_mother":
      return hiveMother(boss, aiState, players, tick);
    case "spore_lord":
      return sporeLord(boss, aiState, players, tick);
    case "the_architect":
      return theArchitect(boss, aiState, players, enemies, tick);
  }
}
function updatePhase(boss, aiState) {
  const hpFrac = boss.hp / boss.maxHP;
  switch (aiState.bossType) {
    case "hive_mother":
      if (hpFrac <= HM_PHASE2_THRESHOLD && aiState.phase < 2) {
        aiState.phase = 2;
        aiState.enraged = true;
      }
      break;
    case "spore_lord":
      if (hpFrac <= SL_PHASE2_THRESHOLD && aiState.phase < 2) {
        aiState.phase = 2;
      }
      break;
    case "the_architect":
      if (hpFrac <= ARCH_PHASE3_THRESHOLD && aiState.phase < 3) {
        aiState.phase = 3;
      } else if (hpFrac <= ARCH_PHASE2_THRESHOLD && aiState.phase < 2) {
        aiState.phase = 2;
      }
      break;
  }
}
function hiveMother(boss, aiState, players, tick) {
  const interval = aiState.phase >= 2 ? HM_SPAWN_INTERVAL_P2 : HM_SPAWN_INTERVAL_P1;
  const count = aiState.phase >= 2 ? HM_SPAWN_COUNT_P2 : HM_SPAWN_COUNT_P1;
  if (tick < aiState.actionCooldownUntilTick) {
    return { type: "idle", dx: 0, dy: 0 };
  }
  aiState.actionCooldownUntilTick = tick + interval;
  const spawns = [];
  for (let i = 0;i < count; i++) {
    const angle = 2 * Math.PI * i / count;
    const spawnDist = boss.radius + 24;
    spawns.push({
      behavior: "melee_chase",
      x: boss.x + Math.cos(angle) * spawnDist,
      y: boss.y + Math.sin(angle) * spawnDist,
      hpScale: aiState.enraged ? 1.3 : 1
    });
  }
  return { type: "spawn_wave", dx: 0, dy: 0, spawns };
}
function sporeLord(boss, aiState, players, tick) {
  if (tick < aiState.actionCooldownUntilTick) {
    return { type: "idle", dx: 0, dy: 0 };
  }
  aiState.actionCooldownUntilTick = tick + SL_BURST_INTERVAL;
  const target = findNearestPlayer2(boss, players);
  if (aiState.phase >= 2 && target) {
    if (tick / SL_BURST_INTERVAL % 2 < 1) {
      return sporeLordBurst(boss, target);
    }
    return sporeLordPoison(boss, target);
  }
  if (target) {
    return sporeLordBurst(boss, target);
  }
  return { type: "idle", dx: 0, dy: 0 };
}
function sporeLordBurst(boss, target) {
  const projectiles = [];
  for (let i = 0;i < SL_BURST_COUNT; i++) {
    const angle = 2 * Math.PI * i / SL_BURST_COUNT;
    projectiles.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * SL_PROJ_SPEED,
      vy: Math.sin(angle) * SL_PROJ_SPEED,
      damage: boss.stats.ATK,
      radius: SL_PROJ_RADIUS,
      lifetimeTicks: SL_PROJ_LIFETIME
    });
  }
  const dx = target.x - boss.x;
  const dy = target.y - boss.y;
  const baseAngle = Math.atan2(dy, dx);
  for (let i = 0;i < SL_AIMED_COUNT; i++) {
    const spread = (i - Math.floor(SL_AIMED_COUNT / 2)) * 0.15;
    const angle = baseAngle + spread;
    projectiles.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * SL_PROJ_SPEED * 1.5,
      vy: Math.sin(angle) * SL_PROJ_SPEED * 1.5,
      damage: boss.stats.ATK,
      radius: SL_PROJ_RADIUS,
      lifetimeTicks: SL_PROJ_LIFETIME
    });
  }
  return { type: "projectile_burst", dx: 0, dy: 0, projectiles };
}
function sporeLordPoison(boss, target) {
  return {
    type: "spawn_zone",
    dx: 0,
    dy: 0,
    zone: {
      x: target.x,
      y: target.y,
      radius: SL_POISON_RADIUS,
      durationTicks: SL_POISON_DURATION,
      type: "poison",
      damagePerTick: SL_POISON_DAMAGE
    }
  };
}
function theArchitect(boss, aiState, players, enemies, tick) {
  switch (aiState.phase) {
    case 1:
      return architectPhase1(boss, aiState, tick);
    case 2:
      return architectPhase2(boss, aiState, players, tick);
    case 3:
      return architectPhase3(boss, aiState, players, tick);
    default:
      return { type: "idle", dx: 0, dy: 0 };
  }
}
function architectPhase1(boss, aiState, tick) {
  if (tick < aiState.actionCooldownUntilTick) {
    return { type: "idle", dx: 0, dy: 0 };
  }
  aiState.actionCooldownUntilTick = tick + ARCH_SUMMON_INTERVAL;
  const behaviors = ["melee_chase", "ranged_pattern", "slow_charge"];
  const spawns = [];
  for (let i = 0;i < behaviors.length; i++) {
    const angle = 2 * Math.PI * i / behaviors.length;
    const dist = boss.radius + 40;
    spawns.push({
      behavior: behaviors[i],
      x: boss.x + Math.cos(angle) * dist,
      y: boss.y + Math.sin(angle) * dist,
      hpScale: 1.2
    });
  }
  return { type: "spawn_wave", dx: 0, dy: 0, spawns };
}
function architectPhase2(boss, aiState, players, tick) {
  const target = findNearestPlayer2(boss, players);
  if (!target)
    return { type: "idle", dx: 0, dy: 0 };
  if (aiState.comboStartTick > 0) {
    const elapsed = tick - aiState.comboStartTick;
    if (elapsed < ARCH_COMBO_TELEGRAPH) {
      return { type: "telegraph", dx: 0, dy: 0, telegraphTicks: ARCH_COMBO_TELEGRAPH - elapsed };
    }
    const strikePhase = elapsed - ARCH_COMBO_TELEGRAPH;
    const step = Math.floor(strikePhase / ARCH_COMBO_STEP_TICKS);
    if (step >= ARCH_COMBO_STEPS) {
      aiState.comboStartTick = 0;
      aiState.comboStep = 0;
      aiState.actionCooldownUntilTick = tick + 48;
      return { type: "idle", dx: 0, dy: 0 };
    }
    if (step > aiState.comboStep) {
      aiState.comboStep = step;
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      const angle = Math.atan2(dy, dx);
      const projectiles = [{
        x: boss.x,
        y: boss.y,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        damage: Math.floor(boss.stats.ATK * 1.5),
        radius: 6,
        lifetimeTicks: 48
      }];
      return { type: "combo", dx: 0, dy: 0, projectiles };
    }
    return { type: "combo", dx: 0, dy: 0 };
  }
  if (tick < aiState.actionCooldownUntilTick) {
    const dx = target.x - boss.x;
    const dy = target.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 60) {
      const speed = boss.stats.SPD * boss.slowMultiplier;
      return {
        type: "move",
        dx: dx / dist * speed,
        dy: dy / dist * speed
      };
    }
    return { type: "idle", dx: 0, dy: 0 };
  }
  aiState.comboStartTick = tick;
  aiState.comboStep = 0;
  return { type: "telegraph", dx: 0, dy: 0, telegraphTicks: ARCH_COMBO_TELEGRAPH };
}
function architectPhase3(boss, aiState, players, tick) {
  const target = findNearestPlayer2(boss, players);
  if (!target)
    return { type: "idle", dx: 0, dy: 0 };
  if (tick < aiState.actionCooldownUntilTick) {
    return architectPhase2(boss, aiState, players, tick);
  }
  const actionCycle = Math.floor(tick / ARCH_SUMMON_INTERVAL) % 3;
  if (actionCycle === 0) {
    aiState.actionCooldownUntilTick = tick + ARCH_SUMMON_INTERVAL;
    return {
      type: "spawn_zone",
      dx: 0,
      dy: 0,
      zone: {
        x: target.x,
        y: target.y,
        radius: ARCH_HAZARD_RADIUS,
        durationTicks: ARCH_HAZARD_DURATION,
        type: "hazard",
        damagePerTick: ARCH_HAZARD_DAMAGE
      }
    };
  }
  if (actionCycle === 1) {
    aiState.actionCooldownUntilTick = tick + ARCH_SUMMON_INTERVAL;
    const spawns = [
      { behavior: "melee_chase", x: boss.x + 40, y: boss.y, hpScale: 1 },
      { behavior: "melee_chase", x: boss.x - 40, y: boss.y, hpScale: 1 },
      { behavior: "ranged_pattern", x: boss.x, y: boss.y + 40, hpScale: 1 }
    ];
    return { type: "spawn_wave", dx: 0, dy: 0, spawns };
  }
  aiState.actionCooldownUntilTick = tick + ARCH_SUMMON_INTERVAL;
  const projectiles = [];
  for (let i = 0;i < 12; i++) {
    const angle = 2 * Math.PI * i / 12;
    projectiles.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3,
      damage: boss.stats.ATK,
      radius: 5,
      lifetimeTicks: 64
    });
  }
  return { type: "projectile_burst", dx: 0, dy: 0, projectiles };
}
function findNearestPlayer2(boss, players) {
  let bestDist = Infinity;
  let best = null;
  for (const p of players) {
    if (!p.alive)
      continue;
    const dx = boss.x - p.x;
    const dy = boss.y - p.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}
function createBossAIState(bossType) {
  return {
    bossType,
    phase: 1,
    actionCooldownUntilTick: 0,
    comboStep: 0,
    comboStartTick: 0,
    enraged: false
  };
}

// src/dungeon/stats.ts
function calculateEffectiveStats(base, powerups) {
  const effective = {
    maxHP: base.maxHP,
    ATK: base.ATK,
    DEF: base.DEF,
    SPD: base.SPD,
    LCK: base.LCK
  };
  for (const p of powerups) {
    if (p.modifiers.maxHP)
      effective.maxHP += p.modifiers.maxHP;
    if (p.modifiers.ATK)
      effective.ATK += p.modifiers.ATK;
    if (p.modifiers.DEF)
      effective.DEF += p.modifiers.DEF;
    if (p.modifiers.SPD)
      effective.SPD += p.modifiers.SPD;
    if (p.modifiers.LCK)
      effective.LCK += p.modifiers.LCK;
  }
  effective.maxHP = Math.max(1, effective.maxHP);
  effective.ATK = Math.max(0, effective.ATK);
  effective.DEF = Math.max(0, effective.DEF);
  effective.SPD = Math.max(0.5, effective.SPD);
  effective.LCK = Math.max(0, effective.LCK);
  const autoAttackIntervalMs = 600 / (1 + effective.SPD * 0.05);
  const critChance = Math.min(0.8, effective.LCK * 0.02);
  return {
    ...effective,
    autoAttackIntervalMs,
    critChance
  };
}

// src/dungeon/dungeon-protocol.ts
var TILE2 = {
  FLOOR: 0,
  WALL: 1,
  DOOR_CLOSED: 2,
  DOOR_OPEN: 3,
  SPAWN: 4,
  TREASURE: 5,
  SHRINE: 6,
  STAIRS: 7
};

// src/dungeon/loot.ts
var RARITY_WEIGHTS = {
  common: 60,
  uncommon: 30,
  rare: 10
};
var FLOOR_UNCOMMON_BONUS = 5;
var FLOOR_RARE_BONUS = 3;

class LootRegistry {
  items = [];
  loadFromDB(db2) {
    const rows = db2.query("SELECT id, slug, name, description, stat_modifier, rarity FROM powerups").all();
    this.items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      statModifier: JSON.parse(row.stat_modifier),
      rarity: row.rarity
    }));
    console.log(`[loot] Loaded ${this.items.length} powerups from DB`);
  }
  registerItem(item) {
    const existing = this.items.findIndex((i) => i.id === item.id);
    if (existing >= 0) {
      this.items[existing] = item;
    } else {
      this.items.push(item);
    }
  }
  clearAndReplace(items) {
    this.items = [...items];
    console.log(`[loot] Registry replaced with ${this.items.length} items`);
  }
  get size() {
    return this.items.length;
  }
  getById(id) {
    return this.items.find((i) => i.id === id);
  }
  generateChoices(count, floorNumber, rng = Math.random) {
    if (this.items.length === 0)
      return [];
    if (this.items.length <= count)
      return [...this.items];
    const pools = { common: [], uncommon: [], rare: [] };
    for (const item of this.items) {
      const pool = pools[item.rarity];
      if (pool)
        pool.push(item);
    }
    const floorBonus = Math.max(0, floorNumber - 1);
    const weights = {
      common: Math.max(10, RARITY_WEIGHTS.common - floorBonus * (FLOOR_UNCOMMON_BONUS + FLOOR_RARE_BONUS)),
      uncommon: RARITY_WEIGHTS.uncommon + floorBonus * FLOOR_UNCOMMON_BONUS,
      rare: RARITY_WEIGHTS.rare + floorBonus * FLOOR_RARE_BONUS
    };
    const totalWeight = weights.common + weights.uncommon + weights.rare;
    const chosen = [];
    const usedIds = new Set;
    let attempts = 0;
    while (chosen.length < count && attempts < count * 20) {
      attempts++;
      const roll = rng() * totalWeight;
      let rarity;
      if (roll < weights.common) {
        rarity = "common";
      } else if (roll < weights.common + weights.uncommon) {
        rarity = "uncommon";
      } else {
        rarity = "rare";
      }
      const pool = pools[rarity];
      if (!pool || pool.length === 0)
        continue;
      const item = pool[Math.floor(rng() * pool.length)];
      if (usedIds.has(item.id))
        continue;
      usedIds.add(item.id);
      chosen.push(item);
    }
    if (chosen.length < count) {
      for (const item of this.items) {
        if (chosen.length >= count)
          break;
        if (!usedIds.has(item.id)) {
          usedIds.add(item.id);
          chosen.push(item);
        }
      }
    }
    return chosen;
  }
}
var lootRegistry = new LootRegistry;
var SEED_POWERUPS = [
  { slug: "minor-heal", name: "Minor Heal", description: "A small restorative blessing.", stat_modifier: '{"hp": 20}', rarity: "common" },
  { slug: "quick-feet", name: "Quick Feet", description: "Light boots that make you nimble.", stat_modifier: '{"spd": 3}', rarity: "common" },
  { slug: "iron-skin", name: "Iron Skin", description: "Your skin hardens against blows.", stat_modifier: '{"def": 3}', rarity: "common" },
  { slug: "berserkers-rage", name: "Berserker's Rage", description: "Trade protection for raw power.", stat_modifier: '{"atk": 5, "def": -2}', rarity: "uncommon" },
  { slug: "lucky-charm", name: "Lucky Charm", description: "Fortune smiles upon you.", stat_modifier: '{"lck": 5}', rarity: "uncommon" },
  { slug: "vitality", name: "Vitality", description: "A surge of life force.", stat_modifier: '{"hp": 30}', rarity: "uncommon" },
  { slug: "glass-cannon", name: "Glass Cannon", description: "Devastating power at a terrible cost.", stat_modifier: '{"atk": 10, "hp": -20}', rarity: "rare" },
  { slug: "fortunes-favor", name: "Fortune's Favor", description: "Luck and speed in equal measure.", stat_modifier: '{"lck": 8, "spd": 3}', rarity: "rare" },
  { slug: "juggernaut", name: "Juggernaut", description: "An immovable object. Slow but nearly indestructible.", stat_modifier: '{"def": 8, "hp": 20, "spd": -3}', rarity: "rare" }
];
function initLootSystem(db2) {
  db2.run(`
    CREATE TABLE IF NOT EXISTS powerups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      stat_modifier TEXT NOT NULL DEFAULT '{}',
      rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare'))
    )
  `);
  const count = db2.query("SELECT COUNT(*) as cnt FROM powerups").get();
  if (count.cnt === 0) {
    const insert = db2.prepare("INSERT INTO powerups (slug, name, description, stat_modifier, rarity) VALUES (?, ?, ?, ?, ?)");
    for (const p of SEED_POWERUPS) {
      insert.run(p.slug, p.name, p.description, p.stat_modifier, p.rarity);
    }
    console.log(`[loot] Seeded ${SEED_POWERUPS.length} powerups into DB`);
  }
  lootRegistry.loadFromDB(db2);
}

// src/dungeon/dungeon-loop.ts
var TICK_MS = 62.5;
var TILE_SIZE3 = 16;
var PLAYER_RADIUS = 10;
var DISCONNECT_TIMEOUT_MS = 60000;
var TOTAL_FLOORS = 3;
var POWERUP_PICK_TIMEOUT_MS = 15000;
var ephemeralMap = new Map;
function getEphemeral(instance) {
  let e = ephemeralMap.get(instance.id);
  if (!e) {
    e = {
      aiStates: new Map,
      bossAIState: null,
      bossId: null,
      autoAttackTimers: new Map,
      pendingAttacks: new Set,
      pendingPowers: new Set,
      genLayout: null,
      transitionChoices: null,
      transitionPicks: new Map,
      transitionTimer: null
    };
    ephemeralMap.set(instance.id, e);
  }
  return e;
}
function cleanupEphemeral(instanceId) {
  const eph = ephemeralMap.get(instanceId);
  if (eph?.transitionTimer) {
    clearTimeout(eph.transitionTimer);
  }
  ephemeralMap.delete(instanceId);
}
var globalSendFn2 = null;
function setSendFunction(fn) {
  globalSendFn2 = fn;
}
function sendToPlayer(playerId, msg) {
  if (globalSendFn2)
    globalSendFn2(playerId, msg);
}
function broadcastToInstance(instance, msg) {
  for (const [id, player] of instance.players) {
    if (player.connected) {
      sendToPlayer(id, msg);
    }
  }
}
var PERSONA_STATS = {
  holden: { maxHP: 150, ATK: 12, DEF: 10, SPD: 2.5, LCK: 4 },
  broseidon: { maxHP: 100, ATK: 16, DEF: 5, SPD: 3.5, LCK: 6 },
  deckard_cain: { maxHP: 90, ATK: 8, DEF: 6, SPD: 3, LCK: 10 },
  galactus: { maxHP: 120, ATK: 14, DEF: 7, SPD: 2.8, LCK: 8 }
};
var PERSONA_POWER = {
  holden: "holden",
  broseidon: "broseidon",
  deckard_cain: "deckard_cain",
  galactus: "galactus"
};
var DEFAULT_ENEMY_VARIANTS = [
  { id: 1, name: "Crawler", behavior: "crawler", hp: 20, atk: 5, def: 2, spd: 1.5, floor_min: 1, budget_cost: 3 },
  { id: 2, name: "Spitter", behavior: "spitter", hp: 15, atk: 8, def: 1, spd: 1.2, floor_min: 1, budget_cost: 5 },
  { id: 3, name: "Brute", behavior: "brute", hp: 40, atk: 12, def: 5, spd: 0.8, floor_min: 2, budget_cost: 8 }
];
var DEFAULT_FLOOR_TEMPLATES = [
  { floor_number: 1, room_count_min: 5, room_count_max: 7, enemy_budget: 30, boss_type_id: 1, powerup_choices: 3, enemy_scaling: 1 },
  { floor_number: 2, room_count_min: 6, room_count_max: 9, enemy_budget: 50, boss_type_id: 2, powerup_choices: 3, enemy_scaling: 1.4 },
  { floor_number: 3, room_count_min: 7, room_count_max: 10, enemy_budget: 70, boss_type_id: 3, powerup_choices: 2, enemy_scaling: 1.8 }
];
var BOSS_TYPE_MAP = {
  1: "hive_mother",
  2: "spore_lord",
  3: "the_architect"
};
function initFloor(instance) {
  const floorNum = instance.floor;
  const template = DEFAULT_FLOOR_TEMPLATES[floorNum - 1] ?? DEFAULT_FLOOR_TEMPLATES[0];
  const seedStr = `${instance.seed}-f${floorNum}`;
  const genLayout = generateFloor(seedStr, floorNum, template, DEFAULT_ENEMY_VARIANTS);
  const eph = getEphemeral(instance);
  eph.genLayout = genLayout;
  const layout = {
    width: genLayout.width,
    height: genLayout.height,
    tiles: genLayout.tileGrid,
    rooms: genLayout.rooms.map((r) => ({
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      enemyIds: [],
      cleared: r.type === "start" || r.type === "rest" || r.type === "treasure"
    })),
    corridors: genLayout.corridors.map((c) => ({
      x1: c.points[0]?.x ?? 0,
      y1: c.points[0]?.y ?? 0,
      x2: c.points[c.points.length - 1]?.x ?? 0,
      y2: c.points[c.points.length - 1]?.y ?? 0,
      width: 3
    }))
  };
  instance.layout = layout;
  instance.enemies.clear();
  instance.projectiles.clear();
  instance.aoeZones.clear();
  eph.aiStates.clear();
  eph.bossAIState = null;
  eph.bossId = null;
  let enemyCounter = 0;
  for (const spawn2 of genLayout.enemySpawns) {
    const variant = DEFAULT_ENEMY_VARIANTS.find((v) => v.id === spawn2.variantId);
    if (!variant)
      continue;
    const enemyId = `e-${instance.id}-${enemyCounter++}`;
    const behaviorMap = {
      crawler: "melee_chase",
      spitter: "ranged_pattern",
      brute: "slow_charge"
    };
    const enemy = {
      id: enemyId,
      variantId: variant.id,
      variantName: variant.name,
      behavior: behaviorMap[variant.behavior] ?? "melee_chase",
      x: spawn2.x * TILE_SIZE3 + TILE_SIZE3 / 2,
      y: spawn2.y * TILE_SIZE3 + TILE_SIZE3 / 2,
      hp: Math.floor(variant.hp * template.enemy_scaling),
      maxHp: Math.floor(variant.hp * template.enemy_scaling),
      atk: Math.floor(variant.atk * template.enemy_scaling),
      def: variant.def,
      spd: variant.spd,
      isBoss: false,
      roomIndex: spawn2.roomId,
      targetPlayerId: null,
      cooldownTicks: 0,
      telegraphing: false,
      telegraphTicks: 0,
      phase: 0,
      phaseData: {}
    };
    instance.enemies.set(enemyId, enemy);
    eph.aiStates.set(enemyId, createEnemyAIState(enemy.behavior));
    const room = layout.rooms[spawn2.roomId];
    if (room)
      room.enemyIds.push(enemyId);
  }
  if (template.boss_type_id !== null) {
    const bossRoom = genLayout.rooms.find((r) => r.type === "boss");
    if (bossRoom) {
      const bossId = `boss-${instance.id}-f${floorNum}`;
      const bossType = BOSS_TYPE_MAP[template.boss_type_id] ?? "hive_mother";
      const bossHp = Math.floor(200 * template.enemy_scaling);
      const boss = {
        id: bossId,
        variantId: 0,
        variantName: bossType,
        behavior: "melee_chase",
        x: (bossRoom.x + Math.floor(bossRoom.w / 2)) * TILE_SIZE3 + TILE_SIZE3 / 2,
        y: (bossRoom.y + Math.floor(bossRoom.h / 2)) * TILE_SIZE3 + TILE_SIZE3 / 2,
        hp: bossHp,
        maxHp: bossHp,
        atk: Math.floor(15 * template.enemy_scaling),
        def: Math.floor(8 * template.enemy_scaling),
        spd: 1.5,
        isBoss: true,
        roomIndex: genLayout.rooms.indexOf(bossRoom),
        targetPlayerId: null,
        cooldownTicks: 0,
        telegraphing: false,
        telegraphTicks: 0,
        phase: 1,
        phaseData: {}
      };
      instance.enemies.set(bossId, boss);
      eph.bossId = bossId;
      eph.bossAIState = createBossAIState(bossType);
      const protoRoom = layout.rooms[genLayout.rooms.indexOf(bossRoom)];
      if (protoRoom)
        protoRoom.enemyIds.push(bossId);
    }
  }
  const startRoom = genLayout.rooms.find((r) => r.type === "start");
  if (startRoom) {
    const cx = (startRoom.x + Math.floor(startRoom.w / 2)) * TILE_SIZE3 + TILE_SIZE3 / 2;
    const cy = (startRoom.y + Math.floor(startRoom.h / 2)) * TILE_SIZE3 + TILE_SIZE3 / 2;
    let offset = 0;
    for (const [_id, player] of instance.players) {
      player.x = cx + (offset % 2 === 0 ? offset * 8 : -offset * 8);
      player.y = cy + (offset < 2 ? -8 : 8);
      offset++;
    }
  }
  for (const [_id, player] of instance.players) {
    const base = PERSONA_STATS[player.personaSlug] ?? PERSONA_STATS.holden;
    const effective = calculateEffectiveStats(base, []);
    player.maxHp = effective.maxHP;
    player.hp = effective.maxHP;
    player.atk = effective.ATK;
    player.def = effective.DEF;
    player.spd = effective.SPD;
    player.lck = effective.LCK;
    player.iframeTicks = 0;
    player.cooldownTicks = 0;
    player.cooldownMax = Math.ceil(effective.autoAttackIntervalMs / TICK_MS);
    player.diedOnFloor = null;
  }
  const floorMsg = {
    type: "d_floor",
    floor: floorNum,
    gridWidth: genLayout.width,
    gridHeight: genLayout.height,
    tiles: Array.from(genLayout.tileGrid),
    rooms: layout.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    corridors: layout.corridors.map((c) => ({
      x1: c.x1,
      y1: c.y1,
      x2: c.x2,
      y2: c.y2,
      width: c.width
    }))
  };
  const bossRoomIndex = genLayout.rooms.findIndex((r) => r.type === "boss");
  for (let i = 0;i < layout.rooms.length; i++) {
    if (i === bossRoomIndex)
      continue;
    layout.rooms[i].cleared = true;
    openDoorsForRoom(layout, i);
  }
  if (bossRoomIndex >= 0) {
    const allNonBossCleared = layout.rooms.every((r, idx) => idx === bossRoomIndex || r.cleared);
    if (allNonBossCleared) {
      layout.rooms[bossRoomIndex].cleared = true;
      openDoorsForRoom(layout, bossRoomIndex);
    }
  }
  floorMsg.tiles = Array.from(layout.tiles);
  broadcastToInstance(instance, floorMsg);
  console.log(`[dungeon-loop] Floor ${floorNum} initialized for ${instance.id}: ${genLayout.rooms.length} rooms, ${instance.enemies.size} enemies`);
}
function toPlayerEntity(p, tick) {
  return {
    id: p.id,
    x: p.x,
    y: p.y,
    radius: PLAYER_RADIUS,
    hp: p.hp,
    maxHP: p.maxHp,
    stats: {
      maxHP: p.maxHp,
      ATK: p.atk,
      DEF: p.def,
      SPD: p.spd,
      LCK: p.lck,
      autoAttackIntervalMs: 600 / (1 + p.spd * 0.05),
      critChance: Math.min(0.8, p.lck * 0.02)
    },
    facing: p.facing,
    iFrameUntilTick: tick + p.iframeTicks,
    alive: p.hp > 0 && p.diedOnFloor === null,
    persona: PERSONA_POWER[p.personaSlug] ?? "holden",
    powerCooldownUntilTick: tick + p.cooldownTicks,
    broseidonWindowEnd: 0,
    broseidonStacks: 0
  };
}
function toEnemyEntity(e, tick) {
  const radiusMap = {
    melee_chase: 8,
    ranged_pattern: 8,
    slow_charge: 16
  };
  return {
    id: e.id,
    x: e.x,
    y: e.y,
    radius: e.isBoss ? 20 : radiusMap[e.behavior] ?? 8,
    hp: e.hp,
    maxHP: e.maxHp,
    stats: {
      maxHP: e.maxHp,
      ATK: e.atk,
      DEF: e.def,
      SPD: e.spd,
      LCK: 0,
      autoAttackIntervalMs: 1000,
      critChance: 0
    },
    facing: "right",
    iFrameUntilTick: 0,
    alive: e.hp > 0,
    stunUntilTick: 0,
    slowMultiplier: 1
  };
}
function tickInstance(instance) {
  if (instance.status !== "running" && instance.status !== "boss")
    return;
  instance.tick++;
  const tick = instance.tick;
  const layout = instance.layout;
  if (!layout)
    return;
  const eph = getEphemeral(instance);
  const events = [];
  for (const [_pid, player] of instance.players) {
    if (player.hp <= 0 || !player.connected)
      continue;
    while (player.inputQueue.length > 0) {
      const input = player.inputQueue.shift();
      player.x = input.x;
      player.y = input.y;
      player.facing = input.facing;
      player.lastProcessedSeq = input.seq;
    }
  }
  const alivePlayers = Array.from(instance.players.values()).filter((p) => p.hp > 0 && p.diedOnFloor === null);
  const playerTargets = alivePlayers.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    radius: PLAYER_RADIUS,
    alive: true
  }));
  const enemyEntities = [];
  for (const [_eid, enemy] of instance.enemies) {
    if (enemy.hp <= 0)
      continue;
    enemyEntities.push(toEnemyEntity(enemy, tick));
  }
  resetSlowMultipliers(enemyEntities);
  const combatAoeZones = [];
  for (const [_zid, zone] of instance.aoeZones) {
    combatAoeZones.push({
      id: zone.id,
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      expiresAtTick: tick + zone.ticksRemaining,
      owner: zone.ownerId,
      type: "deckard_slow",
      slowFactor: zone.slowFactor
    });
  }
  const expiredZones = tickAoEZones(combatAoeZones, enemyEntities, tick);
  for (const zoneId of expiredZones) {
    instance.aoeZones.delete(zoneId);
  }
  for (const ee of enemyEntities) {
    const enemy = instance.enemies.get(ee.id);
    if (enemy) {}
  }
  for (const [zid, zone] of instance.aoeZones) {
    zone.ticksRemaining--;
    if (zone.ticksRemaining <= 0) {
      instance.aoeZones.delete(zid);
    }
  }
  for (const [eid, enemy] of instance.enemies) {
    if (enemy.hp <= 0)
      continue;
    if (enemy.isBoss)
      continue;
    const aiState = eph.aiStates.get(eid);
    if (!aiState)
      continue;
    const ee = enemyEntities.find((e) => e.id === eid);
    const combatEnemy = ee ?? toEnemyEntity(enemy, tick);
    const action = updateEnemyAI(combatEnemy, aiState, playerTargets, layout.tiles, layout.width, layout.height, tick, TILE_SIZE3);
    switch (action.type) {
      case "move":
      case "charge":
        enemy.x += action.dx;
        enemy.y += action.dy;
        break;
      case "attack": {
        if (!action.projectile) {
          for (const p of alivePlayers) {
            const dx = enemy.x - p.x;
            const dy = enemy.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= combatEnemy.radius + PLAYER_RADIUS + 2 && p.iframeTicks <= 0) {
              const damage = Math.max(1, enemy.atk - Math.floor(p.def * 0.5));
              p.hp -= damage;
              p.iframeTicks = 8;
              p.damageTaken += damage;
              events.push({
                type: "damage",
                payload: { targetId: p.id, damage, attackerId: eid, isCrit: false }
              });
              if (p.hp <= 0) {
                p.hp = 0;
                p.diedOnFloor = instance.floor;
                events.push({
                  type: "player_death",
                  payload: { playerId: p.id, floor: instance.floor }
                });
              }
              break;
            }
          }
        }
        if (action.projectile) {
          enemy.x += action.dx;
          enemy.y += action.dy;
          spawnProjectile(instance, action.projectile, eid, true);
        }
        break;
      }
      case "telegraph":
        enemy.telegraphing = true;
        enemy.telegraphTicks = action.telegraphTicks ?? 0;
        break;
      case "idle":
        enemy.telegraphing = false;
        break;
    }
  }
  if (eph.bossId && eph.bossAIState) {
    const boss = instance.enemies.get(eph.bossId);
    if (boss && boss.hp > 0) {
      instance.status = "boss";
      const bossEntity = toEnemyEntity(boss, tick);
      const bossAction = updateBossAI(bossEntity, eph.bossAIState, playerTargets, enemyEntities, layout.tiles, layout.width, tick);
      switch (bossAction.type) {
        case "move":
          boss.x += bossAction.dx;
          boss.y += bossAction.dy;
          break;
        case "spawn_wave":
          if (bossAction.spawns) {
            for (const spawnReq of bossAction.spawns) {
              const newId = `e-${instance.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
              const behaviorMap = {
                melee_chase: "melee_chase",
                ranged_pattern: "ranged_pattern",
                slow_charge: "slow_charge"
              };
              const newEnemy = {
                id: newId,
                variantId: 0,
                variantName: spawnReq.behavior,
                behavior: behaviorMap[spawnReq.behavior] ?? "melee_chase",
                x: spawnReq.x,
                y: spawnReq.y,
                hp: Math.floor(20 * spawnReq.hpScale),
                maxHp: Math.floor(20 * spawnReq.hpScale),
                atk: 5,
                def: 2,
                spd: 1.5,
                isBoss: false,
                roomIndex: boss.roomIndex,
                targetPlayerId: null,
                cooldownTicks: 0,
                telegraphing: false,
                telegraphTicks: 0,
                phase: 0,
                phaseData: {}
              };
              instance.enemies.set(newId, newEnemy);
              eph.aiStates.set(newId, createEnemyAIState(newEnemy.behavior));
            }
          }
          break;
        case "projectile_burst":
          if (bossAction.projectiles) {
            for (const proj of bossAction.projectiles) {
              spawnProjectile(instance, {
                x: proj.x,
                y: proj.y,
                vx: proj.vx,
                vy: proj.vy,
                damage: proj.damage,
                radius: proj.radius,
                lifetimeTicks: proj.lifetimeTicks
              }, eph.bossId, true);
            }
          }
          break;
        case "spawn_zone":
          if (bossAction.zone) {
            const zoneId = `bz-${tick}-${Math.random().toString(36).slice(2, 5)}`;
            const zone = {
              id: zoneId,
              x: bossAction.zone.x,
              y: bossAction.zone.y,
              radius: bossAction.zone.radius,
              ticksRemaining: bossAction.zone.durationTicks,
              zoneType: bossAction.zone.type,
              ownerId: eph.bossId,
              damagePerTick: bossAction.zone.damagePerTick,
              slowFactor: 0.5
            };
            instance.aoeZones.set(zoneId, zone);
          }
          break;
        case "combo":
          if (bossAction.projectiles) {
            for (const proj of bossAction.projectiles) {
              spawnProjectile(instance, {
                x: proj.x,
                y: proj.y,
                vx: proj.vx,
                vy: proj.vy,
                damage: proj.damage,
                radius: proj.radius,
                lifetimeTicks: proj.lifetimeTicks
              }, eph.bossId, true);
            }
          }
          break;
        case "telegraph":
          boss.telegraphing = true;
          boss.telegraphTicks = bossAction.telegraphTicks ?? 0;
          break;
        case "idle":
          boss.telegraphing = false;
          break;
      }
      boss.phase = eph.bossAIState.phase;
    }
  }
  const projectilesToRemove = [];
  for (const [pid, proj] of instance.projectiles) {
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.lifetimeTicks--;
    if (proj.lifetimeTicks <= 0) {
      projectilesToRemove.push(pid);
      continue;
    }
    const tileX = Math.floor(proj.x / TILE_SIZE3);
    const tileY = Math.floor(proj.y / TILE_SIZE3);
    if (tileX < 0 || tileX >= layout.width || tileY < 0 || tileY >= layout.height) {
      projectilesToRemove.push(pid);
      continue;
    }
    const tileVal = layout.tiles[tileY * layout.width + tileX];
    if (tileVal === TILE2.WALL || tileVal === TILE2.DOOR_CLOSED) {
      projectilesToRemove.push(pid);
      continue;
    }
    if (proj.fromEnemy) {
      for (const p of alivePlayers) {
        if (p.iframeTicks > 0)
          continue;
        if (circleVsCircle(proj.x, proj.y, proj.radius, p.x, p.y, PLAYER_RADIUS)) {
          const damage = Math.max(1, proj.damage - Math.floor(p.def * 0.5));
          p.hp -= damage;
          p.iframeTicks = 8;
          p.damageTaken += damage;
          events.push({
            type: "damage",
            payload: { targetId: p.id, damage, attackerId: proj.ownerId, isCrit: false }
          });
          if (p.hp <= 0) {
            p.hp = 0;
            p.diedOnFloor = instance.floor;
            events.push({
              type: "player_death",
              payload: { playerId: p.id, floor: instance.floor }
            });
          }
          projectilesToRemove.push(pid);
          break;
        }
      }
    } else {
      for (const [eid, enemy] of instance.enemies) {
        if (enemy.hp <= 0)
          continue;
        const eRadius = enemy.isBoss ? 20 : 8;
        if (circleVsCircle(proj.x, proj.y, proj.radius, enemy.x, enemy.y, eRadius)) {
          enemy.hp -= proj.damage;
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            events.push({ type: "kill", payload: { enemyId: eid, killerId: proj.ownerId } });
            const killer = instance.players.get(proj.ownerId);
            if (killer)
              killer.kills++;
          }
          projectilesToRemove.push(pid);
          break;
        }
      }
    }
  }
  for (const pid of projectilesToRemove) {
    instance.projectiles.delete(pid);
  }
  for (const [_zid, zone] of instance.aoeZones) {
    if (zone.damagePerTick <= 0)
      continue;
    for (const p of alivePlayers) {
      if (p.iframeTicks > 0)
        continue;
      if (circleVsCircle(p.x, p.y, PLAYER_RADIUS, zone.x, zone.y, zone.radius)) {
        p.hp -= zone.damagePerTick;
        p.damageTaken += zone.damagePerTick;
        if (p.hp <= 0) {
          p.hp = 0;
          p.diedOnFloor = instance.floor;
          events.push({
            type: "player_death",
            payload: { playerId: p.id, floor: instance.floor }
          });
        }
      }
    }
  }
  for (const [pid, player] of instance.players) {
    if (player.hp <= 0 || player.diedOnFloor !== null)
      continue;
    const nextAttackTick = eph.autoAttackTimers.get(pid) ?? 0;
    if (tick < nextAttackTick)
      continue;
    const pe = toPlayerEntity(player, tick);
    const targets = enemyEntities.filter((e) => e.alive);
    const result = resolveAutoAttack(pe, targets, tick);
    if (result && result.hit) {
      const enemy = instance.enemies.get(result.targetId);
      if (enemy) {
        enemy.hp -= result.damage;
        player.damageDealt += result.damage;
        events.push({
          type: "damage",
          payload: {
            targetId: result.targetId,
            damage: result.damage,
            attackerId: pid,
            isCrit: result.isCrit
          }
        });
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          player.kills++;
          events.push({ type: "kill", payload: { enemyId: enemy.id, killerId: pid } });
        }
        const intervalTicks = Math.ceil(pe.stats.autoAttackIntervalMs / TICK_MS);
        eph.autoAttackTimers.set(pid, tick + intervalTicks);
      }
    }
  }
  for (const pid of eph.pendingPowers) {
    const player = instance.players.get(pid);
    if (!player || player.hp <= 0)
      continue;
    if (player.cooldownTicks > 0)
      continue;
    const pe = toPlayerEntity(player, tick);
    const targets = enemyEntities.filter((e) => e.alive);
    const combatZones = [];
    const powerResult = resolvePower(pe, targets, combatZones, tick);
    if (powerResult && powerResult.activated) {
      player.cooldownTicks = Math.max(0, pe.powerCooldownUntilTick - tick);
      events.push({
        type: "power_activate",
        payload: { playerId: pid, power: powerResult.powerName, affected: powerResult.affected }
      });
      for (const eid of powerResult.affected) {
        const enemy = instance.enemies.get(eid);
        if (enemy) {
          const ce = targets.find((t) => t.id === eid);
          if (ce) {
            enemy.hp = ce.hp;
            if (enemy.hp <= 0) {
              enemy.hp = 0;
              player.kills++;
              events.push({ type: "kill", payload: { enemyId: eid, killerId: pid } });
            }
          }
        }
      }
      if (powerResult.spawnedZone) {
        const sz = powerResult.spawnedZone;
        const zoneInstance = {
          id: sz.id,
          x: sz.x,
          y: sz.y,
          radius: sz.radius,
          ticksRemaining: sz.expiresAtTick - tick,
          zoneType: sz.type,
          ownerId: sz.owner,
          damagePerTick: 0,
          slowFactor: sz.slowFactor
        };
        instance.aoeZones.set(sz.id, zoneInstance);
      }
      if (powerResult.healed) {
        player.hp = Math.min(player.maxHp, player.hp + powerResult.healed);
      }
    }
  }
  eph.pendingPowers.clear();
  for (const [_pid, player] of instance.players) {
    if (player.iframeTicks > 0)
      player.iframeTicks--;
    if (player.cooldownTicks > 0)
      player.cooldownTicks--;
  }
  if (layout.rooms) {
    for (let i = 0;i < layout.rooms.length; i++) {
      const room = layout.rooms[i];
      if (room.cleared)
        continue;
      const allDead = room.enemyIds.length === 0 || room.enemyIds.every((eid) => {
        const enemy = instance.enemies.get(eid);
        return !enemy || enemy.hp <= 0;
      });
      if (allDead) {
        room.cleared = true;
        events.push({ type: "door_open", payload: { roomIndex: i } });
        openDoorsForRoom(layout, i);
      }
    }
  }
  if (eph.bossId) {
    const boss = instance.enemies.get(eph.bossId);
    if (boss && boss.hp <= 0) {
      if (instance.floor >= TOTAL_FLOORS) {
        instance.status = "completed";
        const resultsMsg = buildResults(instance, "victory");
        broadcastToInstance(instance, resultsMsg);
        console.log(`[dungeon-loop] Victory for ${instance.id}!`);
        setTimeout(() => {
          cleanupEphemeral(instance.id);
          destroyRun(instance.lobbyId);
        }, 5000);
        return;
      }
      instance.status = "between_floors";
      startPowerupTransition(instance, eph);
      return;
    }
  }
  const anyAlive = Array.from(instance.players.values()).some((p) => p.hp > 0 && p.diedOnFloor === null);
  if (!anyAlive) {
    instance.status = "completed";
    const resultsMsg = buildResults(instance, "death");
    broadcastToInstance(instance, resultsMsg);
    console.log(`[dungeon-loop] Defeat for ${instance.id} on floor ${instance.floor}`);
    setTimeout(() => {
      cleanupEphemeral(instance.id);
      destroyRun(instance.lobbyId);
    }, 5000);
    return;
  }
  const now = Date.now();
  for (const [pid, player] of instance.players) {
    if (!player.connected && player.disconnectedAt) {
      if (now - player.disconnectedAt > DISCONNECT_TIMEOUT_MS) {
        player.hp = 0;
        player.diedOnFloor = instance.floor;
      }
    }
  }
  const tickMsg = {
    type: "d_tick",
    tick,
    t: Date.now(),
    players: buildPlayerSnapshots(instance),
    enemies: buildEnemySnapshots(instance),
    projectiles: buildProjectileSnapshots(instance),
    aoeZones: buildAoEZoneSnapshots(instance),
    events
  };
  broadcastToInstance(instance, tickMsg);
}
function startPowerupTransition(instance, eph) {
  const choices = lootRegistry.generateChoices(3, instance.floor);
  eph.transitionChoices = choices;
  eph.transitionPicks = new Map;
  const choicesMsg = {
    type: "d_powerup_choices",
    choices: choices.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      rarity: c.rarity,
      statModifier: c.statModifier
    }))
  };
  broadcastToInstance(instance, choicesMsg);
  console.log(`[dungeon-loop] Powerup transition for ${instance.id} floor ${instance.floor}: ${choices.map((c) => c.name).join(", ")}`);
  eph.transitionTimer = setTimeout(() => {
    finalizePowerupTransition(instance);
  }, POWERUP_PICK_TIMEOUT_MS);
}
function handlePowerupPick(instanceId, playerId, powerupId) {
  const instancesMap = getAllInstances();
  let instance = null;
  for (const [_lobbyId, inst] of instancesMap) {
    if (inst.id === instanceId) {
      instance = inst;
      break;
    }
  }
  if (!instance || instance.status !== "between_floors")
    return;
  const eph = getEphemeral(instance);
  if (!eph.transitionChoices)
    return;
  const validChoice = eph.transitionChoices.find((c) => c.id === powerupId);
  if (!validChoice)
    return;
  eph.transitionPicks.set(playerId, powerupId);
  const alivePlayers = Array.from(instance.players.values()).filter((p) => p.hp > 0 && p.diedOnFloor === null);
  const allPicked = alivePlayers.every((p) => eph.transitionPicks.has(p.id));
  if (allPicked) {
    if (eph.transitionTimer) {
      clearTimeout(eph.transitionTimer);
      eph.transitionTimer = null;
    }
    finalizePowerupTransition(instance);
  }
}
function finalizePowerupTransition(instance) {
  const eph = getEphemeral(instance);
  if (!eph.transitionChoices || eph.transitionChoices.length === 0) {
    advanceFloor(instance, eph);
    return;
  }
  const alivePlayers = Array.from(instance.players.values()).filter((p) => p.hp > 0 && p.diedOnFloor === null);
  for (const player of alivePlayers) {
    if (!eph.transitionPicks.has(player.id)) {
      const randomChoice = eph.transitionChoices[Math.floor(Math.random() * eph.transitionChoices.length)];
      eph.transitionPicks.set(player.id, randomChoice.id);
    }
  }
  for (const player of alivePlayers) {
    const chosenId = eph.transitionPicks.get(player.id);
    if (chosenId === undefined)
      continue;
    const lootItem = eph.transitionChoices.find((c) => c.id === chosenId);
    if (!lootItem)
      continue;
    player.powerups.push(lootItem.id);
    const mods = lootItem.statModifier;
    if (mods.hp) {
      player.maxHp += mods.hp;
      player.hp = Math.min(player.hp + Math.max(0, mods.hp), player.maxHp);
      player.maxHp = Math.max(1, player.maxHp);
      player.hp = Math.max(1, Math.min(player.hp, player.maxHp));
    }
    if (mods.atk)
      player.atk = Math.max(0, player.atk + mods.atk);
    if (mods.def)
      player.def = Math.max(0, player.def + mods.def);
    if (mods.spd)
      player.spd = Math.max(0.5, player.spd + mods.spd);
    if (mods.lck)
      player.lck = Math.max(0, player.lck + mods.lck);
    console.log(`[dungeon-loop] Player ${player.name} picked ${lootItem.name} (${lootItem.rarity})`);
  }
  eph.transitionChoices = null;
  eph.transitionPicks.clear();
  eph.transitionTimer = null;
  advanceFloor(instance, eph);
}
function advanceFloor(instance, _eph) {
  instance.floor++;
  instance.status = "running";
  initFloor(instance);
}
var projCounter = 0;
function spawnProjectile(instance, spawn2, ownerId, fromEnemy) {
  const id = `proj-${projCounter++}`;
  const proj = {
    id,
    x: spawn2.x,
    y: spawn2.y,
    vx: spawn2.vx,
    vy: spawn2.vy,
    radius: spawn2.radius,
    damage: spawn2.damage,
    fromEnemy,
    ownerId,
    lifetimeTicks: spawn2.lifetimeTicks
  };
  instance.projectiles.set(id, proj);
}
function openDoorsForRoom(layout, roomIndex) {
  const room = layout.rooms[roomIndex];
  if (!room)
    return;
  for (let y = room.y - 1;y <= room.y + room.h; y++) {
    for (let x = room.x - 1;x <= room.x + room.w; x++) {
      if (x < 0 || x >= layout.width || y < 0 || y >= layout.height)
        continue;
      const idx = y * layout.width + x;
      if (layout.tiles[idx] === TILE2.DOOR_CLOSED) {
        layout.tiles[idx] = TILE2.DOOR_OPEN;
      }
    }
  }
}
function buildPlayerSnapshots(instance) {
  const snaps = [];
  for (const [_id, p] of instance.players) {
    snaps.push({
      id: p.id,
      name: p.name,
      personaSlug: p.personaSlug,
      x: p.x,
      y: p.y,
      facing: p.facing,
      hp: p.hp,
      maxHp: p.maxHp,
      iframeTicks: p.iframeTicks,
      cooldownRemaining: p.cooldownTicks
    });
  }
  return snaps;
}
function buildEnemySnapshots(instance) {
  const snaps = [];
  for (const [_id, e] of instance.enemies) {
    if (e.hp <= 0)
      continue;
    snaps.push({
      id: e.id,
      variantName: e.variantName,
      behavior: e.behavior,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      isBoss: e.isBoss,
      telegraphing: e.telegraphing
    });
  }
  return snaps;
}
function buildProjectileSnapshots(instance) {
  const snaps = [];
  for (const [_id, p] of instance.projectiles) {
    snaps.push({
      id: p.id,
      x: p.x,
      y: p.y,
      radius: p.radius,
      fromEnemy: p.fromEnemy
    });
  }
  return snaps;
}
function buildAoEZoneSnapshots(instance) {
  const snaps = [];
  for (const [_id, z] of instance.aoeZones) {
    snaps.push({
      id: z.id,
      x: z.x,
      y: z.y,
      radius: z.radius,
      ticksRemaining: z.ticksRemaining,
      zoneType: z.zoneType
    });
  }
  return snaps;
}
function buildResults(instance, outcome) {
  const durationMs = Date.now() - instance.startedAt;
  const players = Array.from(instance.players.values()).map((p) => ({
    playerId: p.id,
    name: p.name,
    personaSlug: p.personaSlug,
    kills: p.kills,
    damageDealt: p.damageDealt,
    damageTaken: p.damageTaken,
    diedOnFloor: p.diedOnFloor
  }));
  return {
    type: "d_results",
    outcome,
    floorReached: instance.floor,
    durationMs,
    players
  };
}
function queuePowerActivation(instanceId, playerId) {
  for (const [_lobbyId, instance] of getAllInstances()) {
    if (instance.id === instanceId) {
      const eph = getEphemeral(instance);
      eph.pendingPowers.add(playerId);
      return;
    }
  }
}
var loopInterval = null;
function startDungeonLoop() {
  if (loopInterval)
    return;
  loopInterval = setInterval(() => {
    for (const [_lobbyId, instance] of getAllInstances()) {
      if (instance.status === "running" || instance.status === "boss") {
        try {
          tickInstance(instance);
        } catch (err) {
          console.error(`[dungeon-loop] Tick error for ${instance.id}:`, err);
        }
      }
    }
  }, TICK_MS);
  console.log("[dungeon-loop] Started at 16Hz");
}
function stopDungeonLoop() {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    console.log("[dungeon-loop] Stopped");
  }
}

// src/index.ts
var npcs = initNpcs();
try {
  const savedPositions = loadNpcPositions();
  for (const [name, pos] of savedPositions) {
    const npc = npcs.get(name);
    if (npc) {
      npc.x = pos.x;
      npc.y = pos.y;
      npc.facing = pos.facing === "left" || pos.facing === "right" ? pos.facing : "right";
      console.log(`[init] Restored NPC ${name} position from DB`);
    }
  }
} catch (err) {
  console.warn("[init] Could not load NPC positions from DB:", err);
}
var chunks = new Map;
chunks.set("0:0", buildChunk(0, 0));
var world = {
  players: new Map,
  npcs,
  warthog: {
    x: 350,
    y: 280,
    vx: 0,
    vy: 0,
    facing: "right",
    seats: [null, null, null, null]
  },
  walkers: [],
  congress: { active: false },
  chunks,
  tickCount: 0
};
var dungeonSockets = new Map;
var congressPollFailures = 0;
async function pollCongressState() {
  try {
    const res = await fetch("http://localhost:8081/api/congress/state", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      world.congress.active = !!data.active;
      congressPollFailures = 0;
    }
  } catch (err) {
    congressPollFailures = (congressPollFailures ?? 0) + 1;
    if (congressPollFailures === 1 || congressPollFailures % 10 === 0) {
      console.warn(`[congress-poll] clunger unreachable (${congressPollFailures} failures):`, err);
    }
  }
}
setInterval(() => {
  pollCongressState().catch((err) => console.error("[congress-poll] Error:", err));
}, 1e4);
var bunServer = serve({
  port: 8090,
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const userId = url.searchParams.get("userId") ?? "anonymous";
      const name = url.searchParams.get("name") ?? "unknown";
      const color = url.searchParams.get("color") ?? "#ffffff";
      const socketId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const upgraded = server.upgrade(req, {
        data: {
          userId,
          name,
          color,
          socketId,
          chunkX: 0,
          chunkY: 0,
          lastSeen: Date.now()
        }
      });
      if (upgraded)
        return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", players: world.players.size, tick: world.tickCount }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/admin/congress" && req.method === "POST") {
      return req.json().then((body) => {
        world.congress.active = !!body.active;
        console.log(`[admin] Congress active: ${world.congress.active}`);
        return new Response(JSON.stringify({ active: world.congress.active }), {
          headers: { "Content-Type": "application/json" }
        });
      }, (err) => {
        console.error("[admin] Congress toggle failed to parse body:", err);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      });
    }
    if (url.pathname === "/admin/reset-npcs" && req.method === "POST") {
      try {
        const npcNames = Array.from(world.npcs.keys());
        const center = resetNpcPositionsInDb(npcNames);
        resetNpcPositions(world.npcs, center.x, center.y);
        console.log(`[admin] NPC reset triggered \u2014 ${npcNames.length} NPCs moved to center (${center.x}, ${center.y})`);
        return new Response(JSON.stringify({ ok: true, npcsReset: npcNames.length, center }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        console.error("[admin] NPC reset failed:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/admin/terrain-changed" && req.method === "POST") {
      try {
        const npcNames = Array.from(world.npcs.keys());
        const center = resetNpcPositionsInDb(npcNames);
        resetNpcPositions(world.npcs, center.x, center.y);
        chunks.set("0:0", buildChunk(0, 0));
        console.log(`[admin] Terrain changed \u2014 rebuilt chunk (0,0) and reset ${npcNames.length} NPCs to center`);
        return new Response(JSON.stringify({ ok: true, npcsReset: npcNames.length, center, chunkRebuilt: "0:0" }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        console.error("[admin] terrain-changed handler failed:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/api/audition/walkers" && req.method === "GET") {
      return getWalkersResponse(world);
    }
    if (url.pathname === "/api/audition/pause" && req.method === "POST") {
      const body = await req.json();
      return pauseWalker(world, body.id);
    }
    if (url.pathname === "/api/audition/resume" && req.method === "POST") {
      const body = await req.json();
      return resumeWalker(world, body.id);
    }
    if (url.pathname === "/api/audition/keep" && req.method === "POST") {
      const body = await req.json();
      return keepWalker(world, body.id);
    }
    if (url.pathname === "/api/audition/dismiss" && req.method === "POST") {
      const body = await req.json();
      return dismissWalker(world, body.id);
    }
    if (url.pathname === "/dungeon-ws") {
      const userId = url.searchParams.get("userId") ?? "anonymous";
      const name = url.searchParams.get("name") ?? "unknown";
      const lobbyId = url.searchParams.get("lobbyId") ?? "";
      const socketId = `dng-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const upgraded = server.upgrade(req, {
        data: {
          userId,
          name,
          socketId,
          lobbyId,
          isDungeon: true
        }
      });
      if (upgraded)
        return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    if (url.pathname === "/api/clungiverse/lobby/create" && req.method === "POST") {
      try {
        const body = await req.json();
        if (!body.userId || !body.name) {
          return new Response(JSON.stringify({ error: "userId and name required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const instance = createLobby(body.userId, body.name);
        return new Response(JSON.stringify({ lobbyId: instance.lobbyId, hostId: body.userId }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    const lobbyGetMatch = url.pathname.match(/^\/api\/clungiverse\/lobby\/([^/]+)$/);
    if (lobbyGetMatch && req.method === "GET") {
      const lobbyId = lobbyGetMatch[1];
      const instance = getInstance(lobbyId);
      if (!instance) {
        return new Response(JSON.stringify({ error: "Lobby not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      const players = Array.from(instance.players.values()).map((p) => ({
        playerId: p.id,
        name: p.name,
        personaSlug: p.personaSlug || null,
        ready: !!p.personaSlug
      }));
      return new Response(JSON.stringify({
        lobbyId: instance.lobbyId,
        status: instance.status,
        playerCount: instance.players.size,
        players
      }), { headers: { "Content-Type": "application/json" } });
    }
    const lobbyJoinMatch = url.pathname.match(/^\/api\/clungiverse\/lobby\/([^/]+)\/join$/);
    if (lobbyJoinMatch && req.method === "POST") {
      try {
        const lobbyId = lobbyJoinMatch[1];
        const body = await req.json();
        if (!body.userId || !body.name) {
          return new Response(JSON.stringify({ error: "userId and name required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const instance = joinLobby(lobbyId, body.userId, body.name);
        if (!instance) {
          return new Response(JSON.stringify({ error: "Cannot join lobby (full, not found, or in progress)" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ lobbyId: instance.lobbyId, joined: true }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      if (ws.data.isDungeon) {
        const dws = ws;
        const { socketId: socketId2, userId: userId2, name: name2, lobbyId } = dws.data;
        dungeonSockets.set(socketId2, dws);
        if (lobbyId) {
          const instance = handleReconnect(lobbyId, userId2, socketId2);
          if (instance) {
            dws.send(JSON.stringify({
              type: "d_welcome",
              playerId: userId2,
              lobbyId: instance.lobbyId
            }));
            if (instance.status === "lobby") {
              const players = Array.from(instance.players.values()).map((p) => ({
                playerId: p.id,
                name: p.name,
                personaSlug: p.personaSlug || null,
                ready: !!p.personaSlug
              }));
              const hostId = instance.players.keys().next().value ?? "";
              dws.send(JSON.stringify({
                type: "d_lobby",
                lobbyId: instance.lobbyId,
                hostId,
                players,
                status: "waiting"
              }));
            }
          }
        }
        console.log(`[dungeon-ws] ${name2} (${userId2}) connected \u2014 socketId=${socketId2}`);
        return;
      }
      const { socketId, chunkX, chunkY, name, color, userId } = ws.data;
      ws.subscribe(`chunk:${chunkX}:${chunkY}`);
      const chunkKey = `${chunkX}:${chunkY}`;
      if (!world.chunks.has(chunkKey)) {
        world.chunks.set(chunkKey, buildChunk(chunkX, chunkY));
      }
      const player = {
        socketId,
        name,
        color,
        x: 500,
        y: 350,
        facing: "right",
        hopFrame: 0,
        isAway: false,
        chunkX,
        chunkY,
        lastSeen: Date.now(),
        lastProcessedInput: 0
      };
      world.players.set(socketId, player);
      console.log(`[ws] Player ${name} (${userId}) connected \u2014 socketId=${socketId}`);
      ws.send(JSON.stringify({ type: "welcome", socket_id: socketId }));
      const chunkPlayers = Array.from(world.players.values()).filter((p) => p.chunkX === chunkX && p.chunkY === chunkY);
      const initialTick = buildTickPayload(world, chunkKey, chunkPlayers, world.tickCount, Date.now());
      initialTick.npcs = Array.from(world.npcs.values());
      initialTick.warthog = { ...world.warthog, seats: [...world.warthog.seats] };
      initialTick.congress = { active: world.congress.active };
      const wornPaths = loadWornPathsForChunk(chunkX, chunkY);
      if (wornPaths.length > 0)
        initialTick.wornPaths = wornPaths;
      ws.send(JSON.stringify(initialTick));
    },
    message(ws, rawMessage) {
      if (ws.data.isDungeon) {
        const dws = ws;
        const { userId, lobbyId } = dws.data;
        let msg2;
        try {
          msg2 = JSON.parse(rawMessage.toString());
        } catch {
          return;
        }
        const sendToPlayer2 = (targetId, serverMsg) => {
          for (const [_sid, sock] of dungeonSockets) {
            if (sock.data.userId === targetId) {
              sock.send(JSON.stringify(serverMsg));
              break;
            }
          }
        };
        if (msg2.type === "d_start") {
          const inst = getInstance(lobbyId);
          if (inst && inst.status === "lobby") {
            const started = startRun(lobbyId);
            if (started) {
              initFloor(started);
            }
          }
          return;
        }
        if (msg2.type === "d_power") {
          const inst = getInstance(lobbyId);
          if (inst && (inst.status === "running" || inst.status === "boss")) {
            queuePowerActivation(inst.id, userId);
          }
          return;
        }
        if (msg2.type === "d_pick_powerup") {
          const inst = getInstance(lobbyId);
          if (inst && inst.status === "between_floors") {
            handlePowerupPick(inst.id, userId, msg2.powerupId);
          }
          return;
        }
        handleMessage(lobbyId, userId, msg2, sendToPlayer2);
        return;
      }
      const { socketId } = ws.data;
      const player = world.players.get(socketId);
      if (!player)
        return;
      player.lastSeen = Date.now();
      ws.data.lastSeen = player.lastSeen;
      let msg;
      try {
        msg = JSON.parse(rawMessage.toString());
      } catch (err) {
        console.error(`[ws] Invalid JSON from ${socketId}:`, err);
        return;
      }
      if (msg.type === "worn_path") {
        const wpm = msg;
        recordWornPath(wpm.chunkX, wpm.chunkY, wpm.tileX, wpm.tileY);
        return;
      }
      handleClientMessage(socketId, msg, world);
    },
    close(ws) {
      if (ws.data.isDungeon) {
        const { socketId: socketId2, userId, lobbyId, name: name2 } = ws.data;
        dungeonSockets.delete(socketId2);
        if (lobbyId) {
          handleDisconnect(lobbyId, userId);
        }
        console.log(`[dungeon-ws] ${name2} disconnected (${socketId2})`);
        return;
      }
      const { socketId, chunkX, chunkY, name } = ws.data;
      ws.unsubscribe(`chunk:${chunkX}:${chunkY}`);
      const seatIdx = world.warthog.seats.indexOf(socketId);
      if (seatIdx >= 0) {
        world.warthog.seats[seatIdx] = null;
      }
      world.players.delete(socketId);
      console.log(`[ws] Player ${name} disconnected (${socketId})`);
    },
    idleTimeout: 30
  }
});
initLootSystem(db);
var dungeonSendFn = (playerId, msg) => {
  for (const [_sid, sock] of dungeonSockets) {
    if (sock.data.userId === playerId) {
      try {
        sock.send(JSON.stringify(msg));
      } catch (err) {
        console.error(`[dungeon] Failed to send to ${playerId}:`, err);
      }
      break;
    }
  }
};
setSendFunction(dungeonSendFn);
setManagerSendFunction(dungeonSendFn);
startDungeonLoop();
console.log("[commons-server] Dungeon loop started");
setChunkSubscriptionCallback((socketId, oldChunkX, oldChunkY, newChunkX, newChunkY) => {
  const newKey = `${newChunkX}:${newChunkY}`;
  if (!world.chunks.has(newKey)) {
    world.chunks.set(newKey, buildChunk(newChunkX, newChunkY));
  }
});
setForceSyncCallback((_socketId) => {});
var broadcast = (chunkX, chunkY, payload) => {
  bunServer.publish(`chunk:${chunkX}:${chunkY}`, payload);
};
var tickInterval = setInterval(() => {
  try {
    runTick(world, broadcast);
  } catch (err) {
    console.error("[game-loop] Tick error:", err);
  }
}, 50);
process.on("SIGTERM", () => {
  console.log("[commons-server] SIGTERM received \u2014 flushing state and shutting down");
  clearInterval(tickInterval);
  stopDungeonLoop();
  try {
    persistState(world);
  } catch (err) {
    console.error("[shutdown] Final persist failed:", err);
  }
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[commons-server] SIGINT received \u2014 shutting down");
  clearInterval(tickInterval);
  process.exit(0);
});
startSpawnSchedule(world);
console.log("[commons-server] Audition walker spawning enabled");
console.log(`[commons-server] Listening on :8090 \u2014 20Hz tick, ${world.npcs.size} NPCs loaded`);
