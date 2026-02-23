import { Species, PhyloNode } from './species';

const PAD_LEFT = 60;
const PAD_RIGHT = 40;
const PAD_TOP = 40;
const NODE_RADIUS_BASE = 5;
const NODE_RADIUS_MAX = 14;
const MIN_LEAF_SPACING = 24;

function statusColor(sp: Species): string {
  if (sp.extinctTick !== null) return '#ef4444';
  if (sp.currentPopulation < 10) return '#f59e0b';
  return '#22c55e';
}

function computeLeafCount(node: PhyloNode): number {
  if (node.children.length === 0) {
    node.leafCount = 1;
    return 1;
  }
  let total = 0;
  for (const child of node.children) {
    total += computeLeafCount(child);
  }
  node.leafCount = total;
  return total;
}

function assignLayoutY(node: PhyloNode, startY: number, leafSpacing: number): number {
  if (node.children.length === 0) {
    node.layoutY = startY + leafSpacing / 2;
    return startY + leafSpacing;
  }
  let nextY = startY;
  for (const child of node.children) {
    nextY = assignLayoutY(child, nextY, leafSpacing);
  }
  const first = node.children[0].layoutY;
  const last = node.children[node.children.length - 1].layoutY;
  node.layoutY = (first + last) / 2;
  return nextY;
}

function maxBornTick(node: PhyloNode): number {
  let m = node.species.bornTick;
  for (const child of node.children) {
    const cm = maxBornTick(child);
    if (cm > m) m = cm;
  }
  return m;
}

