import * as vscode from "vscode";

/**
 * Watches the built-in Git extension and fires when a commit lands (the HEAD
 * commit hash changes). VS Code's Git API has no pre-commit hook for
 * extensions, so we react just after the commit to warn before the code is
 * pushed. Degrades silently if the Git extension is unavailable.
 */
export class GitWatcher {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly heads = new Map<string, string>();

  constructor(private readonly onCommit: () => void) {}

  async start(): Promise<void> {
    const ext = vscode.extensions.getExtension<GitExtensionShape>("vscode.git");
    if (!ext) {
      return;
    }
    const exports = ext.isActive ? ext.exports : await ext.activate();
    const api = exports.getAPI(1);

    const wire = (repo: GitRepoShape): void => {
      this.heads.set(repo.rootUri.toString(), repo.state.HEAD?.commit ?? "");
      this.disposables.push(
        repo.state.onDidChange(() => {
          const key = repo.rootUri.toString();
          const current = repo.state.HEAD?.commit ?? "";
          const previous = this.heads.get(key);
          if (current && previous !== undefined && current !== previous) {
            this.heads.set(key, current);
            this.onCommit();
          } else {
            this.heads.set(key, current);
          }
        })
      );
    };

    api.repositories.forEach(wire);
    this.disposables.push(api.onDidOpenRepository(wire));
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

// Minimal structural typings for the bits of the Git API we touch.
interface GitExtensionShape {
  getAPI(version: 1): GitApiShape;
}
interface GitApiShape {
  repositories: GitRepoShape[];
  onDidOpenRepository(cb: (repo: GitRepoShape) => void): vscode.Disposable;
}
interface GitRepoShape {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { commit?: string };
    onDidChange(cb: () => void): vscode.Disposable;
  };
}
