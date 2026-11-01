import { drawFaceCamera, faceDemoAmount } from "../../src/face-ui";
import { describe, expect, it } from "vitest";
import { FACE_ACTIONS, type Action } from "../../src/config";
import { FaceCalibration, FaceDetector, faceAxes, faceFeatures, faceNeutral, faceEyeEffort, faceEyesOpen, type FaceFeatures } from "../../src/face-actions";
import { Game } from "../../src/game";
const neutral: FaceFeatures = { x: .65, y: .35, size: .3, roll: 3, yaw: 2, pitch: -2,
  jaw: .06, lipGap: .005, smileLeft: .1, smileRight: .1, upperLipLeft: .02, upperLipRight: .02, browDownLeft: .05, browDownRight: .08, eyeLeft: .04, eyeRight: .05, eyesValid: true,
  browInner: .02, browLeft: .02, browRight: .02, browsValid: true,
  blinkLeft: .05, blinkRight: .05, apertureLeft: .22, apertureRight: .22 };
function harness(action: Action) {
  const detector = new FaceDetector();
  let now = 0, id = 1;
  const hits: Action[] = [];
  const hold = (change: Partial<FaceFeatures>, ms = 650, active = true) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      now += 50;
      const hit = detector.update({ ...neutral, ...change }, neutral, now, { id, action, active });
      if (hit) hits.push(hit);
    }
  };
  hold({});
  return { detector, hold, hits, next: () => id++, lose: () => { now += 50; detector.update(null, neutral, now); },
    gap: () => { now += 500; } };
}
const movements: [Action, Partial<FaceFeatures>][] = [
  ["jump", { pitch: -14 }], ["duck", { pitch: 10 }], ["left", { yaw: 14 }], ["right", { yaw: -10 }],
  ["pose_t", { jaw: .7 }], ["pose_lunge", { roll: 24 }], ["pose_knee", { roll: -18 }],
  ["pose_arms_l", { eyeLeft: .6, eyeRight: .6 }],
  ["pose_side_bend", { smileLeft: .7, smileRight: .35 }], ["pose_tree", { jaw: .06, lipGap: .005 }],
];
describe("personalized face action events", () => {
  for (const [action, change] of movements.filter(([a]) => a !== "pose_tree")) it(`${action} holds, fires once and rearms at neutral`, () => {
    const h = harness(action);
    h.hold(change, 1200); expect(h.hits).toEqual([action]);
    h.next(); h.hold(change); expect(h.hits).toHaveLength(1);
    h.hold({}); h.hold(change); expect(h.hits).toEqual([action, action]);
  });
  it("rejects pure translation, the wrong rotation axis and reverse turns", () => {
    const h = harness("left");
    h.hold({ x: .56 }); h.hold({ pitch: 30 }); h.hold({ roll: 24 }); h.hold({ yaw: -20 });
    h.hold({}); h.hold({ yaw: 14 }, 50); h.hold({});
    expect(h.hits).toEqual([]);
    h.hold({ yaw: 14, pitch: 5, roll: 8 }); expect(h.hits).toEqual(["left"]);
  });
  it("ignores inactive targets and accepts valid directions as soon as a target is active", () => {
    const h = harness("left");
    h.hold({ yaw: 14 }, 650, false); expect(h.hits).toEqual([]);
    h.hold({}); h.hold({ yaw: 14 }); expect(h.hits).toEqual(["left"]);
    h.hold({ yaw: 14 }); expect(h.hits).toEqual(["left"]);
  });
  it("rejects one wide eye, missing eye evidence, blinking and ordinary talking", () => {
    const h = harness("pose_arms_l");
    h.hold({ eyeLeft: .8 }); h.hold({ eyeLeft: .7, eyeRight: .7, eyesValid: false });
    h.hold({ jaw: .5, eyesValid: false }); expect(h.hits).toEqual([]);
    const mouth = harness("pose_t");
    for (let i = 0; i < 8; i++) { mouth.hold({ jaw: .35 }, 100); mouth.hold({}, 150); }
    expect(mouth.hits).toEqual([]);
  });
  it("invalid data, missing tracking and long gaps erase a partial hold and require neutral", () => {
    for (const loss of ["missing", "gap", "invalid"] as const) {
      const h = harness("pose_t"); h.hold({ jaw: .7 }, 200);
      if (loss === "missing") h.lose();
      else if (loss === "gap") h.gap();
      else h.hold({ jaw: NaN }, 50);
      h.hold({ jaw: .7 }); expect(h.hits).toEqual([]);
      h.hold({}); h.hold({ jaw: .7 }); expect(h.hits).toEqual(["pose_t"]);
    }
  });
  it("only counts stable full mouth cycles inside the active smash window", () => {
    const h = harness("smash");
    h.hold({ jaw: .7 }, 1000, false); h.hold({}, 500, false);
    expect(h.detector.energy).toBe(0);
    h.hold({ jaw: .7 }, 1000); // Must first close inside the active window.
    expect(h.detector.energy).toBe(0);
    h.hold({});
    h.hold({ jaw: .7 }, 1200); expect(h.detector.energy).toBe(0);
    h.hold({}); expect(h.detector.energy).toBe(1);
    for (let i = 0; i < 5; i++) { h.hold({ jaw: .25 }, 50); h.hold({ jaw: .18 }, 50); }
    expect(h.detector.energy).toBe(1);
    h.hold({ jaw: .7 }); h.hold({}); expect(h.detector.energy).toBe(2);
    h.next(); h.hold({}); expect(h.detector.energy).toBe(0);
    for (let i = 0; i < 3; i++) { h.hold({ jaw: .7 }, 450); h.hold({}, 450); }
    expect(h.detector.energy).toBe(3); expect(h.hits).toContain("smash");
    h.lose(); expect(h.detector.energy).toBe(0);
  });
});
function result(roll = 0, yaw = 0, pitch = 0) {
  const p = Array.from({ length: 478 }, () => ({ x: .5, y: .4 }));
  p[33] = { x: .4, y: .35 }; p[263] = { x: .6, y: .35 };
  p[133] = { x: .46, y: .35 }; p[362] = { x: .54, y: .35 };
  p[159] = { x: .43, y: .33 }; p[145] = { x: .43, y: .37 };
  p[386] = { x: .57, y: .33 }; p[374] = { x: .57, y: .37 };
  const r = roll * Math.PI / 180, y = yaw * Math.PI / 180, x = pitch * Math.PI / 180;
  const cr = Math.cos(r), sr = Math.sin(r), cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
  // Column-major Rz * Ry * Rx, as emitted by MediaPipe MatrixData.
  const data = [cr*cy,sr*cy,-sy,0, cr*sy*sx-sr*cx,sr*sy*sx+cr*cx,cy*sx,0,
    cr*sy*cx+sr*sx,sr*sy*cx-cr*sx,cy*cx,0, 0,0,-40,1];
  return { faceLandmarks: [p], faceBlendshapes: [{ categories: [
    { categoryName: "jawOpen", score: .1 }, { categoryName: "eyeWideLeft", score: .2 },
    { categoryName: "eyeWideRight", score: .2 }, { categoryName: "eyeBlinkLeft", score: .05 },
    { categoryName: "eyeBlinkRight", score: .05 },
    { categoryName: "browInnerUp", score: .02 }, { categoryName: "browOuterUpLeft", score: .02 },
    { categoryName: "browOuterUpRight", score: .02 },
  ] }], facialTransformationMatrixes: [{ rows: 4, columns: 4, data }] };
}
it("extracts matrix angles independently, mirrors horizontal translation and validates eyes", () => {
  const raw = result(20, 25, 12), sample = faceFeatures(raw, 4/3);
  expect(sample.features!.roll).toBeCloseTo(-20);
  expect(sample.features!.yaw).toBeCloseTo(25);
  expect(sample.features!.pitch).toBeCloseTo(12);
  expect(sample.features!.eyesValid).toBe(true);
  for (const p of raw.faceLandmarks[0]) p.x += .05;
  expect(faceFeatures(raw, 4/3).features!.x).toBeLessThan(sample.features!.x);
  raw.faceLandmarks[0][159].y = .35; raw.faceLandmarks[0][145].y = .35;
  expect(faceFeatures(raw, 4/3).features!.eyesValid).toBe(true);
  expect(faceEyesOpen(faceFeatures(raw, 4/3).features!, sample.features!)).toBe(false);
  raw.facialTransformationMatrixes = [];
  expect(faceFeatures(raw, 4/3).features).toBeNull();
});
it("keeps default body rounds and uses shared score, health and pause for all 11 face actions", () => {
  const game = new Game(); game.start(FACE_ACTIONS); game.tick(3);
  expect(new Set(game.obstacles.map(o => o.action)).size).toBe(11);
  for (const o of game.obstacles) {
    game.tick(o.collision - .1 - game.time); game.accept({ id: o.id, action: o.action, time: game.time });
  }
  expect(game.successes).toBe(game.obstacles.length);
  expect(game.score).toBe(game.successes * 100);
  game.start(); expect(new Set(game.obstacles.map(o => o.action)).size).toBe(4);
});
it("face calibration records a stable personal neutral and never passes absent faces", () => {
  const c = new FaceCalibration(); c.start();
  for (let t = 50; t < 3000; t += 50) c.update(null, t);
  expect(c.step).toBe(0); expect(c.done).toBe(false);
  for (let t = 3000; t < 5500; t += 50) c.update(neutral, t);
  expect(c.step).toBe(1); expect(c.baseline).toEqual(neutral);
});

