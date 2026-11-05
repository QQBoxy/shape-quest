import { it, expect } from "vitest";
import { VideoMetrics } from "../../src/video-metrics";
it("counts native wraps and frame gaps, while excluding explicit pauses from gaps", () => {
  const m = new VideoMetrics();
  m.sample(0, 7.8, 7.93, { fullMAE: 0, roadMAE: 0 });
  m.sample(42, 7.85, 7.93, { fullMAE: 4, roadMAE: 3 });
  m.activeSeconds = 7.94;
  expect(m.isWrap(0.01, 7.93)).toBe(true);
  expect(m.isWrap(7.9, 7.93)).toBe(false);
  expect(m.sample(84, 0.01, 7.93, { fullMAE: 37, roadMAE: 16 })).toBe(true);
  expect(m.loops[0]).toMatchObject({ loop: 1, gapMs: 42, roadMAE: 16 });
  m.breakSequence();
  expect(m.isWrap(0.01, 7.93)).toBe(false);
  m.sample(10000, 0.02, 7.93, { fullMAE: 0, roadMAE: 0 });
  expect(m.maxFrameGapMs).toBe(42);
  m.sample(10300, 0.3, 7.93, { fullMAE: 0, roadMAE: 0 });
  expect(m.gapsOver250ms).toBe(1);
});

it("queries loop boundaries without consuming frames or changing the baseline", () => {
  const m = new VideoMetrics();
  const difference = { fullMAE: 12, roadMAE: 8 };
  expect(m.isWrap(0, 8)).toBe(false);
  m.sample(0, 7, 8, difference);
  expect(m.isWrap(3, 8)).toBe(false); // Exactly half a cycle is not a wrap.
  expect(m.isWrap(2.99, 8)).toBe(true);
  expect(m.isWrap(2.99, 8)).toBe(true);
  expect(m.frameCount).toBe(1);
  expect(m.loops).toEqual([]);
  m.activeSeconds = 8;
  expect(m.sample(250, 0, 8, difference)).toBe(true);
  expect(m.gapsOver250ms).toBe(0);
  m.sample(501, 7, 8, difference);
  expect(m.gapsOver250ms).toBe(1);
  m.activeSeconds = 16;
  m.sample(543, 0, 8, difference);
  expect(m.loops).toEqual([
    { loop: 1, activeSeconds: 8, gapMs: 250, beforeMedia: 7, afterMedia: 0, ...difference },
    { loop: 2, activeSeconds: 16, gapMs: 42, beforeMedia: 7, afterMedia: 0, ...difference },
  ]);
  m.breakSequence();
  m.sample(10000, 0, 8, difference);
  expect(m.loops).toHaveLength(2);
  expect(m.maxFrameGapMs).toBe(251);
});
