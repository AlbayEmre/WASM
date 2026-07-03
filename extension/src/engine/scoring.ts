import { CodeBlock, RiskSignal, SignalType } from "./types";
import { matchesAny } from "./glob";

export function isSensitive(fsPath: string, sensitivePaths: string[]): boolean {
  return matchesAny(fsPath, sensitivePaths);
}

/**
 * Compute the review-risk for a single block.
 * Returns null when the block carries no risk (typed, or already reviewed).
 *
 * Risk = external-origin AND unreviewed, weighted by size and sensitivity.
 * This is the TS port of `scoring.rs`.
 */
export function scoreBlock(block: CodeBlock, sensitive: boolean): RiskSignal | null {
  const external = block.origin === "pasted" || block.origin === "ai";
  if (!external) {
    return null;
  }
  // Only an explicit "Mark as reviewed" action clears a block.
  if (block.read) {
    return null;
  }

  const lines = block.endLine - block.startLine + 1;
  // Size drives a 0.5–0.8 base; sensitivity pushes it into critical territory.
  let score = 0.5 + Math.min(lines / 40, 1) * 0.3;
  if (sensitive) {
    score = Math.min(1, score + 0.25);
  }

  const aiLike = block.origin === "ai";
  const originLabel = aiLike ? "AI-generated" : "pasted";

  let type: SignalType;
  if (sensitive) {
    type = aiLike ? "UNREAD_AI_IN_SENSITIVE" : "UNREAD_PASTE_IN_SENSITIVE";
  } else {
    type = aiLike ? "LARGE_UNREAD_AI_BLOCK" : "BULK_PASTE_UNREAD";
  }

  const where = sensitive ? " in a security-sensitive file" : "";
  return {
    type,
    score,
    startLine: block.startLine,
    endLine: block.endLine,
    origin: block.origin,
    message: `${lines} line${lines === 1 ? "" : "s"} of ${originLabel} code${where} not yet reviewed.`,
    suggestion: "Read through this block (or edit/run it) before committing.",
  };
}
