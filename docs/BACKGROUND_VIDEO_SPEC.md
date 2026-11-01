# Shape Quest（奇形狀）
# 背景影片統一製作與整合規格 v2.0

版本日期：2026-11-01

狀態：製作規格已確認；正式整合及裝置驗收仍在進行。

## 1. 核心目標

Shape Quest 是為兒童設計的第一人稱體感跑酷遊戲，透過攝影機辨識身體動作，讓玩家在不同的奇幻世界中持續向前奔跑。

背景使用 Google Flow 生成高品質 3D 卡通影片，遊戲程式則負責障礙物、動作判定、生命值、分數及特效。

背景系統的優先順序：

1. 精緻、可愛且具有吸引力的 3D 卡通美術。
2. 穩定、自然的第一人稱前進感。
3. 正確的三線道與障礙物透視。
4. 適合 90～120 秒持續遊玩的循環效果。
5. 手機、平板與電腦的流暢度。
6. 影片生成成本與後續維護效率。

不以數學上完全無縫的影片循環作為必要條件，而以實際遊玩時的自然度與舒適度為驗收依據。

## 2. 正式背景架構

採用：

**完整 Google Flow 原始影片＋約 0.333 秒首尾交叉淡化＋單一 HTML5 Video 循環播放。**

具體規則：

- 保留 AI 生成的完整原始影片內容。
- 不預先裁切影片頭尾。
- 原始影片通常約 8 秒。
- 首尾交叉淡化長度預設為 8 影格（24 FPS 下約 0.333 秒）。
- 交叉淡化預先合成至輸出 MP4。
- 不在每次播放時額外執行即時交叉淡化。
- 使用單一 HTML5 Video、muted、playsInline、loop、playbackRate 1.0。
- 影片與遊戲時間軸互相獨立。
- 背景影片不負責障礙物生成與判定。
- 遊戲背景影片預設不包含音訊。

以目前測試素材為例，原影片約 7.9167 秒，交叉淡化後每輪約 7.583 秒。實際輸出週期應依來源影格數與處理方式計算，不強制所有素材相同。

已實際比較「原始影片＋淡化」與「剪輯＋淡化」，視覺差異很小，原始影片版本略佳，因此採用前者作為預設。

### 不採用的方案

- 剪輯頭尾後再淡化：僅保留比較與備選。
- 複雜速度模糊、傳送門、雲霧等轉場：暫停開發。
- 固定遠景＋程式近景混合渲染：不作為目前正式方向。
- 單純依靠 Prompt 強迫 AI 生成完美無縫影片。
- 使用影片時間作為遊戲障礙物的判定時間。

所有既有 PoC、測試紀錄與原始素材保留。

## 3. 統一美術風格

風格名稱：

**Cute Stylized 3D Cartoon Fantasy Adventure**

美術要求：

- 高品質、精緻的 3D 卡通遊戲環境。
- 色彩明亮、鮮豔、溫暖且豐富。
- 圓潤、可愛、有童話感的物件造型。
- 適度的材質反射、柔和光影與立體層次。
- 世界具有豐富裝飾，但不能影響道路辨識。
- 適合約 6 歲兒童觀看。
- 各世界具有不同的主題色彩與建築、植物及自然景觀。
- 同一世界內不同影片須維持一致的視覺語言。

避免：

- 寫實攝影風格。
- 低多邊形、簡陋平面插圖風格。
- 過暗、恐怖或壓迫性的場景。
- 強烈閃光、閃爍、劇烈鏡頭震動。
- 過度複雜或擁擠的道路裝飾。

畫面以 16:9 橫向構圖製作。

## 4. 攝影機與前進動態

### 4.1 攝影機

- 第一人稱視角。
- 鏡頭位於道路中央。
- 固定攝影機高度。
- 固定視野角度與透視。
- 固定中央消失點。
- 道路筆直向遠方延伸。
- 不顯示玩家角色身體。
- 保持穩定的水平線。

禁止：

