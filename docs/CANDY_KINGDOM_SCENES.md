# 糖果王國場景整合（2026-11-02）

四個糖果王國背景已完成配置：棒棒糖森林大道、巧克力湖畔、果凍軟糖城、棉花糖森林 v2。它們屬於同一個世界，場景順序不代表關卡或難度；每局仍固定一個所選背景，同局自動輪播尚未決定。

棉花糖森林使用本次提供的 v2 素材，搬移前後 SHA-256 一致，見 [來源清單](video-tests/l03-candy-005-v2/source-manifest.json)；[原片 ffprobe 紀錄](video-tests/l03-candy-005-v2/source-probe.json)另存。已沿用既有腳本新增標準淡化與滑桿版本，工程驗證與人工視覺驗收分開記錄。

## 場景 ID、順序與素材

影片目錄為 `public/videos/level-03/`，參考圖目錄為 `public/references/level-03/`。穩定 ID 與素材編號分開管理；薑餅保留使用過的 002 編號，因此果凍使用 004，不能用清單索引推算素材路徑。

| 順序 | 名稱／英文 | ID | 原片 | 標準淡化版 | 參考圖 |
| --- | --- | --- | --- | --- | --- |
| 1 | 棒棒糖森林大道／Lollipop Forest Avenue | `lollipop` | `l03_candy_001_v2.mp4` | `l03_candy_001_v2_original_xfade.mp4` | `l03_candy_001_v2_reference.png` |
| 2 | 巧克力湖畔／Chocolate Lakeside | `chocolate` | `l03_candy_003.mp4` | `l03_candy_003_original_xfade.mp4` | `l03_candy_003_reference.png` |
| 3 | 果凍軟糖城／Gummy Jelly Town | `gummy` | `l03_candy_004.mp4` | `l03_candy_004_original_xfade.mp4` | `l03_candy_004_reference.png` |
| 4 | 棉花糖森林／Cotton Candy Forest | `cotton-candy` | `l03_candy_005_v2.mp4` | `l03_candy_005_v2_original_xfade.mp4` | `l03_candy_005_v2_reference.png` |

棉花糖森林僅使用此次提供的 v2 原片；舊版不列入清單。

配置來源為 `src/scenes.ts`，正式遊戲與 Video Lab 共用相同順序、名稱、穩定 ID；路徑仍經 `asset()` 使用 Vite BASE_URL。巧克力由舊稱「巧克力河畔」更新為「巧克力湖畔」，ID 與素材未變。薑餅素材與歷史測試紀錄保留，沒有放回現行選單。

## 來源保留與後製

棒棒糖 v2 與巧克力原片／標準淡化版直接沿用，沒有重新編碼；本次前後 SHA-256 相同，見 [既有素材雜湊](video-tests/l03-candy-004/existing-assets-baseline.json)。既有 120 秒結果沿用 [前次驗證報告](CHOCOLATE_RIVERSIDE_REPLACEMENT.md)。

果凍原始檔 `Candy_kingdom_endless_runner_video_60aea710.mp4` 與 `繽紛糖果王國果凍大道.png` 從根目錄搬至上述目錄，搬移前後 SHA-256 相同，見 [來源清單](video-tests/l03-candy-004/source-manifest.json)。

沿用 `scripts/prepare-candy-video.mjs`。果凍已完成後製，這次只新增棉花糖 v2 後製，前三支影片沒有重新編碼，見 [本次既有素材雜湊](video-tests/l03-candy-005-v2/existing-assets-baseline.json)。重建指令：

```sh
node scripts/prepare-candy-video.mjs --gummy
node scripts/prepare-candy-video.mjs --gummy --fade-presets
node scripts/prepare-candy-video.mjs --cotton-candy
node scripts/prepare-candy-video.mjs --cotton-candy --fade-presets
```

使用完整原片、不額外裁切頭尾，8 影格重疊合成首尾接點。輸出 H.264、yuv420p、無音軌、faststart；播放為 1.0x。果凍另產生既有滑桿所需的 `fades/004-original-{4,12,16,20,24}.mp4`，棉花糖則為 `fades/005-v2-original-{4,12,16,20,24}.mp4`，預設仍為 8 影格標準版本。這是單片原生循環的離線淡化，不是場景間轉場。

## ffprobe 實際規格

