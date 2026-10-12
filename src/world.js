import * as THREE from 'three';
import { PLANET_RADIUS, SEA_RADIUS } from './planet-height.js';
import { snappedSurfaceRadius } from './voxel-mesh.js';
import { createVoxelTerrain } from './voxel-terrain.js';

export { PLANET_RADIUS, SEA_RADIUS };
export const START_DIRECTION = new THREE.Vector3(0, 0, 1);

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function smoothstep(a, b, value) {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function random(seed) { return Math.abs((Math.sin(seed * 127.1 + 78.233) * 43758.5453) % 1); }

export function surfacePoint(direction, offset = 0) {
  const normal = direction.clone().normalize();
  return normal.multiplyScalar(snappedSurfaceRadius(normal) + offset);
}

export function getTangentFrame(direction) {
  const north = new THREE.Vector3(0, 1, 0).addScaledVector(direction, -direction.y).normalize();
  if (north.lengthSq() < .01) north.set(0, 0, 1);
  const east = new THREE.Vector3().crossVectors(north, direction).normalize();
  return { north, east };
}

function makeSky() {
  const uniforms = {
    uTime: { value: 0 },
    uTop: { value: new THREE.Color('#4c9de4') },
    uHorizon: { value: new THREE.Color('#b8ddeb') },
    uGlow: { value: new THREE.Color('#ffe9c7') },
    uSun: { value: new THREE.Vector3(.5, .8, -.5) },
    uUp: { value: START_DIRECTION.clone() },
    uClouds: { value: 1 },
    uDay: { value: 1 },
    uSpace: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uClouds;
      uniform float uDay;
      uniform float uSpace;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uSun;
      uniform vec3 uUp;
      varying vec3 vDirection;
      float hash3(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = mix(hash3(i), hash3(i + vec3(1,0,0)), f.x);
        float b = mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x);
        float c = mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x);
        float d = mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x);
        return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float height = dot(direction, normalize(uUp));
        float vertical = smoothstep(.03, .91, height * .5 + .5);
        vec3 color = mix(uHorizon, uTop, pow(vertical, .31));
        float sun = max(dot(direction, normalize(uSun)), 0.0);
        color += uGlow * pow(sun, 12.0) * .20 * uDay;
        color += vec3(1.0, .88, .65) * pow(sun, 580.0) * .82 * uDay;
        vec3 cloudCoord = direction * vec3(5.4, 8.8, 5.4) + vec3(uTime * .008, 0.0, uTime * .003);
        float cloud = noise3(cloudCoord) * .63 + noise3(cloudCoord * 2.1) * .37;
        float cloudBand = smoothstep(-.1, .16, height) * (1.0 - smoothstep(.5, .94, height));
        vec3 cloudColor = mix(vec3(.06, .23, .43), vec3(1.0, .96, .89), uDay);
        color = mix(color, cloudColor, smoothstep(.52, .66, cloud) * cloudBand * uClouds * (.05 + uDay * .66));
        vec3 spaceColor = mix(vec3(.008, .017, .055), vec3(.025, .052, .115), smoothstep(-.7, .7, direction.y));
        color = mix(color, spaceColor, uSpace);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 32), material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function makeStars() {
  const count = 1900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = random(i * 9.14 + 2.1) * 2 - 1;
    const angle = random(i * 7.37 + 42.7) * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * ring * 3800;
    positions[i * 3 + 1] = y * 3800;
    positions[i * 3 + 2] = Math.sin(angle) * ring * 3800;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: '#fff8e7', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  return { mesh: new THREE.Points(geometry, material), material };
}

function makeAtmosphere() {
  const uniforms = {
    uSun: { value: new THREE.Vector3(.5, .8, .4) },
    uDay: { value: 1 },
    uSpace: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform float uDay;
      uniform float uSpace;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 eye = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(dot(normalize(vNormal), eye), 0.0), 4.0);
        float light = max(dot(normalize(vNormal), normalize(uSun)), 0.0);
        vec3 color = mix(vec3(.15, .24, .46), vec3(.32, .64, .88), uDay) * (.55 + light * .45);
        gl_FragColor = vec4(color, rim * uSpace * .21);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS + 63, 64, 40), material);
  mesh.visible = false;
  return { mesh, uniforms };
}

function makeCharacter() {
  const root = new THREE.Group();
  const facing = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(facing);
  facing.add(bodyGroup);
  const materials = {
    skin: new THREE.MeshLambertMaterial({ color: '#edc19d' }),
    hair: new THREE.MeshLambertMaterial({ color: '#463743' }),
    shirt: new THREE.MeshLambertMaterial({ color: '#e7a758' }),
    shorts: new THREE.MeshLambertMaterial({ color: '#526f83' }),
    blade: new THREE.MeshLambertMaterial({ color: '#d8a265' }),
    shoes: new THREE.MeshLambertMaterial({ color: '#493e45' }),
    eyes: new THREE.MeshLambertMaterial({ color: '#292b36' }),
  };
  const cube = (parent, material, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  cube(bodyGroup, materials.shirt, 0, .85, 0, .77, .78, .44);
  const armor = cube(bodyGroup, materials.shorts, 0, .86, -.255, .81, .68, .10);
  cube(bodyGroup, materials.shorts, 0, .43, 0, .72, .28, .44);
  cube(bodyGroup, materials.skin, 0, 1.57, 0, .78, .7, .65);
  cube(bodyGroup, materials.hair, 0, 1.94, -.03, .84, .26, .71);
  cube(bodyGroup, materials.hair, 0, 1.79, .31, .84, .16, .11);
  cube(bodyGroup, materials.eyes, -.17, 1.6, .333, .075, .10, .03);
  cube(bodyGroup, materials.eyes, .17, 1.6, .333, .075, .10, .03);
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-.48, 1.18, 0);
  rightArm.position.set(.48, 1.18, 0);
  facing.add(leftArm, rightArm);
  cube(leftArm, materials.skin, 0, -.29, 0, .24, .58, .31);
  cube(rightArm, materials.skin, 0, -.29, 0, .24, .58, .31);
  const sword = new THREE.Group();
  rightArm.add(sword);
  cube(sword, materials.hair, 0, -.67, .05, .13, .38, .13);
  const swordBlade = cube(sword, materials.blade, 0, -1.13, .05, .18, .58, .12);
  cube(sword, materials.blade, 0, -.88, .05, .40, .36, .10);
  const makeLeg = x => {
    const pivot = new THREE.Group();
    pivot.position.set(x, .4, 0);
    facing.add(pivot);
    cube(pivot, materials.shorts, 0, -.16, 0, .25, .36, .29);
    cube(pivot, materials.shoes, 0, -.38, .06, .29, .16, .4);
    return pivot;
  };
  const leftLeg = makeLeg(-.21);
  const rightLeg = makeLeg(.21);
  return { root, facing, bodyGroup, leftArm, rightArm, leftLeg, rightLeg, sword, swordBlade, armor };
}

