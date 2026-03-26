// NPC AI module — tile-aware movement, persona-specific patterns

import type { NPCState, ChunkData } from "./protocol.ts";
import { CHUNK_TILES_W, CHUNK_TILES_H, TILE_SIZE } from "./map.ts";

// ─── Persona configs ─────────────────────────────────────────────────────────

export const NPC_PATTERNS: Record<string, { speed: number; behavior: string }> = {
  chairman:    { speed: 1.2, behavior: "wander" },
  critic:      { speed: 1.0, behavior: "pacing" },
  architect:   { speed: 0.8, behavior: "stationary" },
  ux:          { speed: 1.1, behavior: "wander" },
  designer:    { speed: 1.0, behavior: "circular" },
  galactus:    { speed: 1.5, behavior: "aggressive" },
  hume:        { speed: 0.9, behavior: "pacing" },
  otto:        { speed: 1.0, behavior: "wander" },
  pm:          { speed: 1.3, behavior: "directed" },
  spengler:    { speed: 0.7, behavior: "stationary" },
  trump:       { speed: 1.4, behavior: "aggressive" },
  "uncle-bob": { speed: 0.8, behavior: "pacing" },
  bloodfeast:  { speed: 1.6, behavior: "aggressive" },
  adelbert:    { speed: 0.9, behavior: "wander" },
  jhaddu:      { speed: 1.0, behavior: "circular" },
  morgan:      { speed: 1.1, behavior: "directed" },
  "the-kid":   { speed: 1.3, behavior: "wander" },
};

// Congress gathering target (pixel coords of council building doorway area)
const COUNCIL_TARGET = { x: 5 * TILE_SIZE + 16, y: 5 * TILE_SIZE + 16 };

// Initial NPC positions spread around chunk (0,0)
const NPC_SPAWN_POSITIONS: Record<string, { x: number; y: number }> = {
  chairman:    { x: 400, y: 280 },
  critic:      { x: 300, y: 350 },
  architect:   { x: 250, y: 180 },
  ux:          { x: 450, y: 200 },
  designer:    { x: 520, y: 350 },
  galactus:    { x: 200, y: 420 },
  hume:        { x: 350, y: 450 },
  otto:        { x: 600, y: 280 },
  pm:          { x: 480, y: 420 },
  spengler:    { x: 140, y: 300 },
  trump:       { x: 650, y: 180 },
  "uncle-bob": { x: 320, y: 250 },
  bloodfeast:  { x: 700, y: 450 },
  adelbert:    { x: 550, y: 480 },
  jhaddu:      { x: 420, y: 500 },
  morgan:      { x: 260, y: 490 },
  "the-kid":   { x: 600, y: 400 },
};

// Per-NPC pacing state (for deterministic patterns)
const pacingState: Map<string, { ticksOnCurrent: number; maxTicks: number }> = new Map();
const circularState: Map<string, { angle: number }> = new Map();
const directedState: Map<string, { targetX: number; targetY: number; stuckTicks: number }> = new Map();

export function initNpcs(): Map<string, NPCState> {
  const npcs = new Map<string, NPCState>();
  for (const [name, pattern] of Object.entries(NPC_PATTERNS)) {
    const spawn = NPC_SPAWN_POSITIONS[name] ?? { x: 400, y: 300 };
    npcs.set(name, {
      name,
      x: spawn.x,
      y: spawn.y,
      facing: "right",
      vx: 0,
      vy: 0,
      pattern: pattern.behavior,
    });
    pacingState.set(name, { ticksOnCurrent: 0, maxTicks: 20 + Math.floor(Math.random() * 40) });
    circularState.set(name, { angle: Math.random() * Math.PI * 2 });
    directedState.set(name, {
      targetX: 200 + Math.random() * 400,
      targetY: 150 + Math.random() * 300,
      stuckTicks: 0,
    });
  }
  return npcs;
}

// ─── Walkability helpers ─────────────────────────────────────────────────────

function isWalkablePixel(px: number, py: number, walkable: boolean[][]): boolean {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= walkable.length || ty >= (walkable[0]?.length ?? 0)) return false;
  return walkable[tx][ty];
}

/**
 * Greedy pathfind — step toward target, try perpendicular if blocked.
 * Returns delta {dx, dy} to apply, or {0,0} if fully stuck.
 */
function greedyStep(
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
  walkable: boolean[][]
): { dx: number; dy: number } {
  const ddx = tx - x;
  const ddy = ty - y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist < speed) return { dx: 0, dy: 0 };

  const nx = (ddx / dist) * speed;
  const ny = (ddy / dist) * speed;

  // Try direct
  if (isWalkablePixel(x + nx, y + ny, walkable)) {
    return { dx: nx, dy: ny };
  }
  // Try horizontal only
  if (isWalkablePixel(x + nx, y, walkable)) {
    return { dx: nx, dy: 0 };
  }
  // Try vertical only
  if (isWalkablePixel(x, y + ny, walkable)) {
    return { dx: 0, dy: ny };
  }
  // Stuck
  return { dx: 0, dy: 0 };
}

/**
 * Pick a random direction that is walkable from current position.
 * Tries up to 8 directions before giving up.
 */
