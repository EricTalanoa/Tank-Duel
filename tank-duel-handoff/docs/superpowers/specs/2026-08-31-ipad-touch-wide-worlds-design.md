# iPad Touch Controls and Wide Worlds Design

## Goal

Make Quick Start the focused entry point, make every battlefield feel expansive, and allow a complete match to be played on an iPad without a keyboard or mouse.

## Menu and ammunition flow

- Remove the Custom Game button from the title screen without deleting the dormant Custom Game flow.
- Quick Start continues through battlefield selection, briefing, and loadout.
- All 12 completed shells are enabled for Quick Start and appear in the loadout chooser.
- HE remains locked into slot one. Players still choose at most five optional shells under the existing 10-point limit.
- Anvil Round remains unavailable until its simulation behavior is implemented.

## World scale and balance

- Every shipped world has a width of at least 1200 field pixels.
- Terra, Vesper, and Ferrum become 1200 px wide. Hollow remains 1200 px. Rust and Selene keep their existing larger widths.
- The global 150 px spawn inset remains unchanged, producing a minimum 900 px spawn gap.
- Existing gravity, atmosphere, wind, and time-scale identities remain unchanged.
- World construction uses explicit spec-backed mass overrides where a shell cannot cross the new spawn gap. Vesper and Ferrum require the largest adjustments.
- Range validation must confirm every flight-based playable shell can cross every world's spawn gap at maximum power. Repair Kit is excluded because it has no projectile.
- Camera behavior remains unchanged: both tanks are framed during aiming and projectiles are followed during flight.

## Touch-only match controls

The keyboard path remains available. A DOM touch-control layer sits above the match canvas and sends the same angle, power, shell-selection, and fire intents into the existing match runtime.

The persistent controls include:

- Angle decrement and increment buttons.
- Power decrement and increment buttons.
- Angle and power sliders for larger adjustments.
- One touch target for every equipped shell, showing selected and spent/disabled states.
- A prominent Fire button.

All interactive targets are at least 44 by 44 CSS pixels. Controls account for iPad safe-area insets and remain usable in landscape at the project's 1194 by 834 reference viewport. No action depends on hover.

## Direct aiming gesture

- A pointer drag beginning on or near the active tank starts direct aiming.
- The drag direction sets elevation relative to the tank's facing direction.
- Drag distance maps to power across the existing minimum and maximum power range.
- Pointer movement updates the same simulation aim state used by keyboard and button controls.
- Releasing the pointer confirms the aim but does not fire. Firing always requires the explicit Fire control, preventing accidental shots while adjusting aim.
- Pointer capture keeps a drag active if the finger leaves the tank or canvas.
- Gestures are ignored outside the AIM phase, while paused, and during CPU turns.

## Responsive behavior

- Gameplay remains landscape-only on iPad; the existing orientation gate continues to pause interaction in portrait.
- The canvas remains full-viewport. Touch controls occupy edge zones and safe areas without changing field coordinates or simulation dimensions.
- On shorter landscape screens, secondary labels compact before any control falls below the minimum touch target.
- Browser panning and pinch gestures are disabled only on the gameplay surface. Menu pages retain normal accessible interaction behavior.

## Error handling and lifecycle

- Touch input becomes inert immediately when the runtime is paused or disposed.
- Pointer capture is released on cancellation, disposal, and phase changes.
- Fire remains protected by the simulation's existing AIM-phase guard and cannot double-fire from repeated pointer events.
- Disabled or spent shells remain visible but cannot be selected.

## Focused verification

Per the requested light-testing scope:

- Add targeted tests for the touch intent translation, drag-to-angle/power mapping, and fire debouncing.
- Add one world validation test for the 1200 px minimum and 900 px minimum spawn gap.
- Update affected menu/loadout expectations.
- Run the directly affected tests and a production build; avoid expanding into unrelated exhaustive testing.

## Out of scope

- Re-enabling Custom Game.
- Implementing Anvil Round.
- Portrait gameplay.
- Multi-touch gestures that fire or select ammunition.
- Retuning gravity, wind, atmosphere, damage, or loadout costs.
