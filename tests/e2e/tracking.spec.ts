import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`camera stays visible through calibration and tracking recovery ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await page.addInitScript(() => {
      (window as any).testPose = "standing";
      (window as any).cameraRequests = [];
      Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
        value: async () => [{ kind: "videoinput", deviceId: "ultra-wide", label: "後方超廣角鏡頭" }],
      });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (constraints: MediaStreamConstraints) => {
          (window as any).cameraRequests.push(constraints);
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          setInterval(() => {
            canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
          }, 50);
          return canvas.captureStream(20);
        },
      });
    });
    // Exercise the actual app state machine with deterministic landmark samples.
    await page.route(/\/assets\/pose-[^/]+\.js$/, (route) => route.fulfill({
      contentType: "text/javascript",
      body: `export class PoseTracker {
        async load() {} close() {}
        sample() {
          const action = window.testPose;
          if (action === 'missing') return [];
          const p = Array.from({length: 33}, () => ({x: .5, y: .5, visibility: 1}));
          p[0].y = .1;
          for (const [i, x, y] of [[11,.43,.3],[12,.57,.3],[23,.43,.55],[24,.57,.55],[25,.43,.73],[26,.57,.73],[27,.43,.9],[28,.57,.9]]) p[i] = {x,y,visibility:1};
          if (action === 'left' || action === 'right') for (const v of p) v.x += action === 'left' ? -.15 : .15;
          if (action === 'returned') {
            for (const v of p) v.x += .07;
            p[23].y = p[24].y = .59;
            p[11].y = p[12].y = .33;
            p[27].visibility = p[28].visibility = .1;
          }
          if (action === 'jump') { p[23].y = p[24].y = .47; p[27].y = p[28].y = .84; }
          if (action === 'duck') {
            p[23].y = p[24].y = .67; p[11].y = p[12].y = .43;
            p[25].x = .25; p[26].x = .75;
          }
          if (action === 'occluded-duck') {
            p[23].y = p[24].y = .67; p[11].y = p[12].y = .43;
            for (const i of [25,26,27,28]) p[i].visibility = .1;
          }
          return p;
        }
      }`,
    }));
    await page.goto("./");
    if (viewport.width === 844) {
      await page.getByRole("button", { name: "選單", exact: true }).click();
      await page.locator(".camera-settings summary").click();
      await page.locator("#camera-choice").selectOption("rear");
      await page.getByRole("button", { name: "關閉選單" }).click();
    }
    await page.getByRole("button", { name: "開啟鏡頭，開始冒險" }).click();
  await page.locator("#choose-body").click();
    await expect(page.locator("#calibration-panel")).toBeVisible();
    const pose = async (value: string, ms: number) => {
      await page.evaluate((v) => { (window as any).testPose = v; }, value);
      await page.clock.runFor(ms);
    };
    const unobstructedCamera = async () => {
      const camera = (await page.locator("#camera-preview").boundingBox())!;
      for (const selector of ["#menu-toggle", "#fullscreen", "#tracking", "#hud", "#cue"]) {
        if (!await page.locator(selector).isVisible()) continue;
        const control = (await page.locator(selector).boundingBox())!;
        expect(
          camera.x + camera.width <= control.x || control.x + control.width <= camera.x ||
          camera.y + camera.height <= control.y || control.y + control.height <= camera.y,
          `${selector} must stay outside the camera preview`,
        ).toBe(true);
      }
    };
    const separate = async (panel: string) => {
      const camera = (await page.locator("#camera-preview").boundingBox())!;
      const text = (await page.locator(panel).boundingBox())!;
      expect(camera.width).toBeGreaterThan(viewport.width * .45);
      expect(camera.height).toBeGreaterThan(viewport.height * .35);
      expect(camera.x + camera.width <= text.x || camera.y + camera.height <= text.y).toBe(true);
      expect(camera.y).toBeGreaterThanOrEqual(0);
      expect(text.y + text.height).toBeLessThanOrEqual(viewport.height);
    };
    await separate("#calibration-panel");
    await unobstructedCamera();
    await page.screenshot({ path: `test-results/calibration-${viewport.width}.png` });
    await pose("standing", 2300);
    await expect(page.locator("#start-calibration")).toBeVisible();
    await expect(page.locator("#calibration-title")).toHaveText("先擺好手機");
    await page.locator("#start-calibration").click();
    await pose("standing", 2300);
    for (const action of ["left", "right", "duck", "jump"]) {
      await pose(action, 150);
      await expect(page.locator("#calibration-title")).toHaveText("動作成功，回中央站好");
      await expect(page.locator("#calibration-message")).toContainText("已辨識");
      await pose("returned", 400);
      await expect(page.locator("#calibration-title")).not.toHaveText("動作成功，回中央站好");
    }
    await expect(page.locator("#begin-camera")).toBeVisible();
    await pose("standing", 100);
    await page.locator("#begin-camera").click();
    await page.clock.runFor(3300);
    await expect(page.locator("#camera-preview")).toBeVisible();
    await unobstructedCamera();
    // Also check a portrait camera source in a landscape viewport.
    await page.locator("#camera").evaluate((video: HTMLVideoElement) => {
      Object.defineProperty(video, "videoWidth", { value: 480, configurable: true });
      Object.defineProperty(video, "videoHeight", { value: 640, configurable: true });
    });
    await page.clock.runFor(150);
    await unobstructedCamera();
    await page.screenshot({ path: `test-results/camera-clear-${viewport.width}.png` });
    await pose("occluded-duck", 2000);
    await expect(page.locator("#dialog")).toBeHidden();
    await pose("missing", 250);
    await expect(page.locator("#dialog")).toBeHidden();
    await pose("standing", 400);
    await expect(page.locator("#dialog")).toBeHidden();
    await page.getByRole("button", { name: "選單", exact: true }).click();
    await page.locator("#preview-toggle").click();
    await page.getByRole("button", { name: "關閉選單" }).click();
    await expect(page.locator("#camera-preview")).toBeHidden();
    await pose("missing", 1800);
    await expect(page.locator("#dialog-title")).toHaveText("等你回到畫面裡");
    await expect(page.locator("#camera-preview")).toBeVisible();
    await separate("#dialog");
    await unobstructedCamera();
    await page.screenshot({ path: `test-results/recovery-${viewport.width}.png` });
    const timer = await page.locator("#timer").textContent();
    await page.clock.runFor(2000);
    await expect(page.locator("#timer")).toHaveText(timer!);
    await pose("standing", 900);
    await expect(page.locator("#dialog")).toBeHidden();
    await expect(page.locator("#countdown")).toBeVisible();
    await expect(page.locator("#camera-preview")).toBeHidden();
    await pose("standing", 24000);
    await expect(page.locator("#restart")).toBeVisible();
    const oldStream = await page.locator("#camera").evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).id);
    await page.locator("#restart").click();
    await pose("standing", 4200);
    await expect(page.locator("#countdown")).toBeHidden();
    await expect(page.locator("#dialog")).toBeHidden();
    await expect(page.locator("#timer")).toHaveText("59 秒");
    await expect(page.locator("#calibration-panel")).toBeHidden();
    await expect(page.locator("#hud")).toBeVisible();
    expect(await page.locator("#camera").evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).id)).toBe(oldStream);
    if (viewport.width === 844) {
      expect(await page.evaluate(() => (window as any).cameraRequests[0].video.facingMode)).toEqual({ exact: "environment" });
      await page.getByRole("button", { name: "選單", exact: true }).click();
      await page.locator("#camera-choice").selectOption("device:ultra-wide");
      await expect(page.locator("#calibration-title")).toHaveText("先擺好手機");
      await expect(page.locator("#start-calibration")).toBeVisible();
      expect(await page.evaluate(() => (window as any).cameraRequests.at(-1).video.deviceId)).toEqual({ exact: "ultra-wide" });
    }
  });
}
