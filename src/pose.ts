import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { CONFIG, asset } from "./config";
import { mirror, type Point } from "./actions";
export class PoseTracker {
  private model: PoseLandmarker | null = null;
  private lastVideo = -1;
  private lastRun = -Infinity;
  inferenceMs = 0;
  fps = 0;
  async load() {
    const files = await FilesetResolver.forVisionTasks(asset("wasm"));
    const options = {
      baseOptions: {
        modelAssetPath: asset(CONFIG.model),
        delegate: "GPU" as const,
      },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };
    try {
      this.model = await PoseLandmarker.createFromOptions(files, options);
    } catch {
      this.model = await PoseLandmarker.createFromOptions(files, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" },
      });
    }
  }
  sample(video: HTMLVideoElement, now: number): Point[] | undefined {
    if (
      !this.model ||
      video.readyState < 2 ||
      video.currentTime === this.lastVideo ||
      now - this.lastRun < 1000 / CONFIG.inferenceFps
    )
      return;
    const previous = this.lastRun;
    this.lastRun = now;
    this.lastVideo = video.currentTime;
    const start = performance.now();
    const result = this.model.detectForVideo(video, now);
    this.inferenceMs = performance.now() - start;
    if (Number.isFinite(previous)) this.fps = 1000 / (now - previous);
    return mirror(result.landmarks[0] ?? []);
  }
  close() {
    this.model?.close();
    this.model = null;
  }
}
