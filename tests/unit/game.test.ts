import { describe, expect, it } from "vitest";
import { Game } from "../../src/game";
import { CONFIG } from "../../src/config";
function playing() {
  const g = new Game();
  g.start();
  g.tick(CONFIG.countdown);
  return g;
}
describe("game clock and judgement", () => {
  it("adds one health per success, caps at nine and consumes each event once", () => {
    const g = playing();
    g.tick(CONFIG.firstCollision + 0.01);
    expect(g.health).toBe(6);
    for (const [index, o] of g.obstacles.slice(1, 6).entries()) {
      g.tick(o.collision - 0.3 - g.time);
      const event = { id: o.id, action: o.action, time: g.time };
      g.accept(event);
      g.accept(event);
      expect(g.health).toBe(Math.min(9, 7 + index));
    }
    g.tick(g.obstacles[6].collision + 0.01 - g.time);
    expect(g.health).toBe(6); // Successes at full health cannot be banked.
    g.start();
    expect(g.health).toBe(9);
  });
  it("preserves fractional health on damage, stays alive at one and clamps damage at zero", () => {
    const g = playing();
    const expectedHealth = [6, 3, 4, 1, 2, 0];
    for (const [index, o] of g.obstacles.slice(0, 6).entries()) {
      if (index === 2 || index === 4) {
        g.tick(o.collision - 0.3 - g.time);
        g.accept({ id: o.id, action: o.action, time: g.time });
      } else {
        g.tick(o.collision + 0.01 - g.time);
      }
      expect(g.health).toBe(expectedHealth[index]);
      expect(g.phase).toBe(index === 5 ? "finished" : "playing");
    }
    g.start();
    expect(g.health).toBe(9);
  });
  it("ignores successes at full health and preserves fractional health on protected misses", () => {
    const g = playing();
    for (const o of g.obstacles.slice(0, 4)) {
      g.tick(o.collision - 0.3 - g.time);
      g.accept({ id: o.id, action: o.action, time: g.time });
      expect(g.health).toBe(9);
    }
    g.tick(g.obstacles[4].collision + 0.01 - g.time);
    expect(g.health).toBe(6);
    const o = g.obstacles[5];
    g.tick(o.collision - 0.3 - g.time);
    g.accept({ id: o.id, action: o.action, time: g.time });
    expect(g.health).toBe(7);
    g.invincibleUntil = g.obstacles[6].collision + 2;
    g.tick(g.obstacles[6].collision + 0.01 - g.time);
    expect(g.health).toBe(7);
    g.start();
    expect(g.health).toBe(9);
  });
  it("can run a long engineering session without changing default gameplay", () => {
    const lab = new Game(600, 3000);
    expect(lab.health).toBe(3000);
    lab.start();
    lab.tick(3);
    lab.tick(121);
    expect(lab.time).toBe(121);
    expect(lab.phase).toBe("playing");
    const normal = new Game();
    expect(normal.duration).toBe(60);
  });
  it("judges a newly sampled action on the current frame clock", () => {
    const g = playing();
    g.tick(4.35);
    g.tick(0.1, { id: 1, action: "jump", time: 4.45 });
    expect(g.successes).toBe(1);
    expect(g.misses).toBe(0);
  });
  it("does not advance during countdown, pause or invalid deltas", () => {
    const g = new Game();
    g.start();
    g.tick(1);
    expect(g.time).toBe(0);
    g.tick(2);
    g.tick(1);
    expect(g.time).toBe(1);
    g.pause("manual");
    g.tick(20);
    g.tick(NaN);
    g.tick(-1);
    expect(g.time).toBe(1);
  });
  it("accepts window boundaries once and consumes an event at most once", () => {
    for (const offset of [0.6, 0]) {
      const g = playing();
      g.tick(CONFIG.firstCollision - offset);
      g.accept({ id: 1, action: "jump", time: g.time });
      g.accept({ id: 1, action: "jump", time: g.time });
      expect(g.successes).toBe(1);
      expect(g.score).toBe(100);
      expect(g.health).toBe(9);
      g.tick(1);
      expect(g.misses).toBe(0);
    }
  });
  it("rejects early, wrong-direction, stale and future events", () => {
    const g = playing();
    g.tick(4);
    g.accept({ id: 1, action: "jump", time: 4 });
    g.tick(0.5);
    g.accept({ id: 1, action: "jump", time: 4.5 }); // Early event cannot be reused.
    g.accept({ id: 2, action: "left", time: 4.5 });
    g.accept({ id: 3, action: "jump", time: 4 });
    g.accept({ id: 4, action: "jump", time: 5 });
    expect(g.score).toBe(0);
    g.tick(0.51);
    expect(g.misses).toBe(1);
    expect(g.health).toBe(6);
  });
  it("does not damage during tracking pause and gives a full new preview on resume", () => {
    const g = playing();
    g.tick(4.7);
    g.pause("tracking");
    g.tick(100);
    expect(g.health).toBe(9);
    expect(g.time).toBe(4.7);
    expect(g.resume()).toBe(false);
    g.clearPause("tracking");
    expect(g.resume()).toBe(true);
    expect(g.obstacles[0].collision - g.time).toBeCloseTo(CONFIG.preview);
    expect(g.misses).toBe(0);
    g.tick(3);
    expect(g.time).toBe(4.7);
  });
  it("preserves explicit pause when tracking recovers", () => {
    const g = playing();
    g.pause("manual");
    g.pause("tracking");
    g.clearPause("tracking");
    expect(g.resume()).toBe(false);
    expect(g.phase).toBe("paused");
    g.clearPause("manual");
    expect(g.resume()).toBe(true);
  });
  it("records failures but only damages once inside invincibility, and freezes invincibility", () => {
    const g = playing();
    g.obstacles[1].collision = 5.2;
    g.tick(5.01);
    expect(g.health).toBe(6);
    g.pause("manual");
    const until = g.invincibleUntil;
    g.tick(20);
    expect(g.invincibleUntil).toBe(until);
    g.clearPause("manual");
    g.resume();
    g.tick(3);
    // Resume re-previews the next pending obstacle, so test the invincibility rule directly.
    g.obstacles[1].collision = g.time + 0.1;
    g.tick(0.2);
    expect(g.misses).toBe(2);
    expect(g.health).toBe(6);
  });
  it("finishes at zero health and resets all session state", () => {
    const g = playing();
    g.tick(5.1);
    g.tick(4);
    g.tick(4);
    expect(g.phase).toBe("finished");
    expect(g.health).toBe(0);
    expect(g.misses).toBe(3);
    g.start();
    expect(g.phase).toBe("countdown");
    expect(g.health).toBe(9);
    expect(g.time).toBe(0);
    expect(g.misses).toBe(0);
    expect(g.score).toBe(0);
    expect(g.feedback).toBeNull();
  });
  it("finishes at 60s with valid outcomes, without counting tracking interruptions", () => {
    const g = playing();
    for (const o of g.obstacles) {
      g.tick(o.collision - 0.3 - g.time);
      g.accept({ id: o.id, action: o.action, time: g.time });
    }
    g.tick(60 - g.time);
    expect(g.phase).toBe("finished");
    expect(g.time).toBe(60);
    expect(g.misses).toBe(0);
    expect(g.health).toBe(9);
    expect(g.successes).toBe(g.obstacles.length);
  });
});

