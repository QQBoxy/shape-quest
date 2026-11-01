import { test, expect } from "@playwright/test";
test("subpath assets, keyboard round, pause and restart", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => requestFrame(function frame(now) {
      if ((window as any).holdGameFrames) requestFrame(frame);
      else callback(now);
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /動起來/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  for (const path of [
    "models/pose_landmarker_lite.task",
    "wasm/vision_wasm_internal.wasm",
    "wasm/vision_wasm_internal.js",
  ]) {
    const response = await request.head(path);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).not.toContain("text/html");
  }
  await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
  await expect(page.locator("#mode-label")).toHaveText("無鏡頭模式");
  await expect(page.locator("#hearts .heart[data-fill=\"1\"]")).toHaveCount(3);
  await page.clock.runFor(7800);
  await page.keyboard.press("ArrowUp");
  await page.clock.runFor(100);
  await expect(page.locator("#score")).toHaveText("0100");
  await expect(page.locator("#hearts .heart[data-fill=\"1\"]")).toHaveCount(3);
  await page.getByRole("button", { name: "選單", exact: true }).click();
  const timer = await page.locator("#timer").innerText();
  await page.clock.runFor(10000);
  await expect(page.locator("#timer")).toHaveText(timer);
  await page.getByRole("button", { name: "關閉選單" }).click();
  await page.clock.runFor(25000);
  await expect(page.getByRole("button", { name: "再冒險一次" })).toBeVisible();
  await expect(page.locator("#dialog-body")).toContainText("無鏡頭模式結束");
  // A results screen can stop receiving frames while its tab is inactive.
  await page.evaluate(() => { (window as any).holdGameFrames = true; });
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "再冒險一次" }).click();
  await page.evaluate(() => { (window as any).holdGameFrames = false; });
  await page.clock.runFor(4200);
  await expect(page.locator("#countdown")).toBeHidden();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#timer")).toHaveText("59 秒");
  await expect(page.locator("#score")).toHaveText("0000");
  await expect(page.locator("#hearts .heart[data-fill=\"1\"]")).toHaveCount(3);
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.getByRole("button", { name: "結束探險" }).click();
  await expect(page.getByRole("heading", { name: /動起來/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test("camera denial is actionable and allows retry/home", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "開啟鏡頭，開始冒險" }).click();
  await page.locator("#choose-body").click();
  await expect(page.locator("#dialog-body")).toContainText(
    "尚未取得攝影機權限",
  );
  await expect(
    page.getByRole("button", { name: "重新開啟鏡頭" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "回首頁", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "開啟鏡頭，開始冒險" }),
  ).toBeVisible();
});
test("mobile layout, debug and fullscreen fallback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: undefined,
    });
  });
  await page.goto("./");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.locator(".menu-tools > summary").click();
  await page.getByRole("button", { name: "校正格線" }).click();
  await expect(page.locator("#debug")).toBeVisible();
  await page.getByRole("button", { name: "關閉選單" }).click();
  await page.getByRole("button", { name: "全螢幕" }).click();
  await expect(page.locator("body")).toHaveClass(/css-fullscreen/);
  await page.getByRole("button", { name: "離開全螢幕" }).click();
  await expect(page.locator("body")).not.toHaveClass(/css-fullscreen/);
  await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("mobile swipes play all four actions without a camera", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const startTime = new Date("2026-11-01T00:00:00Z");
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => { throw new Error("Manual mode requested camera"); };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
  await page.clock.runFor(200);
  await expect(page.locator("#manual-hint")).toBeVisible();
  await expect(page.locator("#stage")).toHaveCSS("touch-action", "none");
  const client = await context.newCDPSession(page);
  const swipe = async (dx: number, dy: number, cancel = false) => {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x: 195, y: 420 }],
    });
    if (cancel) {
      await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      return;
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x: 195 + dx, y: 420 + dy }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(0, -80); // Countdown ignores input.
  await page.clock.runFor(7400);
  await swipe(0, -10); // A tap or tiny movement is not a jump.
  await swipe(0, -80, true);
  await page.clock.runFor(100);
  await expect(page.locator("#score")).toHaveText("0000");
  await swipe(0, -80);
  await page.clock.runFor(100);
  await expect(page.locator("#score")).toHaveText("0100");
  for (const [dx, dy, score] of [[0, 80, "0200"], [-80, 0, "0300"], [80, 0, "0400"]] as const) {
    await page.clock.runFor(3900);
    await swipe(dx, dy);
    await page.clock.runFor(100);
    await expect(page.locator("#score")).toHaveText(score);
  }
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "剩餘 3 顆愛心");
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
  await page.screenshot({ path: "test-results/manual-mobile.png" });
  await page.clock.runFor(4400); // Four successes at full health must not prefill the next lost heart.
  await expect(page.locator("#hearts .heart").nth(2)).toHaveAttribute("data-fill", "0");
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "剩餘 2 顆愛心，下一顆補血進度 0／3");
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await expect(page.locator("#manual-hint")).toBeHidden();
  await swipe(0, -80);
  await page.clock.runFor(5000);
  await expect(page.locator("#score")).toHaveText("0400");
  expect(errors).toEqual([]);
  await context.close();
});

test("empty hearts fill in thirds and recovery survives a miss", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const startTime = new Date("2026-11-01T00:00:00Z");
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto("./");
  await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
  const hearts = page.locator("#hearts .heart");
  await page.clock.runFor(8200); // Miss the first obstacle.
  await expect(hearts.nth(2)).toHaveAttribute("data-fill", "0");
  await page.clock.runFor(3400);
  await page.keyboard.press("ArrowDown");
  await page.clock.runFor(100);
  await expect(hearts.nth(2)).toHaveAttribute("data-fill", String(1 / 3));
  await page.clock.runFor(3900);
  await page.keyboard.press("ArrowLeft");
  await page.clock.runFor(400);
  await expect(hearts.nth(2)).toHaveAttribute("data-fill", String(2 / 3));
  await page.screenshot({ path: "test-results/heart-two-thirds-mobile.png" });
  await page.clock.runFor(4100); // Miss the fourth obstacle; progress moves to the next empty heart.
  await expect(hearts.nth(0)).toHaveAttribute("data-fill", "1");
  await expect(hearts.nth(1)).toHaveAttribute("data-fill", String(2 / 3));
  await expect(hearts.nth(2)).toHaveAttribute("data-fill", "0");
  await page.clock.runFor(3500);
  await page.keyboard.press("ArrowUp");
  await page.clock.runFor(400);
  await expect(hearts.nth(1)).toHaveAttribute("data-fill", "1");
  await expect(hearts.nth(2)).toHaveAttribute("data-fill", "0");
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "剩餘 2 顆愛心，下一顆補血進度 0／3");
  await expect(page.locator("#recovery-stars")).toHaveCount(0);
});
