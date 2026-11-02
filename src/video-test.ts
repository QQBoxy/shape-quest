import "./styles.css";
import "./video-test.css";
import { Background } from "./background";
import { asset, LABEL, type Action, type Projection } from "./config";
import { Game } from "./game";
import { Renderer } from "./renderer";
import { VideoMetrics } from "./video-metrics";
import { CANDY_SCENES as SCENES, CANDY_PROJECTION, CANDY_DURATION } from "./scenes";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const VARIANTS = {
  "original-fade": {
    file: "l03_candy_001_v2_original_xfade.mp4",
    label: "原始影片＋0.333 秒淡化 · 7.583 秒 · 無音軌（未做接點剪輯）",
  },
  original: {
    file: "l03_candy_001_v2.mp4",
    label: "原始影片 · 7.93 秒（含音軌、強制靜音）",
  },
  trim: {
    file: "l03_candy_001_v2_trim.mp4",
    label: "接點剪輯 · 6.667 秒 · 無音軌",
  },
  xfade: {
    file: "l03_candy_001_v2_xfade.mp4",
    label: "剪輯＋0.333 秒淡化 · 6.333 秒 · 無音軌",
  },
};
type Variant = keyof typeof VARIANTS;
type Scene = keyof typeof SCENES;
const switchPoC = new URLSearchParams(location.search).has("sceneSwitch");
const requestedScene = new URLSearchParams(location.search).get("scene");
let scene: Scene = requestedScene && Object.hasOwn(SCENES, requestedScene) ? requestedScene as Scene : "lollipop";
let fadeFrames = 8;
const isFade = () => variant === "original-fade" || variant === "xfade";
function selectedFile() {
  if (scene !== "lollipop") {
    if (variant === "original" || fadeFrames === 0) return `${SCENES[scene].stem}.mp4`;
    return fadeFrames === 8 ? `${SCENES[scene].stem}_original_xfade.mp4`
      : `fades/${SCENES[scene].fadePrefix}original-${fadeFrames}.mp4`;
  }
  if (!isFade() || fadeFrames === 8) return VARIANTS[variant].file;
  const base = variant === "original-fade" ? "original" : "trim";
  return fadeFrames === 0 ? VARIANTS[base].file : `fades/v2-${base}-${fadeFrames}.mp4`;
}
const selectedLabel = () => scene !== "lollipop"
  ? `${SCENES[scene].label} · ${variant === "original" ? "原始影片（含音軌、強制靜音）" : `完整原片＋${(fadeFrames / 24).toFixed(3)} 秒首尾交叉淡化`}`
  : isFade()
  ? `${variant === "original-fade" ? "原始影片" : "剪輯"}＋${(fadeFrames / 24).toFixed(3)} 秒淡化`
  : VARIANTS[variant].label;
