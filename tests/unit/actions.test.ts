import { describe, it, expect } from "vitest";
import {
  features,
  mirror,
  makeBaseline,
  classify,
  detectAction,
  freshDetector,
  isNeutral,
  type Features,
  type Point,
} from "../../src/actions";
import { Calibration } from "../../src/calibration";
const standing: Features = {
  hipX: 0.5,
  hipY: 0.55,
  shoulderY: 0.3,
  feetY: 0.9,
  height: 0.8,
  knee: Math.PI,
};
const baseline = makeBaseline(Array(30).fill(standing))!;
const poses = {
  left: { ...standing, hipX: 0.37 },
  right: { ...standing, hipX: 0.63 },
  jump: { ...standing, hipY: 0.47, feetY: 0.86 },
  duck: { ...standing, hipY: 0.66, shoulderY: 0.4, knee: 2.4 },
};
function feed(
  state: ReturnType<typeof freshDetector>,
  pose: Features,
  start: number,
  count = 5,
) {
  let action: string | null = null;
  for (let i = 0; i < count; i++) {
    const result = detectAction(state, pose, baseline, start + i * 60);
    state = result.state;
    action = result.action ?? action;
  }
  return { state, action };
}
describe("pose quality and normalized actions", () => {
  it("waits for manual setup and never establishes center from an off-center player", () => {
    const setup = new Calibration();
    for (let i = 0; i < 60; i++) setup.update(standing, i * 60);
    expect(setup.baseline).toBeNull();
    setup.start();
    for (let i = 60; i < 120; i++) setup.update({ ...standing, hipX: 0.3 }, i * 60);
    expect(setup.baseline).toBeNull();
    expect(setup.progress).toBe(0);
    for (let i = 120; i < 160; i++) setup.update({ ...standing, hipX: 0.52 }, i * 60);
    expect(setup.baseline?.hipX).toBe(0.5);
    expect(setup.step).toBe(1);
  });
  it("restarts standing calibration after a gap in camera samples", () => {
    const cal = new Calibration();
    cal.start();
    for (let i = 0; i < 25; i++) cal.update(standing, i * 60);
    cal.update(standing, 5000);
    expect(cal.step).toBe(0);
    expect(cal.progress).toBe(0);
    expect(cal.baseline).toBeNull();
  });
  it("rejects missing, clipped and low-confidence essential joints", () => {
    expect(features([])).toBeNull();
    const points: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 1,
    }));
    points[0].y = 0.1;
    points[27].y = points[28].y = 0.9;
    expect(features(points)).not.toBeNull();
    points[27].visibility = 0.1;
    expect(features(points)).toBeNull();
    points[27].visibility = 1;
    points[28].x = 1;
    expect(features(points)).toBeNull();
  });
  it("keeps a crouching torso trackable when the legs are occluded, without inventing a jump", () => {
    const p: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    p[0].y = 0.78;
    p[11].y = p[12].y = 0.43;
    p[23].y = p[24].y = 0.67;
    for (const i of [25, 26, 27, 28]) p[i].visibility = 0.1;
    expect(features(p)).toBeNull();
    const duck = features(p, 4 / 3, true)!;
    expect(duck).not.toBeNull();
    expect(classify(duck, baseline)).toBe("duck");
    expect(classify({ ...duck, hipY: 0.4 }, baseline)).not.toBe("jump");
    p[23].visibility = 0.1;
    expect(features(p, 4 / 3, true)).toBeNull();
  });
  it("mirrors screen coordinates exactly once without swapping joint identities", () => {
    const p = [{ x: 0.2, y: 0.6, visibility: 1 }];
    expect(mirror(p)[0].x).toBe(0.8);
    expect(mirror(mirror(p))[0].x).toBeCloseTo(0.2);
    expect(p[0].x).toBe(0.2);
  });
  it("requires stable straight standing and enough samples", () => {
    expect(makeBaseline([standing])).toBeNull();
    expect(makeBaseline([...Array(29).fill(standing), poses.left])).toBeNull();
    expect(makeBaseline(Array(30).fill(poses.duck))).toBeNull();
    expect(baseline).not.toBeNull();
  });
  it.each(Object.entries(poses))(
    "recognizes %s relative to body scale",
    (action, pose) => {
      expect(classify(pose, baseline)).toBe(action);
      const scale = (f: Features) => ({
        ...f,
        hipX: f.hipX * 0.7,
        hipY: f.hipY * 0.7,
        shoulderY: f.shoulderY * 0.7,
        feetY: f.feetY * 0.7,
        height: f.height * 0.7,
      });
      expect(
        classify(scale(pose), {
          ...scale(baseline),
          leftLimit: 0,
          rightLimit: 1,
        }),
      ).toBe(action);
    },
  );
  it("does not call raised arms / hip motion without raised feet a jump", () => {
    expect(classify({ ...standing, hipY: 0.47 }, baseline)).toBeNull();
  });
  it("filters a single noisy frame, consumes a held action, and rearms after standing", () => {
    let state = feed(freshDetector(), standing, 0).state;
    let r = detectAction(state, poses.jump, baseline, 300);
    state = r.state;
    expect(r.action).toBeNull();
    state = feed(state, standing, 360).state;
    const first = feed(state, poses.jump, 660);
    expect(first.action).toBe("jump");
    const held = feed(first.state, poses.jump, 960);
    expect(held.action).toBeNull();
    state = feed(held.state, standing, 1260).state;
    expect(feed(state, poses.jump, 1560).action).toBe("jump");
  });
  it("clears arming on lost/stale tracking and cannot resume a held pose", () => {
    const armed = feed(freshDetector(), standing, 0).state;
    const missing = detectAction(armed, null, baseline, 300);
    expect(feed(missing.state, poses.left, 360).action).toBeNull();
    expect(feed(armed, poses.left, 1000).action).toBeNull();
  });
  it("accepts a natural return with ankle drift or occlusion, but not an action pose", () => {
    for (const feetY of [0.95, NaN]) {
      const returned = { ...standing, hipX: 0.57, hipY: 0.59, shoulderY: 0.33, feetY };
      expect(isNeutral(returned, baseline)).toBe(true);
      expect(feed(freshDetector(), returned, 0).state.armed).toBe(true);
    }
    for (const pose of Object.values(poses)) expect(isNeutral(pose, baseline)).toBe(false);
  });
  it("calibrates both steps without pre-arming or returning to the exact original coordinates", () => {
    const cal = new Calibration();
    cal.start();
    let now = 0;
    const sample = (f: Features | null, count: number) => {
      for (let i = 0; i < count; i++) { cal.update(f, now); now += 60; }
    };
    sample(standing, 31); // Baseline completes on the last sample; no extra neutral hold.
    expect(cal.step).toBe(1);
    for (const action of ["left", "right"] as const) {
      sample(poses[action], 2);
      expect(cal.returning).toBe(true);
      expect(cal.message).toContain("已辨識");
      sample(poses[action], 20); // Holding the step must never finish the return.
      expect(cal.step).toBe(action === "left" ? 1 : 2);
      sample(null, 2); // Losing a joint does not forget a completed movement.
      sample({ ...standing, hipX: 0.57, hipY: 0.59, shoulderY: 0.33, feetY: NaN }, 5);
      expect(cal.step).toBe(action === "left" ? 2 : 3);
      expect(cal.returning).toBe(false);
    }
  });
  it("does not calibrate a stationary player, wrong direction, or one noisy movement frame", () => {
    const cal = new Calibration();
    cal.start();
    for (let i = 0; i < 50; i++) cal.update(standing, i * 60);
    cal.update(poses.left, 3000);
    cal.update(standing, 3060);
    for (let i = 0; i < 10; i++) cal.update(poses.right, 3120 + i * 60);
    expect(cal.step).toBe(1);
    expect(cal.returning).toBe(false);
  });
  it("requires a continuous return after a camera gap instead of counting missing time", () => {
    const cal = new Calibration();
    cal.start();
    for (let i = 0; i < 31; i++) cal.update(standing, i * 60);
    cal.update(poses.left, 1860);
    cal.update(poses.left, 1920);
    cal.update(standing, 1980);
    cal.update(standing, 4000);
    expect(cal.step).toBe(1);
    cal.update(standing, 4120);
    expect(cal.step).toBe(1);
    cal.update(standing, 4180);
    expect(cal.step).toBe(2);
  });
  it("only finishes calibration after every observed action and return to center", () => {
    const cal = new Calibration();
    cal.start();
    let now = 0;
    for (let i = 0; i < 36; i++) {
      cal.update(standing, now);
      now += 60;
    }
    expect(cal.step).toBe(1);
    expect(cal.done).toBe(false);
    for (const action of ["left", "right", "duck", "jump"] as const) {
      for (let i = 0; i < 5; i++) {
        cal.update(standing, now);
        now += 60;
      }
      for (let i = 0; i < 5; i++) {
        cal.update(poses[action], now);
        now += 60;
      }
      expect(cal.done).toBe(false);
      for (let i = 0; i < 5; i++) {
        cal.update(standing, now);
        now += 60;
      }
    }
    expect(cal.done).toBe(true);
    expect(cal.baseline).not.toBeNull();
  });
});
