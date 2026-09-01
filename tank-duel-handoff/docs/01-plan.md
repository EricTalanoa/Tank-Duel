# Tank Duel — Full Plan

2D side-view, 1v1, turn-based artillery. Angle + power aiming, multiple shell types, destructible terrain.

---

## 1. Engine verdict

**Don't use Unity. Use TypeScript + HTML5 Canvas.**

Five reasons specific to *this* game:

1. **The core tech is a destructible pixel terrain mask.** Unity has no built-in support for this. You'd end up writing the exact same `Uint8Array` bitmask + texture blit you'd write on Canvas — except you'd also be fighting Unity's sprite/collider pipeline to keep it in sync.
2. **You do not want a physics engine.** Artillery feel comes from a hand-tuned integrator: gravity, wind, drag, substepping. Box2D/Unity physics fights you the moment you want a shell that arcs "wrong" on purpose because it feels better.
3. **Iteration speed decides this genre.** This game is 90% tuning numbers. Save → refresh is under a second on Vite. Unity's domain reload is 5–20s. That difference compounds into hundreds of hours.
4. **Distribution.** A hotseat 1v1 game is a URL you text someone. Unity WebGL builds are 5–15 MB with a loading bar. You already deploy to Vercel.
5. **Toolchain fit.** VS Code + Claude Code + GitHub is your setup. Unity buries logic in scene/prefab YAML that diffs terribly and that Claude Code can't reason about well.

**When Unity would actually be right:** 3D, heavy animation state machines, console ports, or a team with artists who need a visual editor. None of that is this game.

### Comparison

| Option | Terrain destruction | Iteration | Ship to a friend | Verdict |
|---|---|---|---|---|
| **TS + Canvas** | Trivial (you own the pixels) | Instant | Send a URL | **Pick this** |
| Godot 4 | Manual, same work | Fast (~1s) | Web export ~2MB, or a real .exe | Runner-up if you want Steam |
| Phaser 3 | Fights you — its physics assumes bodies | Instant | Send a URL | Adds weight, solves nothing here |
| Unity | Manual + pipeline friction | Slow | 5–15MB WebGL | No |
| Raylib + C | Trivial | Fast, but compile step | No easy sharing | Fun, but you lose the URL |

### Stack

```
Vite + TypeScript          build/dev server
Canvas 2D                  rendering (no WebGL needed at this scale)
Zero runtime dependencies  the whole sim is yours
Vitest                     for the ballistics/terrain unit tests
Vercel                     deploy (matches what you already do)
```

---

## 2. Architecture

Keep the simulation completely separate from rendering. This is the one structural decision that matters — it gives you replays, unit tests, deterministic behavior, and an upgrade path to online play for free.

```
src/
  sim/                    ← pure, no DOM, no Canvas, deterministic
    world.ts              GameState, step(state, input) -> state
    terrain.ts            Uint8Array mask, carve(), fill(), collapse(), surfaceY()
    ballistics.ts         integrate(), substep collision
    weapons.ts            weapon data table + behavior hooks
    damage.ts             falloff, fall damage, death
    rng.ts                seeded PRNG (mulberry32) — never use Math.random in sim/
  render/                 ← reads state, draws, owns nothing
    terrainLayer.ts       offscreen canvas, dirty-rect repaint
    entities.ts           tanks, projectiles, trails
    fx.ts                 particles, screen shake, muzzle flash
    hud.ts
  input/
    controls.ts           keyboard + mouse + on-screen
  audio/
  main.ts                 fixed-timestep loop
```

### Fixed timestep

```ts
const DT = 1 / 60;
let acc = 0;
function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25);  // clamp so alt-tab doesn't explode
  while (acc >= DT) { state = step(state, input); acc -= DT; }
  render(state, acc / DT);   // alpha for interpolation
  requestAnimationFrame(frame);
}
```

Never step the sim with a variable `dt`. Determinism is what makes replays and netcode possible later, and it's free if you do it from day one.

### Terrain

The whole thing is one bitmask:

```ts
mask: Uint8Array   // width * height, 1 = solid
```

- **Collision:** `mask[y * W + x] === 1`. That's it. O(1).
- **Carve:** zero out a circle, mark the column range dirty.
- **Fill (sandbags/dirt bomb):** set to 1 in a circle where currently 0.
- **Collapse:** after carving, per dirty column, slide floating spans down. Cap this at ~2 px/frame so it *animates* instead of teleporting — it reads as sand pouring and looks far better than an instant snap.
- **Render:** paint into an offscreen `ImageData` once; on carve, repaint only the dirty column range and `putImageData` with a dirty rect. Color by depth-from-surface (scrub → dirt → bedrock), which means craters naturally expose darker soil with zero extra work.

### Ballistics

