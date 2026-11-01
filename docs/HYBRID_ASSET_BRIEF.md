# 混合式背景：後續分層素材需求草案

日期：2026-11-01。用途：下一輪單一糖果世界驗證；**尚未要求生成或核准為正式規格**。

## 先改製作方式，再生成素材

目前 v2 是道路、路緣、建築、棒棒糖、天空全部烘焙在一起的影片。不存在可直接關掉道路的圖層，任意 chroma key 或把中間塗透明也不會產生被遮住的環境、深度或自然路緣。

建議改成「遠景 plate＋近景透明道具＋程式道路／路緣」，每個圖層只承擔相容的視差範圍。不要再生成帶完整近景跑道的影片，然後期待 Canvas 自動無縫融合。

## 一、固定遠景 plate（優先）

- 畫面只含天空、雲、真正遠方的糖果山丘、微小建築與棒棒糖樹冠。
- 不含近景道路、磚紋、路緣、巨大棒棒糖、近景建築、迎面物體、UI、文字或角色。
- 寬幅、地平線附近集中景觀，上方留天空；左右邊緣不可塞入看似很近卻不產生視差的物件。
- 參考交付目標約 4096×1024 的寬幅 PNG／WebP；實際渲染保持比例，依視窗裁切天空，不拉伸建築。是否降低到 2048 寬需依手機清晰度與記憶體實測。
- 與核准 Camera Profile 對齊。PoC 的 centerX=.5、horizon=.41、道路半寬 .64 只是候選，不能未經檢查就鎖定成十二世界永久規格。
- 若景物底部需透明，提供真正的 alpha 或人工確認的獨立遮罩；不能把純色背景誤認成透明。

英文圖片 Prompt 起點：

```text
A distant panoramic matte for a cute stylized 3D cartoon candy fantasy world.
Soft rounded candy mountains, tiny distant confectionery buildings and
small lollipop tree crowns concentrated in a low distant horizon band.
Bright cheerful sky, gentle pink clouds, soft consistent daylight.
All architectural elements are far away; no large foreground objects.
No road, no pavement, no curb, no close buildings, no foreground lollipops.
No characters, no gameplay obstacles, no text, no logo, no UI.
Wide horizontal composition with generous sky and clean layer boundaries.
Designed as a fixed distant backdrop behind a separately rendered 3D road.
Preserve the agreed visual style and light direction of the supplied reference.
```

## 二、近景道具（真正產生視差）

每世界先做 2～4 個變體，例如棒棒糖樹、糖果灌木、薑餅小屋。使用獨立透明 PNG，或由美術確認的 alpha 遮罩；後續再打包成 atlas。

- 物件完整、沒有畫面截斷；底部接地錨點固定在水平中央，保留透明邊界。
- 光源、鏡頭視角與輪廓語言一致；不烘焙道路、遠方建築或大片地面。
- 地面接觸陰影由程式投影，或另提供獨立陰影層；不要把不同方向的地面陰影烘在主圖。
- 道具不能長得像需要玩家跳、蹲、閃或打破的障礙。近景道具僅放道路外側。
- 程式控制深度排序、尺度、出現距離與視差。若透明 billboard 在近景轉向或形狀不自然，再評估低成本 3D mesh；不先要求全世界完整建模。

英文圖片 Prompt 起點：

```text
One complete isolated lollipop tree prop for a cheerful stylized 3D cartoon
candy adventure game. Rounded glossy candy forms, soft daylight from the
agreed upper-left direction, matching the supplied world reference.
A clean front-facing game prop, centered, with its ground contact point
at the bottom center. No road, no environment, no text, no character.
Deliver a true transparent-background cutout or a separate clean matte.
Do not bake a large ground plane or a directional ground shadow into the prop.
```

工具是否輸出真正透明背景需實際檢查；Prompt 不保證格式或 alpha 正確。

## 三、路面與路緣材質

- 路面是可重複的小面積糖果／糖霜材質，**正交俯視**，不含透視、遠方消失點、車道線、路緣或障礙。
- 約 512～1024 正方形即可先驗證；四邊需可平鋪，沒有巨大辨識性圖案、烘焙陰影或單向光斑。
- 三線道分隔、路面格、接地與前進速度由程式繪製；不要把不同幾何畫進材質。
- 固定世界速度及材質重複長度集中設定。重複圖案可以規律出現，不能在第 8 秒整張跳回。

```text
Seamless top-down orthographic pink candy pavement material for a cute
stylized 3D cartoon game. Soft frosting-like detail and subtle rounded
surface variation. Even lighting. No perspective, no vanishing point,
no lane markings, no curb, no objects, no baked shadows, no text.
Tileable on all four edges, low contrast so gameplay cues remain clear.
```

## 四、如果仍需 AI 環境影片

影片只承擔低視差遠景或小區域動態，例如非常緩慢的遠處雲，不含任何近景道路、路緣或向鏡頭快速放大的建築。攝影機應固定；前進感由程式近景提供，避免同時出現兩個不同的跑速。

- 若只是全畫面移動的另一支八秒影片，換到道路後方仍會在兩側跳接，不能解決問題。
- 若需要透明／遮罩影片，提供獨立 matte pass，驗證時間同步、邊緣污染、編碼和 Safari／Chrome 實際播放；不要假設目前 H.264 MP4 已有可用 alpha。
- 純色 key 只能作待驗證的製作手段，糖果世界的高飽和顏色容易誤去背。靜態透明 PNG 與局部 sprite 動畫是更簡單的起點。
- 無音軌、固定解析度／影格率、穩定光照、不閃光、不碰撞、不產生動作提示；人工檢查首尾多影格，不能只要求同一張首尾圖。

```text
A locked-off distant sky and far candy skyline layer for a layered game scene.
The camera does not translate, pan, tilt, zoom, shake or move forward.
Only very subtle, slow distant cloud motion; all buildings remain distant
and structurally stable. No foreground road, pavement, curb or near props.
No approaching castle, no gameplay obstacles, no characters, no UI.
Maintain consistent soft daylight. Intended as an optional background layer
behind independently rendered moving foreground geometry.
A loop request is a creative target and must be validated after generation.
```

## 五、成本與驗收順序

先只做一張遠景、一張路面與兩個近景道具，人工確認分層、光色、接地，再測手機＋姿態推論 120 秒。通過後再擴充其他世界，不一次生成十二套。

最小程序方案可僅需每世界一張遠景，細節則由程式提供；較完整的美術方案每世界約 4～6 張來源圖，十二世界約 48～72 張。這是工作量假設，不是生成價格或保證一次成功的數量。

素材需保留來源、授權、生成工具／模型、Prompt 與版本。僅載入目前世界，避免同時解碼十二張大圖：單張 4096×1024 RGBA 約 16 MiB 原始像素，瀏覽器／GPU 另有額外成本；不能只以壓縮檔案大小估算行動記憶體。
