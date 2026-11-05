import { afterEach, expect, it, vi } from "vitest";
import { Background } from "../../src/background";

function fixture() {
  const video = Object.assign(new EventTarget(), {
    muted: false, loop: false, playsInline: false, paused: true,
    readyState: 2, videoWidth: 1280, videoHeight: 720, playbackRate: 1, src: "",
    play: vi.fn(async () => {}), pause: vi.fn(), load: vi.fn(),
    removeAttribute: vi.fn(),
  });
  return { video, background: new Background(video as unknown as HTMLVideoElement) };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it("loads muted inline video, follows the requested clock and stays visible during loop seeks", async () => {
  const { video, background } = fixture();
  expect(video.muted && video.loop && video.playsInline).toBe(true);
  background.sync(true);
  const loading = background.load("candy.mp4", "糖果");
  expect(background.visible).toBe(false);
  expect(video.play).not.toHaveBeenCalled();
  video.dispatchEvent(new Event("loadeddata"));
  await loading;
  expect(background.visible).toBe(true);
  expect(video.play).toHaveBeenCalledTimes(1);
  video.readyState = 1;
  expect(background.visible).toBe(true);
  background.sync(false);
  expect(video.pause).toHaveBeenCalled();
  video.dispatchEvent(new Event("error"));
  expect(background.visible).toBe(false);
  expect(background.status).toContain("失敗");
});

it("revokes uploaded object URLs after replacement or explicit clearing", async () => {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const { video, background } = fixture();
  await expect(background.choose(new File(["x"], "bad.txt", { type: "text/plain" }))).rejects.toThrow("MP4");
  expect(create).not.toHaveBeenCalled();
  const upload = background.choose(new File(["x"], "candy.mp4"));
  video.dispatchEvent(new Event("loadeddata"));
  await upload;
  const replacement = background.load("candy.mp4", "糖果");
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:test");
  video.dispatchEvent(new Event("loadeddata"));
  await replacement;
  background.clear();
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(background.url).toBeNull();
});

it.each(["error", "aspect", "timeout"])("cleans up a %s failure and can load again", async failure => {
  vi.useFakeTimers();
  const { video, background } = fixture();
  const loading = background.load("bad.mp4", "失敗素材");
  const rejected = expect(loading).rejects.toThrow();
  if (failure === "timeout") await vi.advanceTimersByTimeAsync(15000);
  else {
    if (failure === "aspect") video.videoWidth = 720;
    video.dispatchEvent(new Event(failure === "error" ? "error" : "loadeddata"));
  }
  await rejected;
  expect(background.visible).toBe(false);
  expect(background.url).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  video.videoWidth = 1280;
  const retry = background.load("good.mp4", "重試");
  video.dispatchEvent(new Event("loadeddata"));
  await retry;
  expect(background.visible).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([true, false])("handles aborted=%s playback without retry storms", async aborted => {
  const { video, background } = fixture();
  let rejectPlay!: (error: Error) => void;
  video.play.mockImplementation(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
  const loading = background.load("candy.mp4", "糖果");
  video.dispatchEvent(new Event("loadeddata"));
  await loading;
  background.sync(true);
  background.sync(true);
  expect(video.play).toHaveBeenCalledTimes(1);
  rejectPlay(aborted ? new DOMException("cancelled", "AbortError") : new Error("decode failed"));
  await vi.waitFor(() => {
    if (aborted) {
      background.sync(true);
      expect(video.play).toHaveBeenCalledTimes(2);
    } else expect(background.visible).toBe(false);
  });
  expect(background.visible).toBe(aborted);
  if (!aborted) expect(background.status).toContain("無法播放");
});

it("ignores a pending play rejection from a replaced source", async () => {
  const { video, background } = fixture();
  let rejectPlay!: (error: Error) => void;
  video.play.mockImplementation(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
  let loading = background.load("old.mp4", "舊片");
  video.dispatchEvent(new Event("loadeddata")); await loading;
  background.sync(true);
  loading = background.load("new.mp4", "新片");
  video.dispatchEvent(new Event("loadeddata")); await loading;
  rejectPlay(new Error("old source failed"));
  await Promise.resolve(); await Promise.resolve();
  expect(background.url).toBe("new.mp4");
  expect(background.visible).toBe(true);
});
