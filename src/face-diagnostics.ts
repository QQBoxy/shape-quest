import { median } from "./actions";
import type { Action } from "./config";
import { angleDelta, FACE_LABEL, FACE_CHANNELS, faceActionParts, faceSignals, faceAxes, FaceDetector, faceMouthClosed, learnClosedMouth, FACE_HINT, type ClosedMouthLimits, type FaceFeatures } from "./face-actions";

// Experimental settings, not webcam acceptance criteria. Kept out of the game.
export const FACE_PROBE_CONFIG = {
  baselineMs: 1800, minimumSamples: 24, validRatio: 0.8,
  recoveryMs: 350, shortLossMs: 250, staleMs: 250,
  holdMs: 300, releaseMs: 180, trialMs: 1800,
  noiseMultiplier: 4, learnedRatio: 0.65, releaseRatio: 0.45,
  rotationFloor: 2, expressionFloor: 0.025, eyeEffortFloor: 0.15,
} as const;
export const PROBE_LABEL = FACE_LABEL;
export const PROBE_CHANNELS = FACE_CHANNELS;
type Channel = typeof PROBE_CHANNELS[number];
type Signals = Record<Channel, number>;
export interface ProbeThreshold { enter: number; exit: number; learned: number; noise: number }
export type ProbeState = "未校正" | "待學習" | "待命" | "候選" | "已觸發" | "等待解除";
const quantile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? 0;
const floor = (c: Channel) => ["pitch", "yaw", "roll"].includes(c)
  ? FACE_PROBE_CONFIG.rotationFloor : c === "eyes" ? FACE_PROBE_CONFIG.eyeEffortFloor : FACE_PROBE_CONFIG.expressionFloor;
