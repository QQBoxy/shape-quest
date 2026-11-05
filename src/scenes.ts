import { CONFIG, type Projection } from "./config";

export const CANDY_SCENES = {
  lollipop: { label: "棒棒糖森林", englishName: "Lollipop Forest", stem: "l03_candy_001_poc_72f19161", fadePrefix: "001-" },
  chocolate: { label: "巧克力河流", englishName: "Chocolate River", stem: "l03_candy_003_poc_9ab4f711", fadePrefix: "003-" },
  gummy: { label: "果凍軟糖城鎮", englishName: "Gummy Candy Town", stem: "l03_candy_004_poc_36c9edb4", fadePrefix: "004-" },
  "cotton-candy": { label: "棉花糖天空", englishName: "Marshmallow Sky", stem: "l03_candy_005_poc_e7e3ab4a", fadePrefix: "005-" },
} as const;
export const CANDY_DURATION = 120;
// Shared Canvas geometry: centered at 45% height, full-width at the near plane.
export const CANDY_PROJECTION: Projection = {
  ...CONFIG.projection,
  centerX: 0.5,
  horizon: 0.45,
  nearHalfWidth: 0.5,
  speed: 5,
};