document.title = "Shape Quest — 糖果王國背景場景比較";
$("app").innerHTML =
  `<header class="site-header"><a class="brand" href="./">奇形狀<small>SHAPE QUEST / VIDEO LAB</small></a><a class="button quiet" href="./">回到遊戲 ↗</a></header>
<main class="video-lab"><span class="eyebrow">PHASE 1 · SINGLE-CLIP INTEGRATION</span><h1>糖果王國背景場景比較</h1><p>${Object.values(SCENES).map(scene => scene.label).join("／")} · 候選素材，搭配道路格線與障礙物驗證 · 單一 HTML5 Video 播放器。</p>
<div class="lab-toolbar"><label>背景場景<select id="scene">${Object.entries(SCENES).map(([id, scene]) => `<option value="${id}">${scene.label}</option>`).join("")}</select></label><label>測試版本<select id="variant"><option value="original-fade">原始影片＋淡化</option><option value="xfade">剪輯＋淡化</option><option value="original">原始影片（無淡化基準）</option><option value="trim">接點剪輯（無淡化基準）</option></select></label><label>淡化秒數 <output id="fade-value" for="fade-duration">0.333 秒</output><input id="fade-duration" type="range" min="0" max="6" step="1" value="2" aria-label="淡化秒數" aria-valuetext="0.333 秒"></label><button id="lab-start" class="button primary">開始 120 秒測試</button><button id="lab-pause" class="button" disabled>暫停</button><button id="lab-export" class="button">匯出紀錄</button></div>
<section class="stage in-game lab-stage" aria-label="影片合成測試"><video id="lab-video" class="background-video" muted playsinline loop preload="auto"></video><canvas id="lab-world"></canvas><div id="lab-time" class="lab-time">準備載入素材</div><div id="lab-cue" class="lab-cue"></div><div id="lab-notice" class="lab-notice" role="status">尚未開始</div></section>
<div class="lab-controls"><label class="lab-check"><input id="lab-overlay" type="checkbox" checked>顯示遊戲疊加（障礙物／判定回饋）</label><label>消失點 X<input id="centerX" type="range" min="0.45" max="0.55" step="0.001" value="0.5"></label><label>消失點 Y<input id="horizon" type="range" min="0.30" max="0.48" step="0.001" value="0.42"></label><label>道路底部半寬<input id="nearHalfWidth" type="range" min="0.35" max="0.8" step="0.01" value="0.46"></label><label>固定虛擬速度<input id="speed" type="range" min="2" max="9" step="0.1" value="6"></label><label class="lab-check"><input id="lab-grid" type="checkbox" checked>顯示道路格線／接地點</label></div>
<p id="lab-source"></p><p>糖果王國各場景預設使用完整原片＋8 影格交叉淡化（0.333 秒），也可選原片比較。首尾交叉淡化可調整為 0～1 秒，每格約 0.167 秒，預設 0.333 秒。淡化預先合成進影片，調整秒數並放開滑桿後套用；播放中會重新開始這輪比較。原始＋淡化不做接點剪輯；剪輯＋淡化沿用既有接點剪輯。循環片長會依首尾重疊秒數縮短，可能看見殘影或景物換位，請直接比較播放效果。</p><p class="lab-help">工程測試可跑 10 分鐘，使用較高生命值以持續出題；失敗照常記錄，不模擬玩家成功。↑／↓／←／→ 可測試動作判定。暫停與倒數不計入有效遊玩時間。改變幾何設定會開始新一輪紀錄。</p>
<div class="lab-summary"><section><h2>播放與遊戲時鐘</h2><pre id="lab-summary"></pre><details><summary>完整 JSON 紀錄</summary><pre id="video-metrics"></pre></details></section><section><h2>每次循環接點</h2><p>像素差為 320×180 縮圖的 0–255 MAE；數值低不保證運動連續。縮圖依序為循環前／後。</p><div class="lab-table"><table><thead><tr><th>循環</th><th>有效秒數</th><th>影格間隔 ms</th><th>道路 MAE</th><th>前／後</th></tr></thead><tbody id="seams"></tbody></table></div></section></div></main>`;
const video = $<HTMLVideoElement>("lab-video");
const background = new Background(video);
const renderer = new Renderer($<HTMLCanvasElement>("lab-world"));
renderer.debug = true;
let game = new Game(switchPoC ? CANDY_DURATION : 600, 3000),
  metrics = new VideoMetrics();
const requestedVariant = new URLSearchParams(location.search).get("variant") || "original-fade";
let variant: Variant = Object.hasOwn(VARIANTS, requestedVariant) ? requestedVariant as Variant : "original-fade",
  started = false,
  ready = false,
  intentionalSeek = false;
let last = performance.now(),
  lastUI = 0,
  lastPlaying = false,
  sequence = 0;
let activeMs = 0,
  rows = 0;
