import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("isolated road PoC uses the four approved real videos in both orientations and restores snapshots", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./?backgroundRoad=1&videoPaused=true&roadPaused=true&guides=false");
  const video = page.locator("#br-video");
  const canvas = page.locator("#br-canvas");
  const setRange = async (id: string, value: number) => page.locator(`#${id}`).evaluate((input: HTMLInputElement, value) => {
    input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const ready = async () => expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  for (const [scene, file] of Object.entries({
    lollipop: "l03_candy_001_poc_72f19161.mp4", chocolate: "l03_candy_003_poc_9ab4f711.mp4",
    gummy: "l03_candy_004_poc_36c9edb4.mp4", "cotton-candy": "l03_candy_005_poc_e7e3ab4a.mp4",
  })) {
    await page.selectOption("#scene", scene);
    await ready();
    expect(await video.evaluate((v: HTMLVideoElement) => ({ width: v.videoWidth, height: v.videoHeight, loop: v.loop, muted: v.muted }))).toEqual({ width: 1280, height: 720, loop: true, muted: true });
    await expect(page.locator("#br-source")).toContainText(file);
    await setRange("br-seek", 3);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking)).toBe(false);
    for (const aspect of ["landscape", "portrait"]) {
      await page.selectOption("#aspect", aspect);
      await expect.poll(async () => {
        const box = await canvas.boundingBox(); return Math.abs(box!.width / box!.height - (aspect === "landscape" ? 16 / 9 : 9 / 16));
      }).toBeLessThan(0.01);
      await page.locator("#br-stage").screenshot({ path: `test-results/background-road/${scene}-${aspect}-composite.jpg` });
      await page.check("#original");
      await expect(canvas).toBeHidden();
      await page.locator("#br-stage").screenshot({ path: `test-results/background-road/${scene}-${aspect}-original.jpg` });
      await page.uncheck("#original");
      await expect(canvas).toBeVisible();
      await expect(page.locator("#width")).toHaveValue("1");
      await expect(page.locator("#vpY")).toHaveValue("0.45");
    }
  }
  // Media controls and road clock operate independently.
  const before = await canvas.getAttribute("data-distance");
  await page.uncheck("#videoPaused");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(3.4);
  await expect(canvas).toHaveAttribute("data-distance", before!);
  await page.check("#videoPaused");
  const videoTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.uncheck("#roadPaused");
  await expect.poll(() => canvas.getAttribute("data-distance")).not.toBe(before);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(videoTime, 1);
  await page.check("#roadPaused");
  await setRange("zoom", 1.25); await setRange("offsetX", 12); await setRange("offsetY", -8);
  await setRange("vpX", 0.6); await setRange("width", 1.2); await setRange("videoRate", 0.8);
  await page.selectOption("#fit", "contain"); await page.selectOption("#lane", "-1");
  await page.click("#snapshot");
  const url = await page.locator("#br-url").inputValue();
  const distance = Number(new URL(url).searchParams.get("distance"));
  await page.goto(url); await ready();
  await expect(page.locator("#zoom")).toHaveValue("1.25");
  await expect(page.locator("#vpX")).toHaveValue("0.6");
  await expect(page.locator("#lane")).toHaveValue("-1");
  await expect(page.locator("#fit")).toHaveValue("contain");
  await expect.poll(() => canvas.getAttribute("data-distance")).toBe(distance.toFixed(4));
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(videoTime, 1);
  // Mobile layout, rotation, viewport mode, and contain expose rather than hide blank areas.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption("#aspect", "window");
  await expect.poll(async () => { const b = await canvas.boundingBox(); return b!.width / b!.height; }).toBeCloseTo(390 / 844, 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/background-road/mobile-controls.png", fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => { const b = await canvas.boundingBox(); return b!.width / b!.height; }).toBeCloseTo(844 / 390, 2);
  await page.click("#reset");
  await ready(); await expect(page.locator("#scene")).toHaveValue("lollipop");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect.poll(() => canvas.getAttribute("data-distance")).not.toBe("0.0000");
  expect(errors).toEqual([]);
});

test("media failure stays visible while the independent Canvas keeps rendering", async ({ page }) => {
  await page.route("**/videos/level-03/*.mp4", route => route.abort());
  await page.goto("./?backgroundRoad=1");
  await expect(page.locator("#br-status")).toContainText("影片載入失敗");
  await expect.poll(async () => Number(await page.locator("#br-canvas").getAttribute("data-distance"))).toBeGreaterThan(1);
});

test("real-time comparison crosses a video loop in all eight scene/aspect combinations", async ({ page }) => {
  test.setTimeout(150000);
  const results = [];
  for (const scene of ["lollipop", "chocolate", "gummy", "cotton-candy"]) {
    for (const aspect of ["landscape", "portrait"]) {
      await page.setViewportSize(aspect === "portrait" ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.goto(`./?backgroundRoad=1&scene=${scene}&aspect=${aspect}&guides=false`);
      await expect.poll(() => page.locator("#br-video").evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2)).toBe(true);
      const sample = await page.evaluate(async () => {
        const video = document.querySelector<HTMLVideoElement>("#br-video")!;
        const canvas = document.querySelector<HTMLCanvasElement>("#br-canvas")!;
        let last = performance.now(), frames = 0, loops = 0, lastTime = video.currentTime;
        const start = last, intervals: number[] = [];
        const before = video.getVideoPlaybackQuality();
        const events = { waiting: 0, stalled: 0 };
        video.addEventListener("waiting", () => events.waiting++);
        video.addEventListener("stalled", () => events.stalled++);
        await new Promise<void>(resolve => {
          function tick(now: number) {
            intervals.push(now - last); last = now; frames++;
            if (video.currentTime + 0.5 < lastTime) loops++;
            lastTime = video.currentTime;
            if (now - start < 10000) requestAnimationFrame(tick); else resolve();
          }
          requestAnimationFrame(tick);
        });
        const after = video.getVideoPlaybackQuality();
        intervals.sort((a, b) => a - b);
        return {
          elapsedMs: last - start, rafFps: frames * 1000 / (last - start), rafP95Ms: intervals[Math.floor(intervals.length * 0.95)],
          loops, ...events, droppedFrames: after.droppedVideoFrames - before.droppedVideoFrames,
          totalFrames: after.totalVideoFrames - before.totalVideoFrames, distance: Number(canvas.dataset.distance),
          stats: document.getElementById("br-stats")!.textContent,
        };
      });
      expect(sample.loops).toBeGreaterThanOrEqual(1);
      expect(sample.distance).toBeGreaterThan(50);
      results.push({ scene, aspect, viewport: page.viewportSize(), ...sample });
    }
  }
  await mkdir("test-results/background-road", { recursive: true });
  await writeFile("test-results/background-road/comparison.json", JSON.stringify({ environment: "Playwright Chromium, macOS; portrait is viewport emulation, not a physical phone", secondsPerCase: 10, results }, null, 2));
});
