import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
// Measure this local performance scenario in a visible browser, as for manual play.
test.use({ headless: false });
const output = "docs/game-tests/chocolate-riverside";
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const data = await page.evaluate(() => ({
    gpu: (() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    })(),
    pose: (window as any).testPose,
    count: (window as any).realInferenceStats?.length,
    lastInferences: (window as any).realInferenceStats?.slice(-10),
    debug: document.querySelector('#debug')?.textContent,
    message: document.querySelector('#calibration-message')?.textContent,
    title: document.querySelector('#calibration-title')?.textContent,
  }));
  await writeFile(`${output}/failure-${Date.now()}.json`, JSON.stringify({ test:info.title, ...data },null,2)+"\n");
});
for (const scene of ["lollipop", "chocolate"]) {
  test(`${scene}: real 120-second game with real MediaPipe inference and synthetic body input`, async ({ page }) => {
    test.setTimeout(210000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await mkdir(output, { recursive: true });
    await page.addInitScript(() => {
      Object.assign(window, { testPose: "standing", autoPose: false, realInferenceStats: [] });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "#333"; c.fillRect(0, 0, 640, 480);
        setInterval(() => { c.fillRect(0, 0, 640, 480); }, 50);
        return canvas.captureStream(20);
      } });
    });
    // The real model still loads and runs on blank camera frames. Only the returned
    // landmarks are synthetic, to exercise calibration/actions without a human.
    await page.route(/\/assets\/pose-[^/]+\.js(?:\?.*)?$/, async route => {
      const url = route.request().url();
      if (url.includes("realModel=1")) { await route.continue(); return; }
      await route.fulfill({ contentType: "text/javascript", body: `
        import { PoseTracker as RealTracker } from ${JSON.stringify(url + "?realModel=1")};
        export class PoseTracker extends RealTracker {
          sample(video, now) {
            const actual = super.sample(video, now);
            if (actual === undefined) return;
            window.realInferenceStats.push({ ms: this.inferenceMs, fps: this.fps });
            let action = window.testPose;
            if (window.autoPose) {
              action = 'standing';
              const debug = document.querySelector('#debug').textContent;
              const time = Number(debug.match(/t=([\\d.]+)/)?.[1]);
              const target = debug.match(/(jump|duck|left|right) · 碰撞 ([\\d.]+)/);
              if (target && target[2] - time <= .5 && target[2] - time >= 0) action = target[1];
            }
            if (action === 'missing') return [];
            const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
            p[0].y = .1;
            for (const [i,x,y] of [[11,.43,.3],[12,.57,.3],[23,.43,.55],[24,.57,.55],[25,.43,.73],[26,.57,.73],[27,.43,.9],[28,.57,.9]]) p[i] = {x,y,visibility:1};
            if (action === 'left' || action === 'right') for (const v of p) v.x += action === 'left' ? -.15 : .15;
            if (action === 'jump') { p[23].y=p[24].y=.47; p[27].y=p[28].y=.84; }
            if (action === 'duck') { p[23].y=p[24].y=.67; p[11].y=p[12].y=.43; p[25].x=.25; p[26].x=.75; }
            return p;
          }
        }` });
    });
    await page.goto(`./?scene=${scene}`);
    await expect(page.locator("#start-camera")).toBeEnabled({ timeout: 20000 });
    await page.locator("#menu-toggle").click();
    await page.locator(".menu-tools summary").click();
    await page.locator("#debug-toggle").click();
    await page.locator("#menu-close").click();
    await page.locator("#start-camera").click();
    await page.locator("#choose-body").click();
    await expect(page.locator("#start-calibration")).toBeVisible({ timeout: 30000 });
    await page.locator("#start-calibration").click();
    const pose = async (value: string, ms: number) => {
      await page.evaluate(v => { (window as any).testPose = v; }, value);
      await page.waitForTimeout(ms);
    };
    await pose("standing", 0);
    await expect(page.locator("#calibration-title")).toHaveText("往左跨一步，再回中央", { timeout: 15000 });
    for (const action of ["left", "right", "duck", "jump"]) {
      await pose(action, 300);
      await expect(page.locator("#calibration-title")).toHaveText("動作成功，回中央站好");
      await pose("standing", 500);
    }
    await expect(page.locator("#begin-camera")).toBeVisible();
    await page.evaluate(() => { (window as any).autoPose = true; });
    await page.locator("#begin-camera").click();
    await expect(page.locator("#countdown")).toBeHidden({ timeout: 7000 });
    const wallStart = Date.now();
    await page.evaluate(() => {
      const v = document.querySelector<HTMLVideoElement>("#background")!;
      const data = { loops: 0, frames: 0, maxFrameGapMs: 0, maxLoopGapMs: 0, waiting: 0, stalled: 0, fallbackFrames: 0,
        sourceChanges: 0, waitingDurationsMs: [] as number[], renderFPS: [] as number[], rates: [] as number[] };
      (window as any).gameVideoProbe = data;
      let prev: { wall: number; media: number } | null = null;
      let waitingAt: number | null = null;
      const playing = () => /camera · playing/.test(document.querySelector('#debug')!.textContent!);
      v.addEventListener('waiting', () => { if (playing()) { data.waiting++; waitingAt = performance.now(); } });
      v.addEventListener('playing', () => { if (waitingAt !== null) { data.waitingDurationsMs.push(performance.now()-waitingAt); waitingAt=null; } });
      v.addEventListener('pause', () => { prev = null; waitingAt = null; });
      v.addEventListener('stalled', () => { if (playing()) data.stalled++; });
      v.addEventListener('emptied', () => { data.sourceChanges++; });
      function sample(now: number, m: VideoFrameCallbackMetadata) {
        if (playing() && !v.paused) {
          if (prev) {
            const gap = now-prev.wall;
            data.maxFrameGapMs = Math.max(data.maxFrameGapMs, gap);
            if (prev.media-m.mediaTime > v.duration/2) { data.loops++; data.maxLoopGapMs=Math.max(data.maxLoopGapMs,gap); }
          }
          data.frames++; prev={wall:now,media:m.mediaTime};
        } else prev=null;
        v.requestVideoFrameCallback(sample);
      }
      v.requestVideoFrameCallback(sample);
      let lastPerf = 0;
      function render(now: number) {
        if (playing()) {
          const c = document.querySelector<HTMLCanvasElement>('#world')!;
          const pixel=c.getContext('2d')!.getImageData(10,10,1,1).data;
          if (pixel[3]===255 && pixel[0]<200 && pixel[1]>200) data.fallbackFrames++;
          if (now-lastPerf > 1000) {
            data.renderFPS.push(Number(document.querySelector('#debug')!.textContent!.match(/FPS ([\d.]+)/)?.[1]));
            data.rates.push(v.playbackRate); lastPerf=now;
          }
        }
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    });
    // Explicit manual pause, then tracking loss/recovery, through the production flow.
    await expect.poll(() => page.locator("#score").textContent(), { timeout: 10000 }).toBe("0100");
    await page.locator("#menu-toggle").click();
    const pausedTime = await page.locator("#timer").textContent();
    const pausedVideo = await page.locator("#background").evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.waitForTimeout(1100);
    await expect(page.locator("#timer")).toHaveText(pausedTime!);
    expect(await page.locator("#background").evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    expect(Math.abs(await page.locator("#background").evaluate((v: HTMLVideoElement) => v.currentTime)-pausedVideo)).toBeLessThan(.06);
    await page.locator("#menu-close").click();
    await expect(page.locator("#countdown")).toBeHidden({ timeout: 7000 });
    await page.evaluate(() => { (window as any).autoPose = false; (window as any).testPose = "missing"; });
    await expect(page.locator("#dialog-title")).toHaveText("等你回到畫面裡", { timeout: 5000 });
    const lostTime = await page.locator("#timer").textContent();
    await page.waitForTimeout(1000);
    await expect(page.locator("#timer")).toHaveText(lostTime!);
    expect(await page.locator("#background").evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.evaluate(() => { (window as any).testPose = "standing"; (window as any).autoPose = true; });
    await expect(page.locator("#dialog")).toBeHidden({ timeout: 5000 });
    await expect(page.locator("#countdown")).toBeHidden({ timeout: 7000 });
    await expect(page.locator("#restart")).toBeVisible({ timeout: 145000 });
    const wallSeconds = (Date.now()-wallStart)/1000;
    const report = await page.evaluate(() => ({
      ...(window as any).gameVideoProbe,
      realInferenceStats: (window as any).realInferenceStats,
      debug: document.querySelector('#debug')!.textContent,
      result: document.querySelector('#dialog-body')!.textContent,
      video: (() => { const v=document.querySelector<HTMLVideoElement>('#background')!; return { src:v.currentSrc, paused:v.paused, rate:v.playbackRate, loop:v.loop, muted:v.muted }; })(),
    }));
    const median = (values: number[]) => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const inference = report.realInferenceStats as { ms: number; fps: number }[];
    delete report.realInferenceStats;
    Object.assign(report, { scene, wallSeconds, realInferenceCount: inference.length,
      medianInferenceMs: median(inference.map(x=>x.ms)), medianInferenceFPS: median(inference.map(x=>x.fps)),
      medianRenderFPS: median(report.renderFPS), manualPausePassed:true, trackingRecoveryPassed:true,
      testedAt: new Date().toISOString(), errors,
      environment: "Visible desktop Chromium; real MediaPipe model inference on synthetic blank camera plus injected synthetic landmarks. Normal 1.0x native video and real wall time. Not human Webcam acceptance.",
    });
    await writeFile(`${output}/${scene}-120s-game.json`, JSON.stringify(report,null,2)+"\n");
    await page.screenshot({ path: `${output}/${scene}-120s-game.png` });
    expect(wallSeconds).toBeGreaterThanOrEqual(120);
    expect(report.result).toContain("遊玩 120 秒");
    expect(report.loops).toBeGreaterThanOrEqual(14);
    expect(report.frames).toBeGreaterThan(2400);
    expect(report.fallbackFrames).toBe(0);
    expect(report.sourceChanges).toBe(0);
    expect(report.stalled).toBe(0);
    expect(report.rates.every((r: number)=>r===1)).toBe(true);
    expect(report.video).toMatchObject({ paused:true, rate:1, loop:true, muted:true });
    expect(inference.length).toBeGreaterThan(1000);
    expect(report.medianRenderFPS).toBeGreaterThanOrEqual(25);
    expect(errors).toEqual([]);
    // Replay keeps this scene and resets the same game, rather than swapping videos.
    await page.locator('#restart').click();
    await expect(page.locator('#calibration-panel')).toBeHidden();
    await expect(page.locator('#score')).toHaveText('0000');
    await expect(page.locator('#scene-choice')).toBeDisabled();
  });
}
