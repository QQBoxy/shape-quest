import "./background-road.css";
import { asset } from "./config";
import { CANDY_SCENES } from "./scenes";
import { projectRoad, roadDepth } from "./background-road-projection";

const POC_SCENES = CANDY_SCENES;

const defaults = {
  scene: "lollipop", aspect: "landscape", fit: "cover", zoom: 1, offsetX: 0, offsetY: 0,
  videoRate: 1, videoPaused: false, vpX: 0.5, vpY: 0.45, width: 1,
  road: true, opacity: 0.5, color: "#ffffff", speed: 6, roadPaused: false,
  obstacles: true, lane: "all", original: false, guides: true, videoTime: 0, distance: 0,
};
const state = { ...defaults };
const params = new URLSearchParams(location.search);
const ranges = {
  zoom: [0.5, 3, 0.01], offsetX: [-100, 100, 1], offsetY: [-100, 100, 1],
  videoRate: [0.25, 2, 0.05], vpX: [0.1, 0.9, 0.005], vpY: [0.1, 0.8, 0.005],
  width: [0.3, 2.5, 0.01], opacity: [0, 1, 0.01], speed: [0, 20, 0.1],
  videoTime: [0, 3600, 0.01], distance: [0, 1e8, 0.01],
} as const;
for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
  const value = Number(params.get(key));
  if (params.has(key) && Number.isFinite(value)) state[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value));
}
for (const key of ["videoPaused", "road", "roadPaused", "obstacles", "original", "guides"] as const) {
  if (params.has(key)) state[key] = params.get(key) === "true";
}
for (const [key, options] of Object.entries({ scene: Object.keys(POC_SCENES), aspect: ["landscape", "portrait", "window"], fit: ["cover", "contain"], lane: ["all", "-1", "0", "1"] })) {
  const value = params.get(key);
  if (value && options.includes(value)) Object.assign(state, { [key]: value });
}
if (/^#[0-9a-f]{6}$/i.test(params.get("color") ?? "")) state.color = params.get("color")!;

const select = (key: keyof typeof state, label: string, options: Record<string, string>) =>
  `<label>${label}<select id="${key}">${Object.entries(options).map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
const range = (key: keyof typeof ranges, label: string) => {
  const [min, max, step] = ranges[key];
  return `<label for="${key}">${label}<output id="${key}-value"></output><input id="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
};
const check = (key: keyof typeof state, label: string) => `<label class="br-check"><input id="${key}" type="checkbox">${label}</label>`;
document.title = "背景影片 × Canvas 道路 — Shape Quest PoC";
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="br-app">
    <header class="br-header"><div><a href="${import.meta.env.BASE_URL}">← Shape Quest</a><h1>背景影片 × Canvas 道路 <span>PoC</span></h1><p>四個世界，同一條三線道。原片色彩保留，所有參數獨立調整。</p></div><button id="snapshot">儲存目前畫面設定</button></header>
    <div class="br-layout">
      <section class="br-preview" aria-label="合成預覽">
        <div class="br-toolbar">${select("aspect", "預覽比例", { landscape: "16:9 橫向", portrait: "9:16 直向", window: "跟隨視窗比例" })}${check("original", "僅顯示原始影片")}</div>
        <div class="br-stage-wrap"><div id="br-stage"><video id="br-video" muted playsinline loop preload="auto"></video><canvas id="br-canvas" aria-label="三線道與障礙物投影"></canvas></div></div>
        <p id="br-source"></p><p id="br-status" role="status">正在載入影片…</p><p id="br-stats"></p>
        <label class="br-saved" hidden>可重現網址（暫停於目前影片影格與道路位置）<input id="br-url" readonly><a id="br-open">開啟儲存設定</a></label>
        <p class="br-note">觀察重點：原路緣外露、遠方消失點、景物被覆蓋、直向裁切，以及兩種前進速度。藍色十字為程式消失點；關閉輔助線可看純合成畫面。</p>
      </section>
      <aside class="br-controls" aria-label="即時調整控制面板">
        <fieldset><legend>01 · 背景影片</legend>
          ${select("scene", "糖果王國場景", Object.fromEntries(Object.entries(POC_SCENES).map(([id, s]) => [id, s.label])))}
          ${check("videoPaused", "暫停影片")}${range("videoRate", "影片播放速度（倍）")}
          <label for="br-seek">影片時間 <output id="br-time"></output><input id="br-seek" type="range" min="0" max="8" step="0.01" value="0"></label>
          ${select("fit", "填滿方式", { cover: "cover · 裁切填滿", contain: "contain · 完整顯示" })}
          ${range("zoom", "影片縮放（倍）")}${range("offsetX", "水平偏移（畫面 %）")}${range("offsetY", "垂直偏移（畫面 %）")}
        </fieldset>
        <fieldset><legend>02 · 三線道投影</legend>${check("road", "顯示道路")}${check("guides", "顯示消失點與車道輔助線")}
          ${range("vpX", "消失點 X（畫面比例）")}${range("vpY", "消失點 Y（畫面比例）")}${range("width", "底部路寬（畫面寬度倍數）")}
          ${range("opacity", "道路不透明度（1 = 100%）")}<label>道路顏色<input id="color" type="color"></label>
        </fieldset>
        <fieldset><legend>03 · 前進與障礙物</legend>${check("roadPaused", "暫停道路與障礙物")}${range("speed", "道路速度（世界單位／秒）")}${check("obstacles", "顯示測試方塊")}
          ${select("lane", "障礙物車道", { all: "左、中、右各一個", "-1": "左車道", "0": "中車道", "1": "右車道" })}
          <button id="restart" type="button">從頭對照（影片與道路歸零）</button>
        </fieldset><button id="reset">恢復全部預設值</button>
      </aside>
    </div>
  </main>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const video = el<HTMLVideoElement>("br-video");
