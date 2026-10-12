import * as THREE from 'three';
import { PLANET_RADIUS } from './planet-height.js';
import { surfacePoint } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createLootSystem(scene) {
  const group = new THREE.Group();
  group.name = 'death-drops';
  scene.add(group);
  const satchelGeometry = new THREE.BoxGeometry(.9, .6, .65);
  const beamGeometry = new THREE.BoxGeometry(.1, 4.8, .1);
  const capGeometry = new THREE.BoxGeometry(.55, .55, .55);
  const satchelMaterial = new THREE.MeshLambertMaterial({ color: '#967049' });
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#83d7ff', transparent: true, opacity: .42, depthWrite: false });
  const capMaterial = new THREE.MeshBasicMaterial({ color: '#c1f3ff' });
  return {
    group, drops: new Map(), visuals: new Map(),
    geometries: [satchelGeometry, beamGeometry, capGeometry],
    materials: [satchelMaterial, beamMaterial, capMaterial],
  };
}

export function addDeathDrop(system, drop) {
  system.drops.set(drop.id, drop);
  const direction = new THREE.Vector3(drop.direction.x, drop.direction.y, drop.direction.z).normalize();
  const root = new THREE.Group();
  root.position.copy(surfacePoint(direction, .3));
  root.quaternion.setFromUnitVectors(UP, direction);
  const satchel = new THREE.Mesh(system.geometries[0], system.materials[0]);
  satchel.position.y = .42;
  const beam = new THREE.Mesh(system.geometries[1], system.materials[1]);
  beam.position.y = 2.6;
  const cap = new THREE.Mesh(system.geometries[2], system.materials[2]);
  cap.position.y = 5.1;
  root.add(satchel, beam, cap);
  system.group.add(root);
  system.visuals.set(drop.id, { root, cap });
}

export function removeDeathDrop(system, id) {
  const visual = system.visuals.get(id);
  if (!visual) return;
  system.group.remove(visual.root);
  system.visuals.delete(id);
  system.drops.delete(id);
}

export function closestDeathDrop(system, playerDirection) {
  let nearest = null;
  let distance = Infinity;
  const playerPosition = surfacePoint(playerDirection);
  for (const drop of system.drops.values()) {
    const dropDirection = new THREE.Vector3(drop.direction.x, drop.direction.y, drop.direction.z).normalize();
    const candidate = playerPosition.distanceTo(surfacePoint(dropDirection));
    if (candidate < distance) { nearest = drop; distance = candidate; }
  }
  return nearest ? { drop: nearest, distance } : null;
}

export function updateDeathDrops(system, now, playerDirection) {
  for (const [id, visual] of system.visuals) {
    const drop = system.drops.get(id);
    const dot = playerDirection.x * drop.direction.x + playerDirection.y * drop.direction.y + playerDirection.z * drop.direction.z;
    visual.root.visible = dot > Math.cos(120 / PLANET_RADIUS);
    visual.cap.rotation.y = now * 1.4;
    visual.cap.position.y = 5.1 + Math.sin(now * 2.4 + id) * .25;
  }
}

export function disposeLootSystem(system) {
  system.group.clear();
  system.geometries.forEach(geometry => geometry.dispose());
  system.materials.forEach(material => material.dispose());
}
