import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

// --- CONFIGURATION ---
const GRID_SIZE = 2; 
const LANES = [
    { type: 'grass', z: 6 },
    { type: 'road',  z: 4 },  // New Road Lane
    { type: 'road',  z: 2 },  // New Road Lane
    { type: 'grass', z: 0 },
    { type: 'water', z: -2 },
    { type: 'water', z: -4 },
    { type: 'grass', z: -6 },
    { type: 'road',  z: -8 }, // Another Road Lane
    { type: 'water', z: -10 },
    { type: 'grass', z: -12 },
    { type: 'trophy', z: -16 }
];

let gameStarted = false;
let player = null;
let mixer = null;
const clock = new THREE.Clock();

// Audio setup
const splashSound = new Audio('assets/splash.mp3');
const crashSound = new Audio('https://actions.google.com/sounds/v1/impacts/crash_metal.ogg'); // Placeholder for car hit

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 15); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- WORLD GENERATION ---
const obstacles = [];

LANES.forEach(lane => {
    let color;
    if (lane.type === 'grass') color = 0x2ecc71;
    if (lane.type === 'water') color = 0x0077be;
    if (lane.type === 'road')  color = 0x333333; // Dark Grey for Asphalt
    if (lane.type === 'trophy') color = 0x2ecc71;

    const geometry = new THREE.BoxGeometry(40, 1, GRID_SIZE);
    const material = new THREE.MeshPhongMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, -0.5, lane.z);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Populate Water with Logs
    if (lane.type === 'water') {
        const speed = 0.04 + Math.random() * 0.03;
        const direction = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < 3; i++) {
            obstacles.push(createMovingObject(lane.z, speed, direction, 'log'));
        }
    }
    // Populate Road with Cars
    if (lane.type === 'road') {
        const speed = 0.06 + Math.random() * 0.05; // Cars are faster than logs
        const direction = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < 2; i++) {
            obstacles.push(createMovingObject(lane.z, speed, direction, 'car'));
        }
    }
});

function createMovingObject(z, speed, direction, type) {
    let geometry, material;
    
    if (type === 'log') {
        geometry = new THREE.BoxGeometry(3.5, 0.5, 1.4);
        material = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    } else {
        // Simple Car Shape
        geometry = new THREE.BoxGeometry(2.5, 1.2, 1.5);
        const carColors = [0xff0000, 0xffff00, 0xffffff, 0x0000ff];
        material = new THREE.MeshPhongMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)] });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 30 - 15, 0.2, z);
    mesh.userData = { speed, direction, type };
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
}

// --- TROPHY ---
const trophyGeom = new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8);
const trophyMat = new THREE.MeshPhongMaterial({ color: 0xffd700 });
const trophy = new THREE.Mesh(trophyGeom, trophyMat);
trophy.position.set(0, 1, -16);
scene.add(trophy);

// --- PLAYER LOADING ---
const loader = new GLTFLoader();
loader.load('assets/foxpacked.glb', (gltf) => {
    player = gltf.scene;
    player.scale.set(0.6, 0.6, 0.6);
    player.position.set(0, 0, 6);
    scene.add(player);
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
});

// --- MOVEMENT ---
function resetPosition() {
    player.position.set(0, 0, 6);
}

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player) return;

    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;

    player.position.x = Math.max(-14, Math.min(14, player.position.x));

    if (player.position.z <= -16) {
        alert("Victory! You reached the finish line!");
        resetPosition();
    }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    trophy.rotation.y += 0.02;

    let onLog = false;

    if (player) {
        const currentLane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        
        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 20) obj.position.x = -20;
            if (obj.position.x < -20) obj.position.x = 20;

            // Collision Check
            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.8 && dx < 2.0) {
                if (obj.userData.type === 'log') {
                    onLog = true;
                    player.position.x += obj.userData.speed * obj.userData.direction;
                } else if (obj.userData.type === 'car') {
                    crashSound.play();
                    resetPosition();
                }
            }
        });

        // Water Logic
        if (currentLane && currentLane.type === 'water' && !onLog) {
            splashSound.play();
            resetPosition();
        }

        camera.position.z = player.position.z + 10;
        camera.lookAt(player.position.x, 0, player.position.z);
    }

    renderer.render(scene, camera);
}
animate();