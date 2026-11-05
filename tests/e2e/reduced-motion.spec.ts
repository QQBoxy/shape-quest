import { test, expect } from "@playwright/test";

test("cached animation preferences update live without losing heart progress", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const time = new Date("2026-11-01T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    Object.assign(window, { heartAnimations: 0 });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(keyframes, options) {
      if (this.matches("#hearts .heart")) (window as any).heartAnimations++;
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto("./");
  await page.locator("#start-manual").click();
  const heart = page.locator("#hearts .heart").nth(2);
  let elapsed = 0;
  const at = async (ms: number, key?: string) => {
    await page.clock.runFor(ms - elapsed);
    if (key) await page.keyboard.press(key);
    // Advance beyond the HUD's 100ms refresh while the virtual clock is paused.
    await page.clock.runFor(400);
    elapsed = ms + 400;
  };
  await at(8200); // Miss, then restore one heart with three successes.
  await expect(heart).toHaveAttribute("data-fill", "0");
  await at(11600, "ArrowDown");
  await at(15600, "ArrowLeft");
  await at(19600, "ArrowRight");
  await expect(heart).toHaveAttribute("data-fill", "1");
  expect(await page.evaluate(() => (window as any).heartAnimations)).toBe(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await at(24200);
  await expect(heart).toHaveAttribute("data-fill", "0");
  await at(27600, "ArrowDown");
  await at(31600, "ArrowLeft");
  await at(35600, "ArrowRight");
  await expect(heart).toHaveAttribute("data-fill", "1");
  expect(await page.evaluate(() => (window as any).heartAnimations)).toBe(1);
  await expect(page.locator("#score")).toHaveText("0600");
});
