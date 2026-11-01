# Shape Quest — 兩支糖果王國影片獨立循環驗證

後續進度：已另完成糖果王國正式遊戲工程整合，見 [正式整合報告](CANDY_GAME_INTEGRATION_REPORT.md)；本文件保留獨立影片驗證階段的紀錄。

日期：2026-11-01（台灣時間）。本次僅完成素材後製、Video Lab 比較與獨立循環驗證；正式遊戲預設背景未變更，沒有同局自動切換，沒有重新生成 Google Flow 影片。

## 觀看方式

先執行 `npm run dev`，開啟：

- 棒棒糖森林大道：<http://127.0.0.1:5173/shape-quest/?videoTest=1&scene=lollipop&overlay=0>
- 薑餅村莊：<http://127.0.0.1:5173/shape-quest/?videoTest=1&scene=gingerbread&overlay=0>

按「開始 120 秒測試」即可觀看。兩個連結預設選取完整原片＋8 影格淡化，純影片模式隱藏 Canvas；可由「背景場景」切換影片，「顯示遊戲疊加」恢復格線、障礙物及判定回饋。單一 HTML5 Video、1.0x、muted、playsInline、loop；滑桿提供 0～1 秒，每格 4 影格（約 0.167 秒）。0 秒使用原始影片但強制靜音。

## 影片位置與規格

| 場景 | 原片 | 完整原片＋8 影格淡化 |
| --- | --- | --- |
| 棒棒糖森林大道（三線道 v2） | `public/videos/level-03/l03_candy_001_v2.mp4` | `public/videos/level-03/l03_candy_001_v2_original_xfade.mp4` |
| 薑餅村莊 | `public/videos/level-03/l03_candy_002.mp4` | `public/videos/level-03/l03_candy_002_original_xfade.mp4` |

兩支原片的影像序列均為 1280×720、24 FPS、190 影格、7.916667 秒；含 AAC 音軌的容器約 7.93 秒。淡化版本均為 182 影格、24 FPS、1280×720、H.264、yuv420p、無音軌，已驗證 `moov` 位於 `mdat` 之前（faststart）。

- 棒棒糖森林大道：ffprobe 實際長度 **7.583333 秒**。
- 薑餅村莊：ffprobe 實際長度 **7.583008 秒**；影格數換算為 182/24 = 7.583333 秒。差異來自時間戳量化，不代表變更播放速度。

棒棒糖沿用既有完整原片淡化版本並重新驗證；薑餅村莊本次重用相同 FFmpeg 函式製作。沒有另外挑選、剪除首尾內容。完整序列首尾重疊 8 影格，週期縮短 8/24 秒；最前面的影格合成到最後一段交叉淡化中，接回下一輪內容。

薑餅村莊參考圖：`public/references/level-03/l03_candy_002_reference.png`。兩份新素材已由根目錄搬至上述位置，搬移前後 SHA-256 一致，原始檔名與雜湊保存在 [source-manifest.json](video-tests/l03-candy-002/source-manifest.json)。生成工具為使用者提供的 Google Flow；未另外推定模型版本、完整 Prompt 或授權資訊。

完整規格與雜湊見 [both-video-metadata.json](video-tests/l03-candy-002/both-video-metadata.json)；薑餅其他滑桿版本見 [preset-metadata.json](video-tests/l03-candy-002/preset-metadata.json)。

## FFmpeg 重建方式

```sh
# 棒棒糖森林大道：完整原片＋8 影格首尾淡化
node scripts/prepare-candy-video.mjs --v2 --original-fade-only
# 薑餅村莊：完整原片＋8 影格首尾淡化
node scripts/prepare-candy-video.mjs --gingerbread
# 其他滑桿比較版本（4、12、16、20、24 影格）
node scripts/prepare-candy-video.mjs --gingerbread --fade-presets
node scripts/prepare-candy-video.mjs --v2 --fade-presets
```

沿用 `bakeFade()`，兩份同源輸入做 `xfade=transition=fade`，重疊長 8/24 秒、offset=(190−8)/24 秒，再選取循環區間 `trim=start=8/24:end=190/24,setpts=PTS-STARTPTS`。這裡的 trim 是取出已重疊合成的完整循環週期，不是挑選原片的最佳剪輯接點。輸出參數為 `-an -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -movflags +faststart`。原始檔不作輸出目的地。

## 循環閃動的原因與修正

接點解碼時，瀏覽器短暫進入 `readyState=1`。原本 `Background.visible` 把 `readyState < 2` 視為影片不可見，Renderer 便在影片上方畫出程式草原；逐格紀錄在薑餅淡化版抓到兩個這樣的畫面。這不是原始影片或交叉淡化產生的黑影格。

