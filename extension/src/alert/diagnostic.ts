import * as vscode from "vscode";
import { RiskSignal } from "../engine/types";

export const COLLECTION_NAME = "codeprov";

function severityFor(score: number): vscode.DiagnosticSeverity {
  if (score >= 0.9) {
    return vscode.DiagnosticSeverity.Warning;
  }
  if (score >= 0.7) {
    return vscode.DiagnosticSeverity.Information;
  }
  return vscode.DiagnosticSeverity.Hint;
}

/** Renders RiskSignals as inline diagnostics (squiggles) on a document. */
export class DiagnosticReporter {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  }

  refresh(doc: vscode.TextDocument, signals: RiskSignal[]): void {
    const diagnostics: vscode.Diagnostic[] = signals.map((s) => {
      const lastLine = Math.min(s.endLine, Math.max(0, doc.lineCount - 1));
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, s.startLine), 0),
        doc.lineAt(lastLine).range.end
      );
      const d = new vscode.Diagnostic(range, `codeprov: ${s.message}`, severityFor(s.score));
      d.source = COLLECTION_NAME;
      d.code = s.type;
      return d;
    });
    this.collection.set(doc.uri, diagnostics);
  }

  /** Set diagnostics by uri without an open document (for closed/off-screen files). */
  refreshByUri(uri: vscode.Uri, signals: RiskSignal[]): void {
    const diagnostics = signals.map((s) => {
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, s.startLine), 0),
        new vscode.Position(Math.max(0, s.endLine), 2000)
      );
      const d = new vscode.Diagnostic(range, `codeprov: ${s.message}`, severityFor(s.score));
      d.source = COLLECTION_NAME;
      d.code = s.type;
      return d;
    });
    this.collection.set(uri, diagnostics);
  }

  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  dispose(): void {
    this.collection.dispose();
  }
}
