// Core data model for codeprov.
//
// This mirrors the Rust engine structs in (Origin / RiskSignal).
// When the Rust -> WASM engine is built, these types become the JS-side
// shape that crosses the wasm-bindgen boundary.

/** How a block of code entered the file. */
export type Origin = "typed" | "pasted" | "ai";

/** A contiguous run of lines that share a single origin. */
export interface CodeBlock {
  id: number;
  /** 0-based inclusive line range, kept in sync as the document shifts. */
  startLine: number;
  endLine: number;
  origin: Origin;
  createdAt: number;
  /** Set only by an explicit "Mark as reviewed" action — the only way to clear. */
  read: boolean;
  edited: boolean;
  charCount: number;
}

export type SignalType =
  | "UNREAD_AI_IN_SENSITIVE"
  | "UNREAD_PASTE_IN_SENSITIVE"
  | "LARGE_UNREAD_AI_BLOCK"
  | "BULK_PASTE_UNREAD";

/** A risk surfaced to the UI (diagnostic / status bar / commit guard). */
export interface RiskSignal {
  type: SignalType;
  /** 0.0 – 1.0 review-risk score. */
  score: number;
  startLine: number;
  endLine: number;
  origin: Origin;
  message: string;
  suggestion: string;
}

export interface EngineConfig {
  enabled: boolean;
  minScore: number;
  pasteThresholdLines: number;
  pasteThresholdChars: number;
  sensitivePaths: string[];
  ignorePaths: string[];
}

/** One file's outstanding risks (used by the commit guard). */
export interface FileRisk {
  uri: string;
  fsPath: string;
  sensitive: boolean;
  signals: RiskSignal[];
}

/** A batch of edits for one document, plus the clipboard at that moment. */
export interface ChangeContext {
  uri: string;
  fsPath: string;
  clipboard: string;
  changes: readonly { text: string; range: { start: { line: number }; end: { line: number } } }[];
}

/** Per-file raw block listing (used by the report view). */
export interface FileBlocksSnapshot {
  uri: string;
  fsPath: string;
  blocks: CodeBlock[];
}

/** Normalized baseline numbers shared by the TS and WASM engines. */
export interface BaselineSnapshot {
  linesByOrigin: Record<Origin, number>;
  externalLines: number;
  totalLines: number;
  externalRatio: number;
  avgCadenceMs: number;
  unreadCleared: number;
}

/**
 * The surface both engines implement, so `extension.ts` can swap the WASM
 * engine in for the TS one transparently.
 */
export interface IEngine {
  readonly cfg: EngineConfig;
  updateConfig(cfg: EngineConfig): void;
  onChange(ctx: ChangeContext): RiskSignal[];
  markReviewedAt(uri: string, fsPath: string, line: number): RiskSignal[];
  flagExternalRegion(
    uri: string,
    fsPath: string,
    startLine: number,
    endLine: number,
    charCount: number
  ): RiskSignal[];
  signalsFor(uri: string, fsPath: string): RiskSignal[];
  markFileReviewed(uri: string): void;
  forget(uri: string): void;
  allRisks(): FileRisk[];
  allFiles(): FileBlocksSnapshot[];
  baselineSnapshot(): BaselineSnapshot;
}