export class PhyloTree {
  private open = false;
  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private hoveredId: number | null = null;
  private isDragging = false;
  private lastMx = 0;
  private lastMy = 0;
  private speciesData: Map<number, Species> = new Map();
  private mouseX = 0;
  private mouseY = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private onSelectSpecies: (id: number) => void,
  ) {
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.open) return;
      this.isDragging = true;
      this.lastMx = e.clientX;
      this.lastMy = e.clientY;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.open) return;
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      if (this.isDragging) {
        this.panX += e.clientX - this.lastMx;
        this.panY += e.clientY - this.lastMy;
        this.lastMx = e.clientX;
        this.lastMy = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.open) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - this.panX) / this.zoom;
      const wy = (my - this.panY) / this.zoom;
      this.zoom = Math.max(0.3, Math.min(8, this.zoom * factor));
      this.panX = mx - wx * this.zoom;
      this.panY = my - wy * this.zoom;
    }, { passive: false, capture: true });

    canvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.open) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (this.hoveredId !== null) {
        this.onSelectSpecies(this.hoveredId);
      }
      void mx; void my;
    });
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.resetView();
  }

  show(): void {
    this.open = true;
    this.resetView();
  }

  hide(): void {
    this.open = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  setData(data: Map<number, Species>): void {
    this.speciesData = data;
  }

  private resetView(): void {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = 'rgba(6, 8, 18, 0.96)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('Phylogenetic Tree', 16, 12);
    ctx.fillStyle = '#475569';
    ctx.font = '11px monospace';
    ctx.fillText('Scroll to zoom  •  Drag to pan  •  Click node to inspect  •  T / Esc to close', 16, 32);

    if (this.speciesData.size === 0) {
      ctx.fillStyle = '#374151';
      ctx.font = '13px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('No species data yet.', cw / 2 - 60, ch / 2);
      return;
    }

    const root = this.buildTree();
    if (!root) return;

    const leafCount = computeLeafCount(root);
    const leafSpacing = Math.max(MIN_LEAF_SPACING, (ch - PAD_TOP * 2) / leafCount);
    assignLayoutY(root, PAD_TOP, leafSpacing);

    const maxTick = Math.max(maxBornTick(root), 1);
    const drawW = cw - PAD_LEFT - PAD_RIGHT;

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this.hoveredId = null;
    this.drawTree(ctx, root, null, maxTick, drawW);

    ctx.restore();
  }

  private drawTree(
    ctx: CanvasRenderingContext2D,
    node: PhyloNode,
    parent: PhyloNode | null,
    maxTick: number,
    drawW: number,
  ): void {
    const x = PAD_LEFT + (node.species.bornTick / maxTick) * drawW;
    const y = node.layoutY;

    if (parent !== null) {
      const px = PAD_LEFT + (parent.species.bornTick / maxTick) * drawW;
      const py = parent.layoutY;

      ctx.strokeStyle = 'rgba(100,116,139,0.4)';
      ctx.lineWidth = 1 / this.zoom;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    for (const child of node.children) {
      this.drawTree(ctx, child, node, maxTick, drawW);
    }

    const sp = node.species;
    const peak = sp.peakPopulation;
    const radius = sp.id === 0
      ? 3
      : Math.max(NODE_RADIUS_BASE, Math.min(NODE_RADIUS_MAX, NODE_RADIUS_BASE + (peak / 50) * 6));

    const screenX = x * this.zoom + this.panX;
    const screenY = y * this.zoom + this.panY;
    const hovered =
      Math.abs(this.mouseX - screenX) < radius * this.zoom + 4 &&
      Math.abs(this.mouseY - screenY) < radius * this.zoom + 4;

    if (hovered && sp.id !== 0) {
      this.hoveredId = sp.id;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = sp.id === 0 ? '#334155' : statusColor(sp);
    ctx.fill();

    if (hovered) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.stroke();
      ctx.lineWidth = 1 / this.zoom;
    }

    if (this.zoom > 0.6 && sp.id !== 0) {
      const label = sp.name;
      ctx.font = `${Math.max(8, 10 / this.zoom)}px monospace`;
      ctx.fillStyle = '#cbd5e1';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + radius + 4, y);
    }

    if (hovered && sp.id !== 0) {
      this.drawTooltip(ctx, x, y, sp);
    }
  }

  private drawTooltip(
    ctx: CanvasRenderingContext2D,
    nx: number, ny: number, sp: Species,
  ): void {
    const lines = [
      sp.name,
      `Pop: ${sp.currentPopulation} / ${sp.peakPopulation}`,
      `Born: tick ${sp.bornTick}`,
    ];
    if (sp.extinctTick !== null) lines.push(`Extinct: tick ${sp.extinctTick}`);

    const fontSize = Math.max(9, 11 / this.zoom);
    ctx.font = `${fontSize}px monospace`;
    let maxW = 0;
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      if (w > maxW) maxW = w;
    }
    const lineH = fontSize + 4;
    const bw = maxW + 16;
    const bh = lines.length * lineH + 12;
    const bx = nx + 14;
    const by = ny - bh / 2;

    ctx.fillStyle = 'rgba(8,8,20,0.92)';
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 0 ? '#e2e8f0' : '#94a3b8';
      ctx.fillText(lines[i], bx + 8, by + 6 + i * lineH);
    }
  }

  private buildTree(): PhyloNode | null {
    if (this.speciesData.size === 0) return null;

    const childrenOf = new Map<number | null, number[]>();
    for (const [id, sp] of this.speciesData) {
      const pid = sp.parentId;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(id);
    }

    const buildNode = (id: number): PhyloNode => {
      const sp = this.speciesData.get(id)!;
      const childIds = childrenOf.get(id) ?? [];
      return {
        species: sp,
        children: childIds.map(cid => buildNode(cid)),
        layoutY: 0,
        leafCount: 0,
      };
    };

    const roots = childrenOf.get(null) ?? [];
    if (roots.length === 0) return null;
    if (roots.length === 1) return buildNode(roots[0]);

    return {
      species: {
        id: 0, name: 'Progenitor', parentId: null, kind: 'root',
        bornTick: 0, extinctTick: null, peakPopulation: 0,
        currentPopulation: 0, averageGenome: [], populationHistory: [],
        color: '#666',
      },
      children: roots.map(id => buildNode(id)),
      layoutY: 0,
      leafCount: 0,
    };
  }
}
