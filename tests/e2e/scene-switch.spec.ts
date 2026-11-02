import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "docs/scene-switch-tests/manual";

test("manual PoC waits for judgement, holds the last frame, preserves the game and wraps in order", async ({ page }) => {
  test.setTimeout(60000);
  await mkdir(output, { recursive: true });
  await page.route("**/l03_candy_003_original_xfade.mp4", async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("./?videoTest=1&sceneSwitch=1&variant=trim&overlay=0");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await expect(page.locator("#variant")).toHaveValue("original-fade");
  await expect(page.locator("#variant")).toBeDisabled();
  await expect(page.locator("#fade-duration")).toBeDisabled();
  await page.locator("#lab-start").click();
  await expect(page.locator("#scene")).toBeDisabled();
  await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(2.2);
  await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).queuedScene).toBe("chocolate");
  expect((await data()).switches).toHaveLength(0);
  await expect.poll(async () => (await data()).gameTime, { intervals: [25] }).toBeGreaterThan(4.45);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await data()).switching).toBe(true);
  await expect(page.locator("#lab-held-frame")).toBeVisible();
  await expect(page.locator("#lab-video")).toHaveCSS("visibility", "hidden");
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "hidden");
  await expect(page.locator("#lab-next")).toBeDisabled();
  const frozen = await data();
  await page.waitForTimeout(300);
  expect((await data()).gameTime).toBe(frozen.gameTime);
  await page.screenshot({ path: `${output}/delayed-load-held-frame.png` });
  await expect.poll(async () => (await data()).scene, { timeout: 15000 }).toBe("chocolate");
  const first = (await data()).switches[0];
  expect(first.waitMs).toBeGreaterThan(1000);
  expect(first.freezeMs).toBeGreaterThan(900);
  expect(first.before.score).toBe(100);
  expect(first.after).toEqual(first.before);
  for (const scene of ["gummy", "cotton-candy", "lollipop"]) {
    await expect(page.locator("#lab-next")).toBeEnabled();
    await page.locator("#lab-next").click();
    await expect.poll(async () => (await data()).scene, { timeout: 10000 }).toBe(scene);
  }
  const report = await data();
  expect(report.switches.map((s: any) => s.to)).toEqual(["chocolate", "gummy", "cotton-candy", "lollipop"]);
  for (const s of report.switches) {
    expect(s.status).toBe("passed");
    expect(s.after).toEqual(s.before);
    expect(s.firstFrameMs).toBeGreaterThanOrEqual(s.loadMs);
    expect(s.before.obstacles.some((o: any) => o.result === "pending" && o.collision - s.before.time <= 3)).toBe(false);
  }
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await data()).gamePhase).toBe("paused");
  const paused = await data();
  await page.waitForTimeout(400);
  expect((await data()).gameTime).toBe(paused.gameTime);
  await expect(page.locator("#lab-next")).toBeDisabled();
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await data()).gamePhase, { timeout: 7000 }).toBe("playing");
  expect(await page.locator("video").count()).toBe(1);
  expect(errors).toEqual([]);
  await writeFile(`${output}/functional.json`, JSON.stringify({ ...report, errors, testedAt: new Date().toISOString() }, null, 2)+"\n");
  await page.screenshot({ path: `${output}/four-scenes-wrap.png`, fullPage: true });
});

test("failed scene load freezes the existing round and can retry without a reset", async ({ page }) => {
  let fail = true;
  await page.route("**/l03_candy_004_original_xfade.mp4", async route => {
    if (fail) await route.abort("failed"); else await route.continue();
  });
  await page.goto("./?videoTest=1&sceneSwitch=1&scene=chocolate");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await page.locator("#lab-start").click();
  await expect(page.locator("#lab-next")).toBeEnabled();
  await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).switches[0]?.status).toBe("failed");
  const frozen = await data();
  expect(frozen.scene).toBe("chocolate");
  await expect(page.locator("#lab-held-frame")).toBeVisible();
  await expect(page.locator("#lab-start")).toBeDisabled();
  await expect(page.locator("#lab-next")).toHaveText("重試下一個場景");
  await page.waitForTimeout(500);
  expect((await data()).gameTime).toBe(frozen.gameTime);
  await page.keyboard.press("ArrowUp");
  expect((await data()).score).toBe(frozen.score);
  await page.screenshot({ path: `${output}/failed-load-held-frame.png` });
  fail = false;
  await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).scene).toBe("gummy");
  const recovered = await data();
  expect(recovered.switchError).toBe("");
  expect(recovered.switches.map((s: any) => s.status)).toEqual(["failed", "passed"]);
  expect(recovered.switches[1].after).toEqual(recovered.switches[1].before);
  await expect(page.locator("#lab-held-frame")).toBeHidden();
  await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(frozen.gameTime + .3);
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/failure-retry.json`, JSON.stringify({ ...recovered, testedAt: new Date().toISOString() }, null, 2)+"\n");
});
