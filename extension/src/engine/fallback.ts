// Fallback engine selector.
//
// The TypeScript `Engine` is a complete, dependency-free implementation of the
// provenance logic. It is the guaranteed path: it works with zero native
// toolchain and is what the extension uses today. When the WASM engine is wired
// in, this is what we fall back to if `tryLoadWasmEngine()` returns null.

export { Engine } from "./engine";
export type { FileRisk, ChangeContext, IEngine } from "./types";