export const probeSignals = faceSignals;
export const probeParts = faceAxes;
function valid(f: FaceFeatures | null): f is FaceFeatures {
  return !!f && f.size > 0 && Object.values(f).every(v => typeof v === "boolean" || v === undefined || Number.isFinite(v));
}
export class FaceProbe {
  baseline: FaceFeatures | null = null;
  noise: Signals = { pitch: 0, yaw: 0, roll: 0, jaw: 0, eyes: 0, smile: 0, closed: 0 };
  signals: Signals = { ...this.noise };
  thresholds: Partial<Record<Action, ProbeThreshold[]>> = {};
  action: Action = "jump";
  state: ProbeState = "未校正";
  tracking = "等待資料";
  message = "先開啟鏡頭，再自然看著遊戲畫面取樣。";
  progress = 0;
  hits = 0;
  cycles = 0;
  calibrationProgress = 0;
  validRatio = 0;
  calibrating = false;
  learning = false;
  private samples: FaceFeatures[] = [];
  private total = 0;
  private started = 0;
  private last = -Infinity;
  private lostAt: number | null = null;
  private recoveringAt: number | null = null;
  private heldMs = 0;
  private releasedMs = 0;
  private trial: number[][] = [];
  private trialStarted = 0;
  private mouthOpen = false;
  private mouthReady = false;
  private requireRelease = true;
  private visibleParts: boolean[] = [];
  private closedDetector = new FaceDetector();
  private closedSamples: FaceFeatures[] = [];
  private closedConfirmed = false;
  closedMouth?: ClosedMouthLimits;
  get parts() { return probeParts(this.action).map(([channel, sign], i) => ({ channel,
    value: this.signals[channel] * sign, threshold: this.thresholds[this.action]?.[i], available: this.visibleParts[i] ?? false })); }
  select(action: Action) {
    this.closedDetector.reset(); this.closedSamples = []; this.closedConfirmed = false;
    if (action === "pose_tree") this.thresholds.pose_tree = [{ enter: 1, exit: .5, learned: 1, noise: 0 }];
    this.action = action; this.state = this.thresholds[action] ? "等待解除" : "待學習";
    this.heldMs = this.releasedMs = this.progress = this.cycles = 0;
    this.requireRelease = true; this.mouthOpen = this.mouthReady = false; this.learning = false;
    this.message = "先放鬆目標動作，再練習；不必把臉移回固定位置。";
  }
  calibrate(now: number) {
    this.closedDetector.reset(); this.closedSamples = []; this.closedConfirmed = false; this.closedMouth = undefined;
    this.baseline = null; this.thresholds = {}; this.samples = []; this.total = 0;
    this.started = now; this.calibrating = true; this.learning = false;
    this.calibrationProgress = 0; this.state = "未校正"; this.hits = 0;
    this.message = "舒服看著遊戲畫面，不必看鏡頭或刻意睜大眼睛。";
  }
  learn(now: number) {
    if (!this.baseline || this.tracking !== "有效追蹤") return;
    if (this.action === "pose_tree") {
      this.closedDetector.reset(); this.closedSamples = []; this.closedConfirmed = false; this.message = FACE_HINT.pose_tree; return;
    }
    this.trial = probeParts(this.action).map(() => []); this.trialStarted = now;
    this.learning = true; this.heldMs = 0;
    this.message = `慢慢完成「${PROBE_LABEL[this.action]}」並舒服維持，約 2 秒。`;
  }
  private interrupt() {
    this.closedDetector.reset();
    this.requireRelease = true; this.heldMs = this.releasedMs = this.progress = 0;
    this.mouthOpen = this.mouthReady = false; this.learning = false;
    this.state = this.thresholds[this.action] ? "等待解除" : this.baseline ? "待學習" : "未校正";
  }
  update(f: FaceFeatures | null, now: number) {
    if (!Number.isFinite(now) || now <= this.last) return;
    const gap = now - this.last;
    this.last = now;
    if (!valid(f)) {
      this.closedDetector.reset(); this.closedSamples = [];
      this.lostAt ??= now;
      this.tracking = now - this.lostAt <= FACE_PROBE_CONFIG.shortLossMs ? "短暫中斷" : "追蹤失效";
      this.recoveringAt = null;
      // Never join a mouth cycle or a learning trial across a missing frame.
      this.mouthOpen = this.mouthReady = false; this.learning = false;
      if (this.action === "smash") { this.requireRelease = true; this.heldMs = this.releasedMs = 0; }
      if (now - this.lostAt > FACE_PROBE_CONFIG.shortLossMs) this.interrupt();
      this.message = "輸入資料不足，暫停累積；請確認整張臉入鏡與光線。";
    } else {
      if (this.lostAt !== null || gap > FACE_PROBE_CONFIG.staleMs) {
        if (gap > FACE_PROBE_CONFIG.staleMs || now - (this.lostAt ?? now) > FACE_PROBE_CONFIG.shortLossMs) this.interrupt();
        this.recoveringAt ??= now;
        this.lostAt = null;
      }
      if (this.recoveringAt !== null && now - this.recoveringAt < FACE_PROBE_CONFIG.recoveryMs) {
        this.tracking = "恢復確認中"; return;
      }
      this.recoveringAt = null; this.tracking = "有效追蹤";
    }
    if (this.calibrating) {
      this.total++;
      if (valid(f) && this.tracking === "有效追蹤") this.samples.push({ ...f });
      this.validRatio = this.samples.length / this.total;
      this.calibrationProgress = Math.min(1, (now - this.started) / FACE_PROBE_CONFIG.baselineMs);
      if (this.calibrationProgress < 1) return;
      this.calibrating = false;
      if (this.samples.length < FACE_PROBE_CONFIG.minimumSamples || this.validRatio < FACE_PROBE_CONFIG.validRatio) {
        this.message = "有效資料不足，請調整光線後重新取樣。"; return;
      }
      const b = { ...this.samples[0] };
      for (const key of Object.keys(b) as (keyof FaceFeatures)[]) {
        if (typeof b[key] !== "number") continue;
        const values = this.samples.map(s => Number(s[key]));
        const angle = key === "pitch" || key === "yaw" || key === "roll";
        (b as unknown as Record<string, unknown>)[key] = angle
          ? Number(b[key]) + median(values.map(v => angleDelta(v, Number(b[key])))) : median(values);
      }
      b.eyesValid = this.samples.every(s => s.eyesValid);
      b.browsValid = this.samples.every(s => s.browsValid);
      this.baseline = b;
      for (const c of PROBE_CHANNELS) this.noise[c] = c === "closed" ? 0 : quantile(this.samples.map(s => Math.abs(probeSignals(s, b)[c])), 0.95);
      this.select(this.action);
      this.message = "自然基準完成，請選動作並記錄舒適幅度；門檻仍是實驗值。";
      return;
    }
    if (!valid(f) || !this.baseline) return;
    this.signals = probeSignals(f, this.baseline, { noise: this.noise, thresholds: this.thresholds, closedMouth: this.closedMouth });
    this.visibleParts = faceActionParts(f, this.baseline, this.action).map(p => p.available);
    if (this.action === "pose_tree") {
      if (this.closedConfirmed) {
        this.state = "已觸發"; this.progress = 1; this.message = "這次閉嘴已確認；重新選擇此動作可測下一題，不必先張嘴。"; return;
      }
      const profile = { noise: this.noise, thresholds: this.thresholds, closedMouth: this.closedMouth };
      if (faceMouthClosed(f, profile)) { this.closedSamples.push({ ...f }); if (this.closedSamples.length > 200) this.closedSamples.shift(); }
      const hit = this.closedDetector.update(f, this.baseline, now, { id: "closed-test", action: "pose_tree", active: true }, profile);
      this.progress = this.closedDetector.progress; this.message = this.closedDetector.hint || FACE_HINT.pose_tree;
      this.state = this.progress > 0 ? "候選" : "待命";
      if (hit) {
        this.hits++; this.closedConfirmed = true; this.closedMouth = learnClosedMouth(this.closedSamples);
        this.state = "已觸發"; this.message = "自然閉嘴已確認，不需要先張嘴。重新選擇此動作可測試下一題。";
      } else if (this.closedDetector.status === "這一題已完成") this.state = "已觸發";
      return;
    }
    if (this.learning) {
      this.parts.forEach((p, i) => { if (p.available) this.trial[i].push(p.value); });
      if (now - this.trialStarted < FACE_PROBE_CONFIG.trialMs) return;
      this.learning = false;
      const learned = this.parts.map((p, i) => {
        const amplitude = quantile(this.trial[i], 0.7);
        const minimum = Math.max(floor(p.channel), this.noise[p.channel] * FACE_PROBE_CONFIG.noiseMultiplier);
        if (this.trial[i].length < FACE_PROBE_CONFIG.minimumSamples || amplitude * FACE_PROBE_CONFIG.learnedRatio <= minimum) return null;
        const enter = amplitude * FACE_PROBE_CONFIG.learnedRatio;
        return { enter, exit: enter * FACE_PROBE_CONFIG.releaseRatio, learned: amplitude, noise: this.noise[p.channel] };
      });
      if (learned.some(t => !t)) {
        this.message = "動作與自然雜訊尚無法區分，請重新練習；保留已有門檻。"; return;
      }
      this.thresholds[this.action] = learned as ProbeThreshold[];
      this.interrupt(); this.message = "幅度已記錄。放鬆目標動作後再做一次，觀察觸發與解除。"; return;
    }
    if (!this.thresholds[this.action]) { this.state = "待學習"; return; }
    if (this.parts.some(p => !p.available)) {
      this.heldMs = 0; this.releasedMs = 0; this.progress = 0;
      this.message = "目標表情資料不足，無法判斷；不視為動作解除。"; return;
    }
    const dt = Math.min(gap, 100); // Invalid and recovery frames never add hold time.
    const released = faceActionParts(f, this.baseline, this.action, { noise: this.noise, thresholds: this.thresholds }).every(p => p.released);
    if (this.requireRelease) {
      this.releasedMs = released ? this.releasedMs + dt : 0;
      this.state = "等待解除";
      if (this.releasedMs >= FACE_PROBE_CONFIG.releaseMs) {
        this.requireRelease = false; this.heldMs = this.releasedMs = 0; this.state = "待命";
        this.mouthReady = true;
      }
      return;
    }
    if (this.action === "smash") {
      const p = this.parts[0];
      const open = p.value >= p.threshold!.enter;
      const close = p.value <= p.threshold!.exit;
      const match = this.mouthOpen ? close : open && this.mouthReady;
      this.heldMs = match ? this.heldMs + dt : 0;
      this.state = match ? "候選" : "待命";
      if (this.heldMs >= FACE_PROBE_CONFIG.holdMs) {
        this.heldMs = 0;
        if (this.mouthOpen) {
          this.cycles++; this.mouthOpen = false;
          if (this.cycles % 3 === 0) { this.hits++; this.state = "已觸發"; }
        } else this.mouthOpen = true;
      }
      return;
    }
    const match = this.parts.every(p => p.value >= p.threshold!.enter);
    this.heldMs = match ? this.heldMs + dt : 0;
    this.progress = Math.min(1, this.heldMs / FACE_PROBE_CONFIG.holdMs);
    this.state = match ? "候選" : "待命";
    this.message = match ? "條件成立，保持一下。" : this.parts.some(p => p.value < -p.threshold!.exit)
      ? "目前變化方向相反，請確認鏡像方向。" : "目標變化不足，請跟著提示做出目前要求的獨立動作。";
    if (this.progress === 1) { this.hits++; this.state = "已觸發"; this.requireRelease = true; this.heldMs = 0; }
  }
}
