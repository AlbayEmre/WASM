import * as vscode from "vscode";
import { Engine } from "./engine/engine";
import { EngineConfig, IEngine, RiskSignal } from "./engine/types";
import { tryLoadWasmEngine } from "./engine/wasm_bridge";
import { WasmEngine, toWasmConfig } from "./engine/wasmEngine";
import { DiagnosticReporter } from "./alert/diagnostic";
import { StatusBar } from "./alert/statusbar";
import { GutterDecorations } from "./alert/gutter";
import { checkUnread } from "./alert/commitGuard";
import { showReport } from "./alert/report";
import { sendSlackSummary } from "./alert/slack";
import { ReviewCodeActionProvider } from "./alert/codeAction";
import { GitWatcher } from "./collector/git";
import { DiskWatcher } from "./collector/watcher";
import { exportRules, importRules } from "./config/rules";

function readConfig(): EngineConfig {
  const c = vscode.workspace.getConfiguration("codeprov");
  return {
    enabled: c.get<boolean>("enabled", true),
    minScore: c.get<number>("minScore", 0.5),
    pasteThresholdLines: c.get<number>("pasteThresholdLines", 3),
    pasteThresholdChars: c.get<number>("pasteThresholdChars", 80),
    sensitivePaths: c.get<string[]>("sensitivePaths", []),
    ignorePaths: c.get<string[]>("ignorePaths", []),
  };
}

/** Prefer the Rust/WASM engine; fall back to the TS engine if it isn't built. */
async function createEngine(cfg: EngineConfig): Promise<IEngine> {
  const wasm = await tryLoadWasmEngine(JSON.stringify(toWasmConfig(cfg)));
  if (wasm) {
    console.log("codeprov: using Rust/WASM engine.");
    return new WasmEngine(wasm, cfg);
  }
  console.log("codeprov: using TypeScript engine (WASM not built).");
  return new Engine(cfg);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const engine = await createEngine(readConfig());
  const reporter = new DiagnosticReporter();
  const statusBar = new StatusBar();
  const gutter = new GutterDecorations(context);

  const refreshStatus = (): void => {
    const risks = engine.allRisks();
    const total = risks.reduce((n, r) => n + r.signals.length, 0);
    statusBar.update(total, risks.some((r) => r.sensitive));
  };

  const render = (doc: vscode.TextDocument, signals: RiskSignal[]): void => {
    reporter.refresh(doc, signals);
    for (const ed of vscode.window.visibleTextEditors) {
      if (ed.document.uri.toString() === doc.uri.toString()) {
        gutter.apply(ed, signals);
      }
    }
    refreshStatus();
  };

  // --- Origin tracking (needs the clipboard to split paste vs AI) ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (e.contentChanges.length === 0) {
        return;
      }
      const clipboard = await vscode.env.clipboard.readText().then(
        (t) => t,
        () => ""
      );
      const signals = engine.onChange({
        uri: e.document.uri.toString(),
        fsPath: e.document.uri.fsPath,
        clipboard,
        changes: e.contentChanges,
      });
      render(e.document, signals);
    }),

    // Re-apply decorations when switching editors.
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (!ed) {
        return;
      }
      const signals = engine.signalsFor(ed.document.uri.toString(), ed.document.uri.fsPath);
      gutter.apply(ed, signals);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("codeprov")) {
        engine.updateConfig(readConfig());
      }
    }),

    vscode.workspace.onDidCloseTextDocument((doc) => {
      engine.forget(doc.uri.toString());
      reporter.clear(doc.uri);
      refreshStatus();
    })
  );

  // --- Commit watcher (post-commit warning) ---
  const git = new GitWatcher(() => {
    const risks = engine.allRisks();
    const unread = risks.reduce((n, r) => n + r.signals.length, 0);
    if (unread > 0) {
      vscode.window
        .showWarningMessage(
          `codeprov: you just committed ${unread} unread external block(s). Review before pushing.`,
          "Show report"
        )
        .then((pick) => {
          if (pick === "Show report") {
            showReport(engine);
          }
        });
    }
  });
  void git.start();
  context.subscriptions.push({ dispose: () => git.dispose() });

  // --- Disk watcher: flag external code in files you are NOT editing ---
  const diskWatcher = new DiskWatcher({
    isOpen: (uri) => vscode.workspace.textDocuments.some((d) => d.uri.toString() === uri),
    ignorePaths: () => readConfig().ignorePaths,
    onExternal: (uri, startLine, endLine, charCount) => {
      const signals = engine.flagExternalRegion(
        uri.toString(),
        uri.fsPath,
        startLine,
        endLine,
        charCount
      );
      reporter.refreshByUri(uri, signals);
      refreshStatus();
      if (signals.length > 0) {
        statusBar.flash();
      }
    },
  });
  diskWatcher.start(context);

  // --- "Mark as reviewed" quick fix (the only way to clear a marker) ---
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider("*", new ReviewCodeActionProvider(), {
      providedCodeActionKinds: ReviewCodeActionProvider.providedKinds,
    })
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("codeprov.markBlockReviewed", (line?: number) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const ln = typeof line === "number" ? line : editor.selection.active.line;
      const signals = engine.markReviewedAt(
        editor.document.uri.toString(),
        editor.document.uri.fsPath,
        ln
      );
      render(editor.document, signals);
    }),
    vscode.commands.registerCommand("codeprov.checkUnread", () => {
      const blockOnSensitive = vscode.workspace
        .getConfiguration("codeprov")
        .get<boolean>("blockCommitOnUnreadSensitive", true);
      return checkUnread(engine, blockOnSensitive);
    }),
    vscode.commands.registerCommand("codeprov.markFileReviewed", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      engine.markFileReviewed(editor.document.uri.toString());
      const signals = engine.signalsFor(editor.document.uri.toString(), editor.document.uri.fsPath);
      render(editor.document, signals);
      vscode.window.showInformationMessage("codeprov: current file marked reviewed.");
    }),
    vscode.commands.registerCommand("codeprov.showReport", () => showReport(engine)),
    vscode.commands.registerCommand("codeprov.sendSlackSummary", () => sendSlackSummary(engine)),
    vscode.commands.registerCommand("codeprov.exportRules", () => exportRules()),
    vscode.commands.registerCommand("codeprov.importRules", () => importRules()),

    reporter,
    statusBar,
    gutter
  );
}

export function deactivate(): void {
  // Subscriptions disposed by VS Code.
}
