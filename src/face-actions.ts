import { CONFIG, FACE_ACTIONS, type Action } from "./config";
import { median, type Point } from "./actions";

// Initial webcam tuning values; keep these together for real-device validation.
export const FACE_CONFIG = {
  smoothingMs: 65, rotationEnter: 8, rotationExit: 3.6,
  minimumRotation: 3, minimumExpression: 0.05, minimumEyeEffort: 0.3,
  noiseMultiplier: 4, learnedRatio: 0.65, releaseRatio: 0.45, smileDelta: 0.16,
  directionHoldMs: 110, returnMs: 180, poseHoldMs: 300,
  poseGapMs: 150, // Experimental pause budget per candidate; verify with webcam data.
  mouthOpenDelta: 0.23, mouthCloseDelta: 0.09,
  // Experimental absolute closure bounds; a naturally open baseline cannot raise them.
  closedJawMax: 0.18, closedLipGapMax: 0.025,
  closedJawFloor: 0.10, closedLipGapFloor: 0.012,
  closedJawMargin: 0.03, closedLipGapMargin: 0.005,
  neutralMouthDelta: 0.16,
  eyeWideDelta: 0.14, browUpDelta: 0.16, browWeight: 0.85,
  blinkDelta: 0.3, eyelidOpenRatio: 0.45, eyelidMinimum: 0.003,
  smashCycles: 3, mouthStateMs: 130,
} as const;
export const FACE_LABEL: Record<Action, string> = {
  jump: "上仰", duck: "低頭", left: "向左轉頭", right: "向右轉頭",
  pose_t: "張大嘴巴", pose_lunge: "頭往左歪", pose_knee: "頭往右歪",
  pose_arms_l: "睜眼、眉毛輕抬", pose_side_bend: "露齒微笑", pose_tree: "自然閉嘴巴",
  smash: "連續張嘴、閉嘴",
};
export const FACE_HINT: Record<Action, string> = {
  jump: "輕輕抬起下巴、頭往上仰，舒服的幅度就好。",
  duck: "輕輕低頭，像點頭往下看，舒服的幅度就好。",
  left: "鼻尖輕輕轉向畫面左邊，不是平移整顆頭；完成後自然放鬆。",
  right: "鼻尖輕輕轉向畫面右邊，不是平移整顆頭；完成後自然放鬆。",
  pose_t: "自然張大嘴巴，維持一下，不需要微笑。",
  pose_lunge: "頭頂往畫面左邊歪，像耳朵靠近肩膀，不是轉頭。",
  pose_knee: "頭頂往畫面右邊歪，像耳朵靠近肩膀，不是轉頭。",
  pose_arms_l: "雙眼稍微睜開，搭配眉毛輕輕上抬，維持一下，不用勉強撐大。",
  pose_side_bend: "自然露齒微笑，嘴角向兩側、上方拉開，不必咬緊牙齒、閉嘴或轉頭。",
  pose_tree: "嘴唇自然輕輕接觸，保持一下就好；原本就閉嘴也可以，不必先張嘴或用力抿嘴。",
  smash: "慢慢張嘴再閉嘴，完成 3 次就能擊破，不用快速動作。",
};
export interface FaceFeatures {
  x: number; y: number; size: number;
  roll: number; yaw: number; pitch: number;
  lipGap?: number; // Maximum of three inner-lip gaps, divided by inter-eye scale.
  jaw: number; eyeLeft: number; eyeRight: number;
  smileLeft?: number; smileRight?: number;
  upperLipLeft?: number; upperLipRight?: number;
  browDownLeft?: number; browDownRight?: number;
  eyesValid: boolean;
  blinkLeft: number; blinkRight: number; apertureLeft: number; apertureRight: number;
  browInner: number; browLeft: number; browRight: number; browsValid: boolean;
}
export const FACE_OPTIONAL_FEATURES = ["smileLeft", "smileRight", "upperLipLeft", "upperLipRight", "browDownLeft", "browDownRight", "lipGap"] as const;
export type FaceBaseline = FaceFeatures;
export interface FaceSample { points: Point[]; features: FaceFeatures | null; trackingIssue?: string }
interface FaceResult {
  faceLandmarks: Point[][];
  faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
  facialTransformationMatrixes: { rows: number; columns: number; data: number[] }[];
}
const degrees = (n: number) => n * 180 / Math.PI;
export const angleDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export function faceFeatures(result: FaceResult, aspect: number): FaceSample {
  const raw = result.faceLandmarks[0] ?? [];
  const points = raw.map(p => ({ ...p, x: 1 - p.x }));
  const invalid = { points, features: null };
  const m = result.facialTransformationMatrixes[0];
  if (!Number.isFinite(aspect) || aspect <= 0 || !m || m.rows !== 4 || m.columns !== 4 ||
      m.data.length !== 16 || !m.data.every(Number.isFinite)) return invalid;
  const valid = (i: number) => {
    const p = raw[i];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x > 0.015 && p.x < 0.985 && p.y > 0.015 && p.y < 0.985;
  };
  // Upper-face anchors avoid shifting the center when the jaw opens.
  if ([10, 33, 263, 168].some(i => !valid(i))) return invalid;
  const distance = (a: number, b: number) => Math.hypot(
    (raw[a].x - raw[b].x) * aspect, raw[a].y - raw[b].y);
  const size = distance(33, 263);
  if (size < 0.065) return invalid;
  // Inner contours from MediaPipe FACEMESH_LIPS. Requiring a usable mouth
  // width prevents a collapsed/missing mesh from looking like closed lips.
  const lipsValid = [13, 14, 82, 87, 312, 317, 78, 308].every(valid) && distance(78, 308) / size > 0.15;
  const lipGap = lipsValid ? Math.max(distance(13, 14), distance(82, 87), distance(312, 317)) / size : undefined;
  const categories = result.faceBlendshapes[0]?.categories ?? [];
  const scores = new Map(categories.map(c => [c.categoryName, c.score]));
  const jaw = scores.get("jawOpen");
  if (jaw === undefined || !Number.isFinite(jaw) || jaw < 0 || jaw > 1) return invalid;
  const eyeScore = (name: string) => {
    const s = scores.get(name);
    return s !== undefined && Number.isFinite(s) && s >= 0 && s <= 1 ? s : null;
  };
  const left = eyeScore("eyeWideLeft"), right = eyeScore("eyeWideRight");
  const blinkLeft = eyeScore("eyeBlinkLeft"), blinkRight = eyeScore("eyeBlinkRight");
  const browInner = eyeScore("browInnerUp"), browLeft = eyeScore("browOuterUpLeft"), browRight = eyeScore("browOuterUpRight");
  // Data availability is independent of eye size or how far the lids are open.
  // Openness and blinking are judged against this player's natural baseline later.
  const eyesValid = left !== null && right !== null && blinkLeft !== null && blinkRight !== null &&
    [133, 159, 145, 362, 386, 374].every(valid) && distance(33, 133) > 0.005 && distance(263, 362) > 0.005;
  const apertureLeft = eyesValid ? distance(159, 145) / distance(33, 133) : 0;
  const apertureRight = eyesValid ? distance(386, 374) / distance(263, 362) : 0;
  // MediaPipe MatrixData is column-major. Camera +Y points up; mirroring X
  // flips the roll sign: positive model roll leans right on the mirrored screen.
  const d = m.data;
  const roll = -degrees(Math.atan2(d[1], d[0]));
  const yaw = degrees(Math.atan2(-d[2], Math.hypot(d[0], d[1])));
  const pitch = degrees(Math.atan2(d[6], d[10]));
  // Reject suspect geometry at callers before learning or recognizing actions.
  const axes = [[d[0], d[1], d[2]], [d[4], d[5], d[6]], [d[8], d[9], d[10]]];
  const lengths = axes.map(v => Math.hypot(...v));
  const unit = axes.map((v, i) => v.map(n => n / lengths[i]));
  const dot = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);
  const determinant = unit[0][0] * (unit[1][1] * unit[2][2] - unit[1][2] * unit[2][1])
    - unit[1][0] * (unit[0][1] * unit[2][2] - unit[0][2] * unit[2][1])
    + unit[2][0] * (unit[0][1] * unit[1][2] - unit[0][2] * unit[1][1]);
  const trackingIssue = lengths.some(n => n < 1e-6) || Math.max(...lengths) / Math.min(...lengths) > 1.1 ||
    Math.abs(dot(unit[0], unit[1])) > 0.1 || Math.abs(dot(unit[0], unit[2])) > 0.1 ||
    Math.abs(dot(unit[1], unit[2])) > 0.1 || determinant < 0.9 || Math.abs(yaw) > 80
    ? "旋轉矩陣失真或接近角度奇異點，暫不採計" : undefined;
  return { points, trackingIssue, features: {
    x: ((points[33].x + points[263].x) / 2) * aspect,
    y: (points[33].y + points[263].y) / 2,
    size, roll, yaw, pitch, jaw, lipGap, smileLeft: eyeScore("mouthSmileLeft") ?? undefined,
    smileRight: eyeScore("mouthSmileRight") ?? undefined,
    upperLipLeft: eyeScore("mouthUpperUpLeft") ?? undefined, upperLipRight: eyeScore("mouthUpperUpRight") ?? undefined,
    browDownLeft: eyeScore("browDownLeft") ?? undefined, browDownRight: eyeScore("browDownRight") ?? undefined, eyeLeft: left ?? 0, eyeRight: right ?? 0, eyesValid,
    browInner: browInner ?? 0, browLeft: browLeft ?? 0, browRight: browRight ?? 0,
    browsValid: browInner !== null && browLeft !== null && browRight !== null,
    blinkLeft: blinkLeft ?? 1, blinkRight: blinkRight ?? 1, apertureLeft, apertureRight,
  } };
}
export function faceEyesOpen(f: FaceFeatures, b: FaceBaseline) {
  return f.eyesValid && b.eyesValid &&
    f.blinkLeft <= b.blinkLeft + FACE_CONFIG.blinkDelta &&
    f.blinkRight <= b.blinkRight + FACE_CONFIG.blinkDelta &&
    f.apertureLeft >= Math.max(FACE_CONFIG.eyelidMinimum, b.apertureLeft * FACE_CONFIG.eyelidOpenRatio) &&
    f.apertureRight >= Math.max(FACE_CONFIG.eyelidMinimum, b.apertureRight * FACE_CONFIG.eyelidOpenRatio);
}
// One expression: bilateral eye opening plus eyebrow lift can share the effort.
// Missing eyebrows fall back to eyes; uncertain/closed eyes never pass the pose.
export function faceEyeEffort(f: FaceFeatures, b: FaceBaseline) {
  if (!faceEyesOpen(f, b)) return 0;
  const eyes = Math.max(0, Math.min(f.eyeLeft - b.eyeLeft, f.eyeRight - b.eyeRight)) / FACE_CONFIG.eyeWideDelta;
  const brows = f.browsValid && b.browsValid
    ? (Math.max(0, f.browInner - b.browInner) +
      Math.max(0, Math.min(f.browLeft - b.browLeft, f.browRight - b.browRight))) / 2 / FACE_CONFIG.browUpDelta : 0;
  return eyes + FACE_CONFIG.browWeight * brows;
}
export const FACE_CHANNELS = ["pitch", "yaw", "roll", "jaw", "eyes", "smile", "closed"] as const;
export type FaceChannel = typeof FACE_CHANNELS[number];
export type FaceSignals = Record<FaceChannel, number>;
export interface FaceThreshold { enter: number; exit: number; learned: number; noise: number }
export interface ClosedMouthLimits { jawMax: number; lipGapMax: number }
export interface FaceProfile {
  closedMouth?: ClosedMouthLimits;
  noise: Partial<FaceSignals>;
  thresholds: Partial<Record<Action, FaceThreshold[]>>;
}
export function closedMouthLimits(profile?: FaceProfile): ClosedMouthLimits {
  return profile?.closedMouth ?? { jawMax: FACE_CONFIG.closedJawMax, lipGapMax: FACE_CONFIG.closedLipGapMax };
}
export function faceMouthClosed(f: FaceFeatures, profile?: FaceProfile) {
  const limits = closedMouthLimits(profile);
  return Number.isFinite(f.jaw) && f.jaw >= 0 && f.jaw <= limits.jawMax &&
    f.lipGap !== undefined && Number.isFinite(f.lipGap) && f.lipGap >= 0 && f.lipGap <= limits.lipGapMax;
}
export function learnClosedMouth(samples: FaceFeatures[]): ClosedMouthLimits {
  const valid = samples.filter(f => faceMouthClosed(f));
  const upper = (values: number[]) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * .95)];
  if (!valid.length) return closedMouthLimits();
  return {
    jawMax: Math.min(FACE_CONFIG.closedJawMax, Math.max(FACE_CONFIG.closedJawFloor,
      upper(valid.map(f => f.jaw)) + FACE_CONFIG.closedJawMargin)),
    lipGapMax: Math.min(FACE_CONFIG.closedLipGapMax, Math.max(FACE_CONFIG.closedLipGapFloor,
      upper(valid.map(f => f.lipGap!)) + FACE_CONFIG.closedLipGapMargin)),
  };
}
export const FACE_CHANNEL_LABEL: Record<FaceChannel, string> = {
  pitch: "抬頭／低頭", yaw: "轉頭", roll: "歪頭", jaw: "張嘴", eyes: "睜眼＋抬眉", smile: "微笑", closed: "嘴唇閉合",
};
export function faceSignals(f: FaceFeatures, b: FaceBaseline, profile?: FaceProfile): FaceSignals {
  const dl = Math.max(0, (f.smileLeft ?? 0) - (b.smileLeft ?? 0));
  const dr = Math.max(0, (f.smileRight ?? 0) - (b.smileRight ?? 0));
  return { pitch: angleDelta(f.pitch, b.pitch), yaw: angleDelta(f.yaw, b.yaw),
    roll: angleDelta(f.roll, b.roll), jaw: f.jaw - b.jaw,
    eyes: faceEyeEffort(f, b), smile: Math.max(dl, dr) * 0.75 + Math.min(dl, dr) * 0.25, closed: faceMouthClosed(f, profile) ? 1 : 0 };
}
export function faceAxes(a: Action): [FaceChannel, number][] {
  switch (a) {
    case "jump": return [["pitch", -1]];
    case "duck": return [["pitch", 1]];
    case "left": return [["yaw", 1]];
    case "right": return [["yaw", -1]];
    case "pose_lunge": return [["roll", 1]];
    case "pose_knee": return [["roll", -1]];
    case "pose_arms_l": return [["eyes", 1]];
    case "pose_side_bend": return [["smile", 1]];
    case "pose_tree": return [["closed", 1]];
    default: return [["jaw", 1]];
  }
}
export function faceActionParts(f: FaceFeatures, b: FaceBaseline, action: Action, profile?: FaceProfile) {
  const signals = faceSignals(f, b, profile);
  return faceAxes(action).map(([channel, sign], i) => {
    const fallback = channel === "jaw" ? FACE_CONFIG.mouthOpenDelta : channel === "eyes" ? 1
      : channel === "smile" ? FACE_CONFIG.smileDelta : channel === "closed" ? 1 : FACE_CONFIG.rotationEnter;
    const threshold = profile?.thresholds[action]?.[i];
    const enter = channel === "closed" ? 1 : threshold?.enter ?? fallback;
    const available = channel === "eyes" ? f.eyesValid && b.eyesValid : channel === "smile"
      ? f.smileLeft !== undefined && f.smileRight !== undefined && b.smileLeft !== undefined && b.smileRight !== undefined
      : channel === "closed" ? f.lipGap !== undefined && Number.isFinite(f.lipGap) && f.lipGap >= 0 : true;
    const value = signals[channel] * sign;
    const exit = channel === "closed" ? 0.5 : threshold?.exit ?? enter * FACE_CONFIG.releaseRatio;
    return { channel, value, enter, exit, available,
      // Blinking alone is not evidence of relaxing a held eye expression.
      released: available && (channel !== "eyes" || faceEyesOpen(f, b)) && value < exit };
  });
}
export function faceActionReleased(f: FaceFeatures, b: FaceBaseline, action: Action, profile?: FaceProfile) {
  return faceActionParts(f, b, action, profile).every(p => p.released);
}
export function faceNeutral(f: FaceFeatures, b: FaceBaseline) {
  // No spatial center or scale requirement. This is a relaxed pose, not alignment.
  return Math.abs(angleDelta(f.roll, b.roll)) < FACE_CONFIG.rotationExit &&
    Math.abs(angleDelta(f.yaw, b.yaw)) < FACE_CONFIG.rotationExit &&
    Math.abs(angleDelta(f.pitch, b.pitch)) < FACE_CONFIG.rotationExit &&
    f.jaw < b.jaw + FACE_CONFIG.neutralMouthDelta && faceEyeEffort(f, b) < 0.85;
}

