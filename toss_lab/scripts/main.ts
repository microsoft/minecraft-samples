import { world, system, Player } from "@minecraft/server";
import { TossLabGame } from "./tossLabGame";
import { PROJECTILES, THROW_FORCE } from "./config";

/** Active games keyed by player ID. */
const activeGames = new Map<string, TossLabGame>();

// ── Charged throw mechanic ─────────────────────────────────────────────────
// Items have `minecraft:use_modifiers` so they can be held to charge.
// itemStartUse → record start tick. itemStopUse → spawn entity & impulse,
// scaling force by hold duration. Direction comes from the toss lab
// aim if a game is active, otherwise the player's view direction.

const ITEM_TO_PROJECTILE = new Map(PROJECTILES.map((p) => [p.itemId, p]));

/** Per-player active charge: item being held and tick when started. */
interface ChargeState {
  itemId: string;
  startTick: number;
}
const charging = new Map<string, ChargeState>();

/** Ticks of hold required to reach maximum charge (≈1.5 s). */
const MAX_CHARGE_TICKS = 30;
/** Minimum force multiplier (tap = light toss). */
const MIN_CHARGE_MULT = 0.35;
/** Maximum force multiplier (full hold = strong throw). */
const MAX_CHARGE_MULT = 2.0;

world.afterEvents.itemStartUse.subscribe((event) => {
  if (!ITEM_TO_PROJECTILE.has(event.itemStack.typeId)) return;
  charging.set(event.source.id, {
    itemId: event.itemStack.typeId,
    startTick: system.currentTick,
  });
});

world.afterEvents.itemStopUse.subscribe((event) => {
  const player = event.source;
  const state = charging.get(player.id);
  if (!state) return;
  charging.delete(player.id);

  // Use the item that was being charged (event.itemStack may be undefined
  // if the player swapped slots mid-charge).
  const def = ITEM_TO_PROJECTILE.get(state.itemId);
  if (!def) return;

  const heldTicks = system.currentTick - state.startTick;
  const chargeRatio = Math.min(1, Math.max(0, heldTicks / MAX_CHARGE_TICKS));
  const chargeMult = MIN_CHARGE_MULT + (MAX_CHARGE_MULT - MIN_CHARGE_MULT) * chargeRatio;

  // Direction: aim vector from active toss lab game, else view.
  const game = activeGames.get(player.id);
  const dir = game?.isRunning ? game.getAimDirection() : player.getViewDirection();

  const head = player.getHeadLocation();
  const spawnPos = {
    x: head.x + dir.x * 1.0,
    y: head.y + dir.y * 1.0,
    z: head.z + dir.z * 1.0,
  };

  try {
    const entity = player.dimension.spawnEntity(def.entityId, spawnPos);
    const force = THROW_FORCE * def.forceMultiplier * chargeMult;
    entity.applyImpulse({ x: dir.x * force, y: dir.y * force, z: dir.z * force });
    if (game?.isRunning) {
      game.trackProjectile(entity, def.itemId);
    }
    player.onScreenDisplay.setActionBar(`§e${def.label}§r  Power: ${(chargeRatio * 100).toFixed(0)}%`);
  } catch (e) {
    player.sendMessage(`§cThrow failed: ${e}`);
  }
});

// Live charge meter while holding.
system.runInterval(() => {
  for (const [playerId, state] of charging) {
    const player = world.getAllPlayers().find((p) => p.id === playerId);
    if (!player) {
      charging.delete(playerId);
      continue;
    }
    const def = ITEM_TO_PROJECTILE.get(state.itemId);
    if (!def) continue;
    const heldTicks = system.currentTick - state.startTick;
    const ratio = Math.min(1, heldTicks / MAX_CHARGE_TICKS);
    const filled = Math.round(ratio * 10);
    const bar = "§a" + "█".repeat(filled) + "§7" + "█".repeat(10 - filled);
    player.onScreenDisplay.setActionBar(`§e${def.label}§r  [${bar}§r] ${(ratio * 100).toFixed(0)}%`);
  }
}, 2);

// ── Listen for /scriptevent commands ────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(
  (event) => {
    const player = event.sourceEntity;
    if (!(player instanceof Player)) return;

    if (event.id === "tosslab:start") {
      // Stop existing game if any
      const existing = activeGames.get(player.id);
      if (existing?.isRunning) {
        existing.stop();
      }

      const game = new TossLabGame(player);
      activeGames.set(player.id, game);
      game.start();
    }

    if (event.id === "tosslab:stop") {
      const game = activeGames.get(player.id);
      if (game?.isRunning) {
        game.stop();
        activeGames.delete(player.id);
      } else {
        player.sendMessage("§cNo active toss lab game to stop.");
      }
    }
  },
  { namespaces: ["tosslab"] }
);

// ── Handle respawns ─────────────────────────────────────────────────────────

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) return; // Skip first join; only handle death respawns
  const game = activeGames.get(event.player.id);
  if (game?.isRunning) {
    game.onRespawn();
  }
});