it("accepts a comfortable off-center return and blinking without relaxing action entry", () => {
  const relaxed = { ...neutral, x: neutral.x + .036, y: neutral.y + .036,
    roll: neutral.roll + 2, jaw: neutral.jaw + .13, eyeLeft: neutral.eyeLeft + .1,
    eyeRight: neutral.eyeRight + .1 };
  expect(faceNeutral(relaxed, neutral)).toBe(true);
  expect(faceNeutral({ ...relaxed, eyesValid: false }, neutral)).toBe(true);
  expect(faceNeutral({ ...neutral, x: .2, y: .7 }, neutral)).toBe(true);
  expect(faceNeutral({ ...neutral, jaw: .7 }, neutral)).toBe(false);
  expect(faceNeutral({ ...neutral, eyeLeft: .6, eyeRight: .6 }, neutral)).toBe(false);
  const h = harness("left");
  h.hold({ yaw: 14 });
  h.hold({ x: .2, y: .7 });
  h.hold({ yaw: 14 });
  expect(h.hits).toEqual(["left", "left"]);
});
it("calibration advances after a slightly offset return even during blinking", () => {
  const c = new FaceCalibration(); c.start();
  let now = 0;
  const hold = (change: Partial<FaceFeatures>, ms: number) => {
    for (let t = 0; t < ms; t += 50) { now += 50; c.update({ ...neutral, ...change }, now); }
  };
  hold({}, 2500); expect(c.step).toBe(1);
  hold({ pitch: -14 }, 650); expect(c.returning).toBe(true);
  hold({ x: .686, y: .386, eyesValid: false }, 400);
  expect(c.step).toBe(2); expect(c.returning).toBe(false);
});

