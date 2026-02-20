import { Simulation } from './simulation';
import { Camera } from './camera';
import { Renderer } from './renderer';

const WORLD_W = 300;
const WORLD_H = 300;
const CELL_SIZE = 4;
const SEED = 12345;

const canvas = document.getElementById('morphogen-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const simulation = new Simulation(WORLD_W, WORLD_H, SEED);
const camera = new Camera(canvas);
const renderer = new Renderer(canvas, simulation, camera, CELL_SIZE);

setInterval(() => {
  simulation.tick();
  renderer.recordStats();
}, 100);

function frame(): void {
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);