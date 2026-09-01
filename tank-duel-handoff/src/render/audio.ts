import { EFFECTS } from './effectConfig';

export interface AudioBackend {
  resume(): Promise<void> | void;
  tone(frequencyHz: number): void;
}

export interface EffectsAudio {
  unlock(): Promise<void>;
  playFire(): void;
  playImpact(): void;
  playDirectHit(): void;
}

function webAudioBackend(): AudioBackend | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  return {
    resume: () => context.resume(),
    tone(frequencyHz) {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequencyHz, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(
        EFFECTS.audio.masterGain,
        now + EFFECTS.audio.attackSeconds,
      );
      gain.gain.exponentialRampToValueAtTime(
        Number.EPSILON,
        now + EFFECTS.audio.releaseSeconds,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + EFFECTS.audio.releaseSeconds);
    },
  };
}

export function createAudio(factory: () => AudioBackend | null = webAudioBackend): EffectsAudio {
  let backend: AudioBackend | null = null;
  let unlocked = false;
  const play = (frequency: number): void => {
    if (unlocked) backend?.tone(frequency);
  };
  return {
    async unlock() {
      if (unlocked) return;
      backend = factory();
      if (!backend) return;
      await backend.resume();
      unlocked = true;
    },
    playFire: () => play(EFFECTS.audio.fireFrequencyHz),
    playImpact: () => play(EFFECTS.audio.impactFrequencyHz),
    playDirectHit: () => play(EFFECTS.audio.directHitFrequencyHz),
  };
}
