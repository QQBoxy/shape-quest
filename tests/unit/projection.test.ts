import { expect, it } from "vitest";
import { project, Renderer } from "../../src/renderer";
import { Game } from "../../src/game";
import { CONFIG } from "../../src/config";
it("uses a single perspective for ground position and size at fixed world speed", () => {
  const near = project(0, 0, CONFIG.projection.near);
  expect(near.x).toBe(640);
  expect(near.y).toBeCloseTo(720);
  const far = project(0, 0, 20);
  expect(far.y).toBeLessThan(near.y);
  expect(far.scale).toBeLessThan(near.scale);
  expect(project(-1, 0, 20).x).toBeLessThan(640);
  expect(project(1, 0, 20).x).toBeGreaterThan(640);
  expect(project(0, 1, 20).y).toBeLessThan(far.y);
});

it("keeps a uniform scene scale on portrait and landscape canvases", () => {
  for (const [clientWidth, clientHeight] of [[390, 844], [844, 390], [1440, 900]]) {
    let transform: number[] = [];
    const canvas = {
      clientWidth, clientHeight, width: 0, height: 0,
      getContext: () => ({
        setTransform: (...values: number[]) => { transform = values; },
        clearRect: () => {},
        beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {},
      }),
    } as unknown as HTMLCanvasElement;
    Object.defineProperty(globalThis, "devicePixelRatio", { value: 2, configurable: true });
    try {
      new Renderer(canvas).draw(new Game(), 0, true);
      expect(canvas.width / canvas.height).toBeCloseTo(16 / 9, 2);
      expect(transform[0]).toBeCloseTo(transform[3], 2);
    } finally { delete (globalThis as any).devicePixelRatio; }
  }
});
