import { expect, it } from "vitest";
import { CameraCoordinates, cameraSide } from "../../src/camera-orientation";
import { features, type Point } from "../../src/actions";
import { FaceCalibration, type FaceFeatures } from "../../src/face-actions";

const face = { x: .35, y: .4, size: .2, roll: 3, yaw: 12, pitch: -9,
  jaw: .06, lipGap: .005, eyesValid: true, eyeLeft: .1, eyeRight: .1,
  blinkLeft: .05, blinkRight: .05, apertureLeft: .2, apertureRight: .2,
  browInner: .02, browLeft: .02, browRight: .02, browsValid: true } satisfies FaceFeatures;

it("maps both landscape rotations and supports primary/secondary fallbacks", () => {
  expect(cameraSide("landscape-primary", 90)).toBe("left");
  expect(cameraSide("landscape-secondary", 270)).toBe("right");
  expect(cameraSide("landscape-secondary", -90)).toBe("right");
  expect(cameraSide("landscape-secondary", 0)).toBe("right");
});

for (const rotation of [0, 90, -90, 180]) it(`keeps face angles, size and expression thresholds through ${rotation}° residual video rotation`, () => {
  const coordinates = new CameraCoordinates();
  const reference = coordinates.face(face, 480, 640);
  const c = Math.cos(-rotation * Math.PI / 180), s = Math.sin(-rotation * Math.PI / 180);
  const x = (face.x - .75 / 2) * 640, y = (face.y - .5) * 640;
  const width = rotation % 180 ? 640 : 480, height = rotation % 180 ? 480 : 640;
  const raw = { ...face, x: (c * x - s * y) / height + width / height / 2,
    y: (s * x + c * y) / height + .5, size: face.size * 640 / height, roll: face.roll + rotation };
  coordinates.requestRotation();
  const adjusted = coordinates.face(raw, width, height);
  for (const key of ["x", "y", "size", "roll", "yaw", "pitch", "jaw", "lipGap"] as const)
    expect(adjusted[key]).toBeCloseTo(reference[key]!);
});

it("does not rotate a frame that the browser has already made upright", () => {
  const coordinates = new CameraCoordinates();
  coordinates.face(face, 480, 640);
  coordinates.requestRotation();
  const adjusted = coordinates.face({ ...face,
    x: (face.x - .375) * 640 / 480 + 640 / 480 / 2,
    y: (face.y - .5) * 640 / 480 + .5, size: face.size * 640 / 480,
  }, 640, 480);
  for (const key of ["x", "y", "size", "roll", "yaw", "pitch"] as const) expect(adjusted[key]).toBeCloseTo(face[key]);
});

it("preserves body calibration units when dimensions swap and on a 180° flip", () => {
  const coordinates = new CameraCoordinates();
  const points: Point[] = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
  points[0].y = .1;
  for (const [i,x,y] of [[11,.43,.3],[12,.57,.3],[23,.43,.55],[24,.57,.55],[25,.43,.73],[26,.57,.73],[27,.43,.9],[28,.57,.9]]) points[i] = {x,y,visibility:1};
  const original = coordinates.pose(points, 640, 480);
  const baseline = coordinates.body(features(original.points, original.aspect)!, original.aspect);
  for (const angle of [0,90,-90,180,0]) {
    const width = angle % 180 ? 480 : 640, height = angle % 180 ? 640 : 480;
    const c = Math.cos(-angle * Math.PI / 180), s = Math.sin(-angle * Math.PI / 180);
    const raw = points.map(p => {
      const x = (p.x-.5)*640, y=(p.y-.5)*480;
      return {...p,x:(c*x-s*y)/width+.5,y:(s*x+c*y)/height+.5};
    });
    coordinates.requestRotation();
    const oriented = coordinates.pose(raw,width,height);
    const result = coordinates.body(features(oriented.points,oriented.aspect)!,oriented.aspect);
    for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) expect(result[key]).toBeCloseTo(baseline[key]);
  }
});

it("interrupts an unfinished lesson without discarding the baseline, profile or completed steps", () => {
  const calibration = new FaceCalibration(); calibration.start();
  for (let now = 0; now <= 2000; now += 50) calibration.update(face, now);
  expect(calibration.step).toBe(1);
  const baseline = calibration.baseline, profile = calibration.profile;
  calibration.interrupt();
  expect(calibration.baseline).toBe(baseline); expect(calibration.profile).toBe(profile);
  expect(calibration.step).toBe(1); expect(calibration.started).toBe(true);
  expect(calibration.progress).toBe(0);
});

it("projects the recovery band and baseline guides back into the rotated preview", () => {
  const coordinates = new CameraCoordinates();
  coordinates.face(face, 640, 480);
  const baseline = { hipX: .5, hipY: .55, shoulderY: .3, feetY: .9, height: .8, knee: 3,
    leftLimit: .35, rightLimit: .65 };
  const preview = coordinates.bodyPreview(baseline, .75);
  expect(preview.leftLimit).toBeCloseTo(.3);
  expect(preview.rightLimit).toBeCloseTo(.7);
  expect(coordinates.bodyRange(.11 * baseline.height, .75)).toBeCloseTo(.11 * .8 * 4 / 3);
});