- 左右轉彎。
- 鏡頭旋轉、傾斜。
- 上下彈跳。
- 鏡頭震動。
- 變焦。
- 突然加速或減速。
- 場景切換及剪接。

### 4.2 前進運動

必須有自然的持續前進感。

- 道路地面紋理持續向後移動。
- 路邊近景物件自然從遠方接近並經過攝影機。
- 中景物件依距離產生合理視差。
- 移動速度全片保持一致。
- 物件不可突然出現、消失或瞬間變形。
- 不可僅使用整張圖片放大來模擬前進。

前進速度由影片視覺呈現；遊戲障礙物使用獨立的虛擬世界速度及投影系統。

兩者需在視覺上盡可能匹配，但不得假設 AI 影片存在完全精確、可還原的 3D 世界座標。

## 5. 三線道道路規格

所有背景影片都必須有真正的三線道。

### 5.1 道路幾何

- 一條筆直、持續向遠方延伸的道路。
- 左、中、右三條車道。
- **只能有兩條內部分隔線。**
- 兩條分隔線應將道路分成大致等寬的三條車道。
- 道路寬度與透視比例應全片維持穩定。
- 攝影機正對中央車道。
- 道路中央保持空曠。

禁止：

- 出現第三條內部分隔線，形成四個車道。
- 車道數量在影片中變化。
- 道路突然變窄、變寬、分岔或彎曲。
- 不規則路口或複雜交叉道路。
- 影片自行生成遊戲障礙物。

### 5.2 道路與遊戲整合

障礙物由程式即時繪製，並使用同一套 Camera Projection。

影片中的道路須保留足夠清楚的三線道視覺空間，讓 Jump、Duck、Dodge、Smash 與形狀牆等障礙物可以正確疊加。

目前 PoC 的候選 Camera / Motion Profile：

- centerX = 0.5
- horizon = 0.41
- nearHalfWidth = 0.64
- worldSpeed = 5.0

以上只是候選值，尚未鎖定成所有世界的正式 Profile。

未來應以實際素材與遊戲畫面驗證後，再確認統一設定。

## 6. 遠景穩定性規格

**遠景穩定性為所有新背景影片的必要驗收項目。**

這是針對實際循環播放時，遠處雲層微幅移動而造成前後跳動的問題所新增的要求。

### 6.1 天空與雲層

- 天空背景應保持視覺穩定。
- 遠處雲層預設保持近乎靜止。
- 不應有明顯水平飄移。
- 不應有明顯垂直漂浮。
- 不應突然縮放、變形或改變形狀。
- 不應出現雲層忽然靠近或遠離攝影機。
- 雲層的光線與亮度應全片一致。
- 首尾交叉淡化時，雲的位置差異應盡量小。

### 6.2 遠方地景

以下元素也應保持高度穩定：

- 極遠山丘。
- 遠方城堡輪廓。
- 遠方城市天際線。
- 極遠的大型地形。
- 遠處固定建築群。

極遠物件可以存在非常微弱的透視變化，但不可像近景物件一樣快速移動。

### 6.3 視差原則

| 景深層次 | 動態要求 |
|---|---|
| 天空與極遠雲層 | 幾乎固定 |
| 極遠山丘與天際線 | 幾乎固定 |
| 中景建築與植物 | 少量、自然的透視位移 |
| 近景建築與樹木 | 明顯向後經過 |
| 道路與近地面紋理 | 最明顯的前進動態 |

**前進感主要來自道路與中近景，而不是天空或遠景雲層。**

## 7. 場景構圖與景觀配置

### 7.1 中央道路

中央道路保持完全空曠，不得包含：

- 路障。
- 需要跳過的物體。
- 需要蹲下通過的橫樑。
- 需要左右閃避的障礙。
- 形狀牆。
- 可擊碎物件。
- 角色、NPC 或車輛。
- 任何會讓玩家誤認成遊戲任務的物件。

### 7.2 兩側景觀

允許：

- 主題樹木。
- 特色建築。
- 花草與裝飾。
- 遠景山丘。
- 童話世界地標。
- 規律排列的道路邊裝飾。

