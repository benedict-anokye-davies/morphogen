import { Entity, WorldStats, TerrainCell } from './types';
import { generateTerrain, isLand } from './terrain';

class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed | 0; if (this.state === 0) this.state = 1; }
  next(): number { this.state ^= this.state << 13; this.state ^= this.state >> 17; this.state ^= this.state << 5; return ((this.state >>> 0) / 0xffffffff); }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
}

const MAX_PLANTS = 1000, MAX_HERBIVORES = 500, MAX_CARNIVORES = 150;
const TICKS_PER_DAY = 50;
const DAYS_PER_SEASON = 30;
const SEASONS_PER_YEAR = 4;
const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_SEASON * SEASONS_PER_YEAR;
const KIND_SPECIES_ID: Record<string, number> = { plant: 1, herbivore: 2, carnivore: 3 };

export class Simulation {
  entities: Entity[] = []; terrain: TerrainCell[][]; tickCount = 0;
  get year(): number { return Math.floor(this.tickCount / TICKS_PER_YEAR) + 1; }
  get season(): string { const s = Math.floor((this.tickCount % TICKS_PER_YEAR) / (TICKS_PER_DAY * DAYS_PER_SEASON)); return ['Spring', 'Summer', 'Autumn', 'Winter'][s]; }
  get day(): number { return Math.floor((this.tickCount % (TICKS_PER_DAY * DAYS_PER_SEASON)) / TICKS_PER_DAY) + 1; }
  get generation(): number { return Math.floor(this.tickCount / 200) + 1; }
  readonly width: number; readonly height: number;
  private rng: SeededRNG; private nextId = 0;
  walls: Set<string> = new Set(); scorchedCells: Set<string> = new Set(); rainBoostMap: Map<string, number> = new Map();
  plantReproductionMultiplier = 1.0;