const probe = document.createElement("canvas");
probe.width = 320;
probe.height = 180;
const ctx = probe.getContext("2d", { willReadFrequently: true })!;
let previous: ImageData | null = null;
const seamImages: { before: string; after: string }[] = [];
const samples: { wall: number; media: number; game: number }[] = [];
const waitingEvents: { gameTime: number; videoTime: number; durationMs: number | null }[] = [];
let waitingSince: number | null = null;
let switching = false, switchError = "", queuedScene: Scene | null = null;
let requestedAt = 0, requestedGameTime = 0, roundStartedAt = 0;
const heldFrame = document.createElement("canvas");
heldFrame.id = "lab-held-frame";
heldFrame.width = 1280;
heldFrame.height = 720;
heldFrame.hidden = true;
heldFrame.setAttribute("aria-hidden", "true");
const gameState = () => ({
  time: game.time, score: game.score, health: game.health,
  successes: game.successes, misses: game.misses,
  obstacles: game.obstacles.map(o => ({ ...o })),
});
const switches: {
  from: Scene; to: Scene; requestedGameTime: number; waitMs: number;
  loadMs: number | null; firstFrameMs: number | null; freezeMs: number;
  status: "loading" | "passed" | "failed";
  before: ReturnType<typeof gameState>; after?: ReturnType<typeof gameState>; error?: string;
}[] = [];
if (switchPoC) {
  variant = "original-fade";
  video.after(heldFrame);
  document.title = "Shape Quest — 手動換片 PoC";
  document.querySelector("h1")!.textContent = "糖果王國手動換片 PoC";
  $("lab-start").after(Object.assign(document.createElement("button"), {
    id: "lab-next", className: "button", textContent: "下一個場景", disabled: true,
  }));
  $("lab-source").after(Object.assign(document.createElement("pre"), { id: "lab-switches" }));
  document.querySelector(".lab-help")!.textContent =
    "手動按下一個場景，等目前障礙判定結束後換片。載入期間保留上一張背景並凍結遊戲時鐘；分數、生命與出題不重設。遊戲時間 120 秒，實際經過時間另加換片與暫停。方向鍵可操作，工程生命值較高。";
  for (const key of ["centerX", "horizon", "nearHalfWidth", "speed"])
    $<HTMLInputElement>(key).disabled = true;
} else {
  $("lab-source").after(Object.assign(document.createElement("a"), {
    href: "?videoTest=1&sceneSwitch=1", className: "button", textContent: "手動換片 PoC ↗",
  }));
}
function switchControls() {
  if (!switchPoC) return;
  $<HTMLSelectElement>("scene").disabled = started || switching;
  $<HTMLSelectElement>("variant").disabled = true;
  $<HTMLInputElement>("fade-duration").disabled = true;
  $<HTMLButtonElement>("lab-start").disabled = !ready || switching || !!queuedScene;
  $<HTMLButtonElement>("lab-pause").disabled = !started || !ready || switching || game.phase === "finished";
  $<HTMLButtonElement>("lab-next").disabled = !started || switching || !!queuedScene || (!switchError && game.phase !== "playing");
  $("lab-next").textContent = switchError ? "重試下一個場景" : "下一個場景";
}
if (switchPoC) $("lab-next").onclick = () => {
  if (switching || queuedScene || !started || (!switchError && game.phase !== "playing")) return;
  const order = Object.keys(SCENES) as Scene[];
  queuedScene = order[(order.indexOf(scene) + 1) % order.length];
  requestedAt = performance.now();
  requestedGameTime = game.time;
  switchControls();
};
async function changeScene(target: Scene) {
  const began = performance.now();
  const retry = !!switchError;
  const record: typeof switches[number] = {
    from: scene, to: target, requestedGameTime, waitMs: began - requestedAt,
    loadMs: null, firstFrameMs: null, freezeMs: 0, status: "loading", before: gameState(),
  };
  switches.push(record);
  queuedScene = null;
  switching = true;
  switchError = "";
  ready = false;
  background.sync(false);
  if (!retry) heldFrame.getContext("2d")!.drawImage(video, 0, 0, 1280, 720);
  heldFrame.hidden = false;
  video.style.visibility = "hidden";
  metrics.breakSequence();
  previous = null;
  waitingSince = null;
  switchControls();
  updateUI();
  try {
    await background.load(asset(`videos/level-03/${SCENES[target].stem}_original_xfade.mp4`), SCENES[target].label);
    record.loadMs = performance.now() - began;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        video.cancelVideoFrameCallback(callback);
        reject(new Error("新影片第一張影格等待逾時"));
      }, 5000);
      const callback = video.requestVideoFrameCallback(() => { clearTimeout(timeout); resolve(); });
      background.sync(true);
    });
    record.firstFrameMs = performance.now() - began;
    scene = target;
    $<HTMLSelectElement>("scene").value = scene;
    heldFrame.hidden = true;
    video.style.visibility = "visible";
    ready = true;
    record.status = "passed";
    $("lab-source").textContent = `來源：${selectedFile()} · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(3)} 秒 · 1.0x`;
  } catch (error) {
    switchError = error instanceof Error ? error.message : "換片失敗";
    background.sync(false);
    record.status = "failed";
    record.error = switchError;
  } finally {
    record.freezeMs = performance.now() - began;
    record.after = gameState();
    switching = false;
    metrics.breakSequence();
    previous = null;
    last = performance.now();
    background.sync(ready && game.phase === "playing" && !document.hidden);
    switchControls();
    updateUI();
  }
}
if (scene !== "lollipop" && variant !== "original") variant = "original-fade";
$<HTMLSelectElement>("scene").value = scene;
$<HTMLSelectElement>("variant").value = variant;
const load = async (autoStart = false) => {
  ready = false;
  started = false;
  $<HTMLSelectElement>("scene").disabled = true;
  $<HTMLSelectElement>("variant").disabled = true;
  $<HTMLInputElement>("fade-duration").disabled = true;
  background.sync(false);
  game.phase = "idle";
  $("lab-start").setAttribute("disabled", "");
  $("lab-pause").setAttribute("disabled", "");
  $("lab-notice").textContent = "載入候選影片中…";
  try {
    await background.load(
      asset(`videos/level-03/${selectedFile()}`),
      selectedLabel(),
    );
    ready = true;
    $("lab-start").removeAttribute("disabled");
    $("lab-source").textContent =
      `來源：${selectedFile()} · ${video.videoWidth}×${video.videoHeight} · 實際片長 ${video.duration.toFixed(3)} 秒 · 1.0x · muted / playsInline / loop`;
    $("lab-notice").textContent = "已就緒，按開始。請用道路格線及四種障礙物比對目前場景。";
    if (autoStart) start();
  } catch {
    $("lab-notice").textContent =
      "素材載入失敗，請確認已準備衍生影片並重新載入頁面。";
  } finally {
    $<HTMLSelectElement>("scene").disabled = false;
    $<HTMLSelectElement>("variant").disabled = false;
    for (const option of $<HTMLSelectElement>("variant").options)
      option.disabled = scene !== "lollipop" && ["trim", "xfade"].includes(option.value);
    $<HTMLInputElement>("fade-duration").disabled = !isFade();
    $("fade-value").textContent = isFade() ? `${(fadeFrames / 24).toFixed(3)} 秒` : "無淡化基準";
    switchControls();
  }
};
function resetMetrics() {
  metrics = new VideoMetrics();
  activeMs = 0;
  previous = null;
  seamImages.length = 0;
  samples.length = 0;
  waitingEvents.length = 0;
  waitingSince = null;
  rows = 0;
  $("seams").innerHTML = "";
}
function start() {
  if (!ready || switching || queuedScene) return;
  background.sync(false);
  intentionalSeek = video.currentTime > 0.001;
  if (intentionalSeek) video.currentTime = 0;
  game = new Game(switchPoC ? CANDY_DURATION : 600, 3000);
  game.start();
  game.phase = "playing";
  resetMetrics();
  started = true;
  switches.length = 0;
  roundStartedAt = performance.now();
  last = performance.now();
  $("lab-pause").removeAttribute("disabled");
  $("lab-pause").textContent = "暫停";
  $("lab-notice").textContent = "測試中 · 120 秒後會標記達標並繼續播放。";
  switchControls();
}
video.addEventListener("seeked", () => {
  if (intentionalSeek) {
    intentionalSeek = false;
    metrics.breakSequence();
    previous = null;
  }
});
function pause() {
  if (!started || switching || !ready) return;
  if (game.phase === "paused") {
    game.clearPause("manual");
    game.clearPause("hidden");
    game.resume();
    $("lab-pause").textContent = "暫停";
  } else {
    game.pause("manual");
    background.sync(false);
    metrics.breakSequence();
    previous = null;
    $("lab-pause").textContent = "恢復（倒數 3 秒）";
  }
}
video.addEventListener("waiting", () => {
  if (started && game.phase === "playing" && !switching) {
    metrics.waiting++;
    waitingSince = performance.now();
    waitingEvents.push({ gameTime: game.time, videoTime: video.currentTime, durationMs: null });
  }
});
video.addEventListener("playing", () => {
  if (waitingSince !== null && waitingEvents.length) {
    waitingEvents[waitingEvents.length - 1].durationMs = performance.now() - waitingSince;
    waitingSince = null;
  }
});
video.addEventListener("stalled", () => {
  if (started && game.phase === "playing") metrics.stalled++;
});
function onVideoFrame(now: number, metadata: VideoFrameCallbackMetadata) {
  if (
    started &&
    !switching &&
    game.phase === "playing" &&
    !video.paused &&
    !intentionalSeek
  ) {
    ctx.drawImage(video, 0, 0, 320, 180);
    const current = ctx.getImageData(0, 0, 320, 180);
    let full = 0,
      road = 0,
      roadPixels = 0;
    if (previous)
      for (let y = 0; y < 180; y++)
        for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4;
          const d =
            (Math.abs(previous.data[i] - current.data[i]) +
              Math.abs(previous.data[i + 1] - current.data[i + 1]) +
              Math.abs(previous.data[i + 2] - current.data[i + 2])) /
            3;
          full += d;
          if (y > 82 && Math.abs(x - 160) < (y - 82) * 1.12) {
            road += d;
            roadPixels++;
          }
        }
    const wrap = metrics.sample(now, metadata.mediaTime, video.duration, {
      fullMAE: full / (320 * 180),
      roadMAE: road / Math.max(1, roadPixels),
    });
    if (wrap && previous) {
      ctx.putImageData(previous, 0, 0);
      const before = probe.toDataURL("image/jpeg", 0.65);
      ctx.putImageData(current, 0, 0);
      seamImages.push({ before, after: probe.toDataURL("image/jpeg", 0.65) });
    }
    previous = current;
  }
  video.requestVideoFrameCallback(onVideoFrame);
}
if (video.requestVideoFrameCallback)
  video.requestVideoFrameCallback(onVideoFrame);
