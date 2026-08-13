interface AutoscrollerOptions {
  scrollBy: (delta: number) => void;
  onStop?: () => void;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
  now?: () => number;
}

// Frame gaps above this are treated as this long: rAF stops in background tabs,
// and scrolling through the whole gap on the resume frame would jump the text.
export const PACED_SCROLL_MAX_FRAME_MS = 100;

// Auto Scroll reading mode core (#4998): teleprompter-style scrolling at a
// constant caller-set velocity, with pause/resume. Emits whole-pixel forward
// deltas with fractional carry like Autoscroller; the caller owns the scroll
// direction sign. Pure logic with an injectable rAF/clock for tests.
export class PacedScroller {
  #opts: AutoscrollerOptions;
  #active = false;
  #paused = false;
  #velocity = 0;
  #lastTime = 0;
  #residual = 0;
  #frameId: number | null = null;

  constructor(opts: AutoscrollerOptions) {
    this.#opts = opts;
  }

  get active() {
    return this.#active;
  }

  get paused() {
    return this.#paused;
  }

  start(velocity: number) {
    this.stop();
    this.#active = true;
    this.#paused = false;
    this.#velocity = velocity;
    this.#residual = 0;
    this.#resetClockAndRequestFrame();
  }

  setVelocity(velocity: number) {
    this.#velocity = velocity;
  }

  pause() {
    if (!this.#active || this.#paused) return;
    this.#paused = true;
    this.#cancelFrame();
  }

  resume() {
    if (!this.#active || !this.#paused) return;
    this.#paused = false;
    this.#resetClockAndRequestFrame();
  }

  stop() {
    if (!this.#active) return;
    this.#active = false;
    this.#paused = false;
    this.#cancelFrame();
    this.#opts.onStop?.();
  }

  #cancelFrame() {
    if (this.#frameId !== null) {
      (this.#opts.caf ?? cancelAnimationFrame)(this.#frameId);
      this.#frameId = null;
    }
  }

  #resetClockAndRequestFrame() {
    this.#lastTime = (this.#opts.now ?? performance.now.bind(performance))();
    this.#frameId = (this.#opts.raf ?? requestAnimationFrame)((time) => this.#tick(time));
  }

  #tick(time: number) {
    this.#frameId = null;
    if (!this.#active || this.#paused) return;
    const dt = Math.min(Math.max(0, time - this.#lastTime), PACED_SCROLL_MAX_FRAME_MS);
    this.#lastTime = time;
    this.#residual += this.#velocity * (dt / 1000);
    const whole = Math.trunc(this.#residual);
    if (whole !== 0) {
      this.#residual -= whole;
      this.#opts.scrollBy(whole);
      // scrollBy may stop the session (e.g. the book ended); don't re-arm then.
      if (!this.#active || this.#paused) return;
    }
    this.#frameId = (this.#opts.raf ?? requestAnimationFrame)((t) => this.#tick(t));
  }
}