  constructor(width: number, height: number, seed: number) {
    this.width = width; this.height = height; this.rng = new SeededRNG(seed);
    this.terrain = generateTerrain(width, height, seed); this.populate();
  }
  private allocId(): number { return this.nextId++; }
  private findLandPosition(): { x: number; y: number } {
    for (let attempts = 0; attempts < 500; attempts++) {
      const x = this.rng.range(0, this.width), y = this.rng.range(0, this.height);
      const gx = Math.floor(x), gy = Math.floor(y);
      if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height && isLand(this.terrain[gy][gx])) return { x, y };
    }
    return { x: this.width / 2, y: this.height / 2 };
  }
  private clamp(v: number, min: number, max: number): number { return v < min ? min : v > max ? max : v; }
  private createEntity(kind: Entity['kind']): Entity {
    const pos = this.findLandPosition();
    const base: Record<Entity['kind'], { energy: number; speed: number; size: number }> = {
      plant: { energy: 10, speed: 0, size: 3 }, herbivore: { energy: 20, speed: 2.0, size: 4 }, carnivore: { energy: 20, speed: 2.0, size: 5 },
    };
    const cfg = base[kind];
    const speed = this.clamp(cfg.speed + this.rng.range(-0.3, 0.3), 0.5, 3);
    const size = this.clamp(cfg.size + this.rng.range(-0.2, 0.2), 2, 6);
    const genome = [
      this.clamp((speed - 0.5) / 2.5 + this.rng.range(-0.08, 0.08), 0, 1),
      this.clamp((size - 2) / 4 + this.rng.range(-0.08, 0.08), 0, 1),
      this.clamp(this.rng.range(0.25, 0.75), 0, 1),
      this.clamp(this.rng.range(0.25, 0.75), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
    ];
    return { id: this.allocId(), x: pos.x, y: pos.y, energy: cfg.energy + this.rng.range(-2, 2), kind, alive: true, size, speed, age: 0, speciesId: KIND_SPECIES_ID[kind] ?? 1, genome };
  }
  private createEntityAt(kind: Entity['kind'], x: number, y: number): Entity {
    const base: Record<Entity['kind'], { energy: number; speed: number; size: number }> = {
      plant: { energy: 10, speed: 0, size: 3 }, herbivore: { energy: 20, speed: 2.0, size: 4 }, carnivore: { energy: 20, speed: 2.0, size: 5 },
    };
    const cfg = base[kind];
    const speed = this.clamp(cfg.speed + this.rng.range(-0.3, 0.3), 0.5, 3);
    const size = this.clamp(cfg.size + this.rng.range(-0.2, 0.2), 2, 6);
    const genome = [
      this.clamp((speed - 0.5) / 2.5 + this.rng.range(-0.08, 0.08), 0, 1),
      this.clamp((size - 2) / 4 + this.rng.range(-0.08, 0.08), 0, 1),
      this.clamp(this.rng.range(0.25, 0.75), 0, 1),
      this.clamp(this.rng.range(0.25, 0.75), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
      this.clamp(this.rng.range(0.2, 0.8), 0, 1),
    ];
    return { id: this.allocId(), x, y, energy: cfg.energy + this.rng.range(-2, 2), kind, alive: true, size, speed, age: 0, speciesId: KIND_SPECIES_ID[kind] ?? 1, genome };
  }
  addEntity(kind: Entity['kind'], x: number, y: number): void { this.entities.push(this.createEntityAt(kind, x, y)); }
  private populate(): void {
    for (let i = 0; i < 500; i++) this.entities.push(this.createEntity('plant'));
    for (let i = 0; i < 150; i++) this.entities.push(this.createEntity('herbivore'));
    for (let i = 0; i < 50; i++) this.entities.push(this.createEntity('carnivore'));
  }
  private distSq(a: Entity, b: Entity): number { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  isBlocked(x: number, y: number): boolean {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) return true;
    return this.walls.has(gx + "," + gy);
  }
  private moveToward(entity: Entity, tx: number, ty: number): void {
    const dx = tx - entity.x, dy = ty - entity.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return; const step = Math.min(entity.speed, dist);
    const nx = this.clamp(entity.x + (dx / dist) * step, 0, this.width - 1);
    const ny = this.clamp(entity.y + (dy / dist) * step, 0, this.height - 1);
    if (this.isBlocked(nx, ny)) {
      if (!this.isBlocked(nx, entity.y)) { entity.x = nx; return; }
      if (!this.isBlocked(entity.x, ny)) { entity.y = ny; return; }
      return;
    }
    entity.x = nx; entity.y = ny;
  }
  private wander(entity: Entity): void {
    const angle = this.rng.next() * Math.PI * 2;
    this.moveToward(entity, entity.x + Math.cos(angle) * entity.speed * 2, entity.y + Math.sin(angle) * entity.speed * 2);
  }
  private findNearest(entity: Entity, kind: Entity['kind'], range: number): Entity | null {
    let best: Entity | null = null, bestDist = range * range;
    for (let i = 0; i < this.entities.length; i++) {
      const other = this.entities[i];
      if (!other.alive || other.kind !== kind || other.id === entity.id) continue;
      const d = this.distSq(entity, other); if (d < bestDist) { bestDist = d; best = other; }
    }
    return best;
  }
  private countAlive(kind: Entity['kind']): number { let n = 0; for (let i = 0; i < this.entities.length; i++) if (this.entities[i].alive && this.entities[i].kind === kind) n++; return n; }
  private spawnOffspring(parent: Entity): void {
    const caps: Record<Entity['kind'], number> = { plant: MAX_PLANTS, herbivore: MAX_HERBIVORES, carnivore: MAX_CARNIVORES };
    if (this.countAlive(parent.kind) >= caps[parent.kind]) return;
    const genome = parent.genome.map(g => this.clamp(g + this.rng.range(-0.12, 0.12), 0, 1));
    const speed = this.clamp(0.5 + genome[0] * 2.5 + this.rng.range(-0.05, 0.05), 0.5, 3);
    const size = this.clamp(2 + genome[1] * 4 + this.rng.range(-0.05, 0.05), 2, 6);
    const cx = this.clamp(parent.x + this.rng.range(-4, 4), 0, this.width - 1); const cy = this.clamp(parent.y + this.rng.range(-4, 4), 0, this.height - 1); if (this.isBlocked(cx, cy)) return;
    const child: Entity = { id: this.allocId(), x: cx, y: cy, energy: parent.energy * 0.35, kind: parent.kind, alive: true, size, speed, age: 0, speciesId: parent.speciesId, genome };
    parent.energy *= 0.55; this.entities.push(child);
  }
  feedArea(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]; if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) e.energy += 20;
    }
  }
  poisonArea(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]; if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) e.alive = false;
    }
  }
  rainBoost(x: number, y: number, radius: number): void {
    const cr = Math.ceil(radius), r2 = radius * radius;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) if (dx * dx + dy * dy <= r2) {
      const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy;
      if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) this.rainBoostMap.set(cx + ',' + cy, 300);
    }
  }
  getPopulationBySpecies(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const e of this.entities) { if (!e.alive) continue; counts.set(e.speciesId, (counts.get(e.speciesId) ?? 0) + 1); }
    return counts;
  }
  killBySpecies(speciesId: number, rate: number): void {
    for (const e of this.entities) { if (e.alive && e.speciesId === speciesId && this.rng.next() < rate) e.alive = false; }
  }
  getTerrainHeight(x: number, y: number): number {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) return this.terrain[gy][gx].height;
    return 0;
  }
  private tickPlant(e: Entity): void {
    const growth = this.season === 'Spring' ? 0.8 : this.season === 'Summer' ? 0.7 : this.season === 'Winter' ? 0.2 : 0.5;
    e.energy += growth; if (e.energy > 20 && this.rng.next() < 0.08 * this.plantReproductionMultiplier) this.spawnOffspring(e); if (e.energy <= 0 || e.age > 500) e.alive = false;
  }
  private tickHerbivore(e: Entity): void {
    const seasonMod = this.season === 'Winter' ? 1.5 : this.season === 'Summer' ? 0.7 : 1.0;
    e.energy -= 0.06 * seasonMod;
    const target = this.findNearest(e, 'plant', 80);
    e.prevX = e.x;
    e.prevY = e.y;
    if (target) {
      this.moveToward(e, target.x, target.y);
      if (this.distSq(e, target) < 4) { e.energy += 12; target.alive = false; }
    } else {
      this.wander(e);
    }
    if (e.energy > 18 && this.rng.next() < 0.12) this.spawnOffspring(e);
    if (e.energy <= 0 || e.age > 600) e.alive = false;
  }
  private tickCarnivore(e: Entity): void {
    const cSeasonMod = this.season === 'Winter' ? 1.3 : this.season === 'Summer' ? 0.8 : 1.0;
    e.energy -= 0.12 * cSeasonMod;
    const target = this.findNearest(e, 'herbivore', 90);
    e.prevX = e.x;
    e.prevY = e.y;
    e.hunting = target !== null;
    if (target) {
      this.moveToward(e, target.x, target.y);
      if (this.distSq(e, target) < 6) { e.energy += 20; target.alive = false; }
    } else {
      this.wander(e);
    }
    if (!e.trail) {
      e.trail = [{ x: e.prevX, y: e.prevY }, { x: e.prevX, y: e.prevY }, { x: e.prevX, y: e.prevY }];
    } else {
      e.trail[0].x = e.trail[1].x; e.trail[0].y = e.trail[1].y;
      e.trail[1].x = e.trail[2].x; e.trail[1].y = e.trail[2].y;
      e.trail[2].x = e.prevX; e.trail[2].y = e.prevY;
    }
    if (e.energy > 22 && this.rng.next() < 0.08) this.spawnOffspring(e);
    if (e.energy <= 0 || e.age > 400) e.alive = false;
  }
  tick(): void {
    this.tickCount++; this.plantReproductionMultiplier = 1.0;
    for (const [key, ttl] of this.rainBoostMap) { if (ttl <= 0) this.rainBoostMap.delete(key); else this.rainBoostMap.set(key, ttl - 1); }
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]; if (!e.alive) continue; e.age++;
      if (this.rainBoostMap.has(Math.floor(e.x) + ',' + Math.floor(e.y))) { if (e.kind === 'plant') e.energy += 0.3; }
      switch (e.kind) { case 'plant': this.tickPlant(e); break; case 'herbivore': this.tickHerbivore(e); break; case 'carnivore': this.tickCarnivore(e); break; }
    }
    this.entities = this.entities.filter(e => e.alive);
    const plants = this.countAlive('plant'), herbivores = this.countAlive('herbivore'), carnivores = this.countAlive('carnivore');
    if (plants < 100) for (let i = 0; i < 30; i++) this.entities.push(this.createEntity('plant'));
    if (herbivores < 40 && plants > 30) for (let i = 0; i < 20; i++) this.entities.push(this.createEntity('herbivore'));
    if (carnivores < 15 && herbivores > 10) for (let i = 0; i < 10; i++) this.entities.push(this.createEntity('carnivore'));
  }
  getStats(): WorldStats {
    let plantCount = 0, herbivoreCount = 0, carnivoreCount = 0, totalEnergy = 0;
    for (let i = 0; i < this.entities.length; i++) { const e = this.entities[i]; if (!e.alive) continue; totalEnergy += e.energy; switch (e.kind) { case 'plant': plantCount++; break; case 'herbivore': herbivoreCount++; break; case 'carnivore': carnivoreCount++; break; } }
    return { plantCount, herbivoreCount, carnivoreCount, totalEnergy, tick: this.tickCount };
  }
  paintWalls(x: number, y: number, radius: number, add: boolean): void {
    const cr = Math.ceil(radius), r2 = radius * radius;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) if (dx * dx + dy * dy <= r2) { const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy; if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) { const key = cx + ',' + cy; if (add) this.walls.add(key); else this.walls.delete(key); } }
  }
  meteorStrike(x: number, y: number): void {
    const radius = 60, r2 = radius * radius;
    for (let i = 0; i < this.entities.length; i++) { const e = this.entities[i]; if (!e.alive) continue; const dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) e.alive = false; }
    const cr = Math.ceil(radius);
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) if (dx * dx + dy * dy <= r2) { const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy; if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) this.scorchedCells.add(cx + ',' + cy); }
  }
  removeNearestEntity(x: number, y: number, range: number): void {
    let best: Entity | null = null, bestDist = range * range;
    for (let i = 0; i < this.entities.length; i++) { const e = this.entities[i]; if (!e.alive) continue; const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bestDist) { bestDist = d; best = e; } }
    if (best) best.alive = false;
  }
}
