import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 667, height: 320 },
  { width: 568, height: 280 },
  { width: 320, height: 568 },
]) {
  test(`home fills the viewport and keeps utilities in the menu ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.getByRole("heading", { name: /動起來/ })).toBeVisible();
    const bounds = (await page.locator("#stage").boundingBox())!;
    expect(bounds).toEqual({ x: 0, y: 0, ...viewport });
    expect(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))).toEqual(viewport);
    const start = (await page.locator("#start-camera").boundingBox())!;
    expect(start.y).toBeGreaterThan(0);
    expect(start.y + start.height).toBeLessThan(viewport.height);
    const header = (await page.locator(".site-header").boundingBox())!;
    const panel = (await page.locator("#home-panel").boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height + 12);
    expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    for (const selector of ["#home-panel h2", "#start-camera", "#start-manual"]) {
      const item = (await page.locator(selector).boundingBox())!;
      expect(item.y, `${selector} stays below the logo and controls`).toBeGreaterThanOrEqual(panel.y);
      expect(item.y + item.height, `${selector} stays inside the screen`).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.locator("#fullscreen")).toBeVisible();
    const menuButton = (await page.locator("#menu-toggle").boundingBox())!;
    const fullscreenButton = (await page.locator("#fullscreen").boundingBox())!;
    expect(menuButton.x).toBeLessThanOrEqual(24);
    expect(viewport.width - fullscreenButton.x - fullscreenButton.width).toBeLessThanOrEqual(24);
    expect(menuButton.y).toBeLessThanOrEqual(24);
    expect(fullscreenButton.y).toBeLessThanOrEqual(24);
    await expect(page.locator("#debug-toggle")).toBeHidden();
    await expect(page.getByRole("link", { name: /影片整合測試/ })).toBeHidden();
    await page.screenshot({ path: `test-results/game-home-${viewport.width}.png` });
    await page.getByRole("button", { name: "選單", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "冒險選單" })).toBeVisible();
    await expect(page.locator("#fullscreen")).toBeVisible();
    await page.locator(".menu-tools > summary").click();
    await expect(page.locator("#debug-toggle")).toBeVisible();
    await expect(page.getByRole("link", { name: /影片整合測試/ })).toBeVisible();
    await page.screenshot({ path: `test-results/game-menu-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await expect(page.locator("#game-menu")).not.toBeVisible();
    await expect(page.locator("#menu-toggle")).toBeFocused();
    await expect(page.locator("#game-menu #fullscreen")).toHaveCount(0);
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
      await expect(page.locator("#cue")).toBeVisible({ timeout: 10000 });
      const ratio = await page.locator("#world").evaluate((canvas: HTMLCanvasElement) => canvas.width / canvas.height);
      expect(ratio).toBeCloseTo(16 / 9, 2);
      await expect(page.locator("#world")).toHaveCSS("object-fit", "contain");
      await page.screenshot({ path: "test-results/game-playing-portrait.png" });
    }
  });
}