要求：

- 景觀自然豐富。
- 不同物件的距離與大小合理。
- 近景物件能自然經過攝影機。
- 不讓巨大物件突然遮住整個畫面。
- 不干擾遊戲道路與障礙物。

### 7.3 避免終點式構圖

不應在道路正前方設置會持續接近的城堡、大門、山壁或其他終點地標。

例如糖果王國最初版本曾讓玩家持續接近中央城堡，不適合作為可重複播放的跑酷背景。

遠方可以存在大型建築輪廓，但不應佔據道路中心並逐漸變成無法通過的物件。

## 8. Google Flow 影片生成流程

### 第一階段：靜態參考圖

先建立場景參考圖，再生成影片。

圖片需確認：

- 美術風格正確。
- 16:9 構圖。
- 攝影機視角一致。
- 正確的三線道。
- 兩條內部分隔線。
- 道路筆直、中央空曠。
- 遠景與近景層次合理。
- 沒有會迎面接近的終點地標。
- 天空與遠景適合保持穩定。

參考圖未通過驗收，不進入影片生成。

### 第二階段：Google Flow 影片

目前驗證的生成設定：

- Google Flow。
- Veo 3.1 Lite。
- 16:9。
- 每次生成一支。
- 約 8 秒。
- 使用已確認的靜態參考圖進行 Image-to-Video。

生成 Prompt 必須強調：

- 固定第一人稱攝影機。
- 穩定向前移動。
- 兩條內部分隔線。
- 遠景雲層與天空近乎靜止。
- 路邊物件自然經過。
- 道路保持空曠。
- 沒有鏡頭震動、變焦、轉彎或場景剪接。
- 無角色、無障礙物、無 UI。
- 不需要音樂及音效。

### 第三階段：原片驗收

先檢查原片是否具有正常前進動態、正確道路與穩定遠景。

不應因為影片首尾不完全一致，就直接判定素材失敗。

### 第四階段：影片後製

由 FFmpeg 自動處理：

1. 讀取完整原始影片。
2. 確認實際 FPS 與影格數。
3. 取首尾約 0.333 秒做交叉淡化。
4. 輸出新的循環 MP4。
5. 移除音軌。
6. 使用適合瀏覽器播放的 H.264／yuv420p 格式。
7. 加入 faststart 容器最佳化。
8. 保留原始 MP4，不覆蓋來源。

若原片不是 24 FPS，應換算對應的影格數，以時間長度為主要基準。

## 9. 通用 Google Flow 英文 Prompt

以下為所有世界可共用的影片動態規格。各世界的場景元素與視覺風格由對應世界 Prompt 補充。

```text
Create an approximately 8-second first-person endless runner
background video using the provided reference image.

VISUAL STYLE:
Preserve the polished, colorful, cute stylized 3D cartoon
fantasy adventure appearance of the reference image.

CAMERA:
The camera moves continuously forward at a smooth and constant
running speed, centered on a perfectly straight three-lane road.

Maintain a fixed camera height, fixed field of view,
stable horizon, and consistent central vanishing point.

No turning, panning, tilting, rotation, camera shake,
vertical bouncing, zooming, acceleration, deceleration,
or scene cuts.

ROAD GEOMETRY:
The road must contain exactly THREE lanes,
separated by exactly TWO internal dashed lane-divider lines.

Do not create a third internal divider or four lanes.

Maintain the same road width, lane proportions,
road perspective, and divider count throughout every frame.

Keep all three lanes clear and unobstructed.

FORWARD MOTION:
The road surface and nearby roadside scenery
must move naturally as the camera advances.

Nearby objects should pass backward with realistic
perspective motion and consistent parallax.

Do not simulate forward movement by simply zooming
into a static image.

DISTANT BACKGROUND STABILITY:
Distant clouds, far sky, distant mountains, and very far
background elements should remain visually stable
and nearly static.

No noticeable drifting, shifting, scaling, wobbling,
deformation, or sudden movement of distant clouds.

The distant skyline should maintain stable positions,
shapes, lighting, and color throughout the video.

Forward movement must come primarily from the road
and nearby roadside scenery, not from cloud movement.

LOOP-FRIENDLY DESIGN:
Use naturally repeating roadside scenery
with consistent lighting and visual speed.

Avoid unique central landmarks, approaching destinations,
road endings, or sudden environmental changes.

Keep the distant background as stable as possible
to reduce visible differences when the video loops.

A mathematically perfect seamless loop is not required.

GAMEPLAY RESTRICTIONS:
No characters, vehicles, gameplay obstacles,
barriers, holes, walls, overhead beams,
or objects blocking the road.

No text, logos, HUD, or user interface.

AUDIO:
No dialogue, music, or sound effects.

OUTPUT:
A stable, forward-moving, visually consistent
background video suitable for repeated playback
in a children's motion-controlled endless runner game.
```

