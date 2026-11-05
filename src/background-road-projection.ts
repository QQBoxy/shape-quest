// PoC only. Lane centres are -1, 0, 1; boundaries are -1.5, -0.5, 0.5, 1.5.
// z=1 is the bottom of the viewport, z→∞ converges to the vanishing point.
export type RoadProjection = { vpX: number; vpY: number; width: number };
export function projectRoad(x: number, height: number, z: number, p: RoadProjection, w: number, h: number) {
  const scale = 1 / z;
  return {
    x: (p.vpX + (0.5 - p.vpX + x * p.width / 3) * scale) * w,
    y: (p.vpY + (1 - p.vpY) * scale) * h - height * p.width / 3 * w * scale,
    scale,
  };
}
export const roadDepth = (worldZ: number, distance: number, span: number) =>
  1 + ((worldZ - distance) % span + span) % span;
