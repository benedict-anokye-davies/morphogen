import { Entity, WorldStats, TerrainCell } from './types';
import { generateTerrain, isLand } from './terrain';

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) / 0xffffffff);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

const MAX_PLANTS = 600;
const MAX_HERBIVORES = 200;
const MAX_CARNIVORES = 60;

export class Simulation {
  entities: Entity[] = [];
  terrain: TerrainCell[][];
  tickCount = 0;
  readonly width: number;
  readonly height: number;
  private rng: SeededRNG;
  private nextId = 0;

  constructor(width: number, height: number, seed: number) {
    this.width = width;
    this.height = height;
    this.rng = new SeededRNG(seed);
    this.terrain = generateTerrain(width, height, seed);
    this.populate();
  }

  private allocId(): number {
    return this.nextId++;
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

  private createEntity(kind: Entity['kind']): Entity {
    const pos = this.findLandPosition();
    const base: Record<Entity['kind'], { energy: number; speed: number; size: number }> = {
      plant: { energy: 10, speed: 0, size: 3 },
      herbivore: { energy: 20, speed: 2.0, size: 4 },
      carnivore: { energy: 20, speed: 2.0, size: 5 },
    };
    const cfg = base[kind];
    return {
      id: this.allocId(),
      x: pos.x,
      y: pos.y,
      energy: cfg.energy + this.rng.range(-2, 2),
      kind,
      alive: true,
      size: cfg.size,
      speed: cfg.speed + this.rng.range(-0.3, 0.3),
      age: 0,
      speciesId: Math.floor(this.rng.next() * 1000),
    };
  }

  private populate(): void {
    for (let i = 0; i < 400; i++) this.entities.push(this.createEntity('plant'));
    for (let i = 0; i < 80; i++) this.entities.push(this.createEntity('herbivore'));
    for (let i = 0; i < 30; i++) this.entities.push(this.createEntity('carnivore'));
  }

  private clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
  }

  private distSq(a: Entity, b: Entity): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private moveToward(entity: Entity, tx: number, ty: number): void {
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;
    const step = Math.min(entity.speed, dist);
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;
    entity.x = this.clamp(entity.x, 0, this.width - 1);
    entity.y = this.clamp(entity.y, 0, this.height - 1);
  }

  private wander(entity: Entity): void {
    const angle = this.rng.next() * Math.PI * 2;
    const tx = entity.x + Math.cos(angle) * entity.speed * 2;
    const ty = entity.y + Math.sin(angle) * entity.speed * 2;
    this.moveToward(entity, tx, ty);
  }

  private findNearest(entity: Entity, kind: Entity['kind'], range: number): Entity | null {
    let best: Entity | null = null;
    let bestDist = range * range;
    for (let i = 0; i < this.entities.length; i++) {
      const other = this.entities[i];
      if (!other.alive || other.kind !== kind || other.id === entity.id) continue;
      const d = this.distSq(entity, other);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  private countAlive(kind: Entity['kind']): number {
    let n = 0;
    for (let i = 0; i < this.entities.length; i++) {
      if (this.entities[i].alive && this.entities[i].kind === kind) n++;
    }
    return n;
  }

  private spawnOffspring(parent: Entity): void {
    const caps: Record<Entity['kind'], number> = {
      plant: MAX_PLANTS,
      herbivore: MAX_HERBIVORES,
      carnivore: MAX_CARNIVORES,
    };
    if (this.countAlive(parent.kind) >= caps[parent.kind]) return;

    const offsetX = this.rng.range(-4, 4);
    const offsetY = this.rng.range(-4, 4);
    const child: Entity = {
      id: this.allocId(),
      x: this.clamp(parent.x + offsetX, 0, this.width - 1),
      y: this.clamp(parent.y + offsetY, 0, this.height - 1),
      energy: parent.energy * 0.35,
      kind: parent.kind,
      alive: true,
      size: parent.size + this.rng.range(-0.2, 0.2),
      speed: parent.speed + this.rng.range(-0.1, 0.1),
      age: 0,
      speciesId: parent.speciesId,
    };
    child.speed = this.clamp(child.speed, 0.5, 3);
    child.size = this.clamp(child.size, 2, 6);
    parent.energy *= 0.55;
    this.entities.push(child);
  }

  private tickPlant(e: Entity): void {
    e.energy += 0.5;
    if (e.energy > 20 && this.rng.next() < 0.08) {
      this.spawnOffspring(e);
    }
    if (e.energy <= 0 || e.age > 500) e.alive = false;
  }

  private tickHerbivore(e: Entity): void {
    e.energy -= 0.15;
    const target = this.findNearest(e, 'plant', 35);
    if (target) {
      this.moveToward(e, target.x, target.y);
      if (this.distSq(e, target) < 4) {
        e.energy += 8;
        target.alive = false;
      }
    } else {
      this.wander(e);
    }
    if (e.energy > 22 && this.rng.next() < 0.08) {
      this.spawnOffspring(e);
    }
    if (e.energy <= 0 || e.age > 400) e.alive = false;
  }

  private tickCarnivore(e: Entity): void {
    e.energy -= 0.4;
    const target = this.findNearest(e, 'herbivore', 40);
    if (target) {
      this.moveToward(e, target.x, target.y);
      if (this.distSq(e, target) < 6) {
        e.energy += 15;
        target.alive = false;
      }
    } else {
      this.wander(e);
    }
    if (e.energy > 30 && this.rng.next() < 0.04) {
      this.spawnOffspring(e);
    }
    if (e.energy <= 0 || e.age > 200) e.alive = false;
  }

  tick(): void {
    this.tickCount++;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      e.age++;

      switch (e.kind) {
        case 'plant': this.tickPlant(e); break;
        case 'herbivore': this.tickHerbivore(e); break;
        case 'carnivore': this.tickCarnivore(e); break;
      }
    }

    this.entities = this.entities.filter(e => e.alive);

    const plants = this.countAlive('plant');
    const herbivores = this.countAlive('herbivore');
    const carnivores = this.countAlive('carnivore');

    if (plants < 100) {
      for (let i = 0; i < 30; i++) this.entities.push(this.createEntity('plant'));
    }
    if (herbivores < 8 && plants > 80) {
      for (let i = 0; i < 8; i++) this.entities.push(this.createEntity('herbivore'));
    }
    if (carnivores < 3 && herbivores > 25) {
      for (let i = 0; i < 4; i++) this.entities.push(this.createEntity('carnivore'));
    }
  }

  getStats(): WorldStats {
    let plantCount = 0;
    let herbivoreCount = 0;
    let carnivoreCount = 0;
    let totalEnergy = 0;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      totalEnergy += e.energy;
      switch (e.kind) {
        case 'plant': plantCount++; break;
        case 'herbivore': herbivoreCount++; break;
        case 'carnivore': carnivoreCount++; break;
      }
    }

    return { plantCount, herbivoreCount, carnivoreCount, totalEnergy, tick: this.tickCount };
  }
}