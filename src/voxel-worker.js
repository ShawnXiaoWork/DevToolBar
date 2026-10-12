import { buildVoxelPatch } from './voxel-mesh.js';

self.onmessage = event => {
  const { key, face, x, y, size, grid } = event.data;
  const mesh = buildVoxelPatch({ face, x, y, size, grid, detail: true });
  self.postMessage({ key, mesh }, [
    mesh.positions.buffer, mesh.normals.buffer, mesh.colors.buffer, mesh.sway.buffer, mesh.indices.buffer,
  ]);
};