## 10. 多場景影片與關卡結構

每個世界由多種景觀片段組成。

例如糖果王國可以包含：

- 棒棒糖森林大道。
- 薑餅村莊。
- 巧克力河畔。
- 糖果花園。
- 棉花糖山谷。

以上為候選景觀，不表示所有場景均已製作或確認。

各片段必須維持：

- 相同的美術風格。
- 相同的基本攝影機視角。
- 相容的三線道幾何。
- 相近的視覺前進速度。
- 相同的遊戲障礙物投影規則。

單支影片可重複播放，正式關卡不受單支影片長度限制。

未來若需要不同影片之間的場景切換，應另外驗證片段銜接品質。首尾交叉淡化只處理各影片本身的循環，不自動保證不同影片之間能自然切換。

各世界彼此獨立選擇，無固定關卡順序或跨世界故事連續性。

## 11. 遊戲整合規則

背景影片只負責視覺。

遊戲程式負責：

- MediaPipe Pose Landmarker。
- Jump、Duck、Dodge 等動作辨識。
- 後續 Smash 與形狀牆玩法。
- 障礙物生成。
- 碰撞判定。
- 分數與生命值。
- 成功、失敗及勝利特效。
- 背景音樂和音效。

### 時間軸

- 使用 Game Clock 作為障礙物與碰撞判定依據。
- 不使用 video.currentTime 作為動作判定時間。
- 影片循環不得重設 Game Clock。
- 影片淡化不改變障礙物排程。
- 遊戲暫停時，背景影片也必須暫停。
- 恢復時遵循原本的倒數與遊戲流程。
- 不因影片循環而重新初始化姿態辨識。

### 音效

- 影片本身保持靜音。
- 背景音樂由遊戲獨立播放。
- Jump、Duck、Dodge、Smash、碰撞及過關音效由遊戲觸發。
- 影片循環不得導致背景音樂重新開始或中斷。

## 12. 素材驗收 Checklist

### A. 靜態參考圖

- [ ] 符合 Cute Stylized 3D Cartoon Fantasy Adventure。
- [ ] 16:9 構圖。
- [ ] 正確三線道。
- [ ] 恰好兩條內部分隔線。
- [ ] 攝影機置中。
- [ ] 道路筆直。
- [ ] 中央沒有障礙物。
- [ ] 沒有會持續接近的終點地標。
- [ ] 遠景與近景層次合理。

### B. 原始影片

- [ ] 攝影機穩定向前。
- [ ] 道路沒有變形或轉彎。
- [ ] 全程維持兩條分隔線。
- [ ] 近景自然經過。
- [ ] 中景視差合理。
- [ ] 遠景雲層幾乎固定。
- [ ] 天空沒有明顯跳動、漂移或變形。
- [ ] 遠方山丘與天際線穩定。
- [ ] 沒有突發障礙物。
- [ ] 沒有劇烈光線變化。
- [ ] 沒有鏡頭震動或變焦。

### C. 淡化處理後影片