it("calibrates a natural screen-reading head angle instead of requiring camera alignment", () => {
  const c = new FaceCalibration(); c.start();
  const reading = { ...neutral, yaw: 26, pitch: -24, roll: 7 };
  for (let t = 50; t < 2500; t += 50) c.update(reading, t);
  expect(c.step).toBe(1);
  expect(c.baseline).toEqual(reading);
  expect(faceNeutral(reading, c.baseline!)).toBe(true);
  const detector = new FaceDetector();
  const hits: Action[] = [];
  for (let t = 50; t < 1500; t += 50) {
    const hit = detector.update(t < 700 ? reading : { ...reading, pitch: reading.pitch - 12 },
      c.baseline!, t, { id: 1, action: "jump", active: true });
    if (hit) hits.push(hit);
  }
  expect(hits).toEqual(["jump"]);
});

it("does not require a second neutral hold after advancing each calibration lesson", () => {
  const c = new FaceCalibration(); c.start();
  let now = 0;
  const hold = (change: Partial<FaceFeatures>, ms: number) => {
    for (let t = 0; t < ms; t += 50) { now += 50; c.update({ ...neutral, ...change }, now); }
  };
  hold({}, 2100);
  expect(c.step).toBe(1);
  for (const [index, [, change]] of movements.entries()) {
    hold(change, 700);
    if (index === 9) { expect(c.step).toBe(11); expect(c.returning).toBe(false); continue; }
    expect(c.returning, `lesson ${index + 1}`).toBe(true);
    hold({}, 250); expect(c.step).toBe(index + 2);
  }
  for (let i = 0; i < 3; i++) { hold({ jaw: .7 }, 450); hold({}, 450); }
  hold({}, 250);
  expect(c.done).toBe(true);
});
it("uses real MediaPipe rotation matrices with the correct mirrored tilt directions", () => {
  // Recorded from official portrait.jpg at image rotations -20 and +20 degrees.
  // A clockwise source tilt appears LEFT in the mirrored camera preview.
  const cases: [Action, number[]][] = [
    ["pose_knee", [0.93365228,0.35633465,-0.03633059,0,-0.35137871,0.93087006,0.10007266,0,0.06947839,-0.0806672,0.99431676,0,-8.4471,21.92475,-84.04008,1]],
    ["pose_lunge", [0.94791788,-0.31646696,-0.03605466,0,0.31851408,0.94190621,0.10658791,0,0.00022855,-0.1125206,0.99364913,0,7.64742,22.39958,-84.7207,1]],
  ];
  const b = faceFeatures(result(), 1).features!;
  for (const [action, data] of cases) {
    const raw = result(); raw.facialTransformationMatrixes[0].data = data;
    const f = faceFeatures(raw, 1).features!;
    expect(Math.sign(f.roll)).toBe(action === "pose_lunge" ? 1 : -1);
    const detector = new FaceDetector(); detector.startFromNeutral(b, b, 0);
    const hits: Action[] = [];
    for (let t = 50; t <= 800; t += 50) {
      const hit = detector.update(f, b, t, { id: 1, action, active: true });
      if (hit) hits.push(hit);
    }
    expect(hits).toEqual([action]);
  }
});