| 場景 | 原片解析度／FPS | 原片影格／影像秒數 | 原片容器秒數 | 標準淡化影格／秒數 |
| --- | --- | --- | --- | --- |
| 棒棒糖森林大道 v2 | 1280×720／24 | 190／7.916667 | 7.930000 | 182／7.583333 |
| 巧克力湖畔 | 1280×720／24 | 190／7.916667 | 7.930000 | 182／7.583333 |
| 果凍軟糖城 | 1280×720／24 | 190／7.916667 | 7.930000 | 182／7.583333 |
| 棉花糖森林 v2 | 1280×720／24 | 190／7.916667 | 7.930000 | 182／7.583333 |

四支標準淡化版皆維持 1280×720、24 FPS、H.264/yuv420p、無音軌、moov 在 mdat 前（faststart）。原片保留 AAC 音軌，播放器強制靜音。完整 ffprobe 摘要、雜湊及滑桿版本規格見 [前三支 media-specs.json](video-tests/l03-candy-004/media-specs.json)及[棉花糖 v2 media-specs.json](video-tests/l03-candy-005-v2/media-specs.json)。

## 工程驗證

本次建置、TypeScript 及 112 項單元測試通過。相關 E2E 涵蓋四個場景的選單順序／名稱、棉花糖深層連結、原片／淡化滑桿、單一播放器、固定 120 秒遊戲及四種動作與暫停流程。播放器時鐘、解碼、繪製與共用投影邏輯未改，前三支影片也未改，沿用既有 120 秒結果，本次補跑場景相關回歸及棉花糖獨立長測。

棉花糖原片及標準淡化版完整解碼成功；FFmpeg blackdetect（98% 像素低於黑色閾值）未偵測到整幅黑畫面，詳見 `docs/video-tests/l03-candy-005-v2/*.decode.log`。果凍的相同檢查亦已通過並保留前次紀錄。此檢查不代表沒有局部暗區或所有裝置皆無解碼問題。

前次果凍整合的瀏覽器測試結果（保留紀錄，本次不重跑未變影片的 120 秒測試）：

- `npm run test:e2e`：34／34 項通過，約 4.9 分鐘。
- `npm run test:video -- tests/video-integration/chocolate.spec.ts --grep gummy`：1／1 項通過，約 2.4 分鐘。
- 果凍以正常 1.0x 實際播放 120.562 秒，牆鐘 120.588 秒，Game Clock 120.579 秒；循環 15 次、2884 張影片影格、丟影格 0。
- 最長循環影格間隔 83.4 ms，最長 waiting 30.0 ms；stalled=0，超過 250 ms 的影格間隔=0，頁面錯誤=0。
- 四種鍵盤動作成功、暫停／恢復及暫停 seek 不影響 Game Clock 全數通過。
- [循環短測](video-tests/l03-candy-004/loop-fallback.json)包含果凍與巧克力原片／淡化版及棒棒糖原片，每組至少一次循環，備援草原影格皆為 0。
- 使用桌面 Playwright Chromium、原生影片、真實牆鐘時間，沒有加速時鐘。並非真人 Webcam 或行動裝置效能驗收。

完整資料：[驗證摘要](video-tests/l03-candy-004/validation.json)、[果凍 120 秒 JSON](video-tests/l03-candy-004/gummy-120s.json)、[長測截圖](video-tests/l03-candy-004/gummy-120s.png)；四種動作疊圖同存於 `docs/video-tests/l03-candy-004/`。

棉花糖森林 v2 本次驗證：

- 相關 E2E 共 10 項：首輪 9 項通過、循環短測 1 項逾時。Trace 顯示棉花糖兩種版本已完成取樣，後續既有巧克力原片取樣出現長時間執行空檔。根因未確認；以相同斷言及 110 秒逾時設定單獨重跑該項後通過（約 1.3 分鐘），沒有更改播放器或放寬門檻。原 trace 與錯誤快照保留於 `video-tests/l03-candy-005-v2/first-loop-timeout/`。
- `npm run test:video -- tests/video-integration/chocolate.spec.ts --grep cotton-candy`：1 項通過，約 2.4 分鐘。
- 正常 1.0x 實際播放 120.529 秒，牆鐘 120.562 秒，Game Clock 120.545 秒；循環 15 次、2883 張影片影格、丟影格 0。
- 最長循環影格間隔 83.4 ms，最長 waiting 26.7 ms；stalled=0、超過 250 ms 的影格間隔=0、頁面錯誤=0。
- 四種鍵盤動作、暫停／恢復及暫停 seek 不改變 Game Clock 均通過。
- [本次循環短測](video-tests/l03-candy-005-v2/loop-fallback.json)涵蓋四支影片的原片與標準淡化版，每組至少一次循環，備援草原影格皆為 0。
- [驗證摘要](video-tests/l03-candy-005-v2/validation.json)、[棉花糖 120 秒 JSON](video-tests/l03-candy-005-v2/cotton-candy-120s.json)、[長測截圖](video-tests/l03-candy-005-v2/cotton-candy-120s.png)。桌面 Chromium 工程結果並非真人 Webcam 或手機／平板驗收。

