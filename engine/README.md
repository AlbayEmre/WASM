# codeprov-engine (Rust → WASM)

The performance path for codeprov's provenance logic — a 1:1 port of the
TypeScript engine in `../extension/src/engine`.

## Layout

```
src/
├── lib.rs                 # wasm-bindgen Engine (snake_case exports, no panics)
├── types.rs               # Origin / CodeBlock / RiskSignal / EngineConfig
├── scoring.rs             # score_block()
├── provenance/
│   ├── origin.rs          # classify_origin()  (typed / pasted / ai)
│   ├── attention.rs       # is_reviewed(), range overlap
│   └── sensitivity.rs     # glob matcher (no regex dep → smaller WASM)
└── state/
    ├── block_map.rs       # FileBlocks: line-shift + attention tracking
    ├── ring_buffer.rs     # last-N keystroke intervals
    └── baseline.rs        # SessionBaseline (cadence + origin mix)
```

## Build

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack          # one-time
wasm-pack build --target bundler --out-dir ../extension/wasm
# or: ./build.sh
```

> **Windows note:** building proc-macro deps (serde/wasm-bindgen) compiles for the
> host, which needs a linker. Either install the *MSVC Build Tools* (C++ workload)
> or use the GNU toolchain:
> `rustup default stable-x86_64-pc-windows-gnu`.

## Design rules

- `#![forbid(unsafe_code)]` — no `unsafe`.
- No panics: every fallible path returns a value / empty JSON.
- `feed`-style updates are O(1)/O(log n) per change.
- The JS side owns editor events + clipboard; it passes a per-change
  `matches_clipboard` flag so this crate stays editor-agnostic.
