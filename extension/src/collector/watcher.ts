import * as vscode from "vscode";
import { matchesAny } from "../engine/glob";

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|rb|php|c|h|cpp|cs|kt|swift|scala|sql|sh|vue|svelte)$/i;

export interface WatcherDeps {
  /** Is this uri currently open in the editor? (those are handled live) */
  isOpen: (uriString: string) => boolean;
  ignorePaths: () => string[];
  /** A file we are NOT editing changed on disk — external code appeared. */
  onExternal: (uri: vscode.Uri, startLine: number, endLine: number, charCount: number) => void;
}

/**
 * Watches the workspace for files that change on disk while you are NOT editing
 * them (e.g. an AI agent writing many files at once). Such changes can't carry
 * clipboard/typing context, so they are reported as external (AI) code that you
 * never read — exactly the "I wasn't even on that file" case.
 */
export class DiskWatcher {
  private watcher?: vscode.FileSystemWatcher;
  private readonly cache = new Map<string, string[]>();

  constructor(private readonly deps: WatcherDeps) {}

  start(context: vscode.ExtensionContext): void {
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*");
    context.subscriptions.push(
      this.watcher,
      this.watcher.onDidChange((u) => void this.handle(u, false)),
      this.watcher.onDidCreate((u) => void this.handle(u, true))
    );
  }

  private async handle(uri: vscode.Uri, created: boolean): Promise<void> {
    const key = uri.toString();
    if (this.deps.isOpen(key)) {
      return; // open documents go through the live editor path
    }
    if (!CODE_EXT.test(uri.fsPath) || matchesAny(uri.fsPath, this.deps.ignorePaths())) {
      return;
    }

    let content: string;
    try {
      content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    } catch {
      return;
    }
    const newLines = content.split(/\r?\n/);
    const oldLines = this.cache.get(key);
    this.cache.set(key, newLines);

    // Brand-new file -> whole content is external. Existing file with no
    // baseline yet -> just record it, don't flag (avoids flagging the project
    // on startup); the next change will be diffed.
    if (created && content.trim().length > 0) {
      this.deps.onExternal(uri, 0, newLines.length - 1, content.length);
      return;
    }
    if (!oldLines) {
      return;
    }

    const region = diffRegion(oldLines, newLines);
    if (region && region.text.trim().length > 0) {
      this.deps.onExternal(uri, region.start, region.end, region.text.length);
    }
  }
}

/** Minimal line diff: strip common prefix/suffix, return the changed new region. */
function diffRegion(
  oldLines: string[],
  newLines: string[]
): { start: number; end: number; text: string } | null {
  let p = 0;
  while (p < oldLines.length && p < newLines.length && oldLines[p] === newLines[p]) {
    p++;
  }
  let s = 0;
  while (
    s < oldLines.length - p &&
    s < newLines.length - p &&
    oldLines[oldLines.length - 1 - s] === newLines[newLines.length - 1 - s]
  ) {
    s++;
  }
  const start = p;
  const end = newLines.length - 1 - s;
  if (end < start) {
    return null; // pure deletion — nothing new entered
  }
  return { start, end, text: newLines.slice(start, end + 1).join("\n") };
}
