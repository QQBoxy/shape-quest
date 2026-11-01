import { test, expect } from "@playwright/test";
test("candy integration pauses both clocks and video seeking cannot reset judgement time", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?videoTest=1");
  await expect(page.locator("#lab-start")).toBeEnabled({ timeout: 20000 });
  const metrics = async () =>
    JSON.parse((await page.locator("#video-metrics").textContent()) || "{}");
  const res = await request.head("videos/level-03/l03_candy_001_v2.mp4");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("video");
  await page.locator("#lab-start").click();
  for (const [time, action] of [
    [4.45, "jump"],
    [8.45, "duck"],
    [12.45, "left"],
    [16.45, "right"],
  ] as const) {
    await expect
      .poll(async () => (await metrics()).gameTime, {
        timeout: 10000,
        intervals: [100],
      })
      .toBeGreaterThan(time);
    await page
      .locator(".lab-stage")
      .screenshot({
        path: `test-results/candy-v2-${action}-overlay.png`,
      });
  }
  await page.locator("#lab-pause").click();
  await expect.poll(async () => (await metrics()).gamePhase).toBe("paused");
  const before = await metrics();
  await page.waitForTimeout(1200); // Real pause duration, not an accelerated clock.
  const after = await metrics();
  expect(after.gameTime).toBe(before.gameTime);
  expect(Math.abs(after.videoTime - before.videoTime)).toBeLessThan(0.06);
  await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 5;
  });
  await expect
    .poll(async () => (await metrics()).videoTime)
    .toBeGreaterThan(4.9);
  expect((await metrics()).gameTime).toBe(before.gameTime);
  await page.locator("#lab-pause").click();
  await expect
    .poll(async () => (await metrics()).gamePhase, { timeout: 7000 })
    .toBe("playing");
  await expect
    .poll(async () => (await metrics()).gameTime)
    .toBeGreaterThan(before.gameTime + 0.2);
  await expect
    .poll(async () => (await metrics()).videoTime)
    .toBeGreaterThan(5.2);
  expect((await metrics()).profile.speed).toBe(5);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/candy-v2-aligned.png",
    fullPage: true,
  });
});
