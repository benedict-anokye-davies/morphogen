use std::f64::consts::PI;
use rand::Rng;

#[derive(Debug, Clone, Copy)]
pub struct Genome {
    pub traits: [f64; 32],
}

impl Genome {
    pub fn speed(&self) -> f64              { self.traits[0] }
    pub fn size(&self) -> f64               { self.traits[1] }
    pub fn sense_range(&self) -> f64        { self.traits[2] }
    pub fn metabolic_rate(&self) -> f64     { self.traits[3] }
    pub fn reproduction_threshold(&self) -> f64 { self.traits[4] }
    pub fn mutation_rate(&self) -> f64      { self.traits[5] }
    pub fn diet_preference(&self) -> f64    { self.traits[6] }
    pub fn toxicity(&self) -> f64           { self.traits[7] }
    pub fn growth_rate(&self) -> f64        { self.traits[8] }
    pub fn seed_range(&self) -> f64         { self.traits[9] }
    pub fn water_need(&self) -> f64         { self.traits[10] }
    pub fn light_need(&self) -> f64         { self.traits[11] }
    pub fn lifespan_base(&self) -> f64      { self.traits[12] }

    pub fn mutate(&self, rng: &mut impl Rng) -> Genome {
        let mut traits = self.traits;
        let mag = self.mutation_rate();
        for t in &mut traits {
            *t = (*t + gaussian(mag, rng)).max(0.0);
        }
        traits[6] = traits[6].clamp(0.0, 1.0);
        traits[10] = traits[10].clamp(0.0, 1.0);
        traits[11] = traits[11].clamp(0.0, 1.0);
        Genome { traits }
    }
}

fn gaussian(std_dev: f64, rng: &mut impl Rng) -> f64 {
    let u1: f64 = rng.random::<f64>().max(f64::EPSILON);
    let u2: f64 = rng.random::<f64>();
    let z = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
    std_dev * z
}
