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
let player = null;
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

// --- 3. LIGHTING (Restored for best Kirby visibility) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 15, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 4. VEHICLE & LOG FACTORY ---
function createVehicle(z, direction) {
    const group = new THREE.Group();
    const carMat = new THREE.MeshStandardMaterial({ color: [0xd32f2f, 0x1976d2, 0x388e3c][Math.floor(Math.random()*3)] });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 1.4), carMat);
    base.position.y = 0.4; group.add(base);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), new THREE.MeshStandardMaterial({color: 0x222222}));
    cabin.position.set(-0.2, 1.0, 0); group.add(cabin);
    group.position.set(Math.random() * 40 - 20, 0, z);
    if (direction < 0) group.rotation.y = Math.PI;
    group.userData = { speed: 0.08 + Math.random() * 0.1, direction, type: 'car' };
    scene.add(group);
    return group;
}

function createRealisticLog(z, direction) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    log.rotation.z = Math.PI / 2;
    log.position.set(Math.random() * 40 - 20, 0.3, z);
    log.userData = { speed: 0.04 + Math.random() * 0.05, direction, type: 'log' };
    scene.add(log);
    return log;
}

// --- 5. WORLD GEN ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshStandardMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    scene.add(ground);
    const direction = Math.random() > 0.5 ? 1 : -1;
    if (lane.type === 'water') {
        for (let i = 0; i < 4; i++) obstacles.push(createRealisticLog(lane.z, direction));
    } else if (lane.type === 'road') {
        for (let i = 0; i < 2; i++) obstacles.push(createVehicle(lane.z, direction));
    }
});

// --- 6. KIRBY LOAD & HARD OFFSET FIX ---
const loader = new GLTFLoader();
loader.load('assets/Kirby.glb', (gltf) => {
    player = new THREE.Group(); // Create a container to handle the offset
    const model = gltf.scene;
    
    // SCALE
    model.scale.set(0.05, 0.05, 0.05); 

    // --- HARD OFFSET CORRECTION ---
    // If he's an "inch" too low and to the right, we move the model 
    // INSIDE the container to the left and up.
    model.position.x = -1.5; // Shift Left
    model.position.y = 0.8;  // Shift Up
    model.position.z = 0;

    player.add(model);
    player.position.set(0, 0, 6); // Container is at the correct start
    scene.add(player);

    player.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            if (node.material) {
                node.material.metalness = 0;
                node.material.roughness = 0.6;
            }
        }
    });
    
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
    }
}, undefined, (error) => {
    console.error("Load Error:", error);
});

// --- 7. LOGIC ---
function reset() { if(player) player.position.set(0, 0, 6); }

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player || isDead) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;
    if (player.position.z <= -16) { alert("Kirby Won!"); reset(); }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    
    if (player && gameStarted) {
        const lane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        let onLog = false;

        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 30) obj.position.x = -30;
            if (obj.position.x < -30) obj.position.x = 30;

            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.9 && !isDead) {
                if (obj.userData.type === 'car' && dx < 2.5) { crashSound.play(); reset(); }
                if (obj.userData.type === 'log' && dx < 2.2) { 
                    onLog = true; player.position.x += obj.userData.speed * obj.userData.direction; 
                }
            }
        });
        if (lane && lane.type === 'water' && !onLog) { splashSound.play(); reset(); }

        camera.position.z = player.position.z + 10;
        camera.lookAt(0, 0, player.position.z - 5);
    }
    renderer.render(scene, camera);
}
animate();
