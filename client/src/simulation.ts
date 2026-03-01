import { Entity, WorldStats, TerrainCell, Trait } from './types';
import { generateTerrain, isLand } from './terrain';

class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed | 0; if (this.state === 0) this.state = 1; }
  next(): number { this.state ^= this.state << 13; this.state ^= this.state >> 17; this.state ^= this.state << 5; return ((this.state >>> 0) / 0xffffffff); }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
}

const MAX_POPULATION = 1500;
const TICKS_PER_DAY = 50;
const DAYS_PER_SEASON = 30;
const SEASONS_PER_YEAR = 4;
const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_SEASON * SEASONS_PER_YEAR;
const GRID_CELL = 20;

const PRIMORDIAL_GENOME: number[] = [0.5, 0.3, 0.3, 0.2, 0.3, 0.5, 0.6, 0.2, 0.1, 0.1, 0.5, 0.5];

export const AUTOTROPH_GENOME: number[] = [0.9, 0.05, 0.2, 0.0, 0.1, 0.6, 0.5, 0.3, 0.1, 0.1, 0.3, 0.6];
export const FORAGER_GENOME: number[]    = [0.1, 0.6, 0.4, 0.15, 0.5, 0.5, 0.4, 0.2, 0.3, 0.3, 0.3, 0.5];
export const PREDATOR_GENOME: number[]   = [0.0, 0.8, 0.6, 0.8, 0.6, 0.4, 0.3, 0.1, 0.1, 0.0, 0.3, 0.4];

export class Simulation {
  entities: Entity[] = [];
  terrain: TerrainCell[][];
  tickCount = 0;

  get year(): number { return Math.floor(this.tickCount / TICKS_PER_YEAR) + 1; }
  get season(): string { return ['Spring', 'Summer', 'Autumn', 'Winter'][this.seasonIndex()]; }
  get day(): number { return Math.floor((this.tickCount % (TICKS_PER_DAY * DAYS_PER_SEASON)) / TICKS_PER_DAY) + 1; }
  get generation(): number { return Math.floor(this.tickCount / 200) + 1; }

  readonly width: number;
  readonly height: number;
  private rng: SeededRNG;
  private nextId = 0;

  walls: Set<string> = new Set();
  scorchedCells: Set<string> = new Set();
  rainBoostMap: Map<string, number> = new Map();
  plantReproductionMultiplier = 1.0;

  private gridW = 0;
  private gridH = 0;
  private grid: Int32Array[] = [];
  private gridCounts: Int32Array = new Int32Array(0);
  private entityById: Map<number, Entity> = new Map();

  constructor(width: number, height: number, seed: number) {
    this.width = width;
    this.height = height;
    this.rng = new SeededRNG(seed);
    this.gridW = Math.ceil(width / GRID_CELL);
    this.gridH = Math.ceil(height / GRID_CELL);
    const totalCells = this.gridW * this.gridH;
    this.gridCounts = new Int32Array(totalCells);
    for (let i = 0; i < totalCells; i++) this.grid[i] = new Int32Array(64);
    this.terrain = generateTerrain(width, height, seed);
    this.populate();
  }

  private allocId(): number { return this.nextId++; }

