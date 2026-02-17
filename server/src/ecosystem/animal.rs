use std::f64::consts::PI;
use rand::Rng;

use crate::ecosystem::organism::{Organism, OrganismKind};
use crate::ecosystem::spatial::SpatialGrid;

fn dist(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = ax - bx;
    let dy = ay - by;
    (dx * dx + dy * dy).sqrt()
}

pub fn tick(
    idx: usize,
    organisms: &mut Vec<Organism>,
    grid: &SpatialGrid,
    next_id: &mut u64,
    rng: &mut impl Rng,
) -> Option<Organism> {
    let (px, py) = (organisms[idx].x, organisms[idx].y);
    let sense = organisms[idx].genome.sense_range();
    let diet = organisms[idx].genome.diet_preference();
    let spd = organisms[idx].genome.speed();
    let sz = organisms[idx].genome.size();
    let parent_kind = organisms[idx].kind;

    let candidates = grid.query_radius((px, py), sense);

    let mut best_food: Option<(usize, f64)> = None;
    let mut nearest_threat: Option<(usize, f64)> = None;

    for &ni in &candidates {
        if ni == idx || !organisms[ni].alive {
            continue;
        }
        let d = dist(px, py, organisms[ni].x, organisms[ni].y);
        match organisms[ni].kind {
            OrganismKind::Plant => {
                if diet < 0.7 {
                    let score = organisms[ni].energy / (d + 1.0);
                    if best_food.map_or(true, |(_, s)| score > s) {
                        best_food = Some((ni, score));
                    }
                }
            }
            OrganismKind::Herbivore | OrganismKind::Carnivore => {
                let prey_diet = organisms[ni].genome.diet_preference();
                if diet > 0.3 && prey_diet < diet && organisms[ni].genome.size() <= sz * 1.5 {
                    let score = organisms[ni].energy / (d + 1.0);
                    if best_food.map_or(true, |(_, s)| score > s) {
                        best_food = Some((ni, score));
                    }
                }
                if prey_diet > diet && organisms[ni].genome.size() > sz {
                    if nearest_threat.map_or(true, |(_, td)| d < td) {
                        nearest_threat = Some((ni, d));
                    }
                }
            }
            OrganismKind::Decomposer => {}
        }
    }

    let direction: (f64, f64) = if let Some((threat_idx, _)) = nearest_threat {
        let dx = px - organisms[threat_idx].x;
        let dy = py - organisms[threat_idx].y;
        let len = (dx * dx + dy * dy).sqrt().max(f64::EPSILON);
        (dx / len, dy / len)
    } else if let Some((food_idx, _)) = best_food {
        let dx = organisms[food_idx].x - px;
        let dy = organisms[food_idx].y - py;
        let len = (dx * dx + dy * dy).sqrt().max(f64::EPSILON);
        (dx / len, dy / len)
    } else {
        let angle = rng.random::<f64>() * 2.0 * PI;
        (angle.cos(), angle.sin())
    };

    organisms[idx].x = (px + direction.0 * spd).clamp(0.0, super::world::WORLD_SIZE);
    organisms[idx].y = (py + direction.1 * spd).clamp(0.0, super::world::WORLD_SIZE);

    let move_cost = spd * sz * 0.08;
    organisms[idx].energy -= move_cost;

    if let Some((food_idx, _)) = best_food {
        let contact_range = sz + organisms[food_idx].genome.size();
        if dist(organisms[idx].x, organisms[idx].y, organisms[food_idx].x, organisms[food_idx].y) < contact_range {
            let gain = organisms[food_idx].energy * 0.3;
            organisms[food_idx].alive = false;
            organisms[idx].energy += gain;
        }
    }

    organisms[idx].age += 1;
    let upkeep = organisms[idx].genome.metabolic_rate() * sz * 0.15;
    organisms[idx].energy -= upkeep;

    let lifespan = organisms[idx].genome.lifespan_base() as u32;
    if organisms[idx].energy <= 0.0 || organisms[idx].age > lifespan {
        organisms[idx].alive = false;
        return None;
    }

    if organisms[idx].energy > organisms[idx].genome.reproduction_threshold() {
        let child_energy = organisms[idx].energy * 0.45;
        organisms[idx].energy -= child_energy;

        let child_genome = organisms[idx].genome.mutate(rng);
        let child_id = *next_id;
        *next_id += 1;

        return Some(Organism {
            id: child_id,
            genome: child_genome,
            energy: child_energy,
            age: 0,
            x: organisms[idx].x,
            y: organisms[idx].y,
            species_id: organisms[idx].species_id,
            alive: true,
            kind: parent_kind,
        });
    }

    None
}
