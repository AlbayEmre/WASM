<p align="center">
  <img src="extension/media/icon.png" alt="codeprov logo" width="128" height="128" />
</p>

<h1 align="center">codeprov — Code Provenance Guard</h1>

<p align="center">
  Flags AI-generated or pasted code you <strong>never actually read</strong> — before you commit it.<br/>
  <strong>100% local. No API keys. No cloud.</strong>
</p>

Linters tell you *the code is bad*. CI tells you *a test failed*. Nothing tells you
**"you didn't even read these 23 lines."** codeprov does — by tracking *how* code
enters a file (typed / pasted / AI-accepted) and whether you ever looked at it again.

## Repository layout

```
WASM/
├── extension/   # TypeScript VS Code extension (the product) — works today
├── engine/      # Rust → WASM provenance engine (performance path)
├── docs/        # provenance model
└── tests/       # fixtures
```

## Quick start (extension)

```bash
cd extension
npm install
npm run compile
# Press F5 in VS Code → Extension Development Host
```

Paste 3+ lines into a file → it lights up as **unread**. Click into it → it clears.
Run **“codeprov: Check unread AI/pasted code”** before committing.

See [`extension/README.md`](extension/README.md) for the full feature list and
[`docs/provenance-model.md`](docs/provenance-model.md) for how scoring works.

## The two engines

The extension ships with a complete **TypeScript engine** (zero toolchain, runs
everywhere). The **Rust → WASM engine** in `engine/` is a 1:1 port for speed; build it:

```bash
cd engine
rustup target add wasm32-unknown-unknown
cargo install wasm-pack        # one-time
./build.sh                     # → extension/wasm
```

Both implement the same origin + attention + scoring model.

## How AI vs paste is detected (no AI service needed)

VS Code delivers a clipboard paste and an accepted Copilot/Cursor suggestion
identically. codeprov compares the inserted text against the **live clipboard**:
matches → `pasted`, doesn't match → `ai`. Pure local heuristic, no model calls.

## Privacy

Everything is in-memory and session-scoped. No code leaves your machine. The
optional Slack summary sends **counts only**.