it("combines gentle eye opening and bilateral eyebrow lift into one accessible eye pose", () => {
  const gentle = { eyeLeft: neutral.eyeLeft + .035, eyeRight: neutral.eyeRight + .035,
    browInner: .18, browLeft: .18, browRight: .18 };
  expect(faceEyeEffort({ ...neutral, ...gentle }, neutral)).toBeGreaterThan(1);
  const h = harness("pose_arms_l"); h.hold(gentle);
  expect(h.hits).toEqual(["pose_arms_l"]);
  h.hold(gentle); expect(h.hits).toHaveLength(1);
  h.hold({ ...gentle, eyesValid: false }); h.hold(gentle);
  expect(h.hits).toHaveLength(1);
  h.hold({}); h.hold(gentle); expect(h.hits).toHaveLength(2);
  const blink = harness("pose_arms_l"); blink.hold({ ...gentle, eyesValid: false });
  expect(blink.hits).toEqual([]);
  const oneBrow = harness("pose_arms_l"); oneBrow.hold({ browLeft: .9 });
  expect(oneBrow.hits).toEqual([]);
  const missing = harness("pose_arms_l"); missing.hold({ ...gentle, browsValid: false });
  expect(missing.hits).toEqual([]);
});
it("releases an eye pose on a relaxed return without replaying a latched expression", () => {
  const h = harness("pose_arms_l");
  h.hold({ eyeLeft: .6, eyeRight: .6 });
  h.hold({ eyeLeft: neutral.eyeLeft + .1, eyeRight: neutral.eyeRight + .1 }, 1300);
  expect(h.hits).toHaveLength(1);
});

it("calibrates naturally small eyes without asking for wider eyes and accepts eyebrow assistance", () => {
  const small = { ...neutral, apertureLeft: .045, apertureRight: .04, blinkLeft: .65, blinkRight: .62 };
  const c = new FaceCalibration(); c.start();
  for (let t = 50; t < 2500; t += 50) c.update(small, t);
  expect(c.step).toBe(1); expect(c.baseline).toEqual(small);
  expect(faceEyesOpen(small, c.baseline!)).toBe(true);
  const highNaturalBlink = { ...small, blinkLeft: .98, blinkRight: .98 };
  expect(faceEyesOpen(highNaturalBlink, highNaturalBlink)).toBe(true);
  const expressive = { ...small, eyeLeft: small.eyeLeft + .025, eyeRight: small.eyeRight + .025,
    browInner: .2, browLeft: .2, browRight: .2 };
  expect(faceEyeEffort(expressive, c.baseline!)).toBeGreaterThan(1);
  expect(faceEyeEffort({ ...expressive, blinkLeft: .99, blinkRight: .99,
    apertureLeft: .001, apertureRight: .001 }, c.baseline!)).toBe(0);
});
it("does not block neutral calibration when eye information is temporarily unavailable", () => {
  const c = new FaceCalibration(); c.start();
  for (let t = 50; t < 2500; t += 50) c.update({ ...neutral, eyesValid: false }, t);
  expect(c.step).toBe(1); expect(c.done).toBe(false);
});
it("treats small lid openings and high natural blink coefficients as valid eye data", () => {
  const raw = result();
  raw.faceLandmarks[0][159].y = raw.faceLandmarks[0][386].y = .349;
  raw.faceLandmarks[0][145].y = raw.faceLandmarks[0][374].y = .351;
  raw.faceBlendshapes[0].categories.filter(c => c.categoryName.startsWith("eyeBlink")).forEach(c => c.score = .65);
  const f = faceFeatures(raw, 4/3).features!;
  expect(f.eyesValid).toBe(true);
  expect(faceEyesOpen(f, f)).toBe(true);
});

