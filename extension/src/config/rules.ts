import * as vscode from "vscode";

interface RuleSet {
  minScore: number;
  pasteThresholdLines: number;
  pasteThresholdChars: number;
  blockCommitOnUnreadSensitive: boolean;
  sensitivePaths: string[];
  ignorePaths: string[];
}

const KEYS: (keyof RuleSet)[] = [
  "minScore",
  "pasteThresholdLines",
  "pasteThresholdChars",
  "blockCommitOnUnreadSensitive",
  "sensitivePaths",
  "ignorePaths",
];

/** Export the current codeprov ruleset to a JSON file. */
export async function exportRules(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("codeprov");
  const ruleSet = Object.fromEntries(KEYS.map((k) => [k, cfg.get(k)])) as unknown as RuleSet;

  const uri = await vscode.window.showSaveDialog({
    saveLabel: "Export codeprov rules",
    filters: { JSON: ["json"] },
    defaultUri: vscode.Uri.file("codeprov.rules.json"),
  });
  if (!uri) {
    return;
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(ruleSet, null, 2), "utf8"));
  vscode.window.showInformationMessage("codeprov: rules exported. ✅");
}

/** Import a ruleset JSON and apply it to the workspace settings. */
export async function importRules(): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Import codeprov rules",
    filters: { JSON: ["json"] },
  });
  if (!picked || picked.length === 0) {
    return;
  }
  let parsed: Partial<RuleSet>;
  try {
    const raw = await vscode.workspace.fs.readFile(picked[0]);
    parsed = JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch (err) {
    vscode.window.showErrorMessage(`codeprov: could not read rules — ${String(err)}`);
    return;
  }

  const cfg = vscode.workspace.getConfiguration("codeprov");
  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  for (const k of KEYS) {
    if (parsed[k] !== undefined) {
      await cfg.update(k, parsed[k], target);
    }
  }
  vscode.window.showInformationMessage("codeprov: rules imported. ✅");
}
