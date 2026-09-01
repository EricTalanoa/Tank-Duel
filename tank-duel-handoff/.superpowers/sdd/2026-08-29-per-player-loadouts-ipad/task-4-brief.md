# Task 4 Brief — Side-by-side independent loadout owner

## Context

Checkpoints 1–3 are complete. Implement checkpoint 4 only from the approved plan/design. The controller now consumes `PlayerLoadouts` and exposes `initialPlayerLoadoutIds`; `main.ts` contains one temporary shared-deck adapter that this task must delete.

`makePlayerLoadouts` validates complete decks: HE exactly once in slot one, no duplicates, playable IDs. Existing spec-backed point/slot rules stay authoritative.

## Files

- Modify `src/ui/loadout.ts`, `src/ui/loadout.test.ts`, `src/ui/loadout.css`, and `src/main.ts`.
- Modify controller/main typing only if required to remove the temporary adapter; do not redesign controller contracts.
- Write `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-4-report.md`.
- Do not implement orientation gating, Blue/Pink combat colors, CPU behavior, or Task 13.

## Required public contract

```ts
export interface MountLoadoutOptions {
  readonly onDeploy: (loadouts: PlayerLoadouts) => void;
  readonly enabledShellIds?: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
}
```

Remove `initialShellIds` and the temporary one-deck widening adapter in `main.ts`; there must be no old UI compatibility alias afterward.

Create a pure two-player editor model with an interface equivalent to:

```ts
export interface PlayerLoadoutEditorModel {
  readonly players: readonly [PlayerLoadoutPanelModel, PlayerLoadoutPanelModel];
  readonly canDeploy: boolean;
  toggle(player: PlayerIndex, shellId: string): void;
  deployment(): PlayerLoadouts;
}
```

Each panel owns a separate `Loadout`. One player's toggle must not mutate the other. Both use the same enabled-shell set. Each independently gets the full spec-backed budget and locked/free HE.

## DOM and interaction

- One overlay owner, two equal neutral labelled regions using spec-backed `Player 1` / `Player 2` labels.
- Each region has its own points/slots counter and full icon/name/cost/ammo/mass cards.
- One shared Deploy button; enabled only when both panels are valid.
- Deploy returns a stable Player 1 / Player 2 tuple and disposes before callback.
- Disposal removes overlay/listeners idempotently.
- Minimum 44×44 CSS-pixel card and Deploy targets, visible keyboard focus, safe-area padding, touch-first/no hover-only affordances.
- Use landscape two-column layout; Task 5 owns portrait blocking.
- Fold the duplicated `STANDARD_WEAPONS.map(...)` default derivation into one existing spec-derived default helper/constant rather than creating another duplicate.

## TDD

Capture RED before production changes. Tests must prove:

- two distinct initial decks render and deploy in stable tuple order;
- toggling Player 1 leaves Player 2 deeply unchanged and vice versa;
- each points/slots counter is independent;
- HE is locked in both;
- Deploy is shared and requires both valid decks;
- enabled-shell filtering applies equally;
- caller mutation cannot alter model-owned/deployed tuples;
- owner/listener disposal is idempotent;
- labels come from presentation spec, not hardcoded production strings;
- CSS minimum targets and focus treatment.

## Verification

Run `src/ui/loadout.test.ts`, controller/app-view regressions, then full suite, `npx tsc --noEmit`, and Vite build. Use D: temp/output. Report RED/GREEN commands/counts, changed files, removed-adapter grep, independent-budget evidence, golden hash, self-review, and concerns.

## Constraints

- `spec/*.json` authoritative; never edit/regenerate golden vectors.
- Menus/loadout remain neutral; no Blue/Pink panel accents.
- No module-scope DOM access; `matchRuntime.test.ts` imports this module.
- Non-Git workspace; do not initialize Git or claim commits.
- Do not spawn agents/reviewers.
