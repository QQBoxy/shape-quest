export const CONFIG = {
  duration: 60,
  hearts: 3,
  healthPerHeart: 3,
  invincible: 1.5,
  score: 100,
  countdown: 3,
  recoveryStableMs: 700,
  trackingLostMs: 1500,
  poseStaleMs: 350,
  preview: 3,
  firstCollision: 5,
  obstacleGap: 4,
  windows: { jump: 0.6, duck: 0.6, left: 0.6, right: 0.6,
    pose_t: 1.6, pose_lunge: 1.6, pose_knee: 1.6, pose_arms_l: 1.6,
    pose_side_bend: 1.6, pose_tree: 1.6, smash: 6 },
  inferenceFps: 18,
  visibility: 0.55,
  border: 0.015,
  calibrationMs: 1800,
  setupCenterRange: 0.04,
  calibrationMinSamples: 20,
  neutralRange: 0.065,
  jumpHip: 0.075,
  jumpFeet: 0.025,
  duckHip: 0.1,
  duckShoulder: 0.06,
  duckKnee: 0.15,
  dodgeMaxVertical: 0.09,
  dodge: 0.13,
  neutralHip: 0.065,
  returnRange: 0.11,
  neutralFeet: 0.08,
  neutralShoulder: 0.08,
  holdMs: 110,
  returnMs: 170,
  camera: { width: 640, height: 480 },
  projection: {
    centerX: 0.5,
    horizon: 0.42,
    nearHalfWidth: 0.46,
    focal: 0.85,
    speed: 6,
    near: 2,
  },
  model: "models/pose_landmarker_lite.task",
} as const;
export const ACTIONS = ["jump", "duck", "left", "right"] as const;
export const FACE_ACTIONS = [...ACTIONS, "pose_t", "pose_lunge", "pose_knee",
  "pose_arms_l", "pose_side_bend", "pose_tree", "smash"] as const;
export type Action = (typeof FACE_ACTIONS)[number];
export const LABEL: Record<Action, string> = {
  jump: "跳起來",
  duck: "蹲低低",
  left: "往左跨",
  right: "往右跨",
  pose_t: "T 字站姿",
  pose_lunge: "弓箭步舉手",
  pose_knee: "雙手打開、單腳抬膝",
  pose_arms_l: "雙臂 L 型上舉",
  pose_side_bend: "身體側彎伸展",
  pose_tree: "瑜珈樹式",
  smash: "連續出拳",
};
export const KEY: Record<string, Action> = {
  ArrowUp: "jump",
  " ": "jump",
  ArrowDown: "duck",
  ArrowLeft: "left",
  ArrowRight: "right",
};
export const asset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

export type Projection = {
  -readonly [P in keyof typeof CONFIG.projection]: number;
};

export const actionPreview = (action: Action) => Math.max(CONFIG.preview, CONFIG.windows[action]);
