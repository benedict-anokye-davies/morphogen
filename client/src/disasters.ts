import { Simulation } from './simulation';

export type DisasterType = 'IceAge' | 'Plague' | 'Flood' | 'Drought' | 'SolarFlare';

const COLD_BIOMES = new Set<string>(['tundra', 'snow', 'mountain']);

const DISASTER_DURATIONS: Record<DisasterType, number> = {
  IceAge:     200,
  Plague:      50,
  Flood:      100,
  Drought:    100,
  SolarFlare:  50,
};

export interface ActiveDisaster {
  type: DisasterType;
  startTick: number;
  duration: number;
  x?: number;
  y?: number;
  radius?: number;
}

export interface DisasterRecord {
  type: DisasterType;
  startTick: number;
  endTick: number;
}

export class DisasterManager {
  activeDisasters: ActiveDisaster[] = [];
  history: DisasterRecord[] = [];

  triggerDisaster(type: DisasterType, tick: number, x?: number, y?: number): void {
    if (this.activeDisasters.some(d => d.type === type)) return;
    this.activeDisasters.push({
      type,
      startTick: tick,
      duration: DISASTER_DURATIONS[type],
      x,
      y,
    });
  }

  applyDisasters(simulation: Simulation, tick: number): void {
    simulation.plantReproductionMultiplier = 1.0;

    const toRemove: number[] = [];

    for (let i = 0; i < this.activeDisasters.length; i++) {
      const d = this.activeDisasters[i];
      if (tick - d.startTick >= d.duration) {
        this.history.push({ type: d.type, startTick: d.startTick, endTick: tick });
        if (this.history.length > 50) this.history.shift();
        toRemove.push(i);
        continue;
      }

      switch (d.type) {
        case 'IceAge':
          this.applyIceAge(simulation);
          break;
        case 'Plague':
          this.applyPlague(simulation);
          break;
        case 'Flood':
          this.applyFlood(simulation);
          break;
        case 'Drought':
          simulation.plantReproductionMultiplier = 0;
          this.applyDrought(simulation);
          break;
        case 'SolarFlare':
          this.applySolarFlare(simulation);
          break;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.activeDisasters.splice(toRemove[i], 1);
    }
  }

  private applyIceAge(simulation: Simulation): void {
    const { entities, terrain, width, height } = simulation;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive) continue;
      if (e.kind === 'plant') {
        const gx = Math.floor(e.x);
        const gy = Math.floor(e.y);
        if (gx >= 0 && gx < width && gy >= 0 && gy < height && COLD_BIOMES.has(terrain[gy][gx].biome)) {
          e.energy -= 1.0;
        }
      } else if (e.kind === 'herbivore') {
        e.energy -= 0.075;
      }
    }
  }

  private applyPlague(simulation: Simulation): void {
    const populations = simulation.getPopulationBySpecies();
    if (populations.size === 0) return;

    let targetSpecies = -1;
    let maxPop = 0;
    for (const [id, count] of populations) {
      if (count > maxPop) {
        maxPop = count;
        targetSpecies = id;
      }
    }

    if (targetSpecies >= 0) {
      simulation.killBySpecies(targetSpecies, 0.03);
    }
  }

  private applyFlood(simulation: Simulation): void {
    const { entities } = simulation;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive) continue;
      if (simulation.getTerrainHeight(e.x, e.y) < 0.3) {
        e.alive = false;
      }
    }
  }

  private applyDrought(simulation: Simulation): void {
    const { entities } = simulation;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive || e.kind !== 'plant') continue;
      e.energy -= 0.5;
    }
  }

  private applySolarFlare(simulation: Simulation): void {
    const { entities } = simulation;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive || e.kind !== 'plant') continue;
      e.energy += 5;
    }
  }
}