it("starts each face demonstration at neutral, moves outward, holds and returns smoothly", () => {
  expect(faceDemoAmount(0, "pose_lunge")).toBe(0);
  expect(faceDemoAmount(400, "pose_lunge")).toBe(0);
  expect(faceDemoAmount(900, "pose_lunge")).toBeGreaterThan(0);
  expect(faceDemoAmount(900, "pose_lunge")).toBeLessThan(1);
  expect(faceDemoAmount(1500, "pose_lunge")).toBe(1);
  expect(faceDemoAmount(2400, "pose_lunge")).toBeGreaterThan(0);
  expect(faceDemoAmount(2400, "pose_lunge")).toBeLessThan(1);
  expect(faceDemoAmount(3299, "pose_lunge")).toBe(0);
  expect(faceDemoAmount(3300, "pose_lunge")).toBe(0);
  expect(faceDemoAmount(0, "smash")).toBe(0);
  expect(faceDemoAmount(1800, "smash")).toBe(0);
  expect(faceDemoAmount(0, "pose_lunge", true)).toBe(1);
});

it("exposes smile coefficients and warns diagnostics about degenerate or reflected matrices", () => {
  const raw = result();
  raw.faceBlendshapes[0].categories.push({ categoryName: "mouthSmileLeft", score: .7 }, { categoryName: "mouthSmileRight", score: .3 });
  const sample = faceFeatures(raw, 4/3);
  expect(sample.features!.smileLeft).toBe(.7);
  expect(sample.features!.smileRight).toBe(.3);
  expect(sample.trackingIssue).toBeUndefined();
  raw.facialTransformationMatrixes[0].data[0] = -1;
  expect(faceFeatures(raw, 4/3).trackingIssue).toBeDefined();
  raw.facialTransformationMatrixes[0].data.fill(0);
  expect(faceFeatures(raw, 4/3).trackingIssue).toBeDefined();
});

it("learns comfortable rotation amplitudes during the real tutorial and uses them in play", () => {
  const thresholds: number[] = [];
  for (const amplitude of [10, 18]) {
    const c = new FaceCalibration(); c.start(); let now = 0;
    const hold = (change: Partial<FaceFeatures>, ms: number) => {
      for (let t = 0; t < ms; t += 50) { now += 50; c.update({ ...neutral, ...change }, now); }
    };
    hold({}, 2100); hold({ x: .2, y: .7 }, 800);
    expect(c.step).toBe(1); expect(c.returning).toBe(false);
    hold({ pitch: neutral.pitch - amplitude, x: .2, y: .7 }, 800);
    expect(c.returning).toBe(true);
    hold({ x: .2, y: .7 }, 300); expect(c.step).toBe(2);
    const threshold = c.profile.thresholds.jump![0]; thresholds.push(threshold.enter);
    expect(threshold.learned).toBeCloseTo(amplitude);
    const d = new FaceDetector(); const hits: Action[] = [];
    for (let t = 50; t < 1800; t += 50) {
      const result = d.update({ ...neutral, x: .8, y: .6, pitch: t < 650 ? neutral.pitch : neutral.pitch - amplitude },
        c.baseline!, t, { id: 1, action: "jump", active: true }, c.profile);
      if (result) hits.push(result);
    }
    expect(hits).toEqual(["jump"]);
  }
  expect(thresholds[1]).toBeGreaterThan(thresholds[0]);
});

