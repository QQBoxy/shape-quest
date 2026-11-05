import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("manual four-scene PoC completes a real 120-second round with continuous game state", async ({ page }) => {
  test.setTimeout(180000);
  const output = "docs/scene-switch-tests/manual";
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("./?videoTest=1&sceneSwitch=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await page.evaluate(() => {
    const world = document.querySelector<HTMLCanvasElement>("#lab-world")!;
    const probe = document.createElement("canvas"); probe.width = 32; probe.height = 18;
    const c = probe.getContext("2d", { willReadFrequently: true })!;
    const stats = { sampledFrames: 0, transitionFrames: 0, unavailableReadbacks: 0, blackFrames: 0, fallbackFrames: 0 };
    Object.assign(window, { switchDisplayProbe: stats });
    function sample() {
      const v = document.querySelector<HTMLVideoElement>("#lab-video")!;
      const fallback = world.getContext("2d")!.getImageData(10, 10, 1, 1).data;
      if (fallback[3] === 255 && fallback[0] < 200 && fallback[1] > 200) stats.fallbackFrames++;
      if (v.readyState >= 2) {
        c.drawImage(v, 0, 0, 32, 18);
        const incoming = document.querySelector<HTMLVideoElement>("#lab-video-incoming");
        if (incoming && incoming.readyState >= 2) {
          c.globalAlpha = Number(getComputedStyle(incoming).opacity);
          c.drawImage(incoming, 0, 0, 32, 18);
          c.globalAlpha = 1;
          stats.transitionFrames++;
        }
        const pixels = c.getImageData(0, 0, 32, 18).data;
        let dark = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] < 20 && pixels[i+1] < 20 && pixels[i+2] < 20 && pixels[i+3] === 255) dark++;
        if (dark / (32 * 18) > .98) stats.blackFrames++;
        stats.sampledFrames++;
      } else stats.unavailableReadbacks++;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const wallStart = Date.now();
  await page.locator("#lab-start").click();
  // This mode changes scenes only when the test presses the manual button.
  for (const [at, scene] of [[22, "chocolate"], [52, "gummy"], [82, "cotton-candy"], [112, "lollipop"]] as const) {
    await expect.poll(async () => (await data()).gameTime, { timeout: 40000, intervals: [250] }).toBeGreaterThan(at);
    await page.locator("#lab-next").click();
    await expect.poll(async () => (await data()).scene, { timeout: 10000 }).toBe(scene);
    console.log(JSON.stringify({ mode: "manual", scene, gameTime: (await data()).gameTime }));
    await page.screenshot({ path: `${output}/round-${scene}.png` });
  }
  await expect.poll(async () => (await data()).gamePhase, { timeout: 20000 }).toBe("finished");
  const wallSeconds = (Date.now() - wallStart) / 1000;
  const report = { ...await data(), wallSeconds, errors, testedAt: new Date().toISOString(),
    displayProbe: await page.evaluate(() => (window as any).switchDisplayProbe),
    environment: "Desktop Playwright Chromium, native 1.0x video, real wall time. Manual button clicks driven by test; no synthetic clock, no MediaPipe or human camera acceptance.",
  };
  await writeFile(`${output}/round-120s.json`, JSON.stringify(report, null, 2)+"\n");
  await page.screenshot({ path: `${output}/round-120s.png`, fullPage: true });
  expect(wallSeconds).toBeGreaterThanOrEqual(120);
  expect(report.gameTime).toBe(120);
  expect(report.roundDuration).toBe(120);
  expect(report.switches.map((s: any) => s.to)).toEqual(["chocolate", "gummy", "cotton-candy", "lollipop"]);
  for (const s of report.switches) {
    expect(s.status).toBe("passed");
    expect(s.after.time).toBeGreaterThan(s.before.time);
    expect(s.freezeMs).toBe(0);
    expect(s.before.obstacles.some((o: any) => o.result === "pending" && o.collision - s.before.time <= 3)).toBe(false);
  }
  expect(report.displayProbe.sampledFrames).toBeGreaterThan(2400);
  expect(report.displayProbe.blackFrames).toBe(0);
  expect(report.displayProbe.transitionFrames).toBeGreaterThan(20);
  expect(report.displayProbe.fallbackFrames).toBe(0);
  expect(report.rate).toBe(1);
  expect(report.muted && report.loop && report.playsInline && report.paused).toBe(true);
  expect(report.stalled).toBe(0);
  expect(report.switchError).toBe("");
  expect(errors).toEqual([]);
  await expect(page.locator("#lab-next")).toBeDisabled();
  expect(await page.locator("video").count()).toBe(1);
});

test("automatic carousel completes 120 real seconds across repeated scene cycles", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./?videoTest=1&sceneCarousel=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  const began = Date.now();
  await page.locator("#lab-start").click();
  let nextProgress = 30;
  await expect.poll(async () => {
    const progress = await data();
    if (progress.gameTime >= nextProgress) {
      console.log(JSON.stringify({ mode: "carousel", scene: progress.scene, gameTime: progress.gameTime,
        switches: progress.switches.length, switchError: progress.switchError }));
      nextProgress += 30;
    }
    return progress.gamePhase;
  }, { timeout: 155000, intervals: [1000] }).toBe("finished");
  const report = { ...await data(), wallSeconds: (Date.now() - began) / 1000, errors };
  await writeFile(info.outputPath("carousel-120s.json"), JSON.stringify(report, null, 2) + "\n");
  expect(report.wallSeconds).toBeGreaterThanOrEqual(120);
  expect(report.gameTime).toBe(120);
  expect(report.switches.length).toBeGreaterThanOrEqual(8);
  const order = ["chocolate", "gummy", "cotton-candy", "lollipop"];
  for (const [index, change] of report.switches.entries()) {
    expect(change.to).toBe(order[index % order.length]);
    expect(change.status).toBe("passed");
    expect(change.after.time).toBeGreaterThan(change.before.time);
    expect(change.freezeMs).toBe(0);
  }
  expect(report.rate).toBe(1);
  expect(report.muted && report.loop && report.playsInline && report.paused).toBe(true);
  expect(report.switchError).toBe("");
  expect(errors).toEqual([]);
});
