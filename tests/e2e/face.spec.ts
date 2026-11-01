import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`mode picker defers camera and disables hands ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      (window as any).requests = 0;
      navigator.mediaDevices.getUserMedia = async () => { (window as any).requests++; throw new Error("unexpected camera request"); };
    });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await expect(page.locator("#mode-picker")).toBeVisible();
    await expect(page.locator("#choose-body")).toBeEnabled();
    await expect(page.locator("#choose-face")).toBeEnabled();
    await expect(page.locator("#choose-hand")).toBeDisabled();
    expect(await page.evaluate(() => (window as any).requests)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/mode-picker-${viewport.width}.png`, fullPage: true });
    await page.locator("#mode-home").click();
    await expect(page.locator("#home-panel")).toBeVisible();
  });
}

test("face lessons, all 11 game actions, energy, nonblocking tracking loss and replay share the core", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => {
    (window as any).testFace = "neutral";
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => requestFrame(function frame(now) {
      if ((window as any).holdGameFrames) requestFrame(frame);
      else callback(now);
    });
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480;
      setInterval(() => c.getContext("2d")!.fillRect(0,0,640,480), 50);
      return c.captureStream(20);
    };
  });
  await page.route(/\/assets\/face-(?!actions-|test-)[^/]+\.js$/, route => route.fulfill({
    contentType: "text/javascript", body: `export class FaceTracker {
      async load() {} close() {} sample() {
        const a = window.testFace;
        const f = { x:.65,y:.35,size:.3,roll:0,yaw:0,pitch:0,jaw:.05,lipGap:.005,browDownLeft:.05,browDownRight:.08,upperLipLeft:.02,upperLipRight:.02,smileLeft:.1,smileRight:.1,eyeLeft:.04,eyeRight:.04,eyesValid:true,browInner:.02,browLeft:.02,browRight:.02,browsValid:true,blinkLeft:.65,blinkRight:.65,apertureLeft:.045,apertureRight:.045 };
        if (a === 'missing') return {points:[],features:null};
        if (a === 'translate') { f.x -= .09; f.y -= .09; }
        if (a === 'jump') f.pitch -= 12;
        if (a === 'duck') f.pitch += 12;
        if (a === 'left') f.yaw += 12;
        if (a === 'right') f.yaw -= 12;
        if (['pose_t','open'].includes(a)) f.jaw = .75;
        if (a === 'pose_lunge') f.roll = 22;
        if (a === 'pose_knee') f.roll = -22;
        if (a === 'pose_side_bend') { f.smileLeft = .7; f.smileRight = .35; f.jaw = .3; f.upperLipLeft = .2; f.upperLipRight = .15; }
        if (a === 'pose_side_bend_soft') { f.smileLeft = f.smileRight = .33; f.jaw = .25; }
        if (a === 'pose_tree' || a === 'closed_smile') { f.jaw = .05; f.lipGap = .005; f.smileLeft = .7; f.smileRight = .35; }
        if (a === 'pose_t_with_turn') { f.jaw = .75; f.lipGap = .1; f.yaw = -12; }
        if (a === 'slightly_open') { f.jaw = .04; f.lipGap = .045; }
        if (a === 'left_relaxed') f.yaw = 2.5;
        if (a === 'smile_relaxed') { f.smileLeft = .18; f.smileRight = .15; }
        if (a === 'pose_arms_l') { f.eyeLeft = f.eyeRight = .075; f.browInner = f.browLeft = f.browRight = .18; }
        return {points:[],features:f};
      }
    }`,
  }));
  const pose = async (value: string, ms = 650) => {
    await page.evaluate(v => { (window as any).testFace = v; }, value);
    await page.clock.runFor(ms);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./"); await page.locator("#start-camera").click(); await page.locator("#choose-face").click();
  await expect(page.locator("#calibration-panel")).toBeVisible();
  await expect(page.locator("#face-demo")).toHaveCount(0);
  await expect(page.locator("#calibration-title")).toBeHidden();
  await expect(page.locator("#calibration-steps")).toBeHidden();
  await expect(page.locator("#calibration-summary")).toBeVisible();
  const buttonsShareRow = async () => {
    const buttons = await page.locator(".calibration-actions > button:visible").evaluateAll(elements => elements.map(e => {
      const box = e.getBoundingClientRect(); return { center: box.y + box.height / 2, width: box.width };
    }));
    expect(buttons).toHaveLength(3);
    expect(Math.max(...buttons.map(b => b.center)) - Math.min(...buttons.map(b => b.center))).toBeLessThan(1);
  };
  await buttonsShareRow();
  await page.screenshot({ path: "test-results/face-calibration-mobile-ready.png" });
  await page.locator("#start-calibration").click(); await pose("neutral", 2300);
  await page.screenshot({ path: "test-results/face-calibration-mobile.png" });
  const panel = (await page.locator("#calibration-panel").boundingBox())!;
  for (const selector of ["#calibration-summary", ".calibration-actions"]) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(panel.y);
    expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
  }
  await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /上仰/);
  await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /動作幅度.*維持進度/);
  const stableLayout = await page.locator("#camera-preview").boundingBox();
  await pose("translate", 800);
  expect(await page.locator("#camera-preview").boundingBox()).toEqual(stableLayout);
  await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /上仰/);
  await pose("neutral", 250);
  await page.setViewportSize({ width: 844, height: 390 });
  await pose("neutral", 50);
  await page.screenshot({ path: "test-results/face-calibration-landscape.png" });
  const cancel = (await page.locator("#cancel-calibration").boundingBox())!;
  expect(cancel.y + cancel.height).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1512, height: 862 });
  await pose("neutral", 50);
  await page.locator("#recalibrate").click();
  await pose("neutral", 50);
  await buttonsShareRow();
  expect((await page.locator("#start-calibration").boundingBox())!.width).toBeLessThan(300);
  await page.screenshot({ path: "test-results/face-calibration-desktop.png" });
  await page.locator("#start-calibration").click();
  await pose("neutral", 2300);
  expect(await page.locator("#pose-preview").evaluate((c: HTMLCanvasElement) => c.width >= c.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  const actions = ["jump","duck","left","right","pose_t","pose_lunge","pose_knee","pose_arms_l","pose_side_bend","pose_tree","smash"];
  for (const action of actions) {
    if (action === "smash") {
      for (let i = 0; i < 3; i++) { await pose("open", 450); await pose("neutral", 450); }
    } else if (action === "left") {
      await pose(action, 800); await pose("left_relaxed", 250);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /向右轉頭/);
      await expect(page.locator("#calibration-message")).toContainText("接下來");
      continue;
    } else if (action === "pose_side_bend") {
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /露齒微笑/);
      await pose("neutral", 1300); await page.screenshot({path:"test-results/face-demo-smile.png"});
      await pose(action,180); await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /微笑 保持住/);
      await pose(action,620); await pose("smile_relaxed",250);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /自然閉嘴巴/);
      continue;
    } else if (action === "pose_tree") {
      // Already closed when the lesson starts: never issue an OPEN pose to pass it.
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /自然閉嘴巴/);
      await page.screenshot({path:testInfo.outputPath("face-demo-closed-mouth.png")});
      await pose("neutral",450);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /連續張嘴、閉嘴/);
      continue;
    } else if (action === "pose_lunge") {
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /頭往左歪/);
      const straight = await page.locator("#pose-preview").evaluate((c: HTMLCanvasElement) => c.toDataURL());
      await pose("neutral", 300);
      expect(await page.locator("#pose-preview").evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(straight);
      await page.screenshot({ path: "test-results/face-demo-starts-neutral.png" });
      await pose("neutral", 1000);
      expect(await page.locator("#pose-preview").evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(straight);
      await page.screenshot({ path: "test-results/face-camera-left-tilt-demo.png" });
      await pose(action, 180);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /歪頭 (?:保持住 ✓|.*%)/);
      await page.screenshot({ path: "test-results/face-camera-left-tilt-feedback.png" });
      await pose(action, 620);
    } else if (action === "pose_arms_l") {
      await pose(action, 180);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /睜眼、眉毛輕抬/);
      await page.screenshot({ path: "test-results/face-camera-gentle-eye-brow.png" });
      await pose(action, 620);
      await pose("neutral", 250);
      await expect(page.locator("#pose-preview")).toHaveAttribute("aria-label", /露齒微笑/);
      continue;
    } else await pose(action, 800);
    await pose("neutral", 250);
  }
  await expect(page.locator("#begin-camera")).toBeVisible();
  await page.screenshot({ path: "test-results/face-lessons-complete.png" });
  await page.locator("#begin-camera").click(); await page.clock.runFor(3000);
  await expect(page.locator("#mode-label")).toHaveText("臉部模式");
  let elapsed = 0;
  const advance = async (ms: number) => { await page.clock.runFor(ms); elapsed += ms; };
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const collision = 5000 + 4000*i + (action === "smash" ? 3000 : 0);
    const start = collision - (action === "smash" ? 5200 : 2800);
    // Keep the previous unrelated action held through the next prompt.
    await pose(action === "pose_t" ? "right" : action === "pose_tree" ? "closed_smile" : "neutral", 0);
    await advance(start - elapsed);
    if (action === "smash") {
      await expect(page.locator("#face-progress")).toBeVisible();
      for (let j = 0; j < 3; j++) {
        await pose("open", 500); elapsed += 500;
        await pose("neutral", 500); elapsed += 500;
        if (j === 1) {
          await expect(page.locator("#face-progress-label")).toContainText("2／3");
          await page.setViewportSize({ width: 390, height: 844 });
          const power = (await page.locator("#face-progress").boundingBox())!;
          for (const selector of ["#hud", "#tracking", "#camera-preview", "#cue"]) {
            const box = (await page.locator(selector).boundingBox())!;
            expect(power.x + power.width <= box.x || box.x + box.width <= power.x ||
              power.y + power.height <= box.y || box.y + box.height <= power.y, selector).toBe(true);
          }
          await page.screenshot({ path: "test-results/face-smash-mobile.png" });
          await page.setViewportSize({ width: 1280, height: 800 });
          await page.screenshot({ path: "test-results/face-smash-energy.png" });
        }
      }
    } else if (action === "pose_tree") {
      await pose("closed_smile",500); elapsed += 500;
    } else if (action === "pose_side_bend") {
      await pose(action,150); await pose(`${action}_soft`,650); elapsed += 800;
    } else {
      await pose(action === "pose_t" ? "pose_t_with_turn" : action, action.startsWith("pose_") ? 800 : 430);
      elapsed += action.startsWith("pose_") ? 800 : 430;
    }
    await expect(page.locator("#cue")).toContainText("動作已完成");
    await expect(page.locator("#score")).toHaveText(String(i*100).padStart(4,"0"));
    // Relax (or lose tracking) well before collision; completion stays on this obstacle.
    await pose(i === 0 ? "missing" : "neutral", 0);
    await advance(collision + 150 - elapsed);
    await expect(page.locator("#score")).toHaveText(String((i+1)*100).padStart(4,"0"));
    await pose("neutral", 0);
  }
  const timer = await page.locator("#timer").textContent();
  await pose("missing", 1800);
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#timer")).not.toHaveText(timer!);
  await pose("neutral", 1000);
  await expect(page.locator("#countdown")).toBeHidden();
  await page.clock.runFor(30000);
  await expect(page.locator("#restart")).toBeVisible();
  await page.evaluate(() => { (window as any).holdGameFrames = true; });
  await page.clock.runFor(1000);
  await page.locator("#restart").click();
  await page.evaluate(() => { (window as any).holdGameFrames = false; });
  await pose("neutral", 4200);
  await expect(page.locator("#countdown")).toBeHidden();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#timer")).toHaveText("59 秒");
  await expect(page.locator("#calibration-panel")).toBeHidden();
  await expect(page.locator("#mode-label")).toHaveText("臉部模式");
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.locator("#exit").click(); await expect(page.locator("#home-panel")).toBeVisible();
  expect(await page.locator("#camera").evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
  expect(errors).toEqual([]);
});

test("real Face Landmarker loads locally and rejects an empty webcam", async ({ page, request }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480;
      setInterval(() => { const ctx = c.getContext("2d")!; ctx.fillStyle = "#b9c4db"; ctx.fillRect(0,0,640,480); }, 50);
      return c.captureStream(20);
    };
  });
  await page.goto("./");
  expect((await request.head("models/face_landmarker.task")).ok()).toBe(true);
  await page.locator("#start-camera").click(); await page.locator("#choose-face").click();
  await expect(page.locator("#calibration-panel")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("#start-calibration")).toHaveText("坐好了，開始校正");
  await page.screenshot({ path: "test-results/face-calibration-desktop-ready.png" });
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await page.locator(".menu-help > summary").click();
  await expect(page.locator(".menu-moves")).toContainText("6 秒內完成 3 次");
  await page.getByRole("button", { name: "關閉選單" }).click();
  await page.locator("#start-calibration").click();
  await expect(page.locator("#calibration-message")).toContainText("請讓整張臉入鏡", { timeout: 15000 });
  await expect(page.locator("#begin-camera")).toBeHidden();
  await page.screenshot({ path: "test-results/face-outline-guide.png" });
  await page.locator("#cancel-calibration").click();
  expect(errors).toEqual([]);
});
