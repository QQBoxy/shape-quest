import { CONFIG, type Action } from "./config";
export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
export interface Features {
  hipX: number;
  hipY: number;
  shoulderY: number;
  feetY: number;
  height: number;
  knee: number;
}
export interface Baseline extends Features {
  leftLimit: number;
  rightLimit: number;
}
export const REQUIRED = [0, 11, 12, 23, 24, 25, 26, 27, 28];
export const mirror = (points: Point[]) =>
  points.map((p) => ({ ...p, x: 1 - p.x }));
const mean = (a: number, b: number) => (a + b) / 2;
export function features(
  points: Point[],
  aspect = 4 / 3,
  motion = false,
): Features | null {
  // Standing calibration needs the whole body. Moving legs can occlude each other.
  const visible = (i: number) => {
    const p = points[i];
    const border = motion ? -0.04 : CONFIG.border;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      (p.visibility ?? 0) >= (motion ? 0.35 : CONFIG.visibility) &&
      p.x >= border && p.x <= 1 - border &&
      p.y >= border && p.y <= 1 - border;
  };
  if ((motion ? [11, 12, 23, 24] : REQUIRED).some((i) => !visible(i)))
    return null;
  const ankles = [27, 28].filter(visible);
  const feetY = ankles.length
    ? ankles.reduce((sum, i) => sum + points[i].y, 0) / ankles.length
    : NaN;
  const height = visible(0) ? feetY - points[0].y : NaN;
  if (!motion && height < 0.25) return null;
  const angle = (a: Point, b: Point, c: Point) => {
    const ax = (a.x - b.x) * aspect,
      ay = a.y - b.y;
    const bx = (c.x - b.x) * aspect,
      by = c.y - b.y;
    return Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1),
        ),
      ),
    );
  };
  const knees = [[23, 25, 27], [24, 26, 28]]
    .filter((leg) => leg.every(visible))
    .map(([a, b, c]) => angle(points[a], points[b], points[c]));
  return {
    hipX: mean(points[23].x, points[24].x),
    hipY: mean(points[23].y, points[24].y),
    shoulderY: mean(points[11].y, points[12].y),
    feetY,
    height,
    knee: knees.length ? knees.reduce((sum, k) => sum + k, 0) / knees.length : NaN,
  };
}
export const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
export function makeBaseline(samples: Features[]): Baseline | null {
  if (samples.length < CONFIG.calibrationMinSamples) return null;
  const result = Object.fromEntries(
    Object.keys(samples[0]).map((k) => [
      k,
      median(samples.map((f) => f[k as keyof Features])),
    ]),
  ) as unknown as Features;
  const stable = samples.every(
    (f) =>
      Math.abs(f.hipY - result.hipY) / result.height < CONFIG.neutralRange &&
      Math.abs(f.hipX - result.hipX) / result.height < CONFIG.neutralRange,
  );
  if (!stable || result.knee < 2.5) return null;
  return {
    ...result,
    leftLimit: result.hipX - CONFIG.dodge * result.height,
    rightLimit: result.hipX + CONFIG.dodge * result.height,
  };
}
export function classify(f: Features, b: Baseline): Action | null {
  const up = (b.hipY - f.hipY) / b.height;
  const downShoulder = (f.shoulderY - b.shoulderY) / b.height;
  if (up > CONFIG.jumpHip && (b.feetY - f.feetY) / b.height > CONFIG.jumpFeet)
    return "jump";
  if (
    -up > CONFIG.duckHip &&
    downShoulder > CONFIG.duckShoulder &&
    (!Number.isFinite(f.knee) || f.knee < b.knee - CONFIG.duckKnee)
  )
    return "duck";
  const dx = (f.hipX - b.hipX) / b.height;
  if (Math.abs(up) < CONFIG.dodgeMaxVertical && dx < -CONFIG.dodge)
    return "left";
  if (Math.abs(up) < CONFIG.dodgeMaxVertical && dx > CONFIG.dodge)
    return "right";
  return null;
}
export function isNeutral(f: Features, b: Baseline) {
  return (
    Math.abs(f.hipY - b.hipY) / b.height < CONFIG.neutralHip &&
    Math.abs(f.hipX - b.hipX) / b.height < CONFIG.returnRange &&
    Math.abs(f.shoulderY - b.shoulderY) / b.height < CONFIG.neutralShoulder &&
    // An occluded ankle must not prevent an otherwise upright torso from rearming.
    (!Number.isFinite(f.feetY) ||
      Math.abs(f.feetY - b.feetY) / b.height < CONFIG.neutralFeet)
  );
}
export interface DetectorState {
  armed: boolean;
  candidate: Action | null;
  since: number;
  neutralSince: number | null;
  last: number;
}
export const freshDetector = (): DetectorState => ({
  armed: false,
  candidate: null,
  since: 0,
  neutralSince: null,
  last: -Infinity,
});
export function detectAction(
  previous: DetectorState,
  f: Features | null,
  b: Baseline,
  now: number,
): { state: DetectorState; action: Action | null } {
  if (!f || !Number.isFinite(now))
    return { state: freshDetector(), action: null };
  const s = {
    ...(now - previous.last > CONFIG.poseStaleMs || now <= previous.last
      ? freshDetector()
      : previous),
    last: now,
  };
  if (isNeutral(f, b)) {
    s.neutralSince ??= now;
    if (now - s.neutralSince >= CONFIG.returnMs) s.armed = true;
    s.candidate = null;
    return { state: s, action: null };
  }
  s.neutralSince = null;
  const action = classify(f, b);
  if (!s.armed || !action) {
    s.candidate = null;
    return { state: s, action: null };
  }
  if (s.candidate !== action) {
    s.candidate = action;
    s.since = now;
  }
  if (now - s.since < CONFIG.holdMs) return { state: s, action: null };
  s.armed = false;
  s.candidate = null;
  return { state: s, action };
}
