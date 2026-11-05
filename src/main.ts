import "./styles.css";
import { CONFIG, FACE_ACTIONS, KEY, LABEL, asset, type Action } from "./config";
import { detectAction, features, freshDetector, type Point } from "./actions";
import { Calibration, CALIBRATION_STEPS } from "./calibration";
import { Game } from "./game";
import { Background } from "./background";
import { CANDY_SCENES, CANDY_DURATION, CANDY_PROJECTION } from "./scenes";
import { CameraCoordinates, cameraSide } from "./camera-orientation";
import { openCamera, cameraError, type CameraChoice } from "./camera";
import { Renderer, drawCamera } from "./renderer";
import type { PoseTracker } from "./pose";
import type { FaceTracker } from "./face";
import { FaceCalibration, FaceDetector, FACE_LABEL, FACE_CONFIG, FACE_CALIBRATION_STEPS, type FaceSample, type FaceFeatures } from "./face-actions";
import { drawFaceCamera, faceDemoAmount } from "./face-ui";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const icon = (action: Action) => {
  const shapes: Partial<Record<Action, string>> = {
    jump: '<path d="m8 15 4-4 4 4M12 11v11M5 9l2-5m12 5-2-5"/><circle cx="12" cy="5" r="2"/>',
    duck: '<circle cx="12" cy="7" r="2"/><path d="m7 13 5-3 5 3M12 10v5l-5 4h10M5 3h14"/>',
    left: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    right: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[action]}</svg>`;
};
$("app").innerHTML = `
<header class="site-header">
  <button id="menu-toggle" class="button menu-toggle" aria-label="選單" aria-haspopup="dialog" aria-controls="game-menu">☰ <span>選單</span></button>
  <a id="home-brand" class="brand" href="./" aria-label="奇形狀首頁"><span class="brand-mark"><i></i><i></i><i></i></span><span>奇形狀<small>SHAPE QUEST</small></span></a>
  <button id="fullscreen" class="button menu-toggle" aria-label="全螢幕">⛶ <span>全螢幕</span></button>
</header>
<main>
  <section id="stage" class="stage" aria-label="遊戲畫面">
    <video id="background" class="background-video" muted playsinline loop></video>
    <canvas id="world" aria-label="陽光草原跑酷道路"></canvas>
    <div id="scene-label" class="scene-label"><span class="sun-dot"></span> SUNNY MEADOW <span class="scene-sub">陽光草原 · 原型挑戰</span></div>
    <div id="hud" class="hud" hidden><div class="hud-left"><span id="hearts" class="hearts" role="img" aria-label="生命值">${Array.from({ length: CONFIG.hearts }, () => `<span class="heart" aria-hidden="true"><svg viewBox="0 0 24 24" class="heart-outline"><path d="M12 21S2 15 2 8a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13Z"/></svg><svg viewBox="0 0 24 24" class="heart-fill"><path d="M12 21S2 15 2 8a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13Z"/></svg></span>`).join("")}</span><span class="hud-rule"></span><span class="score-label">冒險分數 <strong id="score">0000</strong></span></div><div class="hud-right"><span id="mode-label"></span><span id="timer">60 秒</span></div></div>
    <div id="manual-hint" class="manual-hint" hidden>滑動操作：↑ 跳躍 · ↓ 蹲下 · ← → 跨步<span>也可以使用方向鍵／空白鍵</span></div>
    <div id="tracking" class="tracking" hidden><i></i><span>等待追蹤</span></div>
    <div id="home-panel" class="home-panel">
      <h2>動起來，<br>冒險去<span>！</span></h2>
      <div class="scene-choice"><label for="scene-choice">選擇冒險場景</label><select id="scene-choice"><option value="meadow">陽光草原 · 60 秒</option><optgroup label="糖果王國 · 120 秒">${Object.entries(CANDY_SCENES).map(([id, scene]) => `<option value="${id}">${scene.label}</option>`).join("")}</optgroup></select><span id="scene-status" role="status">選好場景，就可以出發囉</span></div>
      <button id="start-camera" class="button primary">開啟鏡頭，開始冒險 <span>↗</span></button>
      <button id="start-manual" class="manual-link">無鏡頭開始玩 <span>→</span></button>
    </div>
    <section id="mode-picker" class="mode-picker" hidden aria-labelledby="mode-picker-title">
      <span class="eyebrow">CHOOSE YOUR ADVENTURE</span><h2 id="mode-picker-title">今天想怎麼玩？</h2>
      <p>選好模式後才會開啟鏡頭，影像只在你的裝置處理。</p>
      <div class="mode-cards">
        <button id="choose-body" class="mode-card"><span class="mode-emoji">🏃</span><strong>全身模式</strong><span>跳躍、蹲下、左右跨步</span><small>全身入鏡 · 站著動一動</small></button>
        <button id="choose-face" class="mode-card"><span class="mode-emoji">🙂</span><strong>臉部模式</strong><span>轉頭、歪頭、做表情</span><small>臉部入鏡 · 坐著也能玩</small></button>
        <button id="choose-hand" class="mode-card" disabled><span class="mode-emoji">👋</span><strong>手部模式</strong><span>即將推出</span><small>開發中，尚未開放</small></button>
      </div><button id="mode-home" class="button quiet">回首頁</button>
    </section>
    <div id="home-stamp" class="home-stamp"><span>✦</span><b>陽光草原</b><small>第一站 · 60 秒挑戰</small></div>
    <div id="camera-preview" class="camera-preview" hidden><canvas id="pose-preview" aria-label="鏡像攝影機與人體骨架"></canvas><span>中央黃線固定 · 先移動手機對齊身體</span></div>
    <div id="dialog" class="dialog" hidden role="dialog" aria-modal="true" aria-labelledby="dialog-title"></div>
    <div id="calibration-panel" class="calibration-panel" hidden><span class="eyebrow">LET’S GET READY</span><h2 id="calibration-title">站在中央</h2><p id="calibration-message" role="status"></p><div id="calibration-summary" class="calibration-summary" hidden></div><div class="calibration-progress" role="progressbar" aria-label="校正進度" aria-valuemin="0" aria-valuemax="100"><i id="calibration-progress"></i></div><ol id="calibration-steps"></ol><p class="calibration-safety">先確認周圍沒有家具與障礙物，再請家長幫忙看看喔。</p><div class="calibration-actions"><button id="start-calibration" class="button small">手機擺好了，開始校正</button><button id="begin-camera" class="button small" hidden>校正完成，出發！ ↗</button><button id="recalibrate" class="button small">重新校正</button><button id="cancel-calibration" class="button small">回首頁</button></div></div>
    <div id="countdown" class="countdown" hidden role="status"></div>
    <div id="cue" class="cue" hidden aria-live="polite"></div>
    <div id="face-progress" class="face-progress" hidden><span id="face-progress-label"></span><progress id="face-progress-bar" max="1" value="0"></progress></div>
    <div id="debug" class="debug" hidden></div>
  </section>
</main>
<dialog id="game-menu" class="game-menu" aria-labelledby="menu-title">
  <div class="menu-heading"><div><span class="eyebrow">SHAPE QUEST</span><h2 id="menu-title">冒險選單</h2></div><button id="menu-close" class="button" aria-label="關閉選單">✕</button></div>
  <div id="game-controls" class="menu-actions" hidden><button id="preview-toggle" class="button" aria-pressed="false">顯示鏡頭</button><button id="exit" class="button">結束探險</button></div>
  <details class="camera-settings"><summary>鏡頭設定</summary><label for="camera-choice">選擇鏡頭</label><select id="camera-choice"><option value="front">前鏡頭</option><option value="rear">後鏡頭（電視投放）</option></select><p>開啟鏡頭後會列出裝置提供的鏡頭，可選廣角或超廣角；切換鏡頭後需重新校正。未列出的鏡頭無法由網頁強制開啟。</p><button id="swap-camera-side" class="button">Camera 換邊</button><button id="reset-camera" class="button" hidden>重新擺放手機與校正</button></details>
  <details class="menu-help"><summary>怎麼玩？</summary><div class="menu-moves"><p>${icon("jump")}輕輕跳，越過路障 <kbd>↑ / 空白鍵</kbd></p><p>${icon("duck")}蹲低低，躲過橫木 <kbd>↓</kbd></p><p>${icon("left")}左右跨步，再回中央 <kbd>← →</kbd></p></div><p>每成功一次，空心愛心就填滿三分之一；累積 3 次補回一心，失敗也會保留補血進度喔！</p><p id="status" role="status">請由家長協助固定裝置，讓頭部與雙腳完整入鏡。</p><p>先確認周圍有足夠活動空間。影像只在你的裝置處理，不上傳、不保存。</p></details>
  <details class="menu-tools"><summary>進階與測試工具</summary><div class="menu-actions"><button id="debug-toggle" class="button" aria-pressed="false">校正格線</button><a class="button" href="?faceTest=1">臉部 Webcam 診斷 ↗</a><a class="button" href="?videoTest=1">影片整合測試 ↗</a><label class="button video-import">＋ 測試背景影片<input id="video-file" type="file" accept="video/mp4,video/*"></label></div><p id="background-label">程式動態背景 · 陽光草原</p></details>
</dialog>
<video id="camera" class="camera-source" muted playsinline></video><div id="toast" class="toast" role="status" hidden></div>`;

const menu = $<HTMLDialogElement>("game-menu");
const bodyHelp = menu.querySelector(".menu-moves")!.innerHTML;
let menuPausedGame = false;
let cameraChoiceValue = "front";
document.body.classList.add("game-shell");

type Scene = "meadow" | keyof typeof CANDY_SCENES;
const requestedScene = new URLSearchParams(location.search).get("scene") || "meadow";
let selectedScene: Scene = Object.hasOwn(CANDY_SCENES, requestedScene) ? requestedScene as Scene : "meadow";
let sceneLoading = false, sceneReady = true;
let game = new Game(selectedScene === "meadow" ? CONFIG.duration : CANDY_DURATION);
const renderer = new Renderer($<HTMLCanvasElement>("world"));
const background = new Background($<HTMLVideoElement>("background"));
const camera = $<HTMLVideoElement>("camera");
const cameraPreview = $("camera-preview");
const posePreview = $<HTMLCanvasElement>("pose-preview");
const hearts = $("hearts");
const heartItems = hearts.querySelectorAll<HTMLElement>(".heart");
const trackingLabel = $("tracking").querySelector("span")!;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let screen: "home" | "modes" | "loading" | "calibration" | "game" | "results" | "error" =
  "home";
let mode: "camera" | "manual" = "camera";
let trackingMode: "body" | "face" = "body";
let faceCalibration = new FaceCalibration();
let liveFace: FaceFeatures | null = null;
let cameraCoordinates = new CameraCoordinates();
let rotatingUntil = 0, orientationGamePhase: typeof game.phase | null = null;
let lastOrientation = "";
const faceDetector = new FaceDetector();
const ready = () => trackingMode === "face" ? faceCalibration.done : calibration.done;
let stream: MediaStream | null = null,
  tracker: PoseTracker | FaceTracker | null = null;
let calibration = new Calibration(),
  detector = freshDetector();
let points: Point[] = [],
  tracked = false,
  lastPoseAt = -Infinity,
  lastTrackedAt = -Infinity,
  stableSince: number | null = null;
let eventId = 0,
  token = 0,
  showPreview = false,
  debug = false;
let lastFrame = performance.now(),
  lastUI = 0,
  sceneTime = 0,
  renderFps = 60;
let lastGamePhase = game.phase,
  lastCue = "",
  toastTimer = 0;
let faceDemoKey = "", faceDemoStartedAt = 0;
const pressed = new Set<string>();
let swipe: { id: number; x: number; y: number } | null = null;
function show(id: string, visible: boolean) {
  $(id).hidden = !visible;
}
function toast(text: string) {
  $("toast").textContent = text;
  show("toast", true);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => show("toast", false), 5000);
}
function dialog(
  title: string,
  body: string,
  buttons: { id: string; text: string; run: () => void }[],
) {
  $("dialog").innerHTML =
    `<div class="dialog-card"><span class="eyebrow">SHAPE QUEST</span><h2 id="dialog-title"></h2><p id="dialog-body"></p><div class="dialog-buttons"></div></div>`;
  $("dialog-title").textContent = title;
  $("dialog-body").textContent = body;
  for (const b of buttons) {
    const button = document.createElement("button");
    button.id = b.id;
    button.className = `button ${buttons.indexOf(b) === 0 ? "primary" : "quiet"}`;
    button.textContent = b.text;
    button.onclick = b.run;
    $("dialog").querySelector(".dialog-buttons")!.append(button);
  }
  show("dialog", true);
  $("dialog").querySelector<HTMLButtonElement>("button")?.focus();
}
function release() {
  token++;
  tracker?.close();
  tracker = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  camera.srcObject = null;
  cameraCoordinates = new CameraCoordinates();
  rotatingUntil = 0; orientationGamePhase = null;
  points = [];
  liveFace = null;
  tracked = false;
  lastPoseAt = -Infinity;
  lastTrackedAt = -Infinity;
  stableSince = null;
  detector = freshDetector();
  faceDetector.reset();
  pressed.clear();
}
function home() {
  release();
  screen = "home";
  game.phase = "idle";
  showPreview = false;
  updateScreen();
  $("status").textContent = "請由家長協助固定裝置，讓頭部與雙腳完整入鏡。";
  $("start-camera").focus();
}
function updateScreen() {
  swipe = null;
  menuPausedGame = false;
  menu.close();
  show("home-brand", screen === "home");
  show("reset-camera", !!stream);
  const playing = screen === "game";
  show("home-panel", screen === "home");
  updateSceneControls();
  show("mode-picker", screen === "modes");
  show("calibration-summary", screen === "calibration" && trackingMode === "face");
  show("face-progress", false);
  renderer.faceMode = mode === "camera" && trackingMode === "face";
  document.body.classList.toggle("face-session", renderer.faceMode);
  $("start-calibration").textContent = renderer.faceMode ? "坐好了，開始校正" : "手機擺好了，開始校正";
  menu.querySelector(".menu-moves")!.innerHTML = renderer.faceMode
    ? "<p>↕ ↔ 上仰、低頭、左右轉頭，完成後自然放鬆。</p><p>🙂 跟圖示張嘴、左右歪頭或睜眼搭配輕抬眉毛，維持一下。</p><p>六種穿牆：張嘴、左歪、右歪、睜眼＋抬眉、露齒微笑、自然閉嘴巴；各做一種即可。</p><p>擊破題：6 秒內完成 3 次張嘴、閉嘴，不用快速動作。</p>"
    : bodyHelp;
  cameraPreview.querySelector("span")!.textContent = trackingMode === "face"
    ? "鏡像預覽 · 看著遊戲畫面，跟著大臉示範做動作" : "中央黃線固定 · 先移動手機對齊身體";
  posePreview.setAttribute("aria-label", trackingMode === "face" ? "鏡像攝影機與臉部追蹤" : "鏡像攝影機與人體骨架");
  show("home-stamp", screen === "home");
  show("hud", playing);
  show("tracking", mode === "camera" && (playing || screen === "calibration"));
  show("game-controls", playing);
  show("preview-toggle", mode === "camera");
  show("calibration-panel", screen === "calibration");
  show("dialog", false);
  show("countdown", false);
  show("cue", false);
  show(
    "camera-preview",
    screen === "calibration" || (playing && showPreview && mode === "camera"),
  );
  cameraPreview.classList.toggle("calibrating", screen === "calibration");
  $("stage").classList.toggle("in-game", playing);
  $("stage").classList.toggle("manual-input", playing && mode === "manual");
  $("stage").classList.remove("is-recovering");
  $("stage").classList.toggle("is-calibrating", screen === "calibration");
  document.body.classList.toggle("camera-session", mode === "camera" && (playing || screen === "calibration"));
  $("mode-label").textContent = mode === "manual" ? "無鏡頭模式" : trackingMode === "face" ? "臉部模式" : "全身模式";
  $("preview-toggle").setAttribute("aria-pressed", String(showPreview));
  $("preview-toggle").textContent = showPreview ? "隱藏鏡頭" : "顯示鏡頭";
}
async function startCamera() {
  release();
  const session = token;
  mode = "camera";
  screen = "loading";
  updateScreen();
  dialog(
    "準備你的冒險裝備",
    "請允許使用所選鏡頭。模型首次載入需要一點時間，影像不會離開你的裝置。",
    [{ id: "cancel-load", text: "回首頁", run: home }],
  );
  let candidate: PoseTracker | FaceTracker | null = null;
  try {
    const choice: CameraChoice = cameraChoiceValue.startsWith("device:")
      ? { facingMode: "user", deviceId: cameraChoiceValue.slice(7) }
      : { facingMode: cameraChoiceValue === "rear" ? "environment" : "user" };
    const media = await openCamera(camera, () => session === token, choice);
    if (session !== token) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = media;
    // Labels are usually available only after the camera permission is granted.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (session !== token) return;
      const select = $<HTMLSelectElement>("camera-choice");
      select.querySelectorAll('option[value^="device:"]').forEach((option) => option.remove());
      devices.filter((device) => device.kind === "videoinput" && device.deviceId)
        .forEach((device, i) => select.add(new Option(device.label || `鏡頭 ${i + 1}`, `device:${device.deviceId}`)));
      select.value = cameraChoiceValue;
    } catch { /* Front/back selection remains available without device enumeration. */ }
    media.getVideoTracks()[0].addEventListener("ended", () => {
      if (screen === "game" && trackingMode === "face") {
        tracked = false; faceDetector.reset();
      } else if (screen === "game") {
        game.pause("camera");
        updatePause();
      } else if (screen === "calibration")
        fail("攝影機已中斷，請重新啟動鏡頭。");
    });
    $("dialog-body").textContent = "鏡頭已開啟，正在載入本機姿態模型…";
    if (trackingMode === "face") {
      const { FaceTracker } = await import("./face");
      if (session !== token) return;
      candidate = new FaceTracker();
    } else {
      const { PoseTracker } = await import("./pose");
      if (session !== token) return;
      candidate = new PoseTracker();
    }
    await candidate.load();
    if (session !== token) {
      candidate.close();
      return;
    }
    tracker = candidate;
    calibration = new Calibration();
    faceCalibration = new FaceCalibration();
    faceDetector.reset();
    detector = freshDetector();
    screen = "calibration";
    updateScreen();
    updateCalibration();
  } catch (error) {
    candidate?.close();
    if (session !== token) return;
    fail(cameraError(error));
  }
}
function fail(message: string) {
  release();
  screen = "error";
  updateScreen();
  dialog("裝備還沒準備好", message, [
    { id: "retry-camera", text: "重新開啟鏡頭", run: () => void startCamera() },
    { id: "error-home", text: "回首頁", run: home },
  ]);
}
function updateCalibration() {
  if (trackingMode === "face") {
    const c = faceCalibration;
    $("calibration-message").textContent = c.message;
    $("calibration-summary").textContent = `校正進度 ${Math.min(c.step + 1, FACE_CALIBRATION_STEPS.length)} / ${FACE_CALIBRATION_STEPS.length}`;
    const progress = c.done ? 100 : (c.step + c.progress) / FACE_CALIBRATION_STEPS.length * 100;
    $("calibration-progress").style.width = `${progress}%`;
    $("calibration-progress").parentElement!.setAttribute("aria-valuenow", String(Math.round(progress)));
    show("begin-camera", c.done); show("start-calibration", !c.started);
    return;
  }
  $("calibration-panel").querySelector(".eyebrow")!.textContent = "LET’S GET READY";
  $("calibration-panel").querySelector(".calibration-safety")!.textContent = "先確認周圍沒有家具與障礙物，再請家長幫忙看看喔。";
  $("calibration-title").textContent = calibration.done
    ? "準備完成！"
    : !calibration.started
      ? "先擺好手機"
      : calibration.returning
      ? "動作成功，回中央站好"
      : CALIBRATION_STEPS[calibration.step];
  $("calibration-message").textContent = calibration.message;
  $("calibration-progress").style.width =
    `${calibration.done ? 100 : ((calibration.step + calibration.progress) / 5) * 100}%`;
  $("calibration-progress").parentElement!.setAttribute("aria-valuenow", String(Math.round(calibration.done ? 100 : (calibration.step + calibration.progress) / 5 * 100)));
  $("calibration-steps").innerHTML = CALIBRATION_STEPS.map(
    (label, i) =>
      `<li class="${i < calibration.step ? "complete" : i === calibration.step ? "current" : ""}"><span>${i < calibration.step ? "✓" : i + 1}</span>${label}</li>`,
  ).join("");
  show("begin-camera", calibration.done);
  show("start-calibration", !calibration.started);
}
function updateSceneControls() {
  $<HTMLSelectElement>("scene-choice").disabled = screen !== "home" || sceneLoading;
  $<HTMLButtonElement>("start-camera").disabled = sceneLoading || !sceneReady;
  $<HTMLButtonElement>("start-manual").disabled = sceneLoading || !sceneReady;
}
async function selectScene() {
  if (screen !== "home") return;
  selectedScene = $<HTMLSelectElement>("scene-choice").value as Scene;
  const candy = selectedScene === "meadow" ? null : CANDY_SCENES[selectedScene];
  const label = candy?.label || "陽光草原";
  game = new Game(candy ? CANDY_DURATION : CONFIG.duration);
  renderer.projection = { ...(candy ? CANDY_PROJECTION : CONFIG.projection) };
  $("world").setAttribute("aria-label", `${label}跑酷道路`);
  $("scene-label").textContent = candy ? `糖果王國 · ${label}` : "SUNNY MEADOW · 陽光草原";
  $("home-stamp").querySelector("b")!.textContent = label;
  $("home-stamp").querySelector("small")!.textContent = `${candy ? "糖果王國" : "第一站"} · ${game.duration} 秒挑戰`;
  $("stage").dataset.scene = selectedScene;
  sceneLoading = true;
  sceneReady = false;
  updateSceneControls();
  $("scene-status").textContent = "正在準備場景…";
  try {
    if (candy) await background.transition(asset(`videos/level-03/${candy.stem}_original_xfade.mp4`), candy.label);
    else { background.clear(); background.status = "程式動態背景 · 陽光草原"; }
    sceneReady = true;
    $("scene-status").textContent = `一局 ${game.duration} 秒 · ${candy ? "糖果王國" : "陽光草原"}`;
  } catch {
    $("scene-status").textContent = "背景載入失敗，請重新選擇場景。";
  } finally {
    sceneLoading = false;
    updateSceneControls();
  }
}
function begin() {
  if (sceneLoading || !sceneReady) return;
  if (mode === "camera" && (!ready() || !stream?.getVideoTracks().some((track) => track.readyState === "live"))) {
    toast(trackingMode === "face" ? "請先完成臉部校正與練習。" : "請先回到鏡頭中央，讓全身完整入鏡。");
    return;
  }
  background.sync(false);
  if (background.url) background.video.currentTime = 0;
  detector = freshDetector();
  faceDetector.reset();
  pressed.clear();
  game.start(mode === "camera" && trackingMode === "face" ? FACE_ACTIONS : undefined, {
    acceptFromPreview: mode === "camera" && trackingMode === "face",
  });
  screen = "game";
  showPreview = mode === "camera";
  lastTrackedAt = performance.now();
  // Ignore gaps spent on the results screen when checking for interrupted frames.
  lastFrame = performance.now();
  lastGamePhase = "idle";
  updateScreen();
  $("status").textContent =
    mode === "camera"
      ? trackingMode === "face" ? "跟著臉部提示轉頭或做表情，完成後自然放鬆。" : "跟著提示做動作，完成後回中央站好。"
      : "在遊戲畫面往上滑跳躍、往下滑蹲下、左右滑跨步，也能用方向鍵或空白鍵操作。";
}
function startManual() {
  release();
  mode = "manual";
  begin();
}
function updatePause() {
  swipe = null;
  background.sync(false);
  updateHUD(performance.now());
  show("countdown", false);
  show("cue", false);
  const reasons = game.pauseReasons;
  let title = "休息一下",
    body = "準備好了再繼續，遊戲時間與生命都已暫停。";
  const buttons = [
    { id: "resume", text: "準備好了，繼續", run: resume },
    { id: "pause-home", text: "回首頁", run: home },
  ];
  if (reasons.has("orientation")) {
    title = "正在調整畫面方向"; body = "校正已保留，畫面穩定後會自動繼續。"; buttons.shift();
  } else if (reasons.has("camera")) {
    title = "鏡頭中斷了";
    body = "請回首頁重新開啟鏡頭與校正，暫停期間不會扣血。";
    buttons.shift();
  } else if (reasons.has("tracking")) {
    title = "等你回到畫面裡";
    body = "看著鏡頭預覽，站回黃線中央；看不到自己時，請退後或調整鏡頭。站穩後會倒數繼續，不會扣血。";
    if (!reasons.has("manual") && !reasons.has("hidden")) buttons.shift();
  }
  dialog(title, body, buttons);
  const recovering = reasons.has("tracking") && !reasons.has("camera");
  $("stage").classList.toggle("is-recovering", recovering);
  if (recovering) show("camera-preview", true);
}
function resume() {
  game.clearPause("manual");
  if (!document.hidden) game.clearPause("hidden");
  if (mode === "camera" && trackingMode === "body" && (!tracked || game.pauseReasons.has("tracking"))) {
    updatePause();
    return;
  }
  detector = freshDetector();
  faceDetector.reset();
  pressed.clear();
  if (game.resume()) {
    show("dialog", false);
    $("stage").classList.remove("is-recovering");
    show("camera-preview", showPreview && mode === "camera");
    lastFrame = performance.now();
  }
}
function finish() {
  screen = "results";
  const cameraMode = mode === "camera";
  // Keep the live camera and its baseline for another round at the same placement.
  if (!cameraMode) release();
  detector = freshDetector();
  faceDetector.reset();
  pressed.clear();
  updateScreen();
  dialog(
    game.health ? "小小冒險家，做得好！" : "休息一下，再來挑戰！",
    `${cameraMode ? trackingMode === "face" ? "臉部挑戰" : "體感挑戰" : "無鏡頭模式"}結束 · ${game.score} 分\n成功 ${game.successes} 次 · 失敗 ${game.misses} 次 · 遊玩 ${Math.floor(game.time)} 秒`,
    [
      {
        id: "restart",
        text: "再冒險一次 ↗",
        run: cameraMode ? () => {
          if (stream?.getVideoTracks().some((track) => track.readyState === "live") && ready()) begin();
          else void startCamera();
        } : startManual,
      },
      { id: "results-home", text: "回首頁", run: home },
    ],
  );
}
function onPose(sample: Point[], now: number) {
  if (now - lastPoseAt > CONFIG.poseStaleMs) stableSince = null;
  const oriented = cameraCoordinates.pose(sample, camera.videoWidth, camera.videoHeight);
  points = oriented.points;
  const raw = features(
    oriented.points,
    oriented.aspect,
    screen === "game" || (screen === "calibration" && calibration.step > 0),
  );
  const f = raw ? cameraCoordinates.body(raw, oriented.aspect) : null;
  tracked = !!f;
  if (f) lastTrackedAt = now;
  lastPoseAt = now;
  if (screen === "calibration") {
    calibration.update(f, now);
    return;
  }
  if (screen !== "game" || mode !== "camera") return;
  if (!f) {
    stableSince = null;
    detector = freshDetector();
    return;
  }
  if (game.phase === "paused" && game.pauseReasons.has("tracking")) {
    // Recovery also requires returning near the calibrated standing position.
    const b = calibration.baseline!;
    const centered =
      Math.abs(f.hipX - b.hipX) / b.height < 0.12 &&
      Math.abs(f.hipY - b.hipY) / b.height < 0.12;
    $("dialog-body").textContent = centered
      ? "找到你了！保持站穩，馬上倒數繼續。"
      : Math.abs(f.hipX - b.hipX) / b.height >= 0.12
        ? `請往畫面的${f.hipX < b.hipX ? "右" : "左"}邊移動，讓身體回到中間黃線。遊戲已暫停，不會扣血。`
        : f.hipY > b.hipY
          ? "看見你了，請慢慢站直，回到原本的位置。遊戲已暫停，不會扣血。"
          : "請對照鏡頭預覽，退後一點，回到原本的位置。遊戲已暫停，不會扣血。";
    if (!centered) {
      stableSince = null;
      return;
    }
    stableSince ??= now;
    if (now - stableSince >= CONFIG.recoveryStableMs) {
      game.clearPause("tracking");
      detector = freshDetector();
      if (!game.pauseReasons.size) {
        game.resume();
        show("dialog", false);
        $("stage").classList.remove("is-recovering");
        show("camera-preview", showPreview || game.pauseReasons.has("tracking"));
      } else updatePause();
    }
    return;
  }
  stableSince = null;
  const result = detectAction(detector, f, calibration.baseline!, now);
  detector = result.state;
  if (result.action && game.phase === "playing") return result.action;
}
function onFace(sample: FaceSample, now: number) {
  points = sample.points;
  const raw = sample.trackingIssue ? null : sample.features;
  const f = raw ? cameraCoordinates.face(raw, camera.videoWidth, camera.videoHeight) : null;
  liveFace = f;
  if (now - lastPoseAt > CONFIG.poseStaleMs) stableSince = null;
  tracked = !!f; lastPoseAt = now;
  if (f) lastTrackedAt = now;
  if (screen === "calibration") { faceCalibration.update(f, now); return; }
  if (screen !== "game" || !faceCalibration.baseline) return;
  if (!f) { stableSince = null; faceDetector.reset(); return; }
  stableSince = null;
  if (game.phase !== "playing") { faceDetector.reset(); return; }
  const o = game.next;
  return faceDetector.update(f, faceCalibration.baseline, now, o ? {
    id: o.id, action: o.action,
    active: !o.completed && game.time <= o.collision,
  } : undefined, faceCalibration.profile);
}
function updateHUD(now: number) {
  show("manual-hint", screen === "game" && mode === "manual" &&
    (game.phase === "playing" || game.phase === "countdown"));
  heartItems.forEach((heart, index) => {
    const fill = Math.max(0, Math.min(CONFIG.healthPerHeart,
      game.health - index * CONFIG.healthPerHeart)) / CONFIG.healthPerHeart;
    const previous = heart.dataset.fill;
    if (previous === String(fill)) return;
    heart.dataset.fill = String(fill);
    heart.style.setProperty("--empty", `${(1 - fill) * 100}%`);
    if (fill === 1 && previous !== undefined && Number(previous) < 1 &&
        game.phase === "playing" && !reducedMotion.matches)
      heart.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" },
        { transform: "scale(1)" }], { duration: 350 });
  });
  const fullHearts = Math.floor(game.health / CONFIG.healthPerHeart);
  hearts.setAttribute("aria-label", `剩餘 ${fullHearts} 顆愛心` +
    (game.health < game.maxHealth
      ? `，下一顆補血進度 ${game.health % CONFIG.healthPerHeart}／${CONFIG.healthPerHeart}` : ""));
  $("score").textContent = String(game.score).padStart(4, "0");
  $("timer").textContent = `${game.remaining} 秒`;
  const valid = tracked && now - lastPoseAt <= CONFIG.poseStaleMs;
  $("tracking").classList.toggle("lost", !valid);
  trackingLabel.textContent = valid
    ? "動作追蹤中"
    : screen === "calibration" ? trackingMode === "face" ? "請讓整張臉入鏡" : "請站進鏡頭裡" : trackingMode === "face" ? "臉部追蹤暫時中斷" : "請看鏡頭預覽";
  if (screen === "calibration") updateCalibration();
  const count = screen === "game" && game.phase === "countdown";
  show("countdown", count);
  if (count)
    $("countdown").innerHTML =
      `<strong>${Math.max(1, Math.ceil(game.countdown))}</strong><span>${trackingMode === "face" && mode === "camera" ? "自然放鬆，準備出發！" : "回中央站好，準備出發！"}</span>`;
  const o = game.next,
    feedback = game.feedback;
  const feedbackActive = feedback && game.time - feedback.at < 0.85;
  const faceActive = mode === "camera" && trackingMode === "face" && screen === "game" && game.phase === "playing" && !!o;
  show("face-progress", faceActive && !o!.completed && (o!.action.startsWith("pose_") || o!.action === "smash"));
  if (faceActive) {
    $("face-progress-label").textContent = o!.action === "smash"
      ? `擊破能量 ${faceDetector.energy}／${FACE_CONFIG.smashCycles} · 張嘴再閉嘴算一次`
      : `${FACE_LABEL[o!.action]} · ${Math.round(faceDetector.progress * 100)}% · ${faceDetector.status}`;
    $<HTMLProgressElement>("face-progress-bar").value = faceDetector.progress;
  }
  const text =
    game.phase === "playing"
      ? feedbackActive
        ? feedback!.kind === "success"
          ? "太棒了！ +100"
          : feedback!.damaged
            ? "再試一次，沒關係！"
            : "保護時間 · 繼續加油"
        : o
          ? o.completed ? "動作已完成！可以放鬆，等著通過 ✨"
            : `${mode === "camera" && trackingMode === "face" ? FACE_LABEL[o.action] : LABEL[o.action]} · ${mode === "camera" && trackingMode === "face" ? "現在就可以做！" : o.collision - game.time <= CONFIG.windows[o.action] ? "現在！" : "準備"}`
          : "回中央，準備下一個動作"
      : "";
  show("cue", !!text);
  if (text !== lastCue) {
    $("cue").textContent = text;
    lastCue = text;
  }
  $("cue").classList.toggle(
    "success",
    !!o?.completed || (!!feedbackActive && feedback?.kind === "success"),
  );
  if (debug) {
    const next = game.next;
    $("debug").textContent =
      `FPS ${renderFps.toFixed(0)} | 推論 ${tracker?.fps.toFixed(0) ?? "—"} FPS / ${tracker?.inferenceMs.toFixed(1) ?? "—"}ms\n${mode} · ${game.phase} · t=${game.time.toFixed(2)} · pose=${points.length}\n${next ? `${next.id} ${next.action} · 碰撞 ${next.collision.toFixed(1)} · ${next.result}` : "無接近障礙"}\n${background.status}\n場景 ${selectedScene} · 回合 ${game.duration} 秒 · 消失點 ${renderer.projection.centerX},${renderer.projection.horizon} · 道路半寬 ${renderer.projection.nearHalfWidth}\n影片 ${background.video.currentTime.toFixed(2)}s · ${background.video.paused ? "暫停" : "播放"} · camera/motion 草案\n${points
        .filter((_, i) => [0, 23, 24, 27, 28].includes(i))
        .map((p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`)
        .join(" ")}`;
  }
  $("background-label").textContent = background.url || background.status.includes("失敗")
    ? background.status
    : "程式動態背景 · 陽光草原";
}
function frame(now: number) {
  const orientationSettling = !!rotatingUntil;
  if (rotatingUntil && now >= rotatingUntil && camera.readyState >= 2 && !document.hidden) {
    rotatingUntil = 0;
    lastPoseAt = lastTrackedAt = now;
    game.clearPause("orientation");
    if (orientationGamePhase) {
      if (!game.pauseReasons.size) {
        game.phase = orientationGamePhase;
        show("dialog", false);
      } else updatePause();
      orientationGamePhase = null;
      lastGamePhase = game.phase;
    } else if (screen === "game" && game.phase === "paused") updatePause();
  }
  let sampledAction: Action | undefined;
  const elapsed = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = Math.min(elapsed, 0.1);
  renderFps = 0.95 * renderFps + 0.05 / Math.max(elapsed, 0.001);
  if (screen === "game" && elapsed > 0.5 && !orientationSettling) game.pause("hidden");
  if (tracker && !rotatingUntil && !document.hidden && (!menu.open || screen === "game")) {
    try {
      const sample = tracker.sample(camera, now);
      if (sample) sampledAction = Array.isArray(sample) ? onPose(sample, now) : onFace(sample, now);
    } catch {
      if (screen === "game" && trackingMode === "face") onFace({ points: [], features: null }, now);
      else fail("姿態辨識中斷了，請重新啟動鏡頭或換用支援 WebGL 的瀏覽器。");
    }
  }
  if (
    screen === "game" &&
    mode === "camera" &&
    trackingMode === "body" &&
    !rotatingUntil && now - lastTrackedAt > CONFIG.trackingLostMs
  ) {
    tracked = false;
    stableSince = null;
    detector = freshDetector();
    faceDetector.reset();
    game.pause("tracking");
  }
  if (screen === "game") {
    game.tick(
      dt,
      sampledAction
        ? {
            id: eventId++,
            action: sampledAction,
            time: Math.min(game.duration, game.time + dt),
          }
        : undefined,
    );
    if (game.phase !== lastGamePhase) {
      if (game.phase === "paused") updatePause();
      if (game.phase === "finished") finish();
      lastGamePhase = game.phase;
    }
  }
  const playing = screen === "game" && game.phase === "playing";
  background.sync(playing || screen === "home");
  if (playing || screen === "home") sceneTime += dt;
  renderer.draw(
    game,
    screen === "home" ? sceneTime : game.time,
    background.visible,
  );
  if (!cameraPreview.hidden && trackingMode === "body")
    drawCamera(
      posePreview,
      camera,
      points,
      calibration.baseline ? cameraCoordinates.bodyPreview(calibration.baseline, cameraCoordinates.aspect(camera.videoWidth, camera.videoHeight)) : null,
      cameraCoordinates.imageRotation,
      cameraCoordinates.bodyRange(calibration.baseline ? CONFIG.returnRange * calibration.baseline.height : CONFIG.setupCenterRange,
        cameraCoordinates.aspect(camera.videoWidth, camera.videoHeight)),
    );
  if (!cameraPreview.hidden && trackingMode === "face") {
    const calibrating = screen === "calibration";
    const returning = calibrating ? faceCalibration.returning : game.phase !== "playing";
    const action = calibrating
      ? !returning && !faceCalibration.done ? FACE_ACTIONS[faceCalibration.step - 1] : undefined
      : !returning ? game.next?.action : undefined;
    const key = calibrating
      ? `${token}:lesson:${faceCalibration.step}:${faceCalibration.returning}:${faceCalibration.done}`
      : `${token}:${screen}:${game.phase}:${game.next?.id ?? "none"}`;
    if (key !== faceDemoKey) { faceDemoKey = key; faceDemoStartedAt = now; }
    const demoAmount = faceDemoAmount(now - faceDemoStartedAt, action, reducedMotion.matches);
    drawFaceCamera(posePreview, camera, faceCalibration.baseline, calibrating ? {
      action, amount: demoAmount, returning: calibrating && faceCalibration.returning, live: liveFace,
      progress: returning ? faceCalibration.releaseProgress : faceCalibration.progress,
      done: faceCalibration.done,
      nextAction: returning ? FACE_ACTIONS[faceCalibration.step] : undefined,
      profile: faceCalibration.profile,
      conditionMatches: faceCalibration.conditionMatches,
      releaseAction: returning ? FACE_ACTIONS[faceCalibration.step - 1] : undefined,
      message: faceCalibration.message,
    } : undefined, cameraCoordinates.imageRotation);
  }
  if (now - lastUI > 100) {
    updateHUD(now);
    lastUI = now;
  }
  requestAnimationFrame(frame);
}
$("start-camera").onclick = () => {
  screen = "modes"; updateScreen(); $("choose-body").focus();
};
$("choose-body").onclick = () => { trackingMode = "body"; void startCamera(); };
$("choose-face").onclick = () => { trackingMode = "face"; void startCamera(); };
$("mode-home").onclick = home;
$("start-manual").onclick = startManual;
$("cancel-calibration").onclick = home;
$("start-calibration").onclick = () => {
  if (trackingMode === "face") faceCalibration.start();
  else calibration.start();
  updateCalibration();
};
function resetCalibration() {
  calibration = new Calibration();
  faceCalibration = new FaceCalibration();
  faceDetector.reset();
  stableSince = null;
  detector = freshDetector();
  game.phase = "idle";
  screen = "calibration";
  updateScreen();
  updateCalibration();
}
$("recalibrate").onclick = resetCalibration;
$("reset-camera").onclick = resetCalibration;
$<HTMLSelectElement>("camera-choice").onchange = () => {
  cameraChoiceValue = $<HTMLSelectElement>("camera-choice").value;
  if (stream) void startCamera();
};
$("begin-camera").onclick = begin;
$("exit").onclick = home;
$("preview-toggle").onclick = () => {
  showPreview = !showPreview;
  show("camera-preview", showPreview || game.pauseReasons.has("tracking"));
  $("preview-toggle").textContent = showPreview ? "隱藏鏡頭" : "顯示鏡頭";
  $("preview-toggle").setAttribute("aria-pressed", String(showPreview));
};
$("debug-toggle").onclick = () => {
  debug = !debug;
  renderer.debug = debug;
  show("debug", debug);
  $("debug-toggle").setAttribute("aria-pressed", String(debug));
};
function closeMenu() {
  menu.close();
  if (menuPausedGame) {
    menuPausedGame = false;
    resume();
  }
}
$("menu-toggle").onclick = () => {
  menuPausedGame = screen === "game" && ["playing", "countdown"].includes(game.phase);
  if (menuPausedGame) {
    game.pause("manual");
    updatePause();
  }
  menu.showModal();
};
$("menu-close").onclick = closeMenu;
menu.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeMenu();
});
function updateFullscreenButton() {
  const fullscreen = !!document.fullscreenElement || document.body.classList.contains("css-fullscreen");
  $("fullscreen").innerHTML = fullscreen ? "⛶ <span>離開全螢幕</span>" : "⛶ <span>全螢幕</span>";
  $("fullscreen").setAttribute("aria-label", fullscreen ? "離開全螢幕" : "全螢幕");
}
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.body.classList.contains("css-fullscreen"))
      document.body.classList.remove("css-fullscreen");
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else throw new Error("unsupported");
  } catch {
    document.body.classList.toggle("css-fullscreen");
    toast("已切換滿版顯示；瀏覽器工具列可能仍會顯示。");
  }
  updateFullscreenButton();
};
document.addEventListener("fullscreenchange", updateFullscreenButton);
$<HTMLInputElement>("video-file").onchange = async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  if (screen === "game") {
    game.pause("manual");
    updatePause();
  }
  try {
    input.disabled = true;
    await background.choose(file);
    toast(
      "候選影片已載入，只在本機播放。請開啟校正格線確認道路與障礙；尚未代表驗收通過。",
    );
  } catch (error) {
    toast(
      error instanceof Error && error.message.includes("16:9")
        ? error.message
        : "影片無法播放，已使用程式背景。請確認是瀏覽器支援的 MP4 / H.264。",
    );
  }
  input.value = "";
  input.disabled = false;
};
const stage = $("stage");
stage.addEventListener("pointerdown", (event) => {
  if (screen !== "game" || mode !== "manual" || game.phase !== "playing" ||
      menu.open || !event.isPrimary || event.pointerType === "mouse" ||
      (event.target instanceof Element && event.target.closest("button, a, input, select, .dialog"))) return;
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (!swipe || swipe.id !== event.pointerId) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 36) return;
  swipe = null; // One action per swipe; lift the finger before the next one.
  if (screen !== "game" || mode !== "manual" || game.phase !== "playing" || menu.open) return;
  const action: Action = Math.abs(dx) > Math.abs(dy)
    ? (dx < 0 ? "left" : "right")
    : (dy < 0 ? "jump" : "duck");
  game.accept({ id: eventId++, action, time: game.time });
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
  stage.addEventListener(name, (event) => {
    if (swipe?.id === (event as PointerEvent).pointerId) swipe = null;
  });
}
document.addEventListener("keydown", (event) => {
  if (menu.open) return;
  if (!$("dialog").hidden && event.key === "Tab") {
    const buttons = [
      ...$("dialog").querySelectorAll<HTMLButtonElement>("button"),
    ];
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
    return;
  }
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement
  )
    return;
  if (event.code === "Escape" && screen === "game") {
    game.pause("manual");
    updatePause();
    return;
  }
  const action = KEY[event.key];
  if (screen !== "game" || mode !== "manual" || !action) return;
  if (
    event.target instanceof HTMLButtonElement &&
    (event.key === " " || event.key === "Enter")
  )
    return;
  event.preventDefault();
  if (event.repeat || pressed.has(event.key)) return;
  pressed.add(event.key);
  game.accept({ id: eventId++, action, time: game.time });
});
document.addEventListener("keyup", (event) => pressed.delete(event.key));
window.addEventListener("blur", () => {
  pressed.clear();
  if (screen === "game") {
    game.pause("hidden");
    updatePause();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "game") {
    game.pause("hidden");
    updatePause();
  }
});
window.addEventListener("pagehide", () => {
  release();
  background.clear();
});
$<HTMLSelectElement>("scene-choice").value = selectedScene;
$("scene-choice").onchange = () => void selectScene();
updateScreen();
void selectScene();
requestAnimationFrame(frame);

