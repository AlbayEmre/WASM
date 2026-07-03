use crate::provenance::attention::is_reviewed;
use crate::types::{CodeBlock, Origin, RiskSignal, SignalType};

/// Compute the review-risk for a single block, or `None` if it carries no risk
/// (typed origin, or already reviewed). Port of the TS `scoring.ts`.
pub fn score_block(block: &CodeBlock, sensitive: bool) -> Option<RiskSignal> {
    if !block.origin.is_external() || is_reviewed(block) {
        return None;
    }

    let lines = block.end_line.saturating_sub(block.start_line) + 1;
    let mut score = 0.5 + (lines as f32 / 40.0).min(1.0) * 0.3;
    if sensitive {
        score = (score + 0.25).min(1.0);
    }

    let ai_like = block.origin == Origin::Ai;
    let origin_label = if ai_like { "AI-generated" } else { "pasted" };

    let signal_type = if sensitive {
        if ai_like {
            SignalType::UnreadAiInSensitive
        } else {
            SignalType::UnreadPasteInSensitive
        }
    } else if ai_like {
        SignalType::LargeUnreadAiBlock
    } else {
        SignalType::BulkPasteUnread
    };

    let where_ = if sensitive {
        " in a security-sensitive file"
    } else {
        ""
    };
    let plural = if lines == 1 { "" } else { "s" };

    Some(RiskSignal {
        signal_type,
        score,
        start_line: block.start_line,
        end_line: block.end_line,
        origin: block.origin,
        message: format!("{lines} line{plural} of {origin_label} code{where_} not yet reviewed."),
        suggestion: "Read through this block (or edit/run it) before committing.".to_string(),
    })
}
