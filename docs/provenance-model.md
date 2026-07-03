# Provenance Model

codeprov classifies every block of code on two independent axes and combines
them with file sensitivity into a single review-risk score.

## Axis 1 — Origin (how the code entered the file)

| Origin | Detection | Notes |
|---|---|---|
| `typed` | Small change at human cadence (< paste thresholds) | The safe baseline. |
| `pasted` | Bulk insert **that matches the clipboard** | Clipboard text == inserted text. |
| `ai` | Bulk insert that does **not** match the clipboard | Accepted Copilot/Cursor/inline suggestion — the user never copied it. |

The clipboard comparison is the key trick: VS Code's public API delivers a
paste and an accepted inline suggestion identically (one multi-line insert, no
provenance flag). Comparing the insertion against the live clipboard separates
them without any private API or AI service.

Thresholds (configurable): `pasteThresholdLines` (default 3),
`pasteThresholdChars` (default 80).

## Axis 2 — Attention (what happened after it entered)

| Signal | How it is set | Meaning |
|---|---|---|
| `read` | Cursor/selection visits the block (after the insertion settles) | The user looked at it. |
| `edited` | A later manual keystroke lands inside the block | The user actively changed it. |
| `ran` | A debug/run session starts for the file | The code was exercised. |
| `untouched` | none of the above | **Unread.** |

A 500 ms guard ignores the cursor move caused by the insertion itself, so a
fresh paste/AI block does not count as "read" instantly.

## Risk score (0.0 – 1.0)

```
risk = 0  if origin == typed
risk = 0  if read or edited or ran          (reviewed)
otherwise:
  base   = 0.5 + min(lines / 40, 1) * 0.3   (0.5 .. 0.8 by size)
  if sensitive: risk = min(1.0, base + 0.25)
```

Sensitivity is decided by `sensitivePaths` globs (default: `auth/**`,
`*secret*`, `*.sql`, `*.env`).

## Signal types

| Signal | Tier | Surface |
|---|---|---|
| `UNREAD_AI_IN_SENSITIVE` | 🔴 critical | commit guard (modal) |
| `UNREAD_PASTE_IN_SENSITIVE` | 🔴 critical | commit guard (modal) |
| `LARGE_UNREAD_AI_BLOCK` | 🟡 high | notification / gutter |
| `BULK_PASTE_UNREAD` | 🟡 high | gutter / status bar |

## Privacy

Everything above is computed in-memory, per session. No code, paths, or
contents leave the machine. The optional Slack summary sends **counts only**.