export class FaceDetector {
  private filtered: FaceFeatures | null = null;
  private last = -Infinity;
  private targetId: number | string | null = null;
  private armed = false;
  private completedClosedId: number | string | null = null;
  private relaxedSince: Partial<Record<Action, number>> = {};
  private readyActions = new Set<Action>();
  private heldSince: number | null = null;
  private mouthOpen = false;
  private mouthSince: number | null = null;
  private cycleOpen = false;
  private mouthReady = false;
  private poseParts: boolean[] = [];
  private poseStarted: number | null = null;
  private poseHeldMs = 0;
  private posePreviousMatch = false;
  get conditionMatches(): readonly boolean[] { return this.poseParts; }
  private resetPose() {
    this.poseParts = []; this.poseStarted = null;
    this.poseHeldMs = 0; this.posePreviousMatch = false;
  }
  private updatePose(parts: ReturnType<typeof faceActionParts>, now: number, sampleMs: number, holdMs: number) {
    // A pose must enter once, then stays active down to its release threshold.
    this.poseParts = parts.map((p, i) => p.available &&
      (p.value >= p.enter || (!!this.poseParts[i] && p.value > p.exit)));
    const match = this.armed && this.poseParts.every(Boolean);
    if (!this.armed || parts.every(p => p.released) || parts.some(p => ["pitch", "yaw", "roll"].includes(p.channel) && p.value < -p.enter)) {
      this.resetPose(); this.progress = 0; return false;
    }
    if (match) this.poseStarted ??= now;
    if (this.poseStarted === null) { this.progress = 0; return false; }
    // Only intervals with valid pose evidence at BOTH ends add hold time.
    if (match && this.posePreviousMatch) this.poseHeldMs += sampleMs;
    this.posePreviousMatch = match;
    // Bound total interrupted time, so repeated tiny fragments cannot accumulate forever.
    if (now - this.poseStarted - this.poseHeldMs > FACE_CONFIG.poseGapMs) {
      this.resetPose(); this.progress = 0; return false;
    }
    this.progress = Math.min(1, this.poseHeldMs / holdMs);
    return match && this.progress === 1;
  }
  energy = 0;
  progress = 0;
  hint = "";
  status = "等待動作";
  reset() {
    this.filtered = null; this.last = -Infinity; this.targetId = null;
    this.armed = false; this.completedClosedId = null; this.relaxedSince = {}; this.readyActions.clear();
    this.heldSince = this.mouthSince = null;
    this.mouthOpen = this.cycleOpen = this.mouthReady = false;
    this.energy = this.progress = 0; this.hint = ""; this.status = "等待動作"; this.resetPose();
  }
  private resetTracking() {
    const completed = this.completedClosedId;
    this.reset(); this.completedClosedId = completed;
  }
  startFromNeutral(f: FaceFeatures, b: FaceBaseline, now: number, targetId: number | string | null = null, action?: Action, profile?: FaceProfile) {
    this.reset();
    const parts = action ? faceActionParts(f, b, action, profile) : [];
    const ready = action === "pose_tree" || (action ? parts.every(p => p.released) : faceNeutral(f, b));
    if (ready) {
      this.filtered = { ...f }; this.last = now; this.armed = true;
      this.targetId = targetId;
      // A completed lesson handoff already provides trusted relaxed evidence.
      for (const a of FACE_ACTIONS) if (faceActionReleased(f, b, a, profile)) {
        this.readyActions.add(a); this.relaxedSince[a] = now - FACE_CONFIG.returnMs;
      }
      this.mouthReady = f.jaw <= Math.min(0.87, b.jaw + FACE_CONFIG.mouthCloseDelta);
    }
  }
  update(raw: FaceFeatures | null, b: FaceBaseline, now: number,
    target?: { id: number | string; action: Action; active: boolean; holdMs?: number }, profile?: FaceProfile): Action | undefined {
    if (!raw || !Number.isFinite(now) || !Object.entries(raw).every(([k,v]) => (k === "eyesValid" || k === "browsValid") || (FACE_OPTIONAL_FEATURES.some(name => name === k) && v === undefined) || Number.isFinite(v))) {
      this.resetTracking(); return;
    }
    if (now - this.last > CONFIG.poseStaleMs || now <= this.last) this.resetTracking();
    const sampleMs = this.filtered ? now - this.last : 0;
    const alpha = this.filtered ? 1 - Math.exp(-(now - this.last) / FACE_CONFIG.smoothingMs) : 1;
    const f = { ...raw };
    if (this.filtered) {
      for (const k of ["x", "y", "size", "jaw", "eyeLeft", "eyeRight", "browInner", "browLeft", "browRight"] as const)
        f[k] = this.filtered[k] + alpha * (raw[k] - this.filtered[k]);
      for (const k of FACE_OPTIONAL_FEATURES)
        if (raw[k] !== undefined && this.filtered[k] !== undefined) f[k] = this.filtered[k]! + alpha * (raw[k]! - this.filtered[k]!);
      for (const k of ["roll", "yaw", "pitch"] as const)
        f[k] = this.filtered[k] + alpha * angleDelta(raw[k], this.filtered[k]);
    }
    this.filtered = f; this.last = now;
    if ((target?.id ?? null) !== this.targetId) {
      this.targetId = target?.id ?? null; this.heldSince = this.mouthSince = null;
      this.energy = this.progress = 0; this.resetPose();
      this.cycleOpen = this.mouthReady = false;
    }
    const jawPart = target ? faceActionParts(f, b, target.action, profile).find(p => p.channel === "jaw") : undefined;
    const openAt = b.jaw + (jawPart?.enter ?? FACE_CONFIG.mouthOpenDelta);
    const closeAt = b.jaw + (jawPart?.exit ?? FACE_CONFIG.mouthCloseDelta);
    const wasOpen = this.mouthOpen;
    if (f.jaw >= openAt) this.mouthOpen = true;
    else if (f.jaw <= closeAt) this.mouthOpen = false;
    if (wasOpen !== this.mouthOpen) this.mouthSince = null;
    // Track releases independently, even before that action's prompt appears.
    // Holding a previous turn/smile must not block a fresh mouth/brow action.
    for (const action of FACE_ACTIONS) {
      if (faceActionReleased(f, b, action, profile)) {
        this.relaxedSince[action] ??= now;
        if (now - this.relaxedSince[action]! >= FACE_CONFIG.returnMs) this.readyActions.add(action);
      } else delete this.relaxedSince[action];
    }
    this.armed = !!target && (target.action === "pose_tree" ? target.id !== this.completedClosedId : this.readyActions.has(target.action));
    const direction = !!target && ["jump", "duck", "left", "right"].includes(target.action);
    // Only emit once per deliberate movement; the game decides its acceptance period.
    if (!target || !target.active) {
      this.heldSince = this.mouthSince = null;
      this.energy = this.progress = 0; this.resetPose();
      this.cycleOpen = this.mouthReady = false;
      return;
    }
    const a = target.action;
    // Closure uses current lip/jaw evidence, never a smoothed previous closed frame.
    const parts = faceActionParts(a === "pose_tree" ? raw : f, b, a, profile);
    const heldPose = a.startsWith("pose_");
    const poseDone = heldPose && this.updatePose(parts, now, sampleMs, target.holdMs ?? FACE_CONFIG.poseHoldMs);
    const missing = parts.find(p => !p.available);
    const insufficient = parts.find((p, i) => heldPose ? !this.poseParts[i] : p.value < p.enter);
    this.hint = !this.armed && a !== "smash" ? "輕輕放鬆剛剛的動作，就能再開始，不用移回固定位置。"
      : missing ? "暫時看不清目標表情，請確認光線與整張臉入鏡。"
      : insufficient ? insufficient.value < -insufficient.enter ? "方向相反囉，跟著示範往另一邊轉動。"
      : insufficient.channel === "jaw" ? "再舒服地張開嘴巴，輕輕保持一下。"
      : insufficient.channel === "smile" ? "自然露齒微笑、讓嘴角上揚，不必咬牙或轉頭。"
      : insufficient.channel === "closed" ? "嘴唇自然輕輕接觸，再保持一下，不必先張嘴。"
      : insufficient.channel === "eyes" ? "可以試著輕抬雙邊眉毛，不必勉強撐大眼睛。"
      : "輕輕轉動到舒服的幅度，再保持一下。" : "動作可以了！保持一下。";
    this.status = missing ? "嘴部或表情資料不足"
      : !this.armed ? a === "pose_tree" ? "這一題已完成" : "先放鬆這個動作，再做一次"
      : this.progress > 0 ? "保持一下"
      : insufficient?.channel === "closed" ? "嘴唇尚未確認閉合"
      : insufficient?.channel === "jaw" ? "張嘴幅度尚未達標"
      : insufficient ? "動作幅度尚未達標" : "保持一下";
    if (a === "smash") {
      if (this.energy >= FACE_CONFIG.smashCycles) return;
      this.heldSince = null;
      if (!this.mouthReady && !this.cycleOpen && this.mouthOpen)
        this.hint = "先輕輕閉嘴，再張嘴、閉嘴算一次。";
      // Only count a stable CLOSED → OPEN → CLOSED cycle inside this obstacle.
      const stableState = this.mouthOpen ? f.jaw >= openAt : f.jaw <= closeAt;
      if (!stableState) { this.mouthSince = null; return; }
      this.mouthSince ??= now;
      if (now - this.mouthSince < FACE_CONFIG.mouthStateMs) return;
      if (!this.mouthOpen) {
        if (this.cycleOpen) { this.energy++; this.cycleOpen = false; }
        this.mouthReady = true;
      } else if (this.mouthReady) { this.cycleOpen = true; this.mouthReady = false; }
      this.progress = Math.min(1, this.energy / FACE_CONFIG.smashCycles);
      if (this.energy >= FACE_CONFIG.smashCycles) return a;
      return;
    }
    if (heldPose) {
      if (!poseDone) return;
      this.armed = false; this.readyActions.delete(a); delete this.relaxedSince[a]; this.heldSince = null;
      if (a === "pose_tree") this.completedClosedId = target.id;
      this.resetPose(); return a;
    }
    const match = this.armed && parts.every(p => p.available && p.value >= p.enter);
    if (!match) { this.heldSince = null; this.progress = 0; return; }
    this.heldSince ??= now;
    this.progress = Math.min(1, (now - this.heldSince) /
      (target.holdMs ?? (direction ? FACE_CONFIG.directionHoldMs : FACE_CONFIG.poseHoldMs)));
    if (this.progress < 1) return;
    this.armed = false; this.readyActions.delete(a); delete this.relaxedSince[a]; this.heldSince = null;
    return a;
  }
}

