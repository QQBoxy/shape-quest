export class Background {
  url: string | null = null;
  status = "程式動態背景 · 陽光草原";
  private preparing = false;
  private playPending = false;
  private shouldPlay = false;
  private objectUrl = false;
  private incoming: Background | null = null;
  private loadVersion = 0;
  private onError = () => {
    if (this.preparing) return;
    this.status = "影片載入／解碼失敗，已切回程式背景";
    this.clear();
  };
  constructor(public video: HTMLVideoElement) {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener("error", this.onError);
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
    return this.prepare(path, label, false);
  }
  async transition(path: string, label: string, seconds = 1 / 3) {
    if (!this.visible || !this.video.parentElement) return this.load(path, label);
    const version = ++this.loadVersion, began = performance.now();
    const old = this.video;
    const next = document.createElement("video");
    next.className = old.className;
    next.id = `${old.id}-incoming`;
    next.style.opacity = "0";
    next.style.pointerEvents = "none";
    old.after(next);
    const prepared = new Background(next);
    this.incoming = prepared;
    try {
      await prepared.load(path, label);
      const loadMs = performance.now() - began;
      if (version !== this.loadVersion) throw new DOMException("Scene load cancelled", "AbortError");
      prepared.sync(this.shouldPlay);
      if (this.shouldPlay && typeof next.requestVideoFrameCallback === "function") await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("新場景影格等待逾時")), 5000);
        next.requestVideoFrameCallback(() => { clearTimeout(timeout); resolve(); });
      });
      const firstFrameMs = performance.now() - began;
      // Fade only the new opaque frame over the still-playing old clip. This
      // keeps the combined background opaque and leaves the game clock alone.
      const animation = next.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: seconds * 1000, fill: "forwards", easing: "linear",
      });
      await animation.finished;
      if (version !== this.loadVersion) throw new DOMException("Scene load cancelled", "AbortError");
      prepared.video.removeEventListener("error", prepared.onError);
      old.removeEventListener("error", this.onError);
      const id = old.id;
      old.pause(); old.removeAttribute("src"); old.load(); old.remove();
      if (this.url && this.objectUrl) URL.revokeObjectURL(this.url);
      this.video = next; this.url = path; this.status = label; this.objectUrl = false;
      next.id = id; next.style.opacity = "1"; animation.cancel();
      next.addEventListener("error", this.onError);
      return { loadMs, firstFrameMs, transitionMs: performance.now() - began };
    } catch (error) {
      prepared.clear(); next.remove();
      throw error;
    } finally { if (this.incoming === prepared) this.incoming = null; }
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
    this.incoming?.sync(playing);
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
    this.loadVersion++;
    if (this.incoming) { this.incoming.clear(); this.incoming.video.remove(); this.incoming = null; }
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
