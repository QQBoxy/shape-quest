import { describe, expect, it } from "vitest";
import { FaceProbe, probeSignals, probeParts, PROBE_LABEL } from "../../src/face-diagnostics";
import { FACE_ACTIONS, type Action } from "../../src/config";
import type { FaceFeatures } from "../../src/face-actions";
const neutral: FaceFeatures = { x: .65, y: .35, size: .3, roll: 7, yaw: 21, pitch: -17,
  jaw: .08, lipGap: .005, eyeLeft: .04, eyeRight: .05, eyesValid: true, browInner: .02, browLeft: .02, browRight: .02,
  browsValid: true, blinkLeft: .65, blinkRight: .65, apertureLeft: .045, apertureRight: .045,
  smileLeft: .1, smileRight: .12, browDownLeft: .05, browDownRight: .08 };
function harness(action: Action = "left", noise = 0) {
  const p = new FaceProbe(); let now = 0;
  const hold = (change: Partial<FaceFeatures> | null, ms = 650) => {
    for (let t = 0; t < ms; t += 50) { now += 50; p.update(change === null ? null : { ...neutral, ...change }, now); }
  };
  p.select(action); p.calibrate(now);
  for (let i = 0; i < 45; i++) hold({ yaw: neutral.yaw + (i % 2 ? noise : -noise) }, 50);
  const learn = (change: Partial<FaceFeatures>) => { p.learn(now); hold(change, 1900); hold({}, 400); };
  return { p, hold, learn, get now() { return now; } };
}
const movements: [Action, Partial<FaceFeatures>][] = [
  ["jump", { pitch: -29 }], ["duck", { pitch: -5 }], ["left", { yaw: 33 }], ["right", { yaw: 9 }],
  ["pose_lunge", { roll: 19 }], ["pose_knee", { roll: -5 }], ["pose_t", { jaw: .45 }],
  ["pose_arms_l", { browInner: .4, browLeft: .4, browRight: .4 }],
  ["pose_side_bend", { smileLeft: .65, smileRight: .25 }], ["pose_tree", { lipGap: .005 }],
];
describe("isolated webcam diagnostic probe", () => {
  it("exposes all eleven revised mappings and wrapped relative angles", () => {
    expect(FACE_ACTIONS.every(a => PROBE_LABEL[a])).toBe(true);
    expect(probeParts("pose_side_bend")).toEqual([["smile", 1]]);
    expect(probeParts("pose_tree")).toEqual([["closed", 1]]);
    expect(probeSignals({ ...neutral, yaw: -179 }, { ...neutral, yaw: 179 }).yaw).toBe(2);
  });
  for (const [action, change] of movements.filter(([a]) => a !== "pose_tree")) it(`${action}: learns personal amplitude, holds once, releases without fixed position`, () => {
    const h = harness(action); expect(h.p.baseline!.yaw).toBe(21);
    h.learn(change); expect(h.p.thresholds[action]).toBeDefined();
    h.hold({ ...change, x: .2, y: .6 }, 1300); expect(h.p.hits).toBe(1);
    h.hold(change); expect(h.p.hits).toBe(1);
    h.hold({ x: .85, y: .65 }); h.hold(change); expect(h.p.hits).toBe(2);
  });
  it("learns a 12-degree turn and distinguishes it from natural noise without lowering failed thresholds", () => {
    const h = harness("left", .4); h.learn({ yaw: 33 });
    const threshold = h.p.thresholds.left![0]; expect(threshold.enter).toBeCloseTo((33 - h.p.baseline!.yaw) * .65);
    h.hold({ yaw: 22 }); expect(h.p.hits).toBe(0);
    h.p.learn(h.now); h.hold({ yaw: 21.2 }, 1900);
    expect(h.p.thresholds.left![0]).toEqual(threshold);
    const noisy = harness("left", 4); noisy.learn({ yaw: 29 });
    expect(noisy.p.thresholds.left).toBeUndefined();
  });
  it("rejects opposite direction, position translations and threshold jitter", () => {
    const h = harness(); h.learn({ yaw: 33 });
    h.hold({ yaw: 9 }); h.hold({ x: .2 });
    for (let i = 0; i < 10; i++) { h.hold({ yaw: 29 }, 50); h.hold({ yaw: 28 }, 50); }
    expect(h.p.hits).toBe(0);
    h.hold({ yaw: 33, pitch: -22, roll: 12 }); expect(h.p.hits).toBe(1);
  });
  it("rejects single-sided brows, blinking and missing smile data", () => {
    const h = harness("pose_arms_l"); h.learn({ browInner: .4, browLeft: .4, browRight: .4 });
    h.hold({ browLeft: .8 }); h.hold({ eyeLeft: .7, eyeRight: .7, blinkLeft: 1 });
    expect(h.p.hits).toBe(0);
    const smile = harness("pose_side_bend"); smile.learn({ smileLeft: .7, smileRight: .3 });
    smile.hold({ yaw: 9, smileLeft: undefined, smileRight: undefined }); expect(smile.p.hits).toBe(0);
    expect(smile.p.message).toContain("資料不足");
  });
  it("pauses short losses, cancels long losses and rejects reacquisition jumps", () => {
    const h = harness(); h.learn({ yaw: 33 }); h.hold({ yaw: 33 }, 100);
    h.hold(null, 100); expect(h.p.tracking).toBe("短暫中斷");
    h.hold({ yaw: 33 }, 300); expect(h.p.hits).toBe(0);
    h.hold({ yaw: 33 }, 400); expect(h.p.hits).toBe(1);
    h.hold({}); h.hold(null, 700); expect(h.p.tracking).toBe("追蹤失效");
    h.hold({ yaw: 45 }, 1000); expect(h.p.hits).toBe(1);
    h.hold({}); h.hold({ yaw: 33 }); expect(h.p.hits).toBe(2);
  });
  it("counts stable mouth cycles, never joins a cycle across tracking interruption", () => {
    const h = harness("smash"); h.learn({ jaw: .45 });
    h.hold({ jaw: .45 }, 1200); expect(h.p.cycles).toBe(0);
    h.hold(null, 100); h.hold({}, 1000); expect(h.p.cycles).toBe(0);
    for (let i = 0; i < 3; i++) { h.hold({ jaw: .45 }, 400); h.hold({}, 400); }
    expect(h.p.cycles).toBe(3); expect(h.p.hits).toBe(1);
  });
  it("does not accept invalid frames as calibration data or retain a candidate on lesson switches", () => {
    const p = new FaceProbe(); p.calibrate(0);
    for (let t = 50; t < 2500; t += 50) p.update({ ...neutral, yaw: NaN }, t);
    expect(p.baseline).toBeNull();
    const h = harness(); h.learn({ yaw: 33 }); h.hold({ yaw: 33 }, 150);
    h.p.select("left"); h.hold({ yaw: 33 }); expect(h.p.hits).toBe(0);
  });
});

it("diagnoses an already closed mouth without requiring expression learning or an opening", () => {
  const h = harness("pose_tree"); h.hold({}); expect(h.p.hits).toBe(1);
  h.hold({},1000); expect(h.p.hits).toBe(1);
  h.p.select("pose_tree"); h.hold({}); expect(h.p.hits).toBe(2);
});
