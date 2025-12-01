import "./style.css";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GUI } from "lil-gui";

// -----------------------------------------------------
// BASIC SETUP
// -----------------------------------------------------
const app = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(5, 5, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

scene.add(new THREE.AxesHelper(1));

// -----------------------------------------------------
// LIGHTS
// -----------------------------------------------------

// Ambient soft fill
const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

// Directional sun
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 15, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);

// -----------------------------------------------------
// 5 POINT LIGHTS + VISUAL SPHERES + HELPERS
// -----------------------------------------------------
const lights = [];
const lightSpheres = [];
const lightHelpers = [];

// initial positions for 5 lights
const initialPositions = [
  new THREE.Vector3(0, 3, 0),
  new THREE.Vector3(3, 2, 0),
  new THREE.Vector3(-3, 2, 0),
  new THREE.Vector3(0, 2, 3),
  new THREE.Vector3(0, 2, -3),
];

const sphereGeo = new THREE.SphereGeometry(0.15, 16, 16);

for (let i = 0; i < 5; i++) {
  const pLight = new THREE.PointLight(0xffffff, 2.5, 40);
  pLight.castShadow = true;
  pLight.position.copy(initialPositions[i]);
  scene.add(pLight);
  lights.push(pLight);

  const sphere = new THREE.Mesh(
    sphereGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  sphere.position.copy(pLight.position);
  scene.add(sphere);
  lightSpheres.push(sphere);

  const helper = new THREE.PointLightHelper(pLight, 0.3);
  scene.add(helper);
  lightHelpers.push(helper);
}

// -----------------------------------------------------
// LOAD MODEL
// -----------------------------------------------------
const loader = new GLTFLoader();
let modelRoot = null;

loader.load(
  "SHop_Model_(1).glb", // make sure this is really at public/scene.glb
  (gltf) => {
    modelRoot = gltf.scene;

    modelRoot.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        const mat = obj.material;
        if (mat && mat.map) {
          mat.map.encoding = THREE.SRGBEncoding;
          mat.map.anisotropy = 4;
          mat.map.needsUpdate = true;
        }
      }
    });

    scene.add(modelRoot);

    // Auto-frame camera around model
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8;

    camera.position.copy(
      new THREE.Vector3(center.x + dist, center.y + dist, center.z + dist)
    );
    camera.lookAt(center);

    controls.target.copy(center);
    controls.update();
  },
  undefined,
  (error) => {
    console.error("GLB load error:", error);
  }
);

// -----------------------------------------------------
// KEY INPUT: CAMERA + ACTIVE LIGHT
// -----------------------------------------------------
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  PageUp: false,
  PageDown: false,
};

window.addEventListener("keydown", (e) => {
  if (e.code in keys) keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code in keys) keys[e.code] = false;
});

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const moveDir = new THREE.Vector3();

function updateCameraMovement(delta) {
  const speed = 5; // camera units per second

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  right.crossVectors(forward, camera.up).normalize();

  moveDir.set(0, 0, 0);

  if (keys.KeyW) moveDir.add(forward);
  if (keys.KeyS) moveDir.sub(forward);
  if (keys.KeyA) moveDir.sub(right);
  if (keys.KeyD) moveDir.add(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize().multiplyScalar(speed * delta);
    camera.position.add(moveDir);
    controls.target.add(moveDir);
  }
}

// which light to control with arrow keys
const params = {
  activeLight: 0, // index 0..4
};

// move selected light with keyboard
function updateLightMovement(delta) {
  const l = lights[params.activeLight];
  if (!l) return;

  const lightSpeed = 4 * delta;

  if (keys.ArrowUp) l.position.z -= lightSpeed;
  if (keys.ArrowDown) l.position.z += lightSpeed;
  if (keys.ArrowLeft) l.position.x -= lightSpeed;
  if (keys.ArrowRight) l.position.x += lightSpeed;
  if (keys.PageUp) l.position.y += lightSpeed;
  if (keys.PageDown) l.position.y -= lightSpeed;

  // sync spheres + helpers
  for (let i = 0; i < lights.length; i++) {
    lightSpheres[i].position.copy(lights[i].position);
    lightHelpers[i].update();
  }
}

// -----------------------------------------------------
// GUI PANEL (lil-gui)
// -----------------------------------------------------
const gui = new GUI();

const globalFolder = gui.addFolder("Global");
globalFolder.add(ambient, "intensity", 0, 2, 0.01).name("Ambient Intensity");
globalFolder.add(sun, "intensity", 0, 5, 0.1).name("Sun Intensity");

// dropdown to choose which light keyboard controls affect
const lightNames = {
  "Light 1": 0,
  "Light 2": 1,
  "Light 3": 2,
  "Light 4": 3,
  "Light 5": 4,
};
globalFolder
  .add(params, "activeLight", lightNames)
  .name("Active Light (keys)");

globalFolder.open();

// one folder per light
for (let i = 0; i < lights.length; i++) {
  const light = lights[i];
  const folder = gui.addFolder(`Light ${i + 1}`);

  folder.add(light.position, "x", -20, 20, 0.1).name("pos X");
  folder.add(light.position, "y", 0, 20, 0.1).name("pos Y");
  folder.add(light.position, "z", -20, 20, 0.1).name("pos Z");

  folder.add(light, "intensity", 0, 10, 0.1).name("intensity");
  folder.add(light, "distance", 0, 100, 1).name("distance");
  folder
    .addColor({ color: light.color.getHex() }, "color")
    .name("color")
    .onChange((value) => {
      light.color.set(value);
      lightSpheres[i].material.color.set(value);
    });

  folder.open();
}

// -----------------------------------------------------
// RESIZE + LOOP
// -----------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();

  updateCameraMovement(delta);
  updateLightMovement(delta);

  controls.update();
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

animate();
