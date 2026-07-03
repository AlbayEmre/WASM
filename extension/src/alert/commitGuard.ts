import * as vscode from "vscode";
import { FileRisk, IEngine } from "../engine/types";

function totalBlocks(risks: FileRisk[]): number {
  return risks.reduce((n, r) => n + r.signals.length, 0);
}

async function revealFirst(risks: FileRisk[]): Promise<void> {
  const first = risks[0];
  const sig = first.signals[0];
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(first.uri));
  const editor = await vscode.window.showTextDocument(doc);
  const pos = new vscode.Position(sig.startLine, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

/**
 * The commit guard: surfaces unread external code before it leaves the editor.
 * Bound to `codeprov.checkUnread` (status bar click / command palette / can be
 * wired to a pre-commit keybinding).
 */
export async function checkUnread(engine: IEngine, blockOnSensitive: boolean): Promise<void> {
  const risks = engine.allRisks();
  const total = totalBlocks(risks);

  if (total === 0) {
    vscode.window.showInformationMessage("codeprov: no unread AI/pasted code. ✅");
    return;
  }

  const sensitive = risks.filter((r) => r.sensitive);
  const fileList = risks
    .map((r) => {
      const name = r.fsPath.split(/[/\\]/).pop() ?? r.fsPath;
      return `• ${name} — ${r.signals.length} block(s)${r.sensitive ? " ⚠️ sensitive" : ""}`;
    })
    .join("\n");

  const headline =
    sensitive.length > 0 && blockOnSensitive
      ? `⚠️ ${total} unread external block(s), including ${sensitive.length} sensitive file(s).`
      : `${total} unread external block(s) you have not reviewed.`;

  const choice = await vscode.window.showWarningMessage(
    `${headline}\n\n${fileList}`,
    { modal: true },
    "Reveal first",
    "Mark all reviewed"
  );

  if (choice === "Reveal first") {
    await revealFirst(risks);
  } else if (choice === "Mark all reviewed") {
    for (const r of risks) {
      engine.markFileReviewed(r.uri);
    }
    vscode.window.showInformationMessage("codeprov: all blocks marked reviewed.");
  }
}
