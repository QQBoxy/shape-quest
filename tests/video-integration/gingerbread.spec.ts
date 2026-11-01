import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "docs/video-tests/l03-candy-002";
for (const scene of ["gingerbread", "lollipop"]) {
  test(`${scene}: 120 wall seconds, overlays and independent game clock`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await mkdir(output, { recursive: true });
    await page.goto(`./?videoTest=1&scene=${scene}`);
    await expect(page.locator("#lab-start")).toBeEnabled({ timeout: 20000 });
    expect(await page.locator("video").count()).toBe(1);
    const metrics = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
    await page.locator("#lab-start").click();
    for (const [time, action, key] of [
      [4.5, "jump", "ArrowUp"], [8.5, "duck", "ArrowDown"],
      [12.5, "left", "ArrowLeft"], [16.5, "right", "ArrowRight"],
    ] as const) {
      await expect.poll(async () => (await metrics()).gameTime, { timeout: 10000, intervals: [50] }).toBeGreaterThan(time);
      await page.locator(".lab-stage").screenshot({ path: `${output}/${scene}-${action}-overlay.png` });
      await page.keyboard.press(key);
    }
    await expect.poll(async () => (await metrics()).successes).toBe(4);
    const overlaySuccesses = (await metrics()).successes;
    // Restart after screenshot sampling so capture overhead cannot perturb the long run.
    const wallStart = Date.now();
    await page.locator("#lab-start").click();
    // Real native decoding at 1.0x; no synthetic clock or accelerated playback.
    await expect.poll(async () => (await metrics()).activeSeconds, {
      timeout: 135000, intervals: [1000],
    }).toBeGreaterThanOrEqual(120);
    const wallSeconds = (Date.now() - wallStart) / 1000;
    await page.locator("#lab-pause").click();
    await expect.poll(async () => (await metrics()).gamePhase).toBe("paused");
    const report = await metrics();
    await page.waitForTimeout(1100);
    const paused = await metrics();
    expect(paused.gameTime).toBe(report.gameTime);
    expect(Math.abs(paused.videoTime - report.videoTime)).toBeLessThan(0.06);
    await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => { v.currentTime = 2; });
    await expect.poll(async () => (await metrics()).videoTime).toBeCloseTo(2, 1);
    expect((await metrics()).gameTime).toBe(report.gameTime);
    await page.locator("#lab-pause").click();
    await expect.poll(async () => (await metrics()).gamePhase, { timeout: 7000 }).toBe("playing");
    await expect.poll(async () => (await metrics()).gameTime).toBeGreaterThan(report.gameTime + 0.3);
    await page.locator("#lab-pause").click();
    await page.screenshot({ path: `${output}/${scene}-120s.png`, fullPage: true });
    await writeFile(`${output}/${scene}-120s.json`, JSON.stringify({
      ...report, wallSeconds, overlaySuccesses, pauseResumePassed: true, seekIndependentClockPassed: true,
      testedAt: new Date().toISOString(),
      testEnvironment: "Desktop Playwright Chromium, serial pages, normal 1.0x real wall time; not mobile or human pose input",
      errors,
    }, null, 2) + "\n");
    expect(wallSeconds).toBeGreaterThanOrEqual(120);
    expect(report.scene).toBe(scene);
    expect(report.rate).toBe(1);
    expect(report.muted && report.playsInline && report.loop).toBe(true);
    expect(report.loops.length).toBeGreaterThanOrEqual(15);
    expect(report.gameTime).toBeGreaterThan(119);
    expect(Math.abs(report.gameTime - report.activeSeconds)).toBeLessThan(0.3);
    expect(report.frameCount).toBeGreaterThan(2400);
    // Native loop seeking can emit waiting even when decoded frames stay continuous.
    expect(report.waitingEvents.every((e: { durationMs: number | null }) => e.durationMs !== null && e.durationMs < 250)).toBe(true);
    expect(report.stalled).toBe(0);
    expect(report.gapsOver250ms).toBe(0);
    expect(report.misses).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
}
