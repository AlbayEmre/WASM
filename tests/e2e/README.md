# End-to-end tests

The provenance engine's behaviour is covered by fast Rust integration tests in
[`../../engine/tests/engine_test.rs`](../../engine/tests/engine_test.rs) — run them with:

```bash
cd engine
cargo test            # (Windows: cargo +stable-x86_64-pc-windows-gnu test)
```

These exercise the exact logic that the WASM engine ships (origin classification,
attention clearing, sensitivity scoring, baseline tracking).

## VS Code host tests (manual / future)

Full editor-host tests need `@vscode/test-electron`. The manual smoke test is:

1. `cd extension && npm run compile`, press **F5**.
2. Paste `../fixtures/demo_paste_me.txt` into a file under `src/auth/` → expect a
   red **UNREAD_*_IN_SENSITIVE** squiggle + status bar count.
3. Click into the block → squiggle clears.
4. Run **codeprov: Check unread AI/pasted code** with an unread block → modal warns.
5. Check the Output/Debug console for `codeprov: using Rust/WASM engine.`
