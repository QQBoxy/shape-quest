import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("native loop keeps the loaded video visible while the decoder seeks", async ({ page }) => {
  test.setTimeout(110000);
  const reports = [];
  for (const [scene, variant] of [["cotton-candy", "original-fade"], ["cotton-candy", "original"], ["lollipop", "original-fade"], ["gummy", "original-fade"], ["gummy", "original"], ["chocolate", "original-fade"], ["chocolate", "original"], ["lollipop", "original"]]) {
    await page.goto(`./?videoTest=1&scene=${scene}&variant=${variant}`);
    await expect(page.locator("#lab-start")).toBeEnabled();
    await page.locator("#lab-start").click();
    const result = await page.evaluate(() => new Promise<{
      frames: number; loops: number; fallbackFrames: { media: number; readyState: number; rgba: number[] }[];
    }>(resolve => {
      const video = document.querySelector<HTMLVideoElement>("#lab-video")!;
      const canvas = document.querySelector<HTMLCanvasElement>("#lab-world")!;
      const start = performance.now();
      const data = { frames: 0, loops: 0, fallbackFrames: [] as { media: number; readyState: number; rgba: number[] }[] };
      let previous = video.currentTime;
      function sample(now: number) {
        const media = video.currentTime;
        if (previous - media > video.duration / 2) data.loops++;
        previous = media;
        const rgba = Array.from(canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data);
        if (rgba[3] === 255 && rgba[0] < 200 && rgba[1] > 200) data.fallbackFrames.push({ media, readyState: video.readyState, rgba });
        data.frames++;
        if (now - start >= 9500) resolve(data);
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
    reports.push({ scene, variant, ...result });
  }
  await mkdir("docs/video-tests/l03-candy-005-v2", { recursive: true });
  await writeFile("docs/video-tests/l03-candy-005-v2/loop-fallback.json", JSON.stringify(reports, null, 2) + "\n");
  for (const result of reports) {
    expect(result.loops).toBeGreaterThanOrEqual(1);
    expect(result.fallbackFrames).toEqual([]);
  }
});
