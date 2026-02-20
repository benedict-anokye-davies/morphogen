export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;

  private dragging = false;
  private lastMx = 0;
  private lastMy = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.bindEvents();
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.dragging = true;
      this.lastMx = e.clientX;
      this.lastMy = e.clientY;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastMx;
      const dy = e.clientY - this.lastMy;
      this.targetX -= dx / this.zoom;
      this.targetY -= dy / this.zoom;
      this.lastMx = e.clientX;
      this.lastMy = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldBefore = this.screenToWorld(mx, my);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.targetZoom = Math.max(0.2, Math.min(20, this.targetZoom * factor));

      const worldAfter = this.screenToWorld(mx, my);
      this.targetX += worldBefore.x - worldAfter.x;
      this.targetY += worldBefore.y - worldAfter.y;
    }, { passive: false });
  }

  update(): void {
    const smoothing = 0.15;
    this.x += (this.targetX - this.x) * smoothing;
    this.y += (this.targetY - this.y) * smoothing;
    this.zoom += (this.targetZoom - this.zoom) * smoothing;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom,
      y: (wy - this.y) * this.zoom,
    };
  }
}