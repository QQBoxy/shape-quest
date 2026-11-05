import type { Features, Point } from "./actions";
import { angleDelta, type FaceFeatures } from "./face-actions";

export type CameraSide = "left" | "right";
export function cameraSide(type: string, angle: number): CameraSide {
  // Portrait-natural phones: a 90° screen rotation puts the top camera on the left.
  if (angle % 180 !== 0) return ((angle % 360) + 360) % 360 === 90 ? "left" : "right";
  return type === "landscape-secondary" ? "right" : "left";
}

/** Coordinates use the calibration frame's scale. Distance stays fixed on rotation. */
export class CameraCoordinates {
  private referenceAspect = 0;
  private referenceHeight = 1;
  private rotation = 0;
  private pending = true;
  private lastRoll = 0;
  requestRotation() { this.pending = true; }
  get imageRotation() { return this.rotation; }
  aspect(width: number, height: number) {
    if (!width || !height) return 4 / 3;
    return Math.abs(this.rotation / 90) % 2 === 1 ? height / width : width / height;
  }
  private geometry(width: number, height: number, rotation: number) {
    const swapped = Math.abs(rotation / 90) % 2 === 1;
    const w = swapped ? height : width, h = swapped ? width : height;
    this.referenceAspect ||= w / h;
    if (!this.referenceSet) { this.referenceHeight = h / Math.min(w, h); this.referenceSet = true; }
    return { aspect: w / h, scale: h / Math.min(w, h) / this.referenceHeight };
  }
  private referenceSet = false;
  face(f: FaceFeatures, width: number, height: number): FaceFeatures {
    if (!width || !height) return f;
    if (this.pending) {
      // Browsers usually deliver upright frames already. Only compensate residual
      // quarter turns seen in the model after a device/video orientation change.
      // ponytail: assumes a comfortable head tilt (<45° from the previous pose);
      // use explicit frame-rotation metadata if a browser exposes it in the future.
      this.rotation = Math.round(angleDelta(f.roll, this.lastRoll) / 90) * 90;
      this.pending = false;
    }
    const a = this.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const rawAspect = width / height;
    const x = f.x - rawAspect / 2, y = f.y - .5;
    this.geometry(width, height, this.rotation);
    const rawScale = height / Math.min(width, height) / this.referenceHeight;
    // Apply camera-Z rotation to the first basis vector of Rz(-roll) Ry(yaw) Rx(pitch).
    // The Z row is unchanged, so yaw/pitch and expression channels remain invariant.
    const r = -f.roll * Math.PI / 180;
    const m00 = Math.cos(r), m10 = Math.sin(r);
    const roll = -Math.atan2(s * m00 + c * m10, c * m00 - s * m10) * 180 / Math.PI;
    this.lastRoll = roll;
    return { ...f, x: (c * x - s * y) * rawScale + this.referenceAspect / 2,
      y: (s * x + c * y) * rawScale + .5, size: f.size * rawScale, roll };
  }
  pose(points: Point[], width: number, height: number) {
    if (!width || !height) return { points, aspect: 4 / 3 };
    if (this.pending && points[11] && points[12]) {
      const dx = (points[12].x - points[11].x) * width;
      const dy = (points[12].y - points[11].y) * height;
      this.rotation = -Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 90) * 90;
      this.pending = false;
    }
    const a = this.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const swapped = Math.abs(this.rotation / 90) % 2 === 1;
    const w = swapped ? height : width, h = swapped ? width : height;
    this.geometry(width, height, this.rotation);
    return { points: points.map(p => {
      const x = (p.x - .5) * width, y = (p.y - .5) * height;
      return { ...p, x: (c * x - s * y) / w + .5, y: (s * x + c * y) / h + .5 };
    }), aspect: w / h };
  }
  body(f: Features, aspect: number): Features {
    const { scale } = this.geometry(aspect, 1, 0);
    return { ...f, hipX: (f.hipX - .5) * aspect * scale / this.referenceAspect + .5,
      hipY: (f.hipY - .5) * scale + .5, shoulderY: (f.shoulderY - .5) * scale + .5,
      feetY: (f.feetY - .5) * scale + .5, height: f.height * scale };
  }
  bodyRange(range: number, aspect: number) {
    const { scale } = this.geometry(aspect, 1, 0);
    return range * this.referenceAspect / (aspect * scale);
  }
  bodyPreview<T extends Features & { leftLimit: number; rightLimit: number }>(f: T, aspect: number): T {
    const { scale } = this.geometry(aspect, 1, 0);
    const x = (n: number) => (n - .5) * this.referenceAspect / (aspect * scale) + .5;
    return { ...f, hipX: x(f.hipX), hipY: (f.hipY - .5) / scale + .5,
      height: f.height / scale, leftLimit: x(f.leftLimit), rightLimit: x(f.rightLimit) };
  }
}

/** Draw the same mirrored, upright image used by recognition. */
export function drawCameraImage(c: CanvasRenderingContext2D, video: HTMLVideoElement,
  x: number, y: number, width: number, height: number, rotation = 0, contain = true) {
  const swapped = Math.abs(rotation / 90) % 2 === 1;
  const w = swapped ? video.videoHeight : video.videoWidth;
  const h = swapped ? video.videoWidth : video.videoHeight;
  const scale = (contain ? Math.min : Math.max)(width / w, height / h);
  c.save(); c.translate(x + width / 2, y + height / 2);
  c.scale(scale, scale); c.rotate(rotation * Math.PI / 180); c.scale(-1, 1);
  c.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
  c.restore();
}
