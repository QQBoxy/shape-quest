import { test, expect } from "@playwright/test";
for (const [variant, label, file, duration] of [
  ["original-fade", "原始影片＋淡化", "l03_candy_001_v2_original_xfade.mp4", 7.583],
  ["xfade", "剪輯＋淡化", "l03_candy_001_v2_xfade.mp4", 6.333],
] as const) {
  test(`${label} uses baked fade and loops without a transition clock`, async ({page}) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`?videoTest=1&variant=${variant}`);
    await expect(page.locator("#lab-start")).toBeEnabled();
    await expect(page.locator("#variant")).toHaveValue(variant);
    await expect(page.locator("#variant option", {hasText:label})).toHaveCount(1);
    const metadata = await page.locator("#lab-video").evaluate((v:HTMLVideoElement) => ({src:v.currentSrc,duration:v.duration,loop:v.loop,rate:v.playbackRate}));
    expect(metadata.src).toContain(file); expect(metadata.duration).toBeCloseTo(duration,2);
    expect(metadata.loop).toBe(true); expect(metadata.rate).toBe(1);
    await page.locator("#lab-start").click();
    const data = async () => JSON.parse((await page.locator("#video-metrics").textContent()) || "{}");
    await expect.poll(async () => ((await data()).loops?.length ?? 0), {timeout:12000,intervals:[200]}).toBeGreaterThanOrEqual(1);
    expect((await data()).gameTime).toBeGreaterThan(duration);
    await page.locator("#lab-pause").click();
    await expect.poll(async () => (await data()).gamePhase).toBe("paused");
    const before = await data(); await page.waitForTimeout(500); const after = await data();
    expect(after.gameTime).toBe(before.gameTime); expect(Math.abs(after.videoTime-before.videoTime)).toBeLessThan(.05);
    // Apply a longer baked fade while paused, then check the live-playback reload path.
    await page.locator("#fade-duration").evaluate((el:HTMLInputElement) => {
      el.value = "3"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
    });
    await expect(page.locator("#lab-start")).toBeEnabled();
    await expect(page.locator("#fade-value")).toHaveText("0.500 秒");
    await expect(page.locator("#lab-source")).toContainText(variant === "xfade" ? "v2-trim-12.mp4" : "v2-original-12.mp4");
    expect(await page.locator("#lab-video").evaluate((v:HTMLVideoElement) => v.paused)).toBe(true);
    await page.locator("#lab-start").click();
    await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(.2);
    await page.locator("#fade-duration").evaluate((el:HTMLInputElement) => {
      el.value = "6"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
    });
    await expect(page.locator("#lab-start")).toBeEnabled();
    await expect(page.locator("#fade-value")).toHaveText("1.000 秒");
    await expect(page.locator("#lab-source")).toContainText(variant === "xfade" ? "v2-trim-24.mp4" : "v2-original-24.mp4");
    await expect.poll(async () => (await data()).fadeSeconds).toBe(1);
    await expect.poll(async () => (await data()).gameTime).toBeGreaterThan(.3);
    expect(await page.locator("#lab-video").evaluate((v:HTMLVideoElement) => v.duration)).toBeCloseTo((variant === "xfade" ? 160-24 : 190-24)/24,2);
    expect(await page.locator("video").count()).toBe(1);
    await page.locator("#fade-duration").evaluate((el:HTMLInputElement) => {
      el.value = "0"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
    });
    await expect(page.locator("#lab-start")).toBeEnabled();
    await expect(page.locator("#fade-value")).toHaveText("0.000 秒");
    await expect(page.locator("#lab-source")).toContainText(variant === "xfade" ? "l03_candy_001_v2_trim.mp4" : "l03_candy_001_v2.mp4");
    await page.locator("#fade-duration").evaluate((el:HTMLInputElement) => {
      el.value = "2"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
    });
    await expect(page.locator("#lab-start")).toBeEnabled();
    await page.locator("#variant").selectOption(variant === "xfade" ? "original-fade" : "xfade");
    await expect(page.locator("#lab-start")).toBeEnabled();
    await expect(page.locator("#lab-source")).toContainText(variant === "xfade" ? "original_xfade" : "001_v2_xfade");
    expect(errors).toEqual([]);
  });
}

test("only fade lab is exposed and it defaults to the selected original fade", async ({page}) => {
  await page.goto("?videoTest=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#variant")).toHaveValue("original-fade");
  await expect(page.locator("#profile")).toHaveCount(0);
  await expect(page.locator("#horizon")).toHaveValue("0.41");
  await expect(page.locator("#nearHalfWidth")).toHaveValue("0.64");
  await expect(page.locator("#speed")).toHaveValue("5");
  await expect(page.locator("a[href*=hybridTest],a[href*=transitionTest]")).toHaveCount(0);
  await page.screenshot({path:"test-results/fade-slider.png",fullPage:true});
  for (const oldRoute of ["hybridTest", "transitionTest"]) {
    await page.goto(`?${oldRoute}=1`);
    await expect(page.getByRole("heading",{name:/動起來/})).toBeVisible();
    await expect(page.locator("#poc-world,#tr-world")).toHaveCount(0);
  }
});
