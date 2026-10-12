import { BLOCK_SIZE, PLANET_RADIUS, SEA_RADIUS, terrainRadius, quantizedSurfaceRadius } from './planet-height.js';

export const NEAR_GRID = 512;
export const CHUNK_CELLS = 16;
export const FAR_GRID = 48;

export const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

export function faceDirection(face, u, v) {
  const basis = FACES[face];
  const x = basis.n[0] + basis.u[0] * u + basis.v[0] * v;
  const y = basis.n[1] + basis.u[1] * u + basis.v[1] * v;
  const z = basis.n[2] + basis.u[2] * u + basis.v[2] * v;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

export function directionToCell(direction, grid = NEAR_GRID) {
  const abs = [Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)];
  const axis = abs[0] > abs[1] && abs[0] > abs[2] ? 0 : abs[1] > abs[2] ? 1 : 2;
  const face = axis * 2 + (direction[['x', 'y', 'z'][axis]] < 0 ? 1 : 0);
  const basis = FACES[face];
  const denominator = Math.abs(direction[['x', 'y', 'z'][axis]]);
  const u = (direction.x * basis.u[0] + direction.y * basis.u[1] + direction.z * basis.u[2]) / denominator;
  const v = (direction.x * basis.v[0] + direction.y * basis.v[1] + direction.z * basis.v[2]) / denominator;
  return {
    face,
    x: Math.max(0, Math.min(grid - 1, Math.floor((u + 1) * grid * .5))),
    y: Math.max(0, Math.min(grid - 1, Math.floor((v + 1) * grid * .5))),
  };
}

export function snappedSurfaceRadius(direction) {
  const cell = directionToCell(direction);
  const center = faceDirection(cell.face, -1 + (cell.x + .5) * 2 / NEAR_GRID, -1 + (cell.y + .5) * 2 / NEAR_GRID);
  return quantizedSurfaceRadius(center);
}

