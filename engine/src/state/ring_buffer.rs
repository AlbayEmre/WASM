/// Fixed-capacity circular buffer holding the last N items. Used to keep recent
/// inter-keystroke intervals for cadence analysis without unbounded growth.
pub struct RingBuffer<T> {
    items: Vec<T>,
    capacity: usize,
    head: usize,
    len: usize,
}

impl<T: Clone> RingBuffer<T> {
    pub fn new(capacity: usize) -> Self {
        RingBuffer {
            items: Vec::with_capacity(capacity),
            capacity: capacity.max(1),
            head: 0,
            len: 0,
        }
    }

    pub fn push(&mut self, item: T) {
        if self.items.len() < self.capacity {
            self.items.push(item);
        } else {
            self.items[self.head] = item;
        }
        self.head = (self.head + 1) % self.capacity;
        if self.len < self.capacity {
            self.len += 1;
        }
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn iter(&self) -> impl Iterator<Item = &T> {
        self.items.iter()
    }
}
