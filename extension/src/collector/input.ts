import { Origin } from "../engine/types";

export interface ChangeInfo {
  insertedText: string;
  insertedLines: number; // number of newlines inside the inserted text
  rangeStartLine: number;
  rangeEndLine: number; // last line touched, before the edit
  /** Whatever the clipboard held at the moment of the change (may be ""). */
  clipboard: string;
  /** ms since the previous change in this document (Infinity if first). */
  sinceLastChangeMs: number;
}

export interface ClassifyConfig {
  pasteThresholdLines: number;
  pasteThresholdChars: number;
}

function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

/**
 * Decide how a single content change entered the document: typed / pasted / ai.
 *
 * Key trick for the AI-vs-paste split (no private API needed): a clipboard
 * paste inserts text that EQUALS the current clipboard. An accepted Copilot /
 * Cursor / inline suggestion inserts a chunk that the user never copied, so it
 * will NOT match the clipboard. That gives us a real trichotomy:
 *
 *   bulk insert + matches clipboard      -> pasted
 *   bulk insert + does NOT match clip    -> ai   (accepted suggestion)
 *   small, human-cadence edit            -> typed
 */
export function classifyOrigin(change: ChangeInfo, cfg: ClassifyConfig): Origin {
  const bulk =
    change.insertedText.length >= cfg.pasteThresholdChars ||
    change.insertedLines >= cfg.pasteThresholdLines;

  if (!bulk) {
    return "typed";
  }

  const inserted = normalize(change.insertedText);
  const clip = normalize(change.clipboard);
  if (clip.length > 0 && (inserted === clip || clip.includes(inserted) || inserted.includes(clip))) {
    return "pasted";
  }
  // Bulk insert that the user never copied -> almost certainly an accepted
  // AI/inline suggestion (or an autocompletion snippet).
  return "ai";
}
