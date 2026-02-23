export type SimSpeed = 1 | 2 | 5 | 10 | 50;

const SPEED_STEPS: SimSpeed[] = [1, 2, 5, 10, 50];

export class TimeController {
  speed: SimSpeed = 1;
  paused = false;
  private stepping = false;
  private speedIndex = 0;

  togglePause(): void {
    this.paused = !this.paused;
  }

  step(): void {
    if (this.paused) {
      this.stepping = true;
    }
  }

  increaseSpeed(): void {
    if (this.speedIndex < SPEED_STEPS.length - 1) {
      this.speedIndex++;
      this.speed = SPEED_STEPS[this.speedIndex];
    }
  }

  decreaseSpeed(): void {
    if (this.speedIndex > 0) {
      this.speedIndex--;
      this.speed = SPEED_STEPS[this.speedIndex];
    }
  }

  ticksThisFrame(): number {
    if (this.paused) {
      if (this.stepping) {
        this.stepping = false;
        return 1;
      }
      return 0;
    }
    return this.speed;
  }
}
