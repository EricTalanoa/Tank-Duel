import { describe, expect, it } from 'vitest';
import { EFFECTS } from './effectConfig';
import { createAudio, type AudioBackend } from './audio';

describe('effects audio', () => {
  it('is a safe no-op when Web Audio is unavailable', async () => {
    const audio = createAudio(() => null);
    audio.playFire();
    audio.playImpact();
    audio.playDirectHit();
    await expect(audio.unlock()).resolves.toBeUndefined();
  });

  it('stays silent before unlock and uses spec frequencies afterward', async () => {
    const frequencies: number[] = [];
    let resumes = 0;
    const backend: AudioBackend = {
      resume: () => { resumes++; },
      tone: (frequency) => { frequencies.push(frequency); },
    };
    const audio = createAudio(() => backend);
    audio.playFire();
    expect(frequencies).toEqual([]);
    await audio.unlock();
    audio.playFire();
    audio.playImpact();
    audio.playDirectHit();
    expect(resumes).toBe(1);
    expect(frequencies).toEqual([
      EFFECTS.audio.fireFrequencyHz,
      EFFECTS.audio.impactFrequencyHz,
      EFFECTS.audio.directHitFrequencyHz,
    ]);
  });
});
