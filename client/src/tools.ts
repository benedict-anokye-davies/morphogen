import { Simulation } from './simulation';

export enum ToolType {
  Select         = 0,
  SpawnPlant     = 1,
  SpawnHerbivore = 2,
  SpawnCarnivore = 3,
  Kill           = 4,
  Feed           = 5,
  Poison         = 6,
  Wall           = 7,
  EraseWall      = 8,
  Meteor         = 9,
  Rain           = 10,
}

export interface ToolDef {
  name: string;
  hotkey: string;
  cursor: string;
  radius: number;
  color: string;
  icon: string;
}

export const TOOL_DEFS: Record<ToolType, ToolDef> = {
  [ToolType.Select]:         { name: 'Select',     hotkey: '1', cursor: 'default',   radius: 0,  color: '#e5e7eb', icon: '>>' },
  [ToolType.SpawnPlant]:     { name: 'Plant',      hotkey: '2', cursor: 'crosshair', radius: 0,  color: '#22c55e', icon: 'PL' },
  [ToolType.SpawnHerbivore]: { name: 'Herbivore',  hotkey: '3', cursor: 'crosshair', radius: 0,  color: '#3b82f6', icon: 'HB' },
  [ToolType.SpawnCarnivore]: { name: 'Carnivore',  hotkey: '4', cursor: 'crosshair', radius: 0,  color: '#ef4444', icon: 'CR' },
  [ToolType.Kill]:           { name: 'Kill',       hotkey: '5', cursor: 'crosshair', radius: 15, color: '#f97316', icon: 'KL' },
  [ToolType.Feed]:           { name: 'Feed',       hotkey: '6', cursor: 'crosshair', radius: 30, color: '#facc15', icon: 'FD' },
  [ToolType.Poison]:         { name: 'Poison',     hotkey: '7', cursor: 'crosshair', radius: 30, color: '#a855f7', icon: 'PZ' },
  [ToolType.Wall]:           { name: 'Wall',       hotkey: '8', cursor: 'cell',      radius: 3,  color: '#6b7280', icon: '##' },
  [ToolType.EraseWall]:      { name: 'Erase Wall', hotkey: 'E', cursor: 'cell',      radius: 3,  color: '#d1d5db', icon: '..' },
  [ToolType.Meteor]:         { name: 'Meteor',     hotkey: '9', cursor: 'crosshair', radius: 60, color: '#fb923c', icon: 'MT' },
  [ToolType.Rain]:           { name: 'Rain',       hotkey: '0', cursor: 'crosshair', radius: 40, color: '#38bdf8', icon: 'RN' },
};

export const ALL_TOOLS: ToolType[] = [
  ToolType.Select,
  ToolType.SpawnPlant,
  ToolType.SpawnHerbivore,
  ToolType.SpawnCarnivore,
  ToolType.Kill,
  ToolType.Feed,
  ToolType.Poison,
  ToolType.Wall,
  ToolType.EraseWall,
  ToolType.Meteor,
  ToolType.Rain,
];

export class ToolManager {
  activeTool: ToolType = ToolType.Select;

  constructor(private simulation: Simulation) {}

  get walls(): Set<string> {
    return this.simulation.walls;
  }

  setTool(tool: ToolType): void {
    this.activeTool = tool;
  }

  getActiveDef(): ToolDef {
    return TOOL_DEFS[this.activeTool];
  }

  applyAt(cellX: number, cellY: number): void {
    const sim = this.simulation;

    switch (this.activeTool) {
      case ToolType.SpawnPlant:
        sim.addEntity('plant', cellX, cellY);
        break;
      case ToolType.SpawnHerbivore:
        sim.addEntity('herbivore', cellX, cellY);
        break;
      case ToolType.SpawnCarnivore:
        sim.addEntity('carnivore', cellX, cellY);
        break;
      case ToolType.Kill:
        sim.removeNearestEntity(cellX, cellY, TOOL_DEFS[ToolType.Kill].radius);
        break;
      case ToolType.Feed:
        sim.feedArea(cellX, cellY, TOOL_DEFS[ToolType.Feed].radius);
        break;
      case ToolType.Poison:
        sim.poisonArea(cellX, cellY, TOOL_DEFS[ToolType.Poison].radius);
        break;
      case ToolType.Wall:
        sim.paintWalls(cellX, cellY, TOOL_DEFS[ToolType.Wall].radius, true);
        break;
      case ToolType.EraseWall:
        sim.paintWalls(cellX, cellY, TOOL_DEFS[ToolType.EraseWall].radius, false);
        break;
      case ToolType.Meteor:
        sim.meteorStrike(cellX, cellY);
        break;
      case ToolType.Rain:
        sim.rainBoost(cellX, cellY, TOOL_DEFS[ToolType.Rain].radius);
        break;
    }
  }
}
