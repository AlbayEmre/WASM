use crate::types::CodeBlock;

/// Whether a block has been explicitly reviewed (the only thing that clears it).
pub fn is_reviewed(block: &CodeBlock) -> bool {
    block.read
}

/// Whether two inclusive line ranges overlap.
pub fn ranges_overlap(a_start: u32, a_end: u32, b_start: u32, b_end: u32) -> bool {
    a_start <= b_end && b_start <= a_end
}
