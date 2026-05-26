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
  system,
  world,
} from "@minecraft/server";
import {
  CAMERA_Z_OFFSET,
  CAMERA_Y_OFFSET,
  FALL_DEPTH,
  FALL_GRACE_TICKS,
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
  MILESTONE_INTERVAL_SEGMENTS,
} from "./config";
import { scoutBestSite, ScoutedSite, waitForAreaLoaded } from "./levelScout";
import { LevelBuilder, SegmentBuilt } from "./levelBuilder";

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
  private deathY = 0;
  private belowGroundTicks = 0;
  private originX = 0;
  private lastMilestone = 0;
  /** true = facing east (+X, right), false = facing west (-X, left) */
  private facingRight = true;
  /** Number of deaths (falls) this run. */
  private deaths = 0;

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
    this.deathY = this.groundY - FALL_DEPTH;
    this.originX = this.site.originX;

    // Promote the winning site into a long-lived play ticking area covering
    // the prebuilt range; we'll grow it implicitly as new chunks are touched.
    await this.ensureChunksLoaded();

    // Phase 2: prebuild the streaming level ahead of the player.
    this.player.sendMessage(`§eBuilding ${this.site.theme} level...`);
    this.builder = new LevelBuilder(this.site);
    this.barrierFrontierMaxX = this.originX - MARGIN_X;
    this.lastClearedMinX = this.originX - MARGIN_X;
    this.lastClearedMaxX = this.originX - MARGIN_X;
    const initial = this.builder.ensureBuiltAhead(this.originX, INITIAL_PREBUILD_BLOCKS, this.loadedMaxX - MARGIN_X);
    for (const seg of initial) this.extendInfrastructureFor(seg);

    // Teleport the player to the start.
    this.teleportToStart();

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
    this.player.sendMessage("§7Run §f/scriptevent tossLab:stop§7 to exit.");

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
      this.checkFall();
    } catch (e) {
      // Log but don't swallow — fall back to start
      this.player.teleport(
        { x: this.originX + 3, y: this.groundY + 1, z: this.playZ },
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

    // On first tick, the player's teleport may not have applied yet — skip
    // until they've actually arrived at the play plane to avoid the engine's
    // "Placing the camera outside a loaded and ticking chunk" warning.
    if (this.firstTick && Math.abs(loc.z - this.playZ) > 1) {
      return;
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

    // Snap Z back if the player drifted
    if (Math.abs(loc.z - this.playZ) > 0.15) {
      this.player.teleport(
        { x: loc.x, y: loc.y, z: this.playZ },
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

  /** Print a milestone message every N segments. */
  private checkMilestone(): void {
    const seg = this.builder.totalSegments;
    const milestone = Math.floor(seg / MILESTONE_INTERVAL_SEGMENTS);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      const distance = Math.floor(this.player.location.x - this.originX);
      this.player.sendMessage(`§a§lMilestone! §r§a${distance} blocks · ${seg} segments · Deaths: §e${this.deaths}`);
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
      const newMaxX = Math.max(this.loadedMaxX, Math.ceil(targetMaxX) + MARGIN_X);
      if (newMaxX <= this.loadedMaxX) return;

      // Prune BEFORE adding so we have capacity for the new slab.
      this.pruneSlabsBehind(this.player.location.x - PRUNE_BEHIND_BLOCKS);

      // Add a new slab that overlaps the previous one slightly so there is no gap.
      const fromX = Math.max(this.originX - MARGIN_X, this.loadedMaxX - 8);
      const id = TossLabGame.TICKING_AREA_ID_PREFIX + this.nextSlabSeq++;
      const options = {
        dimension: this.dimension,
        from: { x: fromX, y: this.groundY - 25, z: this.playZ - 5 },
        to: { x: newMaxX, y: this.groundY + 35, z: this.playZ + CLEAR_Z_BEHIND },
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
      await waitForAreaLoaded(id, 8000);
      this.playAreas.push({ id, fromX, toX: newMaxX });
      this.loadedMaxX = newMaxX;
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

    this.deaths++;
    const fallX = Math.floor(this.player.location.x);
    let safe: { x: number; y: number };
    try {
      safe = this.findSafeGround(fallX);
    } catch {
      safe = { x: Math.max(fallX - 3, this.originX + 3), y: this.groundY };
    }
    this.player.teleport(
      { x: safe.x + 0.5, y: safe.y + 1, z: this.playZ },
      { rotation: { x: 0, y: TossLabGame.YAW_RIGHT } }
    );
    this.facingRight = true;
    this.firstTick = true;
    this.applyEffects();
    this.giveProjectileItems();
    this.player.sendMessage(`§cYou fell! Deaths: §e${this.deaths}§c. Respawning...`);
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
        if (!block || block.typeId === "minecraft:air") continue;
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

    // Show aim angle and selected projectile on action bar
    const def = this.getSelectedProjectile();
    this.player.onScreenDisplay.setActionBar(`§e${def.label}§r  Aim: ${this.aimAngle.toFixed(0)}°`);

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

      let atRest = false;
      try {
        const v = tp.entity.getVelocity();
        const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (speed < PROJECTILE_REST_VELOCITY) {
          tp.restTicks++;
          if (tp.restTicks >= PROJECTILE_REST_TICKS) atRest = true;
        } else {
          tp.restTicks = 0;
        }
      } catch {
        // If velocity is unavailable, fall back to age-only logic.
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
    const id = TossLabGame.TICKING_AREA_ID_PREFIX + this.nextSlabSeq++;
    await mgr.createTickingArea(id, {
      dimension: this.dimension,
      from: { x: fromX, y: this.groundY - 25, z: this.playZ - 5 },
      to: { x: initialMaxX, y: this.groundY + 35, z: this.playZ + CLEAR_Z_BEHIND },
    });
    await waitForAreaLoaded(id, 10000);
    this.playAreas.push({ id, fromX, toX: initialMaxX });
    this.loadedMaxX = initialMaxX;
  }

  private teleportToStart(): void {
    this.facingRight = true;
    this.player.teleport(
      { x: this.originX + 3, y: this.groundY + 1, z: this.playZ },
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
  }

  /** Remove toss lab effects. */
  private removeEffects(): void {
    try {
      this.player.removeEffect("minecraft:speed");
      this.player.removeEffect("minecraft:jump_boost");
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
    const yMin = this.groundY - BARRIER_DEPTH;
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

  /** Place barrier walls at playZ ± 1 across an X range. */
  private placeBarrierRange(xMin: number, xMax: number): void {
    const barrier = BlockPermutation.resolve("minecraft:barrier");
    const yMin = this.groundY - BARRIER_DEPTH;
    const yMax = this.groundY + BARRIER_HEIGHT;
    this.chunkedFill({ x: xMin, y: yMin, z: this.playZ - 1 }, { x: xMax, y: yMax, z: this.playZ - 1 }, barrier);
    this.chunkedFill({ x: xMin, y: yMin, z: this.playZ + 1 }, { x: xMax, y: yMax, z: this.playZ + 1 }, barrier);
  }

  /** Clear the visibility corridor across an X range. */
  private clearCorridorRange(xMin: number, xMax: number): void {
    const air = BlockPermutation.resolve("minecraft:air");
    this.chunkedFill(
      { x: xMin, y: this.groundY - BARRIER_DEPTH, z: this.playZ + 2 },
      { x: xMax, y: this.groundY + CLEAR_HEIGHT, z: this.playZ + CLEAR_Z_BEHIND },
      air
    );
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
