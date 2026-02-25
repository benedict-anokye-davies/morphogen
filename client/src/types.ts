export interface Entity {
  id: number;
  x: number;
  y: number;
  energy: number;
  kind: 'plant' | 'herbivore' | 'carnivore';
  alive: boolean;
  size: number;
  speed: number;
  age: number;
  speciesId: number;
  genome: number[];
  prevX?: number;
  prevY?: number;
  trail?: { x: number; y: number }[];
  hunting?: boolean;
}

export interface WorldStats {
  plantCount: number;
  herbivoreCount: number;
  carnivoreCount: number;
  totalEnergy: number;
  tick: number;
}

export interface TerrainCell {
  height: number;
  moisture: number;
  biome: string;
  color: string;
}
