//! codeprov engine — code provenance (origin + attention + scoring) for WASM.
//!
//! Mirrors the TypeScript engine in `extension/src/engine`. The JS side handles
//! editor events and clipboard access, then feeds normalized changes here. This
//! crate owns the block state and risk scoring.
//!
//!  no panics (all fallible paths return Result/strings),
//! no `unsafe`, wasm-bindgen exports are snake_case.
#![forbid(unsafe_code)]

mod provenance;
mod scoring;
mod state;
mod types;

use std::collections::HashMap;

use serde::Deserialize;
use wasm_bindgen::prelude::*;

use provenance::origin::classify_origin;
use provenance::sensitivity::is_sensitive;
use scoring::score_block;
use state::baseline::SessionBaseline;
use state::block_map::FileBlocks;
use types::{EngineConfig, Origin, RiskSignal};

#[derive(Deserialize)]
struct ChangeInput {
    inserted_chars: u32,
    inserted_lines: u32,
    start_line: u32,
    end_line: u32,
    matches_clipboard: bool,
}

/// The provenance engine, exported to JS. Construct once and reuse (singleton).
#[wasm_bindgen]
pub struct Engine {
    files: HashMap<String, FileBlocks>,
    baseline: SessionBaseline,
    cfg: EngineConfig,
    last_change_at: f64,
}

#[wasm_bindgen]
impl Engine {
    /// Create an engine from a JSON `EngineConfig`. Falls back to defaults on
    /// parse failure so the JS side never has to handle a constructor error.
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Engine {
        let cfg = serde_json::from_str(config_json).unwrap_or_default();
        Engine {
            files: HashMap::new(),
            baseline: SessionBaseline::default(),
            cfg,
            last_change_at: 0.0,
        }
    }

    pub fn update_config(&mut self, config_json: &str) {
        if let Ok(cfg) = serde_json::from_str(config_json) {
            self.cfg = cfg;
        }
    }

    /// Process a batch of content changes. `changes_json` is a JSON array of
    /// `{inserted_chars, inserted_lines, start_line, end_line, matches_clipboard}`.
    /// Returns a JSON array of RiskSignal.
    pub fn on_change(
        &mut self,
        uri: &str,
        fs_path: &str,
        changes_json: &str,
        now_ms: f64,
    ) -> String {
        if !self.cfg.enabled || is_sensitive(fs_path, &self.cfg.ignore_paths) {
            return "[]".to_string();
        }
        let changes: Vec<ChangeInput> = match serde_json::from_str(changes_json) {
            Ok(c) => c,
            Err(_) => return "[]".to_string(),
        };

        let since_last = if self.last_change_at == 0.0 {
            f64::INFINITY
        } else {
            now_ms - self.last_change_at
        };

        let fb = self
            .files
            .entry(uri.to_string())
            .or_insert_with(|| FileBlocks::new(fs_path.to_string()));

        for c in &changes {
            let removed_span = c.end_line.saturating_sub(c.start_line);
            let line_delta = c.inserted_lines as i64 - removed_span as i64;
            fb.apply_shift(c.start_line, c.end_line, line_delta);

            let origin = classify_origin(
                c.inserted_chars,
                c.inserted_lines,
                c.matches_clipboard,
                &self.cfg,
            );

            if origin == Origin::Typed {
                if c.inserted_chars <= 2 {
                    self.baseline.record_typing_interval(since_last);
                }
                self.baseline.record_lines(Origin::Typed, 1);
                fb.mark_edited(c.start_line);
            } else {
                fb.add_block(
                    c.start_line,
                    c.start_line + c.inserted_lines,
                    origin,
                    c.inserted_chars,
                    now_ms,
                );
                self.baseline.record_lines(origin, c.inserted_lines + 1);
            }
        }
        self.last_change_at = now_ms;
        self.signals_json(uri, fs_path)
    }

