import { drawCameraImage } from "./camera-orientation";
import { CONFIG, LABEL, type Action, type Projection } from "./config";
import type { Baseline, Point } from "./actions";
import type { Game } from "./game";
import { FACE_LABEL } from "./face-actions";
import { drawFaceGlyph } from "./face-ui";
const W = 1280,
  H = 720;
export function project(
  x: number,
  y: number,
  z: number,
  p: Projection = CONFIG.projection,
) {
  return {
    x: W * (p.centerX + (x * p.focal) / z),
    y:
      H *
      (p.horizon + ((((1 - p.horizon) * p.near) / p.focal - y) * p.focal) / z),
    scale: p.focal / z,
  };
}
function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 12,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
export function person(
  ctx: CanvasRenderingContext2D,
  action: Action | null,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.055;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const duck = action === "duck",
    jump = action === "jump";
  const lean = action === "left" ? -0.12 : action === "right" ? 0.12 : 0;
  const headY = duck ? -0.48 : -0.87;
  ctx.beginPath();
  ctx.arc(lean, headY, 0.085, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lean, headY + 0.15);
  ctx.lineTo(lean, duck ? -0.25 : -0.36);
  ctx.moveTo(lean - 0.25, jump ? -0.9 : duck ? -0.3 : -0.55);
  ctx.lineTo(lean, headY + 0.22);
  ctx.lineTo(lean + 0.25, jump ? -0.9 : duck ? -0.3 : -0.55);
  ctx.moveTo(lean, duck ? -0.25 : -0.36);
  ctx.lineTo(lean - 0.22, duck ? -0.15 : -0.17);
  ctx.lineTo(lean - 0.15, 0);
  ctx.moveTo(lean, duck ? -0.25 : -0.36);
  ctx.lineTo(lean + 0.22, duck ? -0.15 : -0.17);
  ctx.lineTo(lean + 0.15, 0);
  ctx.stroke();
  ctx.restore();
}
export class Renderer {
  ctx: CanvasRenderingContext2D;
  debug = false;
  faceMode = false;
  projection: Projection = { ...CONFIG.projection };
  private project(x: number, y: number, z: number) {
    return project(x, y, z, this.projection);
  }
  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }
  draw(
    game: Game,
    sceneryTime: number,
    hasVideo: boolean,
  ) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    // Keep the drawing buffer at the scene's aspect ratio. CSS can then fit it
    // without stretching people, obstacles, or the video underneath.
    const fit = game.phase === "idle" ? Math.max : Math.min;
    const scale = fit(
      this.canvas.clientWidth / W,
      this.canvas.clientHeight / H,
    );
    const width = Math.max(1, Math.round(W * scale * ratio)),
      height = Math.max(1, Math.round((width * H) / W));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const c = this.ctx;
    c.setTransform(width / W, 0, 0, height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!hasVideo) this.scenery(sceneryTime);
    else this.road(sceneryTime);
    const o = game.next;
    if (o) {
      const z =
        this.projection.near +
        Math.max(0, o.collision - game.time) * this.projection.speed;
      const roadHalf =
        (this.projection.nearHalfWidth * this.projection.near) /
        this.projection.focal;
      const laneCenter = (roadHalf * 2) / 3;
      const beamHalf = roadHalf * 0.9;
      const center =
        o.action === "left"
          ? laneCenter
          : o.action === "right"
            ? -laneCenter
            : 0;
      const base = this.project(center, 0, z),
        top = this.project(center, o.action === "duck" ? 1.1 : 0.36, z);
      const unit = W * base.scale;
      c.save();
      c.shadowColor = "#164b4533";
      c.shadowBlur = 16;
      c.fillStyle = "#224b4530";
      c.beginPath();
      c.ellipse(
        base.x,
        base.y + 4,
        unit * 0.52,
        unit * 0.06,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      if (o.action.startsWith("pose_") || o.action === "smash") {
        const wallWidth = unit * beamHalf * 2;
        const wallHeight = unit * 1.05;
        pill(c, base.x - wallWidth / 2, base.y - wallHeight, wallWidth, wallHeight,
          o.action === "smash" ? "#de9865" : "#a38bd6", Math.max(5, unit * 0.04));
        pill(c, base.x - wallWidth * 0.42, base.y - wallHeight * 0.92, wallWidth * 0.84,
          wallHeight * 0.8, "#fff3", Math.max(5, unit * 0.04));
      } else if (o.action === "duck") {
        pill(
          c,
          base.x - unit * beamHalf,
          top.y,
          unit * beamHalf * 2,
          unit * 0.13,
          "#9a6ed6",
          Math.max(4, unit * 0.04),
        );
        pill(
          c,
          base.x - unit * beamHalf,
          top.y,
          unit * 0.1,
          base.y - top.y,
          "#be9ce8",
          4,
        );
        pill(
          c,
          base.x + unit * (beamHalf - 0.1),
          top.y,
          unit * 0.1,
          base.y - top.y,
          "#be9ce8",
          4,
        );
      } else {
        const bw =
          ((unit * roadHalf * 2) / 3) * (o.action === "jump" ? 0.9 : 0.8);
        pill(
          c,
          base.x - bw / 2,
          top.y,
          bw,
          base.y - top.y,
          o.action === "jump" ? "#f6ae4b" : "#65ad9c",
          Math.max(4, unit * 0.045),
        );
        pill(
          c,
          base.x - bw / 2 + 5,
          top.y + 5,
          bw - 10,
          Math.max(3, (base.y - top.y) * 0.13),
          "#ffffff50",
          4,
        );
      }
      c.shadowBlur = 0;
      const guide = this.project(
        o.action === "left"
          ? -laneCenter
          : o.action === "right"
            ? laneCenter
            : 0,
        0,
        z,
      );
      const size = Math.max(30, unit * 0.65);
      c.fillStyle = "#fffc";
      c.beginPath();
      c.ellipse(guide.x, guide.y, size * 0.38, size * 0.07, 0, 0, Math.PI * 2);
      c.fill();
      if (this.faceMode) drawFaceGlyph(c, o.action, guide.x, guide.y - size * 0.55, size);
      else person(c, o.action, guide.x, guide.y - 8, size, "#fff");
      const windowOpen = this.faceMode || o.collision - game.time <= CONFIG.windows[o.action];
      const labelY = Math.max(130, top.y - size * 1.2);
      c.font = "bold 26px system-ui";
      c.textAlign = "center";
      pill(
        c,
        guide.x - 87,
        labelY - 28,
        174,
        44,
        windowOpen ? "#256b54" : "#fff",
        22,
      );
      c.fillStyle = windowOpen ? "#fff" : "#285c4e";
      c.font = "bold 22px system-ui";
      c.fillText(o.completed ? "已完成 ✓" : this.faceMode ? FACE_LABEL[o.action] : windowOpen ? "現在！" : LABEL[o.action], guide.x, labelY + 2, 160);
      if (this.debug) {
        c.strokeStyle = "#00fbff";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(base.x - 13, base.y);
        c.lineTo(base.x + 13, base.y);
        c.moveTo(base.x, base.y - 10);
        c.lineTo(base.x, base.y + 10);
        c.stroke();
        c.font = "14px monospace";
        c.fillStyle = "#093d43";
        c.textAlign = "center";
        c.fillText(`GROUND z=${z.toFixed(2)}`, base.x, base.y + 24);
      }
      c.restore();
    }
    const f = game.feedback;
    if (f && game.time - f.at < 0.85 && game.phase !== "idle") {
      const age = game.time - f.at;
      c.save();
      c.globalAlpha = 1 - age / 0.85;
      if (f.kind === "success") {
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6,
            r = 45 + age * 150;
          c.fillStyle = i % 2 ? "#fff8bf" : "#6ddeaf";
          c.beginPath();
          c.arc(
            640 + Math.cos(a) * r,
            390 + Math.sin(a) * r,
            6,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      } else {
        c.strokeStyle = "#efaf91";
        c.lineWidth = 14;
        c.strokeRect(7, 7, W - 14, H - 14);
      }
      c.restore();
    }
    if (this.debug) this.overlay();
  }
  scenery(time: number) {
    const c = this.ctx,
      horizon = H * this.projection.horizon;
    const sky = c.createLinearGradient(0, 0, 0, horizon + 100);
    sky.addColorStop(0, "#a7dce5");
    sky.addColorStop(1, "#e9f5d8");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff2b9";
    c.beginPath();
    c.arc(1010, 110, 48, 0, Math.PI * 2);
    c.fill();
    for (const [x, y, s] of [
      [150, 95, 1],
      [480, 63, 0.7],
      [820, 153, 0.65],
    ]) {
      c.fillStyle = "#ffffffa0";
      c.beginPath();
      c.ellipse(x, y, 70 * s, 20 * s, 0, 0, Math.PI * 2);
      c.ellipse(x - 20 * s, y - 17 * s, 35 * s, 28 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#a0c9a0";
    c.beginPath();
    c.moveTo(0, horizon);
    c.bezierCurveTo(170, 130, 230, 210, 450, horizon);
    c.bezierCurveTo(690, 155, 820, 225, 1040, horizon);
    c.bezierCurveTo(1160, 180, 1220, 220, W, horizon);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.fillStyle = "#79ad83";
    c.beginPath();
    c.moveTo(0, horizon + 20);
    c.bezierCurveTo(200, 250, 330, 250, 640, horizon + 30);
    c.bezierCurveTo(800, 220, 1040, 265, W, horizon);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.fillStyle = "#a5c879";
    c.fillRect(0, horizon + 45, W, H);
    const road = c.createLinearGradient(0, horizon, 0, H);
    road.addColorStop(0, "#e0d6ae");
    road.addColorStop(1, "#f2dfac");
    c.fillStyle = road;
    c.beginPath();
    c.moveTo(W / 2, horizon);
    c.lineTo(W * 0.96, H);
    c.lineTo(W * 0.04, H);
    c.closePath();
    c.fill();
    for (const lane of [-1 / 3, 1 / 3]) {
      c.strokeStyle = "#fff6da60";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(W / 2, horizon);
      c.lineTo(W * (0.5 + 0.46 * lane), H);
      c.stroke();
    }
    // Fixed world speed matches obstacle motion; decorations stay outside the road.
    const travel = time * this.projection.speed;
    for (let i = 13; i >= 0; i--) {
      const z = this.projection.near + ((i * 5 - (travel % 70) + 70) % 70);
      for (const side of [-1, 1]) {
        const p = this.project(side * (1.45 + (i % 3) * 0.2), 0, z),
          size = 210 * p.scale;
        if (p.x < -180 || p.x > W + 180) continue;
        c.fillStyle = "#416c52";
        c.fillRect(p.x - size * 0.05, p.y - size * 0.9, size * 0.1, size * 0.9);
        c.fillStyle = i % 2 ? "#4e9673" : "#67a66e";
        c.beginPath();
        c.ellipse(p.x, p.y - size, size * 0.5, size * 0.68, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#92bc7e";
        c.beginPath();
        c.ellipse(
          p.x - size * 0.15,
          p.y - size * 1.2,
          size * 0.22,
          size * 0.25,
          -0.4,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      const p = this.project(0.13 * ((i % 3) - 1), 0, z);
      c.fillStyle = "#c9b47a30";
      c.beginPath();
      c.ellipse(p.x, p.y, 35 * p.scale, 5 * p.scale, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  road(time: number) {
    const c = this.ctx, p = this.projection;
    c.fillStyle = "#fff9eb80";
    c.beginPath(); c.moveTo(W * p.centerX, H * p.horizon);
    c.lineTo(W * (.5 + p.nearHalfWidth), H);
    c.lineTo(W * (.5 - p.nearHalfWidth), H); c.closePath(); c.fill();
    c.strokeStyle = "#ffffffbd";
    for (const lane of [-1 / 3, 1 / 3]) {
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(W * p.centerX, H * p.horizon);
      c.lineTo(W * (.5 + p.nearHalfWidth * lane), H); c.stroke();
    }
    const half = p.nearHalfWidth * p.near / p.focal;
    c.strokeStyle = "#ffffff66";
    for (let i = 0; i < 14; i++) {
      const z = p.near + ((i * 5 - time * p.speed % 70 + 70) % 70);
      const l = this.project(-half, 0, z), r = this.project(half, 0, z);
      c.lineWidth = Math.max(1, 5 * l.scale);
      c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
    }
  }
  overlay() {
    const c = this.ctx,
      h = H * this.projection.horizon;
    c.save();
    c.strokeStyle = "#fd5aa7";
    c.lineWidth = 2;
    c.setLineDash([8, 6]);
    for (const x of [-1, -1 / 3, 1 / 3, 1].map(
      (l) => this.projection.centerX + l * this.projection.nearHalfWidth,
    )) {
      c.beginPath();
      c.moveTo(W * this.projection.centerX, h);
      c.lineTo(x * W, H);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, h);
    c.lineTo(W, h);
    c.moveTo(W * this.projection.centerX, 0);
    c.lineTo(W * this.projection.centerX, H);
    c.stroke();
    c.fillStyle = "#fd5aa715";
    c.fillRect(W * 0.3, H * 0.35, W * 0.4, H * 0.55);
    c.strokeRect(W * 0.3, H * 0.35, W * 0.4, H * 0.55);
    c.setLineDash([]);
    c.beginPath();
    c.arc(W * this.projection.centerX, h, 7, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
}
const EDGES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];
const JOINTS = [...new Set(EDGES.flat())];
export function drawCamera(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  points: Point[],
  baseline: Baseline | null,
  rotation = 0,
  centerRange = baseline ? CONFIG.returnRange * baseline.height : CONFIG.setupCenterRange,
) {
  const c = canvas.getContext("2d")!;
  const w = 640,
    h = video.videoWidth ? 640 * (Math.abs(rotation / 90) % 2 === 1 ? video.videoWidth / video.videoHeight : video.videoHeight / video.videoWidth) : 480;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  c.clearRect(0, 0, w, h);
  if (video.readyState >= 2) {
    drawCameraImage(c, video, 0, 0, w, h, rotation);
  }
  c.fillStyle = "#80e0a438";
  c.fillRect((0.5 - centerRange) * w, 0, 2 * centerRange * w, h);
  c.strokeStyle = "#ffe6a4";
  c.lineWidth = 2;
  c.setLineDash([6, 5]);
  const guides = baseline ? [baseline.leftLimit, 0.5, baseline.rightLimit] : [0.5];
  for (const x of guides) {
    c.beginPath();
    c.moveTo(x * w, 0);
    c.lineTo(x * w, h);
    c.stroke();
  }
  c.setLineDash([]);
  c.strokeStyle = "#a6ffc8";
  c.lineWidth = 4;
  for (const [a, b] of EDGES)
    if (
      (points[a]?.visibility ?? 0) >= CONFIG.visibility &&
      (points[b]?.visibility ?? 0) >= CONFIG.visibility
    ) {
      c.beginPath();
      c.moveTo(points[a].x * w, points[a].y * h);
      c.lineTo(points[b].x * w, points[b].y * h);
      c.stroke();
    }
  c.fillStyle = "#fff";
  for (const index of JOINTS) {
    const p = points[index];
    if ((p?.visibility ?? 0) >= CONFIG.visibility) {
      c.beginPath();
      c.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  const visible = (index: number) =>
    (points[index]?.visibility ?? 0) >= CONFIG.visibility;
  const leftEye = points[2],
    rightEye = points[5];
  if (!visible(2) || !visible(5)) return;
  const eyeDistance = Math.hypot(
    (rightEye.x - leftEye.x) * w,
    (rightEye.y - leftEye.y) * h,
  );
  const size = Math.max(3, eyeDistance * 0.28);
  const angle = Math.atan2(
    (rightEye.y - leftEye.y) * h,
    (rightEye.x - leftEye.x) * w,
  );
  c.fillStyle = "#ff6b9d";
  for (const eye of [leftEye, rightEye]) {
    c.save();
    c.translate(eye.x * w, eye.y * h);
    // Keep the heart upright even when mirrored eye order points left.
    c.rotate(
      angle > Math.PI / 2
        ? angle - Math.PI
        : angle < -Math.PI / 2
          ? angle + Math.PI
          : angle,
    );
    c.beginPath();
    c.moveTo(0, -size * 0.4);
    c.bezierCurveTo(-size, -size * 1.3, -size * 1.5, size * 0.2, 0, size);
    c.bezierCurveTo(size * 1.5, size * 0.2, size, -size * 1.3, 0, -size * 0.4);
    c.fill();
    c.restore();
  }
  if (visible(0)) {
    const nose = points[0];
    c.fillStyle = "#ffd166";
    c.beginPath();
    c.moveTo(nose.x * w, nose.y * h - size * 0.7);
    c.lineTo(nose.x * w - size * 0.7, nose.y * h + size * 0.6);
    c.lineTo(nose.x * w + size * 0.7, nose.y * h + size * 0.6);
    c.closePath();
    c.fill();
  }
  if (visible(9) && visible(10)) {
    c.fillStyle = "#ff8fab";
    c.beginPath();
    c.ellipse(
      ((points[9].x + points[10].x) / 2) * w,
      ((points[9].y + points[10].y) / 2) * h,
      size * 1.2,
      size * 0.6,
      angle,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}
