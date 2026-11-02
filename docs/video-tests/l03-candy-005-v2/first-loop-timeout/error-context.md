# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: background-loop.spec.ts >> native loop keeps the loaded video visible while the decoder seeks
- Location: tests/e2e/background-loop.spec.ts:3:1

# Error details

```
Test timeout of 110000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 110000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f7e2]:
  - banner [ref=f7e3]:
    - link "奇形狀 SHAPE QUEST / VIDEO LAB" [ref=f7e4] [cursor=pointer]:
      - /url: ./
      - text: 奇形狀
      - generic [ref=f7e5]: SHAPE QUEST / VIDEO LAB
    - link "回到遊戲 ↗" [ref=f7e6] [cursor=pointer]:
      - /url: ./
  - main [ref=f7e7]:
    - generic [ref=f7e8]: PHASE 1 · SINGLE-CLIP INTEGRATION
    - heading "糖果王國背景場景比較" [level=1] [ref=f7e9]
    - paragraph [ref=f7e10]: 棒棒糖森林大道／巧克力湖畔／果凍軟糖城／棉花糖森林 · 候選素材，搭配道路格線與障礙物驗證 · 單一 HTML5 Video 播放器。
    - generic [ref=f7e11]:
      - generic [ref=f7e12]:
        - text: 背景場景
        - combobox "背景場景" [ref=f7e13]:
          - option "棒棒糖森林大道" [selected]
          - option "巧克力湖畔"
          - option "果凍軟糖城"
          - option "棉花糖森林"
      - generic [ref=f7e14]:
        - text: 測試版本
        - combobox "測試版本" [ref=f7e15]:
          - option "原始影片＋淡化"
          - option "剪輯＋淡化"
          - option "原始影片（無淡化基準）" [selected]
          - option "接點剪輯（無淡化基準）"
      - generic [ref=f7e16]:
        - text: 淡化秒數
        - status "淡化秒數 0.333 秒" [ref=f7e17]: 無淡化基準
        - slider "淡化秒數" [disabled] [ref=f7e18]: "2"
      - button "開始 120 秒測試" [active] [ref=f7e19] [cursor=pointer]
      - button "暫停" [ref=f7e20] [cursor=pointer]
      - button "匯出紀錄" [ref=f7e21] [cursor=pointer]
    - region "影片合成測試" [ref=f7e22]:
      - generic [ref=f7e25]: 有效播放 1.9 / 120 秒 · 遊戲時鐘 1.96 · 循環 0
      - generic [ref=f7e26]: 等待測試障礙
      - status [ref=f7e27]: 測試中 · 120 秒後會標記達標並繼續播放。
    - generic [ref=f7e28]:
      - generic [ref=f7e29]:
        - checkbox "顯示遊戲疊加（障礙物／判定回饋）" [checked] [ref=f7e30]
        - text: 顯示遊戲疊加（障礙物／判定回饋）
      - generic [ref=f7e31]:
        - text: 消失點 X
        - slider "消失點 X" [ref=f7e32]: "0.5"
      - generic [ref=f7e33]:
        - text: 消失點 Y
        - slider "消失點 Y" [ref=f7e34]: "0.41"
      - generic [ref=f7e35]:
        - text: 道路底部半寬
        - slider "道路底部半寬" [ref=f7e36]: "0.64"
      - generic [ref=f7e37]:
        - text: 固定虛擬速度
        - slider "固定虛擬速度" [ref=f7e38]: "5"
      - generic [ref=f7e39]:
        - checkbox "顯示道路格線／接地點" [checked] [ref=f7e40]
        - text: 顯示道路格線／接地點
    - paragraph [ref=f7e41]: 來源：l03_candy_001_v2.mp4 · 1280×720 · 實際片長 7.930 秒 · 1.0x · muted / playsInline / loop
    - paragraph [ref=f7e42]: 糖果王國各場景預設使用完整原片＋8 影格交叉淡化（0.333 秒），也可選原片比較。首尾交叉淡化可調整為 0～1 秒，每格約 0.167 秒，預設 0.333 秒。淡化預先合成進影片，調整秒數並放開滑桿後套用；播放中會重新開始這輪比較。原始＋淡化不做接點剪輯；剪輯＋淡化沿用既有接點剪輯。循環片長會依首尾重疊秒數縮短，可能看見殘影或景物換位，請直接比較播放效果。
    - paragraph [ref=f7e43]: 工程測試可跑 10 分鐘，使用較高生命值以持續出題；失敗照常記錄，不模擬玩家成功。↑／↓／←／→ 可測試動作判定。暫停與倒數不計入有效遊玩時間。改變幾何設定會開始新一輪紀錄。
    - generic [ref=f7e44]:
      - generic [ref=f7e45]:
        - heading "播放與遊戲時鐘" [level=2] [ref=f7e46]
        - generic [ref=f7e47]: 原始影片 · 7.93 秒（含音軌、強制靜音） 畫面回呼 45 · 最大間隔 66.8 ms >250 ms 間隔 0 · waiting 0 · stalled 0 成功 0 · 失敗 0（不自動通關） 消失點 (0.500, 0.410) · 道路半寬 0.64 · 固定速度 5.0
        - group [ref=f7e48]:
          - generic "完整 JSON 紀錄" [ref=f7e49]
      - generic [ref=f7e50]:
        - heading "每次循環接點" [level=2] [ref=f7e51]
        - paragraph [ref=f7e52]: 像素差為 320×180 縮圖的 0–255 MAE；數值低不保證運動連續。縮圖依序為循環前／後。
        - table [ref=f7e54]:
          - rowgroup [ref=f7e55]:
            - row [ref=f7e56]:
              - columnheader "循環" [ref=f7e57]
              - columnheader "有效秒數" [ref=f7e58]
              - columnheader "影格間隔 ms" [ref=f7e59]
              - columnheader "道路 MAE" [ref=f7e60]
              - columnheader "前／後" [ref=f7e61]
          - rowgroup
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { mkdir, writeFile } from "node:fs/promises";
  3  | test("native loop keeps the loaded video visible while the decoder seeks", async ({ page }) => {
  4  |   test.setTimeout(110000);
  5  |   const reports = [];
  6  |   for (const [scene, variant] of [["cotton-candy", "original-fade"], ["cotton-candy", "original"], ["lollipop", "original-fade"], ["gummy", "original-fade"], ["gummy", "original"], ["chocolate", "original-fade"], ["chocolate", "original"], ["lollipop", "original"]]) {
  7  |     await page.goto(`./?videoTest=1&scene=${scene}&variant=${variant}`);
  8  |     await expect(page.locator("#lab-start")).toBeEnabled();
  9  |     await page.locator("#lab-start").click();
> 10 |     const result = await page.evaluate(() => new Promise<{
     |                               ^ Error: page.evaluate: Test timeout of 110000ms exceeded.
  11 |       frames: number; loops: number; fallbackFrames: { media: number; readyState: number; rgba: number[] }[];
  12 |     }>(resolve => {
  13 |       const video = document.querySelector<HTMLVideoElement>("#lab-video")!;
  14 |       const canvas = document.querySelector<HTMLCanvasElement>("#lab-world")!;
  15 |       const start = performance.now();
  16 |       const data = { frames: 0, loops: 0, fallbackFrames: [] as { media: number; readyState: number; rgba: number[] }[] };
  17 |       let previous = video.currentTime;
  18 |       function sample(now: number) {
  19 |         const media = video.currentTime;
  20 |         if (previous - media > video.duration / 2) data.loops++;
  21 |         previous = media;
  22 |         const rgba = Array.from(canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data);
  23 |         if (rgba[3] === 255 && rgba[0] < 200 && rgba[1] > 200) data.fallbackFrames.push({ media, readyState: video.readyState, rgba });
  24 |         data.frames++;
  25 |         if (now - start >= 9500) resolve(data);
  26 |         else requestAnimationFrame(sample);
  27 |       }
  28 |       requestAnimationFrame(sample);
  29 |     }));
  30 |     reports.push({ scene, variant, ...result });
  31 |   }
  32 |   await mkdir("docs/video-tests/l03-candy-005-v2", { recursive: true });
  33 |   await writeFile("docs/video-tests/l03-candy-005-v2/loop-fallback.json", JSON.stringify(reports, null, 2) + "\n");
  34 |   for (const result of reports) {
  35 |     expect(result.loops).toBeGreaterThanOrEqual(1);
  36 |     expect(result.fallbackFrames).toEqual([]);
  37 |   }
  38 | });
  39 | 
```