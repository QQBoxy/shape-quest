import { CONFIG, type Projection } from "./config";

export const CANDY_SCENES = {
  lollipop: { label: "棒棒糖森林大道", englishName: "Lollipop Forest Avenue", stem: "l03_candy_001_v2", fadePrefix: "v2-" },
  chocolate: { label: "巧克力湖畔", englishName: "Chocolate Lakeside", stem: "l03_candy_003", fadePrefix: "003-" },
  gummy: { label: "果凍軟糖城", englishName: "Gummy Jelly Town", stem: "l03_candy_004", fadePrefix: "004-" },
  "cotton-candy": { label: "棉花糖森林", englishName: "Cotton Candy Forest", stem: "l03_candy_005_v2", fadePrefix: "005-v2-" },
} as const;
export const CANDY_DURATION = 120;
// Reuse the Video Lab calibration for the candy kingdom scenes.
export const CANDY_PROJECTION: Projection = {
  ...CONFIG.projection,
  centerX: 0.5,
  horizon: 0.41,
  nearHalfWidth: 0.64,
  speed: 5,
};
