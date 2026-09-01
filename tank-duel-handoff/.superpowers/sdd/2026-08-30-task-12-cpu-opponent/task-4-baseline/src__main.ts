import { createAppController } from './app/controller';
import { createMatchRuntime } from './app/matchRuntime';
import { createHowtoScene } from './render/howtoScene';
import { motionPolicy } from './render/motion';
import { createTitleScene, type SceneAnimationOptions } from './render/titleScene';
import { createRng, hashSeed } from './sim/rng';
import { mountAppView } from './ui/appView';
import { mountLoadout } from './ui/loadout';
import { mountOrientationGate } from './ui/orientationGate';
import './style.css';
import './ui/loadout.css';
import './ui/orientationGate.css';

const canvas = document.querySelector<HTMLCanvasElement>('#field');
if (!canvas) throw new Error('#field canvas not found');

const appSurface = document.createElement('div');
appSurface.id = 'app-surface';
document.body.insertBefore(appSurface, canvas);
appSurface.append(canvas);

const appRoot = document.createElement('main');
appRoot.id = 'app';
appSurface.append(appRoot);

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
  mountLoadout: ({ onDeploy, enabledShellIds, initialPlayerLoadoutIds }) => mountLoadout(
    appSurface,
    {
      enabledShellIds,
      onDeploy,
      ...(initialPlayerLoadoutIds === undefined ? {} : { initialPlayerLoadoutIds }),
    },
  ),
  createMatchRuntime: ({ config, playerLoadoutIds, onComplete }) => createMatchRuntime({
    canvas,
    config: {
      seed: config.seed,
      worldId: config.worldId,
      generatorId: config.generatorId,
      mode: config.mode,
      cpuTierId: config.cpuTierId,
    },
    playerLoadoutIds,
    onComplete,
  }),
});

const orientationGate = mountOrientationGate(appSurface, globalThis, (blocked) => {
  controller.setPresentationBlocked(blocked);
});

globalThis.addEventListener('pagehide', () => {
  orientationGate.dispose();
  controller.dispose();
}, { once: true });

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