const canvas = el<HTMLCanvasElement>("br-canvas");
const ctx = canvas.getContext("2d")!;
const stage = el("br-stage");
const status = el("br-status");
const seek = el<HTMLInputElement>("br-seek");
let w = 1, h = 1, distance = state.distance;
let mediaMessage = "正在載入影片…";
let seekingFromSlider = false;
let pendingTime = state.videoTime;

function updateLayout() {
  const ratio = state.aspect === "portrait" ? 9 / 16 : state.aspect === "window" ? innerWidth / innerHeight : 16 / 9;
  // Fit within the preview column and viewport height without distorting the stage.
  const available = Math.max(1, stage.parentElement!.clientWidth);
  stage.style.width = `${Math.min(available, Math.max(220, innerHeight * 0.74) * ratio)}px`;
  stage.style.aspectRatio = String(ratio);
}
function applyVisuals() {
  video.style.objectFit = state.fit;
  video.style.transform = `translate(${state.offsetX}%, ${state.offsetY}%) scale(${state.zoom})`;
  video.playbackRate = state.videoRate;
  canvas.hidden = state.original;
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const input = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
    if (!input) continue;
    if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(state[key]);
    else input.value = String(state[key]);
    const output = document.getElementById(`${key}-value`);
    if (output) output.textContent = Number(state[key]).toFixed(key === "offsetX" || key === "offsetY" ? 0 : 2);
  }
  updateLayout();
}
async function playVideo() {
  if (state.videoPaused || document.hidden) { video.pause(); return; }
  const source = video.src;
  try { await video.play(); }
  catch (error) {
    if (source !== video.src || (error instanceof DOMException && error.name === "AbortError")) return;
    mediaMessage = "瀏覽器尚未允許播放，請取消勾選「暫停影片」重試。"; state.videoPaused = true; applyVisuals();
  }
}
function loadScene() {
  const scene = POC_SCENES[state.scene as keyof typeof POC_SCENES];
  mediaMessage = "正在載入影片…";
  pendingTime = state.videoTime;
  video.src = asset(`videos/level-03/${scene.stem}.mp4`);
  el("br-source").textContent = `${scene.label} · ${scene.stem}.mp4（原片）`;
  video.load();
}
video.addEventListener("loadedmetadata", () => {
  seek.max = String(video.duration);
  video.currentTime = Math.min(pendingTime, Math.max(0, video.duration - 0.01));
  video.playbackRate = state.videoRate;
  void playVideo();
});
video.addEventListener("loadeddata", () => { mediaMessage = ""; });
video.addEventListener("playing", () => { mediaMessage = ""; });
video.addEventListener("waiting", () => { mediaMessage = "影片緩衝中…"; });
video.addEventListener("seeked", () => { mediaMessage = ""; });
video.addEventListener("error", () => { mediaMessage = `影片載入失敗（${video.error?.code ?? "未知"}），可切換場景重試；道路仍可獨立測試。`; });
seek.addEventListener("input", () => {
  if (video.readyState >= 1) video.currentTime = Number(seek.value);
});
seek.addEventListener("pointerdown", () => { seekingFromSlider = true; });
window.addEventListener("pointerup", () => { seekingFromSlider = false; });
for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
  const input = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
  if (!input) continue;
  input.addEventListener("input", () => {
    const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : typeof defaults[key] === "number" ? Number(input.value) : input.value;
    Object.assign(state, { [key]: value });
    applyVisuals();
    if (key === "scene") { state.videoTime = 0; loadScene(); }
    if (key === "videoPaused") void playVideo();
  });
}
el("restart").addEventListener("click", () => {
  distance = 0;
  if (video.readyState >= 1) video.currentTime = 0;
});
el("reset").addEventListener("click", () => {
  Object.assign(state, defaults); distance = 0; applyVisuals(); loadScene();
});
el("snapshot").addEventListener("click", () => {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set("backgroundRoad", "1");
  const snapshot = { ...state, videoPaused: true, roadPaused: true, videoTime: video.currentTime || 0, distance };
  for (const [key, value] of Object.entries(snapshot)) url.searchParams.set(key, String(value));
  el<HTMLInputElement>("br-url").value = url.href;
  el<HTMLAnchorElement>("br-open").href = url.href;
  el("br-url").parentElement!.hidden = false;
});
new ResizeObserver(() => {
  w = stage.clientWidth; h = stage.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
}).observe(stage);
window.addEventListener("resize", updateLayout);
document.addEventListener("visibilitychange", () => { previous = 0; void playVideo(); });

