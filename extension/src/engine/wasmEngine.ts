import {
  BaselineSnapshot,
  ChangeContext,
  EngineConfig,
  FileBlocksSnapshot,
  FileRisk,
  IEngine,
  RiskSignal,
} from "./types";
import { WasmEngineInstance } from "./wasm_bridge";

interface WasmChange {
  inserted_chars: number;
  inserted_lines: number;
  start_line: number;
  end_line: number;
  matches_clipboard: boolean;
}

function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

/**
 * Adapts the Rust/WASM `Engine` to the same `IEngine` surface as the TS engine.
 *
 * The WASM side speaks JSON strings; this class does the marshalling. The
 * clipboard comparison (paste vs AI) is done here in JS — where the clipboard
 * lives — and passed across as a per-change `matches_clipboard` flag.
 */
export class WasmEngine implements IEngine {
  constructor(private readonly wasm: WasmEngineInstance, public cfg: EngineConfig) {}

  updateConfig(cfg: EngineConfig): void {
    this.cfg = cfg;
    this.wasm.update_config(JSON.stringify(toWasmConfig(cfg)));
  }

  onChange(ctx: ChangeContext): RiskSignal[] {
    const clip = normalize(ctx.clipboard);
    const changes: WasmChange[] = ctx.changes.map((c) => {
      const insertedLines = (c.text.match(/\n/g) || []).length;
      const inserted = normalize(c.text);
      const matches =
        clip.length > 0 && (inserted === clip || clip.includes(inserted) || inserted.includes(clip));
      return {
        inserted_chars: c.text.length,
        inserted_lines: insertedLines,
        start_line: c.range.start.line,
        end_line: c.range.end.line,
        matches_clipboard: matches,
      };
    });
    return parse(this.wasm.on_change(ctx.uri, ctx.fsPath, JSON.stringify(changes), Date.now()));
  }

  markReviewedAt(uri: string, fsPath: string, line: number): RiskSignal[] {
    return parse(this.wasm.mark_block_reviewed_at(uri, fsPath, line));
  }

  flagExternalRegion(
    uri: string,
    fsPath: string,
    startLine: number,
    endLine: number,
    charCount: number
  ): RiskSignal[] {
    return parse(this.wasm.flag_external_region(uri, fsPath, startLine, endLine, charCount));
  }

  signalsFor(uri: string, fsPath: string): RiskSignal[] {
    return parse(this.wasm.signals_for(uri, fsPath));
  }

  markFileReviewed(uri: string): void {
    this.wasm.mark_file_reviewed(uri);
  }

  forget(uri: string): void {
    this.wasm.forget(uri);
  }

  allRisks(): FileRisk[] {
    return parse<FileRisk[]>(this.wasm.all_risks_json());
  }

  allFiles(): FileBlocksSnapshot[] {
    return parse<FileBlocksSnapshot[]>(this.wasm.all_files_json());
  }

  baselineSnapshot(): BaselineSnapshot {
    try {
      return JSON.parse(this.wasm.baseline_json()) as BaselineSnapshot;
    } catch {
      return {
        linesByOrigin: { typed: 0, pasted: 0, ai: 0 },
        externalLines: 0,
        totalLines: 0,
        externalRatio: 0,
        avgCadenceMs: 0,
        unreadCleared: 0,
      };
    }
  }
}

function parse<T = RiskSignal[]>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return [] as unknown as T;
  }
}

/** EngineConfig uses camelCase in JS but the Rust struct expects snake_case. */
function toWasmConfig(cfg: EngineConfig): Record<string, unknown> {
  return {
    enabled: cfg.enabled,
    min_score: cfg.minScore,
    paste_threshold_lines: cfg.pasteThresholdLines,
    paste_threshold_chars: cfg.pasteThresholdChars,
    sensitive_paths: cfg.sensitivePaths,
    ignore_paths: cfg.ignorePaths,
  };
}

export { toWasmConfig };
