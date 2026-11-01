import { it, expect } from "vitest";
import { VideoMetrics } from "../../src/video-metrics";
it("counts native wraps and frame gaps, while excluding explicit pauses from gaps", () => {
  const m = new VideoMetrics();
  m.sample(0, 7.8, 7.93, { fullMAE: 0, roadMAE: 0 });
  m.sample(42, 7.85, 7.93, { fullMAE: 4, roadMAE: 3 });
  m.activeSeconds = 7.94;
  expect(m.sample(84, 0.01, 7.93, { fullMAE: 37, roadMAE: 16 })).toBe(true);
  expect(m.loops[0]).toMatchObject({ loop: 1, gapMs: 42, roadMAE: 16 });
  m.breakSequence();
  m.sample(10000, 0.02, 7.93, { fullMAE: 0, roadMAE: 0 });
  expect(m.maxFrameGapMs).toBe(42);
  m.sample(10300, 0.3, 7.93, { fullMAE: 0, roadMAE: 0 });
  expect(m.gapsOver250ms).toBe(1);
});
