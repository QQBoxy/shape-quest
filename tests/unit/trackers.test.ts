import { afterEach, expect, it, vi } from "vitest";
import { CONFIG } from "../../src/config";
import { PoseTracker } from "../../src/pose";
import { FaceTracker } from "../../src/face";

const mocks = vi.hoisted(() => ({ files: vi.fn(), pose: vi.fn(), face: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.files },
  PoseLandmarker: { createFromOptions: mocks.pose },
  FaceLandmarker: { createFromOptions: mocks.face },
}));
afterEach(() => vi.resetAllMocks());

for (const [name, Tracker, create] of [["body", PoseTracker, mocks.pose], ["face", FaceTracker, mocks.face]] as const) {
  it(`${name} tracker falls back to CPU and skips duplicate, unready and throttled frames`, async () => {
    mocks.files.mockResolvedValue({});
    const model = {
      detectForVideo: vi.fn(() => ({ landmarks: [], faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] })),
      close: vi.fn(),
    };
    create.mockRejectedValueOnce(new Error("GPU unavailable")).mockResolvedValueOnce(model);
    const tracker = new Tracker();
    const video = { readyState: 1, currentTime: 0, videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    expect(tracker.sample(video, 0)).toBeUndefined();
    await tracker.load();
    expect(create.mock.calls.map(([, options]) => options.baseOptions.delegate)).toEqual(["GPU", "CPU"]);
    expect(tracker.sample(video, 0)).toBeUndefined();
    Object.assign(video, { readyState: 2 });
    tracker.sample(video, 0);
    expect(model.detectForVideo).toHaveBeenCalledTimes(1);
    tracker.sample(video, 1000);
    expect(model.detectForVideo).toHaveBeenCalledTimes(1);
    Object.assign(video, { currentTime: 0.1 });
    tracker.sample(video, 1000 / CONFIG.inferenceFps - 1);
    expect(model.detectForVideo).toHaveBeenCalledTimes(1);
    tracker.sample(video, 1000 / CONFIG.inferenceFps);
    expect(model.detectForVideo).toHaveBeenCalledTimes(2);
    expect(tracker.fps).toBeCloseTo(CONFIG.inferenceFps);
    expect(tracker.inferenceMs).toBeGreaterThanOrEqual(0);
    tracker.close(); tracker.close();
    expect(model.close).toHaveBeenCalledTimes(1);
    expect(tracker.sample(video, 2000)).toBeUndefined();
  });

  it(`${name} tracker propagates failure when both delegates fail`, async () => {
    mocks.files.mockResolvedValue({});
    const error = new Error("model unavailable");
    create.mockRejectedValue(error);
    await expect(new Tracker().load()).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(2);
  });
}
