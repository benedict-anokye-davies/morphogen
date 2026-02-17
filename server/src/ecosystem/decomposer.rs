use std::collections::HashMap;
use crate::ecosystem::organism::Organism;

const MINERAL_CELL_SIZE: f64 = 50.0;

pub fn recycle(organisms: &[Organism], minerals: &mut HashMap<(i32, i32), f64>) {
    for org in organisms {
        if !org.alive && org.energy > 0.0 {
            let key = mineral_cell((org.x, org.y));
            *minerals.entry(key).or_insert(0.0) += org.energy;
        }
    }
}

pub fn mineral_cell(pos: (f64, f64)) -> (i32, i32) {
    (
        (pos.0 / MINERAL_CELL_SIZE).floor() as i32,
        (pos.1 / MINERAL_CELL_SIZE).floor() as i32,
    )
}
