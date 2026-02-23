import { Entity } from './types';

export interface Species {
  id: number;
  name: string;
  parentId: number | null;
  kind: string;
  bornTick: number;
  extinctTick: number | null;
  peakPopulation: number;
  currentPopulation: number;
  averageGenome: number[];
  populationHistory: number[];
  color: string;
}

export interface PhyloNode {
  species: Species;
  children: PhyloNode[];
  layoutY: number;
  leafCount: number;
}

const GENUS_POOL = [
  'Velocis', 'Magna', 'Silva', 'Aqua', 'Terra',
  'Caelo', 'Umbra', 'Ignis', 'Petra', 'Herba',
  'Vorax', 'Pacis', 'Fortis', 'Brevis', 'Nocti',
];

const EPITHET_POOL = [
  'maximus', 'minimus', 'raptor', 'grazer', 'viridis',
  'rubrum', 'celer', 'robustus', 'fragilis', 'communis',
  'rarus', 'ferox', 'mitis', 'tenax', 'vivax',
];

export function speciesColor(id: number): string {
  const hue = (id * 137.508) % 360;
  return `hsl(${hue}, 68%, 58%)`;
}

function genomeDistance(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export class SpeciesTracker {
  species: Map<number, Species> = new Map();
  nextSpeciesId = 4;
  private usedNames = new Set<string>();

  generateName(): string {
    let name: string;
    let attempts = 0;
    do {
      const genus = GENUS_POOL[Math.floor(Math.random() * GENUS_POOL.length)];
      const epithet = EPITHET_POOL[Math.floor(Math.random() * EPITHET_POOL.length)];
      name = `${genus} ${epithet}`;
      attempts++;
    } while (this.usedNames.has(name) && attempts < 500);
    this.usedNames.add(name!);
    return name!;
  }

  initBaseSpecies(entities: Entity[], tick: number): void {
    const kindConfig: Array<{ kind: Entity['kind']; id: number; name: string }> = [
      { kind: 'plant', id: 1, name: 'Herba viridis' },
      { kind: 'herbivore', id: 2, name: 'Magna communis' },
      { kind: 'carnivore', id: 3, name: 'Vorax raptor' },
    ];

    for (const { kind, id, name } of kindConfig) {
      const members = entities.filter(e => e.kind === kind && e.alive);
      const genomeLen = members[0]?.genome.length ?? 4;
      const avg = new Array(genomeLen).fill(0);
      for (const e of members) {
        for (let i = 0; i < genomeLen; i++) avg[i] += e.genome[i];
      }
      if (members.length > 0) {
        for (let i = 0; i < genomeLen; i++) avg[i] /= members.length;
      }

      this.usedNames.add(name);
      this.species.set(id, {
        id,
        name,
        parentId: null,
        kind,
        bornTick: tick,
        extinctTick: null,
        peakPopulation: members.length,
        currentPopulation: members.length,
        averageGenome: avg,
        populationHistory: [members.length],
        color: speciesColor(id),
      });
    }
  }

  update(entities: Entity[], tick: number): void {
    for (const sp of this.species.values()) {
      sp.currentPopulation = 0;
    }

    const groups = new Map<number, Entity[]>();
    for (const e of entities) {
      if (!e.alive) continue;
      let bucket = groups.get(e.speciesId);
      if (!bucket) { bucket = []; groups.set(e.speciesId, bucket); }
      bucket.push(e);
    }

    const speciations: Array<{ parentId: number; outliers: Entity[]; kind: string }> = [];

    for (const [spId, members] of groups) {
      const sp = this.species.get(spId);
      if (!sp) continue;

      const genomeLen = members[0].genome.length;
      const avg = new Array(genomeLen).fill(0);
      for (const e of members) {
        for (let i = 0; i < genomeLen; i++) avg[i] += e.genome[i];
      }
      for (let i = 0; i < genomeLen; i++) avg[i] /= members.length;
      sp.averageGenome = avg;

      sp.currentPopulation = members.length;
      if (sp.currentPopulation > sp.peakPopulation) {
        sp.peakPopulation = sp.currentPopulation;
      }

      if (members.length < 4) continue;

      const outliers: Entity[] = [];
      for (const e of members) {
        if (genomeDistance(e.genome, avg) > 0.4) outliers.push(e);
      }

      if (outliers.length > 0 && outliers.length < members.length) {
        speciations.push({ parentId: spId, outliers, kind: sp.kind });
      }
    }

    for (const { parentId, outliers, kind } of speciations) {
      const newId = this.nextSpeciesId++;
      const genomeLen = outliers[0].genome.length;
      const avg = new Array(genomeLen).fill(0);
      for (const e of outliers) {
        for (let i = 0; i < genomeLen; i++) avg[i] += e.genome[i];
        e.speciesId = newId;
      }
      for (let i = 0; i < genomeLen; i++) avg[i] /= outliers.length;

      this.species.set(newId, {
        id: newId,
        name: this.generateName(),
        parentId,
        kind,
        bornTick: tick,
        extinctTick: null,
        peakPopulation: outliers.length,
        currentPopulation: outliers.length,
        averageGenome: avg,
        populationHistory: [],
        color: speciesColor(newId),
      });
    }

    for (const [spId, sp] of this.species) {
      if (sp.extinctTick !== null) continue;
      if (!groups.has(spId)) {
        sp.currentPopulation = 0;
        sp.extinctTick = tick;
      }
    }

    if (tick % 10 === 0) {
      for (const sp of this.species.values()) {
        sp.populationHistory.push(sp.currentPopulation);
        if (sp.populationHistory.length > 200) sp.populationHistory.shift();
      }
    }
  }

  getPhylogeneticTree(): PhyloNode | null {
    if (this.species.size === 0) return null;

    const childrenOf = new Map<number | null, number[]>();
    for (const [id, sp] of this.species) {
      const pid = sp.parentId;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(id);
    }

    const buildNode = (id: number): PhyloNode => {
      const sp = this.species.get(id)!;
      const childIds = childrenOf.get(id) ?? [];
      return {
        species: sp,
        children: childIds.map(cid => buildNode(cid)),
        layoutY: 0,
        leafCount: 0,
      };
    };

    const roots = childrenOf.get(null) ?? [];
    if (roots.length === 0) return null;

    if (roots.length === 1) return buildNode(roots[0]);

    const virtualRoot: PhyloNode = {
      species: {
        id: 0,
        name: 'Progenitor',
        parentId: null,
        kind: 'root',
        bornTick: 0,
        extinctTick: null,
        peakPopulation: 0,
        currentPopulation: 0,
        averageGenome: [],
        populationHistory: [],
        color: '#666',
      },
      children: roots.map(id => buildNode(id)),
      layoutY: 0,
      leafCount: 0,
    };
    return virtualRoot;
  }
}
