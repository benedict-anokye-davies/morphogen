use noise::{NoiseFn, Simplex};

const CHUNK_SCALE: f64 = 0.03;
const OCTAVES: usize = 6;
const PERSISTENCE: f64 = 0.5;
const LACUNARITY: f64 = 2.0;

/// Generates a normalised heightmap for a chunk at world grid position (chunk_x, chunk_z).
///
/// The returned Vec has `resolution * resolution` elements in row-major (z-outer, x-inner)
/// order. Values are normalised to [0.0, 1.0] after sampling.
pub fn generate_heightmap(seed: u64, chunk_x: i32, chunk_z: i32, resolution: usize) -> Vec<f64> {
    let simplex = Simplex::new(seed as u32);
    sample_map(&simplex, chunk_x, chunk_z, resolution, CHUNK_SCALE)
}

/// Generates a normalised moisture map using an independent noise layer derived from seed.
///
/// A different scale is used to avoid spatial correlation with the heightmap.
pub fn generate_moisture_map(
    seed: u64,
    chunk_x: i32,
    chunk_z: i32,
    resolution: usize,
) -> Vec<f64> {
    let moisture_seed = seed
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    let simplex = Simplex::new(moisture_seed as u32);
    sample_map(&simplex, chunk_x, chunk_z, resolution, CHUNK_SCALE * 0.61)
}

fn sample_map(
    simplex: &Simplex,
    chunk_x: i32,
    chunk_z: i32,
    resolution: usize,
    scale: f64,
) -> Vec<f64> {
    let mut values = Vec::with_capacity(resolution * resolution);
    for z in 0..resolution {
        for x in 0..resolution {
            let wx = (chunk_x as f64 + x as f64 / resolution as f64) * scale;
            let wz = (chunk_z as f64 + z as f64 / resolution as f64) * scale;
            values.push(fbm(simplex, wx, wz));
        }
    }
    normalise(&mut values);
    values
}

fn fbm(simplex: &Simplex, x: f64, z: f64) -> f64 {
    let mut value = 0.0_f64;
    let mut amplitude = 1.0_f64;
    let mut frequency = 1.0_f64;
    let mut normalization = 0.0_f64;

    for _ in 0..OCTAVES {
        value += simplex.get([x * frequency, z * frequency]) * amplitude;
        normalization += amplitude;
        amplitude *= PERSISTENCE;
        frequency *= LACUNARITY;
    }

    value / normalization
}

fn normalise(values: &mut Vec<f64>) {
    let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let range = max - min;
    if range < f64::EPSILON {
        values.iter_mut().for_each(|v| *v = 0.5);
        return;
    }
    values.iter_mut().for_each(|v| *v = (*v - min) / range);
}
