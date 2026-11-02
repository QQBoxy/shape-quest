# 糖果王國手動換片 PoC

入口：`/shape-quest/?videoTest=1&sceneSwitch=1`。也可從既有 Video Lab 點「手動換片 PoC」。這是獨立工程測試模式，正式遊戲仍固定所選背景；沒有啟用自動輪播或加入跨場景淡化特效。

## 操作與切換規則

1. 選起始場景，按「開始 120 秒測試」。方向鍵沿用既有四種動作；工程生命值較高，以便測試滿一回合。
2. 按「下一個場景」，依 `lollipop → chocolate → gummy → cotton-candy → lollipop` 順序預約換片。
3. 目前還有待判定的障礙時，繼續原場景，直到沒有待判定障礙的空檔。預約等待時間仍正常計入遊戲。
4. 換片時擷取上一張背景到 Canvas，暫停背景與遊戲時鐘，再用同一個 HTML Video 載入下一支標準淡化影片。
5. 等新影片 `loadeddata` 且送出第一張影格後才顯示新片，從相同遊戲狀態繼續。分數、生命、障礙結果及排程不因換片重設。
6. 載入失敗／首幀等待逾時時保留原背景截圖及遊戲狀態，提供重試；不跳過失敗場景。換片期間封鎖重複請求與重新開始。切換分頁仍沿用 Video Lab 的暫停行為。

120 秒指 **Game Clock 的有效遊戲時間**。實際經過時間另加換片凍結、手動暫停與恢復倒數，不能解讀成固定 120 秒牆鐘時間。載入時背景確實會停住，因此本 PoC 不能宣稱背景持續前進或無感轉場。

## 範圍與量測

沿用現有四場景配置、單支影片首尾淡化素材、`Background`、`Game`、`Renderer`、`VideoMetrics` 與共用候選投影。實作位於 `src/video-test.ts` 的 `sceneSwitch` 模式，沒有修改正式遊戲、動作辨識、障礙判定或素材。

固定使用完整原片＋8 影格首尾淡化。PoC 進行時鎖住場景／版本／淡化／投影設定，避免重載設定中斷同一回合；仍可顯示／隱藏遊戲疊加與格線。保留影格用獨立 Canvas 顯示，所以關掉遊戲疊加後也能覆蓋載入空窗，不需要第二個播放器。

每次切換記錄來源／目標 ID、請求時的 Game Clock、等待安全空檔時間、載入時間、第一張影格時間、總凍結時間、結果與前後完整遊戲資料。首幀時間從開始換片起算，包含載入時間；它不是 `loadeddata` 後額外花費的時間。遊戲資料比對用相同時間、分數、生命、成功／失敗數及所有障礙的碰撞時間／結果。可以用「匯出紀錄」保存 JSON。

相鄰新來源會中斷影格連續性取樣，避免把換片誤算成原生循環；換片的凍結另記於 `switches`。播放器回報的 droppedFrames／totalFrames 可能在換來源時重設，不能當作整個回合跨來源的累積丟影格量。

## 驗證

建置、TypeScript、112 項單元測試通過。

相關 E2E 共 11 項：原 Video Lab 場景選擇、淡化及時鐘回歸共 9 項通過；PoC 兩項通過，包含安全空檔預約、四場景順序與回到起點、刻意延遲 1 秒時保留背景／凍結遊戲、得分後換片狀態不變、暫停／恢復、載入失敗後重試及單一 Video。首次 PoC 得分測試因預設輪詢間隔錯過按鍵判定窗而失敗，改為 25 ms 測試輪詢後兩項重跑通過，沒有修改遊戲判定窗。

執行指令：

```sh
npm run build
npm test
npm run test:e2e -- tests/e2e/scene-switch.spec.ts tests/e2e/video-test.spec.ts tests/e2e/background-scenes.spec.ts tests/e2e/fade-options.spec.ts
npm run test:e2e -- tests/e2e/scene-switch.spec.ts
npm run test:video -- tests/video-integration/scene-switch.spec.ts
```

[功能測試 JSON](scene-switch-tests/manual/functional.json)中，刻意延遲的首次換片凍結約 1082.8 ms，其他三次約 50.2、51.1、99.9 ms。四次切換前後遊戲資料皆一致。[載入失敗與重試 JSON](scene-switch-tests/manual/failure-retry.json)另存。

120 秒長測：1 項通過。原生 1.0x、真實牆鐘時間，測試在遊戲時間約 22／52／82／112 秒點擊手動按鈕，並非應用程式自動輪播。Game Clock 完成 120 秒，實際牆鐘 120.403 秒，四次切換前後遊戲資料完全一致。

| 切換 | 實際切換 Game Clock（秒） | 等安全空檔 ms | loadeddata ms | 首幀 ms | 凍結 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| lollipop → chocolate | 25.001 | 2814.2 | 47.1 | 49.8 | 49.9 |
| chocolate → gummy | 53.016 | 764.2 | 45.2 | 49.0 | 49.0 |
| gummy → cotton-candy | 85.015 | 2894.2 | 40.9 | 84.2 | 84.3 |
| cotton-candy → lollipop | 113.014 | 728.4 | 42.5 | 84.0 | 84.1 |

畫面探針取樣 7199 次，保留背景取樣 16 次；可讀取的背景影像中黑畫面為 0，Canvas 草原備援影格為 0，stalled=0、頁面錯誤=0。原生循環／解碼期間有 26 次無法讀回像素，已排除黑畫面判斷，因此不能宣稱所有顯示影格皆逐像素驗收。探針只在本機測試使用，未加入正式遊戲。

[120 秒完整 JSON](scene-switch-tests/manual/round-120s.json)／[截圖](scene-switch-tests/manual/round-120s.png)／[驗證摘要](scene-switch-tests/manual/validation.json)。單片影格間隔不包含刻意的換片凍結；兩者不能混為同一個連續播放指標。

## 限制與下一步

- 本機桌面 Chromium 的載入／首幀速度不代表手機、網路冷快取或 MediaPipe 同時執行的負載。
- 四支影片道路會聚點、景物密度與速度感仍有落差；直接切換會看見場景跳變，既有首尾淡化不會消除這種跳變。素材人工驗收限制見 [場景整合報告](CANDY_KINGDOM_SCENES.md)。
- 保留靜態背景是可量測的換片等待；若最終要求背景永不停住，需另比較預先解碼／雙播放器方案的效能與複雜度，本次沒有擴充。
- 下一階段可在此 PoC 上加「約每 30 秒預約下一場景」，沿用安全空檔；每段長度會因等待空檔而浮動。需先決定 120 秒指有效遊戲或實際經過時間，再接正式自動輪播。
- 這輪測試沒有真人攝影機、行動裝置、電視投放或正式視覺驗收。
