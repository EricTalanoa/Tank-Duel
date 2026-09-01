import { createAppController } from './app/controller';
import { createMatchRuntime } from './app/matchRuntime';
import { createHowtoScene } from './render/howtoScene';
import { motionPolicy } from './render/motion';
import { createTitleScene, type SceneAnimationOptions } from './render/titleScene';
import { makePlayerLoadouts } from './sim/playerLoadouts';
import { createRng, hashSeed } from './sim/rng';
import { mountAppView } from './ui/appView';
import { mountLoadout } from './ui/loadout';
import './style.css';
import './ui/loadout.css';

const canvas = document.querySelector<HTMLCanvasElement>('#field');
if (!canvas) throw new Error('#field canvas not found');

const appRoot = document.createElement('main');
appRoot.id = 'app';
document.body.append(appRoot);

const controller = createAppController({
  storage: globalThis.localStorage,
  location: globalThis.location,
  createView: (callbacks) => mountAppView(appRoot, callbacks),
  createTitleScene: () => {
    resizeSceneCanvas(canvas);
    return createTitleScene(canvas, sceneOptions('title'));
  },
  createHowtoScene: () => {
    resizeSceneCanvas(canvas);
    return createHowtoScene(canvas, sceneOptions('howto'));
  },
  // TEMPORARY (Task 4 deletes this adapter): the loadout screen still edits one shared
  // deck, so its single deployed deck is widened into two identical entries here, at the
  // composition boundary. Everything downstream already treats the two decks as
  // independent, so Task 4's two-panel editor replaces exactly this one call site.
  mountLoadout: ({ onDeploy, enabledShellIds, initialPlayerLoadoutIds }) => mountLoadout(
    document.body,
    {
      enabledShellIds,
      onDeploy: (ids) => { onDeploy(makePlayerLoadouts(ids, ids)); },
      ...(initialPlayerLoadoutIds === undefined
        ? {}
        : { initialShellIds: initialPlayerLoadoutIds[0] }),
    },
  ),
  createMatchRuntime: ({ config, playerLoadoutIds, onComplete }) => createMatchRuntime({
    canvas,
    config: {
      seed: config.seed,
      worldId: config.worldId,
      generatorId: config.generatorId,
    },
    playerLoadoutIds,
    onComplete,
  }),
});

globalThis.addEventListener('pagehide', () => { controller.dispose(); }, { once: true });

function sceneOptions(scene: 'title' | 'howto'): SceneAnimationOptions {
  return {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    now: () => performance.now(),
    rng: createRng(hashSeed(`tank-duel:${scene}`)),
    motion: motionPolicy(globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
}

function resizeSceneCanvas(sceneCanvas: HTMLCanvasElement): void {
  const bounds = sceneCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
  sceneCanvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
  sceneCanvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
}
