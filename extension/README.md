<p align="center">
  <img src="media/icon.png" alt="codeprov logo" width="128" height="128" />
</p>

<h1 align="center">codeprov — Code Provenance Guard</h1>

<p align="center">
  Flags AI-generated or pasted code you <strong>never actually read</strong> — before you commit it.<br/>
  <strong>100% local. No API keys. No cloud. No data ever leaves your machine.</strong>
</p>

Linters tell you *the code is bad*. CI tells you *a test failed*. Nothing tells you
**"you didn't even read these 23 lines."** codeprov does.

In the Copilot / Cursor era we accept and paste code constantly. codeprov watches
**how code enters a file** — typed by hand, pasted, or accepted from an AI suggestion —
and whether you ever looked at it again before committing.

## What it does

- **Origin tracking** — every block is tagged `typed` / `pasted` / `ai` from editor events,
  using a clipboard-comparison heuristic (see below) — no AI service involved.
- **Attention tracking** — a block stays flagged as unread until you explicitly mark it
  reviewed; simply scrolling past or editing nearby code does not clear it.
- **Inline warning** — unread external blocks get a colored gutter marker: purple for
  AI-generated code, orange for pasted code.
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
4. Put the cursor on the squiggle → Ctrl+. → **"Mark this block as reviewed"** → it clears.

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
> accepted inline suggestion identically (one multi-line insert, no provenance flag).
> codeprov compares the inserted text against the live clipboard: a match is labeled
> `pasted`, a non-match is labeled `ai` (an accepted Copilot/Cursor/inline suggestion).

## Privacy

Everything runs in-memory, locally. codeprov makes **zero** network calls and reads
**zero** secrets out. It does not watch *you* — it shows *you* the code you skipped.
