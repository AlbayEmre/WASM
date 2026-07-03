use crate::provenance::attention::ranges_overlap;
use crate::types::{CodeBlock, Origin};

/// Tracks origin/attention for the blocks of a single file, keeping line
/// ranges in sync as the document is edited. Port of the TS `blockMap.ts`.
#[derive(Default)]
pub struct FileBlocks {
    /// Kept for parity with the TS engine / future per-file reporting.
    #[allow(dead_code)]
    pub fs_path: String,
    pub blocks: Vec<CodeBlock>,
    next_id: u32,
}

impl FileBlocks {
    pub fn new(fs_path: String) -> Self {
        FileBlocks {
            fs_path,
            blocks: Vec::new(),
            next_id: 1,
        }
    }

    pub fn add_block(
        &mut self,
        start_line: u32,
        end_line: u32,
        origin: Origin,
        char_count: u32,
        now_ms: f64,
    ) {
        // Skip if fully inside an existing same-origin block.
        for b in &self.blocks {
            if b.origin == origin && start_line >= b.start_line && end_line <= b.end_line {
                return;
            }
        }
        let id = self.next_id;
        self.next_id += 1;
        self.blocks.push(CodeBlock {
            id,
            start_line,
            end_line,
            origin,
            created_at_ms: now_ms,
            read: false,
            edited: false,
            ran: false,
            char_count,
        });
    }

    /// Apply a document edit, shifting blocks below and resizing overlaps.
    pub fn apply_shift(&mut self, change_start: u32, change_end: u32, line_delta: i64) {
        if line_delta == 0 {
            return;
        }
        for b in &mut self.blocks {
            if b.start_line > change_end {
                b.start_line = shift(b.start_line, line_delta);
                b.end_line = shift(b.end_line, line_delta);
            } else if ranges_overlap(change_start, change_end, b.start_line, b.end_line) {
                let new_end = shift(b.end_line, line_delta);
                b.end_line = new_end.max(b.start_line);
            }
        }
    }

    /// Explicitly mark the block containing this line as reviewed (the only clear).
    pub fn mark_reviewed_at(&mut self, line: u32) {
        for b in &mut self.blocks {
            if !b.read && line >= b.start_line && line <= b.end_line {
                b.read = true;
            }
        }
    }

    pub fn mark_edited(&mut self, line: u32) {
        for b in &mut self.blocks {
            if line >= b.start_line && line <= b.end_line {
                b.edited = true;
            }
        }
    }

    pub fn mark_all_read(&mut self) {
        for b in &mut self.blocks {
            b.read = true;
        }
    }
}

fn shift(value: u32, delta: i64) -> u32 {
    let result = value as i64 + delta;
    if result < 0 {
        0
    } else {
        result as u32
    }
}
