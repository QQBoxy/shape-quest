import { test, expect } from "@playwright/test";
test("scene selector preserves lollipop presets and loads the full gingerbread fade", async ({ page }) => {
  await page.goto("./?videoTest=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#scene")).toHaveValue("lollipop");
  await page.locator("#scene").selectOption("gingerbread");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText("l03_candy_002_original_xfade.mp4");
  await expect(page.locator("#fade-duration")).toBeEnabled();
  await page.locator("#fade-duration").evaluate((el: HTMLInputElement) => {
    el.value = "3"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText("fades/002-original-12.mp4");
  await expect(page.locator("#fade-value")).toHaveText("0.500 秒");
  await page.locator("#fade-duration").evaluate((el: HTMLInputElement) => {
    el.value = "2"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#lab-start")).toBeEnabled();
  expect(await page.locator("#variant option[value=trim]").evaluate((o: HTMLOptionElement) => o.disabled)).toBe(true);
  expect(await page.locator("video").count()).toBe(1);
  expect(await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.duration)).toBeCloseTo(182 / 24, 2);
  await page.locator("#variant").selectOption("original");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText("l03_candy_002.mp4");
  await page.locator("#scene").selectOption("lollipop");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#fade-duration")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText("l03_candy_001_v2_original_xfade.mp4");
});


test("pure video viewing hides gameplay feedback without replacing the player", async ({ page }) => {
  await page.goto("./?videoTest=1&scene=gingerbread&overlay=0");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-overlay")).not.toBeChecked();
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "hidden");
  expect(await page.locator("video").count()).toBe(1);
  await page.screenshot({ path: "docs/video-tests/l03-candy-002/pure-video-page.png", fullPage: false });
  await page.locator("#lab-overlay").check();
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "visible");
});