    /// Explicit "Mark as reviewed" on the block at `line` — the only clear.
    pub fn mark_block_reviewed_at(&mut self, uri: &str, fs_path: &str, line: u32) -> String {
        if let Some(fb) = self.files.get_mut(uri) {
            fb.mark_reviewed_at(line);
        }
        self.signals_json(uri, fs_path)
    }

    /// Flag external code in a file we are NOT editing (disk watcher). No
    /// clipboard context exists off-screen, so it is always treated as AI.
    pub fn flag_external_region(
        &mut self,
        uri: &str,
        fs_path: &str,
        start_line: u32,
        end_line: u32,
        char_count: u32,
    ) -> String {
        if !self.cfg.enabled || is_sensitive(fs_path, &self.cfg.ignore_paths) {
            return "[]".to_string();
        }
        let mut fb = FileBlocks::new(fs_path.to_string());
        fb.add_block(start_line, end_line, Origin::Ai, char_count, 0.0);
        self.baseline
            .record_lines(Origin::Ai, end_line.saturating_sub(start_line) + 1);
        self.files.insert(uri.to_string(), fb);
        self.signals_json(uri, fs_path)
    }

    pub fn mark_file_reviewed(&mut self, uri: &str) {
        if let Some(fb) = self.files.get_mut(uri) {
            fb.mark_all_read();
        }
    }

    pub fn forget(&mut self, uri: &str) {
        self.files.remove(uri);
    }

    pub fn signals_for(&self, uri: &str, fs_path: &str) -> String {
        self.signals_json(uri, fs_path)
    }

    /// JSON snapshot of the session baseline (shape matches BaselineSnapshot).
    pub fn baseline_json(&self) -> String {
        serde_json::json!({
            "linesByOrigin": {
                "typed": self.baseline.typed_lines,
                "pasted": self.baseline.pasted_lines,
                "ai": self.baseline.ai_lines,
            },
            "externalLines": self.baseline.external_lines(),
            "totalLines": self.baseline.total_lines(),
            "externalRatio": self.baseline.external_ratio(),
            "avgCadenceMs": self.baseline.avg_cadence_ms(),
            "unreadCleared": self.baseline.unread_cleared,
        })
        .to_string()
    }

    /// JSON array of every file's current risks: `[{uri, fsPath, sensitive, signals}]`.
    pub fn all_risks_json(&self) -> String {
        let risks: Vec<serde_json::Value> = self
            .files
            .iter()
            .filter_map(|(uri, fb)| {
                let signals = self.collect_signals(uri, &fb.fs_path);
                if signals.is_empty() {
                    None
                } else {
                    Some(serde_json::json!({
                        "uri": uri,
                        "fsPath": fb.fs_path,
                        "sensitive": is_sensitive(&fb.fs_path, &self.cfg.sensitive_paths),
                        "signals": signals,
                    }))
                }
            })
            .collect();
        serde_json::to_string(&risks).unwrap_or_else(|_| "[]".to_string())
    }

    /// JSON array of every tracked file with its raw blocks: `[{uri, fsPath, blocks}]`.
    pub fn all_files_json(&self) -> String {
        let files: Vec<serde_json::Value> = self
            .files
            .iter()
            .map(|(uri, fb)| {
                serde_json::json!({ "uri": uri, "fsPath": fb.fs_path, "blocks": fb.blocks })
            })
            .collect();
        serde_json::to_string(&files).unwrap_or_else(|_| "[]".to_string())
    }
}

impl Engine {
    fn signals_json(&self, uri: &str, fs_path: &str) -> String {
        let signals = self.collect_signals(uri, fs_path);
        serde_json::to_string(&signals).unwrap_or_else(|_| "[]".to_string())
    }

    fn collect_signals(&self, uri: &str, fs_path: &str) -> Vec<RiskSignal> {
        let Some(fb) = self.files.get(uri) else {
            return Vec::new();
        };
        let sensitive = is_sensitive(fs_path, &self.cfg.sensitive_paths);
        fb.blocks
            .iter()
            .filter_map(|b| score_block(b, sensitive))
            .filter(|s| s.score >= self.cfg.min_score)
            .collect()
    }
}
