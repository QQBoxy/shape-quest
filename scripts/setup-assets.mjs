import {
  mkdir,
  cp,
  access,
  readFile,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const modelURL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
await mkdir("public/models", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/wasm", {
  recursive: true,
});
const target = "public/models/pose_landmarker_lite.task";
try {
  await access(target);
} catch {
  console.log("Downloading version 1 Pose Landmarker Lite model…");
  const response = await fetch(modelURL, {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length < 1_000_000) throw new Error("Model download is incomplete.");
  await writeFile(`${target}.tmp`, data);
  await rename(`${target}.tmp`, target);
}
const hash = createHash("sha256")
  .update(await readFile(target))
  .digest("hex");
const expected =
  "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a";
if (expected && hash !== expected) {
  await rm(target);
  throw new Error(
    "Model checksum mismatch. Run npm run setup to download again.",
  );
}
console.log(
  `Pose model ready (SHA-256 ${hash}). WASM copied from the locked npm package.`,
);

const faceTarget = "public/models/face_landmarker.task";
const faceHash = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";
try { await access(faceTarget); }
catch {
  console.log("Downloading version 1 Face Landmarker model…");
  const response = await fetch("https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Face model download failed: ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (createHash("sha256").update(data).digest("hex") !== faceHash)
    throw new Error("Face model checksum mismatch. Run npm run setup again.");
  await writeFile(`${faceTarget}.tmp`, data);
  await rename(`${faceTarget}.tmp`, faceTarget);
}
if (createHash("sha256").update(await readFile(faceTarget)).digest("hex") !== faceHash) {
  await rm(faceTarget);
  throw new Error("Face model checksum mismatch. Run npm run setup again.");
}
console.log(`Face model ready (SHA-256 ${faceHash}).`);
