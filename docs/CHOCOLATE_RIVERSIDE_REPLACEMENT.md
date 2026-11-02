# 巧克力河畔場景替換（2026-11-02）

已從正式遊戲與 Video Lab 移除薑餅村莊選項，改為巧克力河畔（scene=chocolate）。棒棒糖及草原保留。舊薑餅原片、衍生素材與驗證紀錄仍留作歷史存檔，沒有列入目前場景選單。

根目錄素材已搬至：

- 原片：public/videos/level-03/l03_candy_003.mp4
- 參考圖：public/references/level-03/l03_candy_003_reference.png
- 標準淡化版：public/videos/level-03/l03_candy_003_original_xfade.mp4

原片影像為 1280×720、24 FPS、190 影格；影像長 7.916667 秒，含 AAC 的容器長 7.93 秒。原始內容保留且搬移前後 SHA-256 一致。沿用既有 FFmpeg 完整原片＋8 影格首尾交叉淡化，輸出 182 影格、7.583333 秒、24 FPS、無音軌 H.264/yuv420p/faststart。另已產生滑桿使用的 4、12、16、20、24 影格版本。

正式遊戲沿用 120 秒回合與相同糖果道路參數，沒有修改 MediaPipe、Game Clock、障礙規則或循環顯示判斷。

重建：node scripts/prepare-candy-video.mjs --chocolate；滑桿素材另加 --fade-presets。

正式入口：http://127.0.0.1:5173/shape-quest/?scene=chocolate
影片比較：http://127.0.0.1:5173/shape-quest/?videoTest=1&scene=chocolate&overlay=0
若伺服器未啟動，先在專案執行 npm run dev。

建置與 TypeScript 通過，影片及滑桿輸出規格已用 ffprobe 驗證。接點縮圖仍可見短暫景物雙像。

## 補跑瀏覽器驗證（2026-11-02）

重新建置後執行以下指令，全數通過；本次沒有修改遊戲或測試程式。

```sh
npm run build
npm run test:e2e
npm run test:video -- tests/video-integration/chocolate.spec.ts tests/video-integration/candy-game.spec.ts
```

- E2E：31 項通過，約 4.4 分鐘。包含場景選擇、淡化滑桿、原生循環無草原備援畫面、暫停／恢復及既有玩法回歸。
- 長測：4 項通過，約 9.5 分鐘；單一 worker 依序執行，原生影片 1.0x、實際牆鐘時間，沒有加速時鐘。
- 本次未重跑先前已通過的 112 項單元測試。

| 場景／模式 | 實際牆鐘秒數 | 遊戲秒數 | 循環次數 | 影片影格數 | 最長循環影格間隔 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 巧克力河畔 Video Lab | 120.641 | 120.645 | 15 | 2879 | 216.7 ms |
| 棒棒糖 Video Lab | 120.616 | 120.595 | 15 | 2884 | 83.4 ms |
| 巧克力河畔正式遊戲 | 127.839 | 120 | 15 | 2864 | 75.0 ms |
| 棒棒糖正式遊戲 | 131.315 | 120 | 15 | 2877 | 74.7 ms |

兩組 Video Lab 的四種鍵盤動作、暫停／恢復及暫停 seek 不改變 Game Clock 均通過；stalled 與超過 250 ms 的影格間隔皆為 0。巧克力最長 waiting 約 167.7 ms，棒棒糖約 30.5 ms。循環仍有短暫等待，本結果不代表視覺接點完全無感。

兩組正式遊戲均完成 29 次成功、0 次失敗，手動暫停、追蹤中斷／恢復及重玩保留場景均通過。stalled、草原備援影格、背景來源切換及頁面錯誤皆為 0；牆鐘時間包含暫停與恢復倒數。測試使用可見桌面 Chromium、真實 MediaPipe 模型在合成空白攝影機影像上推論，再注入合成骨架動作，並非真人 Webcam 驗收。

原始數據與截圖：

- [巧克力 Video Lab](video-tests/l03-candy-003/chocolate-120s.json)／[截圖](video-tests/l03-candy-003/chocolate-120s.png)
- [棒棒糖 Video Lab](video-tests/l03-candy-003/lollipop-120s.json)／[截圖](video-tests/l03-candy-003/lollipop-120s.png)
- [巧克力正式遊戲](game-tests/chocolate-riverside/chocolate-120s-game.json)／[截圖](game-tests/chocolate-riverside/chocolate-120s-game.png)
- [棒棒糖正式遊戲](game-tests/chocolate-riverside/lollipop-120s-game.json)／[截圖](game-tests/chocolate-riverside/lollipop-120s-game.png)

真人 Webcam、手機、平板及電視投放仍待驗收。先前薑餅村莊的通過紀錄僅保留為歷史存檔。
