# Changelog

## 0.1.4

- Fixed Marketplace packaging: README no longer embeds SVG images (disallowed
  by the Marketplace README renderer).
- Corrected `repository` field to point at the actual GitHub remote, with a
  `directory` hint since the extension lives in a subfolder.
- README and `docs/provenance-model.md` now describe the actual 0.1.1 behavior
  (a block clears only via explicit "Mark as reviewed"; `edited` is tracked
  but does not clear a block on its own).
- Removed the unused `ran` field and the dead `markRan()` method, left over
  from before the 0.1.1 attention-model change.
- Fixed a Rust/WASM engine bug where zero-length changes (deletions) were
  counted toward typing-cadence sampling, unlike the TypeScript engine.

## 0.1.3

- **Off-screen detection**: a disk watcher now flags external code written to
  files you are NOT editing (e.g. an AI agent touching many files at once).
  Such changes show up in the Problems panel even if the file is never opened.

## 0.1.2

- Colors by origin: AI = purple 🟣, pasted = yellow 🟡.
- Unread markers clear **only** via the explicit "Mark as reviewed" quick fix
  (Ctrl+. → Enter); cursor movement no longer clears them.

## 0.1.1

- Colors by origin: AI = purple 🟣, pasted = yellow 🟡.
- Unread markers now clear **only** via an explicit "Mark as reviewed" quick fix
  (Ctrl+. → Enter). Moving the cursor over the code no longer clears it.

## 0.1.0

Initial release.

- Origin tracking: `typed` / `pasted` / `ai` (clipboard-comparison heuristic).
- Attention tracking: read / edited / ran → clears "unread" risk.
- Inline diagnostics + gutter decorations (AI = purple, paste = orange).
- Status bar with live unread count (red for sensitive files).
- Commit guard command + post-commit warning via the Git API.
- Session provenance report (webview).
- Optional Slack summary (aggregate metrics only — no code).
- Ruleset export / import.
- Fully local: no API keys, no network calls (except opt-in Slack webhook).
