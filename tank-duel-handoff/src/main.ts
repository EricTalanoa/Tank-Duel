import { createAppController } from './app/controller';
import { createMatchRuntime } from './app/matchRuntime';
import { createHowtoScene } from './render/howtoScene';
import { motionPolicy } from './render/motion';
import { createTitleScene, type SceneAnimationOptions } from './render/titleScene';
import { createRng, hashSeed } from './sim/rng';
import { mountAppView } from './ui/appView';
import { mountLoadout } from './ui/loadout';
import { mountOrientationGate, type OrientationGate } from './ui/orientationGate';
import './style.css';
import './ui/loadout.css';
import './ui/touchControls.css';
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

/**
 * Only the match needs the full iPad width, so only the match is gated on it. The gate owns
 * the overlay and the controller owns whether a match exists; this is where the two meet.
 */
let matchActive = false;
let orientationGate: OrientationGate | null = null;

function setMatchActive(active: boolean): void {
  if (matchActive === active) return;
  matchActive = active;
  orientationGate?.refresh();
}

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
  mountLoadout: ({ onDeploy, onBack, enabledShellIds, initialPlayerLoadoutIds, mode, cpuTierId }) => mountLoadout(
    appSurface,
    {
      enabledShellIds,
      mode,
      cpuTierId,
      onDeploy,
      onBack,
      ...(initialPlayerLoadoutIds === undefined ? {} : { initialPlayerLoadoutIds }),
    },
  ),
  createMatchRuntime: ({ config, playerLoadoutIds, onComplete }) => {
    setMatchActive(true);
    const runtime = createMatchRuntime({
      canvas,
      controlRoot: appSurface,
      hudChrome: { showTelemetry: devTelemetryEnabled() },
      config: {
        seed: config.seed,
        worldId: config.worldId,
        generatorId: config.generatorId,
        mode: config.mode,
        cpuTierId: config.cpuTierId,
      },
      playerLoadoutIds,
      onComplete,
    });
    return {
      setPaused: (paused) => runtime.setPaused(paused),
      dispose: () => {
        setMatchActive(false);
        runtime.dispose();
      },
    };
  },
});

orientationGate = mountOrientationGate(appSurface, globalThis, {
  needsFullWidth: () => matchActive,
  onBlockedChange: (blocked) => controller.setPresentationBlocked(blocked),
  onLeave: () => controller.dispatch({ type: 'menu' }),
});

globalThis.addEventListener('pagehide', () => {
  orientationGate?.dispose();
  controller.dispose();
}, { once: true });

/** Loop telemetry is a dev aid, so it ships off and opts in through `?telemetry=1`. */
function devTelemetryEnabled(): boolean {
  return new URLSearchParams(globalThis.location.search).get('telemetry') === '1';
}

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
