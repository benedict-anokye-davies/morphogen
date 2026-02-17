mod terrain;
mod ecosystem;

use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;

use ecosystem::organism::Organism;
use ecosystem::world::World;

fn main() {
    const WORLD: f64 = ecosystem::world::WORLD_SIZE;
    const SEED: u64 = 42;

    let mut world = World::new(SEED);
    let mut setup_rng = StdRng::seed_from_u64(SEED ^ 0xDEAD_BEEF);

    for _ in 0..200 {
        let pos = (
            setup_rng.random_range(0.0..WORLD),
            setup_rng.random_range(0.0..WORLD),
        );
        let genome = Organism::default_plant_genome(&mut setup_rng);
        world.spawn_plant(pos, genome);
    }

    for _ in 0..25 {
        let pos = (
            setup_rng.random_range(0.0..WORLD),
            setup_rng.random_range(0.0..WORLD),
        );
        let genome = Organism::default_herbivore_genome(&mut setup_rng);
        world.spawn_animal(pos, genome);
    }

    for _ in 0..25 {
        let pos = (
            setup_rng.random_range(0.0..WORLD),
            setup_rng.random_range(0.0..WORLD),
        );
        let genome = Organism::default_carnivore_genome(&mut setup_rng);
        world.spawn_animal(pos, genome);
    }

    println!(
        "{:<6} {:>8} {:>12} {:>12} {:>14}",
        "tick", "plants", "herbivores", "carnivores", "total_energy"
    );
    println!("{}", "-".repeat(56));

    for _ in 0..100 {
        world.tick();
        if world.tick_count % 10 == 0 {
            let s = world.stats();
            println!(
                "{:<6} {:>8} {:>12} {:>12} {:>14.1}",
                s.tick, s.plant_count, s.herbivore_count, s.carnivore_count, s.total_energy
            );
        }
    }
}
