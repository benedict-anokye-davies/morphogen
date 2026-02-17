use crate::terrain::biome::{classify_biome, Biome};
use crate::terrain::erosion::apply_erosion;
use crate::terrain::noise::{generate_heightmap, generate_moisture_map};

pub const CHUNK_RESOLUTION: usize = 64;
const EROSION_ITERATIONS: usize = 1000;

/// A fully generated terrain chunk with heightmap and biome data.
#[derive(Debug)]
pub struct Chunk {
    pub x: i32,
    pub z: i32,
    pub heightmap: Vec<f64>,
    pub biomes: Vec<Biome>,
    pub resolution: usize,
}

/// Generates a complete chunk at (x, z) from the given world seed.
///
/// Pipeline: simplex noise heightmap -> hydraulic erosion -> moisture noise -> biome classification.
/// The same seed and coordinates always produce identical output.
pub fn generate_chunk(seed: u64, x: i32, z: i32) -> Chunk {
    let resolution = CHUNK_RESOLUTION;
    let mut heightmap = generate_heightmap(seed, x, z, resolution);
    let moisture = generate_moisture_map(seed, x, z, resolution);

    apply_erosion(&mut heightmap, resolution, EROSION_ITERATIONS);

    let biomes = heightmap
        .iter()
        .enumerate()
        .map(|(i, &height)| {
            let local_z = (i / resolution) as f64 / resolution as f64;
            let temperature = point_temperature(height, z as f64 + local_z);
            classify_biome(height, temperature, moisture[i])
        })
        .collect();

    Chunk {
        x,
        z,
        heightmap,
        biomes,
        resolution,
    }
}

/// Computes the temperature at a surface point based on altitude and latitude.
///
/// Temperature decreases with height (altitude lapse rate) and with distance
/// from the equator (latitude_factor). Both components are blended to produce
/// a value in [0.0, 1.0] where 1.0 is hottest.
fn point_temperature(height: f64, world_z: f64) -> f64 {
    let latitude_cold = (world_z * 0.015).abs().min(1.0);
    let altitude_cold = height * 0.45;
    (1.0 - latitude_cold * 0.55 - altitude_cold).clamp(0.0, 1.0)
}
