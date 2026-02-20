import { Simulation } from './simulation';
import { Camera } from './camera';
import { WorldStats } from './types';

const COLORS = {
  plant: '#22c55e',
  herbivore: '#3b82f6',
  carnivore: '#ef4444',
} as const;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private history: WorldStats[] = [];
  private lastFrameTime = performance.now();
  private fps = 60;
  private terrainCanvas: HTMLCanvasElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private simulation: Simulation,
    private camera: Camera,
    private cellSize: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire 2D context');
    this.ctx = ctx;

    this.terrainCanvas = document.createElement('canvas');
    this.bakeTerrainCache();
  }

  private bakeTerrainCache(): void {
    const terrain = this.simulation.terrain;
    const cs = this.cellSize;
    const w = this.simulation.width * cs;
    const h = this.simulation.height * cs;

    this.terrainCanvas.width = w;
    this.terrainCanvas.height = h;
    const tctx = this.terrainCanvas.getContext('2d');
    if (!tctx) return;

    for (let y = 0; y < this.simulation.height; y++) {
      for (let x = 0; x < this.simulation.width; x++) {
        tctx.fillStyle = terrain[y][x].color;
        tctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
  }

  recordStats(): void {
    this.history.push(this.simulation.getStats());
    if (this.history.length > 300) this.history.shift();
  }

  render(): void {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.fps += (1000 / dt - this.fps) * 0.05;

    this.camera.update();

    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, width, height);

    this.drawTerrain();
    this.drawEntities();
    this.drawHUD();
    this.drawPopulationGraph();
  }

  private drawTerrain(): void {
    const cs = this.cellSize;
    const origin = this.camera.worldToScreen(0, 0);
    const totalW = this.simulation.width * cs * this.camera.zoom;
    const totalH = this.simulation.height * cs * this.camera.zoom;

    this.ctx.drawImage(
      this.terrainCanvas,
      Math.floor(origin.x),
      Math.floor(origin.y),
      Math.ceil(totalW),
      Math.ceil(totalH),
    );
  }

  private drawEntities(): void {
    const cs = this.cellSize;
    const entities = this.simulation.entities;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const zoomScale = Math.min(this.camera.zoom, 3);

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive) continue;

      const screen = this.camera.worldToScreen(e.x * cs, e.y * cs);

      if (screen.x < -20 || screen.x > cw + 20 ||
          screen.y < -20 || screen.y > ch + 20) continue;

      const radius = Math.max(2, Math.min(8, (e.energy / 10) * 2)) * zoomScale;

      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS[e.kind];
      this.ctx.fill();
    }
  }

  private drawHUD(): void {
    const stats = this.simulation.getStats();
    this.ctx.font = '13px monospace';
    this.ctx.textBaseline = 'top';

    const lines = [
      { label: `FPS: ${Math.round(this.fps)}`, color: '#888' },
      { label: `Tick: ${stats.tick}`, color: '#888' },
      { label: `Plants: ${stats.plantCount}`, color: COLORS.plant },
      { label: `Herbivores: ${stats.herbivoreCount}`, color: COLORS.herbivore },
      { label: `Carnivores: ${stats.carnivoreCount}`, color: COLORS.carnivore },
      { label: `Energy: ${Math.round(stats.totalEnergy)}`, color: '#f59e0b' },
    ];

    let yOffset = 12;
    for (const line of lines) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.ctx.fillRect(8, yOffset - 2, this.ctx.measureText(line.label).width + 8, 18);
      this.ctx.fillStyle = line.color;
      this.ctx.fillText(line.label, 12, yOffset);
      yOffset += 20;
    }
  }

  private drawPopulationGraph(): void {
    if (this.history.length < 2) return;

    const gw = 220;
    const gh = 110;
    const pad = 10;
    const ox = this.canvas.width - gw - pad;
    const oy = this.canvas.height - gh - pad;

    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(ox, oy, gw, gh);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    this.ctx.strokeRect(ox, oy, gw, gh);

    const inset = 8;
    const plotW = gw - inset * 2;
    const plotH = gh - inset * 2;
    const plotX = ox + inset;
    const plotY = oy + inset;

    let maxVal = 1;
    for (const s of this.history) {
      maxVal = Math.max(maxVal, s.plantCount, s.herbivoreCount, s.carnivoreCount);
    }

    const drawLine = (key: 'plantCount' | 'herbivoreCount' | 'carnivoreCount', color: string): void => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.5;
      for (let i = 0; i < this.history.length; i++) {
        const x = plotX + (i / (this.history.length - 1)) * plotW;
        const y = plotY + plotH - (this.history[i][key] / maxVal) * plotH;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    };

    drawLine('plantCount', COLORS.plant);
    drawLine('herbivoreCount', COLORS.herbivore);
    drawLine('carnivoreCount', COLORS.carnivore);

    this.ctx.lineWidth = 1;
  }
}