it("does not use a blink to release and replay an eye expression that is still held", () => {
  const h = harness("pose_arms_l"); const wide = { eyeLeft: .6, eyeRight: .6 };
  h.hold(wide); expect(h.hits).toHaveLength(1);
  h.hold({ ...wide, blinkLeft: .9, blinkRight: .9, apertureLeft: .001, apertureRight: .001 });
  h.hold(wide); expect(h.hits).toHaveLength(1);
  h.hold({}); h.hold(wide); expect(h.hits).toHaveLength(2);
});

it("learns before release so a comfortable partial return can advance each direction lesson", () => {
  const c = new FaceCalibration(); c.start(); let now = 0;
  const hold = (change: Partial<FaceFeatures>, ms = 700) => {
    for (let t = 0; t < ms; t += 50) { now += 50; c.update({ ...neutral, ...change }, now); }
  };
  hold({}, 2100);
  const lessons: [Action, Partial<FaceFeatures>, Partial<FaceFeatures>][] = [
    ["jump", { pitch: -14 }, { pitch: -4.5 }],
    ["duck", { pitch: 10 }, { pitch: .5 }],
    ["left", { yaw: 14 }, { yaw: 4.5 }],
    ["right", { yaw: -10 }, { yaw: -.5 }],
  ];
  for (const [i, [action, move, relaxed]] of lessons.entries()) {
    hold(move); expect(c.returning).toBe(true);
    const threshold = c.profile.thresholds[action]![0];
    expect(threshold.learned).toBeCloseTo(12);
    expect(threshold.exit).toBeCloseTo(3.51);
    expect(c.message).toContain("接下來");
    hold({ ...relaxed, x: .2, y: .65, roll: 11 }, 250);
    expect(c.step).toBe(i + 2); expect(c.returning).toBe(false);
    expect(c.message).toContain("接下來");
    expect(c.profile.thresholds[action]![0]).toEqual(threshold);
    hold({ ...relaxed, x: .2, y: .65, roll: 11 }, 100);
    expect(c.message).toContain("接下來");
    expect(c.message).not.toContain("方向相反");
  }
});

it("does not treat a held pose or missing tracking as a completed release", () => {
  const c = new FaceCalibration(); c.start(); let now = 0;
  const hold = (change: Partial<FaceFeatures> | null, ms = 700) => {
    for (let t = 0; t < ms; t += 50) { now += 50; c.update(change === null ? null : { ...neutral, ...change }, now); }
  };
  hold({}, 2100); hold({ pitch: -14 });
  hold({ pitch: -11 }); expect(c.returning).toBe(true); expect(c.step).toBe(1);
  expect(c.releaseProgress).toBe(0);
  hold({ pitch: -4.5 }, 150); expect(c.step).toBe(1);
  expect(c.releaseProgress).toBeGreaterThan(0);
  expect(c.releaseProgress).toBeLessThan(1);
  hold(null, 250); expect(c.step).toBe(1);
  expect(c.releaseProgress).toBe(0);
  hold({ pitch: -4.5 }, 150); expect(c.step).toBe(1);
  expect(c.releaseProgress).toBeGreaterThan(0);
  expect(c.releaseProgress).toBeLessThan(1);
  hold({ pitch: -4.5 }, 150); expect(c.step).toBe(2);
});

it("keeps the full desktop camera image above the caption instead of scaling a mobile overlay", () => {
  let image: number[] = [];
  const context = new Proxy({
    drawImage: (_video: unknown, ...bounds: number[]) => { image = bounds; },
    measureText: (text: string) => ({ width: text.length * 24 }),
  }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });
  const canvas = { clientWidth: 1464, clientHeight: 600, width: 0, height: 0,
    getContext: () => context, setAttribute: () => {} } as unknown as HTMLCanvasElement;
  const video = { videoWidth: 1920, videoHeight: 1080, readyState: 2 } as HTMLVideoElement;
  drawFaceCamera(canvas, video, neutral, {
    action: "left", amount: 0, progress: 0, message: "輕輕向左轉頭。",
    live: neutral, returning: false,
  });
  const [x, y, width, height] = image;
  expect(canvas.width).toBeGreaterThanOrEqual(canvas.clientWidth);
  expect(x).toBeGreaterThanOrEqual(0);
  expect(y).toBeGreaterThan(0);
  expect(x + width).toBeLessThanOrEqual(canvas.width);
  expect(y + height).toBeLessThanOrEqual(canvas.height * .8);
  expect(width / height).toBeCloseTo(video.videoWidth / video.videoHeight);
});

