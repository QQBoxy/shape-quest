import { test, expect } from "@playwright/test";
for (const [scene, stem] of [["lollipop", "l03_candy_001_poc_72f19161"], ["chocolate", "l03_candy_003_poc_9ab4f711"], ["gummy", "l03_candy_004_poc_36c9edb4"], ["cotton-candy", "l03_candy_005_poc_e7e3ab4a"]]) {
  test(`${scene} is selected before a fixed 120-second game with the shared projection`, async ({ page }) => {
    const now = new Date("2026-11-01T00:00:00Z");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.goto("./");
    await page.locator("#scene-choice").selectOption(scene);
    await expect(page.locator("#start-manual")).toBeEnabled();
    const video = page.locator("#background");
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain(`${stem}_original_xfade.mp4`);
    expect(await video.evaluate((v: HTMLVideoElement) => ({ rate: v.playbackRate, loop: v.loop, muted: v.muted }))).toEqual({ rate: 1, loop: true, muted: true });
    await page.screenshot({ path: `test-results/candy-kingdom/${scene}-home.png` });
    await page.locator("#menu-toggle").click();
    await page.locator(".menu-tools summary").click();
    await page.locator("#debug-toggle").click();
    await page.locator("#menu-close").click();
    await page.locator("#start-manual").click();
    await expect(page.locator("#scene-choice")).toBeDisabled();
    await page.clock.runFor(3100);
    await expect(page.locator("#timer")).toHaveText("120 秒");
    await expect(page.locator("#debug")).toContainText("消失點 0.5,0.45 · 道路半寬 0.5");
    for (const [ms, key] of [[4500, "ArrowUp"], [4000, "ArrowDown"], [4000, "ArrowLeft"], [4000, "ArrowRight"]] as const) {
      await page.clock.runFor(ms);
      await page.keyboard.press(key);
    }
    await page.clock.runFor(200);
    await expect(page.locator("#score")).toHaveText("0400");
    await page.screenshot({ path: `test-results/candy-kingdom/${scene}-playing.png` });
    await page.locator("#menu-toggle").click();
    const time = await page.locator("#timer").textContent();
    await page.clock.runFor(2000);
    await expect(page.locator("#timer")).toHaveText(time!);
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.locator("#menu-close").click();
    await page.clock.runFor(3300);
    await expect(page.locator("#countdown")).toBeHidden();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain(`${stem}_original_xfade.mp4`);
    await page.locator("#menu-toggle").click();
    await page.locator("#exit").click();
    await expect(page.locator("#scene-choice")).toBeEnabled();
    await expect(page.locator("#scene-choice")).toHaveValue(scene);
    expect(await page.locator("#background").count()).toBe(1);
    await page.locator("#menu-toggle").click();
    await expect(page.getByRole("link", { name: "影片整合測試 ↗" })).toHaveAttribute("href", "?videoTest=1");
  });
}