describe("face actions completed during the visible preview", () => {
  function face(actions: readonly import("../../src/config").Action[] = ["jump", "jump"]) {
    const g = new Game(); g.start(actions, { acceptFromPreview: true }); g.tick(3); return g;
  }
  it("remembers an early action until collision, then rewards exactly once", () => {
    const g = face(); const o = g.obstacles[0];
    g.tick(o.collision - CONFIG.preview);
    g.accept({ id: 1, action: "jump", time: g.time });
    expect(o.completed).toBe(true); expect(g.next).toBe(o);
    expect(g.score).toBe(0); expect(o.result).toBe("pending");
    g.accept({ id: 2, action: "jump", time: g.time });
    expect(g.obstacles[1].completed).toBeUndefined();
    g.tick(CONFIG.preview + .01);
    expect(o.result).toBe("success"); expect(g.score).toBe(100); expect(g.misses).toBe(0);
    g.tick(.5); expect(g.score).toBe(100);
  });
  it("does not carry completion forward to another identical obstacle", () => {
    const g = face(); const [first, second] = g.obstacles;
    g.tick(first.collision - CONFIG.preview);
    g.accept({ id: 1, action: "jump", time: g.time });
    g.tick(second.collision + .01 - g.time);
    expect(first.result).toBe("success"); expect(second.result).toBe("miss");
    expect(g.score).toBe(100); expect(g.misses).toBe(1);
  });
  it("requires the current visible target and rejects pre-preview, late, stale or wrong events", () => {
    const g = face(["jump", "duck"]); const first = g.obstacles[0];
    g.tick(first.collision - CONFIG.preview - .1);
    g.accept({ id: 1, action: "jump", time: g.time }); expect(first.completed).toBeUndefined();
    g.tick(.2);
    g.accept({ id: 2, action: "duck", time: g.time });
    g.accept({ id: 3, action: "jump", time: g.time - 1 });
    g.accept({ id: 4, action: "jump", time: g.time + 1 });
    expect(first.completed).toBeUndefined();
    g.tick(first.collision + .01 - g.time);
    g.accept({ id: 5, action: "jump", time: g.time });
    expect(first.result).toBe("miss"); expect(g.score).toBe(0);
  });
  it("accepts poses, combinations and completed smash cycles throughout their preview", () => {
    for (const action of ["pose_t", "pose_side_bend", "pose_tree", "smash"] as const) {
      const g = face([action]); const o = g.obstacles[0];
      g.tick(o.collision - (action === "smash" ? 5 : 2.5));
      g.accept({ id: 1, action, time: g.time }); expect(o.completed).toBe(true);
      g.tick(o.collision + .01 - g.time); expect(g.score).toBe(100);
    }
  });
  it("preserves completed actions across pauses and clears them and the policy on restart", () => {
    const g = face(); g.tick(2.5); g.accept({ id: 1, action: "jump", time: g.time });
    g.pause("manual"); g.tick(20); expect(g.time).toBe(2.5);
    g.clearPause("manual"); g.resume(); g.tick(3);
    g.tick(g.obstacles[0].collision + .01 - g.time);
    expect(g.score).toBe(100); expect(g.misses).toBe(0);
    g.start(); g.tick(3); g.tick(2.5); g.accept({ id: 2, action: "jump", time: g.time });
    expect(g.obstacles[0].completed).toBeUndefined(); expect(g.score).toBe(0);
  });
});
