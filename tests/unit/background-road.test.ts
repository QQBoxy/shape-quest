import { expect, it } from "vitest";
import { projectRoad, roadDepth } from "../../src/background-road-projection";

it("keeps three lanes and common ground/size perspective across aspect ratios and vanishing points", () => {
  for (const [w, h] of [[1600, 900], [390, 844], [844, 390]]) {
    for (const vpX of [0.2, 0.5, 0.8]) {
      const p = { vpX, vpY: 0.42, width: 1 };
      for (const [laneX, fraction] of [[-1.5, 0], [-0.5, 1 / 3], [0.5, 2 / 3], [1.5, 1]]) {
        const bottom = projectRoad(laneX, 0, 1, p, w, h);
        expect(bottom.x).toBeCloseTo(w * fraction);
        expect(bottom.y).toBe(h);
      }
      const far = projectRoad(1, 0, 1e9, p, w, h);
      expect(far.x).toBeCloseTo(w * vpX);
      expect(far.y).toBeCloseTo(h * p.vpY);
      const ground = projectRoad(1, 0, 8, p, w, h);
      const top = projectRoad(1, 0.65, 8, p, w, h);
      expect(top.x).toBe(ground.x);
      expect(ground.y - top.y).toBeCloseTo(0.65 * w / 3 * ground.scale);
      expect(projectRoad(1, 0, 4, p, w, h).scale).toBe(ground.scale * 2);
    }
  }
});
it("advances world depth uniformly and wraps behind the near plane without resetting at video loops", () => {
  for (const t of [0, 7.93, 15.86, 120]) {
    const a = roadDepth(40, t * 6, 96);
    const b = roadDepth(40, (t + 0.01) * 6, 96);
    expect((a - b + 96) % 96).toBeCloseTo(0.06);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThan(97);
  }
});