function makeRespawnBeacon() {
  const direction = START_DIRECTION.clone().add(new THREE.Vector3(.018, 0, 0)).normalize();
  const root = new THREE.Group();
  root.name = 'respawn-beacon';
  root.position.copy(surfacePoint(direction, .02));
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const stone = new THREE.MeshLambertMaterial({ color: '#738b8f' });
  const light = new THREE.MeshBasicMaterial({ color: '#b8f0e3' });
  const add = (w, h, d, y, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = y;
    root.add(mesh);
  };
  add(1.7, .35, 1.7, .18, stone);
  add(.55, 1.15, .55, .92, stone);
  add(.85, .85, .85, 1.9, light);
  return root;
}

export function createWorld() {
  const scene = new THREE.Scene();
  const sky = makeSky();
  const stars = makeStars();
  const atmosphere = makeAtmosphere();
  const voxel = createVoxelTerrain();
  const character = makeCharacter();
  const respawnBeacon = makeRespawnBeacon();
  const decorations = new THREE.Group();
  scene.add(sky.mesh, stars.mesh, atmosphere.mesh, voxel.group, decorations, respawnBeacon, character.root);

  const ambient = new THREE.HemisphereLight('#edf6ff', '#59674d', 1.32);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff2cf', 1.75);
  sun.castShadow = false;
  scene.add(sun);
  scene.add(sun.target);
  const moonLight = new THREE.DirectionalLight('#97b7ee', 0);
  scene.add(moonLight);
  const moon = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: '#ffedce', fog: false }));
  scene.add(moon);
  return {
    scene, sky, stars, atmosphere, voxel, character, decorations, respawnBeacon, ambient, sun, moonLight, moon,
    grass: { uniforms: voxel.uniforms },
  };
}

export function updateWorld(world, timeOfDay, elapsed) {
  const hour = ((timeOfDay % 24) + 24) % 24;
  const altitude = Math.sin((hour - 6) / 24 * Math.PI * 2);
  const day = smoothstep(-.13, .24, altitude);
  const twilight = Math.max(0, 1 - Math.abs(hour - 18.5) / 2.4, 1 - Math.abs(hour - 5.5) / 2.4);
  const top = new THREE.Color('#124d99').lerp(new THREE.Color('#4c9de4'), day);
  const horizon = new THREE.Color('#12386e').lerp(new THREE.Color('#b8ddeb'), day);
  top.lerp(new THREE.Color('#776fa1'), twilight * .44);
  horizon.lerp(new THREE.Color('#f8bfa3'), twilight * .64);
  world.sky.uniforms.uTop.value.copy(top);
  world.sky.uniforms.uHorizon.value.copy(horizon);
  world.sky.uniforms.uGlow.value.set(twilight > .15 ? '#ffd4af' : '#fff1d8');
  world.sky.uniforms.uTime.value = elapsed;
  world.sky.uniforms.uDay.value = day;
  world.stars.material.opacity = (1 - day) * .92;

  const radial = world.character.root.position.clone().normalize();
  const { north, east } = getTangentFrame(radial);
  const sunDirection = radial.clone().multiplyScalar(altitude * 1.15)
    .addScaledVector(north, .42).addScaledVector(east, .65).normalize();
  world.sky.uniforms.uSun.value.copy(sunDirection);
  world.atmosphere.uniforms.uSun.value.copy(sunDirection);
  world.atmosphere.uniforms.uDay.value = day;
  world.voxel.uniforms.uTime.value = elapsed;
  world.voxel.uniforms.uDay.value = day;
  world.voxel.uniforms.uSun.value.copy(sunDirection);
  world.sun.position.copy(world.character.root.position).addScaledVector(sunDirection, 420);
  world.sun.target.position.copy(world.character.root.position);
  world.sun.target.updateMatrixWorld();
  world.sun.intensity = .16 + day * 1.78;
  world.sun.color.set(twilight > .15 ? '#ffd1ab' : '#fff3d6');
  world.ambient.intensity = 1.04 + day * .36;
  world.ambient.color.set(day > .4 ? '#ecf5ff' : '#a8bbe7');
  world.ambient.groundColor.set(day > .4 ? '#7e8569' : '#38466b');
  world.moonLight.position.copy(world.character.root.position).addScaledVector(radial, 420).addScaledVector(north, -270);
  world.moonLight.intensity = (1 - day) * 1.45;
  world.moon.position.copy(world.character.root.position).addScaledVector(radial, 210).addScaledVector(north, 600).addScaledVector(east, -140);
  world.moon.visible = day < .36;
  return { day, twilight };
}
