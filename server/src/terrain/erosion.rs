/// Minimal xorshift64 PRNG for deterministic droplet spawning without external dependencies.
struct Xorshift64(u64);

impl Xorshift64 {
    fn new(seed: u64) -> Self {
        Self(if seed == 0 { 0xcafe_babe_dead_beef } else { seed })
    }

    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn next_f64(&mut self) -> f64 {
        (self.next() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }
}

/// Applies droplet-based hydraulic erosion to a heightmap in-place.
///
/// Spawns `iterations` water droplets at random positions. Each droplet flows
/// downhill following the gradient of the terrain, eroding material on steep
/// descent and depositing sediment where the terrain flattens or rises.
/// The simulation is fully deterministic: the same input heightmap and
/// iteration count always produce the same output.
pub fn apply_erosion(heightmap: &mut Vec<f64>, resolution: usize, iterations: usize) {
    const INERTIA: f64 = 0.05;
    const SEDIMENT_CAPACITY_FACTOR: f64 = 4.0;
    const MIN_SEDIMENT_CAPACITY: f64 = 0.01;
    const ERODE_SPEED: f64 = 0.3;
    const DEPOSIT_SPEED: f64 = 0.3;
    const EVAPORATE_SPEED: f64 = 0.01;
    const GRAVITY: f64 = 4.0;
    const MAX_STEPS: usize = 64;

    let bound = (resolution - 2) as f64;
    let mut rng = Xorshift64::new(resolution as u64 * 7_919);

    for _ in 0..iterations {
        let mut pos_x = rng.next_f64() * bound;
        let mut pos_z = rng.next_f64() * bound;
        let mut dir_x = 0.0_f64;
        let mut dir_z = 0.0_f64;
        let mut speed = 1.0_f64;
        let mut water = 1.0_f64;
        let mut sediment = 0.0_f64;

        for _ in 0..MAX_STEPS {
            let ix = pos_x as usize;
            let iz = pos_z as usize;

            if ix + 1 >= resolution || iz + 1 >= resolution {
                break;
            }

            let fx = pos_x - ix as f64;
            let fz = pos_z - iz as f64;

            let h00 = heightmap[iz * resolution + ix];
            let h10 = heightmap[iz * resolution + ix + 1];
            let h01 = heightmap[(iz + 1) * resolution + ix];
            let h11 = heightmap[(iz + 1) * resolution + ix + 1];

            let grad_x = (h10 - h00) * (1.0 - fz) + (h11 - h01) * fz;
            let grad_z = (h01 - h00) * (1.0 - fx) + (h11 - h10) * fx;

            dir_x = dir_x * INERTIA - grad_x * (1.0 - INERTIA);
            dir_z = dir_z * INERTIA - grad_z * (1.0 - INERTIA);

            let len = (dir_x * dir_x + dir_z * dir_z).sqrt();
            if len < f64::EPSILON {
                break;
            }
            dir_x /= len;
            dir_z /= len;

            let old_height = bilinear(h00, h10, h01, h11, fx, fz);
            let new_pos_x = pos_x + dir_x;
            let new_pos_z = pos_z + dir_z;

            if new_pos_x < 0.0
                || new_pos_z < 0.0
                || new_pos_x + 1.0 >= resolution as f64
                || new_pos_z + 1.0 >= resolution as f64
            {
                break;
            }

            let nix = new_pos_x as usize;
            let niz = new_pos_z as usize;
            let nfx = new_pos_x - nix as f64;
            let nfz = new_pos_z - niz as f64;

            let nh00 = heightmap[niz * resolution + nix];
            let nh10 = heightmap[niz * resolution + nix + 1];
            let nh01 = heightmap[(niz + 1) * resolution + nix];
            let nh11 = heightmap[(niz + 1) * resolution + nix + 1];

            let new_height = bilinear(nh00, nh10, nh01, nh11, nfx, nfz);
            let delta_height = new_height - old_height;

            let capacity = (-delta_height * speed * water * SEDIMENT_CAPACITY_FACTOR)
                .max(MIN_SEDIMENT_CAPACITY);

            if sediment > capacity || delta_height > 0.0 {
                let deposit = if delta_height > 0.0 {
                    sediment.min(delta_height)
                } else {
                    (sediment - capacity) * DEPOSIT_SPEED
                };
                sediment -= deposit;
                splat(heightmap, ix, iz, deposit, fx, fz, resolution, 1.0);
            } else {
                let erode_amount = ((capacity - sediment) * ERODE_SPEED).min(-delta_height);
                sediment += erode_amount;
                splat(heightmap, ix, iz, erode_amount, fx, fz, resolution, -1.0);
            }

            speed = (speed * speed + delta_height * GRAVITY).max(0.0).sqrt();
            water *= 1.0 - EVAPORATE_SPEED;
            pos_x = new_pos_x;
            pos_z = new_pos_z;
        }
    }
}

#[inline]
fn bilinear(h00: f64, h10: f64, h01: f64, h11: f64, fx: f64, fz: f64) -> f64 {
    h00 * (1.0 - fx) * (1.0 - fz)
        + h10 * fx * (1.0 - fz)
        + h01 * (1.0 - fx) * fz
        + h11 * fx * fz
}

#[inline]
fn splat(
    h: &mut Vec<f64>,
    ix: usize,
    iz: usize,
    amount: f64,
    fx: f64,
    fz: f64,
    res: usize,
    sign: f64,
) {
    h[iz * res + ix] += sign * amount * (1.0 - fx) * (1.0 - fz);
    h[iz * res + ix + 1] += sign * amount * fx * (1.0 - fz);
    h[(iz + 1) * res + ix] += sign * amount * (1.0 - fx) * fz;
    h[(iz + 1) * res + ix + 1] += sign * amount * fx * fz;
}
