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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. ENHANCED OBJECT CREATOR ---
const obstacles = [];

function createDetailedObject(z, speed, direction, type) {
    const group = new THREE.Group();

    if (type === 'log') {
        const logGeom = new THREE.CylinderGeometry(0.5, 0.5, 4, 12);
        const logMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
        const mesh = new THREE.Mesh(logGeom, logMat);
        mesh.rotation.z = Math.PI / 2;
        group.add(mesh);
        // Add a knot
        const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8), logMat);
        knot.position.set(1, 0.4, 0);
        group.add(knot);

    } else if (type === 'stick') {
        const stickMat = new THREE.MeshPhongMaterial({ color: 0x3e2723 });
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.5, 8), stickMat);
        mesh.rotation.z = Math.PI / 2;
        group.add(mesh);

    } else if (type === 'tire') {
        const tireGeom = new THREE.TorusGeometry(0.5, 0.2, 12, 24);
        const tireMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const mesh = new THREE.Mesh(tireGeom, tireMat);
        mesh.rotation.x = Math.PI / 2;
        group.add(mesh);

    } else if (type === 'car') {
        const carColors = [0xff4444, 0xffff44, 0x4444ff, 0xffffff];
        const bodyMat = new THREE.MeshPhongMaterial({ color: carColors[Math.floor(Math.random()*carColors.length)] });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.4), bodyMat);
        body.position.y = 0.4;
        group.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), bodyMat);
        cabin.position.y = 1.0;
        group.add(cabin);
    }

    group.position.set(Math.random() * 30 - 15, 0.1, z);
    group.userData = { speed, direction, type };
    group.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(group);
    return group;
}

// --- 3. GENERATE THE WORLD ---
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x333333);
    const ground = new THREE.Mesh(
        new THREE.BoxGeometry(60, 1, GRID_SIZE),
        new THREE.MeshPhongMaterial({ color })
    );
    ground.position.set(0, -0.5, lane.z);
    ground.receiveShadow = true;
    scene.add(ground);

    if (lane.type === 'water') {
        const speed = 0.04 + Math.random() * 0.03;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const types = ['log', 'stick', 'tire'];
        for (let i = 0; i < 3; i++) {
            obstacles.push(createDetailedObject(lane.z, speed, direction, types[Math.floor(Math.random()*types.length)]));
        }
    }
    if (lane.type === 'road') {
        const speed = 0.07 + Math.random() * 0.04;
        const direction = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < 2; i++) {
            obstacles.push(createDetailedObject(lane.z, speed, direction, 'car'));
        }
    }
});

// Trophy
const trophy = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8),
    new THREE.MeshPhongMaterial({ color: 0xffd700 })
);
trophy.position.set(0, 1, -18);
scene.add(trophy);

// --- 4. PLAYER & INPUT ---
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
    if (player.position.z <= -18) { alert("Winner!"); reset(); }
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

            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.8 && dx < 2.0) {
                if (obj.userData.type === 'car') { crashSound.play(); reset(); }
                else { 
                    onPlatform = true; 
                    player.position.x += obj.userData.speed * obj.userData.direction; 
                }
            }
        });

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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