```ts
// per sim step, SUBSTEPS = 6
for (let i = 0; i < SUBSTEPS; i++) {
  p.vy += GRAVITY * w.mass / SUBSTEPS;
  p.vx += wind * WIND_SCALE * w.drag / SUBSTEPS;
  p.x += p.vx / SUBSTEPS;
  p.y += p.vy / SUBSTEPS;
  if (solidAt(p.x, p.y)) return onTerrainHit(p);
  if (hitsTank(p)) return onDirectHit(p);
}
```

Substepping is non-negotiable — a shell at power 100 moves ~16 px/frame and will tunnel straight through a thin ridge without it.

**Tuned constants (measured, not guessed — these come out of the prototype):**

```
GRAVITY  = 0.215   px/frame²
MUZZLE   = 0.160   v = power * MUZZLE
WIND_K   = 0.00038 horizontal accel per wind unit
SUBSTEPS = 8
```

Measured range on flat ground at 45°, no wind:

| Power | 30 | 40 | 50 | 60 | 70 | 80 | 85+ |
|---|---|---|---|---|---|---|---|
| Range (px) | 151 | 236 | 344 | 476 | 632 | 810 | off-map |
| Flight | 0.7s | 0.8s | 1.0s | 1.1s | 1.3s | 1.5s | — |

Typical spawn separation is 620–840 px, so real engagements live at **power 70–82**. Wind at full ±100 shifts impact by **±115 px** — enough to demand a correction every turn, not enough to make aiming pointless. Angle sweep behaves properly: max range at 45°, and steep angles (60–85°) trade range for hang time and a near-vertical descent, which is how you hit someone behind a ridge.

Two things fell out of tuning that are worth knowing before you rebuild this:

- **Wind is the easiest thing in the game to get catastrophically wrong.** The first pass had `WIND_K` 35× too high, which made every shot unaimable while still *looking* plausible. Sanity-check it against gravity: horizontal wind accel should be roughly 1/6th of gravity at maximum, never more.
- **Mortar mass caps its range.** At `mass 2.00` the Heavy Mortar could not reach across a 700 px spawn gap at all — a limited-ammo weapon that was literally unusable. Corrected to `1.55`. Any weapon with `mass > 1` needs its max range checked against the spawn gap: `range = v² / (GRAVITY × mass)`.
- **Power 85+ at 45° flies off a 1000 px map.** That's not wasted slider — it's the steep-lob band. But if you widen the map with a scrolling camera later, re-derive `MUZZLE` from `range = v²/GRAVITY`.

### Weapons as data, not classes

One table, behaviors composed from hooks. Adding a weapon should be ~10 lines and zero new files.

```ts
interface Weapon {
  id: string;
  name: string;
  ammo: number | 'inf';
  mass: number;              // gravity multiplier
  drag: number;              // wind susceptibility
  blastRadius: number;
  damage: number;
  terrain: 'carve' | 'fill' | 'none';
  onApex?: (p, world) => void;      // cluster split
  onTerrainHit?: (p, world) => Handled;  // digger burrows, roller rolls
  trailStyle: 'thin' | 'smoke' | 'fire';
}
```

---

## 3. Weapon roster

Start with the first six. The rest are a backlog, not a requirement.

| # | Weapon | Ammo | Behavior | Role |
|---|---|---|---|---|
| 1 | **HE Shell** | ∞ | Baseline arc, radius 26, dmg 34 | Your ranging shot |
| 2 | **Heavy Mortar** | 4 | mass 1.55 (steeper arc, ~794 px max range), radius 44, dmg 52 | Payoff for a dialed-in solution |
| 3 | **Cluster Bomb** | 3 | Splits into 5 at apex | Punishes flat/open positions |
| 4 | **Bunker Buster** | 3 | Burrows ~30 px into terrain, then detonates | Beats dug-in opponents |
| 5 | **Sandbags** | 3 | *Adds* terrain, 0 damage | Defensive — build a wall |
| 6 | **Roller** | 3 | Lands, rolls downhill, detonates on contact or after fuse | Rewards reading the slope |

**Backlog:** Napalm (burning terrain that ticks damage), Bouncer (2 ricochets), Airstrike (vertical bombs on a chosen x), Laser (hitscan, ignores wind, low damage), MIRV (splits into 3 tracked warheads), Repair Kit (heal, ends turn), Teleport.

Balance rule: every limited weapon must be *situationally* better than the HE Shell, never flatly better. If Heavy Mortar is just "HE but more," you've built a resource-drain, not a decision.

---

## 4. Rules & turn flow

```
Setup → roll terrain, place tanks, coin flip
  ↓
AIM (active player)
  · adjust angle 0–180°, power 10–100
  · pick weapon
  · wind is visible and fixed for this turn
  ↓  FIRE
FLIGHT — shell integrates, camera optionally follows
  ↓
RESOLVE — explosion, carve, damage, collapse
  ↓
SETTLE — tanks fall onto new terrain, fall damage if drop > 40 px
  ↓
Health ≤ 0? → ROUND OVER
Else → reroll wind, swap player, back to AIM
```

