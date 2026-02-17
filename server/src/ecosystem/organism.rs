use rand::Rng;
use crate::ecosystem::genome::Genome;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrganismKind {
    Plant,
    Herbivore,
    Carnivore,
    Decomposer,
}

#[derive(Debug, Clone)]
pub struct Organism {
    pub id: u64,
    pub genome: Genome,
    pub energy: f64,
    pub age: u32,
    pub x: f64,
    pub y: f64,
    pub species_id: u32,
    pub alive: bool,
    pub kind: OrganismKind,
}

impl Organism {
    pub fn default_plant_genome(rng: &mut impl Rng) -> Genome {
        let mut t = [0.0f64; 32];
        t[0]  = 0.0;
        t[1]  = rng.random_range(0.3..0.8);
        t[2]  = 10.0;
        t[3]  = rng.random_range(0.05..0.15);
        t[4]  = rng.random_range(35.0..50.0);
        t[5]  = 0.05;
        t[6]  = 0.0;
        t[7]  = rng.random_range(0.0..0.2);
        t[8]  = rng.random_range(1.0..1.5);
        t[9]  = rng.random_range(30.0..60.0);
        t[10] = rng.random_range(0.3..0.6);
        t[11] = rng.random_range(0.6..0.9);
        t[12] = rng.random_range(200.0..400.0);
        Genome { traits: t }
    }

    pub fn default_herbivore_genome(rng: &mut impl Rng) -> Genome {
        let mut t = [0.0f64; 32];
        t[0]  = rng.random_range(1.5..2.5);
        t[1]  = rng.random_range(0.8..1.5);
        t[2]  = rng.random_range(60.0..90.0);
        t[3]  = rng.random_range(0.2..0.35);
        t[4]  = rng.random_range(50.0..70.0);
        t[5]  = 0.05;
        t[6]  = rng.random_range(0.05..0.2);
        t[7]  = 0.0;
        t[8]  = 1.0;
        t[9]  = 0.0;
        t[10] = 0.3;
        t[11] = 0.0;
        t[12] = rng.random_range(150.0..250.0);
        Genome { traits: t }
    }

    pub fn default_carnivore_genome(rng: &mut impl Rng) -> Genome {
        let mut t = [0.0f64; 32];
        t[0]  = rng.random_range(2.5..4.0);
        t[1]  = rng.random_range(1.0..2.0);
        t[2]  = rng.random_range(80.0..120.0);
        t[3]  = rng.random_range(0.3..0.5);
        t[4]  = rng.random_range(60.0..80.0);
        t[5]  = 0.05;
        t[6]  = rng.random_range(0.8..1.0);
        t[7]  = 0.0;
        t[8]  = 1.0;
        t[9]  = 0.0;
        t[10] = 0.2;
        t[11] = 0.0;
        t[12] = rng.random_range(100.0..200.0);
        Genome { traits: t }
    }

    pub fn default_decomposer_genome(rng: &mut impl Rng) -> Genome {
        let mut t = [0.0f64; 32];
        t[0]  = rng.random_range(0.1..0.5);
        t[1]  = rng.random_range(0.1..0.3);
        t[2]  = rng.random_range(5.0..15.0);
        t[3]  = rng.random_range(0.02..0.08);
        t[4]  = rng.random_range(20.0..35.0);
        t[5]  = 0.03;
        t[6]  = 0.5;
        t[7]  = rng.random_range(0.1..0.4);
        t[8]  = rng.random_range(0.5..1.0);
        t[9]  = 0.0;
        t[10] = rng.random_range(0.5..0.8);
        t[11] = 0.0;
        t[12] = rng.random_range(80.0..150.0);
        Genome { traits: t }
    }
}