已改為在影片成功載入後維持顯示，正常循環／seek 時不因短暫就緒狀態變化而切回草原。明確清除、載入失敗與解碼錯誤仍沿用原本備援。另提供純影片觀看開關，避免每次漏接障礙的全畫面閃色回饋干擾視覺驗收。正式遊戲玩法與預設背景沒有改動。

[修正前紀錄](video-tests/l03-candy-002/before-loop-display-fix/loop-fallback.json) 包含正常漏接回饋及草原影格；草原影格可由 `readyState=1`、RGB 約 (168,220,228) 辨識，不能將所有非透明像素都當成循環閃動。[修正後回歸](video-tests/l03-candy-002/loop-fallback.json) 的三組比較均至少跨越一次循環，未再畫出草原：薑餅淡化版、薑餅原片、棒棒糖原片。既有載入失敗備援 E2E 亦通過。

## 120 秒實際播放結果

兩支修正後的測試均通過（各自正常 1.0x、實際牆鐘時間）：

| 場景 | 有效播放 | 牆鐘時間 | 循環 | 解碼影格回呼 | 最大影格間隔 | waiting 次數／最長 | stalled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 棒棒糖森林大道 | 120.562 秒 | 120.604 秒 | 15 | 2882 | 100.0 ms | 15 次／最長 50.8 ms | 0 |
| 薑餅村莊 | 120.645 秒 | 120.682 秒 | 15 | 2883 | 133.3 ms | 15 次／最長 29.0 ms | 0 |

兩支均無超過 250 ms 的影格空檔，暫停／恢復、暫停中 seek 不改變 Game Clock 均通過；四種障礙物各成功判定一次。未再以 `readyState` 暫降切回草原。這是桌面 Chromium 的工程測試結果，不代表所有裝置都能無感循環。

完整長測資料：[棒棒糖](video-tests/l03-candy-002/lollipop-120s.json)、[薑餅](video-tests/l03-candy-002/gingerbread-120s.json)；[棒棒糖畫面](video-tests/l03-candy-002/lollipop-120s.png)、[薑餅畫面](video-tests/l03-candy-002/gingerbread-120s.png)。


測試命令：

```sh
npm run test:video -- tests/video-integration/gingerbread.spec.ts
```

每個場景先以鍵盤完成 Jump、Duck、左 Dodge、右 Dodge 與截圖取樣，再重啟一次無截圖干擾的 120 秒正常播放。未使用 Playwright 模擬時鐘、變更 playbackRate 或加速影片。每支影片串行執行，暫停及恢復倒數不計入有效播放時間；另驗證暫停凍結、恢復播放，以及暫停中 seek 不會改變 Game Clock。

瀏覽器原生 loop 可能發出短暫 `waiting` 事件，因此不能以事件次數等同可見卡頓；報告同時保留每次事件持續時間、decoded frame 間隔及循環畫面取樣。

先前與 E2E／編碼併跑的紀錄保存在 `first-concurrent-run/`；顯示修正前的長測保存在 `before-loop-display-fix/`。沒有刪除既有 PoC、歷史素材或測試紀錄。

## 雲層、道路與重影觀察

以下為影格接點表、縮圖差異、瀏覽器合成畫面與實際播放監測的工程觀察，不取代使用者正常觀看及裝置實測。

| 項目 | 棒棒糖森林大道 | 薑餅村莊 |
| --- | --- | --- |
| 首尾接點 | 淡化降低景物突然換位，仍不是數學無縫 | 同樣減少切換感；近景薑餅屋的外形變換較容易察覺 |
| 遠景雲層 | 有短暫輪廓疊合／位置變化 | 雲層輕微換位及疊合比棒棒糖略明顯；不是黑閃 |
| 建築／棒棒糖／薑餅屋 | 淡化中段可見短暫雙像 | 屋頂與立面雙像可見，限於約 0.333 秒淡化區，不能稱完全消除重影 |
| 三線道與分隔線 | 維持兩條內部分隔線，接點沒有整條道路突然橫移 | 同樣維持三線道；接點可能柔化／局部雙線，但沒有大幅橫向錯位 |
| 地面紋理 | 重疊時紋理重置、短暫變軟 | 同樣有紋理重置；逐格未見全段反向播放，精確運動連續性仍有生成影片限制 |
| 黑畫面／等待 | 全片解碼取樣沒有全黑影格；瀏覽器結果見長測表 | 同左，原先露出草原的顯示問題已修正 |

320×180 RGB 接點 MAE（0～255，數值越低只代表像素差較低，不直接代表觀感或速度）：

