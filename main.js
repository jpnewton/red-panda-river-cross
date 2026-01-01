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
const clock = new THREE.Clock();

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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. DETAILED MODELS ---

function createRealisticCar(z, speed, direction) {
    const group = new THREE.Group();
    const bodyColor = [0xff4444, 0x4444ff, 0xeeeeee, 0xffff00][Math.floor(Math.random()*4)];
    const mat = new THREE.MeshPhongMaterial({ color: bodyColor });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x222222 });

    // Main Chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.4), mat);
    body.position.y = 0.5;
    group.add(body);

    // Top Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), glassMat);
    cabin.position.set(-0.2, 1.0, 0);
    group.add(cabin);

    // Headlights (Small white boxes)
    const lightGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const lightMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const leftLight = new THREE.Mesh(lightGeom, lightMat);
    leftLight.position.set(1.3, 0.6, 0.4);
    const rightLight = leftLight.clone();
    rightLight.position.z = -0.4;
    group.add(leftLight, rightLight);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const wheels = [[0.8, 0.3, 0.6], [0.8, 0.3, -0.6], [-0.8, 0.3, 0.6], [-0.8, 0.3, -0.6]];
    wheels.forEach(pos => {
        const w = new THREE.Mesh(wheelGeom, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });

    group.position.set(Math.random() * 30 - 15, 0, z);
    if (direction < 0) group.rotation.y = Math.PI; // Face the right way
    group.userData = { speed, direction, type: 'car' };
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    return group;
}

function createRealisticLog(z, speed, direction) {
    const group = new THREE.Group();
    const barkMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    const innerMat = new THREE.MeshPhongMaterial({ color: 0xbc8f8f });

    // Main Trunk (Cylinder)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.5, 12), barkMat);
    trunk.rotation.z = Math.PI / 2;
    trunk.position.y = 0.2;
    group.add(trunk);

    // Ends (Lighter rings)
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), innerMat);
    end.position.set(-2.25, 0.2, 0); end.rotation.y = -Math.PI/2;
    const end2 = end.clone();
    end2.position.set(2.25, 0.2, 0); end2.rotation.y = Math.PI/2;
    group.add(end, end2);

    group.position.set(Math.random() * 30 - 15, 0, z);
    group.userData = { speed, direction, type: 'log' };
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    return group;
}

// --- 3. GENERATE THE WORLD ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshPhongMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    ground.receiveShadow = true;
    scene.add(ground);

    const speed = 0.05 + Math.random() * 0.05;
    const direction = Math.random() > 0.5 ? 1 : -1;

    if (lane.type === 'water') {
        for (let i = 0; i < 3; i++) {
            const l = createRealisticLog(lane.z, speed, direction);
            obstacles.push(l); scene.add(l);
        }
    } else if (lane.type === 'road') {
        for (let i = 0; i < 2; i++) {
            const c = createRealisticCar(lane.z, speed * 1.5, direction);
            obstacles.push(c); scene.add(c);
        }
    }
});

const trophy = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8), new THREE.MeshPhongMaterial({ color: 0xffd700 }));
trophy.position.set(0, 1, -16);
scene.add(trophy);

// --- 4. PLAYER & LOGIC ---
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

function reset() { player.position.set(0, 0, 6); }

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;
    player.position.x = Math.max(-14, Math.min(14, player.position.x));
    if (player.position.z <= -16) { alert("You won!"); reset(); }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    trophy.rotation.y += 0.02;

    let onLog = false;

    if (player) {
        const lane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        
        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 20) obj.position.x = -20;
            if (obj.position.x < -20) obj.position.x = 20;

            // --- DEBUGGED COLLISION DETECTION ---
            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            // Car Collision (Deadly)
            if (obj.userData.type === 'car' && dz < 0.8 && dx < 2.2) {
                crashSound.play();
                reset();
            }
            // Log Collision (Safe)
            if (obj.userData.type === 'log' && dz < 0.8 && dx < 2.5) {
                onLog = true;
                player.position.x += obj.userData.speed * obj.userData.direction;
            }
        });

        if (lane && lane.type === 'water' && !onLog) {
            splashSound.play();
            reset();
        }
        camera.position.z = player.position.z + 10;
        camera.lookAt(player.position.x, 0, player.position.z);
    }
    renderer.render(scene, camera);
}
animate();