else
  $("lab-notice").textContent =
    "此瀏覽器不支援影格回呼，無法提供精確循環影格監測；請使用新版瀏覽器。";
function snapshot() {
  const q = video.getVideoPlaybackQuality();
  return {
    switchPoC,
    switching,
    queuedScene,
    switchError,
    switches,
    score: game.score,
    health: game.health,
    roundDuration: game.duration,
    wallSeconds: roundStartedAt ? (performance.now() - roundStartedAt) / 1000 : 0,
    scene,
    sceneLabel: SCENES[scene].label,
    gameOverlay: $<HTMLInputElement>("lab-overlay").checked,
    variant,
    file: selectedFile(),
    fadeSeconds: isFade() ? fadeFrames / 24 : 0,
    status: "candidate",
    targetSeconds: 120,
    activeSeconds: metrics.activeSeconds,
    reached120: metrics.activeSeconds >= 120,
    gameTime: game.time,
    gamePhase: game.phase,
    successes: game.successes,
    misses: game.misses,
    videoTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    muted: video.muted,
    playsInline: video.playsInline,
    loop: video.loop,
    rate: video.playbackRate,
    profile: renderer.projection,
    frameCount: metrics.frameCount,
    maxFrameGapMs: metrics.maxFrameGapMs,
    gapsOver250ms: metrics.gapsOver250ms,
    waiting: metrics.waiting,
    waitingEvents,
    stalled: metrics.stalled,
    droppedFrames: q.droppedVideoFrames,
    totalFrames: q.totalVideoFrames,
    loops: metrics.loops,
    samples,
    userAgent: navigator.userAgent,
    note: "Timing and pixel differences do not certify seamlessness or physical 3D alignment.",
  };
}
function updateUI() {
  const data = snapshot();
  $("lab-time").textContent =
    `有效播放 ${metrics.activeSeconds.toFixed(1)} / 120 秒 · 遊戲時鐘 ${game.time.toFixed(2)} · 循環 ${metrics.loops.length}`;
  $("lab-cue").textContent =
    game.phase === "countdown"
      ? `恢復倒數 ${Math.ceil(game.countdown)}`
      : game.phase === "paused"
        ? "已暫停，時間與影片凍結"
        : game.next
          ? `${LABEL[game.next.action]} · 接地十字與格線供比對`
          : "等待測試障礙";
  if (switchPoC) {
    $("lab-notice").textContent = switching ? "正在換片，保留上一張背景，遊戲時鐘暫停…"
      : switchError ? `換片失敗：${switchError}。畫面與遊戲保持凍結，可按重試。`
      : queuedScene ? `已預約 ${SCENES[queuedScene].label}，等待目前障礙判定結束。`
      : game.phase === "finished" ? "120 秒遊戲結束，換片紀錄可匯出。"
      : started ? `${SCENES[scene].label} · 分數 ${game.score} · 生命 ${game.health} · 換片等待另計實際時間。`
      : ready ? "選好起始場景後按開始，再手動切換下一個場景。" : $("lab-notice").textContent;
    $("lab-switches").textContent = `實際經過 ${data.wallSeconds.toFixed(2)} 秒 · 遊戲 ${game.time.toFixed(2)} 秒\n` +
      switches.map(s => `${SCENES[s.from].label} → ${SCENES[s.to].label} · ${s.status} · 等待空檔 ${s.waitMs.toFixed(1)} ms · 載入 ${s.loadMs?.toFixed(1) ?? "—"} ms · 首幀 ${s.firstFrameMs?.toFixed(1) ?? "—"} ms · 凍結 ${s.freezeMs.toFixed(1)} ms`).join("\n");
    switchControls();
  } else if (metrics.activeSeconds >= 120)
    $("lab-notice").textContent =
      "已累計播放 120 秒（不含暫停）；仍在播放，視覺品質請另行判讀。";
  $("lab-summary").textContent =
    `${selectedLabel()}\n畫面回呼 ${metrics.frameCount} · 最大間隔 ${metrics.maxFrameGapMs.toFixed(1)} ms\n>250 ms 間隔 ${metrics.gapsOver250ms} · waiting ${metrics.waiting} · stalled ${metrics.stalled}\n成功 ${game.successes} · 失敗 ${game.misses}（不自動通關）\n消失點 (${renderer.projection.centerX.toFixed(3)}, ${renderer.projection.horizon.toFixed(3)}) · 道路半寬 ${renderer.projection.nearHalfWidth.toFixed(2)} · 固定速度 ${renderer.projection.speed.toFixed(1)}`;
  $("video-metrics").textContent = JSON.stringify(data, null, 2);
  while (rows < metrics.loops.length) {
    const seam = metrics.loops[rows],
      images = seamImages[rows];
    const row = document.createElement("tr");
    row.innerHTML = `<td>${seam.loop}</td><td>${seam.activeSeconds.toFixed(2)}</td><td>${seam.gapMs.toFixed(1)}</td><td>${seam.roadMAE.toFixed(2)}</td><td>${images ? `<img alt="循環前" src="${images.before}"><img alt="循環後" src="${images.after}">` : ""}</td>`;
    $("seams").append(row);
    rows++;
  }
}
function frame(now: number) {
  const dt = Math.max(0, (now - last) / 1000);
  last = now;
  const playing =
    started && ready && !switching && game.phase === "playing" && !intentionalSeek;
  if (playing && !video.paused) {
    activeMs += dt * 1000;
    metrics.activeSeconds = activeMs / 1000;
  }
  if (started && ready && !switching && !intentionalSeek) game.tick(Math.min(dt, 0.1));
  if (queuedScene && (switchError || (game.phase === "playing" && !game.next && video.readyState >= 2 && !video.seeking)))
    void changeScene(queuedScene);
  if (queuedScene && game.phase === "finished") queuedScene = null;
  const nextPlaying =
    started && ready && !switching && game.phase === "playing" && !intentionalSeek;
  if (lastPlaying && !nextPlaying) {
    metrics.breakSequence();
    previous = null;
  }
  lastPlaying = nextPlaying;
  if (!switching) background.sync(nextPlaying);
  renderer.draw(game, game.time, background.visible || !heldFrame.hidden);
  if (now - lastUI > 250) {
    updateUI();
    lastUI = now;
  }
  requestAnimationFrame(frame);
}
$("scene").onchange = () => {
  scene = $<HTMLSelectElement>("scene").value as Scene;
  variant = "original-fade";
  fadeFrames = 8;
  $<HTMLSelectElement>("variant").value = variant;
  $<HTMLInputElement>("fade-duration").value = "2";
  resetMetrics();
  applyProfile(CANDY_PROJECTION);
  void load();
};
$("lab-start").onclick = start;
$("lab-pause").onclick = pause;
$<HTMLSelectElement>("variant").onchange = () => {
  variant = $<HTMLSelectElement>("variant").value as Variant;
  resetMetrics();
  void load();
};
const fadeSlider = $<HTMLInputElement>("fade-duration");
fadeSlider.oninput = () => {
  const seconds = (Number(fadeSlider.value) * 4 / 24).toFixed(3);
  $("fade-value").textContent = `${seconds} 秒`;
  fadeSlider.setAttribute("aria-valuetext", `${seconds} 秒`);
};
fadeSlider.onchange = () => {
  const autoStart = started && game.phase === "playing";
  fadeFrames = Number(fadeSlider.value) * 4;
  resetMetrics();
  void load(autoStart);
};
const overlay = $<HTMLInputElement>("lab-overlay");
overlay.checked = new URLSearchParams(location.search).get("overlay") !== "0";
function applyOverlay() {
  $("lab-world").style.visibility = overlay.checked ? "visible" : "hidden";
}
overlay.onchange = applyOverlay;
applyOverlay();
$("lab-grid").onchange = () =>
  (renderer.debug = $<HTMLInputElement>("lab-grid").checked);
