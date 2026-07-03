use crate::state::ring_buffer::RingBuffer;
use crate::types::Origin;

/// Per-session behavioural baseline: typing cadence + origin line mix.
/// Port of the TS `baseline.ts`. In-memory and session-scoped only.
pub struct SessionBaseline {
    intervals: RingBuffer<f64>,
    pub typed_lines: u32,
    pub pasted_lines: u32,
    pub ai_lines: u32,
    pub unread_cleared: u32,
}

impl Default for SessionBaseline {
    fn default() -> Self {
        SessionBaseline {
            intervals: RingBuffer::new(128),
            typed_lines: 0,
            pasted_lines: 0,
            ai_lines: 0,
            unread_cleared: 0,
        }
    }
}

impl SessionBaseline {
    pub fn record_typing_interval(&mut self, ms: f64) {
        if ms <= 0.0 || ms > 5000.0 {
            return;
        }
        self.intervals.push(ms);
    }

    pub fn record_lines(&mut self, origin: Origin, lines: u32) {
        let n = lines.max(1);
        match origin {
            Origin::Typed => self.typed_lines += n,
            Origin::Pasted => self.pasted_lines += n,
            Origin::Ai => self.ai_lines += n,
        }
    }

    pub fn avg_cadence_ms(&self) -> u32 {
        if self.intervals.is_empty() {
            return 0;
        }
        let sum: f64 = self.intervals.iter().sum();
        (sum / self.intervals.len() as f64).round() as u32
    }

    pub fn external_lines(&self) -> u32 {
        self.pasted_lines + self.ai_lines
    }

    pub fn total_lines(&self) -> u32 {
        self.typed_lines + self.external_lines()
    }

    pub fn external_ratio(&self) -> f32 {
        let t = self.total_lines();
        if t == 0 {
            0.0
        } else {
            self.external_lines() as f32 / t as f32
        }
    }
}
