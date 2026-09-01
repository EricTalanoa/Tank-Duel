# Task 6 Brief — Application controller integration

Implement only Task 6 from the approved plan. Read current Task 1–5 public interfaces, `.impeccable.md`, and the approved design.

## Files

- Create `src/app/controller.ts`, `src/app/controller.test.ts`.
- Modify `src/main.ts` and global/menu stylesheet imports as needed.
- Modify prior modules only for concrete integration defects, preserving reviewed contracts.

## Controller requirements

- Export `createAppController(dependencies)`; it owns flow state, view, injected storage, title/HOWTO scenes, loadout, and at most one match runtime.
- Initial load decodes saved config; explicit URL seed/world/generator values override that fresh initialization only when present. Later saved choices are not unexpectedly overwritten.
- Wire TITLE, exact two-click Quick Start, MODE representation, MAP/Random, CUSTOM, HOWTO, ROUND_INTRO, LOADOUT, MATCH, and ROUND_OVER through the pure reducer/view.
- Persist every accepted configuration change through the guarded adapter.
- Start exactly one runtime. Completion immediately disposes it and enters ROUND_OVER once.
- Rematch preserves every resolved setting except seed, persists it, and creates one replacement path/runtime. Change Loadout preserves settings and returns to loadout. Menu disposes runtime/scenes and returns TITLE.
- Scene lifecycle follows visible screens: no hidden scene RAF loops. Controller and all disposers are idempotent.
- Keep CPU disabled/non-startable and do not implement Task 12.
- Preserve existing reproducible URL support and dev handle semantics.
- TDD with injected view/storage/runtime/scenes/location; prove reload persistence, navigation, runtime counts, cleanup, and rematch deep equality except seed.
- Run controller/app/UI/runtime/purity tests and TypeScript/build with runner/D:. Write task-6-report.md.
