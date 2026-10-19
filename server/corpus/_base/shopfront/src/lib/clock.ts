export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export function fakeClock(start = 0): Clock & { advance(ms: number): void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}
