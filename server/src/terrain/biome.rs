#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Biome {
    Ocean,
    Beach,
    Plains,
    Forest,
    Jungle,
    Desert,
    Tundra,
    Mountain,
    Snow,
}

/// Classifies a surface point into a biome based on its physical attributes.
///
/// Height thresholds carve out ocean, beach, and alpine zones before
/// temperature and moisture determine the remaining biome. Temperature
/// decreases with both latitude and altitude; moisture comes from an
/// independent noise layer.
pub fn classify_biome(height: f64, temperature: f64, moisture: f64) -> Biome {
    if height < 0.28 {
        return Biome::Ocean;
    }
    if height < 0.34 {
        return Biome::Beach;
    }
    if height > 0.78 {
        return if temperature < 0.25 {
            Biome::Snow
        } else {
            Biome::Mountain
        };
    }
    if temperature < 0.25 {
        return Biome::Snow;
    }
    if temperature < 0.42 {
        return Biome::Tundra;
    }
    if temperature > 0.72 {
        return if moisture > 0.55 {
            Biome::Jungle
        } else {
            Biome::Desert
        };
    }
    if moisture > 0.58 {
        return Biome::Forest;
    }
    if moisture > 0.32 {
        return Biome::Plains;
    }
    Biome::Desert
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ocean_at_low_height() {
        assert_eq!(classify_biome(0.1, 0.5, 0.5), Biome::Ocean);
    }

    #[test]
    fn snow_at_high_altitude() {
        assert_eq!(classify_biome(0.9, 0.1, 0.5), Biome::Snow);
    }

    #[test]
    fn jungle_requires_heat_and_moisture() {
        assert_eq!(classify_biome(0.5, 0.8, 0.7), Biome::Jungle);
    }

    #[test]
    fn desert_with_heat_and_dry() {
        assert_eq!(classify_biome(0.5, 0.8, 0.2), Biome::Desert);
    }
}
