import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

// --- 1. CONFIGURATION ---
const GRID_SIZE = 2; 
const LANES = [
    { type: 'grass', z: 6 },
    { type: 'road',  z: 4 },
    { type: 'road',  z: 2 },
    { type: 'grass', z: 0 },
    { type: 'water', z: -2 },
    { type: 'water', z: -4 },
    { type: 'grass', z: -6 },
    { type: 'road',  z: -8 },
    { type: 'water', z: -10 },
    { type: 'grass', z: -12 },
    { type: 'trophy', z: -16 }
];

let gameStarted = false;
let player = new THREE.Group(); // Player is now a group so we can swap models
let mixer = null;
let isDead = false;
const clock = new THREE.Clock();

const splashSound = new Audio('assets/splash.mp3');
const crashSound = new Audio('https://actions.google.com/sounds/v1/impacts/crash_metal.ogg');

// --- 2. SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- 3. HIGH-DEF LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- 4. ADVANCED CARS (Extruded Shapes) ---
function createCarShape() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.4, 0);   // Bottom
    shape.lineTo(2.4, 0.4); // Rear Bumper
    shape.lineTo(2.0, 0.4); 
    shape.lineTo(1.6, 1.0); // Rear Window
    shape.lineTo(0.8, 1.0); // Roof
    shape.lineTo(0.5, 0.5); // Windshield
    shape.lineTo(0.0, 0.4); // Hood
    return shape;
}

function createVehicle(z, direction) {
    const group = new THREE.Group();
    
    // Aerodynamic Body
    const extrudeSettings = { steps: 1, depth: 1.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
    const carColor = [0xd32f2f, 0x1976d2, 0x2e7d32, 0xf9a825][Math.floor(Math.random() * 4)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.2, metalness: 0.4 });
    const geometry = new THREE.ExtrudeGeometry(createCarShape(), extrudeSettings);
    geometry.center(); // Center geometry around origin
    const body = new THREE.Mesh(geometry, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    [[0.8, 0.35, 0.7], [0.8, 0.35, -0.7], [-0.8, 0.35, 0.7], [-0.8, 0.35, -0.7]].forEach(pos => {
        const w = new THREE.Mesh(wheelGeom, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });

    // Headlights
    const lightGeom = new THREE.CircleGeometry(0.15, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const hl1 = new THREE.Mesh(lightGeom, lightMat); hl1.rotation.y = -Math.PI/2; hl1.position.set(-1.25, 0.5, 0.4); group.add(hl1);
    const hl2 = hl1.clone(); hl2.position.set(-1.25, 0.5, -0.4); group.add(hl2);

    group.position.set(Math.random() * 40 - 20, 0, z);
    if (direction > 0) group.rotation.y = Math.PI;
    
    group.userData = { speed: 0.08 + Math.random() * 0.1, direction, type: 'car' };
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    scene.add(group);
    return group;
}

function createRealisticLog(z, direction) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.5, 16), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    log.rotation.z = Math.PI / 2;
    log.position.set(Math.random() * 40 - 20, 0.3, z);
    log.userData = { speed: 0.04 + Math.random() * 0.05, direction, type: 'log' };
    log.castShadow = true;
    scene.add(log);
    return log;
}

// --- 5. WORLD GEN ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshStandardMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    ground.receiveShadow = true;
    scene.add(ground);
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (lane.type === 'water') for (let i=0; i<4; i++) obstacles.push(createRealisticLog(lane.z, dir));
    else if (lane.type === 'road') for (let i=0; i<2; i++) obstacles.push(createVehicle(lane.z, dir));
});

// --- 6. FAIL-SAFE PLAYER SYSTEM ---
// Step 1: Add Player Group to scene immediately so game logic works
player.position.set(0, 0, 6);
scene.add(player);

// Step 2: Create "Procedural Kirby" (Pink Sphere + Shoes)
function createProceduralKirby() {
    const kirby = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.2 }));
    body.position.y = 0.5;
    kirby.add(body);
    // Shoes
    const shoeGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const leftShoe = new THREE.Mesh(shoeGeom, shoeMat); leftShoe.position.set(-0.3, 0.1, 0); leftShoe.scale.set(1, 0.6, 1.5); kirby.add(leftShoe);
    const rightShoe = new THREE.Mesh(
