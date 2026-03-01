export interface Entity {
  id: number;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  energy: number;
  alive: boolean;
  age: number;
  speciesId: number;
  genome: number[];
  trail?: { x: number; y: number }[];
  hunting?: boolean;
}

export const enum Trait {
  Photosynthesis = 0,
  Speed          = 1,
  Size           = 2,
  Aggression     = 3,
  SenseRange     = 4,
  Efficiency     = 5,
  ReproRate      = 6,
  Defense        = 7,
  Cooperation    = 8,
  Camouflage     = 9,
  Adaptability   = 10,
  Longevity      = 11,
}

export const GENOME_LENGTH = 12;

export const TRAIT_LABELS: string[] = [
  'Photo', 'Speed', 'Size', 'Aggr', 'Sense', 'Effic',
  'Repro', 'Def', 'Coop', 'Camo', 'Adapt', 'Longev',
];

export interface WorldStats {
  autotrophCount: number;
  foragerCount: number;
  predatorCount: number;
  totalCount: number;
  totalEnergy: number;
  tick: number;
}

export interface TerrainCell {
  height: number;
  moisture: number;
  biome: string;
  color: string;
}
