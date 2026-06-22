import {
  Player,
  Dimension,
  BlockVolume,
  BlockPermutation,
  EntityInventoryComponent,
  InputPermissionCategory,
  InputButton,
  ItemStack,
  ButtonState,
  EasingType,
  Entity,
  GameMode,
  system,
  world,
} from "@minecraft/server";
import {
  CAMERA_Z_OFFSET,
  CAMERA_Y_OFFSET,
  FALL_DEPTH,
  FALL_GRACE_TICKS,
  MAX_SAFE_DESCENT_PER_TICK,
  CLEAR_Z_BEHIND,
  CLEAR_HEIGHT,
  MARGIN_X,
  BARRIER_HEIGHT,
  BARRIER_DEPTH,
  CLEAR_WINDOW_HALF,
  AIM_SPEED,
  RETICLE_DISTANCE,
  THROW_FORCE,
  THROW_COOLDOWN,
  PROJECTILE_MAX_LIFETIME_TICKS,
  PROJECTILE_REST_TICKS,
  PROJECTILE_REST_VELOCITY,
  PROJECTILES,
  ProjectileDef,
  LOOKAHEAD_BLOCKS,
  INITIAL_PREBUILD_BLOCKS,
  PRUNE_BEHIND_BLOCKS,
  MILESTONE_INTERVAL_BLOCKS,
} from "./config";
import { scoutBestSite, ScoutedSite, waitForAreaLoaded } from "./levelScout";
import { LevelBuilder, SegmentBuilt } from "./levelBuilder";
import { getActiveHint } from "./puzzles";

export class TossLabGame {
  private player: Player;
  private dimension: Dimension;
  private running = false;
  private runId: number | undefined;
  private lastClearedMinX = 0;
  private lastClearedMaxX = 0;
  /** Rightmost X already protected by barriers / corridor clearing. */
  private barrierFrontierMaxX = 0;
  /** Right edge (X) of the currently loaded play ticking area. */
  private loadedMaxX = 0;
  /** A slab that was registered but hadn't finished loading its chunks yet, so
   *  we deferred adopting its extent. Filling barriers/corridor over unloaded
   *  chunks throws and permanently skips a segment's clearing (leaving an
   *  uncleared wall), so we wait for it to load before advancing loadedMaxX. */
  private pendingSlab: { id: string; toX: number } | undefined;
  /** True while an extend-the-play-area request is in flight. */
  private extendingArea = false;
  /** X of the temporary safety wall blocking the player at the built frontier. */
  private safetyWallX: number | undefined;
  private firstTick = true;
  /** Site picked by the scout; undefined until start() resolves. */
  private site!: ScoutedSite;
  private builder!: LevelBuilder;
  private playZ = 0;
  private groundY = 0;
  /** Highest surface height currently considered safe for the player. */
  private currentSafeGroundY = 0;
  private deathY = 0;
  private belowGroundTicks = 0;
  private originX = 0;
  private lastMilestone = 0;
  /** true = facing east (+X, right), false = facing west (-X, left) */
  private facingRight = true;
  /** Number of falls this run. */
  private falls = 0;
  /** Game mode the player was in before start(); restored on stop(). */
  private originalGameMode: GameMode | undefined;

  // ── Aim & Throw state ──
  /** Aim angle in degrees: 0 = right (3 o'clock), 90 = up (12), 180 = left (9). */
  private aimAngle = 0;
  /** Armor stand entity used as the aim reticle. */
  private reticleEntity: Entity | undefined;
  /** Ticks remaining before the player can throw again. */
  private throwCooldown = 0;
  /** Whether sneak was pressed last tick (for edge detection). */
  private wasSneaking = false;
  /** Active thrown projectiles being watched for rest/timeout. */
  private trackedProjectiles: {
    entity: Entity;
    itemId: string;
    age: number;
    restTicks: number;
  }[] = [];