export const FACE_CALIBRATION_STEPS = ["自然看著遊戲畫面", ...FACE_ACTIONS.map(a => FACE_LABEL[a])];
export class FaceCalibration {
  started = false;
  done = false;
  step = 0;
  progress = 0;
  returning = false;
  baseline: FaceBaseline | null = null;
  message = "坐舒服，讓整張臉入鏡，再按開始校正。";
  profile: FaceProfile = { noise: {}, thresholds: {} };
  private observations: number[][] = [];
  private closedSamples: FaceFeatures[] = [];
  private samples: FaceFeatures[] = [];
  private since: number | null = null;
  private last = -Infinity;
  private detector = new FaceDetector();
  get conditionMatches() { return this.detector.conditionMatches; }
  get releaseProgress() {
    return this.returning && this.since !== null ? Math.min(1, (this.last - this.since) / FACE_CONFIG.returnMs) : 0;
  }
  private prepareLesson(f: FaceFeatures, now: number) {
    const action = FACE_ACTIONS[this.step - 1];
    this.observations = faceAxes(action).map(() => []); this.closedSamples = [];
    this.profile.thresholds[action] = faceAxes(action).map(([channel]) => {
      const minimum = ["pitch", "yaw", "roll"].includes(channel) ? FACE_CONFIG.minimumRotation
        : channel === "eyes" ? FACE_CONFIG.minimumEyeEffort : FACE_CONFIG.minimumExpression;
      if (channel === "closed") return { enter: 1, exit: 0.5, learned: 1, noise: 0 };
      const noise = this.profile.noise[channel] ?? 0;
      const enter = Math.max(minimum, noise * FACE_CONFIG.noiseMultiplier);
      return { enter, exit: enter * FACE_CONFIG.releaseRatio, learned: 0, noise };
    });
    // Reuse the learned mouth amplitude for the repeated-mouth lesson.
    if (action === "smash" && this.profile.thresholds.pose_t)
      this.profile.thresholds.smash = this.profile.thresholds.pose_t.map(t => ({ ...t }));
    this.detector.startFromNeutral(f, this.baseline!, now, this.step, action, this.profile);
    this.message = `接下來：${FACE_LABEL[action]}。${FACE_HINT[action]}`;
  }
  interrupt() {
    this.samples = []; this.since = null; this.progress = 0;
    this.observations = this.observations.map(() => []); this.closedSamples = [];
    this.last = -Infinity; this.detector.reset();
  }
  start() { this.started = true; }
  update(f: FaceFeatures | null, now: number) {
    if (this.done || !this.started) return;
    if (!f || now - this.last > CONFIG.poseStaleMs || now <= this.last) {
      this.samples = []; this.since = null; this.progress = 0; this.detector.reset();
    }
    this.last = now;
    if (!f) { this.message = "請讓整張臉入鏡，保持光線充足。"; return; }
    if (!this.baseline) {
      // Any stable, tracked face can establish neutral. Never ask players to
      // widen their eyes or change expression just to make calibration accept them.
      this.since ??= now; this.samples.push(f);
      this.progress = Math.min(1, (now - this.since) / CONFIG.calibrationMs);
      this.message = "舒服看著遊戲畫面，保持約 2 秒就好，不必睜大眼睛或抬眉。";
      if (this.progress < 1 || this.samples.length < CONFIG.calibrationMinSamples) return;
      const b = { ...f };
      for (const k of ["x", "y", "size", "roll", "yaw", "pitch", "jaw", "eyeLeft", "eyeRight", "browInner", "browLeft", "browRight", "blinkLeft", "blinkRight", "apertureLeft", "apertureRight"] as const) {
        b[k] = ["roll", "yaw", "pitch"].includes(k)
          ? f[k] + median(this.samples.map(s => angleDelta(s[k], f[k])))
          : median(this.samples.map(s => s[k]));
      }
      for (const k of FACE_OPTIONAL_FEATURES)
        b[k] = this.samples.every(s => s[k] !== undefined) ? median(this.samples.map(s => s[k]!)) : undefined;
      if (this.samples.some(s => ["roll", "yaw", "pitch"].some(k =>
          Math.abs(angleDelta(s[k as "roll"], b[k as "roll"])) > 6))) {
        this.samples = []; this.since = null; this.progress = 0;
        this.message = "剛剛有點晃動，我們放鬆再試一次。"; return;
      }
      this.baseline = b;
      for (const channel of FACE_CHANNELS) {
        const values = this.samples.map(s => Math.abs(faceSignals(s, b)[channel])).sort((a, b) => a - b);
        this.profile.noise[channel] = channel === "closed" ? 0 : values[Math.floor((values.length - 1) * .95)];
      }
      this.step = 1; this.progress = 0; this.since = null;
      this.prepareLesson(f, now);
      return;
    }
    const action = FACE_ACTIONS[this.step - 1];
    const parts = faceActionParts(f, this.baseline, action, this.profile);
    if (!this.returning && parts.every(p => p.available && p.value >= p.enter)) {
      parts.forEach((p, i) => { this.observations[i].push(p.value); if (this.observations[i].length > 200) this.observations[i].shift(); });
      if (action === "pose_tree") this.closedSamples.push({ ...f });
    }
    if (this.returning) {
      const next = FACE_ACTIONS[this.step];
      const nextHint = next ? `接下來：${FACE_LABEL[next]}。` : "放鬆後就能出發囉！";
      if (!parts.every(p => p.released)) {
        this.since = null;
        this.message = parts.map(p => `${FACE_CHANNEL_LABEL[p.channel]}：${!p.available ? "資料不足" : p.released ? "已放鬆" : "待放鬆"}`).join(" · ") + `。${nextHint}不用喬到固定角度。`;
        return;
      }
      this.message = `已放鬆，準備繼續。${nextHint}`;
      this.since ??= now;
      if (now - this.since < FACE_CONFIG.returnMs) return;
      this.returning = false; this.step++; this.progress = 0; this.since = null;
      if (this.step > FACE_ACTIONS.length) { this.done = true; this.message = "全部練習完成，可以出發囉！"; }
      else this.prepareLesson(f, now);
      return;
    }
    const result = this.detector.update(f, this.baseline, now, { id: this.step, action, active: true, holdMs: FACE_CONFIG.poseHoldMs }, this.profile);
    this.progress = this.detector.progress;
    this.message = `接下來：${FACE_LABEL[action]}。` + (this.detector.hint || FACE_HINT[action]) + (action === "smash" ? `（${this.detector.energy}／${FACE_CONFIG.smashCycles} 次）` : "");
    if (result && action === "pose_tree") {
      this.profile.closedMouth = learnClosedMouth(this.closedSamples);
      // Absolute-pose exception: do not require opening the mouth to leave this lesson.
      this.step++; this.progress = 0; this.since = null;
      this.prepareLesson(f, now);
      this.message = `閉嘴已確認！${this.message}`;
      return;
    }
    if (result) {
      // Learn BEFORE checking release: the provisional floor can demand a near-zero
      // return (3 degrees * .45 = 1.35 degrees), even after a comfortable 12-degree turn.
      this.profile.thresholds[action] = this.profile.thresholds[action]!.map((t, i) => {
        const learned = median(this.observations[i]);
        const enter = Math.max(t.enter, learned * FACE_CONFIG.learnedRatio);
        return { ...t, learned, enter, exit: enter * FACE_CONFIG.releaseRatio };
      });
      this.returning = true; this.progress = 1;
      const next = FACE_ACTIONS[this.step];
      this.message = `動作成功！先自然放鬆，不必精準回正。${next ? `接下來：${FACE_LABEL[next]}。` : "放鬆後就能出發囉！"}`;
    }
  }
}