function pickWalkableDirection(
  npc: NPCState,
  speed: number,
  walkable: boolean[][]
): void {
  const angles = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
  // Shuffle angles for variety
  for (let i = angles.length - 1; i > 0; i--) {
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

// ─── Season helpers ──────────────────────────────────────────────────────────

export function getCurrentSeason(): "spring" | "summer" | "autumn" | "winter" {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const seasons: ("spring" | "summer" | "autumn" | "winter")[] = ["spring", "summer", "autumn", "winter"];
  return seasons[week % 4];
}

// ─── Per-behavior update functions ───────────────────────────────────────────

function applyWander(npc: NPCState, speed: number, walkable: boolean[][]): void {
  // Random direction change ~2% per tick
  if (Math.random() < 0.02) {
    pickWalkableDirection(npc, speed, walkable);
  }
}

function applyPacing(npc: NPCState, speed: number, walkable: boolean[][]): void {
  const state = pacingState.get(npc.name)!;
  state.ticksOnCurrent++;
  if (state.ticksOnCurrent >= state.maxTicks) {
    // Reverse direction or pick new
    npc.vx = -npc.vx || (Math.random() < 0.5 ? speed : -speed);
    npc.vy = 0;
    state.ticksOnCurrent = 0;
    state.maxTicks = 20 + Math.floor(Math.random() * 40);
  }
  // Make sure we have some velocity
  if (npc.vx === 0 && npc.vy === 0) {
    npc.vx = Math.random() < 0.5 ? speed : -speed;
  }
}

function applyStationary(npc: NPCState, _speed: number, _walkable: boolean[][]): void {
  // 0.5% chance of small wander
  if (Math.random() < 0.005) {
    npc.vx = (Math.random() - 0.5) * 0.5;
    npc.vy = (Math.random() - 0.5) * 0.5;
  } else {
    npc.vx *= 0.9;
    npc.vy *= 0.9;
  }
}

function applyCircular(npc: NPCState, speed: number, _walkable: boolean[][]): void {
  const state = circularState.get(npc.name)!;
  state.angle += 0.03;
  npc.vx = Math.cos(state.angle) * speed;
  npc.vy = Math.sin(state.angle) * speed;
}

function applyAggressive(npc: NPCState, speed: number, walkable: boolean[][]): void {
  // Fast random movement with frequent direction changes
  if (Math.random() < 0.05) {
    pickWalkableDirection(npc, speed, walkable);
  }
}

function applyDirected(npc: NPCState, speed: number, walkable: boolean[][]): void {
  const state = directedState.get(npc.name)!;
  const dist = Math.sqrt((state.targetX - npc.x) ** 2 + (state.targetY - npc.y) ** 2);
  if (dist < speed * 2 || state.stuckTicks > 40) {
    // Pick new target
    state.targetX = 100 + Math.random() * 600;
    state.targetY = 100 + Math.random() * 400;
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

function applyPatternBehavior(npc: NPCState, behavior: string, speed: number, walkable: boolean[][]): void {
  switch (behavior) {
    case "wander":      applyWander(npc, speed, walkable); break;
    case "pacing":      applyPacing(npc, speed, walkable); break;
    case "stationary":  applyStationary(npc, speed, walkable); break;
    case "circular":    applyCircular(npc, speed, walkable); break;
    case "aggressive":  applyAggressive(npc, speed, walkable); break;
    case "directed":    applyDirected(npc, speed, walkable); break;
    default:            applyWander(npc, speed, walkable); break;
  }
}

// ─── Main NPC tick ───────────────────────────────────────────────────────────

export function tickNpcs(
  npcs: Map<string, NPCState>,
  chunks: Map<string, ChunkData>,
  congressActive: boolean
): void {
  const chunk = chunks.get("0:0"); // NPCs stay in chunk (0,0) for Phase 1-3
  if (!chunk) return;

  const season = getCurrentSeason();
  const speedMod = season === "winter" ? 0.7 : 1.0;

  for (const npc of npcs.values()) {
    const patternCfg = NPC_PATTERNS[npc.name];
    if (!patternCfg) continue;
    const speed = patternCfg.speed * speedMod;

    // Congress mode: override with pathfinding to council target
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

    // Apply movement with tile collision check
    const targetX = npc.x + npc.vx;
    const targetY = npc.y + npc.vy;

    // Try full move
    if (isWalkablePixel(targetX, targetY, chunk.walkable)) {
      npc.x = targetX;
      npc.y = targetY;
    } else {
      // Try horizontal only
      if (isWalkablePixel(targetX, npc.y, chunk.walkable)) {
        npc.x = targetX;
        npc.vy = -npc.vy * 0.5;
      }
      // Try vertical only
      else if (isWalkablePixel(npc.x, targetY, chunk.walkable)) {
        npc.y = targetY;
        npc.vx = -npc.vx * 0.5;
      }
      // Fully blocked — pick new direction
      else {
        npc.vx = 0;
        npc.vy = 0;
        pickWalkableDirection(npc, speed, chunk.walkable);
      }
    }

    // Clamp to chunk bounds (pixel space)
    const maxX = (chunk.tiles.length - 1) * TILE_SIZE;
    const maxY = (chunk.tiles[0].length - 1) * TILE_SIZE;
    npc.x = Math.max(TILE_SIZE, Math.min(maxX - TILE_SIZE, npc.x));
    npc.y = Math.max(TILE_SIZE, Math.min(maxY - TILE_SIZE, npc.y));

    // Update facing
    if (npc.vx > 0.01) npc.facing = "right";
    else if (npc.vx < -0.01) npc.facing = "left";
  }
}
