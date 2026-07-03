// Bridge to the Rust -> WASM engine.
//
// The shipped extension currently runs the TypeScript engine (./engine.ts),
// which is the deliberate "fallback" path from the architecture. Once the Rust
// crate is built (`engine/build.sh` -> ../wasm), this module loads the compiled
// WASM Engine and exposes the same surface, so `extension.ts` can switch the
// active engine in one place.
//
// We keep the import dynamic + guarded so the extension still activates cleanly
// when the WASM artifact is absent (e.g. before the first `wasm-pack build`).

export interface WasmEngineModule {
  Engine: new (configJson: string) => WasmEngineInstance;
}

export interface WasmEngineInstance {
  update_config(configJson: string): void;
  on_change(uri: string, fsPath: string, changesJson: string, nowMs: number): string;
  mark_block_reviewed_at(uri: string, fsPath: string, line: number): string;
  flag_external_region(
    uri: string,
    fsPath: string,
    startLine: number,
    endLine: number,
    charCount: number
  ): string;
  mark_file_reviewed(uri: string): void;
  forget(uri: string): void;
  signals_for(uri: string, fsPath: string): string;
  baseline_json(): string;
  all_risks_json(): string;
  all_files_json(): string;
}

/**
 * Attempt to load the compiled WASM engine. Returns null if it has not been
 * built yet, in which case the caller should fall back to the TS engine.
 */
export async function tryLoadWasmEngine(configJson: string): Promise<WasmEngineInstance | null> {
  try {
    // Path kept in a variable so TS does not statically resolve it; the WASM
    // artifact may not exist yet. Missing module -> graceful null.
    const modPath = "../../wasm/codeprov_engine.js";
    const mod = (await import(modPath)) as unknown as WasmEngineModule;
    return new mod.Engine(configJson);
  } catch {
    return null;
  }
}