- **Health:** 100. Damage falls off linearly to 25% at blast edge.
- **Wind:** −100…+100, rerolled each turn, always displayed. This is the main anti-memorization mechanic — without it, one player finds a perfect angle/power pair and repeats it forever.
- **Fall damage:** `(dropPx − 40) * 0.5`. Makes digging under your *own* tank a real risk.
- **Match:** best of 3 rounds, fresh terrain each round.

### Feel details worth building early

- **Persistent shot trails.** Keep the last 3 trails of the current player on screen as faint dotted lines. Adjusting fire — over, short, bracket, hit — *is* the game, and this is the single highest-value UI element you can build. It's in the prototype.
- **Aim shows in-world.** The barrel physically rotates and a power bar fills along the muzzle direction. Never make the player read numbers to know where they're pointing.
- **Screen shake + a 200ms hitstop on a direct hit.** Cheap, enormous impact.

---

## 5. Art direction

"Somewhat simple" is a strength here — go **procedural, zero art assets.**

- **Terrain:** midpoint-displacement heightmap, colored by depth. Three flat bands: scrub top (~5 px), dirt, bedrock. No textures.
- **Tanks:** drawn programmatically — a rounded hull, a turret dome, a barrel line, three tread wheels. ~20 lines of Canvas each, and they recolor per player for free.
- **Sky:** vertical gradient, dusk palette. Add a distant ridge silhouette at 25% opacity for depth. One gradient, huge payoff.
- **Palette:**
  ```
  #0E1219  void / panel base
  #2B3A52  upper sky
  #C9A87C  horizon haze
  #4A5540  scrub      #5C4A36  dirt      #34291F  bedrock
  #E8B33C  Player 1 (brass)
  #4FC3D9  Player 2 (cyan)
  #FF6B35  explosions / danger
  ```
- **Type:** monospace with tabular figures for all telemetry (angle, power, wind, damage) — it's a fire-control readout, and numbers that don't jitter as they change is worth more than any font choice. Condensed sans for labels.

The whole visual identity is: *gunner's instrument panel wrapped around a dusk battlefield.* Nothing needs to be drawn by hand.

---

## 6. Build order

Each phase ends with something playable. Don't skip ahead.

| Phase | Scope | Est. |
|---|---|---|
| **0** | Spike prototype (attached — validates the whole approach) | done |
| **1** | Vite + TS skeleton, fixed-timestep loop, seeded RNG, input layer | 3h |
| **2** | Terrain: generate, render with dirty rects, carve, animated collapse | 6h |
| **3** | Ballistics + HE Shell end to end, substep collision, trails | 5h |
| **4** | Turn system, health, damage falloff, fall damage, win condition | 4h |
| **5** | Weapon data table + the six weapons, ammo, weapon UI | 8h |
| **6** | Feel pass: particles, shake, hitstop, sound, camera follow | 8h |
| **7** | Meta: best-of-3, loadout screen, terrain themes, settings | 6h |
| **8** | *Optional* — online play (see below) | 20h+ |

~40 hours to a genuinely finished local game. That's a real, shippable scope.

---

## 7. Gotchas

- **Tunneling.** Substep or shells pass through thin terrain. Bites you at high power specifically, so it looks like a rare "sometimes it misses" bug.
- **Buried alive.** If a tank ends up fully inside terrain, it must dig up, not fall forever. Add an escape hatch: if solid at tank center, walk upward until clear.
- **Collapse performance.** Naive per-pixel collapse over the full width every frame will tank you. Only process dirty columns, and cap fall speed.
- **P2 angle mirroring.** Player 2 aims left. Either mirror the display (show P2 "45°" when internally it's 135°) or keep it absolute — pick one and never mix. Mirroring is friendlier.
- **Non-determinism.** One `Math.random()` inside `sim/` kills replays and netcode. Seeded RNG only, enforced by a lint rule if you want to be strict.
- **Wind readability.** A number alone isn't enough. Draw an arrow whose length scales with strength, plus drifting particles in the sky.
- **Turn-length creep.** If a player can sit in aim mode indefinitely, matches drag. A 30s soft timer that auto-fires at current settings fixes it.

---

## 8. Online play (only if you want it)

Because the sim is deterministic and separate from rendering, you get two easy options:

- **Turn-based state sync (recommended).** It's a turn game — just send `{angle, power, weaponId}` over a WebSocket, both clients run the identical deterministic sim, and the terrain stays in sync automatically. Tiny payload, no rollback, no interpolation. A Supabase Realtime channel or a 100-line WS server covers it.
- **Full lockstep** is overkill here. Don't.

Do this only after phase 7. Local hotseat is a complete game.

---

## 9. Next step

Play the prototype. Specifically check: does the angle/power loop feel good, is the wind swing too punishing, and do the six weapons feel distinct? Those three answers drive every number in phase 3–5.
