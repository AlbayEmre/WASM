import { CodeBlock, Origin } from "./types";

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Tracks origin/attention for the blocks of a single file.
 *
 * The line ranges are kept in sync with the live document: every edit shifts
 * the blocks below it (insert/delete) so a stored block always points at the
 * same logical code even as the file grows above it. This is the TS port of
 * the Rust `block_map.rs`.
 */
export class FileBlocks {
  blocks: CodeBlock[] = [];
  private nextId = 1;

  constructor(public readonly fsPath: string) {}

  addBlock(startLine: number, endLine: number, origin: Origin, charCount: number): void {
    // If this insertion sits fully inside an existing unread external block of
    // the same origin, treat it as part of that block instead of duplicating.
    for (const b of this.blocks) {
      if (b.origin === origin && startLine >= b.startLine && endLine <= b.endLine) {
        return;
      }
    }
    this.blocks.push({
      id: this.nextId++,
      startLine,
      endLine,
      origin,
      createdAt: Date.now(),
      read: false,
      edited: false,
      charCount,
    });
  }

  /**
   * Apply a document edit to keep block ranges accurate.
   * @param changeStartLine first line touched by the edit
   * @param changeEndLine   last line touched (before edit)
   * @param lineDelta       net change in line count (added - removed)
   */
  applyShift(changeStartLine: number, changeEndLine: number, lineDelta: number): void {
    if (lineDelta === 0) {
      return;
    }
    for (const b of this.blocks) {
      if (b.startLine > changeEndLine) {
        // Block entirely below the edit: shift it.
        b.startLine += lineDelta;
        b.endLine += lineDelta;
      } else if (overlaps(changeStartLine, changeEndLine, b.startLine, b.endLine)) {
        // Edit overlaps the block: grow/shrink its end.
        b.endLine = Math.max(b.startLine, b.endLine + lineDelta);
      }
    }
  }

  /** Explicitly mark the block containing this line as reviewed (the only clear). */
  markReviewedAt(line: number): boolean {
    let changed = false;
    for (const b of this.blocks) {
      if (!b.read && line >= b.startLine && line <= b.endLine) {
        b.read = true;
        changed = true;
      }
    }
    return changed;
  }

  /** A manual edit landed on this line — the user actively changed it. */
  markEdited(line: number): void {
    for (const b of this.blocks) {
      if (line >= b.startLine && line <= b.endLine) {
        b.edited = true;
      }
    }
  }

  /** Force every block to reviewed (used by "Mark file as reviewed"). */
  markAllRead(): void {
    for (const b of this.blocks) {
      b.read = true;
    }
  }
}
