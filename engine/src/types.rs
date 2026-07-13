use serde::{Deserialize, Serialize};

/// How a block of code entered the file.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Typed,
    Pasted,
    Ai,
}

impl Origin {
    pub fn is_external(self) -> bool {
        matches!(self, Origin::Pasted | Origin::Ai)
    }
}

/// A contiguous run of lines sharing a single origin.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeBlock {
    pub id: u32,
    pub start_line: u32,
    pub end_line: u32,
    pub origin: Origin,
    pub created_at_ms: f64,
    /// Set only by an explicit "Mark as reviewed" action — the only way to clear.
    pub read: bool,
    pub edited: bool,
    pub char_count: u32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SignalType {
    UnreadAiInSensitive,
    UnreadPasteInSensitive,
    LargeUnreadAiBlock,
    BulkPasteUnread,
}

/// A risk surfaced to the UI.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskSignal {
    #[serde(rename = "type")]
    pub signal_type: SignalType,
    pub score: f32,
    pub start_line: u32,
    pub end_line: u32,
    pub origin: Origin,
    pub message: String,
    pub suggestion: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineConfig {
    pub enabled: bool,
    pub min_score: f32,
    pub paste_threshold_lines: u32,
    pub paste_threshold_chars: u32,
    pub sensitive_paths: Vec<String>,
    pub ignore_paths: Vec<String>,
}

impl Default for EngineConfig {
    fn default() -> Self {
        EngineConfig {
            enabled: true,
            min_score: 0.5,
            paste_threshold_lines: 3,
            paste_threshold_chars: 80,
            sensitive_paths: Vec::new(),
            ignore_paths: Vec::new(),
        }
    }
}
