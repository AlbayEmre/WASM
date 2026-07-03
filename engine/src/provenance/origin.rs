use crate::types::{EngineConfig, Origin};

/// Classify how a single content change entered the document.
///
/// The clipboard comparison (paste vs AI) is done JS-side where the clipboard
/// is accessible; the result is passed in as `matches_clipboard`. Here we only
/// decide bulk-vs-typed and apply that hint.
pub fn classify_origin(
    inserted_chars: u32,
    inserted_lines: u32,
    matches_clipboard: bool,
    cfg: &EngineConfig,
) -> Origin {
    let bulk =
        inserted_chars >= cfg.paste_threshold_chars || inserted_lines >= cfg.paste_threshold_lines;
    if !bulk {
        return Origin::Typed;
    }
    if matches_clipboard {
        Origin::Pasted
    } else {
        Origin::Ai
    }
}
