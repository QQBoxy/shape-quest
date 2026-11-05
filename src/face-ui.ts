import { drawCameraImage } from "./camera-orientation";
import type { Action } from "./config";
import { FACE_LABEL, FACE_CHANNEL_LABEL, faceActionParts, type FaceProfile, type FaceFeatures, type FaceBaseline } from "./face-actions";

// Each lesson supplies elapsed time from its own start, never the global clock.
export function faceDemoAmount(elapsed: number, action?: Action, reduced = false) {
  if (reduced) return 1;
  const duration = action === "smash" ? 1800 : 3300;
  const phase = (Math.max(0, elapsed) % duration) / duration;
  if (phase < 0.15) return 0; // Show the neutral face before moving.
  if (phase < 0.4) return (1 - Math.cos((phase - 0.15) / 0.25 * Math.PI)) / 2;
  if (phase < 0.6) return 1; // Hold the demonstrated target.
  if (phase < 0.85) return (1 + Math.cos((phase - 0.6) / 0.25 * Math.PI)) / 2;
  return 0;
}

// Shared, code-native face illustrations for obstacle cues and animated lessons.
export function drawFaceGlyph(c: CanvasRenderingContext2D, action: Action | null,
  x: number, y: number, size: number, amount = 1) {
  c.save(); c.translate(x, y); c.scale(size, size);
  const dx = action === "left" ? -0.18 : action === "right" ? 0.18 : 0;
  const dy = action === "jump" ? -0.14 : action === "duck" ? 0.14 : 0;
  const tilt = action === "pose_lunge" ? -0.3 : action === "pose_knee" ? 0.3 : 0;
  const yaw = action === "left" ? -amount : action === "right" ? amount : 0;
  const pitch = action === "jump" ? -amount : action === "duck" ? amount : 0;
  c.rotate(tilt * amount);
  c.lineWidth = 0.025; c.strokeStyle = "#633d83"; c.fillStyle = "#ffe6c1";
  c.beginPath(); c.ellipse(0, 0, 0.27 - Math.abs(yaw) * 0.05, 0.32 - Math.abs(pitch) * 0.025, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#593c6d";
  c.save(); c.translate(yaw * 0.11, pitch * 0.09);
  c.scale(1 - Math.abs(yaw) * 0.2, 1 - Math.abs(pitch) * 0.2);
  const wide = action === "pose_arms_l" ? amount : 0;
  const closed = action === "pose_tree" ? amount : 0;
  for (const side of [-1, 1]) {
    c.fillStyle = "white"; c.beginPath();
    c.ellipse(side * 0.105, -0.065, 0.06, 0.055 + wide * 0.018, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    const browX = side * 0.105;
    const browY = -0.15 - wide * 0.06;
    c.beginPath(); c.moveTo(browX - 0.055, browY);
    c.quadraticCurveTo(browX, browY - 0.03, browX + 0.055,
      browY); c.stroke();
    c.fillStyle = "#593c6d"; c.beginPath();
    c.ellipse(side * 0.105, -0.065, 0.026, 0.034, 0, 0, Math.PI * 2); c.fill();
  }
  const open = ["pose_t", "smash"].includes(action ?? "") ? amount : 0;
  c.beginPath(); c.moveTo(0, -0.015); c.lineTo(yaw * 0.06 - 0.025, 0.07); c.lineTo(0.025, 0.07); c.stroke();
  if (action === "pose_side_bend" && amount > 0.12) {
    c.fillStyle = "white"; c.beginPath(); c.ellipse(0, 0.14, 0.105, 0.025 + 0.025 * amount, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
  } else if (open > 0.12) {
    c.fillStyle = "#81394c"; c.beginPath(); c.ellipse(0, 0.145, 0.07, 0.025 + 0.065 * open, 0, 0, Math.PI * 2); c.fill();
  } else {
    c.beginPath(); c.moveTo(-0.075, 0.12 + closed * 0.02);
    c.quadraticCurveTo(0, 0.20 - closed * 0.05, 0.075, 0.12 + closed * 0.02); c.stroke();
  }
  c.restore(); c.restore();
  if (dx || dy) {
    c.save(); c.translate(x, y); c.strokeStyle = "#7953c4"; c.lineWidth = Math.max(2, size * 0.025);
    const ax = dx ? Math.sign(dx) * size * 0.43 : 0;
    const ay = dy ? Math.sign(dy) * size * 0.43 : 0;
    c.beginPath(); c.moveTo(ax * 0.5 - ay * 0.25, ay * 0.5 + ax * 0.25); c.quadraticCurveTo(ax - ay * 0.3, ay + ax * 0.3, ax, ay);
    const angle = Math.atan2(ay, ax);
    for (const turn of [-0.65, 0.65]) {
      c.moveTo(ax - Math.cos(angle + turn) * size * 0.09, ay - Math.sin(angle + turn) * size * 0.09);
      c.lineTo(ax, ay);
    }
    c.stroke(); c.restore();
  }
}
export interface CameraFaceGuide {
  action?: Action;
  amount: number;
  progress: number;
  message: string;
  live: FaceFeatures | null;
  returning: boolean;
  done?: boolean;
  nextAction?: Action;
  releaseAction?: Action;
  conditionMatches?: readonly boolean[];
  profile?: FaceProfile;
}
export function drawFaceCamera(canvas: HTMLCanvasElement, video: HTMLVideoElement,
  baseline: FaceBaseline | null, guide?: CameraFaceGuide, rotation = 0) {
  let w = guide ? Math.max(640, canvas.clientWidth) : 640;
  let h = guide && canvas.clientWidth && canvas.clientHeight
    ? Math.max(1, Math.round(w * canvas.clientHeight / canvas.clientWidth))
    : video.videoWidth ? w * (Math.abs(rotation / 90) % 2 === 1 ? video.videoWidth / video.videoHeight : video.videoHeight / video.videoWidth) : 480;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, w, h);
  const overlayScale = guide ? Math.min(1, h / 620) : 1;
  if (video.readyState >= 2) {
    // Reserve caption space at every size so instructions never cover the camera image.
    const top = guide ? 45 * overlayScale : 0;
    const videoHeight = guide ? h - top - 190 * overlayScale : h;
    drawCameraImage(c, video, 0, top, w, videoHeight, rotation, !!guide);
  }
  if (!guide) return; // During play the camera stays a simple preview.
  // Fit the instruction artwork to the available height, including short phones.
  c.save(); c.scale(overlayScale, overlayScale);
  w /= overlayScale; h /= overlayScale;
  const action = guide.action;
  const f = guide.live, b = baseline;
  const bottomHeight = 190;
  const x = w / 2, y = (h - bottomHeight + 44) / 2;
  c.save(); c.globalAlpha = 0.58;
  drawFaceGlyph(c, action ?? null, x, y, Math.min(w * 0.8, (h - bottomHeight - 44) * 1.25), guide.amount);
  c.restore();
  const title = guide.done ? "準備完成！" : !f ? "請讓整張臉入鏡" : guide.returning
    ? guide.message.startsWith("已放鬆") ? "放鬆完成 ✓" : "放鬆一下"
    : action ? FACE_LABEL[action] : "自然看著畫面";
  c.fillStyle = "#132b25d9"; c.fillRect(0, 0, w, 45);
  c.font = "bold 22px system-ui"; c.fillStyle = "#fff"; c.textAlign = "center";
  c.fillText("臉部校正", w / 2, 30, w - 24);
  const measuredAction = guide.releaseAction ?? action;
  const parts = measuredAction && f && b ? faceActionParts(f, b, measuredAction, guide.profile) : [];
  const amplitude = parts.length ? Math.max(0, Math.min(1, ...parts.map(p => !p.available ? 0
    : guide.returning ? 1 - Math.max(0, p.value - p.exit) / (p.enter - p.exit) : p.value / p.enter))) : 0;
  const conditions = parts.map((p, i) => {
    const matched = guide.conditionMatches?.[i] ?? (p.available && p.value >= p.enter);
    return `${FACE_CHANNEL_LABEL[p.channel]} ${!p.available ? "資料不足" : matched ? "保持住 ✓" : `${Math.round(Math.max(0, p.value / p.enter) * 100)}%`}`;
  }).join(" · ");
  const detail = guide.returning ? guide.message : [conditions, guide.message].filter(Boolean).join(" · ");
  const pending = parts.filter(p => !p.released).map(p => `${FACE_CHANNEL_LABEL[p.channel]}${p.available ? "待放鬆" : "資料不足"}`).join("、");
  const hint = guide.done ? "按下方按鈕，就能出發囉！" : !f ? "坐舒服，確認光線與鏡頭位置" : guide.returning
    ? [pending, guide.nextAction ? `接著${FACE_LABEL[guide.nextAction]}` : "放鬆後就能出發囉！"].filter(Boolean).join("。")
    : guide.message.replace(/^接下來：[^。]+。/, "").split("。")[0]
      + (guide.message.match(/（[^）]+）$/)?.[0] ?? "");
  const lines: string[] = []; let line = "";
  c.font = "24px system-ui";
  for (const char of hint) {
    if (c.measureText(line + char).width > w - 32) { lines.push(line); line = ""; }
    line += char;
  }
  if (line) lines.push(line);
  c.fillStyle = "#132b25e6"; c.fillRect(0, h - bottomHeight, w, bottomHeight);
  c.fillStyle = "#fff";
  c.font = "bold 36px system-ui";
  c.fillText(title, w / 2, h - bottomHeight + 42, w - 32);
  c.font = "24px system-ui";
  lines.slice(0, 2).forEach((text, i) => c.fillText(text, w / 2, h - bottomHeight + 77 + i * 28, w - 32));
  c.font = "22px system-ui";
  c.textAlign = "left";
  for (const [i, p] of [amplitude, guide.progress].entries()) {
    const yy = h - 48 + i * 30;
    c.fillStyle = "#fff";
    c.fillText(i === 0 ? guide.returning ? "放鬆程度" : "動作幅度" : "維持進度", 20, yy + 10);
    c.fillStyle = "#ffffff33"; c.fillRect(132, yy, w - 152, 8);
    c.fillStyle = i === 0 ? "#ffe6a4" : "#a6ffc8"; c.fillRect(132, yy, (w - 152) * p, 8);
  }
  canvas.setAttribute("aria-label", `${title}。${detail}。${guide.returning ? "放鬆進度" : "動作幅度"} ${Math.round(amplitude * 100)}%。維持進度 ${Math.round(guide.progress * 100)}%`);
  c.restore();
}
