const canvas = document.getElementById("morphogen-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Failed to acquire 2D rendering context.");
}

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function render(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Simulation frames will be drawn here
}

function loop(): void {
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
resize();
loop();
