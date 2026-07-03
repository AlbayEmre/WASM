// Integration tests for the codeprov engine. Run with `cargo test`.
// (On Windows this needs a host linker — MSVC Build Tools or the GNU toolchain.)

use codeprov_engine::*;

fn cfg() -> String {
    serde_json::json!({
        "enabled": true,
        "min_score": 0.5,
        "paste_threshold_lines": 3,
        "paste_threshold_chars": 80,
        "sensitive_paths": ["**/auth/**"],
        "ignore_paths": ["**/node_modules/**"]
    })
    .to_string()
}

fn change(chars: u32, lines: u32, start: u32, matches_clipboard: bool) -> String {
    serde_json::json!([{
        "inserted_chars": chars,
        "inserted_lines": lines,
        "start_line": start,
        "end_line": start,
        "matches_clipboard": matches_clipboard
    }])
    .to_string()
}

#[test]
fn typed_code_is_never_risky() {
    let mut e = Engine::new(&cfg());
    let signals = e.on_change("file://a.ts", "/a.ts", &change(1, 0, 0, false), 1000.0);
    assert_eq!(signals, "[]");
}

#[test]
fn unread_ai_in_sensitive_file_is_critical() {
    let mut e = Engine::new(&cfg());
    // Bulk insert that does NOT match the clipboard -> AI origin.
    let out = e.on_change("file://auth/login.ts", "/auth/login.ts", &change(200, 8, 0, false), 1000.0);
    assert!(out.contains("UNREAD_AI_IN_SENSITIVE"), "got: {out}");
    assert!(out.contains("\"score\""));
}

#[test]
fn matching_clipboard_is_pasted_not_ai() {
    let mut e = Engine::new(&cfg());
    let out = e.on_change("file://auth/x.ts", "/auth/x.ts", &change(200, 8, 0, true), 1000.0);
    assert!(out.contains("UNREAD_PASTE_IN_SENSITIVE"), "got: {out}");
}

#[test]
fn risk_persists_until_explicitly_reviewed() {
    let mut e = Engine::new(&cfg());
    let out = e.on_change("file://b.ts", "/b.ts", &change(200, 8, 0, false), 1000.0);
    assert!(out.contains("UNREAD"), "block should start unread: {out}");
    // Re-querying without an explicit review keeps the risk.
    assert!(e.signals_for("file://b.ts", "/b.ts").contains("UNREAD"));
}

#[test]
fn explicit_review_clears_the_risk() {
    let mut e = Engine::new(&cfg());
    e.on_change("file://b.ts", "/b.ts", &change(200, 8, 0, false), 1000.0);
    // Mark the block at line 3 (inside 0..8) as reviewed -> cleared.
    let out = e.mark_block_reviewed_at("file://b.ts", "/b.ts", 3);
    assert_eq!(out, "[]", "explicit review should clear the risk, got: {out}");
}

#[test]
fn external_region_in_unopened_file_is_flagged_as_ai() {
    let mut e = Engine::new(&cfg());
    // Simulates an AI agent writing to a file you never opened.
    let out = e.flag_external_region("file://auth/new.ts", "/auth/new.ts", 0, 9, 240);
    assert!(out.contains("UNREAD_AI_IN_SENSITIVE"), "got: {out}");
    // And it persists until reviewed.
    let cleared = e.mark_block_reviewed_at("file://auth/new.ts", "/auth/new.ts", 3);
    assert_eq!(cleared, "[]");
}

#[test]
fn baseline_tracks_origin_mix() {
    let mut e = Engine::new(&cfg());
    e.on_change("file://c.ts", "/c.ts", &change(200, 8, 0, false), 1000.0);
    let b = e.baseline_json();
    assert!(b.contains("\"ai\""));
}
