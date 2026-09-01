# Task 6 independent review package

Review checkpoint 6 against `task-6-brief.md`, the approved design spec, checkpoint 6 of the
implementation plan, and `task-6-report.md`. This is a non-Git workspace; preserved originals for
the principal planned files are in `task-6-baseline/`. Inspect all current changed files listed in
the report, including the wider simulation fixtures/validation paths required by the new owner.

Return separate **spec compliance** and **code quality** PASS/FAIL verdicts. Rank findings as
Critical, Important, or Minor with exact file/line evidence.

Explicitly audit:

- every player-owned combat surface uses `playerColor(PlayerIndex)` from `PRESENTATION`;
- menus/loadout, terrain, explosions, shell icons, generic accents, and non-player title/HOWTO
  decoration retain functional colors;
- identity remains non-color-only;
- old competing player palette entries are fully removed;
- `Projectile.owner`/`LaunchOptions.owner` are typed and supplied by every caller;
- fire, split, staged, airburst, bounce, roller, cloning, validation, and presentation paths all
  preserve owner correctly;
- owner never branches physics, damage, RNG, terrain, or deterministic outcomes;
- newly touched validation/presentation code remains strict and does not silently repair invalid
  ownership;
- no CPU/ammunition/visual-overhaul scope creep, no UI imports into simulation, no duplicated spec
  colors, and no golden-file mutation.

Worker evidence: focused 55/55, full suite 52 files / 421 tests, TypeScript clean, Vite build clean,
golden SHA-256 `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