  private static readonly TICKING_AREA_ID_PREFIX = "tossLab_slab_";
  /** Active play-area slabs, ordered left-to-right by `toX`. */
  private playAreas: { id: string; fromX: number; toX: number }[] = [];
  private nextSlabSeq = 0;
  /** Per-instance suffix to keep slab IDs unique across script reloads &
   *  back-to-back game starts. Without this, recreating a slab after a script
   *  reload throws "Identifier already exists" because ticking areas persist
   *  on the world. */
  private readonly slabIdSuffix = `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  /** Yaw for facing east — right side profile visible to camera at +Z. */
  private static readonly YAW_RIGHT = -90;
  /** Yaw for facing west — left side profile visible to camera at +Z. */
  private static readonly YAW_LEFT = 90;

  constructor(player: Player) {
    this.player = player;
    this.dimension = player.dimension;
  }

  /** Set up the level, camera, constraints, and start the game loop. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.firstTick = true;

    // Phase 1: scout candidate sites and pick the best one.
    this.player.sendMessage("§eScouting for a scenic level site...");
    this.site = await scoutBestSite(this.player);
    this.playZ = this.site.playZ;
    this.groundY = this.site.groundY;
    this.currentSafeGroundY = this.groundY;
    this.deathY = this.currentSafeGroundY - FALL_DEPTH;
    this.originX = this.site.originX;

    // Start each run at daytime so the opening view is always readable.
    try {
      this.dimension.runCommand("time set day");
    } catch {
      /* ignore — time control may be unavailable in some dimensions */
    }

    // Promote the winning site into a long-lived play ticking area covering
    // the prebuilt range; we'll grow it implicitly as new chunks are touched.
    await this.ensureChunksLoaded();

    // Phase 2: prebuild the streaming level ahead of the player.
    this.builder = new LevelBuilder(this.site);
    this.barrierFrontierMaxX = this.originX - MARGIN_X;
    this.lastClearedMinX = this.originX - MARGIN_X;
    this.lastClearedMaxX = this.originX - MARGIN_X;
    const initial = this.builder.ensureBuiltAhead(this.originX, INITIAL_PREBUILD_BLOCKS, this.loadedMaxX - MARGIN_X);
    for (const seg of initial) this.extendInfrastructureFor(seg);

    // Teleport the player to the start.
    this.teleportToStart();

    // Save current game mode and switch to Survival so the platformer feels right.
    try {
      this.originalGameMode = this.player.getGameMode();
      this.player.setGameMode(GameMode.Survival);
    } catch (e) {
      this.player.sendMessage(`§cCould not set survival mode: ${e}`);
    }

    // Pin the respawn point to the level start so a fatal hit doesn't send the
    // player back to world spawn outside the game.
    try {
      this.player.setSpawnPoint({
        x: Math.floor(this.originX + 3),
        y: Math.floor(this.groundY + 1),
        z: Math.floor(this.playZ),
        dimension: this.dimension,
      });
    } catch {
      /* setSpawnPoint may fail in some dimensions; not critical */
    }

    // Restrict input
    this.applyInputRestrictions();

    // Apply speed & jump boost
    this.applyEffects();

    // Spawn the aim reticle
    this.spawnReticle();

    // Give the player the throwable physics-puzzle objects
    this.giveProjectileItems();

    this.player.sendMessage("§aSide-scroller started! W = right, S = left, Space = jump.");
    this.player.sendMessage("§7A/D = aim, Shift = throw. Hotbar 1-5 picks projectile.");
    this.player.sendMessage("§7Run §f/scriptevent toss_lab:stop§7 to exit.");

    // Start tick loop
    this.tick();
  }

  /** Stop the game and restore normal controls. */
  stop(): void {
    this.running = false;

    try {
      this.player.camera.clear();
      this.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
      this.removeEffects();
      this.destroyReticle();

      // Restore the player's original game mode.
      if (this.originalGameMode !== undefined) {
        try {
          this.player.setGameMode(this.originalGameMode);
        } catch {
          /* ignore */
        }
      }

      // Remove all play-area slabs
      const mgr = world.tickingAreaManager;
      for (const a of this.playAreas) {
        try {
          if (mgr.hasTickingArea(a.id)) mgr.removeTickingArea(a.id);
        } catch {
          /* ignore */
        }
      }
      this.playAreas = [];
      this.pendingSlab = undefined;
    } catch {
      // Player may have disconnected
    }

    this.player.sendMessage("§eSide-scroller stopped.");
  }

  /** Called when the player respawns after death. */
  onRespawn(): void {
    if (!this.running) return;
    this.teleportToStart();
    this.applyInputRestrictions();
    this.applyEffects();
    this.giveProjectileItems();
    // Re-apply camera on first tick naturally via firstTick flag
    this.firstTick = true;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get playerId(): string {
    return this.player.id;
  }

  /** Register a thrown projectile entity so it gets converted back to an item later. */
  trackProjectile(entity: Entity, itemId: string): void {
    this.trackedProjectiles.push({ entity, itemId, age: 0, restTicks: 0 });
  }

  // ────────────────────────────── Private ──────────────────────────────

  private tick(): void {
    if (!this.running) return;

    try {
      if (!this.player.isValid) {
        this.running = false;
        return;
      }
    } catch {
      this.running = false;
      return;
    }

    // Fall check runs first and must not be swallowed
    try {
      this.refreshDeathThreshold();
      this.checkFall();
    } catch (e) {
      // Log but don't swallow — fall back to start
      this.player.teleport(
        { x: this.originX + 3.5, y: this.groundY + 1, z: this.playZ + 0.5 },
        { rotation: { x: 0, y: TossLabGame.YAW_RIGHT } }
      );
      this.firstTick = true;
    }

    try {
      this.updateAim();
      this.updateCamera();
      this.enforceConstraints();
      this.updateVisibility();
      this.checkMilestone();
    } catch {
      // Guard against transient errors (e.g., player in unloaded chunk)
    }

    // Streaming gets its own try/catch so failures are visible — if generation
    // silently dies, the player can't progress and has no idea why.
    try {
      this.updateStreaming();
    } catch (e) {
      this.player.sendMessage(`§cStreaming error: ${e}`);
    }

    try {
      this.builder.tickPuzzles(this.player.location);
    } catch {
      /* swallow puzzle errors */
    }

    // Reticle outside the try/catch so errors are visible
    try {
      this.updateReticle();
    } catch (e) {
      this.player.sendMessage(`§cReticle error: ${e}`);
    }

    try {
      this.updateProjectiles();
    } catch (e) {
      this.player.sendMessage(`§cProjectile update error: ${e}`);
    }

    this.runId = system.run(() => this.tick());
  }

  /** Position the camera south of the player, facing north at them. */
  private updateCamera(): void {
    const loc = this.player.location;

    // On the first tick after a (re)spawn the player's teleport may not have
    // applied yet, so player.location can still report the *old* position in a
    // far-away, unticked chunk. Placing the camera there triggers the engine's
    // "Placing the camera outside a loaded and ticking chunk" warning. Wait
    // until the player has actually arrived inside the loaded play area —
    // checking both axes, since the old Z alone can coincidentally match the
    // play plane while X is still far away.
    if (this.firstTick) {
      const insideX = loc.x >= this.originX - MARGIN_X && loc.x <= this.loadedMaxX;
      const insideZ = Math.abs(loc.z - (this.playZ + 0.5)) <= 1.5;
      if (!insideX || !insideZ) {
        return;
      }
    }

    const cameraPos = {
      x: loc.x,
      y: loc.y + CAMERA_Y_OFFSET,
      z: this.playZ + CAMERA_Z_OFFSET,
    };
    const facingPos = {
      x: loc.x,
      y: loc.y + CAMERA_Y_OFFSET * 0.5,
      z: this.playZ,
    };

    if (this.firstTick) {
      // Snap camera immediately on first tick
      this.player.camera.setCamera("minecraft:free", {
        location: cameraPos,
        facingLocation: facingPos,
      });
      this.firstTick = false;
    } else {
      // Smooth tracking with short ease
      this.player.camera.setCamera("minecraft:free", {
        location: cameraPos,
        facingLocation: facingPos,
        easeOptions: { easeTime: 0.15, easeType: EasingType.Linear },
      });
    }
  }

  /** Keep the player locked to the playing plane Z and facing the movement direction. */
  private enforceConstraints(): void {
    const loc = this.player.location;
    const vel = this.player.getVelocity();

    // Detect movement direction and flip facing (only from W/S velocity, not aim)
    if (vel.x > 0.01) {
      this.facingRight = true;
    } else if (vel.x < -0.01) {
      this.facingRight = false;
    }

    const desiredYaw = this.facingRight ? TossLabGame.YAW_RIGHT : TossLabGame.YAW_LEFT;
    const desiredPitch = this.getAimPitch();

    // Snap Z back if the player drifted. Target is the block center
    // (playZ + 0.5), not the integer edge — otherwise the player's bbox
    // overlaps the back barrier at playZ - 1.
    const targetZ = this.playZ + 0.5;
    if (Math.abs(loc.z - targetZ) > 0.15) {
      this.player.teleport(
        { x: loc.x, y: loc.y, z: targetZ },
        { keepVelocity: true, rotation: { x: desiredPitch, y: desiredYaw } }
      );
      return;
    }

    // setRotation controls both body yaw and head pitch
    this.player.setRotation({ x: desiredPitch, y: desiredYaw });
  }

  /** Incrementally clear blocks between camera and player as they move. */
  private updateVisibility(): void {
    const px = Math.floor(this.player.location.x);
    const desiredMin = px - CLEAR_WINDOW_HALF;
    const desiredMax = px + CLEAR_WINDOW_HALF;

    // Clear strips on the leading edges if the player has moved
    if (desiredMax > this.lastClearedMaxX) {
      this.clearStrip(this.lastClearedMaxX + 1, desiredMax);
      this.lastClearedMaxX = desiredMax;
    }
    if (desiredMin < this.lastClearedMinX) {
      this.clearStrip(desiredMin, this.lastClearedMinX - 1);
      this.lastClearedMinX = desiredMin;
    }
  }

  /** Print a milestone message every N blocks the player has actually walked forward. */
  private checkMilestone(): void {
    const distance = Math.floor(this.player.location.x - this.originX);
    const milestone = Math.floor(distance / MILESTONE_INTERVAL_BLOCKS);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      const seg = this.builder.totalSegments;
      this.player.sendMessage(`§a§lMilestone! §r§a${distance} blocks · ${seg} segments · Falls: §e${this.falls}`);
    }
  }

  /** Stream new segments + extend barriers and corridor as the player moves right. */
  private updateStreaming(): void {
    const playerX = this.player.location.x;

    // Always keep the loaded ticking area at least `2 * INITIAL_PREBUILD_BLOCKS`
    // ahead of the *built frontier* (not just the player) so even if the player
    // is stopped against the safety wall, generation continues to extend forward.
    const lookaheadTarget = Math.max(playerX, this.barrierFrontierMaxX) + INITIAL_PREBUILD_BLOCKS;
    if (!this.extendingArea && lookaheadTarget > this.loadedMaxX) {
      void this.extendPlayArea(lookaheadTarget + INITIAL_PREBUILD_BLOCKS);
    }

    // Build segments out to the loaded frontier (not just the player's lookahead),
    // so the safety wall can keep advancing while the player is stopped.
    const safeMaxX = this.loadedMaxX - MARGIN_X;
    const built = this.builder.ensureBuiltAhead(playerX, LOOKAHEAD_BLOCKS, safeMaxX);
    for (const seg of built) this.extendInfrastructureFor(seg);
  }

  /** Recreate the play ticking area to cover up to `targetMaxX` and await its load. */
  private async extendPlayArea(targetMaxX: number): Promise<void> {
    if (this.extendingArea) return;
    this.extendingArea = true;
    try {
      const mgr = world.tickingAreaManager;

      // If a previously-registered slab is still finishing its chunk load,
      // adopt its extent once it's ready rather than stacking another slab on
      // top. We only advance the build frontier (loadedMaxX) over chunks that
      // are actually loaded; building barriers/corridor over unloaded chunks
      // throws in fillBlocks and permanently skips a segment, leaving an
      // uncleared wall in front of the player.
      if (this.pendingSlab) {
        if (await waitForAreaLoaded(this.pendingSlab.id, 8000)) {
          this.loadedMaxX = Math.max(this.loadedMaxX, this.pendingSlab.toX);
          this.pendingSlab = undefined;
        }
        return;
      }

      const newMaxX = Math.max(this.loadedMaxX, Math.ceil(targetMaxX) + MARGIN_X);
      if (newMaxX <= this.loadedMaxX) return;

      // Prune BEFORE adding so we have capacity for the new slab.
      this.pruneSlabsBehind(this.player.location.x - PRUNE_BEHIND_BLOCKS);

      // Add a new slab that overlaps the previous one slightly so there is no gap.
      const fromX = Math.max(this.originX - MARGIN_X, this.loadedMaxX - 8);
      const id = `${TossLabGame.TICKING_AREA_ID_PREFIX}${this.slabIdSuffix}_${this.nextSlabSeq++}`;
      // Slab Z range must extend at least to the camera position, otherwise the
      // engine logs "Placing the camera outside a loaded and ticking chunk".
      // CLEAR_Z_BEHIND drives visibility clearing; the camera sits at
      // playZ + CAMERA_Z_OFFSET, so take the max of both (plus a small margin).
      const slabMaxZ = this.playZ + Math.max(CLEAR_Z_BEHIND, CAMERA_Z_OFFSET + 4);
      const options = {
        dimension: this.dimension,
        from: { x: fromX, y: this.groundY - 25, z: this.playZ - 5 },
        to: { x: newMaxX, y: this.groundY + 35, z: slabMaxZ },
      };

      // If the manager still doesn't have room, evict the oldest slabs (those
      // furthest behind the player) until it does. Always keep at least the two
      // most-recent slabs so the area around the player and frontier stays loaded.
      while (!mgr.hasCapacity(options) && this.playAreas.length > 2) {
        const victim = this.playAreas.shift();
        if (!victim) break;
        try {
          if (mgr.hasTickingArea(victim.id)) mgr.removeTickingArea(victim.id);
        } catch {
          /* ignore */
        }
      }

      await mgr.createTickingArea(id, options);
      this.playAreas.push({ id, fromX, toX: newMaxX });

      // Only advance the build frontier once the slab's chunks are actually
      // loaded. If it times out, defer: keep the slab (it will keep loading)
      // and adopt its extent on a later tick. Advancing loadedMaxX early would
      // let the builder fill barriers/corridor over unloaded chunks, which
      // throws and leaves an uncleared wall the player runs into.
      if (await waitForAreaLoaded(id, 8000)) {
        this.loadedMaxX = newMaxX;
      } else {
        this.pendingSlab = { id, toX: newMaxX };
      }
    } catch (e) {
      // Surface so we can see why generation may have stalled.
      try {
        this.player.sendMessage(`§cextendPlayArea failed: ${e}`);
      } catch {
        /* player may be gone */
      }
    } finally {
      this.extendingArea = false;
    }
  }

  /** Remove play-area slabs whose right edge is left of `minKeepX`. */
  private pruneSlabsBehind(minKeepX: number): void {
    const mgr = world.tickingAreaManager;
    this.playAreas = this.playAreas.filter((a) => {
      if (a.toX < minKeepX) {
        try {
          if (mgr.hasTickingArea(a.id)) mgr.removeTickingArea(a.id);
        } catch {
          /* ignore */
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Keep the fall-death threshold aligned with the surface directly under the
   * player, so random ramps and dips do not accumulate into a false death.
   * If there is no surface in the current column, preserve the last known safe
   * height so gaps still count as falls.
   */
  private refreshDeathThreshold(): void {
    const surfaceY = this.findSurfaceY(Math.floor(this.player.location.x), this.player.location.y);
    if (surfaceY === undefined) return;
    // Let the safe ground rise freely (player climbed up), but only descend
    // while the player is actually standing on the surface and isn't already
    // mid-fall. A fall starts slow (gravity accelerates), so if we keep
    // following the surface down every tick the death threshold "chases" the
    // falling player — it stays within FALL_DEPTH the whole way down and a real
    // pit never registers. Requiring the player to be grounded and still above
    // the threshold freezes deathY during a fall (so it counts) while still
    // tracking gentle ramps and small step-downs the player walks over.
    if (surfaceY >= this.currentSafeGroundY) {
      this.currentSafeGroundY = surfaceY;
    } else {
      let grounded = false;
      try {
        grounded = this.player.isOnGround;
      } catch {
        /* ignore — treat as airborne */
      }
      if (grounded && this.player.location.y > this.deathY) {
        const descent = Math.min(this.currentSafeGroundY - surfaceY, MAX_SAFE_DESCENT_PER_TICK);
        this.currentSafeGroundY -= descent;
      }
    }
    this.deathY = this.currentSafeGroundY - FALL_DEPTH;
  }

  /**
   * Find the walkable surface in the play plane at column `x`, scanning DOWN
   * from just above the player's feet (`fromY`). Starting at the player rather
   * than the sky is essential: trees at the play plane drape overhanging leaves
   * above the corridor (the corridor clear can't remove play-plane blocks
   * because puzzles live there), and a top-down scan would return that canopy
   * as the "ground" — inflating the death threshold so simply standing on the
   * real ground reads as a fall. Scanning from the feet down finds the block
   * the player is actually standing on and ignores anything above them.
   */
  private findSurfaceY(x: number, fromY: number): number | undefined {
    const scanTop = Math.min(Math.floor(fromY) + 1, this.site.groundY + 31);
    const scanBottom = this.site.groundY - 20;

    for (let y = scanTop; y >= scanBottom; y--) {
      try {
        const block = this.dimension.getBlock({ x, y, z: this.playZ });
        if (block && block.typeId !== "minecraft:air") {
          return y;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /** Detect if the player fell below the death threshold and respawn them. */
  private checkFall(): void {
    if (this.player.location.y > this.deathY) {
      this.belowGroundTicks = 0;
      return;
    }

    // Below threshold — require a grace period before counting it as a death,
    // so a brief dip the player can recover from doesn't kill them.
    this.belowGroundTicks++;
    if (this.belowGroundTicks < FALL_GRACE_TICKS) return;
    this.belowGroundTicks = 0;

    this.falls++;
    const fallX = Math.floor(this.player.location.x);
    let safe: { x: number; y: number };
    try {
      safe = this.findSafeGround(fallX);
    } catch {
      safe = { x: Math.max(fallX - 3, this.originX + 3), y: this.groundY };
    }
    this.player.teleport(
      { x: safe.x + 0.5, y: safe.y + 1, z: this.playZ + 0.5 },
      { rotation: { x: 0, y: TossLabGame.YAW_RIGHT } }
    );
    this.facingRight = true;
    this.currentSafeGroundY = safe.y;
    this.deathY = this.currentSafeGroundY - FALL_DEPTH;
    this.firstTick = true;
    this.applyEffects();
    this.giveProjectileItems();
    this.player.sendMessage(`§cYou fell! Falls: §e${this.falls}§c. Respawning...`);
  }

  /**
   * Find a safe respawn spot at or behind the given X. Scans leftward across
   * columns and, for each column, finds the topmost solid block within the
   * level's vertical bounds. Requires:
   *   - 2 blocks of air clearance above (no immediate suffocation), AND
   *   - the top is at/above the death threshold (no immediate re-death loop).
   * Returns the X and Y of the top solid block (caller teleports to y + 1).
   */
  private findSafeGround(startX: number): { x: number; y: number } {
    const baseY = this.site.groundY;
    // Level builder clamps terrain to [baseY - 20, baseY + 30].
    const scanTop = baseY + 31;
    // Don't accept respawn columns below the death threshold — they'd kill
    // the player again on the next grace window.
    const scanBottom = this.deathY + 1;
    const minX = Math.max(this.originX, startX - 32);

    for (let x = startX; x >= minX; x--) {
      for (let y = scanTop; y >= scanBottom; y--) {
        const block = this.dimension.getBlock({ x, y, z: this.playZ });
        if (!block || block.typeId === "minecraft:air" || this.isFoliage(block.typeId)) continue;
        // Found a solid block. Confirm 2-block air clearance above for the player.
        const above1 = this.dimension.getBlock({ x, y: y + 1, z: this.playZ });
        const above2 = this.dimension.getBlock({ x, y: y + 2, z: this.playZ });
        if (above1 && above1.typeId === "minecraft:air" && above2 && above2.typeId === "minecraft:air") {
          return { x, y };
        }
        // Solid here but no headroom — try the next column.
        break;
      }
    }
    // Fallback: start of run, at base ground (always above deathY).
    return { x: this.originX + 3, y: baseY };
  }

  /**
   * True for tree canopy / trunk / vegetation blocks that line the play plane.
   * These must never be treated as walkable ground, or the player respawns
   * stranded on top of a tree after a fall.
   */
  private isFoliage(typeId: string): boolean {
    return (
      typeId.endsWith("_leaves") ||
      typeId.endsWith("_log") ||
      typeId.endsWith("_wood") ||
      typeId.endsWith("_stem") ||
      typeId.endsWith("_hyphae") ||
      typeId.endsWith("_sapling") ||
      typeId === "minecraft:leaves" ||
      typeId === "minecraft:leaves2" ||
      typeId === "minecraft:log" ||
      typeId === "minecraft:log2" ||
      typeId === "minecraft:vine" ||
      typeId === "minecraft:bamboo"
    );
  }

  // ────────────────────────── Aim & Throw ────────────────────────────

  /** Read A/D input and adjust the aim angle. */
  private updateAim(): void {
    const moveVec = this.player.inputInfo.getMovementVector();
    const lateral = moveVec.x;
    if (lateral < -0.1) {
      this.aimAngle = Math.max(0, this.aimAngle - AIM_SPEED);
    } else if (lateral > 0.1) {
      this.aimAngle = Math.min(180, this.aimAngle + AIM_SPEED);
    }

    // Show aim angle and selected projectile on action bar, with the active
    // puzzle hint (if any) appended on a second line.
    const def = this.getSelectedProjectile();
    const hint = getActiveHint();
    const base = `§e${def.label}§r  Aim: ${this.aimAngle.toFixed(0)}°`;
    this.player.onScreenDisplay.setActionBar(hint ? `${base}\n${hint}` : base);

    if (this.throwCooldown > 0) {
      this.throwCooldown--;
    }
  }

  /**
   * Convert aim angle to player head pitch.
   * When facingRight: aim 0° (right) = pitch 0, aim 90° (up) = pitch -90.
   * When facingLeft: aim 180° (left) = pitch 0, aim 90° (up) = pitch -90.
   */
  private getAimPitch(): number {
    // How far the aim is from "straight ahead" in the current facing direction
    // facingRight: 0° = ahead, so offset = aimAngle
    // facingLeft: 180° = ahead, so offset = 180 - aimAngle
    const offset = this.facingRight ? this.aimAngle : 180 - this.aimAngle;
    // Clamp to [0, 90] — past 90° is "behind" the player, we cap at straight up
    const clampedOffset = Math.min(offset, 90);
    // Minecraft pitch: negative = look up
    return -clampedOffset;
  }

  /** Compute the aim direction as a world-space unit vector. */
  public getAimDirection(): { x: number; y: number; z: number } {
    const aimRad = (this.aimAngle * Math.PI) / 180;
    return {
      x: Math.cos(aimRad), // positive = right (+X)
      y: Math.sin(aimRad), // positive = up (+Y)
      z: 0,
    };
  }

  /** Spawn the aim reticle (clean up any leftover entities). */
  private spawnReticle(): void {
    this.destroyReticle();
    // Kill any leftover armor stands from previous runs
    try {
      const entities = this.dimension.getEntities({ type: "minecraft:armor_stand" });
      for (const e of entities) {
        e.kill();
      }
    } catch {
      // Ignore errors
    }
  }

  /** Show the aim reticle as particles at the current aim position. */
  private updateReticle(): void {
    const head = this.player.getHeadLocation();
    const dir = this.getAimDirection();
    const cx = head.x + dir.x * RETICLE_DISTANCE;
    const cy = head.y + dir.y * RETICLE_DISTANCE;

    // Crosshair offsets: center + 4 arms of a "+" shape.
    const r = 0.35;
    const offsets: Array<[number, number]> = [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ];

    try {
      for (const [dx, dy] of offsets) {
        this.dimension.runCommand(
          `particle tossLab:aim_reticle ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} ${this.playZ.toFixed(2)}`
        );
      }
      return;
    } catch {
      // Custom particle not available
    }

    // Fallback: vanilla heart particle
    this.dimension.runCommand(
      `particle minecraft:heart_particle ${cx.toFixed(2)} ${cy.toFixed(2)} ${this.playZ.toFixed(2)}`
    );
  }

  /** Clean up reticle (no-op — particles are fire-and-forget). */
  private destroyReticle(): void {
    // Kill any leftover armor stand from a previous version
    try {
      if (this.reticleEntity?.isValid) {
        this.reticleEntity.kill();
      }
    } catch {
      // Entity may already be gone
    }
    this.reticleEntity = undefined;
  }

  /** Throw the currently-selected projectile in the aim direction. */
  private tryThrow(): void {
    const sneaking = this.player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;

    // Only throw on the rising edge (press, not hold)
    if (sneaking && !this.wasSneaking && this.throwCooldown <= 0) {
      const def = this.getSelectedProjectile();
      const head = this.player.getHeadLocation();
      const dir = this.getAimDirection();
      const spawnPos = {
        x: head.x + dir.x * 1.5,
        y: head.y + dir.y * 1.5,
        z: this.playZ,
      };

      const force = THROW_FORCE * def.forceMultiplier;
      const projectile = this.dimension.spawnEntity(def.entityId, spawnPos);
      projectile.applyImpulse({
        x: dir.x * force,
        y: dir.y * force,
        z: 0,
      });

      this.trackedProjectiles.push({
        entity: projectile,
        itemId: def.itemId,
        age: 0,
        restTicks: 0,
      });

      this.throwCooldown = THROW_COOLDOWN;
    }

    this.wasSneaking = sneaking;
  }

  /**
   * Per-tick maintenance for thrown projectiles: convert them back to a
   * dropped item once they come to rest or outlive their max lifetime.
   */
  private updateProjectiles(): void {
    const remaining: typeof this.trackedProjectiles = [];

    for (const tp of this.trackedProjectiles) {
      let valid = false;
      try {
        valid = tp.entity.isValid;
      } catch {
        valid = false;
      }
      if (!valid) continue;

      tp.age++;

      // ── Per-type passive effects while in flight ──
      // Ice disc: leave a trail of packed_ice one block below the disc as it
      // flies, so a disc skimmed across a gap freezes a walkable bridge in its
      // wake. Runs every tick so the trail is continuous, not just at the
      // landing point (the iceSlideBridge puzzle's flight-path tracking is a
      // bonus on top of this generic behavior).
      if (tp.itemId === "toss_lab:ice_disc") {
        try {
          this.layIceTrail(tp.entity);
        } catch {
          /* ignore — block may be in an unloaded chunk */
        }
      }

      // Heavy stone: detonate any TNT block it strikes, the instant it makes
      // contact. Unlike the other projectiles' rest-based puzzle hooks, the
      // blast fires on impact so the player gets immediate feedback. The
      // detonation is a safe, non-destructive scripted blast (see
      // detonateTntNear) — it clears TNT + plays effects, but never damages
      // the player or surrounding terrain.
      if (tp.itemId === "toss_lab:heavy_stone") {
        let loc;
        try {
          loc = tp.entity.location;
        } catch {
          continue;
        }
        if (this.detonateTntNear(loc)) {
          try {
            tp.entity.kill();
          } catch {
            /* ignore */
          }
          try {
            this.dimension.spawnItem(new ItemStack(tp.itemId, 1), loc);
          } catch {
            /* ignore */
          }
          continue;
        }
      }

      // Cotton puff: light as silk — the instant it drifts up against a solid
      // block on its left, it catches and sets into a bridge block. This is
      // what makes the cotton_bridge puzzle solvable: the puff used to need a
      // full 5s rest, but it falls straight through the open gap and never
      // rests, so it never converted. Now the player strings a bridge one puff
      // at a time, building rightward from the left solid edge.
      if (tp.itemId === "toss_lab:cotton_puff") {
        let loc;
        try {
          loc = tp.entity.location;
        } catch {
          continue;
        }
        if (tp.age > 2 && this.placeCottonStrandAt(loc)) {
          try {
            tp.entity.kill();
          } catch {
            /* ignore */
          }
          // Consumed into the bridge — no item drop.
          continue;
        }
      }

      let atRest = false;
      let speed = Infinity;
      try {
        const v = tp.entity.getVelocity();
        speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (speed < PROJECTILE_REST_VELOCITY) {
          tp.restTicks++;
          if (tp.restTicks >= PROJECTILE_REST_TICKS) atRest = true;
        } else {
          tp.restTicks = 0;
        }
      } catch {
        // If velocity is unavailable, fall back to age-only logic.
      }

      // Sticky glob: sticks ONLY when it smacks into a block on its right (+X,
      // the direction the player throws). This makes it a deliberate tool — you
      // have to splat it against a wall to build a step — instead of it setting
      // in mid-air the moment it slows at the top of its arc.
      if (tp.itemId === "toss_lab:sticky_glob") {
        if (tp.age > 2) {
          let loc;
          try {
            loc = tp.entity.location;
          } catch {
            continue;
          }
          if (this.stickSlimeToWall(loc)) {
            try {
              tp.entity.remove();
            } catch {
              /* ignore */
            }
            // No item drop — the glob is consumed into the slime block.
            continue;
          }
        }
      }

      const expired = tp.age >= PROJECTILE_MAX_LIFETIME_TICKS;

      if (atRest || expired) {
        let loc;
        try {
          loc = tp.entity.location;
        } catch {
          continue;
        }
        // Notify puzzles BEFORE killing the entity so they can react to the resting projectile.
        if (atRest) {
          try {
            this.builder.onProjectileRest(tp.itemId, loc);
          } catch {
            /* swallow */
          }
        }
        try {
          tp.entity.kill();
        } catch {
          /* ignore */
        }
        try {
          this.dimension.spawnItem(new ItemStack(tp.itemId, 1), loc);
        } catch {
          /* ignore */
        }
        continue;
      }

      remaining.push(tp);
    }

    this.trackedProjectiles = remaining;
  }

  /**
   * Freeze the cell directly below an in-flight ice disc into packed_ice.
   * Called every tick the disc is alive. Only fires when the disc is in the
   * play corridor and the cell below is currently air, so the disc both:
   *   - leaves a visible trail along its flight path, and
   *   - never tries to replace existing terrain (or its own freshly-placed ice).
   * The block below the disc (not the disc's own cell) is targeted so the
   * disc doesn't immediately collide with the ice it just spawned.
   */
  private layIceTrail(entity: Entity): void {
    let loc;
    try {
      loc = entity.location;
    } catch {
      return;
    }
    // Stay strictly inside the play plane — placing on z = playZ ± 1 would
    // collide with the back/front barrier walls.
    if (Math.floor(loc.z) !== Math.floor(this.playZ)) return;
    const bx = Math.floor(loc.x);
    const by = Math.floor(loc.y) - 1;
    const bz = Math.floor(loc.z);
    const block = this.dimension.getBlock({ x: bx, y: by, z: bz });
    if (!block || block.typeId !== "minecraft:air") return;
    block.setPermutation(BlockPermutation.resolve("minecraft:packed_ice"));
  }

  /**
   * If a cotton puff has drifted up against a solid block on its left, set its
   * own (air) cell to a white_wool "strand" the player can walk on, and return
   * true so the caller can despawn the puff. Requiring a solid block on the
   * left means strands only form chained out from a platform edge (or an
   * already-placed strand) — never floating in open space — so the player
   * bridges a gap one puff at a time, building rightward. A solid block is used
   * rather than a cobweb because a cobweb over an open gap would let the player
   * sink through and fall.
   */
  private placeCottonStrandAt(loc: { x: number; y: number; z: number }): boolean {
    if (Math.floor(loc.z) !== Math.floor(this.playZ)) return false;
    const bx = Math.floor(loc.x);
    const by = Math.floor(loc.y);
    const bz = Math.floor(loc.z);

    let cell;
    try {
      cell = this.dimension.getBlock({ x: bx, y: by, z: bz });
    } catch {
      return false;
    }
    if (!cell || cell.typeId !== "minecraft:air") return false;

    const isSolid = (x: number): boolean => {
      try {
        const b = this.dimension.getBlock({ x, y: by, z: bz });
        return !!b && b.typeId !== "minecraft:air";
      } catch {
        return false;
      }
    };
    if (!isSolid(bx - 1)) return false;

    try {
      cell.setPermutation(BlockPermutation.resolve("minecraft:white_wool"));
      this.dimension.runCommand(`playsound block.wool.place @a ${bx} ${by} ${bz}`);
    } catch {
      return false;
    }
    return true;
  }

  /**
   * If a heavy stone is touching one or more `minecraft:tnt` blocks, detonate
   * them with a safe, non-destructive scripted blast: the TNT is cleared, an
   * explosion sound + particle play, and any puzzle covering that X is
   * notified so it can react (e.g. clear a blast wall). Returns true when at
   * least one TNT block was detonated, so the caller can despawn the stone.
   */
  private detonateTntNear(loc: { x: number; y: number; z: number }): boolean {
    const cx = Math.floor(loc.x);
    const cy = Math.floor(loc.y);
    const cz = Math.floor(loc.z);

    // Find a TNT block adjacent to the stone (3x3 on the play plane).
    let hit: { x: number; y: number; z: number } | undefined;
    for (let dx = -1; dx <= 1 && !hit; dx++) {
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const pos = { x: cx + dx, y: cy + dy, z: cz };
        let block;
        try {
          block = this.dimension.getBlock(pos);
        } catch {
          continue;
        }
        if (block && block.typeId === "minecraft:tnt") hit = pos;
      }
    }
    if (!hit) return false;

    this.clearTntCluster(hit);

    try {
      this.dimension.runCommand(`playsound random.explode @a ${hit.x} ${hit.y} ${hit.z}`);
    } catch {
      /* ignore — sound is cosmetic */
    }
    try {
      this.dimension.spawnParticle("minecraft:huge_explosion_emitter", {
        x: hit.x + 0.5,
        y: hit.y + 0.5,
        z: hit.z + 0.5,
      });
    } catch {
      /* ignore */
    }

    // Let any puzzle covering this X react (e.g. clear its blast wall).
    try {
      this.builder.onProjectileImpact("toss_lab:heavy_stone", { x: hit.x, y: hit.y, z: hit.z });
    } catch {
      /* swallow puzzle bugs */
    }

    return true;
  }

  /**
   * Replace every `minecraft:tnt` block in a small box around `center` with
   * air. Bounded scan (never a true flood-fill) so a chain reaction can't tear
   * up the level; the box is tall enough to swallow the 3-tall beacon column
   * and the single puzzle TNT, both of which sit on the play plane.
   */
  private clearTntCluster(center: { x: number; y: number; z: number }): void {
    const air = BlockPermutation.resolve("minecraft:air");
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 4; dy++) {
        const pos = { x: center.x + dx, y: center.y + dy, z: center.z };
        let block;
        try {
          block = this.dimension.getBlock(pos);
        } catch {
          continue;
        }
        if (block && block.typeId === "minecraft:tnt") {
          try {
            block.setPermutation(air);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  /**
   * Stick a sticky glob to a wall on its right. If the cell immediately to the
   * glob's right (+X, the direction the player throws) is solid, set the glob's
   * own (air) cell to a slime block and return true so the caller can despawn
   * it. Returns false when there's no wall on the right, so a glob lobbed into
   * open space never sets — the player has to splat it against a wall to build
   * a step.
   */
  private stickSlimeToWall(loc: { x: number; y: number; z: number }): boolean {
    if (Math.floor(loc.z) !== Math.floor(this.playZ)) return false;
    const bx = Math.floor(loc.x);
    const by = Math.floor(loc.y);
    const bz = Math.floor(loc.z);
    try {
      // Require a solid block immediately to the right (+X).
      const right = this.dimension.getBlock({ x: bx + 1, y: by, z: bz });
      if (!right || right.typeId === "minecraft:air") return false;
      // Only fill the glob's own cell, and only if it's empty.
      const cell = this.dimension.getBlock({ x: bx, y: by, z: bz });
      if (!cell || cell.typeId !== "minecraft:air") return false;
      cell.setPermutation(BlockPermutation.resolve("minecraft:slime"));
      try {
        this.dimension.runCommand(`playsound mob.slime.big @a ${bx} ${by} ${bz}`);
      } catch {
        /* ignore — sound is cosmetic */
      }
      return true;
    } catch {
      return false;
    }
  }
  private getSelectedProjectile(): ProjectileDef {
    const slot = this.player.selectedSlotIndex;
    if (slot >= 0 && slot < PROJECTILES.length) {
      return PROJECTILES[slot];
    }
    return PROJECTILES[0];
  }

  /** Place one stack of each projectile item in the player's hotbar. */
  private giveProjectileItems(): void {
    try {
      const inv = this.player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
      const container = inv?.container;
      if (!container) return;
      for (let i = 0; i < PROJECTILES.length; i++) {
        const def = PROJECTILES[i];
        try {
          container.setItem(i, new ItemStack(def.itemId, 64));
        } catch (e) {
          this.player.sendMessage(`§cCould not give ${def.label}: ${e}`);
        }
      }
    } catch (e) {
      this.player.sendMessage(`§cInventory error: ${e}`);
    }
  }

  // ────────────────────────── Setup helpers ────────────────────────────

  /** Create the initial play ticking area slab covering the prebuilt level. */
  private async ensureChunksLoaded(): Promise<void> {
    const mgr = world.tickingAreaManager;
    const initialMaxX = this.originX + INITIAL_PREBUILD_BLOCKS + MARGIN_X;
    const fromX = this.originX - MARGIN_X;
    const id = `${TossLabGame.TICKING_AREA_ID_PREFIX}${this.slabIdSuffix}_${this.nextSlabSeq++}`;
    const slabMaxZ = this.playZ + Math.max(CLEAR_Z_BEHIND, CAMERA_Z_OFFSET + 4);
    await mgr.createTickingArea(id, {
      dimension: this.dimension,
      from: { x: fromX, y: this.groundY - 25, z: this.playZ - 5 },
      to: { x: initialMaxX, y: this.groundY + 35, z: slabMaxZ },
    });
    // Wait until the slab's chunks are actually loaded before we build into
    // them. Proceeding early makes the barrier/corridor fills throw on unloaded
    // chunks (leaving an uncleared wall) and trips the engine's "camera outside
    // a loaded and ticking chunk" warning on the first camera placement. Far
    // scouted sites stream in slowly, so retry the wait a few times.
    let loaded = false;
    for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
      loaded = await waitForAreaLoaded(id, 10000);
    }
    if (!loaded) {
      this.player.sendMessage("§eLevel area is still loading; the start may take a moment to appear.");
    }
    this.playAreas.push({ id, fromX, toX: initialMaxX });
    this.loadedMaxX = initialMaxX;
  }

  private teleportToStart(): void {
    this.facingRight = true;
    this.currentSafeGroundY = this.groundY;
    this.deathY = this.currentSafeGroundY - FALL_DEPTH;
    // Center the player in the play column: integer Z is the edge between
    // blocks, which would clip the player's 0.6-wide bbox into the back
    // barrier at playZ - 1. playZ + 0.5 puts them at the block center.
    this.player.teleport(
      { x: this.originX + 3.5, y: this.groundY + 1, z: this.playZ + 0.5 },
      { rotation: { x: 0, y: TossLabGame.YAW_RIGHT } }
    );
  }

  private applyInputRestrictions(): void {
    this.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
  }

  /** Apply speed and jump boost effects for toss lab gameplay. */
  private applyEffects(): void {
    // Duration in ticks: 20 ticks/sec * 999999 = effectively permanent
    const duration = 20000000;
    // Speed II (amplifier 1) — noticeably faster
    this.player.addEffect("minecraft:speed", duration, {
      amplifier: 1,
      showParticles: false,
    });
    // Jump Boost II (amplifier 1) — roughly 2x jump height
    this.player.addEffect("minecraft:jump_boost", duration, {
      amplifier: 1,
      showParticles: false,
    });
    // Resistance V (amplifier 4) — absorbs fall damage so a deep gap is a
    // "reset" via checkFall(), not a real death that sends the player to
    // world spawn outside the game.
    this.player.addEffect("minecraft:resistance", duration, {
      amplifier: 4,
      showParticles: false,
    });
  }

  /** Remove toss lab effects. */
  private removeEffects(): void {
    try {
      this.player.removeEffect("minecraft:speed");
      this.player.removeEffect("minecraft:jump_boost");
      this.player.removeEffect("minecraft:resistance");
    } catch {
      // Player may have disconnected
    }
  }

  /** Extend barriers and the visibility corridor over a newly built segment. */
  private extendInfrastructureFor(seg: SegmentBuilt): void {
    const xMin = Math.max(seg.xStart, this.barrierFrontierMaxX + 1);
    const xMax = seg.xEnd + MARGIN_X;
    if (xMax <= xMin) return;
    this.placeBarrierRange(xMin, xMax);
    this.clearCorridorRange(xMin, xMax);
    this.barrierFrontierMaxX = xMax;
    this.moveSafetyWallTo(seg.xEnd + 1);
  }

  /**
   * Maintain a single column of barrier blocks at the right edge of the built
   * frontier so the player can't run into ungenerated chunks while the play
   * area is being extended asynchronously.
   */
  private moveSafetyWallTo(newX: number): void {
    if (this.safetyWallX === newX) return;
    const air = BlockPermutation.resolve("minecraft:air");
    const barrier = BlockPermutation.resolve("minecraft:barrier");
    const yMin = this.groundY - 20 - BARRIER_DEPTH;
    const yMax = this.groundY + BARRIER_HEIGHT;
    try {
      if (this.safetyWallX !== undefined) {
        this.dimension.fillBlocks(
          new BlockVolume(
            { x: this.safetyWallX, y: yMin, z: this.playZ },
            { x: this.safetyWallX, y: yMax, z: this.playZ }
          ),
          air
        );
      }
      this.dimension.fillBlocks(
        new BlockVolume({ x: newX, y: yMin, z: this.playZ }, { x: newX, y: yMax, z: this.playZ }),
        barrier
      );
      this.safetyWallX = newX;
    } catch {
      /* unloaded — will retry next segment */
    }
  }

  /** Place barrier walls at playZ ± 1 across an X range. The band spans the
   *  whole height the lane can reach — the level builder clamps the ground to
   *  20 blocks below the site start, so the barriers must reach below that or a
   *  descended section leaves visible natural terrain at playZ + 1, occluding
   *  the player from the camera. Bounds stay inside the loaded slab
   *  (groundY - 25 .. groundY + 35). */
  private placeBarrierRange(xMin: number, xMax: number): void {
    const barrier = BlockPermutation.resolve("minecraft:barrier");
    const yMin = this.groundY - 20 - BARRIER_DEPTH;
    const yMax = this.groundY + BARRIER_HEIGHT;
    this.chunkedFill({ x: xMin, y: yMin, z: this.playZ - 1 }, { x: xMax, y: yMax, z: this.playZ - 1 }, barrier);
    this.chunkedFill({ x: xMin, y: yMin, z: this.playZ + 1 }, { x: xMax, y: yMax, z: this.playZ + 1 }, barrier);
  }

  /** Clear the visibility corridor across an X range. The vertical window
   *  follows the built lane height at each column (from the level builder's
   *  recorded profile), so the corridor stays clear even where the level has
   *  descended far from the site's starting height. A fixed window anchored at
   *  the original groundY left foreground terrain occluding the camera once the
   *  level dropped more than BARRIER_DEPTH blocks; scanning the play plane was
   *  also unreliable, since natural terrain can sit above a descended lane. */
  private clearCorridorRange(xMin: number, xMax: number): void {
    const air = BlockPermutation.resolve("minecraft:air");
    for (let x = xMin; x <= xMax; x++) {
      const groundAtX = this.builder.groundYAt(x);
      this.chunkedFill(
        { x, y: groundAtX - BARRIER_DEPTH, z: this.playZ + 2 },
        { x, y: groundAtX + CLEAR_HEIGHT, z: this.playZ + CLEAR_Z_BEHIND },
        air
      );
    }
  }

  /** Clear a strip of blocks in the visibility corridor (legacy). */
  private clearStrip(xMin: number, xMax: number): void {
    this.clearCorridorRange(xMin, xMax);
  }

  private static readonly MAX_FILL = 32768;

  /** Split a fillBlocks call along the X axis so each chunk is ≤ MAX_FILL blocks. */
  private chunkedFill(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    block: BlockPermutation
  ): void {
    const yLen = Math.abs(to.y - from.y) + 1;
    const zLen = Math.abs(to.z - from.z) + 1;
    const sliceArea = yLen * zLen;
    // How many X-columns fit in one fill call
    const xStep = Math.max(1, Math.floor(TossLabGame.MAX_FILL / sliceArea));

    const xMin = Math.min(from.x, to.x);
    const xMax = Math.max(from.x, to.x);

    for (let x = xMin; x <= xMax; x += xStep) {
      const xEnd = Math.min(x + xStep - 1, xMax);
      this.dimension.fillBlocks(new BlockVolume({ x, y: from.y, z: from.z }, { x: xEnd, y: to.y, z: to.z }), block);
    }
  }
}