  private clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
  }

  private rebuildGrid(): void {
    this.gridCounts.fill(0);
    this.entityById.clear();
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      this.entityById.set(e.id, e);
      const gx = Math.min(Math.floor(e.x / GRID_CELL), this.gridW - 1);
      const gy = Math.min(Math.floor(e.y / GRID_CELL), this.gridH - 1);
      const ci = gy * this.gridW + gx;
      const idx = this.gridCounts[ci];
      let bucket = this.grid[ci];
      if (idx >= bucket.length) {
        const bigger = new Int32Array(bucket.length * 2);
        bigger.set(bucket);
        this.grid[ci] = bigger;
        bucket = bigger;
      }
      bucket[idx] = e.id;
      this.gridCounts[ci] = idx + 1;
    }
  }

  private forNearby(cx: number, cy: number, radius: number, fn: (e: Entity) => boolean): void {
    const minGx = Math.max(0, Math.floor((cx - radius) / GRID_CELL));
    const maxGx = Math.min(this.gridW - 1, Math.floor((cx + radius) / GRID_CELL));
    const minGy = Math.max(0, Math.floor((cy - radius) / GRID_CELL));
    const maxGy = Math.min(this.gridH - 1, Math.floor((cy + radius) / GRID_CELL));
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const ci = gy * this.gridW + gx;
        const count = this.gridCounts[ci];
        const bucket = this.grid[ci];
        for (let i = 0; i < count; i++) {
          const e = this.entityById.get(bucket[i]);
          if (e && e.alive && fn(e)) return;
        }
      }
    }
  }

  private findLandPosition(): { x: number; y: number } {
    for (let attempts = 0; attempts < 500; attempts++) {
      const x = this.rng.range(0, this.width);
      const y = this.rng.range(0, this.height);
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height && isLand(this.terrain[gy][gx])) {
        return { x, y };
      }
    }
    return { x: this.width / 2, y: this.height / 2 };
  }

  private findLargestLandCenter(): { x: number; y: number } {
    const visited = new Array(this.height).fill(null).map(() => new Array(this.width).fill(false));
    let bestSize = 0;
    let bestSumX = 0;
    let bestSumY = 0;

    for (let sy = 0; sy < this.height; sy++) {
      for (let sx = 0; sx < this.width; sx++) {
        if (visited[sy][sx] || !isLand(this.terrain[sy][sx])) continue;
        let size = 0;
        let sumX = 0;
        let sumY = 0;
        const stack: number[] = [sx, sy];
        while (stack.length > 0) {
          const cy = stack.pop()!;
          const cx = stack.pop()!;
          if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) continue;
          if (visited[cy][cx] || !isLand(this.terrain[cy][cx])) continue;
          visited[cy][cx] = true;
          size++;
          sumX += cx;
          sumY += cy;
          stack.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
        }
        if (size > bestSize) {
          bestSize = size;
          bestSumX = sumX;
          bestSumY = sumY;
        }
      }
    }
    if (bestSize === 0) return { x: this.width / 2, y: this.height / 2 };
    return { x: bestSumX / bestSize + 0.5, y: bestSumY / bestSize + 0.5 };
  }

  private makeGenome(base: number[], variance: number): number[] {
    return base.map(g => this.clamp(g + this.rng.range(-variance, variance), 0, 1));
  }

  private createOrganism(genome: number[], x: number, y: number, energy: number, speciesId: number): Entity {
    return { id: this.allocId(), x, y, energy, alive: true, age: 0, speciesId, genome };
  }

  private populate(): void {
    const center = this.findLargestLandCenter();
    const g1 = this.makeGenome(PRIMORDIAL_GENOME, 0.02);
    const g2 = this.makeGenome(PRIMORDIAL_GENOME, 0.02);
    this.entities.push(
      this.createOrganism(g1, center.x - 1, center.y, 50, 1),
      this.createOrganism(g2, center.x + 1, center.y, 50, 1),
    );
  }

  addEntity(baseGenome: number[], x: number, y: number): void {
    const genome = this.makeGenome(baseGenome, 0.08);
    this.entities.push(this.createOrganism(genome, x, y, 30, 1));
  }

  isBlocked(x: number, y: number): boolean {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) return true;
    return this.walls.has(gx + ',' + gy);
  }

  private moveToward(entity: Entity, tx: number, ty: number): void {
    const speed = entity.genome[Trait.Speed] * 2.5;
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;
    const step = Math.min(speed, dist);
    const nx = this.clamp(entity.x + (dx / dist) * step, 0, this.width - 1);
    const ny = this.clamp(entity.y + (dy / dist) * step, 0, this.height - 1);
    if (this.isBlocked(nx, ny)) {
      if (!this.isBlocked(nx, entity.y)) { entity.x = nx; return; }
      if (!this.isBlocked(entity.x, ny)) { entity.y = ny; return; }
      return;
    }
    entity.x = nx;
    entity.y = ny;
  }

  private moveAway(entity: Entity, fx: number, fy: number): void {
    const speed = entity.genome[Trait.Speed] * 2.5;
    const dx = entity.x - fx;
    const dy = entity.y - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) { this.wander(entity); return; }
    const nx = this.clamp(entity.x + (dx / dist) * speed, 0, this.width - 1);
    const ny = this.clamp(entity.y + (dy / dist) * speed, 0, this.height - 1);
    if (this.isBlocked(nx, ny)) {
      if (!this.isBlocked(nx, entity.y)) { entity.x = nx; return; }
      if (!this.isBlocked(entity.x, ny)) { entity.y = ny; return; }
      return;
    }
    entity.x = nx;
    entity.y = ny;
  }

  private wander(entity: Entity): void {
    const speed = entity.genome[Trait.Speed] * 2.5;
    const angle = this.rng.next() * Math.PI * 2;
    this.moveToward(entity, entity.x + Math.cos(angle) * speed * 2, entity.y + Math.sin(angle) * speed * 2);
  }

  private findNearestPrey(hunter: Entity, range: number): Entity | null {
    const hunterSize = hunter.genome[Trait.Size];
    const hunterAggr = hunter.genome[Trait.Aggression];
    let best: Entity | null = null;
    let bestDist = range * range;

    this.forNearby(hunter.x, hunter.y, range, (other) => {
      if (other.id === hunter.id) return false;
      if (hunterSize <= other.genome[Trait.Size] * 0.8) return false;
      if (other.genome[Trait.Defense] >= hunterAggr) return false;
      const camoPenalty = 1 - other.genome[Trait.Camouflage] * 0.5;
      const dx = hunter.x - other.x;
      const dy = hunter.y - other.y;
      const d = dx * dx + dy * dy;
      const effectiveD = d / (camoPenalty * camoPenalty + 0.001);
      if (effectiveD < bestDist) { bestDist = effectiveD; best = other; }
      return false;
    });
    return best;
  }

  private findNearestThreat(entity: Entity, range: number): Entity | null {
    const mySize = entity.genome[Trait.Size];
    let best: Entity | null = null;
    let bestDist = range * range;

    this.forNearby(entity.x, entity.y, range, (other) => {
      if (other.id === entity.id) return false;
      if (other.genome[Trait.Aggression] <= 0.3) return false;
      if (other.genome[Trait.Size] <= mySize * 0.8) return false;
      const dx = entity.x - other.x;
      const dy = entity.y - other.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = other; }
      return false;
    });
    return best;
  }

  private seasonIndex(): number {
    return Math.floor((this.tickCount % TICKS_PER_YEAR) / (TICKS_PER_DAY * DAYS_PER_SEASON));
  }

  private photoSeasonMod(): number {
    return [1.3, 1.1, 0.8, 0.3][this.seasonIndex()];
  }

  private metabSeasonMod(): number {
    return [1.0, 0.9, 1.0, 1.3][this.seasonIndex()];
  }

  private spawnOffspring(parent: Entity): void {
    if (this.entities.length >= MAX_POPULATION) return;
    const adaptability = parent.genome[Trait.Adaptability];
    const mutRate = 0.05 + adaptability * 0.1;
    const genome = parent.genome.map(g => this.clamp(g + this.rng.range(-mutRate, mutRate), 0, 1));
    const cx = this.clamp(parent.x + this.rng.range(-5, 5), 0, this.width - 1);
    const cy = this.clamp(parent.y + this.rng.range(-5, 5), 0, this.height - 1);
    if (this.isBlocked(cx, cy)) return;
    const gx = Math.floor(cx);
    const gy = Math.floor(cy);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) return;
    if (!isLand(this.terrain[gy][gx])) return;
    const childEnergy = parent.energy * 0.35;
    parent.energy *= 0.60;
    this.entities.push(this.createOrganism(genome, cx, cy, childEnergy, parent.speciesId));
  }

  private tickOrganism(e: Entity): void {
    const photo  = e.genome[Trait.Photosynthesis];
    const speed  = e.genome[Trait.Speed];
    const size   = e.genome[Trait.Size];
    const aggr   = e.genome[Trait.Aggression];
    const sense  = e.genome[Trait.SenseRange];
    const effic  = e.genome[Trait.Efficiency];
    const repro  = e.genome[Trait.ReproRate];
    const defense = e.genome[Trait.Defense];
    const longevity = e.genome[Trait.Longevity];

    const baseCost = 0.02;
    const speedCost = speed * speed * 0.08;
    const sizeCost = size * 0.04;
    const aggrCost = aggr * 0.03;
    const defCost = defense * 0.02;
    const effMod = 1.0 - effic * 0.4;
    const totalCost = (baseCost + speedCost + sizeCost + aggrCost + defCost) * effMod * this.metabSeasonMod();
    e.energy -= totalCost;

    const speedPenalty = speed > 0.3 ? Math.max(0, 1.0 - (speed - 0.3) * 1.4) : 1.0;
    const photoGain = photo * 0.6 * speedPenalty * this.photoSeasonMod() * this.plantReproductionMultiplier;
    e.energy += photoGain;

    if (this.rainBoostMap.has(Math.floor(e.x) + ',' + Math.floor(e.y))) {
      if (photo > 0.3) e.energy += 0.3;
    }

    e.prevX = e.x;
    e.prevY = e.y;
    e.hunting = false;

    if (speed >= 0.1) {
      const senseRange = sense * 80;
      if (aggr > 0.5) {
        const prey = this.findNearestPrey(e, senseRange);
        if (prey) { this.moveToward(e, prey.x, prey.y); e.hunting = true; }
        else { this.wander(e); }
      } else if (aggr < 0.3) {
        const threat = this.findNearestThreat(e, senseRange);
        if (threat) { this.moveAway(e, threat.x, threat.y); }
        else { this.wander(e); }
      } else {
        this.wander(e);
      }
    }

    if (aggr > 0.3) {
      this.forNearby(e.x, e.y, 3, (target) => {
        if (target.id === e.id) return false;
        if (size <= target.genome[Trait.Size] * 0.8) return false;
        if (target.genome[Trait.Defense] >= aggr) return false;
        const dx = e.x - target.x;
        const dy = e.y - target.y;
        if (dx * dx + dy * dy < 9) {
          e.energy += target.energy * 0.4 * (1 + size * 0.3);
          target.alive = false;
          return true;
        }
        return false;
      });
    }

    if (speed > 0.3 && aggr > 0.4) {
      const px = e.prevX ?? e.x;
      const py = e.prevY ?? e.y;
      if (!e.trail) {
        e.trail = [{ x: px, y: py }, { x: px, y: py }, { x: px, y: py }];
      } else {
        e.trail[0].x = e.trail[1].x; e.trail[0].y = e.trail[1].y;
        e.trail[1].x = e.trail[2].x; e.trail[1].y = e.trail[2].y;
        e.trail[2].x = px; e.trail[2].y = py;
      }
    }

    const reproThreshold = 15 + size * 10;
    if (e.energy > reproThreshold && this.rng.next() < repro * 0.1) {
      this.spawnOffspring(e);
    }

    const maxAge = 500 + longevity * 1000;
    if (e.energy <= 0 || e.age > maxAge) e.alive = false;
  }

  tick(): void {
    this.tickCount++;
    this.plantReproductionMultiplier = 1.0;

    for (const [key, ttl] of this.rainBoostMap) {
      if (ttl <= 0) this.rainBoostMap.delete(key);
      else this.rainBoostMap.set(key, ttl - 1);
    }

    this.rebuildGrid();

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      e.age++;
      this.tickOrganism(e);
    }

    this.entities = this.entities.filter(e => e.alive);

    if (this.entities.length > MAX_POPULATION) {
      this.entities.sort((a, b) => a.energy - b.energy);
      const excess = this.entities.length - MAX_POPULATION;
      for (let i = 0; i < excess; i++) this.entities[i].alive = false;
      this.entities = this.entities.filter(e => e.alive);
    }

    if (this.entities.length < 5) {
      for (let i = 0; i < 10; i++) {
        const pos = this.findLandPosition();
        const genome = this.makeGenome(PRIMORDIAL_GENOME, 0.05);
        this.entities.push(this.createOrganism(genome, pos.x, pos.y, 50, 1));
      }
    }
  }

  private classify(e: Entity): 'autotroph' | 'forager' | 'predator' {
    const photo = e.genome[Trait.Photosynthesis];
    const speed = e.genome[Trait.Speed];
    const aggr  = e.genome[Trait.Aggression];
    if (aggr > 0.4 && speed > 0.3) return 'predator';
    if (speed > 0.3 && aggr <= 0.4) return 'forager';
    if (photo > 0.4 && speed <= 0.3) return 'autotroph';
    if (aggr > photo && aggr > speed) return 'predator';
    if (speed > photo) return 'forager';
    return 'autotroph';
  }

  getStats(): WorldStats {
    let autotrophCount = 0;
    let foragerCount = 0;
    let predatorCount = 0;
    let totalEnergy = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      totalEnergy += e.energy;
      switch (this.classify(e)) {
        case 'autotroph': autotrophCount++; break;
        case 'forager':   foragerCount++;   break;
        case 'predator':  predatorCount++;  break;
      }
    }
    return { autotrophCount, foragerCount, predatorCount, totalCount: autotrophCount + foragerCount + predatorCount, totalEnergy, tick: this.tickCount };
  }

  feedArea(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) e.energy += 20;
    }
  }

  poisonArea(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) e.alive = false;
    }
  }

  rainBoost(x: number, y: number, radius: number): void {
    const cr = Math.ceil(radius), r2 = radius * radius;
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const cx = Math.floor(x) + dx;
          const cy = Math.floor(y) + dy;
          if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
            this.rainBoostMap.set(cx + ',' + cy, 300);
          }
        }
      }
    }
  }

  getPopulationBySpecies(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const e of this.entities) {
      if (!e.alive) continue;
      counts.set(e.speciesId, (counts.get(e.speciesId) ?? 0) + 1);
    }
    return counts;
  }

  killBySpecies(speciesId: number, rate: number): void {
    for (const e of this.entities) {
      if (e.alive && e.speciesId === speciesId && this.rng.next() < rate) e.alive = false;
    }
  }

  getTerrainHeight(x: number, y: number): number {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) return this.terrain[gy][gx].height;
    return 0;
  }

  paintWalls(x: number, y: number, radius: number, add: boolean): void {
    const cr = Math.ceil(radius), r2 = radius * radius;
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const cx = Math.floor(x) + dx;
          const cy = Math.floor(y) + dy;
          if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
            const key = cx + ',' + cy;
            if (add) this.walls.add(key); else this.walls.delete(key);
          }
        }
      }
    }
  }

  meteorStrike(x: number, y: number): void {
    const radius = 60, r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) e.alive = false;
    }
    const cr = Math.ceil(radius);
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const cx = Math.floor(x) + dx;
          const cy = Math.floor(y) + dy;
          if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
            this.scorchedCells.add(cx + ',' + cy);
          }
        }
      }
    }
  }

  removeNearestEntity(x: number, y: number, range: number): void {
    let best: Entity | null = null;
    let bestDist = range * range;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = e; }
    }
    if (best) best.alive = false;
  }
}
