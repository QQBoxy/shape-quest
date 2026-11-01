import "./face-test.css";
import { FACE_ACTIONS, type Action } from "./config";
import { openCamera, cameraError } from "./camera";
import { FaceTracker } from "./face";
import { FaceProbe, PROBE_CHANNELS, PROBE_LABEL, FACE_PROBE_CONFIG } from "./face-diagnostics";
import { faceSignals, closedMouthLimits, type FaceSample } from "./face-actions";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
$("app").innerHTML = `<main class="face-lab">
  <header><a href="./">← 回遊戲</a><h1>臉部 Webcam 診斷</h1><p>開發診斷工具 · 正式遊戲已使用旋轉操作 · 手部模式未開發</p></header>
  <p>坐舒服、看遊戲畫面，不必注視鏡頭或對齊固定中心。畫面採鏡像；左右指預覽畫面方向，請實際轉頭確認。</p>
  <div class="lab-buttons"><button id="lab-start">開啟鏡頭</button><button id="lab-stop" disabled>關閉鏡頭</button><button id="lab-calibrate" disabled>自然觀看取樣</button></div>
  <p id="lab-status" role="status">尚未開啟鏡頭，影像只在本機處理。</p>
  <div class="lab-grid"><section><h2>鏡像即時畫面與關鍵點</h2><canvas id="lab-camera" width="640" height="480" aria-label="鏡像 Webcam 與 Face Landmarks"></canvas>
    <p id="lab-quality">等待資料</p><label>自然取樣進度 <progress id="lab-baseline-progress" max="1" value="0"></progress></label>
    <p id="lab-message" role="status"></p>
    <label for="lab-action">目標動作</label><select id="lab-action">${FACE_ACTIONS.map(a => `<option value="${a}">${PROBE_LABEL[a]}</option>`).join("")}</select>
    <button id="lab-learn" disabled>記錄這個動作的舒適幅度</button>
    <p>幅度記錄期間慢慢完成動作並維持，擊破先記錄張嘴幅度。完成後放鬆，再做一次測試。無法區分雜訊時會要求重練，不會逐次降低門檻。</p>
    <p id="lab-state"></p><label>維持進度 <progress id="lab-hold" max="1" value="0"></progress></label>
    <div id="lab-parts"></div>
  </section><section><h2>姿態與表情訊號</h2><p>角度分解：column-major Rz × Ry × Rx；正 Pitch 低頭、正 Yaw 畫面左轉、正 Roll 畫面左歪。方向仍待真人確認。</p>
    <div class="lab-table"><table><thead><tr><th>特徵</th><th>即時</th><th>自然基準</th><th>相對變化</th><th>自然雜訊 P95</th></tr></thead><tbody id="lab-values"></tbody></table></div>
    <p>eyes 是雙眼與眉毛的相對綜合量。微笑採嘴角係數，無法直接確認牙齒是否露出；張嘴與微笑可能同時成立。自然閉嘴同時參考 jawOpen 與正規化嘴唇距離；嘴部資料不足不判定，不用先張嘴。表情分數不是成功機率。</p>
    <h2>本機量測記錄</h2><div class="lab-buttons"><button id="lab-record">開始記錄數值</button><button id="lab-export" disabled>匯出 JSON</button></div>
    <p id="lab-record-status">未記錄。只記錄數值與狀態，不含影像、關鍵點、裝置識別碼；最多保存最近 3,000 筆。關頁後清除。</p>
  </section></div><video id="lab-video" muted playsinline hidden></video>
</main>`;
let probe = new FaceProbe();
const video = $<HTMLVideoElement>("lab-video");
const canvas = $<HTMLCanvasElement>("lab-camera");
let tracker: FaceTracker | null = null;
let stream: MediaStream | null = null;
let session = 0, frameId = 0, lastSampleAt = -Infinity, lastUI = -Infinity;
let sample: FaceSample = { points: [], features: null };
let recording = false;
let recordingStarted = 0;
const records: object[] = [];
const fmt = (n: number | undefined) => n === undefined ? "—" : n.toFixed(3);
function enabled(id: string, value: boolean) { $<HTMLButtonElement>(id).disabled = !value; }
function render(now: number) {
  enabled("lab-learn", !!probe.baseline && probe.tracking === "有效追蹤" && !probe.learning && !probe.calibrating);
  $("lab-quality").textContent = `${probe.tracking} · landmarks ${sample.points.length} · ${sample.trackingIssue ?? "資料完整度檢查，非信心分數"} · 推論 ${fmt(tracker?.fps)} FPS / ${fmt(tracker?.inferenceMs)} ms`;
  $("lab-message").textContent = probe.message;
  $<HTMLProgressElement>("lab-baseline-progress").value = probe.calibrationProgress;
  $<HTMLProgressElement>("lab-hold").value = probe.progress;
  $("lab-state").textContent = `${probe.learning ? "學習幅度中" : probe.state} · 累計觸發 ${probe.hits} · 張閉嘴循環 ${probe.cycles} · 自然取樣有效比例 ${Math.round(probe.validRatio * 100)}%`;
  const f = sample.features, b = probe.baseline;
  const rows = ["pitch", "yaw", "roll", "size", "jaw", "lipGap", "eyeLeft", "eyeRight", "browInner", "browLeft", "browRight", "blinkLeft", "blinkRight", "apertureLeft", "apertureRight", "smileLeft", "smileRight", "upperLipLeft", "upperLipRight", "browDownLeft", "browDownRight"] as const;
  const labels: Partial<Record<typeof rows[number], string>> = {
    jaw: "jawOpen", eyeLeft: "eyeWideLeft", eyeRight: "eyeWideRight", browInner: "browInnerUp",
    browLeft: "browOuterUpLeft", browRight: "browOuterUpRight", smileLeft: "mouthSmileLeft", smileRight: "mouthSmileRight",
    upperLipLeft: "mouthUpperUpLeft", upperLipRight: "mouthUpperUpRight",
  };
  $("lab-values").innerHTML = rows.map(k => {
    const c = PROBE_CHANNELS.find(c => c === k);
    return `<tr><th>${labels[k] ?? k}</th><td>${fmt(f?.[k])}</td><td>${fmt(b?.[k])}</td><td>${fmt(b && f ? c ? probe.signals[c] : f[k] !== undefined && b[k] !== undefined ? f[k]! - b[k]! : undefined : undefined)}</td><td>${fmt(b && c ? probe.noise[c] : undefined)}</td></tr>`;
  }).join("") + (["eyes", "closed"] as const).map(c => {
    const profile = { noise: probe.noise, thresholds: probe.thresholds, closedMouth: probe.closedMouth };
    const current = f && b ? faceSignals(f, b, profile)[c] : undefined;
    const baseline = b ? c === "closed" ? faceSignals(b, b, profile).closed : 0 : undefined;
    return `<tr><th>${c}（${c === "closed" ? "閉合狀態" : "綜合"}）</th><td>${fmt(current)}</td><td>${fmt(baseline)}</td><td>${fmt(current !== undefined && baseline !== undefined ? current - baseline : undefined)}</td><td>${fmt(b && c !== "closed" ? probe.noise[c] : undefined)}</td></tr>`;
  }).join("");
  $("lab-learn").textContent = probe.action === "pose_tree" ? "重新確認自然閉嘴" : "記錄這個動作的舒適幅度";
  $("lab-parts").innerHTML = probe.parts.map(p => `<p>${p.channel}：${p.available ? fmt(p.value) : "資料不足"} · 觸發 ${fmt(p.threshold?.enter)} / 解除 ${fmt(p.threshold?.exit)} · 學習幅度 ${fmt(p.threshold?.learned)} ${p.threshold && p.available && p.value >= p.threshold.enter ? "✓" : ""}</p>`).join("");
  if (probe.action === "pose_tree") {
    const limits = closedMouthLimits({ noise: probe.noise, thresholds: probe.thresholds, closedMouth: probe.closedMouth });
    $("lab-parts").innerHTML += `<p>閉合上限：jawOpen ≤ ${fmt(limits.jawMax)}；lipGap ≤ ${fmt(limits.lipGapMax)}。兩項同時有效才計時。</p>`;
  }
  if (recording) {
    records.push({ ms: Math.round(now - recordingStarted), action: probe.action, tracking: probe.tracking,
      state: probe.state, trackingIssue: sample.trackingIssue ?? null, signals: { ...probe.signals }, progress: probe.progress, hits: probe.hits, cycles: probe.cycles,
      features: f ? { pitch: f.pitch, yaw: f.yaw, roll: f.roll, jaw: f.jaw, lipGap: f.lipGap, size: f.size,
        eyeLeft: f.eyeLeft, eyeRight: f.eyeRight, browInner: f.browInner, browLeft: f.browLeft, browRight: f.browRight,
        blinkLeft: f.blinkLeft, blinkRight: f.blinkRight, apertureLeft: f.apertureLeft, apertureRight: f.apertureRight, smileLeft: f.smileLeft, smileRight: f.smileRight, upperLipLeft: f.upperLipLeft, upperLipRight: f.upperLipRight,
        browDownLeft: f.browDownLeft, browDownRight: f.browDownRight } : null,
      thresholds: structuredClone(probe.thresholds[probe.action] ?? null) });
    if (records.length > 3000) records.shift();
    $("lab-record-status").textContent = `已保留 ${records.length} 筆本機數值（不含影像或關鍵點），尚未匯出。`;
    enabled("lab-export", true);
  }
}
function frame(now: number) {
  if (!tracker) return;
  try {
    const next = !document.hidden ? tracker.sample(video, now) : undefined;
    if (next) { sample = next; lastSampleAt = now; probe.update(next.trackingIssue ? null : next.features, now); }
    else if (now - lastSampleAt > FACE_PROBE_CONFIG.staleMs) {
      sample = { points: [], features: null }; probe.update(null, now);
    }
    const c = canvas.getContext("2d")!;
    if (video.readyState >= 2) {
      const h = 640 * video.videoHeight / video.videoWidth;
      if (canvas.height !== h) canvas.height = h;
      c.save(); c.translate(640, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, 640, h); c.restore();
      c.fillStyle = "#90ffd5";
      for (const p of sample.points) { c.beginPath(); c.arc(p.x * 640, p.y * h, 1, 0, Math.PI * 2); c.fill(); }
    }
    if (now - lastUI >= 100) { render(now); lastUI = now; }
    frameId = requestAnimationFrame(frame);
  } catch (error) {
    stop(); $("lab-status").textContent = `辨識中斷：${cameraError(error)}`;
  }
}
function stop() {
  session++; cancelAnimationFrame(frameId); tracker?.close(); tracker = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
  sample = { points: [], features: null }; lastSampleAt = -Infinity;
  probe.update(null, performance.now());
  canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  enabled("lab-start", true); enabled("lab-stop", false); enabled("lab-calibrate", false); enabled("lab-learn", false);
  render(performance.now());
  $("lab-status").textContent = "鏡頭已關閉。";
}
$("lab-start").onclick = async () => {
  stop(); const current = session; probe = new FaceProbe();
  probe.select($<HTMLSelectElement>("lab-action").value as Action);
  enabled("lab-start", false); enabled("lab-stop", true);
  $("lab-status").textContent = "正在開啟鏡頭並載入本機模型…";
  let candidate: FaceTracker | null = null;
  try {
    const media = await openCamera(video, () => current === session);
    if (current !== session) { media.getTracks().forEach(t => t.stop()); return; }
    stream = media;
    media.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (current === session) { stop(); $("lab-status").textContent = "攝影機已中斷，請重新開啟。"; }
    });
    candidate = new FaceTracker(); await candidate.load();
    if (current !== session) { candidate.close(); return; }
    tracker = candidate; enabled("lab-calibrate", true);
    $("lab-status").textContent = "鏡頭已開啟，請自然觀看取樣；不必對齊臉部中心。";
    frameId = requestAnimationFrame(frame);
  } catch (error) {
    candidate?.close();
    if (current !== session) return;
    stop(); $("lab-status").textContent = cameraError(error);
  }
};
$("lab-stop").onclick = stop;
$("lab-calibrate").onclick = () => probe.calibrate(performance.now());
$("lab-action").onchange = () => probe.select($<HTMLSelectElement>("lab-action").value as Action);
$("lab-learn").onclick = () => probe.learn(performance.now());
$("lab-record").onclick = () => {
  recording = !recording;
  if (recording) { records.length = 0; recordingStarted = performance.now(); enabled("lab-export", false); }
  else $("lab-record-status").textContent = `已停止記錄，共 ${records.length} 筆，可匯出至本機。`;
  $("lab-record").textContent = recording ? "停止記錄數值" : "開始記錄數值";
};
$("lab-export").onclick = () => {
  const b = probe.baseline;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, experimental: true,
    config: FACE_PROBE_CONFIG, convention: "column-major Rz*Ry*Rx; mirrored preview; signs require human validation",
    baseline: b ? Object.fromEntries(Object.entries(b).filter(([k]) => k !== "x" && k !== "y")) : null,
    noise: probe.noise, thresholds: probe.thresholds, closedMouth: probe.closedMouth, records }, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "shape-quest-face-diagnostics.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("pagehide", stop);
render(performance.now());
