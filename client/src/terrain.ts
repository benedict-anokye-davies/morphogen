import { TerrainCell } from './types';
import { fbm } from './noise';

const BIOMES: Record<string, string> = {
  ocean: '#1a3a5c',
  beach: '#c2b280',
  plains: '#4a7c3f',
  forest: '#2d5a1e',
  desert: '#c4a35a',
  mountain: '#7a7a7a',
  snow: '#e8e8e8',
  tundra: '#a0b0a0',
  jungle: '#1a4d1a',
};

function classifyBiome(height: number, moisture: number): { biome: string; color: string } {
  if (height < 0.3) return { biome: 'ocean', color: BIOMES.ocean };
  if (height < 0.35) return { biome: 'beach', color: BIOMES.beach };
  if (height > 0.8) return { biome: 'snow', color: BIOMES.snow };
  if (height > 0.7) return { biome: 'mountain', color: BIOMES.mountain };

  if (moisture < 0.3) return { biome: 'desert', color: BIOMES.desert };
  if (moisture > 0.7 && height < 0.5) return { biome: 'jungle', color: BIOMES.jungle };
  if (moisture > 0.5) return { biome: 'forest', color: BIOMES.forest };
  if (moisture < 0.4 && height > 0.6) return { biome: 'tundra', color: BIOMES.tundra };

  return { biome: 'plains', color: BIOMES.plains };
}

export function generateTerrain(width: number, height: number, seed: number): TerrainCell[][] {
  const grid: TerrainCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TerrainCell[] = [];
    for (let x = 0; x < width; x++) {
      const h = fbm(x * 0.02, y * 0.02, seed, 6);
      const m = fbm(x * 0.03 + 100, y * 0.03 + 100, seed + 42, 4);
      const { biome, color } = classifyBiome(h, m);
      row.push({ height: h, moisture: m, biome, color });
    }
    grid.push(row);
  }

  return grid;
}

export function isLand(cell: TerrainCell): boolean {
  return cell.biome !== 'ocean';
}