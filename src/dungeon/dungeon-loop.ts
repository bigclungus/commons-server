// Clungiverse Dungeon Loop — 16Hz server tick
// Ties together: dungeon-manager, dungeon-generation, combat, enemy-ai, boss-ai, collision, stats

import type {
  DungeonInstance,
  DungeonPlayer,
  EnemyInstance,
  ProjectileInstance,
  AoEZoneInstance,
  FloorLayout as ProtocolFloorLayout,
  DungeonServerMessage,
  DungeonTickMessage,
  DungeonFloorMessage,
  DungeonPlayerSnapshot,
  EnemySnapshot,
  ProjectileSnapshot,
  AoEZoneSnapshot,
  TickEvent,
  Room as ProtocolRoom,
  DungeonResultsMessage,
} from "./dungeon-protocol.ts";

import {
  getAllInstances,
  destroyRun,
} from "./dungeon-manager.ts";

import {
  generateFloor,
  type FloorLayout as GenFloorLayout,
  type EnemyVariant,
  type FloorTemplate,
  type Room as GenRoom,
} from "./dungeon-generation.ts";

import {
  resolvePower,
  applyDamage,
  processKill,
  tickBroseidonWindow,
  tickAoEZones,
  type PlayerEntity,
  type EnemyEntity,
  type AoEZone,
  type HealEvent,
  type CombatEntity,
} from "./combat.ts";

import {
  updateEnemyAI,
  createEnemyAIState,
  resetSlowMultipliers,
  type EnemyAIState,
  type ProjectileSpawn,
} from "./enemy-ai.ts";

import {
  updateBossAI,
  createBossAIState,
  type BossAIState,
  type BossType,
} from "./boss-ai.ts";

import {
  circleVsCircle,
} from "./collision.ts";

import {
  calculateEffectiveStats,
  type BaseStats,
} from "./stats.ts";

import { TILE } from "./dungeon-protocol.ts";

import {
  lootRegistry,
  initLootSystem,
  type LootItem,
} from "./loot.ts";

// ─── Constants ──────────────────────────────────────────────────────────────

const TICK_MS = 62.5; // 16Hz
const TILE_SIZE = 16;
const PLAYER_RADIUS = 10;
const DISCONNECT_TIMEOUT_MS = 60_000;
const AUTO_ATTACK_INTERVAL_TICKS = 1; // every tick (~62.5ms) — maximum fire rate
const PLAYER_PROJECTILE_SPEED = 300 / (1000 / TICK_MS); // 300px/s → px/tick
const PLAYER_PROJECTILE_RADIUS = 4;
const PLAYER_PROJECTILE_LIFETIME_TICKS = Math.ceil(1500 / TICK_MS); // 1.5s
const PLAYER_AUTO_ATTACK_RANGE = 120; // px — detection range for spawning projectiles
const TOTAL_FLOORS = 3;
const POWERUP_PICK_TIMEOUT_MS = 15_000; // 15s to pick a powerup between floors

// ─── Per-instance ephemeral state ────────────────────────────────────────────

interface InstanceEphemeral {
  aiStates: Map<string, EnemyAIState>;
  bossAIState: BossAIState | null;
  bossId: string | null;
  autoAttackTimers: Map<string, number>; // playerId -> tick of next allowed auto-attack
  pendingAttacks: Set<string>; // playerIds that requested an attack this tick
  pendingPowers: Set<string>; // playerIds that activated power this tick
  genLayout: GenFloorLayout | null;
  // Powerup transition state
  transitionChoices: LootItem[] | null; // current powerup choices offered
  transitionPicks: Map<string, number>; // playerId → chosen powerup ID
  transitionTimer: ReturnType<typeof setTimeout> | null;
}

const ephemeralMap = new Map<string, InstanceEphemeral>();

function getEphemeral(instance: DungeonInstance): InstanceEphemeral {
  let e = ephemeralMap.get(instance.id);
  if (!e) {
    e = {
      aiStates: new Map(),
      bossAIState: null,
      bossId: null,
      autoAttackTimers: new Map(),
      pendingAttacks: new Set(),
      pendingPowers: new Set(),
      genLayout: null,
      transitionChoices: null,
      transitionPicks: new Map(),
      transitionTimer: null,
    };
    ephemeralMap.set(instance.id, e);
  }
  return e;
}

function cleanupEphemeral(instanceId: string): void {
  const eph = ephemeralMap.get(instanceId);
  if (eph?.transitionTimer) {
    clearTimeout(eph.transitionTimer);
  }
  ephemeralMap.delete(instanceId);
}

// ─── Send function registry ──────────────────────────────────────────────────

type SendFn = (playerId: string, msg: DungeonServerMessage) => void;

let globalSendFn: SendFn | null = null;

export function setSendFunction(fn: SendFn): void {
  globalSendFn = fn;
}

function sendToPlayer(playerId: string, msg: DungeonServerMessage): void {
  if (globalSendFn) globalSendFn(playerId, msg);
}

function broadcastToInstance(instance: DungeonInstance, msg: DungeonServerMessage): void {
  for (const [id, player] of instance.players) {
    if (player.connected) {
      sendToPlayer(id, msg);
    }
  }
}

// ─── Persona base stats ─────────────────────────────────────────────────────

