import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "docs/video-tests/candy-v2-fade";
for (const variant of ["original-fade", "original", "trim", "xfade"])
  test(`${variant}: real-time 120-second native loop`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?videoTest=1");
    await page.locator("#variant").selectOption(variant);
    await expect(page.locator("#lab-start")).toBeEnabled({ timeout: 20000 });
    await page.locator("#lab-start").click();
    // No page.clock or playback acceleration: decoded source runs in real wall time.
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await page.locator("#video-metrics").textContent()) || "{}",
          ).activeSeconds,
        { timeout: 145000, intervals: [1000] },
      )
      .toBeGreaterThanOrEqual(120);
    await page.locator("#lab-pause").click();
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await page.locator("#video-metrics").textContent()) || "{}",
          ).gamePhase,
      )
      .toBe("paused");
    const report = JSON.parse(
      (await page.locator("#video-metrics").textContent()) || "{}",
    );
    await mkdir(output, { recursive: true });
    await writeFile(
      `${output}/${variant}-120s.json`,
      JSON.stringify(
        {
          ...report,
          testedAt: new Date().toISOString(),
          testEnvironment:
            "Desktop Playwright Chromium, single serial test page, real wall time; not mobile",
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    await page.screenshot({
      path: `${output}/${variant}-120s.png`,
      fullPage: true,
    });
    expect(report.muted).toBe(true);
    expect(report.playsInline).toBe(true);
    expect(report.loop).toBe(true);
    expect(report.rate).toBe(1);
    expect(report.loops.length).toBeGreaterThanOrEqual(
      Math.floor(120 / report.duration) - 1,
    );
    expect(report.gameTime).toBeGreaterThan(115);
    expect(report.frameCount).toBeGreaterThan(2400);
    expect(report.successes).toBe(0);
    expect(report.misses).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
