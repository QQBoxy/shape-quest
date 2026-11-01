import { CONFIG, type Projection } from "./config";

export const CANDY_SCENES = {
  lollipop: { label: "棒棒糖森林大道", stem: "l03_candy_001_v2" },
  gingerbread: { label: "薑餅村莊", stem: "l03_candy_002" },
} as const;
export const CANDY_DURATION = 120;
// Reuse the Video Lab calibration for both candy scenes.
export const CANDY_PROJECTION: Projection = {
  ...CONFIG.projection,
  centerX: 0.5,
  horizon: 0.41,
  nearHalfWidth: 0.64,
  speed: 5,
};
