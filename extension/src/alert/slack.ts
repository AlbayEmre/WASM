import * as https from "https";
import * as vscode from "vscode";
import { IEngine } from "../engine/types";

/**
 * Posts an AGGREGATE provenance summary to a Slack webhook.
 *
 * Privacy contract: only counts/ratios are sent — never file contents, never
 * code, never paths beyond the basename count. Opt-in via the
 * `codeprov.alert.slackWebhook` setting and an explicit command.
 */
export async function sendSlackSummary(engine: IEngine): Promise<void> {
  const webhook = vscode.workspace
    .getConfiguration("codeprov")
    .get<string>("alert.slackWebhook", "")
    .trim();

  if (!webhook) {
    vscode.window.showWarningMessage(
      "codeprov: set `codeprov.alert.slackWebhook` first."
    );
    return;
  }

  const risks = engine.allRisks();
  const unread = risks.reduce((n, r) => n + r.signals.length, 0);
  const sensitive = risks.filter((r) => r.sensitive).length;
  const b = engine.baselineSnapshot();

  const text =
    `*codeprov session summary*\n` +
    `• Unread external blocks: *${unread}*${sensitive ? ` (incl. ${sensitive} sensitive file(s) ⚠️)` : ""}\n` +
    `• Lines — typed: ${b.linesByOrigin.typed}, pasted: ${b.linesByOrigin.pasted}, AI: ${b.linesByOrigin.ai}\n` +
    `• External ratio: ${Math.round(b.externalRatio * 100)}%\n` +
    `_Aggregate metrics only — no code or file contents are sent._`;

  try {
    await post(webhook, JSON.stringify({ text }));
    vscode.window.showInformationMessage("codeprov: summary sent to Slack. ✅");
  } catch (err) {
    vscode.window.showErrorMessage(`codeprov: Slack post failed — ${String(err)}`);
  }
}

function post(webhook: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(webhook);
    } catch {
      reject(new Error("invalid webhook URL"));
      return;
    }
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
