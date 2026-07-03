import * as vscode from "vscode";
import { IEngine } from "../engine/types";
import { scoreBlock, isSensitive } from "../engine/scoring";

/** Opens a webview summarising provenance for the current session. */
export function showReport(engine: IEngine): void {
  const panel = vscode.window.createWebviewPanel(
    "codeprovReport",
    "codeprov — Provenance Report",
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );
  panel.webview.html = renderHtml(engine);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function renderHtml(engine: IEngine): string {
  const b = engine.baselineSnapshot();
  const files = engine.allFiles();

  let unreadBlocks = 0;
  const rows: string[] = [];
  for (const f of files) {
    const sensitive = isSensitive(f.fsPath, engine.cfg.sensitivePaths);
    const unread = f.blocks.filter((blk) => scoreBlock(blk, sensitive));
    if (f.blocks.length === 0) {
      continue;
    }
    unreadBlocks += unread.length;
    const name = f.fsPath.split(/[/\\]/).pop() ?? f.fsPath;
    rows.push(`<tr>
      <td>${esc(name)}${sensitive ? ' <span class="tag sens">sensitive</span>' : ""}</td>
      <td>${f.blocks.length}</td>
      <td class="${unread.length ? "bad" : "ok"}">${unread.length}</td>
    </tr>`);
  }

  const ratioPct = Math.round(b.externalRatio * 100);
  const tableBody = rows.length ? rows.join("") : `<tr><td colspan="3">No tracked files yet.</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }
  h1 { font-size: 1.3em; } h2 { font-size: 1.05em; margin-top: 1.4em; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; }
  .card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border);
    border-radius: 8px; padding: 12px 16px; min-width: 120px; }
  .num { font-size: 1.8em; font-weight: 700; }
  .lbl { opacity: 0.7; font-size: 0.85em; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-widget-border); }
  .bad { color: #ff6b6b; font-weight: 700; } .ok { color: #6bdc8b; }
  .tag { font-size: 0.7em; padding: 1px 6px; border-radius: 6px; background: #ffb45433; }
  .tag.sens { background: #ff6b6b33; color: #ff9d9d; }
  .bar { height: 10px; border-radius: 5px; background: var(--vscode-input-background); overflow: hidden; margin-top: 6px; }
  .bar > i { display: block; height: 100%; background: linear-gradient(90deg,#ffb454,#b180ff); }
</style></head><body>
  <h1>🛡️ codeprov — Session Provenance</h1>
  <div class="cards">
    <div class="card"><div class="num">${b.linesByOrigin.typed}</div><div class="lbl">typed lines</div></div>
    <div class="card"><div class="num">${b.linesByOrigin.pasted}</div><div class="lbl">pasted lines</div></div>
    <div class="card"><div class="num">${b.linesByOrigin.ai}</div><div class="lbl">AI lines</div></div>
    <div class="card"><div class="num ${unreadBlocks ? "bad" : "ok"}">${unreadBlocks}</div><div class="lbl">unread blocks</div></div>
  </div>

  <h2>External code ratio: ${ratioPct}%</h2>
  <div class="bar"><i style="width:${ratioPct}%"></i></div>
  <p class="lbl">${b.externalLines} of ${b.totalLines} lines came from paste/AI rather than your keyboard.
  Avg typing cadence: ${b.avgCadenceMs || "—"} ms/char · blocks reviewed: ${b.unreadCleared}.</p>

  <h2>Files</h2>
  <table>
    <thead><tr><th>File</th><th>Blocks</th><th>Unread</th></tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
  <p class="lbl">All data is in-memory and session-scoped. Nothing leaves your machine.</p>
</body></html>`;
}
