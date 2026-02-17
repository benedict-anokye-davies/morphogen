use std::collections::HashMap;

pub struct SpatialGrid {
    pub cell_size: f64,
    pub cells: HashMap<(i32, i32), Vec<usize>>,
}

impl SpatialGrid {
    pub fn new(cell_size: f64) -> Self {
        Self {
            cell_size,
            cells: HashMap::new(),
        }
    }

    pub fn clear(&mut self) {
        self.cells.clear();
    }

    pub fn insert(&mut self, id: usize, pos: (f64, f64)) {
        let key = self.cell_key(pos);
        self.cells.entry(key).or_default().push(id);
    }

    pub fn query_radius(&self, pos: (f64, f64), radius: f64) -> Vec<usize> {
        let cx = (pos.0 / self.cell_size).floor() as i32;
        let cy = (pos.1 / self.cell_size).floor() as i32;
        let span = (radius / self.cell_size).ceil() as i32 + 1;

        let mut result = Vec::new();
        for dx in -span..=span {
            for dy in -span..=span {
                if let Some(ids) = self.cells.get(&(cx + dx, cy + dy)) {
                    result.extend_from_slice(ids);
                }
            }
        }
        result
    }

    fn cell_key(&self, pos: (f64, f64)) -> (i32, i32) {
        (
            (pos.0 / self.cell_size).floor() as i32,
            (pos.1 / self.cell_size).floor() as i32,
        )
    }
}
