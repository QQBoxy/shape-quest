import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    const state = { angle: 0, type: "portrait-primary" };
    Object.assign(window, { testOrientation: state, testAction: "neutral" });
    Object.defineProperties(screen.orientation, { angle: { get: () => state.angle }, type: { get: () => state.type } });
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 480;
      Object.assign(window, { testCameraCanvas: c });
      setInterval(() => c.getContext("2d")!.fillRect(0,0,c.width,c.height),50);
      return c.captureStream(20);
    };
  });
}
async function turn(page: Page, angle: number) {
  await page.setViewportSize(angle % 180 ? {width:844,height:390} : {width:390,height:844});
  await page.evaluate(angle => {
    Object.assign((window as any).testOrientation, { angle, type: angle === 0 ? "portrait-primary" : angle === 90 ? "landscape-primary" : "landscape-secondary" });
    screen.orientation.dispatchEvent(new Event("change"));
  },angle);
}
async function action(page: Page, value: string, ms = 700) {
  await page.evaluate(v => { (window as any).testAction = v; },value);
  await page.clock.runFor(ms);
}

test("face lessons survive both landscape sides and the camera uses the available height", async ({page}, info) => {
  await setup(page); await page.setViewportSize({width:390,height:844});
  await page.route(/\/assets\/face-(?!actions-|test-)[^/]+\.js$/,route=>route.fulfill({contentType:"text/javascript",body:`
    export class FaceTracker {async load(){} close(){} sample(){
      return {points:[],features:{x:.65,y:.35,size:.3,roll:0,yaw:0,pitch:window.testAction==='jump'?-12:window.testAction==='duck'?12:0,
        jaw:.05,lipGap:.005,eyeLeft:.04,eyeRight:.04,eyesValid:true,blinkLeft:.05,blinkRight:.05,
        apertureLeft:.2,apertureRight:.2,browInner:.02,browLeft:.02,browRight:.02,browsValid:true}};
    }}
  `}));
  await page.goto("./"); await page.locator("#start-camera").click(); await page.locator("#choose-face").click();
  await page.locator("#start-calibration").click(); await action(page,"neutral",2300);
  await expect(page.locator("#calibration-summary")).toHaveText("校正進度 2 / 12");
  for (const angle of [90,270]) {
    await turn(page,angle); await action(page,"neutral",650);
    const camera = (await page.locator("#camera-preview").boundingBox())!;
    const panel = (await page.locator("#calibration-panel").boundingBox())!;
    expect(camera.height).toBeGreaterThan(250); expect(camera.width).toBeGreaterThan(400);
    if (angle === 90) expect(camera.x+camera.width).toBeLessThanOrEqual(panel.x);
    else expect(panel.x+panel.width).toBeLessThanOrEqual(camera.x);
    await expect(page.locator("#calibration-summary")).toHaveText("校正進度 2 / 12");
    await expect(page.locator("#start-calibration")).toBeHidden();
    await page.screenshot({path:info.outputPath(`face-landscape-${angle}.png`)});
  }
  await action(page,"jump"); await action(page,"neutral",300);
  await expect(page.locator("#calibration-summary")).toHaveText("校正進度 3 / 12");
  await page.locator("#menu-toggle").click(); await page.locator(".camera-settings summary").click();
  await page.locator("#swap-camera-side").click(); await page.locator("#menu-close").click();
  await expect(page.locator("body")).toHaveAttribute("data-camera-side","left");
  await expect(page.locator("#calibration-summary")).toHaveText("校正進度 3 / 12");
  await action(page,"duck"); await action(page,"neutral",300);
  await expect(page.locator("#calibration-summary")).toHaveText("校正進度 4 / 12");
});

