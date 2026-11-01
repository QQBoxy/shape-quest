# Shape Quest — 糖果王國正式遊戲整合

日期：2026-11-01。工程整合與自動化測試不代表真人驗收已通過。

## 可實際遊玩的版本

開發伺服器執行 `npm run dev`，以本機瀏覽器開啟：

- 棒棒糖森林大道：`http://127.0.0.1:5173/shape-quest/?scene=lollipop`
- 薑餅村莊：`http://127.0.0.1:5173/shape-quest/?scene=gingerbread`

這兩個入口是正式遊戲首頁，不是 Video Lab。也可從首頁「選擇冒險場景」切換。選好後按「開啟鏡頭，開始冒險」→「全身模式」→依原有流程完成站立、左右跨步、蹲下、跳躍校正→「校正完成，出發」。亦保留臉部模式及無鏡頭模式。

糖果王國每局 120 秒，生命與出題規則沿用原設定；生命耗盡仍會提早結束，沒有自動通關或提高真人遊戲生命值。整局固定同一支背景，重玩沿用所選場景；要換場景需先回首頁。未指定場景的首頁仍預設原本草原 60 秒挑戰。

## 實作內容

- 首頁新增兩個糖果王國場景，開始前載入，載入完成才開放開始按鈕。
- 開始、模式選擇、校正、遊玩與結算期間鎖定首頁場景選擇；回首頁才可重新選擇。
- 回合開始把同一支背景影片移到開頭，倒數、暫停、追蹤中斷及結束時沿用原有 Background.sync 控制。
- 使用同一個背景 HTML5 Video，muted、playsInline、loop、playbackRate=1；攝影機仍有獨立的既有 video 元素。
- 沿用已修正的 Background.visible，原生循環 waiting／readyState 暫降不會切回草原。
- 沒有以影片 currentTime 或 loop 事件控制 Game Clock、障礙生成或碰撞判定。
- 沒有更動 MediaPipe、全身／臉部偵測、校正或追蹤恢復邏輯。
- 糖果回合使用既有 Game(120)，草原維持 Game(60)。姿態事件的時間上限改用該回合 game.duration，避免原本 CONFIG.duration=60 截斷後半局的事件時間。
- 兩個糖果場景共同使用 Video Lab 已驗證的投影參數：centerX=0.5、horizon=0.41、nearHalfWidth=0.64、speed=5，focal／near 沿用既有值。投影公式未改，兩場景沒有不同的難度或速度設定。
- 將原有糖果場景名稱與投影常數移到 src/scenes.ts，正式遊戲與 Video Lab 共用，不另外實作播放或投影系統。
- 保留 Debug、Video Lab、原始素材及全部 PoC 歷史檔案，沒有同局自動切換或複雜轉場。

## 素材完整性

直接沿用：

- `public/videos/level-03/l03_candy_001_v2_original_xfade.mp4`
- `public/videos/level-03/l03_candy_002_original_xfade.mp4`

本次沒有執行 FFmpeg、重新生成、改寫或重新編碼影片。兩支檔案的 SHA-256 與獨立循環驗證紀錄一致，見 `docs/game-tests/candy/asset-integrity.json`。

## 自動化驗證

- 單元測試：8 個檔案、112 項通過。
- TypeScript 與正式 Vite 建置通過。
- 既有 29 項 E2E 回歸通過；新增兩個正式場景 E2E 已修正測試的 HUD 更新等待與隱藏選單查找方式，重跑 2/2 通過，沒有為此修改正式遊戲邏輯。
- 兩個正式場景均在可見 Chromium 完成正常 1.0x 的 120 秒完整回合，實際牆鐘時間包含手動暫停、失追暫停與恢復倒數。

| 場景 | 遊戲時間 | 牆鐘時間 | 循環 | 渲染中位數 | 模型推論中位數 | 最大影格間隔 | 最長 waiting |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 棒棒糖森林大道 | 120 秒 | 131.116 秒 | 15 | 60 FPS | 15.0 FPS／26.3 ms | 100.1 ms | 7.7 ms |
| 薑餅村莊 | 120 秒 | 131.318 秒 | 15 | 60 FPS | 15.0 FPS／26.4 ms | 102.0 ms | 34.0 ms |

兩支皆由合成動作完成 29 次成功、0 次失敗，結算時間為 120 秒。背景來源切換 0 次、備援草原影格 0 次、stalled 0 次，影片維持 muted／loop／1.0x。手動暫停凍結影片與遊戲時間，失追暫停及回到中央後恢復均通過；結算時影片暫停，再冒險一次保留原場景。

資料：`docs/game-tests/candy/lollipop-120s-game.json`、`docs/game-tests/candy/gingerbread-120s-game.json`。這些是合成動作輸入的工程結果，不是玩家真人成功率。等待事件與循環影格間隔仍有記錄，未宣稱影片在所有裝置完全沒有任何解碼等待。


正式長回合測試使用實際載入與執行的 MediaPipe Pose Landmarker，在合成空白攝影機影像上推論，再由測試專用 wrapper 回傳合成身體關鍵點，完成原本校正、Jump／Duck／左右 Dodge、手動暫停及失追恢復流程。沒有在正式程式加入繞過校正、額外生命或自動成功的開關。

長測在可見桌面 Chromium（headed）以正常 1.0x 影片和實際牆鐘時間完成 120 秒遊戲，不用加速時鐘。動作由測試合成輸入完成，**不是實際真人 Webcam 動作驗收**。推論效能數據來自空白影像，不能代表真人完整骨架追蹤負載。

測試命令：

```sh
npm test
npm run build
npm run test:e2e
npm run test:video -- tests/video-integration/candy-game.spec.ts --headed
```

## 無頭環境效能限制

相同模型在這台機器的無頭 Chromium 中只有約 8～9 FPS、每次約 116～126 ms；原有站立校正需要足夠的連續取樣，該環境未能完成校正。本次沒有降低校正／辨識標準，也沒有更動 MediaPipe。可見 Chromium 的完整回合另行驗證，不能把它的結果當作無頭環境已通過，兩種環境的效能也不能互相替代。

診斷紀錄：`docs/game-tests/candy/failure-1793540048869.json`。真人驗收應使用正常可見瀏覽器，並另看實際裝置的 Debug 渲染／推論 FPS。

## 真人與裝置驗收狀態

尚未執行：

- 真人 Webcam 完整 120 秒回合，包括實際 Jump、Duck、左右 Dodge 的辨識率、疲勞與安全空間確認。
- 真人存在時的 MediaPipe 推論負載、攝影機曝光與失追穩定性。
- iPhone／Android 手機實機。
- iPad／Android 平板實機。
- 電視投放、外接鏡頭與後鏡頭組合。

桌面自動化與行動尺寸排版檢查不能替代以上驗收。建議先以桌面 Webcam 分別玩兩個場景，再進入手機／平板及電視投放驗證。

## 檔案變更

- `src/main.ts`：首頁場景選擇、場景載入、120 秒回合與 Debug 場景資訊。
- `src/scenes.ts`：正式遊戲與 Video Lab 共用的既有糖果素材及投影設定。
- `src/video-test.ts`：改由共用檔案讀取既有設定，保留原功能。
- `src/styles.css`：場景選單與低高度橫向首頁排版。
- `tests/e2e/candy-game.spec.ts`：兩個正式入口、120 秒設定、四種動作、暫停及場景鎖定回歸。
- `tests/video-integration/candy-game.spec.ts`：真實模型推論與合成輸入的正式 120 秒回合。
- `README.md`、本報告、`docs/game-tests/candy/`：操作方式、規格完整性與測試證據。