## 道路、透視、速度與接點觀察

對四支原片各抽取約每秒一張影格，另檢視新場景末尾完整 8 影格淡化區：

- [棒棒糖時間取樣](video-tests/l03-candy-004/l03_candy_001_v2-timeline.jpg)
- [巧克力時間取樣](video-tests/l03-candy-004/l03_candy_003-timeline.jpg)
- [果凍時間取樣](video-tests/l03-candy-004/l03_candy_004-timeline.jpg)
- [果凍末尾 8 影格淡化](video-tests/l03-candy-004/gummy-fade-last-8-frames.jpg)
- [棉花糖 v2 時間取樣](video-tests/l03-candy-005-v2/cotton-candy-timeline.jpg)
- [棉花糖 v2 末尾 8 影格淡化](video-tests/l03-candy-005-v2/cotton-candy-fade-last-8-frames.jpg)

抽樣中皆有中央粉紅道路、兩條內部白色虛線與向前延伸的透視，未見跨越中央道路的近景物件。視點大致朝正前方，抽樣雲層未見嚴重垂直跳動；仍需正常播放人工判讀，不能用時間取樣宣告固定攝影機或道路完全無漂移。

果凍兩側透明熊與高塔的尺寸及近景移動幅度比前兩支更醒目，三支的景物密度與材質不同。皆沿用候選道路參數 centerX=0.5、horizon=0.41、nearHalfWidth=0.64、speed=5；相同參數與播放倍率不代表影片光流／主觀速度完全一致。果凍正式遊戲的[疊圖截圖](game-tests/gummy-jelly-town/gummy-playing.png)中，道路會聚點略低於既有 horizon=0.41 參考線，存在待人工確認的接地／透視對齊差異；本次保留既有投影設定。本次未做實際 3D 校正或光流速度量測，不能宣稱四支已達到相同視覺速度。棉花糖較蓬鬆的樹冠、條紋樹幹與灌木取代果凍的大型透明熊；四支近景尺度與景物密度不同，同一倍率的前進感仍需並排人工比較。

果凍末尾淡化明顯可見城堡、彩虹與路旁裝飾雙像，雲層與道路紋理也有混合。這是需要人工判斷能否接受的素材品質問題；目前保留候選，不宣告正式接點驗收通過。若使用者認為 0.333 秒重影或速度落差不可接受，再決定是否重生素材，本次未重新生成或擅改已決定的標準淡化方式。

棉花糖 v2 的取樣畫面中央道路開闊，有兩條白色虛線，沒有看到橫跨道路的大拱門或近距離大型城堡。末尾淡化可見樹冠、星星裝飾、灌木與道路紋理雙像；雲層位置也有混合。[棉花糖遊戲疊圖](game-tests/cotton-candy-forest-v2/cotton-candy-playing.png)顯示影片道路會聚點約在畫面高度 0.49，明顯低於共用 horizon=0.41 參考線；這是單張截圖的近似目視位置，並非校正量測，仍有透視／接地對齊差異。本次依限制保留原投影參數，不宣稱四支道路透視一致。若共用投影對齊是硬性美術門檻，或重影與主觀速度不能接受，這支仍可能需要重新生成；由使用者正常播放驗收後決定，本次未生成素材，也不能用工程測試代替正式素材驗收。

## 人工驗收待辦與後續

- 正常 1.0x 觀看果凍與棉花糖 v2 接點重影、雲層換位、道路輪廓與近景速度，判斷是否需重生。
- 四支逐一搭配道路格線／障礙疊加，比對實際接地、縮放與速度感。
- 真人 Webcam、手機／平板的解碼與 MediaPipe 同時執行、電視投放及實際遊玩仍待驗收。
- 同局多背景自動切換尚未決定，需另提方案與風險後再做。

棉花糖 Video Lab：`/shape-quest/?videoTest=1&scene=cotton-candy&overlay=0`；正式遊戲：`/shape-quest/?scene=cotton-candy`。沿用既有 Debug、Video Lab 及歷史 PoC／報告，沒有新增 B2、T1～T5，沒有修改 Camera Projection、MediaPipe、動作辨識或障礙物判定。
