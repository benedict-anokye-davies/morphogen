use std::collections::HashMap;

use crate::terrain::chunk::{generate_chunk, Chunk};

/// Planet owns the world seed and lazily generates chunks on demand.
///
/// Chunks are cached in a HashMap keyed by grid coordinates. Once generated,
/// a chunk is never regenerated — the same coordinates always return the same data.
#[derive(Debug)]
pub struct Planet {
    pub seed: u64,
    pub chunks: HashMap<(i32, i32), Chunk>,
}

impl Planet {
    pub fn new(seed: u64) -> Self {
        Self {
            seed,
            chunks: HashMap::new(),
        }
    }

    /// Returns a reference to the chunk at (x, z), generating it if not yet cached.
    pub fn get_or_generate_chunk(&mut self, x: i32, z: i32) -> &Chunk {
        let seed = self.seed;
        self.chunks
            .entry((x, z))
            .or_insert_with(|| generate_chunk(seed, x, z))
    }
}
