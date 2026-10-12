import * as THREE from 'three';
import { BLOCK_SIZE, PLANET_RADIUS } from './planet-height.js';
import { buildVoxelPatch, CHUNK_CELLS, FAR_GRID, NEAR_GRID, faceDirection, directionToCell, snappedSurfaceRadius } from './voxel-mesh.js';

const MAX_WORKER_JOBS = 2;
const STREAM_INTERVAL = .18;

function geometryFromData(data, recess = 0) {
  if (recess) {
    for (let i = 0; i < data.positions.length; i += 3) {
      const x = data.positions[i];
      const y = data.positions[i + 1];
      const z = data.positions[i + 2];
      const radius = Math.hypot(x, y, z);
      const scale = (radius - recess) / radius;
      data.positions[i] *= scale;
      data.positions[i + 1] *= scale;
      data.positions[i + 2] *= scale;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute('aSway', new THREE.BufferAttribute(data.sway, 1));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeMesh(data, material, recess = 0) {
  const mesh = new THREE.Mesh(geometryFromData(data, recess), material);
  mesh.frustumCulled = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createVoxelTerrain() {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 1 },
    uSun: { value: new THREE.Vector3(.5, .8, .4) },
    uWindStrength: { value: .75 },
    uWindSpeed: { value: 1 },
    uWindDirection: { value: new THREE.Vector3(Math.cos(35 * Math.PI / 180), Math.sin(35 * Math.PI / 180), 0) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 color;
      attribute float aSway;
      uniform float uTime;
      uniform float uWindStrength;
      uniform float uWindSpeed;
      uniform vec3 uWindDirection;
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        vec3 radial = normalize(position);
        vec3 wind = normalize(uWindDirection - radial * dot(uWindDirection, radial) + vec3(.0001));
        float wave = sin(dot(position, uWindDirection) * .035 - uTime * uWindSpeed * 1.8);
        vec3 displaced = position + wind * wave * aSway * uWindStrength * .16;
        vColor = color;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uDay;
      uniform vec3 uSun;
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        float diffuse = max(dot(normalize(vNormal), normalize(uSun)), 0.0);
        float lighting = mix(.55, .69 + diffuse * .37, uDay);
        gl_FragColor = vec4(vColor * lighting, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const far = new THREE.Group();
  const near = new THREE.Group();
  group.add(far, near);
  for (let face = 0; face < 6; face++) {
    const data = buildVoxelPatch({ face, x: 0, y: 0, size: FAR_GRID, grid: FAR_GRID, detail: false });
    const mesh = makeMesh(data, material, BLOCK_SIZE * 2);
    far.add(mesh);
  }

  const descriptors = [];
  const chunksPerFace = NEAR_GRID / CHUNK_CELLS;
  for (let face = 0; face < 6; face++) {
    for (let y = 0; y < chunksPerFace; y++) {
      for (let x = 0; x < chunksPerFace; x++) {
        const u = -1 + (x + .5) * 2 / chunksPerFace;
        const v = -1 + (y + .5) * 2 / chunksPerFace;
        const direction = faceDirection(face, u, v);
        descriptors.push({
          face, x: x * CHUNK_CELLS, y: y * CHUNK_CELLS,
          key: `${face}:${x}:${y}`, direction,
        });
      }
    }
  }

  const active = new Map();
  const pending = new Set();
  const wanted = new Set();
  let worker = null;
  try {
    worker = new Worker(new URL('./voxel-worker.js', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  const state = {
    group, far, near, active, pending, wanted, descriptors, material, uniforms,
    renderDistance: window.innerWidth < 700 ? 65 : 105,
    maxChunks: window.innerWidth < 700 ? 30 : 96,
    stats: { active: 0, pending: 0, candidate: 0, mode: '近景' },
    elapsed: STREAM_INTERVAL,
    worker,
  };

  if (worker) {
    worker.onmessage = event => {
      const { key, mesh: data } = event.data;
      pending.delete(key);
      if (!wanted.has(key) || active.has(key)) return;
      const mesh = makeMesh(data, material);
      mesh.name = `voxel-chunk-${key}`;
      near.add(mesh);
      active.set(key, mesh);
      state.stats.active = active.size;
      state.stats.pending = pending.size;
    };
    worker.onerror = () => {
      worker.terminate();
      worker = null;
      state.worker = null;
      pending.clear();
    };
  }

  state.dispose = () => {
    worker?.terminate();
    for (const mesh of active.values()) mesh.geometry.dispose();
    for (const mesh of far.children) mesh.geometry.dispose();
    material.dispose();
  };
  return state;
}

export function updateVoxelTerrain(state, camera, playerDirection, dt) {
  state.elapsed += dt;
  if (state.elapsed < STREAM_INTERVAL) return;
  state.elapsed = 0;
  const cameraDirection = camera.position.clone().normalize();
  const nearMode = camera.position.length() - PLANET_RADIUS < 185;
  const cameraHeight = camera.position.length() - snappedSurfaceRadius(cameraDirection);
  const closeFace = directionToCell(cameraDirection).face;
  for (let face = 0; face < 6; face++) {
    state.far.children[face].visible = !(nearMode && cameraHeight < 22 && state.active.size >= 35 && face === closeFace);
  }
  const candidates = [];
  const angularLimit = state.renderDistance / PLANET_RADIUS;
  const cosineLimit = Math.cos(angularLimit);
  if (nearMode) {
    for (const descriptor of state.descriptors) {
      const direction = descriptor.direction;
      const cameraDot = direction.x * cameraDirection.x + direction.y * cameraDirection.y + direction.z * cameraDirection.z;
      const playerDot = direction.x * playerDirection.x + direction.y * playerDirection.y + direction.z * playerDirection.z;
      const closeness = Math.max(cameraDot, playerDot);
      if (closeness >= cosineLimit) candidates.push({ descriptor, closeness });
    }
  }
  candidates.sort((a, b) => b.closeness - a.closeness);
  state.wanted.clear();
  for (const item of candidates.slice(0, state.maxChunks)) state.wanted.add(item.descriptor.key);

  for (const [key, mesh] of state.active) {
    if (state.wanted.has(key)) continue;
    state.near.remove(mesh);
    mesh.geometry.dispose();
    state.active.delete(key);
  }

  for (const item of candidates) {
    if (state.pending.size >= MAX_WORKER_JOBS || state.active.size + state.pending.size >= state.maxChunks) break;
    const descriptor = item.descriptor;
    if (!state.wanted.has(descriptor.key) || state.active.has(descriptor.key) || state.pending.has(descriptor.key)) continue;
    state.pending.add(descriptor.key);
    const request = { key: descriptor.key, face: descriptor.face, x: descriptor.x, y: descriptor.y, size: CHUNK_CELLS, grid: NEAR_GRID };
    if (state.worker) state.worker.postMessage(request);
    else {
      const data = buildVoxelPatch({ ...request, detail: true });
      const mesh = makeMesh(data, state.material);
      state.near.add(mesh);
      state.active.set(descriptor.key, mesh);
      state.pending.delete(descriptor.key);
      break;
    }
  }
  state.stats.active = state.active.size;
  state.stats.pending = state.pending.size;
  state.stats.candidate = candidates.length;
  state.stats.mode = nearMode ? '近景区块' : '整球 LOD';
}
