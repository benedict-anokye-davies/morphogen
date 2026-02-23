import { Simulation } from './simulation';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { SpeciesTracker } from './species';
import { Encyclopedia } from './encyclopedia';
import { PhyloTree } from './phylotree';
import { ToolManager, ToolType, TOOL_DEFS } from './tools';
import { TimeController } from './timecontrol';
import { DisasterManager, DisasterType } from './disasters';

const WORLD_W   = 300;
const WORLD_H   = 300;
const CELL_SIZE = 4;
const SEED      = 12345;

const canvas = document.getElementById('morphogen-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

function resize(): void {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const simulation      = new Simulation(WORLD_W, WORLD_H, SEED);
const camera          = new Camera(canvas);
const renderer        = new Renderer(canvas, simulation, camera, CELL_SIZE);
const tools           = new ToolManager(simulation);
const timeController  = new TimeController();
const disasterManager = new DisasterManager();

renderer.setToolManager(tools);
renderer.setTimeController(timeController);
renderer.setDisasterManager(disasterManager);

const speciesTracker = new SpeciesTracker();
speciesTracker.initBaseSpecies(simulation.entities, 0);

const encyclopedia = new Encyclopedia(canvas);
const phyloTree = new PhyloTree(canvas, (id: number) => {
  encyclopedia.selectSpecies(id);
  encyclopedia.show();
  phyloTree.hide();
});

renderer.setOverlays(encyclopedia, phyloTree);

camera.setLockFn(() => {
  const overlaysOpen = encyclopedia.isOpen() || phyloTree.isOpen();
  const toolActive   = tools.activeTool !== ToolType.Select;
  return overlaysOpen || toolActive;
});

function screenToCell(sx: number, sy: number): { x: number; y: number } {
  const world = camera.screenToWorld(sx, sy);
  return { x: world.x / CELL_SIZE, y: world.y / CELL_SIZE };
}

function activateTool(tool: ToolType): void {
  tools.setTool(tool);
  canvas.style.cursor = TOOL_DEFS[tool].cursor;
}

const hotkeyMap: Record<string, ToolType> = {
  '1': ToolType.Select,
  '2': ToolType.SpawnPlant,
  '3': ToolType.SpawnHerbivore,
  '4': ToolType.SpawnCarnivore,
  '5': ToolType.Kill,
  '6': ToolType.Feed,
  '7': ToolType.Poison,
  '8': ToolType.Wall,
  '9': ToolType.Meteor,
  '0': ToolType.Rain,
  'e': ToolType.EraseWall,
  'E': ToolType.EraseWall,
};

const KEY_DISASTER: Record<string, DisasterType> = {
  i: 'IceAge',
  g: 'Plague',
  o: 'Flood',
  d: 'Drought',
  s: 'SolarFlare',
};

let isMouseDown    = false;
let isDraggingTool = false;

canvas.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
});

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button === 2) {
    const cell = screenToCell(e.clientX, e.clientY);
    simulation.removeNearestEntity(cell.x, cell.y, 15);
    return;
  }

  if (e.button !== 0) return;

  isMouseDown    = true;
  isDraggingTool = tools.activeTool !== ToolType.Select;

  if (!isDraggingTool) return;

  const cell = screenToCell(e.clientX, e.clientY);

  if (tools.activeTool === ToolType.Meteor) {
    tools.applyAt(cell.x, cell.y);
    renderer.triggerMeteorFlash();
  } else {
    tools.applyAt(cell.x, cell.y);
  }
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  renderer.setCursorPos(e.clientX, e.clientY);

  if (!isMouseDown || !isDraggingTool) return;

  const t = tools.activeTool;
  if (t === ToolType.Wall || t === ToolType.EraseWall) {
    const cell = screenToCell(e.clientX, e.clientY);
    tools.applyAt(cell.x, cell.y);
  }
});

window.addEventListener('mouseup', () => {
  isMouseDown    = false;
  isDraggingTool = false;
});

document.addEventListener('keydown', (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const tool = hotkeyMap[e.key];
  if (tool !== undefined) {
    activateTool(tool);
    return;
  }

  const key = e.key.toLowerCase();

  switch (key) {
    case ' ':
      e.preventDefault();
      timeController.togglePause();
      break;
    case '.':
      timeController.step();
      break;
    case '-':
      timeController.decreaseSpeed();
      break;
    case '=':
    case '+':
      timeController.increaseSpeed();
      break;
    case 'tab':
      e.preventDefault();
      encyclopedia.toggle();
      if (encyclopedia.isOpen()) phyloTree.hide();
      break;
    case 't':
      phyloTree.toggle();
      if (phyloTree.isOpen()) encyclopedia.hide();
      break;
    case 'k':
      renderer.toggleSpeciesTint();
      break;
    case 'escape':
      activateTool(ToolType.Select);
      encyclopedia.hide();
      phyloTree.hide();
      break;
    default:
      if (KEY_DISASTER[key]) {
        disasterManager.triggerDisaster(KEY_DISASTER[key], simulation.tickCount);
      }
      break;
  }
});

function frame(): void {
  const ticks = timeController.ticksThisFrame();

  for (let i = 0; i < ticks; i++) {
    disasterManager.applyDisasters(simulation, simulation.tickCount);
    simulation.tick();
    speciesTracker.update(simulation.entities, simulation.tickCount);
    renderer.recordStats();
  }

  if (ticks > 0) {
    renderer.updateSpeciesData(speciesTracker.species);
    encyclopedia.setData(speciesTracker.species);
    phyloTree.setData(speciesTracker.species);
  }

  renderer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
