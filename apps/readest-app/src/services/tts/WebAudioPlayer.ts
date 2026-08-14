// Shared Web Audio context plus an inaudible background keep-alive tone,
// used by the TTS session to stay schedulable while backgrounded.
//
// The real AudioContext is a MODULE-LEVEL SINGLETON, never closed: WebKit
// caps live AudioContexts (~4 on iOS) — per-session contexts would leak until
// a new one is born suspended and TTS goes silent.

export interface TTSAudioContext {
  readonly currentTime: number;
  readonly state: string; // 'running' | 'suspended' | 'interrupted' | 'closed'
  readonly destination: unknown;
  onstatechange: (() => void) | null;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

let sharedContext: TTSAudioContext | null = null;

const getSharedContext = (): TTSAudioContext => {
  if (!sharedContext) {
    sharedContext = new AudioContext() as unknown as TTSAudioContext;
  }
  return sharedContext;
};

// Warm up (create + resume) the shared context. Call this synchronously in a
// user-gesture handler: speak() itself runs after network awaits, outside
// WebKit's gesture window, where resume() can be rejected by autoplay policy.
export const ensureSharedAudioContext = async (): Promise<void> => {
  if (typeof AudioContext === 'undefined') return;
  try {
    const ctx = getSharedContext();
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
  } catch (err) {
    console.warn('[TTS] audio context warmup failed', err);
  }
};

// Inaudible background keep-alive for a page that must stay schedulable.
//
// When the app is backgrounded (or the screen locks) the WebView page becomes
// hidden, and Chromium throttles — then outright freezes — a hidden page's
// timers and task queues. A page that is emitting audio is exempt: that is
// precisely why Edge TTS keeps reading with the screen off (its speech is
// audible WebAudio output) while system TTS stops after a page. Merely having a
// running-but-idle context does NOT earn the exemption — Chromium keys off
// actual, non-silent output — so we play a continuous 40 Hz tone at ~-62 dBFS:
// below the reach of phone speakers and masked to inaudibility by the speech,
// but non-silent enough to keep the page "audible" and its timers alive.
//
// Two things depend on it: the JS-driven per-sentence auto-advance loop that
// direct-speak engines rely on while playing (#4408), and — for EVERY engine —
// the media-session transport handlers of a *paused* session, which live in the
// page even though the notification itself is served by the native foreground
// service (#5561).
const KEEP_ALIVE_FREQ_HZ = 40;
const KEEP_ALIVE_GAIN = 0.0008;
let keepAliveCtx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let keepAliveGain: GainNode | null = null;

export const startAudioKeepAlive = (): void => {
  if (typeof AudioContext === 'undefined') return;
  if (keepAliveOsc) return;
  try {
    // A context of its OWN, never the shared one: a paused session may
    // suspend the shared context, which would silence the tone exactly when
    // a paused session needs it — and resuming that context to feed the tone
    // would un-pause the speech.
    if (!keepAliveCtx) keepAliveCtx = new AudioContext();
    const ctx = keepAliveCtx;
    // TTS only ever starts from a user gesture, so the page has sticky
    // activation and the context comes up running; nudge it best-effort in
    // case autoplay policy left it suspended.
    if (ctx.state !== 'running') void ctx.resume();
    const osc = ctx.createOscillator();
    osc.frequency.value = KEEP_ALIVE_FREQ_HZ;
    const gain = ctx.createGain();
    gain.gain.value = KEEP_ALIVE_GAIN;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    keepAliveOsc = osc;
    keepAliveGain = gain;
  } catch (err) {
    console.warn('[TTS] audio keep-alive start failed', err);
  }
};

export const stopAudioKeepAlive = (): void => {
  if (!keepAliveOsc && !keepAliveGain) return;
  try {
    keepAliveOsc?.stop();
    keepAliveOsc?.disconnect();
    keepAliveGain?.disconnect();
    // Close rather than suspend: an idle-but-running context still renders
    // silence to an open output stream, and unlike the shared context this one
    // has no other use. A later start() builds a fresh one, which is also the
    // path that has to work when Pause arrives with the app already hidden.
    void keepAliveCtx?.close();
  } catch (err) {
    console.warn('[TTS] audio keep-alive stop failed', err);
  }
  keepAliveCtx = null;
  keepAliveOsc = null;
  keepAliveGain = null;
};
