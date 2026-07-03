import { Origin } from "./types";

/**
 * Per-session behavioural baseline (TS port of `baseline.rs`).
 *
 * Tracks how the developer normally works so the report can show drift:
 * typing cadence, and the running mix of typed / pasted / ai lines.
 * Everything is in-memory and session-scoped — nothing is persisted or sent.
 */
export class SessionBaseline {
  /** Exponentially-weighted moving average of inter-keystroke interval (ms). */
  private cadenceMs = 0;
  private cadenceSamples = 0;
  private static readonly ALPHA = 0.1;

  readonly linesByOrigin: Record<Origin, number> = { typed: 0, pasted: 0, ai: 0 };
  unreadCleared = 0;

  recordTypingInterval(ms: number): void {
    if (ms <= 0 || ms > 5000) {
      return; // ignore pauses / first event
    }
    this.cadenceSamples++;
    this.cadenceMs =
      this.cadenceSamples === 1
        ? ms
        : SessionBaseline.ALPHA * ms + (1 - SessionBaseline.ALPHA) * this.cadenceMs;
  }

  recordLines(origin: Origin, lines: number): void {
    this.linesByOrigin[origin] += Math.max(1, lines);
  }

  recordCleared(): void {
    this.unreadCleared++;
  }

  get avgCadenceMs(): number {
    return Math.round(this.cadenceMs);
  }

  get externalLines(): number {
    return this.linesByOrigin.pasted + this.linesByOrigin.ai;
  }

  get totalLines(): number {
    return this.linesByOrigin.typed + this.externalLines;
  }

  /** Share of code this session that came from outside the keyboard (0–1). */
  get externalRatio(): number {
    const t = this.totalLines;
    return t === 0 ? 0 : this.externalLines / t;
  }
}
