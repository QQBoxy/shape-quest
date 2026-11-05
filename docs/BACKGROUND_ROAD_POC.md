> 2026-11-05 更新：此頁已與正式遊戲共用四個新版場景，舊片與額外 PoC 選項已移除。下文為 2026-11-02 舊素材實驗的歷史紀錄，不代表目前素材或目前測試結果。現況請見 [正式場景整合](CANDY_KINGDOM_SCENES.md)。

# 背景影片 × Canvas 道路 PoC

日期：2026-11-02。獨立實驗，尚未導入正式遊戲。

## 測試入口與操作

```sh
npm run dev
```

開啟 [背景道路 PoC](http://127.0.0.1:5173/shape-quest/?backgroundRoad=1)。沿用專案現有的 query 入口，靜態部署於 `/shape-quest/` 也可直接開啟，不需要新增伺服器路由。正式建置可用 `npm run build`、`npm run preview`，改開 4173 埠。

手機測試可執行 `npm run dev -- --host 0.0.0.0`，在同一區域網路用電腦的 LAN IP 開啟相同路徑。不需要相機權限。

1. 選場景與 16:9／9:16／視窗比例；切換影片不會修改道路參數或道路進度。
2. 用「僅顯示原始影片」在同一影片時間比較合成與原片；切回後還原原本的道路／障礙物開關。
3. 分別暫停影片與道路，使用影片時間滑桿觀察接縫。影片速度以倍數表示，道路速度以抽象世界單位／秒表示，兩者沒有自動同步。
4. 調整消失點、底部路寬、顏色與透明度；預設 X=0.5、Y=0.45、底寬=畫面寬度、白色、50% 不透明。
5. 影片縮放以畫面中心為基準；水平／垂直偏移單位是預覽畫面的百分比。這些設定完全不影響道路幾何。
6. 選左／中／右車道或三個車道各一個方塊。道路、虛線、地面橫紋、方塊全部使用同一投影與前進距離。
7. 按「儲存目前畫面設定」，複製網址或開啟儲存設定。網址包含所有參數、影片時間、道路距離，重新開啟會暫停兩者，方便檢查同一畫面；取消暫停即可繼續。儲存後若繼續調整，需再按一次更新網址。
8. 「從頭對照」讓影片與道路歸零，保留參數及暫停狀態。「恢復全部預設值」會還原場景、參數並重新播放。

「跟隨視窗比例」使用瀏覽器 viewport 的寬高比，畫面仍等比縮放以容納控制面板，並非全螢幕模式。手機的控制面板在預覽下方。

## 實際素材

讀取 `src/scenes.ts` 的現有場景對應。以下四個原檔皆實際存在，ffprobe 確認為 1280×720、24 FPS、影像長 7.916667 秒（容器時間可能含音軌尾段）。本次直接播放原片，沒有生成、剪輯或改寫任何影片，也沒有改用既有的淡化衍生版。

| 場景 | 專案素材路徑 |
| --- | --- |
| 棒棒糖森林大道 | `public/videos/level-03/l03_candy_001_v2.mp4` |
| 巧克力湖畔 | `public/videos/level-03/l03_candy_003.mp4` |
| 果凍軟糖城 | `public/videos/level-03/l03_candy_004.mp4` |
| 棉花糖森林 | `public/videos/level-03/l03_candy_005_v2.mp4` |

單一 HTML video 使用 muted、playsinline、loop；保留原片色彩、亮度及不透明度。未載入正式 Game、Renderer、MediaPipe 或相機模組。

## 投影與效能設計

PoC 只有 Canvas 2D，沒有新增套件。`background-road-projection.ts` 是此頁專用投影，不修改正式遊戲的投影、關卡或障礙物。

世界車道中心 x = -1、0、1，邊界 x = -1.5、-0.5、0.5、1.5。近面 z=1，遠方 z→∞，縮放係數 s=1/z。

```text
screenX = [vpX + (0.5 − vpX + worldX × roadWidth / 3) × s] × viewportWidth
screenY = [vpY + (1 − vpY) × s] × viewportHeight
          − objectHeight × roadWidth / 3 × viewportWidth × s
z = 1 + positiveModulo(worldZ − distance, span)
distance += speed × deltaSeconds
```

因此底部始終置中，底寬為 1 時兩側位於左右角，內部分界位於 1/3 與 2/3，無論消失點 X 或預覽比例如何改變。尺寸和位置使用相同 s；深度以固定世界速度減少，呈現靠近時加速放大的透視。所有場景沿用相同參數。

只繪製 24 組路面標記與最多三個方塊。Canvas backing resolution 隨 ResizeObserver 更新，DPR 上限為 2。背景分頁暫停影片和道路進度，回前景後按各自的暫停設定恢復；長影格的步進上限是 0.1 秒，避免卡頓後瞬移。這是視覺 PoC，沒有絕對時間同步要求。

頁面提供 rAF 更新率、Canvas JS 繪圖提交時間與影片累計丟格，僅供快速觀察；不是 GPU 成本或手機效能保證。暫停時仍會繪圖，讓參數調整即時可見。

## 可重現的視覺比較

以下截圖皆為原片第 3 秒、道路距離 0，使用當時的預設道路（Y=0.42、棕色、100% 不透明）、影片 cover／1 倍／無偏移、關閉藍色輔助線。這是刻意不做場景專屬校正的比較。

- [棒棒糖橫向重現](http://127.0.0.1:5173/shape-quest/?backgroundRoad=1&scene=lollipop&aspect=landscape&vpY=0.42&color=%23b98668&opacity=1&videoTime=3&distance=0&videoPaused=true&roadPaused=true&guides=false)
- [巧克力直向重現](http://127.0.0.1:5173/shape-quest/?backgroundRoad=1&scene=chocolate&aspect=portrait&vpY=0.42&color=%23b98668&opacity=1&videoTime=3&distance=0&videoPaused=true&roadPaused=true&guides=false)
- [果凍直向重現](http://127.0.0.1:5173/shape-quest/?backgroundRoad=1&scene=gummy&aspect=portrait&vpY=0.42&color=%23b98668&opacity=1&videoTime=3&distance=0&videoPaused=true&roadPaused=true&guides=false)
- [棉花糖直向重現](http://127.0.0.1:5173/shape-quest/?backgroundRoad=1&scene=cotton-candy&aspect=portrait&vpY=0.42&color=%23b98668&opacity=1&videoTime=3&distance=0&videoPaused=true&roadPaused=true&guides=false)

| 場景 | 橫向原片／合成 | 直向原片／合成 | 實際觀察 |
| --- | --- | --- | --- |
| 棒棒糖 | [原片](background-road/lollipop-landscape-original.jpg)／[合成](background-road/lollipop-landscape-composite.jpg) | [原片](background-road/lollipop-portrait-original.jpg)／[合成](background-road/lollipop-portrait-composite.jpg) | 橫向中間路面大部分遮住，但粉紅邊帶與原路緣仍在；直向兩側原路面變寬，程式路尖與影片遠方交會位置有落差。 |
| 巧克力 | [原片](background-road/chocolate-landscape-original.jpg)／[合成](background-road/chocolate-landscape-composite.jpg) | [原片](background-road/chocolate-portrait-original.jpg)／[合成](background-road/chocolate-portrait-composite.jpg) | 直向中央道路外仍露出粉紅路面與白色標記；湖畔／側邊景觀大量裁切，剩下中央街道。 |
| 果凍 | [原片](background-road/gummy-landscape-original.jpg)／[合成](background-road/gummy-landscape-composite.jpg) | [原片](background-road/gummy-portrait-original.jpg)／[合成](background-road/gummy-portrait-composite.jpg) | 橫向遠處路側景觀被道路三角形局部蓋住；直向近景大軟糖熊裁掉，原路面與白色邊界仍外露。 |
| 棉花糖 | [原片](background-road/cotton-candy-landscape-original.jpg)／[合成](background-road/cotton-candy-landscape-composite.jpg) | [原片](background-road/cotton-candy-portrait-original.jpg)／[合成](background-road/cotton-candy-portrait-composite.jpg) | 橫向路面遮蓋接近原有走向，仍有材質落差與粉紅邊緣；直向棉花糖近景大量裁切，兩側露出原路面。 |

共同結論：三線道幾何與障礙物的視覺對齊能獨立維持，四支影片也都能沿用為播放素材；**單一不透明三角形不能保證消除原片道路、路緣與透視衝突**。尤其直向 cover 會裁掉大量左右內容，影片原路面的投影寬度與程式路面不再相同。固定路寬／消失點能統一道路，不能讓烘焙在影片中的整個環境自動符合新相機。

以 contain 保留完整影片時，直向必然出現大面積上下黑邊，Canvas 仍延伸至預覽底部，會更明顯看出兩層範圍不一致。影片縮放與偏移能探索取捨，但可能露出空白或移動影片消失點，並不會同步校正程式道路。此頁保留這些問題，沒有模糊、降亮度、半透明影片或額外特效掩蓋。

## 驗證與限制

```sh
npm test
npm run build
npx playwright test tests/e2e/background-road.spec.ts tests/e2e/home.spec.ts tests/e2e/game.spec.ts
# 下列測試預設包含八組各 10 秒、跨原生循環的真實時間播放比較：
npm run test:e2e -- tests/e2e/background-road.spec.ts
```

單元測試檢查橫直向與不同消失點下的底部邊界、分界、遠方收斂、障礙物高度縮放，以及影片循環時間附近的世界距離連續性。目前瀏覽器功能測試使用六支真實 MP4（含兩支新影片），驗證橫直向、原片切換、獨立時鐘、seek、設定還原、手機尺寸與旋轉、載入失敗時的獨立道路。比較截圖輸出到 `test-results/background-road/`，此次視覺證據另保存在本文件旁的 `background-road/`。

此次結果：`npm test` 共 114 項通過；型別檢查及 production build 通過；開啟播放比較的 PoC＋既有首頁／遊戲流程共 14 項瀏覽器測試通過。

播放比較數據見 [comparison.json](background-road/comparison.json)。桌面及手機尺寸模擬皆用同一台 macOS 的 Playwright Chromium，沒有 CPU 節流；**手機尺寸模擬不等於真實手機測試**。10 秒短測涵蓋一次循環，不能代表長時間耗電、溫度或記憶體穩定性。

| 場景 | 橫向 rAF FPS | 直向模擬 rAF FPS | 每組循環／waiting／stalled | 每組影片丟格 |
| --- | --- | --- | --- | --- |
| 棒棒糖 | 60.10 | 60.04 | 1／1／0 | 0 |
| 巧克力 | 60.10 | 60.03 | 1／1／0 | 0 |
| 果凍 | 60.10 | 59.95 | 1／1／0 | 0 |
| 棉花糖 | 60.05 | 59.95 | 1／1／0 | 0 |

八組 rAF P95 為 16.7～16.8 ms，頁面末次 Canvas 平均提交時間為 0.04～0.07 ms。每組原生循環皆觸發一次 waiting，沒有 stalled 或回報丟格；因此不能描述為完全無等待或無縫播放。

原片 loop 的環境回捲仍然存在；道路動畫不會隨影片回捲。道路世界速度與影片攝影機速度沒有已知比例，因此只提供獨立調整，未宣稱前進感已協調或能自動對齊。影片的生成形變與視差不可能只靠道路投影修復。

方塊只測試接地與尺寸投影，沒有碰撞、分數、深度遮擋景物或完整遊戲流程。程式路面是純色診斷材質，與影片的光照、陰影、紋理存在明顯美術差異；本 PoC 不代表正式美術通過。

目前適合繼續拿此頁做實機與視覺取捨，尚不足以直接導入正式 Shape Quest。決策重點應放在能否接受直向景觀裁切、殘留路緣與兩層前進感，而不是只看道路幾何及 FPS 通過。
