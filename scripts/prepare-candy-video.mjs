import { readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Only the four approved source clips live here. Originals are never overwritten.
const dir = "public/videos/level-03";
const presets = process.argv.includes("--fade-presets");
for (const flag of process.argv.slice(2)) {
  if (flag !== "--fade-presets") throw new Error(`Unsupported option: ${flag}`);
}
mkdirSync(`${dir}/fades`, { recursive: true });
for (const source of readdirSync(dir).filter(name => /_poc_[a-f0-9]+\.mp4$/.test(name))) {
  const stem = source.slice(0, -4);
  const stream = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", `${dir}/${source}`,
  ], { encoding: "utf8" })).streams[0];
  const [num, den] = stream.avg_frame_rate.split("/").map(Number);
  const fps = num / den, frames = Number(stream.nb_frames);
  for (const overlap of presets ? [4, 8, 12, 16, 20, 24] : [8]) {
    const output = overlap === 8 ? `${dir}/${stem}_original_xfade.mp4`
      : `${dir}/fades/${stem.match(/candy_(\d+)/)[1]}-original-${overlap}.mp4`;
    // Existing offline cyclic crossfade: overlap complete source frames, no seam trimming.
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
      "-i", `${dir}/${source}`, "-i", `${dir}/${source}`, "-filter_complex",
      `[0:v][1:v]xfade=transition=fade:duration=${overlap / fps}:offset=${(frames - overlap) / fps},trim=start=${overlap / fps}:end=${frames / fps},setpts=PTS-STARTPTS[v]`,
      "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
    ], { stdio: "inherit" });
    console.log(output);
  }
}