function applyProfile(p: Projection) {
  renderer.projection = { ...p };
  for (const key of ["centerX", "horizon", "nearHalfWidth", "speed"] as const)
    $<HTMLInputElement>(key).value = String(p[key]);
  if (started) start();
}
for (const key of ["centerX", "horizon", "nearHalfWidth", "speed"] as const)
  $(key).onchange = () =>
    applyProfile({
      ...renderer.projection,
      [key]: Number($<HTMLInputElement>(key).value),
    });
$("lab-export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot(), null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${SCENES[scene].stem}-${variant}-loop-test.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return;
  const actions: Record<string, Action> = {
    ArrowUp: "jump",
    ArrowDown: "duck",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  if (actions[event.key] && !switching && ready) {
    event.preventDefault();
    game.accept({
      id: sequence++,
      action: actions[event.key],
      time: game.time,
    });
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started) {
    game.pause("hidden");
    background.sync(false);
    metrics.breakSequence();
    $("lab-pause").textContent = "恢復（倒數 3 秒）";
  }
});
window.addEventListener("pagehide", () => background.clear());
setInterval(() => {
  if (started && game.phase === "playing")
    samples.push({
      wall: metrics.activeSeconds,
      media: video.currentTime,
      game: game.time,
    });
}, 1000);
applyProfile(CANDY_PROJECTION);
void load();
requestAnimationFrame(frame);
