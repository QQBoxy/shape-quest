import { expect, test } from "@playwright/test";

test("diagnostic page learns rotation, tolerates position changes and exports numerical data locally", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => {
    (window as any).labPose = "neutral";
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480;
      setInterval(() => c.getContext("2d")!.fillRect(0, 0, 640, 480), 50);
      return c.captureStream(20);
    };
  });
  await page.route(/\/assets\/face-(?!actions-|test-)[^/]+\.js$/, route => route.fulfill({
    contentType: "text/javascript", body: `export class FaceTracker {
      async load() {} close() {} sample() {
        if (window.labPose === 'missing') return {points:[],features:null};
        return {points:[],features:{x:window.labPose==='left'?.2:.65,y:.35,size:.3,roll:7,
          yaw:window.labPose==='left'?33:21,pitch:-17,jaw:.08,lipGap:window.labPose==='slightly_open'?.045:.005,eyeLeft:.04,eyeRight:.05,
          eyesValid:true,browInner:.02,browLeft:.02,browRight:.02,browsValid:true,
          blinkLeft:.65,blinkRight:.65,apertureLeft:.045,apertureRight:.045,smileLeft:window.labPose==='closed_smile'?.7:.1,smileRight:window.labPose==='closed_smile'?.4:.12,browDownLeft:.05,browDownRight:.08,upperLipLeft:.02,upperLipRight:.02}};
      }
    }`,
  }));
  const pose = async (value: string, ms: number) => {
    await page.evaluate(v => { (window as any).labPose = v; }, value); await page.clock.runFor(ms);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?faceTest=1");
  await expect(page.getByRole("heading", { name: "臉部 Webcam 診斷", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#lab-start").click(); await expect(page.locator("#lab-calibrate")).toBeEnabled();
  await pose("neutral", 500); await page.locator("#lab-calibrate").click(); await pose("neutral", 2000);
  await page.locator("#lab-action").selectOption("left");
  await page.locator("#lab-learn").click(); await pose("left", 2000); await pose("neutral", 500);
  await expect(page.locator("#lab-parts")).toContainText("觸發 7.800");
  await page.locator("#lab-record").click(); await pose("left", 1200);
  await expect(page.locator("#lab-state")).toContainText("累計觸發 1");
  await pose("missing", 800); await expect(page.locator("#lab-quality")).toContainText("追蹤失效");
  await pose("left", 1000); await expect(page.locator("#lab-state")).toContainText("累計觸發 1");
  await pose("neutral", 700); await pose("left", 700);
  await expect(page.locator("#lab-state")).toContainText("累計觸發 2");
  await page.locator("#lab-record").click();
  const downloaded = page.waitForEvent("download"); await page.locator("#lab-export").click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("shape-quest-face-diagnostics.json");
  const file = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of file!) chunks.push(Buffer.from(chunk));
  const data = JSON.parse(Buffer.concat(chunks).toString());
  expect(data.records.length).toBeGreaterThan(0);
  expect(data.baseline.yaw).toBe(21); expect(data.baseline.x).toBeUndefined();
  expect(data.thresholds.left[0].learned).toBe(12);
  expect(data.baseline.browDownLeft).toBe(.05);
  expect(data.records[0].features.apertureLeft).toBe(.045);
  await expect(page.locator("#lab-values")).toContainText("browDownLeft");
  await expect(page.locator("#lab-values")).toContainText("mouthUpperUpLeft");
  await expect(page.locator("#lab-action")).toContainText("自然閉嘴巴");
  expect(JSON.stringify(data)).not.toContain('"points"');
  await page.screenshot({ path: "test-results/face-diagnostics-mobile.png", fullPage: true });
  await page.locator("#lab-action").selectOption("pose_tree");
  await pose("left",450); await expect(page.locator("#lab-state")).toContainText("累計觸發 3");
  await pose("slightly_open",0);
  await page.locator("#lab-action").selectOption("left");
  await page.locator("#lab-action").selectOption("pose_tree");
  await pose("slightly_open",600); await expect(page.locator("#lab-state")).toContainText("累計觸發 3");
  await pose("closed_smile",450); await expect(page.locator("#lab-state")).toContainText("累計觸發 4");
  await expect(page.locator("#lab-parts")).toContainText("lipGap");
  await page.locator("#lab-stop").click();
  expect(await page.locator("#lab-video").evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
  expect(errors).toEqual([]);
});

test("real Face Landmarker diagnostic page refuses an empty webcam baseline", async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480;
      setInterval(() => c.getContext("2d")!.fillRect(0, 0, 640, 480), 50);
      return c.captureStream(20);
    };
  });
  await page.goto("./?faceTest=1"); await page.locator("#lab-start").click();
  await expect(page.locator("#lab-calibrate")).toBeEnabled({ timeout: 60000 });
  await page.locator("#lab-calibrate").click();
  await expect(page.locator("#lab-baseline-progress")).toHaveJSProperty("value", 1, { timeout: 15000 });
  await expect(page.locator("#lab-message")).toContainText("資料不足");
  await expect(page.locator("#lab-state")).toContainText("未校正");
  await expect(page.locator("#lab-learn")).toBeDisabled();
  await page.locator("#lab-stop").click();
});
