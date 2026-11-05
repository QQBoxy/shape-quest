import { test, expect } from "@playwright/test";

for (const [query, selector] of [
  ["backgroundRoad=1&faceTest=1&videoTest=1", "#br-stage"],
  ["faceTest=1&videoTest=1", "#lab-camera"],
  ["videoTest=1", "#lab-world"],
  ["unknown=1", "#home-panel"],
]) {
  test(`entry selects the correct page for ${query}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`./?${query}`);
    await expect(page.locator(selector)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("road URL parameters reject invalid values and clamp numeric limits", async ({ page }) => {
  await page.goto("./?backgroundRoad=1&scene=unknown&aspect=unknown&fit=unknown&lane=unknown&zoom=999&vpY=-1&speed=NaN&color=invalid&videoPaused=true");
  await expect(page.locator("#scene")).toHaveValue("lollipop");
  await expect(page.locator("#aspect")).toHaveValue("landscape");
  await expect(page.locator("#fit")).toHaveValue("cover");
  await expect(page.locator("#lane")).toHaveValue("all");
  await expect(page.locator("#zoom")).toHaveValue("3");
  await expect(page.locator("#vpY")).toHaveValue("0.1");
  await expect(page.locator("#speed")).toHaveValue("6");
  await expect(page.locator("#color")).toHaveValue("#ffffff");
});
