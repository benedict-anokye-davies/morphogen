use std::collections::HashMap;
use rand::rngs::StdRng;
use rand::SeedableRng;

use crate::ecosystem::animal;
use crate::ecosystem::decomposer::recycle;
use crate::ecosystem::genome::Genome;
use crate::ecosystem::organism::{Organism, OrganismKind};
use crate::ecosystem::plant;
use crate::ecosystem::spatial::SpatialGrid;

pub const WORLD_SIZE: f64 = 500.0;

const SPATIAL_CELL: f64 = 40.0;
const DEFAULT_LIGHT: f64 = 0.8;
const DEFAULT_WATER: f64 = 0.6;

pub struct WorldStats {
    pub plant_count: usize,
    pub herbivore_count: usize,
    pub carnivore_count: usize,
    pub total_energy: f64,
    pub tick: u64,
}

pub struct World {
    pub organisms: Vec<Organism>,
    pub minerals: HashMap<(i32, i32), f64>,
    pub next_id: u64,
    pub tick_count: u64,
    rng: StdRng,
}

impl World {
    pub fn new(seed: u64) -> Self {
        Self {
            organisms: Vec::new(),
            minerals: HashMap::new(),
            next_id: 0,
            tick_count: 0,
            rng: StdRng::seed_from_u64(seed),
        }
    }

    pub fn spawn_plant(&mut self, pos: (f64, f64), genome: Genome) {
        let id = self.next_id;
        self.next_id += 1;
        self.organisms.push(Organism {
            id,
            genome,
            energy: 20.0,
            age: 0,
            x: pos.0,
            y: pos.1,
            species_id: 0,
            alive: true,
            kind: OrganismKind::Plant,
        });
    }

    pub fn spawn_animal(&mut self, pos: (f64, f64), genome: Genome) {
        let id = self.next_id;
        self.next_id += 1;
        let kind = if genome.diet_preference() < 0.5 {
            OrganismKind::Herbivore
        } else {
            OrganismKind::Carnivore
        };
        let species_id = match kind {
            OrganismKind::Herbivore => 1,
            OrganismKind::Carnivore => 2,
            _ => 3,
        };
        self.organisms.push(Organism {
            id,
            genome,
            energy: 40.0,
            age: 0,
            x: pos.0,
            y: pos.1,
            species_id,
            alive: true,
            kind,
        });
    }

    pub fn tick(&mut self) {
        self.tick_count += 1;

        let mut grid = SpatialGrid::new(SPATIAL_CELL);
        for (i, org) in self.organisms.iter().enumerate() {
            if org.alive {
                grid.insert(i, (org.x, org.y));
            }
        }

        let mut offspring: Vec<Organism> = Vec::new();

        let plant_indices: Vec<usize> = self
            .organisms
            .iter()
            .enumerate()
            .filter(|(_, o)| o.alive && o.kind == OrganismKind::Plant)
            .map(|(i, _)| i)
            .collect();
        let plant_count = plant_indices.len();

        for i in plant_indices {
            if let Some(child) = plant::tick(
                i,
                &mut self.organisms,
                DEFAULT_LIGHT,
                DEFAULT_WATER,
                &mut self.minerals,
                &mut self.next_id,
                plant_count,
                &mut self.rng,
            ) {
                offspring.push(child);
            }
        }

        grid.clear();
        for (i, org) in self.organisms.iter().enumerate() {
            if org.alive {
                grid.insert(i, (org.x, org.y));
            }
        }

        let animal_indices: Vec<usize> = self
            .organisms
            .iter()
            .enumerate()
            .filter(|(_, o)| {
                o.alive
                    && matches!(o.kind, OrganismKind::Herbivore | OrganismKind::Carnivore)
            })
            .map(|(i, _)| i)
            .collect();

        for i in animal_indices {
            if let Some(child) = animal::tick(
                i,
                &mut self.organisms,
                &grid,
                &mut self.next_id,
                &mut self.rng,
            ) {
                offspring.push(child);
            }
        }

        recycle(&self.organisms, &mut self.minerals);
        self.organisms.retain(|o| o.alive);
        self.organisms.extend(offspring);
    }

    pub fn stats(&self) -> WorldStats {
        let mut plant_count = 0;
        let mut herbivore_count = 0;
        let mut carnivore_count = 0;
        let mut total_energy = 0.0;

        for org in &self.organisms {
            total_energy += org.energy;
            match org.kind {
                OrganismKind::Plant => plant_count += 1,
                OrganismKind::Herbivore => herbivore_count += 1,
                OrganismKind::Carnivore => carnivore_count += 1,
                OrganismKind::Decomposer => {}
            }
        }

        let mineral_energy: f64 = self.minerals.values().sum();
        total_energy += mineral_energy;

        WorldStats {
            plant_count,
            herbivore_count,
            carnivore_count,
            total_energy,
            tick: self.tick_count,
        }
    }
}
