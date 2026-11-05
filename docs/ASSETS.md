# 素材與執行資源紀錄

## 程式背景與介面

草原背景、道路、樹木、障礙物、動作輪廓與介面圖示由本專案程式繪製；糖果場景使用下列影片素材。程式背景僅為可玩原型與合成測試使用，並非已核准的正式 3D 影片。

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

## 臉部模型

臉部模式使用 Face Landmarker float16、版本 1，由 `scripts/setup-assets.mjs` 下載並驗證。
SHA-256：`64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`。
模型與 WASM 同樣由本機靜態資源提供，影像不會上傳。

## 目前糖果場景（2026-11-05）

正式素材已改為新版棒棒糖森林、巧克力河流、果凍軟糖城鎮與棉花糖天空，舊影片與參考圖已淘汰。精確原檔、衍生檔、音訊狀態及重建方式見 [正式場景整合](CANDY_KINGDOM_SCENES.md)，SHA-256 與實際 ffprobe 資料見 [素材驗證](candy-kingdom-2026-11-05/media-validation.json)。原檔保留內容不重寫；來源所附音軌由播放器強制靜音，淡化輸出皆為無音軌。
