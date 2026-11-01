export interface SeamSample {
  loop: number;
  activeSeconds: number;
  gapMs: number;
  beforeMedia: number;
  afterMedia: number;
  fullMAE: number;
  roadMAE: number;
}
/** Frame timing only. A small gap never means the images are visually seamless. */
export class VideoMetrics {
  activeSeconds = 0;
  frameCount = 0;
  maxFrameGapMs = 0;
  waiting = 0;
  stalled = 0;
  gapsOver250ms = 0;
  loops: SeamSample[] = [];
  private previous: { wall: number; media: number } | null = null;
  breakSequence() {
    this.previous = null;
  }
  sample(
    wall: number,
    media: number,
    duration: number,
    difference: { fullMAE: number; roadMAE: number },
  ): boolean {
    const previous = this.previous;
    this.previous = { wall, media };
    this.frameCount++;
    if (!previous) return false;
    const gap = wall - previous.wall;
    this.maxFrameGapMs = Math.max(this.maxFrameGapMs, gap);
    if (gap > 250) this.gapsOver250ms++;
    const wrapped = previous.media - media > duration / 2;
    if (wrapped)
      this.loops.push({
        loop: this.loops.length + 1,
        activeSeconds: this.activeSeconds,
        gapMs: gap,
        beforeMedia: previous.media,
        afterMedia: media,
        ...difference,
      });
    return wrapped;
  }
}
