export const PLANET_RADIUS = 260;
export const SEA_RADIUS = 266.3;
export const BLOCK_SIZE = 1.5;

const satellites = [
  { x: -0.84, y: 0.12, z: 0.53, width: 0.44, height: 1.57 },
  { x: 0.76, y: 0.39, z: 0.52, width: 0.34, height: 1.44 },
  { x: 0.2, y: -0.75, z: 0.63, width: 0.33, height: 1.35 },
].map(item => {
  const length = Math.hypot(item.x, item.y, item.z);
  return { ...item, x: item.x / length, y: item.y / length, z: item.z / length };
});

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function landShape(direction, center, width) {
  const dot = Math.max(-1, Math.min(1,
    direction.x * center.x + direction.y * center.y + direction.z * center.z));
  const angle = Math.acos(dot);
  const irregularity =
    Math.sin(direction.x * 19.4 + direction.y * 8.6) * 0.032 +
    Math.sin(direction.y * 28.1 - direction.z * 15.2) * 0.019 +
    Math.sin(direction.z * 43.2 + direction.x * 23.4) * 0.011;
  return smoothstep(width + 0.12, width - 0.15, angle + irregularity);
}

export function terrainRadius(direction) {
  const island = landShape(direction, { x: 0, y: 0, z: 1 }, 0.76);
  let elevation = island * 2.22;
  const ridge = Math.exp(-((direction.x - .06) ** 2 / .055 + (direction.y - .20) ** 2 / .027));
  const shoulder = Math.exp(-((direction.x + .31) ** 2 / .038 + (direction.y - .22) ** 2 / .035));
  elevation += island * (ridge * 1.55 + shoulder * .72);
  for (const item of satellites) {
    elevation = Math.max(elevation, landShape(direction, item, item.width) * item.height);
  }
  const detail =
    Math.sin(direction.x * 27 + direction.y * 19) * Math.cos(direction.y * 25 - direction.z * 13) * 0.10 +
    Math.sin(direction.x * 61 + direction.z * 37) * 0.045;
  return PLANET_RADIUS + (elevation + detail * Math.min(1, elevation * 1.2)) * 10;
}

export function quantizedSurfaceRadius(direction) {
  const ground = terrainRadius(direction);
  if (ground <= SEA_RADIUS) return SEA_RADIUS;
  return Math.max(SEA_RADIUS, PLANET_RADIUS + Math.ceil((ground - PLANET_RADIUS) / BLOCK_SIZE) * BLOCK_SIZE);
}
