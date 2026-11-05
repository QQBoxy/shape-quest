import { test, expect } from "@playwright/test";
for (const [scene, prefix, fadePrefix] of [["lollipop", "001_poc_72f19161", "001-"], ["chocolate", "003_poc_9ab4f711", "003-"], ["gummy", "004_poc_36c9edb4", "004-"], ["cotton-candy", "005_poc_e7e3ab4a", "005-"]]) {
test(`${scene} selector preserves lollipop presets and loads the full original fade`, async ({ page }) => {
  await page.goto("./?videoTest=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#scene")).toHaveValue("lollipop");
  await page.locator("#scene").selectOption(scene);
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText(`l03_candy_${prefix}_original_xfade.mp4`);
  await expect(page.locator("#fade-duration")).toBeEnabled();
  await page.locator("#fade-duration").evaluate((el: HTMLInputElement) => {
    el.value = "3"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText(`fades/${fadePrefix}original-12.mp4`);
  await expect(page.locator("#fade-value")).toHaveText("0.500 秒");
  await page.locator("#fade-duration").evaluate((el: HTMLInputElement) => {
    el.value = "2"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#variant option[value=trim],#variant option[value=xfade]")).toHaveCount(0);
  expect(await page.locator("video").count()).toBe(1);
  expect(await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.duration)).toBeCloseTo(182 / 24, 2);
  await page.locator("#variant").selectOption("original");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText(`l03_candy_${prefix}.mp4`);
  await page.locator("#scene").selectOption("lollipop");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#fade-duration")).toBeEnabled();
  await expect(page.locator("#lab-source")).toContainText("l03_candy_001_poc_72f19161_original_xfade.mp4");
});
}

test("pure video viewing hides gameplay feedback without replacing the player", async ({ page }) => {
  await page.goto("./?videoTest=1&scene=chocolate&overlay=0");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#lab-overlay")).not.toBeChecked();
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "hidden");
  expect(await page.locator("video").count()).toBe(1);
  await page.screenshot({ path: "test-results/candy-kingdom/regression/pure-video-page.png", fullPage: false });
  await page.locator("#lab-overlay").check();
  await expect(page.locator("#lab-world")).toHaveCSS("visibility", "visible");
});


test("candy menus share the ordered scenes and cotton candy deep links load the full fade", async ({ page }) => {
  const ids = ["lollipop", "chocolate", "gummy", "cotton-candy"];
  const labels = ["棒棒糖森林", "巧克力河流", "果凍軟糖城鎮", "棉花糖天空"];
  await page.goto("./?scene=cotton-candy");
  await expect(page.locator("#start-manual")).toBeEnabled();
  await expect(page.locator("#scene-choice")).toHaveValue("cotton-candy");
  await expect(page.locator("#scene-choice optgroup option")).toHaveText(labels);
  expect(await page.locator("#scene-choice optgroup option").evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).toEqual(ids);
  await page.goto("./?videoTest=1&scene=cotton-candy&variant=trim");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#scene")).toHaveValue("cotton-candy");
  await expect(page.locator("#scene option")).toHaveText(labels);
  expect(await page.locator("#scene option").evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).toEqual(ids);
  await expect(page.locator("#variant")).toHaveValue("original-fade");
  await expect(page.locator("#lab-source")).toContainText("l03_candy_005_poc_e7e3ab4a_original_xfade.mp4");
});
