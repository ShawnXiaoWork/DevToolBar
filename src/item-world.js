import * as THREE from 'three';
import { ITEMS } from './items.js';
import { PLANET_RADIUS } from './planet-height.js';
import { surfacePoint } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createItemWorld(scene) {
  const group = new THREE.Group();
  group.name = 'ground-items';
  scene.add(group);
  const geometry = new THREE.BoxGeometry(.45, .45, .45);
  const materials = new Map(Object.entries(ITEMS).map(([id, item]) =>
    [id, new THREE.MeshLambertMaterial({ color: item.color, emissive: item.color, emissiveIntensity: .15 })]));
  return { group, geometry, materials, drops: new Map(), visuals: new Map() };
}

export function addGroundItem(system, drop) {
  if (!ITEMS[drop.itemId] || drop.quantity < 1 || system.drops.has(drop.id)) return false;
  const direction = new THREE.Vector3(drop.direction.x, drop.direction.y, drop.direction.z).normalize();
  const root = new THREE.Group();
  root.position.copy(surfacePoint(direction, .48));
  root.quaternion.setFromUnitVectors(UP, direction);
  const mesh = new THREE.Mesh(system.geometry, system.materials.get(drop.itemId));
  root.add(mesh);
  system.group.add(root);
  system.drops.set(drop.id, drop);
  system.visuals.set(drop.id, { root, mesh });
  return true;
}

export function removeGroundItem(system, id) {
  const visual = system.visuals.get(id);
  if (!visual) return;
  system.group.remove(visual.root);
  system.visuals.delete(id);
  system.drops.delete(id);
}

export function closestGroundItem(system, playerDirection) {
  const playerPosition = surfacePoint(playerDirection);
  let nearest = null;
  let distance = Infinity;
  for (const drop of system.drops.values()) {
    const direction = new THREE.Vector3(drop.direction.x, drop.direction.y, drop.direction.z).normalize();
    const candidate = playerPosition.distanceTo(surfacePoint(direction));
    if (candidate < distance) { nearest = drop; distance = candidate; }
  }
  return nearest ? { drop: nearest, distance } : null;
}

export function updateGroundItems(system, now, playerDirection) {
  for (const [id, visual] of system.visuals) {
    const drop = system.drops.get(id);
    const dot = playerDirection.x * drop.direction.x + playerDirection.y * drop.direction.y + playerDirection.z * drop.direction.z;
    visual.root.visible = dot > Math.cos(95 / PLANET_RADIUS);
    if (!visual.root.visible) continue;
    visual.mesh.rotation.y = now * 1.5 + id;
    visual.mesh.position.y = Math.sin(now * 2.5 + id) * .12;
  }
}

export function disposeItemWorld(system) {
  system.group.clear();
  system.geometry.dispose();
  for (const material of system.materials.values()) material.dispose();
}
