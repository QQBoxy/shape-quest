# 素材與執行資源紀錄

## 程式背景與介面

目前草原背景、道路、樹木、障礙物、動作輪廓與介面圖示由本專案程式繪製，不含外部圖片、字型、音樂或背景影片。程式背景僅為可玩原型與合成測試使用，並非已核准的正式 3D 影片。

`tests/fixtures/background.mp4` 為本專案使用 FFmpeg 產生的 1 秒單色、無音軌測試影片，只供自動化檢查；不作為正式素材或宣稱通過背景美術驗收。

## MediaPipe

- 執行套件：`@mediapipe/tasks-vision` 1.2.0，套件宣告 Apache-2.0；版本與 npm 完整性資訊固定於 `package-lock.json`。
- WASM：執行 `npm run setup` 從已安裝套件複製至 `public/wasm/`，不將產生檔提交 Git。
- 模型：[Google 官方 Pose Landmarker 模型說明](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/index)。
- 使用 Lite、float16、版本 1：[下載來源](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task)。
- SHA-256：`59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`。
- `npm run setup` 下載並驗證模型；雜湊不符會拒絕使用，請勿略過檢查。
- 模型與 WASM 由自己的靜態網站提供；開始體感模式才載入，不從執行期第三方 CDN 載入。
- 發布者應保留上游授權與說明，模型使用條件依 Google 官方模型說明與來源提供的條款，不將套件授權自動套用到所有未來素材。

## 候選影片接入

首頁下方「測試背景影片」透過 Object URL 播放本機檔案，不上傳。預期為 16:9 MP4 / H.264，固定 1.0x、靜音並循環。載入失敗切回程式背景，候選素材永遠標示未驗收。

選檔是開發驗證功能，不會保存設定；重新整理後需重選。未選入真實影片前，不代表已驗證 AI 影片的光流、接地、透視或循環品質。

正式影片到位時，依 [背景規格](BACKGROUND_VIDEO_SPEC.md) 登記實際片長、比例、來源、授權、Prompt、生成工具／模型、Profile 與驗收結果。正式循環使用單一 HTML5 Video；不同場景的切換方式另行驗證。

## 糖果王國「棒棒糖森林大道」候選

使用者提供 Google Flow 生成影片及參考圖，分別位於 `public/videos/level-03/l03_candy_001.mp4`、`public/references/level-03/l03_candy_001_reference.png`。原片含 AAC 音軌，播放器強制靜音；原檔不改寫。另有 `l03_candy_001_trim.mp4` 與 `l03_candy_001_xfade.mp4` 兩個離線衍生測試檔，均移除音軌。來源生成 Prompt、模型版本、點數與發布授權紀錄仍待素材提供者補齊，不自行推定。

三個版本只供 Phase 1 工程比較，皆維持 candidate；詳見 [整合報告](BACKGROUND_INTEGRATION_REPORT.md)。

## 糖果 v2 混合式渲染 PoC（歷史研究）

v2 原始影片與參考圖保留不改寫。`l03_candy_001_v2_faststart.mp4` 是影像串流直接複製、去除音軌、前置索引的低成本封裝比較片，不是新 AI 影片。固定遠景 PoC 僅在記憶體中裁取／羽化參考圖上半部，不產生新的正式美術素材；道路與近景由程式繪製。詳見 [PoC 報告](HYBRID_RENDERING_POC.md)。

## 2026-11-01：v2.0 正式製作基準

依 [背景影片統一製作與整合規格 v2.0](BACKGROUND_VIDEO_SPEC.md)，採完整 Google Flow 原片、不預先裁切頭尾、約 0.333 秒離線首尾交叉淡化。24 FPS 預設 8 影格；其他 FPS 以時間換算。保留來源 MP4，衍生檔輸出無音軌 H.264／yuv420p／faststart，使用單一 HTML5 Video 靜音循環、playsInline、1.0x 播放。

目前比較使用三線道修正版 `l03_candy_001_v2.mp4`；原始 190 影格、24 FPS 約 7.9167 秒，重疊 8 影格後為 182 影格、約 7.583 秒，不將此週期強制套用到其他素材。選定「原始影片＋淡化」為預設方向，剪輯＋淡化僅保留比較；詳見 [淡化比較](FADE_COMPARISON.md)。混合渲染及複雜轉場研究保留，不作為目前正式方向。

新素材須登記世界、場景、版本、生成工具／模型、Prompt、實際 FPS／影格數／片長、來源與衍生檔、Profile 及逐項驗收結果。驗收新增天空、雲層與極遠地景穩定性，並要求全片恰好兩條內部分隔線。正式背景整合、新淡化影片獨立 120 秒長測、行動裝置搭配 MediaPipe 與電視投放仍待驗證；歷史 v1 或混合式 PoC 的長測結果不能代替本次素材驗收。


## 糖果王國第二場景：薑餅村莊（2026-11-01）

使用者提供的 Google Flow 原片已從根目錄搬到 `public/videos/level-03/l03_candy_002.mp4`，靜態參考圖為 `public/references/level-03/l03_candy_002_reference.png`。搬移前後 SHA-256 相同，原始檔名與雜湊見 `video-tests/l03-candy-002/source-manifest.json`。沒有重新生成或改寫原片。

原影像為 H.264／1280×720／24 FPS／190 影格、7.916667 秒，容器含 AAC 音軌，容器長 7.93 秒。標準衍生檔 `l03_candy_002_original_xfade.mp4` 使用完整影像序列、8 影格（0.333 秒）循環交叉淡化，輸出 182 影格、ffprobe 長 7.583008 秒，無音軌 H.264／yuv420p／faststart。滑桿比較版本位於 `public/videos/level-03/fades/002-original-{4,12,16,20,24}.mp4`；0 秒使用原片並強制靜音，8 影格使用標準衍生檔。

沿用現有 Video Lab、Background、Game、Renderer 與 VideoMetrics。獨立場景僅在 Debug 比較頁選擇；正式遊戲背景預設沒有變更。來源生成模型、完整 Prompt 與授權未另提供，不自行推定。驗證與裝置限制見 [薑餅村莊整合報告](GINGERBREAD_VILLAGE_REPORT.md)。


## 2026-11-01：糖果王國正式遊戲驗證入口

上述兩支 8 影格淡化 MP4 已接入首頁開始前場景選擇，可分別以 120 秒回合遊玩；整局固定同一場景，重玩沿用選擇。影片內容與雜湊沒有變更，未新增自動轉場。草原 60 秒預設與 Video Lab 保留。工程測試使用真實模型推論及合成關鍵點，真人 Webcam、手機／平板及電視投放尚待驗收，詳見 [正式整合報告](CANDY_GAME_INTEGRATION_REPORT.md)。