| 場景 | 全畫面：原片 → 淡化 | 天空：原片 → 淡化 | 道路：原片 → 淡化 |
| --- | --- | --- | --- |
| 棒棒糖 | 35.63 → 15.28 | 44.17 → 15.34 | 15.79 → 6.07 |
| 薑餅 | 33.67 → 17.66 | 40.67 → 18.18 | 16.19 → 6.15 |

原始資料：[offline-comparison.json](video-tests/l03-candy-002/offline-comparison.json)。接點圖為最後 8 影格再接最前 8 影格，依左至右、上至下：

- [棒棒糖淡化接點](video-tests/l03-candy-002/lollipop-fade-seam.jpg)
- [薑餅淡化接點](video-tests/l03-candy-002/gingerbread-fade-seam.jpg)

## 兩支影片的一致性與障礙疊加

兩片均為正前方、中央直路、三線道，消失點大致居中。道路寬度與地平線在畫面上的位置接近，可沿用同一組候選 Debug 參數：centerX=0.5、horizon=0.41、nearHalfWidth=0.64、虛擬速度=5。Jump、Duck、左／右 Dodge 的接地點皆落於預期道路區域，沒有因背景循環而重置判定時間。

薑餅村莊的近景房屋較大、立面較連續；棒棒糖森林大道的糖果裝飾較密集。兩者正常 1.0x 下都呈現持續向前的近景擴張，主觀速度屬相近範圍，但房屋尺度會改變速度感，不能宣稱攝影機高度、焦距或真實世界速度完全一致。本次沒有由 AI 影片反推絕對公尺／秒，也沒有為追求相同視覺速度而修改播放速度或 Game Clock。

[薑餅 Jump](video-tests/l03-candy-002/gingerbread-jump-overlay.png)、[Duck](video-tests/l03-candy-002/gingerbread-duck-overlay.png)、[左 Dodge](video-tests/l03-candy-002/gingerbread-left-overlay.png)、[右 Dodge](video-tests/l03-candy-002/gingerbread-right-overlay.png)；棒棒糖對應截圖位於相同目錄的 `lollipop-*-overlay.png`。

## 其他檢查與限制

- 單元測試：7 個檔案、102 項通過。
- TypeScript 與正式 Vite 建置通過。
- 既有全套 E2E 首輪 26/27 通過；既有鍵盤遊戲測試在與長測併跑時得分時序斷言失敗，單獨重跑通過，未修改遊戲判定邏輯。
- 場景選擇與既有淡化滑桿 4 項 E2E 通過；顯示修正後的循環回歸、純影片開關、場景選擇與原有媒體／模型相關 E2E 共 6 項通過。
- 120 秒結果為桌面 Playwright Chromium；未完成 iPhone／iPad Safari、Android、低階裝置、電視投放與真人 MediaPipe 同時運作的效能／觀感驗收。
- 沒有修改 MediaPipe、動作判定、障礙生成或 Game Clock。這次共用播放器僅修正已載入影片在循環時誤露出備援背景的判斷。

## 下一步建議

**兩支均建議保留為正式候選素材，可進入下一步受控的正式遊戲整合驗證。** 現階段不直接宣告正式素材驗收通過：先由使用者在純影片頁確認短暫近景雙像可接受，再完成手機／平板及真人動作測試。薑餅雲層的少量換位可列觀察項，沒有必要僅為此立即重生影片。

本次沒有自動轉場；兩支素材可獨立選看，還不能以此推論兩支影片在同一局自動切換的觀感已驗證。

## 新增／修改檔案

- `public/videos/level-03/l03_candy_002.mp4`：搬移並保留原片。
- `public/references/level-03/l03_candy_002_reference.png`：搬移並保留參考圖。
- `public/videos/level-03/l03_candy_002_original_xfade.mp4`：標準淡化版。
- `public/videos/level-03/fades/002-original-{4,12,16,20,24}.mp4`：滑桿比較版本。
- `scripts/prepare-candy-video.mjs`：重用既有 bakeFade，新增薑餅輸入與 preset 命名。
- `src/video-test.ts`：場景選擇、薑餅滑桿、純影片開關及 waiting 持續時間紀錄。
- `src/background.ts`：正常循環時維持已載入影片顯示。
- `tests/e2e/background-scenes.spec.ts`、`tests/e2e/background-loop.spec.ts`、`tests/video-integration/gingerbread.spec.ts`：對應驗證。
- `README.md`、`docs/ASSETS.md`、本報告及 `docs/video-tests/l03-candy-002/` 中的規格／截圖／量測紀錄。