const PERSONA_STATS: Record<string, BaseStats> = {
  holden: { maxHP: 150, ATK: 12, DEF: 10, SPD: 2.5, LCK: 4 },
  broseidon: { maxHP: 100, ATK: 16, DEF: 5, SPD: 3.5, LCK: 6 },
  deckard_cain: { maxHP: 90, ATK: 8, DEF: 6, SPD: 3.0, LCK: 10 },
  galactus: { maxHP: 120, ATK: 14, DEF: 7, SPD: 2.8, LCK: 8 },
};

// SPD in base stats is px/tick movement speed; the state file uses big numbers
// for the client display, but server combat uses the base values directly.

const PERSONA_POWER: Record<string, "holden" | "broseidon" | "deckard_cain" | "galactus"> = {
  holden: "holden",
  broseidon: "broseidon",
  deckard_cain: "deckard_cain",
  galactus: "galactus",
};

// ─── Default enemy variants (until DB is populated) ─────────────────────────

const DEFAULT_ENEMY_VARIANTS: EnemyVariant[] = [
  { id: 1, name: "Crawler", behavior: "crawler", hp: 20, atk: 5, def: 2, spd: 1.5, floor_min: 1, budget_cost: 3 },
  { id: 2, name: "Spitter", behavior: "spitter", hp: 15, atk: 8, def: 1, spd: 1.2, floor_min: 1, budget_cost: 5 },
  { id: 3, name: "Brute", behavior: "brute", hp: 40, atk: 12, def: 5, spd: 0.8, floor_min: 2, budget_cost: 8 },
];

const DEFAULT_FLOOR_TEMPLATES: FloorTemplate[] = [
  { floor_number: 1, room_count_min: 5, room_count_max: 7, enemy_budget: 600, boss_type_id: 1, powerup_choices: 3, enemy_scaling: 1.0 },
  { floor_number: 2, room_count_min: 6, room_count_max: 9, enemy_budget: 1000, boss_type_id: 2, powerup_choices: 3, enemy_scaling: 1.4 },
  { floor_number: 3, room_count_min: 7, room_count_max: 10, enemy_budget: 1400, boss_type_id: 3, powerup_choices: 2, enemy_scaling: 1.8 },
];

const BOSS_TYPE_MAP: Record<number, BossType> = {
  1: "hive_mother",
  2: "spore_lord",
  3: "the_architect",
};

// ─── Floor Initialization ────────────────────────────────────────────────────