function updateCameraOrientation(videoChanged = false) {
  // Use window.screen: the local `screen` variable is the game view, not the API.
  const orientation = window.screen.orientation;
  const legacy = (window as Window & { orientation?: number }).orientation;
  const type = orientation?.type ?? (matchMedia("(orientation: landscape)").matches ? "landscape-primary" : "portrait-primary");
  const angle = orientation?.angle ?? legacy ?? 0;
  const key = `${type}:${angle}`;
  if (key !== lastOrientation) {
    document.body.dataset.cameraSide = cameraSide(type, angle);
    lastOrientation = key;
  } else if (!videoChanged) return;
  if (!stream || mode !== "camera" || !["calibration", "game"].includes(screen)) return;
  cameraCoordinates.requestRotation();
  calibration.interrupt(); faceCalibration.interrupt(); faceDetector.reset(); detector = freshDetector();
  points = []; tracked = false; stableSince = null;
  rotatingUntil = performance.now() + 450;
  if (screen === "game") {
    if (!orientationGamePhase && (game.phase === "playing" || game.phase === "countdown")) orientationGamePhase = game.phase;
    game.pause("orientation"); updatePause(); lastGamePhase = game.phase;
  }
}
window.screen.orientation?.addEventListener("change", () => updateCameraOrientation());
window.addEventListener("orientationchange", () => updateCameraOrientation());
window.addEventListener("resize", () => updateCameraOrientation());
camera.addEventListener("resize", () => updateCameraOrientation(true));
$("swap-camera-side").onclick = () => {
  document.body.dataset.cameraSide = document.body.dataset.cameraSide === "right" ? "left" : "right";
};
updateCameraOrientation();
