import * as vscode from "vscode";
import { COLLECTION_NAME } from "./diagnostic";

/**
 * Offers a "Mark as reviewed" quick fix on each codeprov diagnostic.
 *
 * Flow for the user: put the cursor on the squiggle → Ctrl+. → the action is
 * pre-selected → Enter. This is the ONLY way an unread marker clears — moving
 * the cursor over the code no longer does anything.
 */
export class ReviewCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    _doc: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const ours = context.diagnostics.filter((d) => d.source === COLLECTION_NAME);
    return ours.map((d) => {
      const action = new vscode.CodeAction(
        "codeprov: Mark this block as reviewed",
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [d];
      action.isPreferred = true;
      action.command = {
        command: "codeprov.markBlockReviewed",
        title: "Mark as reviewed",
        arguments: [d.range.start.line],
      };
      return action;
    });
  }
}
