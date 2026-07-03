# codeprov — Code Provenance Guard

> Flags AI-generated or pasted code you **never actually read** — before you commit it.
> **100% local. No API keys. No cloud. No data ever leaves your machine.**

Linters tell you *the code is bad*. CI tells you *a test failed*. Nothing tells you
**"you didn't even read these 23 lines."** codeprov does.

In the Copilot / Cursor era we accept and paste code constantly. codeprov watches
**how code enters a file** — typed by hand, pasted, or accepted from an AI suggestion —
and whether you ever looked at it again before committing.

## What it does

- **Origin tracking** — every block is tagged `typed` / `pasted` / `ai` from editor events.
- **Attention tracking** — a block clears once you read, edit, or run it.
- **Inline warning** — unread external blocks get a squiggle.
- **Status bar** — live count of unread external code; turns red for sensitive files.
- **Commit guard** — `codeprov: Check unread AI/pasted code` lists everything you
  haven't reviewed, and warns hard when it's in a sensitive file (`auth/`, `*.sql`, `*.env`, …).

## Run it (development)

```bash
cd extension
npm install
npm run compile
# Press F5 in VS Code -> opens the Extension Development Host
```

In the dev host:
1. Open any file.
2. **Paste** (or type fast) a block of 3+ lines → it lights up as *unread*, status bar shows the count.
3. Run **`codeprov: Check unread AI/pasted code`** from the Command Palette → modal lists it.
4. Click into the block / scroll through it → it clears (you "read" it).

Try it against `tests/fixtures/` for a scripted demo.

## Configuration (`codeprov.*`)

| Setting | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `minScore` | `0.5` | Min risk (0–1) before surfacing |
| `pasteThresholdLines` | `3` | Lines in one change → treated as external |
| `pasteThresholdChars` | `80` | Chars in one change → treated as external |
| `blockCommitOnUnreadSensitive` | `true` | Hard warning for sensitive files |
| `sensitivePaths` | `auth/**`, `*secret*`, `*.sql`, `*.env` | Higher-risk globs |
| `ignorePaths` | `node_modules`, `dist`, `out` | Skipped entirely |

## Architecture

- `extension/` — TypeScript, VS Code API + the current engine (the "fallback" path).
- `engine/` — Rust → WASM engine (performance path, ported from the TS logic).

> **Note on AI vs paste:** the public VS Code API delivers a clipboard paste and an
> accepted inline suggestion identically (one multi-line insert, no provenance flag),
> so the MVP labels both as external `pasted`. A future command hook for inline-suggest
> acceptance promotes a block to `ai`.

## Privacy

Everything runs in-memory, locally. codeprov makes **zero** network calls and reads
**zero** secrets out. It does not watch *you* — it shows *you* the code you skipped.
