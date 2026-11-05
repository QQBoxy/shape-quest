import { test, expect } from "@playwright/test";

test("comparison carousel cycles all scenes, pauses its timer and keeps the round", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./?videoTest=1&scene=cotton-candy&overlay=0");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await page.locator("#lab-mode").selectOption("carousel");
  await expect(page.locator("h1")).toHaveText("糖果王國場景輪播測試");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#scene")).toHaveValue("cotton-candy");
  await expect(page.locator("#lab-overlay")).not.toBeChecked();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await page.locator("#lab-start").click();
  await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(1);
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await data()).gamePhase).toBe("paused");
  const paused = await data();
  await page.waitForTimeout(8500);
  expect((await data()).nextSceneIn).toBe(paused.nextSceneIn);
  expect((await data()).switches).toHaveLength(0);
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await data()).switches.filter((s: any) => s.status === "passed").length,
    { timeout: 55000, intervals: [250] }).toBe(4);
  await page.locator("#lab-pause").click();
  const report = await data();
  expect(report.carousel).toBe(true);
  expect(report.carouselSeconds).toBe(8);
  expect(report.scene).toBe("cotton-candy");
  expect(report.switches.map((s: any) => s.to)).toEqual(["lollipop", "chocolate", "gummy", "cotton-candy"]);
  for (const [index, s] of report.switches.entries()) {
    expect(s.status).toBe("passed");
    expect(s.after.time).toBeGreaterThan(s.before.time);
    expect(s.freezeMs).toBe(0);
    expect(s.requestedGameTime - (index ? report.switches[index - 1].after.time : 0)).toBeGreaterThanOrEqual(8);
  }
  await page.locator("#lab-interval").selectOption("15");
  await expect.poll(async () => (await data()).nextSceneIn).toBe(15);
  await page.screenshot({ path: test.info().outputPath("carousel.png"), fullPage: true });
  expect(await page.locator("video").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("carousel retains the old clip on failure and retries without interrupting gameplay", async ({ page }) => {
  test.setTimeout(40000);
  let fail = true;
  await page.route("**/l03_candy_003_poc_9ab4f711_original_xfade.mp4", route => fail ? route.abort("failed") : route.continue());
  await page.goto("./?videoTest=1&sceneCarousel=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  const data = async () => JSON.parse(await page.locator("#video-metrics").textContent() || "{}");
  await page.locator("#lab-start").click();
  await expect.poll(async () => (await data()).switches?.[0]?.status, { timeout: 15000 }).toBe("failed");
  const frozen = await data();
  await page.waitForTimeout(1000);
  expect((await data()).gameTime).toBeGreaterThan(frozen.gameTime);
  expect((await data()).switches).toHaveLength(1);
  await expect(page.locator("#lab-held-frame")).toBeHidden();
  fail = false;
  await page.locator("#lab-next").click();
  await expect.poll(async () => (await data()).scene).toBe("chocolate");
  await expect.poll(async () => (await data()).scene, { timeout: 15000 }).toBe("gummy");
  expect((await data()).switches.map((s: any) => s.status)).toEqual(["failed", "passed", "passed"]);
});
