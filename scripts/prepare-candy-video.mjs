import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "public/videos/level-03";
const gingerbread = process.argv.includes("--gingerbread");
const chocolate = process.argv.includes("--chocolate");
const gummy = process.argv.includes("--gummy");
const cottonCandy = process.argv.includes("--cotton-candy");
const fullSource = gingerbread || chocolate || gummy || cottonCandy;
const v2 = process.argv.includes("--v2");
const stem = cottonCandy ? "l03_candy_005_v2" : gummy ? "l03_candy_004" : chocolate ? "l03_candy_003" : gingerbread ? "l03_candy_002" : v2 ? "l03_candy_001_v2" : "l03_candy_001";
const prefix = cottonCandy ? "005-v2-" : gummy ? "004-" : chocolate ? "003-" : gingerbread ? "002-" : v2 ? "v2-" : "";
const source = `${dir}/${stem}.mp4`;
const probe = fullSource ? JSON.parse(execFileSync("ffprobe", [
  "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", source,
], { encoding: "utf8" })).streams[0] : null;
const report = fullSource ? {
  source, videoFrames: Number(probe.nb_frames),
  fps: probe.avg_frame_rate.split("/").map(Number).reduce((a, b) => a / b),
  bestTrim: { startFrame: 0, lastFrame: Number(probe.nb_frames) - 1 },
} : JSON.parse(
  readFileSync(v2 ? "docs/hybrid-tests/candy-v2/offline-analysis.json" : "docs/video-tests/l03-candy-001/offline-analysis.json", "utf8"),
);
const { startFrame, lastFrame } = report.bestTrim;
const fps = report.fps,
  frames = lastFrame - startFrame + 1,
  fadeFrames = 8;
const trim = `${dir}/${stem}_trim.mp4`;
const crossfade = `${dir}/${stem}_xfade.mp4`;
mkdirSync(dir, { recursive: true });
const run = (args) =>
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
const encode = [
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
];
const originalFade = `${dir}/${stem}_original_xfade.mp4`;
if (process.argv.includes("--fade-presets")) {
  mkdirSync(`${dir}/fades`, { recursive: true });
  for (const count of [4, 12, 16, 20, 24]) {
    bakeFade(report.source, report.videoFrames, `${dir}/fades/${prefix}original-${count}.mp4`, count);
    if (!fullSource) bakeFade(trim, frames, `${dir}/fades/${prefix}trim-${count}.mp4`, count);
  }
  process.exit(0);
}
if (fullSource || process.argv.includes("--original-fade-only")) {
  bakeFade(report.source, report.videoFrames, originalFade);
  console.log(JSON.stringify({ originalFade, sourceFrames: report.videoFrames, fadeFrames, outputFrames: report.videoFrames - fadeFrames }, null, 2));
  process.exit(0);
}
run([
  "-i",
  report.source,
  "-vf",
  `trim=start_frame=${startFrame}:end_frame=${lastFrame + 1},setpts=PTS-STARTPTS`,
  ...encode,
  trim,
]);
// Bake the cyclic seam offline. Runtime remains a single HTML video.
function bakeFade(input, frameCount, output, overlap = fadeFrames) {
  run([
    "-i", input, "-i", input,
    "-filter_complex",
    `[0:v][1:v]xfade=transition=fade:duration=${overlap / fps}:offset=${(frameCount - overlap) / fps},trim=start=${overlap / fps}:end=${frameCount / fps},setpts=PTS-STARTPTS[v]`,
    "-map", "[v]", ...encode, output,
  ]);
}
bakeFade(trim, frames, crossfade);
console.log(
  JSON.stringify(
    {
      trim,
      crossfade,
      trimFrames: frames,
      fadeFrames,
      crossfadeFrames: frames - fadeFrames,
    },
    null,
    2,
  ),
);