function draw() {
  ctx.clearRect(0, 0, w, h);
  if (state.original) return;
  const p = state;
  const at = (x: number, z: number, height = 0) => projectRoad(x, height, z, p, w, h);
  const polygon = (points: { x: number; y: number }[], color: string) => {
    ctx.beginPath(); points.forEach((v, i) => i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  if (state.road) {
    ctx.globalAlpha = state.opacity;
    polygon([{ x: state.vpX * w, y: state.vpY * h }, at(-1.5, 1), at(1.5, 1)], state.color);
    for (let i = 0; i < 24; i++) {
      const z = roadDepth(i * 4, distance, 96);
      const end = z + 1.5;
      for (const x of [-0.5, 0.5]) {
        polygon([at(x - 0.018, z), at(x + 0.018, z), at(x + 0.018, end), at(x - 0.018, end)], "#fff4ce");
      }
      polygon([at(-1.5, z), at(1.5, z), at(1.5, z + 0.025), at(-1.5, z + 0.025)], "#ffffff20");
    }
    ctx.globalAlpha = 1;
  }
  if (state.obstacles) {
    const lanes = state.lane === "all" ? [-1, 0, 1] : [Number(state.lane)];
    const boxes = lanes.map(lane => ({ lane, z: roadDepth((lane + 1) * 17 + 8, distance, 60) })).sort((a, b) => b.z - a.z);
    for (const { lane, z } of boxes) {
      const l = lane - 0.28, r = lane + 0.28, back = z + 0.7, height = 0.65;
      polygon([at(l, z), at(r, z), at(r, z, height), at(l, z, height)], "#fcbd4b");
      polygon([at(l, z, height), at(r, z, height), at(r, back, height), at(l, back, height)], "#ffe3a3");
      // Choose the outward visible side from the camera's world centre.
      const side = lane < 0 ? r : l;
      polygon([at(side, z), at(side, back), at(side, back, height), at(side, z, height)], "#b87430");
    }
  }
  if (state.guides) {
    ctx.strokeStyle = "#50e1ff"; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (const x of [-1.5, -0.5, 0.5, 1.5]) {
      const bottom = at(x, 1); ctx.moveTo(state.vpX * w, state.vpY * h); ctx.lineTo(bottom.x, bottom.y);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(state.vpX * w - 8, state.vpY * h); ctx.lineTo(state.vpX * w + 8, state.vpY * h);
    ctx.moveTo(state.vpX * w, state.vpY * h - 8); ctx.lineTo(state.vpX * w, state.vpY * h + 8); ctx.stroke();
  }
}
let previous = 0, sampleStart = 0, frames = 0, submitMs = 0;
function frame(now: number) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
  previous = now;
  if (!document.hidden && !state.roadPaused) distance += dt * state.speed;
  const start = performance.now(); draw(); submitMs += performance.now() - start; frames++;
  if (now - sampleStart > 500) {
    const quality = video.getVideoPlaybackQuality?.();
    el("br-stats").textContent = `${Math.round(w)} × ${Math.round(h)} · Canvas ${Math.round(frames * 1000 / (now - sampleStart))} FPS · 繪圖提交 ${(submitMs / frames).toFixed(2)} ms · 影片丟格 ${quality?.droppedVideoFrames ?? "—"} / ${quality?.totalVideoFrames ?? "—"}（累計）`;
    status.textContent = mediaMessage || `${video.paused ? "影片已暫停" : "影片循環播放中"} · 道路${state.roadPaused ? "已暫停" : "前進中"}`;
    el("br-time").textContent = `${video.currentTime.toFixed(2)} / ${(video.duration || 0).toFixed(2)} 秒`;
    if (!seekingFromSlider) seek.value = String(video.currentTime);
    canvas.dataset.distance = distance.toFixed(4);
    sampleStart = now; frames = 0; submitMs = 0;
  }
  requestAnimationFrame(frame);
}
applyVisuals(); loadScene(); requestAnimationFrame(frame);
