import {
  BaselineSnapshot,
  ChangeContext,
  CodeBlock,
  EngineConfig,
  FileBlocksSnapshot,
  FileRisk,
  IEngine,
  Origin,
  RiskSignal,
} from "./types";
import { FileBlocks } from "./blockMap";
import { isSensitive, scoreBlock } from "./scoring";
import { matchesAny } from "./glob";
import { classifyOrigin, ChangeInfo } from "../collector/input";
import { SessionBaseline } from "./baseline";

/**
 * The provenance engine (TS implementation / "fallback" path).
 *
 * Owns one FileBlocks per document plus a session baseline. Turns raw VS Code
 * events into origin + attention state, then into RiskSignals. The Rust -> WASM
 * engine exposes the same surface.
 */
export class Engine implements IEngine {
  private files = new Map<string, FileBlocks>();
  readonly baseline = new SessionBaseline();
  private lastChangeAt = 0;

  constructor(public cfg: EngineConfig) {}

  updateConfig(cfg: EngineConfig): void {
    this.cfg = cfg;
  }

  private isIgnored(fsPath: string): boolean {
    return matchesAny(fsPath, this.cfg.ignorePaths);
  }

  private fileFor(uri: string, fsPath: string): FileBlocks {
    let f = this.files.get(uri);
    if (!f) {
      f = new FileBlocks(fsPath);
      this.files.set(uri, f);
    }
    return f;
  }

  onChange(ctx: ChangeContext): RiskSignal[] {
    if (!this.cfg.enabled || this.isIgnored(ctx.fsPath)) {
      return [];
    }
    const fb = this.fileFor(ctx.uri, ctx.fsPath);
    const now = Date.now();
    const sinceLast = this.lastChangeAt === 0 ? Infinity : now - this.lastChangeAt;

    for (const c of ctx.changes) {
      const insertedLines = (c.text.match(/\n/g) || []).length;
      const removedSpan = c.range.end.line - c.range.start.line;
      const lineDelta = insertedLines - removedSpan;

      fb.applyShift(c.range.start.line, c.range.end.line, lineDelta);

      const info: ChangeInfo = {
        insertedText: c.text,
        insertedLines,
        rangeStartLine: c.range.start.line,
        rangeEndLine: c.range.end.line,
        clipboard: ctx.clipboard,
        sinceLastChangeMs: sinceLast,
      };
      const origin: Origin = classifyOrigin(info, this.cfg);

      if (origin === "typed") {
        // Human keystroke: feed cadence, and if it lands inside an external
        // block that counts as the user actively reviewing/editing it.
        if (c.text.length > 0 && c.text.length <= 2) {
          this.baseline.recordTypingInterval(sinceLast);
        }
        this.baseline.recordLines("typed", 1);
        fb.markEdited(c.range.start.line);
      } else {
        fb.addBlock(c.range.start.line, c.range.start.line + insertedLines, origin, c.text.length);
        this.baseline.recordLines(origin, insertedLines + 1);
      }
    }
    this.lastChangeAt = now;
    return this.signalsFor(ctx.uri, ctx.fsPath);
  }

  /** Explicit "Mark as reviewed" on the block at this line — the only clear. */
  markReviewedAt(uri: string, fsPath: string, line: number): RiskSignal[] {
    this.files.get(uri)?.markReviewedAt(line);
    return this.signalsFor(uri, fsPath);
  }

  /**
   * Flag external code that appeared in a file we are NOT editing (disk watcher).
   * No clipboard context is available, so it is always treated as AI/external.
   */
  flagExternalRegion(
    uri: string,
    fsPath: string,
    startLine: number,
    endLine: number,
    charCount: number
  ): RiskSignal[] {
    if (!this.cfg.enabled || matchesAny(fsPath, this.cfg.ignorePaths)) {
      return [];
    }
    const fb = new FileBlocks(fsPath);
    fb.addBlock(startLine, endLine, "ai", charCount);
    this.files.set(uri, fb);
    this.baseline.recordLines("ai", endLine - startLine + 1);
    return this.signalsFor(uri, fsPath);
  }

  signalsFor(uri: string, fsPath: string): RiskSignal[] {
    const fb = this.files.get(uri);
    if (!fb) {
      return [];
    }
    const sensitive = isSensitive(fsPath, this.cfg.sensitivePaths);
    const out: RiskSignal[] = [];
    for (const b of fb.blocks) {
      const sig = scoreBlock(b, sensitive);
      if (sig && sig.score >= this.cfg.minScore) {
        out.push(sig);
      }
    }
    return out;
  }

  allRisks(): FileRisk[] {
    const out: FileRisk[] = [];
    for (const [uri, fb] of this.files) {
      const signals = this.signalsFor(uri, fb.fsPath);
      if (signals.length > 0) {
        out.push({
          uri,
          fsPath: fb.fsPath,
          sensitive: isSensitive(fb.fsPath, this.cfg.sensitivePaths),
          signals,
        });
      }
    }
    return out;
  }

  markFileReviewed(uri: string): void {
    this.files.get(uri)?.markAllRead();
  }

  forget(uri: string): void {
    this.files.delete(uri);
  }

  blocksOf(uri: string): CodeBlock[] {
    return this.files.get(uri)?.blocks ?? [];
  }

  allFiles(): FileBlocksSnapshot[] {
    return [...this.files.entries()].map(([uri, fb]) => ({
      uri,
      fsPath: fb.fsPath,
      blocks: fb.blocks,
    }));
  }

  baselineSnapshot(): BaselineSnapshot {
    const b = this.baseline;
    return {
      linesByOrigin: { ...b.linesByOrigin },
      externalLines: b.externalLines,
      totalLines: b.totalLines,
      externalRatio: b.externalRatio,
      avgCadenceMs: b.avgCadenceMs,
      unreadCleared: b.unreadCleared,
    };
  }
}