export function initFloor(instance: DungeonInstance): void {
  const floorNum = instance.floor;
  const template = DEFAULT_FLOOR_TEMPLATES[floorNum - 1] ?? DEFAULT_FLOOR_TEMPLATES[0];
  const seedStr = `${instance.seed}-f${floorNum}`;

  const genLayout = generateFloor(seedStr, floorNum, template, DEFAULT_ENEMY_VARIANTS);
  const eph = getEphemeral(instance);
  eph.genLayout = genLayout;

  // Build protocol-compatible FloorLayout
  const layout: ProtocolFloorLayout = {
    width: genLayout.width,
    height: genLayout.height,
    tiles: genLayout.tileGrid,
    rooms: genLayout.rooms.map((r) => ({
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      enemyIds: [],
      cleared: r.type === "start" || r.type === "rest" || r.type === "treasure",
    })),
    corridors: genLayout.corridors.map((c) => ({
      x1: c.points[0]?.x ?? 0,
      y1: c.points[0]?.y ?? 0,
      x2: c.points[c.points.length - 1]?.x ?? 0,
      y2: c.points[c.points.length - 1]?.y ?? 0,
      width: 3,
    })),
  };
  instance.layout = layout;

  // Clear old entities
  instance.enemies.clear();
  instance.projectiles.clear();
  instance.aoeZones.clear();
  eph.aiStates.clear();
  eph.bossAIState = null;
  eph.bossId = null;

  // Spawn enemies from genLayout
  let enemyCounter = 0;
  for (const spawn of genLayout.enemySpawns) {
    const variant = DEFAULT_ENEMY_VARIANTS.find((v) => v.id === spawn.variantId);
    if (!variant) continue;

    const enemyId = `e-${instance.id}-${enemyCounter++}`;
    const behaviorMap: Record<string, "melee_chase" | "ranged_pattern" | "slow_charge"> = {
      crawler: "melee_chase",
      spitter: "ranged_pattern",
      brute: "slow_charge",
    };

    const enemy: EnemyInstance = {
      id: enemyId,
      variantId: variant.id,
      variantName: variant.name,
      behavior: behaviorMap[variant.behavior] ?? "melee_chase",
      x: spawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: spawn.y * TILE_SIZE + TILE_SIZE / 2,
      hp: Math.floor(variant.hp * template.enemy_scaling),
      maxHp: Math.floor(variant.hp * template.enemy_scaling),
      atk: Math.floor(variant.atk * template.enemy_scaling),
      def: variant.def,
      spd: variant.spd,
      isBoss: false,
      roomIndex: spawn.roomId,
      targetPlayerId: null,
      cooldownTicks: 0,
      telegraphing: false,
      telegraphTicks: 0,
      phase: 0,
      phaseData: {},
    };

    instance.enemies.set(enemyId, enemy);
    eph.aiStates.set(enemyId, createEnemyAIState(enemy.behavior));

    // Track enemy in room
    const room = layout.rooms[spawn.roomId];
    if (room) room.enemyIds.push(enemyId);
  }

  // Spawn boss if template has one
  if (template.boss_type_id !== null) {
    const bossRoom = genLayout.rooms.find((r) => r.type === "boss");
    if (bossRoom) {
      const bossId = `boss-${instance.id}-f${floorNum}`;
      const bossType = BOSS_TYPE_MAP[template.boss_type_id] ?? "hive_mother";
      const bossHp = Math.floor(200 * template.enemy_scaling);

      const boss: EnemyInstance = {
        id: bossId,
        variantId: 0,
        variantName: bossType,
        behavior: "melee_chase", // boss uses its own AI, this is just for type compat
        x: (bossRoom.x + Math.floor(bossRoom.w / 2)) * TILE_SIZE + TILE_SIZE / 2,
        y: (bossRoom.y + Math.floor(bossRoom.h / 2)) * TILE_SIZE + TILE_SIZE / 2,
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
        phaseData: {},
      };

      instance.enemies.set(bossId, boss);
      eph.bossId = bossId;
      eph.bossAIState = createBossAIState(bossType);

      // Track in room
      const protoRoom = layout.rooms[genLayout.rooms.indexOf(bossRoom)];
      if (protoRoom) protoRoom.enemyIds.push(bossId);
    }
  }

  // Position players at spawn point (center of start room)
  const startRoom = genLayout.rooms.find((r) => r.type === "start");
  if (startRoom) {
    const cx = (startRoom.x + Math.floor(startRoom.w / 2)) * TILE_SIZE + TILE_SIZE / 2;
    const cy = (startRoom.y + Math.floor(startRoom.h / 2)) * TILE_SIZE + TILE_SIZE / 2;
    let offset = 0;
    for (const [_id, player] of instance.players) {
      // Clear stale movement inputs from previous floor so they don't
      // overwrite the new spawn position on the next tick
      player.inputQueue.length = 0;
      player.x = cx + (offset % 2 === 0 ? offset * 8 : -offset * 8);
      player.y = cy + (offset < 2 ? -8 : 8);
      offset++;
    }
  }

  // Initialize player stats
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
    // cooldownMax in ticks derived from autoAttackIntervalMs
    player.cooldownMax = Math.ceil(effective.autoAttackIntervalMs / TICK_MS);
    player.diedOnFloor = null;
  }

  // Send floor data to all players
  const floorMsg: DungeonFloorMessage = {
    type: "d_floor",
    floor: floorNum,
    gridWidth: genLayout.width,
    gridHeight: genLayout.height,
    tiles: Array.from(genLayout.tileGrid),
    rooms: layout.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    corridors: layout.corridors.map((c) => ({
      x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, width: c.width,
    })),
  };
  // Open doors for all non-boss rooms immediately (fog of war + aggro radius replace doors)
  // Boss room doors stay locked until all other rooms are cleared.
  // Must happen BEFORE broadcasting d_floor so the client gets the correct tile states.
  const bossRoomIndex = genLayout.rooms.findIndex((r) => r.type === "boss");
  for (let i = 0; i < layout.rooms.length; i++) {
    if (i === bossRoomIndex) continue; // keep boss room doors closed
    layout.rooms[i].cleared = true;
    openDoorsForRoom(layout, i);
  }

  // Check if boss room doors should also open (all non-boss rooms cleared)
  if (bossRoomIndex >= 0) {
    const allNonBossCleared = layout.rooms.every((r, idx) => idx === bossRoomIndex || r.cleared);
    if (allNonBossCleared) {
      layout.rooms[bossRoomIndex].cleared = true;
      openDoorsForRoom(layout, bossRoomIndex);
    }
  }

  // Update the floor message tiles after opening doors
  floorMsg.tiles = Array.from(layout.tiles);
  broadcastToInstance(instance, floorMsg);

  console.log(`[dungeon-loop] Floor ${floorNum} initialized for ${instance.id}: ${genLayout.rooms.length} rooms, ${instance.enemies.size} enemies`);
}

// ─── Adapter: DungeonPlayer → combat PlayerEntity ────────────────────────────

function toPlayerEntity(p: DungeonPlayer, tick: number): PlayerEntity {
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
      critChance: Math.min(0.8, p.lck * 0.02),
    },
    facing: p.facing,
    iFrameUntilTick: tick + p.iframeTicks,
    alive: p.hp > 0 && p.diedOnFloor === null,
    persona: PERSONA_POWER[p.personaSlug] ?? "holden",
    powerCooldownUntilTick: tick + p.cooldownTicks,
    broseidonWindowEnd: 0,
    broseidonStacks: 0,
  };
}

function toEnemyEntity(e: EnemyInstance, tick: number): EnemyEntity {
  const radiusMap: Record<string, number> = {
    melee_chase: 8,
    ranged_pattern: 8,
    slow_charge: 16,
  };
  return {
    id: e.id,
    x: e.x,
    y: e.y,
    radius: e.isBoss ? 20 : (radiusMap[e.behavior] ?? 8),
    hp: e.hp,
    maxHP: e.maxHp,
    stats: {
      maxHP: e.maxHp,
      ATK: e.atk,
      DEF: e.def,
      SPD: e.spd,
      LCK: 0,
      autoAttackIntervalMs: 1000,
      critChance: 0,
    },
    facing: "right",
    iFrameUntilTick: 0,
    alive: e.hp > 0,
    stunUntilTick: 0,
    slowMultiplier: 1.0,
  };
}