it("maps all six wall poses to one independent instruction, with no yaw condition on expressions", () => {
  const channels = ["pose_t", "pose_lunge", "pose_knee", "pose_arms_l", "pose_side_bend", "pose_tree"] as const;
  expect(channels.map(a => faceAxes(a))).toEqual([[["jaw", 1]], [["roll", 1]], [["roll", -1]], [["eyes", 1]], [["smile", 1]], [["closed", 1]]]);
});

it("smiles independently with an open jaw, asymmetric corners and an off-center tilted head", () => {
  const h = harness("pose_side_bend");
  h.hold({ yaw: -12, jaw: .7 }); expect(h.hits).toEqual([]);
  h.hold({ smileLeft: .7, smileRight: .25, jaw: .4, x: .2, y: .6, pitch: 8, roll: 10 });
  expect(h.hits).toEqual(["pose_side_bend"]);
});

for (const [action, strong, weak] of [
  ["pose_side_bend", { smileLeft: .5, smileRight: .5 }, { smileLeft: .228, smileRight: .228 }],
] as const) {
  it(`${action}: uses hysteresis and clears partial holds on loss and target changes`, () => {
    const h = harness(action);
    h.hold(strong, 150); h.hold(weak, 400); expect(h.hits).toEqual([action]);
    h.hold(weak, 500); expect(h.hits).toHaveLength(1);
    h.hold({}); h.next(); h.hold(strong, 150); h.lose(); h.hold(strong); expect(h.hits).toHaveLength(1);
    h.hold({}); h.hold(strong); expect(h.hits).toHaveLength(2);
  });
}

it("extracts the new frown and upper-lip diagnostics without inventing missing coefficients", () => {
  const raw = result(); raw.faceBlendshapes[0].categories.push(
    { categoryName: "browDownLeft", score: .4 }, { categoryName: "browDownRight", score: .3 },
    { categoryName: "mouthUpperUpLeft", score: .2 }, { categoryName: "mouthUpperUpRight", score: .15 });
  const f = faceFeatures(raw, 4/3).features!;
  expect(f.browDownLeft).toBe(.4); expect(f.browDownRight).toBe(.3);
  expect(f.upperLipLeft).toBe(.2); expect(f.upperLipRight).toBe(.15);
  raw.faceBlendshapes[0].categories.find(c => c.categoryName === "browDownLeft")!.score = NaN;
  expect(faceFeatures(raw, 4/3).features!.browDownLeft).toBeUndefined();
});

it("accepts a first mouth and smile action while unrelated earlier actions are still held", () => {
  const d = new FaceDetector(); let now = 0; const hits: Action[] = [];
  const hold = (id: number, action: Action, change: Partial<FaceFeatures>, ms = 700) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50;
      const hit = d.update({ ...neutral, ...change }, neutral, now, { id, action, active: true });
      if (hit) hits.push(hit);
    }
  };
  hold(1, "right", {}); hold(1, "right", { yaw: -10 });
  expect(hits).toEqual(["right"]);
  // The right turn remains held: the mouth's own prior release is sufficient.
  hold(2, "pose_t", { yaw: -10, jaw: .7 });
  expect(hits).toEqual(["right", "pose_t"]);
  hold(3, "pose_side_bend", { yaw: -10, jaw: .7, smileLeft: .7, smileRight: .35 });
  expect(hits).toEqual(["right", "pose_t", "pose_side_bend"]);

});

it("learns independent readiness before the prompt, and clears it on tracking loss", () => {
  const d = new FaceDetector(); let now = 0; const hits: Action[] = [];
  const hold = (change: Partial<FaceFeatures>, action?: Action, ms = 650) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50; const hit = d.update({ ...neutral, ...change }, neutral, now, action ? { id: 1, action, active: true } : undefined);
      if (hit) hits.push(hit);
    }
  };
  hold({ yaw: -10 }); hold({ yaw: -10, jaw: .7 }, "pose_t"); expect(hits).toEqual(["pose_t"]);
  now += 50; d.update(null, neutral, now);
  hold({ smileLeft: .7, smileRight: .35 }, "pose_side_bend"); expect(hits).toHaveLength(1);
  hold({}, "pose_side_bend"); hold({ smileLeft: .7, smileRight: .35 }, "pose_side_bend"); expect(hits).toHaveLength(2);
});

