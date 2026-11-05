import { ACTIONS, CONFIG, actionPreview, type Action } from "./config";
export type Phase = "idle" | "countdown" | "playing" | "paused" | "finished";
export type PauseReason = "manual" | "tracking" | "hidden" | "camera" | "orientation";
export interface Obstacle {
  id: number;
  action: Action;
  collision: number;
  result: "pending" | "success" | "miss";
  completed?: boolean;
}
export interface ActionEvent {
  id: number;
  action: Action;
  time: number;
}
export interface Feedback {
  kind: "success" | "miss";
  action: Action;
  at: number;
  damaged: boolean;
}
export class Game {
  phase: Phase = "idle";
  time = 0;
  countdown = CONFIG.countdown as number;
  health: number;
  score = 0;
  successes = 0;
  misses = 0;
  invincibleUntil = -1;
  obstacles: Obstacle[] = [];
  pauseReasons = new Set<PauseReason>();
  feedback: Feedback | null = null;
  private consumed = new Set<number>();
  private acceptFromPreview = false;
  constructor(
    readonly duration: number = CONFIG.duration,
    readonly maxHealth: number = CONFIG.hearts * CONFIG.healthPerHeart,
  ) {
    this.health = maxHealth;
  }
  start(actions: readonly Action[] = ACTIONS, options: { acceptFromPreview?: boolean } = {}) {
    if (!actions.length) throw new Error("至少需要一種遊戲動作");
    this.acceptFromPreview = options.acceptFromPreview ?? false;
    this.time = this.score = this.successes = this.misses = 0;
    this.health = this.maxHealth;
    this.invincibleUntil = -1;
    this.feedback = null;
    this.consumed.clear();
    this.pauseReasons.clear();
    this.countdown = CONFIG.countdown;
    this.phase = "countdown";
    this.obstacles = [];
    for (
      let t: number = Math.max(CONFIG.firstCollision, actionPreview(actions[0]) + 1), id = 0;
      t < this.duration;
      t += CONFIG.obstacleGap + Math.max(0, actionPreview(actions[(id + 1) % actions.length]) - CONFIG.preview), id++
    )
      this.obstacles.push({
        id,
        action: actions[id % actions.length],
        collision: t,
        result: "pending",
      });
  }
  tick(dt: number, event?: ActionEvent) {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (this.phase === "countdown") {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown <= 0) this.phase = "playing";
      return; // Countdown never advances the gameplay clock.
    }
    if (this.phase !== "playing") return;
    this.time = Math.min(this.duration, this.time + dt);
    if (event) this.accept(event);
    for (const o of this.obstacles) {
      if (o.result !== "pending" || this.time <= o.collision) continue;
      if (o.completed) { this.succeed(o); continue; }
      o.result = "miss";
      this.misses++;
      const damaged = this.time >= this.invincibleUntil;
      if (damaged) {
        this.health = Math.max(0, this.health - CONFIG.healthPerHeart);
        this.invincibleUntil = this.time + CONFIG.invincible;
      }
      this.feedback = {
        kind: "miss",
        action: o.action,
        at: this.time,
        damaged,
      };
      if (!this.health) {
        this.phase = "finished";
        return;
      }
    }
    if (this.time >= this.duration) this.phase = "finished";
  }
  accept(event: ActionEvent) {
    if (
      this.phase !== "playing" ||
      this.consumed.has(event.id) ||
      !Number.isFinite(event.time)
    )
      return;
    // Reject stale/future events, including samples captured before a pause.
    if (event.time - this.time > 1e-6 || this.time - event.time > 0.25) return;
    this.consumed.add(event.id);
    const target = this.acceptFromPreview ? this.next : undefined;
    const o = this.obstacles.find(
      (o) =>
        o.result === "pending" &&
        !o.completed &&
        (!this.acceptFromPreview || o === target) &&
        o.action === event.action &&
        event.time >= o.collision - (this.acceptFromPreview ? actionPreview(o.action) : CONFIG.windows[o.action]) &&
        event.time <= o.collision,
    );
    if (!o) return;
    if (this.acceptFromPreview) { o.completed = true; return; }
    this.succeed(o);
  }
  private succeed(o: Obstacle) {
    o.result = "success";
    this.successes++;
    this.health = Math.min(this.maxHealth, this.health + 1);
    this.score += CONFIG.score;
    this.feedback = {
      kind: "success",
      action: o.action,
      at: this.time,
      damaged: false,
    };
  }
  pause(reason: PauseReason) {
    if (!["playing", "countdown", "paused"].includes(this.phase)) return;
    this.pauseReasons.add(reason);
    this.phase = "paused";
  }
  clearPause(reason: PauseReason) {
    this.pauseReasons.delete(reason);
  }
  resume() {
    if (this.phase !== "paused" || this.pauseReasons.size) return false;
    // Re-preview the next unresolved obstacle, including any interrupted window.
    const next = this.obstacles.find((o) => o.result === "pending");
    if (next && next.collision - this.time < actionPreview(next.action)) {
      const shift = actionPreview(next.action) - (next.collision - this.time);
      for (const o of this.obstacles)
        if (o.result === "pending") o.collision += shift;
    }
    this.phase = "countdown";
    this.countdown = CONFIG.countdown;
    return true;
  }
  get next() {
    return this.phase === "idle" || this.phase === "finished"
      ? undefined
      : this.obstacles.find(
          (o) =>
            o.result === "pending" && o.collision - this.time <= actionPreview(o.action),
        );
  }
  get remaining() {
    return Math.ceil(this.duration - this.time);
  }
}