// ─── Write combat results back to instance ───────────────────────────────────

function syncPlayerFromEntity(p: DungeonPlayer, pe: PlayerEntity, tick: number): void {
  p.hp = pe.hp;
  p.iframeTicks = Math.max(0, pe.iFrameUntilTick - tick);
  p.cooldownTicks = Math.max(0, pe.powerCooldownUntilTick - tick);
  if (!pe.alive && p.diedOnFloor === null) {
    p.diedOnFloor = p.diedOnFloor; // set by caller
  }
}

function syncEnemyFromEntity(e: EnemyInstance, ee: EnemyEntity): void {
  e.hp = ee.hp;
  e.x = ee.x;
  e.y = ee.y;
}

// ─── Main Tick ───────────────────────────────────────────────────────────────

function tickInstance(instance: DungeonInstance): void {
  if (instance.status !== "running" && instance.status !== "boss") return;

  instance.tick++;
  const tick = instance.tick;
  const layout = instance.layout;
  if (!layout) return;

  const eph = getEphemeral(instance);
  const events: TickEvent[] = [];

  // === 1. Process pending player inputs (movement) ===
  for (const [_pid, player] of instance.players) {
    if (player.hp <= 0 || !player.connected) continue;

    // Client-authoritative movement: trust the client's reported position
    while (player.inputQueue.length > 0) {
      const input = player.inputQueue.shift()!;
      player.x = input.x;
      player.y = input.y;
      player.facing = input.facing;
      player.lastProcessedSeq = input.seq;
    }
  }

  // === 2. Build combat entity arrays ===
  const alivePlayers = Array.from(instance.players.values()).filter(
    (p) => p.hp > 0 && p.diedOnFloor === null
  );
  const playerTargets = alivePlayers.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    radius: PLAYER_RADIUS,
    alive: true,
  }));

  // Build enemy entities for combat
  const enemyEntities: EnemyEntity[] = [];
  for (const [_eid, enemy] of instance.enemies) {
    if (enemy.hp <= 0) continue;
    enemyEntities.push(toEnemyEntity(enemy, tick));
  }

  // === 3. Reset slow multipliers before AoE processing ===
  resetSlowMultipliers(enemyEntities);

  // === 4. Process AoE zone effects ===
  const combatAoeZones: AoEZone[] = [];
  for (const [_zid, zone] of instance.aoeZones) {
    combatAoeZones.push({
      id: zone.id,
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      expiresAtTick: tick + zone.ticksRemaining,
      owner: zone.ownerId,
      type: "deckard_slow",
      slowFactor: zone.slowFactor,
    });
  }

  const expiredZones = tickAoEZones(combatAoeZones, enemyEntities, tick);
  for (const zoneId of expiredZones) {
    instance.aoeZones.delete(zoneId);
  }

  // Sync slow multipliers back from combat entities to instance enemies
  for (const ee of enemyEntities) {
    const enemy = instance.enemies.get(ee.id);
    if (enemy) {
      // Store slow for AI use (enemy-ai reads slowMultiplier)
      // We pass it through the toEnemyEntity conversion on next tick
    }
  }

  // Tick down AoE zone durations
  for (const [zid, zone] of instance.aoeZones) {
    zone.ticksRemaining--;
    if (zone.ticksRemaining <= 0) {
      instance.aoeZones.delete(zid);
    }
  }

  // === 5. Update enemy AI ===
  for (const [eid, enemy] of instance.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.isBoss) continue; // boss has its own AI

    const aiState = eph.aiStates.get(eid);
    if (!aiState) continue;

    // Find the matching combat entity for slow multiplier
    const ee = enemyEntities.find((e) => e.id === eid);
    const combatEnemy = ee ?? toEnemyEntity(enemy, tick);

    const action = updateEnemyAI(
      combatEnemy,
      aiState,
      playerTargets,
      layout.tiles,
      layout.width,
      layout.height,
      tick,
      TILE_SIZE,
    );

    // Apply action
    switch (action.type) {
      case "move":
      case "charge":
        enemy.x += action.dx;
        enemy.y += action.dy;
        break;
      case "attack": {
        // Melee attack: damage nearest player in range
        if (!action.projectile) {
          for (const p of alivePlayers) {
            const dx = enemy.x - p.x;
            const dy = enemy.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= (combatEnemy.radius + PLAYER_RADIUS + 2) && p.iframeTicks <= 0) {
              const damage = Math.max(1, enemy.atk - Math.floor(p.def * 0.5));
              p.hp -= damage;
              p.iframeTicks = 8;
              p.damageTaken += damage;
              events.push({
                type: "damage",
                payload: { targetId: p.id, damage, attackerId: eid, isCrit: false },
              });
              if (p.hp <= 0) {
                p.hp = 0;
                p.diedOnFloor = instance.floor;
                events.push({
                  type: "player_death",
                  payload: { playerId: p.id, floor: instance.floor },
                });
              }
              break;
            }
          }
        }
        // Ranged: spawn projectile
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

  // === 6. Update boss AI ===
  if (eph.bossId && eph.bossAIState) {
    const boss = instance.enemies.get(eph.bossId);
    if (boss && boss.hp > 0) {
      instance.status = "boss"; // ensure status reflects boss fight

      const bossEntity = toEnemyEntity(boss, tick);
      const bossAction = updateBossAI(
        bossEntity,
        eph.bossAIState,
        playerTargets,
        enemyEntities,
        layout.tiles,
        layout.width,
        tick,
      );

      // Apply boss action
      switch (bossAction.type) {
        case "move":
          boss.x += bossAction.dx;
          boss.y += bossAction.dy;
          break;
        case "spawn_wave":
          if (bossAction.spawns) {
            for (const spawnReq of bossAction.spawns) {
              const newId = `e-${instance.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
              const behaviorMap: Record<string, "melee_chase" | "ranged_pattern" | "slow_charge"> = {
                melee_chase: "melee_chase",
                ranged_pattern: "ranged_pattern",
                slow_charge: "slow_charge",
              };
              const newEnemy: EnemyInstance = {
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
                phaseData: {},
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
                x: proj.x, y: proj.y,
                vx: proj.vx, vy: proj.vy,
                damage: proj.damage,
                radius: proj.radius,
                lifetimeTicks: proj.lifetimeTicks,
              }, eph.bossId, true);
            }
          }
          break;
        case "spawn_zone":
          if (bossAction.zone) {
            const zoneId = `bz-${tick}-${Math.random().toString(36).slice(2, 5)}`;
            const zone: AoEZoneInstance = {
              id: zoneId,
              x: bossAction.zone.x,
              y: bossAction.zone.y,
              radius: bossAction.zone.radius,
              ticksRemaining: bossAction.zone.durationTicks,
              zoneType: bossAction.zone.type,
              ownerId: eph.bossId,
              damagePerTick: bossAction.zone.damagePerTick,
              slowFactor: 0.5,
            };
            instance.aoeZones.set(zoneId, zone);
          }
          break;
        case "combo":
          if (bossAction.projectiles) {
            for (const proj of bossAction.projectiles) {
              spawnProjectile(instance, {
                x: proj.x, y: proj.y,
                vx: proj.vx, vy: proj.vy,
                damage: proj.damage,
                radius: proj.radius,
                lifetimeTicks: proj.lifetimeTicks,
              }, eph.bossId!, true);
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

      // Emit boss_phase event when phase changes
      if (boss.phase !== eph.bossAIState.phase) {
        events.push({
          type: "boss_phase",
          payload: { bossId: boss.id, oldPhase: boss.phase, newPhase: eph.bossAIState.phase },
        });
      }
      boss.phase = eph.bossAIState.phase;
    }
  }

  // === 7. Process projectiles ===
  const projectilesToRemove: string[] = [];
  for (const [pid, proj] of instance.projectiles) {
    // Move
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.lifetimeTicks--;

    if (proj.lifetimeTicks <= 0) {
      projectilesToRemove.push(pid);
      continue;
    }

    // Check wall collision
    const tileX = Math.floor(proj.x / TILE_SIZE);
    const tileY = Math.floor(proj.y / TILE_SIZE);
    if (tileX < 0 || tileX >= layout.width || tileY < 0 || tileY >= layout.height) {
      projectilesToRemove.push(pid);
      continue;
    }
    const tileVal = layout.tiles[tileY * layout.width + tileX];
    if (tileVal === TILE.WALL || tileVal === TILE.DOOR_CLOSED) {
      projectilesToRemove.push(pid);
      continue;
    }

    // Check entity collision
    if (proj.fromEnemy) {
      // Enemy projectile → hit players
      for (const p of alivePlayers) {
        if (p.iframeTicks > 0) continue;
        if (circleVsCircle(proj.x, proj.y, proj.radius, p.x, p.y, PLAYER_RADIUS)) {
          const damage = Math.max(1, proj.damage - Math.floor(p.def * 0.5));
          p.hp -= damage;
          p.iframeTicks = 8;
          p.damageTaken += damage;
          events.push({
            type: "damage",
            payload: { targetId: p.id, damage, attackerId: proj.ownerId, isCrit: false },
          });
          if (p.hp <= 0) {
            p.hp = 0;
            p.diedOnFloor = instance.floor;
            events.push({
              type: "player_death",
              payload: { playerId: p.id, floor: instance.floor },
            });
          }
          projectilesToRemove.push(pid);
          break;
        }
      }
    } else {
      // Player projectile → hit enemies
      for (const [eid, enemy] of instance.enemies) {
        if (enemy.hp <= 0) continue;
        const eRadius = enemy.isBoss ? 20 : 8;
        if (circleVsCircle(proj.x, proj.y, proj.radius, enemy.x, enemy.y, eRadius)) {
          enemy.hp -= proj.damage;
          const killer = instance.players.get(proj.ownerId);
          if (killer) killer.damageDealt += proj.damage;
          events.push({
            type: "damage",
            payload: {
              targetId: eid,
              damage: proj.damage,
              attackerId: proj.ownerId,
              isCrit: false,
            },
          });
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            events.push({ type: "kill", payload: { enemyId: eid, killerId: proj.ownerId } });
            if (killer) killer.kills++;
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

  // === 8. AoE damage zones (boss poison/hazard) ===
  for (const [_zid, zone] of instance.aoeZones) {
    if (zone.damagePerTick <= 0) continue;
    // Damage players inside damage zones
    for (const p of alivePlayers) {
      if (p.iframeTicks > 0) continue;
      if (circleVsCircle(p.x, p.y, PLAYER_RADIUS, zone.x, zone.y, zone.radius)) {
        p.hp -= zone.damagePerTick;
        p.damageTaken += zone.damagePerTick;
        if (p.hp <= 0) {
          p.hp = 0;
          p.diedOnFloor = instance.floor;
          events.push({
            type: "player_death",
            payload: { playerId: p.id, floor: instance.floor },
          });
        }
      }
    }
  }

  // === 9. Resolve auto-attacks for players (bullet-hell projectiles) ===
  for (const [pid, player] of instance.players) {
    if (player.hp <= 0 || player.diedOnFloor !== null) continue;

    // Check auto-attack timer (rapid fire: every 3 ticks ~187ms)
    const nextAttackTick = eph.autoAttackTimers.get(pid) ?? 0;
    if (tick < nextAttackTick) continue;

    // Find nearest alive enemy within detection range
    const pe = toPlayerEntity(player, tick);
    let bestDist = Infinity;
    let bestTarget: EnemyEntity | null = null;
    for (const ee of enemyEntities) {
      if (!ee.alive) continue;
      const dx = player.x - ee.x;
      const dy = player.y - ee.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= PLAYER_AUTO_ATTACK_RANGE && dist < bestDist) {
        bestDist = dist;
        bestTarget = ee;
      }
    }

    if (bestTarget) {
      // Calculate damage now and bake it into the projectile
      const variance = 1 + (Math.random() * 0.2 - 0.1);
      const rawDamage = pe.stats.ATK * variance;
      const mitigation = bestTarget.stats.DEF * 0.5;
      let finalDamage = Math.max(1, Math.floor(rawDamage - mitigation));
      const isCrit = Math.random() < pe.stats.critChance;
      if (isCrit) finalDamage = Math.floor(finalDamage * 1.5);

      // Aim at the target
      const dx = bestTarget.x - player.x;
      const dy = bestTarget.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const vx = (dx / dist) * PLAYER_PROJECTILE_SPEED;
      const vy = (dy / dist) * PLAYER_PROJECTILE_SPEED;

      spawnProjectile(instance, {
        x: player.x,
        y: player.y,
        vx,
        vy,
        damage: finalDamage,
        radius: PLAYER_PROJECTILE_RADIUS,
        lifetimeTicks: PLAYER_PROJECTILE_LIFETIME_TICKS,
      }, pid, false);

      // Set next auto-attack timer (rapid fire)
      eph.autoAttackTimers.set(pid, tick + AUTO_ATTACK_INTERVAL_TICKS);
    }
  }

  // === 10. Process power activations ===
  // Build allPlayers combat entities for powers that need them (Deckard heal)
  const allPlayerEntities: PlayerEntity[] = [];
  for (const [, p] of instance.players) {
    if (p.hp > 0 && p.diedOnFloor === null) {
      allPlayerEntities.push(toPlayerEntity(p, tick));
    }
  }

  for (const pid of eph.pendingPowers) {
    const player = instance.players.get(pid);
    if (!player || player.hp <= 0) continue;
    if (player.cooldownTicks > 0) continue;

    const pe = allPlayerEntities.find((p) => p.id === pid);
    if (!pe) continue;
    const targets = enemyEntities.filter((e) => e.alive);
    const combatZones: AoEZone[] = [];

    const powerResult = resolvePower(pe, targets, combatZones, tick, allPlayerEntities);
    if (powerResult && powerResult.activated) {
      // Sync cooldown back
      player.cooldownTicks = Math.max(0, pe.powerCooldownUntilTick - tick);

      events.push({
        type: "power_activate",
        payload: { playerId: pid, power: powerResult.powerName, affected: powerResult.affected },
      });

      // Apply effects from power
      for (const eid of powerResult.affected) {
        const enemy = instance.enemies.get(eid);
        if (enemy) {
          // Sync HP from combat entity
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

      // Handle spawned AoE zone (Deckard)
      if (powerResult.spawnedZone) {
        const sz = powerResult.spawnedZone;
        const zoneInstance: AoEZoneInstance = {
          id: sz.id,
          x: sz.x,
          y: sz.y,
          radius: sz.radius,
          ticksRemaining: sz.expiresAtTick - tick,
          zoneType: sz.type,
          ownerId: sz.owner,
          damagePerTick: 0,
          slowFactor: sz.slowFactor,
        };
        instance.aoeZones.set(sz.id, zoneInstance);
      }

      // Heal (Galactus)
      if (powerResult.healed) {
        player.hp = Math.min(player.maxHp, player.hp + powerResult.healed);
      }

      // Heal events (Deckard Cain healing aura) — sync HP back to DungeonPlayer
      if (powerResult.healEvents) {
        for (const he of powerResult.healEvents) {
          const healTarget = instance.players.get(he.targetId);
          if (healTarget) {
            // Find the combat entity to get the updated HP
            const ce = allPlayerEntities.find((p) => p.id === he.targetId);
            if (ce) {
              healTarget.hp = ce.hp;
            }
          }
          events.push({
            type: "heal",
            payload: { targetId: he.targetId, amount: he.amount, healerId: pid },
          });
        }
      }
    }
  }
  eph.pendingPowers.clear();

  // === 11. Tick down player i-frames and cooldowns ===
  for (const [_pid, player] of instance.players) {
    if (player.iframeTicks > 0) player.iframeTicks--;
    if (player.cooldownTicks > 0) player.cooldownTicks--;
  }

  // === 12. Check room clear conditions (only boss room doors remain locked) ===
  if (layout.rooms) {
    for (let i = 0; i < layout.rooms.length; i++) {
      const room = layout.rooms[i];
      if (room.cleared) continue;

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

  // === 13. Check floor clear (boss dead → next floor or victory) ===
  if (eph.bossId) {
    const boss = instance.enemies.get(eph.bossId);
    if (boss && boss.hp <= 0) {
      if (instance.floor >= TOTAL_FLOORS) {
        // Victory!
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

      // Enter powerup selection phase
      instance.status = "between_floors";
      startPowerupTransition(instance, eph);
      return;
    }
  }

  // === 14. Check defeat (all players dead) ===
  const anyAlive = Array.from(instance.players.values()).some(
    (p) => p.hp > 0 && p.diedOnFloor === null
  );
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

  // === 15. Check disconnection timeouts ===
  const now = Date.now();
  for (const [pid, player] of instance.players) {
    if (!player.connected && player.disconnectedAt) {
      if (now - player.disconnectedAt > DISCONNECT_TIMEOUT_MS) {
        // Remove player from instance
        player.hp = 0;
        player.diedOnFloor = instance.floor;
      }
    }
  }

  // === 16. Build and broadcast tick snapshot ===
  const tickMsg: DungeonTickMessage = {
    type: "d_tick",
    tick,
    t: Date.now(),
    players: buildPlayerSnapshots(instance),
    enemies: buildEnemySnapshots(instance),
    projectiles: buildProjectileSnapshots(instance),
    aoeZones: buildAoEZoneSnapshots(instance),
    events,
  };
  broadcastToInstance(instance, tickMsg);
}

// ─── Powerup transition ─────────────────────────────────────────────────────

function startPowerupTransition(instance: DungeonInstance, eph: InstanceEphemeral): void {
  // Generate 3 choices from registry
  const choices = lootRegistry.generateChoices(3, instance.floor);
  eph.transitionChoices = choices;
  eph.transitionPicks = new Map();

  // Broadcast choices to all players
  const choicesMsg = {
    type: "d_powerup_choices" as const,
    choices: choices.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      rarity: c.rarity,
      statModifier: c.statModifier,
    })),
  };
  broadcastToInstance(instance, choicesMsg);

  console.log(`[dungeon-loop] Powerup transition for ${instance.id} floor ${instance.floor}: ${choices.map((c) => c.name).join(", ")}`);

  // Start timeout — after 15s, assign random picks to anyone who hasn't chosen
  eph.transitionTimer = setTimeout(() => {
    finalizePowerupTransition(instance);
  }, POWERUP_PICK_TIMEOUT_MS);
}

/**
 * Handle a player's powerup pick. Called from index.ts message handler.
 */
export function handlePowerupPick(instanceId: string, playerId: string, powerupId: number): void {
  // Find instance by iterating the manager's map
  const instancesMap = getAllInstances();
  let instance: DungeonInstance | null = null;
  for (const [_lobbyId, inst] of instancesMap) {
    if (inst.id === instanceId) {
      instance = inst;
      break;
    }
  }
  if (!instance || instance.status !== "between_floors") return;

  const eph = getEphemeral(instance);
  if (!eph.transitionChoices) return;

  // Validate the pick is one of the offered choices
  const validChoice = eph.transitionChoices.find((c) => c.id === powerupId);
  if (!validChoice) return;

  eph.transitionPicks.set(playerId, powerupId);

  // Check if all alive players have picked
  const alivePlayers = Array.from(instance.players.values()).filter(
    (p) => p.hp > 0 && p.diedOnFloor === null
  );
  const allPicked = alivePlayers.every((p) => eph.transitionPicks.has(p.id));

  if (allPicked) {
    // Cancel timer, finalize immediately
    if (eph.transitionTimer) {
      clearTimeout(eph.transitionTimer);
      eph.transitionTimer = null;
    }
    finalizePowerupTransition(instance);
  }
}

function finalizePowerupTransition(instance: DungeonInstance): void {
  const eph = getEphemeral(instance);
  if (!eph.transitionChoices || eph.transitionChoices.length === 0) {
    // No choices available — just advance
    advanceFloor(instance, eph);
    return;
  }

  const alivePlayers = Array.from(instance.players.values()).filter(
    (p) => p.hp > 0 && p.diedOnFloor === null
  );

  // Assign random picks for players who didn't choose
  for (const player of alivePlayers) {
    if (!eph.transitionPicks.has(player.id)) {
      const randomChoice = eph.transitionChoices[Math.floor(Math.random() * eph.transitionChoices.length)];
      eph.transitionPicks.set(player.id, randomChoice.id);
    }
  }

  // Apply powerups to players
  for (const player of alivePlayers) {
    const chosenId = eph.transitionPicks.get(player.id);
    if (chosenId === undefined) continue;

    const lootItem = eph.transitionChoices.find((c) => c.id === chosenId);
    if (!lootItem) continue;

    // Track the powerup ID on the player
    player.powerups.push(lootItem.id);

    // Apply stat modifiers directly
    const mods = lootItem.statModifier;
    if (mods.hp) {
      player.maxHp += mods.hp;
      player.hp = Math.min(player.hp + Math.max(0, mods.hp), player.maxHp);
      player.maxHp = Math.max(1, player.maxHp);
      player.hp = Math.max(1, Math.min(player.hp, player.maxHp));
    }
    if (mods.atk) player.atk = Math.max(0, player.atk + mods.atk);
    if (mods.def) player.def = Math.max(0, player.def + mods.def);
    if (mods.spd) player.spd = Math.max(0.5, player.spd + mods.spd);
    if (mods.lck) player.lck = Math.max(0, player.lck + mods.lck);

    console.log(`[dungeon-loop] Player ${player.name} picked ${lootItem.name} (${lootItem.rarity})`);
  }

  // Clear transition state
  eph.transitionChoices = null;
  eph.transitionPicks.clear();
  eph.transitionTimer = null;

  advanceFloor(instance, eph);
}

function advanceFloor(instance: DungeonInstance, _eph: InstanceEphemeral): void {
  instance.floor++;
  instance.status = "running";
  initFloor(instance);
}

// ─── Projectile spawning ─────────────────────────────────────────────────────

let projCounter = 0;

function spawnProjectile(
  instance: DungeonInstance,
  spawn: ProjectileSpawn,
  ownerId: string,
  fromEnemy: boolean,
): void {
  const id = `proj-${projCounter++}`;
  const proj: ProjectileInstance = {
    id,
    x: spawn.x,
    y: spawn.y,
    vx: spawn.vx,
    vy: spawn.vy,
    radius: spawn.radius,
    damage: spawn.damage,
    fromEnemy,
    ownerId,
    lifetimeTicks: spawn.lifetimeTicks,
  };
  instance.projectiles.set(id, proj);
}

// ─── Door opening ────────────────────────────────────────────────────────────

function openDoorsForRoom(layout: ProtocolFloorLayout, roomIndex: number): void {
  const room = layout.rooms[roomIndex];
  if (!room) return;

  // Scan border tiles of the room for closed doors and open them
  for (let y = room.y - 1; y <= room.y + room.h; y++) {
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      if (x < 0 || x >= layout.width || y < 0 || y >= layout.height) continue;
      const idx = y * layout.width + x;
      if (layout.tiles[idx] === TILE.DOOR_CLOSED) {
        layout.tiles[idx] = TILE.DOOR_OPEN;
      }
    }
  }
}

// ─── Snapshot builders ───────────────────────────────────────────────────────

function buildPlayerSnapshots(instance: DungeonInstance): DungeonPlayerSnapshot[] {
  const snaps: DungeonPlayerSnapshot[] = [];
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
      cooldownRemaining: p.cooldownTicks,
    });
  }
  return snaps;
}

function buildEnemySnapshots(instance: DungeonInstance): EnemySnapshot[] {
  const snaps: EnemySnapshot[] = [];
  for (const [_id, e] of instance.enemies) {
    if (e.hp <= 0) continue;
    snaps.push({
      id: e.id,
      variantName: e.variantName,
      behavior: e.behavior,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      isBoss: e.isBoss,
      telegraphing: e.telegraphing,
    });
  }
  return snaps;
}

function buildProjectileSnapshots(instance: DungeonInstance): ProjectileSnapshot[] {
  const snaps: ProjectileSnapshot[] = [];
  for (const [_id, p] of instance.projectiles) {
    snaps.push({
      id: p.id,
      x: p.x,
      y: p.y,
      radius: p.radius,
      fromEnemy: p.fromEnemy,
      ownerId: p.ownerId,
    });
  }
  return snaps;
}

function buildAoEZoneSnapshots(instance: DungeonInstance): AoEZoneSnapshot[] {
  const snaps: AoEZoneSnapshot[] = [];
  for (const [_id, z] of instance.aoeZones) {
    snaps.push({
      id: z.id,
      x: z.x,
      y: z.y,
      radius: z.radius,
      ticksRemaining: z.ticksRemaining,
      zoneType: z.zoneType,
    });
  }
  return snaps;
}

function buildResults(
  instance: DungeonInstance,
  outcome: "victory" | "death",
): DungeonResultsMessage {
  const durationMs = Date.now() - instance.startedAt;
  const players = Array.from(instance.players.values()).map((p) => ({
    playerId: p.id,
    name: p.name,
    personaSlug: p.personaSlug,
    kills: p.kills,
    damageDealt: p.damageDealt,
    damageTaken: p.damageTaken,
    diedOnFloor: p.diedOnFloor,
  }));

  return {
    type: "d_results",
    outcome,
    floorReached: instance.floor,
    durationMs,
    players,
  };
}

// ─── Public: queue power activation from message handler ─────────────────────

export function queuePowerActivation(instanceId: string, playerId: string): void {
  // Find instance by iterating all instances
  for (const [_lobbyId, instance] of getAllInstances()) {
    if (instance.id === instanceId) {
      const eph = getEphemeral(instance);
      eph.pendingPowers.add(playerId);
      return;
    }
  }
}

// ─── Loop lifecycle ──────────────────────────────────────────────────────────

let loopInterval: ReturnType<typeof setInterval> | null = null;

export function startDungeonLoop(): void {
  if (loopInterval) return;

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

export function stopDungeonLoop(): void {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    console.log("[dungeon-loop] Stopped");
  }
}