test("body gameplay pauses only during rotation and automatically resumes the existing calibration", async ({page}) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await setup(page); await page.setViewportSize({width:390,height:844});
  await page.route(/\/assets\/pose-[^/]+\.js$/,route=>route.fulfill({contentType:"text/javascript",body:`
    export class PoseTracker {fps=18; inferenceMs=0; async load(){} close(){} sample(video){
      const a=window.testAction,p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));p[0].y=.1;
      for(const [i,x,y] of [[11,.43,.3],[12,.57,.3],[23,.43,.55],[24,.57,.55],[25,.43,.73],[26,.57,.73],[27,.43,.9],[28,.57,.9]]) p[i]={x,y,visibility:1};
      if(a==='left'||a==='right')for(const v of p)v.x+=a==='left'?-.15:.15;
      if(a==='jump'){p[23].y=p[24].y=.47;p[27].y=p[28].y=.84;}
      if(a==='duck'){p[23].y=p[24].y=.67;p[11].y=p[12].y=.43;p[25].x=.25;p[26].x=.75;}
      for(const v of p){v.x=.5+(v.x-.5)*640/video.videoWidth;v.y=.5+(v.y-.5)*480/video.videoHeight;}
      return p;
    }}
  `}));
  await page.goto("./"); await page.locator("#start-camera").click(); await page.locator("#choose-body").click();
  await page.locator("#menu-toggle").click(); await page.locator(".menu-tools summary").click();
  await page.locator("#debug-toggle").click(); await page.locator("#menu-close").click();
  await page.locator("#start-calibration").click(); await action(page,"neutral",3000);
  for (const move of ["left","right","duck","jump"]) { await action(page,move,300); await action(page,"neutral",450); }
  await expect(page.locator("#begin-camera")).toBeVisible();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await page.locator("#begin-camera").click(); await action(page,"neutral",3300);
  for (const angle of [90,270,0]) {
    await turn(page,angle); await page.clock.runFor(150);
    await expect(page.locator("#dialog-title")).toHaveText("正在調整畫面方向");
    const time = await page.locator("#timer").textContent();
    await page.clock.runFor(150); await expect(page.locator("#timer")).toHaveText(time!);
    await action(page,"neutral",550);
    await expect(page.locator("#dialog")).toBeHidden();
    await expect(page.locator("#calibration-panel")).toBeHidden();
    await expect(page.locator("#countdown")).toBeHidden();
  }
  // Exercise actual stream metadata changing, with the same physical distances.
  await turn(page,90);
  await page.evaluate(() => {
    const c = (window as any).testCameraCanvas as HTMLCanvasElement;
    c.width=480; c.height=640; c.getContext("2d")!.fillRect(0,0,480,640);
  });
  await page.clock.runFor(200); // Submit fresh capture frames with the new dimensions.
  await expect.poll(() => page.locator("#camera").evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(480);
  await action(page,"neutral",700);
  await expect(page.locator("#dialog")).toBeHidden();
  const band = await page.locator("#pose-preview").evaluate((c: HTMLCanvasElement) =>
    Array.from(c.getContext("2d")!.getImageData(260,17,1,1).data));
  expect(band[1]).toBeGreaterThan(band[0]);
  expect(band[1]).toBeGreaterThan(30);
  const gameTime = Number((await page.locator("#debug").textContent())?.match(/\bt=([\d.]+)/)?.[1]);
  expect(gameTime).toBeLessThan(4.45);
  await page.clock.runFor(Math.round((4.45-gameTime)*1000));
  await action(page,"jump",200); await page.clock.runFor(650);
  await expect(page.locator("#score")).toHaveText("0100");
  await page.keyboard.press("Escape");
  const pausedTime = await page.locator("#timer").textContent();
  await turn(page,270); await action(page,"neutral",700);
  await expect(page.locator("#resume")).toBeVisible();
  await expect(page.locator("#timer")).toHaveText(pausedTime!);
  await page.locator("#resume").click(); await action(page,"neutral",3300);
  await expect(page.locator("#dialog")).toBeHidden();
  expect(errors).toEqual([]);
});