- [ ] 使用完整原片，不裁切。
- [ ] 首尾約 0.333 秒交叉淡化。
- [ ] 原始來源檔保留。
- [ ] 輸出影片沒有音軌。
- [ ] H.264／yuv420p 可正常播放。
- [ ] 沒有明顯黑影格。
- [ ] 淡化期間沒有嚴重殘影。
- [ ] 遠景雲層沒有明顯前後跳動。
- [ ] 循環接點在實際遊玩時可接受。

### D. 遊戲整合

- [ ] Jump、Duck、Dodge 障礙物對齊道路。
- [ ] Game Clock 不受循環影響。
- [ ] 暫停與恢復正常。
- [ ] 90～120 秒背景播放穩定。
- [ ] 不出現持續黑畫面或無法恢復的停頓。
- [ ] FPS 與影片播放狀態符合目標裝置需求。
- [ ] MediaPipe 同時運作沒有明顯效能問題。
- [ ] 手機與平板實機通過。
- [ ] 電視鏡像投放體驗可接受。

尚未執行的項目必須明確標記為待驗證，不得直接宣稱通過。

## 13. 世界規劃

目前優先製作的五個世界：

| 世界 | 難度定位 | 主要視覺特色 |
|---|---|---|
| 糖果王國 | ★ | 糖果樹、薑餅屋、粉紅道路 |
| 玩具積木城 | ★ | 彩色積木建築、積木居民，不使用泰迪熊主題 |
| 海底王國 | ★★ | 海底珊瑚、氣泡、繽紛海洋景觀 |
| 恐龍樂園 | ★★★ | 友善恐龍、熱帶植物、彩色恐龍蛋 |
| 未來科技城 | ★★★★ | 明亮科技建築、鮮豔霓虹、未來城市 |

其餘七個保留世界：

- 冰雪王國。
- 海盜寶藏島。
- 彩虹水晶洞。
- 精靈花園。
- 歡樂遊樂園。
- 音樂奇幻國。
- 彩虹水晶城堡。

彩虹水晶城堡採用空中漂浮城堡與彩色空中道路，而非地面道路。

世界難度僅為規劃定位，不代表必須依序遊玩。

## 14. 後續製作與開發流程

標準流程：

**場景規劃 → 靜態圖片生成 → 圖片驗收 → Google Flow 影片生成 → 原片驗收 → FFmpeg 淡化後製 → 循環驗收 → 遊戲整合。**

工程要求：

- 影片後製應能批次自動化。
- 原片與處理後影片分開保存。
- 素材記錄世界、場景、版本、生成工具與 Prompt。
- 不重新對已核准素材進行不必要的反覆生成。
- 每個場景獨立驗收。
- 正式遊戲只使用已通過整合驗收的素材。
- 仍須保留既有 Debug、測試與效能量測功能。

## 15. 已確認與尚待驗證事項

### 已確認

- 採用完整 AI 影片，而非程式化近景取代。
- 使用原始影片首尾交叉淡化。
- 預設淡化時間約 0.333 秒。
- 不進行額外頭尾剪輯。
- 複雜轉場暫停開發。
- 遠景雲層應盡量保持固定。
- 遊戲障礙物與背景影片時間軸分離。
- 各世界獨立，沒有固定故事順序。

### 尚待驗證

- 正式遊戲預設背景整合。
- 新淡化影片的獨立 120 秒長時間測試。
- 各世界影片的統一攝影機 Profile。
- 多支不同場景影片之間的切換方式。
- 手機／平板搭配 MediaPipe 的實際效能。
- 電視投放與兒童實際遊玩體驗。

## 16. 最終製作原則

Shape Quest 的背景影片不是要追求絕對完美的影片循環技術，而是要在有限生成成本下，提供高品質、穩定、自然且可長時間遊玩的兒童奇幻跑酷世界。

**保留精緻的 Google Flow 3D 卡通畫面，以完整原始影片搭配約 0.333 秒首尾交叉淡化作為標準；強化固定攝影機、三線道、近景前進及遠景雲層穩定性，減少循環時容易察覺的跳動。**