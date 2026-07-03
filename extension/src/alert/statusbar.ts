import * as vscode from "vscode";

/** Status bar item showing how much unread external code is outstanding. */
export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "codeprov.checkUnread";
    this.item.show();
    this.update(0, false);
  }

  update(unreadBlocks: number, anySensitive: boolean): void {
    if (unreadBlocks === 0) {
      this.item.text = "$(eye) codeprov: clean";
      this.item.tooltip = "No unread AI/pasted code. Click to re-check.";
      this.item.backgroundColor = undefined;
      return;
    }
    const icon = anySensitive ? "$(alert)" : "$(eye-closed)";
    this.item.text = `${icon} codeprov: ${unreadBlocks} unread`;
    this.item.tooltip = `${unreadBlocks} unread external block(s)${
      anySensitive ? " — including a sensitive file" : ""
    }. Click to review.`;
    this.item.backgroundColor = anySensitive
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
  }

  /** Draw attention when external code lands in a file you're not on. */
  flash(): void {
    this.item.text = "$(alert) codeprov: external code detected";
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }

  dispose(): void {
    this.item.dispose();
  }
}
