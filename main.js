import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

// --- 1. CONFIGURATION & STATE ---
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
    { type: 'water', z: -12 },
    { type: 'grass', z: -14 },
    { type: 'trophy', z: -18 }
];

let gameStarted = false;
let player = null;
let mixer = null;
const clock = new THREE.Clock();

// Audio
const splashSound = new Audio('assets/splash.mp3');
const crashSound = new Audio('https://actions.google.com/sounds/v1/impacts/crash_metal.ogg');

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 15); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. REALISTIC OBJECT CREATORS ---

function createDetailedCar(z, speed, direction) {
    const group = new THREE.Group();
    const carColors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2];
    const bodyColor = carColors[Math.floor(Math.random() * carColors.length)];
    const bodyMat = new THREE.MeshPhongMaterial({ color: bodyColor });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x333333, transparent: true, opacity: 0.8 });
    const tireMat = new THREE.MeshPhongMaterial({ color: 0x111111 });

    // Lower Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.4), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // Upper Cabin (Windows)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), glassMat);
    cabin.position.set(-0.2, 1.0, 0);
    group.add(cabin);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12);
    const wheelPos = [[0.7, 0.2, 0.6], [0.7, 0.2, -0.6], [-0.7, 0.2, 0.6], [-0.7, 0.2, -0.6]];
    wheelPos.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeom, tireMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        group.add(wheel);
    });

    group.position.set(Math.random() * 30 - 15, 0, z);
    group.userData = { speed, direction, type: 'car' };
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    return group;
}

function createDetailedLog(z, speed, direction) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    const endMat = new THREE.MeshPhongMaterial({ color: 0x8d6e63 });

    // Main Trunk
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 12), woodMat);
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.3;
    group.add(log);

    // Log Ends (Rings)
    const endGeom = new THREE.CircleGeometry(0.5, 12);
    const end1 = new THREE.Mesh(endGeom, endMat);
    end1.position.set(-2, 0.3, 0); end1.rotation.y = -Math.PI/2;
    group.add(end1);
    
    const end2 = end1.clone();
    end2.position.set(2, 0.3, 0); end2.rotation.y = Math.PI/2;
    group.add(end2);

    group.position.set(Math.random() * 30 - 15, 0, z);
    group.userData = { speed, direction, type: 'log' };
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    return group;
}

// --- 3. GENERATE THE WORLD ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(
        new THREE.BoxGeometry(60, 1, GRID_SIZE),
        new THREE.MeshPhongMaterial({ color })
    );
    ground.position.set(0, -0.5, lane.z); // Top of ground is at y=0
    ground.receiveShadow = true;
    scene.add(ground);

    if (lane.type === 'water') {
        const speed = 0.04 + Math.random() * 0.03;
        const direction = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < 3; i++) {
            const log = createDetailedLog(lane.z, speed, direction);
            obstacles.push(log);
            scene.add(log);
        }
    }
    if (lane.type === 'road') {
        const speed = 0.08 + Math.random() * 0.04;
        const direction = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < 2; i++) {
            const car = createDetailedCar(lane.z, speed, direction);
            obstacles.push(car);
            scene.add(car);
        }
    }
});

// Trophy
const trophy = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8),
    new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 })
);
trophy.position.set(0, 1, -18);
scene.add(trophy);

// --- 4. PLAYER & INPUT ---
const loader = new GLTFLoader();
loader.load('assets/foxpacked.glb', (gltf) => {
    player = gltf.scene;
    player.scale.set(0.7, 0.7, 0.7);
    player.position.set(0, 0, 6); // Grounded at y=0
    scene.add(player);
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
});

function reset() {
    player.position.set(0, 0, 6);
}

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;

    player.position.x = Math.max(-14, Math.min(14, player.position.x));

    if (player.position.z <= -18) {
        alert("You Won! The Fox is home!");
        reset();
    }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- 5. GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    trophy.rotation.y += 0.02;

    let onPlatform = false;

    if (player) {
        const currentLane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        
        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 25) obj.position.x = -25;
            if (obj.position.x < -25) obj.position.x = 25;

            // Collision Check
            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.9 && dx < 1.8) {
                if (obj.userData.type === 'car') {
                    crashSound.play();
                    reset();
                } else if (obj.userData.type === 'log') {
                    onPlatform = true;
                    player.position.x += obj.userData.speed * obj.userData.direction;
                }
            }
        });

        // Water Death Check
        if (currentLane && currentLane.type === 'water' && !onPlatform) {
            splashSound.play();
            reset();
        }

        camera.position.z = player.position.z + 10;
        camera.lookAt(player.position.x, 0, player.position.z);
    }
    renderer.render(scene, camera);
}
animate();
