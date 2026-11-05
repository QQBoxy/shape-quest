import { test, expect } from "@playwright/test";
import { CANDY_SCENES } from "../../src/scenes";

test("four scenes crossfade while the old video and independent game clock keep playing", async ({ page }, info) => {
  test.setTimeout(60000);
  await page.route(`**/${CANDY_SCENES.chocolate.stem}_original_xfade.mp4`, async route => {
    await new Promise(resolve => setTimeout(resolve, 4200));
    await route.continue();
  });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("./?videoTest=1&sceneSwitch=1&variant=trim&overlay=0");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await expect(page.locator("#variant")).toHaveValue("original-fade");
  await page.locator("#lab-start").click();
  await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(2.2);
  await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).queuedScene).toBe("chocolate");
  await expect.poll(async () => (await data()).gameTime, { intervals: [25] }).toBeGreaterThan(4.45);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await data()).switching).toBe(true);
  const before = await data();
  const mediaBefore = await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.waitForTimeout(350);
  expect((await data()).gameTime).toBeGreaterThan(before.gameTime + .2);
  expect(await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(mediaBefore);
  await expect(page.locator("#lab-held-frame")).toBeHidden();
  await expect(page.locator("#lab-video")).toHaveCSS("visibility", "visible");
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "hidden");
  await expect.poll(async () => (await data()).gameTime, { intervals: [25] }).toBeGreaterThan(8.45);
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await data()).score).toBe(200);
  await expect.poll(async () => (await data()).scene, { timeout: 15000 }).toBe("chocolate");
  const first = (await data()).switches[0];
  expect(first.loadMs).toBeGreaterThan(4200);
  expect(first.freezeMs).toBe(0);
  expect(first.before.score).toBe(100);
  expect(first.after.score).toBe(200);
  for (const scene of ["gummy", "cotton-candy", "lollipop"]) {
    await expect(page.locator("#lab-next")).toBeEnabled();
    await page.locator("#lab-next").click();
    await expect.poll(async () => (await data()).scene, { timeout: 10000 }).toBe(scene);
  }
  const report = await data();
  expect(report.switches.map((s: any) => s.to)).toEqual(["chocolate", "gummy", "cotton-candy", "lollipop"]);
  for (const change of report.switches) {
    expect(change.status).toBe("passed");
    expect(change.after.time).toBeGreaterThan(change.before.time);
    expect(change.after.obstacles.map((o: any) => o.collision)).toEqual(change.before.obstacles.map((o: any) => o.collision));
    expect(change.freezeMs).toBe(0);
  }
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await data()).gamePhase).toBe("paused");
  const paused = await data(); await page.waitForTimeout(400);
  expect((await data()).gameTime).toBe(paused.gameTime);
  expect(await page.locator("video").count()).toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("four-scenes.png"), fullPage: true });
});

test("failed scene loading keeps the current clip and game alive and supports retry", async ({ page }) => {
  let fail = true;
  await page.route(`**/${CANDY_SCENES.gummy.stem}_original_xfade.mp4`, route => fail ? route.abort("failed") : route.continue());
  await page.goto("./?videoTest=1&sceneSwitch=1&scene=chocolate");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await page.locator("#lab-start").click(); await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).switches?.[0]?.status).toBe("failed");
  const before = await data();
  expect(before.scene).toBe("chocolate");
  expect(await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await page.waitForTimeout(500);
  expect((await data()).gameTime).toBeGreaterThan(before.gameTime);
  await expect(page.locator("#lab-next")).toHaveText("重試下一個場景");
  fail = false; await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).scene).toBe("gummy");
  expect((await data()).switches.map((s: any) => s.status)).toEqual(["failed", "passed"]);
  expect(await page.locator("video").count()).toBe(1);
});