function hash(face, x, y, salt = 0) {
  let value = (face + 1) * 73856093 ^ (x + 2071) * 19349663 ^ (y + 3911) * 83492791 ^ salt;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

function colorForTop(direction, face, x, y) {
  const height = terrainRadius(direction);
  const variation = hash(face, x, y, 13);
  if (height <= SEA_RADIUS) return [0.065 + variation * .015, .33 + variation * .06, .54 + variation * .06];
  if (height < SEA_RADIUS + 2.2) return [.68 + variation * .06, .56 + variation * .05, .34 + variation * .03];
  if (height > PLANET_RADIUS + 34) return [.43 + variation * .10, .44 + variation * .10, .43 + variation * .10];
  const meadow = .5 + .5 * Math.sin(direction.x * 104 + Math.sin(direction.y * 69) * 2.3) * Math.cos(direction.y * 137);
  return [.24 + meadow * .085 + variation * .055, .45 + meadow * .13 + variation * .07, .13 + meadow * .035 + variation * .035];
}

function sideColor(topHeight, currentHeight, ocean, variation) {
  if (ocean) return [.035, .23, .40];
  if (currentHeight < PLANET_RADIUS + 11) return [.39 + variation * .05, .30 + variation * .04, .18 + variation * .025];
  if (topHeight > PLANET_RADIUS + 34 || topHeight - currentHeight > 8) return [.37 + variation * .06, .37 + variation * .06, .35 + variation * .06];
  return [.38 + variation * .04, .265 + variation * .03, .15 + variation * .02];
}

export function buildVoxelPatch({ face, x, y, size, grid, detail }) {
  const positions = [];
  const normals = [];
  const colors = [];
  const sway = [];
  const indices = [];
  const step = 2 / grid;
  const baseU = -1 + x * step;
  const baseV = -1 + y * step;

  const point = (direction, radius) => [direction.x * radius, direction.y * radius, direction.z * radius];
  const addQuad = (a, b, c, d, color, vertexSway = [0, 0, 0, 0]) => {
    const index = positions.length / 3;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const length = Math.hypot(...normal) || 1;
    for (const [vertexIndex, vertex] of [a, b, c, d].entries()) {
      positions.push(...vertex);
      normals.push(normal[0] / length, normal[1] / length, normal[2] / length);
      colors.push(...color);
      sway.push(vertexSway[vertexIndex]);
    }
    indices.push(index, index + 1, index + 2, index + 1, index + 3, index + 2);
  };

  const addBlock = (center, tangentU, tangentV, base, width, height, color, topColor = color, windAmount = 0) => {
    const half = width * .5;
    const corner = (u, v, radial) => [
      center.x * radial + tangentU[0] * u + tangentV[0] * v,
      center.y * radial + tangentU[1] * u + tangentV[1] * v,
      center.z * radial + tangentU[2] * u + tangentV[2] * v,
    ];
    const bottom = [corner(-half, -half, base), corner(half, -half, base), corner(-half, half, base), corner(half, half, base)];
    const top = [corner(-half, -half, base + height), corner(half, -half, base + height), corner(-half, half, base + height), corner(half, half, base + height)];
    addQuad(top[0], top[1], top[2], top[3], topColor, [windAmount, windAmount, windAmount, windAmount]);
    addQuad(bottom[0], top[0], bottom[1], top[1], color, [0, windAmount, 0, windAmount]);
    addQuad(bottom[1], top[1], bottom[3], top[3], color, [0, windAmount, 0, windAmount]);
    addQuad(bottom[3], top[3], bottom[2], top[2], color, [0, windAmount, 0, windAmount]);
    addQuad(bottom[2], top[2], bottom[0], top[0], color, [0, windAmount, 0, windAmount]);
  };

  for (let localY = 0; localY < size; localY++) {
    for (let localX = 0; localX < size; localX++) {
      const cellX = x + localX;
      const cellY = y + localY;
      const u0 = baseU + localX * step;
      const v0 = baseV + localY * step;
      const center = faceDirection(face, u0 + step * .5, v0 + step * .5);
      const height = quantizedSurfaceRadius(center);
      const ocean = terrainRadius(center) <= SEA_RADIUS;
      const topColor = colorForTop(center, face, cellX, cellY);
      const corners = [
        faceDirection(face, u0, v0), faceDirection(face, u0 + step, v0),
        faceDirection(face, u0, v0 + step), faceDirection(face, u0 + step, v0 + step),
      ];
      const top = corners.map(direction => point(direction, height));
      addQuad(top[0], top[1], top[2], top[3], topColor);

      const neighbours = [
        { du: -step, dv: 0, a: 0, b: 2 },
        { du: step, dv: 0, a: 3, b: 1 },
        { du: 0, dv: -step, a: 1, b: 0 },
        { du: 0, dv: step, a: 2, b: 3 },
      ];
      for (const edge of neighbours) {
        const neighbour = faceDirection(face, u0 + step * .5 + edge.du, v0 + step * .5 + edge.dv);
        const nextHeight = quantizedSurfaceRadius(neighbour);
        if (nextHeight >= height - .01) continue;
        const total = height - nextHeight;
        const segments = detail ? Math.ceil(total / BLOCK_SIZE) : Math.min(3, Math.ceil(total / BLOCK_SIZE));
        for (let segment = 0; segment < segments; segment++) {
          const bottomHeight = nextHeight + total * segment / segments;
          const topHeight = nextHeight + total * (segment + 1) / segments;
          const shade = sideColor(height, bottomHeight, ocean, hash(face, cellX, cellY, segment));
          addQuad(point(corners[edge.a], bottomHeight), point(corners[edge.a], topHeight),
            point(corners[edge.b], bottomHeight), point(corners[edge.b], topHeight), shade);
        }
      }

      if (!detail || ocean || height <= SEA_RADIUS + 1) continue;
      const basis = FACES[face];
      const project = axis => {
        const dot = axis[0] * center.x + axis[1] * center.y + axis[2] * center.z;
        const vector = [axis[0] - center.x * dot, axis[1] - center.y * dot, axis[2] - center.z * dot];
        const length = Math.hypot(...vector);
        return vector.map(value => value / length);
      };
      const tangentU = project(basis.u);
      const tangentV = project(basis.v);
      const plant = hash(face, cellX, cellY, 47);
      if (plant < .075) {
        const green = [.16, .46 + hash(face, cellX, cellY, 91) * .12, .12];
        addBlock(center, tangentU, tangentV, height + .02, .16, .38 + hash(face, cellX, cellY, 49) * .32, green, green, 1);
      }
      if (plant > .966 && plant < .983) {
        const petals = hash(face, cellX, cellY, 61) < .48 ? [.8, .15, .25] : hash(face, cellX, cellY, 63) < .55 ? [.22, .26, .72] : [.85, .82, .69];
        addBlock(center, tangentU, tangentV, height + .02, .14, .75, [.16, .42, .12], [.16, .42, .12], .7);
        addBlock(center, tangentU, tangentV, height + .72, .43, .25, petals, petals, .8);
      }
      if (plant > .9962 && height > SEA_RADIUS + 4) {
        addBlock(center, tangentU, tangentV, height, .9, 3.5, [.30, .17, .08]);
        addBlock(center, tangentU, tangentV, height + 2.8, 4.2, 2.6, [.12, .35, .10], [.20, .48, .13], .35);
        addBlock(center, tangentU, tangentV, height + 5.2, 2.8, 1.4, [.16, .39, .11], [.25, .52, .15], .5);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    sway: new Float32Array(sway),
    indices: new Uint32Array(indices),
  };
}
