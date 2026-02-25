import { Simulation } from './simulation';
import { Camera } from './camera';
import { Entity, WorldStats } from './types';
import { Species } from './species';
import { Encyclopedia } from './encyclopedia';
import { PhyloTree } from './phylotree';
import { ToolManager, TOOL_DEFS, ALL_TOOLS } from './tools';
import { TimeController } from './timecontrol';
import { DisasterManager, DisasterType } from './disasters';

const COLORS = {
  plant:     '#22c55e',
  herbivore: '#3b82f6',
  carnivore: '#ef4444',
} as const;

const PALETTE_W    = 50;
const SLOT_H       = 42;
const HUD_X        = PALETTE_W + 8;
const WALL_COLOR   = '#374151';
const SCORCH_COLOR = '#3b1a08';
const RAIN_COLOR   = 'rgba(56, 189, 248, 0.18)';

interface DisasterStyle {
  tint:   string;
  banner: string;
  label:  string;
}

const DISASTER_STYLES: Record<DisasterType, DisasterStyle> = {
  IceAge:     { tint: 'rgba(80, 130, 255, 0.12)',  banner: '#1e3a8a', label: 'ICE AGE'     },
  Plague:     { tint: 'rgba(180, 0, 0, 0.10)',     banner: '#7f1d1d', label: 'PLAGUE'      },
  Flood:      { tint: 'rgba(0, 20, 180, 0.14)',    banner: '#1e2f6e', label: 'FLOOD'       },
  Drought:    { tint: 'rgba(160, 80, 0, 0.10)',    banner: '#78350f', label: 'DROUGHT'     },
  SolarFlare: { tint: 'rgba(255, 200, 0, 0.10)',   banner: '#713f12', label: 'SOLAR FLARE' },
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private history: WorldStats[] = [];
  private lastFrameTime = performance.now();
  private fps = 60;
  private terrainCanvas: HTMLCanvasElement;
  private speciesData: Map<number, Species> = new Map();
  private speciesTintEnabled = false;
  private encyclopedia: Encyclopedia | null = null;
  private phyloTree: PhyloTree | null = null;

  private toolManager: ToolManager | null = null;
  private timeController: TimeController | null = null;
  private disasterManager: DisasterManager | null = null;
  private cursorSx = 0;
  private cursorSy = 0;
  private meteorFlash = 0;

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

  setOverlays(enc: Encyclopedia, phy: PhyloTree): void {
    this.encyclopedia = enc;
    this.phyloTree = phy;
  }

  setToolManager(tm: ToolManager): void {
    this.toolManager = tm;
  }

  setTimeController(tc: TimeController): void {
    this.timeController = tc;
  }

  setDisasterManager(dm: DisasterManager): void {
    this.disasterManager = dm;
  }

  setCursorPos(sx: number, sy: number): void {
    this.cursorSx = sx;
    this.cursorSy = sy;
  }

  triggerMeteorFlash(): void {
    this.meteorFlash = 1.0;
  }

  updateSpeciesData(data: Map<number, Species>): void {
    this.speciesData = data;
  }

  toggleSpeciesTint(): void {
    this.speciesTintEnabled = !this.speciesTintEnabled;
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
    this.drawScorchedCells();
    this.drawRainCells();
    this.drawWalls();
    this.drawEntities();
    this.drawMeteorFlash();
    this.drawDisasterTint();
    this.drawHUD();
    this.drawSpeedIndicator();
    this.drawDisasterBanner();
    this.drawDisasterHistory();
    this.drawPopulationGraph();
    this.drawToolPalette();
    this.drawCursorPreview();
    this.drawToolFooter();

    if (this.phyloTree?.isOpen()) {
      this.phyloTree.render(this.ctx);
    } else if (this.encyclopedia?.isOpen()) {
      this.encyclopedia.render(this.ctx, this.simulation.tickCount);
    }
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

  private drawScorchedCells(): void {
    const cs = this.cellSize;
    const cellSz = cs * this.camera.zoom;
    if (cellSz < 0.5) return;

    this.ctx.fillStyle = SCORCH_COLOR;
    for (const key of this.simulation.scorchedCells) {
      const comma = key.indexOf(',');
      const cx = +key.slice(0, comma);
      const cy = +key.slice(comma + 1);
      const { x, y } = this.camera.worldToScreen(cx * cs, cy * cs);
      this.ctx.fillRect(x, y, cellSz + 0.5, cellSz + 0.5);
    }
  }

  private drawRainCells(): void {
    const cs = this.cellSize;
    const cellSz = cs * this.camera.zoom;
    if (cellSz < 0.5) return;

    this.ctx.fillStyle = RAIN_COLOR;
    for (const [key] of this.simulation.rainBoostMap) {
      const comma = key.indexOf(',');
      const cx = +key.slice(0, comma);
      const cy = +key.slice(comma + 1);
      const { x, y } = this.camera.worldToScreen(cx * cs, cy * cs);
      this.ctx.fillRect(x, y, cellSz + 0.5, cellSz + 0.5);
    }
  }

  private drawWalls(): void {
    const cs = this.cellSize;
    const cellSz = cs * this.camera.zoom;
    if (cellSz < 0.5) return;

    this.ctx.fillStyle = WALL_COLOR;
    for (const key of this.simulation.walls) {
      const comma = key.indexOf(',');
      const cx = +key.slice(0, comma);
      const cy = +key.slice(comma + 1);
      const { x, y } = this.camera.worldToScreen(cx * cs, cy * cs);
      this.ctx.fillRect(x, y, cellSz + 0.5, cellSz + 0.5);
    }
  }

  private drawEntities(): void {
    const cs = this.cellSize;
    const entities = this.simulation.entities;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const zs = Math.min(this.camera.zoom, 3);
    const ctx = this.ctx;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive || e.kind !== 'carnivore' || !e.trail) continue;
      const scr = this.camera.worldToScreen(e.x * cs, e.y * cs);
      if (scr.x < -80 || scr.x > cw + 80 || scr.y < -80 || scr.y > ch + 80) continue;
      const baseR = Math.max(1.5, (2.5 + (e.genome[1] ?? 0.5) * 2.5) * zs * 0.55);
      for (let t = 0; t < e.trail.length; t++) {
        const tp = e.trail[t];
        const ts = this.camera.worldToScreen(tp.x * cs, tp.y * cs);
        ctx.beginPath();
        ctx.arc(ts.x, ts.y, baseR * (0.55 + t * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${((t + 1) * 0.10).toFixed(2)})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.alive) continue;
      const scr = this.camera.worldToScreen(e.x * cs, e.y * cs);
      const sx = scr.x;
      const sy = scr.y;
      if (sx < -20 || sx > cw + 20 || sy < -20 || sy > ch + 20) continue;
      switch (e.kind) {
        case 'plant':     this.drawPlant(e, sx, sy, zs);     break;
        case 'herbivore': this.drawHerbivore(e, sx, sy, zs); break;
        case 'carnivore': this.drawCarnivore(e, sx, sy, zs); break;
      }
    }

    ctx.shadowBlur = 0;
  }

  private plantColor(g: number[], energy: number, age: number): string {
    const g2 = g[2] ?? 0.5;
    let h: number, s: number, l: number;
    if (g2 < 0.5) {
      const t = g2 * 2;
      h = 120 - t * 40; s = 70 - t * 10; l = 25 + t * 20;
    } else if (g2 < 0.8) {
      const t = (g2 - 0.5) / 0.3;
      h = 80 - t * 35; s = 60 + t * 15; l = 45 + t * 5;
    } else {
      const t = (g2 - 0.8) * 5;
      h = (45 + t * 235) % 360; s = 75 - t * 15; l = 50 - t * 5;
    }
    const grey = energy < 2 ? (2 - energy) * 0.5 : 0;
    const flash = age < 10 ? (10 - age) * 2 : 0;
    s = s * (1 - grey);
    l = Math.min(88, l * (1 - grey) + 50 * grey + flash);
    const pulse = 0.82 + Math.sin(age * 0.12) * 0.12;
    return `hsla(${h | 0},${s | 0}%,${l | 0}%,${pulse.toFixed(2)})`;
  }

  private herbivoreColor(g: number[], energy: number, age: number): string {
    const vivid = g[0] * 0.6 + (1 - g[1]) * 0.4;
    const h = 220 - vivid * 30;
    let s = 75 + vivid * 20;
    let l = 18 + vivid * 47;
    const grey = energy < 2 ? (2 - energy) * 0.5 : 0;
    const flash = age < 10 ? (10 - age) * 2 : 0;
    s = s * (1 - grey);
    l = Math.min(88, l * (1 - grey) + 50 * grey + flash);
    const alpha = energy < 5 ? 0.35 + (energy / 5) * 0.65 : 1.0;
    return `hsla(${h | 0},${s | 0}%,${l | 0}%,${alpha.toFixed(2)})`;
  }

  private carnivoreColor(g: number[], energy: number, age: number): string {
    const vivid = g[0] * 0.6 + (1 - g[1]) * 0.4;
    const h = (350 + vivid * 30) % 360;
    let s = 80 + vivid * 10;
    let l = 22 + vivid * 33;
    const grey = energy < 2 ? (2 - energy) * 0.5 : 0;
    const flash = age < 10 ? (10 - age) * 2 : 0;
    s = s * (1 - grey);
    l = Math.min(88, l * (1 - grey) + 50 * grey + flash);
    return `hsl(${h | 0},${s | 0}%,${l | 0}%)`;
  }

  private speciesEntityColor(e: Entity): string {
    const hue = (e.speciesId * 137.508) % 360;
    const energyNorm = Math.min(1, e.energy / 25);
    const grey = e.energy < 2 ? (2 - e.energy) * 0.5 : 0;
    const s = 68 * (1 - grey);
    const l = Math.min(88, (28 + energyNorm * 42) * (1 - grey) + 50 * grey);
    return `hsl(${hue | 0},${s | 0}%,${l | 0}%)`;
  }

  private drawPlant(e: Entity, sx: number, sy: number, zs: number): void {
    const ctx = this.ctx;
    const energyNorm = Math.min(1, Math.max(0, e.energy / 20));
    const r = Math.max(2, 2 + energyNorm * 4) * zs;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.speciesTintEnabled ? this.speciesEntityColor(e) : this.plantColor(e.genome, e.energy, e.age);
    ctx.fill();
  }

  private drawHerbivore(e: Entity, sx: number, sy: number, zs: number): void {
    const ctx = this.ctx;
    const r = Math.max(3, 2.5 + (e.genome[1] ?? 0.5) * 3.5) * zs;
    const color = this.speciesTintEnabled ? this.speciesEntityColor(e) : this.herbivoreColor(e.genome, e.energy, e.age);

    const dx = e.prevX !== undefined ? e.x - e.prevX : 0;
    const dy = e.prevY !== undefined ? e.y - e.prevY : 0;
    const angle = (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) ? Math.atan2(dy, dx) : -Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const tipX = sx + cosA * r;
    const tipY = sy + sinA * r;
    const blX = sx + cosA * (-r * 0.6) - sinA * (-r * 0.85);
    const blY = sy + sinA * (-r * 0.6) + cosA * (-r * 0.85);
    const brX = sx + cosA * (-r * 0.6) - sinA * (r * 0.85);
    const brY = sy + sinA * (-r * 0.6) + cosA * (r * 0.85);

    if (e.energy > 20) {
      ctx.shadowBlur = 8 * zs;
      ctx.shadowColor = '#7dd3fc';
    }

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(blX, blY);
    ctx.lineTo(brX, brY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (e.energy > 20) ctx.shadowBlur = 0;
  }

  private drawCarnivore(e: Entity, sx: number, sy: number, zs: number): void {
    const ctx = this.ctx;
    const baseR = Math.max(3, 3 + (e.genome[1] ?? 0.5) * 3) * zs;
    const r = e.hunting ? baseR * 1.25 : baseR;
    const color = this.speciesTintEnabled ? this.speciesEntityColor(e) : this.carnivoreColor(e.genome, e.energy, e.age);

    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.lineTo(sx + r * 0.72, sy);
    ctx.lineTo(sx, sy + r);
    ctx.lineTo(sx - r * 0.72, sy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawMeteorFlash(): void {
    if (this.meteorFlash <= 0) return;
    this.ctx.fillStyle = `rgba(255, 180, 60, ${this.meteorFlash})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.meteorFlash = Math.max(0, this.meteorFlash - 0.05);
  }

  private drawDisasterTint(): void {
    if (!this.disasterManager) return;
    const active = this.disasterManager.activeDisasters;
    if (active.length === 0) return;

    const { width, height } = this.canvas;
    for (const d of active) {
      this.ctx.fillStyle = DISASTER_STYLES[d.type].tint;
      this.ctx.fillRect(0, 0, width, height);
    }
  }

  private drawHUD(): void {
    const stats = this.simulation.getStats();
    this.ctx.font = '13px monospace';
    this.ctx.textBaseline = 'top';

    const speciesCount = [...this.speciesData.values()].filter(s => s.extinctTick === null).length;

    const lines = [
      { label: `FPS: ${Math.round(this.fps)}`, color: '#888' },
      { label: `Tick: ${stats.tick}`, color: '#888' },
      { label: `Plants: ${stats.plantCount}`, color: COLORS.plant },
      { label: `Herbivores: ${stats.herbivoreCount}`, color: COLORS.herbivore },
      { label: `Carnivores: ${stats.carnivoreCount}`, color: COLORS.carnivore },
      { label: `Energy: ${Math.round(stats.totalEnergy)}`, color: '#f59e0b' },
      { label: `Species: ${speciesCount}`, color: '#a78bfa' },
      { label: `[Tab] Encyclopedia  [T] Phylotree  [K] Color by species`, color: '#334155' },
    ];

    let yOffset = 12;
    for (const line of lines) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.ctx.fillRect(HUD_X - 4, yOffset - 2, this.ctx.measureText(line.label).width + 8, 18);
      this.ctx.fillStyle = line.color;
      this.ctx.fillText(line.label, HUD_X, yOffset);
      yOffset += 20;
    }
  }

  private drawSpeedIndicator(): void {
    if (!this.timeController) return;
    const tc = this.timeController;
    const label = tc.paused ? 'PAUSED' : `Speed: ${tc.speed}x`;
    const color = tc.paused ? '#facc15' : '#a3e635';

    this.ctx.font = '13px monospace';
    this.ctx.textBaseline = 'top';

    const textW = this.ctx.measureText(label).width;
    const x = this.canvas.width - textW - 16;
    const y = 12;

    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(x - 4, y - 2, textW + 8, 18);
    this.ctx.fillStyle = color;
    this.ctx.fillText(label, x, y);
  }

  private drawDisasterBanner(): void {
    if (!this.disasterManager) return;
    const active = this.disasterManager.activeDisasters;
    if (active.length === 0) return;

    const bannerH = 26;
    const { width } = this.canvas;

    this.ctx.font = 'bold 12px monospace';
    this.ctx.textBaseline = 'middle';

    const segW = Math.floor(width / active.length);
    for (let i = 0; i < active.length; i++) {
      const d = active[i];
      const style = DISASTER_STYLES[d.type];
      const elapsed = this.simulation.tickCount - d.startTick;
      const remaining = d.duration - elapsed;
      const progress = elapsed / d.duration;
      const pct = Math.round((1 - progress) * 100);
      const label = `*** ${style.label}  ${remaining}t (${pct}%) ***`;

      const x = i * segW;
      this.ctx.fillStyle = style.banner;
      this.ctx.fillRect(x, 0, segW, bannerH);

      const textW = this.ctx.measureText(label).width;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(label, x + (segW - textW) / 2, bannerH / 2);
    }
  }

  private drawDisasterHistory(): void {
    if (!this.disasterManager) return;
    const records = this.disasterManager.history.slice(-5);
    if (records.length === 0) return;

    const pad = 10;
    const lineH = 18;
    const tick = this.simulation.tickCount;

    this.ctx.font = '11px monospace';
    this.ctx.textBaseline = 'top';

    let y = this.canvas.height - pad - records.length * lineH;

    for (const record of records) {
      const age = tick - record.endTick;
      const alpha = Math.max(0.1, 1 - age / 400);
      const label = `${record.type} [${record.startTick}-${record.endTick}]`;
      const textW = this.ctx.measureText(label).width;

      this.ctx.fillStyle = `rgba(0,0,0,${(alpha * 0.65).toFixed(2)})`;
      this.ctx.fillRect(pad, y - 2, textW + 8, lineH);
      this.ctx.fillStyle = `rgba(210,210,210,${alpha.toFixed(2)})`;
      this.ctx.fillText(label, pad + 4, y);
      y += lineH;
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

  private drawToolPalette(): void {
    if (!this.toolManager) return;

    const ch = this.canvas.height;
    const totalH = ALL_TOOLS.length * SLOT_H;
    const startY = Math.max(0, (ch - totalH) / 2);

    this.ctx.fillStyle = 'rgba(10,10,10,0.85)';
    this.ctx.fillRect(0, 0, PALETTE_W, ch);

    this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(PALETTE_W, 0);
    this.ctx.lineTo(PALETTE_W, ch);
    this.ctx.stroke();

    for (let i = 0; i < ALL_TOOLS.length; i++) {
      const tool = ALL_TOOLS[i];
      const def = TOOL_DEFS[tool];
      const slotY = startY + i * SLOT_H;
      const active = this.toolManager.activeTool === tool;

      if (active) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.12)';
        this.ctx.fillRect(0, slotY, PALETTE_W, SLOT_H);
        this.ctx.fillStyle = def.color;
        this.ctx.fillRect(0, slotY, 3, SLOT_H);
      }

      this.ctx.font = 'bold 12px monospace';
      this.ctx.textBaseline = 'middle';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = active ? def.color : 'rgba(200,200,200,0.65)';
      this.ctx.fillText(def.icon, PALETTE_W / 2, slotY + SLOT_H / 2 - 5);

      this.ctx.font = '9px monospace';
      this.ctx.fillStyle = active ? 'rgba(255,255,255,0.8)' : 'rgba(120,120,120,0.7)';
      this.ctx.fillText(def.hotkey, PALETTE_W / 2, slotY + SLOT_H / 2 + 8);

      this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(4, slotY + SLOT_H);
      this.ctx.lineTo(PALETTE_W - 4, slotY + SLOT_H);
      this.ctx.stroke();
    }

    this.ctx.textAlign = 'left';
  }

  private drawCursorPreview(): void {
    if (!this.toolManager) return;
    const def = this.toolManager.getActiveDef();
    if (def.radius <= 0) return;

    const screenRadius = def.radius * this.cellSize * this.camera.zoom;

    this.ctx.beginPath();
    this.ctx.arc(this.cursorSx, this.cursorSy, screenRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = def.color;
    this.ctx.lineWidth = 1.5;
    this.ctx.globalAlpha = 0.55;
    this.ctx.stroke();

    this.ctx.fillStyle = def.color;
    this.ctx.globalAlpha = 0.06;
    this.ctx.fill();

    this.ctx.globalAlpha = 1.0;
  }

  private drawToolFooter(): void {
    if (!this.toolManager) return;
    const def = this.toolManager.getActiveDef();

    const label = `${def.name}  [${def.hotkey}]${def.radius > 0 ? `  r:${def.radius}` : ''}`;
    this.ctx.font = '12px monospace';
    this.ctx.textBaseline = 'bottom';
    this.ctx.textAlign = 'left';
    const tw = this.ctx.measureText(label).width;
    const bx = PALETTE_W + 8;
    const by = this.canvas.height - 8;

    this.ctx.fillStyle = 'rgba(0,0,0,0.65)';
    this.ctx.fillRect(bx - 4, by - 16, tw + 12, 20);

    this.ctx.fillStyle = def.color;
    this.ctx.fillText(label, bx, by);
  }
}
