import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CONFIG, asset } from "./config";
import { faceFeatures } from "./face-actions";

export class FaceTracker {
  private model: FaceLandmarker | null = null;
  private lastVideo = -1;
  private lastRun = -Infinity;
  inferenceMs = 0;
  fps = 0;
  async load() {
    const files = await FilesetResolver.forVisionTasks(asset("wasm"));
    const options = {
      baseOptions: { modelAssetPath: asset("models/face_landmarker.task"), delegate: "GPU" as const },
      runningMode: "VIDEO" as const, numFaces: 1,
      minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
    };
    try { this.model = await FaceLandmarker.createFromOptions(files, options); }
    catch {
      this.model = await FaceLandmarker.createFromOptions(files, {
        ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" },
      });
    }
  }
  sample(video: HTMLVideoElement, now: number) {
    if (!this.model || video.readyState < 2 || video.currentTime === this.lastVideo ||
        now - this.lastRun < 1000 / CONFIG.inferenceFps) return;
    const previous = this.lastRun;
    this.lastRun = now; this.lastVideo = video.currentTime;
    const start = performance.now();
    const result = this.model.detectForVideo(video, now);
    this.inferenceMs = performance.now() - start;
    if (Number.isFinite(previous)) this.fps = 1000 / (now - previous);
    return faceFeatures(result, video.videoWidth / video.videoHeight);
  }
  close() { this.model?.close(); this.model = null; }
}
