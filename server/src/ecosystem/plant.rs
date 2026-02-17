use std::collections::HashMap;
use std::f64::consts::PI;
use rand::Rng;

use crate::ecosystem::decomposer::mineral_cell;
use crate::ecosystem::organism::{Organism, OrganismKind};

pub fn tick(
    idx: usize,
    organisms: &mut Vec<Organism>,
    light_level: f64,
    water_level: f64,
    minerals: &mut HashMap<(i32, i32), f64>,
    next_id: &mut u64,
    plant_count: usize,
    rng: &mut impl Rng,
) -> Option<Organism> {
    let cell = mineral_cell((organisms[idx].x, organisms[idx].y));

    let mineral_in = {
        let pool = minerals.entry(cell).or_insert(0.0);
        let absorbed = (*pool * 0.15).min(*pool);
        *pool -= absorbed;
        absorbed
    };

    let light_per_plant = if plant_count > 0 {
        light_level * organisms[idx].genome.light_need() * 30.0 / (plant_count as f64)
    } else {
        0.0
    };

    let water_deficit = (organisms[idx].genome.water_need() - water_level).max(0.0);
    let water_drain = water_deficit;

    let metabolic_drain =
        organisms[idx].genome.metabolic_rate() * organisms[idx].genome.size() * 0.3;

    organisms[idx].energy += light_per_plant + mineral_in;
    organisms[idx].energy -= metabolic_drain + water_drain;
    organisms[idx].age += 1;

    let lifespan = organisms[idx].genome.lifespan_base() as u32;
    if organisms[idx].energy <= 0.0 || organisms[idx].age > lifespan {
        organisms[idx].alive = false;
        return None;
    }

    if organisms[idx].energy > organisms[idx].genome.reproduction_threshold() {
        let child_energy = organisms[idx].energy * 0.4;
        organisms[idx].energy -= child_energy;

        let angle = rng.random::<f64>() * 2.0 * PI;
        let dist = rng.random::<f64>() * organisms[idx].genome.seed_range();
        let child_x = (organisms[idx].x + angle.cos() * dist).clamp(0.0, super::world::WORLD_SIZE);
        let child_y = (organisms[idx].y + angle.sin() * dist).clamp(0.0, super::world::WORLD_SIZE);

        let child_genome = organisms[idx].genome.mutate(rng);
        let child_id = *next_id;
        *next_id += 1;

        return Some(Organism {
            id: child_id,
            genome: child_genome,
            energy: child_energy,
            age: 0,
            x: child_x,
            y: child_y,
            species_id: organisms[idx].species_id,
            alive: true,
            kind: OrganismKind::Plant,
        });
    }

    None
}
