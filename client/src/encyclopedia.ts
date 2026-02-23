import { Species } from './species';

type SortMode = 'population' | 'age' | 'alpha';

const PAD = 16;
const ITEM_H = 38;
const HEADER_H = 48;
const SORT_BAR_H = 36;
const TRAIT_NAMES = ['Speed', 'Size', 'Sense', 'Metabolism'];

function statusOf(sp: Species): 'Extinct' | 'Endangered' | 'Alive' {
  if (sp.extinctTick !== null) return 'Extinct';
  if (sp.currentPopulation < 10) return 'Endangered';
  return 'Alive';
}

function dotColor(sp: Species): string {
  const s = statusOf(sp);
  if (s === 'Extinct') return '#ef4444';
  if (s === 'Endangered') return '#f59e0b';
  return '#22c55e';
}

function statusColor(status: string): string {
  if (status === 'Extinct') return '#ef4444';
  if (status === 'Endangered') return '#f59e0b';
  return '#22c55e';
}

export class Encyclopedia {
  private open = false;
  private selectedId: number | null = null;
  private sortMode: SortMode = 'population';
  private scrollOffset = 0;
  private mouseX = 0;
  private mouseY = 0;
  private speciesData: Map<number, Species> = new Map();
  private clickZones: Array<{ x: number; y: number; w: number; h: number; fn: () => void }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.open) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const z of this.clickZones) {
        if (mx >= z.x && mx < z.x + z.w && my >= z.y && my < z.y + z.h) {
          z.fn();
          return;
        }
      }
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.open) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.scrollOffset = Math.max(0, this.scrollOffset + Math.sign(e.deltaY) * 40);
    }, { passive: false, capture: true });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.scrollOffset = 0;
  }

  show(): void {
    this.open = true;
  }

  hide(): void {
    this.open = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  selectSpecies(id: number): void {
    this.selectedId = id;
  }

  setData(data: Map<number, Species>): void {
    this.speciesData = data;
    if (this.selectedId !== null && !data.has(this.selectedId)) {
      this.selectedId = null;
    }
  }

  getSpeciesData(): Map<number, Species> {
    return this.speciesData;
  }

  render(ctx: CanvasRenderingContext2D, tick: number): void {
    this.clickZones = [];

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ow = cw * 0.8;
    const oh = ch * 0.8;
    const ox = cw * 0.1;
    const oy = ch * 0.1;

    ctx.fillStyle = 'rgba(8, 8, 16, 0.94)';
    this.roundRect(ctx, ox, oy, ow, oh, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, ox, oy, ow, oh, 8);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('Species Encyclopedia', ox + PAD, oy + HEADER_H / 2);

    ctx.fillStyle = '#475569';
    ctx.font = '11px monospace';
    ctx.fillText('Tab / Esc to close', ox + ow - PAD - 130, oy + HEADER_H / 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy + HEADER_H);
    ctx.lineTo(ox + ow, oy + HEADER_H);
    ctx.stroke();

    const lpW = ow * 0.3;
    const rpX = ox + lpW + 1;
    const rpW = ow - lpW - 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(rpX, oy + HEADER_H);
    ctx.lineTo(rpX, oy + oh);
    ctx.stroke();

    this.drawLeftPanel(ctx, ox, oy, lpW, oh, tick);
    this.drawRightPanel(ctx, rpX, oy, rpW, oh, tick);
  }

  private drawLeftPanel(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, pw: number, oh: number,
    _tick: number,
  ): void {
    const sortY = oy + HEADER_H;
    this.drawSortBar(ctx, ox, sortY, pw);

    const listY = sortY + SORT_BAR_H;
    const listH = oh - HEADER_H - SORT_BAR_H;
    const sorted = this.sortedSpecies();

    const maxScroll = Math.max(0, sorted.length * ITEM_H - listH);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, listY, pw, listH);
    ctx.clip();

    for (let i = 0; i < sorted.length; i++) {
      const sp = sorted[i];
      const itemY = listY + i * ITEM_H - this.scrollOffset;
      if (itemY + ITEM_H < listY || itemY > listY + listH) continue;

      const isSelected = sp.id === this.selectedId;
      const isHovered =
        this.mouseX >= ox && this.mouseX < ox + pw &&
        this.mouseY >= itemY && this.mouseY < itemY + ITEM_H;

      if (isSelected) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.fillRect(ox, itemY, pw, ITEM_H);
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(ox, itemY, pw, ITEM_H);
      }

      const dot = dotColor(sp);
      ctx.beginPath();
      ctx.arc(ox + PAD + 6, itemY + ITEM_H / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = dot;
      ctx.fill();

      ctx.fillStyle = isSelected ? '#e2e8f0' : '#94a3b8';
      ctx.font = '12px monospace';
      ctx.textBaseline = 'middle';
      const nameX = ox + PAD + 18;
      const maxNameW = pw - PAD - 18 - 40;
      ctx.fillText(this.truncate(ctx, sp.name, maxNameW), nameX, itemY + ITEM_H / 2 - 7);

      ctx.fillStyle = '#4b5563';
      ctx.font = '10px monospace';
      ctx.fillText(`${sp.currentPopulation}`, nameX, itemY + ITEM_H / 2 + 7);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox + PAD, itemY + ITEM_H - 1);
      ctx.lineTo(ox + pw - PAD, itemY + ITEM_H - 1);
      ctx.stroke();

      const capturedId = sp.id;
      const capturedItemY = itemY;
      this.clickZones.push({
        x: ox, y: capturedItemY, w: pw, h: ITEM_H,
        fn: () => { this.selectedId = capturedId; },
      });
    }

    ctx.restore();
  }

  private drawSortBar(ctx: CanvasRenderingContext2D, ox: number, oy: number, pw: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(ox, oy, pw, SORT_BAR_H);

    const modes: SortMode[] = ['population', 'age', 'alpha'];
    const labels = ['Pop', 'Age', 'A-Z'];
    const btnW = (pw - PAD * 2 - 8) / 3;

    for (let i = 0; i < modes.length; i++) {
      const bx = ox + PAD + i * (btnW + 4);
      const by = oy + 6;
      const bh = SORT_BAR_H - 12;
      const active = this.sortMode === modes[i];
      const hovered =
        this.mouseX >= bx && this.mouseX < bx + btnW &&
        this.mouseY >= by && this.mouseY < by + bh;

      ctx.fillStyle = active ? 'rgba(99,102,241,0.6)' : hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
      this.roundRect(ctx, bx, by, btnW, bh, 4);
      ctx.fill();

      ctx.fillStyle = active ? '#e2e8f0' : '#64748b';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], bx + btnW / 2, by + bh / 2);
      ctx.textAlign = 'left';

      const mode = modes[i];
      this.clickZones.push({
        x: bx, y: by, w: btnW, h: bh,
        fn: () => { this.sortMode = mode; this.scrollOffset = 0; },
      });
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy + SORT_BAR_H - 1);
    ctx.lineTo(ox + pw, oy + SORT_BAR_H - 1);
    ctx.stroke();
  }

  private drawRightPanel(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, pw: number, oh: number,
    tick: number,
  ): void {
    const sp = this.selectedId !== null ? this.speciesData.get(this.selectedId) : null;

    if (!sp) {
      ctx.fillStyle = '#374151';
      ctx.font = '13px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select a species to view details', ox + PAD, oy + oh / 2);
      return;
    }

    const status = statusOf(sp);
    let cy = oy + HEADER_H + PAD * 2;

    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(ox + PAD + 8, cy + 12, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(sp.name, ox + PAD + 24, cy);
    cy += 26;

    const badge = status;
    ctx.font = 'bold 10px monospace';
    const bw = ctx.measureText(badge).width + 12;
    ctx.fillStyle = statusColor(status) + '33';
    this.roundRect(ctx, ox + PAD, cy, bw, 18, 3);
    ctx.fill();
    ctx.fillStyle = statusColor(status);
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, ox + PAD + 6, cy + 9);
    cy += 28;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox + PAD, cy);
    ctx.lineTo(ox + pw - PAD, cy);
    ctx.stroke();
    cy += 14;

    const col2X = ox + pw * 0.5;
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';

    const metaPairs: Array<[string, string]> = [
      ['Kind', sp.kind],
      ['Born', `tick ${sp.bornTick}`],
      ['Extinct', sp.extinctTick !== null ? `tick ${sp.extinctTick}` : '—'],
      ['Population', `${sp.currentPopulation} / ${sp.peakPopulation} peak`],
    ];

    for (let i = 0; i < metaPairs.length; i++) {
      const [label, value] = metaPairs[i];
      const mx = i % 2 === 0 ? ox + PAD : col2X;
      ctx.fillStyle = '#4b5563';
      ctx.fillText(label, mx, cy);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(value, mx, cy + 14);
      if (i % 2 === 1) cy += 36;
    }
    cy += 14;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(ox + PAD, cy);
    ctx.lineTo(ox + pw - PAD, cy);
    ctx.stroke();
    cy += 14;

    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('Genome Traits', ox + PAD, cy);
    cy += 18;

    const barW = pw - PAD * 2 - 80;
    for (let i = 0; i < Math.min(sp.averageGenome.length, TRAIT_NAMES.length); i++) {
      const val = sp.averageGenome[i] ?? 0;
      ctx.fillStyle = '#374151';
      ctx.fillText(TRAIT_NAMES[i], ox + PAD, cy + 4);
      const bx = ox + PAD + 80;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(bx, cy + 2, barW, 10);
      ctx.fillStyle = sp.color;
      ctx.fillRect(bx, cy + 2, barW * val, 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(val.toFixed(2), bx + barW + 6, cy + 4);
      ctx.font = '11px monospace';
      cy += 18;
    }
    cy += 6;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(ox + PAD, cy);
    ctx.lineTo(ox + pw - PAD, cy);
    ctx.stroke();
    cy += 14;

    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('Population History', ox + PAD, cy);
    cy += 16;

    const gh = 55;
    const gw = pw - PAD * 2;
    this.drawMiniGraph(ctx, ox + PAD, cy, gw, gh, sp.populationHistory, sp.color);
    cy += gh + PAD;

    if (sp.parentId !== null) {
      const parent = this.speciesData.get(sp.parentId);
      if (parent) {
        ctx.fillStyle = '#4b5563';
        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('Evolved from:', ox + PAD, cy);
        ctx.fillStyle = parent.color;
        ctx.fillText(parent.name, ox + PAD + 90, cy);

        const pid = sp.parentId;
        this.clickZones.push({
          x: ox + PAD + 90, y: cy - 2, w: ctx.measureText(parent.name).width + 4, h: 16,
          fn: () => { this.selectedId = pid; },
        });
        cy += 20;
      }
    }

    const descendants = [...this.speciesData.values()].filter(s => s.parentId === sp.id);
    if (descendants.length > 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '11px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`Descendants (${descendants.length}):`, ox + PAD, cy);
      cy += 16;
      for (const d of descendants.slice(0, 5)) {
        ctx.fillStyle = d.color;
        ctx.fillText(`• ${d.name}`, ox + PAD + 8, cy);
        const did = d.id;
        this.clickZones.push({
          x: ox + PAD, y: cy - 2, w: gw, h: 16,
          fn: () => { this.selectedId = did; },
        });
        cy += 16;
      }
      if (descendants.length > 5) {
        ctx.fillStyle = '#374151';
        ctx.fillText(`  + ${descendants.length - 5} more`, ox + PAD + 8, cy);
      }
    }

    void tick;
  }

  private drawMiniGraph(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    history: number[], color: string,
  ): void {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    if (history.length < 2) return;

    let maxVal = 1;
    for (const v of history) if (v > maxVal) maxVal = v;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < history.length; i++) {
      const px = x + (i / (history.length - 1)) * w;
      const py = y + h - (history[i] / maxVal) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  private sortedSpecies(): Species[] {
    const list = [...this.speciesData.values()];
    switch (this.sortMode) {
      case 'population':
        return list.sort((a, b) => b.currentPopulation - a.currentPopulation);
      case 'age':
        return list.sort((a, b) => a.bornTick - b.bornTick);
      case 'alpha':
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  private truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
