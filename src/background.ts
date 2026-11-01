export class Background {
  url: string | null = null;
  status = "程式草原 · 等待正式影片";
  private preparing = false;
  private playPending = false;
  private shouldPlay = false;
  private objectUrl = false;
  constructor(readonly video: HTMLVideoElement) {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener("error", () => {
      // choose() handles its own load failure; runtime decode errors use the fallback.
      if (this.preparing) return;
      this.status = "影片載入／解碼失敗，已切回程式背景";
      this.clear();
    });
  }
  async choose(file: File) {
    if (!/^video\//.test(file.type) && !/\.mp4$/i.test(file.name))
      throw new Error("請選擇 MP4 影片檔。");
    return this.prepare(
      URL.createObjectURL(file),
      `候選素材：${file.name}（未驗收）`,
      true,
    );
  }
  async load(path: string, label: string) {
    return this.prepare(path, `候選素材：${label}（未驗收）`, false);
  }
  private async prepare(path: string, label: string, objectUrl: boolean) {
    this.clear();
    this.objectUrl = objectUrl;
    this.preparing = true;
    this.url = path;
    this.status = label;
    this.video.playbackRate = 1;
    this.video.muted = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const clean = () => {
          clearTimeout(timeout);
          this.video.removeEventListener("loadeddata", ready);
          this.video.removeEventListener("error", failed);
        };
        const ready = () => {
          clean();
          resolve();
        };
        const failed = () => {
          clean();
          reject(new Error("影片載入或解碼失敗"));
        };
        const timeout = setTimeout(failed, 15000);
        this.video.addEventListener("loadeddata", ready);
        this.video.addEventListener("error", failed);
        this.video.preload = "auto";
        this.video.src = this.url!;
        this.video.load();
      });
      if (
        Math.abs(this.video.videoWidth / this.video.videoHeight - 16 / 9) >
        0.035
      )
        throw new Error(
          "候選影片需使用 16:9 橫向比例，才能與道路格線共用座標。",
        );
      this.preparing = false;
      // Playback follows the game clock, even when a file is selected while paused.
      this.sync(this.shouldPlay);
    } catch (error) {
      this.preparing = false;
      this.status = "影片載入／解碼失敗，已切回程式背景";
      this.clear();
      throw error;
    }
  }
  sync(playing: boolean) {
    this.shouldPlay = playing;
    if (!this.url || this.preparing) return;
    this.video.playbackRate = 1;
    if (!playing) {
      this.video.pause();
      return;
    }
    if (!this.video.paused || this.playPending) return;
    const source = this.url;
    this.playPending = true;
    void this.video
      .play()
      .catch((error) => {
        if (
          this.url !== source ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        this.status = "影片無法播放，已切回程式背景";
        this.clear();
      })
      .finally(() => {
        this.playPending = false;
      });
  }
  clear() {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.url && this.objectUrl) URL.revokeObjectURL(this.url);
    this.url = null;
    this.objectUrl = false;
  }
  get visible() {
    // A native loop seek can briefly lower readyState. Keep the loaded video
    // visible until an explicit clear/load failure instead of flashing scenery.
    return !!this.url && !this.preparing;
  }
}
