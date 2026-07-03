import * as vscode from "vscode";
import { RiskSignal } from "../engine/types";

/**
 * Gutter + overview-ruler decorations marking unread external blocks by origin.
 * AI = purple, pasted = orange. Cleared automatically as blocks become read.
 */
export class GutterDecorations {
  private readonly aiType: vscode.TextEditorDecorationType;
  private readonly pasteType: vscode.TextEditorDecorationType;

  constructor(context: vscode.ExtensionContext) {
    const icon = (name: string): vscode.Uri =>
      vscode.Uri.joinPath(context.extensionUri, "media", name);

    this.aiType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: icon("unread-ai.svg"),
      gutterIconSize: "contain",
      overviewRulerColor: "#b180ff",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      isWholeLine: true,
      backgroundColor: "rgba(177,128,255,0.06)",
    });
    this.pasteType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: icon("unread-paste.svg"),
      gutterIconSize: "contain",
      overviewRulerColor: "#e5d100",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      isWholeLine: true,
      backgroundColor: "rgba(229,209,0,0.07)",
    });
  }

  apply(editor: vscode.TextEditor, signals: RiskSignal[]): void {
    const ai: vscode.DecorationOptions[] = [];
    const paste: vscode.DecorationOptions[] = [];
    const max = Math.max(0, editor.document.lineCount - 1);

    for (const s of signals) {
      const start = Math.min(Math.max(0, s.startLine), max);
      const end = Math.min(Math.max(start, s.endLine), max);
      const range = new vscode.Range(start, 0, end, 0);
      const opt: vscode.DecorationOptions = {
        range,
        hoverMessage: `codeprov: ${s.message}`,
      };
      (s.origin === "ai" ? ai : paste).push(opt);
    }
    editor.setDecorations(this.aiType, ai);
    editor.setDecorations(this.pasteType, paste);
  }

  dispose(): void {
    this.aiType.dispose();
    this.pasteType.dispose();
  }
}
