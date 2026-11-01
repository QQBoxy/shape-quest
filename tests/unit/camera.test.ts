import { expect, it, vi } from "vitest";
import { drawCamera } from "../../src/renderer";
import type { Point } from "../../src/actions";

it("draws facial shapes and larger dots only at body joints, excluding fingers and feet tips", () => {
  const context = {
    clearRect: vi.fn(), fillRect: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    bezierCurveTo: vi.fn(), closePath: vi.fn(), ellipse: vi.fn(),
  };
  const canvas = { width: 640, height: 480, getContext: () => context };
  const video = { videoWidth: 640, videoHeight: 480, readyState: 0 };
  const points: Point[] = Array.from({ length: 33 }, (_, i) => ({
    x: 0.3 + i * 0.01, y: 0.3, visibility: 1,
  }));
  const draw = () => drawCamera(
    canvas as unknown as HTMLCanvasElement,
    video as HTMLVideoElement, points, null,
  );
  draw();
  expect(context.moveTo).toHaveBeenCalledWith(320, 0);
  expect(context.lineTo).toHaveBeenCalledWith(320, 480);
  const joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  expect(context.arc).toHaveBeenCalledTimes(joints.length);
  for (const index of joints) {
    expect(context.arc).toHaveBeenCalledWith(
      points[index].x * 640, points[index].y * 480, 4, 0, Math.PI * 2,
    );
  }
  expect(context.bezierCurveTo).toHaveBeenCalledTimes(4);
  expect(context.closePath).toHaveBeenCalledTimes(1);
  expect(context.ellipse).toHaveBeenCalledTimes(1);
  for (const point of points) point.visibility = 0;
  vi.clearAllMocks();
  draw();
  expect(context.arc).not.toHaveBeenCalled();
  expect(context.bezierCurveTo).not.toHaveBeenCalled();
  expect(context.closePath).not.toHaveBeenCalled();
  expect(context.ellipse).not.toHaveBeenCalled();
});

it("opens the requested rear or physical lens at its available minimum zoom", async () => {
  const { openCamera } = await import("../../src/camera");
  const track = {
    stop: vi.fn(), getSettings: () => ({ facingMode: "environment" }),
    getCapabilities: () => ({ zoom: { min: 0.5, max: 4 } }),
    applyConstraints: vi.fn(async () => {}),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const video = { srcObject: null, play: vi.fn(async () => {}) };
  try {
    await openCamera(video as unknown as HTMLVideoElement, () => true, { facingMode: "environment" });
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      video: expect.objectContaining({ facingMode: { exact: "environment" } }),
    }));
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 0.5 }] });
    await openCamera(video as unknown as HTMLVideoElement, () => true, { facingMode: "user", deviceId: "ultra-wide" });
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      video: expect.objectContaining({ deviceId: { exact: "ultra-wide" } }),
    }));
    await expect(openCamera(video as unknown as HTMLVideoElement, () => false)).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stop).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
