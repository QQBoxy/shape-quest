import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

test("actual model initializes on synthetic camera but does not falsely pass calibration", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        setInterval(() => {
          ctx.fillStyle = "#93bda4";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#fff";
          ctx.fillRect(Date.now() % 600, 20, 10, 10);
        }, 50);
        return canvas.captureStream(20);
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "開啟鏡頭，開始冒險" }).click();
  await page.locator("#choose-body").click();
  await expect(page.locator("#calibration-panel")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator("#calibration-message")).toContainText(
    "找不到完整身體",
    { timeout: 15000 },
  );
  await expect(page.locator("#begin-camera")).toBeHidden();
  await expect(page.locator("#calibration-title")).toHaveText("先擺好手機");
  await page.getByRole("button", { name: "回首頁", exact: true }).click();
  expect(
    await page
      .locator("#camera")
      .evaluate((video: HTMLVideoElement) => video.srcObject),
  ).toBeNull();
  expect(errors).toEqual([]);
});

test("cancelled permission request stops a late stream and never opens calibration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const stream = canvas.captureStream();
        (window as unknown as { lateStream: MediaStream }).lateStream = stream;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return stream;
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "開啟鏡頭，開始冒險" }).click();
  await page.locator("#choose-body").click();
  await page.getByRole("button", { name: "回首頁", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { lateStream: MediaStream }
          ).lateStream.getTracks()[0].readyState,
      ),
    )
    .toBe("ended");
  await expect(page.locator("#calibration-panel")).toBeHidden();
  expect(
    await page
      .locator("#camera")
      .evaluate((video: HTMLVideoElement) => video.srcObject),
  ).toBeNull();
});

test("local video is muted, fixed-speed, loops, pauses with the clock and falls back on decode error", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("./");
  await page
    .locator("#video-file")
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/background.mp4", import.meta.url)),
    );
  await expect(page.locator("#background-label")).toContainText("候選素材");
  const state = () =>
    page.locator("#background").evaluate((v: HTMLVideoElement) => ({
      muted: v.muted,
      loop: v.loop,
      rate: v.playbackRate,
      paused: v.paused,
      ready: v.readyState,
    }));
  await expect
    .poll(async () => (await state()).ready)
    .toBeGreaterThanOrEqual(2);
  expect(await state()).toMatchObject({
    muted: true,
    loop: true,
    rate: 1,
    paused: false,
  });
  await page.getByRole("button", { name: "無鏡頭開始玩" }).click();
  await expect.poll(async () => (await state()).paused).toBe(true);
  await page.clock.runFor(3100);
  await expect.poll(async () => (await state()).paused).toBe(false);
  await page.getByRole("button", { name: "選單", exact: true }).click();
  await expect.poll(async () => (await state()).paused).toBe(true);
  await page
    .locator("#video-file")
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/background.mp4", import.meta.url)),
    );
  await expect(page.locator("#video-file")).toBeEnabled();
  await expect
    .poll(async () => (await state()).ready)
    .toBeGreaterThanOrEqual(2);
  expect(await state()).toMatchObject({ paused: true, muted: true, rate: 1 });
  await page.getByRole("button", { name: "結束探險" }).click();
  await page.locator("#video-file").setInputFiles({
    name: "invalid.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("invalid video fixture"),
  });
  await expect(page.locator("#toast")).toContainText("影片無法播放");
  await expect
    .poll(() =>
      page
        .locator("#background")
        .evaluate((v: HTMLVideoElement) => v.getAttribute("src")),
    )
    .toBeNull();
  await expect(
    page.getByRole("button", { name: "開啟鏡頭，開始冒險" }),
  ).toBeVisible();
});
