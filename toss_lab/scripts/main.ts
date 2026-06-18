import { world, system, Player } from "@minecraft/server";
import { MessageBox, DataDrivenScreenClosedReason } from "@minecraft/server-ui";
import { TossLabGame } from "./tossLabGame";
import { PROJECTILES, THROW_FORCE } from "./config";

/** Active games keyed by player ID. */
const activeGames = new Map<string, TossLabGame>();

/** Cancel fall damage for players actively in a Toss Lab game so a gap is
 *  always handled by checkFall() (teleport back) rather than a real death
 *  that would send the player to world spawn outside the game. */
world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.damageSource.cause !== "fall") return;
  const hurt = event.hurtEntity;
  if (!(hurt instanceof Player)) return;
  const game = activeGames.get(hurt.id);
  if (game?.isRunning) {
    event.cancel = true;
  }
});

/** Player IDs that have already seen the welcome dialog this script session. */
const welcomeShown = new Set<string>();

/** Start (or restart) a Toss Lab game for the given player. */
function startGame(player: Player): void {
  const existing = activeGames.get(player.id);
  if (existing?.isRunning) {
    existing.stop();
  }
  const game = new TossLabGame(player);
  activeGames.set(player.id, game);
  game.start();
}

/** Show the welcome dialog introducing Toss Lab. Safe to call repeatedly —
 *  only the first call per player per script session opens the form. */
function showWelcomeDialog(player: Player): void {
  if (welcomeShown.has(player.id)) return;
  welcomeShown.add(player.id);

  const form = new MessageBox(player, "Welcome to Toss Lab!")
    .body(
      "Toss Lab is a side-scrolling puzzle game about throwing objects to solve challenges.\n\n" +
        "Hold an item to charge your throw, then release to toss.\n" +
        "Sneak to aim and run.\n\n" +
        "Ready to play?"
    )
    .button1("Play Toss Lab")
    .button2("Close");

  form
    .show()
    .then((response) => {
      // If the player was busy (UI was already open), try again shortly.
      if (response.closeReason === DataDrivenScreenClosedReason.UserBusy) {
        welcomeShown.delete(player.id);
        system.runTimeout(() => {
          if (player.isValid) showWelcomeDialog(player);
        }, 40);
        return;
      }
      // MessageBox's first button (button1 = "Play Toss Lab") resolves with
      // selection 1; the second button (button2 = "Close") resolves with 0.
      if (response.selection === 1) {
        startGame(player);
      }
    })
    .catch((e) => {
      console.warn(`Toss Lab welcome dialog failed: ${e}`);
    });
}

/** Schedule the welcome dialog after a short delay so the client UI is ready. */
function scheduleWelcomeDialog(player: Player): void {
  if (welcomeShown.has(player.id)) return;
  system.runTimeout(() => {
    if (player.isValid) {
      showWelcomeDialog(player);
    }
  }, 40);
}

// On script load, prompt any players already in the world (covers behavior-pack
// reloads & /reload, where playerSpawn won't fire for already-present players).
system.run(() => {
  for (const player of world.getAllPlayers()) {
    scheduleWelcomeDialog(player);
  }
});

// Clean up tracking when a player leaves so a rejoin shows the dialog again.
world.afterEvents.playerLeave.subscribe((event) => {
  welcomeShown.delete(event.playerId);
  activeGames.delete(event.playerId);
});

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
// Accept both `tosslab:*` and `toss_lab:*` for convenience.

const START_EVENT_IDS = new Set(["tosslab:start", "toss_lab:start"]);
const STOP_EVENT_IDS = new Set(["tosslab:stop", "toss_lab:stop"]);

system.afterEvents.scriptEventReceive.subscribe(
  (event) => {
    const player = event.sourceEntity;
    if (!(player instanceof Player)) return;

    if (START_EVENT_IDS.has(event.id)) {
      startGame(player);
    } else if (STOP_EVENT_IDS.has(event.id)) {
      const game = activeGames.get(player.id);
      if (game?.isRunning) {
        game.stop();
        activeGames.delete(player.id);
      } else {
        player.sendMessage("§cNo active toss lab game to stop.");
      }
    }
  },
  { namespaces: ["tosslab", "toss_lab"] }
);

// ── Startup cleanup ─────────────────────────────────────────────────────────
// Ticking areas persist on the world across script reloads. If we don't clean
// them up, recreating a slab with the same ID throws "Identifier already exists".
system.run(() => {
  try {
    const mgr = world.tickingAreaManager;
    for (const area of mgr.getAllTickingAreas()) {
      if (area.identifier.startsWith("tossLab_")) {
        try {
          mgr.removeTickingArea(area.identifier);
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    console.warn(`Toss Lab ticking-area cleanup failed: ${e}`);
  }
});

// ── Handle respawns & first-join welcome ────────────────────────────────────

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    // First time joining this world session — introduce Toss Lab.
    scheduleWelcomeDialog(event.player);
    return;
  }

  // Death respawn — notify any active game.
  const game = activeGames.get(event.player.id);
  if (game?.isRunning) {
    game.onRespawn();
  }
});
