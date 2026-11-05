import { test, expect } from "@playwright/test";
import { CANDY_SCENES } from "../../src/scenes";

test("approved originals and baked fades replace all retired trim variants", async ({ page }) => {
  await page.goto("?videoTest=1");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#variant option")).toHaveCount(2);
  await expect(page.locator("#horizon")).toHaveValue("0.45");
  await expect(page.locator("#nearHalfWidth")).toHaveValue("0.5");
  await expect(page.locator("#speed")).toHaveValue("5");
  await expect(page.locator("#lab-grid")).not.toBeChecked();
  await expect(page.locator("#lab-source")).toContainText(CANDY_SCENES.lollipop.stem + "_original_xfade.mp4");
  for (const step of [0,1,2,3,4,5,6]) {
    await page.locator("#fade-duration").evaluate((el: HTMLInputElement, step) => {
      el.value = String(step); el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change"));
    }, step);
    await expect(page.locator("#lab-start")).toBeEnabled();
    const duration = await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.duration);
    expect(duration).toBeCloseTo(step ? (190-step*4)/24 : 7.93,2);
  }
  await page.locator("#variant").selectOption("original");
  await expect(page.locator("#lab-start")).toBeEnabled();
  await expect(page.locator("#fade-duration")).toBeDisabled();
  await expect(page.locator("#lab-source")).toContainText(CANDY_SCENES.lollipop.stem + ".mp4");
  for (const oldRoute of ["hybridTest", "transitionTest"]) {
    await page.goto(`?${oldRoute}=1`);
    await expect(page.getByRole("heading", { name: /動起來/ })).toBeVisible();
  }
});
