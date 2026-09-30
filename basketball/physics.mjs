export const HOOPS = [220, 580];
export const RIM_Y = 318;
export const GRAVITY = 1100;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export function remaining(deadline, now) { return Math.max(0, (deadline - now) / 1000); }
export function pointsAt(seconds) { return seconds <= 0 ? 0 : seconds <= 10 ? 3 : seconds <= 20 ? 2 : 1; }
export function makeBall(lane, dx, dy, round) {
  return {x: HOOPS[lane], y: 684, vx: clamp(dx * 3, -650, 650), vy: -clamp(dy * 3.4, 650, 1120), age: 0, scored: false, round};
}
// Detect only downward crossings. Interpolation prevents fast balls skipping the rim.
export function stepBall(ball, dt) {
  const oldX = ball.x, oldY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt + GRAVITY * dt * dt / 2;
  ball.vy += GRAVITY * dt;
  ball.age += dt;
  if (!ball.scored && oldY < RIM_Y && ball.y >= RIM_Y && ball.vy > 0) {
    const x = oldX + (ball.x - oldX) * (RIM_Y - oldY) / (ball.y - oldY);
    const hoop = HOOPS.findIndex(h => Math.abs(x - h) < 34);
    if (hoop !== -1) { ball.scored = true; return hoop; }
    // A rim strike kicks the ball away rather than counting it as a basket.
    const edge = HOOPS.flatMap(h => [h - 48, h + 48]).find(e => Math.abs(x - e) < 15);
    if (edge !== undefined) { ball.vy *= -.42; ball.vx += (x < edge ? -1 : 1) * 150; }
  }
  return -1;
}
