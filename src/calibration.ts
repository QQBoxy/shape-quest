import { CONFIG, LABEL, type Action } from "./config";
import {
  makeBaseline,
  classify,
  isNeutral,
  type Baseline,
  type Features,
} from "./actions";
export const CALIBRATION_STEPS = [
  "站在中央",
  "往左跨一步，再回中央",
  "往右跨一步，再回中央",
  "蹲低低，再站起來",
  "輕輕跳一下，再站好",
] as const;
const TARGETS: Action[] = ["left", "right", "duck", "jump"];
export class Calibration {
  started = false;
  step = 0;
  progress = 0;
  baseline: Baseline | null = null;
  done = false;
  message = "先移動手機，讓身體對齊固定中央黃線，再按開始校正";
  private samples: Features[] = [];
  private since: number | null = null;
  private actionSamples = 0;
  private returnSince: number | null = null;
  private observed = false;
  private lastAt = -Infinity;
  start() {
    this.started = true;
    this.samples = [];
    this.since = null;
    this.progress = 0;
  }
  interrupt() {
    this.samples = []; this.since = null; this.progress = 0;
    this.actionSamples = 0; this.returnSince = null; this.lastAt = -Infinity;
  }
  get returning() { return this.observed; }
  update(f: Features | null, now: number) {
    if (this.done || !Number.isFinite(now)) return;
    if (now - this.lastAt > CONFIG.poseStaleMs || now <= this.lastAt) {
      this.actionSamples = 0;
      this.returnSince = null;
      if (this.step === 0) {
        this.samples = [];
        this.since = null;
        this.progress = 0;
      }
    }
    this.lastAt = now;
    if (!f) {
      this.message = "找不到完整身體，請退後一點、調整光線或鏡頭角度";
      this.actionSamples = 0;
      this.returnSince = null;
      if (this.step === 0) {
        this.samples = [];
        this.since = null;
        this.progress = 0;
      }
      return;
    }
    if (!this.baseline) {
      const centered = Math.abs(f.hipX - 0.5) <= CONFIG.setupCenterRange;
      if (!this.started || !centered) {
        this.samples = [];
        this.since = null;
        this.progress = 0;
        this.message = !centered
          ? "請移動手機、調整拍攝方向，讓身體對齊固定中央黃線"
          : "已對齊中央！手機擺好後，按開始校正，再站穩約 2 秒";
        return;
      }
      this.since ??= now;
      this.samples.push(f);
      this.progress = Math.min(1, (now - this.since) / CONFIG.calibrationMs);
      this.message = "站在中央，身體保持自然不動";
      if (this.progress < 1) return;
      const measured = makeBaseline(this.samples);
      this.baseline = measured ? {
        ...measured, hipX: 0.5,
        leftLimit: 0.5 - CONFIG.dodge * measured.height,
        rightLimit: 0.5 + CONFIG.dodge * measured.height,
      } : null;
      if (!this.baseline) {
        this.samples = [];
        this.since = null;
        this.progress = 0;
        this.message = "剛剛有點晃動，請站直，我們再試一次";
        return;
      }
      this.step = 1;
      this.progress = 0;
      this.actionSamples = 0;
      this.returnSince = null;
    }
    const target = TARGETS[this.step - 1];
    if (target === "left")
      this.baseline.leftLimit = Math.min(this.baseline.leftLimit, f.hipX);
    if (target === "right")
      this.baseline.rightLimit = Math.max(this.baseline.rightLimit, f.hipX);
    // Calibration observes the requested movement directly, without gameplay's
    // arming prerequisite. Two samples reject a single landmark spike.
    if (!this.observed) {
      this.actionSamples = classify(f, this.baseline) === target
        ? this.actionSamples + 1 : 0;
      this.observed = this.actionSamples >= 2;
      this.progress = this.observed ? 0.5 : 0;
      this.message = this.observed
        ? `${LABEL[target]}已辨識！回到綠色區域站好`
        : `請${LABEL[target]}，辨識到後會提示你回中央`;
      return;
    }
    if (!isNeutral(f, this.baseline)) {
      this.returnSince = null;
      this.progress = 0.5;
      const dx = (f.hipX - this.baseline.hipX) / this.baseline.height;
      this.message = Math.abs(dx) >= CONFIG.returnRange
        ? `動作已辨識，請往畫面${dx < 0 ? "右" : "左"}邊移動，回到綠色區域`
        : "動作已辨識，請站直、雙腳落地，不用精準站回原點";
      return;
    }
    this.returnSince ??= now;
    this.progress = 0.5 + 0.5 * Math.min(1, (now - this.returnSince) / CONFIG.returnMs);
    this.message = "回到中央了！保持站穩一下";
    if (now - this.returnSince < CONFIG.returnMs) return;
    this.step++;
    this.observed = false;
    this.actionSamples = 0;
    this.returnSince = null;
    this.progress = 0;
    if (this.step > TARGETS.length) {
      this.done = true;
      this.message = "校正完成，準備冒險！";
    } else {
      this.message = `上一個動作完成！接著請${LABEL[TARGETS[this.step - 1]]}`;
    }
  }
}
